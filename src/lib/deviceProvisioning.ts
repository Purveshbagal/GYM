import bcrypt from "bcryptjs";
import crypto from "crypto";
import Device from "@/models/Device";

export type ProvisionAgentInput = {
  gymId: string;
  name: string;
  ip: string;
  port?: number;
  username: string;
  password: string;
  agentId?: string;
  agentToken?: string;
};

export type ProvisionAgentResult = {
  matchedBy: "agentId" | "gym+ip" | "created";
  deviceId: string;
  gymId: string;
  agentId: string;
  ip: string;
  /** Present only when a new token was generated/rotated this call. */
  agentToken: string | null;
};

/**
 * Creates or updates the Device record backing a Windows Gym Device Agent.
 * agentId is the STABLE IDENTITY of a physical agent/device — never its IP.
 * A device's IP is just a network/location property and can change (DHCP,
 * moving the terminal to another router, etc.) without that being a new
 * device or a new agent.
 *
 * - If `agentId` is supplied and matches an existing Device, that lookup
 *   takes priority over everything else: ip/name/username/password update
 *   in place on that SAME document, and agentId/agentTokenHash are left
 *   untouched unless `agentToken` is explicitly supplied (deliberate
 *   rotation).
 * - Otherwise (true first-time provisioning), falls back to matching by
 *   {gymId, ip} so a freshly generated agentId attaches to a pre-existing
 *   app-created device (which has no agentId yet) instead of creating a
 *   disconnected duplicate.
 */
export async function provisionDeviceAgent(input: ProvisionAgentInput): Promise<ProvisionAgentResult> {
  const { gymId, name, ip, username, password } = input;
  const port = input.port ?? 80;
  const requestedAgentId = input.agentId;
  const requestedAgentToken = input.agentToken;

  const byAgentId = requestedAgentId
    ? await Device.findOne({ agentId: requestedAgentId }).select("+agentTokenHash")
    : null;
  const byGymAndIp = !byAgentId ? await Device.findOne({ gymId, ip }).select("+agentTokenHash") : null;
  const existing = byAgentId ?? byGymAndIp;

  // An explicitly requested agentId always wins, even over one already set
  // on a device matched via the gym+ip fallback (e.g. a device that was
  // previously auto-provisioned with a random id is being pinned to a
  // caller-chosen static id now) — the caller's explicit intent takes
  // priority over whatever happened to already be stored.
  const agentId = requestedAgentId || existing?.agentId || `AGENT-${gymId}-${crypto.randomBytes(3).toString("hex")}`;

  let agentToken: string | null = null;
  let agentTokenHash = existing?.agentTokenHash;
  if (!agentTokenHash || requestedAgentToken) {
    agentToken = requestedAgentToken || crypto.randomBytes(24).toString("base64url");
    agentTokenHash = await bcrypt.hash(agentToken, 10);
  }

  const device = existing
    ? await Device.findByIdAndUpdate(
        existing._id,
        { name, ip, port, username, password, gymId, agentId, agentTokenHash },
        { new: true }
      )
    : await Device.create({ name, ip, port, username, password, gymId, agentId, agentTokenHash });

  return {
    matchedBy: existing ? (byAgentId ? "agentId" : "gym+ip") : "created",
    deviceId: String(device!._id),
    gymId,
    agentId,
    ip,
    agentToken,
  };
}
