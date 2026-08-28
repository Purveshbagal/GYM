import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MembershipPlan from "@/models/MembershipPlan";
import { getAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const body = await req.json();
  const plan = await MembershipPlan.findByIdAndUpdate(params.id, body, { new: true });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  // Soft-delete: existing members referencing this plan keep valid history.
  const plan = await MembershipPlan.findByIdAndUpdate(params.id, { active: false }, { new: true });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
}
