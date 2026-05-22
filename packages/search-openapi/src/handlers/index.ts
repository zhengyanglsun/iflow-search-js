/**
 * Ordered list of tool handlers. Order is the order they appear in
 * /openapi.json so consumers (Open WebUI, Coze, …) get a stable
 * tool catalog.
 */

import { webSearchHandler } from "./web-search.js";
import { imageSearchHandler } from "./image-search.js";
import { webFetchHandler } from "./web-fetch.js";
import type { ToolHandler } from "./types.js";

export const TOOL_HANDLERS: readonly ToolHandler[] = [
  webSearchHandler,
  imageSearchHandler,
  webFetchHandler,
];

export type { ToolHandler };
export { webSearchHandler, imageSearchHandler, webFetchHandler };
