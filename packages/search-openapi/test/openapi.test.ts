import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../src/openapi.js";
import { VERSION } from "../src/version.js";

interface ResponseObject {
  description: string;
  content: Record<string, { schema: Record<string, unknown> }>;
}
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
    responses: Record<string, ResponseObject>;
  };
}
interface Doc {
  openapi: string;
  info: { title: string; version: string; description: string };
  paths: Record<string, PathItem>;
  servers?: Array<{ url: string }>;
  components?: { securitySchemes: Record<string, unknown> };
}

const CANONICAL_TOOL_NAMES = [
  "iflow_web_search",
  "iflow_image_search",
  "iflow_web_fetch",
] as const;

function objectSchema(schema: unknown): Record<string, unknown> {
  if (schema && typeof schema === "object") return schema as Record<string, unknown>;
  throw new Error("expected schema to be an object");
}

function successDataSchema(item: PathItem): Record<string, unknown> {
  const schema = item.post.responses["200"]?.content["application/json"]?.schema;
  const top = objectSchema(schema);
  const props = objectSchema(top.properties);
  return objectSchema(props.data);
}

describe("buildOpenApiDocument — canonical profile (default)", () => {
  it("advertises all three tool routes under /tools/", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.version).toBe(VERSION);
    expect(Object.keys(doc.paths)).toEqual([
      "/tools/iflow_web_search",
      "/tools/iflow_image_search",
      "/tools/iflow_web_fetch",
    ]);
    for (const name of CANONICAL_TOOL_NAMES) {
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

  it("omits servers[] when publicUrl is not set", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    expect(doc.servers).toBeUndefined();
  });
});

describe("buildOpenApiDocument — coze profile", () => {
  it("renders openapi: 3.0.3 instead of 3.1.0", () => {
    const doc = buildOpenApiDocument({ profile: "coze", bearerAuth: false }) as Doc;
    expect(doc.openapi).toBe("3.0.3");
  });

  it("never declares security even when bearerAuth is true", () => {
    const doc = buildOpenApiDocument({ profile: "coze", bearerAuth: true }) as Doc;
    expect(doc.components).toBeUndefined();
    for (const item of Object.values(doc.paths)) {
      expect(item.post.security).toBeUndefined();
    }
  });

  it("keeps the same canonical operationIds by default", () => {
    const doc = buildOpenApiDocument({ profile: "coze", bearerAuth: false }) as Doc;
    for (const name of CANONICAL_TOOL_NAMES) {
      expect(doc.paths[`/tools/${name}`].post.operationId).toBe(name);
    }
  });

  it("preserves the same tool paths as canonical", () => {
    const coze = buildOpenApiDocument({ profile: "coze", bearerAuth: false }) as Doc;
    const canonical = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    expect(Object.keys(coze.paths)).toEqual(Object.keys(canonical.paths));
  });
});

describe("buildOpenApiDocument — servers injection", () => {
  it("injects servers[0].url in the canonical profile when publicUrl is set", () => {
    const doc = buildOpenApiDocument({
      bearerAuth: false,
      publicUrl: "https://iflow.example.com:8443",
    }) as Doc;
    expect(doc.servers).toEqual([{ url: "https://iflow.example.com:8443" }]);
  });

  it("injects servers[0].url in the coze profile when publicUrl is set", () => {
    const doc = buildOpenApiDocument({
      profile: "coze",
      bearerAuth: false,
      publicUrl: "https://iflow.example.com",
    }) as Doc;
    expect(doc.servers).toEqual([{ url: "https://iflow.example.com" }]);
  });
});

describe("buildOpenApiDocument — operationSuffix cache-buster", () => {
  it("appends `_<suffix>` to every operationId in both profiles", () => {
    for (const profile of ["canonical", "coze"] as const) {
      const doc = buildOpenApiDocument({
        profile,
        bearerAuth: false,
        operationSuffix: "open3",
      }) as Doc;
      for (const name of CANONICAL_TOOL_NAMES) {
        expect(doc.paths[`/tools/${name}`].post.operationId).toBe(`${name}_open3`);
      }
    }
  });

  it("leaves tool paths unchanged when operationSuffix is set", () => {
    const doc = buildOpenApiDocument({
      bearerAuth: false,
      operationSuffix: "v2",
    }) as Doc;
    expect(Object.keys(doc.paths)).toEqual([
      "/tools/iflow_web_search",
      "/tools/iflow_image_search",
      "/tools/iflow_web_fetch",
    ]);
  });
});

describe("buildOpenApiDocument — concrete inline 200 data schemas", () => {
  // These assertions are the load-bearing fix for Coze Agent rendering:
  // an untyped `data: { type: "object" }` collapses to `data {0}` in Coze
  // even when ok=true and real results came back. Concrete inline
  // properties are also strictly additive for Open WebUI.

  for (const profile of ["canonical", "coze"] as const) {
    it(`${profile}: iflow_web_search data declares results[] with title/url/snippet`, () => {
      const doc = buildOpenApiDocument({ profile, bearerAuth: false }) as Doc;
      const data = successDataSchema(doc.paths["/tools/iflow_web_search"]);
      expect(data.type).toBe("object");
      const props = objectSchema(data.properties);
      expect(objectSchema(props.query).type).toBe("string");
      expect(objectSchema(props.count).type).toBe("integer");
      expect(objectSchema(props.tookMs).type).toBe("integer");
      const results = objectSchema(props.results);
      expect(results.type).toBe("array");
      const item = objectSchema(results.items);
      const itemProps = objectSchema(item.properties);
      expect(objectSchema(itemProps.title).type).toBe("string");
      expect(objectSchema(itemProps.url).type).toBe("string");
      expect(objectSchema(itemProps.snippet).type).toBe("string");
      expect(objectSchema(itemProps.position).type).toBe("integer");
      expect(objectSchema(itemProps.date).type).toBe("string");
    });

    it(`${profile}: iflow_image_search data declares images[] with imageUrl/title/sourceUrl`, () => {
      const doc = buildOpenApiDocument({ profile, bearerAuth: false }) as Doc;
      const data = successDataSchema(doc.paths["/tools/iflow_image_search"]);
      const props = objectSchema(data.properties);
      const images = objectSchema(props.images);
      expect(images.type).toBe("array");
      const item = objectSchema(images.items);
      const itemProps = objectSchema(item.properties);
      expect(objectSchema(itemProps.imageUrl).type).toBe("string");
      expect(objectSchema(itemProps.title).type).toBe("string");
      expect(objectSchema(itemProps.sourceUrl).type).toBe("string");
      expect(objectSchema(itemProps.width).type).toBe("integer");
      expect(objectSchema(itemProps.height).type).toBe("integer");
      expect(objectSchema(itemProps.position).type).toBe("integer");
    });

    it(`${profile}: iflow_web_fetch data declares url/title/content/fromCache/tookMs`, () => {
      const doc = buildOpenApiDocument({ profile, bearerAuth: false }) as Doc;
      const data = successDataSchema(doc.paths["/tools/iflow_web_fetch"]);
      const props = objectSchema(data.properties);
      expect(objectSchema(props.url).type).toBe("string");
      expect(objectSchema(props.title).type).toBe("string");
      expect(objectSchema(props.content).type).toBe("string");
      expect(objectSchema(props.fromCache).type).toBe("boolean");
      expect(objectSchema(props.tookMs).type).toBe("integer");
    });
  }

  it("never leaves data as an untyped { type: 'object' }", () => {
    for (const profile of ["canonical", "coze"] as const) {
      const doc = buildOpenApiDocument({ profile, bearerAuth: false }) as Doc;
      for (const item of Object.values(doc.paths)) {
        const data = successDataSchema(item);
        expect(data.properties).toBeDefined();
        expect(
          Object.keys(objectSchema(data.properties)).length,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("Open WebUI contract — canonical /openapi.json preservation", () => {
  // These assertions lock down the parts of the canonical document that
  // Open WebUI consumes today. Any future change is allowed to ADD fields,
  // but removing or renaming any of these would break Open WebUI deployments
  // currently using @next.

  it("retains openapi 3.1.0", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    expect(doc.openapi).toBe("3.1.0");
  });

  it("retains the three canonical tool paths in order", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    expect(Object.keys(doc.paths)).toEqual([
      "/tools/iflow_web_search",
      "/tools/iflow_image_search",
      "/tools/iflow_web_fetch",
    ]);
  });

  it("retains canonical operationIds by default (no suffix)", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    for (const name of CANONICAL_TOOL_NAMES) {
      expect(doc.paths[`/tools/${name}`].post.operationId).toBe(name);
    }
  });

  it("retains a JSON request body schema with `query` (search) or `url` (fetch)", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    const requireSchema = (name: string) =>
      objectSchema(
        doc.paths[`/tools/${name}`].post.requestBody.content["application/json"]
          .schema,
      );
    for (const name of ["iflow_web_search", "iflow_image_search"]) {
      const schema = requireSchema(name);
      const props = objectSchema(schema.properties);
      expect(props.query).toBeDefined();
      expect(schema.required).toEqual(expect.arrayContaining(["query"]));
    }
    const fetchSchema = requireSchema("iflow_web_fetch");
    const fetchProps = objectSchema(fetchSchema.properties);
    expect(fetchProps.url).toBeDefined();
    expect(fetchSchema.required).toEqual(expect.arrayContaining(["url"]));
  });

  it("retains 200/400/401/default response slots on every tool route", () => {
    const doc = buildOpenApiDocument({ bearerAuth: true }) as Doc;
    for (const item of Object.values(doc.paths)) {
      for (const status of ["200", "400", "401", "default"]) {
        expect(item.post.responses[status]).toBeDefined();
        expect(
          item.post.responses[status].content["application/json"].schema,
        ).toBeDefined();
      }
    }
  });

  it("retains BearerAuth component + per-op security when bearerAuth is on", () => {
    const doc = buildOpenApiDocument({ bearerAuth: true }) as Doc;
    expect(doc.components?.securitySchemes).toMatchObject({
      BearerAuth: { type: "http", scheme: "bearer" },
    });
    for (const item of Object.values(doc.paths)) {
      expect(item.post.security).toEqual([{ BearerAuth: [] }]);
    }
  });

  it("does NOT silently add servers[] in canonical when publicUrl is unset", () => {
    const doc = buildOpenApiDocument({ bearerAuth: false }) as Doc;
    expect(doc.servers).toBeUndefined();
  });
});
