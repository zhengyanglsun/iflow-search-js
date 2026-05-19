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
