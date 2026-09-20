import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import { getAuth } from "@/lib/auth";

/**
 * Backs the Dashboard's "Pending Payments" drilldown - every member who
 * still owes money, most-owed first. Mirrors dashboard/collections's
 * {total, list} shape.
 */
export async function GET(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const members = await Member.find({ pendingAmount: { $gt: 0 } })
    .populate("currentPlan")
    .sort({ pendingAmount: -1 });

  const total = members.reduce((sum, m) => sum + (m.pendingAmount || 0), 0);

  return NextResponse.json({ total, members });
}
