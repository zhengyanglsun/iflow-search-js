# Platform smoke results — `@iflow-ai/search-mcp`

Results from end-to-end smokes of the published `@iflow-ai/search-mcp@next`
package against real MCP-client hosts. Sibling of
[`platform-smokes.md`](./platform-smokes.md), which covers the OpenAPI
package against Open WebUI and Coze.

Smoke target: **`@iflow-ai/search-mcp@next`**, at the version published at
the time of each smoke (re-verify with
`npm view @iflow-ai/search-mcp@next version`; the dist-tag on `latest` is
intentionally still `0.1.0-pre.0` — see [release-policy.md](./release-policy.md)).
The OpenCode and CrewAI smokes ran against `0.1.0-pre.1`; the Claude Code
smoke ran against `0.1.0-pre.2`.

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

## CrewAI — passes via stdio MCP

| | |
|---|---|
| CrewAI version | `1.14.5` |
| `crewai-tools[mcp]` version | `1.14.5` |
| MCP Python SDK (`mcp`) | `1.26.0` |
| `mcpadapt` (CrewAI's MCP bridge dep) | `0.1.20` |
| Python | `3.12.13` in a temp venv |
| MCP transport | stdio (`StdioServerParameters`) |
| Spawn | `npx -y @iflow-ai/search-mcp@next` from inside `MCPServerAdapter` |
| MCP server stderr banner | `[@iflow-ai/search-mcp] v0.1.0-pre.1 ready on stdio.` |
| `MCPServerAdapter` tool count | `3` |
| `tools/list` raw names | `iflow_web_search`, `iflow_image_search`, `iflow_web_fetch` |
| Tool object class returned by adapter | `CrewAIMCPTool` (a Pydantic-backed CrewAI `BaseTool`, invokable via `.run(**kwargs)`) |
| Tool-name prefixing | none — CrewAI passes the raw MCP names through unchanged |
| `iflow_web_search` (`query="CrewAI MCP integration test", count=3`) | ✅ 838-char numbered list; first result CrewAI MCP docs (`docs.crewai.com/en/mcp/overview`) |
| `iflow_image_search` (`query="great wall of china", count=3`) | ✅ 657-char numbered list; first image URL `upload.wikimedia.org/.../The_Great_Wall_of_China_at_Jinshanling-edit.jpg` |
| `iflow_web_fetch` (`url="https://example.com"`) | ✅ 164 chars, `Example Domain [cached]` + readable body |
| JSON-RPC parse errors | none |
| stdout pollution from MCP server | none (banner went to stderr) |
| Mid-call disconnects | none |
| Clean shutdown | `MCPServerAdapter` `with` block exited cleanly; Python process exit 0 |
| `IFLOW_MCP_CLIENT=crewai` | accepted by the existing `[a-z0-9._-]{1,64}` validation in `packages/search-mcp/src/config.ts` — no code change required |
| Response-shape / `content[0].text` truncation | none observed; full numbered renderings made it through to `.run()` callers |

### The `StdioServerParameters` block used for the green run

The block in the Python script contained **no secrets** — only the
non-secret `IFLOW_MCP_CLIENT` value, plus a verbatim spread of
`os.environ` so the existing `IFLOW_API_KEY` shell export reaches the
MCP child:

```python
import os
from crewai_tools import MCPServerAdapter
from mcp import StdioServerParameters

server_params = StdioServerParameters(
    command="npx",
    args=["-y", "@iflow-ai/search-mcp@next"],
    env={**os.environ, "IFLOW_MCP_CLIENT": "crewai"},
)
```

`IFLOW_API_KEY` was exported in the shell that launched the smoke
script and inherited by the stdio MCP child via the `{**os.environ,
...}` spread. The key was never written to a Python source file, an
`.env` file, a tracked config file, the script's stdout, the script's
stderr, the MCP server's stdout, or its stderr.

CrewAI's `StdioServerParameters.env` is a plain Python `dict[str,
str]` — values are forwarded verbatim. Writing `"IFLOW_API_KEY":
"${IFLOW_API_KEY}"` would send the literal `${IFLOW_API_KEY}` string
to the MCP child and break iFlow auth (same shape as the OpenCode
warning above).

### Caveat — what this smoke did NOT exercise

A full CrewAI `Agent` / `Task` / `Crew` run needs an authenticated LLM
provider (`openai` / `anthropic` / etc.) before any tool can be
LLM-selected from a prompt. This smoke did not configure an LLM
provider; the three tool calls were issued via direct
`CrewAIMCPTool.run(**kwargs)` calls against the live tools returned by
`MCPServerAdapter`. That covers the full iFlow-facing wire path —
transport, handshake, `tools/list`, `callTool`, response shaping —
i.e. every piece of behavior owned by this package, plus CrewAI's
adapter layer that wraps MCP tools into `CrewAIMCPTool` objects.
What's NOT covered is the LLM-driven tool-selection layer that a Crew
would invoke from a prompt — that is model and prompt behavior, not
iFlow behavior, and it is the same code path CrewAI runs for any
other MCP server.

### Reproduction sketch

```bash
# 1. Export the key in your shell — never write it into a Python file.
export IFLOW_API_KEY="YOUR_IFLOW_API_KEY"

# 2. Create a temp venv (Python 3.10–3.13 required by crewai-tools).
TMP=$(mktemp -d /tmp/iflow-crewai-smoke-XXXXXX)
python3.12 -m venv "$TMP/.venv"
. "$TMP/.venv/bin/activate"
python -m pip install --upgrade pip
python -m pip install "crewai-tools[mcp]"

# 3. Run a minimal smoke script (see "The StdioServerParameters block"
#    above for the env shape). Verify that:
#      - the `with MCPServerAdapter(server_params) as tools:` block
#        opens without raising;
#      - `[t.name for t in tools]` equals
#        ['iflow_web_search', 'iflow_image_search', 'iflow_web_fetch'];
#      - each `tool.run(**kwargs)` returns non-empty text.

# 4. Clean up.
deactivate
rm -rf "$TMP"
```

## Claude Code — passes via stdio MCP

| | |
|---|---|
| Claude Code CLI version | `2.1.148-20260509.2` |
| Invocation | `claude -p --strict-mcp-config --mcp-config <file> --no-session-persistence --permission-mode bypassPermissions --disable-slash-commands --output-format text "..."` |
| Config file | session-scoped `mcp.json` written under a temporary `/tmp/iflow-claude-code-smoke-*` directory |
| MCP transport | stdio |
| Default `claude mcp list` *before* run | `No MCP servers configured.` |
| Default `claude mcp list` *after* run | `No MCP servers configured.` (byte-identical — `claude mcp add` was never run) |
| `tools/list` raw names | `iflow_web_search`, `iflow_image_search`, `iflow_web_fetch` |
| `iflow_web_search` (`query="Claude Code MCP integration test", count=3`) | ✅ ok — first result *"Anyone using Claude Code and MCP's in your test flow? - Reddit"* (`reddit.com/r/softwaretesting/.../anyone_using_claude_code_and_mcps_in_your_test/`) |
| `iflow_image_search` (`query="great wall of china", count=3`) | ✅ ok — first image source domain `en.wikipedia.org` |
| `iflow_web_fetch` (`url="https://example.com"`) | ✅ ok — title `Example Domain`, 113 chars |
| JSON-RPC parse errors | none |
| stdout pollution from MCP server | none (banner stayed on stderr) |
| Mid-call disconnects | none |
| Tool-schema mismatch | none |
| Permission prompt during `-p` mode | none (handled by `--permission-mode bypassPermissions`) |
| Response truncation | none observed |
| `IFLOW_MCP_CLIENT=claude-code` | accepted by the existing `[a-z0-9._-]{1,64}` validation in `packages/search-mcp/src/config.ts` — no code change required |

### The `mcp.json` used for the green run

The temporary config file contained **no secrets** — only the non-secret
`IFLOW_MCP_CLIENT` / `IFLOW_MCP_CLIENT_VERSION` values:

```json
{
  "mcpServers": {
    "iflow-search": {
      "command": "npx",
      "args": ["-y", "@iflow-ai/search-mcp@next"],
      "env": {
        "IFLOW_MCP_CLIENT": "claude-code",
        "IFLOW_MCP_CLIENT_VERSION": "2.1.148"
      }
    }
  }
}
```

`IFLOW_API_KEY` was inherited from the parent shell env. Claude Code's
stdio MCP child layer spreads the parent `process.env` to the spawned
subprocess, so no key value had to be written into `mcp.json`. The key
was never written to a config file, an `.env` file, a tracked file, the
smoke prompt, Claude Code's stdout / stderr, the MCP server's stdout /
stderr, or any log file.

### Isolation guarantees

The `--strict-mcp-config` + `--mcp-config <file>` combination loaded the
`iflow-search` server **only for the single `claude -p` invocation**. No
persistent user / project / local MCP config was created or modified:

- `claude mcp add` was never run.
- The temporary `mcp.json` (`/tmp/iflow-claude-code-smoke-*/mcp.json`)
  was removed after the run.
- The default `claude mcp list` output was byte-identical before and
  after the smoke.
- No leftover `@iflow-ai/search-mcp` or `node` child processes were
  observed (`ps -ef | grep search-mcp` returned nothing).
- `--no-session-persistence` skipped writing the `-p` conversation to
  Claude Code's session store.

### Caveat — what this smoke did NOT exercise

`-p` non-interactive mode runs a single Anthropic LLM round trip that
decides which MCP tools to call. That covers the full iFlow-facing wire
path — transport, handshake, `tools/list`, `callTool`, response
shaping — and additionally exercises Claude Code's MCP client layer
end-to-end (server resolution from `--mcp-config`, env propagation to
the stdio child, tool registration in the model's tool catalog,
permission gating). What's NOT covered is interactive-session UI
behavior (TUI tool-call approval prompts, persistent session
resumption, slash-command interactions with the server) — those are
Claude Code UX paths, not iFlow paths, and they run the same code path
Claude Code uses for any other MCP server.

### Reproduction sketch

```bash
# 1. Export the key in your shell — never write it into mcp.json.
export IFLOW_API_KEY="YOUR_IFLOW_API_KEY"

# 2. Create a temp directory + session-scoped MCP config.
TMP=$(mktemp -d /tmp/iflow-claude-code-smoke-XXXXXX)
cat > "$TMP/mcp.json" <<'EOF'
{
  "mcpServers": {
    "iflow-search": {
      "command": "npx",
      "args": ["-y", "@iflow-ai/search-mcp@next"],
      "env": {
        "IFLOW_MCP_CLIENT": "claude-code"
      }
    }
  }
}
EOF

# 3. Run Claude Code with the isolated config. --strict-mcp-config
#    ignores every other MCP source; --no-session-persistence skips the
#    session save; --mcp-config loads only this file for this one
#    invocation. Persistent user/project/local MCP config is not touched.
claude -p \
  --strict-mcp-config \
  --mcp-config "$TMP/mcp.json" \
  --no-session-persistence \
  --permission-mode bypassPermissions \
  --disable-slash-commands \
  --output-format text \
  "Call iflow_web_search, iflow_image_search, iflow_web_fetch once each and summarize."

# 4. Confirm the persistent MCP list is unchanged.
claude mcp list   #  →  No MCP servers configured.   (or your prior list, unchanged)

# 5. Clean up.
rm -rf "$TMP"
```

## Trust boundary

All three smokes (OpenCode, CrewAI, and Claude Code) ran against the real
iFlow Search API. No mocks involved. Wire paths:

- **OpenCode**: OpenCode CLI (holds parent env including
  `IFLOW_API_KEY`) → stdio child `npx -y @iflow-ai/search-mcp@next`
  (inherits `IFLOW_API_KEY` via parent-env spread; sets
  `IFlow-Source: mcp`, `IFlow-MCP-Client: opencode`,
  `Authorization: Bearer …`) → `https://platform.iflow.cn` (real
  iFlow Search API).
- **CrewAI**: Python smoke script (holds parent env including
  `IFLOW_API_KEY`) → `MCPServerAdapter` opens stdio child
  `npx -y @iflow-ai/search-mcp@next` with explicit
  `env={**os.environ, "IFLOW_MCP_CLIENT": "crewai"}` (so the child
  inherits `IFLOW_API_KEY` and sets `IFlow-Source: mcp`,
  `IFlow-MCP-Client: crewai`, `Authorization: Bearer …`) →
  `https://platform.iflow.cn`.
- **Claude Code**: `claude -p --strict-mcp-config --mcp-config <file>`
  (holds parent env including `IFLOW_API_KEY`) → stdio child
  `npx -y @iflow-ai/search-mcp@next` (inherits `IFLOW_API_KEY` via
  Claude Code's parent-env spread to the stdio MCP child; sets
  `IFlow-Source: mcp`, `IFlow-MCP-Client: claude-code`,
  `Authorization: Bearer …`) → `https://platform.iflow.cn`.

`IFLOW_API_KEY` never leaves the `search-mcp` process in any of these
topologies. OpenCode itself sees the key in its own `process.env`
(since the operator exported it in the shell that launched OpenCode);
the CrewAI smoke script sees it in `os.environ` for the same reason;
Claude Code sees it in its own `process.env` (exported in the shell
that ran `claude -p`). None of the hosts' outbound network calls (to
their LLM providers) were configured to forward `IFLOW_API_KEY`.

`DEEPSEEK_API_KEY` was not used by either smoke; it appears only in
`examples/langgraph-agent` and is not read by `@iflow-ai/search-mcp`.

## Side-effects worth noting

- OpenCode wrote a one-time SQLite database under
  `~/.local/share/opencode/` on first run (the
  `Performing one time database migration` line in the log). Outside
  the repo; expected and standard OpenCode behavior.
- `npx` cached `opencode-ai@1.15.10` plus the platform binary in npm's
  cache directory. Persists across runs; clearable with
  `npm cache clean --force`.
- The CrewAI smoke created a temp venv under `/tmp/iflow-crewai-smoke-*`
  containing `crewai`, `crewai-tools`, `mcp`, `mcpadapt`, and their
  transitive deps (LanceDB, ChromaDB, OpenAI, etc. — a heavy install
  driven by `crewai`'s own dep tree, not by anything iFlow ships).
  Removed after the run. `npx` also cached `@iflow-ai/search-mcp@next`
  in npm's cache directory; clearable the same way.
- The Claude Code smoke wrote only `/tmp/iflow-claude-code-smoke-*/mcp.json`
  (no secrets) and removed it afterwards. `--no-session-persistence`
  prevented Claude Code from saving the `-p` conversation to its
  session store. `npx` cached `@iflow-ai/search-mcp@next` in npm's
  cache directory; clearable with `npm cache clean --force`.

## See also

- [release-policy.md](./release-policy.md) — versioning rules and the `next` vs `latest` discipline
- [integration-roadmap.md](./integration-roadmap.md) — adapter priorities, where new MCP clients fit
- [mcp-design.md](./mcp-design.md) — MCP server design rationale (transport, tool schema, attribution headers)
- [platform-smokes.md](./platform-smokes.md) — sibling OpenAPI smoke results (Open WebUI, Coze)
