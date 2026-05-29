# 隐私政策 — iFlow Search 插件

**最近更新：** 2026-05-29

*本文件描述本插件运营方的政策，非法律意见。*

## 本插件功能

iFlow Search 插件是一个 HTTP/OpenAPI 工具服务器，它将您的查询字符串
转发至 iFlow Search API（`https://platform.iflow.cn`），并将搜索结果
返回给您的 Coze Agent。

## 我们接收的数据

当您（或代您操作的 Coze Agent）调用工具时，本插件会接收：

- 您提交的查询字符串或 URL（`query`、`url`）。
- Coze 附带的 HTTP 元数据：`User-Agent`、来源 IP。
- 用于鉴权调用的认证请求头（具体方案取决于公网部署所采用的鉴权层）。

本插件**不会**索取、收集或记录：

- 您的姓名、邮箱或任何账号标识。
- Coze 用户 ID。
- 超出本次工具输入范围的 Coze 用户会话历史。
- 来自 Coze Agent 的、超出工具本次输入范围的任何内容。

## 我们向 iFlow 发送的数据

每次工具调用都会被转发至 `platform.iflow.cn`，并携带：

- 您的查询或 URL。
- 插件归因请求头（`IFlow-Source`、`IFlow-Integration`、
  `IFlow-Integration-Version`、`User-Agent`）。
- 由插件运营方（zhengyanglsun）持有的服务器端 iFlow API Key。
  该 Key 永远不会暴露给 Coze 工作空间。

发送至 `platform.iflow.cn` 的内容适用 iFlow 自身的隐私实践，详见
<https://platform.iflow.cn/>。

## 日志与留存

- 请求与响应正文**不会**被本插件持久化到磁盘。
- 插件运营方的基础设施（隧道访问日志、可选的反向代理日志）可能保留
  IP、请求路径与时间戳最多 30 天，用于反滥用。查询正文不会被记录。

## 第三方

- **iFlow**（`platform.iflow.cn`）— 搜索结果提供方，必需。
- **Cloudflare**，如公网部署采用 Cloudflare Tunnel、Access、Workers
  或相关基础设施。详见 <https://www.cloudflare.com/privacypolicy/>。

## 联系方式

如有隐私相关问题，请联系 2039222749@qq.com。
