# @iflow-ai/search-openapi

> HTTP / OpenAPI tool server for [iFlow Search](https://platform.iflow.cn) — exposes web search, image search, and web fetch as JSON-over-HTTP endpoints for **Open WebUI**, **Coze**, and other agent platforms that consume an OpenAPI 3.x document.

Built on [`@iflow-ai/search-core`](../search-core). Same three tools as
[`@iflow-ai/search-langchain`](../search-langchain) and
[`@iflow-ai/search-mcp`](../search-mcp) — same names, same shapes, same
attribution — so prompts that drive an iFlow-search-tool agent under one
runtime keep working verbatim under another.

## Status — MVP (`0.1.0-pre.0`)

- **Transport:** HTTP only. Plain JSON request / response. No SSE, no
  WebSocket. The MVP uses Node's built-in `http` module — no Express,
  Fastify, or Koa dependency.
- **Endpoints:**
  - `GET /health` — liveness probe. Never gated by the bearer guard.
  - `GET /openapi.json` — OpenAPI 3.1 document for tool catalogs.
  - `POST /tools/iflow_web_search`
  - `POST /tools/iflow_image_search`
  - `POST /tools/iflow_web_fetch`
- **Configuration:** environment variables only, supplied by your
  deployment (Docker `-e`, systemd `Environment=`, your platform's
  secret manager). The process never reads from disk.

## Install & run

```bash
# One-shot, no install — pulls the published @next tag:
IFLOW_API_KEY=YOUR_IFLOW_API_KEY \
  npx -y @iflow-ai/search-openapi@next
```

Or pin it as a dependency:

```bash
pnpm add @iflow-ai/search-openapi
# or
npm install @iflow-ai/search-openapi

iflow-search-openapi
```

Node ≥ 18. The server binds to `0.0.0.0:8787` by default; override with
`PORT`.

> **Do not commit a real key.** Use `YOUR_IFLOW_API_KEY` everywhere you'd
> normally write the value and inject the real one at runtime via your
> platform's secret store. `@iflow-ai/search-openapi` never reads from
> disk and will not pick up a `.env` automatically.

## Configuration

All configuration is read from `process.env`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `IFLOW_API_KEY` | yes | — | Bearer token sent to iFlow as `Authorization: Bearer ...`. |
| `IFLOW_BASE_URL` | no | `https://platform.iflow.cn` | Override for testing / private deployments. |
| `IFLOW_TIMEOUT_MS` | no | `30000` | Per-request timeout in ms. Must be a positive integer if set. |
| `PORT` | no | `8787` | TCP port to listen on. Must be an integer in `[0, 65535]`. |
| `IFLOW_OPENAPI_AUTH_TOKEN` | no | — | When set, every endpoint **except** `/health` requires `Authorization: Bearer <token>`. Constant-time compared. Absent = open mode (no auth gate). |
| `IFLOW_OPENAPI_CLIENT` | no | — | Identifies the host platform (`open-webui`, `coze`, …). Allowed: `[a-z0-9._-]{1,64}`. Captured into the startup banner; not forwarded to iFlow today. |
| `IFLOW_OPENAPI_CORS_ORIGIN` | no | — | When set, every response carries `Access-Control-Allow-Origin: <value>` plus the matching `Access-Control-Allow-Headers / Methods` and `Vary: Origin`, and `OPTIONS` preflights short-circuit to `204` (no bearer required). Required for **browser-side** tool imports (Open WebUI's user/global tool servers, Coze's plugin importer). Accepts `*` or `http(s)://host[:port]` — any path, query, fragment, or non-printable character is rejected at startup. |

A missing or invalid configuration is a fatal init error: the process
writes a one-line diagnostic to **stderr** and exits with code `1`.

### Key boundary

Two values in this package are bearer-shaped — keep them separate:

| | `IFLOW_API_KEY` | `IFLOW_OPENAPI_AUTH_TOKEN` |
|---|---|---|
| What it is | Your iFlow account key | A token you invent to protect your server |
| Origin | Issued by iFlow for your account | Operator-chosen (any opaque string) |
| Who reads it | This server only (via `@iflow-ai/search-core`) | This server only (timing-safe-compared in `auth.ts`) |
| Who else sees the value | Sent upstream as `Authorization: Bearer` to `platform.iflow.cn` | Pasted into the platform's "Bearer Token" field — never sent to iFlow |

**Open WebUI and Coze never receive `IFLOW_API_KEY`.** They talk only to
this server's HTTP endpoints; the iFlow key lives in the server's
process env and is only ever transmitted upstream to iFlow.

`DEEPSEEK_API_KEY` is unrelated to this package. It appears only in the
`examples/langgraph-agent` demo to authenticate that demo's LLM, and is
never read by `@iflow-ai/search-openapi`, `@iflow-ai/search-mcp`,
`@iflow-ai/search-langchain`, or `@iflow-ai/search-core`.

## Curl smoke test

With the server running locally (open mode):

```bash
# Liveness
curl -s http://127.0.0.1:8787/health

# Tool catalog
curl -s http://127.0.0.1:8787/openapi.json | jq '.paths | keys'

# Web search
curl -s -X POST http://127.0.0.1:8787/tools/iflow_web_search \
  -H 'Content-Type: application/json' \
  -d '{"query":"site:nytimes.com OpenAI","count":3}' | jq .

# Image search
curl -s -X POST http://127.0.0.1:8787/tools/iflow_image_search \
  -H 'Content-Type: application/json' \
  -d '{"query":"snow leopard","count":3}' | jq .

# Web fetch
curl -s -X POST http://127.0.0.1:8787/tools/iflow_web_fetch \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://zh.wikipedia.org/wiki/%E8%A5%BF%E6%B9%96"}' | jq .
```

With `IFLOW_OPENAPI_AUTH_TOKEN` set, add the bearer header to every call
except `/health`:

```bash
curl -s -X POST http://127.0.0.1:8787/tools/iflow_web_search \
  -H 'Authorization: Bearer YOUR_OPENAPI_AUTH_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"query":"hello"}'
```

## Response shapes

Success:

```json
{
  "ok": true,
  "data": {
    "query": "...",
    "count": 3,
    "tookMs": 412,
    "results": [
      { "title": "...", "url": "...", "snippet": "...", "position": 1, "date": null }
    ]
  }
}
```

Error (uniform across all routes):

```json
{
  "ok": false,
  "error": {
    "code": "invalid_param",
    "message": "Parameter \"query\" is required.",
    "status": 400
  }
}
```

Error codes come straight from `@iflow-ai/search-core`: `missing_api_key`,
`missing_param`, `invalid_param`, `network_timeout`, `network_error`,
`api_error`, `api_business_error`. The server adds three HTTP-level codes
for problems before a tool ever runs: `unauthorized`,
`method_not_allowed`, `not_found`, `invalid_input`, `payload_too_large`.

For `api_error`, iFlow's upstream HTTP status (401 / 403 / 429 / 5xx) is
preserved on the response so platforms can react to rate limits or auth
failures correctly.

## Open WebUI

Open WebUI consumes OpenAPI tool servers directly. After starting
`iflow-search-openapi` somewhere it can reach (Docker compose, k8s, a
sidecar, or `npx` on the same host):

1. **Settings → Tools → Add → OpenAPI URL.**
2. URL: `http://<host>:8787/openapi.json`.
3. If you launched the server with `IFLOW_OPENAPI_AUTH_TOKEN` set, paste
   the same token into Open WebUI's *Bearer Token* field for the tool.
   Leave blank for open mode.
4. Save. The three `iflow_*` tools appear in the chat tool picker.

A typical Docker Compose service:

```yaml
services:
  iflow-search-openapi:
    image: node:20-alpine
    command: npx -y @iflow-ai/search-openapi@next
    environment:
      IFLOW_API_KEY: YOUR_IFLOW_API_KEY
      IFLOW_OPENAPI_AUTH_TOKEN: YOUR_OPENAPI_AUTH_TOKEN
      IFLOW_OPENAPI_CLIENT: open-webui
    ports:
      - "8787:8787"
```

Then in Open WebUI:

- URL: `http://iflow-search-openapi:8787/openapi.json` (or
  `http://localhost:8787/openapi.json` if you're running Open WebUI on
  the host)
- Bearer Token: the value of `IFLOW_OPENAPI_AUTH_TOKEN`

## Coze (custom tool / plugin)

Coze can register an external tool from an OpenAPI 3.x document:

1. **Plugins → Create plugin → Import from OpenAPI.**
2. URL: `https://<your-host>/openapi.json`.
3. **Authentication: *None* (open mode).** Coze's plugin runtime ignores
   OpenAPI-declared `securitySchemes` and rejects spec-declared `BearerAuth`
   at runtime with `security requirements failed: missing AuthenticationFunc`
   — the runtime expects an out-of-band `AuthenticationFunc` callback that
   an imported JSON/YAML spec cannot supply. Until Coze adds a binding for
   spec-declared bearer schemes, do **not** set `IFLOW_OPENAPI_AUTH_TOKEN`
   when targeting Coze — start the server in open mode and leave Coze's
   Authentication field set to None.
4. Select all three tools to expose to the agent.

For Coze you generally need a publicly reachable URL — terminate TLS in
front of the server (Caddy, Nginx, your platform's load balancer) or
expose it through a tunnel (cloudflared, ngrok).

**Push the auth gate to the tunnel / reverse-proxy layer**, not to
`IFLOW_OPENAPI_AUTH_TOKEN` — Coze cannot satisfy the spec-declared
bearer scheme (see step 3). Practical options:

- A named Cloudflare tunnel with a [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/) policy in front (service token or identity-based).
- Nginx / Caddy in front of the server that checks a fixed header
  (e.g. `X-Tunnel-Auth: <opaque>`) before proxying to `127.0.0.1:8787`.
- A managed API gateway that enforces auth before reaching the server.

In all of these the search-openapi server itself stays in open mode.

## Programmatic API

The package also exports the building blocks so you can embed the
listener in a larger HTTP app or drive it from integration tests:

```ts
import { createIFlowSearchClient } from "@iflow-ai/search-core";
import { createApp } from "@iflow-ai/search-openapi";
import { createServer } from "node:http";

const client = createIFlowSearchClient({
  apiKey: process.env.IFLOW_API_KEY!,
  source: "openapi",
  integrationName: "@iflow-ai/search-openapi",
  integrationVersion: "0.1.0-pre.0",
});

const app = createApp({ client, authToken: process.env.IFLOW_OPENAPI_AUTH_TOKEN });
createServer(app).listen(8787);
```

## What this package does NOT do

The MVP is deliberately small. The following are explicit non-goals for
this release:

- No TLS termination. Put a reverse proxy in front for production.
- No per-platform packages (`@iflow-ai/search-open-webui`,
  `@iflow-ai/search-coze`, …). One generic OpenAPI server covers them
  all by design.
- No streaming responses, no SSE, no WebSocket.
- No multi-tenant hosting, no per-call API-key override.
- No bundled prompts or resources — only the three search tools.

## Attribution

Every outbound request to iFlow carries:

```
IFlow-Source: openapi
IFlow-Integration: @iflow-ai/search-openapi
IFlow-Integration-Version: <pkg version>
User-Agent: @iflow-ai/search-openapi/<pkg version>
```

`IFLOW_OPENAPI_CLIENT` is **not** forwarded as `IFlow-MCP-Client` — that
header is reserved for MCP transports. It is kept in the startup banner
so operators can confirm which platform a given deployment is intended
to serve.

## License

MIT. See [`LICENSE`](./LICENSE).
