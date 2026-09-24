import Member from "@/models/Member";
import { send7DayExpiryWhatsApp, sendExpiredWhatsApp } from "@/lib/whatsapp";

export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function computeStatus(membershipEnd: Date | null | undefined): "active" | "expired" | "inactive" {
  if (!membershipEnd) return "inactive";
  return membershipEnd.getTime() >= Date.now() ? "active" : "expired";
}

// Flips any member whose membershipEnd has passed from "active" to
// "expired". The daily cron script already does this once a day; calling
// this at the top of read paths that filter/count by status makes expiry
// self-healing on every request instead of waiting for the next midnight
// run (or for that standalone process to even be running).
export async function reconcileExpiredMembers() {
  return Member.updateMany(
    { status: "active", membershipEnd: { $lt: new Date() } },
    { $set: { status: "expired" } }
  );
}

/**
 * Daily WhatsApp sweep (called from /api/cron/expiry-check, which the
 * node-schedule cron already hits once a day): notifies members whose
 * membership is about to lapse or has just lapsed. The `notified*` flags on
 * Member make each send one-shot per membership window - renew clears them
 * so the next cycle gets its own reminders.
 */
export async function sendMembershipReminders() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const expiringSoon = await Member.find({
    status: "active",
    membershipEnd: { $gte: now, $lte: in7Days },
    notifiedExpiry7Day: false,
  });
  for (const member of expiringSoon) {
    const result = await send7DayExpiryWhatsApp(member);
    if (result.ok) {
      member.notifiedExpiry7Day = true;
      await member.save();
    }
  }

  // Runs after reconcileExpiredMembers() has already flipped status, so this
  // only needs to filter on the "not yet notified" flag.
  const justExpired = await Member.find({ status: "expired", notifiedExpired: false });
  for (const member of justExpired) {
    const result = await sendExpiredWhatsApp(member);
    if (result.ok) {
      member.notifiedExpired = true;
      await member.save();
    }
  }

  return { expiringSoonCount: expiringSoon.length, justExpiredCount: justExpired.length };
}
