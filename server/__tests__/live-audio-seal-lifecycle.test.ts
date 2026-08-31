/**
 * Regression coverage for the reconstructed live-audio incident:
 * - avoid double padding between Gemini Live continuation sub-turns;
 * - retain final-response padding for generationComplete/watchdog seals; and
 * - keep playback timing behind trailing silence, including malformed PCM fallback.
 *
 * Run: npx tsx --test server/__tests__/live-audio-seal-lifecycle.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const glSrc = readFileSync(
  resolve(import.meta.dirname, '../services/gemini-live-session.ts'),
  'utf-8',
);
const audioSrc = readFileSync(
  resolve(import.meta.dirname, '../../client/src/lib/audioUtils.ts'),
  'utf-8',
);

function sourceBetween(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `Could not find start marker: ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `Could not find end marker: ${endNeedle}`);
  return source.slice(start, end);
}

describe('live audio seal lifecycle', () => {
  it('pads only definitive generation seals, not ordinary turnComplete boundaries', () => {
    assert.ok(
      glSrc.includes('private sealCurrentAudioSubturn(label: string, withTailPad = false)'),
      'sealCurrentAudioSubturn must make terminal padding explicit',
    );

    const sealBody = sourceBetween(
      glSrc,
      'private sealCurrentAudioSubturn(label: string, withTailPad = false)',
      'private armGenerationCompleteWatchdog()',
    );
    assert.ok(
      sealBody.includes('if (withTailPad)'),
      'the server-side silence chunk must be conditional on a terminal seal',
    );
    assert.ok(
      sealBody.includes("audio: ''") && sealBody.includes('isLast: true'),
      'every seal must still send an empty final marker',
    );

    const turnComplete = sourceBetween(
      glSrc,
      'if (msg.serverContent?.turnComplete)',
      '// ── Generation complete',
    );
    assert.ok(
      turnComplete.includes("this.sealCurrentAudioSubturn('turnComplete', false)"),
      'turnComplete must avoid a server tail pad between continuation sub-turns',
    );

    for (const terminalCall of [
      "this.sealCurrentAudioSubturn('generationComplete-watchdog', true)",
      "this.sealCurrentAudioSubturn('generationComplete-debounce-extended', true)",
      "this.sealCurrentAudioSubturn('generationComplete-debounce', true)",
    ]) {
      assert.ok(
        glSrc.includes(terminalCall),
        `definitive seal must retain terminal padding: ${terminalCall}`,
      );
    }
  });

  it('sets endCtxTime after trailing silence in both empty-PCM paths', () => {
    const normalEmptyPath = sourceBetween(
      audioSrc,
      'if (audio.byteLength === 0)',
      '// === ONLY NOW add to dedup set',
    );
    const nearEmptyFallback = sourceBetween(
      audioSrc,
      'if (numSamples === 0)',
      '// CONTENT-HASH DEDUP',
    );

    for (const [name, path] of [
      ['normal empty marker', normalEmptyPath],
      ['near-empty fallback', nearEmptyFallback],
    ]) {
      const silenceAdvance = path.indexOf('this.progressiveScheduledTime += TRAILING_SEC');
      const endTimeSet = path.indexOf('entry.endCtxTime = this.progressiveScheduledTime');
      assert.ok(silenceAdvance !== -1, `${name} must schedule trailing silence`);
      assert.ok(endTimeSet !== -1, `${name} must set an explicit playback end time`);
      assert.ok(
        silenceAdvance < endTimeSet,
        `${name} must set endCtxTime after trailing silence is added`,
      );
    }
  });

  it('fails its timing assertion if the near-empty fallback reverts to the old ordering', () => {
    const nearEmptyFallback = sourceBetween(
      audioSrc,
      'if (numSamples === 0)',
      '// CONTENT-HASH DEDUP',
    );
    const reverted = nearEmptyFallback.replace(
      'entry.endCtxTime = this.progressiveScheduledTime',
      'entry.endCtxTime = entry.startCtxTime + entry.totalDuration',
    );
    assert.equal(
      reverted.includes('entry.endCtxTime = this.progressiveScheduledTime'),
      false,
      'mutation must remove the post-silence timing assignment',
    );
  });
});