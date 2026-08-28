import mongoose, { Schema } from "mongoose";

const PaymentSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    plan: { type: Schema.Types.ObjectId, ref: "MembershipPlan", required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["new", "renewal"], required: true },
    method: { type: String, enum: ["cash", "card", "upi", "other"], default: "cash" },
    paidAt: { type: Date, default: Date.now },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
