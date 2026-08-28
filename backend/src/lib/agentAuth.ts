import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import Device from "@/models/Device";

/**
 * Auth for the Windows Gym Device Agent, deliberately separate from
 * lib/auth.ts (the admin/mobile JWT). The agent identifies itself with an
 * `agentId` plus a bearer token; only a bcrypt hash of that token is ever
 * stored, so a leaked database dump doesn't hand out live credentials.
 * Revoking an agent is just clearing its agentTokenHash.
 *
 * Header shape: `Authorization: Bearer <agentId>.<agentToken>`
 */
export async function getAgentAuth(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const raw = header.slice(7);
  const separatorIndex = raw.indexOf(".");
  if (separatorIndex < 0) return null;

  const agentId = raw.slice(0, separatorIndex);
  const agentToken = raw.slice(separatorIndex + 1);
  if (!agentId || !agentToken) return null;

  const device = await Device.findOne({ agentId }).select("+agentTokenHash");
  if (!device || !device.agentTokenHash) return null;

  const valid = await bcrypt.compare(agentToken, device.agentTokenHash);
  if (!valid) return null;

  return { agentId, deviceId: String(device._id), gymId: device.gymId as string | undefined };
}
