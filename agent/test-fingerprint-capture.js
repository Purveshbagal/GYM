#!/usr/bin/env node
/**
 * Phase 3b — SAFE, REVERSIBLE diagnostic for remote fingerprint capture.
 *
 * WHAT THIS DOES:
 *  1. Creates a throwaway test user on the device (default employeeNo
 *     9999999 - won't collide with real members, which use small
 *     sequential IDs starting at 1000 per backend/src/app/api/members/route.ts).
 *  2. Tries POST /ISAPI/AccessControl/CaptureFingerPrint with a short list
 *     of plausible request bodies, since Hikvision's exact required shape
 *     for this specific firmware isn't confirmed yet - we don't have
 *     network access to test against your real device ourselves, so this
 *     script is built to iterate safely and report exactly what the
 *     device says back, rather than assume one shape is correct.
 *  3. Prints (never writes to disk) whatever the device returns, so we
 *     can read the real error/success schema and design Phase 4 against
 *     it - not against a guess.
 *  4. Deletes the test user again at the end (unless --keep is passed).
 *
 * WHAT THIS DOES NOT DO:
 *  - Touch any real member's employeeNo.
 *  - Persist any captured fingerprint data anywhere (console only).
 *  - Assume success - a 404 here is a real, useful answer ("this
 *    firmware does not expose this endpoint"), not a bug to work around.
 *
 * CONFIRMED SCHEMA (from GET /ISAPI/AccessControl/CaptureFingerPrint/capabilities
 * against the real device):
 *   <CaptureFingerPrint><CaptureFingerPrintCond><fingerNo min="1" max="10">
 *   </fingerNo></CaptureFingerPrintCond><fingerData min="1" max="768">
 *   </fingerData><fingerNo min="1" max="10"></fingerNo>
 *   <fingerPrintQuality min="1" max="100"></fingerPrintQuality></CaptureFingerPrint>
 * i.e. request is keyed by `fingerNo` (which of the 10 finger slots to
 * capture into), NOT by employeeNo - capture is independent of any user;
 * you separately assign the returned fingerData to a user via
 * FingerPrintCfg. Response should contain fingerData (the raw template -
 * redacted below, never printed/logged) and fingerPrintQuality.
 *
 * Usage:
 *   node test-fingerprint-capture.js <device-ip> <username> <password> [port] [--finger 1] [--employee 9999999] [--keep]
 */
const { isapiRequest } = require("../shared/isapi/isapiClient");
const { createTestUser, deleteTestUser } = require("./_testDeviceUser");

// Flags that take a value must have that value excluded from the
// positional args too - a plain `.filter(a => !a.startsWith("--"))`
// leaves a flag's value (e.g. the "9999999" in "--employee 9999999") in
// the positional list, which silently shifts the port argument after it.
const VALUE_FLAGS = new Set(["--employee", "--finger"]);
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
const fingerNo = Number(flags.finger || 1);

/** Never print raw biometric template bytes, even during diagnostics. */
function redactBiometric(body) {
  if (!body || typeof body !== "object") return body;
  const clone = { ...body };
  for (const key of ["fingerData", "faceData", "faceURL"]) {
    if (key in clone) clone[key] = `[redacted, ${String(clone[key]).length} chars]`;
  }
  return clone;
}

if (!ip || !username || !password) {
  console.error(
    "Usage: node test-fingerprint-capture.js <device-ip> <username> <password> [port] [--finger 1] [--employee 9999999] [--keep]"
  );
  process.exit(1);
}

const device = { ip, port, username, password };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Primary candidate is now the CONFIRMED schema from CaptureFingerPrint's
// own /capabilities response (see header comment). The other two are kept
// as fallbacks only in case this exact firmware build still wants
// something slightly different in practice.
const CANDIDATE_BODIES = [
  {
    label: `CaptureFingerPrintCond { fingerNo: ${fingerNo} } (confirmed schema)`,
    body: { CaptureFingerPrintCond: { fingerNo } },
  },
  { label: "empty body", body: undefined },
  {
    label: "CaptureFingerPrintCond { employeeNo, fingerNo }",
    body: { CaptureFingerPrintCond: { employeeNo, fingerNo } },
  },
];

async function tryCapture() {
  console.log("\nAttempting POST /ISAPI/AccessControl/CaptureFingerPrint with candidate bodies.");
  console.log("If any attempt returns something other than 404, WATCH THE DEVICE SCREEN -");
  console.log("it may be prompting for a finger right now. Place the test subject's finger");
  console.log("on the sensor promptly; capture calls are typically short-lived/blocking.\n");

  for (const candidate of CANDIDATE_BODIES) {
    console.log(`--- Trying: ${candidate.label} ---`);
    try {
      const res = await isapiRequest(
        device,
        "/ISAPI/AccessControl/CaptureFingerPrint?format=json",
        "POST",
        candidate.body
      );
      console.log(`HTTP ${res.status}`);
      console.log(JSON.stringify(redactBiometric(res.body), null, 2));

      if (res.status === 404) {
        console.log("-> 404: this endpoint does not exist on this firmware. Stopping - further");
        console.log("   bodies won't change a 404. This firmware likely does NOT support remote");
        console.log("   live fingerprint capture; Phase 4 will need to use local-device enrollment");
        console.log("   (staff enrolls on the terminal itself) instead of a remote trigger.");
        return { supported: false };
      }
      if (res.ok) {
        console.log("-> Got a non-error response. This is the shape Phase 4's real");
        console.log("   implementation should use. Copy this exact request/response pair");
        console.log("   into the conversation so the production code matches it exactly.");
        return { supported: true, workingBody: candidate.body, response: res.body };
      }
      console.log(`-> HTTP ${res.status} (not 404, not success) - device understood the endpoint`);
      console.log("   exists but rejected this exact body shape. Trying the next candidate...");
    } catch (err) {
      console.log(`-> Request failed: ${err.message}`);
    }
    await sleep(500);
  }

  console.log("\nNo candidate body succeeded, but none returned 404 either - the endpoint");
  console.log("likely exists but needs a different request shape than guessed here. Share");
  console.log("the HTTP statuses/bodies above and we'll adjust the candidates.");
  return { supported: "unknown" };
}

(async () => {
  try {
    console.log(`\nCreating throwaway test user (employeeNo=${employeeNo})...`);
    const createRes = await createTestUser(device, employeeNo, "TEST-FINGERPRINT-PROBE");
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
      console.log(`\n--keep passed: test user ${employeeNo} left on the device. Delete it manually`);
      console.log("when done (Settings -> Biometric Terminals in the app, once that UI exists,");
      console.log("or via the device's own web admin / UserInfo/Delete).");
    }
  }
})();
