# Daniela's Neural Network Expansion - Feature Spec

**Source:** Founder Mode conversation with Daniela (Dec 10, 2025)
**Status:** Ready for implementation
**Priority:** High - Core to interlingual teaching vision

---

## Executive Summary

Daniela's core request: **Language-Specific Pedagogical Memory** - the ability to store and retrieve granular, context-specific teaching information for each language, creating a "specialized teacher's guide" for each language she teaches.

> "I have the underlying knowledge. But what we're building with this memory system is the ability to **access, prioritize, and present** that knowledge in the most effective way for teaching a particular language to a particular student."

---

## Feature 1: Language-Specific Knowledge Categories

### 1.1 Idioms & Proverbs Database

**What Daniela needs:**
- Not just translations, but cultural context and appropriate usage scenarios
- Understanding the "spirit" of expressions
- When to use similar-but-different idioms

**Example:** Knowing *estar como una cabra* (crazy/wild) vs *estar como una vaca* (stuffed/full) - similar structure, completely different meanings

**Data Model:**
```typescript
languageIdioms: {
  id: uuid,
  language: string,           // "spanish", "french", etc.
  idiom: string,              // Original phrase
  literalTranslation: string, // Word-for-word
  meaning: string,            // Actual meaning
  culturalContext: string,    // When/how it's used
  usageExamples: string[],    // Sample sentences
  registerLevel: string,      // "formal", "casual", "slang"
  region: string?,            // Regional variations
  commonMistakes: string[],   // What learners get wrong
  relatedIdioms: uuid[],      // Similar expressions to compare
}
```

### 1.2 Cultural Nuances & Etiquette

**What Daniela needs:**
- Appropriate greetings per culture/context
- Gestures and body language differences
- Social customs (conversational distance, interruption norms)
- Business vs casual register differences

**Example:** How to politely interrupt in French vs German

**Data Model:**
```typescript
culturalNuances: {
  id: uuid,
  language: string,
  category: string,           // "greetings", "gestures", "dining", "business"
  situation: string,          // "meeting someone new", "formal dinner"
  nuance: string,             // What to do/say
  explanation: string,        // Why this matters
  commonMistakes: string[],   // What foreigners get wrong
  region: string?,            // Regional variations
  formalityLevel: string,     // "very formal", "casual", "intimate"
}
```

### 1.3 Common Learner Error Patterns (Per Language)

**What Daniela needs:**
- Pre-loaded knowledge of what English speakers struggle with per target language
- Specific strategies for each common error pattern
- Not per-student, but per-language-pair (English→Spanish, English→French)

**Examples:**
- English→Spanish: Subjunctive mood confusion
- English→French: Tu/vous distinction
- English→German: Case system struggles

**Data Model:**
```typescript
learnerErrorPatterns: {
  id: uuid,
  targetLanguage: string,     // Language being learned
  sourceLanguage: string,     // Learner's native language (default: "english")
  errorCategory: string,      // "grammar", "pronunciation", "vocabulary", "cultural"
  specificError: string,      // "subjunctive overuse", "ser/estar confusion"
  whyItHappens: string,       // Root cause explanation
  teachingStrategies: string[], // Pre-loaded approaches
  exampleMistakes: string[],  // Common incorrect forms
  correctForms: string[],     // Correct versions
  actflLevel: string?,        // When this typically appears
  relatedErrors: uuid[],      // Linked error patterns
}
```

### 1.4 Regional Dialectal Differences

**What Daniela needs:**
- Vocabulary differences between regions
- Pronunciation variations
- Grammar differences (voseo in Argentina, etc.)

**Data Model:**
```typescript
dialectVariations: {
  id: uuid,
  language: string,
  region: string,             // "Mexico", "Argentina", "Spain"
  category: string,           // "vocabulary", "pronunciation", "grammar"
  standardForm: string,       // Standard/neutral version
  regionalForm: string,       // Regional variant
  explanation: string,        // When/why this differs
  audioExample: string?,      // Reference to pronunciation
  usageNotes: string,         // Context for when to use
}
```

---

## Feature 2: Non-Latin Script Support

### 2.1 Character Display & Explanation Tool

**For:** Japanese, Korean, Chinese, Arabic, etc.

**Whiteboard Command:**
```
[STROKE:漢:かん:Chinese character meaning "Han/Chinese":8]
```

**Parameters:**
- Character to display
- Phonetic reading
- Meaning/explanation
- Stroke count

### 2.2 Stroke Order Animation

**Integration:** Already have `hanzi-writer` installed for Chinese/Japanese

**Whiteboard Command:**
```
[STROKE_ANIMATE:漢:speed=slow]
```

**Features needed:**
- Animate stroke order step-by-step
- Pause/replay controls
- Practice mode (student traces)

### 2.3 Tone Visualization (Mandarin, Vietnamese, Thai)

**Whiteboard Command:**
```
[TONE:mā:1:mother]
[TONE:má:2:hemp]  
[TONE:mǎ:3:horse]
[TONE:mà:4:scold]
```

**Visual:** Display tone contour diagram alongside pronunciation

---

## Feature 3: Segmented Language Memory

### The Problem
If a student learns both Spanish and Italian with Daniela, their insights/struggles shouldn't be jumbled together.

### The Solution
Tag all memory entries with language context:

```typescript
// Existing studentInsights, recurringStruggles, etc. get language tag
studentInsights: {
  ...existingFields,
  language: string,  // ADD: "spanish", "italian", "all"
}
```

### Query Pattern
When Daniela "puts on the Italian mask":
- Retrieve only `language = "italian"` or `language = "all"` insights
- Present Italian-specific context immediately
- Maintain separation between language learning journeys

---

## Feature 4: Linguistic Bridge Detection

### What Daniela Wants
Understand connections between languages to help learners leverage their existing knowledge.

**For Spanish→Italian learner:**
- Cognates to leverage
- False friends to warn about
- Pronunciation shifts to explain

**Data Model:**
```typescript
linguisticBridges: {
  id: uuid,
  sourceLanguage: string,
  targetLanguage: string,
  bridgeType: string,         // "cognate", "false_friend", "grammar_parallel"
  sourceWord: string,
  targetWord: string,
  relationship: string,       // "same meaning", "different meaning", "similar structure"
  explanation: string,
  teachingNote: string,       // How to present this to learners
}
```

---

## Implementation Priority

### Phase 1: Schema & Seeding (Week 1)
1. Create database tables for new knowledge categories
2. Seed initial data for Spanish (primary language)
3. Add language tag to existing memory tables

### Phase 2: Retrieval & Context (Week 2)  
1. Build retrieval functions for language-specific knowledge
2. Inject relevant knowledge into Daniela's prompt context
3. Implement language-segmented memory queries

### Phase 3: Whiteboard Tools (Week 3)
1. STROKE command for character display
2. STROKE_ANIMATE integration with hanzi-writer
3. TONE visualization for tonal languages

### Phase 4: Expansion (Ongoing)
1. Seed additional languages
2. Build linguistic bridges database
3. Add regional dialect support

---

## Daniela's Philosophy

> "It's about making sure the right piece of information is at my fingertips at the right moment, rather than having to sift through the entire library every time."

The goal isn't to add more knowledge - she already has it. The goal is **pedagogical indexing** - organizing knowledge for instant, contextual retrieval during teaching moments.
