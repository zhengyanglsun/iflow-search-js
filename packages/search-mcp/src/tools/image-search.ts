/**
 * iflow_image_search MCP tool.
 *
 * Pass-through to IFlowSearchClient.imageSearch. Tool name and description
 * mirror @iflow-ai/search-langchain.
 */

import {
  IMAGE_SEARCH_DEFAULT_COUNT,
  IMAGE_SEARCH_MAX_COUNT,
  type NormalizedImageSearch,
} from "@iflow-ai/search-core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { iflowErrorToToolResult } from "../errors.js";
import type { ToolDefinition } from "./types.js";

const TOOL_NAME = "iflow_image_search";

function summarize(data: NormalizedImageSearch): string {
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

export const imageSearchTool: ToolDefinition = {
  name: TOOL_NAME,
  title: "iFlow Image Search",
  description:
    "Search images with iFlow. Returns image URLs, titles, and the " +
    "source pages they appear on.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        minLength: 1,
        description: "Image search query.",
      },
      count: {
        type: "integer",
        minimum: 1,
        maximum: IMAGE_SEARCH_MAX_COUNT,
        description: `Number of images (1–${IMAGE_SEARCH_MAX_COUNT}, default ${IMAGE_SEARCH_DEFAULT_COUNT}).`,
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
    const result = await client.imageSearch(params);
    if (!result.ok) {
      return iflowErrorToToolResult(result.error, TOOL_NAME);
    }
    return {
      content: [{ type: "text", text: summarize(result.data) }],
      structuredContent: {
        query: result.data.query,
        count: result.data.count,
        tookMs: result.data.tookMs,
        images: result.data.images,
      },
    };
  },
};
