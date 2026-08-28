import { logger } from "./logger";
import type { JobResult, PendingJob } from "./types";

export class BackendClient {
  constructor(
    private baseUrl: string,
    private agentId: string,
    private agentToken: string
  ) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.agentId}.${this.agentToken}`,
    };
  }

  private url(path: string) {
    return `${this.baseUrl}${path}`;
  }

  /** Basic outbound reachability check — used by the setup wizard's "Test Backend" step. */
  async ping(): Promise<{ ok: boolean; status?: number; error?: string }> {
    try {
      const res = await fetch(this.url("/api/agent/heartbeat"), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({}),
      });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async heartbeat(payload: {
    deviceModel?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    deviceOnline?: boolean;
  }): Promise<{ ok: boolean; status?: number; error?: string }> {
    try {
      const res = await fetch(this.url("/api/agent/heartbeat"), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) return { ok: false, status: res.status };
      return { ok: true, status: res.status };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async getPendingJobs(): Promise<PendingJob[]> {
    const res = await fetch(this.url("/api/agent/jobs/pending"), {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Job poll failed: HTTP ${res.status}`);
    const body = (await res.json()) as { data?: PendingJob[] };
    return body?.data ?? [];
  }

  async postJobResult(jobId: string, result: JobResult): Promise<void> {
    const res = await fetch(this.url(`/api/agent/jobs/${jobId}/result`), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(result),
    });
    if (!res.ok) {
      logger.warn("Failed to post job result to backend", { jobId, status: res.status });
    }
  }
}
