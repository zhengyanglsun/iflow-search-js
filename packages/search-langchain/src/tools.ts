/**
 * LangChain JS tool factories backed by @iflow-ai/search-core.
 *
 * Each tool uses responseFormat: "content_and_artifact" — the LLM sees a
 * compact text summary; the application sees the full normalized result
 * via the ToolMessage's `.artifact` field.
 *
 * Errors from search-core (IFlowResult.ok === false) are re-thrown so the
 * agent loop sees them as tool errors.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  IMAGE_SEARCH_DEFAULT_COUNT,
  IMAGE_SEARCH_MAX_COUNT,
  WEB_SEARCH_DEFAULT_COUNT,
  WEB_SEARCH_MAX_COUNT,
  createIFlowSearchClient,
  type IFlowResult,
  type IFlowSearchClient,
  type NormalizedImageSearch,
  type NormalizedWebFetch,
  type NormalizedWebSearch,
} from "@iflow-ai/search-core";
import { INTEGRATION_NAME, SOURCE, VERSION } from "./version.js";

// ── public option shape ──────────────────────────────────────────────────────

export interface IFlowLangChainOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Inject fetch for tests. Falls back to global fetch (Node ≥18). */
  fetch?: typeof fetch;
}

// ── internal helpers ─────────────────────────────────────────────────────────

function buildClient(opts: IFlowLangChainOptions): IFlowSearchClient {
  return createIFlowSearchClient({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    timeoutMs: opts.timeoutMs,
    fetch: opts.fetch,
    source: SOURCE,
    integrationName: INTEGRATION_NAME,
    integrationVersion: VERSION,
  });
}

function unwrap<T>(result: IFlowResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

function summarizeWebSearch(data: NormalizedWebSearch): string {
  if (data.results.length === 0) {
    return `No web results for "${data.query}".`;
  }
  return data.results
    .map((r, i) => {
      const num = r.position ?? i + 1;
      const date = r.date ? ` (${r.date})` : "";
      return `${num}. ${r.title}${date}\n   ${r.url}\n   ${r.snippet}`;
    })
    .join("\n\n");
}

function summarizeImageSearch(data: NormalizedImageSearch): string {
  if (data.images.length === 0) {
    return `No image results for "${data.query}".`;
  }
  return data.images
    .map((img, i) => {
      const num = img.position ?? i + 1;
      const title = img.title ?? "(untitled)";
      const source = img.sourceUrl ? `\n   source: ${img.sourceUrl}` : "";
      return `${num}. ${title}\n   image: ${img.imageUrl}${source}`;
    })
    .join("\n\n");
}

function summarizeWebFetch(data: NormalizedWebFetch): string {
  const title = data.title ?? "(untitled)";
  const cached = data.fromCache === true ? " [cached]" : "";
  return `${title}${cached}\n${data.url}\n\n${data.content}`;
}

// ── tool factories ───────────────────────────────────────────────────────────

const webSearchSchema = z.object({
  query: z.string().min(1).describe("Search query."),
  count: z
    .number()
    .int()
    .min(1)
    .max(WEB_SEARCH_MAX_COUNT)
    .optional()
    .describe(
      `Number of results (1–${WEB_SEARCH_MAX_COUNT}, default ${WEB_SEARCH_DEFAULT_COUNT}).`,
    ),
});

const imageSearchSchema = z.object({
  query: z.string().min(1).describe("Image search query."),
  count: z
    .number()
    .int()
    .min(1)
    .max(IMAGE_SEARCH_MAX_COUNT)
    .optional()
    .describe(
      `Number of images (1–${IMAGE_SEARCH_MAX_COUNT}, default ${IMAGE_SEARCH_DEFAULT_COUNT}).`,
    ),
});

const webFetchSchema = z.object({
  url: z.string().min(1).describe("Absolute URL of the page to fetch."),
});

export function createIFlowWebSearchTool(opts: IFlowLangChainOptions) {
  const client = buildClient(opts);
  return tool(
    async ({ query, count }) => {
      const data = unwrap(await client.webSearch({ query, count }));
      return [summarizeWebSearch(data), data];
    },
    {
      name: "iflow_web_search",
      description:
        "Search the web with iFlow. Use to find current information, news, " +
        "papers, and reference pages. Returns titles, URLs, and snippets.",
      schema: webSearchSchema,
      responseFormat: "content_and_artifact",
    },
  );
}

export function createIFlowImageSearchTool(opts: IFlowLangChainOptions) {
  const client = buildClient(opts);
  return tool(
    async ({ query, count }) => {
      const data = unwrap(await client.imageSearch({ query, count }));
      return [summarizeImageSearch(data), data];
    },
    {
      name: "iflow_image_search",
      description:
        "Search images with iFlow. Returns image URLs, titles, and the " +
        "source pages they appear on.",
      schema: imageSearchSchema,
      responseFormat: "content_and_artifact",
    },
  );
}

export function createIFlowWebFetchTool(opts: IFlowLangChainOptions) {
  const client = buildClient(opts);
  return tool(
    async ({ url }) => {
      const data = unwrap(await client.webFetch({ url }));
      return [summarizeWebFetch(data), data];
    },
    {
      name: "iflow_web_fetch",
      description:
        "Fetch the readable contents of a single URL via iFlow. Use after " +
        "iflow_web_search picks a promising result and you want the full text.",
      schema: webFetchSchema,
      responseFormat: "content_and_artifact",
    },
  );
}

/**
 * Convenience: build all three tools at once.
 *
 *   const tools = createIFlowSearchTools({ apiKey });
 *   const agent = createReactAgent({ llm, tools });
 */
export function createIFlowSearchTools(opts: IFlowLangChainOptions) {
  return [
    createIFlowWebSearchTool(opts),
    createIFlowImageSearchTool(opts),
    createIFlowWebFetchTool(opts),
  ];
}
