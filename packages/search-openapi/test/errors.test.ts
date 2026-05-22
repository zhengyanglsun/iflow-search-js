import type { IFlowError } from "@iflow-ai/search-core";
import { describe, expect, it } from "vitest";
import {
  genericErrorBody,
  iflowErrorToBody,
  statusForIFlowError,
} from "../src/errors.js";

describe("statusForIFlowError", () => {
  it("maps each IFlow code to a sensible HTTP status", () => {
    const cases: Array<[IFlowError, number]> = [
      [{ code: "missing_api_key", message: "x" }, 401],
      [{ code: "missing_param", message: "x" }, 400],
      [{ code: "invalid_param", message: "x" }, 400],
      [{ code: "network_timeout", message: "x" }, 504],
      [{ code: "network_error", message: "x" }, 502],
      [{ code: "api_error", message: "x" }, 502],
      [{ code: "api_business_error", message: "x" }, 502],
    ];
    for (const [err, expected] of cases) {
      expect(statusForIFlowError(err)).toBe(expected);
    }
  });

  it("for api_error, preserves the upstream HTTP status when present", () => {
    expect(statusForIFlowError({ code: "api_error", status: 401, message: "x" })).toBe(401);
    expect(statusForIFlowError({ code: "api_error", status: 403, message: "x" })).toBe(403);
    expect(statusForIFlowError({ code: "api_error", status: 429, message: "x" })).toBe(429);
    expect(statusForIFlowError({ code: "api_error", status: 503, message: "x" })).toBe(503);
  });

  it("ignores upstream status outside 4xx/5xx range", () => {
    expect(statusForIFlowError({ code: "api_error", status: 200, message: "x" })).toBe(502);
  });
});

describe("iflowErrorToBody", () => {
  it("includes code and message always", () => {
    const body = iflowErrorToBody({ code: "missing_param", message: "Need query." });
    expect(body).toEqual({
      ok: false,
      error: { code: "missing_param", message: "Need query." },
    });
  });

  it("includes status and detail when present on the IFlowError", () => {
    const body = iflowErrorToBody({
      code: "api_error",
      message: "rate limited",
      status: 429,
      detail: { retryAfter: 5 },
    });
    expect(body.error.status).toBe(429);
    expect(body.error.detail).toEqual({ retryAfter: 5 });
  });
});

describe("genericErrorBody", () => {
  it("produces the standard ok:false shape", () => {
    expect(genericErrorBody("not_found", "nope")).toEqual({
      ok: false,
      error: { code: "not_found", message: "nope" },
    });
  });
});
