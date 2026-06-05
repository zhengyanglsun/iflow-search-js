# @iflow-ai/search-mcp

> MCP (Model Context Protocol) server for [iFlow Search](https://platform.iflow.cn) — exposes web search, image search, and web fetch to any MCP client (Claude Code, Claude Desktop, and other compatible hosts).

Built on [`@iflow-ai/search-core`](../search-core). Same three tools as
[`@iflow-ai/search-langchain`](../search-langchain), same names, same shapes —
so prompts that drive an iFlow-search-tool agent under LangChain keep working
verbatim under MCP.

## Status — MVP stable (`0.1.0`)

`@iflow-ai/search-mcp@0.1.0` is live on dist-tag `latest`. Bare
`npm install @iflow-ai/search-mcp` resolves the stable release. `@next`
remains the prerelease channel and currently points at `0.1.0-pre.2`; use
it only when you need to track an upcoming pre-cut. Run
`npm view @iflow-ai/search-mcp dist-tags --json` to read live state.

The Official MCP Registry entry `io.github.zhengyanglsun/iflow-search`
publishes `0.1.0` as the current `isLatest` version (`0.1.0-pre.2` remains
visible only as a historical entry — see [Official MCP Registry](#official-mcp-registry)
below). The registry is metadata-only; the package itself installs from npm.

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

## Official MCP Registry

This server is listed in the [Official MCP Registry](https://registry.modelcontextprotocol.io):

- **Registry name:** `io.github.zhengyanglsun/iflow-search`
- **npm package:** `@iflow-ai/search-mcp` on dist-tag `latest` (`0.1.0`)
- **Registry-tracked version:** `0.1.0` (`isLatest: true`, `status: active`). `0.1.0-pre.2` remains as a historical entry only.
- **Transport:** `stdio`

The registry stores metadata only — the package itself still installs from npm. MCP clients launch the server with `npx -y @iflow-ai/search-mcp`, which resolves the current stable release (`0.1.0`), or pin a concrete version (e.g. `@iflow-ai/search-mcp@0.1.0`) for reproducibility. `@next` is still available for pre-cut testing.

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

> **Verified host.** Claude Code is a verified MCP host for this package —
> end-to-end stdio smoke green on `@iflow-ai/search-mcp@0.1.0-pre.2` with
> Claude Code CLI `2.1.148-20260509.2`, all three tools exercised against the
> real iFlow Search API. For one-off smoke / evaluation runs that must not
> touch your persistent Claude Code config, use a session-scoped config file
> with `claude -p --strict-mcp-config --mcp-config <file> --no-session-persistence …`
> and let `IFLOW_API_KEY` reach the MCP child via Claude Code's parent-env
> spread (do NOT write the key into the temp `mcp.json`). The reproduction
> sketch is in
> [`docs/platform-smokes-mcp.md`](../../docs/platform-smokes-mcp.md).

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
- Stable `0.1.0` is on dist-tag `latest`; the bare
  `@iflow-ai/search-mcp` shown above resolves it. Pin to the concrete
  version your registry index advertises (e.g.
  `@iflow-ai/search-mcp@0.1.0`) when you want deterministic upgrades —
  run `npm view @iflow-ai/search-mcp dist-tags --json` to read the
  current state. `@next` (`0.1.0-pre.2` at time of writing) is still
  published for pre-cut testing.
- stdio only: Hermes runs the binary as a child process and speaks
  JSON-RPC over stdin/stdout. No `url` / `headers` fields are needed.

### OpenCode

[OpenCode](https://opencode.ai/) is a terminal coding agent with
first-class stdio MCP support. Configuration goes in `opencode.json`
(project-scoped) or `~/.config/opencode/opencode.json` (user-scoped).

Two things make OpenCode's wiring different from the Claude / Hermes
blocks above:

1. **The top-level block is `mcp`, not `mcpServers`**, and the per-server
   env block is `environment`, not `env`. `command` and `args` are
   folded into a single `command: [...]` array.
2. **Do NOT put `IFLOW_API_KEY` in the `environment` block.** OpenCode
   inherits the parent process's full env into every stdio MCP child
   (see `packages/opencode/src/mcp/index.ts` in
   [`anomalyco/opencode`](https://github.com/anomalyco/opencode):
   `env: { ...process.env, ...mcp.environment }`). Exporting
   `IFLOW_API_KEY` in the shell that launches OpenCode is sufficient —
   the key never appears in any committed file. The `environment` map
   does **not** expand `${VAR}` shell syntax (Effect schema
   `Record<string, string>`, taken verbatim), so writing
   `"${IFLOW_API_KEY}"` as a value would send the literal string to
   the MCP child and break iFlow auth.

Export the key once in your shell:

```bash
export IFLOW_API_KEY="YOUR_IFLOW_API_KEY"
```

Then put **only non-secret** values in `opencode.json`:

```json
{
  "mcp": {
    "iflow-search": {
      "type": "local",
      "command": ["npx", "-y", "@iflow-ai/search-mcp@next"],
      "environment": {
        "IFLOW_MCP_CLIENT": "opencode"
      },
      "enabled": true
    }
  }
}
```

`IFLOW_MCP_CLIENT: opencode` is accepted by the existing
`[a-z0-9._-]{1,64}` validation in
`packages/search-mcp/src/config.ts` — no code change is needed to add
OpenCode as a host slug.

Verify the wiring without launching the TUI:

```bash
opencode mcp list
```

A successful run prints `✓ iflow-search connected`. Add
`--print-logs --log-level INFO` to confirm tool discovery — OpenCode
logs `service=mcp key=iflow-search toolCount=3 create() successfully
created client` once the child returns `tools/list`.

> **OpenCode prefixes MCP tools with the server name in its tool
> registry.** Your LLM will see `iflow-search_iflow_web_search`,
> `iflow-search_iflow_image_search`, `iflow-search_iflow_web_fetch`. The
> raw MCP names returned by `tools/list` remain `iflow_web_search` /
> `iflow_image_search` / `iflow_web_fetch`; the `iflow-search_` prefix
> is OpenCode's namespace, not part of this package.

stdio is the supported transport here. OpenCode also supports remote
MCP (`type: "remote"` with `url`), but this package only ships a stdio
binary — no SSE / streamable-HTTP recommendation applies.

### CrewAI

[CrewAI](https://docs.crewai.com/) is a Python multi-agent framework.
It consumes MCP servers through the `MCPServerAdapter` class shipped in
`crewai-tools[mcp]`, which spawns the stdio child and exposes each MCP
tool as a `CrewAIMCPTool` your Agents can call.

This path uses the **existing published `@iflow-ai/search-mcp` stdio
MCP server**:

- No new npm package is required.
- No CrewAI-native Python package is required — `crewai-tools[mcp]`
  already bridges any MCP stdio server, including this one.
- Keep `IFLOW_API_KEY` in the **parent shell env**, not hard-coded in
  Python source. `StdioServerParameters.env` accepts a dict that is
  passed to the MCP child as its `process.env`; spreading
  `os.environ` into it is sufficient to forward the key without ever
  writing it to a tracked file.

Install (`crewai-tools` requires Python 3.10–3.13):

```bash
pip install "crewai-tools[mcp]"
```

Minimal usage:

```python
import os
from crewai_tools import MCPServerAdapter
from mcp import StdioServerParameters

server_params = StdioServerParameters(
    command="npx",
    args=["-y", "@iflow-ai/search-mcp@next"],
    env={**os.environ, "IFLOW_MCP_CLIENT": "crewai"},
)

with MCPServerAdapter(server_params) as tools:
    print([tool.name for tool in tools])
    # → ['iflow_web_search', 'iflow_image_search', 'iflow_web_fetch']
    # tools can be passed to CrewAI Agents (agent=Agent(tools=tools, ...))
    # or invoked directly in smoke tests via tool.run(**kwargs)
```

CrewAI does **not** prefix MCP tool names with the server slug — the
three names listed by `MCPServerAdapter` are the raw MCP names emitted
by this package: `iflow_web_search`, `iflow_image_search`,
`iflow_web_fetch`. A model-driven Crew sees them under those same
names.

`IFLOW_MCP_CLIENT="crewai"` is accepted by the existing
`[a-z0-9._-]{1,64}` validation in
`packages/search-mcp/src/config.ts` — no code change is required to
add CrewAI as a host slug.

> **Tested scope.** The recorded CrewAI smoke verified
> `MCPServerAdapter` tool discovery (`tools/list` returned all three
> expected tools) and direct `CrewAIMCPTool.run(**kwargs)` calls
> against the real iFlow API. The full CrewAI `Agent` / `Task` /
> `Crew` LLM-driven tool-selection loop was **not** exercised — it
> requires an authenticated LLM provider, which is outside this
> package's wire path. See
> [`docs/platform-smokes-mcp.md`](../../docs/platform-smokes-mcp.md)
> for the smoke detail.

### Cline (VS Code extension)

[Cline](https://cline.bot/) is a VS Code coding agent with built-in
stdio MCP support. It reads MCP server definitions from
`~/.cline/mcp.json` (macOS/Linux; equivalent per-user path on Windows).

Add an `iflow-search` entry pointing at the stable package — `npx -y`
resolves the current `latest` release without a global install:

```json
{
  "mcpServers": {
    "iflow-search": {
      "command": "npx",
      "args": ["-y", "@iflow-ai/search-mcp"],
      "env": {
        "IFLOW_API_KEY": "YOUR_IFLOW_API_KEY",
        "IFLOW_MCP_CLIENT": "cline"
      },
      "autoApprove": []
    }
  }
}
```

After Cline reloads its MCP config, the three tools —
`iflow_web_search`, `iflow_image_search`, `iflow_web_fetch` — show up
in the agent's tool list. The same server is discoverable in the
[Official MCP Registry](https://registry.modelcontextprotocol.io) as
`io.github.zhengyanglsun/iflow-search`; Cline still installs the
package directly from npm.

`IFLOW_MCP_CLIENT: cline` is accepted by the existing
`[a-z0-9._-]{1,64}` validation in
`packages/search-mcp/src/config.ts` — no code change is required to
add Cline as a host slug.

> **Do not commit or share `~/.cline/mcp.json`.** If Cline can inject
> `IFLOW_API_KEY` from your parent shell or a local secret manager,
> prefer that over hard-coding the literal value into the config file.
> Treat any shared copy of `mcp.json` as if the key inside it were
> already leaked. `@iflow-ai/search-mcp` never reads from disk and will
> not pick up a stray `.env`, so the only place the key needs to live
> is the `env` block Cline forwards to the child process.
>
> `autoApprove: []` (the default shown above) keeps every tool call
> gated behind Cline's approval UI — leave it that way until you have
> verified the wiring end-to-end with a known-safe query.

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
| `IFLOW_MCP_CLIENT` | no | — | Declared MCP host name (e.g. `hermes`, `claude-code`, `claude-desktop`, `opencode`, `crewai`). When set, emitted as the `IFlow-MCP-Client` header so backend analytics can distinguish hosts. Allowed: `[a-z0-9._-]{1,64}`. Absent = no header sent (we never send a placeholder like `unknown`). |
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
  integrationVersion: "0.1.0",
});

const server = buildServer({ client, integrationVersion: "0.1.0" });
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
