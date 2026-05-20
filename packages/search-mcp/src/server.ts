/**
 * Wires the iFlow Search tools onto a low-level MCP `Server` instance.
 *
 * Why the low-level Server (not McpServer): McpServer.registerTool requires
 * zod schemas as input, which would force us to take a direct zod runtime
 * dependency. The MVP keeps runtime deps to exactly two packages
 * (@iflow-ai/search-core + @modelcontextprotocol/sdk), so we hand-roll
 * tools/list + tools/call dispatch on top of `Server.setRequestHandler`.
 *
 * Errors never throw across the MCP boundary — each tool handler returns a
 * structured CallToolResult, including isError:true for any failure produced
 * by search-core or for unexpected handler bugs.
 */

import type { IFlowSearchClient } from "@iflow-ai/search-core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { unexpectedErrorToToolResult } from "./errors.js";
import { allTools } from "./tools/index.js";
import type { ToolDefinition } from "./tools/types.js";
import { INTEGRATION_NAME } from "./version.js";

export interface BuildServerOptions {
  /** Ready-to-use search-core client (already configured with attribution headers). */
  client: IFlowSearchClient;
  /** Version reported on the MCP `serverInfo` payload — typically the search-mcp package version. */
  integrationVersion: string;
  /** Override the tool registry, primarily for tests. Defaults to the MVP three. */
  tools?: readonly ToolDefinition[];
}

export function buildServer(opts: BuildServerOptions): Server {
  const tools = opts.tools ?? allTools;
  const toolMap = new Map<string, ToolDefinition>(
    tools.map((t) => [t.name, t]),
  );

  const server = new Server(
    {
      name: INTEGRATION_NAME,
      version: opts.integrationVersion,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const tool = toolMap.get(name);
    if (!tool) {
      const result: CallToolResult = {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}. Available: ${tools.map((t) => t.name).join(", ")}.`,
          },
        ],
        structuredContent: {
          error: { code: "unknown_tool", message: `Unknown tool: ${name}` },
        },
        isError: true,
      };
      return result;
    }
    try {
      return await tool.handle(request.params.arguments, opts.client);
    } catch (err) {
      return unexpectedErrorToToolResult(err, name);
    }
  });

  return server;
}
