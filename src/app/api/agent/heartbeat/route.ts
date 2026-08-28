import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAgentAuth } from "@/lib/agentAuth";
import Device from "@/models/Device";

/**
 * The Windows Gym Device Agent calls this every ~30s so the backend/admin
 * app can show device online/offline without depending on the Hikvision
 * device's own reachability (the agent, not the terminal, is what the
 * backend can actually see over the internet).
 */
export async function POST(req: NextRequest) {
  await connectDB();
  const agent = await getAgentAuth(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceModel, serialNumber, firmwareVersion, deviceOnline } = await req
    .json()
    .catch(() => ({}));

  const update: Record<string, unknown> = { lastSeenAt: new Date() };
  if (deviceModel) update.deviceModel = deviceModel;
  if (serialNumber) update.serialNumber = serialNumber;
  if (firmwareVersion) update.firmwareVersion = firmwareVersion;
  if (typeof deviceOnline === "boolean") update.online = deviceOnline;

  await Device.updateOne({ _id: agent.deviceId }, { $set: update });

  return NextResponse.json({ success: true, message: "Heartbeat received", data: { serverTime: new Date().toISOString() } });
}
