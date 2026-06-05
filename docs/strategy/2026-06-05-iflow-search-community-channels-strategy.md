---
title: iFlow Search JS — Community-Channel Exposure Strategy
date: 2026-06-05
scope: JS line only (search-mcp / search-openapi / search-langchain / search-core)
status: draft — operator review pending
deliverable: strategy + template skeletons; no draft submission bodies; no actions taken in this spec cycle
authorization-model: each NOW / NOW-CANDIDATE / CONDITIONAL action requires explicit operator green-light before execution; this spec does not pre-authorize anything
---

# iFlow Search JS — Community-Channel Exposure Strategy

## A. Executive recommendation

Pivot from official-docs vendor-specific PRs to a **Registry / Marketplace / community-directory-first** model for the JS line.

**One-line rationale:** `langchain-ai/docs` merged exactly **one** third-party JS integration PR in the past 60 days against ~25 same-shape open PRs, making it a maintenance-constrained, low-throughput channel; meanwhile MCP registries (mcp.so, Glama, PulseMCP), Hermes Atlas, Open WebUI's Community Hub, and platform-specific awesome-* lists remain open to third-party submissions with lower review friction.

**Next-stage strategy:** keep all non-LangChain existing submissions in WAIT (no re-pings); self-close `langchain-ai/docs#4152` per the maintainer rationale at `langchainjs#10931`; route new energy through a small set of MCP-discovery channels (NOW: mcp.so; NOW-CANDIDATE: Glama; CONDITIONAL NOW: Hermes Atlas; CONTACT NOW: PulseMCP); treat every remaining channel as VERIFY / CONTACT / LATER / DEFER / DROP based on documented evidence rather than assumption.

## B. Current Status Verification Table

| Platform | Submission ref | Current state | Last meaningful activity | Should we act now? | Recommended action |
|---|---|---|---|---|---|
| Hermes | issue #29250 + PR #29632 (3rd-party) | OPEN, P3, 0 comments | 2026-05-26 | No | WAIT both |
| CrewAI | PR #5928 | OPEN, bot-approved only | 2026-05-26 | No | WAIT |
| VoltAgent | PR #1312 | OPEN, operator bumped 2026-06-05 | 2026-06-05 | No | WAIT |
| Claude Code | issue #61805 | OPEN, labeled, 0 comments | 2026-05-23 | No | WAIT |
| Open WebUI | PR #71 | OPEN, no review activity | 2026-05-26 | No | WAIT |
| OpenCode | PR #29365 | OPEN, no activity | 2026-05-26 | No | WAIT |
| LangChain JS | issue #10931 (CLOSED 2026-06-01) + docs PR #4152 | issue closed by maintainer; PR open | 2026-06-01 | Yes | CLOSE #4152 |
| LangGraph JS | issue #2419 | CLOSED 2026-06-01 by same maintainer | 2026-06-01 | No | none (rolled into LangChain social-amp LATER) |
| Coze | direct API plugin (workspace mode) | working; public Store blocked on platform BYOK | 2026-05-26 | No | LATER (platform-blocked) |
| Cline | issue #1680 (cline/mcp-marketplace) | OPEN, queue ~60+ submissions | 2026-05-27 | No | WAIT |
| Codex | issue #24227 | OPEN, operator bumped 2026-06-05 | 2026-06-05 | No | WAIT |
| Mastra | issue #17135 | CLOSED 2026-05-27 by maintainer | 2026-05-27 | No | LATER / STOP-NOW (no active thread) |

## C. Community-Channel Matrix (NOW / VERIFY tier only — channels with a position to take)

| Channel | Submission entry | Recent third-party acceptance evidence | Auto-indexed? | Duplicate of existing? | Hosted-URL / MCPB / remote-transport required? | Maintenance cost & review queue |
|---|---|---|---|---|---|---|
| **mcp.so** (NOW) | `chatmcp/mcp-directory` GitHub issue | 20k+ servers indexed; new entries appearing daily; **no documented SLA** | ❌ not yet | No (different presentation layer from Official MCP Registry) | ❌ npm stdio accepted | Low input cost; **indexing latency unknown — post-and-wait** |
| **Glama** (NOW-CANDIDATE) | "Submit a GitHub repo" form on `glama.ai` homepage | 21k+ indexed; serves as gating prerequisite for `awesome-mcp-servers` PR merges | ❌ not yet | No | ❌ but Glama expects complete README + install snippet | Low; **success criterion = `iflow-search-js` becomes searchable on `glama.ai/mcp/servers`** |
| **PulseMCP** (CONTACT NOW) | `pulsemcp.com/submit` form; PulseMCP also documents **daily ingest of the Official MCP Registry, weekly processing** | Documented curation cadence | ❌ not visible as of 2026-06-05; Official MCP Registry stable 0.1.0 published 2026-05-26 — 10+ days elapsed, past the documented 1-week ingest window | Same source as Official Registry; presentation layer differs | ❌ | Low. **Re-verify search at `pulsemcp.com/servers` first.** If `@iflow-ai/search-mcp` is still not indexed, send the partner-contact email per documented "if not visible after a week" path **once**, then wait — do not repeat-ping |
| **Hermes Atlas** (CONDITIONAL NOW) | `ksimback/hermes-ecosystem` GitHub issue + repo URL | issue #318 (Exabase memory plugin) submitted 2026-06-02, closed (= incorporated) within days; 4 open submissions all from the past week | ❌ not yet | No (community ecosystem map ≠ Hermes main-repo P3 docs work) | ❌ but **eligibility requires the package to be specifically built for or integrated with Hermes Agent**. README marketing copy alone does not satisfy this. **Pre-submission gate:** repo must carry a real Hermes runtime configuration entry plus smoke evidence in `docs/platform-smokes-mcp.md` covering Hermes invocation | Medium; eligibility test must pass before submission |
| **Smithery** (DEFER → V-3) | `smithery mcp publish <bundle>` CLI under namespace | 6k+ indexed; `exa-mcp-server` is a same-shape npm-stdio precedent | ❌ not yet | No | **Yes — requires one of:** (a) `@smithery/cli build` repackaged single-file CommonJS bundle, (b) hosted URL, (c) MCPB bundle. Current `@iflow-ai/search-mcp` build does not satisfy any of these | High; engineering decision pending — adds Smithery bundler to `prepare` lifecycle |
| **Open WebUI Community Hub** (VERIFY) | `openwebui.com` account UI publish flow | Hundreds of self-published Tools / Functions; no PR queue | ❌ not yet | **Possibly with `openapi-servers#71`** — different layer in principle (Hub = end-user installable artifact; #71 = reference-implementation PR), but overlap unverified | **Unknown — V-4 must determine** whether the Hub publishes (a) Python Tool scripts, (b) configuration entries, or (c) external OpenAPI server URLs. **Do not write a new Python Tool implementation just to fit the Hub** — that would duplicate `@iflow-ai/search-openapi` capability without payoff | Low if Hub accepts OpenAPI URL registration; high if Python Tool rewrite is required |
| **awesome-mcp-servers (punkpeye)** (LATER) | `punkpeye/awesome-mcp-servers` PR | 30 latest merges all on 2026-05-27 in one batch sweep; median PR-to-merge 2.8 days, max 5.3 days; **100 open PRs** as of 2026-06-05 | n/a (curated list) | **Depends on Glama listing** as current gating prerequisite | ❌ | Medium; gating risk — only proceed after Glama (NOW-CANDIDATE) succeeds |

## D. Per-Platform Recommendation

| Platform | Decision | Next step | Real API smoke needed? | New PR/issue needed? | Duplicates existing work? |
|---|---|---|---|---|---|
| Hermes | continue (community path) | Hermes Atlas CONDITIONAL — verify repo carries real Hermes integration + smoke evidence first; then submit issue at `ksimback/hermes-ecosystem` | Yes (Hermes runtime smoke in `docs/platform-smokes-mcp.md`) | 1 (Atlas issue) | No — separate from main-repo P3 work |
| CrewAI | wait | #5928 WAIT. **`crewai-tools[mcp]` proves technical compatibility, not community exposure.** MCP registry presence does not constitute a CrewAI community-listing entry on its own | No | 0 | n/a |
| VoltAgent | wait | #1312 WAIT. `voltagent.dev/showcase` has no submission form; community marketplace status = "in development" | No | 0 | No |
| Claude Code | continue (LATER) | LATER: PR to `hesreallyhim/awesome-claude-code` and ComposioHQ awesome-claude-{plugins,skills}. Trigger after the NOW tier lands | No | 1 (LATER) | No — different layer from #61805 |
| Open WebUI | wait + Hub VERIFY | #71 WAIT. V-4: confirm the Hub's publishing object before any submission. Do not write a new Python Tool to fit | No | possibly 1 after V-4 resolves | TBD by V-4 |
| OpenCode | wait | #29365 WAIT. `awesome-opencode/awesome-opencode` last merge 2026-03-21 — channel dormant, do not invest | No | 0 | No |
| LangChain (JS) | stop (JS scope) + close #4152 | CLOSE #4152 (per §G); keep `@iflow-ai/search-langchain` externally maintained on npm; LATER social amp via `@bromann` once a publishable artifact exists | No | -1 (close) | n/a |
| LangGraph (JS) | maintainer-closed | None standalone; rolled into LangChain LATER social-amp path | No | 0 | n/a |
| Coze | LATER (platform-blocked) | Track Coze public-store BYOK capability. Confirmed 2026 store auth = `none \| service_http(shared key) \| OAuth-server`; no per-user key UI. Workspace path already works | n/a | 0 | No |
| Cline | wait | #1680 WAIT. `cline/prompts` last merge 2026-02-27 — dormant. Do not invest | No | 0 | No |
| Codex | wait | #24227 WAIT. OpenAI third-party skill PR history shows zero external merges. Community route = awesome-* (LATER) | No | 0 | No |
| Mastra | LATER / STOP-NOW | #17135 CLOSED, no active thread. **Do not reopen, do not follow-up.** Revisit only on documented policy change or maintainer invitation | n/a | 0 | n/a |

> **Footnote on agentskills.io.** This is a portable-skill compatibility standard, not a registry. If our package later adds a real Hermes integration path (per the Atlas eligibility gate above), the README may declare agentskills.io compatibility. This is documentation, not a submission target — agentskills.io does not appear in the route map.

## E. Top 5 Next Actions (ranked, each requires explicit operator authorization before execution)

1. **CLOSE `langchain-ai/docs#4152`.**
   - Why now: maintainer policy at `langchainjs#10931` (2026-06-01) plus 60-day evidence that `langchain-ai/docs` external JS integrations are a low-throughput channel. PR is in a no-merge pool.
   - Minimal deliverable: closing comment authored by us (skeleton in §G), then close the PR.
   - Smoke required: no.
   - Prerequisite on existing PRs: none.
   - Operator authorization required: yes.

2. **Submit to mcp.so.**
   - Why now: largest community MCP directory; metadata-only submission; no engineering changes needed.
   - Minimal deliverable: GitHub issue at `chatmcp/mcp-directory` containing server name, description, repo URL, install snippet, transport type (stdio).
   - Smoke required: no.
   - Prerequisite: none.
   - Operator authorization: yes.

3. **Submit to Glama.**
   - Why now: 21k+ indexed servers; Glama listing is current gating prerequisite for `punkpeye/awesome-mcp-servers` merges.
   - Minimal deliverable: complete the homepage "Submit a GitHub repo" form. Success criterion = `@iflow-ai/search-mcp` becomes searchable at `glama.ai/mcp/servers`.
   - Smoke required: no, but README + install snippet must be production-quality (already satisfied by current `packages/search-mcp/README.md`).
   - Prerequisite: none.
   - Operator authorization: yes.

4. **Contact PulseMCP (CONTACT NOW).**
   - Why now: Official MCP Registry stable `0.1.0` published 2026-05-26; current date 2026-06-05 is 10+ days past, exceeding PulseMCP's documented 1-week ingest window. The passive-wait window is over.
   - Minimal deliverable: re-search `pulsemcp.com/servers` for `@iflow-ai/search-mcp` to confirm it is still not indexed. If still absent, send the partner-contact email per the documented "if not visible after a week" path **once**, then wait — do not repeat-ping.
   - Smoke required: no.
   - Prerequisite: none.
   - Operator authorization: yes (for the email step).

5. **Hermes Atlas CONDITIONAL submission.**
   - Why now: Atlas curates aggressively (issue #318 closed within days); fits Hermes ecosystem strategy without conflicting with main-repo P3 backlog.
   - Minimal deliverable: GitHub issue at `ksimback/hermes-ecosystem` with our repo URL — **only after** the eligibility gate passes.
   - Eligibility gate: repo must contain (a) a real Hermes runtime configuration entry (not marketing prose), (b) a smoke evidence row in `docs/platform-smokes-mcp.md` for Hermes invocation. Gate work is itself unspec'd here and out of scope for this spec.
   - Smoke required: yes (Hermes-specific).
   - Prerequisite: gate work; Hermes #29632 (3rd-party PR) does not need to merge first.
   - Operator authorization: yes.

## F. Stop-doing List

- **No further vendor-specific docs PRs** to: `langchain-ai/docs` (any language), `langchain-ai/langchainjs`, `langchain-ai/langgraphjs`, `mastra-ai/mastra`.
- **No re-pings** on existing submissions: Cline #1680, CrewAI #5928, VoltAgent #1312, Open WebUI #71, OpenCode #29365, Codex #24227, Claude Code #61805, Hermes #29250, Hermes #29632.
- **No reopen** of `mastra-ai/mastra#17135` — closed by maintainer policy; no active thread to revive. Revisit only on documented policy change or maintainer invitation.
- **No new `@iflow-ai/search-<framework>` adapter packages.** Existing four packages (`search-core`, `search-mcp`, `search-openapi`, `search-langchain`) cover all in-scope channels.
- **Channels confirmed dormant — do not invest:** `cline/prompts` (last merge 2026-02-27), `awesome-opencode/awesome-opencode` (last merge 2026-03-21).
- **Do not write a Python Tool implementation** to fit Open WebUI Community Hub before V-4 confirms the Hub's publishing object. Avoid duplicating `@iflow-ai/search-openapi` capability with no payoff.
- **Do not conflate "MCP technical compatibility" with "framework community exposure."** CrewAI's `crewai-tools[mcp]` import path proves the former, not the latter.
- **Do not invoke LangChain social amplification (`@bromann` / `@LangChain_JS`) until a publishable artifact exists** (release thread, blog post, or working demo repo).

## G. LangChain / LangGraph Closure Strategy

### docs PR #4152 — recommendation: SELF-CLOSE this cycle

- **Trigger:** maintainer `christian-bromann` closed `langchainjs#10931` and `langgraphjs#2419` on 2026-06-01 with explicit policy: "we don't accept any further 3rd party examples due to maintenance concerns."
- **Quantitative reinforcement:** `langchain-ai/docs` merged 1 external JS integration PR in the past 60 days against 25+ same-shape open PRs. PR #4152 sits in that no-merge pool.
- **Execution model:** we publish a closing comment authored by us, then close the PR ourselves. **No maintainer ping.** No request for reconsideration.

**Closure-comment SKELETON** (fields to populate at execution time; no body in this spec):

```
Subject       : (none — this is a comment, not a new issue)
Greeting      : neutral, single line
Sentence 1    : acknowledge the maintainer's docs-policy decision at langchainjs#10931
                — link the closure comment, do not paraphrase
Sentence 2    : state that @iflow-ai/search-langchain remains available on npm
                under external maintenance for users who want it
Sentence 3    : point to the iflow-search-js README for install instructions
Closing       : single short sentence, no question, no ping
Sign-off      : none / standard
```

### docs PR #4162 (Python) — CLOSE-CANDIDATE only

Same maintainer policy applies in spirit. **Execution is out of scope for this JS spec** — handed to the Python line for separate verification. This spec does not produce a Python closure-comment skeleton.

### `@iflow-ai/search-langchain` — keep externally maintained

Do not deprecate the npm package. Do not unpublish. The package continues to exist as a vendor-maintained adapter for users who locate it via npm or our own README, independent of LangChain's first-party docs.

### `langchainjs#2419` (LangGraph) — no standalone action

Already closed by the same maintainer with identical wording. No separate closure comment needed (we did not author the LangGraph issue ourselves; the closure was on a maintainer-thread).

### LATER: social amplification via `@bromann` / `@LangChain_JS`

The maintainer's closure offered an explicit alternative: "would love to elevate it through social media ... ping me ... I will make sure to retweet/amplify." Trigger condition: a publishable artifact exists. Until then, no invocation.

## H. New Community Opportunities (≤10, cross-platform; not part of the 12 named platforms)

| # | Channel | Why relevant | Acceptance evidence | Recommended asset | Decision |
|---|---|---|---|---|---|
| 1 | **mcp.so** | Largest community MCP directory; metadata-only entry | 20k+ indexed; daily growth | mcp | PURSUE (NOW) |
| 2 | **Glama** | Tool-level deep index; gates `awesome-mcp-servers` | 21k+ indexed; submission form on homepage | mcp | PURSUE (NOW-CANDIDATE) |
| 3 | **PulseMCP** | Curated; daily-ingests Official Registry, weekly processing | Documented cadence; 1-week ingest window elapsed | mcp | PURSUE (CONTACT NOW) |
| 4 | **Hermes Atlas** | Hermes ecosystem map; aggressive curation | issue #318 closed within days | mcp | PURSUE (CONDITIONAL NOW) |
| 5 | **Smithery** | One-click install for Claude Desktop / Cursor | 6k+ indexed | mcp | DEFER (engineering: bundler / hosted URL / MCPB) |
| 6 | **`punkpeye/awesome-mcp-servers`** | Canonical awesome list | 100 open PRs; batch-merge mode | mcp (docs entry) | LATER (after Glama) |
| 7 | **MCPMarket** | Cline-integrated install flow | 10k+ indexed | mcp | DEFER (overlaps mcp.so audience) |
| 8 | **`lobehub/lobe-chat-plugins`** | OpenAPI / chat-UI plugin index | continuous PR merging | openapi | LATER (after Open WebUI Hub V-4) |
| 9 | **HF Spaces (`mcp-server` tag)** | Discoverable from agent ecosystem | thousands of tagged Spaces | requires Gradio wrapper | DROP |
| 10 | **n8n verified community node** | Workflow ecosystem | 1029 community nodes | requires new node package | DROP |

**Top-5 pursuit ranking:** mcp.so → Glama → PulseMCP → Hermes Atlas → (Smithery or LobeChat, both LATER and gated by separate engineering decisions).

## I. Final Route Map

```
NOW
  ├─ CLOSE-1   langchain-ai/docs#4152            (JS-line scope only; closure skeleton in §G; references langchainjs#10931)
  └─ ADD-1     mcp.so                             (issue submission; latency unknown; post-and-wait)

NOW-CANDIDATE
  └─ ADD-2     Glama                              (homepage "Submit a GitHub repo" form; success = searchable on glama.ai/mcp/servers)

CONDITIONAL NOW
  └─ ADD-3     Hermes Atlas (ksimback/hermes-ecosystem)  (gate: real Hermes runtime config + Hermes smoke entry in docs/platform-smokes-mcp.md)

CONTACT NOW
  └─ V-2       PulseMCP                           (1-week ingest window elapsed since Official Registry 0.1.0 on 2026-05-26; re-verify search, then contact once via documented partner-contact path, then wait — no repeat-ping)

VERIFY
  └─ V-4       Open WebUI Community Hub           (determine publishing object: Python Tool / config / OpenAPI URL — before any submission; do not duplicate search-openapi)

DEFER (engineering decision pending)
  └─ V-3       Smithery                           (Smithery bundler / hosted URL / MCPB — none currently satisfied)

WAIT (existing submissions; no re-pings; no reopen)
  ├─ Cline mcp-marketplace#1680
  ├─ CrewAI #5928                                 (note: crewai-tools[mcp] = technical compatibility, not community-exposure)
  ├─ VoltAgent #1312
  ├─ Open WebUI openapi-servers#71
  ├─ OpenCode #29365
  ├─ Codex #24227
  ├─ Claude Code #61805
  └─ Hermes #29250 + Hermes #29632 (3rd-party PR)

CLOSE (this spec authorizes; operator executes)
  └─ langchain-ai/docs#4152

CLOSE-CANDIDATE (handed to Python line; out of scope here)
  └─ langchain-ai/docs#4162

STOP — JS line scope only
  ├─ langchain-ai/docs JS vendor-specific PRs (any new ones)
  ├─ langchain-ai/langchainjs / langgraphjs third-party examples PRs (per #10931 / #2419 closures)
  └─ new @iflow-ai/search-<framework> adapter packages

LATER (external blockers or sequence dependencies)
  ├─ Coze public Store BYOK                       (confirmed: 2026 store auth = none|service_http(shared key)|OAuth-server; no per-user key UI; track platform updates)
  ├─ LangChain social amp (@bromann / @LangChain_JS) (gated on publishable artifact: release thread / blog / demo repo)
  ├─ VoltAgent Community Marketplace               (vendor: "in development"; no submission form)
  ├─ Mastra                                       (no active thread; revisit only on policy change or maintainer invitation)
  ├─ awesome-mcp-servers (punkpeye)                (after Glama listing succeeds)
  ├─ awesome-claude-* (hesreallyhim / Composio)    (Claude Code community path; trigger after NOW tier lands)
  └─ lobehub/lobe-chat-plugins                     (OpenAPI second-exposure; after Open WebUI Hub V-4)

DROP (do not invest)
  ├─ cline/prompts                                 (last merge 2026-02-27; dormant)
  ├─ awesome-opencode/awesome-opencode             (last merge 2026-03-21; dormant)
  ├─ HF Spaces mcp-server tag                     (requires Gradio wrapper; out of scope per "no new adapter packages")
  └─ n8n verified community node                   (requires new node package; out of scope)
```

---

## Self-review confirmation

This spec was written under the operator's stated safety constraints for this turn:

- repo source tree untouched (no edits in `packages/` or `examples/`)
- no GitHub issue / PR / comment created
- no maintainer pinged
- no `git commit`, `git push`, `npm publish`, or `npm dist-tag` change performed
- no real `IFLOW_API_KEY` / `DEEPSEEK_API_KEY` / GitHub token / npm token read or printed
- no key length / prefix / suffix / hash / fragment printed
- no new `@iflow-ai/search-<framework>` adapter package designed
- no duplicate vendor docs PR proposed
- "official support" and "third-party community/example" kept distinct throughout

Every NOW / NOW-CANDIDATE / CONDITIONAL NOW / VERIFY-CONTACT action item explicitly requires operator authorization at execution time. This spec does not pre-authorize anything.

---

## Out-of-scope follow-ups (recorded, not actioned)

- **`langchain-ai/docs#4162` (Python).** CLOSE-CANDIDATE; handed to the Python line for separate verification.
- **iFlow CLI shutdown notice.** A 2026-04-17 shutdown notice for `iflow-ai/iflow-cli` (the official terminal tool) surfaced incidentally during channel research. This is a different product from `platform.iflow.cn` (the search API our SDK calls). Recorded here as a tracking item only; does not trigger any change to the JS line.
- **Namespace collision.** An unrelated `iflow-mcp` GitHub org publishes `@iflow-mcp/*` npm packages (e.g. `@iflow-mcp/filesystem-mcp-server`). Not affiliated with us. Recorded as a brand-confusion risk; no action proposed in this spec.
