#!/usr/bin/env node
/**
 * Phase 3c (pre-step) — helps decide WHICH face library (FDID) is the
 * real one to enroll into, instead of guessing between FDID 1 (blackFD)
 * and FDID 2 (infraredFD) confirmed present on this device.
 *
 * Rationale: blackFD is the standard visible-light face database used by
 * ordinary face-recognition terminals; infraredFD is typically only
 * meaningful on dual-sensor (visible + IR) hardware for anti-spoof
 * liveness matching. Whether THIS specific unit's local recognition
 * engine actually searches FDID 2 at all is a device-configuration fact,
 * not something derivable from the library list alone - so this script
 * gathers what evidence ISAPI can offer (per-library config, and how many
 * face records already exist in each) rather than asserting an answer.
 *
 * Entirely read-only: GETs config, and library "search" calls (POST by
 * ISAPI convention, like the confirmed UserInfoSearchCond pattern
 * elsewhere on this device) that query records without modifying them.
 *
 * Usage: node probe-facelib.js <device-ip> <username> <password> [port]
 */
const { isapiRequest } = require("../shared/isapi/isapiClient");

const [, , ip, username, password, portArg] = process.argv;
if (!ip || !username || !password) {
  console.error("Usage: node probe-facelib.js <device-ip> <username> <password> [port]");
  process.exit(1);
}
const port = portArg ? Number(portArg) : 80;
const device = { ip, port, username, password };

async function listLibraries() {
  const res = await isapiRequest(device, "/ISAPI/Intelligent/FDLib?format=json", "GET");
  console.log(`GET /ISAPI/Intelligent/FDLib -> HTTP ${res.status}`);
  console.log(JSON.stringify(res.body, null, 2));
  return res.body?.FDLib || res.body?.FDLibList || res.body?.FaceLibList || [];
}

async function getLibraryConfig(fdid) {
  // CONFIRMED on the real device: this returns 404 notSupport for both
  // FDID 1 and 2. Kept only in case a different firmware build on another
  // gym's device supports it - do not expect data back on this one.
  try {
    const res = await isapiRequest(device, `/ISAPI/Intelligent/FDLib/${fdid}?format=json`, "GET");
    console.log(`  GET /ISAPI/Intelligent/FDLib/${fdid} -> HTTP ${res.status}`);
    if (res.body) console.log(`  ${JSON.stringify(res.body).slice(0, 400)}`);
    return res;
  } catch (err) {
    console.log(`  GET /ISAPI/Intelligent/FDLib/${fdid} failed: ${err.message}`);
    return null;
  }
}

// Candidate search request shapes. The first round of testing got a
// "faceLibType required" error with faceLibType nested inside the Cond
// object, so this round also tries it at the top level (sibling to the
// Cond object) in case that's where the device actually expects it.
const SEARCH_CANDIDATES = [
  (fdid, faceLibType) => ({
    path: "/ISAPI/Intelligent/FDLib/FDSearch?format=json",
    body: { faceLibType, FDID: String(fdid), FaceInfoSearchCond: { searchResultPosition: 0, maxResults: 5 } },
  }),
  (fdid, faceLibType) => ({
    path: `/ISAPI/Intelligent/FDLib/FDSearch?format=json&faceLibType=${faceLibType}&FDID=${fdid}`,
    body: { FaceInfoSearchCond: { searchResultPosition: 0, maxResults: 5 } },
  }),
  (fdid, faceLibType) => ({
    path: "/ISAPI/Intelligent/FDLib/FDSearch?format=json",
    body: { FaceInfoSearchCond: { searchResultPosition: 0, maxResults: 5, faceLibType, FDID: String(fdid) } },
  }),
  (fdid, faceLibType) => ({
    path: "/ISAPI/Intelligent/FDLib/FDSearch?format=json",
    body: { FDSearchCond: { searchResultPosition: 0, maxResults: 5, faceLibType, FDID: String(fdid) } },
  }),
];

async function searchLibrary(fdid, faceLibType) {
  for (const build of SEARCH_CANDIDATES) {
    const { path, body } = build(fdid, faceLibType);
    try {
      const res = await isapiRequest(device, path, "POST", body);
      console.log(`  POST ${path} (${JSON.stringify(Object.keys(body)[0])}) -> HTTP ${res.status}`);
      if (res.status === 404) {
        console.log("  -> 404: search endpoint not present under this path on this firmware.");
        return null;
      }
      if (res.ok) {
        console.log(`  ${JSON.stringify(res.body).slice(0, 500)}`);
        return res.body;
      }
      console.log(`  ${JSON.stringify(res.body).slice(0, 300)} (trying next candidate shape...)`);
    } catch (err) {
      console.log(`  request failed: ${err.message}`);
    }
  }
  return null;
}

(async () => {
  const libraries = await listLibraries();
  if (libraries.length === 0) {
    console.log("\nNo libraries returned - cannot proceed.");
    return;
  }

  console.log("\n========== PER-LIBRARY DETAIL ==========");
  for (const lib of libraries) {
    console.log(`\nFDID ${lib.FDID} (faceLibType: ${lib.faceLibType}, name: "${lib.name || ""}")`);
    await getLibraryConfig(lib.FDID);
    const searchResult = await searchLibrary(lib.FDID, lib.faceLibType);
    if (searchResult === null) {
      console.log("  Could not determine record count via search (no candidate shape worked, or 404).");
    }
  }

  console.log("\n========== HOW TO DECIDE ==========");
  console.log("1. If one library already has real face records and the other is empty, the");
  console.log("   non-empty one is almost certainly the one staff enroll into locally today");
  console.log("   and the one to target for FaceDataRecord.");
  console.log("2. If both are empty (likely, on a freshly-configured device), ISAPI doesn't");
  console.log("   appear to expose an explicit 'active library' setting in the confirmed");
  console.log("   capabilities - check the device's own web-admin UI (Configuration ->");
  console.log("   Face Comparison Database, or similar) to see which FDID it shows as the");
  console.log("   one used for access-control verification, or manually enroll ONE real test");
  console.log("   face locally on the terminal and re-run this script to see which FDID's");
  console.log("   record count went from 0 to 1.");
  console.log("3. FDID 2 (infraredFD) is conventionally for a secondary IR sensor on");
  console.log("   dual-camera terminals - if this unit only has one visible-light camera,");
  console.log("   FDID 1 (blackFD) is the standard choice, but confirm via step 1 or 2 rather");
  console.log("   than relying on this convention alone.");
  console.log("==========================================\n");
})();
