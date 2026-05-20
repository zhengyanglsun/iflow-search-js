/**
 * Tool definition shape shared by the three iFlow Search MCP tools.
 *
 * The MCP `Server` class (low-level) does not auto-validate per-tool input
 * args against the input schema we advertise — but @iflow-ai/search-core
 * does its own validation (missing/invalid `query`, `count`, `url`) and
 * returns IFlowError values for any rejection. The tool handlers therefore
 * pass args straight through and let search-core do the work.
 */

import type {
  IFlowSearchClient,
} from "@iflow-ai/search-core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ToolDefinition {
  /** Identifier the LLM sees in `tools/list` — must stay stable across releases. */
  name: string;
  /** Human-readable label. */
  title: string;
  /** Agent-facing description. */
  description: string;
  /** JSON Schema advertised via `tools/list`. */
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  /**
   * Handler called from the `tools/call` dispatcher. Receives the raw
   * arguments from the MCP client and a ready-to-use search-core client.
   * Must never throw across the MCP boundary.
   */
  handle(
    rawArgs: unknown,
    client: IFlowSearchClient,
  ): Promise<CallToolResult>;
}
