import { describe, expect, it } from "vitest";
import { checkBearer } from "../src/auth.js";

const EXPECTED = "expected-token-1234567890";

describe("checkBearer", () => {
  it("returns ok when no expected token is configured (open mode)", () => {
    expect(checkBearer(undefined, undefined)).toEqual({ ok: true });
    expect(checkBearer("Bearer anything", undefined)).toEqual({ ok: true });
    expect(checkBearer(undefined, "")).toEqual({ ok: true });
  });

  it("rejects missing Authorization header when token is required", () => {
    const result = checkBearer(undefined, EXPECTED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
    expect(result.code).toBe("unauthorized");
    expect(result.message.toLowerCase()).toContain("missing authorization");
  });

  it("rejects empty Authorization header", () => {
    const result = checkBearer("   ", EXPECTED);
    expect(result.ok).toBe(false);
  });

  it("rejects malformed Authorization header (no Bearer prefix)", () => {
    const result = checkBearer("Basic abc", EXPECTED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toContain("bearer");
  });

  it("rejects Bearer with no token (trailing whitespace only)", () => {
    // After the outer trim, the input becomes just "Bearer" which doesn't
    // match the regex — so this falls through to the malformed branch.
    const result = checkBearer("Bearer   ", EXPECTED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toContain("bearer");
  });

  it("rejects wrong token", () => {
    const result = checkBearer("Bearer wrong-token", EXPECTED);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
    expect(result.code).toBe("unauthorized");
    expect(result.message.toLowerCase()).toContain("invalid bearer token");
  });

  it("rejects a token that is a prefix of the expected token", () => {
    const result = checkBearer(`Bearer ${EXPECTED.slice(0, -1)}`, EXPECTED);
    expect(result.ok).toBe(false);
  });

  it("rejects a token that is longer than the expected token", () => {
    const result = checkBearer(`Bearer ${EXPECTED}x`, EXPECTED);
    expect(result.ok).toBe(false);
  });

  it("accepts the correct token", () => {
    expect(checkBearer(`Bearer ${EXPECTED}`, EXPECTED)).toEqual({ ok: true });
  });

  it("accepts a lowercase bearer scheme (case-insensitive)", () => {
    expect(checkBearer(`bearer ${EXPECTED}`, EXPECTED)).toEqual({ ok: true });
    expect(checkBearer(`BEARER ${EXPECTED}`, EXPECTED)).toEqual({ ok: true });
  });

  it("never throws on equal-length-but-wrong tokens (timing-safe path)", () => {
    const wrongSameLen = "x".repeat(EXPECTED.length);
    expect(() => checkBearer(`Bearer ${wrongSameLen}`, EXPECTED)).not.toThrow();
    const result = checkBearer(`Bearer ${wrongSameLen}`, EXPECTED);
    expect(result.ok).toBe(false);
  });
});
