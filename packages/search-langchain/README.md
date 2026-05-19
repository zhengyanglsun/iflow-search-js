# @iflow-ai/search-langchain

LangChain JS tool factories for the [iFlow Search API](https://platform.iflow.cn/docs/) — exposes `iflow_web_search`, `iflow_image_search`, `iflow_web_fetch`.

Built on top of [`@iflow-ai/search-core`](../search-core). Works with LangChain JS agents and LangGraph (since LangGraph consumes LangChain tools directly).

LangGraph users: there is intentionally no separate `@iflow-ai/search-langgraph` package — pass these tools straight into `createReactAgent` / `ToolNode`. See [`examples/langgraph-agent`](../../examples/langgraph-agent) for an end-to-end ReAct example.

## Install

```bash
npm i @iflow-ai/search-langchain @langchain/core zod
```

## Usage

```ts
import { createIFlowSearchTools } from "@iflow-ai/search-langchain";

const tools = createIFlowSearchTools({
  apiKey: process.env.IFLOW_API_KEY!,
});

// Hand the tools to any LangChain agent or LangGraph `createReactAgent`.
```

Each tool returns a `content_and_artifact` two-tuple:

- **content** — a short, LLM-friendly text summary
- **artifact** — the full normalized result object from `@iflow-ai/search-core`

Tool errors (missing key, network errors, API errors) are surfaced as thrown `Error`s so the agent loop sees them.

## API

```ts
createIFlowWebSearchTool(options)    // → iflow_web_search
createIFlowImageSearchTool(options)  // → iflow_image_search
createIFlowWebFetchTool(options)     // → iflow_web_fetch
createIFlowSearchTools(options)      // → [webSearch, imageSearch, webFetch]
```

Options:

```ts
interface IFlowLangChainOptions {
  apiKey: string;
  baseUrl?: string;     // default "https://platform.iflow.cn"
  timeoutMs?: number;   // default 30_000
  fetch?: typeof fetch; // injectable for tests
}
```

The adapter automatically advertises itself to the iFlow backend with:

```
IFlow-Source:              langchain
IFlow-Integration:         @iflow-ai/search-langchain
IFlow-Integration-Version: <package version>
User-Agent:                @iflow-ai/search-langchain/<version>
```

## License

MIT
