# @iflow-ai/search-mcp

> MCP (Model Context Protocol) server for [iFlow Search](https://platform.iflow.cn) — exposes web search, image search, and web fetch to any MCP client (Claude Code, Claude Desktop, and other compatible hosts).

Built on [`@iflow-ai/search-core`](../search-core). Same three tools as
[`@iflow-ai/search-langchain`](../search-langchain), same names, same shapes —
so prompts that drive an iFlow-search-tool agent under LangChain keep working
verbatim under MCP.

## Status — MVP (`0.1.0-pre.0`)

- **Transport:** stdio only. No SSE, no streamable HTTP, no WebSocket in this
  release.
- **Tools:** `iflow_web_search`, `iflow_image_search`, `iflow_web_fetch`.
- **Configuration:** environment variables only, supplied via the MCP
  client's `env` block (never via CLI flags, dotfiles, keychain, or file
  discovery).

## Install

```bash
pnpm add @iflow-ai/search-mcp
# or
npm install @iflow-ai/search-mcp
```

Node ≥ 18.

## Use it from an MCP client

### Claude Code / Claude Desktop / generic `mcpServers` JSON

Add an entry to your client's `mcpServers` configuration:

```json
{
  "mcpServers": {
    "iflow-search": {
      "command": "npx",
      "args": ["-y", "@iflow-ai/search-mcp"],
      "env": {
        "IFLOW_API_KEY": "YOUR_IFLOW_API_KEY"
      }
    }
  }
}
```

> **Do not commit a real key.** Put `YOUR_IFLOW_API_KEY` in version control
> and inject the real value at runtime (your client's secret store, a local
> override file ignored by git, a `direnv` block, etc.). `@iflow-ai/search-mcp`
> never reads from disk and will not pick up a `.env` automatically.

After your client restarts, the three tools appear automatically:

| Tool | What it does |
|------|--------------|
| `iflow_web_search` | Search the web with iFlow. Returns titles, URLs, snippets. |
| `iflow_image_search` | Search images. Returns image URLs, titles, source pages. |
| `iflow_web_fetch` | Fetch the readable contents of a single URL. |

## Configuration

All configuration is read from `process.env`. Set these inside the `env`
block of the MCP client config above.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `IFLOW_API_KEY` | yes | — | Bearer token sent to iFlow as `Authorization: Bearer ...`. |
| `IFLOW_BASE_URL` | no | `https://platform.iflow.cn` | Override for testing / private deployments. |
| `IFLOW_TIMEOUT_MS` | no | `30000` | Per-request timeout. Must be a positive integer if set. |

A missing or invalid configuration is a fatal init error: the process
writes a one-line diagnostic to **stderr** (never stdout, so the JSON-RPC
stream is not corrupted) and exits with code `1`.

## Programmatic API

If you want to embed the server in your own host (custom transport, tests,
…), the package also exports the building blocks:

```ts
import { createIFlowSearchClient } from "@iflow-ai/search-core";
import { buildServer } from "@iflow-ai/search-mcp";

const client = createIFlowSearchClient({
  apiKey: process.env.IFLOW_API_KEY!,
  source: "mcp",
  integrationName: "@iflow-ai/search-mcp",
  integrationVersion: "0.1.0-pre.0",
});

const server = buildServer({ client, integrationVersion: "0.1.0-pre.0" });
// connect `server` to any Transport from @modelcontextprotocol/sdk
```

## What this package does NOT do

The MVP is deliberately small. The following are explicit non-goals for
this release:

- No HTTP / SSE / WebSocket transport — stdio only.
- No file-based config, no `.env` auto-discovery, no keychain integration.
- No multi-tenant hosting, no API-key proxying, no per-call key override.
- No bundled prompts or resources — only the three search tools.

## Attribution

Every outbound request to iFlow carries:

```
IFlow-Source: mcp
IFlow-Integration: @iflow-ai/search-mcp
IFlow-Integration-Version: <pkg version>
User-Agent: @iflow-ai/search-mcp/<pkg version>
```

This lets iFlow account for traffic generated through the MCP server
separately from direct, LangChain, or other adapters.

## License

MIT. See [`LICENSE`](./LICENSE).
