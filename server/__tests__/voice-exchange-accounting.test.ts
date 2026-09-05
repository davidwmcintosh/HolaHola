import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  advanceCompletedExchangeForEpoch,
  combineVoiceMetricTotals,
} from "../services/voice-exchange-accounting";

test("generation completion counts each real student epoch once", () => {
  let lastCountedEpoch = 0;

  const greeting = advanceCompletedExchangeForEpoch(lastCountedEpoch, 0);
  assert.equal(greeting.counted, false);

  const firstCompletion = advanceCompletedExchangeForEpoch(lastCountedEpoch, 1);
  assert.equal(firstCompletion.counted, true);
  lastCountedEpoch = firstCompletion.lastCountedStudentTurnEpoch;

  const lateWatchdogOrToolContinuation = advanceCompletedExchangeForEpoch(lastCountedEpoch, 1);
  assert.equal(lateWatchdogOrToolContinuation.counted, false);

  const secondCompletion = advanceCompletedExchangeForEpoch(lastCountedEpoch, 2);
  assert.equal(secondCompletion.counted, true);
});

test("a reconnect adds only the current connection's Gemini Live delta", () => {
  const resumed = combineVoiceMetricTotals(
    {
      exchangeCount: 4,
      studentSpeakingSeconds: 18,
      tutorSpeakingSeconds: 27,
      ttsCharacters: 810,
      sttSeconds: 18,
    },
    {
      exchangeCount: 3,
      studentSpeakingMs: 12_000,
      tutorSpeakingMs: 21_000,
      outputCharacters: 630,
    },
  );

  assert.deepEqual(resumed, {
    exchangeCount: 7,
    studentSpeakingSeconds: 30,
    tutorSpeakingSeconds: 48,
    ttsCharacters: 1440,
    sttSeconds: 18,
  });

  assert.equal(
    combineVoiceMetricTotals(resumed, null).exchangeCount,
    7,
    "a new connection starts with a zero Gemini Live delta",
  );
});

test("exchange counting is independent of transcript persistence", () => {
  const source = readFileSync("server/services/gemini-live-session.ts", "utf8");
  const generationBoundary = source.indexOf(
    "this.recordCompletedExchangeAtGenerationBoundary('generationComplete')",
  );
  const transcriptFlush = source.indexOf("private async _doFlushTranscripts()");

  assert.ok(generationBoundary >= 0, "generationComplete must record the exchange");
  assert.ok(transcriptFlush > generationBoundary, "counting must happen before transcript persistence");
  assert.doesNotMatch(
    source.slice(transcriptFlush),
    /this\.completedExchanges\+\+/,
    "transcript persistence must not own exchange accounting",
  );
});

test("all terminal lifecycle paths preserve their actual outcome", () => {
  const source = readFileSync("server/unified-ws-handler.ts", "utf8");

  assert.match(source, /endDurableVoiceSession\(current\.usageSessionId, 'abandoned'/);
  assert.match(source, /endDurableVoiceSession\(expired\.usageSessionId, 'abandoned'/);
  assert.match(source, /endDurableVoiceSession\(capturedUsageSessionId, 'error'/);
  assert.match(
    source,
    /case 'end_session':[\s\S]*?endDurableVoiceSession\(capturedUsageSessionId, undefined,/,
    "explicit clean close must retain the completed default",
  );
});

test("duplicate replacement snapshots current Gemini Live metrics before nulling usage", () => {
  const source = readFileSync("server/unified-ws-handler.ts", "utf8");
  const callbackStart = source.indexOf("duplicateReplacedCallbacks.set(conversationId");
  const callbackEnd = source.indexOf("ws.on('close'", callbackStart);
  const callback = source.slice(callbackStart, callbackEnd);

  assert.match(callback, /const metrics = getCurrentVoiceMetricsSnapshot\(\)/);
  assert.match(callback, /exchangeCount: metrics\.exchangeCount/);
  assert.ok(
    callback.indexOf("getCurrentVoiceMetricsSnapshot()") < callback.indexOf("usageSession = null"),
    "the reconnect snapshot must capture GL totals before usageSession is released",
  );
});