export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function computeStatus(membershipEnd: Date | null | undefined): "active" | "expired" | "inactive" {
  if (!membershipEnd) return "inactive";
  return membershipEnd.getTime() >= Date.now() ? "active" : "expired";
}
