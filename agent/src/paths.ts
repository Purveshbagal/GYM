import path from "path";
import fs from "fs";
import os from "os";

/**
 * Where the agent keeps its config, encryption key, local queue database,
 * and logs. On a real gym PC this is %PROGRAMDATA%\GymDeviceAgent so the
 * agent works the same whether it's run from a user session or a Windows
 * service. Falls back to a local ./data folder when PROGRAMDATA isn't set
 * (non-Windows dev machines).
 */
export function getDataDir(): string {
  const base = process.env.PROGRAMDATA || path.join(os.homedir(), ".gym-device-agent");
  const dir = path.join(base, "GymDeviceAgent");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getConfigPath(): string {
  return path.join(getDataDir(), "config.json");
}

export function getKeyPath(): string {
  return path.join(getDataDir(), "agent.key");
}

export function getQueuePath(): string {
  return path.join(getDataDir(), "queue.db");
}

export function getLogPath(): string {
  return path.join(getDataDir(), "agent.log");
}
