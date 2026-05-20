/**
 * iflow_web_search MCP tool.
 *
 * Thin pass-through to IFlowSearchClient.webSearch — search-core owns query/
 * count validation and produces IFlowError on any rejection. Tool name and
 * description mirror @iflow-ai/search-langchain so the same agent prompts
 * keep working across frameworks.
 */

import {
  WEB_SEARCH_DEFAULT_COUNT,
  WEB_SEARCH_MAX_COUNT,
  type NormalizedWebSearch,
} from "@iflow-ai/search-core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { iflowErrorToToolResult } from "../errors.js";
import type { ToolDefinition } from "./types.js";

const TOOL_NAME = "iflow_web_search";

function summarize(data: NormalizedWebSearch): string {
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

export const webSearchTool: ToolDefinition = {
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
  async handle(rawArgs, client): Promise<CallToolResult> {
    const args = (rawArgs ?? {}) as { query?: unknown; count?: unknown };
    const params: { query: string; count?: number } = {
      query: typeof args.query === "string" ? args.query : "",
    };
    if (args.count !== undefined) {
      params.count = args.count as number;
    }
    const result = await client.webSearch(params);
    if (!result.ok) {
      return iflowErrorToToolResult(result.error, TOOL_NAME);
    }
    return {
      content: [{ type: "text", text: summarize(result.data) }],
      structuredContent: {
        query: result.data.query,
        count: result.data.count,
        tookMs: result.data.tookMs,
        results: result.data.results,
      },
    };
  },
};
