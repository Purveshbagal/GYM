import mongoose, { Schema } from "mongoose";

const AccessLogSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: "Member" },
    device: { type: Schema.Types.ObjectId, ref: "Device" },
    employeeNo: { type: String },
    verifyMode: { type: String }, // "face" | "fingerprint" | "card" etc.
    result: { type: String, enum: ["granted", "denied"], required: true },
    reason: { type: String }, // e.g. "membership expired", "success"
    occurredAt: { type: Date, default: Date.now },
    raw: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.models.AccessLog || mongoose.model("AccessLog", AccessLogSchema);
