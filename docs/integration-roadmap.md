# iFlow Search integration roadmap

How each integration target gets to iFlow Search, and which lever (npm package vs. MCP vs. OpenAPI vs. example) we use for each. Read together with [`package-strategy.md`](./package-strategy.md) — the strategy doc explains *why* the table looks the way it does.

### Project identity

- **Product:** iFlow Search
- **Website:** <https://platform.iflow.cn>
- **npm scope:** `@iflow-ai`
- **Repo:** <https://github.com/zhengyanglsun/iflow-search-js>
- **Maintainer:** maintained by the iFlow team, associated with Hangzhou Xingchen Qianxun Technology Co., Ltd. (杭州星辰千寻科技有限公司)

All upstream integration / docs requests filed by this project are filed by the iFlow team under the identity above.

## Integration matrix

| Integration target | Recommended path | npm package? | Current status | Notes | Reference links |
|---|---|---|---|---|---|
| **LangChain JS** | `@iflow-ai/search-langchain` tools wired into any LangChain agent that supports `bindTools` | Yes — already published | `0.1.0-pre.0` on dist-tag `next` | Three tools: `iflow_web_search`, `iflow_image_search`, `iflow_web_fetch`. Peer-depends on `@langchain/core` `^0.3.0 \|\| ^1.0.0` and `zod` `^3.25.0 \|\| ^4.0.0`. | <https://js.langchain.com/docs/> · <https://js.langchain.com/docs/concepts/tools/> |
| **LangGraph JS** | Reuse `@iflow-ai/search-langchain` tools inside `createReactAgent` / `ToolNode` | No separate package | `examples/langgraph-agent` end-to-end ReAct example validated against real iFlow | A `@iflow-ai/search-langgraph` package would be a re-export — explicitly rejected. Workspace pins `@langchain/core` to `^1.1.44` via `pnpm-workspace.yaml` overrides to avoid `ToolMessage` cross-version bugs. | <https://langchain-ai.github.io/langgraphjs/> |
| **OpenClaw / ClawHub** | `@iflow-ai/iflow-plugin` (separate repo, separate release) | Yes — maintained outside this monorepo | Already shipping | A future internal refactor can let the plugin consume `@iflow-ai/search-core` to delete duplicated HTTP code. Do **not** create `@iflow-ai/search-openclaw`. | <https://clawhub.ai/> · <https://docs.openclaw.ai/plugins/building-plugins> · <https://github.com/openclaw/openclaw/issues/83522> |
| **Hermes Agent** | `@iflow-ai/search-mcp` server over stdio | Yes — `@iflow-ai/search-mcp@0.1.0-pre.0` on dist-tag `next` | ✅ Smoke green end-to-end — Hermes is the first verified MCP client. See Phase 3 verification record. | Hermes is an MCP client. A Hermes-specific package would lock us to Hermes' release cycle — rejected. | <https://modelcontextprotocol.io/> · <https://github.com/NousResearch/hermes-agent/issues/29250> |
| **Claude Code** | Planned `@iflow-ai/search-mcp` server, or a published skill | Yes (planned, same MCP package) | Not implemented | MCP is the first-class extension surface for Claude Code. No Claude-Code-specific npm package. | <https://docs.anthropic.com/en/docs/claude-code> · <https://docs.anthropic.com/en/docs/claude-code/mcp> · <https://modelcontextprotocol.io/> |
| **OpenCode** | `@iflow-ai/search-mcp` server over stdio | No new package — same MCP package | ✅ Smoke green on `@iflow-ai/search-mcp@0.1.0-pre.1` with OpenCode `1.15.10`; stdio MCP connected, `tools/list` found 3 tools, and three real iFlow calls were verified via a direct stdio MCP probe of the same package. LLM-driven tool selection not tested. See [`platform-smokes-mcp.md`](./platform-smokes-mcp.md). | OpenCode is an MCP client. Config goes in `opencode.json` under `mcp` (not `mcpServers`) with `environment` (not `env`). `IFLOW_API_KEY` is inherited from the parent shell — never written into `opencode.json` — per the README's OpenCode section. | <https://opencode.ai/docs/mcp-servers/> · <https://github.com/anomalyco/opencode> · <https://modelcontextprotocol.io/> |
| **iFlow CLI** | Direct dependency on `@iflow-ai/search-core` if/when the CLI is a published Node app | Maybe — only if the CLI itself ships as an npm product | Internal use only today | Internal CLIs can take a workspace dependency; no need to publish a CLI-specific adapter. | — |
| **Open WebUI** | OpenAPI tool spec, or the planned MCP server | No | Not started | Open WebUI's first-class extension surfaces are OpenAPI tools and MCP. We ship a spec / server, not a UI-specific npm package. | <https://docs.openwebui.com/> · <https://spec.openapis.org/oas/latest.html> |
| **Coze** | OpenAPI plugin or HTTP tool config | No | Not started | Coze ingests OpenAPI plugins directly. Same lever as Open WebUI. | <https://www.coze.com/docs/> · <https://spec.openapis.org/oas/latest.html> |
| **CrewAI** | `@iflow-ai/search-mcp` stdio MCP server consumed via `MCPServerAdapter` from `crewai-tools[mcp]` | No new JS package; a native CrewAI package, if ever needed, belongs to the Python line (PyPI), not npm | ✅ Smoke green via `@iflow-ai/search-mcp@0.1.0-pre.1` stdio MCP with CrewAI `1.14.5` / `crewai-tools` `1.14.5`; `MCPServerAdapter` discovered all 3 tools and direct `CrewAIMCPTool.run()` calls succeeded against the real iFlow API. Full LLM-driven Crew agent loop not tested. See [`platform-smokes-mcp.md`](./platform-smokes-mcp.md). | CrewAI's `MCPServerAdapter` (backed by `mcpadapt`) spawns the published `@iflow-ai/search-mcp@next` directly via `StdioServerParameters(command="npx", args=["-y", "@iflow-ai/search-mcp@next"], env={**os.environ, "IFLOW_MCP_CLIENT": "crewai"})`. `IFLOW_API_KEY` is inherited from the parent shell env — never hard-coded in Python source. | <https://docs.crewai.com/> · <https://docs.crewai.com/en/mcp/overview> · <https://modelcontextprotocol.io/> |

## Upstream tracking issues

Official issues filed by the iFlow team against each upstream project, used to coordinate integration / docs work. These are tracking links only — implementation lives in this repo and the published npm packages.

| Upstream | Issue | Kind | Status |
|---|---|---|---|
| LangChain JS (`langchain-ai/langchainjs`) | [#10931](https://github.com/langchain-ai/langchainjs/issues/10931) — *Integration request: iFlow Search tools for LangChain JS* | Integration / docs request | Open, awaiting upstream triage |
| LangGraph JS (`langchain-ai/langgraphjs`) | [#2419](https://github.com/langchain-ai/langgraphjs/issues/2419) — *Example request: LangGraph JS agent using iFlow Search LangChain tools* | Docs / example request | Open, awaiting upstream triage |
| Hermes Agent (`NousResearch/hermes-agent`) | [#29250](https://github.com/NousResearch/hermes-agent/issues/29250) — *Docs request: iFlow Search MCP server configuration for Hermes Agent* | Docs request (MCP server config) | Open, triaged by upstream — labels: `type/docs`, `tool/mcp`, `P3` |

None of these issues block this repo's roadmap — `@iflow-ai/search-langchain`, the LangGraph example, and `@iflow-ai/search-mcp` already work against unmodified upstream versions. They exist so upstream maintainers can decide whether to surface iFlow in their own integration docs.

## Next integration priorities

Six concrete workstreams sit between the current `next` releases and stable `0.1.0` / Phase 4 reach. Listed in execution order. Of these, **only #1 gates stable `0.1.0`** — the remaining items improve ecosystem reach but do not block the move from dist-tag `next` to `latest`.

### 1. Claude Code MCP smoke

- **Path:** reuse `@iflow-ai/search-mcp@next` over stdio — the same package already verified against Hermes Agent. Configuration goes in Claude Code's `mcpServers` block (`.mcp.json` project-scoped or `claude mcp add` user-scoped); see [`mcp-design.md`](./mcp-design.md) §8 for the shape.
- **No new package.**
- **Why first:** [`mcp-design.md`](./mcp-design.md) §9 requires at least two real MCP clients smoked end-to-end before any version moves to dist-tag `latest`. Hermes is the first. Claude Code is the missing second — and therefore the only item on this list that gates stable `0.1.0`.

### 2. OpenAPI schema

- **Path:** add an in-repo OpenAPI 3.x spec describing the three iFlow Search primitives. Default location: `docs/openapi.yaml` — final location decided as part of this workstream (resolves [`mcp-design.md`](./mcp-design.md) §11 Q3).
- **Source of truth:** `@iflow-ai/search-core`'s exported types. v1 may be hand-authored; generator-driven only if maintenance burden grows.
- **Why second:** unlocks Open WebUI (#4) and Coze (#5) in one stroke. Higher leverage than internal-only iFlow CLI work, so it goes ahead of #3.
- Must specify `Authorization: Bearer …`, expected response shapes, and the iFlow business-error mapping (`AUTH_FAILED`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `NETWORK_ERROR`) so third-party consumers know what to expect.

### 3. iFlow CLI

- **Path:** thin Node bin over `@iflow-ai/search-core`. Default `"private": true` workspace package — internal-only unless a separate decision says otherwise. If shipped externally, follows the same `next`-then-`latest` cadence as the other packages.
- **Hard rule:** must reuse `search-core` for all HTTP / `Authorization` / attribution-header / response-parsing / error-mapping logic. No `fetch` in the CLI source.
- **Does not gate stable `0.1.0`.** Parallelizable with #2.

### 4. Open WebUI recipe

- **Path:** depends on #2. Add `examples/openwebui-iflow/` with a README walking through the Open WebUI tool-config flow against the OpenAPI artifact from #2.
- **MCP is the fallback, not the primary path.** Open WebUI's first-class extension surface is OpenAPI tools — use it.
- **Does not gate stable `0.1.0`.**

### 5. Coze recipe

- **Path:** depends on #2. Add `examples/coze-iflow/` with the OpenAPI plugin import flow.
- If Coze requires fields the canonical OpenAPI spec doesn't carry (icon, locale, category, …), those go in a **Coze-specific overlay** inside the example — not in the canonical `docs/openapi.yaml`.
- **Does not gate stable `0.1.0`.**

### 6. CrewAI MCP recipe

- **Path:** reuse `@iflow-ai/search-mcp@next`. Add `examples/crewai-iflow/` with a Python script using CrewAI's MCP client adapter pointed at `npx -y @iflow-ai/search-mcp@next`.
- **No new package — npm or PyPI.** `@iflow-ai/search-crewai` and an equivalent PyPI package are both explicitly rejected per [`package-strategy.md`](./package-strategy.md). Reachable via existing MCP server with zero new release work.
- **Does not gate stable `0.1.0`.** Lowest priority of the six.

### Stable `0.1.0` gating

The promotion from dist-tag `next` to dist-tag `latest` requires only:

1. The MCP cross-client smoke gate ([`mcp-design.md`](./mcp-design.md) §9) — Hermes ✅ done, Claude Code outstanding (#1 above).
2. The pre-publish checklist in [`release-policy.md`](./release-policy.md).

None of #2–#6 block stable `0.1.0`. They are Phase 4 reach work, not Phase 3 release gates.

### Hard constraints (reiterated)

These come from [`package-strategy.md`](./package-strategy.md) and remain non-negotiable while this priority list executes:

- **No client-specific packages.** Not `@iflow-ai/search-claude-code`, not `@iflow-ai/search-hermes`, not `@iflow-ai/search-openwebui`, not `@iflow-ai/search-coze`, not `@iflow-ai/search-crewai`, not `@iflow-ai/search-langgraph`, not `@iflow-ai/search-openclaw`. The single MCP package + OpenAPI artifact + examples are sufficient.
- **Claude Code, Hermes Agent, and Claude Desktop all share `@iflow-ai/search-mcp`.** No fan-out.
- **Open WebUI and Coze go through OpenAPI first.** MCP is fallback only.
- **CrewAI goes through MCP.** No Python package — npm or PyPI — unless MCP proves insufficient.
- **iFlow CLI is a thin wrapper over `@iflow-ai/search-core`.** No re-implemented request logic.
- **All HTTP / `Authorization` / attribution headers / response parsing / error mapping live in `@iflow-ai/search-core` only.** Adapters translate; they do not duplicate.

## Execution phases

The phases below are the order we intend to ship work in. They are not deadlines — each phase only starts after the previous phase's exit criteria are met.

### Phase 1 — harden what is already published ✅ **complete**

- Verify external `npm install @iflow-ai/search-core@next` and `npm install @iflow-ai/search-langchain@next` from a clean directory outside this workspace.
- Run real-iFlow smoke tests against `@iflow-ai/search-langchain` and the LangGraph example.
- Tighten READMEs, examples, and error messages based on real-install feedback.

**Exit criteria:** clean external install, real smoke green, no open issues against the published tarballs.

**Verification record:**

- ✅ `@iflow-ai/search-core@next` external cold install passed from `/tmp/iflow-core-install-check` — resolves to `0.1.0-pre.0`, no nested deps (confirms zero runtime dependencies), all 15 named exports present (`IFlowSearchClient`, `createIFlowSearchClient`, `buildAttributionHeaders`, `redactApiKey`, `isIFlowError`, normalizers and constants).
- ✅ `@iflow-ai/search-langchain@next` external install passed from `/tmp/iflow-npm-real-smoke` — resolves to `0.1.0-pre.0`, nested `@iflow-ai/search-core@0.1.0-pre.0` (confirms the `workspace:*` → concrete-version rewrite landed correctly on the published tarball).
- ✅ Real iFlow API smoke green for all three tools through `@iflow-ai/search-langchain`:
  - `iflow_web_search` — 3 results, content present, first result `心流AI助手 → https://iflow.cn/`.
  - `iflow_image_search` — 3 images, image URLs present.
  - `iflow_web_fetch` — title / url / content all present for `https://platform.iflow.cn/docs/`.
- ✅ Attribution headers verified on every real request: `IFlow-Source: langchain`, `IFlow-Integration: @iflow-ai/search-langchain`, `IFlow-Integration-Version` present, `User-Agent: @iflow-ai/search-langchain/0.1.0-pre.0`, `Authorization` present (value never logged).
- ✅ `@iflow-ai/search-core@next` direct real-API smoke green (not via LangChain): clean external install of `@iflow-ai/search-core@0.1.0-pre.0` in a temp dir, then `createIFlowSearchClient(...)` invoked directly. All three primitives returned real iFlow data — `webSearch` (3 results, first `快速开始 - 心流开放平台 → https://platform.iflow.cn/docs`), `imageSearch` (3 images), `webFetch` (`https://platform.iflow.cn/docs`, 1009-char content). Attribution headers identical across all three calls: `IFlow-Source: core`, `IFlow-Integration: iflow-core-direct-smoke`, `IFlow-Integration-Version: 0.0.0`, `User-Agent: iflow-core-direct-smoke/0.0.0`, `Authorization` present (value redacted via `redactApiKey()`, never logged). Verdict block: `{ allEndpointsOk: true, attributionSourceAlwaysCore: true, attributionIntegrationCorrect: true }`. This was the previously-open follow-up — now closed; `IFlow-Source: core` is first-party measured, not implied.

### Phase 2 — internal reuse for OpenClaw plugin

- Refactor `@iflow-ai/iflow-plugin` to consume `@iflow-ai/search-core` internally, deleting any duplicated HTTP / header logic.
- This phase touches the separate `iflow-plugin` repo, not this monorepo.

**Exit criteria:** plugin builds and ships through ClawHub on top of `search-core` with no behavioral regression.

### Phase 3 — `@iflow-ai/search-mcp`

- **Design document** lives at [`mcp-design.md`](./mcp-design.md). MVP decisions are **locked** — see `mcp-design.md` §2 — including single package `@iflow-ai/search-mcp`, **stdio-only transport**, `@modelcontextprotocol/sdk` as the MCP runtime, env-only configuration (`IFLOW_API_KEY` / `IFLOW_BASE_URL` / `IFLOW_TIMEOUT_MS`), and the architecture constraint that the server must reuse `@iflow-ai/search-core` rather than re-implementing iFlow request logic.
- Implement the MCP server in this monorepo under `packages/search-mcp`.
- Cover Hermes Agent, Claude Code, Claude Desktop, and any other MCP client in a single package.
- **MVP transport is stdio only.** Streamable HTTP / SSE are deferred and only revisited if a concrete remote-deployment use case lands (see `mcp-design.md` §3 and Open Question 4).
- Validate against at least two MCP clients before publishing.

**Exit criteria:** MCP server published to `next`, working stdio transport, validated against ≥ 2 clients (recommended pair: Claude Code + Claude Desktop), unit + protocol smoke + real-API smoke all green.

**Verification record (partial — Hermes only; Claude Code outstanding per [Next integration priorities §1](#1-claude-code-mcp-smoke)):**

- ✅ `@iflow-ai/search-mcp@0.1.0-pre.0` published on dist-tag `next` (note: first publish of a new `@iflow-ai/*` package also auto-assigned `latest` — to be corrected when a stable `0.1.0` ships; see [`release-policy.md`](./release-policy.md)).
- ✅ Local `dist/bin.js` smoke green — Hermes spawned the server directly from the built artifact under `packages/search-mcp/dist/bin.js`, initialize + `tools/list` returned the three expected tools.
- ✅ Published-tarball smoke green — Hermes spawned the server via `npx -y @iflow-ai/search-mcp@next` (clean external resolution from npm, not from the workspace), initialize + `tools/list` returned the same three tools.
- ✅ Three real iFlow API calls executed through Hermes against the published package, each via the corresponding MCP tool:
  - `iflow_web_search` — query "latest LLM benchmarks 2026", `count: 3` — three results returned, titles and URLs populated.
  - `iflow_image_search` — query "great wall of china", `count: 3` — three images returned with `imageUrl` populated.
  - `iflow_web_fetch` — URL `https://example.com` — fetched and returned readable content.
- ✅ Hygiene checks passed for both transports (local bin and `npx`-launched npm package): no JSON-RPC parse errors on the client side, no stdout pollution from the server (all diagnostics on stderr), no mid-call server disconnects, no failed `initialize` handshakes.
- ⏳ Claude Code MCP client smoke outstanding — see Next integration priorities §1. Required as the second MCP client before promoting any version to dist-tag `latest`.

### Phase 4 — Open WebUI / Coze / CrewAI

- Author an OpenAPI spec for the iFlow Search HTTP surface (or generate it from `search-core` types).
- Ship Open WebUI / Coze configuration recipes as workspace examples or a separate `examples/` entry.
- CrewAI users consume the MCP server from Phase 3.

**Exit criteria:** at least one recipe per target landed under `examples/` or `docs/recipes/`, each tested against the real product.

### Phase 5 — stabilize to `latest`

- Once `search-core` and `search-langchain` have run on `next` long enough to surface API-shape issues, cut a stable `0.1.0` and move it to the `latest` dist-tag.
- See [`release-policy.md`](./release-policy.md) for the per-package gate.

**Exit criteria:** at least one external production user, no breaking changes for two minor releases, real smoke green on `next` for the immediately preceding release.
