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

  // ── IFLOW_MCP_CLIENT / IFLOW_MCP_CLIENT_VERSION ────────────────────────────

  it("leaves clientName / clientVersion undefined when not set", () => {
    const cfg = loadConfig({ IFLOW_API_KEY: SECRET });
    expect(cfg.clientName).toBeUndefined();
    expect(cfg.clientVersion).toBeUndefined();
  });

  it("accepts known MCP host slugs (lowercase, dash, dot, underscore)", () => {
    for (const value of ["hermes", "claude-code", "claude-desktop", "cline", "host_2.0", "x"]) {
      const cfg = loadConfig({
        IFLOW_API_KEY: SECRET,
        IFLOW_MCP_CLIENT: value,
      });
      expect(cfg.clientName).toBe(value);
    }
  });

  it("trims whitespace around IFLOW_MCP_CLIENT", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_MCP_CLIENT: "  hermes  ",
    });
    expect(cfg.clientName).toBe("hermes");
  });

  it("treats empty/whitespace IFLOW_MCP_CLIENT as unset", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_MCP_CLIENT: "   ",
    });
    expect(cfg.clientName).toBeUndefined();
  });

  it("rejects uppercase letters and spaces in IFLOW_MCP_CLIENT", () => {
    for (const bad of ["Hermes", "Claude Code", "Claude/Code", "x+y", "hi!", "a b"]) {
      expect(() =>
        loadConfig({ IFLOW_API_KEY: SECRET, IFLOW_MCP_CLIENT: bad }),
      ).toThrow(ConfigError);
    }
  });

  it("rejects IFLOW_MCP_CLIENT longer than 64 chars", () => {
    expect(() =>
      loadConfig({
        IFLOW_API_KEY: SECRET,
        IFLOW_MCP_CLIENT: "a".repeat(65),
      }),
    ).toThrow(ConfigError);
  });

  it("accepts a sane semver-ish IFLOW_MCP_CLIENT_VERSION when paired with client name", () => {
    const cfg = loadConfig({
      IFLOW_API_KEY: SECRET,
      IFLOW_MCP_CLIENT: "claude-code",
      IFLOW_MCP_CLIENT_VERSION: "1.2.3-beta.4+build.5",
    });
    expect(cfg.clientName).toBe("claude-code");
    expect(cfg.clientVersion).toBe("1.2.3-beta.4+build.5");
  });

  it("rejects IFLOW_MCP_CLIENT_VERSION with disallowed characters", () => {
    for (const bad of ["1.0 beta", "1.0/2", "1.0!", "v 1"]) {
      expect(() =>
        loadConfig({
          IFLOW_API_KEY: SECRET,
          IFLOW_MCP_CLIENT: "hermes",
          IFLOW_MCP_CLIENT_VERSION: bad,
        }),
      ).toThrow(ConfigError);
    }
  });

  it("rejects IFLOW_MCP_CLIENT_VERSION when IFLOW_MCP_CLIENT is missing", () => {
    expect(() =>
      loadConfig({
        IFLOW_API_KEY: SECRET,
        IFLOW_MCP_CLIENT_VERSION: "1.2.3",
      }),
    ).toThrow(ConfigError);
  });

  it("config errors never echo the API key", () => {
    let captured: Error | undefined;
    try {
      loadConfig({
        IFLOW_API_KEY: SECRET,
        IFLOW_MCP_CLIENT: "Bad Value",
      });
    } catch (err) {
      captured = err as Error;
    }
    expect(captured).toBeInstanceOf(ConfigError);
    expect(captured?.message).not.toContain(SECRET);
  });
});
