import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Member from "@/models/Member";

export const dynamic = "force-dynamic";

/**
 * The device already refuses expired members' face/fingerprint on its own
 * (Valid.endTime is set at registration/renewal time), so this endpoint
 * only keeps our DB's status field in sync for reporting/renew-prompt UI.
 * Call it from scripts/cron.ts or any external scheduler once a day.
 */
export async function GET() {
  await connectDB();
  const now = new Date();

  const result = await Member.updateMany(
    { status: "active", membershipEnd: { $lt: now } },
    { $set: { status: "expired" } }
  );

  return NextResponse.json({ ok: true, expiredCount: result.modifiedCount });
}
