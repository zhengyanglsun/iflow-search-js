/**
 * Aggregate exports for the three MVP tools. Order is the order the agent
 * sees in `tools/list`; keep web-search first because it's the entry point
 * for most workflows (search → optionally fetch).
 */

import { imageSearchTool } from "./image-search.js";
import { webFetchTool } from "./web-fetch.js";
import { webSearchTool } from "./web-search.js";
import type { ToolDefinition } from "./types.js";

export type { ToolDefinition } from "./types.js";
export { webSearchTool } from "./web-search.js";
export { imageSearchTool } from "./image-search.js";
export { webFetchTool } from "./web-fetch.js";

export const allTools: readonly ToolDefinition[] = [
  webSearchTool,
  imageSearchTool,
  webFetchTool,
];
