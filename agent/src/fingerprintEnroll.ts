import type { DeviceConfig } from "./types";
import { logger } from "./logger";

// CONFIRMED against the real DS-K1T320-B (see raw-CaptureFingerPrint-
// capabilities-*.xml and the live test that returned fingerData length
// 684 / quality 88): this endpoint's own /capabilities ignores
// ?format=json and returns raw XML, and it rejects a JSON request body
// with badXmlFormat/badXmlContent - it needs a genuine XML body.
const { isapiRequest, isapiRequestXml } = require("../../shared/isapi/isapiClient") as {
  isapiRequest: (device: DeviceConfig, path: string, method: string, body?: unknown) => Promise<{ ok: boolean; status: number; body: unknown }>;
  isapiRequestXml: (
    device: DeviceConfig,
    path: string,
    method: string,
    xmlBody: string,
    opts?: { timeoutMs?: number }
  ) => Promise<{ ok: boolean; status: number; text: string }>;
};
const { extractTag } = require("../../shared/isapi/xml") as { extractTag: (xml: string, tag: string) => string | null };

type CaptureResult = { fingerData: string; fingerPrintQuality: number };

// digestFetch's default 15s timeout is too short here: this call blocks
// until the member physically places their finger on the sensor, which
// can reasonably take longer than a typical ISAPI request.
const CAPTURE_TIMEOUT_MS = 60_000;

async function captureFingerprint(device: DeviceConfig, fingerNo: number): Promise<CaptureResult> {
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><CaptureFingerPrintCond><fingerNo>${fingerNo}</fingerNo></CaptureFingerPrintCond>`;
  const res = await isapiRequestXml(device, "/ISAPI/AccessControl/CaptureFingerPrint", "POST", xmlBody, {
    timeoutMs: CAPTURE_TIMEOUT_MS,
  });

  if (!res.ok) {
    throw new Error(`Fingerprint capture failed (HTTP ${res.status}): ${res.text.slice(0, 200)}`);
  }

  let fingerData: string | null;
  let fingerPrintQuality: string | null;
  try {
    const json = JSON.parse(res.text);
    fingerData = json.fingerData ?? null;
    fingerPrintQuality = json.fingerPrintQuality ?? null;
  } catch {
    fingerData = extractTag(res.text, "fingerData");
    fingerPrintQuality = extractTag(res.text, "fingerPrintQuality");
  }

  if (!fingerData) {
    throw new Error("Capture returned HTTP 200 but no fingerData was found in the response");
  }
  return { fingerData, fingerPrintQuality: Number(fingerPrintQuality ?? 0) };
}

// FingerPrintCfg's own /capabilities DOES return real JSON (unlike
// CaptureFingerPrint), confirming employeeNo/fingerPrintID(1-10)/fingerType
// as real field names - but the exact key that should hold the captured
// template was never confirmed against the live device (only capture
// was). Trying the most likely shapes in order and using whichever the
// device accepts, rather than assuming.
function buildSaveCandidates(employeeNo: string, fingerNo: number, fingerData: string) {
  return [
    { label: "FingerPrintCfg.fingerData", body: { FingerPrintCfg: { employeeNo, fingerPrintID: fingerNo, fingerType: "normalFP", fingerData } } },
    { label: "FingerPrintCfg.fingerPrintData", body: { FingerPrintCfg: { employeeNo, fingerPrintID: fingerNo, fingerType: "normalFP", fingerPrintData: fingerData } } },
    { label: "FingerPrintCfgList[].fingerData", body: { FingerPrintCfgList: [{ employeeNo, fingerPrintID: fingerNo, fingerType: "normalFP", fingerData }] } },
  ];
}

/** Redacts the actual template bytes so per-attempt logs are safe to keep/share. */
function redactSaveBody(body: unknown): unknown {
  const clone = JSON.parse(JSON.stringify(body));
  const cfg = clone.FingerPrintCfg ?? (Array.isArray(clone.FingerPrintCfgList) ? clone.FingerPrintCfgList[0] : null);
  if (cfg) {
    for (const key of ["fingerData", "fingerPrintData"]) {
      if (key in cfg) cfg[key] = `[redacted, ${String(cfg[key]).length} chars]`;
    }
  }
  return clone;
}

async function saveFingerprint(device: DeviceConfig, employeeNo: string, fingerNo: number, fingerData: string): Promise<string> {
  const candidates = buildSaveCandidates(employeeNo, fingerNo, fingerData);
  const attempts: { label: string; status: number; body: unknown }[] = [];

  for (const candidate of candidates) {
    const res = await isapiRequest(device, "/ISAPI/AccessControl/FingerPrintCfg?format=json", "POST", candidate.body);
    attempts.push({ label: candidate.label, status: res.status, body: res.body });
    logger.info("FingerPrintCfg save attempt", {
      employeeNo,
      fingerNo,
      shape: candidate.label,
      request: redactSaveBody(candidate.body),
      httpStatus: res.status,
      response: res.body,
    });

    if (res.ok) {
      logger.info("FingerPrintCfg save succeeded", { employeeNo, fingerNo, shape: candidate.label });
      return candidate.label;
    }
    if (res.status === 404) {
      logger.error("FingerPrintCfg endpoint not found on this firmware", { employeeNo, fingerNo });
      throw new Error("FingerPrintCfg endpoint not found on this firmware");
    }
  }

  logger.error("All FingerPrintCfg save candidates were rejected", { employeeNo, fingerNo, attempts });
  throw new Error(
    "Fingerprint was captured but could not be saved to the device - none of the known " +
      "FingerPrintCfg request shapes were accepted. See the 'FingerPrintCfg save attempt' " +
      "log lines (or 'All FingerPrintCfg save candidates were rejected') in agent.log for " +
      "the exact HTTP status/body of every attempt."
  );
}

/**
 * Full fingerprint enrollment: capture from the sensor, save to the
 * user's slot. Never returns or logs fingerData - only the quality score
 * (safe, not biometric material) crosses back into job results/logs.
 */
export async function enrollFingerprint(
  device: DeviceConfig,
  employeeNo: string,
  fingerNo = 1
): Promise<{ fingerPrintQuality: number; savedUsingShape: string }> {
  logger.info("Fingerprint enrollment: starting capture", { employeeNo, fingerNo });
  const { fingerData, fingerPrintQuality } = await captureFingerprint(device, fingerNo);
  logger.info("Fingerprint captured", { employeeNo, fingerNo, fingerPrintQuality });

  const savedUsingShape = await saveFingerprint(device, employeeNo, fingerNo, fingerData);
  logger.info("Fingerprint saved to device", { employeeNo, fingerNo, savedUsingShape });

  return { fingerPrintQuality, savedUsingShape };
}
