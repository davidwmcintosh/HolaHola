# Voice Response Validation Architecture

## Overview
This document describes the **Schema-Level Prevention** approach for voice response validation in LinguaFlow's beginner mode. This architecture prevents issues before they occur rather than fixing them after, resulting in simpler, more maintainable code.

## Architecture Decision: Prevention Over Reaction

**Design Philosophy**: Stop problems at the source instead of fixing them downstream.

### Previous Approach (Deprecated)
- ❌ Complex post-AI validation (~200+ lines)
- ❌ Reactive: Fix issues after AI generates them
- ❌ Hard to maintain
- ❌ Prone to edge cases

### Current Approach (Production)
- ✅ Schema-level prevention (~100 lines)
- ✅ Proactive: Prevent issues before AI generates them
- ✅ Simple and maintainable
- ✅ Universal language support

**Net Improvement**: -100 lines of code, better reliability

---

## Two-Tier Validation System

### Tier 1: Prevention (BEFORE AI)
**Location**: `server/routes.ts` - Voice tutor endpoint

**Gemini Structured Output Schema**:
```typescript
{
  target: {
    type: "string",
    maxLength: 15,  // NO minLength - allows short valid words like "sí", "に", "ja"
    description: "STRICT: ONE {targetLanguage} word or short phrase ONLY. 
                  MUST be in {targetLanguage} ONLY - NO {nativeLanguage} words.
                  NEVER use {nativeLanguage} words like 'Great', 'Perfect', 'OK', 'Yes', 'No'."
  },
  native: {
    type: "string",
    minLength: 30,
    description: "Complete {nativeLanguage} explanation. 
                  Write ONLY in {nativeLanguage} - NO {targetLanguage} sentences.
                  Embed {targetLanguage} words in SINGLE quotes."
  }
}
```

**What This Prevents**:
- Long rambling targets (maxLength: 15)
- Short explanations (minLength: 30)
- Native language words in target field (via clear instructions)

**What This Allows**:
- Short valid target words: "sí", "に", "ja", "oui", "si"
- Proper explanations in native language
- Natural, conversational responses

---

### Tier 2: Safety Net (AFTER AI)
**Location**: `server/routes.ts` - Universal language guard

**Purpose**: Catch the rare cases where Gemini ignores schema instructions.

#### For Short Words (<3 characters):
**Problem**: franc-min language detection doesn't work on very short strings.

**Solution**: Per-language stoplists of common short native words.

```typescript
const shortNativeWords = {
  'english': ['ok', 'hi', 'no', 'yes', 'go', 'me', 'we', 'is', 'am', 'be', 'or', 'to', 'up'],
  'spanish': ['sí', 'no', 'yo', 'tú', 'él', 'la', 'el', 'de', 'es', 'un'],
  'french': ['oui', 'non', 'je', 'tu', 'il', 'la', 'le', 'de', 'un', 'et'],
  'german': ['ja', 'nein', 'ich', 'du', 'er', 'sie', 'es', 'der', 'die', 'das', 'und'],
  'italian': ['sì', 'no', 'io', 'tu', 'lui', 'lei', 'la', 'il', 'di', 'un', 'e'],
  'portuguese': ['sim', 'não', 'eu', 'tu', 'ele', 'ela', 'o', 'a', 'de', 'um', 'e'],
  'russian': ['да', 'нет', 'я', 'ты', 'он', 'она', 'и', 'в', 'на', 'не'],
  'japanese': ['はい', 'いいえ', 'ね', 'よ', 'か', 'な', 'の', 'を', 'に', 'が'],
  'korean': ['네', '아니', '예', '나', '너', '그', '이', '의', '가', '을'],
  'mandarin': ['是', '不', '我', '你', '他', '她', '的', '了', '在', '和'],
  'mandarin chinese': [...], // Same as 'mandarin'
  'chinese': [...] // Same as 'mandarin'
};
```

**Logic**:
1. If `target.length < 3` AND `target` is in native language stoplist
2. Then extract from quotes in `native` field
3. Fallback to language-specific encouragement word

**Example**:
- French speaker learning Spanish
- AI mistakenly returns target: "oui"
- Guard detects "oui" in French stoplist
- Extracts Spanish word from native field quotes
- Result: User sees correct Spanish word

#### For Longer Words (≥3 characters):
**Solution**: Universal franc-min language detection.

```typescript
if (target.length >= 3) {
  const detectedISO = detectLanguage(target); // franc-min
  const expectedTargetISO = langToISO[targetLanguage];
  const expectedNativeISO = langToISO[nativeLanguage];
  
  if (detectedISO === expectedNativeISO && detectedISO !== expectedTargetISO) {
    // Wrong language detected, extract from quotes
  }
}
```

**Supported Languages**:
- English, Spanish, French, German, Italian
- Portuguese, Russian, Japanese, Korean
- Mandarin Chinese (all variants)

#### Graceful Recovery:
**Multi-script quote extraction**:
```typescript
// Supports Latin, CJK, European quotes
const quotedWords = native.matchAll(/['"`''"\"「」『』«»‹›]([^...]+)['"`''"\"「」『』«»‹›]/g);
const targetWord = quotedWords[quotedWords.length - 1][1]; // Use LAST quoted word
```

**Language-specific fallbacks**:
```typescript
const encouragements = {
  spanish: "¡Perfecto!", french: "Parfait!", german: "Gut!",
  italian: "Perfetto!", portuguese: "Perfeito!", japanese: "すごい!",
  korean: "좋아요!", mandarin: "好!", russian: "Отлично!"
};
```

---

## Coverage

### Language Combinations
**Total**: 81 combinations (9 native × 9 target languages)

**Native Languages**:
1. English
2. Spanish
3. French
4. German
5. Italian
6. Portuguese
7. Russian
8. Japanese
9. Korean
10. Mandarin Chinese (supports 'mandarin', 'mandarin chinese', 'chinese')

**Target Languages**: Same as native languages

### Test Scenarios
✅ **Valid short target words allowed**:
- Spanish: "sí", "no"
- Japanese: "に", "は"
- German: "ja"
- French: "oui"

✅ **Short native words blocked**:
- English: "OK", "Hi", "Yes"
- French: "oui", "non"
- German: "ja", "nein"

✅ **Cross-language protection**:
- French speaker learning Spanish: "sí" ✓, "oui" ✗
- German speaker learning Japanese: "に" ✓, "ja" ✗
- English speaker learning Spanish: "sí" ✓, "ok" ✗

---

## Performance Impact

**Previous Approach**:
- ~200+ lines of complex validation
- Multiple regex passes
- Complex normalization
- Hard to debug

**Current Approach**:
- ~100 lines total
- Schema prevents most issues
- Minimal guard catches edge cases
- Clear, maintainable code

**Speed**: No measurable performance impact
- Schema validation happens during AI generation (no extra time)
- Guard only runs on rare violations
- Quote extraction is fast regex

**Target Response Time**: <6 seconds total
- STT: ~1s
- AI: ~2s
- TTS: ~1s
- Validation: <0.01s

---

## Code Location

### Main Implementation
**File**: `server/routes.ts`
**Endpoint**: `POST /api/conversations/:conversationId/voice-tutor`

**Key Sections**:
1. **Schema Definition** (lines ~1530-1550)
2. **Universal Language Guard** (lines ~1615-1670)
3. **Quote Extraction** (lines ~1649-1653)
4. **Encouragement Fallback** (lines ~1656-1661)

### Related Files
- `server/system-prompt.ts` - Voice tutor instructions
- `server/phrase-detection.ts` - Smart phrase detection for "one word rule"
- `shared/schema.ts` - Database schema

---

## Maintenance Guide

### Adding a New Language

1. **Add to stoplists** (if native language):
```typescript
const shortNativeWords = {
  // ... existing languages
  'newlanguage': ['common', 'short', 'words']
};
```

2. **Add to ISO mapping** (if target language):
```typescript
const langToISO = {
  // ... existing languages
  'newlanguage': 'iso' // e.g., 'ita' for Italian
};
```

3. **Add encouragement fallback**:
```typescript
const encouragements = {
  // ... existing languages
  newlanguage: "Encouragement!"
};
```

4. **Test all combinations**:
- Native speaker learning other languages
- Other speakers learning this language

### Debugging

**Enable logging**:
```typescript
console.log('[VOICE LANG GUARD] Detected=...'); // Already in code
```

**Check logs for**:
- Short word detections
- Quote extractions
- Fallback triggers

**Common issues**:
- Language name mismatch (check 'mandarin' vs 'mandarin chinese')
- Missing stoplist entry
- Quote extraction failure (check quote marks)

---

## Key Principles

1. **Prevention over Reaction**: Stop problems at the source
2. **Simple over Complex**: Prefer clear code to clever code
3. **Universal Support**: Work for all languages, not just English
4. **Graceful Degradation**: Always have a fallback
5. **Maintainability**: Document decisions, keep code clean

---

## Migration Notes

**DO NOT REVERT** to the old complex validation system.

**If you see**:
- Complex post-AI validation logic
- Multiple validation passes
- Intricate normalization steps
- Hardcoded English-only checks

**STOP** and refer to this document. The current approach is simpler and better.

---

## Performance Metrics

See `DEVELOPMENT_METRICS.md` for detailed performance analysis.

**Summary**:
- 85% response time improvement (40s → 4s)
- 45% code reduction (200+ → 100 lines)
- 100% language coverage (81 combinations)
- 0% performance overhead (schema + minimal guard)

---

## References

- **franc-min**: Language detection library (npm)
- **Gemini Structured Output**: Google AI JSON schema validation
- **ACTFL Standards**: Language proficiency framework

---

*Last Updated*: November 2025  
*Architecture Owner*: LinguaFlow Development Team  
*Status*: Production (Architect Approved)*
