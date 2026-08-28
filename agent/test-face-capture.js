#!/usr/bin/env node
/**
 * Phase 3d — SAFE, REVERSIBLE diagnostic for LIVE remote face capture.
 *
 * This exists because the full (untruncated) capability dump confirmed
 * isSupportCaptureFace: true on the real device - a claim the earlier,
 * truncated Phase 1 probe never actually made and that test-face-enroll.js
 * (the photo-upload path) does not test. That correction matters: it
 * means the original "stand in front of the terminal, look at camera"
 * live UX may genuinely be possible here via a CaptureFace endpoint
 * sibling to the confirmed CaptureFingerPrint one, not just the
 * photo-upload fallback.
 *
 * Unlike test-fingerprint-capture.js, we do NOT yet have CaptureFace's own
 * /capabilities response (probe-accesscontrol-full.js now requests it -
 * run that again first if you haven't already, and check the saved
 * raw-CaptureFace-capabilities-*.xml file for the exact schema before
 * relying on the guesses below). This script tries plausible request
 * bodies the same way test-fingerprint-capture.js did before its schema
 * was confirmed.
 *
 * WHAT THIS DOES:
 *  1. Creates a throwaway test user (employeeNo 9999999 by default).
 *  2. Tries POST /ISAPI/AccessControl/CaptureFace with a few candidate
 *     bodies, stopping at the first non-404/non-error response.
 *  3. Redacts any returned face image/template data before printing -
 *     never logs raw biometric bytes.
 *  4. Deletes the test user afterward (unless --keep).
 *
 * Usage:
 *   node test-face-capture.js <device-ip> <username> <password> [port] [--employee 9999999] [--keep]
 */
const { isapiRequest } = require("../shared/isapi/isapiClient");
const { createTestUser, deleteTestUser } = require("./_testDeviceUser");

const VALUE_FLAGS = new Set(["--employee"]);
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
const [ip, username, password, maybePort] = positional;
const port = /^\d+$/.test(maybePort || "") ? Number(maybePort) : 80;
const keep = flags.keep;
const employeeNo = flags.employee || "9999999";

if (!ip || !username || !password) {
  console.error("Usage: node test-face-capture.js <device-ip> <username> <password> [port] [--employee 9999999] [--keep]");
  process.exit(1);
}

const device = { ip, port, username, password };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function redactBiometric(body) {
  if (!body || typeof body !== "object") return body;
  const clone = { ...body };
  for (const key of ["faceData", "fingerData", "faceURL", "facePicture"]) {
    if (key in clone) clone[key] = `[redacted, ${String(clone[key]).length} chars]`;
  }
  return clone;
}

// Not confirmed - CaptureFace/capabilities (requested by
// probe-accesscontrol-full.js) will give the real schema, same as it did
// for CaptureFingerPrint. Trying the most likely shapes by analogy in the
// meantime, most-plausible-first.
const CANDIDATE_BODIES = [
  { label: "empty body", body: undefined },
  { label: "CaptureFaceCond {} (empty, mirrors CaptureFingerPrintCond wrapper)", body: { CaptureFaceCond: {} } },
  { label: "CaptureFaceCond { employeeNo }", body: { CaptureFaceCond: { employeeNo } } },
];

async function tryCapture() {
  console.log("\nAttempting POST /ISAPI/AccessControl/CaptureFace with candidate bodies.");
  console.log("If any attempt returns something other than 404, WATCH THE DEVICE SCREEN -");
  console.log("it may be prompting for a face right now. Have the test subject look at the");
  console.log("camera promptly; capture calls are typically short-lived/blocking.\n");

  for (const candidate of CANDIDATE_BODIES) {
    console.log(`--- Trying: ${candidate.label} ---`);
    try {
      const res = await isapiRequest(device, "/ISAPI/AccessControl/CaptureFace?format=json", "POST", candidate.body);
      console.log(`HTTP ${res.status}`);
      console.log(JSON.stringify(redactBiometric(res.body), null, 2));

      if (res.status === 404) {
        console.log("-> 404: this endpoint does not exist at this path on this firmware. Stopping -");
        console.log("   further bodies won't change a 404. Check raw-CaptureFace-capabilities-*.xml");
        console.log("   from probe-accesscontrol-full.js for the real endpoint name/path before");
        console.log("   concluding live face capture is unsupported (isSupportCaptureFace: true");
        console.log("   is confirmed, so a 404 here likely means the wrong path was guessed).");
        return { supported: false };
      }
      if (res.ok) {
        console.log("-> Got a non-error response. This is the shape Phase 5's real");
        console.log("   implementation should use. Copy this exact request/response pair");
        console.log("   (with the redaction noted) into the conversation to confirm the design.");
        return { supported: true, workingBody: candidate.body };
      }
      console.log(`-> HTTP ${res.status} (not 404, not success) - device understood the endpoint`);
      console.log("   exists but rejected this exact body shape. Trying the next candidate...");
    } catch (err) {
      console.log(`-> Request failed: ${err.message}`);
    }
    await sleep(500);
  }

  console.log("\nNo candidate body succeeded, but none returned 404 either - the endpoint likely");
  console.log("exists but needs a different request shape. Share the HTTP statuses/bodies above");
  console.log("(and the CaptureFace/capabilities schema once probed) and we'll adjust.");
  return { supported: "unknown" };
}

(async () => {
  try {
    console.log(`\nCreating throwaway test user (employeeNo=${employeeNo})...`);
    const createRes = await createTestUser(device, employeeNo, "TEST-FACE-CAPTURE-PROBE");
    console.log(`  -> HTTP ${createRes.status}`, JSON.stringify(createRes.body).slice(0, 300));
    if (!createRes.ok) {
      throw new Error("Could not create test user - stopping before attempting capture (nothing to clean up).");
    }

    const result = await tryCapture();
    console.log("\n========== RESULT ==========");
    console.log(JSON.stringify({ supported: result.supported }, null, 2));
    console.log("=============================");
  } catch (err) {
    console.error("\nStopped:", err.message);
  } finally {
    if (!keep) {
      console.log(`\nDeleting test user (employeeNo=${employeeNo})...`);
      const delRes = await deleteTestUser(device, employeeNo);
      console.log(`  -> HTTP ${delRes.status}`, JSON.stringify(delRes.body).slice(0, 300));
    } else {
      console.log(`\n--keep passed: test user ${employeeNo} left on the device.`);
    }
  }
})();
