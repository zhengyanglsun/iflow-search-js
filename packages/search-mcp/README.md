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
        "IFLOW_API_KEY": "YOUR_IFLOW_API_KEY",
        "IFLOW_MCP_CLIENT": "claude-code"
      }
    }
  }
}
```

For Claude Desktop, the wiring is identical but set `IFLOW_MCP_CLIENT` to
`claude-desktop` so backend analytics can tell the two apart:

```json
"env": {
  "IFLOW_API_KEY": "YOUR_IFLOW_API_KEY",
  "IFLOW_MCP_CLIENT": "claude-desktop"
}
```

`IFLOW_MCP_CLIENT` is optional — see the [Configuration](#configuration)
table for the allowed value set. If absent, no `IFlow-MCP-Client` header
is sent (the request is still attributed to `IFlow-Source: mcp`).

> **Do not commit a real key.** Put `YOUR_IFLOW_API_KEY` in version control
> and inject the real value at runtime (your client's secret store, a local
> override file ignored by git, a `direnv` block, etc.). `@iflow-ai/search-mcp`
> never reads from disk and will not pick up a `.env` automatically.

### Hermes Agent

Add the server to `~/.hermes/config.yaml`:

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  iflow-search:
    command: npx
    args:
      - -y
      - "@iflow-ai/search-mcp@next"
    env:
      IFLOW_API_KEY: YOUR_IFLOW_API_KEY
      IFLOW_MCP_CLIENT: hermes
```

Verify Hermes can spawn the server and list its three tools:

```bash
hermes mcp test iflow-search
```

Notes:

- `IFLOW_API_KEY` **must** be set inside the server's `env:` block. Hermes
  only forwards a small allowlist of parent-shell variables to MCP
  subprocesses (`PATH`, `HOME`, `USER`, …); anything else, including your
  iFlow key, has to be declared here. Keep `YOUR_IFLOW_API_KEY` as a
  placeholder in anything you share — never commit the real key.
- `IFLOW_MCP_CLIENT: hermes` tags every outbound request with the
  `IFlow-MCP-Client: hermes` header so backend analytics can distinguish
  Hermes traffic from Claude Code / Claude Desktop. The field is optional
  but recommended.
- Prefer `@next` (as above) or a pinned version like
  `@iflow-ai/search-mcp@0.1.0-pre.0`. Avoid the bare `@iflow-ai/search-mcp`
  in shared configs so upgrades stay intentional.
- stdio only: Hermes runs the binary as a child process and speaks
  JSON-RPC over stdin/stdout. No `url` / `headers` fields are needed.

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
| `IFLOW_MCP_CLIENT` | no | — | Declared MCP host name (e.g. `hermes`, `claude-code`, `claude-desktop`). When set, emitted as the `IFlow-MCP-Client` header so backend analytics can distinguish hosts. Allowed: `[a-z0-9._-]{1,64}`. Absent = no header sent (we never send a placeholder like `unknown`). |
| `IFLOW_MCP_CLIENT_VERSION` | no | — | Optional version for the above host. When both are set, emitted as `IFlow-MCP-Client-Version`. Allowed: `[A-Za-z0-9._+-]{1,64}`. Ignored unless `IFLOW_MCP_CLIENT` is set. |

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

When the MCP client config sets `IFLOW_MCP_CLIENT` (and optionally
`IFLOW_MCP_CLIENT_VERSION`), the following are additionally sent:

```
IFlow-MCP-Client: hermes | claude-code | claude-desktop | ...
IFlow-MCP-Client-Version: <only if IFLOW_MCP_CLIENT_VERSION is set>
```

This lets iFlow account for traffic generated through the MCP server
separately from direct, LangChain, or other adapters, AND distinguish
which MCP host (Hermes / Claude Code / Claude Desktop / custom) generated
each request. The `IFlow-MCP-Client` value is operator-declared — it is
not auto-detected from the MCP `clientInfo` handshake, so backend
dashboards see a stable, allowlist-style set of host slugs rather than
free-form, self-reported strings.

## License

MIT. See [`LICENSE`](./LICENSE).
