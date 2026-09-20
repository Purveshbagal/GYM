import Member from "@/models/Member";

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
