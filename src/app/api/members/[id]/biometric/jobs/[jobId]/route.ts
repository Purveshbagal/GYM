import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuth } from "@/lib/auth";
import DeviceJob from "@/models/DeviceJob";

/**
 * Android polls this every 1-2s while a fingerprint/face enrollment job
 * is PENDING/PROCESSING, to drive the Pending -> Processing -> Success UI.
 * `result` only ever contains non-biometric metadata (fingerPrintQuality,
 * or {detected:true} for face) - see agent/src/fingerprintEnroll.ts and
 * faceEnroll.ts, which never return raw fingerData/faceURL to the job
 * result in the first place.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string; jobId: string } }) {
  if (!getAuth(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  await connectDB();

  const job = await DeviceJob.findOne({ _id: params.jobId, member: params.id });
  if (!job) return NextResponse.json({ success: false, message: "Job not found", code: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    success: true,
    message: "Job status",
    data: {
      jobId: String(job._id),
      type: job.type,
      status: job.status,
      result: job.result ?? null,
      errorMessage: job.errorMessage ?? null,
    },
  });
}
