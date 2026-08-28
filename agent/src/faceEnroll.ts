import type { DeviceConfig } from "./types";
import { logger } from "./logger";

const { isapiRequest } = require("../../shared/isapi/isapiClient") as {
  isapiRequest: (device: DeviceConfig, path: string, method: string, body?: unknown) => Promise<{ ok: boolean; status: number; body: unknown }>;
};

// CONFIRMED on the real DS-K1T320-B: there is no remote trigger for face
// capture (CaptureFace -> HTTP 400 notSupport; its own /capabilities ->
// 404). The only real mechanism is: the member enrolls locally at the
// terminal's own camera/menu, and UserInfo/Search - also confirmed
// working live, detecting the transition in ~0.1s - is how the Agent
// finds out it happened, without a photo ever touching Android/backend.
const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 120_000; // time for the member to walk up and enroll

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FaceInfo = { employeeNo: string; numOfFace: number };

/**
 * Only extracts employeeNo + numOfFace - deliberately never touches or
 * returns faceURL (present in the real response) or any other field, so
 * there is no code path that could accidentally log or forward it.
 */
async function getFaceInfo(device: DeviceConfig, employeeNo: string): Promise<FaceInfo> {
  const res = await isapiRequest(device, "/ISAPI/AccessControl/UserInfo/Search?format=json", "POST", {
    UserInfoSearchCond: { searchID: "1", searchResultPosition: 0, maxResults: 1, EmployeeNoList: [{ employeeNo }] },
  });
  if (!res.ok) {
    throw new Error(`UserInfo/Search failed (HTTP ${res.status})`);
  }
  const body = res.body as any;
  const record = body?.UserInfoSearch?.UserInfo?.[0] ?? body?.UserInfo?.[0] ?? null;
  if (!record) {
    return { employeeNo, numOfFace: 0 };
  }
  if (record.employeeNo && String(record.employeeNo) !== String(employeeNo)) {
    throw new Error(`UserInfo/Search returned employeeNo ${record.employeeNo}, expected ${employeeNo}`);
  }
  return { employeeNo, numOfFace: Number(record.numOfFace ?? (record.hasFace ? 1 : 0)) };
}

/**
 * Waits for the member to complete face enrollment locally at the
 * terminal. Records the baseline numOfFace before polling so an already-
 * enrolled face from before this job started can't produce a false
 * "just enrolled" result.
 */
export async function enrollFaceByDetection(device: DeviceConfig, employeeNo: string): Promise<{ detected: true; waitedMs: number }> {
  const baseline = await getFaceInfo(device, employeeNo);
  logger.info("Face enrollment: waiting for local enrollment at the terminal", { employeeNo, baseline: baseline.numOfFace });

  const start = Date.now();
  const deadline = start + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const current = await getFaceInfo(device, employeeNo);
    if (current.numOfFace > baseline.numOfFace) {
      const waitedMs = Date.now() - start;
      logger.info("Face enrollment detected", { employeeNo, waitedMs });
      return { detected: true, waitedMs };
    }
  }

  throw new Error(
    `No local face enrollment detected within ${MAX_WAIT_MS / 1000}s - ask the member to ` +
      "complete enrollment at the terminal's camera and try again"
  );
}
