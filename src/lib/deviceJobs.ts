import Device from "@/models/Device";
import DeviceJob from "@/models/DeviceJob";

/**
 * Resolves the Device a gym-scoped action should target, without requiring
 * the caller to know a specific device id. Members are never required to
 * have a manually assigned terminal - the app is single-gym in practice, so
 * "the gym's device" is the most recently active agent-configured Device
 * system-wide (matched by agentId, never by IP).
 *
 * `explicitDeviceId` (e.g. a member's stored `device` field, or a value the
 * client passed) is honored only if it actually resolves to a device with a
 * configured agent - a stale/legacy device with no agentId is treated the
 * same as no explicit id at all, and falls through to auto-resolution.
 */
export async function resolveActiveGymDevice(explicitDeviceId?: unknown) {
  if (explicitDeviceId) {
    const explicit = await Device.findById(explicitDeviceId);
    if (explicit?.agentId) return explicit;
  }
  return Device.findOne({ agentId: { $exists: true, $ne: null } }).sort({ lastSeenAt: -1 });
}

/**
 * Queues a device-lifecycle job (CREATE_USER/SYNC_USER/DISABLE_ACCESS/
 * DELETE_USER) for the Gym Device Agent to execute. These replace the old
 * direct backend-to-device ISAPI calls in lib/isapi.ts, which only ever
 * worked when the backend and device shared a LAN - now that the backend
 * runs on a VPS and the device sits behind the gym's own NAT with no
 * public IP, only the agent (which lives on the device's LAN) can reach
 * it, so every device mutation has to go through this queue instead.
 *
 * Silently no-ops (returns null) if the device has no agent configured -
 * callers treat that the same as "device sync unavailable", matching the
 * old direct-call code's best-effort error handling.
 */
export async function queueDeviceJob(
  deviceId: unknown,
  memberId: unknown,
  type: "CREATE_USER" | "SYNC_USER" | "DISABLE_ACCESS" | "DELETE_USER",
  payload: Record<string, unknown>
): Promise<{ jobId: string } | null> {
  const device = await Device.findById(deviceId);
  if (!device || !device.agentId) return null;

  const job = await DeviceJob.create({
    gymId: device.gymId,
    device: device._id,
    agentId: device.agentId,
    member: memberId,
    type,
    status: "PENDING",
    payload,
  });

  return { jobId: String(job._id) };
}
