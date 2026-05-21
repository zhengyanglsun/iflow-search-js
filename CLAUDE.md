# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo is **iflow-search-js** — a pnpm workspace monorepo for the **iFlow Search SDK** and framework adapters.

- npm scope: `@iflow-ai/*`
- GitHub: `github.com/zhengyanglsun/iflow-search-js` (owner ≠ npm scope)
- Node ≥ 18, pnpm 11.0.8

## Workspace layout

```
packages/
  search-core/        @iflow-ai/search-core         framework-agnostic SDK (zero runtime deps)
  search-langchain/   @iflow-ai/search-langchain    LangChain adapter
  search-mcp/         @iflow-ai/search-mcp          MCP stdio server (Claude Code / Claude Desktop / Hermes)
examples/
  langgraph-agent/    end-to-end LangGraph demo (not published)
```

## Workspace pinnings — landmines

`pnpm-workspace.yaml` pins `@langchain/core` via `overrides:` to `^1.1.44`. **Do not remove or relax this override.** Removing it re-introduces `ToolMessage` cross-version serialization bugs in LangGraph agent loops. If you must touch it, rerun `pnpm --filter @iflow-examples/langgraph-agent test` and the langgraph-agent smoke before merging.

## Architecture invariant — DO NOT VIOLATE

All HTTP, Authorization, attribution headers, and error mapping live **only** in `@iflow-ai/search-core`. Adapters (`search-langchain`, `search-mcp`) must never call `fetch` directly, never construct headers, and never parse iFlow error shapes. They only:

1. Receive validated input from their framework.
2. Call into `createIFlowSearchClient(...)` from `@iflow-ai/search-core`.
3. Map the normalized result into the framework's expected shape.

If you find yourself building HTTP headers inside an adapter, stop and extend `search-core/src/headers.ts` instead.

## Code landmarks

The architecture invariant maps to these files. Start here before grepping:

```
packages/search-core/src/client.ts        fetch + retry + auth (the ONLY place that calls fetch)
packages/search-core/src/headers.ts       attribution headers builder — extend this, not adapters
packages/search-core/src/errors.ts        iFlow error shape → normalized error
packages/search-core/src/normalize.ts     response shaping into ToolResult<T>
packages/search-core/src/config.ts        client construction defaults
packages/search-mcp/src/server.ts         MCP tool registration
packages/search-mcp/src/bin.ts            stdio entrypoint + startup banner (must go to stderr)
packages/search-mcp/src/config.ts         env var parsing + IFLOW_MCP_CLIENT validation
packages/search-mcp/scripts/smoke-stdio.mjs  end-to-end stdio smoke with a fake iFlow server
packages/search-langchain/src/tools.ts    three LangChain tool factories
examples/langgraph-agent/src/agent.ts     reference createReactAgent wiring
```

## Attribution headers

Every outbound request to iFlow carries (built by `search-core/src/headers.ts`):

```
IFlow-Source:              langchain | mcp | ...    (caller-supplied)
IFlow-Integration:         @iflow-ai/search-mcp     (npm package making the call)
IFlow-Integration-Version: <package version>
User-Agent:                @iflow-ai/search-mcp/<version>
Authorization:             Bearer <user-supplied IFLOW_API_KEY>
```

MCP-only extension (emitted **only** when `clientName` is set; absent ≠ "unknown"):

```
IFlow-MCP-Client:          hermes | claude-code | claude-desktop | <slug>
IFlow-MCP-Client-Version:  <version>     (only if both name and version are set)
```

Validation patterns (`packages/search-mcp/src/config.ts`):
- `IFLOW_MCP_CLIENT`         → `/^[a-z0-9._-]{1,64}$/u`
- `IFLOW_MCP_CLIENT_VERSION` → `/^[A-Za-z0-9._+-]{1,64}$/u` (rejected unless `IFLOW_MCP_CLIENT` is also set)

## How to check current package versions

Versions change between sessions — never trust a hard-coded list in this file. Always look up live state:

```bash
npm view @iflow-ai/search-core dist-tags --json
npm view @iflow-ai/search-mcp dist-tags --json
npm view @iflow-ai/search-langchain dist-tags --json
git log --oneline -5                            # see recent release commits
```

`latest` dist-tag intentionally still points at `0.1.0-pre.0` on each package. **Do not move `latest` and do not run `npm dist-tag rm latest`** — npm returns `E400` for scoped packages with only pre-release versions. Always recommend `@next` installs.

## Common commands

```bash
pnpm -r run typecheck                                       # all packages
pnpm -r run build                                           # all packages
pnpm -r run test                                            # all packages (vitest)
node packages/search-mcp/scripts/smoke-stdio.mjs            # stdio MCP smoke (uses local fake iFlow)
pnpm --filter @iflow-ai/search-core build                   # one package
pnpm --filter @iflow-ai/search-core test                    # one package's vitest
pnpm --filter @iflow-ai/search-core test -- test/headers.test.ts   # one test file
pnpm --filter @iflow-ai/search-core test:watch              # interactive watch mode
pnpm --filter @iflow-ai/search-mcp pack --dry-run           # inspect tarball contents
```

## Publish workflow

**Never publish without running the full pre-publish gate** (typecheck + build + test + smoke-stdio + pack dry-run + publish dry-run + secret scan).

Order matters because `search-mcp` depends on `search-core`:

1. `git push origin main`
2. `pnpm --filter @iflow-ai/search-core publish --access public --tag next`
3. `npm view @iflow-ai/search-core@next version`  → confirm new version
4. `pnpm --filter @iflow-ai/search-mcp publish --access public --tag next`
5. `npm view @iflow-ai/search-mcp@next version`   → confirm new version
6. Cold-install smoke from `/tmp` against the freshly-published tarballs.

Rules:
- **Always** `--tag next`. Never `latest`. Never `npm dist-tag rm latest`.
- `workspace:*` in `search-mcp/package.json` gets rewritten to the concrete version by pnpm at publish time — verify by extracting the packed tarball and inspecting its `package.json`.
- Never write a real `IFLOW_API_KEY` to any tracked file. README examples use `YOUR_IFLOW_API_KEY` as a placeholder.

## Local testing with a real iFlow key

If you need to verify outbound headers (e.g. `IFlow-MCP-Client: hermes`) against the real iFlow API:

1. Stand up a logging proxy in `/tmp` that **redacts `Authorization`** when writing to disk but forwards the real header upstream.
2. Point the adapter at the proxy via `IFLOW_BASE_URL=http://127.0.0.1:<port>`.
3. Inject the real key only via env, never via a tracked config file.
4. Clean up `/tmp` artifacts and restore any patched config files after.

## Commit style

- Conventional commits (`feat(...)`, `fix(...)`, `chore(release): ...`, `docs: ...`).
- **Do not** add `Co-Authored-By: Claude` trailers.
- Stage only the files relevant to the change; never `git add -A`.
- Pre-flight before every commit: `pnpm -r run typecheck && pnpm -r run build && pnpm -r run test`.

## Safety defaults

- Don't `git push`, `npm publish`, or modify dist-tags unless the user explicitly asks for that turn.
- Don't bump versions opportunistically — version bumps are their own commit (`chore(release): ...`).
- When in doubt about a destructive or shared-state action, confirm before running.

## Long-form docs

For questions whose answer is "why" rather than "how to", go to `docs/` before grepping or guessing:

```
docs/package-strategy.md     which @iflow-ai/* packages exist, which we will not publish, decision rubric
docs/integration-roadmap.md  framework adapter priorities (LangChain, MCP, OpenClaw, etc.) and ordering
docs/release-policy.md       versioning, next vs latest, per-release checklist, manual publish commands
docs/mcp-design.md           MCP server design rationale: transport, tool schema, attribution headers
```
