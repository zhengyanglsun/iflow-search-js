/**
 * Build a LangGraph React agent wired with iFlow Search tools.
 *
 * LangGraph consumes LangChain tools directly, so this example reuses
 * @iflow-ai/search-langchain — there is no @iflow-ai/search-langgraph
 * package and none is needed.
 */

import { ToolNode, createReactAgent } from "@langchain/langgraph/prebuilt";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { Runnable } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  createIFlowSearchTools,
  type IFlowLangChainOptions,
} from "@iflow-ai/search-langchain";

export interface CreateIFlowAgentOptions extends IFlowLangChainOptions {
  /**
   * Bring your own tool-calling LLM (e.g. ChatDeepSeek, ChatOpenAI, ChatAnthropic).
   * Must support `.bindTools(...)` and emit AIMessage with `tool_calls`.
   */
  llm: LanguageModelLike;
}

// Typed as Runnable to keep the public surface portable: the precise
// createReactAgent return type drags in deep internal LangGraph paths that
// fail TS2742 ("inferred type cannot be named without a reference to ...").
// The agent is fully usable through Runnable.invoke / .stream.
export function createIFlowAgent(
  options: CreateIFlowAgentOptions,
): Runnable {
  const { llm, ...iflowOptions } = options;
  // The cast bridges @langchain/core@0.3 types compiled into
  // @iflow-ai/search-langchain's .d.ts and the @langchain/core@1.x types
  // pulled in transitively by @langchain/langgraph@1. At runtime the tool
  // surface (name / description / schema / invoke) is identical.
  const tools = createIFlowSearchTools(iflowOptions) as unknown as StructuredToolInterface[];
  const toolNode = new ToolNode(tools);
  return createReactAgent({ llm, tools: toolNode });
}
