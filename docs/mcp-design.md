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

## 2. MVP decisions (locked)

Everything in the table below is **locked** for the MVP. Detailed rationale lives in the referenced sections; this table is the at-a-glance summary so future readers don't have to scan the whole document. If a decision here ever needs to change, update this table first and the downstream sections second.

| Topic | Decision |
|---|---|
| Package name | `@iflow-ai/search-mcp` |
| Package location | `packages/search-mcp/` in this monorepo |
| License | MIT |
| Binary name | `iflow-search-mcp` — see §7 |
| MCP SDK | `@modelcontextprotocol/sdk` (the official TypeScript reference SDK) |
| Transport scope (MVP) | **stdio only** — see §3 |
| Config source | Process environment variables only — no file config, no CLI flags for secrets — see §5 |
| Required env | `IFLOW_API_KEY` |
| Optional env | `IFLOW_BASE_URL`, `IFLOW_TIMEOUT_MS` |
| Attribution `IFlow-Source` | `mcp` — see §6 |
| Attribution `IFlow-Integration` | `@iflow-ai/search-mcp` |
| Tool names | `iflow_web_search`, `iflow_image_search`, `iflow_web_fetch` — see §4 |
| Initial publish target | `0.1.0-pre.0` on dist-tag `next` — see §10 |

### Runtime dependencies

| Dep | Why |
|---|---|
| `@iflow-ai/search-core` | All iFlow API request logic. The MCP server constructs its client through `createIFlowSearchClient(...)` and does not call `fetch` directly. |
| `@modelcontextprotocol/sdk` | MCP server framing, stdio transport, tool registration, error mapping. |

No other runtime deps. If `zod` is needed for tool input schemas it follows whatever version the MCP SDK already pins as a transitive — never a separately-pinned major.

### Architecture constraint — reuse `@iflow-ai/search-core`, do not reimplement

The MCP server is a **thin transport wrapper**. It must:

- Construct its iFlow client through `createIFlowSearchClient(...)` from `@iflow-ai/search-core`.
- Inherit retries, timeouts, response normalization, attribution headers, error shape, and base-URL handling from `search-core` unchanged.
- **Not** re-implement iFlow API request logic, response parsing, header construction, or error shaping. If `search-core` cannot do something the MCP server needs, the capability is added to `search-core` first and consumed here — never duplicated inside `search-mcp`.

This is the same rule that already governs `@iflow-ai/search-langchain`, which is why that package has zero `fetch` code of its own and why its attribution headers were verified end-to-end against the real iFlow API without `search-langchain` touching the network path.

### Non-goals for the MVP

Listed here so reviewers don't have to chase "why isn't this in the spec?":

- **Streamable HTTP / SSE transports.** The MVP does **not** implement them. Adding HTTP transports forces decisions about bind host, auth (token? mTLS?), Origin allow-list, CORS, and rate limiting that have no universally correct default. They are revisited only if a concrete remote-deployment use case lands (e.g., a hosted Hermes instance). See §3 for the abstraction we keep open and Open Question 4 for the trigger.
- **WebSocket transport.** Not on the MCP spec track we target.
- **Client-specific npm packages.** No `@iflow-ai/search-claude-code`, `@iflow-ai/search-hermes`, `@iflow-ai/search-openwebui`, `@iflow-ai/search-coze`, `@iflow-ai/search-crewai`. Every MCP-speaking client reaches iFlow via this single package. See [`package-strategy.md`](./package-strategy.md) for the full rubric.
- **File-backed config.** No `~/.iflow-search-mcp.json`, no `.env` discovery, no keychain integration. The MCP client's `env` block is the only configuration source — keeping the key off the filesystem is the security model.
- **CLI flags for the API key.** Env only. Env vars don't appear in `ps -ef` the way command-line arguments do on most platforms.
- **Multiple API keys per process.** One server instance = one iFlow account. Spawn a second `mcpServers` entry if a second key is needed.
- **Hosting / proxying.** The MCP server is a local stdio process spawned and torn down by the client. It is not a daemon, not a network service, and not a key broker.

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

Only the items below remain genuinely undecided. Everything that used to live here about package name, MCP SDK choice, Open WebUI / Coze coverage, tool description sourcing, and structured-vs-text output rendering is now resolved in §2 above.

1. **Hermes Agent `mcpServers` config format.** The Anthropic-shaped JSON block in §8 may need a per-client variant — Hermes' exact `mcpServers` config schema needs confirmation before we ship a Hermes-side recipe. Decision unblocked once we have access to a Hermes test client.
2. **`examples/mcp-claude-code/` shipping form.** Do we ship a copy-paste-ready `.mcp.json` example directory in this monorepo? If yes, it must contain only `YOUR_IFLOW_API_KEY` placeholders and the example dir needs a README warning against committing real keys. If no, the README config snippet in §8 is the only artifact users get.
3. **OpenAPI schema location and ownership.** When Phase 4 of the integration roadmap starts (Open WebUI / Coze), do we author the OpenAPI spec inside this repo (e.g. `docs/openapi.yaml` generated from `search-core` types), in a separate documentation repo, or document the HTTP surface in prose only? Triggered by Phase 4, not by MCP — but worth resolving early so `search-core` type exports can be designed with schema generation in mind.
4. **Streamable HTTP — future need.** Is there a remote-deployed MCP consumer (e.g. hosted Hermes, multi-tenant Claude Desktop replacement) expected in the next two releases? If yes, factor the transport boundary now so adding Streamable HTTP later does not require touching tool handlers. If no, defer the abstraction entirely. Decision deadline: before promoting `@iflow-ai/search-mcp` to `latest`. The MVP ships stdio-only regardless.
