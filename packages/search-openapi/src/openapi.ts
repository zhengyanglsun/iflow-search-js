/**
 * OpenAPI description served at /openapi.json (canonical) and
 * /openapi.coze.json (Coze-flavored).
 *
 * Open WebUI consumes the canonical 3.1.0 document; Coze cannot parse 3.1
 * and additionally rejects spec-declared BearerAuth at execute time with
 * `missing AuthenticationFunc`. The Coze flavor downgrades to 3.0.3 and
 * strips every security declaration; the server-side bearer gate still
 * applies independently of what the spec advertises.
 *
 * Both profiles share the same paths, the same operationIds (modulo the
 * optional IFLOW_OPENAPI_OPERATION_SUFFIX cache-buster), the same request
 * schemas, and the same concrete inline 200 response schemas — so prompts
 * written against one runtime keep working under another.
 */

import { TOOL_HANDLERS } from "./handlers/index.js";
import { VERSION } from "./version.js";

export type OpenApiProfile = "canonical" | "coze";

export interface OpenApiDocumentOptions {
  /** Profile selects OAS version and security shape. Default: "canonical". */
  profile?: OpenApiProfile;
  /** True when IFLOW_OPENAPI_AUTH_TOKEN is configured. Ignored when profile === "coze". */
  bearerAuth: boolean;
  /** Absolute http(s) base URL injected into `servers[]` when set. */
  publicUrl?: string | undefined;
  /** Cache-buster appended to operationIds (`iflow_web_search_<suffix>`, …). */
  operationSuffix?: string | undefined;
}

const SUCCESS_SCHEMAS: Record<string, object> = {
  iflow_web_search: {
    type: "object",
    required: ["query", "count", "tookMs", "results"],
    properties: {
      query: { type: "string" },
      count: { type: "integer" },
      tookMs: { type: "integer" },
      results: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "url", "snippet"],
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            snippet: { type: "string" },
            position: { type: "integer" },
            date: { type: "string" },
          },
        },
      },
    },
  },
  iflow_image_search: {
    type: "object",
    required: ["query", "count", "tookMs", "images"],
    properties: {
      query: { type: "string" },
      count: { type: "integer" },
      tookMs: { type: "integer" },
      images: {
        type: "array",
        items: {
          type: "object",
          required: ["imageUrl"],
          properties: {
            imageUrl: { type: "string" },
            title: { type: "string" },
            sourceUrl: { type: "string" },
            width: { type: "integer" },
            height: { type: "integer" },
            position: { type: "integer" },
          },
        },
      },
    },
  },
  iflow_web_fetch: {
    type: "object",
    required: ["url", "content", "tookMs"],
    properties: {
      url: { type: "string" },
      title: { type: "string" },
      content: { type: "string" },
      fromCache: { type: "boolean" },
      tookMs: { type: "integer" },
    },
  },
};

export function buildOpenApiDocument(
  options: OpenApiDocumentOptions,
): object {
  const profile: OpenApiProfile = options.profile ?? "canonical";
  const isCoze = profile === "coze";
  const includeSecurity = !isCoze && options.bearerAuth;

  const errorSchema = {
    type: "object",
    required: ["ok", "error"],
    properties: {
      ok: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          status: { type: "integer" },
          detail: {},
        },
      },
    },
  } as const;

  const security = includeSecurity ? [{ BearerAuth: [] as string[] }] : [];

  const suffix = options.operationSuffix
    ? `_${options.operationSuffix}`
    : "";

  const paths: Record<string, object> = {};
  for (const handler of TOOL_HANDLERS) {
    const successDataSchema =
      SUCCESS_SCHEMAS[handler.name] ?? { type: "object" };
    paths[`/tools/${handler.name}`] = {
      post: {
        operationId: `${handler.name}${suffix}`,
        summary: handler.title,
        description: handler.description,
        ...(security.length > 0 ? { security } : {}),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: handler.inputSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Successful tool invocation.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok", "data"],
                  properties: {
                    ok: { type: "boolean", enum: [true] },
                    data: successDataSchema,
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid input.",
            content: {
              "application/json": { schema: errorSchema },
            },
          },
          "401": {
            description: "Missing or invalid bearer token.",
            content: {
              "application/json": { schema: errorSchema },
            },
          },
          "default": {
            description: "Error.",
            content: {
              "application/json": { schema: errorSchema },
            },
          },
        },
      },
    };
  }

  const document: Record<string, unknown> = {
    openapi: isCoze ? "3.0.3" : "3.1.0",
    info: {
      title: "iFlow Search OpenAPI",
      version: VERSION,
      description:
        "HTTP/OpenAPI tool server for the iFlow Search API. " +
        "Exposes iflow_web_search, iflow_image_search, and iflow_web_fetch " +
        "as POST endpoints for Open WebUI / Coze and other OpenAPI 3.x tool hosts.",
    },
    paths,
  };

  if (options.publicUrl) {
    document.servers = [{ url: options.publicUrl }];
  }

  if (includeSecurity) {
    document.components = {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    };
  }

  return document;
}
