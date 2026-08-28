import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAgentAuth } from "@/lib/agentAuth";
import DeviceJob from "@/models/DeviceJob";
import Member from "@/models/Member";

const MAX_ATTEMPTS = 5;

// Enrollment jobs (fingerprint/face) already have their own internal
// wait/retry behavior (fingerprint capture, or up to ~2 minutes polling
// for a local face enrollment) - a device-level failure there is a real
// answer ("member didn't finish enrolling in time"), not a transient
// blip worth silently re-queuing forever the way GET_DEVICE_STATUS is.
const NO_AUTO_RETRY_TYPES = new Set(["ENROLL_FINGERPRINT", "ENROLL_FACE"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();
  const agent = await getAgentAuth(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await DeviceJob.findOne({ _id: params.id, agentId: agent.agentId });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const { success, result, errorMessage } = await req.json();

  if (success) {
    job.status = "SUCCESS";
    job.result = result ?? null;
    job.errorMessage = undefined;

    if (job.member && job.type === "ENROLL_FINGERPRINT") {
      await Member.updateOne({ _id: job.member }, { $set: { fingerprintEnrolled: true, biometricEnrolled: true } });
    } else if (job.member && job.type === "ENROLL_FACE") {
      await Member.updateOne({ _id: job.member }, { $set: { faceEnrolled: true, biometricEnrolled: true } });
    }
  } else {
    job.errorMessage = errorMessage || "Unknown error";
    if (NO_AUTO_RETRY_TYPES.has(job.type)) {
      job.status = "FAILED";
    } else {
      job.status = job.attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING"; // re-queue for the next poll
    }
  }
  await job.save();

  return NextResponse.json({ success: true, message: "Job result recorded", data: { jobId: String(job._id), status: job.status } });
}
