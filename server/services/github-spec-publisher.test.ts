import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { GitHubSpecPublisher } from "./github-spec-publisher";

const base = "a".repeat(40);
const bytes = Buffer.from("# Approved\n", "utf8");
const contentHash = createHash("sha256").update(bytes).digest("hex");

test("GitHub publisher writes one approved file to a deterministic branch", async () => {
  const calls: Array<{ method?: string; url: string; body?: string }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ method: init?.method, url, body: init?.body?.toString() });
    if (url.includes("/pulls?")) return new Response("[]", { status: 200 });
    if (url.includes("/git/ref/")) return new Response(JSON.stringify({ object: { sha: base } }), { status: 200 });
    if (url.includes("/contents/")) {
      if (init?.method === "GET") return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      return new Response("{}", { status: 201 });
    }
    if (url.endsWith("/git/refs")) return new Response("{}", { status: 201 });
    if (url.endsWith("/pulls")) return new Response(JSON.stringify({ number: 7, html_url: "https://github.test/pr/7" }), { status: 201 });
    throw new Error(`unexpected request ${url}`);
  };
  const publisher = new GitHubSpecPublisher({
    repository: "hola/specs", baseRef: "main", destinationPrefix: "docs/superpowers/specs/",
    token: "token", apiUrl: "https://github.test", fetchImpl: fakeFetch,
    authorizeMutation: async () => {},
  });
  const prepared = await publisher.prepare({
    documentId: "document-1", revisionId: "revision-1", reviewId: "review-1", contentHash,
    repository: "hola/specs", destinationPath: "docs/superpowers/specs/approved.md",
  });
  const result = await publisher.publish({
    id: "publication-1", documentId: "document-1", revisionId: "revision-1", reviewId: "review-1",
    contentHash, ...prepared, bytes,
  }, { taskRef: "1455", actorId: "luca-replit" });
  assert.equal(result.branchName, `shared-spec/publication-1-${contentHash.slice(0, 12)}`);
  assert.equal(result.pullRequestNumber, 7);
  const write = calls.find(call => call.method === "PUT");
  assert.match(write!.url, /docs\/superpowers\/specs\/approved\.md$/);
  assert.match(write!.body!, new RegExp(Buffer.from(bytes).toString("base64")));
  assert.equal(calls.filter(call => call.url.endsWith("/pulls") && call.method === "POST").length, 1);
});

test("GitHub publisher rejects traversal before any request", async () => {
  let calls = 0;
  const publisher = new GitHubSpecPublisher({
    repository: "hola/specs", baseRef: "main", destinationPrefix: "docs/superpowers/specs/",
    token: "token", fetchImpl: async () => { calls++; throw new Error("must not fetch"); },
    authorizeMutation: async () => {},
  });
  await assert.rejects(() => publisher.prepare({
    documentId: "d", revisionId: "r", reviewId: "v", contentHash, repository: "hola/specs",
    destinationPath: "docs/superpowers/specs/%2fmain.md",
  }), /configured spec filename grammar/);
  assert.equal(calls, 0);
});

test("GitHub reconciliation distinguishes a closed pull request with matching identity", async () => {
  const publisher = new GitHubSpecPublisher({
    repository: "hola/specs", baseRef: "main", destinationPrefix: "docs/superpowers/specs/", token: "token",
    authorizeMutation: async () => {},
    fetchImpl: async () => new Response(JSON.stringify({
      number: 7, html_url: "https://github.test/pr/7", state: "closed", merged: false,
      body: `shared-spec-publication:p;document:d;revision:r;review:v;sha256:${contentHash}`,
      head: { ref: `shared-spec/p-${contentHash.slice(0, 12)}` }, base: { ref: "main" },
    }), { status: 200 }),
  });
  const result = await publisher.reconcile({
    id: "p", documentId: "d", revisionId: "r", reviewId: "v", contentHash, repository: "hola/specs",
    baseRef: "main", expectedBaseCommit: base, destinationPath: "docs/superpowers/specs/approved.md",
    expectedDestinationAbsent: true, state: "open", branchName: `shared-spec/p-${contentHash.slice(0, 12)}`,
    pullRequestNumber: 7, pullRequestUrl: "https://github.test/pr/7",
  });
  assert.equal(result.state, "closed");
});

test("GitHub recovers a lost PUT response from exact deterministic branch bytes", async () => {
  let putCalls = 0;
  let branchHasFile = false;
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/pulls?")) return new Response("[]", { status: 200 });
    if (url.includes("/git/ref/")) return new Response(JSON.stringify({ object: { sha: base } }), { status: 200 });
    if (url.endsWith("/git/refs")) return new Response("{}", { status: 201 });
    if (url.includes("/contents/") && init?.method === "GET") {
      if (url.includes("ref=main")) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      return branchHasFile
        ? new Response(JSON.stringify({ type: "file", encoding: "base64", content: bytes.toString("base64") }), { status: 200 })
        : new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }
    if (url.includes("/contents/") && init?.method === "PUT") { putCalls++; branchHasFile = true; throw new Error("timeout"); }
    if (url.endsWith("/pulls")) return new Response(JSON.stringify({ number: 8, html_url: "https://github.test/pr/8" }), { status: 201 });
    throw new Error(`unexpected request ${url}`);
  };
  const publisher = new GitHubSpecPublisher({
    repository: "hola/specs", baseRef: "main", destinationPrefix: "docs/superpowers/specs/", token: "token", apiUrl: "https://github.test", fetchImpl: fakeFetch,
    authorizeMutation: async () => {},
  });
  const prepared = await publisher.prepare({ documentId: "d", revisionId: "r", reviewId: "v", contentHash, repository: "hola/specs", destinationPath: "docs/superpowers/specs/approved.md" });
  const result = await publisher.publish({ id: "lost-put", documentId: "d", revisionId: "r", reviewId: "v", contentHash, ...prepared, bytes }, { taskRef: "1455", actorId: "luca-replit" });
  assert.equal(result.pullRequestNumber, 8);
  assert.equal(putCalls, 1);
});

test("GitHub publisher refuses to publish before any network call when authorizeMutation refuses", async () => {
  let fetchCalls = 0;
  let receivedAction: string | undefined;
  let receivedContext: unknown;
  const publisher = new GitHubSpecPublisher({
    repository: "hola/specs", baseRef: "main", destinationPrefix: "docs/superpowers/specs/", token: "token",
    fetchImpl: async () => { fetchCalls++; throw new Error("must not fetch when authorization refuses"); },
    authorizeMutation: async (context, action) => {
      receivedContext = context; receivedAction = action;
      throw new Error("blocked: task ownership cannot be proven");
    },
  });
  await assert.rejects(
    () => publisher.publish({
      id: "publication-1", documentId: "document-1", revisionId: "revision-1", reviewId: "review-1",
      contentHash, repository: "hola/specs", baseRef: "main", expectedBaseCommit: base,
      destinationPath: "docs/superpowers/specs/approved.md", expectedDestinationAbsent: true, bytes,
    }, { taskRef: "1455", actorId: "luca-replit" }),
    /blocked: task ownership cannot be proven/,
  );
  assert.equal(fetchCalls, 0, "publish must not make any GitHub request when authorizeMutation refuses");
  assert.equal(receivedAction, "github_spec_publish:hola/specs:docs/superpowers/specs/approved.md");
  assert.deepEqual(receivedContext, { taskRef: "1455", actorId: "luca-replit" });
});

test("GitHub publisher requires an authorizeMutation hook at construction", () => {
  assert.throws(() => new GitHubSpecPublisher({
    repository: "hola/specs", baseRef: "main", destinationPrefix: "docs/superpowers/specs/", token: "token",
  } as any), /authorizeMutation/);
});