import { describe, expect, it, vi } from "vitest";
import {
  createIFlowImageSearchTool,
  createIFlowSearchTools,
  createIFlowWebFetchTool,
  createIFlowWebSearchTool,
} from "../src/index.js";

const FAKE_KEY = "test-key-redacted";

// ── helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function mockFetchWith(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  return vi.fn().mockImplementation(handler);
}

/**
 * A ToolCall input. When the input carries `type: "tool_call"`, LangChain
 * wraps the tool's [content, artifact] return as a ToolMessage with
 * `.content` and `.artifact` — the realistic agent-loop shape.
 */
function toolCall(name: string, args: Record<string, unknown>) {
  return { id: "test-call-1", name, args, type: "tool_call" as const };
}

// ── tool names ───────────────────────────────────────────────────────────────

describe("tool names", () => {
  it("createIFlowWebSearchTool → iflow_web_search", () => {
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: vi.fn() });
    expect(t.name).toBe("iflow_web_search");
  });

  it("createIFlowImageSearchTool → iflow_image_search", () => {
    const t = createIFlowImageSearchTool({ apiKey: FAKE_KEY, fetch: vi.fn() });
    expect(t.name).toBe("iflow_image_search");
  });

  it("createIFlowWebFetchTool → iflow_web_fetch", () => {
    const t = createIFlowWebFetchTool({ apiKey: FAKE_KEY, fetch: vi.fn() });
    expect(t.name).toBe("iflow_web_fetch");
  });

  it("createIFlowSearchTools returns [webSearch, imageSearch, webFetch]", () => {
    const tools = createIFlowSearchTools({ apiKey: FAKE_KEY, fetch: vi.fn() });
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual([
      "iflow_web_search",
      "iflow_image_search",
      "iflow_web_fetch",
    ]);
  });
});

// ── Zod schema validation ────────────────────────────────────────────────────

describe("Zod schema validation", () => {
  it("web search rejects empty query before hitting the network", async () => {
    const fetchMock = vi.fn();
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await expect(
      t.invoke(toolCall("iflow_web_search", { query: "" })),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("image search rejects empty query before hitting the network", async () => {
    const fetchMock = vi.fn();
    const t = createIFlowImageSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await expect(
      t.invoke(toolCall("iflow_image_search", { query: "" })),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("web fetch rejects empty url before hitting the network", async () => {
    const fetchMock = vi.fn();
    const t = createIFlowWebFetchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await expect(
      t.invoke(toolCall("iflow_web_fetch", { url: "" })),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("web search rejects count > max", async () => {
    const fetchMock = vi.fn();
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await expect(
      t.invoke(toolCall("iflow_web_search", { query: "ok", count: 999 })),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("web search accepts query alone (count optional)", async () => {
    const fetchMock = mockFetchWith(() =>
      jsonResponse({ success: true, data: { query: "x", organic: [] } }),
    );
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await expect(
      t.invoke(toolCall("iflow_web_search", { query: "x" })),
    ).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

// ── happy path: tuple [summary, artifact] surfaces as ToolMessage ────────────

describe("happy path returns [summary, artifact] as ToolMessage", () => {
  it("web search", async () => {
    const fetchMock = mockFetchWith(() =>
      jsonResponse({
        success: true,
        data: {
          query: "claude",
          organic: [
            { title: "T1", link: "https://example.com/a", snippet: "first", position: 1, date: null },
            { title: "T2", link: "https://example.com/b", snippet: "second", position: 2, date: "2024" },
          ],
        },
      }),
    );
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    const message = await t.invoke(toolCall("iflow_web_search", { query: "claude", count: 2 }));
    expect(typeof message.content).toBe("string");
    expect((message.content as string).length).toBeGreaterThan(0);
    expect(message.content).toContain("T1");
    expect(message.content).toContain("T2");
    expect(message.artifact).toMatchObject({
      query: "claude",
      count: 2,
      results: [
        expect.objectContaining({ title: "T1", url: "https://example.com/a" }),
        expect.objectContaining({ title: "T2", url: "https://example.com/b" }),
      ],
    });
  });

  it("image search", async () => {
    const fetchMock = mockFetchWith(() =>
      jsonResponse({
        success: true,
        data: [{ url: "https://img/a.jpg", title: "cat", refUrl: "https://page/a" }],
      }),
    );
    const t = createIFlowImageSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    const message = await t.invoke(toolCall("iflow_image_search", { query: "cats", count: 1 }));
    expect(typeof message.content).toBe("string");
    expect((message.content as string).length).toBeGreaterThan(0);
    expect(message.artifact).toMatchObject({
      query: "cats",
      count: 1,
      images: [expect.objectContaining({ imageUrl: "https://img/a.jpg" })],
    });
  });

  it("web fetch", async () => {
    const fetchMock = mockFetchWith(() =>
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
    const t = createIFlowWebFetchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    const message = await t.invoke(
      toolCall("iflow_web_fetch", { url: "https://example.com/article" }),
    );
    expect(typeof message.content).toBe("string");
    expect(message.content).toContain("Hello");
    expect(message.artifact).toMatchObject({
      url: "https://example.com/article",
      title: "Hello",
      content: "Body of the article.",
    });
  });
});

// ── error paths: thrown Error ────────────────────────────────────────────────

describe("error paths throw", () => {
  it("missing api key → Error mentions missing_api_key, no network call", async () => {
    const fetchMock = vi.fn();
    const t = createIFlowWebSearchTool({ apiKey: "", fetch: fetchMock });
    await expect(
      t.invoke(toolCall("iflow_web_search", { query: "x" })),
    ).rejects.toThrow(/missing_api_key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("api business error (success:false) → Error mentions api_business_error and the message", async () => {
    const fetchMock = mockFetchWith(() =>
      jsonResponse({ success: false, code: "Q_LIMIT", message: "quota exceeded" }),
    );
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await expect(
      t.invoke(toolCall("iflow_web_search", { query: "x" })),
    ).rejects.toThrow(/api_business_error/);
    await expect(
      t.invoke(toolCall("iflow_web_search", { query: "x" })),
    ).rejects.toThrow(/quota exceeded/);
  });

  it("non-2xx → Error mentions api_error", async () => {
    const fetchMock = mockFetchWith(
      () => new Response("server boom", { status: 500 }),
    );
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await expect(
      t.invoke(toolCall("iflow_web_search", { query: "x" })),
    ).rejects.toThrow(/api_error/);
  });
});

// ── attribution headers ──────────────────────────────────────────────────────

describe("attribution headers reach the HTTP layer", () => {
  it("sends IFlow-Source=langchain, Integration=@iflow-ai/search-langchain, Version present, matching User-Agent", async () => {
    const fetchMock = mockFetchWith(() =>
      jsonResponse({ success: true, data: { query: "x", organic: [] } }),
    );
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await t.invoke(toolCall("iflow_web_search", { query: "x" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["IFlow-Source"]).toBe("langchain");
    expect(headers["IFlow-Integration"]).toBe("@iflow-ai/search-langchain");
    expect(typeof headers["IFlow-Integration-Version"]).toBe("string");
    expect(headers["IFlow-Integration-Version"]!.length).toBeGreaterThan(0);
    expect(headers["User-Agent"]).toBe(
      `@iflow-ai/search-langchain/${headers["IFlow-Integration-Version"]}`,
    );
  });

  it("API key never leaks into a non-Authorization header or the URL", async () => {
    const fetchMock = mockFetchWith(() =>
      jsonResponse({ success: true, data: { query: "x", organic: [] } }),
    );
    const t = createIFlowWebSearchTool({ apiKey: FAKE_KEY, fetch: fetchMock });
    await t.invoke(toolCall("iflow_web_search", { query: "x" }));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).not.toContain(FAKE_KEY);
    const headers = (init as RequestInit).headers as Record<string, string>;
    for (const [name, value] of Object.entries(headers)) {
      if (name === "Authorization") continue;
      expect(value, `${name} should not leak the key`).not.toContain(FAKE_KEY);
    }
  });
});
