/**
 * Re-exports the HTTP Digest auth handshake used to talk to Hikvision
 * ISAPI devices. The actual implementation lives in shared/isapi so it can
 * also be used, unmodified, by the standalone Windows Gym Device Agent
 * (which must stay independent of the Next.js runtime). Do not re-implement
 * digest auth here — edit shared/isapi/digestFetch.js instead.
 */
export const { digestFetch } = require("../../../shared/isapi/digestFetch") as {
  digestFetch: (
    url: string,
    username: string,
    password: string,
    init?: RequestInit
  ) => Promise<Response>;
};
