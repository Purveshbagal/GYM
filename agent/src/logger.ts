import fs from "fs";
import { getLogPath } from "./paths";

type Level = "info" | "warn" | "error";

const REDACT_KEYS = new Set(["password", "passwordenc", "agenttoken", "agenttokenenc", "authorization"]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

function write(level: Level, message: string, meta?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta !== undefined ? { meta: redact(meta) } : {}),
  };
  const line = JSON.stringify(entry);

  const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleFn(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, meta !== undefined ? redact(meta) : "");

  try {
    fs.appendFileSync(getLogPath(), line + "\n");
  } catch {
    // Logging must never crash the agent; if the disk/log path is
    // unavailable, console output above is the fallback.
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta),
};
