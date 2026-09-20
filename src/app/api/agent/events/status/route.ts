import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAgentAuth } from "@/lib/agentAuth";
import Device from "@/models/Device";

export const dynamic = "force-dynamic";

type Scalar = string | number | boolean | null;

function scalar(value: unknown): Scalar | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return value.slice(0, 300);
  return undefined;
}

/** Keeps only scalars (and one level of scalar-only objects) so a status
 *  report can never smuggle arbitrary documents into the Device record. */
function sanitizeStatus(input: unknown): Record<string, Scalar | Record<string, Scalar>> {
  const out: Record<string, Scalar | Record<string, Scalar>> = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 40)) {
    const s = scalar(value);
    if (s !== undefined) {
      out[key] = s;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested: Record<string, Scalar> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
        const ns = scalar(v);
        if (ns !== undefined) nested[k] = ns;
      }
      out[key] = nested;
    }
  }
  return out;
}

/**
 * Gym Log Agent health report (every ~30s). Stored on the Device so a stuck
 * or misconfigured agent at a gym you can't visit is diagnosable remotely:
 * GET /api/devices already returns it as `logAgent`.
 */
export async function POST(req: NextRequest) {
  await connectDB();
  const agent = await getAgentAuth(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const status = { ...sanitizeStatus(body), reportedAt: new Date() };
  await Device.updateOne({ _id: agent.deviceId }, { $set: { logAgent: status } });

  return NextResponse.json({ success: true });
}
