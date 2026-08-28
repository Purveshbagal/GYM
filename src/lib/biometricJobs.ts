import { NextResponse } from "next/server";
import Member from "@/models/Member";
import DeviceJob from "@/models/DeviceJob";
import { resolveActiveGymDevice } from "@/lib/deviceJobs";

// How stale a device's last heartbeat can be before we consider its agent
// offline and refuse to queue a job that would otherwise sit PENDING
// forever with no one to pick it up (agent heartbeats every 30s - see
// agent/src/heartbeat.ts).
const AGENT_STALE_MS = 90_000;

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

  const device = await resolveActiveGymDevice(member.device);
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
