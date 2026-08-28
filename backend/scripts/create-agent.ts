/**
 * Provisions a Windows Gym Device Agent credential for a gym/device.
 *
 * Run from backend/:
 *   npx tsx scripts/create-agent.ts --gym GYM001 --name "Main Entrance" \
 *     --ip 192.168.1.201 --username admin --password <hikvision-password>
 *
 * Prints the agentId + agentToken ONCE — paste them into the agent's
 * first-run setup wizard. Only a bcrypt hash of the token is stored, so if
 * you lose it you must re-run this (it rotates the token for that device).
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

  const agentId = `AGENT-${gymId}-${crypto.randomBytes(3).toString("hex")}`;
  const agentToken = crypto.randomBytes(24).toString("base64url");
  const agentTokenHash = await bcrypt.hash(agentToken, 10);

  const device = await Device.create({
    name,
    ip,
    port,
    username,
    password,
    gymId,
    agentId,
    agentTokenHash,
  });

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
