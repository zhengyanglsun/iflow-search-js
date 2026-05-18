# iflow-search-js

Monorepo for the iFlow Search SDK and its framework integrations.

## Packages

| Package | Status | Purpose |
|---|---|---|
| [`@iflow-ai/search-core`](./packages/search-core) | in development | Framework-agnostic SDK: HTTP client, normalization, errors, attribution headers. Zero runtime deps. |
| `@iflow-ai/search-langchain` | planned | LangChain JS tool factories (also used by LangGraph). |
| `@iflow-ai/search-mcp` | planned | Standalone MCP server (stdio + Streamable HTTP). |

## Examples (planned)

- `examples/langchain-basic/` — LangChain agent with iFlow tools
- `examples/langgraph-agent/` — LangGraph `createReactAgent` consuming the LangChain tools
- `examples/hermes-mcp/` — Hermes Agent config snippet that wires up the MCP server

## Develop

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
```

## License

MIT — see [LICENSE](./LICENSE).
