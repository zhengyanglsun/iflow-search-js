/**
 * @iflow-ai/search-core — framework-agnostic SDK for the iFlow Search API.
 *
 * See README.md for usage.
 */

export {
  IFlowSearchClient,
  createIFlowSearchClient,
} from "./client.js";

export {
  buildAttributionHeaders,
  type AttributionHeaders,
  type AttributionInput,
} from "./headers.js";

export {
  isIFlowError,
  type IFlowError,
  type IFlowErrorCode,
} from "./errors.js";

export {
  normalizeImageSearch,
  normalizeWebFetch,
  normalizeWebSearch,
  type IFlowEnvelope,
} from "./normalize.js";

export {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  ENV_API_KEY,
  IMAGE_SEARCH_DEFAULT_COUNT,
  IMAGE_SEARCH_MAX_COUNT,
  WEB_SEARCH_DEFAULT_COUNT,
  WEB_SEARCH_MAX_COUNT,
  redactApiKey,
} from "./config.js";

export type {
  IFlowResult,
  IFlowSearchClientOptions,
  ImageSearchParams,
  NormalizedImage,
  NormalizedImageSearch,
  NormalizedWebFetch,
  NormalizedWebSearch,
  NormalizedWebSearchResult,
  WebFetchParams,
  WebSearchParams,
} from "./types.js";
