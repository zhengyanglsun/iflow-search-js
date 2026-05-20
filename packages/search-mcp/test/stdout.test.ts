/**
 * stdout purity: the MCP server reserves stdout for the JSON-RPC stream.
 * Any banner or fatal-init message must go to stderr. We verify by spawning
 * the compiled binary with a known-bad config (no IFLOW_API_KEY) and
 * checking that stdout is empty while stderr names the missing variable.
 *
 * Runs against `dist/bin.js`; expects `pnpm build` to have already produced
 * the file (the validation gate orders typecheck → build → test).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_PATH = resolve(__dirname, "../dist/bin.js");

interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runBin(env: NodeJS.ProcessEnv): Promise<SpawnResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [BIN_PATH], {
      env: { ...env, NODE_ENV: "test" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

describe("stdout purity", () => {
  const distBuilt = existsSync(BIN_PATH);

  (distBuilt ? it : it.skip)(
    "missing IFLOW_API_KEY exits 1 with diagnostic on stderr only — stdout is empty",
    async () => {
      const result = await runBin({
        PATH: process.env.PATH,
        // deliberately no IFLOW_API_KEY
      });
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("IFLOW_API_KEY");
      // The message must not leak the binary's location either.
      expect(result.stderr).not.toContain("sk-");
    },
    15000,
  );

  (distBuilt ? it : it.skip)(
    "invalid IFLOW_TIMEOUT_MS exits 1 with diagnostic on stderr only",
    async () => {
      const result = await runBin({
        PATH: process.env.PATH,
        IFLOW_API_KEY: "test-key",
        IFLOW_TIMEOUT_MS: "abc",
      });
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("IFLOW_TIMEOUT_MS");
    },
    15000,
  );

  if (!distBuilt) {
    it("(stdout-purity child-process tests skipped: dist/bin.js missing — run `pnpm build` first)", () => {
      expect(distBuilt).toBe(false);
    });
  }
});
