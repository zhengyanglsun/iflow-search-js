import { describe, expect, it, vi } from "vitest";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { createIFlowSearchTools } from "@iflow-ai/search-langchain";
import { createIFlowAgent } from "../src/agent.js";

const FAKE_KEY = "test-key-redacted";

// ── helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toolCall(name: string, args: Record<string, unknown>) {
  return { id: "test-call-1", name, args, type: "tool_call" as const };
}

/**
 * Minimal stub LLM that satisfies createReactAgent's structural type check.
 * Never invoked: the agent loop is not run in these tests — we exercise the
 * tool path directly via tool_call shape, which is what the agent itself
 * would do internally.
 */
class StubChatModel extends BaseChatModel {
  _llmType(): string {
    return "stub-chat-model";
  }

  override bindTools(): this {
    return this;
  }

  async _generate(_messages: BaseMessage[]): Promise<ChatResult> {
    return {
      generations: [
        { text: "stub", message: new AIMessage("stub") },
      ],
    };
  }
}

// ── construction ─────────────────────────────────────────────────────────────

describe("createIFlowAgent construction", () => {
  it("returns a compiled LangGraph agent with an invoke() method", () => {
    const fetchMock = vi.fn();
    const agent = createIFlowAgent({
      apiKey: FAKE_KEY,
      fetch: fetchMock,
      llm: new StubChatModel({}),
    });
    expect(agent).toBeDefined();
    expect(typeof (agent as { invoke?: unknown }).invoke).toBe("function");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── tool wiring (the iFlow side of the agent) ────────────────────────────────

describe("createIFlowSearchTools wiring", () => {
  it("returns three tools with iflow_* names in canonical order", () => {
    const tools = createIFlowSearchTools({ apiKey: FAKE_KEY, fetch: vi.fn() });
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual([
      "iflow_web_search",
      "iflow_image_search",
      "iflow_web_fetch",
    ]);
  });
});

// ── tool execution along the agent path (tool_call shape) ────────────────────

describe("tools execute along the agent path", () => {
  it("web search → summary + artifact + attribution headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          query: "lang graph",
          organic: [
            { title: "T1", link: "https://example.com/a", snippet: "first", position: 1, date: null },
            { title: "T2", link: "https://example.com/b", snippet: "second", position: 2, date: null },
          ],
        },
      }),
    );

    const tools = createIFlowSearchTools({ apiKey: FAKE_KEY, fetch: fetchMock });
    const webSearch = tools.find((t) => t.name === "iflow_web_search");
    expect(webSearch).toBeDefined();

    const msg = await webSearch!.invoke(
      toolCall("iflow_web_search", { query: "lang graph", count: 2 }),
    );

    expect(typeof msg.content).toBe("string");
    expect(msg.content).toContain("T1");
    expect(msg.content).toContain("T2");
    expect(msg.artifact).toMatchObject({
      query: "lang graph",
      count: 2,
      results: [
        expect.objectContaining({ title: "T1", url: "https://example.com/a" }),
        expect.objectContaining({ title: "T2", url: "https://example.com/b" }),
      ],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["IFlow-Source"]).toBe("langchain");
    expect(headers["IFlow-Integration"]).toBe("@iflow-ai/search-langchain");
    expect(headers["IFlow-Integration-Version"]).toBeTruthy();
    expect(headers["User-Agent"]).toContain("@iflow-ai/search-langchain");
  });

  it("image search returns artifact with images[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          { url: "https://img/a.jpg", title: "cat", refUrl: "https://page/a" },
        ],
      }),
    );

    const tools = createIFlowSearchTools({ apiKey: FAKE_KEY, fetch: fetchMock });
    const imageSearch = tools.find((t) => t.name === "iflow_image_search");
    expect(imageSearch).toBeDefined();

    const msg = await imageSearch!.invoke(
      toolCall("iflow_image_search", { query: "cats", count: 1 }),
    );

    expect(msg.artifact).toMatchObject({
      query: "cats",
      count: 1,
      images: [expect.objectContaining({ imageUrl: "https://img/a.jpg" })],
    });
  });

  it("web fetch returns artifact with url + title + content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          url: "https://example.com/article",
          title: "Hello",
          content: "Body of the article.",
          fromCache: false,
        },
      }),
    );

    const tools = createIFlowSearchTools({ apiKey: FAKE_KEY, fetch: fetchMock });
    const webFetch = tools.find((t) => t.name === "iflow_web_fetch");
    expect(webFetch).toBeDefined();

    const msg = await webFetch!.invoke(
      toolCall("iflow_web_fetch", { url: "https://example.com/article" }),
    );

    expect(msg.artifact).toMatchObject({
      url: "https://example.com/article",
      title: "Hello",
      content: "Body of the article.",
    });
  });
});

// ── no real network leaks ────────────────────────────────────────────────────

describe("no real network requests", () => {
  it("constructing the agent makes no HTTP call", () => {
    const fetchMock = vi.fn();
    createIFlowAgent({
      apiKey: FAKE_KEY,
      fetch: fetchMock,
      llm: new StubChatModel({}),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("when fetch is injected, the global fetch is never touched", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { query: "x", organic: [] } }),
    );
    const tools = createIFlowSearchTools({ apiKey: FAKE_KEY, fetch: fetchMock });
    const webSearch = tools.find((t) => t.name === "iflow_web_search");
    await webSearch!.invoke(toolCall("iflow_web_search", { query: "x" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0]![0];
    expect(String(url)).toMatch(/^https:\/\/platform\.iflow\.cn\//);
  });
});
