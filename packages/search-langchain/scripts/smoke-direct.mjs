// Ad-hoc smoke test for @iflow-ai/search-langchain.
// Reads IFLOW_API_KEY from env. Never writes the key anywhere.

import { createIFlowSearchTools } from "@iflow-ai/search-langchain";

const apiKey = process.env.IFLOW_API_KEY;
if (!apiKey) {
  console.error("IFLOW_API_KEY env var is not set.");
  process.exit(1);
}

const [webSearch, imageSearch, webFetch] = createIFlowSearchTools({ apiKey });

async function runToolCall(tool, args, label) {
  console.log(`\n========== ${label} ==========`);
  const msg = await tool.invoke({
    id: `smoke-${label}`,
    name: tool.name,
    args,
    type: "tool_call",
  });
  console.log("[content / LLM-readable summary]");
  console.log(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
  console.log("\n[artifact / structured normalized result]");
  console.log(JSON.stringify(msg.artifact, null, 2));
}

try {
  await runToolCall(webSearch, { query: "Claude 4.7 Sonnet release notes", count: 3 }, "iflow_web_search");
  await runToolCall(imageSearch, { query: "iFlow logo", count: 2 }, "iflow_image_search");

  // Use the first web search result URL for web_fetch
  const firstSearch = await webSearch.invoke({
    id: "smoke-pick",
    name: webSearch.name,
    args: { query: "Claude 4.7 Sonnet release notes", count: 1 },
    type: "tool_call",
  });
  const firstUrl = firstSearch.artifact?.results?.[0]?.url;
  if (firstUrl) {
    await runToolCall(webFetch, { url: firstUrl }, "iflow_web_fetch");
  } else {
    console.warn("\nSkipped iflow_web_fetch: no URL from search results.");
  }
} catch (err) {
  // Tool errors come through as plain Error("code: message")
  console.error("\nTOOL ERROR:", err.message);
  process.exit(2);
}
