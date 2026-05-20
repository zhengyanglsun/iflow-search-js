/**
 * Env-only configuration for the iFlow Search MCP server.
 *
 *   IFLOW_API_KEY     (required) — forwarded to search-core, sent as Authorization: Bearer ...
 *   IFLOW_BASE_URL    (optional) — defaults to search-core's default (https://platform.iflow.cn)
 *   IFLOW_TIMEOUT_MS  (optional) — must be a positive finite integer if provided
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
}

export interface EnvLike {
  IFLOW_API_KEY?: string | undefined;
  IFLOW_BASE_URL?: string | undefined;
  IFLOW_TIMEOUT_MS?: string | undefined;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

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

  return { apiKey, baseUrl, timeoutMs };
}
