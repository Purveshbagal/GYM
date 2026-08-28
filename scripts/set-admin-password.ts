/**
 * Sets (or resets) an admin login's password. Creates the admin if the
 * username doesn't exist yet, otherwise just updates the password hash on
 * the existing account (username, name, role are left as-is).
 *
 * Run from backend/:
 *   npx tsx scripts/set-admin-password.ts --username Gym --password Fitness@2026
 *
 * Optional for a brand-new admin: --name "Gym Owner" --role owner
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import "dotenv/config";
import Admin from "../src/models/Admin";

function arg(name: string, fallback?: string) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  return process.argv[idx + 1];
}

async function main() {
  const username = arg("username");
  const password = arg("password");
  const name = arg("name", "Gym Owner");
  const role = arg("role", "owner") as "owner" | "staff";

  if (!username || !password) {
    console.error(
      'Usage: npx tsx scripts/set-admin-password.ts --username Gym --password <pass> [--name "Gym Owner"] [--role owner]'
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/gym";
  await mongoose.connect(uri);

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await Admin.findOne({ username });

  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`\nPassword updated for existing admin "${username}" (role: ${existing.role}).\n`);
  } else {
    await Admin.create({ name, username, passwordHash, role });
    console.log(`\nCreated new admin "${username}" (role: ${role}).\n`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
