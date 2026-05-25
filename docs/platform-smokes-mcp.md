# Platform smoke results — `@iflow-ai/search-mcp`

Results from end-to-end smokes of the published `@iflow-ai/search-mcp@next`
package against real MCP-client hosts. Sibling of
[`platform-smokes.md`](./platform-smokes.md), which covers the OpenAPI
package against Open WebUI and Coze.

Smoke target: **`@iflow-ai/search-mcp@next` = `0.1.0-pre.1`**
(re-verify with `npm view @iflow-ai/search-mcp@next version`; the
dist-tag on `latest` is intentionally still `0.1.0-pre.0` — see
[release-policy.md](./release-policy.md)).

The Hermes Agent smoke is recorded separately in
[`integration-roadmap.md`](./integration-roadmap.md) Phase 3
verification record. This document captures hosts not covered there.

## OpenCode — passes via stdio MCP

| | |
|---|---|
| OpenCode CLI version | `1.15.10` |
| Invocation | `npx -y opencode-ai@1.15.10` (no global install) |
| Config file | `opencode.json` (project-scoped temp dir) |
| MCP transport | stdio (`type: "local"`) |
| `opencode mcp list` | `✓ iflow-search connected` |
| Tool-discovery log line | `service=mcp key=iflow-search toolCount=3 create() successfully created client` |
| `tools/list` raw names | `iflow_web_search`, `iflow_image_search`, `iflow_web_fetch` |
| `iflow_web_search` | ✅ 3 results, `title` + `url` present |
| `iflow_image_search` | ✅ 3 images, `imageUrl` present |
| `iflow_web_fetch` | ✅ `Example Domain`, 119 chars of content |
| JSON-RPC parse errors | none |
| stdout pollution from MCP server | none (banner went to stderr) |
| Mid-call disconnects | none |
| Clean shutdown | server logged `received SIGTERM, closing.` |
| `IFLOW_MCP_CLIENT=opencode` | accepted by the existing `[a-z0-9._-]{1,64}` validation in `packages/search-mcp/src/config.ts` — no code change required |

### `opencode.json` used for the green run

The block in the temp config file contained **no secrets** — only the
non-secret `IFLOW_MCP_CLIENT` value:

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

`IFLOW_API_KEY` was exported in the shell that launched OpenCode and
inherited by the stdio MCP child via OpenCode's
`env: { ...process.env, ...mcp.environment }` spread (see
`packages/opencode/src/mcp/index.ts` in
[`anomalyco/opencode`](https://github.com/anomalyco/opencode)). The
key was never written to a file, never echoed, never logged.

The `environment` map does **not** expand `${VAR}` shell syntax —
Effect schema `Schema.Record(Schema.String, Schema.String)`, values
taken verbatim. A configuration line like
`"IFLOW_API_KEY": "${IFLOW_API_KEY}"` would forward the literal
`${IFLOW_API_KEY}` string to the MCP child and break iFlow auth.

### Caveat — what this smoke did NOT exercise

OpenCode's headless `opencode run "..."` mode needs an authenticated
LLM provider (Anthropic / OpenAI / etc.) before any tool can be
LLM-selected. This smoke did not configure an LLM provider; the three
tool calls were issued via a **direct stdio MCP probe** that connected
to the same `@iflow-ai/search-mcp@next` process OpenCode would spawn,
using the official `@modelcontextprotocol/sdk` client. That covers the
full iFlow-facing wire path — transport, handshake, `tools/list`,
`callTool`, response shaping — i.e. every piece of behavior owned by
this package. What's NOT covered is the OpenCode-side LLM
tool-selection layer, which is model and prompt behavior, not iFlow
behavior, and which is the same code path OpenCode runs for any other
MCP server.

The matching `opencode mcp list` run (which DOES go through OpenCode's
own MCP loader and reaches `connected` status with `toolCount=3`)
exercises everything except the LLM step.

### Tool name visibility in OpenCode

OpenCode's tool registry prefixes MCP tools with the server name. A
model driven by OpenCode would see:

- `iflow-search_iflow_web_search`
- `iflow-search_iflow_image_search`
- `iflow-search_iflow_web_fetch`

The raw MCP names returned by `tools/list` are still
`iflow_web_search` / `iflow_image_search` / `iflow_web_fetch` — the
`iflow-search_` prefix is OpenCode's namespace, not part of
`@iflow-ai/search-mcp`.

### Reproduction sketch

```bash
# 1. Export the key in your shell — never write it into opencode.json.
export IFLOW_API_KEY="YOUR_IFLOW_API_KEY"

# 2. Create a temp project with the opencode.json shown above.
TMP=$(mktemp -d /tmp/iflow-opencode-smoke-XXXXXX)
# ... write opencode.json into $TMP ...

# 3. Verify wiring without starting the TUI.
cd "$TMP" && npx -y opencode-ai@1.15.10 mcp list
#   →  ✓ iflow-search connected
#         npx -y @iflow-ai/search-mcp@next

# 4. (Optional) See the tool count in OpenCode's own log:
cd "$TMP" && npx -y opencode-ai@1.15.10 --print-logs --log-level INFO mcp list
#   →  service=mcp key=iflow-search toolCount=3 create() successfully created client

# 5. Clean up.
rm -rf "$TMP"
```

## Trust boundary

The OpenCode smoke ran against the real iFlow Search API. No mocks
involved. Wire path:

- OpenCode CLI (holds parent env including `IFLOW_API_KEY`) →
  stdio child `npx -y @iflow-ai/search-mcp@next` (inherits
  `IFLOW_API_KEY` via parent-env spread; sets `IFlow-Source: mcp`,
  `IFlow-MCP-Client: opencode`, `Authorization: Bearer …`) →
  `https://platform.iflow.cn` (real iFlow Search API).

`IFLOW_API_KEY` never leaves the `search-mcp` process. OpenCode itself
sees the key in its own `process.env` (since the operator exported it
in the shell that launched OpenCode), but the only outbound network
call OpenCode would otherwise make is to its LLM provider — not
configured in this smoke.

`DEEPSEEK_API_KEY` was not used; it appears only in
`examples/langgraph-agent` and is not read by `@iflow-ai/search-mcp`.

## Side-effects worth noting

- OpenCode wrote a one-time SQLite database under
  `~/.local/share/opencode/` on first run (the
  `Performing one time database migration` line in the log). Outside
  the repo; expected and standard OpenCode behavior.
- `npx` cached `opencode-ai@1.15.10` plus the platform binary in npm's
  cache directory. Persists across runs; clearable with
  `npm cache clean --force`.

## See also

- [release-policy.md](./release-policy.md) — versioning rules and the `next` vs `latest` discipline
- [integration-roadmap.md](./integration-roadmap.md) — adapter priorities, where new MCP clients fit
- [mcp-design.md](./mcp-design.md) — MCP server design rationale (transport, tool schema, attribution headers)
- [platform-smokes.md](./platform-smokes.md) — sibling OpenAPI smoke results (Open WebUI, Coze)
