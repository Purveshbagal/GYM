import readline from "readline";
import { buildConfig, saveConfig, loadConfig, getAgentToken, getDeviceConfig } from "./config";
import { BackendClient } from "./backendClient";
import { testDeviceConnection, parseDeviceInfo } from "./deviceClient";
import { logger } from "./logger";
import type { AgentConfig } from "./types";

function ask(rl: readline.Interface, question: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || fallback || "");
    });
  });
}

/**
 * First-run CLI setup wizard (GUI setup screen is a later packaging
 * phase). Collects backend + device credentials, runs both connection
 * tests, and only saves configuration if both pass — an agent should
 * never start half-configured and spin retrying against something that
 * was never going to work.
 */
export async function runSetupWizard(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const existing = loadConfig();

  console.log("\n====================================");
  console.log("       GYM DEVICE AGENT SETUP");
  console.log("====================================\n");

  const backendUrl = await ask(rl, "Backend URL (e.g. https://api.my-gym.com)", existing?.backendUrl);
  const gymId = await ask(rl, "Gym ID (e.g. GYM001)", existing?.gymId);
  const agentId = await ask(rl, "Agent ID (given by backend admin)", existing?.agentId);
  const agentToken = await ask(rl, "Agent Token (given by backend admin)");
  const deviceIp = await ask(rl, "Hikvision Machine IP (e.g. 192.168.1.201)", existing?.device.ip);
  const devicePortStr = await ask(rl, "Hikvision Port", String(existing?.device.port ?? 80));
  const deviceUsername = await ask(rl, "Hikvision Username", existing?.device.username);
  const devicePassword = await ask(rl, "Hikvision Password");

  const candidate = buildConfig({
    backendUrl,
    gymId,
    agentId,
    agentToken: agentToken || (existing ? getAgentToken(existing) : ""),
    deviceIp,
    devicePort: Number(devicePortStr) || 80,
    deviceUsername,
    devicePassword: devicePassword || (existing ? getDeviceConfig(existing).password : ""),
    autoStart: true,
  });

  console.log("\nTesting connections...\n");
  const ok = await runConnectionTests(candidate);

  if (!ok) {
    console.log("\nSetup NOT saved — fix the issue above and run setup again.\n");
    rl.close();
    process.exitCode = 1;
    return;
  }

  saveConfig(candidate);
  console.log("\nConfiguration saved. Start the agent with: npm run dev  (or Start-Gym-Agent.bat)\n");
  rl.close();
}

/**
 * Runs the same checks the wizard needs, reusable by `--test-connection`
 * without going through the interactive prompts.
 */
export async function runConnectionTests(config: AgentConfig): Promise<boolean> {
  let allOk = true;

  const device = getDeviceConfig(config);
  const deviceCheck = await testDeviceConnection(device);
  if (deviceCheck.ok) {
    const info = parseDeviceInfo(deviceCheck.body);
    console.log("✓ Machine reachable");
    console.log("✓ Authentication successful");
    console.log(`✓ Device model detected: ${info.model ?? "unknown"} (firmware ${info.firmwareVersion ?? "unknown"})`);
  } else {
    console.log(`✗ Hikvision connection failed (HTTP ${deviceCheck.status}) — check IP/username/password`);
    logger.error("Device connection test failed", deviceCheck);
    allOk = false;
  }

  const backend = new BackendClient(config.backendUrl, config.agentId, getAgentToken(config));
  const backendCheck = await backend.ping();
  if (backendCheck.ok) {
    console.log("✓ Backend connected");
  } else {
    console.log(`✗ Backend connection failed: ${backendCheck.error ?? `HTTP ${backendCheck.status}`}`);
    logger.error("Backend connection test failed", backendCheck);
    allOk = false;
  }

  return allOk;
}
