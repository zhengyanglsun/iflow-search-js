/**
 * Error taxonomy. Plain objects, never Error subclasses, so adapters can
 * serialize them straight to JSON without losing fields.
 */

export type IFlowErrorCode =
  | "missing_api_key"
  | "missing_param"
  | "invalid_param"
  | "network_timeout"
  | "network_error"
  | "api_error"
  | "api_business_error";

export interface IFlowError {
  code: IFlowErrorCode;
  message: string;
  status?: number;
  detail?: unknown;
}

export function isIFlowError(value: unknown): value is IFlowError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { code?: unknown; message?: unknown };
  return typeof v.code === "string" && typeof v.message === "string";
}

export function missingApiKeyError(): IFlowError {
  return {
    code: "missing_api_key",
    message:
      "iFlow Search needs an API key. Set IFLOW_API_KEY in the environment, " +
      "or pass apiKey when constructing the client.",
  };
}

export function missingParamError(name: string): IFlowError {
  return { code: "missing_param", message: `Parameter "${name}" is required.` };
}

export function invalidParamError(name: string, detail: string): IFlowError {
  return {
    code: "invalid_param",
    message: `Parameter "${name}" is invalid: ${detail}`,
  };
}

export function networkTimeoutError(timeoutMs: number): IFlowError {
  return {
    code: "network_timeout",
    message: `Request to iFlow timed out after ${Math.round(timeoutMs)}ms.`,
  };
}

export function networkError(detail: string): IFlowError {
  return {
    code: "network_error",
    message: `Network error talking to iFlow: ${detail}`,
  };
}

export function apiHttpError(status: number, detailText: string): IFlowError {
  let message = detailText || `HTTP ${status}`;
  if (status === 401) message = "401 Unauthorized — iFlow API key missing or invalid.";
  else if (status === 403) message = "403 Forbidden — iFlow API key is not allowed for this endpoint.";
  else if (status === 429) message = "429 Too Many Requests — iFlow rate limit reached.";
  return { code: "api_error", status, message, detail: detailText || undefined };
}

export interface BusinessErrorInput {
  code?: string | number | null;
  message?: string | null;
  errorMsg?: string | null;
  errorCode?: string | number | null;
}

export function apiBusinessError(input: BusinessErrorInput): IFlowError {
  const parts: string[] = [];
  if (input.message) parts.push(String(input.message));
  if (input.errorMsg && input.errorMsg !== input.message) {
    parts.push(`detail: ${input.errorMsg}`);
  }
  const message = parts.join(" — ") || "iFlow API returned success=false without a message.";
  return {
    code: "api_business_error",
    message,
    detail: {
      code: input.errorCode ?? input.code ?? null,
      errorMsg: input.errorMsg ?? null,
    },
  };
}
