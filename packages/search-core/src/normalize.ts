/**
 * Map raw iFlow API responses into framework-agnostic normalized shapes.
 *
 * Field mapping mirrors observed iFlow API responses (see openclaw plugin
 * normalize.ts header comment for the schema reference). Defensive coercion
 * keeps the LLM-facing payload predictable even when iFlow emits null or
 * unexpected types.
 */

import type {
  NormalizedImage,
  NormalizedImageSearch,
  NormalizedWebFetch,
  NormalizedWebSearch,
  NormalizedWebSearchResult,
} from "./types.js";

export interface IFlowEnvelope<T> {
  success?: boolean;
  code?: string | number;
  message?: string;
  data?: T;
}

export interface RawOrganicItem {
  title?: unknown;
  link?: unknown;
  snippet?: unknown;
  position?: unknown;
  date?: unknown;
}

export interface RawWebSearchData {
  query?: unknown;
  organic?: RawOrganicItem[] | null;
}

export interface RawImageItem {
  url?: unknown;
  title?: unknown;
  refUrl?: unknown;
  width?: unknown;
  height?: unknown;
  position?: unknown;
}

export type RawImageSearchData = RawImageItem[];

export interface RawWebFetchData {
  title?: unknown;
  content?: unknown;
  url?: unknown;
  fromCache?: unknown;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asNullableNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function normalizeWebSearch(
  raw: IFlowEnvelope<RawWebSearchData> | null | undefined,
  requestQuery: string,
  tookMs: number,
): NormalizedWebSearch {
  const data = raw?.data;
  const organic = Array.isArray(data?.organic) ? (data!.organic as RawOrganicItem[]) : [];
  const results: NormalizedWebSearchResult[] = organic
    .filter((r): r is RawOrganicItem => r !== null && typeof r === "object")
    .map((r) => ({
      title: asString(r.title),
      url: asString(r.link),
      snippet: asString(r.snippet),
      position: asNullableNumber(r.position),
      date: asNullableString(r.date),
    }));
  return {
    query: asString(data?.query, requestQuery),
    count: results.length,
    tookMs,
    results,
  };
}

export function normalizeImageSearch(
  raw: IFlowEnvelope<RawImageSearchData> | null | undefined,
  requestQuery: string,
  tookMs: number,
): NormalizedImageSearch {
  const data = raw?.data;
  const arr = Array.isArray(data) ? data : [];
  const images: NormalizedImage[] = arr
    .filter((r): r is RawImageItem => r !== null && typeof r === "object")
    .map((r) => ({
      imageUrl: asString(r.url),
      title: asNullableString(r.title),
      sourceUrl: asNullableString(r.refUrl),
      width: asNullableNumber(r.width),
      height: asNullableNumber(r.height),
      position: asNullableNumber(r.position),
    }))
    .filter((img) => img.imageUrl.length > 0);
  return {
    query: requestQuery,
    count: images.length,
    tookMs,
    images,
  };
}

export function normalizeWebFetch(
  raw: IFlowEnvelope<RawWebFetchData> | null | undefined,
  requestUrl: string,
  tookMs: number,
): NormalizedWebFetch {
  const data = raw?.data;
  const fromCache =
    typeof data?.fromCache === "boolean" ? (data!.fromCache as boolean) : null;
  return {
    url: asString(data?.url, requestUrl),
    title: asNullableString(data?.title),
    content: asString(data?.content),
    fromCache,
    tookMs,
  };
}
