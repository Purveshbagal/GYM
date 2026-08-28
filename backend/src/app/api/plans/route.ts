import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MembershipPlan from "@/models/MembershipPlan";
import { getAuth } from "@/lib/auth";

export async function GET() {
  await connectDB();
  const plans = await MembershipPlan.find().sort({ durationMonths: 1 });
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { name, durationMonths, fees, description } = await req.json();
  if (!name || !durationMonths || fees === undefined) {
    return NextResponse.json({ error: "name, durationMonths, fees required" }, { status: 400 });
  }
  const plan = await MembershipPlan.create({ name, durationMonths, fees, description });
  return NextResponse.json({ plan }, { status: 201 });
}
