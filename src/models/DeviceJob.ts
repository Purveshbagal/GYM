import mongoose, { Schema } from "mongoose";

/**
 * Generic command queue between the backend and a Windows Gym Device
 * Agent. The agent polls for PENDING jobs addressed to it, executes them
 * against the local Hikvision device, and posts back a result.
 *
 * Phase 4/5 add ENROLL_FINGERPRINT (confirmed via CaptureFingerPrint XML +
 * FingerPrintCfg) and ENROLL_FACE (confirmed via local terminal enrollment
 * + UserInfo/Search polling - no remote trigger exists on this firmware).
 */
const DeviceJobSchema = new Schema(
  {
    gymId: { type: String, required: true, index: true },
    device: { type: Schema.Types.ObjectId, ref: "Device", required: true, index: true },
    agentId: { type: String, required: true, index: true },
    // Set for member-scoped jobs (ENROLL_FINGERPRINT/ENROLL_FACE) so the
    // job-result handler knows which Member document to update.
    member: { type: Schema.Types.ObjectId, ref: "Member", index: true },

    type: {
      type: String,
      enum: [
        "GET_DEVICE_STATUS",
        "CREATE_USER",
        "ENROLL_FINGERPRINT",
        "ENROLL_FACE",
        "DELETE_USER",
        "ENABLE_ACCESS",
        "DISABLE_ACCESS",
        "SYNC_USER",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "RETRYING"],
      default: "PENDING",
      index: true,
    },

    payload: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.DeviceJob || mongoose.model("DeviceJob", DeviceJobSchema);
