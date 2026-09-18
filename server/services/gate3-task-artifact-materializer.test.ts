import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  GATE3_TASK_ARTIFACT_MAX_BYTES,
  Gate3TaskArtifactMaterializationError,
  materializeGate3TaskArtifact,
} from "./gate3-task-artifact-materializer";

const commit = "a".repeat(40);
const canonicalTemplate = "Task\nCommit: __FINAL_STARTING_COMMIT__\nDone\n";
const canonicalText = `Task\nCommit: ${commit}\nDone\n`;
const canonicalSha256 = "2659b1ddfce1f8ca751d5a56e098448c506077ca765fbb286bdec5293fe053a5";
const bytes = (value: string) => new TextEncoder().encode(value);

function rejectsCode(fn: () => unknown, code: string) {
  assert.throws(fn, (error) =>
    error instanceof Gate3TaskArtifactMaterializationError && error.code === code);
}

test("LF, CRLF, and mixed line endings produce the independent canonical LF oracle", () => {
  const variants = [
    canonicalTemplate,
    canonicalTemplate.replace(/\n/g, "\r\n"),
    canonicalTemplate.replace("Task\n", "Task\r\n"),
  ];
  for (const template of variants) {
    const result = materializeGate3TaskArtifact(bytes(template), commit);
    assert.equal(result.text, canonicalText);
    assert.equal(Buffer.from(result.bytes).includes(13), false);
    assert.equal(result.sha256, canonicalSha256);
    assert.equal(
      createHash("sha256").update(Buffer.from(canonicalText, "utf8")).digest("hex"),
      canonicalSha256,
    );
  }
});

test("lone CR and malformed UTF-8 fail closed", () => {
  rejectsCode(
    () => materializeGate3TaskArtifact(bytes("Task\r__FINAL_STARTING_COMMIT__"), commit),
    "artifact_line_endings_invalid",
  );
  rejectsCode(
    () => materializeGate3TaskArtifact(Uint8Array.from([0xc3, 0x28]), commit),
    "artifact_invalid",
  );
});

test("placeholder cardinality and casing fail closed", () => {
  rejectsCode(
    () => materializeGate3TaskArtifact(bytes("none"), commit),
    "artifact_template_invalid",
  );
  rejectsCode(
    () => materializeGate3TaskArtifact(
      bytes("__FINAL_STARTING_COMMIT__\n__FINAL_STARTING_COMMIT__"),
      commit,
    ),
    "artifact_template_invalid",
  );
  rejectsCode(
    () => materializeGate3TaskArtifact(bytes("__final_starting_commit__"), commit),
    "artifact_template_invalid",
  );
});

test("empty, oversized source, oversized output, and invalid commit fail closed", () => {
  rejectsCode(
    () => materializeGate3TaskArtifact(new Uint8Array(), commit),
    "artifact_invalid",
  );
  rejectsCode(
    () => materializeGate3TaskArtifact(
      bytes(`${"x".repeat(GATE3_TASK_ARTIFACT_MAX_BYTES)}__FINAL_STARTING_COMMIT__`),
      commit,
    ),
    "artifact_invalid",
  );
  const outputOverflowTemplate = `${
    "x".repeat(GATE3_TASK_ARTIFACT_MAX_BYTES - "__FINAL_STARTING_COMMIT__".length)
  }__FINAL_STARTING_COMMIT__`;
  rejectsCode(
    () => materializeGate3TaskArtifact(bytes(outputOverflowTemplate), commit),
    "artifact_invalid",
  );
  rejectsCode(
    () => materializeGate3TaskArtifact(bytes(canonicalTemplate), "A".repeat(40)),
    "starting_commit_invalid",
  );
});