/**
 * POST /tools/iflow_image_search
 *
 * Pass-through to IFlowSearchClient.imageSearch.
 */

import {
  IMAGE_SEARCH_DEFAULT_COUNT,
  IMAGE_SEARCH_MAX_COUNT,
} from "@iflow-ai/search-core";
import { iflowErrorToBody, statusForIFlowError } from "../errors.js";
import type { ToolHandler } from "./types.js";

const TOOL_NAME = "iflow_image_search";

export const imageSearchHandler: ToolHandler = {
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
  async handle(rawBody, client) {
    const body = (rawBody ?? {}) as { query?: unknown; count?: unknown };
    const params: { query: string; count?: number } = {
      query: typeof body.query === "string" ? body.query : "",
    };
    if (body.count !== undefined) {
      params.count = body.count as number;
    }
    const result = await client.imageSearch(params);
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
