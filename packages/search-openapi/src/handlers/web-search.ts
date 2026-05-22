/**
 * POST /tools/iflow_web_search
 *
 * Thin pass-through to IFlowSearchClient.webSearch. search-core owns
 * query / count validation and produces IFlowError on any rejection;
 * this module just translates the envelope into the HTTP response shape.
 */

import {
  WEB_SEARCH_DEFAULT_COUNT,
  WEB_SEARCH_MAX_COUNT,
} from "@iflow-ai/search-core";
import { iflowErrorToBody, statusForIFlowError } from "../errors.js";
import type { ToolHandler } from "./types.js";

const TOOL_NAME = "iflow_web_search";

export const webSearchHandler: ToolHandler = {
  name: TOOL_NAME,
  title: "iFlow Web Search",
  description:
    "Search the web with iFlow. Use to find current information, news, " +
    "papers, and reference pages. Returns titles, URLs, and snippets.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        minLength: 1,
        description: "Search query.",
      },
      count: {
        type: "integer",
        minimum: 1,
        maximum: WEB_SEARCH_MAX_COUNT,
        description: `Number of results (1–${WEB_SEARCH_MAX_COUNT}, default ${WEB_SEARCH_DEFAULT_COUNT}).`,
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async handle(rawBody, client) {
    const body = (rawBody ?? {}) as { query?: unknown; count?: unknown };
    const params: { query: string; count?: number } = {
      query: typeof body.query === "string" ? body.query : "",
    };
    if (body.count !== undefined) {
      params.count = body.count as number;
    }
    const result = await client.webSearch(params);
    if (!result.ok) {
      return {
        status: statusForIFlowError(result.error),
        body: iflowErrorToBody(result.error),
      };
    }
    return {
      status: 200,
      body: { ok: true, data: result.data },
    };
  },
};
