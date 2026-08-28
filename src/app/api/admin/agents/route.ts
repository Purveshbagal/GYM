import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuth } from "@/lib/auth";
import { provisionDeviceAgent } from "@/lib/deviceProvisioning";

/**
 * Remote equivalent of scripts/create-agent.ts, for provisioning a Gym
 * Device Agent without needing shell/SSH access to the server — owner-only,
 * since it can mint credentials that authenticate as a device agent.
 */
export async function POST(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const body = await req.json().catch(() => ({}));
  const { gymId, name, ip, port, username, password, agentId, agentToken } = body;
  if (!gymId || !name || !ip || !username || !password) {
    return NextResponse.json(
      { error: "gymId, name, ip, username, password required" },
      { status: 400 }
    );
  }

  const result = await provisionDeviceAgent({
    gymId,
    name,
    ip,
    port,
    username,
    password,
    agentId,
    agentToken,
  });

  return NextResponse.json({ success: true, ...result });
}
