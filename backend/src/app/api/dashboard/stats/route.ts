import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import Payment from "@/models/Payment";
import AccessLog from "@/models/AccessLog";
import { getAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalMembers, activeMembers, expiredMembers, expiringSoon, revenueThisMonth, todayVisits] =
    await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: "active" }),
      Member.countDocuments({ status: "expired" }),
      Member.countDocuments({
        status: "active",
        membershipEnd: { $gte: now, $lte: in7Days },
      }),
      Payment.aggregate([
        { $match: { paidAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      AccessLog.countDocuments({ occurredAt: { $gte: startOfDay }, result: "granted" }),
    ]);

  return NextResponse.json({
    totalMembers,
    activeMembers,
    expiredMembers,
    expiringSoon,
    revenueThisMonth: revenueThisMonth[0]?.total || 0,
    todayVisits,
  });
}
