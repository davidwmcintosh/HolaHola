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

for (const markdown of ["# Approved\n", "# Approved"]) {
  test(`export preserves exact approved Markdown bytes ${markdown.endsWith("\n") ? "with" : "without"} a terminal newline`, async () => {
    let requestedUrl = "";
    let output = "";
    await runSharedSpecCli(
      ["export", "--url", "https://example.test/api/shared-spec", "--token", "actor-token", "--id", "doc-1"],
      {
        fetchImpl: async (input) => {
          requestedUrl = String(input);
          return new Response(markdown, {
            headers: { "content-type": "text/markdown; charset=utf-8" },
          });
        },
        writeOutput: (value) => { output += value; },
      },
    );

    assert.equal(requestedUrl, "https://example.test/api/shared-spec/documents/doc-1/export/raw");
    assert.equal(output, markdown);
  });
}

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
    liveInstructionDocument: false,
  });
});

test("create sets liveInstructionDocument when --live-instruction-document is passed", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  await runSharedSpecCli(
    [
      "create", "--url", "https://example.test/api/shared-spec", "--token", "actor-token",
      "--idempotency-key", "create-2", "--title", "Live Doc", "--kind", "architecture",
      "--repository", "owner/repo", "--path", "docs/superpowers/specs/live.md",
      "--markdown", "# Live", "--live-instruction-document",
    ],
    {
      fetchImpl: async (input, init) => {
        request = { url: String(input), init };
        return Response.json({ id: "doc-1" }, { status: 201 });
      },
      writeOutput: () => {},
    },
  );

  assert.equal((JSON.parse(String(request?.init?.body)) as { liveInstructionDocument?: boolean }).liveInstructionDocument, true);
});

test("share defaults the repository and normalizes the note path", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  await runSharedSpecCli(
    [
      "share", "--url", "https://example.test/api/shared-spec", "--token", "actor-token",
      "--idempotency-key", "share-1", "--path", "gate3-verifier-coprovisioning-gap",
      "--markdown", "# Finding",
    ],
    {
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), init });
        return Response.json({ document: { id: "doc-1" }, revision: { id: "rev-1" }, created: true }, { status: 201 });
      },
      writeOutput: () => {},
    },
  );

  assert.equal(requests[0].url, "https://example.test/api/shared-spec/documents/share");
  assert.equal(requests[0].init?.method, "POST");
  assert.deepEqual(requests[0].init?.headers, {
    "x-shared-spec-token": "actor-token",
    "idempotency-key": "share-1",
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    repository: "luca-hats/notes",
    gitPath: "notes/gate3-verifier-coprovisioning-gap.md",
    markdown: "# Finding",
  });
});

test("share honors an explicit repository, an already-prefixed path, a base revision, and a notify target", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  await runSharedSpecCli(
    [
      "share", "--url", "https://example.test/api/shared-spec", "--token", "actor-token",
      "--idempotency-key", "share-2", "--repository", "custom/space",
      "--path", "notes/finding.md", "--markdown", "# Updated",
      "--base", "rev-1", "--notify", "luca-claude-code",
    ],
    {
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), init });
        return Response.json({ document: { id: "doc-1" }, revision: { id: "rev-2" }, created: false });
      },
      writeOutput: () => {},
    },
  );
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    repository: "custom/space",
    gitPath: "notes/finding.md",
    markdown: "# Updated",
    baseRevisionId: "rev-1",
    notifyActorId: "luca-claude-code",
  });
});

test("pull looks up by destination, then merges the current document with its revision history", async () => {
  const requests: string[] = [];
  let output = "";
  await runSharedSpecCli(
    ["pull", "--url", "https://example.test/api/shared-spec", "--token", "actor-token", "--path", "finding"],
    {
      fetchImpl: async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.includes("by-destination")) {
          return Response.json({ document: { id: "doc-1", gitPath: "notes/finding.md" }, currentRevision: { id: "rev-2" } });
        }
        return Response.json([{ id: "rev-1" }, { id: "rev-2" }]);
      },
      writeOutput: (value) => { output += value; },
    },
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0], "https://example.test/api/shared-spec/documents/by-destination?repository=luca-hats%2Fnotes&gitPath=notes%2Ffinding.md");
  assert.equal(requests[1], "https://example.test/api/shared-spec/documents/doc-1/revisions");
  const parsed = JSON.parse(output);
  assert.equal(parsed.document.id, "doc-1");
  assert.deepEqual(parsed.revisions, [{ id: "rev-1" }, { id: "rev-2" }]);
});

test("pull --write-file writes the current revision's markdown through the injected writer, adding a trailing newline", async () => {
  const writes: { path: string; content: string }[] = [];
  await runSharedSpecCli(
    ["pull", "--url", "https://example.test/api/shared-spec", "--token", "actor-token", "--path", "finding", "--write-file", "docs/finding.md"],
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("by-destination")) {
          return Response.json({ document: { id: "doc-1", gitPath: "notes/finding.md" }, currentRevision: { id: "rev-2", markdown: "# Finding" } });
        }
        return Response.json([{ id: "rev-1" }, { id: "rev-2" }]);
      },
      writeOutput: () => {},
      writeFile: (path, content) => { writes.push({ path, content }); },
    },
  );
  assert.deepEqual(writes, [{ path: "docs/finding.md", content: "# Finding\n" }]);
});

test("pull by --id skips the destination lookup and reads revisions for that document directly", async () => {
  const requests: string[] = [];
  await runSharedSpecCli(
    ["pull", "--url", "https://example.test/api/shared-spec", "--token", "actor-token", "--id", "doc-1"],
    {
      fetchImpl: async (input) => {
        const url = String(input);
        requests.push(url);
        return Response.json(url.endsWith("/revisions") ? [] : { document: { id: "doc-1" } });
      },
      writeOutput: () => {},
    },
  );
  assert.deepEqual(requests, [
    "https://example.test/api/shared-spec/documents/doc-1",
    "https://example.test/api/shared-spec/documents/doc-1/revisions",
  ]);
});