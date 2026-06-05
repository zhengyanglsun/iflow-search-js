# Create an iFlow Search BYOK Plugin in Your Coze Workspace

> **This is the recommended distribution path for iFlow Search on
> Coze today.** The public Plugin Store is gated on platform-feature
> work — see
> [`coze-marketplace-draft.md`](./coze-marketplace-draft.md#public-store-byok-gating--verified-2026-06-05)
> for the gating record. The route below uses only existing Coze and
> iFlow capabilities and gives every user a real BYOK setup: each
> installer's iFlow key stays inside their own Coze workspace, and
> the operator never sees it.

## Why this path?

Coze public-store plugins today only support a **publisher-shared**
service token (one key reused for every installer's calls) or a
**per-user OAuth flow** (which iFlow does not expose). Neither is
right for "each user pays for their own iFlow usage with their own
key."

Creating the plugin **inside your own workspace** sidesteps both
limitations: you fill in `Authorization: Bearer <YOUR_IFLOW_API_KEY>`
once, the plugin is private to you, and your key never leaves your
workspace.

## Prerequisites

- A Coze account on either coze.com or 扣子.cn. The workflow is
  intended for both coze.com and 扣子.cn, but field names and UI
  labels may differ between regions.
- A personal iFlow API key from <https://platform.iflow.cn>. Create
  a **dedicated key** for this plugin rather than reusing one issued
  for another integration (CLI, MCP server, etc.); rotating a leaked
  key is then a one-place change.

## Step 1 — Create the plugin (Existing API Service)

In your Coze workspace: **Plugins → Create plugin → Existing API
Service** (扣子: 资源库 → 插件 → 创建插件 → 基于已有服务).

Suggested fields:

| Field | Value |
|---|---|
| Plugin name | `iFlow Search (BYOK)` |
| Plugin description (EN) | Real-time web search, image search, and full-page fetch via the iFlow Search API. Each user provides their own iFlow API key. |
| Plugin description (ZH) | 由 iFlow Search API 驱动的实时网页搜索、图片搜索与全页抓取。每个用户填写自己的 iFlow API Key。 |
| Plugin URL / Server URL | `https://platform.iflow.cn` |

## Step 2 — Configure authentication

On the plugin's **Authentication** / **授权方式** screen:

| Field | Value |
|---|---|
| Authorization method / 授权方式 | `Service token / API key` |
| Location | `Header` |
| Parameter name | `Authorization` |
| Service token / Value | `Bearer <YOUR_IFLOW_API_KEY>` |

Replace `<YOUR_IFLOW_API_KEY>` with your real key (the literal word
`Bearer ` and one space must remain in front of the key). After
saving, Coze will inject this header automatically on every tool call
the plugin makes.

> ⚠️ **Do NOT also add `Authorization` to the per-tool Headers list
> later in Step 3.** Coze's auth config above is what produces this
> header; adding it again in a tool's Headers list will produce
> duplicate or conflicting headers and the call will fail.

### Optional: attribution header

Add **one** entry to the plugin-level Headers list (separate from
the auth config above) so iFlow can attribute requests to the Coze
channel:

| Header name | Value |
|---|---|
| `IFlow-Source` | `coze` |

The header name is `IFlow-Source` only — no trailing colon. Coze's
UI inserts the `: ` separator on the wire. Adding the colon yourself
will produce an invalid `IFlow-Source:: coze` header.

## Step 3 — Define the three tools

Each of the three tools is a separate POST endpoint on the same base
URL. Body is JSON; the auth header from Step 2 is applied
automatically.

### Tool 1 — `iflow_web_search`

| | |
|---|---|
| Method | `POST` |
| Path | `/api/search/webSearch` |
| Description (EN) | Search the web in real time. Returns ranked results with title, URL, snippet, and (when available) date. |
| Description (ZH) | 实时网页搜索。返回排序后的结果列表，每条包含标题、URL、摘要和（如有）发布日期。 |

Request body parameters:

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `keywords` | string | yes | — | Search query. |
| `num` | integer | no | `10` | Number of results, 1–20. |

### Tool 2 — `iflow_image_search`

| | |
|---|---|
| Method | `POST` |
| Path | `/api/search/imageSearch` |
| Description (EN) | Search the web for images. Returns image URLs, source pages, dimensions, and (when available) titles. |
| Description (ZH) | 网络图片搜索。返回图片 URL、来源页 URL、尺寸和（如有）标题。 |

Request body parameters:

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `keywords` | string | yes | — | Image search query. |
| `num` | integer | no | `10` | Number of images, 1–20. |

### Tool 3 — `iflow_web_fetch`

| | |
|---|---|
| Method | `POST` |
| Path | `/api/search/webFetch` |
| Description (EN) | Fetch and extract the main readable content of a single URL. |
| Description (ZH) | 抓取并提取指定 URL 的主体可读内容。 |

Request body parameters:

| Param | Type | Required | Notes |
|---|---|---|---|
| `url` | string | yes | Absolute URL of the page to fetch. |

The upstream response shape is the same envelope for all three:

```json
{
  "success": true,
  "code": 0,
  "message": "ok",
  "data": { /* tool-specific payload */ }
}
```

You can leave Coze's response schema empty and let it auto-detect
from the first successful Debug call (Step 4), or paste a minimal
schema shaped around the live response.

## Step 4 — Tool Debug

Run Coze's **Test** / **Debug** action against each tool with a
representative input:

| Tool | Sample request body |
|---|---|
| `iflow_web_search` | `{"keywords": "iFlow Search", "num": 3}` |
| `iflow_image_search` | `{"keywords": "Sydney Opera House", "num": 3}` |
| `iflow_web_fetch` | `{"url": "https://en.wikipedia.org/wiki/Search_engine"}` |

**Expected:** HTTP `200` with a JSON body where `success: true` and
`data` contains the tool-specific payload.

Common failures:

- **HTTP 401** → recheck Step 2. The `Service token` value must
  start with `Bearer ` (capital B, one space) and the key after it
  must be your real iFlow key with no extra whitespace.
- **HTTP 200 but `success: false`** → iFlow accepted the request but
  rejected the input. Read `errorMsg` / `errorCode` in the response
  body.
- **Duplicate `Authorization` header** → you also added
  `Authorization` in this tool's Headers list. Remove it; the
  plugin-level auth config from Step 2 is what produces this header.

## Step 5 — Wire into an Agent and run an end-to-end test

- Create or open a Bot / Agent in your workspace.
- In the agent's **Tools** / **技能** panel, add all three tools from
  the BYOK plugin you just created.
- Drive a chained interaction in the chat preview:

  > 用 `iflow_web_search` 搜索 "iFlow Search"，从结果里挑一条用
  > `iflow_web_fetch` 抓全文，再用 `iflow_image_search` 找一张相关
  > 图片。

- Verify all three tools fire and the agent uses each result.

If the agent only uses one tool when you expected three, refine the
agent's instructions / prompt to mention all three by name and
describe when to use each. (This is normal Coze agent tuning, not a
plugin defect.)

## Security warnings

- **Never screenshot or share your iFlow key**, even in part. Avoid
  pasting it into chat logs, blog posts, GitHub issues, or PRs.
- **Never put the key in a tool input parameter.** That routes it
  through model context and conversation logs, which is exactly the
  exposure Step 2's auth config is designed to avoid.
- **Never put the key in an Agent prompt, conversation variable,
  user variable, knowledge base, or any shared document.** Step 2's
  auth config is the only place it should live.
- **Use a dedicated per-user key.** Do not reuse a key issued for
  another integration (CLI, MCP server, OpenAPI host, etc.). If you
  ever suspect exposure, rotate the key on iFlow and update Step 2.
- **Keep the plugin private to your workspace.** Do not publish it
  to the Plugin Store — see
  [`coze-marketplace-draft.md`](./coze-marketplace-draft.md#public-store-byok-gating--verified-2026-06-05)
  for the gating record. If a public listing becomes feasible later,
  it will be a separate plugin built by the operator, not this one.

## See also

- [`coze-marketplace-draft.md`](./coze-marketplace-draft.md) — public
  Store gating record and re-evaluation triggers.
- [`platform-smokes.md`](./platform-smokes.md) — Coze workspace smoke
  history (search-openapi tunnel path, distinct from this BYOK
  direct-connect path).
