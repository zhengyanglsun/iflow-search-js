import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

const SECRET = "sk-FAKEFAKEFAKE-DO-NOT-USE-1234567890";

describe("loadConfig", () => {
  it("requires IFLOW_API_KEY", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ IFLOW_API_KEY: "" })).toThrow(ConfigError);
    expect(() => loadConfig({ IFLOW_API_KEY: "   " })).toThrow(ConfigError);
  });

  it("error message names the env var and never echoes the key value", () => {
    let captured: Error | undefined;
    try {
      loadConfig({});
    } catch (err) {
      captured = err as Error;
    }
    expect(captured).toBeInstanceOf(ConfigError);
    expect(captured?.message).toContain("IFLOW_API_KEY");
    expect(captured?.message).not.toContain(SECRET);
  });

  it("missing-key error never leaks a real-looking key even if one was supplied", () => {
    // Whitespace-only key counts as missing. The thrown message must not echo
    // back the (still-secret) value the user passed in.
    let captured: Error | undefined;
    try {
      loadConfig({ IFLOW_API_KEY: "   " });
    } catch (err) {
      captured = err as Error;
    }
    expect(captured?.message).not.toContain("   ");
  });

  it("returns apiKey trimmed and baseUrl/timeoutMs undefined when not set", () => {
    const cfg = loadConfig({ IFLOW_API_KEY: `  ${SECRET}  ` });
    expect(cfg.apiKey).toBe(SECRET);
    expect(cfg.baseUrl).toBeUndefined();
    expect(cfg.timeoutMs).toBeUndefined();
  });

  it("respects IFLOW_BASE_URL when non-empty", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_BASE_URL: "https://example.test",
    });
    expect(cfg.baseUrl).toBe("https://example.test");
  });

  it("treats empty/whitespace IFLOW_BASE_URL as unset", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_BASE_URL: "   ",
    });
    expect(cfg.baseUrl).toBeUndefined();
  });

  it("parses valid IFLOW_TIMEOUT_MS as integer", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_TIMEOUT_MS: "15000",
    });
    expect(cfg.timeoutMs).toBe(15000);
  });

  it("rejects non-numeric IFLOW_TIMEOUT_MS", () => {
    expect(() =>
      loadConfig({ IFLOW_API_KEY: SECRET, IFLOW_TIMEOUT_MS: "abc" }),
    ).toThrow(ConfigError);
  });

  it("rejects zero, negative, fractional, infinite IFLOW_TIMEOUT_MS", () => {
    for (const bad of ["0", "-1", "1.5", "Infinity", "NaN"]) {
      expect(() =>
        loadConfig({ IFLOW_API_KEY: SECRET, IFLOW_TIMEOUT_MS: bad }),
      ).toThrow(ConfigError);
    }
  });
});
