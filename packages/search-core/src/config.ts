/**
 * Defaults and the env-var name for the iFlow API key. Adapters that want
 * the env fallback can read it themselves — the core client requires an
 * explicit apiKey to avoid surprising production behavior.
 */

export const DEFAULT_BASE_URL = "https://platform.iflow.cn";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const ENV_API_KEY = "IFLOW_API_KEY";

export const WEB_SEARCH_MAX_COUNT = 20;
export const WEB_SEARCH_DEFAULT_COUNT = 10;
export const IMAGE_SEARCH_MAX_COUNT = 20;
export const IMAGE_SEARCH_DEFAULT_COUNT = 10;

/** Strip trailing slashes so concatenating "/api/..." never double-slashes. */
export function normalizeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? DEFAULT_BASE_URL).trim();
  if (!value) return DEFAULT_BASE_URL;
  return value.replace(/\/+$/u, "") || DEFAULT_BASE_URL;
}

/** Mask an API key for logs. Adapters should use this; core never logs keys. */
export function redactApiKey(key: string | undefined): string {
  if (!key) return "<unset>";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}***${key.slice(-2)}`;
}
