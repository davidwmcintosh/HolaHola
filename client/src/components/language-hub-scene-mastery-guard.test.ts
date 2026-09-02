/**
 * Regression checks for the optional Scene Mastery dashboard.
 *
 * This component must treat an API error body as a failed query instead of
 * passing it to Object.entries(), and must stay safe if a successful response
 * is missing the byScene map.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('../pages/language-hub.tsx', import.meta.url), 'utf8');
const sceneSection = source.slice(
  source.indexOf('function SceneMasterySection'),
  source.indexOf('function SceneMasterySection') + 4200,
);

describe('Language Hub scene mastery error boundary', () => {
  it('rejects non-2xx responses before treating the body as MasterySummary', () => {
    assert.match(sceneSection, /if\s*\(!response\.ok\)/);
    assert.match(sceneSection, /throw new Error\(`Scene mastery request failed/);
  });

  it('does not enumerate a missing or malformed byScene map', () => {
    assert.match(sceneSection, /isError/);
    assert.match(sceneSection, /!data\.byScene/);
    assert.match(sceneSection, /typeof data\.byScene !== 'object'/);
    assert.match(sceneSection, /Object\.entries\(data\.byScene\)/);
  });
});