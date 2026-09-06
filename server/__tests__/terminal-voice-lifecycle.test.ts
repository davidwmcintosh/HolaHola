import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runTerminalVoiceLifecycle } from '../services/terminal-voice-lifecycle';

describe('terminal voice lifecycle', () => {
  it('attempts end and cleanup when metrics fail, preserving metrics error', async () => {
    const calls: string[] = [];
    const primary = new Error('metrics');
    await assert.rejects(runTerminalVoiceLifecycle({
      metrics: async () => { calls.push('metrics'); throw primary; },
      end: async () => { calls.push('end'); return null; },
      cleanup: async () => { calls.push('cleanup'); },
    }), primary);
    assert.deepEqual(calls, ['metrics', 'end', 'cleanup']);
  });

  it('always runs cleanup when usage end fails', async () => {
    const calls: string[] = [];
    const primary = new Error('end');
    await assert.rejects(runTerminalVoiceLifecycle({
      end: async () => { calls.push('end'); throw primary; },
      cleanup: async () => { calls.push('cleanup'); },
    }), primary);
    assert.deepEqual(calls, ['end', 'cleanup']);
  });
});