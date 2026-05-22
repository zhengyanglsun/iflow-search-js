import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../src/openapi.js";
import { VERSION } from "../src/version.js";

interface PathItem {
  post: {
    operationId: string;
    summary: string;
    description: string;
    security?: Array<Record<string, string[]>>;
    requestBody: {
      required: boolean;
      content: Record<string, { schema: Record<string, unknown> }>;
    };
    responses: Record<string, unknown>;
  };
}
interface Doc {
  openapi: string;
  info: { title: string; version: string; description: string };
  paths: Record<string, PathItem>;
  components?: { securitySchemes: Record<string, unknown> };
}

describe("buildOpenApiDocument", () => {
  it("advertises all three tool routes under /tools/", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.version).toBe(VERSION);
    expect(Object.keys(doc.paths)).toEqual([
      "/tools/iflow_web_search",
      "/tools/iflow_image_search",
      "/tools/iflow_web_fetch",
    ]);
    for (const name of [
      "iflow_web_search",
      "iflow_image_search",
      "iflow_web_fetch",
    ]) {
      const item = doc.paths[`/tools/${name}`];
      expect(item.post.operationId).toBe(name);
      expect(item.post.requestBody.required).toBe(true);
      expect(item.post.requestBody.content["application/json"].schema).toBeDefined();
    }
  });

  it("omits the security scheme entirely in open mode", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    expect(doc.components).toBeUndefined();
    for (const item of Object.values(doc.paths)) {
      expect(item.post.security).toBeUndefined();
    }
  });

  it("declares BearerAuth at component + operation level when configured", () => {
    const doc = buildOpenApiDocument({ bearerAuth: true }) as Doc;
    expect(doc.components?.securitySchemes).toMatchObject({
      BearerAuth: { type: "http", scheme: "bearer" },
    });
    for (const item of Object.values(doc.paths)) {
      expect(item.post.security).toEqual([{ BearerAuth: [] }]);
    }
  });

  it("declares 200/400/401/default response shapes for every tool route", () => {
    const doc = buildOpenApiDocument({ bearerAuth: true }) as Doc;
    for (const item of Object.values(doc.paths)) {
      expect(item.post.responses).toHaveProperty("200");
      expect(item.post.responses).toHaveProperty("400");
      expect(item.post.responses).toHaveProperty("401");
      expect(item.post.responses).toHaveProperty("default");
    }
  });
});
