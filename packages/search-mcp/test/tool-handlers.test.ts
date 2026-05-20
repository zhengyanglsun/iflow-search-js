import { createIFlowSearchClient } from "@iflow-ai/search-core";
import { describe, expect, it, vi } from "vitest";
import { allTools, imageSearchTool, webFetchTool, webSearchTool } from "../src/tools/index.js";

const FAKE_KEY = "test-key-redacted";

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function buildClient(fetchImpl: typeof fetch) {
  return createIFlowSearchClient({
    apiKey: FAKE_KEY,
    fetch: fetchImpl,
    source: "mcp",
    integrationName: "@iflow-ai/search-mcp",
    integrationVersion: "0.1.0-test",
  });
}

// ── attribution headers ──────────────────────────────────────────────────────

describe("attribution headers", () => {
  it("every outbound request carries IFlow-Source: mcp and IFlow-Integration: @iflow-ai/search-mcp", async () => {
    const captured: RequestInit[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
      captured.push(init);
      const u = String(url);
      if (u.endsWith("/api/search/imageSearch")) {
        return jsonResponse({ success: true, data: [] });
      }
      if (u.endsWith("/api/search/webFetch")) {
        return jsonResponse({
          success: true,
          data: { url: "https://example.test/", title: null, content: "", fromCache: false },
        });
      }
      return jsonResponse({ success: true, data: { organic: [] } });
    });
    const client = buildClient(fetchMock as unknown as typeof fetch);

    await webSearchTool.handle({ query: "anything" }, client);
    await imageSearchTool.handle({ query: "anything" }, client);
    await webFetchTool.handle({ url: "https://example.test/" }, client);

    expect(captured).toHaveLength(3);
    for (const init of captured) {
      const headers = init.headers as Record<string, string>;
      expect(headers["IFlow-Source"]).toBe("mcp");
      expect(headers["IFlow-Integration"]).toBe("@iflow-ai/search-mcp");
      expect(headers["IFlow-Integration-Version"]).toBe("0.1.0-test");
      expect(headers["User-Agent"]).toBe("@iflow-ai/search-mcp/0.1.0-test");
      expect(headers["Authorization"]).toBe(`Bearer ${FAKE_KEY}`);
    }
  });
});

// ── endpoint dispatch ────────────────────────────────────────────────────────

describe("endpoint dispatch", () => {
  it("iflow_web_search POSTs /api/search/webSearch with keywords+num", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
      expect(String(url)).toMatch(/\/api\/search\/webSearch$/);
      expect(init.method).toBe("POST");
      const body = JSON.parse(String(init.body)) as { keywords?: string; num?: number };
      expect(body.keywords).toBe("hello");
      expect(body.num).toBe(3);
      return jsonResponse({
        success: true,
        data: {
          organic: [
            { title: "T", link: "https://x.test/a", snippet: "snip", date: null, position: 1 },
          ],
        },
      });
    });
    const client = buildClient(fetchMock as unknown as typeof fetch);
    const result = await webSearchTool.handle({ query: "hello", count: 3 }, client);
    expect(result.isError).toBeFalsy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const structured = result.structuredContent as {
      query: string;
      count: number;
      results: Array<{ title: string; url: string }>;
    };
    expect(structured.query).toBe("hello");
    // normalizeWebSearch reports `count` as the number of results actually
    // returned by iFlow, not the requested page size.
    expect(structured.count).toBe(structured.results.length);
    expect(structured.results[0]).toMatchObject({ title: "T", url: "https://x.test/a" });
  });

  it("iflow_image_search POSTs /api/search/imageSearch", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toMatch(/\/api\/search\/imageSearch$/);
      return jsonResponse({
        success: true,
        data: [
          {
            url: "https://img.test/a.jpg",
            title: "cat",
            refUrl: "https://src.test/",
            width: 100,
            height: 80,
            position: 1,
          },
        ],
      });
    });
    const client = buildClient(fetchMock as unknown as typeof fetch);
    const result = await imageSearchTool.handle({ query: "cats" }, client);
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      images: Array<{ imageUrl: string; title: string | null }>;
    };
    expect(structured.images[0]).toMatchObject({
      imageUrl: "https://img.test/a.jpg",
      title: "cat",
    });
  });

  it("iflow_web_fetch POSTs /api/search/webFetch with url", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
      expect(String(url)).toMatch(/\/api\/search\/webFetch$/);
      const body = JSON.parse(String(init.body)) as { url?: string };
      expect(body.url).toBe("https://target.test/page");
      return jsonResponse({
        success: true,
        data: {
          url: "https://target.test/page",
          title: "Target Page",
          content: "The body.",
          fromCache: false,
        },
      });
    });
    const client = buildClient(fetchMock as unknown as typeof fetch);
    const result = await webFetchTool.handle(
      { url: "https://target.test/page" },
      client,
    );
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      url: string;
      title: string | null;
      content: string;
    };
    expect(structured.url).toBe("https://target.test/page");
    expect(structured.title).toBe("Target Page");
    expect(structured.content).toBe("The body.");
  });

  it("the three tools have stable names and ordering exposed via allTools", () => {
    expect(allTools.map((t) => t.name)).toEqual([
      "iflow_web_search",
      "iflow_image_search",
      "iflow_web_fetch",
    ]);
  });
});

// ── content shape ────────────────────────────────────────────────────────────

describe("CallToolResult content shape", () => {
  it("success result has a text content block AND structuredContent", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: {
          organic: [
            { title: "Hello", link: "https://h.test/", snippet: "world", date: null, position: 1 },
          ],
        },
      }),
    );
    const client = buildClient(fetchMock as unknown as typeof fetch);
    const result = await webSearchTool.handle({ query: "hi" }, client);
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe("text");
    expect(result.structuredContent).toBeDefined();
  });

  it("empty results produce a friendly summary, not a thrown error", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, data: { organic: [] } }),
    );
    const client = buildClient(fetchMock as unknown as typeof fetch);
    const result = await webSearchTool.handle({ query: "noresults" }, client);
    expect(result.isError).toBeFalsy();
    const first = result.content[0] as { type: string; text: string };
    expect(first.text.toLowerCase()).toContain("no web results");
  });
});
