/**
 * Per-route handler shape shared by the three iFlow Search tool endpoints.
 *
 * Handlers are pure functions from a parsed JSON body to an HTTP response
 * (status code + JSON body). They never throw across the HTTP boundary —
 * all iFlow errors are surfaced as normalized error bodies built from
 * the IFlowError returned by @iflow-ai/search-core.
 *
 * The inputSchema is JSON Schema, surfaced verbatim in /openapi.json as
 * the requestBody schema for each tool route.
 */

import type { IFlowSearchClient } from "@iflow-ai/search-core";

export interface ToolHandler {
  /** Path segment under /tools, e.g. "iflow_web_search". */
  name: string;
  /** Short human label used in /openapi.json summary. */
  title: string;
  /** Description shown to LLMs and tool catalogs. */
  description: string;
  /** JSON Schema for the request body. */
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  /**
   * Handle a parsed JSON request body. Returns the HTTP status and JSON
   * body to send. Implementations delegate all iFlow logic to `client`
   * and translate the IFlowResult envelope into the openapi response shape.
   */
  handle(
    rawBody: unknown,
    client: IFlowSearchClient,
  ): Promise<{ status: number; body: object }>;
}
