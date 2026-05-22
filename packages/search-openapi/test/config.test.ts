import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_PORT, loadConfig } from "../src/config.js";

const SECRET = "sk-FAKEFAKEFAKE-DO-NOT-USE-1234567890";

describe("loadConfig", () => {
  it("requires IFLOW_API_KEY", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ IFLOW_API_KEY: "" })).toThrow(ConfigError);
    expect(() => loadConfig({ IFLOW_API_KEY: "   " })).toThrow(ConfigError);
  });

  it("error message names IFLOW_API_KEY and never echoes the secret", () => {
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

  it("returns trimmed apiKey and undefined baseUrl/timeoutMs/authToken/clientName by default", () => {
    const cfg = loadConfig({ IFLOW_API_KEY: `  ${SECRET}  ` });
    expect(cfg.apiKey).toBe(SECRET);
    expect(cfg.baseUrl).toBeUndefined();
    expect(cfg.timeoutMs).toBeUndefined();
    expect(cfg.authToken).toBeUndefined();
    expect(cfg.clientName).toBeUndefined();
    expect(cfg.port).toBe(DEFAULT_PORT);
  });

  // ── PORT ────────────────────────────────────────────────────────────────────

  it("defaults PORT to 8787 when unset or blank", () => {
    expect(loadConfig({ IFLOW_API_KEY: SECRET }).port).toBe(8787);
    expect(loadConfig({ IFLOW_API_KEY: SECRET, PORT: "  " }).port).toBe(8787);
  });

  it("parses a valid PORT", () => {
    expect(loadConfig({ IFLOW_API_KEY: SECRET, PORT: "9999" }).port).toBe(9999);
    expect(loadConfig({ IFLOW_API_KEY: SECRET, PORT: "0" }).port).toBe(0);
    expect(loadConfig({ IFLOW_API_KEY: SECRET, PORT: "65535" }).port).toBe(65535);
  });

  it("rejects out-of-range, non-integer, or non-numeric PORT", () => {
    for (const bad of ["-1", "65536", "1.5", "abc", "Infinity", "NaN"]) {
      expect(() =>
        loadConfig({ IFLOW_API_KEY: SECRET, PORT: bad }),
      ).toThrow(ConfigError);
    }
  });

  // ── IFLOW_TIMEOUT_MS ────────────────────────────────────────────────────────

  it("parses valid IFLOW_TIMEOUT_MS as integer", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_TIMEOUT_MS: "15000",
    });
    expect(cfg.timeoutMs).toBe(15000);
  });

  it("rejects zero/negative/fractional/non-numeric IFLOW_TIMEOUT_MS", () => {
    for (const bad of ["0", "-1", "1.5", "abc", "Infinity", "NaN"]) {
      expect(() =>
        loadConfig({ IFLOW_API_KEY: SECRET, IFLOW_TIMEOUT_MS: bad }),
      ).toThrow(ConfigError);
    }
  });

  // ── IFLOW_BASE_URL ──────────────────────────────────────────────────────────

  it("respects IFLOW_BASE_URL when non-empty", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_BASE_URL: "https://example.test",
    });
    expect(cfg.baseUrl).toBe("https://example.test");
  });

  it("treats blank IFLOW_BASE_URL as unset", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_BASE_URL: "   ",
    });
    expect(cfg.baseUrl).toBeUndefined();
  });

  // ── IFLOW_OPENAPI_AUTH_TOKEN ────────────────────────────────────────────────

  it("captures IFLOW_OPENAPI_AUTH_TOKEN when set, trimmed", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_OPENAPI_AUTH_TOKEN: "  s3cret-token  ",
    });
    expect(cfg.authToken).toBe("s3cret-token");
  });

  it("treats blank IFLOW_OPENAPI_AUTH_TOKEN as unset (open mode)", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_OPENAPI_AUTH_TOKEN: "   ",
    });
    expect(cfg.authToken).toBeUndefined();
  });

  // ── IFLOW_OPENAPI_CLIENT ────────────────────────────────────────────────────

  it("accepts valid client-name slugs", () => {
    for (const value of [
      "open-webui",
      "coze",
      "my-host",
      "host_2.0",
      "x",
      "a".repeat(64),
    ]) {
      const cfg = loadConfig({
        IFLOW_API_KEY: SECRET,
        IFLOW_OPENAPI_CLIENT: value,
      });
      expect(cfg.clientName).toBe(value);
    }
  });

  it("trims whitespace around IFLOW_OPENAPI_CLIENT", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_OPENAPI_CLIENT: "  coze  ",
    });
    expect(cfg.clientName).toBe("coze");
  });

  it("treats blank IFLOW_OPENAPI_CLIENT as unset", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_OPENAPI_CLIENT: "   ",
    });
    expect(cfg.clientName).toBeUndefined();
  });

  it("rejects uppercase, spaces, slashes, or >64 chars in IFLOW_OPENAPI_CLIENT", () => {
    for (const bad of [
      "Coze",
      "open webui",
      "open/webui",
      "x+y",
      "host!",
      "a".repeat(65),
    ]) {
      expect(() =>
        loadConfig({ IFLOW_API_KEY: SECRET, IFLOW_OPENAPI_CLIENT: bad }),
      ).toThrow(ConfigError);
    }
  });

  it("config errors never echo the API key", () => {
    let captured: Error | undefined;
    try {
      loadConfig({
        IFLOW_API_KEY: SECRET,
        IFLOW_OPENAPI_CLIENT: "Bad Value",
      });
    } catch (err) {
      captured = err as Error;
    }
    expect(captured).toBeInstanceOf(ConfigError);
    expect(captured?.message).not.toContain(SECRET);
  });
});
