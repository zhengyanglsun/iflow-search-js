# iflow-search-js

JavaScript / TypeScript integrations for **iFlow Search (心流搜索)** — a search API that provides web search, image search, and web page fetching with AI-friendly structured output.

- **Product:** <https://platform.iflow.cn/>
- **API docs:** <https://platform.iflow.cn/docs/>
- **Operator:** 杭州星辰千寻科技有限公司

This monorepo contains:

- A framework-agnostic core SDK
- A LangChain JS tool adapter (also usable from LangGraph)
- A LangGraph agent example
- An MCP stdio server for Hermes / Claude Code / Claude Desktop / other MCP clients

## Package / usage matrix

| Path | Package | Status | Publish target | Depends on | When to use |
|---|---|---|---|---|---|
| `packages/search-core` | `@iflow-ai/search-core` | implemented | npm | — (zero runtime deps) | You are building a framework adapter, calling iFlow directly from a backend, or you don't use LangChain. |
| `packages/search-langchain` | `@iflow-ai/search-langchain` | implemented | npm | `@iflow-ai/search-core`, `@langchain/core`, `zod` | You are building a LangChain JS agent **or** a LangGraph agent — both reuse the same tool factories. |
| `examples/langgraph-agent` | `@iflow-examples/langgraph-agent` | implemented | **not published** (workspace example) | `@iflow-ai/search-langchain`, `@langchain/langgraph` | Reference for wiring `createReactAgent` with iFlow Search tools. Copy the pattern, don't depend on it. |
| `packages/search-mcp` | `@iflow-ai/search-mcp` | implemented | npm | `@iflow-ai/search-core`, MCP SDK | You want to expose iFlow Search to MCP clients (Hermes Agent, Claude Code, Claude Desktop, etc.). Stdio transport. |

### Why there is no `@iflow-ai/search-langgraph`

LangGraph consumes LangChain tools directly. A separate `search-langgraph` package would be a thin re-export with no added value — use `@iflow-ai/search-langchain` for both. See `examples/langgraph-agent` for a working `createReactAgent` wiring.

## Current status

- ✅ `@iflow-ai/search-core` — implemented, framework-agnostic client
- ✅ `@iflow-ai/search-langchain` — implemented, three tools (`iflow_web_search`, `iflow_image_search`, `iflow_web_fetch`)
- ✅ `examples/langgraph-agent` — implemented, ReAct agent end-to-end smoke validated against real iFlow API
- ❌ no separate `@iflow-ai/search-langgraph` package (intentional — see above)
- ✅ `@iflow-ai/search-mcp` — implemented, stdio MCP server with three tools mirroring the LangChain adapter; optional MCP-host attribution via `IFLOW_MCP_CLIENT` / `IFLOW_MCP_CLIENT_VERSION`

## Workspace development

```bash
pnpm install
pnpm -r run typecheck
pnpm -r run build
pnpm -r run test
```

The workspace pins `@langchain/core` to `^1.1.44` via `pnpm-workspace.yaml` `overrides:` to keep LangGraph's runtime and LangChain's tool types on a single major. Removing this override re-introduces `ToolMessage` cross-version serialization bugs in LangGraph agent loops; rerun the LangGraph agent tests before you touch it.

## Basic usage — core SDK

```ts
import { createIFlowSearchClient } from "@iflow-ai/search-core";

const client = createIFlowSearchClient({
  apiKey: process.env.IFLOW_API_KEY!,
  source: "core",
  integrationName: "my-app",
  integrationVersion: "1.0.0",
});

const result = await client.webSearch({ query: "flash attention", count: 5 });
if (!result.ok) {
  console.error(result.error.code, result.error.message);
} else {
  for (const r of result.data.results) console.log(r.title, r.url);
}
```

See `packages/search-core/README.md` for the full API surface.

## Basic usage — LangChain

```ts
import { createIFlowSearchTools } from "@iflow-ai/search-langchain";

const tools = createIFlowSearchTools({
  apiKey: process.env.IFLOW_API_KEY!,
});

// Hand `tools` to any LangChain JS agent that supports `bindTools`.
```

See `packages/search-langchain/README.md` for tool-by-tool docs.

## Basic usage — LangGraph

LangGraph does **not** need a separate iFlow package. Pass the same `@iflow-ai/search-langchain` tools into `createReactAgent`:

```ts
import { createReactAgent, ToolNode } from "@langchain/langgraph/prebuilt";
import { createIFlowSearchTools } from "@iflow-ai/search-langchain";

const tools = createIFlowSearchTools({ apiKey: process.env.IFLOW_API_KEY! });
const agent = createReactAgent({ llm, tools: new ToolNode(tools) });
```

The working end-to-end example lives at `examples/langgraph-agent` — bring your own tool-calling LLM (DeepSeek, OpenAI, Anthropic, …).

## Attribution headers

Every request to iFlow goes through `@iflow-ai/search-core` and carries:

```
IFlow-Source:              <runtime>
IFlow-Integration:         <package-name>
IFlow-Integration-Version: <package-version>
User-Agent:                <package-name>/<package-version>
```

Currently emitted values:

| Integration | `IFlow-Source` | `IFlow-Integration` |
|---|---|---|
| `@iflow-ai/search-langchain` (also from LangGraph) | `langchain` | `@iflow-ai/search-langchain` |
| `@iflow-ai/search-mcp` | `mcp` | `@iflow-ai/search-mcp` |

`@iflow-ai/search-mcp` additionally emits `IFlow-MCP-Client` and `IFlow-MCP-Client-Version` when the MCP host declares itself via `IFLOW_MCP_CLIENT` / `IFLOW_MCP_CLIENT_VERSION` environment variables (e.g. `hermes`, `claude-code`, `claude-desktop`). Absence of these headers is meaningful — there is no `unknown` placeholder, so hosts that opt out remain indistinguishable from hosts that have not adopted the convention.

LangGraph traffic shows up as `IFlow-Source: langchain` because it consumes the same LangChain adapter — there is no separate `langgraph` source ID for this reason.

## Security / key handling

- Never commit real API keys. Use environment variables (`IFLOW_API_KEY`, plus your LLM provider key for agent examples).
- Don't write keys into `.env` files that get committed, into `package.json`, or into test fixtures.
- The unit tests in this repo use fake keys and a mocked `fetch` — they never touch the real iFlow API.
- Real-API smoke tests are opt-in. The committed smoke scripts (e.g. `packages/search-langchain/scripts/smoke-direct.mjs`) read `IFLOW_API_KEY` from the environment at runtime and never persist it.

## Roadmap

- **P0** ✅ `@iflow-ai/search-core` — framework-agnostic SDK
- **P1** ✅ `@iflow-ai/search-langchain` — LangChain JS tool adapter
- **P2** ✅ `examples/langgraph-agent` — LangGraph ReAct agent example
- **P3** ✅ `@iflow-ai/search-mcp` — MCP server for Hermes / Claude Desktop / other MCP clients
- **P4** 🟡 docs and examples polish — broader recipes, additional LLM providers
- **P5** optional — refactor the OpenClaw community iFlow plugin to reuse `@iflow-ai/search-core`

## Maintenance and roadmap

Long-form docs for maintainers and contributors live under [`docs/`](./docs):

- [`docs/package-strategy.md`](./docs/package-strategy.md) — which npm packages we publish, which we explicitly will not, and the decision rubric for new ones.
- [`docs/integration-roadmap.md`](./docs/integration-roadmap.md) — how each framework (LangChain, LangGraph, OpenClaw, Hermes, Claude Code, iFlow CLI, Open WebUI, Coze, CrewAI) reaches iFlow Search, with phased execution order.
- [`docs/release-policy.md`](./docs/release-policy.md) — versioning, `next` vs `latest`, the per-release checklist, and the manual publish commands.
- [`docs/mcp-design.md`](./docs/mcp-design.md) — design for the planned `@iflow-ai/search-mcp` server (P3): package decision, transport scope, tool schema, attribution headers, MCP client config example, and test strategy.

## License

MIT — see [LICENSE](./LICENSE).
