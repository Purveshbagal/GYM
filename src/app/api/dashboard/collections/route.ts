import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import { getAuth } from "@/lib/auth";

type Range = "today" | "yesterday" | "thisMonth" | "previousMonth" | "thisYear" | "custom";

function computeRange(range: Range, fromParam: string | null, toParam: string | null): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now.getTime() - 86400000);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "thisMonth":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case "previousMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }
    case "thisYear":
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
    case "custom":
    default:
      return {
        start: fromParam ? startOfDay(new Date(fromParam)) : startOfDay(now),
        end: toParam ? endOfDay(new Date(toParam)) : endOfDay(now),
      };
  }
}

/**
 * Backs the "Total Collection" drilldown - a date-range-filtered list of
 * payments plus their sum. Only counts payments whose member document
 * still exists: deleting a member does not cascade-delete their Payment
 * history (see DELETE /api/members/[id]), so a raw Payment sum would
 * otherwise keep counting revenue from members who were removed.
 */
export async function GET(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") as Range) || "thisMonth";
  const { start, end } = computeRange(range, searchParams.get("from"), searchParams.get("to"));

  const payments = await Payment.find({ paidAt: { $gte: start, $lte: end } })
    .populate("member", "name deviceUserId")
    .populate("plan", "name")
    .sort({ paidAt: -1 });

  const existing = payments.filter((p) => p.member != null);
  const total = existing.reduce((sum, p) => sum + p.amount, 0);

  return NextResponse.json({ total, payments: existing, range: { start, end } });
}
