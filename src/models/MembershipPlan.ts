import mongoose, { Schema } from "mongoose";

/**
 * durationMonths drives expiry-date math; keep it the single source of
 * truth instead of a separate "durationDays" so month-length quirks
 * (28 vs 31 days) don't drift between plans.
 */
const MembershipPlanSchema = new Schema(
  {
    name: { type: String, required: true }, // e.g. "1 Month", "6 Month", "1 Year"
    durationMonths: { type: Number, required: true },
    fees: { type: Number, required: true },
    description: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.MembershipPlan ||
  mongoose.model("MembershipPlan", MembershipPlanSchema);
