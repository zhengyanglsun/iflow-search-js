# Platform smoke results — `@iflow-ai/search-openapi`

Results from end-to-end smokes of published `@iflow-ai/search-openapi@next`
against real third-party agent platforms. Source of truth for what works
out-of-the-box vs. what requires a host-specific overlay, and which gaps
should drive the next iteration.

Smoke target: **`@iflow-ai/search-openapi@next` = `0.1.0-pre.1`**
(re-verify with `npm view @iflow-ai/search-openapi@next version`; the dist-tag
on `latest` is intentionally still `0.1.0-pre.0` — see [release-policy.md](./release-policy.md)).

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

### Real-platform re-smoke for pre.2 — pending user approval

The four items above are landed in source and covered by offline tests.
**Real-platform re-smokes against Open WebUI and Coze have not been
re-run against the pre.2 source** — that requires a fresh `next` publish
and an operator-supervised end-to-end run (tunnel up, Open WebUI / Coze
import, real `IFLOW_API_KEY` in the server's env). When that re-smoke
happens, the expected delta vs. the pre.1 results above is:

- **Open WebUI**: no behavior change. Canonical `/openapi.json` keeps the
  same paths, operationIds, OAS version, request schemas, and 200/400/401/default
  response slots. The new inline `data` schemas are strictly additive.
- **Coze**: the v3 raw overlay step should no longer be needed. Importing
  `/openapi.coze.json` directly should produce the same green Debug +
  Agent run that the pre.1 overlay produced, because the document the
  server emits now matches the overlay shape verified against pre.1.

## See also

- [release-policy.md](./release-policy.md) — versioning rules and the `next` vs `latest` discipline
- [integration-roadmap.md](./integration-roadmap.md) — adapter priorities, where new platforms fit
- [mcp-design.md](./mcp-design.md) — sibling rationale for the MCP transport
