import { createIFlowSearchClient } from "@iflow-ai/search-core";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/server.js";
import { VERSION } from "../src/version.js";

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
    source: "openapi",
    integrationName: "@iflow-ai/search-openapi",
    integrationVersion: "0.1.0-test",
  });
}

interface Harness {
  url: string;
  close: () => Promise<void>;
}

async function startServer(options: {
  fetchImpl: typeof fetch;
  authToken?: string;
  corsOrigin?: string;
}): Promise<Harness> {
  const client = buildClient(options.fetchImpl);
  const app = createApp({
    client,
    authToken: options.authToken,
    corsOrigin: options.corsOrigin,
  });
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

describe("HTTP server", () => {
  let harness: Harness | undefined;

  beforeEach(() => {
    harness = undefined;
  });

  afterEach(async () => {
    if (harness) await harness.close();
  });

  // ── /health ───────────────────────────────────────────────────────────────

  it("GET /health returns 200 even when bearer auth is required", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () => jsonResponse({ success: true, data: { organic: [] } })),
      authToken: "secret-token",
    });
    const res = await fetch(`${harness.url}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; version: string };
    expect(body.ok).toBe(true);
    expect(body.version).toBe(VERSION);
  });

  // ── /openapi.json ─────────────────────────────────────────────────────────

  it("GET /openapi.json returns the document in open mode", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () => jsonResponse({ success: true, data: { organic: [] } })),
    });
    const res = await fetch(`${harness.url}/openapi.json`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
      components?: unknown;
    };
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toContain("/tools/iflow_web_search");
    expect(doc.components).toBeUndefined();
  });

  it("GET /openapi.json requires bearer when configured", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () => jsonResponse({ success: true, data: { organic: [] } })),
      authToken: "secret-token",
    });
    const denied = await fetch(`${harness.url}/openapi.json`);
    expect(denied.status).toBe(401);
    const ok = await fetch(`${harness.url}/openapi.json`, {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(ok.status).toBe(200);
    const doc = (await ok.json()) as { components: { securitySchemes: unknown } };
    expect(doc.components.securitySchemes).toBeDefined();
  });

  // ── tool dispatch ─────────────────────────────────────────────────────────

  it("POST /tools/iflow_web_search forwards to search-core and returns ok+data", async () => {
    const upstream = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
      expect(String(url)).toMatch(/\/api\/search\/webSearch$/);
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
    harness = await startServer({ fetchImpl: upstream as unknown as typeof fetch });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "hello", count: 3 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { query: string; results: Array<{ title: string; url: string }> };
    };
    expect(body.ok).toBe(true);
    expect(body.data.query).toBe("hello");
    expect(body.data.results[0]).toMatchObject({ title: "T", url: "https://x.test/a" });
  });

  it("POST /tools/iflow_image_search forwards to search-core", async () => {
    const upstream = vi.fn(async (url: string | URL | Request) => {
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
    harness = await startServer({ fetchImpl: upstream as unknown as typeof fetch });
    const res = await fetch(`${harness.url}/tools/iflow_image_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "cats" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { images: Array<{ imageUrl: string; title: string | null }> };
    };
    expect(body.data.images[0]).toMatchObject({
      imageUrl: "https://img.test/a.jpg",
      title: "cat",
    });
  });

  it("POST /tools/iflow_web_fetch forwards to search-core", async () => {
    const upstream = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
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
    harness = await startServer({ fetchImpl: upstream as unknown as typeof fetch });
    const res = await fetch(`${harness.url}/tools/iflow_web_fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://target.test/page" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { url: string; title: string | null; content: string };
    };
    expect(body.data.url).toBe("https://target.test/page");
    expect(body.data.title).toBe("Target Page");
    expect(body.data.content).toBe("The body.");
  });

  it("forwards openapi-source attribution to the upstream iFlow request", async () => {
    const captured: RequestInit[] = [];
    const upstream = vi.fn(async (_url: string | URL | Request, init: RequestInit = {}) => {
      captured.push(init);
      return jsonResponse({ success: true, data: { organic: [] } });
    });
    harness = await startServer({ fetchImpl: upstream as unknown as typeof fetch });
    await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "x" }),
    });
    const headers = captured[0]?.headers as Record<string, string>;
    expect(headers["IFlow-Source"]).toBe("openapi");
    expect(headers["IFlow-Integration"]).toBe("@iflow-ai/search-openapi");
    // Critically: no IFlow-MCP-Client header — that header is reserved for MCP transports.
    expect(headers).not.toHaveProperty("IFlow-MCP-Client");
    expect(headers).not.toHaveProperty("IFlow-MCP-Client-Version");
  });

  // ── error mapping ─────────────────────────────────────────────────────────

  it("returns 400 + invalid_param when query is missing", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
    });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(["missing_param", "invalid_param"]).toContain(body.error.code);
  });

  it("returns 400 + invalid_input when the request body is not valid JSON", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
    });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_input");
  });

  it("returns 400 + invalid_input when the request body is a JSON array", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
    });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([1, 2, 3]),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_input");
  });

  it("propagates upstream HTTP status via api_error", async () => {
    const upstream = vi.fn(async () =>
      new Response("rate-limit", { status: 429, headers: { "content-type": "text/plain" } }),
    );
    harness = await startServer({ fetchImpl: upstream as unknown as typeof fetch });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "x" }),
    });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string; status?: number } };
    expect(body.error.code).toBe("api_error");
    expect(body.error.status).toBe(429);
  });

  // ── routing edge cases ────────────────────────────────────────────────────

  it("returns 404 for unknown paths", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
    });
    const res = await fetch(`${harness.url}/nope`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("returns 405 for GET on a tool route", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
    });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`);
    expect(res.status).toBe(405);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("method_not_allowed");
  });

  // ── bearer auth gate ──────────────────────────────────────────────────────

  it("denies tool routes without bearer when configured", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
      authToken: "right-token",
    });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("denies tool routes with wrong bearer", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
      authToken: "right-token",
    });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({ query: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("admits tool routes with correct bearer", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
      authToken: "right-token",
    });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer right-token",
      },
      body: JSON.stringify({ query: "x" }),
    });
    expect(res.status).toBe(200);
  });

  // ── CORS gate ─────────────────────────────────────────────────────────────

  it("emits no CORS headers when corsOrigin is unset (open mode)", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
    });
    const res = await fetch(`${harness.url}/openapi.json`, {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-headers")).toBeNull();
    expect(res.headers.get("access-control-allow-methods")).toBeNull();
    expect(res.headers.get("vary")).toBeNull();
  });

  it("emits no CORS headers when corsOrigin is unset (bearer mode)", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
      authToken: "secret-token",
    });
    const res = await fetch(`${harness.url}/openapi.json`, {
      headers: {
        Origin: "http://localhost:3000",
        Authorization: "Bearer secret-token",
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("adds CORS headers on GET /openapi.json when corsOrigin is set", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
      corsOrigin: "http://localhost:3000",
    });
    const res = await fetch(`${harness.url}/openapi.json`, {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "Content-Type, Authorization",
    );
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, OPTIONS",
    );
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("adds CORS headers on GET /health when corsOrigin is set", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
      corsOrigin: "*",
    });
    const res = await fetch(`${harness.url}/health`, {
      headers: { Origin: "https://example.openwebui.local" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("OPTIONS /openapi.json returns 204 with CORS headers and empty body", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
      corsOrigin: "http://localhost:3000",
    });
    const res = await fetch(`${harness.url}/openapi.json`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, OPTIONS",
    );
    expect(await res.text()).toBe("");
  });

  it("OPTIONS /tools/iflow_web_search returns 204 with CORS headers", async () => {
    harness = await startServer({
      fetchImpl: vi.fn(async () =>
        jsonResponse({ success: true, data: { organic: [] } }),
      ),
      corsOrigin: "http://localhost:3000",
    });
    const res = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "Content-Type, Authorization",
    );
  });

  it("OPTIONS preflight bypasses the bearer gate but POST still requires the token", async () => {
    const upstream = vi.fn(async () =>
      jsonResponse({ success: true, data: { organic: [] } }),
    );
    harness = await startServer({
      fetchImpl: upstream,
      authToken: "right-token",
      corsOrigin: "http://localhost:3000",
    });

    // Preflight without Authorization succeeds.
    const pre = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, authorization",
      },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(upstream).not.toHaveBeenCalled();

    // POST without bearer is still 401 (and still carries CORS headers so the
    // browser surfaces the real 401 instead of a CORS error).
    const denied = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ query: "x" }),
    });
    expect(denied.status).toBe(401);
    expect(denied.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(upstream).not.toHaveBeenCalled();

    // POST with the right bearer succeeds and also carries CORS headers.
    const ok = await fetch(`${harness.url}/tools/iflow_web_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer right-token",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ query: "x" }),
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });
});
