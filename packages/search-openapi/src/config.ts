/**
 * Env-only configuration for the iFlow Search OpenAPI server.
 *
 *   IFLOW_API_KEY                    (required) — forwarded to search-core, sent as Authorization: Bearer ...
 *   IFLOW_BASE_URL                   (optional) — defaults to search-core's default
 *   IFLOW_TIMEOUT_MS                 (optional) — positive integer milliseconds
 *   PORT                             (optional) — listen port, defaults to 8787
 *   IFLOW_OPENAPI_AUTH_TOKEN         (optional) — if set, all routes except /health require
 *                                                  `Authorization: Bearer <token>`. Token is
 *                                                  checked with constant-time comparison.
 *   IFLOW_OPENAPI_CLIENT             (optional) — identifies the host platform (open-webui,
 *                                                  coze, ...). Allowed: [a-z0-9._-]{1,64}.
 *                                                  Not currently wired into a wire header — kept
 *                                                  for future platform attribution. Stored on
 *                                                  ResolvedConfig.clientName so server.ts and
 *                                                  tests can observe it.
 *   IFLOW_OPENAPI_CORS_ORIGIN        (optional) — when set, every response carries
 *                                                  `Access-Control-Allow-Origin: <value>` plus the
 *                                                  companion CORS headers, and `OPTIONS` requests
 *                                                  short-circuit to 204 without the bearer gate.
 *                                                  Absent ⇒ no CORS headers (current behavior).
 *                                                  Accepts `*` or `http(s)://host[:port]`; anything
 *                                                  with a path, query, fragment, or non-printable
 *                                                  char is rejected at init time to keep header
 *                                                  injection out of responses.
 *   IFLOW_OPENAPI_PUBLIC_URL         (optional) — absolute http(s) base URL injected into the
 *                                                  generated OpenAPI documents' `servers[]` block
 *                                                  for both /openapi.json and /openapi.coze.json.
 *                                                  Required when Coze imports the spec (Coze
 *                                                  resolves the server URL from the document, not
 *                                                  from the import URL). Accepts only
 *                                                  `http(s)://host[:port]` — `*`, paths, queries,
 *                                                  fragments, and non-printable chars are rejected.
 *   IFLOW_OPENAPI_OPERATION_SUFFIX   (optional) — cache-busting suffix appended to every
 *                                                  operationId (`iflow_web_search_<suffix>`, …).
 *                                                  Default unset = canonical operationIds. Useful
 *                                                  when Coze's plugin-import cache keys collide
 *                                                  with a prior version. Allowed: [a-z0-9_-]{1,32}.
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
  corsOrigin: string | undefined;
  publicUrl: string | undefined;
  operationSuffix: string | undefined;
}

export interface EnvLike {
  IFLOW_API_KEY?: string | undefined;
  IFLOW_BASE_URL?: string | undefined;
  IFLOW_TIMEOUT_MS?: string | undefined;
  PORT?: string | undefined;
  IFLOW_OPENAPI_AUTH_TOKEN?: string | undefined;
  IFLOW_OPENAPI_CLIENT?: string | undefined;
  IFLOW_OPENAPI_CORS_ORIGIN?: string | undefined;
  IFLOW_OPENAPI_PUBLIC_URL?: string | undefined;
  IFLOW_OPENAPI_OPERATION_SUFFIX?: string | undefined;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const CLIENT_NAME_PATTERN = /^[a-z0-9._-]{1,64}$/u;
// Accepts `*` or scheme://host[:port] with no path/query/fragment and no
// non-printable bytes. Capping at 253-char hostnames + scheme + port keeps
// the whole thing comfortably under 256; the pattern itself enforces shape.
const CORS_ORIGIN_PATTERN =
  /^(\*|https?:\/\/[A-Za-z0-9.-]{1,253}(?::[0-9]{1,5})?)$/u;
// Same shape as CORS minus the `*` wildcard — `servers[]` cannot be a
// wildcard. Used for IFLOW_OPENAPI_PUBLIC_URL.
const PUBLIC_URL_PATTERN =
  /^https?:\/\/[A-Za-z0-9.-]{1,253}(?::[0-9]{1,5})?$/u;
const OPERATION_SUFFIX_PATTERN = /^[a-z0-9_-]{1,32}$/u;

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

  const rawCors = env.IFLOW_OPENAPI_CORS_ORIGIN?.trim();
  let corsOrigin: string | undefined;
  if (rawCors && rawCors.length > 0) {
    if (!CORS_ORIGIN_PATTERN.test(rawCors)) {
      throw new ConfigError(
        `IFLOW_OPENAPI_CORS_ORIGIN must be "*" or "http(s)://host[:port]" with no path, query, fragment, or non-printable characters. Got: ${JSON.stringify(rawCors)}.`,
      );
    }
    corsOrigin = rawCors;
  }

  const rawPublic = env.IFLOW_OPENAPI_PUBLIC_URL?.trim();
  let publicUrl: string | undefined;
  if (rawPublic && rawPublic.length > 0) {
    if (!PUBLIC_URL_PATTERN.test(rawPublic)) {
      throw new ConfigError(
        `IFLOW_OPENAPI_PUBLIC_URL must be "http(s)://host[:port]" with no path, query, fragment, wildcard, or non-printable characters. Got: ${JSON.stringify(rawPublic)}.`,
      );
    }
    publicUrl = rawPublic;
  }

  const rawSuffix = env.IFLOW_OPENAPI_OPERATION_SUFFIX?.trim();
  let operationSuffix: string | undefined;
  if (rawSuffix && rawSuffix.length > 0) {
    if (!OPERATION_SUFFIX_PATTERN.test(rawSuffix)) {
      throw new ConfigError(
        `IFLOW_OPENAPI_OPERATION_SUFFIX must match [a-z0-9_-]{1,32}. Got: ${JSON.stringify(rawSuffix)}.`,
      );
    }
    operationSuffix = rawSuffix;
  }

  return {
    apiKey,
    baseUrl,
    timeoutMs,
    port,
    authToken,
    clientName,
    corsOrigin,
    publicUrl,
    operationSuffix,
  };
}
