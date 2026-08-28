/**
 * Provisions a Windows Gym Device Agent credential for a gym/device.
 *
 * Run from backend/:
 *   npx tsx scripts/create-agent.ts --gym GYM001 --name "Main Entrance" \
 *     --ip 192.168.1.201 --username admin --password <hikvision-password>
 *
 * By default this generates a fresh random agentId + agentToken every run
 * (rotating the credential of whatever device matches gymId+ip — any agent
 * already running with the old token stops authenticating the moment this
 * runs). To pin a STATIC credential that re-running the script never
 * changes, pass --agent-id and --agent-token explicitly:
 *
 *   npx tsx scripts/create-agent.ts --gym GYM001 --name "Main Entrance" \
 *     --ip 192.168.1.201 --username admin --password <hikvision-password> \
 *     --agent-id AGENT-GYM001-xxxxxx --agent-token <fixed-token>
 *
 * Only a bcrypt hash of the token is stored, so if you lose a generated
 * token you must re-run this to get a new one (this rotates it).
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

  if (!gymId || !name || !ip || !username || !password) {
    console.error(
      "Usage: npx tsx scripts/create-agent.ts --gym GYM001 --name \"Main Entrance\" --ip 192.168.1.201 --username admin --password <pass> [--port 80]"
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/gym";
  await mongoose.connect(uri);

  const agentId = arg("agent-id") || `AGENT-${gymId}-${crypto.randomBytes(3).toString("hex")}`;
  const agentToken = arg("agent-token") || crypto.randomBytes(24).toString("base64url");
  const agentTokenHash = await bcrypt.hash(agentToken, 10);

  // Match the same physical terminal by gym + IP. Members are linked to a
  // Device by its _id (set via the app's "Add Device" flow, which creates a
  // Device with no agentId), so provisioning must attach agentId/
  // agentTokenHash to that SAME document rather than creating a new,
  // disconnected one - otherwise members stay pointed at a device the
  // agent can never authenticate as.
  const existing = await Device.findOne({ gymId, ip });
  const device = existing
    ? await Device.findByIdAndUpdate(
        existing._id,
        { name, port, username, password, agentId, agentTokenHash },
        { new: true }
      )
    : await Device.create({ name, ip, port, username, password, gymId, agentId, agentTokenHash });

  console.log(
    existing
      ? "\nExisting device found for this gym/IP - attached agent credentials to it (members already linked to it keep working)."
      : "\nNo existing device for this gym/IP - created a new one."
  );
  console.log("\nAgent provisioned. Enter these into the Gym Device Agent setup wizard:\n");
  console.log(`  Gym ID:       ${gymId}`);
  console.log(`  Agent ID:     ${agentId}`);
  console.log(`  Agent Token:  ${agentToken}`);
  console.log(`  Device Mongo ID: ${device._id}`);
  console.log("\nThis token is shown only once — it is stored as a bcrypt hash, not recoverable.\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
