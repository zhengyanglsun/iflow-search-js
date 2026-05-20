/**
 * Env-only configuration for the iFlow Search MCP server.
 *
 *   IFLOW_API_KEY              (required) — forwarded to search-core, sent as Authorization: Bearer ...
 *   IFLOW_BASE_URL             (optional) — defaults to search-core's default (https://platform.iflow.cn)
 *   IFLOW_TIMEOUT_MS           (optional) — must be a positive finite integer if provided
 *   IFLOW_MCP_CLIENT           (optional) — declared MCP host (e.g. "hermes", "claude-code",
 *                                            "claude-desktop"). Emitted as IFlow-MCP-Client header.
 *                                            Allowed: [a-z0-9._-]{1,64}.
 *   IFLOW_MCP_CLIENT_VERSION   (optional) — version of the above. Allowed: [A-Za-z0-9._+-]{1,64}.
 *                                            Ignored unless IFLOW_MCP_CLIENT is set.
 *
 * Anything not in the table above is rejected — no file discovery, no CLI flags for secrets,
 * no keychain integration. The MCP client's `env` block is the only configuration source.
 *
 * Errors thrown from this module are init-time fatal: bin.ts prints them to stderr and exits
 * with a non-zero code BEFORE the stdio transport is wired up.
 */

export interface ResolvedConfig {
  apiKey: string;
  /** Undefined here means "use search-core's default". */
  baseUrl: string | undefined;
  /** Undefined here means "use search-core's default". */
  timeoutMs: number | undefined;
  /** Undefined here means "do not emit the IFlow-MCP-Client header". */
  clientName: string | undefined;
  /** Undefined here means "do not emit the IFlow-MCP-Client-Version header". */
  clientVersion: string | undefined;
}

export interface EnvLike {
  IFLOW_API_KEY?: string | undefined;
  IFLOW_BASE_URL?: string | undefined;
  IFLOW_TIMEOUT_MS?: string | undefined;
  IFLOW_MCP_CLIENT?: string | undefined;
  IFLOW_MCP_CLIENT_VERSION?: string | undefined;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const CLIENT_NAME_PATTERN = /^[a-z0-9._-]{1,64}$/u;
const CLIENT_VERSION_PATTERN = /^[A-Za-z0-9._+-]{1,64}$/u;

export function loadConfig(env: EnvLike = process.env): ResolvedConfig {
  const apiKey = (env.IFLOW_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new ConfigError(
      "IFLOW_API_KEY is required. Set it in your MCP client's env block, e.g. " +
        '{ "env": { "IFLOW_API_KEY": "YOUR_IFLOW_API_KEY" } }. ' +
        "Never commit the real key.",
    );
  }

  const rawBase = env.IFLOW_BASE_URL?.trim();
  const baseUrl = rawBase && rawBase.length > 0 ? rawBase : undefined;

  const rawTimeout = env.IFLOW_TIMEOUT_MS?.trim();
  let timeoutMs: number | undefined;
  if (rawTimeout && rawTimeout.length > 0) {
    const parsed = Number(rawTimeout);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      throw new ConfigError(
        `IFLOW_TIMEOUT_MS must be a positive integer (milliseconds). Got: ${JSON.stringify(rawTimeout)}.`,
      );
    }
    timeoutMs = parsed;
  }

  const rawClient = env.IFLOW_MCP_CLIENT?.trim();
  const rawClientVersion = env.IFLOW_MCP_CLIENT_VERSION?.trim();
  let clientName: string | undefined;
  let clientVersion: string | undefined;
  if (rawClient && rawClient.length > 0) {
    if (!CLIENT_NAME_PATTERN.test(rawClient)) {
      throw new ConfigError(
        `IFLOW_MCP_CLIENT must match [a-z0-9._-]{1,64} (lowercase letters, digits, dot, underscore, dash). Got: ${JSON.stringify(rawClient)}.`,
      );
    }
    clientName = rawClient;
    if (rawClientVersion && rawClientVersion.length > 0) {
      if (!CLIENT_VERSION_PATTERN.test(rawClientVersion)) {
        throw new ConfigError(
          `IFLOW_MCP_CLIENT_VERSION must match [A-Za-z0-9._+-]{1,64}. Got: ${JSON.stringify(rawClientVersion)}.`,
        );
      }
      clientVersion = rawClientVersion;
    }
  } else if (rawClientVersion && rawClientVersion.length > 0) {
    throw new ConfigError(
      "IFLOW_MCP_CLIENT_VERSION was set without IFLOW_MCP_CLIENT. Set IFLOW_MCP_CLIENT first (e.g. 'hermes', 'claude-code', 'claude-desktop').",
    );
  }

  return { apiKey, baseUrl, timeoutMs, clientName, clientVersion };
}
