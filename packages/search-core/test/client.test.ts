import { describe, expect, it, vi } from "vitest";
import { createIFlowSearchClient } from "../src/client.js";
import { isIFlowError } from "../src/errors.js";

const FAKE_KEY = "test-key-redacted";
const FAKE_BASE = "https://platform.iflow.cn";

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function makeClient(fetchImpl: typeof fetch, opts: { apiKey?: string; timeoutMs?: number } = {}) {
  return createIFlowSearchClient({
    apiKey: opts.apiKey ?? FAKE_KEY,
    timeoutMs: opts.timeoutMs ?? 30_000,
    fetch: fetchImpl,
    source: "core",
    integrationName: "@iflow-ai/search-core-test",
    integrationVersion: "0.0.0-test",
  });
}

describe("IFlowSearchClient.webSearch", () => {
  it("POSTs to /api/search/webSearch with keywords/num and Bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          query: "claude",
          organic: [{ title: "T", link: "https://x", snippet: "s", position: 1, date: null }],
        },
      }),
    );
    const client = makeClient(fetchMock);
    const result = await client.webSearch({ query: "claude", count: 5 });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${FAKE_BASE}/api/search/webSearch`);
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ keywords: "claude", num: 5 });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends attribution headers (Source / Integration / Integration-Version / User-Agent)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { organic: [] } }));
    const client = makeClient(fetchMock);
    await client.webSearch({ query: "x" });
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers["IFlow-Source"]).toBe("core");
    expect(headers["IFlow-Integration"]).toBe("@iflow-ai/search-core-test");
    expect(headers["IFlow-Integration-Version"]).toBe("0.0.0-test");
    expect(headers["User-Agent"]).toBe("@iflow-ai/search-core-test/0.0.0-test");
  });

  it("never includes the API key as plaintext in any non-Authorization header or url", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { organic: [] } }));
    const client = makeClient(fetchMock);
    await client.webSearch({ query: "x" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).not.toContain(FAKE_KEY);
    const headers = (init as RequestInit).headers as Record<string, string>;
    for (const [name, value] of Object.entries(headers)) {
      if (name === "Authorization") continue;
      expect(value, `${name} should not leak the key`).not.toContain(FAKE_KEY);
    }
  });
});

describe("IFlowSearchClient.imageSearch", () => {
  it("POSTs to /api/search/imageSearch with keywords/num", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: [{ url: "https://img/a", title: "a", refUrl: "https://page/a" }] }),
    );
    const client = makeClient(fetchMock);
    const result = await client.imageSearch({ query: "cats", count: 3 });
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${FAKE_BASE}/api/search/imageSearch`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ keywords: "cats", num: 3 });
  });
});

describe("IFlowSearchClient.webFetch", () => {
  it("POSTs to /api/search/webFetch with url", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { url: "https://example.com", title: "T", content: "hi", fromCache: false },
      }),
    );
    const client = makeClient(fetchMock);
    const result = await client.webFetch({ url: "https://example.com" });
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${FAKE_BASE}/api/search/webFetch`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ url: "https://example.com" });
  });
});

describe("IFlowSearchClient error mapping", () => {
  it("maps missing api key to code='missing_api_key' without making a request", async () => {
    const fetchMock = vi.fn();
    const client = makeClient(fetchMock, { apiKey: "" });
    const result = await client.webSearch({ query: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("missing_api_key");
    expect(isIFlowError(result.error)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps missing query to code='missing_param'", async () => {
    const fetchMock = vi.fn();
    const client = makeClient(fetchMock);
    const result = await client.webSearch({ query: "" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("missing_param");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps invalid count to code='invalid_param'", async () => {
    const fetchMock = vi.fn();
    const client = makeClient(fetchMock);
    const result = await client.webSearch({ query: "x", count: -1 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("invalid_param");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps missing url for webFetch to code='missing_param'", async () => {
    const fetchMock = vi.fn();
    const client = makeClient(fetchMock);
    const result = await client.webFetch({ url: "" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("missing_param");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps AbortError into network_timeout", async () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      const e: Error & { name: string } = new Error("aborted") as Error & { name: string };
      e.name = "AbortError";
      return Promise.reject(e);
    });
    const client = makeClient(fetchMock, { timeoutMs: 10 });
    const result = await client.webSearch({ query: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("network_timeout");
  });

  it("maps other fetch errors into network_error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const client = makeClient(fetchMock);
    const result = await client.webSearch({ query: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("network_error");
    expect(result.error.message).toContain("ECONNREFUSED");
  });

  it("maps non-2xx HTTP status into api_error with status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("nope", { status: 500, headers: { "content-type": "text/plain" } }),
    );
    const client = makeClient(fetchMock);
    const result = await client.webSearch({ query: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("api_error");
    expect(result.error.status).toBe(500);
  });

  it("maps success=false body into api_business_error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: false, code: "Q_LIMIT", message: "quota exceeded" }),
    );
    const client = makeClient(fetchMock);
    const result = await client.webSearch({ query: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("api_business_error");
    expect(result.error.message).toContain("quota exceeded");
  });

  it("maps invalid JSON body into api_error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not json", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const client = makeClient(fetchMock);
    const result = await client.webSearch({ query: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("api_error");
  });
});

describe("IFlowSearchClient AbortSignal plumbing", () => {
  it("passes signal through to fetch and aborts when caller's signal aborts", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const sig = init.signal!;
        if (sig.aborted) {
          const e: Error & { name: string } = new Error("aborted") as Error & { name: string };
          e.name = "AbortError";
          reject(e);
          return;
        }
        sig.addEventListener("abort", () => {
          const e: Error & { name: string } = new Error("aborted") as Error & { name: string };
          e.name = "AbortError";
          reject(e);
        });
      });
    });
    const client = makeClient(fetchMock);
    const promise = client.webSearch({ query: "x" }, controller.signal);
    controller.abort();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("network_timeout");
  });
});
