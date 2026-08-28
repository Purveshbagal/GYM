#!/usr/bin/env node
/**
 * Phase 3e — tests the one remaining honest path for face: since live
 * remote-triggered capture is confirmed unsupported (CaptureFace ->
 * notSupport, its own /capabilities -> 404), can the Agent at least
 * detect the MOMENT a face is enrolled locally at the terminal, so
 * Android can still show a live PENDING -> SUCCESS transition without
 * a manual "mark as done" step? This also doubles as the first real test
 * of the UserInfo/Search endpoint (guessed, unconfirmed) that
 * test-fingerprint-capture-xml.js's verify step depends on.
 *
 * WHAT THIS DOES:
 *  1. Creates throwaway test user 9999999.
 *  2. Prompts you to physically enroll a FACE (or fingerprint, via --mode)
 *     for that employeeNo at the terminal's own local menu right now.
 *  3. Polls UserInfo/Search every 2s for up to 60s, watching for
 *     hasFace/numOfFace (or hasFingerprint/numOfFP) to flip.
 *  4. Reports how long detection took - this is the real latency Android
 *     would see between "member finished enrolling" and "app shows
 *     success" if we build the Agent to poll this way.
 *  5. Deletes the test user at the end (unless --keep, which you'll want
 *     if you're about to also test FaceDataRecord against the same user).
 *
 * Usage:
 *   node test-local-enrollment-detection.js <device-ip> <username> <password> [port] [--mode face|fingerprint] [--employee 9999999] [--keep]
 */
const readline = require("readline");
const { isapiRequest } = require("../shared/isapi/isapiClient");
const { createTestUser, deleteTestUser } = require("./_testDeviceUser");

const VALUE_FLAGS = new Set(["--employee", "--mode"]);
const rawArgs = process.argv.slice(2);
const positional = [];
const flags = { keep: false };
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === "--keep") flags.keep = true;
  else if (VALUE_FLAGS.has(a)) flags[a.slice(2)] = rawArgs[++i];
  else if (!a.startsWith("--")) positional.push(a);
}
const [ip, username, password, maybePort] = positional;
const port = /^\d+$/.test(maybePort || "") ? Number(maybePort) : 80;
const keep = flags.keep;
const employeeNo = flags.employee || "9999999";
const mode = flags.mode === "fingerprint" ? "fingerprint" : "face";

if (!ip || !username || !password) {
  console.error(
    "Usage: node test-local-enrollment-detection.js <device-ip> <username> <password> [port] [--mode face|fingerprint] [--employee 9999999] [--keep]"
  );
  process.exit(1);
}

const device = { ip, port, username, password };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForEnter(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(message, () => { rl.close(); resolve(); }));
}

async function queryUserInfo() {
  const res = await isapiRequest(device, "/ISAPI/AccessControl/UserInfo/Search?format=json", "POST", {
    UserInfoSearchCond: { searchID: "1", searchResultPosition: 0, maxResults: 1, EmployeeNoList: [{ employeeNo }] },
  });
  return res;
}

(async () => {
  try {
    console.log(`\nCreating throwaway test user (employeeNo=${employeeNo})...`);
    const createRes = await createTestUser(device, employeeNo, "TEST-LOCAL-ENROLL-DETECT");
    console.log(`  -> HTTP ${createRes.status}`, JSON.stringify(createRes.body).slice(0, 300));
    if (!createRes.ok) throw new Error("Could not create test user - stopping.");

    console.log("\nFirst, confirming UserInfo/Search even works on this firmware (unconfirmed endpoint)...");
    const probe = await queryUserInfo();
    console.log(`  -> HTTP ${probe.status}`, JSON.stringify(probe.body).slice(0, 400));
    if (probe.status === 404) {
      throw new Error(
        "UserInfo/Search returned 404 - this endpoint name is wrong for this firmware. " +
          "Detection needs a different query mechanism; stopping before wasting your time enrolling."
      );
    }

    await waitForEnter(
      `\nNow go to the terminal (${ip}) and enroll a ${mode.toUpperCase()} locally for employeeNo ${employeeNo}, ` +
        `then press Enter here as soon as it's done on the device...\n`
    );

    console.log("Polling UserInfo/Search every 2s for up to 60s...");
    const start = Date.now();
    const deadline = start + 60_000;
    let detected = false;
    while (Date.now() < deadline) {
      const res = await queryUserInfo();
      const record = res.body?.UserInfoSearch?.UserInfo?.[0] ?? res.body?.UserInfo?.[0] ?? null;
      const flag = mode === "face" ? (record?.hasFace ?? record?.numOfFace > 0) : (record?.hasFingerprint ?? record?.numOfFP > 0);
      console.log(`  [${((Date.now() - start) / 1000).toFixed(1)}s] ${JSON.stringify(record)}`);
      if (flag) {
        detected = true;
        console.log(`\n✓ Detected after ${((Date.now() - start) / 1000).toFixed(1)}s - this is the real latency`);
        console.log("  Android would see between finishing local enrollment and the app showing SUCCESS");
        console.log("  if the Agent polls this way.");
        break;
      }
      await sleep(2000);
    }
    if (!detected) {
      console.log("\n✗ Not detected within 60s. Either the field names guessed here (hasFace/numOfFace)");
      console.log("  don't match this firmware's actual UserInfo/Search response shape (check the raw");
      console.log("  records printed above for the real field names), or nothing was enrolled in time.");
    }
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
