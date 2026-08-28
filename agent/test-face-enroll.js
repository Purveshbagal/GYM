#!/usr/bin/env node
/**
 * Phase 3c — SAFE, REVERSIBLE diagnostic for face enrollment.
 *
 * Context: the confirmed capability report already answers the important
 * question here - FDLib capabilities returned isSupportFDExecuteControl:
 * false, which is Hikvision's own flag for "no remote execute/trigger
 * control over face capture." Combined with there being no
 * CaptureFace-style endpoint anywhere in the confirmed capabilities (only
 * FDLib post/delete/put/get/setUp - library record management), the
 * live "stand in front of the terminal, look at camera, done" UX the spec
 * originally asked for is NOT available via ISAPI on this firmware. This
 * script exists to confirm the ONE thing that IS plausible: pushing an
 * existing face PHOTO into the device via FaceDataRecord.
 *
 * WHAT THIS DOES:
 *  1. GET /ISAPI/Intelligent/FDLib to find a real FDID to test against
 *     (read-only).
 *  2. Creates a throwaway test user (see test-fingerprint-capture.js for
 *     why 9999999 is safe).
 *  3. Starts a tiny local HTTP server on THIS PC (LAN-only, not
 *     internet-exposed) serving one sample image, because faceURL is a
 *     URL the device fetches itself over your LAN - it cannot reach the
 *     internet/backend directly, so an agent-hosted local URL is the only
 *     address that could plausibly work.
 *  4. POSTs FaceDataRecord with that local faceURL and prints the exact
 *     result, so Phase 5 is built against a confirmed shape, not a guess.
 *  5. Deletes the test user at the end (unless --keep).
 *
 * --fdid is now REQUIRED, not defaulted: a DS-K1T320EFWX can expose more
 * than one face library (e.g. FDID 1 "blackFD" for the visible-light
 * camera, FDID 2 "infraredFD" for an IR sensor if the hardware has one),
 * and which one the terminal's own recognition engine actually searches
 * during verification is a device-configuration fact, not something to
 * guess from the list alone. Run probe-facelib.js first to see which
 * library actually has content / is the one staff already enrolls into
 * locally, then pass that FDID explicitly here.
 *
 * Usage:
 *   node test-face-enroll.js <device-ip> <username> <password> <sample-image.jpg> --fdid <id> [port] [--employee 9999999] [--keep]
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");
const { isapiRequest } = require("../shared/isapi/isapiClient");
const { createTestUser, deleteTestUser } = require("./_testDeviceUser");

// Flags that take a value must have that value excluded from the
// positional args too - a plain `.filter(a => !a.startsWith("--"))`
// leaves a flag's value (e.g. the "1" in "--fdid 1") in the positional
// list, which silently shifts every positional after it.
const VALUE_FLAGS = new Set(["--fdid", "--employee"]);
const rawArgs = process.argv.slice(2);
const positional = [];
const flags = { keep: false };
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === "--keep") {
    flags.keep = true;
  } else if (VALUE_FLAGS.has(a)) {
    flags[a.slice(2)] = rawArgs[++i];
  } else if (!a.startsWith("--")) {
    positional.push(a);
  }
}
const [ip, username, password, imagePath, maybePort] = positional;
const port = /^\d+$/.test(maybePort || "") ? Number(maybePort) : 80;
const keep = flags.keep;
let fdid = flags.fdid || null;
const employeeNo = flags.employee || "9999999";

if (!ip || !username || !password || !imagePath) {
  console.error(
    "Usage: node test-face-enroll.js <device-ip> <username> <password> <sample-image.jpg> [port] [--fdid 1] [--employee 9999999] [--keep]"
  );
  process.exit(1);
}
if (!fs.existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}`);
  process.exit(1);
}
const imageExt = path.extname(imagePath).toLowerCase();
if (![".jpg", ".jpeg", ".png"].includes(imageExt)) {
  console.error("Confirmed capability: facePicFormat is only jpg/png. Use a .jpg or .png file.");
  process.exit(1);
}

const device = { ip, port, username, password };

function lanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

function startImageServer(filePath) {
  const data = fs.readFileSync(filePath);
  const contentType = filePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const server = http.createServer((req, res) => {
    console.log(`[image-server] ${req.method} ${req.url} (device fetching the test photo)`);
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": data.length });
    res.end(data);
  });
  return new Promise((resolve) => {
    server.listen(0, "0.0.0.0", () => resolve(server));
  });
}

async function listFaceLibraries() {
  console.log("\nListing face libraries via GET /ISAPI/Intelligent/FDLib...");
  const res = await isapiRequest(device, "/ISAPI/Intelligent/FDLib?format=json", "GET");
  console.log(`  -> HTTP ${res.status}`, JSON.stringify(res.body).slice(0, 500));
  // Confirmed real shape from the device: { statusCode, statusString,
  // subStatusCode, FDLib: [{ FDID, faceLibType, name }, ...] }. Kept the
  // older guessed key names too in case a different firmware build uses
  // them, but FDLib is what this exact device returns.
  return res.body?.FDLib || res.body?.FDLibList || res.body?.FaceLibList || [];
}

(async () => {
  let server;
  try {
    const libraries = await listFaceLibraries();
    if (!fdid) {
      console.log("\nAvailable libraries:");
      for (const lib of libraries) console.log(`  FDID ${lib.FDID} - faceLibType: ${lib.faceLibType} - name: "${lib.name || ""}"`);
      throw new Error(
        "--fdid is required. Run probe-facelib.js to see which library is actually in " +
          "use before choosing - do not guess between multiple libraries."
      );
    }
    const chosen = libraries.find((l) => String(l.FDID) === String(fdid));
    if (!chosen) {
      throw new Error(`FDID ${fdid} was not in the device's own library list (${libraries.map((l) => l.FDID).join(", ")}).`);
    }
    const faceLibType = chosen.faceLibType;
    console.log(`\nUsing FDID ${fdid} (faceLibType: ${faceLibType})`);

    console.log(`\nCreating throwaway test user (employeeNo=${employeeNo})...`);
    const createRes = await createTestUser(device, employeeNo, "TEST-FACE-PROBE");
    console.log(`  -> HTTP ${createRes.status}`, JSON.stringify(createRes.body).slice(0, 300));
    if (!createRes.ok) throw new Error("Could not create test user - stopping.");

    server = await startImageServer(imagePath);
    const { port: serverPort } = server.address();
    const faceUrl = `http://${lanIp()}:${serverPort}/${path.basename(imagePath)}`;
    console.log(`\nServing test image locally at: ${faceUrl}`);
    console.log("(This must be reachable from the DEVICE's network, i.e. run this script on");
    console.log(" the same LAN/PC the agent will run on - not from an unrelated machine.)");

    console.log("\nPOST /ISAPI/Intelligent/FDLib/FaceDataRecord ...");
    const res = await isapiRequest(device, "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json", "POST", {
      faceLibType,
      FDID: String(fdid),
      FPID: employeeNo,
      faceURL: faceUrl,
    });
    console.log(`  -> HTTP ${res.status}`);
    console.log(JSON.stringify(res.body, null, 2));

    if (res.ok) {
      console.log("\n✓ Face photo accepted by the device. This confirms the photo-upload path");
      console.log("  works and is the shape Phase 5 should implement.");
    } else {
      console.log("\n✗ Device rejected the request. Common causes to check from the response");
      console.log("  above: wrong FDID, faceURL not reachable from the device's network, image");
      console.log("  too large, or no face detected in the photo. Share this output to adjust.");
    }
  } catch (err) {
    console.error("\nStopped:", err.message);
  } finally {
    if (server) server.close();
    if (!keep) {
      console.log(`\nDeleting test user (employeeNo=${employeeNo})...`);
      const delRes = await deleteTestUser(device, employeeNo);
      console.log(`  -> HTTP ${delRes.status}`, JSON.stringify(delRes.body).slice(0, 300));
    } else {
      console.log(`\n--keep passed: test user ${employeeNo} left on the device.`);
    }
  }
})();
