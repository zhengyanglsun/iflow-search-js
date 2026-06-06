# iFlow Search — Claude Code Plugin

> Web search, image search, and web-page fetching for Claude Code, via the [Model Context Protocol](https://modelcontextprotocol.io).

This plugin wraps the published npm package [`@iflow-ai/search-mcp`](https://www.npmjs.com/package/@iflow-ai/search-mcp) — a stdio MCP server backed by the iFlow Search API at <https://platform.iflow.cn>. It does **not** ship any new runtime code; the plugin is a metadata-only manifest that starts the upstream package via `npx`.

## Tools

| Tool | What it does |
|---|---|
| `iflow_web_search` | Real-time web search. Returns ranked results with title, URL, snippet, and (when available) publication date. |
| `iflow_image_search` | Web image search. Returns image URLs, source pages, dimensions, and titles. |
| `iflow_web_fetch` | Fetches and extracts the main readable content of a given URL with optional cache. |

The three tool names, input shapes, and output shapes mirror the corresponding tools in [`@iflow-ai/search-langchain`](https://www.npmjs.com/package/@iflow-ai/search-langchain) so prompts written for one runtime keep working under the other.

## Prerequisites

- **Node.js ≥ 18** — required by `@iflow-ai/search-mcp`. The plugin uses `npx -y @iflow-ai/search-mcp@0.1.0` to fetch the pinned package version on first run.
- **An iFlow API key.** Sign up at <https://platform.iflow.cn> and export `IFLOW_API_KEY` in the shell **before** you launch Claude Code:

  ```bash
  export IFLOW_API_KEY="YOUR_IFLOW_API_KEY"
  claude
  ```

  The plugin's `.mcp.json` declares `IFLOW_API_KEY` as a `${IFLOW_API_KEY}` placeholder; Claude Code substitutes the value from your shell environment when it spawns the MCP server. **No credential value is ever written into the plugin manifest, the marketplace metadata, or any committed file.**

## Install (from a Claude Code marketplace)

This plugin is being submitted to Anthropic's community plugin marketplace, [`anthropics/claude-plugins-community`](https://github.com/anthropics/claude-plugins-community). Submission is in progress and the plugin is **not yet publicly listed** there — until it lands, use the local-development path below.

After approval and the nightly sync to the community catalog, install will be:

```bash
/plugin marketplace add anthropics/claude-plugins-community
/plugin install iflow-search@claude-community
```

(or browse via `/plugin > Discover`.) The above commands become valid only once the submission is approved and synced.

`claude-plugins-official` is a separately-curated Anthropic marketplace — the standard plugin-directory submission form does not add plugins there, so it is not the target of this submission.

## Install (local development / pre-submission testing)

You can validate and load the plugin straight from this repository — Claude Code's `--plugin-dir` flag is session-only and does **not** modify your saved configuration:

```bash
git clone https://github.com/zhengyanglsun/iflow-search-js.git
cd iflow-search-js
export IFLOW_API_KEY="YOUR_IFLOW_API_KEY"
claude --plugin-dir plugins/iflow-search
```

To validate the manifest without launching a session:

```bash
claude plugin validate --strict plugins/iflow-search
```

To do a full local-marketplace dry run (also session-isolated when scoped to `local`):

```bash
claude plugin marketplace add ./plugins/iflow-search --scope local
claude plugin install iflow-search --scope local
claude plugin list --json
```

## Example queries (in a Claude Code session)

```text
> use iflow_web_search to find recent papers on flash attention
> use iflow_image_search to fetch reference images for "art deco poster"
> use iflow_web_fetch to read https://platform.iflow.cn/docs/ and summarise the auth section
```

The model picks the appropriate tool from `tools/list`. You can also invoke them by name explicitly.

## Security & privacy

- **Credential handling.** The plugin manifest contains no credential value — only a `${IFLOW_API_KEY}` placeholder. Claude Code substitutes the value from your shell environment at MCP server startup; the key reaches the spawned `@iflow-ai/search-mcp` process as an environment variable, never as a tool input or command-line argument. The same `IFLOW_API_KEY` variable is also declared `isSecret: true` in the [Official MCP Registry](https://registry.modelcontextprotocol.io) entry `io.github.zhengyanglsun/iflow-search`.
- **Network calls.** The MCP server makes outbound HTTPS calls only to `https://platform.iflow.cn` (the iFlow Search API) by default.
- **Attribution.** The plugin sets `IFLOW_MCP_CLIENT=claude-code` so the iFlow backend can identify aggregate Claude Code traffic without seeing per-user identifiers.
- **License.** MIT. See the repository [`LICENSE`](https://github.com/zhengyanglsun/iflow-search-js/blob/main/LICENSE).

## Uninstall

```text
/plugin uninstall iflow-search
```

This removes the plugin from your Claude Code configuration. It does not delete any cached `npm` download of `@iflow-ai/search-mcp` (clear that separately with `npm cache clean` if desired).

## Sources

- npm: [`@iflow-ai/search-mcp`](https://www.npmjs.com/package/@iflow-ai/search-mcp)
- Official MCP Registry: [`io.github.zhengyanglsun/iflow-search`](https://registry.modelcontextprotocol.io/v0/servers?search=zhengyanglsun)
- Source code: <https://github.com/zhengyanglsun/iflow-search-js/tree/main/packages/search-mcp>
- Plugin maintainer: [@zhengyanglsun](https://github.com/zhengyanglsun)
