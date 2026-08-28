export type DeviceConfig = {
  ip: string;
  port: number;
  username: string;
  password: string;
};

export type AgentConfig = {
  backendUrl: string;
  gymId: string;
  agentId: string;
  agentTokenEnc: string;
  device: {
    ip: string;
    port: number;
    username: string;
    passwordEnc: string;
  };
  autoStart: boolean;
};

export type PendingJob = {
  jobId: string;
  type: string;
  payload: unknown;
};

export type JobResult = {
  success: boolean;
  result?: unknown;
  errorMessage?: string;
};
