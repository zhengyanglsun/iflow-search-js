/**
 * iflow_web_fetch MCP tool.
 *
 * Pass-through to IFlowSearchClient.webFetch. Tool name and description
 * mirror @iflow-ai/search-langchain.
 */

import type { NormalizedWebFetch } from "@iflow-ai/search-core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { iflowErrorToToolResult } from "../errors.js";
import type { ToolDefinition } from "./types.js";

const TOOL_NAME = "iflow_web_fetch";

function summarize(data: NormalizedWebFetch): string {
  const title = data.title ?? "(untitled)";
  const cached = data.fromCache === true ? " [cached]" : "";
  return `${title}${cached}\n${data.url}\n\n${data.content}`;
}

export const webFetchTool: ToolDefinition = {
  name: TOOL_NAME,
  title: "iFlow Web Fetch",
  description:
    "Fetch the readable contents of a single URL via iFlow. Use after " +
    "iflow_web_search picks a promising result and you want the full text.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        minLength: 1,
        description: "Absolute URL of the page to fetch.",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
  async handle(rawArgs, client): Promise<CallToolResult> {
    const args = (rawArgs ?? {}) as { url?: unknown };
    const url = typeof args.url === "string" ? args.url : "";
    const result = await client.webFetch({ url });
    if (!result.ok) {
      return iflowErrorToToolResult(result.error, TOOL_NAME);
    }
    return {
      content: [{ type: "text", text: summarize(result.data) }],
      structuredContent: {
        url: result.data.url,
        title: result.data.title,
        content: result.data.content,
        fromCache: result.data.fromCache,
        tookMs: result.data.tookMs,
      },
    };
  },
};
