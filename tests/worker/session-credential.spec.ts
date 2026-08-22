/**
 * Unit coverage for src/utils/sessionCredential.ts (issue #135).
 *
 * These run inside workerd via @cloudflare/vitest-pool-workers rather than Node,
 * because the credential is built on crypto.subtle (importKey/sign HMAC and
 * timingSafeEqual, a Workers extension), the same runtime as production.
 */
import { describe, it, expect } from "vitest";
import {
  mintSessionCredential,
  verifySessionCredential,
  SESSION_CREDENTIAL_TTL_MS,
} from "../../src/utils/sessionCredential";

const SECRET = "test-worker-secret";

describe("session credential", () => {
  it("verifies a freshly minted credential", async () => {
    const token = await mintSessionCredential(SECRET);
    await expect(verifySessionCredential(token, SECRET)).resolves.toBe(true);
  });

  it("has the documented two-segment format: issuedAt.macB64url", async () => {
    const token = await mintSessionCredential(SECRET, 1_700_000_000_000);
    const segments = token.split(".");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toBe("1700000000000");
    // base64url, no padding: only the URL-safe alphabet, never "+", "/", or "=".
    expect(segments[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a credential minted with a different secret", async () => {
    const token = await mintSessionCredential("some-other-secret");
    await expect(verifySessionCredential(token, SECRET)).resolves.toBe(false);
  });

  it("rejects a tampered MAC", async () => {
    const token = await mintSessionCredential(SECRET);
    const [issuedAt, mac] = token.split(".") as [string, string];
    // Flip the first MAC character to a different base64url character.
    const flipped = (mac[0] === "A" ? "B" : "A") + mac.slice(1);
    await expect(verifySessionCredential(`${issuedAt}.${flipped}`, SECRET)).resolves.toBe(false);
  });

  it("rejects a tampered (incremented) issuedAt with an otherwise valid MAC", async () => {
    const issuedAt = 1_700_000_000_000;
    const token = await mintSessionCredential(SECRET, issuedAt);
    const mac = token.split(".")[1]!;
    // Same MAC, different timestamp: the MAC no longer signs this issuedAt.
    await expect(verifySessionCredential(`${issuedAt + 1}.${mac}`, SECRET)).resolves.toBe(false);
  });

  it("rejects an expired credential deterministically", async () => {
    // Stamp the credential far enough in the past that Date.now() - issuedAt
    // exceeds the TTL, then sign it with the real mint internals so only the
    // freshness check can fail, not the MAC.
    const expiredIssuedAt = Date.now() - (SESSION_CREDENTIAL_TTL_MS + 1000);
    const token = await mintSessionCredential(SECRET, expiredIssuedAt);
    await expect(verifySessionCredential(token, SECRET)).resolves.toBe(false);
  });

  it("verifies a credential minted just inside the TTL", async () => {
    const nearExpiry = Date.now() - (SESSION_CREDENTIAL_TTL_MS - 60_000);
    const token = await mintSessionCredential(SECRET, nearExpiry);
    await expect(verifySessionCredential(token, SECRET)).resolves.toBe(true);
  });

  describe("malformed tokens return false without throwing", () => {
    // A real MAC segment for building tokens whose OTHER part is malformed.
    let validMac: string;
    let validIssuedAt: string;

    it.each([
      ["empty string", () => ""],
      ["no separator", () => "not-a-token"],
      ["only a dot", () => "."],
      ["three segments", () => `${validIssuedAt}.${validMac}.extra`],
      ["non-numeric issuedAt", () => `abc.${validMac}`],
      ["negative issuedAt", () => `-1.${validMac}`],
      ["scientific-notation issuedAt", () => `1e3.${validMac}`],
      ["empty issuedAt segment", () => `.${validMac}`],
      ["empty MAC segment", () => `${validIssuedAt}.`],
      ["non-base64url MAC (padding/plus)", () => `${validIssuedAt}.++++====`],
      ["wrong-length MAC (decodes to 3 bytes)", () => `${validIssuedAt}.AAAA`],
    ])("rejects %s", async (_label, build) => {
      const token = await mintSessionCredential(SECRET, 1_700_000_000_000);
      [validIssuedAt, validMac] = token.split(".") as [string, string];
      await expect(verifySessionCredential(build(), SECRET)).resolves.toBe(false);
    });
  });
});
