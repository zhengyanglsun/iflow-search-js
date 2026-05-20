/**
 * Map @iflow-ai/search-core IFlowError values into MCP tool results with
 * `isError: true`. The server never throws across the MCP boundary — every
 * iFlow-side failure becomes a structured tool result the client can render.
 *
 * No new error-shaping logic lives here; search-core already produces
 * stable codes and messages.
 */

import type { IFlowError } from "@iflow-ai/search-core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function iflowErrorToToolResult(
  error: IFlowError,
  toolName: string,
): CallToolResult {
  const text = `${toolName} failed: [${error.code}] ${error.message}`;
  const structured: Record<string, unknown> = {
    tool: toolName,
    error: {
      code: error.code,
      message: error.message,
    },
  };
  if (typeof error.status === "number") {
    (structured.error as Record<string, unknown>).status = error.status;
  }
  if (error.detail !== undefined) {
    (structured.error as Record<string, unknown>).detail = error.detail;
  }
  return {
    content: [{ type: "text", text }],
    structuredContent: structured,
    isError: true,
  };
}

/**
 * Generic catch-all for unexpected exceptions inside a tool handler. We do
 * not want bugs in our own code to bring the server down across the MCP
 * boundary; surface them as isError results instead.
 */
export function unexpectedErrorToToolResult(
  err: unknown,
  toolName: string,
): CallToolResult {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "unknown error";
  return {
    content: [
      {
        type: "text",
        text: `${toolName} failed unexpectedly: ${message}`,
      },
    ],
    structuredContent: {
      tool: toolName,
      error: { code: "internal_error", message },
    },
    isError: true,
  };
}
