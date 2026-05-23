/**
 * HTTP request listener for the iFlow Search OpenAPI server.
 *
 * Routes:
 *   GET  /health                       — liveness, never gated by bearer auth
 *   GET  /openapi.json                 — OpenAPI 3.1 schema (bearer-gated when configured)
 *   POST /tools/iflow_web_search       — search-core webSearch passthrough
 *   POST /tools/iflow_image_search     — search-core imageSearch passthrough
 *   POST /tools/iflow_web_fetch        — search-core webFetch passthrough
 *
 * Design notes:
 *   - The server is dependency-light: just the Node built-in `http` module
 *     plus search-core. No Express / Fastify / Koa.
 *   - All HTTP, Authorization, attribution headers, and iFlow error mapping
 *     live in @iflow-ai/search-core. This server only translates between
 *     JSON-over-HTTP and the typed search-core client.
 *   - The handler list is the single source of truth for both the routes
 *     and /openapi.json.
 *   - Body size is capped at MAX_BODY_BYTES to keep tool platforms from
 *     accidentally streaming megabytes into the server.
 */

import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import type { IFlowSearchClient } from "@iflow-ai/search-core";
import { checkBearer } from "./auth.js";
import { TOOL_HANDLERS, type ToolHandler } from "./handlers/index.js";
import { buildOpenApiDocument } from "./openapi.js";
import { genericErrorBody, type ErrorBody } from "./errors.js";
import { VERSION } from "./version.js";

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MiB

export interface AppOptions {
  /** Authenticated iFlow client built from ResolvedConfig in bin.ts. */
  client: IFlowSearchClient;
  /** When set, every route except /health requires `Authorization: Bearer <token>`. */
  authToken: string | undefined;
  /**
   * When set, every response carries `Access-Control-Allow-Origin: <value>` plus
   * the companion CORS headers, and `OPTIONS` short-circuits to 204 without the
   * bearer gate. Absent ⇒ no CORS headers (current behavior). Config validates
   * the value so it is safe to copy verbatim into a response header.
   */
  corsOrigin?: string | undefined;
}

const CORS_ALLOWED_HEADERS = "Content-Type, Authorization, X-Session-Id";
const CORS_ALLOWED_METHODS = "GET, POST, OPTIONS";

export function createApp(options: AppOptions): RequestListener {
  const { client, authToken, corsOrigin } = options;
  const openApiDocument = buildOpenApiDocument({
    bearerAuth: authToken !== undefined,
  });
  const openApiJson = JSON.stringify(openApiDocument);

  const handlersByPath = new Map<string, ToolHandler>();
  for (const handler of TOOL_HANDLERS) {
    handlersByPath.set(`/tools/${handler.name}`, handler);
  }

  return async function listener(req, res) {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname;

      // CORS gate runs before /health and before the bearer check so that
      // browser preflights from Open WebUI / Coze succeed without a token.
      // When corsOrigin is unset the block is a complete no-op and the
      // server behaves exactly as before.
      if (corsOrigin !== undefined) {
        res.setHeader("Access-Control-Allow-Origin", corsOrigin);
        res.setHeader("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
        res.setHeader("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
        res.setHeader("Vary", "Origin");
        if (method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
      }

      // /health is intentionally outside the auth gate.
      if (method === "GET" && pathname === "/health") {
        return sendJson(res, 200, { ok: true, version: VERSION });
      }

      const authResult = checkBearer(
        req.headers["authorization"],
        authToken,
      );
      if (!authResult.ok) {
        return sendJson(res, authResult.status, {
          ok: false,
          error: { code: authResult.code, message: authResult.message },
        } satisfies ErrorBody);
      }

      if (method === "GET" && pathname === "/openapi.json") {
        return sendRawJson(res, 200, openApiJson);
      }

      const toolHandler = handlersByPath.get(pathname);
      if (toolHandler) {
        if (method !== "POST") {
          return sendJson(
            res,
            405,
            genericErrorBody(
              "method_not_allowed",
              `Use POST for /tools/${toolHandler.name}.`,
            ),
          );
        }

        const bodyResult = await readJsonBody(req);
        if (!bodyResult.ok) {
          return sendJson(res, bodyResult.status, bodyResult.body);
        }

        const handlerResult = await toolHandler.handle(bodyResult.value, client);
        return sendJson(res, handlerResult.status, handlerResult.body);
      }

      return sendJson(
        res,
        404,
        genericErrorBody("not_found", `No route for ${method} ${pathname}.`),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Last-resort fallback. Should never be reached because handlers
      // route IFlowError through statusForIFlowError + iflowErrorToBody.
      return sendJson(
        res,
        500,
        genericErrorBody("internal_error", message),
      );
    }
  };
}

interface ReadBodyOk {
  ok: true;
  value: unknown;
}
interface ReadBodyErr {
  ok: false;
  status: number;
  body: ErrorBody;
}

async function readJsonBody(
  req: IncomingMessage,
): Promise<ReadBodyOk | ReadBodyErr> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let aborted = false;

    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        aborted = true;
        req.destroy();
        resolve({
          ok: false,
          status: 413,
          body: genericErrorBody(
            "payload_too_large",
            `Request body exceeds ${MAX_BODY_BYTES} bytes.`,
          ),
        });
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (aborted) return;
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (raw.length === 0) {
        resolve({ ok: true, value: {} });
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          resolve({
            ok: false,
            status: 400,
            body: genericErrorBody(
              "invalid_input",
              "Request body must be a JSON object.",
            ),
          });
          return;
        }
        resolve({ ok: true, value: parsed });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        resolve({
          ok: false,
          status: 400,
          body: genericErrorBody(
            "invalid_input",
            `Request body is not valid JSON: ${message}`,
          ),
        });
      }
    });

    req.on("error", (err) => {
      if (aborted) return;
      aborted = true;
      resolve({
        ok: false,
        status: 400,
        body: genericErrorBody("invalid_input", err.message),
      });
    });
  });
}

function sendJson(res: ServerResponse, status: number, body: object): void {
  sendRawJson(res, status, JSON.stringify(body));
}

function sendRawJson(res: ServerResponse, status: number, json: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(json).toString());
  res.end(json);
}
