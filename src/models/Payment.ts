import mongoose, { Schema } from "mongoose";

const PaymentSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    // Not tied to a period for standalone "payment" (Payment In) rows.
    plan: { type: Schema.Types.ObjectId, ref: "MembershipPlan" },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["new", "renewal", "payment"], required: true },
    method: { type: String, enum: ["cash", "card", "upi", "other"], default: "cash" },
    paidAt: { type: Date, default: Date.now },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    // The fee this transaction was against (plan.fees for new/renewal, 0
    // for a standalone "payment"); lets history rows show what was billed
    // vs what was actually collected.
    dueAmount: { type: Number, default: 0 },
    // Member.pendingAmount snapshot right after this transaction, so
    // history can show a running balance trail without recomputation.
    balanceAfter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
