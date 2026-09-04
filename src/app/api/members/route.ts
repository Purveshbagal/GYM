import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import MembershipPlan from "@/models/MembershipPlan";
import Payment from "@/models/Payment";
import { getAuth } from "@/lib/auth";
import { addMonths } from "@/lib/membership";
import { queueDeviceJob, resolveActiveGymDevice } from "@/lib/deviceJobs";

export async function GET(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const joinDateFrom = searchParams.get("joinDateFrom");
  const joinDateTo = searchParams.get("joinDateTo");
  const expiringWithinDays = searchParams.get("expiringWithinDays");

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { deviceUserId: { $regex: search, $options: "i" } },
    ];
  }
  // membershipStart is the field actually populated with the real join
  // date (see POST below) - the schema's separate `joinDate` field is
  // never set, so filtering by it wouldn't match anything.
  if (joinDateFrom || joinDateTo) {
    const range: Record<string, Date> = {};
    if (joinDateFrom) range.$gte = new Date(joinDateFrom);
    if (joinDateTo) range.$lte = new Date(joinDateTo);
    query.membershipStart = range;
  }
  if (expiringWithinDays) {
    const days = Number(expiringWithinDays);
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400000);
    query.status = "active";
    query.membershipEnd = { $gte: now, $lte: until };
  }

  const sort: Record<string, 1 | -1> = expiringWithinDays ? { membershipEnd: 1 } : { createdAt: -1 };
  const members = await Member.find(query).populate("currentPlan").sort(sort);
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const {
    name,
    phone,
    email,
    gender,
    address,
    emergencyContact,
    planId,
    amountPaid,
    paymentMethod,
    deviceId,
    joinDate,
  } = await req.json();

  if (!name || !phone || !planId) {
    return NextResponse.json({ error: "name, phone, planId required" }, { status: 400 });
  }

  const plan = await MembershipPlan.findById(planId);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const memberCount = await Member.countDocuments();
  const deviceUserId = String(1000 + memberCount + 1);

  // Staff sometimes add a member a few days after their real join date -
  // an explicit joinDate lets the membership window (and therefore
  // expiry/device validity) be backdated correctly instead of always
  // starting from "now".
  const membershipStart = joinDate ? new Date(joinDate) : new Date();
  const membershipEnd = addMonths(membershipStart, plan.durationMonths);

  // No manual terminal assignment: the gym's active, agent-configured
  // Device is resolved automatically (by agentId, never IP), same as
  // biometric enrollment does. `deviceId` is honored only if it happens to
  // already point at a properly agent-configured device.
  const device = await resolveActiveGymDevice(deviceId);

  const member = await Member.create({
    deviceUserId,
    name,
    phone,
    email,
    gender,
    address,
    emergencyContact,
    currentPlan: plan._id,
    membershipStart,
    membershipEnd,
    status: "active",
    device: device?._id,
  });

  await Payment.create({
    member: member._id,
    plan: plan._id,
    amount: amountPaid ?? plan.fees,
    type: "new",
    method: paymentMethod || "cash",
    periodStart: membershipStart,
    periodEnd: membershipEnd,
  });

  let deviceSync: unknown = null;
  if (device) {
    try {
      deviceSync = await queueDeviceJob(device._id, member._id, "CREATE_USER", {
        employeeNo: deviceUserId,
        name,
        validFrom: membershipStart.toISOString(),
        validTo: membershipEnd.toISOString(),
      });
    } catch (err) {
      deviceSync = { ok: false, error: String(err) };
    }
  }

  const populated = await member.populate("currentPlan");
  return NextResponse.json(
    {
      member: populated,
      deviceUserId,
      deviceSync,
      note: "Take the member to the terminal and enroll face/fingerprint using this deviceUserId as the employee number.",
    },
    { status: 201 }
  );
}
