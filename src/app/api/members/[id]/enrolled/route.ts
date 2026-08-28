import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import { getAuth } from "@/lib/auth";

// Staff calls this after physically enrolling the member's face/fingerprint
// on the terminal, so the app can show enrollment status.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const member = await Member.findByIdAndUpdate(
    params.id,
    { biometricEnrolled: true },
    { new: true }
  );
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  return NextResponse.json({ member });
}
