/**
 * voice-message-tutor-name.test.ts
 *
 * Source-analysis guard: confirms the voice-message CTA button uses a dynamic
 * getTutorName() call rather than a hardcoded "Daniela" string.
 *
 * Run standalone:
 *   npx tsx --test server/tests/voice-message-tutor-name.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_PATH = resolve('client/src/pages/voice-message.tsx');
const source = readFileSync(SOURCE_PATH, 'utf8');

describe('voice-message CTA button label', () => {
  it('calls getTutorName() for the button label instead of hardcoding "Daniela"', () => {
    assert.ok(
      source.includes('getTutorName(data.language'),
      'Expected getTutorName(data.language, ...) call inside voice-message.tsx',
    );
  });

  it('does not contain a hardcoded "Start a session with Daniela" string', () => {
    assert.ok(
      !source.includes('Start a session with Daniela'),
      'Found hardcoded "Start a session with Daniela" — replace with getTutorName()',
    );
  });
});
