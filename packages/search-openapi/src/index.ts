/**
 * @iflow-ai/search-openapi — HTTP/OpenAPI tool server for the iFlow Search API.
 *
 * The package is primarily a CLI (`iflow-search-openapi`), but the request
 * listener factory and config loader are exported so the server can be
 * embedded in a larger HTTP app or driven by integration tests.
 */

export { createApp, type AppOptions } from "./server.js";
export {
  loadConfig,
  ConfigError,
  DEFAULT_PORT,
  type ResolvedConfig,
  type EnvLike,
} from "./config.js";
export { buildOpenApiDocument } from "./openapi.js";
export {
  TOOL_HANDLERS,
  webSearchHandler,
  imageSearchHandler,
  webFetchHandler,
  type ToolHandler,
} from "./handlers/index.js";
export { INTEGRATION_NAME, SOURCE, VERSION } from "./version.js";
