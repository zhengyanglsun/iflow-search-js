# Release policy

How we version and publish packages in this monorepo. Read together with [`package-strategy.md`](./package-strategy.md) (what we publish) and [`integration-roadmap.md`](./integration-roadmap.md) (when).

## Currently published

- `@iflow-ai/search-core@0.1.0-pre.0` on dist-tag `next`
- `@iflow-ai/search-langchain@0.1.0-pre.0` on dist-tag `next` — its `dependencies` pin `@iflow-ai/search-core` to the same `0.1.0-pre.0` (the `workspace:*` protocol is rewritten at pack time)

Nothing is on the `latest` dist-tag yet. `npm install @iflow-ai/search-core` (without `@next`) will fail until we explicitly promote a version to `latest` — that is intentional.

## Versioning rules

1. **`pre` versions ship on `next`.** Any version that contains `-pre.`, `-alpha.`, `-beta.`, `-rc.`, or any other prerelease identifier publishes to dist-tag `next`. `latest` stays untouched.
2. **Stable versions ship on `latest`.** A version with no prerelease identifier (e.g. `0.1.0`, `0.2.0`, `1.0.0`) publishes to `latest`. Default `npm install` picks it up.
3. **Never promote a `pre` version to `latest`.** The promotion is a fresh release (`0.1.0-pre.5` → `0.1.0`), not an `npm dist-tag add` from a prerelease.
4. **Docs / examples-only changes do not bump versions.** If a commit only touches `README.md`, `docs/`, `examples/`, or `CONTRIBUTING.md`, no npm publish.
5. **`search-core` API or behavior change** → publish `search-core`, then assess whether `search-langchain`'s tool surface or attribution headers also need a release. If the adapter is unaffected, only `search-core` ships.
6. **`search-langchain` tool schema / name / behavior change** → publish `search-langchain` only. Bump the `@iflow-ai/search-core` dependency range if and only if the change requires a newer core.
7. **`search-core` must publish before `search-langchain`.** `search-langchain`'s manifest pins `@iflow-ai/search-core` to a concrete version; the registry must already serve that version when `search-langchain` is installed.

## Per-package release sequencing

For releases that touch both packages:

1. Bump `search-core` version, publish it.
2. Wait for the registry to surface the new version (`npm view @iflow-ai/search-core version` returns the new value).
3. Bump `search-langchain` version. Its `dependencies."@iflow-ai/search-core"` is `workspace:*` in source — pnpm rewrites that at pack time to the version recorded in `packages/search-core/package.json`, so the dependency just needs to match.
4. Publish `search-langchain`.

If you only changed `search-langchain`, skip steps 1–2; just bump and publish step 4.

## Pre-publish checklist

Run all of these before any `pnpm publish` (real or dry-run). All must pass; any failure aborts the publish.

- [ ] `git status` is clean and you are on `main` (or an explicitly approved release branch).
- [ ] `HEAD` is pushed and the latest GitHub CI run on it is green (`gh run list -R zhengyanglsun/iflow-search-js -L 1` shows `success`).
- [ ] `pnpm install --frozen-lockfile` succeeds — lockfile and `package.json` are in sync.
- [ ] `pnpm -r run build` — all packages build cleanly.
- [ ] `pnpm -r run typecheck` — runs *after* build, since `search-langchain` typechecks against `search-core`'s emitted `dist/index.d.ts`.
- [ ] `pnpm -r run test` — full unit suite green.
- [ ] Secret scan over the diff and the working tree finds no real API keys, tokens, or other authorization credentials. The unit suite uses `test-key-redacted` placeholders only.
- [ ] `pnpm pack` produces a tarball that contains **only** `package/dist/**`, `package/README.md`, `package/LICENSE`, `package/package.json`. No `src/`, no `test/`, no `scripts/`, no `.env`, no `node_modules`.
- [ ] In the packed `search-langchain` tarball, `package.json` `dependencies."@iflow-ai/search-core"` is the concrete version string (e.g. `"0.1.0-pre.0"`), not `"workspace:*"`. pnpm rewrites this at pack time; verify it.
- [ ] `pnpm --filter <pkg> publish --dry-run --access public --tag next` succeeds with no warnings beyond the expected "Skip publishing (dry run)" line.

## Publish commands (manual, never automated)

These are run by a maintainer from a local checkout. There is **no** GitHub Actions workflow that publishes — `.github/workflows/ci.yml` only builds, typechecks, and tests.

```bash
# Prerequisite: npm whoami returns a user with publish access to the @iflow-ai scope.

pnpm --filter @iflow-ai/search-core publish --access public --tag next
pnpm --filter @iflow-ai/search-langchain publish --access public --tag next
```

For a stable `latest` release (when ready, see Phase 5 in the roadmap):

```bash
pnpm --filter @iflow-ai/search-core publish --access public
pnpm --filter @iflow-ai/search-langchain publish --access public
```

(`--tag latest` is the default; omit the flag.)

## What does **not** go in this repo

- Real npm tokens. Authentication is the maintainer's local `~/.npmrc` or `npm login`. No `NPM_TOKEN` is ever committed, no `.npmrc` with a token is ever committed, no automated publish workflow reads a token from secrets.
- Real `IFLOW_API_KEY` / `DEEPSEEK_API_KEY` / any other provider key. Smoke scripts read these from the runtime environment.
- Automated `npm publish` in CI. This is a deliberate decision — every release is reviewed and run by a human.

## Official MCP Registry submission (`@iflow-ai/search-mcp` only)

Registry entries live at <https://registry.modelcontextprotocol.io>; the registry itself only stores metadata, while the npm tarball stays on npmjs.org.

Rules:

1. **Namespace is `io.github.zhengyanglsun/iflow-search`.** Chosen for GitHub OAuth (`mcp-publisher login github`), which grants the `io.github.<gh-user>/*` namespace. If we later move to DNS-verified `cn.iflow.*` we cut a new registry entry — npm package name is unaffected.
2. **`server.json#name` MUST equal `package.json#mcpName`.** Both currently read `io.github.zhengyanglsun/iflow-search`. They are the npm-side ownership-verification marker; the registry pulls the exact published tarball pinned in `server.json` and rejects publish if `mcpName` is missing or mismatched.
3. **A new npm release is required to change `mcpName`.** The registry validator reads `mcpName` from `package.json` inside the npm tarball at `packages[0].version`. Older tarballs (e.g. `0.1.0-pre.1`) cannot be retrofitted — any change to `mcpName` requires a fresh `pnpm publish` of a new version.
4. **Registry publish is a separate step from npm publish, and requires explicit per-release approval.** Order: (a) bump `search-mcp` version, (b) update `server.json#version` + `packages[0].version` to match, (c) run the normal pre-publish gate above, (d) `pnpm --filter @iflow-ai/search-mcp publish --access public --tag next`, (e) wait for `npm view @iflow-ai/search-mcp@<v> version` to surface, (f) `mcp-publisher login github` (interactive OAuth, browser device-code flow), (g) `mcp-publisher validate packages/search-mcp/server.json`, (h) `mcp-publisher publish packages/search-mcp/server.json`. Steps (f)–(h) are never run without an explicit maintainer go-ahead in the current session.
5. **No registry automation in CI.** Same posture as npm publish — every registry update is reviewed and run by a human.
6. **Schema pin.** `server.json#$schema` points at the dated draft (`2025-12-11`). Bumping it is its own change.

### Closure note (initial submission)

The initial registry entry was published for `io.github.zhengyanglsun/iflow-search` version `0.1.0-pre.2` after the matching npm release of `@iflow-ai/search-mcp@0.1.0-pre.2`. Order is forced — the registry validator reads `mcpName` from the npm tarball, so the npm publish must land first.

Future updates follow the same shape:

1. If `server.json#version` (and therefore `packages[0].version`) changes, the matching npm version must publish to npm first — `mcp-publisher publish` will reject a `server.json` that points at an npm version the registry cannot resolve.
2. After npm is live, run `mcp-publisher publish packages/search-mcp/server.json`. The CLI handles registry-side auth via GitHub OAuth (device-code flow); no registry token is stored in this repo or in CI.
3. If a `server.json` change is metadata-only (e.g. description or env-var docs) **and** `packages[0].version` is unchanged, no new npm release is required — only step 2.

## When a release goes wrong

- **Wrong version published to `latest`:** do not unpublish. Publish a corrected version (bump patch) and let users move forward. Unpublishing is destructive for any consumer that resolved the bad version.
- **Wrong version published to `next`:** same — bump and publish a fix. `npm dist-tag rm` can retract the `next` pointer if the bad version must not be picked up by anyone explicitly asking for `@next`.
- **Secret leaked into a published tarball:** rotate the secret immediately at the issuing platform. Then publish a new version with the secret removed; users on the bad version must upgrade. Do not rely on `npm unpublish` to scrub the leak.
