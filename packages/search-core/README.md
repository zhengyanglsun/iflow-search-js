# @iflow-ai/search-core

Framework-agnostic SDK for the [iFlow Search API](https://platform.iflow.cn/docs/) — web search, image search, web fetch.

- Zero runtime dependencies
- Node ≥ 18 (uses global `fetch`)
- Injectable `fetch` for tests
- Per-request timeout + external `AbortSignal`
- Plain-object result envelope; never throws on API errors
- Attribution headers built in (every request advertises which integration sent it)

This package is the shared core consumed by:

- `@iflow-ai/search-langchain` — LangChain JS tool adapter
- `@iflow-ai/search-mcp` — MCP server

## Install

```bash
npm i @iflow-ai/search-core
```

## Quick start

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

## API

See [`src/index.ts`](./src/index.ts) for the full public surface.

## License

MIT
