/**
 * HTTP error JSON shape used by every endpoint. The OpenAPI spec
 * advertises the same shape so Open WebUI / Coze and other OpenAPI
 * tool hosts can render errors uniformly.
 *
 * iFlow errors come pre-shaped from @iflow-ai/search-core (stable codes
 * + messages). This module never re-derives codes — it just maps to
 * HTTP status codes and JSON output.
 *
 * For api_error specifically, iFlow's own HTTP status (when present on
 * `IFlowError.status`) wins over the default — that preserves the
 * upstream 401 / 403 / 429 signal to clients who key off status codes.
 */

import type { IFlowError, IFlowErrorCode } from "@iflow-ai/search-core";

export interface ErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    status?: number;
    detail?: unknown;
  };
}

const STATUS_BY_CODE: Record<IFlowErrorCode, number> = {
  missing_api_key: 401,
  missing_param: 400,
  invalid_param: 400,
  network_timeout: 504,
  network_error: 502,
  api_error: 502,
  api_business_error: 502,
};

export function statusForIFlowError(error: IFlowError): number {
  if (
    error.code === "api_error" &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }
  return STATUS_BY_CODE[error.code] ?? 500;
}

export function iflowErrorToBody(error: IFlowError): ErrorBody {
  const body: ErrorBody = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };
  if (typeof error.status === "number") body.error.status = error.status;
  if (error.detail !== undefined) body.error.detail = error.detail;
  return body;
}

export function genericErrorBody(code: string, message: string): ErrorBody {
  return { ok: false, error: { code, message } };
}
