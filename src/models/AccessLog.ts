import mongoose, { Schema } from "mongoose";

const AccessLogSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: "Member" },
    device: { type: Schema.Types.ObjectId, ref: "Device" },
    employeeNo: { type: String },
    // Name as stored on the terminal itself. Lets the app show who scanned
    // even when the person has no Member record here (e.g. enrolled directly
    // on the device).
    personName: { type: String },
    verifyMode: { type: String }, // "face" | "fingerprint" | "card" etc.
    result: { type: String, enum: ["granted", "denied"], required: true },
    reason: { type: String }, // e.g. "membership expired", "success"
    occurredAt: { type: Date, default: Date.now },
    raw: { type: Schema.Types.Mixed },

    // Set only for events streamed by the Gym Log Agent (pulled from the
    // terminal's own event log). eventKey is what makes re-sending the same
    // event harmless: (device, eventKey) is unique, so backfills, overlapping
    // poll windows and agent restarts can never create duplicates.
    source: { type: String, enum: ["webhook", "device-agent"], default: "webhook" },
    eventKey: { type: String },
    serialNo: { type: Number },
    major: { type: Number },
    minor: { type: Number },
  },
  { timestamps: true }
);

// Partial so pre-existing webhook rows (no eventKey) are never affected.
AccessLogSchema.index(
  { device: 1, eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: "string" } } }
);
// The logs screen always reads newest-first (optionally per member).
AccessLogSchema.index({ occurredAt: -1, _id: -1 });
AccessLogSchema.index({ member: 1, occurredAt: -1 });
// Log agent resume point: "newest event stored for this device".
AccessLogSchema.index({ device: 1, occurredAt: -1 });

export default mongoose.models.AccessLog || mongoose.model("AccessLog", AccessLogSchema);
