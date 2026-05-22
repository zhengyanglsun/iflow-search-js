import { createRequire } from "node:module";

const localRequire = createRequire(import.meta.url);
const pkg = localRequire("../package.json") as { version: string };

export const VERSION: string = pkg.version;
export const INTEGRATION_NAME = "@iflow-ai/search-openapi";
export const SOURCE = "openapi";
