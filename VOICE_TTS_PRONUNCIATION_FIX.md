# Voice TTS Pronunciation Fix - SSML Phoneme Tags

## Current Status: ⚠️ DISABLED

**SSML phoneme tags are currently disabled** because:

1. **Chirp 3 HD voices do NOT support SSML** - Google's highest quality voices reject SSML input
2. **Neural2 voices sound less natural** - When SSML is needed, we must fall back to Neural2 voices which have noticeably inferior quality compared to Chirp 3 HD
3. **Voice quality > pronunciation precision** - User testing confirmed Chirp 3 HD's natural voice is preferred over Neural2's more precise pronunciation

**Future re-enablement**: When Google adds SSML support to Chirp 3 HD voices, remove the early return in `addPhonemeTagsForTargetWords()`.

---

## Problem Statement

When the Spanish Chirp 3 HD TTS voice reads English text with embedded Spanish words (for immersive beginner mode), it **mispronounces Spanish words syllabically**.

**Example**:
- **Text**: "The most common Spanish greeting is 'Hola'..."  
- **Expected**: "Hola" = 2 syllables (HO-la)  
- **Actual**: "Hola" = 3 syllables (sounds like "ho-li-days")

**Root Cause**:  
Google Cloud TTS Chirp 3 HD voices **mis-segment short emphasized loanwords** when reading foreign words embedded in English text.

---

## Attempted Solution Architecture

### Approach: SSML Phoneme Tags

Use **SSML `<phoneme>` tags** with IPA (International Phonetic Alphabet) pronunciation to enforce correct syllable counts.

**Transformation Example**:
```
Input:  "The greeting is 'Hola'..."
Output: "The greeting is '<phoneme alphabet="ipa" ph="ˈola">Hola</phoneme>'..."
```

### Why It Was Disabled

| Voice Type | SSML Support | Quality | Trade-off |
|------------|--------------|---------|-----------|
| **Chirp 3 HD** | ❌ No | ⭐⭐⭐⭐⭐ Excellent | Best quality, no pronunciation control |
| **Neural2** | ✅ Yes | ⭐⭐⭐ Good | Supports phoneme tags, less natural |
| **WaveNet** | ✅ Yes | ⭐⭐⭐ Good | Supports phoneme tags, less natural |

**User feedback**: The Chirp 3 HD voice is "much more natural" than Neural2. The pronunciation benefits don't outweigh the voice quality loss.

---

## Implementation (Preserved for Future Use)

### 1. IPA Pronunciation Mappings

IPA mappings for common Spanish words are ready (`server/services/tts-service.ts`):

```typescript
const IPA_PRONUNCIATIONS: Record<string, Record<string, string>> = {
  'spanish': {
    'hola': 'ola',              // HO-la (2 syllables)
    'adiós': 'aðjos',           // a-DI-ós (3 syllables)
    'gracias': 'gɾasjas',       // GRA-cias (2 syllables)
    'por favor': 'poɾ faβoɾ',   // por fa-VOR
    'buenos días': 'bwenos dias', // BUE-nos DI-as
    // ... 17+ common phrases
  },
  'french': { /* ... */ },
};
```

### 2. SSML-Compatible Voice Map

Added Neural2 voices that support SSML:

```typescript
const GOOGLE_SSML_VOICE_MAP = {
  'spanish': { name: 'es-US-Neural2-A', languageCode: 'es-US' },
  'english': { name: 'en-US-Neural2-F', languageCode: 'en-US' },
  // ... all 9 languages
};
```

### 3. HTML Entity Encoding

Non-ASCII characters (like `í`, `é`, IPA symbols) must be HTML entity encoded for SSML:

```typescript
private encodeForSSML(text: string): string {
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    return code > 127 ? `&#x${code.toString(16)};` : char;
  }).join('');
}
```

**Example**: `días` → `d&#xed;as`

### 4. Automatic Voice Switching

The system automatically switches between voice types based on SSML need:

```typescript
if (usesSSML) {
  // Use Neural2 voice for SSML compatibility
  voiceConfig = GOOGLE_SSML_VOICE_MAP[selectedLanguage];
} else {
  // Use Chirp 3 HD for best quality
  voiceConfig = GOOGLE_VOICE_MAP[selectedLanguage];
}
```

---

## To Re-Enable SSML Phoneme Tags

1. Edit `server/services/tts-service.ts`
2. Find `addPhonemeTagsForTargetWords()` function
3. Remove the early return statement:
   ```typescript
   // Remove this line:
   return { text, usesSSML: false };
   ```
4. The system will automatically:
   - Detect quoted target-language words
   - Apply IPA phoneme tags
   - Switch to Neural2 voice for SSML compatibility

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| **SSML preprocessing overhead** | ~1ms (string replace operation) |
| **Total voice response time** | ~4s (unchanged) |
| **Target** | <6s |
| **Result** | ✅ On target |

---

## Future Considerations

1. **Wait for Chirp 3 HD SSML support** - Google may add SSML support to Chirp voices in future updates
2. **Hybrid approach** - Only use Neural2 for specific problematic words (rare)
3. **Alternative pronunciation techniques** - Explore other methods like prosody/rate/pitch adjustments (these work with Chirp 3 HD)
4. **User preference setting** - Let users choose between voice quality vs pronunciation accuracy

---

## References

- **Google Cloud TTS SSML**: https://cloud.google.com/text-to-speech/docs/ssml
- **IPA for Spanish**: https://en.wikipedia.org/wiki/Help:IPA/Spanish
- **Performance Metrics**: `DEVELOPMENT_METRICS.md`
- **Voice Validation**: `VOICE_VALIDATION_ARCHITECTURE.md`

---

## Summary

SSML phoneme tags are **implemented but disabled** because:
- ❌ Chirp 3 HD (best quality) doesn't support SSML
- ❌ Neural2 (supports SSML) sounds less natural
- ✅ Users prefer natural voice quality over precise pronunciation

**Current approach**: Use Chirp 3 HD consistently for best voice quality, accepting minor pronunciation imperfections.
