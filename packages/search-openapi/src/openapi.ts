/**
 * OpenAPI 3.1 description served at /openapi.json.
 *
 * Open WebUI and Coze (and other OpenAPI 3.x tool hosts) read this
 * document to populate their tool catalogs. The schema is generated
 * from the canonical TOOL_HANDLERS list so the document and the routes
 * can never drift.
 *
 * Auth: when `bearerAuth` is true, every operation declares the
 * `BearerAuth` security scheme; consumers will require the user to
 * paste a token. /health is intentionally excluded from this document
 * — it's a private liveness check, not a tool.
 */

import { TOOL_HANDLERS } from "./handlers/index.js";
import { VERSION } from "./version.js";

export interface OpenApiDocumentOptions {
  /** True when IFLOW_OPENAPI_AUTH_TOKEN is configured. */
  bearerAuth: boolean;
}

export function buildOpenApiDocument(
  options: OpenApiDocumentOptions,
): object {
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

  const security = options.bearerAuth ? [{ BearerAuth: [] as string[] }] : [];

  const paths: Record<string, object> = {};
  for (const handler of TOOL_HANDLERS) {
    paths[`/tools/${handler.name}`] = {
      post: {
        operationId: handler.name,
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
                    data: { type: "object" },
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
    openapi: "3.1.0",
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

  if (options.bearerAuth) {
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
