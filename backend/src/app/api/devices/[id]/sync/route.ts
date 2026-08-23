import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Device from "@/models/Device";
import { getAuth } from "@/lib/auth";
import { testDeviceConnection } from "@/lib/isapi";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const device = await Device.findById(params.id);
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  const test = await testDeviceConnection(device);
  device.online = test.ok;
  device.lastSeenAt = new Date();
  await device.save();

  return NextResponse.json({ online: device.online, result: test });
}
