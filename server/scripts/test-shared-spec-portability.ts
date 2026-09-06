import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const portableModules = [
  "server/services/shared-spec-core.ts",
  "server/routes/shared-spec-routes.ts",
  "server/services/shared-spec-bootstrap.ts",
];

async function runCoreTestsWithoutReplitEnvironment(): Promise<void> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("REPLIT_")),
  );
  assert.equal(
    Object.keys(environment).some((name) => name.startsWith("REPLIT_")),
    false,
    "portable core test process must not receive REPLIT_* configuration",
  );

  await new Promise<void>((resolveRun, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "--test", "server/services/shared-spec-core.test.ts"],
      { cwd: root, env: environment, stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0 && !signal) resolveRun();
      else reject(new Error(`generic shared-spec core tests failed without REPLIT_* variables (${signal ?? `exit ${code}`})`));
    });
  });
}

async function main() {
  const modules = await Promise.all(
    portableModules.map(async (path) => [path, await readFile(resolve(root, path), "utf8")] as const),
  );
  const prohibitedHostImport = /^\s*(?:import|export)\b.*?\bfrom\s*["'][^"']*(?:@replit\/|replit_integrations\/|replit-auth)[^"']*["']|^\s*import\s*["'][^"']*(?:@replit\/|replit_integrations\/|replit-auth)[^"']*["']|require\(\s*["'][^"']*(?:@replit\/|replit_integrations\/|replit-auth)[^"']*["']\s*\)/gim;

  for (const [path, source] of modules) {
    assert.doesNotMatch(source, prohibitedHostImport, `${path} must not import a Replit host API`);
  }
  await runCoreTestsWithoutReplitEnvironment();
  console.log("Shared-spec portable modules have no Replit API imports and core tests pass without REPLIT_* variables.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});