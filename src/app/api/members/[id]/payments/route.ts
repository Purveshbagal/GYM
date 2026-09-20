import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";
import Payment from "@/models/Payment";
import { getAuth } from "@/lib/auth";

/**
 * "Payment In" - a standalone payment against a member's existing pending
 * balance, not tied to a new-membership or renewal cycle. Reduces
 * pendingAmount (floored at 0) and records a Payment row of type "payment"
 * so it still shows up in payment history and Total Collection.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { amount, method } = await req.json();

  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) {
    return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
  }

  const member = await Member.findById(params.id);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  member.pendingAmount = Math.max(0, (member.pendingAmount ?? 0) - amountNum);
  await member.save();

  const payment = await Payment.create({
    member: member._id,
    plan: member.currentPlan ?? undefined,
    amount: amountNum,
    dueAmount: 0,
    balanceAfter: member.pendingAmount,
    type: "payment",
    method: method || "cash",
  });

  const populated = await member.populate("currentPlan");
  return NextResponse.json({ member: populated, payment });
}
