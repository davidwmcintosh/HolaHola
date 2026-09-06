import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const handler = readFileSync('server/unified-ws-handler.ts', 'utf8');
const sharedDto = readFileSync('shared/streaming-voice-types.ts', 'utf8');
const client = readFileSync('client/src/lib/streamingVoiceClient.ts', 'utf8');
const hook = readFileSync('client/src/hooks/useStreamingVoice.ts', 'utf8');
const chat = readFileSync('client/src/components/StreamingVoiceChat.tsx', 'utf8');
const view = readFileSync('client/src/components/VoiceChatViewManager.tsx', 'utf8');
const tutor = readFileSync('client/src/components/ImmersiveTutor.tsx', 'utf8');
const pill = readFileSync('client/src/components/CollaborationIndicator.tsx', 'utf8');

test('every unified voice terminal path closes the exact durable Observation Bench', () => {
  assert.match(handler, /closeObservationBenchBySessionId\(\{ sessionId \}\)/);
  assert.equal(
    [...handler.matchAll(/usageService\.endSession\(/g)].length,
    1,
    'all endSession calls must pass through the bench-closing helper',
  );
  for (const expected of [
    "endDurableVoiceSession(current.usageSessionId, 'abandoned'",
    "endDurableVoiceSession(expired.usageSessionId, 'abandoned'",
    'endDurableVoiceSession(existingActiveSession.id)',
    'endDurableVoiceSession(capturedUsageSessionId, undefined',
    "endDurableVoiceSession(capturedUsageSessionId, 'abandoned'",
    "endDurableVoiceSession(capturedUsageSessionId, 'error'",
  ]) {
    assert.ok(handler.includes(expected), `missing exact-ID terminal path: ${expected}`);
  }
  assert.doesNotMatch(handler, /closeObservationBenchBySessionId\(\{\s*(conversationId|sessionId:\s*conversationId)/);
});

test('session_started durable identity is wired from server through the founder pill', () => {
  assert.match(sharedDto, /voiceSessionId\?: string/);
  assert.match(handler, /dbSessionId \? \{ voiceSessionId: dbSessionId \}/);
  assert.match(client, /message\.voiceSessionId \?\? null/);
  assert.match(hook, /setVoiceSessionId\(event\.voiceSessionId\)/);
  assert.match(chat, /voiceSessionId=\{streamingVoice\.state\.voiceSessionId\}/);
  assert.match(view, /voiceSessionId=\{voiceSessionId\}/);
  assert.match(tutor, /voiceSessionId=\{voiceSessionId\}/);
  assert.match(pill, /observation-bench-sessions\/\$\{voiceSessionId\}\/status/);
  assert.match(pill, /refetchInterval: false/);
});