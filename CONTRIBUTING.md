# Contributing

Thanks for taking the time to look. A few quick notes before you open a PR.

## Local development

```bash
pnpm install
pnpm -r run typecheck
pnpm -r run build
pnpm -r run test
```

The repo is a pnpm workspace. Packages live under `packages/`, examples under `examples/`. Node ≥ 18 is required; CI runs on Node 22.

## Repository layout

- `packages/search-core` — framework-agnostic SDK (`@iflow-ai/search-core`)
- `packages/search-langchain` — LangChain JS tools (`@iflow-ai/search-langchain`)
- `examples/langgraph-agent` — LangGraph ReAct agent example (workspace-only, not published)

If you change anything under `packages/search-langchain` or `examples/langgraph-agent` that touches the LangChain / LangGraph tool path, rerun the LangGraph example tests — they catch cross-version `@langchain/core` regressions that the search-langchain unit tests don't see.

## API keys and secrets

- **Never commit API keys.** Not in source, not in tests, not in fixtures, not in CI config, not in commit messages.
- Tests in this repo use fake keys (`test-key-redacted`) and a mocked `fetch`. They do not need a real key to pass and must keep working without one.
- Real-network smoke tests are **opt-in**. The committed smoke scripts (e.g. `packages/search-langchain/scripts/smoke-direct.mjs`) read `IFLOW_API_KEY` from the environment at runtime — do not paste the key into the script, your shell history, or a commit. Rotate any key that leaks.

## Publishing

Publishing to npm is performed manually by a maintainer. There is intentionally no automated publish workflow in this repo. Anything pushed under `.github/workflows/` runs typecheck / build / test only.

If you need a published release, open an issue describing what changed and why a release is needed.
