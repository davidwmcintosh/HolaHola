import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  cacheGeneratedVisual,
  normalizeTargetLanguage,
  shouldCacheVisualResult,
} from '../services/visual-content-service';

const visualService = readFileSync('server/services/visual-content-service.ts', 'utf8');
const resolver = readFileSync('server/services/vocabulary-image-resolver.ts', 'utf8');
const googleImageService = readFileSync('server/services/google-image-service.ts', 'utf8');

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
      /generateCharacterSceneWithMetadata\(request\.concept,\s*request\.targetLanguage\)/,
    );
    assert.match(
      visualService,
      /req\.anchorImageUrl,\s*req\.targetLanguage/,
    );
    assert.match(
      resolver,
      /generateVisual\(conceptForGeneration, generationType, undefined, undefined, anchorImageUrl, language\)/,
    );
    assert.match(googleImageService, /generateCharacterSceneWithMetadata/);
    assert.match(visualService, /styleProfileUsed=[\s\S]*styleProfileLookupFailed/);
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

  it('does not call storage cacheImage for a failed provider result', async () => {
    let cacheCalls = 0;
    const failed = {
      imageUrl: 'https://picsum.photos/seed/fallback/800/450',
      altText: 'fallback',
      semanticTags: ['infographic'],
      accessibilityDescription: 'fallback',
      conceptAlignment: 0.5,
      metadata: {
        provider: 'placeholder',
        generatedAt: new Date().toISOString(),
        dimensions: { width: 1024, height: 1024 },
      },
    };

    assert.equal(shouldCacheVisualResult(failed), false);
    assert.equal(
      await cacheGeneratedVisual(failed, async () => { cacheCalls += 1; }),
      false,
    );
    assert.equal(cacheCalls, 0);
  });
});