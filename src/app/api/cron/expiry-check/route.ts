import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { reconcileExpiredMembers, sendMembershipReminders } from "@/lib/membership";

export const dynamic = "force-dynamic";

/**
 * The device already refuses expired members' face/fingerprint on its own
 * (Valid.endTime is set at registration/renewal time), so this endpoint
 * only keeps our DB's status field in sync for reporting/renew-prompt UI.
 * Call it from scripts/cron.ts or any external scheduler once a day.
 * (The same reconciliation also runs lazily on members/dashboard reads.)
 *
 * Also runs the WhatsApp expiry-reminder sweep (7-day-left + just-expired)
 * here since both need the same "once a day" cadence and status must be
 * reconciled first for the just-expired check to see them.
 */
export async function GET() {
  await connectDB();
  const result = await reconcileExpiredMembers();
  const reminders = await sendMembershipReminders();
  return NextResponse.json({ ok: true, expiredCount: result.modifiedCount, reminders });
}
