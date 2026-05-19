# @iflow-examples/langgraph-agent

A minimal [LangGraph JS](https://langchain-ai.github.io/langgraphjs/) React agent wired with iFlow Search tools.

This is a **workspace-only example**, not a published npm package.

## Why there is no `@iflow-ai/search-langgraph` package

LangGraph consumes LangChain tools directly: anything constructed with `@langchain/core/tools`' `tool(...)` factory plugs into [`createReactAgent`](https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph_prebuilt.createReactAgent.html), `ToolNode`, custom `StateGraph` nodes, etc.

Since `@iflow-ai/search-langchain` already exposes the three iFlow Search tools as LangChain tools, **a separate `@iflow-ai/search-langgraph` package would be a thin re-export and is intentionally not provided.** Reuse `@iflow-ai/search-langchain` directly.

## What this example does

`createIFlowAgent({ apiKey, llm })` returns a compiled LangGraph React agent with three tools attached:

- `iflow_web_search`
- `iflow_image_search`
- `iflow_web_fetch`

```ts
import { createIFlowAgent } from "@iflow-examples/langgraph-agent";
import { ChatDeepSeek } from "@langchain/deepseek"; // or any tool-calling LLM

const agent = createIFlowAgent({
  apiKey: process.env.IFLOW_API_KEY!,
  llm: new ChatDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    model: "deepseek-chat",
  }),
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Find the latest news about iFlow Search." }],
});

console.log(result.messages.at(-1)?.content);
```

You bring your own LLM. Any LangChain JS chat model that supports `bindTools` works — DeepSeek, OpenAI, Anthropic, etc.

## Running real agents

To run a real agent you need **two** secrets in your environment:

- `IFLOW_API_KEY` — for iFlow Search ([get one here](https://platform.iflow.cn/))
- A key for your chosen LLM (e.g. `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`)

The tests in this example use a `vi.fn()` mock for `fetch` and **never read either real key**. Run them with:

```bash
pnpm --filter @iflow-examples/langgraph-agent test
```

## Note on `responseFormat: "content_and_artifact"`

`@iflow-ai/search-langchain` tools use LangChain's `content_and_artifact` response format, which means:

- When invoked **with a `tool_call` shape** (`{ id, name, args, type: "tool_call" }`) — i.e. the path an agent loop takes — `.invoke()` returns a `ToolMessage` with **both** `.content` (the LLM-readable summary) and `.artifact` (the full normalized result object).
- When invoked with **plain args** (`{ query: "..." }`), `.invoke()` returns **only the content string**. The artifact is dropped.

In an agent loop you always get the tool-call path, so `.artifact` is preserved automatically. If you're calling tools by hand for testing, use the `tool_call` shape if you need `.artifact`.

## Attribution headers

Every request the example sends to iFlow goes through `@iflow-ai/search-core` and carries:

```
IFlow-Source:              langchain
IFlow-Integration:         @iflow-ai/search-langchain
IFlow-Integration-Version: <package version>
User-Agent:                @iflow-ai/search-langchain/<version>
```

LangGraph traffic shows up to iFlow as `IFlow-Source: langchain` — same source ID as plain LangChain — because LangGraph is consuming the same LangChain adapter. There is no separate `langgraph` source ID for this reason.

## Real agent smoke test notes

The committed `vitest` suite covers tool wiring and agent construction with mocks. If you want to drive the agent against the real iFlow API and a real LLM, here is what to know — informed by the smoke test that validated this example end-to-end.

### Required secrets

Both are read **from the environment only**. Do not paste them into source files, lockfiles, scripts, or CI config that ends up in git.

```bash
export IFLOW_API_KEY="<your iFlow Search key>"
export DEEPSEEK_API_KEY="<your DeepSeek key, or any other tool-calling LLM key>"
```

Any tool-calling chat model works — `@langchain/openai`, `@langchain/anthropic`, `@langchain/deepseek`, etc. The example agent code itself doesn't depend on a specific LLM provider; you bring your own through the `llm` option of `createIFlowAgent`.

### `responseFormat: "content_and_artifact"` — agent path vs hand-invoked

`@iflow-ai/search-langchain` tools use LangChain's `content_and_artifact` response format. The behavior differs depending on **how** the tool is invoked:

- **Agent / tool_call path** (`tool.invoke({ id, name, args, type: "tool_call" })`) — returns a full `ToolMessage` with both `.content` (the LLM-readable summary) **and** `.artifact` (the full normalized result object). This is what a real `createReactAgent` loop produces internally, so you get artifacts automatically.
- **Plain-args path** (`tool.invoke({ query: "..." })`) — returns **only the content string**. The artifact is dropped. Use this only for quick scripts where you don't need the structured payload.

In a normal LangGraph agent loop you always get the tool_call path. If you're hand-driving tools for testing and you need `.artifact`, use the tool_call shape.

### `@langchain/core` deduplication

This workspace pins `@langchain/core` to `^1.1.44` via `pnpm-workspace.yaml` `overrides:`. If two copies of `@langchain/core` end up resolved (e.g. `0.3.x` for the LangChain adapter and `1.x` for LangGraph), `ToolMessage` instances built by one major fail to deserialize through the other major's runtime — the agent's second turn crashes with the LLM rejecting `messages[N]: missing field tool_call_id` (or similar).

If you remove the override, rerun the LangGraph agent tests before merging. If you bump `@langchain/core`, do the same.

### What a passing real smoke looks like

For a prompt like *"What is iFlow Search? Search the web and answer in one short sentence."*, with DeepSeek as the LLM:

- The LLM emits at least one `tool_call` for `iflow_web_search` (and often a follow-up `iflow_web_fetch`).
- Each iFlow request carries the attribution headers above (`IFlow-Source: langchain`, `IFlow-Integration: @iflow-ai/search-langchain`, `IFlow-Integration-Version`, `User-Agent`).
- The resulting `ToolMessage`s are returned to the LLM and the loop produces a final natural-language answer.
- Total message count is on the order of: 1 human + N AI (with tool_calls) + N tool + 1 final AI.

If any of those break, suspect — in order — the LLM provider key, the `@langchain/core` dedupe, then real network / API availability.

