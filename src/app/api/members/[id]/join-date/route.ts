import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import MembershipPlan from "@/models/MembershipPlan";
import { getAuth } from "@/lib/auth";
import { addMonths, computeStatus } from "@/lib/membership";
import { queueDeviceJob } from "@/lib/deviceJobs";

/**
 * Narrow, dedicated endpoint for correcting a member's join date after
 * creation - deliberately NOT routed through the generic PUT /[id] (which
 * blindly merges the whole request body). Only membershipStart/
 * membershipEnd/status change here; deviceUserId, biometric enrollment
 * flags, and device assignment are never touched. Recomputes the
 * membership window from the member's current plan duration (same as
 * renew/route.ts) and pushes the new validity window to the device via
 * SYNC_USER, which only updates UserInfo (name/validity/enable) on the
 * terminal - it does not touch fingerprint/face templates or agent auth.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { joinDate } = await req.json();
  if (!joinDate) return NextResponse.json({ error: "joinDate required" }, { status: 400 });

  const newStart = new Date(joinDate);
  if (Number.isNaN(newStart.getTime())) {
    return NextResponse.json({ error: "Invalid joinDate" }, { status: 400 });
  }

  const member = await Member.findById(params.id).populate("currentPlan");
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const plan = member.currentPlan as unknown as { durationMonths: number } | null;
  if (!plan) return NextResponse.json({ error: "Member has no active plan to recompute expiry from" }, { status: 400 });

  const newEnd = addMonths(newStart, plan.durationMonths);

  member.membershipStart = newStart;
  member.membershipEnd = newEnd;
  member.status = computeStatus(newEnd);
  await member.save();

  let deviceSync: unknown = null;
  if (member.device) {
    try {
      deviceSync = await queueDeviceJob(member.device, member._id, "SYNC_USER", {
        employeeNo: member.deviceUserId,
        name: member.name,
        validFrom: newStart.toISOString(),
        validTo: newEnd.toISOString(),
        enable: member.status !== "inactive",
      });
    } catch (err) {
      deviceSync = { ok: false, error: String(err) };
    }
  }

  return NextResponse.json({ member, deviceSync });
}
