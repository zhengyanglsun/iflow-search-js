/**
 * Public entry — programmatic API for embedding @iflow-ai/search-mcp inside
 * a custom host. The bundled `iflow-search-mcp` binary is the primary entry
 * point; this module is for callers who want to compose the server into
 * their own process (alternate transport, tests, etc.).
 */

export { buildServer, type BuildServerOptions } from "./server.js";
export {
  allTools,
  imageSearchTool,
  webFetchTool,
  webSearchTool,
  type ToolDefinition,
} from "./tools/index.js";
export {
  ConfigError,
  loadConfig,
  type EnvLike,
  type ResolvedConfig,
} from "./config.js";
export {
  iflowErrorToToolResult,
  unexpectedErrorToToolResult,
} from "./errors.js";
export { INTEGRATION_NAME, SOURCE, VERSION } from "./version.js";
