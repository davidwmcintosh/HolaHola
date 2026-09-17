import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  cacheGeneratedVisual,
  normalizeTargetLanguage,
  shouldCacheVisualResult,
} from '../services/visual-content-service';
import {
  buildGenerationConcept,
  classifyImageIntent,
  generateIntentCacheKey,
} from '../services/vocabulary-image-resolver';

const visualService = readFileSync('server/services/visual-content-service.ts', 'utf8');
const resolver = readFileSync('server/services/vocabulary-image-resolver.ts', 'utf8');
const googleImageService = readFileSync('server/services/google-image-service.ts', 'utf8');
const nativeHandlers = readFileSync('server/services/native-fc-handlers.ts', 'utf8');
const registry = readFileSync('server/services/daniela-function-registry.ts', 'utf8');

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
      /generateVisual\(\s*conceptForGeneration,\s*generationType,[\s\S]*anchorImageUrl,\s*language/,
    );
    assert.match(googleImageService, /generateCharacterSceneWithMetadata/);
    assert.match(visualService, /styleProfileUsed=[\s\S]*styleProfileLookupFailed/);
  });

  it('classifies the recorded Madrid request as an empty environment', () => {
    const intent = classifyImageIntent(
      'Madrid',
      'a beautiful watercolor painting of a sun-drenched street in Madrid, with historic buildings and sidewalk cafes',
    );
    assert.deepEqual(intent, { contentKind: 'environment', peoplePolicy: 'excluded' });
  });

  it('routes explicit shoppers and active tutor scenes to character content', () => {
    assert.deepEqual(
      classifyImageIntent('Madrid', 'a Madrid street with shoppers and colorful market stalls'),
      { contentKind: 'character', peoplePolicy: 'explicit' },
    );
    assert.match(
      buildGenerationConcept('Madrid', 'a Madrid street with shoppers', 'Madrid', undefined, 'spanish', 'Cindy, the active language tutor,', true),
      /^Cindy, the active language tutor,/,
    );
    assert.doesNotMatch(
      buildGenerationConcept('Madrid', 'a Madrid street with shoppers', 'Madrid', undefined, 'spanish', 'Daniela, the active language tutor,', true),
      /^Cindy/,
    );
  });

  it('keeps long isolated prop descriptions out of the environment route', () => {
    assert.deepEqual(
      classifyImageIntent('apple', 'a red apple on a wooden table with soft studio lighting'),
      { contentKind: 'prop', peoplePolicy: 'excluded' },
    );
    assert.deepEqual(
      classifyImageIntent('horchata', 'a tall glass of horchata with ice and a cinnamon stick'),
      { contentKind: 'prop', peoplePolicy: 'excluded' },
    );
    assert.deepEqual(
      classifyImageIntent('rosa', 'a single pink rose isolated on a white background'),
      { contentKind: 'prop', peoplePolicy: 'excluded' },
    );
    assert.deepEqual(
      classifyImageIntent('Madrid', 'Rosa in a Madrid plaza', undefined, 'Rosa'),
      { contentKind: 'character', peoplePolicy: 'explicit' },
    );
  });

  it('separates custom scene cache identities without changing prop keys', () => {
    const environmentKey = generateIntentCacheKey('Madrid', 'spanish', 'environment', 'a quiet Madrid street');
    const secondEnvironmentKey = generateIntentCacheKey('Madrid', 'spanish', 'environment', 'a crowded Madrid plaza');
    const characterKey = generateIntentCacheKey('Madrid', 'spanish', 'character', 'a Madrid street with shoppers', undefined, 'Cindy');
    assert.notEqual(environmentKey, secondEnvironmentKey);
    assert.notEqual(environmentKey, characterKey);
    assert.match(environmentKey, /^vocab_spanish_madrid_environment_/);
    assert.notEqual(environmentKey, 'vocab_spanish_madrid');
    assert.equal(
      generateIntentCacheKey('Madrid', ' Spanish ', 'environment', 'a quiet Madrid street'),
      environmentKey,
    );
  });

  it('routes environment generation separately and preserves canonical language metadata', () => {
    assert.match(visualService, /request\.type === 'environment'/);
    assert.match(
      visualService,
      /generateEnvironmentSceneWithMetadata\([\s\S]*request\.concept,[\s\S]*request\.targetLanguage \|\| 'environment',[\s\S]*peoplePolicy === 'excluded'/,
    );
    assert.match(visualService, /normalizeTargetLanguage\(language\)/);
    assert.match(googleImageService, /empty environment only; no people, tutors, characters, silhouettes, or human figures/);
    assert.match(nativeHandlers, /scene,\s*slot,\s*tutorName: session\.tutorName/);
    assert.match(registry, /Images in this slot are treated as empty environments/);
  });

  it('classifies explicit custom scenes before canonical vocabulary fallback', () => {
    assert.match(resolver, /const hasCustomScene = Boolean\(scene\?\.trim\(\)\)/);
    assert.match(
      resolver,
      /let conceptKey: string \| null = hasCustomScene\s*\?\s*null\s*:\s*lookupCanonicalConcept/,
    );
    assert.match(resolver, /if \(!conceptKey && !hasCustomScene\)/);
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
    const generationIndex = resolver.lastIndexOf('const result = await generateVisual(');
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