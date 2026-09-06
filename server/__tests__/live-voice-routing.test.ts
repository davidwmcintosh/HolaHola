import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getLiveVoiceSessionOwner,
  resolveLiveVoiceRoute,
  shouldUseLegacyVoicePipeline,
} from '../services/live-voice-routing';

describe('live voice provider routing', () => {
  it('routes OpenAI Realtime independently of the Gemini availability flag', () => {
    assert.equal(resolveLiveVoiceRoute('openai-realtime', true), 'openai-realtime');
    assert.equal(resolveLiveVoiceRoute('openai-realtime', false), 'openai-realtime');
  });

  it('routes both Gemini Live variants only when Gemini Live is enabled', () => {
    assert.equal(resolveLiveVoiceRoute('gemini-live', true), 'gemini-live');
    assert.equal(resolveLiveVoiceRoute('gemini-live-35', true), 'gemini-live');
    assert.equal(resolveLiveVoiceRoute('gemini-live', false), 'legacy');
    assert.equal(resolveLiveVoiceRoute('gemini-live-35', false), 'legacy');
  });

  it('never lets the Gemini flag override a legacy TTS provider', () => {
    for (const provider of ['cartesia', 'elevenlabs', 'google', 'gemini', undefined]) {
      assert.equal(resolveLiveVoiceRoute(provider, true), 'legacy', String(provider));
      assert.equal(resolveLiveVoiceRoute(provider, false), 'legacy', String(provider));
    }
  });

  it('allows legacy response generation only for the legacy route', () => {
    assert.equal(shouldUseLegacyVoicePipeline('legacy'), true);
    assert.equal(shouldUseLegacyVoicePipeline('gemini-live'), false);
    assert.equal(shouldUseLegacyVoicePipeline('openai-realtime'), false);
  });
});

describe('push-to-talk live-session ownership', () => {
  it('treats either live engine as owning the complete turn', () => {
    assert.equal(getLiveVoiceSessionOwner(true, false), 'gemini-live');
    assert.equal(getLiveVoiceSessionOwner(false, true), 'openai-realtime');
    assert.equal(getLiveVoiceSessionOwner(false, false), 'legacy');
    assert.equal(getLiveVoiceSessionOwner(true, true), 'conflict');
  });

  it('exits before the legacy transcript pipeline and clears speculative state', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../unified-ws-handler.ts'),
      'utf8',
    );
    const releaseStart = source.indexOf("case 'ptt_release':");
    const legacyStart = source.indexOf('const interimTranscript = speculativePttTranscript.trim();', releaseStart);
    assert.ok(releaseStart >= 0 && legacyStart > releaseStart, 'ptt_release boundaries must exist');

    const fastPath = source.slice(releaseStart, legacyStart);
    assert.match(fastPath, /getLiveVoiceSessionOwner\(\s*Boolean\(geminiLiveSession\),\s*Boolean\(openaiRealtimeSession\)/s);
    assert.match(fastPath, /if \(selectedLiveVoiceRoute !== 'legacy'\)[\s\S]*pendingSpeculativeTranscript = null;[\s\S]*break;/);
  });

  it('keeps selected live-route ownership across startup and runtime failure', () => {
    const handler = readFileSync(
      resolve(import.meta.dirname, '../unified-ws-handler.ts'),
      'utf8',
    );
    const openaiSession = readFileSync(
      resolve(import.meta.dirname, '../services/openai-realtime-session.ts'),
      'utf8',
    );

    assert.match(handler, /selectedLiveVoiceRoute = liveVoiceRoute;/);
    assert.match(handler, /currentOpenAISession\.onUnavailable = \(reason\) =>/);
    assert.match(handler, /OpenAI Realtime could not start:[\s\S]*sendErrorAdapter\(ws, 'AI_FAILED'/);
    assert.doesNotMatch(handler, /Fall through — session still works via legacy pipeline/);
    assert.match(openaiSession, /onUnavailable\?\.\(`OpenAI Realtime connection error:/);
    assert.match(openaiSession, /onUnavailable\?\.\(detail\)/);
  });

  it('gates every inbound audio shape before legacy processing when a live route is selected', () => {
    const handler = readFileSync(
      resolve(import.meta.dirname, '../unified-ws-handler.ts'),
      'utf8',
    );
    const selectedRouteGates = handler.match(/if \(selectedLiveVoiceRoute !== 'legacy'\)/g) ?? [];
    assert.ok(
      selectedRouteGates.length >= 4,
      `expected live-route gates for binary audio, audio_data, stream chunks, and ptt_release; found ${selectedRouteGates.length}`,
    );
  });

  it('prevents greeting retries and prop interactions from falling back to the legacy orchestrator', () => {
    const handler = readFileSync(
      resolve(import.meta.dirname, '../unified-ws-handler.ts'),
      'utf8',
    );
    const greetingStart = handler.indexOf("case 'request_greeting':");
    const greetingEnd = handler.indexOf("case 'audio_data':", greetingStart);
    const propStart = handler.indexOf("case 'prop_tap':", greetingEnd);
    const propEnd = handler.indexOf("case 'interrupt'", propStart);
    assert.ok(greetingStart >= 0 && greetingEnd > greetingStart);
    assert.ok(propStart > greetingEnd && propEnd > propStart);

    const greetingBlock = handler.slice(greetingStart, greetingEnd);
    const propBlock = handler.slice(propStart, propEnd);
    assert.match(greetingBlock, /selectedLiveVoiceRoute === 'openai-realtime'[\s\S]*break;/);
    assert.match(greetingBlock, /shouldUseLegacyVoicePipeline\(selectedLiveVoiceRoute\)[\s\S]*processGreetingRequest/);
    assert.match(propBlock, /selectedLiveVoiceRoute === 'openai-realtime'/);
    assert.match(propBlock, /shouldUseLegacyVoicePipeline\(selectedLiveVoiceRoute\)[\s\S]*processOpenMicTranscript/);
  });
});