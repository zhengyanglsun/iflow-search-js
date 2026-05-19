# iFlow Search MCP server design

Design document for the planned `@iflow-ai/search-mcp` package. **No code yet.** This doc fixes scope, package name, transport, tool schema, configuration, and test strategy before any implementation begins. Read together with [`package-strategy.md`](./package-strategy.md) (why one MCP package, not many) and [`integration-roadmap.md`](./integration-roadmap.md) (when).

## 1. Goal

Expose iFlow Search's three primitives — web search, image search, web fetch — to any [Model Context Protocol](https://modelcontextprotocol.io/) client through a single npm-installable server. Concretely:

- One package, `@iflow-ai/search-mcp`, that any MCP client (Claude Code, Claude Desktop, Hermes Agent, future MCP-aware tooling) can wire in via the standard MCP `mcpServers` config.
- Zero new HTTP / request logic — the server is a thin MCP wrapper over `@iflow-ai/search-core`. All retries, timeouts, normalization, attribution headers, and error shaping continue to live in `search-core`.
- One published package covers the entire MCP ecosystem. There is intentionally no `search-claude-code`, `search-hermes`, etc. — see Package decision below.

What this server is **not**:

- It is not an HTTP API. It is not a hosted service. It is not a proxy that survives across requests. Each MCP client invocation spawns a fresh stdio process and tears it down.
- It does not add features to iFlow Search. If `search-core` can't do it, this server can't either.

## 2. Package decision

| Field | Value |
|---|---|
| Package name | `@iflow-ai/search-mcp` |
| Location | `packages/search-mcp/` (this monorepo) |
| Runtime deps | `@iflow-ai/search-core`, an MCP server SDK (likely `@modelcontextprotocol/sdk`), and nothing else |
| License | MIT |
| Bin | `iflow-search-mcp` (see CLI entry) |
| Initial version | `0.1.0-pre.0`, dist-tag `next` |

Packages we explicitly do **not** create as part of MCP coverage, with reasons:

- **`@iflow-ai/search-claude-code`** — Claude Code already consumes MCP servers. A Claude-Code-specific package would be a re-export bound to one client's release cycle.
- **`@iflow-ai/search-hermes`** — Hermes Agent is an MCP client. Same reasoning.
- **`@iflow-ai/search-openwebui`** — Open WebUI's first-class extension surfaces are OpenAPI and MCP. We will ship via MCP (this server) or an OpenAPI spec, not a UI-specific npm package.
- **`@iflow-ai/search-coze`** — Coze ingests OpenAPI plugins. Solved by OpenAPI in a later phase, not a Coze-specific package.

`@iflow-ai/search-mcp` is the single MCP integration point. Every MCP-speaking client gets reach via this package.

## 3. Transport scope

### MVP — stdio only

The first published version supports **only the MCP stdio transport**.

Rationale:

- Stdio is the canonical transport for local MCP clients (Claude Code, Claude Desktop). Every supported client today can speak stdio without extra plumbing.
- Configuration on the client side is one JSON block referencing `npx @iflow-ai/search-mcp@next` — no port, no URL, no certificate, no Origin check.
- No HTTP listener means no inbound auth, no CORS, no Origin validation, no deployment footprint. The attack surface is whatever the parent client process is already exposing.
- The iFlow API key never leaves the user's machine — it is read from the client-supplied env block, never from a network request to this server.

### Out of MVP scope

- **SSE / Streamable HTTP** — deferred. Adding HTTP transports forces decisions about bind host, auth (token? mTLS?), Origin allow-list, CORS, and rate limiting that don't have universally correct defaults. We will add Streamable HTTP only if a concrete remote-deployment use case lands (e.g., a hosted Hermes instance).
- **WebSocket transport** — not on the MCP spec roadmap we're targeting. Not planned.

### Forward compatibility

The implementation should keep the transport choice behind a single factory at the entry point so a future Streamable HTTP transport can be wired in without touching tool handlers. The tool handlers themselves are transport-agnostic.

## 4. Tool mapping

Three MCP tools. Names mirror `@iflow-ai/search-langchain` so users moving between the two surfaces see one stable contract.

### `iflow_web_search`

| Field | Type | Required | Notes |
|---|---|---|---|
| `query` | string | yes | Free-form search query, multilingual. |
| `count` | integer | no | Number of results requested. Server clamps to whatever `search-core` enforces. |
| `fresh` | boolean | no | If true, hints the API to prefer recent results. Pass through to `search-core` unchanged. |

Output:

- **Structured `content` blocks** carrying the normalized result list from `search-core` (`results[].title`, `url`, `snippet`, etc.) so MCP clients with structured-tool-output support can render or re-query.
- **Plain-text summary** for clients that only consume text content — a short bullet list of `(title, url)` pairs and any aggregate facet info iFlow returned.

### `iflow_image_search`

| Field | Type | Required | Notes |
|---|---|---|---|
| `query` | string | yes | Free-form image query. |
| `count` | integer | no | Same clamp behavior as web search. |

Output:

- Structured content with the image array: `imageUrl`, `title`, `source`, `width`/`height` where iFlow returns them.
- Plain-text summary listing the first N image URLs.

### `iflow_web_fetch`

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string | yes | HTTPS URL to fetch and extract. |

Output:

- Structured content: `title`, `url`, `content` (extracted body), and any extracted metadata (`author`, `publishedAt`, …) that `search-core` already normalizes.
- Plain-text rendering of the extracted content, suitable for direct LLM consumption.

### Behaviors common to all three tools

- Tool descriptions returned via `tools/list` are derived from the same source as `@iflow-ai/search-langchain` so the agent-facing instructions don't drift.
- iFlow API errors map to `isError: true` tool results with the `search-core` error code (`AUTH_FAILED`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `NETWORK_ERROR`, …) and a human-readable message. Never throw across the MCP boundary — surface the error in the tool result instead.
- Missing API key on startup is a fatal init error returned through MCP's initialization phase, with a message that names the env var to set.

## 5. Configuration

All configuration is read from process environment variables at start time. The MCP client supplies them via the `env` block of its `mcpServers` config.

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `IFLOW_API_KEY` | yes | — | Forwarded to `search-core` and sent in the outbound `Authorization: Bearer …` header. |
| `IFLOW_BASE_URL` | no | `https://platform.iflow.cn` (whatever `search-core` defaults to) | Override for self-hosted iFlow or staging. |
| `IFLOW_TIMEOUT_MS` | no | `search-core` default | Per-request timeout in milliseconds. |

What is **not** supported:

- **File-backed config.** There is no `~/.iflow-search-mcp.json`, no `.env` discovery, no keychain integration. The MCP client is the only configuration source. Keeping the key out of the filesystem is the security model.
- **CLI flags for the API key.** Not supported. Pass it via env — env vars don't show up in `ps -ef` the way command-line arguments do on most platforms.
- **Multiple keys per process.** One server instance = one iFlow account. Spawn another MCP server entry if you need a second key.

## 6. Attribution headers

Every outbound request must continue to carry the iFlow attribution headers that `@iflow-ai/search-core` already sets. The MCP server **never** touches `fetch` directly — it constructs `search-core`'s client with the right source identifiers and lets `search-core` do the work.

Required header values for `@iflow-ai/search-mcp`:

| Header | Value |
|---|---|
| `IFlow-Source` | `mcp` |
| `IFlow-Integration` | `@iflow-ai/search-mcp` |
| `IFlow-Integration-Version` | `@iflow-ai/search-mcp`'s package.json `version` |
| `User-Agent` | `@iflow-ai/search-mcp/<version>` (plus whatever `search-core` appends) |
| `Authorization` | `Bearer <IFLOW_API_KEY>`, set by `search-core` |

Implementation rule:

- The MCP server passes `{ source: "mcp", integrationName: "@iflow-ai/search-mcp", integrationVersion: <pkg.version> }` (or whichever field names `search-core` exposes) to `createIFlowSearchClient`. It does not patch or wrap `fetch`.
- If `search-core` ever changes the source-id contract (e.g., enforces an enum), this server must follow — never silently override the headers from the MCP side.

This mirrors how `@iflow-ai/search-langchain` already sets `IFlow-Source: mcp`'s sibling value `IFlow-Source: langchain` — verified end-to-end against the real iFlow API in the existing smoke runs.

## 7. CLI entry

The package ships a single bin: `iflow-search-mcp`.

### Usage

```bash
# One-off, no install:
IFLOW_API_KEY=YOUR_IFLOW_API_KEY npx -y @iflow-ai/search-mcp@next

# After local install:
npm install -g @iflow-ai/search-mcp@next
IFLOW_API_KEY=YOUR_IFLOW_API_KEY iflow-search-mcp
```

> ⚠️ Replace `YOUR_IFLOW_API_KEY` with your real key. Never paste a real key into documentation, a shell script, a `.env` that gets committed, or this README. The real key only lives in your MCP client's `env` block.

### Behavior

- Reads env, validates `IFLOW_API_KEY` is present, fails fast with a clear message if not.
- Speaks MCP stdio on stdin/stdout. Logs to stderr only (stdout is reserved for MCP frames).
- Exits cleanly on SIGINT / SIGTERM / EOF on stdin.
- No interactive prompts. No TTY assumptions. No colored output to stdout.

## 8. Claude Code / Claude Desktop config example

Target wiring (post-implementation). This is **not yet usable** — `@iflow-ai/search-mcp` does not exist on npm at the time of writing.

```json
{
  "mcpServers": {
    "iflow-search": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@iflow-ai/search-mcp@next"],
      "env": {
        "IFLOW_API_KEY": "YOUR_IFLOW_API_KEY"
      }
    }
  }
}
```

- **Claude Desktop**: paste into `claude_desktop_config.json` (location varies by OS — see Anthropic's Claude Desktop MCP docs).
- **Claude Code**: paste into a project-level `.mcp.json` or use `claude mcp add` per the [Claude Code MCP docs](https://docs.anthropic.com/en/docs/claude-code/mcp). A project-level `.mcp.json` is the recommended sharable form.
- **Hermes Agent**: refer to Hermes' MCP client config. The same stdio command + env block is the input; the wrapping schema differs slightly.

`YOUR_IFLOW_API_KEY` is a placeholder. **Do not commit a real key into `.mcp.json` if the file is checked into a repo.** Use Claude Code's per-user override (`claude mcp add`) or scope the `.mcp.json` to your local checkout via `.gitignore` if the team policy is to keep keys out of VCS.

## 9. Test strategy

### Unit tests (`vitest`, alongside the other packages)

- **Tool schema** — `tools/list` returns exactly three entries with the names, descriptions, and JSON schemas locked above. Renames are detected as breaking.
- **Argument validation** — invalid inputs (missing `query`, non-HTTPS `url`, negative `count`) return MCP tool errors rather than crashing.
- **`search-core` integration** — assert that `iflow_web_search` calls `client.webSearch(...)` with the right args; same for image and fetch. Inject a mocked `search-core` client so no real HTTP happens.
- **Attribution headers** — wire a fake `fetch` into `search-core` and assert outbound headers exactly match Section 6 for all three tools.
- **Missing key startup error** — instantiating the server without `IFLOW_API_KEY` produces a clear init-time failure naming the env var.
- **iFlow API error mapping** — simulate 401 / 429 / 5xx / network failure from the fake fetch and assert each maps to a non-throwing MCP tool result with the expected error code.
- **No stdout pollution** — server emits MCP frames only on stdout; all diagnostic output goes to stderr. (Catches accidental `console.log`.)

### Integration smoke

- **External `npm install` smoke**: in `/tmp/iflow-mcp-smoke`, `npm install @iflow-ai/search-mcp@next` from a clean directory, confirm peer deps resolve and the `iflow-search-mcp` bin is on PATH.
- **MCP protocol smoke**: spawn the server via stdio and run the three tools using either the official MCP TypeScript client SDK or a minimal scripted client. Mock `fetch` at this level (still no real API calls) to verify the full MCP framing works end-to-end.
- **Real-API smoke** (opt-in, maintainer-only): same harness, but `recordingFetch` calls the real iFlow API. Reads `IFLOW_API_KEY` only from the shell environment (`read -rs` or pre-`export`). Never write the key to disk, never echo it, never commit it.

### Cross-client smoke (manual, pre-publish)

Before promoting any version to `latest` (not the `next` releases), the server must be wired into **at least two** real MCP clients (Claude Code and Claude Desktop is the recommended pair) and exercise each tool once. Document the run in `docs/release-policy.md`'s pre-publish checklist when stable releases begin.

## 10. Release strategy

Aligns with the existing [`release-policy.md`](./release-policy.md). MCP-specific notes:

- **Initial version**: `0.1.0-pre.0`, published with `--access public --tag next`. Never promoted to `latest` automatically.
- **`search-core` dependency**: pin the same concrete version `search-langchain` is already pinning (today `0.1.0-pre.0`). `search-core` must be on npm before `search-mcp` publishes — same ordering rule as `search-langchain`.
- **`search-langchain` is unaffected**. Adding `search-mcp` does not require a `search-langchain` release.
- **CI gate**: the existing `.github/workflows/ci.yml` covers the new package as long as the pnpm workspace recursion picks it up. No new workflow.
- **Publish command** (manual, maintainer only):

  ```bash
  pnpm --filter @iflow-ai/search-mcp publish --access public --tag next
  ```

- **Promotion to `latest`** happens only after Phase 5 of the integration roadmap, with the cross-client smoke from Section 9 documented in the release PR.

## 11. Open questions

These need to be resolved before — or early during — implementation. None of them block writing this design.

1. **Streamable HTTP timeline.** Do we anticipate any remote-deployed MCP consumer in the next two releases? If yes, factor the transport boundary now even though MVP ships stdio only. If no, defer the abstraction.
2. **Hermes Agent config format.** Confirm the exact `mcpServers` schema Hermes consumes — the example in Section 8 is Anthropic-shaped and may need a per-client variant in the README.
3. **`.mcp.json` example shipping form.** Should `examples/mcp-claude-code/.mcp.json` exist as a copy-paste-ready file? If yes, it must contain only `YOUR_IFLOW_API_KEY` placeholders, and the example directory needs a README warning against committing real keys.
4. **Open WebUI / Coze path.** Section 2 declares OpenAPI as the integration path for these clients. Open question: do we author the OpenAPI spec inside this repo (e.g., `docs/openapi.yaml` generated from `search-core` types), or in a separate documentation repo?
5. **Separate OpenAPI schema.** Related: should `search-core` expose its request/response shapes as a publishable OpenAPI document, or is this only relevant when Phase 4 (Open WebUI / Coze) starts?
6. **MCP SDK choice.** Confirm `@modelcontextprotocol/sdk` is the right runtime dep — check current spec compliance, license, and bundle size. If it's heavy, consider implementing the MCP framing inline against the spec.
7. **Tool description text.** The agent-facing descriptions live in `@iflow-ai/search-langchain` today. Extract them into `@iflow-ai/search-core` (or a small shared util) so MCP and LangChain stay in sync, or accept some duplication?
8. **Structured tool output gating.** Some MCP clients still ignore structured `content` and only show text. Decide whether the text summary should be a faithful render of the structured payload or a shorter human-friendly variant. (Recommendation: faithful render. Hidden text-only divergence is hard to diagnose later.)
