import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TurnReplayGuard, findImmediateSubstantialReplay } from '../services/gemini-live-replay-detector';

const paragraph = "You're very welcome, David! I'm glad we could get that tested. Is there anything else you'd like to check, or maybe switch over to some Spanish practice? Or were you thinking of wrapping up for today?";

describe('Gemini Live immediate substantial replay detector', () => {
  it('finds an exact long response replay from the response beginning', () => {
    const response = `${paragraph} ${paragraph}`;
    assert.equal(findImmediateSubstantialReplay(response), paragraph.length + 1);
  });

  it('preserves short pedagogical repetition', () => {
    const repeated = 'Repeat this. '.repeat(20);
    assert.equal(findImmediateSubstantialReplay(repeated), null);
  });

  it('does not classify a repeated sentence at the end as a response replay', () => {
    const response = `${paragraph} and then a short note. Is there anything else you'd like to check? Is there anything else you'd like to check?`;
    assert.equal(findImmediateSubstantialReplay(response), null);
  });

  it('normalizes punctuation, whitespace, and chunk boundaries', () => {
    const response = `${paragraph} ${paragraph.replace(/ /g, '  ')}`;
    assert.equal(findImmediateSubstantialReplay(response), paragraph.length + 1);
  });

  it('allows progressive PCM, kills subsequent PCM, then resets for next turn', () => {
    const guard = new TurnReplayGuard();
    assert.equal(guard.shouldDropPcm(20), false);
    guard.appendTranscript(`${paragraph} ${paragraph}`);
    assert.equal(guard.isSuppressed(), true);
    assert.equal(guard.shouldDropPcm(20), true);
    guard.reset();
    assert.equal(guard.shouldDropPcm(20), false);
  });

  it('preserves transcription-first state when the first PCM arrives', () => {
    const guard = new TurnReplayGuard();
    guard.beginResponse();
    guard.appendTranscript(`${paragraph} `);
    assert.equal(guard.shouldDropPcm(20), false);
    guard.appendTranscript('continued response.');
    assert.equal(guard.transcriptText, `${paragraph} continued response.`);
  });

  it('keeps a confirmed transcription replay kill switch before first PCM', () => {
    const guard = new TurnReplayGuard();
    guard.beginResponse();
    guard.appendTranscript(`${paragraph} ${paragraph}`);
    assert.equal(guard.isSuppressed(), true);
    assert.equal(guard.shouldDropPcm(40), true);
  });

  it('requires a large immediate suffix, not a later opening-passage return', () => {
    const intervening = `${paragraph} then we discussed several unrelated topics at length before returning to ${paragraph}`;
    assert.equal(findImmediateSubstantialReplay(intervening), null);
  });
});