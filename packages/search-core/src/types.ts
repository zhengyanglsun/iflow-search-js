/**
 * Public types for @iflow-ai/search-core.
 *
 * Plain objects only. No framework couplings.
 */

// ── Input parameters ─────────────────────────────────────────────────────────

export interface WebSearchParams {
  query: string;
  /** Number of results. Default 10, range 1..20. */
  count?: number;
}

export interface ImageSearchParams {
  query: string;
  count?: number;
}

export interface WebFetchParams {
  url: string;
}

// ── Normalized results ───────────────────────────────────────────────────────

export interface NormalizedWebSearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number | null;
  date: string | null;
}

export interface NormalizedWebSearch {
  query: string;
  count: number;
  tookMs: number;
  results: NormalizedWebSearchResult[];
}

export interface NormalizedImage {
  imageUrl: string;
  title: string | null;
  sourceUrl: string | null;
  width: number | null;
  height: number | null;
  position: number | null;
}

export interface NormalizedImageSearch {
  query: string;
  count: number;
  tookMs: number;
  images: NormalizedImage[];
}

export interface NormalizedWebFetch {
  url: string;
  title: string | null;
  content: string;
  fromCache: boolean | null;
  tookMs: number;
}

// ── Result envelope ──────────────────────────────────────────────────────────

import type { IFlowError } from "./errors.js";

export type IFlowResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IFlowError };

// ── Client configuration ─────────────────────────────────────────────────────

export interface IFlowSearchClientOptions {
  apiKey: string;
  /** Default https://platform.iflow.cn. Trailing slashes stripped. */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** Injectable for tests. Falls back to global fetch (Node ≥18). */
  fetch?: typeof fetch;
  /** e.g. "langchain" | "mcp" | "openclaw" | "core". Required. */
  source: string;
  /** e.g. "@iflow-ai/search-langchain". Required. */
  integrationName: string;
  /** e.g. "1.2.3". Required. */
  integrationVersion: string;
  /**
   * MCP host calling this integration. Optional. Only meaningful when
   * source === "mcp" — e.g. "hermes", "claude-code", "claude-desktop".
   * When set, emitted as the IFlow-MCP-Client header. Absence ≠ "unknown":
   * we simply do not emit the header.
   */
  clientName?: string;
  /**
   * Version of the MCP host. Optional, ignored unless clientName is set.
   * When set, emitted as the IFlow-MCP-Client-Version header.
   */
  clientVersion?: string;
}
