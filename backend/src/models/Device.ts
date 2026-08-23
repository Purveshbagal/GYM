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
  },
  { timestamps: true }
);

export default mongoose.models.Device || mongoose.model("Device", DeviceSchema);
