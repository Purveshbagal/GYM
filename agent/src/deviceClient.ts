import type { DeviceConfig } from "./types";

// Shared, framework-free ISAPI digest-auth client — the exact same code
// the Next.js backend uses (backend/src/lib/isapi.ts re-exports from the
// same place). Keeping this as a plain `require` of shared/isapi means the
// agent has zero Next.js dependency and bundles cleanly with esbuild/pkg.
const { isapiRequest, getDeviceInfo: sharedGetDeviceInfo } = require("../../shared/isapi/isapiClient") as {
  isapiRequest: (
    device: DeviceConfig,
    path: string,
    method: string,
    body?: unknown
  ) => Promise<{ ok: boolean; status: number; body: unknown }>;
  getDeviceInfo: (device: DeviceConfig) => Promise<{ ok: boolean; status: number; body: unknown }>;
};
const { extractTag, isXml } = require("../../shared/isapi/xml") as {
  extractTag: (xml: string, tag: string) => string | null;
  isXml: (text: string) => boolean;
};

export type DeviceInfo = {
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
};

/**
 * Read-only device identification. Never writes to the device. This is
 * the only Hikvision call Phase 2 makes — fingerprint/face/door endpoints
 * are added once the Phase 1 capability probe confirms what this exact
 * unit supports.
 */
export async function testDeviceConnection(device: DeviceConfig) {
  return sharedGetDeviceInfo(device);
}

/**
 * CONFIRMED on the real DS-K1T320-B: /ISAPI/System/deviceInfo returns raw
 * XML, not JSON (isapiRequest's JSON.parse fails and falls back to
 * `{ raw: text }`) - this went undetected until the real-device test
 * because the mock device used for earlier development returned JSON.
 * Handles both shapes now.
 */
export function parseDeviceInfo(body: unknown): DeviceInfo {
  const raw = (body as any)?.raw;
  if (typeof raw === "string" && isXml(raw)) {
    return {
      model: extractTag(raw, "model") ?? undefined,
      serialNumber: extractTag(raw, "serialNumber") ?? undefined,
      firmwareVersion: extractTag(raw, "firmwareVersion") ?? undefined,
    };
  }

  const info = (body as any)?.DeviceInfo ?? (body as any)?.deviceInfo ?? body ?? {};
  return {
    model: info.model,
    serialNumber: info.serialNumber,
    firmwareVersion: info.firmwareVersion,
  };
}

export { isapiRequest };
