import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import AccessLog from "@/models/AccessLog";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Per-member attendance summary: today/yesterday presence plus distinct
 * days-present counts over this month / trailing 3mo / 6mo / 1yr, alongside
 * the member's current plan. One query (granted logs over the trailing
 * year) covers every window - counted in JS (not a Mongo $dateToString
 * group) so "day" boundaries match the server-local convention the rest of
 * the app already uses (see dashboard stats' todayVisits).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const member = await Member.findById(params.id).populate("currentPlan");
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const logs: any[] = await AccessLog.find({
    member: member._id,
    result: "granted",
    occurredAt: { $gte: oneYearAgo },
  })
    .select("occurredAt -_id")
    .lean();

  const days = Array.from(new Set(logs.map((l) => fmt(new Date(l.occurredAt))))).sort();
  const countSince = (threshold: Date) => days.filter((d) => d >= fmt(threshold)).length;

  return NextResponse.json({
    member,
    today: days.includes(fmt(todayStart)),
    yesterday: days.includes(fmt(yesterdayStart)),
    thisMonth: countSince(monthStart),
    last3Months: countSince(threeMonthsAgo),
    last6Months: countSince(sixMonthsAgo),
    lastYear: days.length,
  });
}
