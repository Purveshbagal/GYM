import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import Device from "@/models/Device";
import { getAuth } from "@/lib/auth";
import { disableDeviceUser, updateDeviceUserValidity } from "@/lib/isapi";

// Lets staff manually suspend/restore a member's door access outside the
// normal expiry flow (e.g. payment dispute, temporary hold).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { enable } = await req.json();

  const member = await Member.findById(params.id);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  member.status = enable ? "active" : "inactive";
  await member.save();

  let deviceSync: unknown = null;
  if (member.device) {
    const device = await Device.findById(member.device);
    if (device) {
      try {
        deviceSync = enable
          ? await updateDeviceUserValidity(device, {
              employeeNo: member.deviceUserId,
              name: member.name,
              validFrom: member.membershipStart || new Date(),
              validTo: member.membershipEnd || new Date(),
              enable: true,
            })
          : await disableDeviceUser(device, member.deviceUserId, member.name);
      } catch (err) {
        deviceSync = { ok: false, error: String(err) };
      }
    }
  }

  return NextResponse.json({ member, deviceSync });
}
