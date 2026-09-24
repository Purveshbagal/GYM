import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import MembershipPlan from "@/models/MembershipPlan";
import Payment from "@/models/Payment";
import { getAuth } from "@/lib/auth";
import { addMonths } from "@/lib/membership";
import { queueDeviceJob, resolveActiveGymDevice } from "@/lib/deviceJobs";

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

  const amountPaidNum = amountPaid ?? plan.fees;
  const newPending = Math.max(0, (member.pendingAmount ?? 0) + plan.fees - amountPaidNum);

  member.currentPlan = plan._id;
  member.membershipStart = member.membershipStart || new Date();
  member.membershipEnd = newEnd;
  member.status = "active";
  member.pendingAmount = newPending;
  // New membership window - let it earn its own 7-day/expired reminders.
  member.notifiedExpiry7Day = false;
  member.notifiedExpired = false;
  await member.save();

  await Payment.create({
    member: member._id,
    plan: plan._id,
    amount: amountPaidNum,
    dueAmount: plan.fees,
    balanceAfter: newPending,
    type: "renewal",
    method: paymentMethod || "cash",
    periodStart: base,
    periodEnd: newEnd,
  });

  // Resolve "the gym's device" the same robust way members/route.ts POST
  // does, instead of trusting member.device directly - that field can be
  // empty (member created before any agent-configured device existed) or
  // stale (agent reinstalled/reconfigured since), in which case the old
  // `if (member.device)` check silently skipped queueing any sync job at
  // all, leaving the terminal enforcing the pre-renewal expiry window.
  const device = await resolveActiveGymDevice(member.device);
  let deviceSync: unknown = null;
  if (device) {
    if (String(member.device ?? "") !== String(device._id)) {
      member.device = device._id;
      await member.save();
    }
    try {
      deviceSync = await queueDeviceJob(device._id, member._id, "SYNC_USER", {
        employeeNo: member.deviceUserId,
        name: member.name,
        validFrom: member.membershipStart.toISOString(),
        validTo: newEnd.toISOString(),
        enable: true,
      });
    } catch (err) {
      deviceSync = { ok: false, error: String(err) };
    }
  }

  const populated = await member.populate("currentPlan");
  return NextResponse.json({ member: populated, deviceSync });
}
