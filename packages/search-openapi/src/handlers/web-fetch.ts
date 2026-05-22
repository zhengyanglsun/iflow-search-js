/**
 * POST /tools/iflow_web_fetch
 *
 * Pass-through to IFlowSearchClient.webFetch.
 */

import { iflowErrorToBody, statusForIFlowError } from "../errors.js";
import type { ToolHandler } from "./types.js";

const TOOL_NAME = "iflow_web_fetch";

export const webFetchHandler: ToolHandler = {
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
  async handle(rawBody, client) {
    const body = (rawBody ?? {}) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url : "";
    const result = await client.webFetch({ url });
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
