# Coze Marketplace Submission — Draft

**Status:** Draft / not submitted. Public marketplace is **not** ready —
host, auth layer, and rate-limit policy are still pending operator
action. Privacy/Terms public URLs are live and verified on 2026-05-29
(see [GitHub Pages note](#github-pages-note)). The private/workspace
smoke that passed on 2026-05-26 via a transient cloudflared tunnel is
**not** a marketplace approval and must not be cited as such.

**Last updated:** 2026-05-29
**Operator:** zhengyanglsun
**Contact:** 2039222749@qq.com

---

## Plugin metadata

| Field | English | 中文 |
|---|---|---|
| Plugin name (short) | iFlow Search | iFlow 搜索 |
| One-line tagline (≤80 chars) | Real-time web search, image search, and full-page fetch powered by the iFlow Search API. | 由 iFlow Search API 驱动的实时网页搜索、图片搜索与全页抓取工具。 |
| Category | Search / Web Tools | 搜索 / 网络工具 |
| Keywords | search, web, image, fetch, real-time, iflow | 搜索, 网页, 图片, 抓取, 实时, iflow |

## Long description

### EN (paste into Coze marketplace "Description" field)

```
iFlow Search exposes three production-grade web tools to your Coze agent:

• iflow_web_search — real-time web search with title, URL, snippet, and date for each result. Use this when the agent needs fresh, citeable information.

• iflow_image_search — image search returning image URLs, source pages, and dimensions. Use this for visual references or moodboards.

• iflow_web_fetch — fetches and extracts the main readable content of any URL, with optional caching. Use this when the agent needs to read a specific page (e.g. an article the user linked).

All three tools share consistent error shapes and return structured JSON that Coze's Agent renderer displays cleanly. The plugin is built on the open-source @iflow-ai/search-openapi (MIT, github.com/zhengyanglsun/iflow-search-js) and forwards queries to platform.iflow.cn. The operator's iFlow API key is held server-side and never exposed to the Coze workspace.
```

### ZH（贴入 Coze 市场"描述"框）

```
iFlow 搜索为您的 Coze Agent 提供三个生产级网络工具：

• iflow_web_search — 实时网页搜索，每条结果包含标题、URL、摘要与日期。适合 Agent 需要最新、可引用信息的场景。

• iflow_image_search — 图片搜索，返回图片 URL、来源页与尺寸。适合视觉素材或灵感板场景。

• iflow_web_fetch — 抓取并提取任意 URL 的主体可读内容，支持可选缓存。适合 Agent 需要阅读用户给定页面（如某篇文章）的场景。

三个工具共享一致的错误结构，返回结构化 JSON，Coze Agent 渲染器可直接清晰展示。本插件基于开源项目 @iflow-ai/search-openapi（MIT 协议，github.com/zhengyanglsun/iflow-search-js）构建，请求转发至 platform.iflow.cn。运营方的 iFlow API Key 保存在服务器端，Coze 工作空间永远无法看到。
```

## Tool descriptions — Coze platform override

> The package's source `handlers/*` are English (other platforms share
> the same source). **Do not modify source.** Paste the Chinese versions
> below into the Coze platform UI's per-tool "description" field.

### iflow_web_search

- **EN (source, unchanged):**
  Search the web in real time. Returns a ranked list of results, each
  with title, URL, snippet, and (when available) publication date. Use
  for current events, factual lookups, citations.
- **ZH (Coze UI override):**
  实时网页搜索。返回排序后的结果列表，每条包含标题、URL、摘要和（如有）
  发布日期。适用于时事查询、事实核查、引用查找。

### iflow_image_search

- **EN (source, unchanged):**
  Search the web for images. Returns image URLs, source page URLs,
  dimensions, and (when available) titles. Use for visual references,
  moodboards, or when the agent needs to show rather than tell.
- **ZH (Coze UI override):**
  网络图片搜索。返回图片 URL、来源页 URL、尺寸和（如有）标题。适用于
  视觉参考、灵感板，或 Agent 需要"展示"而非"叙述"的场景。

### iflow_web_fetch

- **EN (source, unchanged):**
  Fetch and extract the main readable content of a given URL. Returns
  cleaned text content plus title and an optional cache flag. Use when
  the agent needs to read a specific page the user linked, not search
  broadly.
- **ZH (Coze UI override):**
  抓取并提取指定 URL 的主体可读内容。返回清洗后的文本、标题以及可选
  的缓存标识。适用于 Agent 需要阅读用户给定的具体页面（而非广泛搜索）
  的场景。

## Host and auth notes

**Current state:** public host pending. No production host or rate-limit
policy is provisioned. **Do not submit to the marketplace until all of
the following are finalized.**

### Preferred host plan (not yet implemented)

- **Host:** Cloudflare named tunnel pointing to the search-openapi
  process on a stable domain owned by the operator. Transient
  `cloudflared` quick tunnels are **not** acceptable for marketplace —
  their URLs change on restart.
- **Auth layer:** authentication enforced at the tunnel / reverse-proxy
  layer (e.g. Cloudflare Access policy with service tokens, or
  equivalent). **Not** at the application layer — `IFLOW_OPENAPI_AUTH_TOKEN`
  is unusable for Coze because Coze rejects spec-declared `BearerAuth`
  at runtime with `missing AuthenticationFunc`. The Coze-flavored OpenAPI
  document at `/openapi.coze.json` therefore deliberately omits any
  `security` declaration, and the application-layer bearer gate would
  silently 401 every Coze tool call. See
  `docs/platform-smokes.md:215-224` for the architectural reasoning;
  the concrete Cloudflare Access recipe is **not yet written**.
- **Spec bypass paths:** the Access policy must allow unauthenticated
  GET on `/openapi.coze.json` and `/health` so Coze can fetch the spec
  during plugin import and platform health checks. All `POST /tools/*`
  paths remain gated.
- **Rate-limit policy:** to be decided. Open-mode without rate limits is
  unacceptable for a public marketplace listing (anyone with the URL
  could drain the operator's iFlow quota).

### What "passed" already (do NOT extrapolate)

- 2026-05-26: private/workspace plugin smoke against a transient
  `cloudflared` quick tunnel, server in open mode, Coze Auth = None.
  Tool Debug and Agent invocation both returned valid results.
- This validates the OpenAPI shape and the wire protocol. It does **not**
  validate the marketplace listing, the public-deployment auth model,
  rate-limit posture, or domain stability.

## Submission checklist (do not check off prematurely)

- [ ] Logo 400×400 PNG ready (operator-side asset)
- [ ] Long description EN + ZH reviewed (this draft)
- [ ] Three tool ZH overrides reviewed (this draft)
- [x] Privacy policy live at a stable URL — verified 2026-05-29 (see [GitHub Pages note](#github-pages-note))
- [x] Terms of service live at a stable URL — verified 2026-05-29 (see [GitHub Pages note](#github-pages-note))
- [ ] Contact email confirmed: `2039222749@qq.com`
- [ ] Operator name confirmed: `zhengyanglsun`
- [ ] Production host provisioned (stable domain + TLS)
- [ ] Auth layer enforced at tunnel / reverse-proxy (not application)
- [ ] Bypass paths for `/openapi.coze.json` and `/health` verified
- [ ] Rate-limit / quota-protection policy decided and enforced
- [ ] End-to-end smoke against the **public** host passes (Coze Debug
      + Agent invocation, with auth headers attached)
- [ ] Operator has reviewed iFlow upstream Terms compatibility

## GitHub Pages note

**Status:** verified 2026-05-29. GitHub Pages is enabled on this repo
with source = `main` / `/`, HTTPS enforced. All four legal pages
return `200 OK` with the expected H1 title rendered.

Canonical URLs to paste into the Coze submission form (no `.html`
suffix — cleaner and stable; the `.html` variants also return 200 but
should not be used as the canonical):

- Privacy Policy (中文): `https://zhengyanglsun.github.io/iflow-search-js/legal/privacy-zh`
- Privacy Policy (English): `https://zhengyanglsun.github.io/iflow-search-js/legal/privacy-en`
- Terms of Service (中文): `https://zhengyanglsun.github.io/iflow-search-js/legal/terms-zh`
- Terms of Service (English): `https://zhengyanglsun.github.io/iflow-search-js/legal/terms-en`

Recommended for the Coze marketplace submission form: use the **中文**
canonical URLs in the primary Privacy / Terms fields (Coze is a
Chinese-language platform), and keep the English canonicals as
operator-side backups if the reviewer asks for an English version.

If either page later starts returning non-200 (Pages outage, repo
rename, branch protection change, etc.), re-run the eight-URL probe
before submitting or resubmitting to the marketplace.
