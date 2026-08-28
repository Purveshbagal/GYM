import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import "dotenv/config";
import MembershipPlan from "../src/models/MembershipPlan";
import Admin from "../src/models/Admin";

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/gym";
  await mongoose.connect(uri);

  const defaultPlans = [
    { name: "1 Month", durationMonths: 1, fees: 1500 },
    { name: "2 Month", durationMonths: 2, fees: 2800 },
    { name: "3 Month", durationMonths: 3, fees: 4000 },
    { name: "6 Month", durationMonths: 6, fees: 7000 },
    { name: "1 Year", durationMonths: 12, fees: 12000 },
  ];

  for (const plan of defaultPlans) {
    await MembershipPlan.updateOne({ name: plan.name }, { $setOnInsert: plan }, { upsert: true });
  }
  console.log("Seeded default membership plans (edit fees anytime from the app's Plans screen).");

  const username = "Gym";
  const existing = await Admin.findOne({ username });
  if (!existing) {
    const passwordHash = await bcrypt.hash("Fitness@2026", 10);
    await Admin.create({ name: "Gym Owner", username, passwordHash, role: "owner" });
    console.log(`Seeded login -> username: ${username} / password: Fitness@2026`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
