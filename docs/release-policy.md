# Release policy

How we version and publish packages in this monorepo. Read together with [`package-strategy.md`](./package-strategy.md) (what we publish) and [`integration-roadmap.md`](./integration-roadmap.md) (when).

## Currently published

| Package | `latest` | `next` | Notes |
|---|---|---|---|
| `@iflow-ai/search-core` | `0.1.0-pre.0` | `0.1.0-pre.1` | Zero runtime deps. Adapters' `workspace:*` is rewritten at pack time to whichever version is in `packages/search-core/package.json` at that moment. |
| `@iflow-ai/search-mcp` | `0.1.0-pre.0` | `0.1.0-pre.2` | Pins `@iflow-ai/search-core` to the rewritten concrete version. Registry entry `io.github.zhengyanglsun/iflow-search` tracks `0.1.0-pre.2`. |
| `@iflow-ai/search-openapi` | `0.1.0-pre.0` | `0.1.0-pre.2` | Pins `@iflow-ai/search-core` to the rewritten concrete version. |
| `@iflow-ai/search-langchain` | `0.1.0-pre.0` | `0.1.0-pre.0` | Pins `@iflow-ai/search-core` to the rewritten concrete version. Has not been re-cut on `@next` since first publish. |

Every `latest` pointer above is the **first-publish auto-assignment** — npm sets `latest` on a brand-new scoped package even when you publish only with `--tag next`. We have not deliberately moved any of them. Run `npm view @iflow-ai/<pkg> dist-tags --json` to read live state; this table is a snapshot, not the source of truth.

For installs, **prefer `@next`** until the stable `0.1.0` cutover lands. Bare `npm install @iflow-ai/<pkg>` currently resolves to whatever first-publish version happens to sit on `latest` (always `0.1.0-pre.0` for these four packages), not the most recent prerelease. Do **not** attempt `npm dist-tag rm @iflow-ai/<pkg> latest` to "fix" this — npm returns `E400` for scoped packages whose only versions are prereleases, and the operation will be rejected.

## Versioning rules

1. **`pre` versions ship on `next`.** Any version that contains `-pre.`, `-alpha.`, `-beta.`, `-rc.`, or any other prerelease identifier publishes to dist-tag `next`. `latest` stays untouched.
2. **Stable versions ship on `latest`.** A version with no prerelease identifier (e.g. `0.1.0`, `0.2.0`, `1.0.0`) publishes to `latest`. Default `npm install` picks it up.
3. **Never promote a `pre` version to `latest`.** The promotion is a fresh release (`0.1.0-pre.5` → `0.1.0`), not an `npm dist-tag add` from a prerelease.
4. **Docs / examples-only changes do not bump versions.** If a commit only touches `README.md`, `docs/`, `examples/`, or `CONTRIBUTING.md`, no npm publish.
5. **`search-core` API or behavior change** → publish `search-core`, then assess each adapter (`search-mcp`, `search-openapi`, `search-langchain`) for whether its tool surface or attribution headers also need a release. Adapters that are unaffected do not ship.
6. **Adapter-only change** (`search-mcp` / `search-openapi` / `search-langchain` tool schema / name / behavior) → publish that adapter only. Bump the `@iflow-ai/search-core` dependency range if and only if the change requires a newer core.
7. **`search-core` must publish before any adapter that bumps its core dep.** Every adapter manifest pins `@iflow-ai/search-core` to a concrete version (the `workspace:*` protocol is rewritten at pack time); the registry must already serve that version when the adapter is installed.

## Per-package release sequencing

For releases that touch `search-core` plus one or more adapters:

1. Bump `search-core` version, publish it.
2. Wait for the registry to surface the new version (`npm view @iflow-ai/search-core version` returns the new value).
3. Bump each adapter whose source changed. Its `dependencies."@iflow-ai/search-core"` is `workspace:*` in source — pnpm rewrites that at pack time to the version recorded in `packages/search-core/package.json`, so the dependency just needs to match.
4. Publish the adapters. Order among `search-mcp` / `search-openapi` / `search-langchain` is maintainer preference — they do not depend on each other.

If you only changed one adapter, skip steps 1–2; just bump and publish step 4 for that adapter alone.

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
- [ ] In each adapter tarball being released (`search-mcp`, `search-openapi`, `search-langchain`), `package.json` `dependencies."@iflow-ai/search-core"` is the concrete version string (e.g. `"0.1.0-pre.2"`), not `"workspace:*"`. pnpm rewrites this at pack time; verify it for every adapter actually being shipped.
- [ ] `pnpm --filter <pkg> publish --dry-run --access public --tag next` succeeds with no warnings beyond the expected "Skip publishing (dry run)" line.

## Publish commands (manual, never automated)

These are run by a maintainer from a local checkout. There is **no** GitHub Actions workflow that publishes — `.github/workflows/ci.yml` only builds, typechecks, and tests.

Prerequisite for both blocks: `npm whoami` returns a user with publish access to the `@iflow-ai` scope.

Prerelease (default for ongoing work — every release on `next`):

```bash
pnpm --filter @iflow-ai/search-core publish --access public --tag next
pnpm --filter @iflow-ai/search-mcp publish --access public --tag next
pnpm --filter @iflow-ai/search-openapi publish --access public --tag next
pnpm --filter @iflow-ai/search-langchain publish --access public --tag next
```

Skip any package whose source did not change since its current `@next`. `search-core` must publish first when its version bumps; adapter ordering among themselves is maintainer preference.

Stable `latest` release (when ready, see Phase 5 in the roadmap):

```bash
pnpm --filter @iflow-ai/search-core publish --access public
pnpm --filter @iflow-ai/search-mcp publish --access public
pnpm --filter @iflow-ai/search-openapi publish --access public
pnpm --filter @iflow-ai/search-langchain publish --access public
```

(`--tag latest` is the default; omit the flag.) Same ordering rule — `search-core` first. For the stable `0.1.0` cutover the recommended scope is all four packages together; see the next section.

## Stable `0.1.0` cutover

The promotion from `0.1.0-pre.*` on `next` to stable `0.1.0` on `latest`. Recommended scope: all four public packages together — `search-core`, `search-mcp`, `search-openapi`, `search-langchain`. Splitting the cutover keeps mixed-version installs alive (e.g. stable adapter resolving a prerelease `search-core`) for no real benefit, since core is a transitive dep of every adapter.

Six steps, in order. Each one is its own commit / action; do not collapse them.

1. **Docs-prep commit.** Refresh this file, the per-package READMEs that quote a current pin, and `docs/integration-roadmap.md`. **No version bumps in this commit.** Lands on `main` before any release commit so that downstream docs already describe the upcoming cut. Commit message style: `docs(release): refresh release-policy and README pins before stable 0.1.0`.
2. **Release commit.** Bumps exactly five tracked files: the four `packages/*/package.json` from `0.1.0-pre.*` to `0.1.0`, plus `packages/search-mcp/server.json` (both `version` and `packages[0].version` to `0.1.0`). No other source change in the same commit. `pnpm-lock.yaml` does not need to move — the only edits are version strings. Commit message style: `chore(release): @iflow-ai/* 0.1.0`. Push to `main` after the full pre-publish gate above passes.
3. **npm publish in order.** `search-core` first — every adapter pins it to a concrete version through the `workspace:*` rewrite, so the registry must already serve `0.1.0` before any adapter ships. Then the three adapters in any order. Stable publish: no `--tag` flag (default `latest`). After each, `npm view @iflow-ai/<pkg>@latest version` must surface `0.1.0` before moving on.
4. **MCP Registry republish.** Once `npm view @iflow-ai/search-mcp@0.1.0 version` returns `0.1.0`, run `mcp-publisher login github` (if the session token has expired), then `mcp-publisher validate packages/search-mcp/server.json` and `mcp-publisher publish packages/search-mcp/server.json`. The validator reads `mcpName` from the live npm tarball at `packages[0].version`; if the npm publish has not yet propagated, the registry publish will fail. No registry-side change is required for `search-core`, `search-openapi`, or `search-langchain`.
5. **Cold-install smoke from `/tmp`.** In an empty temp directory, `npm install @iflow-ai/search-core @iflow-ai/search-mcp @iflow-ai/search-openapi @iflow-ai/search-langchain` (no `@next`) and verify each tarball resolves to `0.1.0` and `dependencies."@iflow-ai/search-core"` in each adapter's installed `package.json` is the concrete `"0.1.0"`. Optional: end-to-end smoke against a known-good `IFLOW_API_KEY` for at least one tool per adapter — but never write that key into any tracked file.
6. **Post-release docs commit.** Update the "Currently published" table in this file to the new `latest` row, flip the prerelease banners in `packages/search-mcp/README.md` and `packages/search-openapi/README.md`, and revise `docs/integration-roadmap.md` Phase 5 to reflect the completed cutover. Commit message style: `docs(release): record stable 0.1.0 release`.

External-PR status (Hermes Agent docs PR, LangChain JS docs PR, Open WebUI tool-server registry PR) is **not** a gate. Those are upstream-side and their merge timing is independent of this monorepo's publish.

If anything in steps 3–5 reveals a problem after a tarball has already been published, follow the "When a release goes wrong" rules below — **do not `npm unpublish`**. Bump to `0.1.1` and re-cut.

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
