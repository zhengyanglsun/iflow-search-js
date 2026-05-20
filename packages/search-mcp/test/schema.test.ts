import { describe, expect, it } from "vitest";
import { allTools } from "../src/tools/index.js";

describe("tools/list schema", () => {
  it("exposes exactly three tools in stable order", () => {
    expect(allTools).toHaveLength(3);
    expect(allTools.map((t) => t.name)).toEqual([
      "iflow_web_search",
      "iflow_image_search",
      "iflow_web_fetch",
    ]);
  });

  it("every tool has a non-empty description and a JSON-schema-shaped inputSchema", () => {
    for (const tool of allTools) {
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(typeof tool.inputSchema.properties).toBe("object");
    }
  });

  it("iflow_web_search requires `query`, accepts optional bounded `count`", () => {
    const tool = allTools.find((t) => t.name === "iflow_web_search");
    expect(tool).toBeDefined();
    const schema = tool!.inputSchema;
    expect(schema.required).toEqual(["query"]);
    const query = schema.properties.query as { type: string; minLength?: number };
    expect(query.type).toBe("string");
    expect(query.minLength).toBe(1);
    const count = schema.properties.count as {
      type: string;
      minimum?: number;
      maximum?: number;
    };
    expect(count.type).toBe("integer");
    expect(count.minimum).toBe(1);
    expect(count.maximum).toBe(20);
  });

  it("iflow_image_search requires `query`, accepts optional bounded `count`", () => {
    const tool = allTools.find((t) => t.name === "iflow_image_search");
    expect(tool).toBeDefined();
    const schema = tool!.inputSchema;
    expect(schema.required).toEqual(["query"]);
    const count = schema.properties.count as {
      type: string;
      maximum?: number;
    };
    expect(count.type).toBe("integer");
    expect(count.maximum).toBe(20);
  });

  it("iflow_web_fetch requires `url` only", () => {
    const tool = allTools.find((t) => t.name === "iflow_web_fetch");
    expect(tool).toBeDefined();
    const schema = tool!.inputSchema;
    expect(schema.required).toEqual(["url"]);
    expect(Object.keys(schema.properties)).toEqual(["url"]);
  });
});
