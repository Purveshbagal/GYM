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
import "dotenv/config";
import { provisionDeviceAgent } from "../src/lib/deviceProvisioning";

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
  const agentId = arg("agent-id");
  const agentToken = arg("agent-token");

  if (!gymId || !name || !ip || !username || !password) {
    console.error(
      "Usage: npx tsx scripts/create-agent.ts --gym GYM001 --name \"Main Entrance\" --ip 192.168.1.201 --username admin --password <pass> [--port 80] [--agent-id AGENT-GYM001-xxxxxx] [--agent-token <token>]"
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/gym";
  await mongoose.connect(uri);

  const result = await provisionDeviceAgent({ gymId, name, ip, port, username, password, agentId, agentToken });

  console.log(
    result.matchedBy === "created"
      ? "\nNo existing device found — created a new one."
      : `\nExisting device found (matched by ${result.matchedBy}) — updated in place, identity preserved.`
  );
  console.log("\nDevice state:\n");
  console.log(`  Gym ID:       ${result.gymId}`);
  console.log(`  Agent ID:     ${result.agentId}`);
  console.log(`  IP:           ${result.ip}`);
  console.log(`  Device Mongo ID: ${result.deviceId}`);
  if (result.agentToken) {
    console.log(`\n  Agent Token:  ${result.agentToken}`);
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
