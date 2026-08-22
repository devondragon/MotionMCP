/**
 * Expiring session credential for the legacy-SSE message endpoint (issue #135).
 *
 * Background. In path-secret mode the agents SDK advertises its message
 * endpoint as /mcp/message?sessionId=... with no secret path segment, so the
 * Worker threads a credential through a query param on the advertised URL. The
 * SDK builds that URL from `new URL(request.url)`, preserving every query param
 * set on the stream-open request, so a param the Worker sets when the stream
 * opens is echoed back verbatim by the client on each message POST.
 *
 * The old mechanism put the raw, long-lived MOTION_MCP_SECRET in that param, so
 * the shared secret landed in every access/proxy log line for a message POST. A
 * leaked log then leaked the secret permanently. This module replaces it with a
 * credential that EXPIRES, verified statelessly: a symmetric HMAC over the
 * issued-at timestamp. There is nothing to bind a stored token to (the outer
 * fetch handler never sees the sessionId; the SDK mints it inside the Durable
 * Object), so the credential carries its own issue time and is checked with the
 * server's secret as the HMAC key, no server-side state required.
 *
 * Token format (two "."-separated segments):
 *   `${issuedAtMs}.${base64url(HMAC_SHA256(secret, utf8(String(issuedAtMs))))}`
 * - issuedAtMs is the decimal string of Date.now() (URL-safe as-is).
 * - The MAC is computed over the exact ASCII bytes of that decimal string (the
 *   first segment), then base64url-encoded without padding. Signing the first
 *   segment's literal bytes avoids any re-encoding mismatch between mint and
 *   verify.
 *
 * TTL tradeoff. Legacy SSE streams are long-lived: a credential is minted ONCE
 * when the stream opens and its issuedAt is fixed for the whole life of the
 * session, so the TTL must OUTLAST a session or in-session message POSTs would
 * start failing. That caps the benefit: the window cannot be short. The gain is
 * that a leaked credential eventually expires, where a leaked shared secret
 * never does, not that the exposure window is small. A session held open past
 * the TTL will get 404s on its message POSTs and must reconnect; reconnecting
 * opens a new stream, which mints a fresh credential, so this self-heals.
 */

/** 24 hours. Must outlast a legacy-SSE session (see the TTL tradeoff above). */
export const SESSION_CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

/** base64url-encode raw bytes with no padding. */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * base64url-decode to raw bytes. Returns null (never throws) on any input that
 * is not valid base64url, so callers can treat a malformed token as a rejection.
 */
function base64urlDecode(value: string): Uint8Array | null {
  // Reject characters outside the base64url alphabet up front; atob would
  // otherwise accept some of them (e.g. standard "+"/"/") or throw.
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    return null;
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/** Import a secret as an HMAC-SHA256 signing key. */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Compute the raw 32-byte HMAC-SHA256 of `issuedAt`'s ASCII bytes under `secret`. */
async function computeMac(issuedAt: string, secret: string): Promise<Uint8Array> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(issuedAt));
  return new Uint8Array(signature);
}

/**
 * Mint a fresh session credential signed with `secret`.
 *
 * The optional `issuedAt` seam exists only for deterministic tests (e.g.
 * simulating an already-expired credential); production callers omit it so the
 * credential is stamped with the current time.
 */
export async function mintSessionCredential(
  secret: string,
  issuedAt: number = Date.now(),
): Promise<string> {
  const issuedAtStr = String(issuedAt);
  const mac = await computeMac(issuedAtStr, secret);
  return `${issuedAtStr}.${base64urlEncode(mac)}`;
}

/**
 * Verify a session credential against `secret`. Returns false (never throws) on
 * any malformed, forged, or expired token. Checks authenticity (the MAC) before
 * trusting the timestamp, and requires both authenticity and freshness to pass.
 */
export async function verifySessionCredential(token: string, secret: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  const segments = token.split(".");
  if (segments.length !== 2) {
    return false;
  }
  const [issuedAtStr, macB64url] = segments as [string, string];

  // First segment must be a plain non-negative integer. Reject anything else
  // (empty, signs, decimals, exponent notation, leading whitespace) so the
  // signed message is exactly the ASCII we re-sign below.
  if (!/^\d+$/.test(issuedAtStr)) {
    return false;
  }
  const issuedAt = Number(issuedAtStr);
  if (!Number.isSafeInteger(issuedAt)) {
    return false;
  }

  const providedMac = base64urlDecode(macB64url);
  // Guard the length BEFORE timingSafeEqual, which throws on unequal lengths.
  if (providedMac === null || providedMac.length !== 32) {
    return false;
  }

  const expectedMac = await computeMac(issuedAtStr, secret);

  // Authenticity first: both are fixed 32-byte buffers, so this is a constant
  // -time compare with no length-based early return.
  if (!crypto.subtle.timingSafeEqual(providedMac, expectedMac)) {
    return false;
  }

  // Freshness: only trusted once the MAC is verified.
  if (Date.now() - issuedAt > SESSION_CREDENTIAL_TTL_MS) {
    return false;
  }

  return true;
}
