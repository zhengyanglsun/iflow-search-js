/**
 * Resolves the package version at runtime by reading ../package.json.
 *
 * Works both in source (vitest -> packages/search-mcp/src) and after
 * compilation (dist/ -> packages/search-mcp/dist), since both sit one
 * level below package.json.
 */

import { createRequire } from "node:module";

const localRequire = createRequire(import.meta.url);
const pkg = localRequire("../package.json") as { version: string };

export const VERSION: string = pkg.version;
export const INTEGRATION_NAME = "@iflow-ai/search-mcp";
export const SOURCE = "mcp";
