import crypto from "crypto";

export type DeviceConfig = {
  ip: string;
  port: number;
  username: string;
  password: string;
};

function md5(input: string) {
  return crypto.createHash("md5").update(input).digest("hex");
}

function parseDigestChallenge(header: string) {
  const params: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }
  return params;
}

function buildDigestHeader(
  device: DeviceConfig,
  method: string,
  uri: string,
  challenge: Record<string, string>
) {
  const { realm, nonce, qop, opaque, algorithm } = challenge;
  const ha1 = md5(`${device.username}:${realm}:${device.password}`);
  const ha2 = md5(`${method}:${uri}`);
  const nc = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");

  let response: string;
  let qopValue: string | undefined;
  if (qop) {
    qopValue = qop.split(",")[0].trim();
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qopValue}:${ha2}`);
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
  }

  const parts = [
    `username="${device.username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (qopValue) {
    parts.push(`qop=${qopValue}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }
  if (opaque) {
    parts.push(`opaque="${opaque}"`);
  }
  if (algorithm) {
    parts.push(`algorithm=${algorithm}`);
  }

  return `Digest ${parts.join(", ")}`;
}

async function finalizeResponse(response: Response) {
  const text = await response.text();
  let parsedBody: unknown = text;
  if (text) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      // Not JSON; leave as raw text.
    }
  }
  return { ok: response.ok, status: response.status, body: parsedBody };
}

/**
 * Performs an ISAPI request against a Hikvision access-control device,
 * handling the HTTP digest-auth challenge/response handshake the devices
 * require (RFC 7616).
 */
export async function isapiRequest(
  device: DeviceConfig,
  path: string,
  method: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `http://${device.ip}:${device.port}${path}`;
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  const firstResponse = await fetch(url, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload,
  });

  if (firstResponse.status !== 401) {
    return finalizeResponse(firstResponse);
  }

  const authHeader = firstResponse.headers.get("www-authenticate");
  if (!authHeader || !authHeader.toLowerCase().startsWith("digest")) {
    return finalizeResponse(firstResponse);
  }

  const challenge = parseDigestChallenge(authHeader);
  const digestHeader = buildDigestHeader(device, method, path, challenge);

  const secondResponse = await fetch(url, {
    method,
    headers: {
      ...(payload ? { "Content-Type": "application/json" } : {}),
      Authorization: digestHeader,
    },
    body: payload,
  });

  return finalizeResponse(secondResponse);
}
