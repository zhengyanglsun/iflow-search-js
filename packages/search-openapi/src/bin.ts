#!/usr/bin/env node
/**
 * `iflow-search-openapi` — HTTP/OpenAPI tool server for the iFlow Search API.
 *
 * Spawned as a regular Node process; listens on PORT (default 8787) and
 * answers HTTP. Intended for Open WebUI / Coze and other OpenAPI 3.x
 * tool hosts.
 *
 * stderr is used for the startup banner and shutdown messages. The server
 * itself does not log per-request lines — platforms typically want to do
 * that in front via a reverse proxy.
 *
 * Exit codes:
 *   0 — clean shutdown after SIGINT / SIGTERM
 *   1 — configuration error or listener failure
 *
 * Attribution: source=`openapi`, integration=`@iflow-ai/search-openapi`.
 * IFLOW_OPENAPI_CLIENT is captured into `clientName` for local visibility
 * (printed in the banner) but is intentionally NOT forwarded to
 * createIFlowSearchClient — the `IFlow-MCP-Client` header is reserved for
 * MCP hosts and reusing it from a non-MCP transport would muddy analytics.
 */

import { createServer } from "node:http";
import { createIFlowSearchClient } from "@iflow-ai/search-core";
import { ConfigError, loadConfig } from "./config.js";
import { createApp } from "./server.js";
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
  });

  const app = createApp({
    client,
    authToken: config.authToken,
  });
  const httpServer = createServer(app);

  const shutdown = (signal: NodeJS.Signals): void => {
    process.stderr.write(`[${INTEGRATION_NAME}] received ${signal}, closing.\n`);
    httpServer.close((err) => {
      if (err) {
        process.stderr.write(
          `[${INTEGRATION_NAME}] error during shutdown: ${err.message}\n`,
        );
        process.exit(1);
      }
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  httpServer.on("error", (err) => {
    process.stderr.write(
      `[${INTEGRATION_NAME}] listen error: ${err.message}\n`,
    );
    process.exit(1);
  });

  httpServer.listen(config.port, () => {
    const address = httpServer.address();
    const boundPort =
      typeof address === "object" && address !== null ? address.port : config.port;
    const authNote = config.authToken
      ? "bearer auth ENABLED"
      : "bearer auth DISABLED (open mode)";
    const clientNote = config.clientName ? ` client=${config.clientName}` : "";
    process.stderr.write(
      `[${INTEGRATION_NAME}] v${VERSION} listening on http://0.0.0.0:${boundPort} — ${authNote}${clientNote}\n`,
    );
  });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[${INTEGRATION_NAME}] fatal: ${message}\n`);
  process.exit(1);
});
