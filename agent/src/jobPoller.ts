import { BackendClient } from "./backendClient";
import { testDeviceConnection, parseDeviceInfo } from "./deviceClient";
import { enrollFingerprint } from "./fingerprintEnroll";
import { enrollFaceByDetection } from "./faceEnroll";
import type { DeviceConfig, PendingJob } from "./types";
import { logger } from "./logger";
import { startRetryLoop } from "./retryLoop";

const POLL_INTERVAL_MS = 5_000;

async function executeJob(job: PendingJob, device: DeviceConfig) {
  switch (job.type) {
    case "GET_DEVICE_STATUS": {
      const res = await testDeviceConnection(device);
      if (!res.ok) throw new Error(`Device unreachable (HTTP ${res.status})`);
      return parseDeviceInfo(res.body);
    }
    case "ENROLL_FINGERPRINT": {
      const payload = job.payload as { employeeNo: string; fingerNo?: number };
      if (!payload?.employeeNo) throw new Error("ENROLL_FINGERPRINT job missing employeeNo");
      return enrollFingerprint(device, payload.employeeNo, payload.fingerNo ?? 1);
    }
    case "ENROLL_FACE": {
      const payload = job.payload as { employeeNo: string };
      if (!payload?.employeeNo) throw new Error("ENROLL_FACE job missing employeeNo");
      return enrollFaceByDetection(device, payload.employeeNo);
    }
    default:
      throw new Error(`Job type "${job.type}" is not supported by this agent build yet`);
  }
}

/**
 * Fingerprint/face enrollment jobs can take a while (face waits up to two
 * minutes for the member to walk up and enroll). Running them here would
 * block the poll loop from picking up other jobs and delay the next
 * heartbeat-adjacent cycle, so each job is dispatched fire-and-forget:
 * the poll loop itself returns as soon as jobs are handed off, and each
 * job posts its own result whenever it actually finishes.
 */
async function runJob(job: PendingJob, device: DeviceConfig, backend: BackendClient) {
  try {
    const result = await executeJob(job, device);
    await backend.postJobResult(job.jobId, { success: true, result });
    logger.info("Job completed", { jobId: job.jobId, type: job.type });
  } catch (err) {
    const errorMessage = (err as Error).message;
    await backend.postJobResult(job.jobId, { success: false, errorMessage });
    logger.error("Job failed", { jobId: job.jobId, type: job.type, errorMessage });
  }
}

export function startJobPollerLoop(backend: BackendClient, device: DeviceConfig) {
  return startRetryLoop("job-poller", POLL_INTERVAL_MS, async () => {
    const jobs = await backend.getPendingJobs();
    if (jobs.length === 0) return;

    logger.info(`Received ${jobs.length} pending job(s)`, { jobIds: jobs.map((j) => j.jobId) });

    for (const job of jobs) {
      // Deliberately not awaited - see runJob's doc comment.
      void runJob(job, device, backend);
    }
  });
}
