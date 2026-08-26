import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Device from "@/models/Device";
import { getAuth } from "@/lib/auth";
import { testDeviceConnection, registerEventListener } from "@/lib/isapi";

export async function GET(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const devices = await Device.find();

  // Live-check each device rather than trusting the last stored flag, so a
  // device that has come back online since it was added/last synced is
  // reflected immediately instead of staying stuck "Offline".
  await Promise.all(
    devices.map(async (device) => {
      try {
        const test = await testDeviceConnection(device);
        device.online = test.ok;
        device.lastSeenAt = new Date();
        await device.save();
      } catch {
        device.online = false;
        await device.save();
      }
    })
  );

  const safeDevices = devices.map((d) => {
    const { password: _pw, ...safe } = d.toObject();
    return safe;
  });
  return NextResponse.json({ devices: safeDevices });
}

export async function POST(req: NextRequest) {
  if (!getAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { name, ip, port, username, password, location } = await req.json();
  if (!name || !ip || !username || !password) {
    return NextResponse.json({ error: "name, ip, username, password required" }, { status: 400 });
  }

  const device = await Device.create({ name, ip, port: port || 80, username, password, location });

  const test = await testDeviceConnection(device);
  device.online = test.ok;
  device.lastSeenAt = new Date();
  await device.save();

  // Best-effort: point the terminal's event push at this backend so
  // access attempts start flowing into /api/webhooks/device-events.
  const backendUrl = new URL(process.env.BACKEND_PUBLIC_URL || "http://localhost:3000");
  try {
    await registerEventListener(
      device,
      backendUrl.hostname,
      Number(backendUrl.port) || 80
    );
  } catch {
    // Non-fatal: device stays usable for access-control even if the
    // listener registration fails (e.g. device unreachable right now).
  }

  const { password: _pw, ...safe } = device.toObject();
  return NextResponse.json({ device: safe, connectionTest: test }, { status: 201 });
}
