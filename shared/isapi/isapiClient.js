const { digestFetch } = require("./digestFetch");

/**
 * @typedef {{ ip: string, port: number, username: string, password: string }} DeviceConfig
 */

function baseUrl(device) {
  return `http://${device.ip}:${device.port}`;
}

/**
 * Generic ISAPI request helper shared by the Next.js backend
 * (src/lib/isapi.ts, for direct calls made from server-side code) and the
 * standalone Windows Gym Device Agent (which talks to the device over the
 * local LAN only). Kept dependency-free so the agent can bundle it without
 * pulling in any Next.js/server-only code.
 *
 * @param {DeviceConfig} device
 * @param {string} path
 * @param {string} method
 * @param {unknown} [body]
 */
async function isapiRequest(device, path, method, body) {
  const url = `${baseUrl(device)}${path}`;
  const res = await digestFetch(url, device.username, device.password, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, body: json };
}

/**
 * Some ISAPI resources on this device (CaptureFingerPrint confirmed;
 * likely anything whose own /capabilities response ignores ?format=json
 * and comes back as raw XML - System, AccessControl, Event notification,
 * RemoteControl/door, Door/param all do the same) reject a JSON request
 * body outright (`badXmlFormat`/`badXmlContent`) even when a JSON
 * response is requested. Those need a real XML request body. Response is
 * returned as raw text - callers parse it as XML or JSON themselves,
 * since which one comes back is not consistent across this firmware.
 *
 * @param {DeviceConfig} device
 * @param {string} path
 * @param {string} method
 * @param {string} xmlBody - a full XML document string, e.g. "<Foo><bar>1</bar></Foo>"
 * @param {{ timeoutMs?: number }} [opts] - override digestFetch's default
 *   15s timeout. CaptureFingerPrint blocks until a member physically
 *   places a finger, which can legitimately take longer.
 */
async function isapiRequestXml(device, path, method, xmlBody, opts = {}) {
  const url = `${baseUrl(device)}${path}`;
  const res = await digestFetch(url, device.username, device.password, {
    method,
    headers: { "Content-Type": "application/xml" },
    body: xmlBody,
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

/**
 * Read-only device identification: model, serial number, firmware. Used by
 * both backend and agent first-run setup / capability checks. Never
 * mutates device state.
 *
 * @param {DeviceConfig} device
 */
async function getDeviceInfo(device) {
  return isapiRequest(device, "/ISAPI/System/deviceInfo?format=json", "GET");
}

module.exports = { isapiRequest, isapiRequestXml, getDeviceInfo };
