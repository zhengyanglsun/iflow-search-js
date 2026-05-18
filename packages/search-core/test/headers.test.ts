import { describe, expect, it } from "vitest";
import { buildAttributionHeaders } from "../src/headers.js";

describe("buildAttributionHeaders", () => {
  it("includes IFlow-Source, IFlow-Integration, IFlow-Integration-Version and User-Agent", () => {
    const h = buildAttributionHeaders({
      source: "langchain",
      integrationName: "@iflow-ai/search-langchain",
      integrationVersion: "1.2.3",
    });
    expect(h["IFlow-Source"]).toBe("langchain");
    expect(h["IFlow-Integration"]).toBe("@iflow-ai/search-langchain");
    expect(h["IFlow-Integration-Version"]).toBe("1.2.3");
    expect(h["User-Agent"]).toBe("@iflow-ai/search-langchain/1.2.3");
  });

  it("does not include undefined or empty values", () => {
    const h = buildAttributionHeaders({
      source: "mcp",
      integrationName: "@iflow-ai/search-mcp",
      integrationVersion: "0.0.1",
    });
    for (const [k, v] of Object.entries(h)) {
      expect(v, `header ${k} should not be undefined`).not.toBeUndefined();
      expect(v, `header ${k} should not be empty`).not.toBe("");
    }
  });

  it("returns a fresh object each call (no shared mutable state)", () => {
    const a = buildAttributionHeaders({
      source: "core",
      integrationName: "foo",
      integrationVersion: "1",
    });
    const b = buildAttributionHeaders({
      source: "core",
      integrationName: "foo",
      integrationVersion: "1",
    });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("rejects empty source / integrationName / integrationVersion", () => {
    expect(() =>
      buildAttributionHeaders({
        source: "",
        integrationName: "foo",
        integrationVersion: "1",
      }),
    ).toThrow();
    expect(() =>
      buildAttributionHeaders({
        source: "x",
        integrationName: "",
        integrationVersion: "1",
      }),
    ).toThrow();
    expect(() =>
      buildAttributionHeaders({
        source: "x",
        integrationName: "foo",
        integrationVersion: "",
      }),
    ).toThrow();
  });
});
