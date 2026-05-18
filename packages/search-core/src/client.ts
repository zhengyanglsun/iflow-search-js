/**
 * IFlowSearchClient — Bearer-authenticated POST client for iFlow Search.
 *
 *   - global fetch (Node ≥18), injectable for tests
 *   - per-request timeout via AbortController; external signal forwarded
 *   - never throws on API errors; returns IFlowResult<T>
 *   - never logs the API key
 *   - no retry, no cache (adapters add those when needed)
 */

import {
  DEFAULT_TIMEOUT_MS,
  IMAGE_SEARCH_DEFAULT_COUNT,
  IMAGE_SEARCH_MAX_COUNT,
  WEB_SEARCH_DEFAULT_COUNT,
  WEB_SEARCH_MAX_COUNT,
  normalizeBaseUrl,
} from "./config.js";
import {
  apiBusinessError,
  apiHttpError,
  invalidParamError,
  missingApiKeyError,
  missingParamError,
  networkError,
  networkTimeoutError,
  type IFlowError,
} from "./errors.js";
import { buildAttributionHeaders } from "./headers.js";
import {
  normalizeImageSearch,
  normalizeWebFetch,
  normalizeWebSearch,
  type IFlowEnvelope,
  type RawImageSearchData,
  type RawWebFetchData,
  type RawWebSearchData,
} from "./normalize.js";
import type {
  IFlowResult,
  IFlowSearchClientOptions,
  ImageSearchParams,
  NormalizedImageSearch,
  NormalizedWebFetch,
  NormalizedWebSearch,
  WebFetchParams,
  WebSearchParams,
} from "./types.js";

type FetchLike = typeof fetch;

const ENDPOINTS = {
  webSearch: "/api/search/webSearch",
  imageSearch: "/api/search/imageSearch",
  webFetch: "/api/search/webFetch",
} as const;

type EndpointKey = keyof typeof ENDPOINTS;

interface ResolvedClientConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  fetchImpl: FetchLike;
  attributionHeaders: ReturnType<typeof buildAttributionHeaders>;
}

function resolveOptions(opts: IFlowSearchClientOptions): ResolvedClientConfig {
  const fetchImpl: FetchLike = opts.fetch ?? (globalThis.fetch as FetchLike);
  if (typeof fetchImpl !== "function") {
    throw new Error(
      "IFlowSearchClient: global fetch is not available; pass `fetch` explicitly (Node <18 or non-standard runtime).",
    );
  }
  const timeoutMs =
    typeof opts.timeoutMs === "number" && Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0
      ? opts.timeoutMs
      : DEFAULT_TIMEOUT_MS;
  return {
    apiKey: typeof opts.apiKey === "string" ? opts.apiKey : "",
    baseUrl: normalizeBaseUrl(opts.baseUrl),
    timeoutMs,
    fetchImpl,
    attributionHeaders: buildAttributionHeaders({
      source: opts.source,
      integrationName: opts.integrationName,
      integrationVersion: opts.integrationVersion,
    }),
  };
}

export class IFlowSearchClient {
  private readonly config: ResolvedClientConfig;

  constructor(opts: IFlowSearchClientOptions) {
    this.config = resolveOptions(opts);
  }

  async webSearch(
    params: WebSearchParams,
    signal?: AbortSignal,
  ): Promise<IFlowResult<NormalizedWebSearch>> {
    const keyMissing = this.checkApiKey();
    if (keyMissing) return { ok: false, error: keyMissing };

    const query = (params?.query ?? "").trim();
    if (!query) return { ok: false, error: missingParamError("query") };

    const count = params.count ?? WEB_SEARCH_DEFAULT_COUNT;
    const countError = validateCount(count, WEB_SEARCH_MAX_COUNT);
    if (countError) return { ok: false, error: countError };

    const started = Date.now();
    const httpResult = await this.call<IFlowEnvelope<RawWebSearchData>>(
      "webSearch",
      { keywords: query, num: count },
      signal,
    );
    if (!httpResult.ok) return httpResult;
    return {
      ok: true,
      data: normalizeWebSearch(httpResult.data, query, Date.now() - started),
    };
  }

  async imageSearch(
    params: ImageSearchParams,
    signal?: AbortSignal,
  ): Promise<IFlowResult<NormalizedImageSearch>> {
    const keyMissing = this.checkApiKey();
    if (keyMissing) return { ok: false, error: keyMissing };

    const query = (params?.query ?? "").trim();
    if (!query) return { ok: false, error: missingParamError("query") };

    const count = params.count ?? IMAGE_SEARCH_DEFAULT_COUNT;
    const countError = validateCount(count, IMAGE_SEARCH_MAX_COUNT);
    if (countError) return { ok: false, error: countError };

    const started = Date.now();
    const httpResult = await this.call<IFlowEnvelope<RawImageSearchData>>(
      "imageSearch",
      { keywords: query, num: count },
      signal,
    );
    if (!httpResult.ok) return httpResult;
    return {
      ok: true,
      data: normalizeImageSearch(httpResult.data, query, Date.now() - started),
    };
  }

  async webFetch(
    params: WebFetchParams,
    signal?: AbortSignal,
  ): Promise<IFlowResult<NormalizedWebFetch>> {
    const keyMissing = this.checkApiKey();
    if (keyMissing) return { ok: false, error: keyMissing };

    const url = (params?.url ?? "").trim();
    if (!url) return { ok: false, error: missingParamError("url") };

    const started = Date.now();
    const httpResult = await this.call<IFlowEnvelope<RawWebFetchData>>(
      "webFetch",
      { url },
      signal,
    );
    if (!httpResult.ok) return httpResult;
    return {
      ok: true,
      data: normalizeWebFetch(httpResult.data, url, Date.now() - started),
    };
  }

  private checkApiKey(): IFlowError | null {
    return this.config.apiKey ? null : missingApiKeyError();
  }

  private async call<T>(
    endpoint: EndpointKey,
    body: Record<string, unknown>,
    externalSignal: AbortSignal | undefined,
  ): Promise<IFlowResult<T>> {
    const { baseUrl, timeoutMs, fetchImpl, apiKey, attributionHeaders } = this.config;
    const url = `${baseUrl}${ENDPOINTS[endpoint]}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          ...attributionHeaders,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const e = err as Error;
      if (e?.name === "AbortError") {
        return { ok: false, error: networkTimeoutError(timeoutMs) };
      }
      return { ok: false, error: networkError(e?.message ?? String(err)) };
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 500);
      } catch {
        // ignore
      }
      return { ok: false, error: apiHttpError(response.status, detail || response.statusText) };
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return {
        ok: false,
        error: {
          code: "api_error",
          message: "iFlow returned a non-JSON response.",
          status: response.status,
        },
      };
    }

    const envelope = parsed as IFlowEnvelope<unknown>;
    if (envelope?.success !== true) {
      const dataObj =
        envelope?.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
          ? (envelope.data as { errorMsg?: string | null; errorCode?: string | number | null })
          : undefined;
      return {
        ok: false,
        error: apiBusinessError({
          code: envelope?.code ?? null,
          message: envelope?.message ?? null,
          errorMsg: dataObj?.errorMsg ?? null,
          errorCode: dataObj?.errorCode ?? null,
        }),
      };
    }

    return { ok: true, data: parsed as T };
  }
}

function validateCount(count: unknown, max: number): IFlowError | null {
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return invalidParamError("count", "must be a finite number");
  }
  if (!Number.isInteger(count)) {
    return invalidParamError("count", "must be an integer");
  }
  if (count < 1) {
    return invalidParamError("count", "must be ≥ 1");
  }
  if (count > max) {
    return invalidParamError("count", `must be ≤ ${max}`);
  }
  return null;
}

export function createIFlowSearchClient(opts: IFlowSearchClientOptions): IFlowSearchClient {
  return new IFlowSearchClient(opts);
}
