import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuth } from "@/lib/auth";
import { createMemberEnrollmentJob } from "@/lib/biometricJobs";

// The Hikvision terminal has no ISAPI command that opens its own camera
// remotely (confirmed live: CaptureFace returns HTTP 400 notSupport even
// though its capabilities doc claims isSupportCaptureFace: true). So
// instead of waiting for a local terminal-menu enrollment (see the
// ENROLL_FACE flow in face/route.ts), this endpoint accepts a photo the
// phone captured with its own camera and hands it to the Agent as a
// base64 job payload - the Agent then pushes it into the device's face
// library via FaceDataRecord. See agent/src/faceEnroll.ts
// (enrollFaceFromPhoto) for the device-side half of this flow.
const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB - well above what image_picker's resized camera capture produces
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  await connectDB();

  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ success: false, message: "Missing photo file", code: "MISSING_PHOTO" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(photo.type)) {
    return NextResponse.json(
      { success: false, message: "Photo must be JPEG or PNG", code: "INVALID_PHOTO_TYPE" },
      { status: 400 }
    );
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { success: false, message: "Photo is too large", code: "PHOTO_TOO_LARGE" },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  const photoBase64 = bytes.toString("base64");
  const photoMimeType = photo.type;

  const result = await createMemberEnrollmentJob(params.id, "ENROLL_FACE_PHOTO", { photoBase64, photoMimeType });
  if ("error" in result) return result.error;

  return NextResponse.json(
    { success: true, message: "Face enrollment started", data: { jobId: String(result.job._id) } },
    { status: 201 }
  );
}
