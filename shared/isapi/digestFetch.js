/**
 * Hikvision ISAPI devices authenticate with HTTP Digest by default. Node's
 * fetch has no built-in digest support, so this does the two-step
 * challenge/response handshake by hand: first request triggers a 401 with
 * a WWW-Authenticate header, then it resends with a computed Authorization.
 *
 * Plain CommonJS with zero dependencies (only Node's built-in `crypto` and
 * global `fetch`, Node 18+) so it can be required directly by both the
 * Next.js backend (src/lib/digestFetch.ts re-exports this) and the
 * standalone Windows Gym Device Agent, which must stay independent of the
 * Next.js runtime and packages to a single .exe.
 *
 * @param {string} url
 * @param {string} username
 * @param {string} password
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
async function digestFetch(url, username, password, init = {}) {
  const first = await fetch(url, { ...init, headers: { ...init.headers } });
  if (first.status !== 401) return first;

  const authHeader = first.headers.get("www-authenticate");
  if (!authHeader) return first;

  const challenge = parseDigestChallenge(authHeader);
  if (!challenge) return first;

  const method = init.method || "GET";
  const uri = new URL(url).pathname + new URL(url).search;

  const nc = "00000001";
  const cnonce = randomHex(8);

  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let response;
  let authValue;

  if (challenge.qop) {
    response = md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`);
    authValue =
      `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", ` +
      `uri="${uri}", qop=${challenge.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"` +
      (challenge.opaque ? `, opaque="${challenge.opaque}"` : "");
  } else {
    response = md5(`${ha1}:${challenge.nonce}:${ha2}`);
    authValue = `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}"`;
  }

  return fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: authValue },
  });
}

function md5(input) {
  return require("crypto").createHash("md5").update(input).digest("hex");
}

function randomHex(bytes) {
  return require("crypto").randomBytes(bytes).toString("hex");
}

function parseDigestChallenge(header) {
  if (!header.toLowerCase().startsWith("digest ")) return null;
  const parts = header.slice(7);
  const map = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
  let m;
  while ((m = re.exec(parts))) {
    map[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  if (!map.realm || !map.nonce) return null;
  return {
    realm: map.realm,
    nonce: map.nonce,
    qop: map.qop,
    opaque: map.opaque,
  };
}

module.exports = { digestFetch };
