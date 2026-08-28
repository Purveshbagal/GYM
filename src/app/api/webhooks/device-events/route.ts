import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AccessLog from "@/models/AccessLog";
import Member from "@/models/Member";
import Device from "@/models/Device";

/**
 * Hikvision terminals push access events here (configured via
 * registerEventListener in lib/isapi.ts) for every face/fingerprint
 * verification attempt, granted or denied. The device enforces the
 * membership valid-period itself, so a "denied" event for an expired
 * member is expected behavior, not an error — we just log it.
 *
 * Body can arrive as raw JSON or multipart/form-data with an embedded
 * JSON part depending on firmware, so we defensively extract JSON from
 * either shape.
 */
export async function POST(req: NextRequest) {
  await connectDB();

  const contentType = req.headers.get("content-type") || "";
  const rawText = await req.text();
  const event = extractJson(rawText, contentType);

  if (!event) {
    return NextResponse.json({ ok: true, note: "no parseable event payload" });
  }

  const acsEvent = event.AccessControllerEvent || event;
  const employeeNo: string | undefined = acsEvent.employeeNoString || acsEvent.employeeNo;
  const major = acsEvent.majorEventType;
  const minor = acsEvent.subEventType ?? acsEvent.minorEventType;

  // Hikvision: major=5 is access-control event; minor=1 is usually "access
  // granted", most other minors under that major represent a denial reason.
  const result = major === 5 && minor === 1 ? "granted" : "denied";

  let member = null;
  if (employeeNo) {
    member = await Member.findOne({ deviceUserId: employeeNo });
  }

  const device = await Device.findOne().sort({ createdAt: 1 }); // single-device setups; extend if multi-door

  await AccessLog.create({
    member: member?._id,
    device: device?._id,
    employeeNo,
    verifyMode: acsEvent.currentVerifyMode,
    result,
    reason: acsEvent.subEventTypeName || (result === "granted" ? "success" : "denied"),
    occurredAt: acsEvent.dateTime ? new Date(acsEvent.dateTime) : new Date(),
    raw: acsEvent,
  });

  return NextResponse.json({ ok: true });
}

function extractJson(raw: string, contentType: string): any {
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  // multipart/form-data: find the first {...} block, which is typically
  // the "event_log" JSON part Hikvision embeds alongside any image parts.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
