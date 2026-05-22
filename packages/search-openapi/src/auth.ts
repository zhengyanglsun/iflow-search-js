/**
 * Bearer-token auth for the HTTP server.
 *
 * Behavior:
 *   - If no `expectedToken` is configured, every request is allowed (open mode).
 *   - If `expectedToken` is set, the request must carry
 *     `Authorization: Bearer <expectedToken>`. Tokens are compared
 *     with timing-safe equality to remove the obvious side-channel.
 *
 * The /health route is checked separately by server.ts; this module
 * does not know about route semantics.
 */

import { timingSafeEqual } from "node:crypto";

export type AuthCheckResult =
  | { ok: true }
  | { ok: false; status: 401; code: "unauthorized"; message: string };

export function checkBearer(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined,
): AuthCheckResult {
  if (!expectedToken) {
    return { ok: true };
  }

  const raw = (authorizationHeader ?? "").trim();
  if (!raw) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message:
        'Missing Authorization header. Send "Authorization: Bearer <token>".',
    };
  }

  const match = /^Bearer\s+(.+)$/i.exec(raw);
  if (!match) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message:
        "Authorization header must be of form `Bearer <token>`.",
    };
  }

  const provided = (match[1] ?? "").trim();
  if (!provided) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Bearer token is empty.",
    };
  }

  if (!safeEqual(provided, expectedToken)) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Invalid bearer token.",
    };
  }

  return { ok: true };
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // Still do a constant-time compare on equal-length buffers to avoid
    // leaking length differences via timing — compare two identical
    // throwaway buffers so we always do the same amount of work.
    const dummy = Buffer.alloc(aBuf.length);
    timingSafeEqual(aBuf, dummy);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
