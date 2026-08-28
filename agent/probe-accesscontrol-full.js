#!/usr/bin/env node
/**
 * Phase 3a — fixes a gap in the Phase 1 probe: probe-device.js truncated
 * any non-JSON (XML) response body to 500 chars before saving, which cut
 * off /ISAPI/AccessControl/capabilities before reaching fields like
 * isSupportCaptureFingerPrint. This script re-fetches that endpoint (and
 * a couple of related ones) with NO truncation and prints/saves the full
 * body, plus explicitly checks for every capture/collect-related flag by
 * name so we don't have to eyeball a large XML blob.
 *
 * Read-only. Changes nothing on the device.
 *
 * Usage: node probe-accesscontrol-full.js <device-ip> <username> <password> [port]
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { digestFetch } = require("../shared/isapi/digestFetch");
const { extractTag, extractBool, isXml } = require("../shared/isapi/xml");

const [, , ip, username, password, portArg] = process.argv;
if (!ip || !username || !password) {
  console.error("Usage: node probe-accesscontrol-full.js <device-ip> <username> <password> [port]");
  process.exit(1);
}
const port = portArg ? Number(portArg) : 80;
const baseUrl = `http://${ip}:${port}`;

async function getFull(isapiPath) {
  const res = await digestFetch(`${baseUrl}${isapiPath}`, username, password, { method: "GET" });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

// Every flag name that could plausibly gate a remote "start capture, wait
// for finger/face, return sample" flow, based on Hikvision's ISAPI naming
// conventions elsewhere in this same capabilities document (isSupportX).
const FLAGS_OF_INTEREST = [
  "isSupportCaptureFingerPrint",
  "isSupportFingerPrintCapture",
  "isSupportCaptureFace",
  "isSupportFaceCapture",
  "isSupportRemoteCollection",
  "isSupportCollectFingerPrint",
];

(async () => {
  const targets = [
    ["/ISAPI/AccessControl/capabilities?format=json", "AccessControl-capabilities-formatjson"],
    ["/ISAPI/AccessControl/capabilities", "AccessControl-capabilities-noformat"],
    ["/ISAPI/AccessControl/CaptureFingerPrint/capabilities?format=json", "CaptureFingerPrint-capabilities"],
    ["/ISAPI/AccessControl/CaptureFace/capabilities?format=json", "CaptureFace-capabilities"],
  ];

  const outDir = __dirname;
  const summary = {};

  for (const [isapiPath, label] of targets) {
    console.log(`\nFetching ${isapiPath} ...`);
    let result;
    try {
      result = await getFull(isapiPath);
    } catch (err) {
      console.log(`  -> request failed: ${err.message} (endpoint may not exist on this firmware, which is itself informative)`);
      continue;
    }

    console.log(`  HTTP ${result.status}, ${result.text.length} bytes`);
    const outFile = path.join(outDir, `raw-${label}-${ip.replace(/\./g, "-")}.xml`);
    fs.writeFileSync(outFile, result.text);
    console.log(`  Saved full body to: ${outFile}`);

    if (isXml(result.text)) {
      for (const flag of FLAGS_OF_INTEREST) {
        const val = extractBool(result.text, flag);
        if (val !== null) summary[flag] = val;
      }
    } else {
      try {
        const json = JSON.parse(result.text);
        for (const flag of FLAGS_OF_INTEREST) {
          if (flag in json) summary[flag] = json[flag];
        }
      } catch {
        // not JSON either; the saved raw file is still there to read by hand
      }
    }
  }

  console.log("\n========== FINGERPRINT/FACE CAPTURE CAPABILITY SUMMARY ==========");
  if (Object.keys(summary).length === 0) {
    console.log("None of the known capture-flag names were found in any response.");
    console.log("This does NOT necessarily mean capture is unsupported — read the");
    console.log("saved raw-*.xml files by hand for anything named similarly, and");
    console.log("check whether POST /ISAPI/AccessControl/CaptureFingerPrint itself");
    console.log("returns 404 (truly absent) vs 400/other (present but needs a body)");
    console.log("using the next script, test-fingerprint-capture.js.");
  } else {
    for (const [flag, val] of Object.entries(summary)) {
      console.log(`${flag}: ${val}`);
    }
  }
  console.log("===================================================================\n");
})();
