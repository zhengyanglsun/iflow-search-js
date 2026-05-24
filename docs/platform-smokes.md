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

## Next-step notes for `pre.2` / `0.2.0`

In priority order:

1. **Inline `200` response `data` schemas in `packages/search-openapi/src/openapi.ts`.**
   The only thing that made Coze's Agent quote real results was concrete
   inline `data.*` properties (`results.items.{title,url,snippet}`,
   `images.items.{title,imageUrl,sourceUrl}`, `web_fetch.data.{url,title,content,fromCache}`).
   Describing them once at the source means Open WebUI, Coze, and any future
   host get the same parseability without per-host overlays. Highest-value,
   smallest-blast-radius change. Existing field names are authoritative —
   take them from the live server, not from the README.
2. **Add `IFLOW_OPENAPI_PUBLIC_URL` env var** to inject `servers[0].url`.
   Today the spec emits no `servers` and every host falls back to its own
   heuristics — Coze needs an explicit URL because import-side and
   execute-side run in different network contexts. Trivial wiring in
   `packages/search-openapi/src/{config.ts,bin.ts,openapi.ts}` plus
   validation matching the existing URL-shape rules.
3. **Consider OpenAPI `3.0.3` as the default** (or a `IFLOW_OPENAPI_VERSION`
   opt-in to 3.1). 3.0.3 is what every commercial agent platform parses
   cleanly today (Coze, Dify, several internal "Bot" frameworks); 3.1's
   nullable-via-`type:[…,"null"]`, `examples` array, and `const` are the
   shapes that trip importers. The downgrade walker used during the smoke
   covers the three known incompatibilities.
4. **Document the Coze AuthenticationFunc limitation in `packages/search-openapi/README.md`.**
   Operators targeting Coze should run open mode behind an auth-enforcing
   proxy (or a tunnel that requires its own auth), not via
   `IFLOW_OPENAPI_AUTH_TOKEN`, until Coze's plugin runtime accepts a plain
   `BearerAuth` securityScheme. Documentation only — no code change.

(2) and (1) together would let Coze import the canonical `/openapi.json`
directly with no overlay. (3) reaches a wider set of hosts beyond Coze.
(4) lowers the support cost in the meantime.

## See also

- [release-policy.md](./release-policy.md) — versioning rules and the `next` vs `latest` discipline
- [integration-roadmap.md](./integration-roadmap.md) — adapter priorities, where new platforms fit
- [mcp-design.md](./mcp-design.md) — sibling rationale for the MCP transport
