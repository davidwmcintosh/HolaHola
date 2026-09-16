import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { normalizeTargetLanguage } from '../services/visual-content-service';

const visualService = readFileSync('server/services/visual-content-service.ts', 'utf8');
const resolver = readFileSync('server/services/vocabulary-image-resolver.ts', 'utf8');

describe('canonical vocabulary image pipeline repair', () => {
  it('normalizes target language before selecting a pinned scene profile', () => {
    assert.equal(normalizeTargetLanguage('  Spanish '), 'spanish');
    assert.equal(normalizeTargetLanguage('FRENCH'), 'french');
    assert.equal(normalizeTargetLanguage('  '), undefined);
    assert.equal(normalizeTargetLanguage(undefined), undefined);
  });

  it('propagates language through generateVisual and its scene generator', () => {
    assert.match(visualService, /targetLanguage:\s*normalizeTargetLanguage\(language\)/);
    assert.match(
      visualService,
      /generateCharacterScene\(request\.concept,\s*request\.targetLanguage\)/,
    );
    assert.match(
      visualService,
      /req\.anchorImageUrl,\s*req\.targetLanguage/,
    );
    assert.match(
      resolver,
      /generateVisual\(conceptForGeneration, generationType, undefined, undefined, anchorImageUrl, language\)/,
    );
  });

  it('keeps prop generation on the prop pipeline and does not pass language into it', () => {
    assert.match(
      visualService,
      /: await generatePropImage\(request\.concept\)/,
    );
    assert.doesNotMatch(
      visualService,
      /generatePropImage\(request\.concept,\s*request\.targetLanguage\)/,
    );
  });

  it('keeps cache resolution ahead of generation and explicit regeneration intact', () => {
    const cacheIndex = resolver.indexOf('const cached = await storage.getCachedStockImage(key)');
    const generationIndex = resolver.indexOf(
      'const result = await generateVisual(conceptForGeneration, generationType, undefined, undefined, anchorImageUrl, language)',
    );
    assert.ok(cacheIndex >= 0 && generationIndex > cacheIndex);
    assert.match(resolver, /export async function refetchImage/);
    assert.match(resolver, /bustVocabImageCache\(\[primaryKey\]\)/);
  });
});