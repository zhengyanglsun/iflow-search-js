# Privacy Policy — iFlow Search Plugin

**Last updated:** 2026-05-29

*This document describes the operator's policy for the iFlow Search plugin
and is not legal advice.*

## What this plugin does

The iFlow Search plugin is an HTTP/OpenAPI tool server that forwards your
query strings to the iFlow Search API (`https://platform.iflow.cn`) and
returns the results to your Coze agent.

## Data we receive

When you (or a Coze agent acting on your behalf) invoke a tool, the plugin
receives:

- The query string or URL you submitted (`query`, `url`).
- HTTP metadata that Coze attaches: `User-Agent`, source IP.
- Authentication headers used to authorize the call (the specific scheme
  depends on the public deployment's auth layer).

The plugin does **not** request, collect, or log:

- Your name, email, or any account identifier.
- Coze user IDs.
- Coze user conversation history beyond the immediate tool input.
- Any content from the Coze agent other than the immediate tool input.

## Data we send to iFlow

Each tool invocation is forwarded to `platform.iflow.cn` with:

- Your query / URL.
- Plugin attribution headers (`IFlow-Source`, `IFlow-Integration`,
  `IFlow-Integration-Version`, `User-Agent`).
- A server-side iFlow API key held by the plugin operator
  (zhengyanglsun). This key is never exposed to the Coze workspace.

iFlow's own privacy practices apply to anything sent to `platform.iflow.cn`.
See <https://platform.iflow.cn/>.

## Logging and retention

- Request and response bodies are **not** persisted to disk by the plugin.
- The plugin operator's infrastructure (tunnel access logs, optional
  reverse-proxy logs) may retain IP, request path, and timestamp for up
  to 30 days for abuse prevention. Query bodies are not logged.

## Third parties

- **iFlow** (`platform.iflow.cn`) — search results provider. Required.
- **Cloudflare**, if the public deployment uses Cloudflare Tunnel,
  Access, Workers, or related infrastructure. See
  <https://www.cloudflare.com/privacypolicy/>.

## Contact

For privacy questions, contact 2039222749@qq.com.
