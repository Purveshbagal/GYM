import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuth } from "@/lib/auth";
import { createMemberEnrollmentJob } from "@/lib/biometricJobs";

/**
 * Android calls this when the admin taps "Fingerprint" in Add Member /
 * member detail. Creates a PENDING ENROLL_FINGERPRINT job the Gym Device
 * Agent will pick up, capture via CaptureFingerPrint (confirmed XML
 * schema), and save via FingerPrintCfg - see agent/src/fingerprintEnroll.ts.
 * Android then polls GET .../biometric/jobs/:jobId for status.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  await connectDB();

  const result = await createMemberEnrollmentJob(params.id, "ENROLL_FINGERPRINT");
  if ("error" in result) return result.error;

  return NextResponse.json(
    { success: true, message: "Fingerprint enrollment started", data: { jobId: String(result.job._id) } },
    { status: 201 }
  );
}
