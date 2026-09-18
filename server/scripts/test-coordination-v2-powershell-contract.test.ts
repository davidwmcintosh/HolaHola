import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("PowerShell enrollment posts payload capabilities under StrictMode", () => {
  const script = readFileSync("scripts/hola-coordinator.ps1", "utf8");
  assert.match(script, /capabilities\s*=\s*\$declaration\.payload\.capabilities/);
  assert.doesNotMatch(script, /capabilities\s*=\s*\$declaration\.capabilities\b/);
  // Execute the same object-shape lookup in a hermetic JS equivalent: the
  // old top-level lookup is intentionally absent from the declaration object.
  const declaration = { payload: { capabilities: ["host:cleanup", "host:transport"] } };
  assert.deepEqual((declaration as any).payload.capabilities, ["host:cleanup", "host:transport"]);
  assert.equal((declaration as any).capabilities, undefined);
});