import { NextResponse } from "next/server";
import Member from "@/models/Member";
import Device from "@/models/Device";
import DeviceJob from "@/models/DeviceJob";

// How stale a device's last heartbeat can be before we consider its agent
// offline and refuse to queue a job that would otherwise sit PENDING
// forever with no one to pick it up (agent heartbeats every 30s - see
// agent/src/heartbeat.ts).
const AGENT_STALE_MS = 90_000;

/**
 * Finds the biometric Device/Agent a member's enrollment job should go to.
 * Members are never required to have one manually assigned (the old
 * Add Member terminal dropdown is gone) - this resolves the gym's active,
 * agent-configured Device automatically, identified by agentId (the stable
 * identity), not by IP. A member-level `device` is still honored if one
 * happens to be set (e.g. an older record), but is no longer required.
 *
 * There's currently no per-gym scoping field on Member, and the app is
 * single-gym in practice, so "the gym's device" is simply the most
 * recently active agent-configured Device system-wide. If/when Member
 * gains its own gymId, this is the one place that would need to filter by
 * it too.
 */
async function resolveMemberDevice(member: InstanceType<typeof Member>) {
  if (member.device) return Device.findById(member.device);
  return Device.findOne({ agentId: { $exists: true, $ne: null } }).sort({ lastSeenAt: -1 });
}

/**
 * Shared by the fingerprint and face enrollment routes: both need the
 * same member/device/agent lookup and the same "is anyone actually
 * listening" check before creating a job. Returns a ready-to-send
 * NextResponse on any failure, or the created job on success.
 */
export async function createMemberEnrollmentJob(
  memberId: string,
  type: "ENROLL_FINGERPRINT" | "ENROLL_FACE"
): Promise<{ error: NextResponse } | { job: InstanceType<typeof DeviceJob> }> {
  const member = await Member.findById(memberId);
  if (!member) {
    return { error: NextResponse.json({ success: false, message: "Member not found", code: "NOT_FOUND" }, { status: 404 }) };
  }

  const device = await resolveMemberDevice(member);
  if (!device || !device.agentId) {
    return {
      error: NextResponse.json(
        { success: false, message: "No active biometric terminal is available for this gym.", code: "NO_AGENT" },
        { status: 400 }
      ),
    };
  }

  const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
  if (Date.now() - lastSeen > AGENT_STALE_MS) {
    return {
      error: NextResponse.json(
        { success: false, message: "Gym biometric device is offline.", code: "DEVICE_OFFLINE" },
        { status: 409 }
      ),
    };
  }

  const payload: Record<string, unknown> = { employeeNo: member.deviceUserId };
  if (type === "ENROLL_FINGERPRINT") payload.fingerNo = 1;

  const job = await DeviceJob.create({
    gymId: device.gymId,
    device: device._id,
    agentId: device.agentId,
    member: member._id,
    type,
    status: "PENDING",
    payload,
  });

  return { job };
}
