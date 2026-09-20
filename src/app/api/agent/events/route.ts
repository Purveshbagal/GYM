import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAgentAuth } from "@/lib/agentAuth";
import AccessLog from "@/models/AccessLog";
import Member from "@/models/Member";
import { classifyAcsEvent, eventKeyFor, sanitizeIncomingEvent } from "@/lib/acsEvents";

export const dynamic = "force-dynamic";

const MAX_BATCH = 500;

/**
 * The Gym Log Agent streams check-in events it reads from the terminal's own
 * event log to this endpoint - the last-mile that the terminal can't do
 * itself because it sits on the gym's private LAN.
 *
 * Idempotent by design: every event has a stable key and (device, eventKey)
 * is unique, so the agent may re-send freely (history backfill, overlapping
 * poll windows, restarts, retries after a timeout) without duplicating rows.
 */
export async function POST(req: NextRequest) {
  await connectDB();
  const agent = await getAgentAuth(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const incoming: unknown[] | null = Array.isArray(body?.events) ? body.events : null;
  if (!incoming) return NextResponse.json({ error: "events[] required" }, { status: 400 });
  if (incoming.length > MAX_BATCH) {
    return NextResponse.json({ error: `at most ${MAX_BATCH} events per request` }, { status: 413 });
  }

  let skipped = 0;
  let invalid = 0;
  const rows: Array<{
    ev: NonNullable<ReturnType<typeof sanitizeIncomingEvent>>;
    verdict: Exclude<ReturnType<typeof classifyAcsEvent>, { kind: "skip" }>;
    key: string;
  }> = [];

  for (const item of incoming) {
    const ev = sanitizeIncomingEvent(item);
    if (!ev) {
      invalid++;
      continue;
    }
    const verdict = classifyAcsEvent(ev);
    if (verdict.kind === "skip") {
      skipped++;
      continue;
    }
    rows.push({ ev, verdict, key: eventKeyFor(ev) });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const employeeNos = Array.from(new Set(rows.map((r) => r.ev.employeeNo).filter((v): v is string => !!v)));
    const members = employeeNos.length
      ? await Member.find({ deviceUserId: { $in: employeeNos } }).select("_id deviceUserId")
      : [];
    const memberIdByNo = new Map<string, unknown>(members.map((m: any) => [m.deviceUserId as string, m._id]));

    const now = new Date();
    const ops = rows.map(({ ev, verdict, key }) => ({
      updateOne: {
        filter: { device: agent.deviceId, eventKey: key },
        update: {
          // Insert-only on purpose: a re-sent event must never overwrite the
          // stored row (and the member link is fixed at first sight).
          $setOnInsert: {
            member: ev.employeeNo ? memberIdByNo.get(ev.employeeNo) : undefined,
            employeeNo: ev.employeeNo,
            personName: ev.name,
            verifyMode: verdict.verifyMode ?? ev.verifyMode,
            result: verdict.kind,
            reason: verdict.reason,
            occurredAt: new Date(ev.occurredAt as string),
            raw: ev.raw ?? undefined,
            source: "device-agent",
            serialNo: ev.serialNo,
            major: ev.major,
            minor: ev.minor,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));

    try {
      const res = await AccessLog.bulkWrite(ops, { ordered: false, timestamps: false });
      inserted = res.upsertedCount ?? 0;
    } catch (err: any) {
      // Two overlapping requests can race to upsert the same key; the loser
      // gets a duplicate-key error. That's the "already stored" outcome we
      // want, so only non-duplicate failures are real errors.
      const writeErrors: Array<{ code?: number }> = err?.writeErrors ?? [];
      const onlyDuplicates =
        err?.code === 11000 || (writeErrors.length > 0 && writeErrors.every((w) => w.code === 11000));
      if (!onlyDuplicates) throw err;
      inserted = err?.result?.upsertedCount ?? 0;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      received: incoming.length,
      accepted: rows.length,
      inserted,
      duplicates: rows.length - inserted,
      skipped,
      invalid,
    },
  });
}
