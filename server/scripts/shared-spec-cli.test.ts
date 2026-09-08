import assert from "node:assert/strict";
import test from "node:test";
import { runSharedSpecCli } from "./shared-spec-cli";

test("list uses the authenticated shared-spec collection contract", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  let output = "";
  await runSharedSpecCli(
    ["list", "--url", "https://example.test/api/shared-spec/", "--token", "actor-token"],
    {
      fetchImpl: async (input, init) => {
        request = { url: String(input), init };
        return Response.json([]);
      },
      writeOutput: (value) => { output += value; },
    },
  );

  assert.equal(request?.url, "https://example.test/api/shared-spec/documents");
  assert.equal(request?.init?.method, "GET");
  assert.deepEqual(request?.init?.headers, { "x-shared-spec-token": "actor-token" });
  assert.equal(output, "[]\n");
});

test("export requests and prints the exact approved Markdown bytes", async () => {
  let requestedUrl = "";
  let output = "";
  await runSharedSpecCli(
    ["export", "--url", "https://example.test/api/shared-spec", "--token", "actor-token", "--id", "doc-1"],
    {
      fetchImpl: async (input) => {
        requestedUrl = String(input);
        return new Response("# Approved\n", {
          headers: { "content-type": "text/markdown; charset=utf-8" },
        });
      },
      writeOutput: (value) => { output += value; },
    },
  );

  assert.equal(requestedUrl, "https://example.test/api/shared-spec/documents/doc-1/export/raw");
  assert.equal(output, "# Approved\n\n");
});

test("mutations preserve auth and idempotency headers", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  await runSharedSpecCli(
    [
      "create", "--url", "https://example.test/api/shared-spec", "--token", "actor-token",
      "--idempotency-key", "create-1", "--title", "Portable", "--kind", "design",
      "--repository", "owner/repo", "--path", "docs/superpowers/specs/portable.md",
      "--markdown", "# Portable",
    ],
    {
      fetchImpl: async (input, init) => {
        request = { url: String(input), init };
        return Response.json({ id: "doc-1" }, { status: 201 });
      },
      writeOutput: () => {},
    },
  );

  assert.equal(request?.url, "https://example.test/api/shared-spec/documents");
  assert.equal(request?.init?.method, "POST");
  assert.deepEqual(request?.init?.headers, {
    "x-shared-spec-token": "actor-token",
    "idempotency-key": "create-1",
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    title: "Portable",
    kind: "design",
    repository: "owner/repo",
    gitPath: "docs/superpowers/specs/portable.md",
    markdown: "# Portable",
  });
});