# Platform smoke results — `@iflow-ai/search-openapi`

Results from end-to-end smokes of published `@iflow-ai/search-openapi@next`
against real third-party agent platforms. Source of truth for what works
out-of-the-box vs. what requires a host-specific overlay, and which gaps
should drive the next iteration.

Smoke targets, in chronological order:

- `@iflow-ai/search-openapi@0.1.0-pre.1` — initial real-platform run.
  Open WebUI passed against canonical `/openapi.json`. Coze passed
  **only** via a host-specific overlay applied at import time. Recorded
  below under the pre.1 sections.
- `@iflow-ai/search-openapi@0.1.0-pre.2` — published re-smoke after the
  Coze-flavored route landed in source. Open WebUI re-verified at the
  HTTP layer (browser UI not rerun; canonical contract preserved). Coze
  passed end-to-end via the published `/openapi.coze.json` — **no
  host-specific overlay needed**. Recorded below under the pre.2 section.

Re-verify the current `@next` dist-tag with
`npm view @iflow-ai/search-openapi@next version`. The `latest` dist-tag
is intentionally still `0.1.0-pre.0` — see
[release-policy.md](./release-policy.md).

## Open WebUI — passes against canonical `/openapi.json`

| | |
|---|---|
| Tool Server URL given to Open WebUI | `http://localhost:8787` |
| Auth field in Open WebUI | None (open mode) |
| Server invocation | `IFLOW_OPENAPI_CLIENT=open-webui IFLOW_OPENAPI_CORS_ORIGIN='*' PORT=8787 npx -y @iflow-ai/search-openapi@next` |
| `iflow_web_search` | ✅ 3 results |
| `iflow_image_search` | ✅ 3 images |
| `iflow_web_fetch` | ✅ page title returned |

CORS gating was the load-bearing fix. Open WebUI's chat-time tool calls
are browser-side, and the browser includes `X-Session-Id` on every POST.
Chrome's CORS algorithm rejects a preflight whose `Access-Control-Allow-Headers`
isn't a case-insensitive superset of `Access-Control-Request-Headers`, so an
ACAH of just `Content-Type, Authorization` produced `TypeError: Failed to fetch`
on every tool call even though Open WebUI's own connect-test (backend-side) passed.

Fix landed in `packages/search-openapi/src/server.ts` —
`CORS_ALLOWED_HEADERS = "Content-Type, Authorization, X-Session-Id"`. Tested
in `packages/search-openapi/test/server.test.ts` with an explicit OPTIONS
preflight that includes `x-session-id` in ACRH.

**No host-specific overlay required for Open WebUI.** The published `/openapi.json`
is consumed directly.

## Coze — passes only via a host-specific overlay

The published `/openapi.json` is NOT directly importable into Coze today.
The smoke succeeded only after applying a Coze-specific overlay to the raw
OpenAPI document at import time. Coze Debug **and** Agent invocation both
passed against that overlay; the canonical spec did not.

### Working overlay shape (Coze v3, used for the green run)

- `openapi: "3.0.3"` (downgraded from canonical 3.1.0)
- `servers: [{ url: "<public tunnel URL>" }]` (canonical spec omits `servers`)
- No `security` block — neither global nor per-operation
- No `components.securitySchemes`
- Inline `200` response `data` schemas with concrete `properties`; no `$ref`,
  no `oneOf`/`anyOf`/`allOf`. Field names match the live server payload.
- Fresh `operationId`s (e.g. `iflow_web_search_open3`) on each retry to
  bypass Coze's plugin-cache key collisions
- Server run in **open mode** (no `IFLOW_OPENAPI_AUTH_TOKEN`) and exposed via
  `cloudflared tunnel --url http://127.0.0.1:8787`

### Failure modes observed against the canonical spec (in order encountered)

1. **OpenAPI 3.1.0 → `Invalid params`** at Coze's import step. Downgrading
   the `openapi` field to `3.0.3` is sufficient; no other schema-level
   changes were needed for parsing.
2. **`BearerAuth` securityScheme → `security requirements failed: missing AuthenticationFunc`**
   at Coze's runtime. Coze's HTTP plugin runtime requires its own
   AuthenticationFunc binding when an OpenAPI `security` block is declared.
   Stripping the security block and switching the server to open mode is the
   only working path until/unless Coze fixes the bridge.
3. **No `servers` array → `no such host`** (Coze can't resolve the upstream
   if the tunnel URL isn't pinned in the spec). Quick `cloudflared` tunnel
   URLs also rotate when the process restarts, so the overlay must be
   regenerated after every tunnel restart.
4. **`data: { type: "object" }` (default schema) → Agent renders `data {0}`**
   even though the HTTP call returned `ok: true` with real results. Coze's
   Agent JSON parser collapses untyped `data` to an empty object; inlining
   concrete `data.*` properties is what unblocks the model from quoting
   actual fields. Debug mode tolerates the untyped form; Agent does not.

### What we deliberately did NOT do

- Modify `packages/search-openapi/src/openapi.ts` to mutate the canonical
  spec for Coze. Per-platform branching at the source belongs in a follow-up
  release with broader consensus, not in a one-off smoke.
- Add a Coze-specific package or build step. The canonical OpenAPI doc is
  meant to be one document; the right move is to make that one document more
  consumable, not to fork it.
- Implement `IFLOW_OPENAPI_PUBLIC_URL` mid-smoke. Listed below as a
  recommendation instead.

## Pre.2 published real-platform smoke — passed

Re-smokes against the published `@iflow-ai/search-openapi@0.1.0-pre.2`
tarball (`@next` at smoke time; `latest` intentionally untouched at
`0.1.0-pre.0` — see [release-policy.md](./release-policy.md)). This
section records what changed vs. the pre.1 results above; the pre.1
sections are kept as historical record of the overlay-driven Coze path
that pre.2 makes unnecessary.

### Open WebUI — HTTP-level re-smoke against published `@next`

| | |
|---|---|
| Tarball | `@iflow-ai/search-openapi@0.1.0-pre.2` via `npx -y @iflow-ai/search-openapi@next` |
| `GET /health` | ✅ `{ ok: true, version: "0.1.0-pre.2" }` |
| `GET /openapi.json` | ✅ `openapi: "3.1.0"`, 3 canonical tool paths |
| `OPTIONS /tools/iflow_web_search` (browser-style preflight with `x-session-id`) | ✅ `204`, `Access-Control-Allow-Headers` includes `X-Session-Id` |
| `POST iflow_web_search` (real iFlow API, `Origin: http://localhost:3000`) | ✅ |
| `POST iflow_image_search` (real iFlow API) | ✅ |
| `POST iflow_web_fetch` (real iFlow API) | ✅ |
| POST response CORS | ✅ `Access-Control-Allow-Origin: *`, `Vary: Origin`, ACAH includes `X-Session-Id` |

Browser-side Open WebUI UI was **not** re-driven on pre.2. The pre.1 UI
run above already verified end-to-end behavior against the canonical
`/openapi.json`, and the pre.2 canonical document preserves that
contract — same paths, operationIds, OAS version, security shape,
request schemas, and 200 / 400 / 401 / default response slots. The new
inline `data.*` properties are strictly additive (Open WebUI ignored
them on pre.1 too).

### Coze — operator-driven UI smoke against published `@next`

| | |
|---|---|
| Endpoint imported into Coze | `<transient cloudflared tunnel URL>/openapi.coze.json` |
| Coze Authentication | None |
| `IFLOW_OPENAPI_AUTH_TOKEN` | unset — server in open mode |
| `IFLOW_OPENAPI_OPERATION_SUFFIX` | unset — default operationIds |
| `IFLOW_OPENAPI_PUBLIC_URL` | set to the same transient tunnel URL so `servers[0].url` resolves |
| Coze import | ✅ direct from `/openapi.coze.json` — **no raw overlay paste needed** |
| Final verified operationIds | `iflow_web_search`, `iflow_image_search`, `iflow_web_fetch` (no `_open3` suffix) |
| Tool Debug | ✅ operator reported success for all three tools |
| Agent invocation | ✅ operator reported success for all three tools |

The real `*.trycloudflare.com` host is **redacted on purpose**. Quick
`cloudflared` tunnels rotate on every process restart and have no
historical value — re-running this smoke produces a new URL each time.

An earlier exploratory run used `IFLOW_OPENAPI_OPERATION_SUFFIX=open3`
as a Coze-plugin-cache buster, which produced operationIds
`iflow_web_search_open3` etc. The **final verified pre.2 Coze run**
above did **not** use the suffix — Coze imported the default-named
operationIds directly. `IFLOW_OPENAPI_OPERATION_SUFFIX` remains an
optional cache-buster (documented in
`packages/search-openapi/README.md`), not a default for normal Coze
setup.

### Pre.1 failure modes — resolved by pre.2

| Pre.1 failure | Resolution in pre.2 |
|---|---|
| `Invalid params` at Coze import (OAS 3.1.0) | `/openapi.coze.json` advertises `openapi: "3.0.3"` |
| `security requirements failed: missing AuthenticationFunc` at Coze runtime | `/openapi.coze.json` never declares `security` or `components.securitySchemes`; Coze Auth = None |
| `no such host` at Coze runtime | `IFLOW_OPENAPI_PUBLIC_URL` injects the public base into `servers[0].url` of `/openapi.coze.json` |
| Coze Agent renders `data {0}` | Inline `data.*` schemas in every 200 response (canonical and Coze profiles) |

The pre.1 raw-overlay workflow under [Reproduction sketch](#reproduction-sketch) below remains in this doc as historical record only; it is **not** needed for pre.2.

## Reproduction sketch

```bash
# Server (open mode, CORS open, identifies as coze in the banner only)
IFLOW_OPENAPI_CLIENT=coze \
  IFLOW_OPENAPI_CORS_ORIGIN='*' \
  PORT=8787 \
  npx -y @iflow-ai/search-openapi@next

# Public URL for Coze (Coze cannot reach localhost)
cloudflared tunnel --url http://127.0.0.1:8787

# Then, off-tree (e.g. in /tmp), build the Coze overlay:
#   - fetch the canonical /openapi.json
#   - rewrite openapi -> 3.0.3
#   - inject servers[0].url = <tunnel URL>
#   - delete every security block + components.securitySchemes
#   - replace each 200 response schema with inline concrete `data` properties
#   - rename operationIds to a fresh suffix
# and paste the result into Coze's "Raw data" import tab. Auth field: none.
```

Keep all overlay artifacts under `/tmp/` — never write them into the repo,
never include a real `IFLOW_API_KEY` or any bearer-style token, and verify
with a `grep -E '"security"|BearerAuth|securitySchemes|Authorization|sk-'`
scan before pasting.

## Trust boundary

Both smokes ran against the real iFlow Search API. No mocks were
involved — the wire shapes (e.g. `results.items.{title,url,snippet}`,
`images.items.{imageUrl,sourceUrl}`, `web_fetch.data.{url,content,fromCache}`)
were verified against `packages/search-core/src/normalize.ts`.

Wire path of each smoke:

- **Open WebUI**: OWUI (same host) → `http://localhost:8787`
  (search-openapi process; holds `IFLOW_API_KEY` in its process env) →
  `https://platform.iflow.cn` (real iFlow Search API).
- **Coze**: Coze cloud → cloudflared quick tunnel → `http://127.0.0.1:8787`
  (search-openapi process; holds `IFLOW_API_KEY` in its process env) →
  `https://platform.iflow.cn`.

In both topologies `IFLOW_API_KEY` never leaves the search-openapi
process. The platform (Open WebUI or Coze) only ever sees (a) the
OpenAPI server's URL and (b) — at most — an operator-chosen
`IFLOW_OPENAPI_AUTH_TOKEN`, which is **not** the iFlow key.

Coze ran in open mode (no `IFLOW_OPENAPI_AUTH_TOKEN`) because of the
`AuthenticationFunc` limitation documented above. For a production-style
Coze deployment, push the auth gate to the tunnel / reverse-proxy layer
(Cloudflare Access policy on a named tunnel, an nginx layer that checks
a fixed header before proxying, or a managed API gateway in front of the
server) — not to `IFLOW_OPENAPI_AUTH_TOKEN`, which Coze cannot satisfy.

`DEEPSEEK_API_KEY` is unrelated to the OpenAPI smokes — it appears only
in `examples/langgraph-agent` to authenticate that demo's LLM, and is
not read by `@iflow-ai/search-openapi`.

## Next-step notes for `pre.2` / `0.2.0`

In priority order:

1. **Inline `200` response `data` schemas in `packages/search-openapi/src/openapi.ts`** — ✅ **landed in unreleased pre.2 source.**
   `openapi.ts` now emits concrete `data.*` properties for all three tools
   (`results.items.{title,url,snippet,position,date}`,
   `images.items.{imageUrl,title,sourceUrl,width,height,position}`,
   `web_fetch.data.{url,title,content,fromCache,tookMs}`) in both the
   canonical 3.1 document and the new Coze-flavored 3.0.3 document. Strictly
   additive for Open WebUI; unblocks Coze's Agent renderer from collapsing
   `data` to `{0}`. Locked down by `packages/search-openapi/test/openapi.test.ts`
   under the "concrete inline 200 data schemas" block.
2. **Add `IFLOW_OPENAPI_PUBLIC_URL` env var** to inject `servers[0].url` — ✅ **landed in unreleased pre.2 source.**
   Validated against the same URL-shape rules as `IFLOW_OPENAPI_CORS_ORIGIN`
   (minus the `*` wildcard). Applied to both `/openapi.json` and
   `/openapi.coze.json` when set. Companion env var
   `IFLOW_OPENAPI_OPERATION_SUFFIX` (`[a-z0-9_-]{1,32}`) is also new —
   appends `_<suffix>` to every operationId for cache-busting without
   touching URL paths.
3. **Two-flavor OpenAPI: keep `/openapi.json` on 3.1, add `/openapi.coze.json` on 3.0.3** — ✅ **landed in unreleased pre.2 source** (chosen over a default-version flip).
   `buildOpenApiDocument({ profile: "canonical" | "coze" })` drives both
   from the same handler list. The Coze flavor downgrades to 3.0.3 and
   never declares `BearerAuth` (component or per-operation) regardless of
   `IFLOW_OPENAPI_AUTH_TOKEN`. Open WebUI keeps consuming the canonical
   3.1 document unchanged — locked down by the "Open WebUI contract"
   block in `packages/search-openapi/test/openapi.test.ts`.
4. **Document the Coze AuthenticationFunc limitation in `packages/search-openapi/README.md`** — ✅ **rewritten in unreleased pre.2 source.**
   README now points Coze users at `/openapi.coze.json`, explains the
   `IFLOW_OPENAPI_AUTH_TOKEN` footgun (server-side gate still runs, even
   though the Coze document omits the advertisement), and recommends
   pushing auth to the tunnel / reverse-proxy layer. `bin.ts` also emits
   a startup stderr warning whenever `IFLOW_OPENAPI_AUTH_TOKEN` is set,
   so operators catch the mismatch before deploying to Coze.

### Real-platform re-smoke for pre.2 — passed

Done — `@iflow-ai/search-openapi@0.1.0-pre.2` is published on `@next`
and the operator-supervised real-platform smoke ran against the
published tarball. See [Pre.2 published real-platform smoke — passed](#pre2-published-real-platform-smoke--passed)
above for the per-endpoint table. Both expected deltas vs. pre.1 held:
Open WebUI's canonical contract was preserved at the HTTP layer
(browser UI not rerun), and Coze imported `/openapi.coze.json`
directly with default operationIds, Authentication = None, and no raw
overlay.

## See also

- [release-policy.md](./release-policy.md) — versioning rules and the `next` vs `latest` discipline
- [integration-roadmap.md](./integration-roadmap.md) — adapter priorities, where new platforms fit
- [mcp-design.md](./mcp-design.md) — sibling rationale for the MCP transport
