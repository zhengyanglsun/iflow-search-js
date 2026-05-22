/**
 * Env-only configuration for the iFlow Search OpenAPI server.
 *
 *   IFLOW_API_KEY              (required) — forwarded to search-core, sent as Authorization: Bearer ...
 *   IFLOW_BASE_URL             (optional) — defaults to search-core's default
 *   IFLOW_TIMEOUT_MS           (optional) — positive integer milliseconds
 *   PORT                       (optional) — listen port, defaults to 8787
 *   IFLOW_OPENAPI_AUTH_TOKEN   (optional) — if set, all routes except /health require
 *                                            `Authorization: Bearer <token>`. Token is
 *                                            checked with constant-time comparison.
 *   IFLOW_OPENAPI_CLIENT       (optional) — identifies the host platform (open-webui,
 *                                            coze, ...). Allowed: [a-z0-9._-]{1,64}.
 *                                            Not currently wired into a wire header — kept
 *                                            for future platform attribution. Stored on
 *                                            ResolvedConfig.clientName so server.ts and
 *                                            tests can observe it.
 *
 * Errors thrown here are init-time fatal: bin.ts prints them to stderr
 * and exits non-zero BEFORE the HTTP listener is wired up.
 */

export const DEFAULT_PORT = 8787;

export interface ResolvedConfig {
  apiKey: string;
  baseUrl: string | undefined;
  timeoutMs: number | undefined;
  port: number;
  authToken: string | undefined;
  clientName: string | undefined;
}

export interface EnvLike {
  IFLOW_API_KEY?: string | undefined;
  IFLOW_BASE_URL?: string | undefined;
  IFLOW_TIMEOUT_MS?: string | undefined;
  PORT?: string | undefined;
  IFLOW_OPENAPI_AUTH_TOKEN?: string | undefined;
  IFLOW_OPENAPI_CLIENT?: string | undefined;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const CLIENT_NAME_PATTERN = /^[a-z0-9._-]{1,64}$/u;

export function loadConfig(env: EnvLike = process.env): ResolvedConfig {
  const apiKey = (env.IFLOW_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new ConfigError(
      "IFLOW_API_KEY is required. Set it in your environment, e.g. " +
        "IFLOW_API_KEY=YOUR_IFLOW_API_KEY. Never commit the real key.",
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

  const rawPort = env.PORT?.trim();
  let port = DEFAULT_PORT;
  if (rawPort && rawPort.length > 0) {
    const parsed = Number(rawPort);
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < 0 ||
      parsed > 65535
    ) {
      throw new ConfigError(
        `PORT must be an integer in [0, 65535]. Got: ${JSON.stringify(rawPort)}.`,
      );
    }
    port = parsed;
  }

  const rawToken = env.IFLOW_OPENAPI_AUTH_TOKEN?.trim();
  const authToken = rawToken && rawToken.length > 0 ? rawToken : undefined;

  const rawClient = env.IFLOW_OPENAPI_CLIENT?.trim();
  let clientName: string | undefined;
  if (rawClient && rawClient.length > 0) {
    if (!CLIENT_NAME_PATTERN.test(rawClient)) {
      throw new ConfigError(
        `IFLOW_OPENAPI_CLIENT must match [a-z0-9._-]{1,64}. Got: ${JSON.stringify(rawClient)}.`,
      );
    }
    clientName = rawClient;
  }

  return { apiKey, baseUrl, timeoutMs, port, authToken, clientName };
}
