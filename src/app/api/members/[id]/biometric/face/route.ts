import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuth } from "@/lib/auth";
import { createMemberEnrollmentJob } from "@/lib/biometricJobs";

/**
 * Android calls this when the admin taps "Face". There is no remote
 * trigger for face capture on this device (CaptureFace confirmed
 * notSupport) - the member enrolls using the terminal's OWN camera via
 * its local menu. This job just tells the Agent which employeeNo to
 * watch: the Agent records the current numOfFace, polls UserInfo/Search,
 * and reports SUCCESS the moment numOfFace increases - see
 * agent/src/faceEnroll.ts. Android polls GET .../biometric/jobs/:jobId
 * for status exactly like fingerprint.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  await connectDB();

  const result = await createMemberEnrollmentJob(params.id, "ENROLL_FACE");
  if ("error" in result) return result.error;

  return NextResponse.json(
    { success: true, message: "Face enrollment started - have the member look at the terminal's camera", data: { jobId: String(result.job._id) } },
    { status: 201 }
  );
}
