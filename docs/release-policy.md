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

## When a release goes wrong

- **Wrong version published to `latest`:** do not unpublish. Publish a corrected version (bump patch) and let users move forward. Unpublishing is destructive for any consumer that resolved the bad version.
- **Wrong version published to `next`:** same — bump and publish a fix. `npm dist-tag rm` can retract the `next` pointer if the bad version must not be picked up by anyone explicitly asking for `@next`.
- **Secret leaked into a published tarball:** rotate the secret immediately at the issuing platform. Then publish a new version with the secret removed; users on the bad version must upgrade. Do not rely on `npm unpublish` to scrub the leak.
