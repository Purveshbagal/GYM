#!/usr/bin/env node
/**
 * Phase 1 capability probe for the Hikvision MinMoe terminal.
 *
 * Run this ON THE WINDOWS PC that will host the Gym Device Agent (same LAN
 * as the terminal). It performs only GET requests (nothing is changed on
 * the device) and prints + saves a report of which ISAPI features the
 * device actually supports, so the rest of the integration is built
 * against confirmed capabilities instead of guesses.
 *
 * Usage:
 *   node probe-device.js <device-ip> <username> <password> [port]
 *
 * Requires Node.js 18+ (uses the built-in fetch/crypto). No npm install
 * needed.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const [, , ip, username, password, portArg] = process.argv;

if (!ip || !username || !password) {
  console.error("Usage: node probe-device.js <device-ip> <username> <password> [port]");
  process.exit(1);
}

const port = portArg ? Number(portArg) : 80;
const baseUrl = `http://${ip}:${port}`;

function md5(input) {
  return crypto.createHash("md5").update(input).digest("hex");
}

function parseDigestChallenge(header) {
  if (!header || !header.toLowerCase().startsWith("digest ")) return null;
  const parts = header.slice(7);
  const map = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
  let m;
  while ((m = re.exec(parts))) map[m[1]] = m[2] !== undefined ? m[2] : m[3];
  if (!map.realm || !map.nonce) return null;
  return { realm: map.realm, nonce: map.nonce, qop: map.qop, opaque: map.opaque };
}

async function digestFetch(url, init = {}) {
  const first = await fetch(url, init);
  if (first.status !== 401) return first;

  const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
  if (!challenge) return first;

  const method = init.method || "GET";
  const uri = new URL(url).pathname + new URL(url).search;
  const nc = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let authValue;
  if (challenge.qop) {
    const response = md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`);
    authValue =
      `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", ` +
      `uri="${uri}", qop=${challenge.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"` +
      (challenge.opaque ? `, opaque="${challenge.opaque}"` : "");
  } else {
    const response = md5(`${ha1}:${challenge.nonce}:${ha2}`);
    authValue = `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}"`;
  }

  return fetch(url, { ...init, headers: { ...init.headers, Authorization: authValue } });
}

async function probe(name, isapiPath) {
  const url = `${baseUrl}${isapiPath}`;
  try {
    const res = await digestFetch(url, { method: "GET" });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Keep the FULL body - this device returns XML for several
      // endpoints even with ?format=json, and truncating here previously
      // cut isSupportCaptureFingerPrint and similar flags out of the
      // saved report before anyone got a chance to read them.
      json = { raw: text };
    }
    return { name, path: isapiPath, httpStatus: res.status, ok: res.ok, body: json };
  } catch (err) {
    return { name, path: isapiPath, httpStatus: null, ok: false, error: String(err) };
  }
}

const CHECKS = [
  ["Device info (model/serial/firmware)", "/ISAPI/System/deviceInfo?format=json"],
  ["System capabilities", "/ISAPI/System/capabilities?format=json"],
  ["Access control capabilities (fingerprint/face capture support)", "/ISAPI/AccessControl/capabilities?format=json"],
  ["User info capabilities", "/ISAPI/AccessControl/UserInfo/capabilities?format=json"],
  ["Fingerprint config capabilities", "/ISAPI/AccessControl/FingerPrintCfg/capabilities?format=json"],
  ["Face data library capabilities", "/ISAPI/Intelligent/FDLib/capabilities?format=json"],
  ["Event/notification (attendance push) capabilities", "/ISAPI/Event/notification/httpHosts/capabilities?format=json"],
  ["Door/relay remote-control capabilities", "/ISAPI/AccessControl/RemoteControl/door/capabilities?format=json"],
  ["Door status/sensor capabilities", "/ISAPI/AccessControl/Door/param/1?format=json"],
];

(async () => {
  console.log(`\nProbing Hikvision device at ${baseUrl} as user "${username}"...\n`);
  const results = [];
  for (const [name, isapiPath] of CHECKS) {
    const r = await probe(name, isapiPath);
    results.push(r);
    const status = r.ok ? "OK" : r.httpStatus ? `HTTP ${r.httpStatus}` : "FAILED";
    console.log(`[${status}] ${name}`);
    console.log(`        ${isapiPath}`);
    if (!r.ok) {
      console.log(`        -> ${r.error || (r.body && JSON.stringify(r.body)) || "no body"}`);
    }
    console.log("");
  }

  // Highlight the specific fields the integration plan depends on.
  const acsCaps = results.find((r) => r.path.includes("AccessControl/capabilities"))?.body;
  const fdCaps = results.find((r) => r.path.includes("FDLib/capabilities"))?.body;
  const deviceInfo = results.find((r) => r.path.includes("deviceInfo"))?.body;

  console.log("========== SUMMARY ==========");
  if (deviceInfo) {
    console.log(`Model: ${deviceInfo.deviceInfo?.model ?? deviceInfo.model ?? "unknown"}`);
    console.log(`Firmware: ${deviceInfo.deviceInfo?.firmwareVersion ?? deviceInfo.firmwareVersion ?? "unknown"}`);
    console.log(`Serial: ${deviceInfo.deviceInfo?.serialNumber ?? deviceInfo.serialNumber ?? "unknown"}`);
  }
  const fpSupport = findDeep(acsCaps, "isSupportCaptureFingerPrint");
  console.log(`Remote fingerprint capture (CaptureFingerPrint): ${fpSupport ?? "NOT REPORTED (needs manual check)"}`);
  const faceLibSupport = fdCaps ? "FDLib endpoint reachable (face photo upload likely supported)" : "NOT REACHABLE";
  console.log(`Face enrollment via FDLib/FaceDataRecord: ${faceLibSupport}`);
  console.log("==============================\n");

  const outFile = path.join(__dirname, `capability-report-${ip.replace(/\./g, "-")}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ ip, port, checkedAt: new Date().toISOString(), results }, null, 2));
  console.log(`Full report saved to: ${outFile}`);
  console.log("Share this file's contents back so the enrollment/door-control design can be finalized against confirmed capabilities.");
})();

function findDeep(obj, key) {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    if (typeof v === "object") {
      const found = findDeep(v, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}
