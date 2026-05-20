#!/usr/bin/env node
/**
 * `iflow-search-mcp` — stdio MCP server for the iFlow Search API.
 *
 * stdio is the only transport in the MVP. The MCP client (Claude Code,
 * Claude Desktop, Hermes Agent, …) spawns this binary, JSON-RPC over
 * stdio, and supplies configuration via the `env` block of mcpServers.
 *
 * stdout MUST be reserved for the JSON-RPC stream. All human-facing
 * messages (banner, startup errors, fatal errors) go to stderr. We never
 * call `console.log` here.
 *
 * Exit codes:
 *   0  — clean shutdown (SIGINT/SIGTERM after a successful init)
 *   1  — configuration or transport error before serving
 */

import { createIFlowSearchClient } from "@iflow-ai/search-core";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigError, loadConfig } from "./config.js";
import { buildServer } from "./server.js";
import { INTEGRATION_NAME, SOURCE, VERSION } from "./version.js";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`[${INTEGRATION_NAME}] ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const client = createIFlowSearchClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    source: SOURCE,
    integrationName: INTEGRATION_NAME,
    integrationVersion: VERSION,
    clientName: config.clientName,
    clientVersion: config.clientVersion,
  });

  const server = buildServer({ client, integrationVersion: VERSION });
  const transport = new StdioServerTransport();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    process.stderr.write(`[${INTEGRATION_NAME}] received ${signal}, closing.\n`);
    try {
      await server.close();
    } catch (err) {
      process.stderr.write(
        `[${INTEGRATION_NAME}] error during shutdown: ${(err as Error).message ?? err}\n`,
      );
    }
    process.exit(0);
  };
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await server.connect(transport);
  process.stderr.write(
    `[${INTEGRATION_NAME}] v${VERSION} ready on stdio.\n`,
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[${INTEGRATION_NAME}] fatal: ${message}\n`);
  process.exit(1);
});
