import mongoose, { Schema } from "mongoose";

const DeviceSchema = new Schema(
  {
    name: { type: String, required: true }, // e.g. "Main Entrance"
    ip: { type: String, required: true },
    port: { type: Number, default: 80 },
    username: { type: String, required: true },
    password: { type: String, required: true }, // ISAPI device credentials
    location: { type: String },
    online: { type: Boolean, default: false },
    lastSeenAt: { type: Date },

    // Which gym this device belongs to. Kept as a plain string id for now
    // (no separate Gym collection yet) so a device/job/member query can
    // filter by it without a join.
    // Not required yet: the existing POST /api/devices (used by the
    // current Add Member flow) doesn't collect it. The agent-provisioning
    // script below always sets it; a later phase will make it required
    // once the admin UI collects it too.
    gymId: { type: String, index: true },

    // Identifies the Windows Gym Device Agent instance allowed to act on
    // this device. The agent authenticates with agentId + a bearer token;
    // only the bcrypt hash of that token is stored, never the raw value.
    // This credential is separate from the Android admin JWT on purpose —
    // it must keep working even if admin sessions are revoked, and must
    // never be usable to log into the admin app.
    agentId: { type: String, unique: true, sparse: true, index: true },
    agentTokenHash: { type: String, select: false },

    // Populated by the agent's read-only deviceInfo/capability checks
    // (Phase 1/2 probe), not typed in manually.
    deviceModel: { type: String },
    serialNumber: { type: String },
    firmwareVersion: { type: String },
    capabilities: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.models.Device || mongoose.model("Device", DeviceSchema);
