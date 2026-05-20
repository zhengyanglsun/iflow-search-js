import { describe, expect, it } from "vitest";
import type { IFlowError } from "@iflow-ai/search-core";
import { iflowErrorToToolResult, unexpectedErrorToToolResult } from "../src/errors.js";

describe("iflowErrorToToolResult", () => {
  it("converts a missing_api_key error into an isError result", () => {
    const err: IFlowError = {
      code: "missing_api_key",
      message: "iFlow Search needs an API key.",
    };
    const result = iflowErrorToToolResult(err, "iflow_web_search");
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect((result.content[0] as { text: string }).text).toContain("iflow_web_search failed");
    expect((result.content[0] as { text: string }).text).toContain("missing_api_key");
    const structured = result.structuredContent as {
      tool: string;
      error: { code: string; message: string };
    };
    expect(structured.tool).toBe("iflow_web_search");
    expect(structured.error.code).toBe("missing_api_key");
  });

  it("propagates status and detail fields when present (api_error)", () => {
    const err: IFlowError = {
      code: "api_error",
      message: "401 Unauthorized — iFlow API key missing or invalid.",
      status: 401,
      detail: "Unauthorized",
    };
    const result = iflowErrorToToolResult(err, "iflow_web_fetch");
    const structured = result.structuredContent as {
      error: { code: string; status?: number; detail?: unknown };
    };
    expect(structured.error.status).toBe(401);
    expect(structured.error.detail).toBe("Unauthorized");
  });

  it("handles every IFlowError code without throwing", () => {
    const codes: IFlowError["code"][] = [
      "missing_api_key",
      "missing_param",
      "invalid_param",
      "network_timeout",
      "network_error",
      "api_error",
      "api_business_error",
    ];
    for (const code of codes) {
      const result = iflowErrorToToolResult(
        { code, message: `${code} test` },
        "iflow_web_search",
      );
      expect(result.isError).toBe(true);
      const structured = result.structuredContent as { error: { code: string } };
      expect(structured.error.code).toBe(code);
    }
  });
});

describe("unexpectedErrorToToolResult", () => {
  it("turns an arbitrary thrown Error into an isError result with code internal_error", () => {
    const result = unexpectedErrorToToolResult(new Error("boom"), "iflow_web_search");
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("boom");
    const structured = result.structuredContent as { error: { code: string } };
    expect(structured.error.code).toBe("internal_error");
  });

  it("handles non-Error throwables", () => {
    const result = unexpectedErrorToToolResult("just a string", "iflow_web_search");
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("just a string");
  });
});
