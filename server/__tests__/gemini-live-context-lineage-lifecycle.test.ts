import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "server/services/gemini-live-session.ts"),
  "utf8",
);

describe("Gemini Live context-lineage lifecycle", () => {
  it("keeps the ledger opt-in and non-blocking", () => {
    assert.match(source, /CONTEXT_LINEAGE_LEDGER_ENABLED !== 'true'/);
    assert.match(source, /new ContextLineageRecorder\(/);
    assert.match(source, /sink: createDatabaseContextLineageSink\(\)/);
    assert.doesNotMatch(source, /await this\._recordContextLineage\(/);
    assert.doesNotMatch(source, /await this\._recordDirectLineageAttempt\(/);
  });

  it("records the lifecycle needed to inspect a grounding delivery trace", () => {
    for (const needle of [
      "stream_event_observed",
      "student_turn_started",
      "context_lookup_started",
      "context_prepared",
      "client_content_send_attempted",
      "tool_response_send_attempted",
      "tool_response_send_failed",
      "tool_response_discarded_by_barge_in",
    ]) {
      assert.match(source, new RegExp(`eventType: '${needle}'`));
    }
    assert.match(source, /streamProxy: \{ eventId: streamProxyEventId \}/);
    assert.match(source, /observeContextLineageEvent/);
    assert.match(source, /observeContextLineageLink/);
    assert.match(source, /observeContextLineageHealth/);
    assert.match(source, /prepared_context_discarded_by_barge_in/);
    assert.match(source, /client_content_send_failed/);
    assert.match(source, /tool_response_send_failed/);
  });

  it("records a factual callback before each direct tool-response attempt", () => {
    const toolCallback = source.indexOf("this._recordFactualStreamCallback('tool_call'");
    const liveToolDispatch = source.indexOf(
      "this.liveSession.sendToolResponse({ functionResponses: responses })",
      toolCallback,
    );
    const toolResponse = source.indexOf(
      "eventType: 'tool_response_send_attempted'",
      liveToolDispatch,
    );
    assert.ok(toolCallback >= 0, "tool-call callback instrumentation is present");
    assert.ok(liveToolDispatch > toolCallback, "tool dispatch follows its factual callback record");
    assert.ok(toolResponse > liveToolDispatch, "tool dispatch attempt is recorded after the SDK call returns");
  });

  it("keeps tool-response diagnostics bounded instead of serializing arbitrary response bodies", () => {
    assert.doesNotMatch(source, /JSON\.stringify\(responses\)/);
    assert.doesNotMatch(source, /JSON\.stringify\(syntheticResponses\)/);
    assert.match(source, /functionResponseCount: responses\.length/);
    assert.match(source, /functionResponseNames: responses\.map/);
  });
});