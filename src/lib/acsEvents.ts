/**
 * Turns an access-control event pulled from a Hikvision terminal's own log
 * (ISAPI AcsEvent, streamed by the Gym Log Agent) into an AccessLog row.
 *
 * The terminal's event log holds everything it ever did - door opened, door
 * closed, alarms, admin operations - not just check-ins. Only major=5
 * ("access control event") entries that describe someone trying to get in
 * belong in the access logs, so everything else is skipped here.
 *
 * Minor codes are Hikvision's MINOR_* constants (HCNetSDK). The tables are
 * best-effort human labels; the untouched device event is stored in
 * AccessLog.raw, so a wrong label can always be re-derived later.
 */

export type IncomingAcsEvent = {
  serialNo?: number;
  /** Timestamp exactly as the device printed it - only used to build the dedupe key. */
  time?: string;
  /** Corrected instant (ISO 8601). */
  occurredAt?: string;
  major?: number;
  minor?: number;
  employeeNo?: string;
  name?: string;
  cardNo?: string;
  doorNo?: number;
  cardReaderNo?: number;
  verifyMode?: string;
  attendanceStatus?: string;
  raw?: unknown;
};

export type ClassifiedEvent =
  | { kind: "skip" }
  | { kind: "granted" | "denied"; verifyMode?: string; reason: string };

const MAJOR_ACCESS_EVENT = 5;

// minor -> [how the person was verified, label]
const GRANTED: Record<number, [string, string]> = {
  1: ["card", "Card verified"],
  2: ["card", "Card + password verified"],
  16: ["multi-person", "Multi-person verification passed"],
  38: ["fingerprint", "Fingerprint verified"],
  40: ["card + fingerprint", "Card + fingerprint verified"],
  43: ["card + fingerprint", "Card + fingerprint + password verified"],
  46: ["fingerprint", "Fingerprint + password verified"],
  54: ["face + fingerprint", "Face + fingerprint verified"],
  57: ["face", "Face + password verified"],
  60: ["face + card", "Face + card verified"],
  63: ["face + fingerprint", "Face + password + fingerprint verified"],
  66: ["face + card", "Face + card + fingerprint verified"],
  69: ["fingerprint", "Employee no. + fingerprint verified"],
  72: ["fingerprint", "Employee no. + fingerprint + password verified"],
  75: ["face", "Face verified"],
  77: ["face", "Employee no. + face verified"],
};

const DENIED: Record<number, [string | undefined, string]> = {
  3: ["card", "Card + password failed"],
  4: ["card", "Card + password timed out"],
  5: ["card", "Card + password over time"],
  6: ["card", "Card has no access right"],
  7: [undefined, "Outside the valid access period"],
  8: [undefined, "Access expired"],
  9: ["card", "Card not registered"],
  10: [undefined, "Anti-passback violation"],
  11: [undefined, "Interlock: other door not closed"],
  12: [undefined, "Not in a multi-verify group"],
  13: [undefined, "Outside the multi-verify period"],
  14: [undefined, "Multi-verify: super-user check failed"],
  15: [undefined, "Multi-verify: remote check failed"],
  39: ["fingerprint", "Fingerprint not matched"],
  41: ["card + fingerprint", "Card + fingerprint failed"],
  42: ["card + fingerprint", "Card + fingerprint timed out"],
  44: ["card + fingerprint", "Card + fingerprint + password failed"],
  45: ["card + fingerprint", "Card + fingerprint + password timed out"],
  47: ["fingerprint", "Fingerprint + password failed"],
  48: ["fingerprint", "Fingerprint + password timed out"],
  49: ["fingerprint", "Fingerprint not registered"],
  55: ["face + fingerprint", "Face + fingerprint failed"],
  56: ["face + fingerprint", "Face + fingerprint timed out"],
  58: ["face", "Face + password failed"],
  59: ["face", "Face + password timed out"],
  61: ["face + card", "Face + card failed"],
  62: ["face + card", "Face + card timed out"],
  64: ["face + fingerprint", "Face + password + fingerprint failed"],
  65: ["face + fingerprint", "Face + password + fingerprint timed out"],
  67: ["face + card", "Face + card + fingerprint failed"],
  68: ["face + card", "Face + card + fingerprint timed out"],
  70: ["fingerprint", "Employee no. + fingerprint failed"],
  71: ["fingerprint", "Employee no. + fingerprint timed out"],
  73: ["fingerprint", "Employee no. + fingerprint + password failed"],
  74: ["fingerprint", "Employee no. + fingerprint + password timed out"],
  76: ["face", "Face not matched"],
  78: ["face", "Employee no. + face failed"],
  79: ["face", "Employee no. + face timed out"],
  80: ["face", "Face not recognised"],
};

export function classifyAcsEvent(ev: IncomingAcsEvent): ClassifiedEvent {
  if (ev.major !== MAJOR_ACCESS_EVENT || typeof ev.minor !== "number") return { kind: "skip" };

  const granted = GRANTED[ev.minor];
  if (granted) return { kind: "granted", verifyMode: granted[0], reason: granted[1] };

  const denied = DENIED[ev.minor];
  if (denied) return { kind: "denied", verifyMode: denied[0] ?? ev.verifyMode, reason: denied[1] };

  // Unlisted minor. Door/lock/alarm events never name a person, whereas every
  // failure we know about that does name one is in the table above - so an
  // unlisted event that carries an identity is most likely a verification
  // variant this table doesn't know yet, and is recorded as a pass. Anything
  // without an identity is device housekeeping and is skipped.
  if (ev.employeeNo || ev.name) {
    return { kind: "granted", verifyMode: ev.verifyMode, reason: `Verified (event 5/${ev.minor})` };
  }
  return { kind: "skip" };
}

/**
 * Stable identity of one device event. The raw device timestamp is used (not
 * the corrected occurredAt) so the key can never change if the agent's clock
 * correction does; the serial number alone isn't enough because it restarts
 * from 1 after a factory reset.
 */
export function eventKeyFor(ev: IncomingAcsEvent): string {
  return [ev.time ?? ev.occurredAt ?? "", ev.serialNo ?? "", ev.employeeNo ?? "", ev.major ?? "", ev.minor ?? ""].join("#");
}

function cleanString(value: unknown, max = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function cleanInt(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/** Returns null for anything that isn't a usable event (bad shape, bad time). */
export function sanitizeIncomingEvent(input: unknown): IncomingAcsEvent | null {
  if (!input || typeof input !== "object") return null;
  const e = input as Record<string, unknown>;

  const occurredAt = cleanString(e.occurredAt, 40);
  if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return null;

  return {
    serialNo: cleanInt(e.serialNo),
    time: cleanString(e.time, 60),
    occurredAt,
    major: cleanInt(e.major),
    minor: cleanInt(e.minor),
    employeeNo: cleanString(e.employeeNo, 64),
    name: cleanString(e.name, 128),
    cardNo: cleanString(e.cardNo, 64),
    doorNo: cleanInt(e.doorNo),
    cardReaderNo: cleanInt(e.cardReaderNo),
    verifyMode: cleanString(e.verifyMode, 64),
    attendanceStatus: cleanString(e.attendanceStatus, 32),
    raw: e.raw && typeof e.raw === "object" ? e.raw : undefined,
  };
}
