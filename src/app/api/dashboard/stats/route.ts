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
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalMembers, activeMembers, expiredMembers, expiringSoon, totalCollection, todayVisits] =
    await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: "active" }),
      Member.countDocuments({ status: "expired" }),
      Member.countDocuments({
        status: "active",
        membershipEnd: { $gte: now, $lte: in7Days },
      }),
      // All-time total, not just this month - and only for members that
      // still exist (deleting a member doesn't cascade-delete their
      // Payment history, so a plain sum would over-count).
      Payment.aggregate([
        { $lookup: { from: "members", localField: "member", foreignField: "_id", as: "memberDoc" } },
        { $match: { memberDoc: { $ne: [] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      AccessLog.countDocuments({ occurredAt: { $gte: startOfDay }, result: "granted" }),
    ]);

  return NextResponse.json({
    totalMembers,
    activeMembers,
    expiredMembers,
    expiringSoon,
    totalCollection: totalCollection[0]?.total || 0,
    todayVisits,
  });
}
