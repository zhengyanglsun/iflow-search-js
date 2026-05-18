import { describe, expect, it } from "vitest";
import {
  normalizeWebSearch,
  normalizeImageSearch,
  normalizeWebFetch,
} from "../src/normalize.js";

describe("normalizeWebSearch", () => {
  it("maps iFlow web search envelope to flat results with title/url/snippet/position/date", () => {
    const raw = {
      success: true,
      data: {
        query: "flash attention",
        organic: [
          {
            title: "Flash Attention Paper",
            link: "https://arxiv.org/abs/2205.14135",
            snippet: "Fast and memory-efficient exact attention.",
            position: 1,
            date: "2022年5月27日",
          },
          {
            title: "Repo",
            link: "https://github.com/Dao-AILab/flash-attention",
            snippet: "Official implementation",
            position: 2,
            date: null,
          },
        ],
      },
    };
    const out = normalizeWebSearch(raw, "flash attention", 123);
    expect(out.query).toBe("flash attention");
    expect(out.count).toBe(2);
    expect(out.tookMs).toBe(123);
    expect(out.results).toHaveLength(2);
    expect(out.results[0]).toEqual({
      title: "Flash Attention Paper",
      url: "https://arxiv.org/abs/2205.14135",
      snippet: "Fast and memory-efficient exact attention.",
      position: 1,
      date: "2022年5月27日",
    });
    expect(out.results[1]?.date).toBeNull();
  });

  it("falls back to requestQuery when envelope omits query", () => {
    const out = normalizeWebSearch({ success: true, data: { organic: [] } }, "fallback", 0);
    expect(out.query).toBe("fallback");
  });

  it("returns empty results when organic missing or null", () => {
    expect(normalizeWebSearch({ success: true, data: {} }, "q", 0).results).toEqual([]);
    expect(normalizeWebSearch({ success: true, data: { organic: null } }, "q", 0).results).toEqual([]);
    expect(normalizeWebSearch(null, "q", 0).results).toEqual([]);
    expect(normalizeWebSearch(undefined, "q", 0).results).toEqual([]);
  });

  it("coerces missing string/number fields to safe defaults", () => {
    const out = normalizeWebSearch(
      {
        success: true,
        data: {
          organic: [{ title: undefined, link: undefined, snippet: undefined, position: "bad" as unknown as number, date: 7 as unknown as string }],
        },
      },
      "q",
      0,
    );
    expect(out.results[0]).toEqual({
      title: "",
      url: "",
      snippet: "",
      position: null,
      date: null,
    });
  });
});

describe("normalizeImageSearch", () => {
  it("maps flat image array with refUrl → sourceUrl", () => {
    const raw = {
      success: true,
      data: [
        { url: "https://img.example/a.jpg", title: "A", refUrl: "https://page.example/a" },
        { url: "https://img.example/b.jpg", title: null, refUrl: null },
      ],
    };
    const out = normalizeImageSearch(raw, "cats", 50);
    expect(out.query).toBe("cats");
    expect(out.count).toBe(2);
    expect(out.tookMs).toBe(50);
    expect(out.images[0]).toMatchObject({
      imageUrl: "https://img.example/a.jpg",
      title: "A",
      sourceUrl: "https://page.example/a",
    });
    expect(out.images[1]?.title).toBeNull();
    expect(out.images[1]?.sourceUrl).toBeNull();
  });

  it("drops images without imageUrl", () => {
    const raw = { success: true, data: [{ url: "", title: "x" }, { url: "https://a/b" }] };
    const out = normalizeImageSearch(raw, "q", 0);
    expect(out.count).toBe(1);
    expect(out.images[0]?.imageUrl).toBe("https://a/b");
  });

  it("returns empty when data is missing or not an array", () => {
    expect(normalizeImageSearch({ success: true }, "q", 0).images).toEqual([]);
    expect(normalizeImageSearch({ success: true, data: undefined }, "q", 0).images).toEqual([]);
    expect(normalizeImageSearch(null, "q", 0).images).toEqual([]);
  });
});

describe("normalizeWebFetch", () => {
  it("maps url/title/content and fromCache=true/false/null", () => {
    const raw = {
      success: true,
      data: {
        url: "https://example.com/article",
        title: "Article",
        content: "Hello world.",
        fromCache: true,
      },
    };
    const out = normalizeWebFetch(raw, "https://example.com/article", 9);
    expect(out).toEqual({
      url: "https://example.com/article",
      title: "Article",
      content: "Hello world.",
      fromCache: true,
      tookMs: 9,
    });
  });

  it("falls back to requestUrl when envelope url missing", () => {
    const out = normalizeWebFetch({ success: true, data: { content: "x" } }, "https://fallback", 0);
    expect(out.url).toBe("https://fallback");
    expect(out.title).toBeNull();
    expect(out.fromCache).toBeNull();
  });

  it("does not crash on null/undefined", () => {
    expect(() => normalizeWebFetch(null, "https://x", 0)).not.toThrow();
    expect(() => normalizeWebFetch(undefined, "https://x", 0)).not.toThrow();
    const out = normalizeWebFetch(null, "https://x", 0);
    expect(out.content).toBe("");
  });
});
