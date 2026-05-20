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
| **Hermes Agent** | Planned `@iflow-ai/search-mcp` server | Yes (planned, single MCP package) | Not implemented | Hermes is an MCP client. A Hermes-specific package would lock us to Hermes' release cycle — rejected. | <https://modelcontextprotocol.io/> |
| **Claude Code** | Planned `@iflow-ai/search-mcp` server, or a published skill | Yes (planned, same MCP package) | Not implemented | MCP is the first-class extension surface for Claude Code. No Claude-Code-specific npm package. | <https://docs.anthropic.com/en/docs/claude-code> · <https://docs.anthropic.com/en/docs/claude-code/mcp> · <https://modelcontextprotocol.io/> |
| **iFlow CLI** | Direct dependency on `@iflow-ai/search-core` if/when the CLI is a published Node app | Maybe — only if the CLI itself ships as an npm product | Internal use only today | Internal CLIs can take a workspace dependency; no need to publish a CLI-specific adapter. | — |
| **Open WebUI** | OpenAPI tool spec, or the planned MCP server | No | Not started | Open WebUI's first-class extension surfaces are OpenAPI tools and MCP. We ship a spec / server, not a UI-specific npm package. | <https://docs.openwebui.com/> · <https://spec.openapis.org/oas/latest.html> |
| **Coze** | OpenAPI plugin or HTTP tool config | No | Not started | Coze ingests OpenAPI plugins directly. Same lever as Open WebUI. | <https://www.coze.com/docs/> · <https://spec.openapis.org/oas/latest.html> |
| **CrewAI** | Planned `@iflow-ai/search-mcp` server (MCP-over-stdio); future Python package if MCP is insufficient | No npm package — CrewAI is Python | Not started | If a Python adapter is ever needed, it ships on PyPI, not npm. | <https://docs.crewai.com/> · <https://modelcontextprotocol.io/> |

## Upstream tracking issues

Official issues filed by the iFlow team against each upstream project, used to coordinate integration / docs work. These are tracking links only — implementation lives in this repo and the published npm packages.

| Upstream | Issue | Kind | Status |
|---|---|---|---|
| LangChain JS (`langchain-ai/langchainjs`) | [#10931](https://github.com/langchain-ai/langchainjs/issues/10931) — *Integration request: iFlow Search tools for LangChain JS* | Integration / docs request | Open, awaiting upstream triage |
| LangGraph JS (`langchain-ai/langgraphjs`) | [#2419](https://github.com/langchain-ai/langgraphjs/issues/2419) — *Example request: LangGraph JS agent using iFlow Search LangChain tools* | Docs / example request | Open, awaiting upstream triage |
| Hermes Agent (`NousResearch/hermes-agent`) | [#29250](https://github.com/NousResearch/hermes-agent/issues/29250) — *Docs request: iFlow Search MCP server configuration for Hermes Agent* | Docs request (MCP server config) | Open, triaged by upstream — labels: `type/docs`, `tool/mcp`, `P3` |

None of these issues block this repo's roadmap — `@iflow-ai/search-langchain`, the LangGraph example, and `@iflow-ai/search-mcp` already work against unmodified upstream versions. They exist so upstream maintainers can decide whether to surface iFlow in their own integration docs.

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

### Phase 4 — Open WebUI / Coze / CrewAI

- Author an OpenAPI spec for the iFlow Search HTTP surface (or generate it from `search-core` types).
- Ship Open WebUI / Coze configuration recipes as workspace examples or a separate `examples/` entry.
- CrewAI users consume the MCP server from Phase 3.

**Exit criteria:** at least one recipe per target landed under `examples/` or `docs/recipes/`, each tested against the real product.

### Phase 5 — stabilize to `latest`

- Once `search-core` and `search-langchain` have run on `next` long enough to surface API-shape issues, cut a stable `0.1.0` and move it to the `latest` dist-tag.
- See [`release-policy.md`](./release-policy.md) for the per-package gate.

**Exit criteria:** at least one external production user, no breaking changes for two minor releases, real smoke green on `next` for the immediately preceding release.
