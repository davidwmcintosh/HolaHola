# Whiteboard API Reference

Technical documentation for the whiteboard markup system and WebSocket integration.

---

## Overview

The whiteboard system uses a markup-based approach embedded in the AI tutor's responses. This document covers:

- Markup format specifications
- Type definitions
- Parsing logic
- WebSocket integration for drills
- Error handling

---

## Markup Format

### General Syntax

```
[TOOL_NAME]content[/TOOL_NAME]
[TOOL_NAME param="value"]content[/TOOL_NAME]
```

### Parsing Notes

- Tags are case-sensitive (use uppercase)
- Parameters are optional unless specified
- Content is extracted between opening and closing tags
- Pipe (`|`) separates multiple values in content
- Line breaks in content are preserved (for DRILL match type)

---

## Type Definitions

All types are defined in `shared/whiteboard-types.ts`.

### Base Types

```typescript
interface WhiteboardItemBase {
  id: string;
  type: WhiteboardItemType;
  timestamp: number;
}

type WhiteboardItemType = 
  | 'write' | 'phonetic' | 'compare' | 'image' | 'drill'
  | 'context' | 'grammar_table' | 'reading' | 'stroke'
  | 'word_map' | 'culture' | 'play' | 'scenario' | 'summary';
```

### Tool-Specific Types

#### WRITE

```typescript
interface WriteItem extends WhiteboardItemBase {
  type: 'write';
  data: {
    text: string;
  };
}
```

#### PHONETIC

```typescript
interface PhoneticItem extends WhiteboardItemBase {
  type: 'phonetic';
  data: {
    word: string;
    breakdown: string;
  };
}
```

**Parsing:** `[PHONETIC]word|breakdown[/PHONETIC]`

#### COMPARE

```typescript
interface CompareItem extends WhiteboardItemBase {
  type: 'compare';
  data: {
    correct: string;
    incorrect: string;
  };
}
```

**Parsing:** `[COMPARE]correct NOT incorrect[/COMPARE]`

#### IMAGE

```typescript
interface ImageItem extends WhiteboardItemBase {
  type: 'image';
  data: {
    word: string;
    description?: string;
    imageUrl?: string;
    isLoading?: boolean;
  };
}
```

**Parsing:** `[IMAGE]word[/IMAGE]` or `[IMAGE]word|description[/IMAGE]`

#### DRILL

```typescript
type DrillType = 'repeat' | 'translate' | 'fill_blank' | 'match';

interface DrillItem extends WhiteboardItemBase {
  type: 'drill';
  data: DrillItemData;
}

interface DrillItemData {
  drillType: DrillType;
  prompt: string;
  pairs?: MatchPair[];  // Only for match type
  state?: MatchState;   // Only for match type
}

interface MatchPair {
  left: string;
  right: string;
}

interface MatchState {
  selectedLeft: number | null;
  matches: number[];        // Index of matched right item for each left
  attempts: number;
  wrongPair: [number, number] | null;
}
```

**Parsing:**
- `[DRILL type="repeat"]prompt[/DRILL]`
- `[DRILL type="translate"]prompt[/DRILL]`
- `[DRILL type="fill_blank"]sentence with ___[/DRILL]`
- `[DRILL type="match"]left1 => right1\nleft2 => right2[/DRILL]`

#### CONTEXT

```typescript
interface ContextItem extends WhiteboardItemBase {
  type: 'context';
  data: {
    word: string;
    sentences: string[];
  };
}
```

**Parsing:** `[CONTEXT]word|sentence1|sentence2|sentence3[/CONTEXT]`

#### GRAMMAR_TABLE

```typescript
interface GrammarTableItem extends WhiteboardItemBase {
  type: 'grammar_table';
  data: {
    verb: string;
    tense: string;
    conjugations?: Record<string, string>;  // pronoun -> form
    isLoading?: boolean;
  };
}
```

**Parsing:** `[GRAMMAR_TABLE]verb|tense[/GRAMMAR_TABLE]`

Supported tenses: `present`, `past`, `future`, `imperfect`, `conditional`, `subjunctive`

#### READING

```typescript
interface ReadingItem extends WhiteboardItemBase {
  type: 'reading';
  data: {
    character: string;
    pronunciation: string;
    language?: 'japanese' | 'mandarin' | 'korean';
  };
}
```

**Parsing:** `[READING]character|pronunciation[/READING]` or `[READING]character|pronunciation|language[/READING]`

Language is auto-detected from character set if not specified.

#### STROKE

```typescript
interface StrokeItem extends WhiteboardItemBase {
  type: 'stroke';
  data: {
    character: string;
    language?: string;
  };
}
```

**Parsing:** `[STROKE]character[/STROKE]`

Uses HanziWriter library for animation.

#### WORD_MAP

```typescript
interface WordMapItem extends WhiteboardItemBase {
  type: 'word_map';
  data: {
    word: string;
    synonyms?: string[];
    antonyms?: string[];
    collocations?: string[];
    wordFamily?: string[];
    isLoading?: boolean;
  };
}
```

**Parsing:** `[WORD_MAP]word[/WORD_MAP]`

Related words are generated asynchronously by AI.

#### CULTURE

```typescript
type CultureCategory = 
  | 'food' | 'dining' | 'gestures' | 'body_language'
  | 'holidays' | 'festivals' | 'etiquette' | 'customs'
  | 'general';

interface CultureItem extends WhiteboardItemBase {
  type: 'culture';
  data: {
    topic: string;
    context: string;
    category: CultureCategory;
  };
}
```

**Parsing:** `[CULTURE]topic|context|category[/CULTURE]`

#### PLAY

```typescript
type PlaySpeed = 'slow' | 'normal' | 'fast';

interface PlayItem extends WhiteboardItemBase {
  type: 'play';
  data: {
    text: string;
    speed: PlaySpeed;
  };
}
```

**Parsing:** `[PLAY]text[/PLAY]` or `[PLAY speed="slow"]text[/PLAY]`

Speed maps to speaking rate: slow=0.5, normal=1.0, fast=1.5

#### SCENARIO

```typescript
type ScenarioMood = 'formal' | 'casual' | 'urgent' | 'friendly';

interface ScenarioItem extends WhiteboardItemBase {
  type: 'scenario';
  data: {
    location: string;
    situation: string;
    mood?: ScenarioMood;
    roles?: string[];  // Extracted from situation text
  };
}
```

**Parsing:** `[SCENARIO]location|situation|mood[/SCENARIO]`

#### SUMMARY

```typescript
interface SummaryItem extends WhiteboardItemBase {
  type: 'summary';
  data: {
    title: string;
    words: string[];
    phrases: string[];
    totalItems: number;
  };
}
```

**Parsing:** `[SUMMARY]title|word1,word2,word3|phrase1,phrase2[/SUMMARY]`

---

## Parsing Functions

Located in `shared/whiteboard-types.ts`:

```typescript
// Main parser
function parseWhiteboardItems(text: string): WhiteboardItem[];

// Individual parsers
function parsePhoneticItem(content: string): PhoneticItemData;
function parseCompareItem(content: string): CompareItemData;
function parseDrillItem(content: string, params: string): DrillItemData;
function parseMatchPairs(content: string): MatchPair[];
function parseContextItem(content: string): ContextItemData;
function parseGrammarTableItem(content: string): GrammarTableItemData;
function parseReadingItem(content: string): ReadingItemData;
function parseStrokeItem(content: string): StrokeItemData;
function parseWordMapItem(content: string): WordMapItemData;
function parseCultureItem(content: string): CultureItemData;
function parsePlayItem(content: string, params: string): PlayItemData;
function parseScenarioItem(content: string): ScenarioItemData;
function parseSummaryItem(content: string): SummaryItemData;

// Type guards
function isWriteItem(item: WhiteboardItem): item is WriteItem;
function isPhoneticItem(item: WhiteboardItem): item is PhoneticItem;
// ... etc for each type
```

---

## WebSocket Integration

### Voice Chat WebSocket

The whiteboard integrates with the voice chat WebSocket for streaming:

```typescript
// Client receives parsed items via WebSocket
interface WhiteboardMessage {
  type: 'whiteboard';
  items: WhiteboardItem[];
}
```

### Drill Evaluation Flow

For interactive drills:

1. **Client → Server:** User response
2. **Server:** Evaluates via Gemini
3. **Server → Client:** Feedback

```typescript
// Drill response
interface DrillResponseMessage {
  type: 'drill_response';
  drillId: string;
  response: string;
}

// Drill feedback
interface DrillFeedbackMessage {
  type: 'drill_feedback';
  drillId: string;
  isCorrect: boolean;
  feedback: string;
  correctAnswer?: string;
}
```

---

## Audio Integration

### PLAY Button TTS

The PLAY tool triggers Cartesia TTS:

```typescript
// API: POST /api/voice/synthesize
interface SynthesizeRequest {
  text: string;
  language: string;
  speakingRate?: number;  // 0.5, 1.0, or 1.5
}

// Client implementation
async function synthesizeSpeech(
  text: string,
  language: string,
  // ... other params
  speakingRate?: number,
  signal?: AbortSignal
): Promise<Blob>;
```

Speed mapping:
- `slow` → speakingRate: 0.5
- `normal` → speakingRate: 1.0
- `fast` → speakingRate: 1.5

---

## Image Resolution

### IMAGE Tool Flow

1. Parse `[IMAGE]word[/IMAGE]`
2. Call vocabulary-image-resolver service
3. Fallback chain: Cache → Stock → AI Generation
4. Update item with `imageUrl`

```typescript
// Service: server/services/vocabulary-image-resolver.ts
async function resolveVocabularyImage(
  word: string,
  language: string,
  userId: string
): Promise<string | null>;
```

---

## HanziWriter Integration

### STROKE Tool Implementation

```typescript
// Dynamic import for SSR safety
const HanziWriter = await import('hanzi-writer');

// Create writer instance
const writer = HanziWriter.create(containerId, character, {
  width: 120,
  height: 120,
  strokeColor: '#ea580c',
  outlineColor: '#ddd',
  delayBetweenStrokes: 300,
});

// Animate
writer.animateCharacter();

// Cleanup on unmount
writer.destroy();
```

---

## Error Handling

### Parsing Errors

Invalid markup is silently ignored:
- Unclosed tags
- Unknown tool names
- Missing required parameters
- Malformed content

### Runtime Errors

| Scenario | Handling |
|----------|----------|
| Image load failure | Show placeholder |
| TTS failure | Show error state, allow retry |
| HanziWriter unsupported | Show static character |
| AI generation timeout | Show loading, then fallback |

---

## Component Implementation

Located in `client/src/components/Whiteboard.tsx`:

```typescript
// Main whiteboard component
function Whiteboard({ items }: { items: WhiteboardItem[] });

// Individual displays
function WriteItemDisplay({ item }: { item: WriteItem });
function PhoneticItemDisplay({ item }: { item: PhoneticItem });
function CompareItemDisplay({ item }: { item: CompareItem });
function ImageItemDisplay({ item }: { item: ImageItem });
function DrillItemDisplay({ item }: { item: DrillItem });
function MatchDrillDisplay({ item }: { item: DrillItem });
function ContextItemDisplay({ item }: { item: ContextItem });
function GrammarTableItemDisplay({ item }: { item: GrammarTableItem });
function ReadingItemDisplay({ item }: { item: ReadingItem });
function StrokeItemDisplay({ item }: { item: StrokeItem });
function WordMapItemDisplay({ item }: { item: WordMapItem });
function CultureItemDisplay({ item }: { item: CultureItem });
function PlayItemDisplay({ item }: { item: PlayItem });
function ScenarioItemDisplay({ item }: { item: ScenarioItem });
function SummaryItemDisplay({ item }: { item: SummaryItem });
```

---

## Testing

### Data-TestIDs

For Playwright testing:

| Element | TestID Pattern |
|---------|---------------|
| Drill left items | `drill-left-{index}` |
| Drill right items | `drill-right-{index}` |
| Match count | `drill-match-count` |
| Try again button | `drill-try-again` |
| Play button | `play-button-{id}` |
| Replay stroke | `stroke-replay-{id}` |

### Testing Notes

- Whiteboard tools only work in Voice Learning mode
- Playwright cannot use microphone, so voice mode must be tested manually
- DRILL interactions can be tested via component tests

---

*Last updated: December 2025*
