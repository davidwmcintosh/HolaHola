import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findImmediateSubstantialReplay } from '../services/gemini-live-replay-detector';

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
});