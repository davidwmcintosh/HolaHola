import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const publisher = read("server/services/github-spec-publisher.ts");
const orchestration = read("server/services/shared-spec-publication.ts");
const routes = read("server/routes/shared-spec-routes.ts");
const notifications = read("server/services/shared-spec-notifications.ts");

assert.match(publisher, /destinationPrefix: "docs\/superpowers\/specs\/"/, "publisher must have an exact spec namespace");
assert.match(publisher, /configured spec filename grammar/, "publisher must use a strict server-owned path grammar");
assert.match(publisher, /expectedBaseCommit/, "publisher must pin the base commit");
assert.match(publisher, /expectedDestination/, "publisher must pin destination state");
assert.match(publisher, /deterministicBranch/, "publisher must use deterministic branch identity");
assert.match(publisher, /findPullRequest/, "publisher must reconcile a lost success before creating again");
assert.match(publisher, /readBranchDestination/, "publisher must reread deterministic branch bytes after a lost write response");
assert.match(orchestration, /SpecPublicationProvider/, "publication provider must remain replaceable");
assert.match(orchestration, /provider\.prepare/, "only the provider may prepare repository/base/destination expectations");
assert.doesNotMatch(orchestration, /request\(actor:[\s\S]*Omit<SpecPublication/, "request must not accept publication authority fields");
assert.doesNotMatch(routes, /publications\.request\(current, \{\s*\.\.\.request\.body/s, "routes must not forward caller publication authority fields");
assert.match(orchestration, /getByRequest/, "publication requests must use durable idempotency lookup");
assert.match(notifications, /NoopSharedSpecNotificationSink/, "notifications must be optional");
assert.doesNotMatch(publisher, /\b(child_process|spawn|exec|simple-git|git\s+(?:push|checkout|commit))\b/i, "publisher may not use shell Git");
assert.doesNotMatch(publisher, /\bREPLIT_|replit|connector|workflow|actions\/workflows\b/i, "publisher may not depend on Replit or Actions");
assert.doesNotMatch(publisher, /base:\s*["']main["']|refs\/heads\/main/, "publisher may not push directly to main");

console.log("Shared-spec publication safety checks passed.");