import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import Payment from "@/models/Payment";
import Device from "@/models/Device";
import { getAuth } from "@/lib/auth";
import { deleteDeviceUser } from "@/lib/isapi";

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
  const member = await Member.findByIdAndUpdate(params.id, body, { new: true }).populate("currentPlan");
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  return NextResponse.json({ member });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const member = await Member.findById(params.id);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (member.device) {
    const device = await Device.findById(member.device);
    if (device) {
      try {
        await deleteDeviceUser(device, member.deviceUserId);
      } catch {
        // Non-fatal: member record removal still proceeds.
      }
    }
  }

  await member.deleteOne();
  return NextResponse.json({ ok: true });
}
