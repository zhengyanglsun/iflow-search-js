# iFlow Search JavaScript package strategy

How we decide what becomes a published npm package and what does not. The goal is to keep the public package surface small enough to maintain long-term while still serving every framework and runtime we care about.

## Core principles

1. **Do not publish a new npm package for every framework integration.** Each additional published package adds a release cadence, a peer-dependency matrix, a README, a tarball to vet, and a versioning question. The cost compounds; the benefit usually does not.
2. **All shared logic belongs in `@iflow-ai/search-core`.** Request signing, attribution headers, retries, timeouts, normalization, error shape, and shared TypeScript types live there and only there. Adapters must not re-implement HTTP or re-shape errors.
3. **Adapters are thin.** A framework adapter exists to translate iFlow concepts into that framework's idioms (tool schema, message shape, streaming contract). If an adapter starts to grow business logic, that logic belongs back in `search-core`.
4. **Prefer config / OpenAPI / MCP / examples over a new package.** If the framework can consume an OpenAPI plugin, an MCP server, or a copy-paste example, that is the recommended integration path — not a bespoke npm package.
5. **Pre-1.0 releases ship on the `next` npm dist-tag.** `latest` is reserved for versions we are willing to support. See `release-policy.md` for the gate.

## Current npm package layout

### 1. `@iflow-ai/search-core` — **maintained**

Framework-agnostic core client. **The only place** the iFlow HTTP surface is implemented.

Responsibilities:

- `webSearch`, `imageSearch`, `webFetch`
- `baseUrl`, `timeout`, abort handling
- Attribution headers (`IFlow-Source`, `IFlow-Integration`, `IFlow-Integration-Version`, `User-Agent`)
- Error normalization (`{ ok, data | error }`)
- Response normalization and shared TypeScript types

Zero runtime dependencies. All other packages in this repo (and all future ones) consume `search-core` rather than calling iFlow directly.

### 2. `@iflow-ai/search-langchain` — **maintained**

LangChain JS tool factories. Used by both LangChain agents and LangGraph agents — see `examples/langgraph-agent` for the LangGraph wiring.

Responsibilities:

- LangChain `tool()` schema (`iflow_web_search`, `iflow_image_search`, `iflow_web_fetch`)
- Tool names (stable; renaming is a breaking change)
- `content` / `artifact` mapping via `responseFormat: "content_and_artifact"`
- Sets `IFlow-Source: langchain` on the inner `search-core` client

Does **not** re-implement API requests. Peer-depends on `@langchain/core` and `zod` so the host application controls those versions.

### 3. `@iflow-ai/search-mcp` — **planned**

Future MCP server covering Hermes, Claude Code, Claude Desktop, and other MCP clients in one package.

- Not implemented yet. Do not stub it.
- Will depend on `@iflow-ai/search-core` and an MCP server SDK.
- Single MCP package is sufficient for the entire MCP ecosystem — there is no reason to fan out into `search-hermes`, `search-claude-code`, etc.

### 4. `@iflow-ai/iflow-plugin` — **maintained separately**

OpenClaw / ClawHub plugin. Lives in its own repository and ships as its own npm package.

- Continue to maintain independently of this monorepo.
- May internally consume `@iflow-ai/search-core` in a future refactor to remove duplicated HTTP logic.
- **Do not** create `@iflow-ai/search-openclaw` — the OpenClaw integration is the plugin itself.

## Packages we explicitly will not create

Each of the following has been considered and rejected. The reason is recorded so we do not relitigate it every release.

### `@iflow-ai/search-langgraph`

LangGraph consumes LangChain tools directly via `createReactAgent` and `ToolNode`. A separate package would be a re-export with no behavior change, no schema change, and no attribution-header change. Users wire `@iflow-ai/search-langchain` into LangGraph instead, and `examples/langgraph-agent` demonstrates the pattern.

### `@iflow-ai/search-hermes`

Hermes Agent is an MCP client. The forthcoming `@iflow-ai/search-mcp` covers it. Publishing a Hermes-specific package would duplicate that surface and lock us into Hermes-specific releases that drift from the MCP spec.

### `@iflow-ai/search-claude-code`

Claude Code consumes MCP servers and skills. Coverage comes from `@iflow-ai/search-mcp` (server) or a published skill — neither needs a Claude-Code-specific npm package.

### `@iflow-ai/search-openwebui`

Open WebUI's first-class integration paths are OpenAPI tools and MCP. We will publish an OpenAPI spec / MCP server, not an Open-WebUI-specific npm package.

### `@iflow-ai/search-coze`

Coze ingests OpenAPI plugins and HTTP tools. Same reasoning as Open WebUI — config and OpenAPI cover it; an npm package does not.

### `@iflow-ai/search-crewai`

CrewAI is Python. If we ever need a Python adapter it ships on PyPI, not npm. In the meantime CrewAI users can call the planned MCP server.

### `@iflow-ai/search-openclaw`

OpenClaw integration is `@iflow-ai/iflow-plugin`, which already exists and ships through ClawHub. Creating a parallel npm-only package would fragment the integration story.

## Decision rubric for any future "should this be a package?" question

Before opening a new package directory under `packages/`, every "yes" below must hold:

1. Does the target framework consume npm packages directly? (If not — MCP server, OpenAPI spec, or example instead.)
2. Is there real adapter code, not just re-exports? (If only re-exports — document the wiring in an example.)
3. Can it be expressed as a thin wrapper over `@iflow-ai/search-core`? (If not, the missing capability belongs in `search-core` first.)
4. Are we willing to commit to the release cadence and peer-dep matrix for this package long-term?

If any answer is "no", the integration ships as an example, an MCP server, an OpenAPI document, or a contribution back to `search-core` — not as a new published package.
