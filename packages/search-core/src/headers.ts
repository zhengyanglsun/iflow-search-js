/**
 * Attribution header builder.
 *
 * Every outbound iFlow Search request carries:
 *
 *   IFlow-Source:              who's calling (framework name, e.g. "langchain")
 *   IFlow-Integration:         the npm package making the call
 *   IFlow-Integration-Version: that package's version
 *   User-Agent:                "<integrationName>/<integrationVersion>"
 *
 * Caller supplies all three values — search-core does not hard-code a source.
 *
 * Optional, only meaningful when source === "mcp":
 *
 *   IFlow-MCP-Client:          the MCP host calling this server, e.g. "hermes",
 *                              "claude-code", "claude-desktop". Caller-declared,
 *                              not auto-detected.
 *   IFlow-MCP-Client-Version:  that host's version (caller-declared).
 *
 * If `clientName` is absent the two MCP headers are not emitted at all (we
 * never send a placeholder like "unknown" — absent is a meaningful signal
 * for backend analytics).
 */

export interface AttributionInput {
  source: string;
  integrationName: string;
  integrationVersion: string;
  /** MCP host name. Only set when source === "mcp"; absent on other adapters. */
  clientName?: string;
  /** MCP host version. Ignored if clientName is absent. */
  clientVersion?: string;
}

export interface AttributionHeaders {
  "IFlow-Source": string;
  "IFlow-Integration": string;
  "IFlow-Integration-Version": string;
  "User-Agent": string;
  "IFlow-MCP-Client"?: string;
  "IFlow-MCP-Client-Version"?: string;
}

function requireNonEmpty(name: string, value: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`buildAttributionHeaders: "${name}" must be a non-empty string.`);
  }
}

export function buildAttributionHeaders(input: AttributionInput): AttributionHeaders {
  requireNonEmpty("source", input.source);
  requireNonEmpty("integrationName", input.integrationName);
  requireNonEmpty("integrationVersion", input.integrationVersion);
  const headers: AttributionHeaders = {
    "IFlow-Source": input.source,
    "IFlow-Integration": input.integrationName,
    "IFlow-Integration-Version": input.integrationVersion,
    "User-Agent": `${input.integrationName}/${input.integrationVersion}`,
  };
  const clientName =
    typeof input.clientName === "string" && input.clientName.length > 0
      ? input.clientName
      : undefined;
  if (clientName) {
    headers["IFlow-MCP-Client"] = clientName;
    const clientVersion =
      typeof input.clientVersion === "string" && input.clientVersion.length > 0
        ? input.clientVersion
        : undefined;
    if (clientVersion) {
      headers["IFlow-MCP-Client-Version"] = clientVersion;
    }
  }
  return headers;
}
