import fs from "fs";
import { getConfigPath } from "./paths";
import { encryptSecret, decryptSecret } from "./secretStore";
import type { AgentConfig, DeviceConfig } from "./types";

export function loadConfig(): AgentConfig | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as AgentConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AgentConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function buildConfig(input: {
  backendUrl: string;
  gymId: string;
  agentId: string;
  agentToken: string;
  deviceIp: string;
  devicePort: number;
  deviceUsername: string;
  devicePassword: string;
  autoStart: boolean;
}): AgentConfig {
  return {
    backendUrl: input.backendUrl.replace(/\/+$/, ""),
    gymId: input.gymId,
    agentId: input.agentId,
    agentTokenEnc: encryptSecret(input.agentToken),
    device: {
      ip: input.deviceIp,
      port: input.devicePort,
      username: input.deviceUsername,
      passwordEnc: encryptSecret(input.devicePassword),
    },
    autoStart: input.autoStart,
  };
}

export function getAgentToken(config: AgentConfig): string {
  return decryptSecret(config.agentTokenEnc);
}

export function getDeviceConfig(config: AgentConfig): DeviceConfig {
  return {
    ip: config.device.ip,
    port: config.device.port,
    username: config.device.username,
    password: decryptSecret(config.device.passwordEnc),
  };
}
