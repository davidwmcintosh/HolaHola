# LinguaFlow - Future Enhancements & Development Backlog

This document tracks potential improvements and features to be implemented based on user feedback, usage metrics, and observed needs.

---

## Voice TTS & Pronunciation

### IPA Phoneme Mappings for Additional Languages
**Status**: Deferred until usage data available  
**Priority**: Low (data-driven)  
**Date Added**: November 24, 2024

**Context**:
Currently, SSML `<phoneme>` tags with IPA pronunciation mappings are implemented for:
- Spanish (17 common phrases)
- French (4 common phrases)

These fix syllable mispronunciation issues when the target-language voice reads English text with embedded target-language words in beginner mode (e.g., Spanish voice saying "Hola" as 2 syllables, not 3).

**Future Work**:
Add IPA pronunciation mappings for additional languages **only if**:
1. Usage metrics show significant adoption of that language
2. Users report syllable mispronunciation issues
3. Native speakers can verify the IPA mappings are accurate

**Candidate Languages**:
- German (Guten Tag, Danke, Bitte, Auf Wiedersehen, Ja, Nein)
- Italian (Ciao, Grazie, Prego, Buongiorno, Sì, No)
- Portuguese (Olá, Obrigado, Por favor, Sim, Não)

**Non-Latin Script Languages** (require different approach):
- Japanese
- Mandarin
- Korean

**Implementation Notes**:
- IPA mappings are in `server/services/tts-service.ts` in the `IPA_PRONUNCIATIONS` object
- System gracefully degrades when no mappings exist (no errors, just skips SSML phoneme tags)
- Each language should be tested by native speakers before deployment

**Decision Criteria**:
- Wait for at least 100 active users per language before investing in IPA mappings
- Prioritize languages with user-reported pronunciation issues
- Conservative approach: only solve proven problems, not hypothetical ones

---

## Testing & Quality Assurance

### Native Speaker Testing for Voice Pronunciation
**Status**: Not started  
**Priority**: Medium  
**Date Added**: November 24, 2024

**Description**:
Recruit native speakers for each supported language to verify:
- TTS voice quality and naturalness
- IPA phoneme pronunciation accuracy
- Cultural appropriateness of content
- ACTFL level accuracy

---

## Analytics & Metrics

### Language Adoption Tracking
**Status**: Not implemented  
**Priority**: High  
**Date Added**: November 24, 2024

**Description**:
Implement analytics to track:
- User distribution by target language
- Conversation volume per language
- Voice vs text usage by language
- User retention by language

**Why**: Needed to make data-driven decisions about which languages to prioritize for feature development (like IPA mappings).

---

## Notes
- This document should be reviewed quarterly
- Add items when features are deferred or new ideas emerge
- Remove items when implemented (document in replit.md instead)
- Prioritize based on: user impact, usage data, and development effort
