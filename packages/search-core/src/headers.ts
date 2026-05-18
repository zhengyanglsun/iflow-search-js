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
 */

export interface AttributionInput {
  source: string;
  integrationName: string;
  integrationVersion: string;
}

export interface AttributionHeaders {
  "IFlow-Source": string;
  "IFlow-Integration": string;
  "IFlow-Integration-Version": string;
  "User-Agent": string;
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
  return {
    "IFlow-Source": input.source,
    "IFlow-Integration": input.integrationName,
    "IFlow-Integration-Version": input.integrationVersion,
    "User-Agent": `${input.integrationName}/${input.integrationVersion}`,
  };
}
