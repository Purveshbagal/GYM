import { loadConfig, getAgentToken, getDeviceConfig } from "./config";
import { runSetupWizard, runConnectionTests } from "./setup";
import { BackendClient } from "./backendClient";
import { startHeartbeatLoop } from "./heartbeat";
import { startJobPollerLoop } from "./jobPoller";
import { closeQueue } from "./queue";
import { logger } from "./logger";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--setup")) {
    await runSetupWizard();
    return;
  }

  const config = loadConfig();

  if (args.includes("--test-connection")) {
    if (!config) {
      console.log("No configuration found. Run: npm run setup");
      process.exitCode = 1;
      return;
    }
    const ok = await runConnectionTests(config);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (!config) {
    console.log("No configuration found — starting first-run setup.\n");
    await runSetupWizard();
    return;
  }

  logger.info("Gym Device Agent starting", { gymId: config.gymId, agentId: config.agentId });

  const backend = new BackendClient(config.backendUrl, config.agentId, getAgentToken(config));
  const device = getDeviceConfig(config);

  const stopHeartbeat = startHeartbeatLoop(backend, device);
  const stopJobPoller = startJobPollerLoop(backend, device);

  console.log("\nGym Device Agent running.");
  console.log(`  Gym:      ${config.gymId}`);
  console.log(`  Device:   ${device.ip}:${device.port}`);
  console.log(`  Backend:  ${config.backendUrl}`);
  console.log("Press Ctrl+C to stop.\n");

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);
    stopHeartbeat();
    stopJobPoller();
    closeQueue();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception (agent keeps running)", { error: err.message, stack: err.stack });
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection (agent keeps running)", { reason: String(reason) });
  });
}

main().catch((err) => {
  logger.error("Fatal startup error", { error: (err as Error).message });
  process.exit(1);
});
