/**
 * @iflow-ai/search-langchain — LangChain JS tool factories for iFlow Search.
 *
 * Built on @iflow-ai/search-core. Works with LangChain agents and LangGraph
 * (LangGraph consumes LangChain tools directly).
 *
 * See README.md for usage.
 */

export {
  createIFlowImageSearchTool,
  createIFlowSearchTools,
  createIFlowWebFetchTool,
  createIFlowWebSearchTool,
  type IFlowLangChainOptions,
} from "./tools.js";

export { INTEGRATION_NAME, SOURCE, VERSION } from "./version.js";
