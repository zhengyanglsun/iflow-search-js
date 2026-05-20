#!/usr/bin/env node
/**
 * Local stdio smoke harness for @iflow-ai/search-mcp.
 *
 * Spawns the compiled `iflow-search-mcp` binary as a child process and
 * drives it via the official MCP StdioClientTransport. No real iFlow
 * credentials are needed — the harness stands up a 127.0.0.1 HTTP server
 * that pretends to be iFlow and returns canned, normalized responses.
 *
 * Verifies, in one round trip:
 *   1. tools/list returns exactly { iflow_web_search, iflow_image_search,
 *      iflow_web_fetch } in that order
 *   2. tools/call iflow_web_search produces a non-error CallToolResult
 *      with text content + structured payload
 *   3. The child sends Authorization: Bearer <env IFLOW_API_KEY> and the
 *      IFlow-Source / IFlow-Integration / IFlow-Integration-Version
 *      attribution headers
 *
 * Run with:
 *   pnpm --filter @iflow-ai/search-mcp build
 *   node packages/search-mcp/scripts/smoke-stdio.mjs
 *
 * Exits 0 on success, 1 on any assertion failure.
 */

import { createServer } from "node:http";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_PATH = resolve(__dirname, "../dist/bin.js");

if (!existsSync(BIN_PATH)) {
  console.error(
    `[smoke] ${BIN_PATH} not found. Run \`pnpm --filter @iflow-ai/search-mcp build\` first.`,
  );
  process.exit(1);
}

const FAKE_KEY = "smoke-test-key";

function assert(cond, msg) {
  if (!cond) {
    console.error(`[smoke] FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`[smoke] ok: ${msg}`);
  }
}

// ── 1. Stand up a fake iFlow HTTP server ─────────────────────────────────────

/** @type {Array<{ path: string; headers: Record<string,string>; body: any }>} */
const requests = [];

const fakeServer = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    let parsedBody = {};
    try {
      parsedBody = body ? JSON.parse(body) : {};
    } catch {
      // ignore
    }
    requests.push({
      path: req.url ?? "",
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v ?? "")]),
      ),
      body: parsedBody,
    });
    res.setHeader("content-type", "application/json");
    if ((req.url ?? "").endsWith("/api/search/webSearch")) {
      res.end(
        JSON.stringify({
          success: true,
          data: {
            organic: [
              {
                title: "Smoke result",
                link: "https://example.test/smoke",
                snippet: "smoke ok",
                position: 1,
                date: null,
              },
            ],
          },
        }),
      );
    } else if ((req.url ?? "").endsWith("/api/search/imageSearch")) {
      res.end(JSON.stringify({ success: true, data: [] }));
    } else if ((req.url ?? "").endsWith("/api/search/webFetch")) {
      res.end(
        JSON.stringify({
          success: true,
          data: {
            url: parsedBody?.url ?? "",
            title: "Smoke title",
            content: "smoke body",
            fromCache: false,
          },
        }),
      );
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, message: "unknown route" }));
    }
  });
});

await new Promise((resolveReady) => fakeServer.listen(0, "127.0.0.1", resolveReady));
const port = /** @type {{ port: number }} */ (fakeServer.address()).port;
const baseUrl = `http://127.0.0.1:${port}`;
console.log(`[smoke] fake iFlow listening on ${baseUrl}`);

// ── 2. Drive the real MCP binary over stdio ──────────────────────────────────

const SMOKE_MCP_CLIENT = "smoke-host";
const SMOKE_MCP_CLIENT_VERSION = "9.9.9-smoke";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [BIN_PATH],
  env: {
    PATH: process.env.PATH ?? "",
    IFLOW_API_KEY: FAKE_KEY,
    IFLOW_BASE_URL: baseUrl,
    IFLOW_MCP_CLIENT: SMOKE_MCP_CLIENT,
    IFLOW_MCP_CLIENT_VERSION: SMOKE_MCP_CLIENT_VERSION,
  },
  stderr: "inherit",
});

const client = new Client(
  { name: "iflow-smoke-client", version: "0.0.0" },
  { capabilities: {} },
);

let exitCode = 0;
try {
  await client.connect(transport);
  console.log("[smoke] connected to child MCP server");

  const listed = await client.listTools();
  const names = listed.tools.map((t) => t.name);
  assert(
    JSON.stringify(names) ===
      JSON.stringify(["iflow_web_search", "iflow_image_search", "iflow_web_fetch"]),
    `tools/list returns the three tools in order (got ${JSON.stringify(names)})`,
  );

  const callResult = await client.callTool({
    name: "iflow_web_search",
    arguments: { query: "smoke", count: 1 },
  });
  assert(!callResult.isError, "iflow_web_search returned without isError");
  assert(
    Array.isArray(callResult.content) && callResult.content.length > 0,
    "iflow_web_search returned content blocks",
  );
  const structured = /** @type {any} */ (callResult.structuredContent);
  assert(
    structured?.results?.[0]?.title === "Smoke result",
    "structuredContent carried the canned result row",
  );

  assert(requests.length >= 1, "fake iFlow received at least one POST");
  const last = requests[requests.length - 1];
  assert(
    last.headers["iflow-source"] === "mcp",
    `IFlow-Source header = "mcp" (got ${JSON.stringify(last.headers["iflow-source"])})`,
  );
  assert(
    last.headers["iflow-integration"] === "@iflow-ai/search-mcp",
    `IFlow-Integration header = "@iflow-ai/search-mcp" (got ${JSON.stringify(last.headers["iflow-integration"])})`,
  );
  assert(
    typeof last.headers["iflow-integration-version"] === "string" &&
      last.headers["iflow-integration-version"].length > 0,
    "IFlow-Integration-Version header is present and non-empty",
  );
  assert(
    last.headers["authorization"] === `Bearer ${FAKE_KEY}`,
    "Authorization header carries the env IFLOW_API_KEY",
  );
  assert(
    last.headers["iflow-mcp-client"] === SMOKE_MCP_CLIENT,
    `IFlow-MCP-Client header = "${SMOKE_MCP_CLIENT}" (got ${JSON.stringify(last.headers["iflow-mcp-client"])})`,
  );
  assert(
    last.headers["iflow-mcp-client-version"] === SMOKE_MCP_CLIENT_VERSION,
    `IFlow-MCP-Client-Version header = "${SMOKE_MCP_CLIENT_VERSION}" (got ${JSON.stringify(last.headers["iflow-mcp-client-version"])})`,
  );
} catch (err) {
  console.error("[smoke] unexpected error:", err);
  exitCode = 1;
} finally {
  try {
    await client.close();
  } catch {
    // ignore
  }
  fakeServer.close();
}

if (exitCode === 0) {
  console.log("[smoke] all assertions passed");
}
process.exit(exitCode);
