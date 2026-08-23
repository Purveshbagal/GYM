import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import MembershipPlan from "@/models/MembershipPlan";
import Payment from "@/models/Payment";
import Device from "@/models/Device";
import { getAuth } from "@/lib/auth";
import { addMonths } from "@/lib/membership";
import { updateDeviceUserValidity } from "@/lib/isapi";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { planId, amountPaid, paymentMethod } = await req.json();

  const member = await Member.findById(params.id);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const plan = await MembershipPlan.findById(planId || member.currentPlan);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // Renewing before expiry extends from the current end date; renewing
  // after a lapse starts fresh from today so the member doesn't lose days.
  const base =
    member.membershipEnd && member.membershipEnd.getTime() > Date.now()
      ? member.membershipEnd
      : new Date();
  const newEnd = addMonths(base, plan.durationMonths);

  member.currentPlan = plan._id;
  member.membershipStart = member.membershipStart || new Date();
  member.membershipEnd = newEnd;
  member.status = "active";
  await member.save();

  await Payment.create({
    member: member._id,
    plan: plan._id,
    amount: amountPaid ?? plan.fees,
    type: "renewal",
    method: paymentMethod || "cash",
    periodStart: base,
    periodEnd: newEnd,
  });

  let deviceSync: unknown = null;
  if (member.device) {
    const device = await Device.findById(member.device);
    if (device) {
      try {
        deviceSync = await updateDeviceUserValidity(device, {
          employeeNo: member.deviceUserId,
          name: member.name,
          validFrom: member.membershipStart,
          validTo: newEnd,
          enable: true,
        });
      } catch (err) {
        deviceSync = { ok: false, error: String(err) };
      }
    }
  }

  const populated = await member.populate("currentPlan");
  return NextResponse.json({ member: populated, deviceSync });
}
