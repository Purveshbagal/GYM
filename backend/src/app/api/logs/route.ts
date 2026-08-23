import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AccessLog from "@/models/AccessLog";
import { getAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit")) || 100;
  const memberId = searchParams.get("member");

  const query: Record<string, unknown> = {};
  if (memberId) query.member = memberId;

  const logs = await AccessLog.find(query)
    .populate("member", "name phone deviceUserId")
    .sort({ occurredAt: -1 })
    .limit(limit);

  return NextResponse.json({ logs });
}
