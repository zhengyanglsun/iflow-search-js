# iFlow Search integration roadmap

How each integration target gets to iFlow Search, and which lever (npm package vs. MCP vs. OpenAPI vs. example) we use for each. Read together with [`package-strategy.md`](./package-strategy.md) — the strategy doc explains *why* the table looks the way it does.

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

## Execution phases

The phases below are the order we intend to ship work in. They are not deadlines — each phase only starts after the previous phase's exit criteria are met.

### Phase 1 — harden what is already published

- Verify external `npm install @iflow-ai/search-core@next` and `npm install @iflow-ai/search-langchain@next` from a clean directory outside this workspace.
- Run real-iFlow smoke tests against `@iflow-ai/search-langchain` and the LangGraph example.
- Tighten READMEs, examples, and error messages based on real-install feedback.

**Exit criteria:** clean external install, real smoke green, no open issues against the published tarballs.

### Phase 2 — internal reuse for OpenClaw plugin

- Refactor `@iflow-ai/iflow-plugin` to consume `@iflow-ai/search-core` internally, deleting any duplicated HTTP / header logic.
- This phase touches the separate `iflow-plugin` repo, not this monorepo.

**Exit criteria:** plugin builds and ships through ClawHub on top of `search-core` with no behavioral regression.

### Phase 3 — `@iflow-ai/search-mcp`

- **Design document** lives at [`mcp-design.md`](./mcp-design.md) — package name, transport scope, tool schema, attribution headers, CLI entry, MCP client config example, and test strategy are all pinned there. Read that before implementation begins.
- Implement the MCP server in this monorepo under `packages/search-mcp`.
- Cover Hermes Agent, Claude Code, Claude Desktop, and any other MCP client in a single package.
- **MVP transport is stdio only.** Streamable HTTP is deferred until a concrete remote-deployment use case lands (see `mcp-design.md` §3).
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
