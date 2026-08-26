import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Device from "@/models/Device";
import Member from "@/models/Member";
import { getAuth } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const device = await Device.findById(params.id);
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  // Members enrolled on this terminal keep their record; just drop the
  // now-dangling device reference so the app doesn't point at a deleted device.
  await Member.updateMany({ device: device._id }, { $unset: { device: "" } });
  await device.deleteOne();

  return NextResponse.json({ ok: true });
}
