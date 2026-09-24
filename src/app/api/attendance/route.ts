import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import AccessLog from "@/models/AccessLog";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, days: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** [start, end) for the requested filter, in server-local days (same convention as dashboard stats' todayVisits). */
function resolveRange(period: string, from: string | null, to: string | null) {
  const now = new Date();
  const todayStart = startOfDay(now);
  if (period === "today") return { start: todayStart, end: addDays(todayStart, 1) };
  if (period === "yesterday") return { start: addDays(todayStart, -1), end: todayStart };
  if (period === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: addDays(todayStart, 1) };
  if (period === "custom") {
    if (!from || !to) return null;
    const start = startOfDay(new Date(from));
    const end = addDays(startOfDay(new Date(to)), 1);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }
  return null;
}

/**
 * Attendance list.
 *   ?period=all|today|yesterday|month|custom (default "all")
 *   ?from=&to=   required when period=custom (yyyy-mm-dd or any Date-parseable string)
 *   ?search=     name/phone/deviceUserId filter, any period
 *
 * period=all returns every member (each flagged with presentToday) so the
 * "All" tab can still be browsed/searched like a member directory. Every
 * other period returns only members with at least one granted check-in in
 * that window, newest visit first - that's who "attended" for the filter.
 */
export async function GET(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "all";
  const search = searchParams.get("search");

  const searchQuery: Record<string, unknown> = {};
  if (search) {
    searchQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { deviceUserId: { $regex: search, $options: "i" } },
    ];
  }

  if (period === "all") {
    const members = await Member.find(searchQuery).populate("currentPlan").sort({ name: 1 }).lean();
    const todayRange = resolveRange("today", null, null)!;
    const presentTodayIds = new Set(
      (
        await AccessLog.aggregate([
          {
            $match: {
              member: { $in: members.map((m) => m._id) },
              result: "granted",
              occurredAt: { $gte: todayRange.start, $lt: todayRange.end },
            },
          },
          { $group: { _id: "$member" } },
        ])
      ).map((r) => String(r._id))
    );
    const records = members.map((m) => ({ member: m, presentToday: presentTodayIds.has(String(m._id)) }));
    return NextResponse.json({ count: records.length, records });
  }

  const range = resolveRange(period, searchParams.get("from"), searchParams.get("to"));
  if (!range) return NextResponse.json({ error: "Invalid period or missing from/to for custom range" }, { status: 400 });

  const grouped: { _id: unknown; visits: number; lastVisit: Date }[] = await AccessLog.aggregate([
    { $match: { result: "granted", member: { $ne: null }, occurredAt: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: "$member", visits: { $sum: 1 }, lastVisit: { $max: "$occurredAt" } } },
    { $sort: { lastVisit: -1 } },
  ]);

  const memberQuery: Record<string, unknown> = { ...searchQuery, _id: { $in: grouped.map((g) => g._id) } };
  const members = await Member.find(memberQuery).populate("currentPlan").lean();
  const memberById = new Map(members.map((m) => [String(m._id), m]));

  const records = grouped
    .map((g) => {
      const member = memberById.get(String(g._id));
      if (!member) return null;
      return { member, visits: g.visits, lastVisit: g.lastVisit };
    })
    .filter((r): r is { member: (typeof members)[number]; visits: number; lastVisit: Date } => r !== null);

  return NextResponse.json({ count: records.length, records });
}
