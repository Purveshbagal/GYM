import { BackendClient } from "./backendClient";
import { testDeviceConnection, parseDeviceInfo } from "./deviceClient";
import type { DeviceConfig } from "./types";
import { logger } from "./logger";
import { startRetryLoop } from "./retryLoop";

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Every 30s: check the Hikvision device is reachable (read-only), then
 * tell the backend "agent is alive" plus what it currently knows about the
 * device. The backend's online/offline status is driven by *this*, not by
 * the backend trying to reach the device directly (it never can — the
 * device has no public IP).
 */
export function startHeartbeatLoop(backend: BackendClient, device: DeviceConfig) {
  return startRetryLoop("heartbeat", HEARTBEAT_INTERVAL_MS, async () => {
    // The device and the backend are checked independently: a Hikvision
    // outage must never suppress the "agent is alive" signal the backend
    // relies on for online/offline status, and vice versa.
    let deviceOnline = false;
    let info: ReturnType<typeof parseDeviceInfo> = {};
    try {
      const deviceCheck = await testDeviceConnection(device);
      deviceOnline = deviceCheck.ok;
      if (deviceCheck.ok) info = parseDeviceInfo(deviceCheck.body);
    } catch (err) {
      logger.warn("Device unreachable during heartbeat check", { error: (err as Error).message });
    }

    const result = await backend.heartbeat({
      deviceModel: info.model,
      serialNumber: info.serialNumber,
      firmwareVersion: info.firmwareVersion,
      deviceOnline,
    });

    if (!result.ok) {
      throw new Error(result.error || `backend rejected heartbeat (status ${result.status})`);
    }

    logger.info("Heartbeat sent", { deviceOnline });
  });
}
