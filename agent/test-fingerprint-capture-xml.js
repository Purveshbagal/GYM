#!/usr/bin/env node
/**
 * Phase 3b (round 2) — fingerprint capture using an XML request body.
 *
 * WHY: the first attempt sent the confirmed field names (CaptureFingerPrintCond
 * { fingerNo }) as JSON and got HTTP 400 badXmlFormat/badXmlContent on every
 * variant, including an empty body. That specific error vocabulary means the
 * device tried to parse the body AS XML and failed - it never got far enough
 * to complain about missing/wrong fields. This lines up with a pattern
 * already visible elsewhere on this device: endpoints whose OWN
 * /capabilities response ignores ?format=json and returns raw XML
 * (System, AccessControl, CaptureFingerPrint, Event notification,
 * RemoteControl/door, Door/param) are exactly the endpoints that also seem
 * to want XML bodies, not JSON - while endpoints whose /capabilities comes
 * back as real JSON (UserInfo, FingerPrintCfg, FDLib) accept JSON bodies,
 * confirmed by UserInfo/Record already working with JSON in Phase 3.
 *
 * WHAT THIS DOES (safe, reversible):
 *  1. Creates throwaway test user 9999999 (JSON - confirmed working).
 *  2. POSTs a genuine XML body to CaptureFingerPrint:
 *       <CaptureFingerPrintCond><fingerNo>1</fingerNo></CaptureFingerPrintCond>
 *     This is still a best-effort reading of the capabilities schema, not a
 *     confirmed-correct body - if this also 400s, the printed error tells us
 *     what to try next (e.g. a full <?xml?> prolog, a different root tag).
 *  3. If capture succeeds, parses out fingerNo/fingerPrintQuality for
 *     display and fingerData for internal use only - fingerData is NEVER
 *     printed or written to disk, only its byte length.
 *  4. Iterates a few candidate bodies for FingerPrintCfg (the save-to-slot
 *     step) since that exact request shape isn't confirmed either - only
 *     that isSupportSetUp: true and the field names employeeNo/fingerPrintID
 *     from its own /capabilities.
 *  5. Verifies by querying UserInfo for this employeeNo and checking
 *     hasFingerprint/numOfFP - again best-effort endpoint guess, reported
 *     honestly if it 404s.
 *  6. Deletes the test user at the end (unless --keep).
 *
 * Usage:
 *   node test-fingerprint-capture-xml.js <device-ip> <username> <password> [port] [--finger 1] [--employee 9999999] [--keep]
 */
const { isapiRequest, isapiRequestXml } = require("../shared/isapi/isapiClient");
const { extractTag } = require("../shared/isapi/xml");
const { createTestUser, deleteTestUser } = require("./_testDeviceUser");

const VALUE_FLAGS = new Set(["--employee", "--finger"]);
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
const fingerNo = Number(flags.finger || 1);

if (!ip || !username || !password) {
  console.error(
    "Usage: node test-fingerprint-capture-xml.js <device-ip> <username> <password> [port] [--finger 1] [--employee 9999999] [--keep]"
  );
  process.exit(1);
}

const device = { ip, port, username, password };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parses either a JSON or XML response body without ever surfacing fingerData in logs. */
function parseCaptureResponse(text) {
  let fingerData = null;
  let fingerPrintQuality = null;
  let respFingerNo = null;
  try {
    const json = JSON.parse(text);
    fingerData = json.fingerData ?? null;
    fingerPrintQuality = json.fingerPrintQuality ?? null;
    respFingerNo = json.fingerNo ?? null;
  } catch {
    fingerData = extractTag(text, "fingerData");
    fingerPrintQuality = extractTag(text, "fingerPrintQuality");
    respFingerNo = extractTag(text, "fingerNo");
  }
  return { fingerData, fingerPrintQuality, fingerNo: respFingerNo };
}

function redactedPreview(text) {
  // Never print the response verbatim if it might contain fingerData -
  // show structure/length only.
  return `${text.length} bytes, starts with: ${text.slice(0, 60).replace(/[\s\S]{1,4}fingerData[\s\S]{0,20}/i, "…fingerData…")}`;
}

// Candidate XML bodies, most-likely-first per the capabilities schema.
const XML_CANDIDATES = [
  `<?xml version="1.0" encoding="UTF-8"?><CaptureFingerPrintCond><fingerNo>${fingerNo}</fingerNo></CaptureFingerPrintCond>`,
  `<CaptureFingerPrintCond><fingerNo>${fingerNo}</fingerNo></CaptureFingerPrintCond>`,
  `<?xml version="1.0" encoding="UTF-8"?><CaptureFingerPrint><CaptureFingerPrintCond><fingerNo>${fingerNo}</fingerNo></CaptureFingerPrintCond></CaptureFingerPrint>`,
];

async function tryCaptureXml() {
  console.log("\nAttempting POST /ISAPI/AccessControl/CaptureFingerPrint with XML bodies.");
  console.log("If any attempt returns something other than 400/404, WATCH THE DEVICE SCREEN -");
  console.log("place the test subject's finger on the sensor promptly.\n");

  for (const xmlBody of XML_CANDIDATES) {
    console.log(`--- Trying XML: ${xmlBody} ---`);
    try {
      const res = await isapiRequestXml(device, "/ISAPI/AccessControl/CaptureFingerPrint", "POST", xmlBody);
      console.log(`HTTP ${res.status}`);

      if (res.status === 404) {
        console.log("-> 404: endpoint not found at this path.");
        return { supported: false };
      }
      if (res.ok) {
        console.log(`-> Success. Response: ${redactedPreview(res.text)}`);
        const parsed = parseCaptureResponse(res.text);
        if (!parsed.fingerData) {
          console.log("-> HTTP was OK but no fingerData found in the response - check the raw shape");
          console.log("   (not printed here because it may contain fingerData) by adding a one-off");
          console.log("   console.log(res.text) locally if needed, off a screen no one else sees.");
          return { supported: "unclear" };
        }
        console.log(`-> Got fingerData (${parsed.fingerData.length} chars, not shown), quality=${parsed.fingerPrintQuality}`);
        return { supported: true, fingerData: parsed.fingerData, fingerPrintQuality: parsed.fingerPrintQuality };
      }
      // Print error bodies - these are just error codes/messages, safe to show.
      console.log(`-> Error body: ${res.text.slice(0, 300)}`);
    } catch (err) {
      console.log(`-> Request failed: ${err.message}`);
    }
    await sleep(500);
  }
  return { supported: "unknown" };
}

// FingerPrintCfg's own /capabilities came back as real JSON (unlike
// CaptureFingerPrint), so JSON is the right family here - confirmed field
// names are employeeNo, fingerPrintID (1-10), fingerType (opt includes
// "normalFP"). The exact key holding the captured template is NOT
// confirmed - trying the most likely names.
function buildFingerPrintCfgCandidates(fingerData) {
  return [
    { label: "fingerData", body: { FingerPrintCfg: { employeeNo, fingerPrintID: fingerNo, fingerType: "normalFP", fingerData } } },
    { label: "fingerPrintData", body: { FingerPrintCfg: { employeeNo, fingerPrintID: fingerNo, fingerType: "normalFP", fingerPrintData: fingerData } } },
    { label: "fingerPrintCfg wrapped array", body: { FingerPrintCfgList: [{ employeeNo, fingerPrintID: fingerNo, fingerType: "normalFP", fingerData }] } },
  ];
}

async function trySaveFingerprint(fingerData) {
  console.log("\nAttempting to save the captured template via FingerPrintCfg (JSON, per its own confirmed-JSON /capabilities)...");
  for (const candidate of buildFingerPrintCfgCandidates(fingerData)) {
    console.log(`--- Trying: ${candidate.label} ---`);
    const bodyForLog = JSON.parse(JSON.stringify(candidate.body));
    for (const key of ["fingerData", "fingerPrintData"]) {
      const cfg = bodyForLog.FingerPrintCfg || (bodyForLog.FingerPrintCfgList && bodyForLog.FingerPrintCfgList[0]);
      if (cfg && key in cfg) cfg[key] = `[redacted, ${cfg[key].length} chars]`;
    }
    console.log(`   request: ${JSON.stringify(bodyForLog)}`);
    try {
      const res = await isapiRequest(device, "/ISAPI/AccessControl/FingerPrintCfg?format=json", "POST", candidate.body);
      console.log(`   -> HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
      if (res.ok) return { saved: true, shape: candidate.label };
      if (res.status === 404) return { saved: false, reason: "endpoint not found" };
    } catch (err) {
      console.log(`   -> Request failed: ${err.message}`);
    }
    await sleep(300);
  }
  return { saved: false, reason: "no candidate shape accepted" };
}

async function verifyEnrollment() {
  console.log("\nVerifying via UserInfo/Search (endpoint name inferred from naming convention, not confirmed)...");
  const res = await isapiRequest(device, "/ISAPI/AccessControl/UserInfo/Search?format=json", "POST", {
    UserInfoSearchCond: { searchID: "1", searchResultPosition: 0, maxResults: 1, EmployeeNoList: [{ employeeNo }] },
  });
  console.log(`  -> HTTP ${res.status}`, JSON.stringify(res.body).slice(0, 400));
  return res;
}

(async () => {
  try {
    console.log(`\nCreating throwaway test user (employeeNo=${employeeNo})...`);
    const createRes = await createTestUser(device, employeeNo, "TEST-FINGERPRINT-XML-PROBE");
    console.log(`  -> HTTP ${createRes.status}`, JSON.stringify(createRes.body).slice(0, 300));
    if (!createRes.ok) throw new Error("Could not create test user - stopping.");

    const captureResult = await tryCaptureXml();
    console.log("\n========== CAPTURE RESULT ==========");
    console.log(JSON.stringify({ supported: captureResult.supported, fingerPrintQuality: captureResult.fingerPrintQuality }, null, 2));
    console.log("=====================================");

    if (captureResult.supported === true && captureResult.fingerData) {
      const saveResult = await trySaveFingerprint(captureResult.fingerData);
      console.log("\n========== SAVE RESULT ==========");
      console.log(JSON.stringify(saveResult, null, 2));
      console.log("==================================");

      if (saveResult.saved) {
        await verifyEnrollment();
      }
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
