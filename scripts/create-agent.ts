/**
 * Provisions (or updates) a Windows Gym Device Agent credential for a
 * gym/device.
 *
 * agentId is the STABLE IDENTITY of a physical Agent/device — never its IP.
 * A device's IP is just a network/location property and can change (DHCP,
 * moving the terminal to another router, etc.) without that being a new
 * device or a new agent.
 *
 * First-time provisioning (no --agent-id yet):
 *   npx tsx scripts/create-agent.ts --gym GYM001 --name "Main Entrance" \
 *     --ip 192.168.1.201 --username admin --password <hikvision-password>
 *   -> generates a new agentId + agentToken. If a Device already exists for
 *      this gym+ip (e.g. one created via the app's "Add Device" flow, which
 *      has no agentId yet), the credentials attach to THAT device rather
 *      than creating a disconnected duplicate. Otherwise a new Device is
 *      created.
 *
 * Updating an existing agent (IP changed, name changed, etc.) — ALWAYS pass
 * the agentId you already have:
 *   npx tsx scripts/create-agent.ts --gym GYM001 --name "Main Entrance" \
 *     --ip <new-ip> --username admin --password <pass> \
 *     --agent-id AGENT-GYM001-xxxxxx
 *   -> looked up BY agentId (not by ip), so the IP (and name/username/
 *      password) update in place on the SAME Device document. agentId and
 *      agentTokenHash are left untouched — no new token, no new device,
 *      regardless of how many times the IP has changed since.
 *
 * To deliberately rotate the token for an existing agentId, pass
 * --agent-token explicitly alongside --agent-id; otherwise the existing
 * hash is always preserved.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import "dotenv/config";
import Device from "../src/models/Device";

function arg(name: string, fallback?: string) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  return process.argv[idx + 1];
}

async function main() {
  const gymId = arg("gym");
  const name = arg("name");
  const ip = arg("ip");
  const username = arg("username");
  const password = arg("password");
  const port = Number(arg("port", "80"));
  const requestedAgentId = arg("agent-id");
  const requestedAgentToken = arg("agent-token");

  if (!gymId || !name || !ip || !username || !password) {
    console.error(
      "Usage: npx tsx scripts/create-agent.ts --gym GYM001 --name \"Main Entrance\" --ip 192.168.1.201 --username admin --password <pass> [--port 80] [--agent-id AGENT-GYM001-xxxxxx] [--agent-token <token>]"
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/gym";
  await mongoose.connect(uri);

  // Stable identity: if an agentId was supplied AND it already exists,
  // that's the ONLY key used to find the device to update — IP is never
  // part of the lookup in that case, so changing IP can never spawn a
  // second Agent no matter how many times it changes.
  const byAgentId = requestedAgentId
    ? await Device.findOne({ agentId: requestedAgentId }).select("+agentTokenHash")
    : null;

  // Only when there's no agentId match yet (true first-time provisioning,
  // whether or not a specific agentId was requested) fall back to gym+ip,
  // purely to attach to a pre-existing app-created device (which has no
  // agentId) instead of creating a disconnected duplicate.
  const byGymAndIp = !byAgentId ? await Device.findOne({ gymId, ip }).select("+agentTokenHash") : null;

  const existing = byAgentId ?? byGymAndIp;

  const agentId = existing?.agentId || requestedAgentId || `AGENT-${gymId}-${crypto.randomBytes(3).toString("hex")}`;

  // Never regenerate/rotate the hash unless the caller explicitly asked
  // for a new token. Preserves the existing credential across IP/name/
  // password updates.
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

  console.log(
    existing
      ? `\nExisting device found (matched by ${byAgentId ? "agentId" : "gym+ip"}) — updated in place, identity preserved.`
      : "\nNo existing device found — created a new one."
  );
  console.log("\nDevice state:\n");
  console.log(`  Gym ID:       ${gymId}`);
  console.log(`  Agent ID:     ${agentId}`);
  console.log(`  IP:           ${ip}`);
  console.log(`  Device Mongo ID: ${device._id}`);
  if (agentToken) {
    console.log(`\n  Agent Token:  ${agentToken}`);
    console.log("\n  This token is shown only once — it is stored as a bcrypt hash, not recoverable.");
    console.log("  Enter Gym ID / Agent ID / Agent Token above into the Gym Device Agent setup wizard.\n");
  } else {
    console.log("\n  Agent Token:  unchanged (existing credential preserved — reuse the value already saved).\n");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
