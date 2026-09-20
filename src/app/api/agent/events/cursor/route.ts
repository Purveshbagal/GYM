import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAgentAuth } from "@/lib/agentAuth";
import AccessLog from "@/models/AccessLog";

export const dynamic = "force-dynamic";

/**
 * What the backend already holds for this agent's device. The Gym Log Agent
 * asks this on start (and periodically) so it can tell an empty/wiped
 * collection - which means "backfill the terminal's whole history again" -
 * from a normal restart.
 */
export async function GET(req: NextRequest) {
  await connectDB();
  const agent = await getAgentAuth(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filter = { device: agent.deviceId, source: "device-agent" };
  const [count, newest] = await Promise.all([
    AccessLog.countDocuments(filter),
    AccessLog.findOne(filter).sort({ occurredAt: -1 }).select("occurredAt").lean(),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      count,
      newestAt: (newest as { occurredAt?: Date } | null)?.occurredAt ?? null,
    },
  });
}
