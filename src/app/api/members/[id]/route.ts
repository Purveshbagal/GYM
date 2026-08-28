import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import Payment from "@/models/Payment";
import { getAuth } from "@/lib/auth";
import { queueDeviceJob } from "@/lib/deviceJobs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const member = await Member.findById(params.id).populate("currentPlan").populate("device");
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  const payments = await Payment.find({ member: member._id }).populate("plan").sort({ paidAt: -1 });
  return NextResponse.json({ member, payments });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const body = await req.json();
  delete body.deviceUserId; // immutable, it's the ISAPI employeeNo

  const existing = await Member.findById(params.id);
  if (!existing) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // First-time terminal assignment (e.g. from the Android app's biometric
  // enrollment flow) - provision the person on the device via the job
  // queue so a subsequent ENROLL_FINGERPRINT/ENROLL_FACE job has a
  // UserInfo record to attach to, with the valid window matching this
  // member's current membership period.
  const assigningNewDevice = body.device && String(existing.device ?? "") !== String(body.device);

  const member = await Member.findByIdAndUpdate(params.id, body, { new: true }).populate("currentPlan");
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  let deviceSync: unknown = null;
  if (assigningNewDevice) {
    try {
      deviceSync = await queueDeviceJob(body.device, member._id, "CREATE_USER", {
        employeeNo: member.deviceUserId,
        name: member.name,
        validFrom: (member.membershipStart ?? new Date()).toISOString(),
        validTo: (member.membershipEnd ?? new Date()).toISOString(),
      });
    } catch (err) {
      deviceSync = { ok: false, error: String(err) };
    }
  }

  return NextResponse.json({ member, deviceSync });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const member = await Member.findById(params.id);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (member.device) {
    try {
      await queueDeviceJob(member.device, member._id, "DELETE_USER", { employeeNo: member.deviceUserId });
    } catch {
      // Non-fatal: member record removal still proceeds.
    }
  }

  await member.deleteOne();
  return NextResponse.json({ ok: true });
}
