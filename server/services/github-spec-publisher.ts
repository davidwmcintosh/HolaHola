import { createHash } from "node:crypto";
import type { SpecPublication, SpecPublicationProvider } from "./shared-spec-publication";

export interface GitHubSpecPublisherConfig {
  readonly repository: string;
  readonly baseRef: string;
  readonly destinationPrefix: "docs/superpowers/specs/";
  readonly apiUrl?: string;
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
}

export interface GitHubDestination {
  readonly baseCommit: string;
  readonly blobSha?: string;
}

export type GitHubPublicationRequest = Omit<SpecPublication, "state" | "branchName" | "pullRequestNumber" | "pullRequestUrl" | "lastError"> & { readonly bytes: Uint8Array };

export interface GitHubPublicationResult {
  readonly branchName: string;
  readonly pullRequestNumber: number;
  readonly pullRequestUrl: string;
}

type GitHubResponse = Record<string, unknown>;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Narrow REST-only GitHub publisher. It has no shell, local checkout, or push-to-base operation. */
export class GitHubSpecPublisher implements SpecPublicationProvider {
  private readonly api: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: GitHubSpecPublisherConfig) {
    if (!/^[^/\s]+\/[^/\s]+$/.test(config.repository)) throw new Error("GitHub repository must be configured as owner/name");
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(config.baseRef) || config.baseRef.includes("..")) throw new Error("Invalid configured GitHub base ref");
    if (!config.token.trim()) throw new Error("GitHub token is required");
    this.api = (config.apiUrl ?? "https://api.github.com").replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private path(path: string): string { return `${this.api}/repos/${this.config.repository}${path}`; }
  private async request(method: string, path: string, body?: unknown): Promise<GitHubResponse> {
    const response = await this.fetchImpl(this.path(path), {
      method,
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${this.config.token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let parsed: GitHubResponse = {};
    try { parsed = text ? JSON.parse(text) as GitHubResponse : {}; } catch { /* response is reported below */ }
    if (!response.ok) throw new Error(`GitHub REST ${method} ${path} failed (${response.status}): ${String(parsed.message ?? text).slice(0, 300)}`);
    return parsed;
  }

  private assertPath(path: string): void {
    const filename = path.slice(this.config.destinationPrefix.length);
    if (!path.startsWith(this.config.destinationPrefix) || path.includes("\\") ||
      /(?:^|\/)(?:\.{1,2})(?:\/|$)|%2f|%5c/i.test(path) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.md$/.test(filename)) {
      throw new Error("Destination is outside the configured spec filename grammar");
    }
  }

  private assertRequest(request: GitHubPublicationRequest): void {
    if (sha256(request.bytes) !== request.contentHash) throw new Error("Approved byte hash does not match publication hash");
    if (!/^[0-9a-f]{64}$/i.test(request.contentHash)) throw new Error("Publication content hash is invalid");
    if (!/^[0-9a-f]{7,64}$/i.test(request.expectedBaseCommit)) throw new Error("Expected base commit is invalid");
    if (request.repository !== this.config.repository) throw new Error("Document repository is not the configured GitHub repository");
    this.assertPath(request.destinationPath);
    if (request.expectedDestinationAbsent === Boolean(request.expectedDestinationBlobHash)) throw new Error("Destination expectation must be exactly absent or one blob");
    if (request.expectedDestinationBlobHash && !/^[0-9a-f]{40,64}$/i.test(request.expectedDestinationBlobHash)) throw new Error("Expected destination blob hash is invalid");
  }

  deterministicBranch(request: Pick<GitHubPublicationRequest, "id" | "contentHash">): string {
    return `shared-spec/${request.id.slice(0, 32)}-${request.contentHash.slice(0, 12)}`;
  }

  private marker(request: Pick<SpecPublication, "id" | "documentId" | "revisionId" | "reviewId" | "contentHash">): string {
    return `shared-spec-publication:${request.id};document:${request.documentId};revision:${request.revisionId};review:${request.reviewId};sha256:${request.contentHash}`;
  }

  async prepare(input: {
    documentId: string; revisionId: string; reviewId: string; contentHash: string; repository: string; destinationPath: string;
  }): Promise<Pick<SpecPublication, "repository" | "baseRef" | "expectedBaseCommit" | "destinationPath" | "expectedDestinationBlobHash" | "expectedDestinationAbsent">> {
    if (input.repository !== this.config.repository) throw new Error("Document repository is not the configured GitHub repository");
    this.assertPath(input.destinationPath);
    const ref = await this.request("GET", `/git/ref/heads/${encodeURIComponent(this.config.baseRef)}`);
    const baseCommit = String((ref.object as GitHubResponse | undefined)?.sha ?? "");
    if (!/^[0-9a-f]{7,64}$/i.test(baseCommit)) throw new Error("GitHub base ref did not resolve to a commit");
    try {
      const file = await this.request("GET", `/contents/${input.destinationPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(this.config.baseRef)}`);
      if (file.type !== "file" || !/^[0-9a-f]{40,64}$/i.test(String(file.sha ?? ""))) throw new Error("GitHub destination is not a regular blob");
      return { repository: this.config.repository, baseRef: this.config.baseRef, expectedBaseCommit: baseCommit,
        destinationPath: input.destinationPath, expectedDestinationBlobHash: String(file.sha), expectedDestinationAbsent: false };
    } catch (error) {
      if (!/\(404\)/.test(String(error))) throw error;
      return { repository: this.config.repository, baseRef: this.config.baseRef, expectedBaseCommit: baseCommit,
        destinationPath: input.destinationPath, expectedDestinationAbsent: true };
    }
  }

  async publish(request: GitHubPublicationRequest): Promise<GitHubPublicationResult> {
    this.assertRequest(request);
    const branchName = this.deterministicBranch(request);
    const marker = this.marker(request);
    const existing = await this.findPullRequest(branchName, marker);
    if (existing) return existing;

    const base = await this.request("GET", `/git/ref/heads/${encodeURIComponent(this.config.baseRef)}`);
    const actualBase = String((base.object as GitHubResponse | undefined)?.sha ?? "");
    if (actualBase !== request.expectedBaseCommit) throw new Error("GitHub base commit drifted; publication was not written");
    let actualBlob: string | undefined;
    try {
      const file = await this.request("GET", `/contents/${request.destinationPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(this.config.baseRef)}`);
      if (file.type && file.type !== "file") throw new Error("GitHub destination is not a regular file");
      actualBlob = String(file.sha ?? "");
    } catch (error) {
      if (!/\(404\)/.test(String(error))) throw error;
    }
    if (request.expectedDestinationAbsent ? actualBlob : actualBlob !== request.expectedDestinationBlobHash) {
      throw new Error("GitHub destination drifted; publication was not written");
    }

    try {
      await this.request("POST", "/git/refs", { ref: `refs/heads/${branchName}`, sha: actualBase });
    } catch (error) {
      if (!/\(422\)/.test(String(error))) throw error;
    }
    // A lost response can have created the branch or PR: reconcile before each later creation.
    const recovered = await this.findPullRequest(branchName, marker);
    if (recovered) return recovered;
    const branchBytes = await this.readBranchDestination(request.destinationPath, branchName);
    if (branchBytes && sha256(branchBytes) !== request.contentHash) {
      throw new Error("Deterministic branch destination differs from approved bytes; publication was not overwritten");
    }
    if (!branchBytes) {
      try {
        await this.request("PUT", `/contents/${request.destinationPath.split("/").map(encodeURIComponent).join("/")}`, {
          message: `Publish approved shared spec ${request.revisionId}`,
          content: Buffer.from(request.bytes).toString("base64"),
          branch: branchName,
        });
      } catch (error) {
        // PUT can succeed while its response is lost (or GitHub reports a
        // replay conflict). Only an exact branch reread permits continuing.
        const recoveredBytes = await this.readBranchDestination(request.destinationPath, branchName);
        if (!recoveredBytes || sha256(recoveredBytes) !== request.contentHash) throw error;
      }
    }
    const afterWrite = await this.findPullRequest(branchName, marker);
    if (afterWrite) return afterWrite;
    const pr = await this.request("POST", "/pulls", {
      title: `Publish approved shared spec: ${request.documentId}`,
      head: branchName, base: this.config.baseRef,
      body: marker,
    });
    return { branchName, pullRequestNumber: Number(pr.number), pullRequestUrl: String(pr.html_url) };
  }

  private async readBranchDestination(destinationPath: string, branchName: string): Promise<Buffer | undefined> {
    try {
      const file = await this.request("GET", `/contents/${destinationPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branchName)}`);
      if (file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string") {
        throw new Error("Deterministic branch destination is not a regular base64 file");
      }
      return Buffer.from(file.content.replace(/\s/g, ""), "base64");
    } catch (error) {
      if (/\(404\)/.test(String(error))) return undefined;
      throw error;
    }
  }

  private async findPullRequest(branchName: string, marker: string): Promise<GitHubPublicationResult | undefined> {
    const prs = await this.request("GET", `/pulls?state=all&head=${encodeURIComponent(this.config.repository.split("/")[0] + ":" + branchName)}&base=${encodeURIComponent(this.config.baseRef)}`);
    const matches = Array.isArray(prs) ? prs : [];
    const pr = matches.find(value => typeof value === "object" && value !== null && String((value as GitHubResponse).body ?? "").includes(marker)) as GitHubResponse | undefined;
    return pr ? { branchName, pullRequestNumber: Number(pr.number), pullRequestUrl: String(pr.html_url) } : undefined;
  }

  async reconcile(publication: SpecPublication): Promise<Pick<SpecPublication, "state" | "pullRequestNumber" | "pullRequestUrl">> {
    if (!publication.pullRequestNumber || !publication.branchName) throw new Error("Publication has no pull-request identity to reconcile");
    const pr = await this.request("GET", `/pulls/${publication.pullRequestNumber}`);
    if (String(pr.body ?? "") !== this.marker(publication) ||
      String((pr.head as GitHubResponse | undefined)?.ref ?? "") !== publication.branchName ||
      String((pr.base as GitHubResponse | undefined)?.ref ?? "") !== this.config.baseRef) {
      throw new Error("GitHub pull request identity does not match publication");
    }
    const url = String(pr.html_url ?? publication.pullRequestUrl ?? "");
    if (pr.merged === true) {
      // Verify the base-ref bytes after merge; otherwise a matching PR alone is
      // insufficient evidence that the approved immutable content landed.
      const file = await this.request("GET", `/contents/${publication.destinationPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(this.config.baseRef)}`);
      if (file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string" ||
        sha256(Buffer.from(file.content.replace(/\s/g, ""), "base64")) !== publication.contentHash) {
        throw new Error("Merged GitHub path bytes do not match the approved publication");
      }
      return { state: "merged", pullRequestNumber: publication.pullRequestNumber, pullRequestUrl: url };
    }
    return { state: pr.state === "closed" ? "closed" : "open", pullRequestNumber: publication.pullRequestNumber, pullRequestUrl: url };
  }
}