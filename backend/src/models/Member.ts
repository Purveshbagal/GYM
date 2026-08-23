import mongoose, { Schema } from "mongoose";

const MemberSchema = new Schema(
  {
    // Unique numeric ID handed to gym staff so they can key it into the
    // Hikvision terminal's own menu while enrolling this member's
    // face/fingerprint (employeeNo on the device).
    deviceUserId: { type: String, required: true, unique: true },

    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    gender: { type: String, enum: ["male", "female", "other"] },
    photoUrl: { type: String },
    address: { type: String },
    emergencyContact: { type: String },
    joinDate: { type: Date, default: Date.now },

    currentPlan: { type: Schema.Types.ObjectId, ref: "MembershipPlan" },
    membershipStart: { type: Date },
    membershipEnd: { type: Date },
    status: {
      type: String,
      enum: ["active", "expired", "inactive"],
      default: "inactive",
    },

    biometricEnrolled: { type: Boolean, default: false },
    device: { type: Schema.Types.ObjectId, ref: "Device" },

    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Member || mongoose.model("Member", MemberSchema);
