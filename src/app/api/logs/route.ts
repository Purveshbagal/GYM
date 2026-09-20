import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import AccessLog from "@/models/AccessLog";
import Member from "@/models/Member";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Clients that don't paginate (older app builds) just get a bigger first page.
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

/** Rows strictly older/newer than a (time, id) position - the id breaks ties between rows sharing a second. */
function beyond(dir: "before" | "after", time: string | null, id: string | null) {
  if (!time) return null;
  const t = new Date(time);
  if (Number.isNaN(t.getTime())) return null;
  const cmp = dir === "before" ? "$lt" : "$gt";
  const ors: Record<string, unknown>[] = [{ occurredAt: { [cmp]: t } }];
  if (id && Types.ObjectId.isValid(id)) ors.push({ occurredAt: t, _id: { [cmp]: new Types.ObjectId(id) } });
  return { $or: ors };
}

/**
 * Newest-first access logs. Response shape is unchanged (`{ logs }`), with
 * `hasMore` added.
 *   ?before=<occurredAt>&beforeId=<_id>   page back through history
 *   ?after=<occurredAt>&afterId=<_id>     only rows newer than that one (cheap live polling:
 *                                         an unchanged log answers with an empty list)
 */
export async function GET(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(searchParams.get("limit"))) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const memberId = searchParams.get("member");

  const and: Record<string, unknown>[] = [];
  if (memberId) and.push({ member: memberId });
  const older = beyond("before", searchParams.get("before"), searchParams.get("beforeId"));
  const newer = beyond("after", searchParams.get("after"), searchParams.get("afterId"));
  if (older) and.push(older);
  if (newer) and.push(newer);
  const query = and.length ? { $and: and } : {};

  const rows: any[] = await AccessLog.find(query)
    .select("-raw")
    .populate("member", "name phone deviceUserId")
    .sort({ occurredAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // A log is linked to its Member when first stored. If the person was only
  // added to the app afterwards (or was enrolled straight on the terminal),
  // resolve the name now so the row never reads "Unknown member" needlessly.
  const unlinked = Array.from(new Set(page.filter((l) => !l.member && l.employeeNo).map((l) => l.employeeNo as string)));
  const late: any[] = unlinked.length
    ? await Member.find({ deviceUserId: { $in: unlinked } })
        .select("name phone deviceUserId")
        .lean()
    : [];
  const memberByNo = new Map(late.map((m) => [m.deviceUserId as string, m]));

  const logs = page.map((l) => {
    if (l.member) return l;
    const found = l.employeeNo ? memberByNo.get(l.employeeNo) : undefined;
    if (found) return { ...l, member: found };
    if (l.personName) return { ...l, member: { name: l.personName } };
    return l;
  });

  return NextResponse.json({ logs, hasMore });
}
