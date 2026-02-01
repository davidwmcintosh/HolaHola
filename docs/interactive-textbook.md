# Interactive Textbook

## Overview

The Interactive Textbook is a visual quick-reference companion to voice sessions with Daniela. It presents curriculum content in a magazine-like format with infographics, making it easy for students to preview lessons, review vocabulary, and understand what they'll practice.

## Architecture

### Page Structure
- **Flat, scrollable design**: All lessons within a chapter are visible on one scrollable page
- **Magazine-like layout**: Visual-first approach with infographics over dense text
- **Mobile-first**: Responsive design optimized for phone and tablet viewing

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TextbookChapterView` | `client/src/components/TextbookChapterView.tsx` | Renders a full chapter with all its lessons |
| `TextbookInfographics` | `client/src/components/TextbookInfographics.tsx` | Visual components for lesson content |
| `LessonSnapshot` | Same file | Orchestrates which infographic to show per lesson |

### Infographic Components

#### DrillDistributionChart
Shows the mix of practice activities in a lesson with a color-coded bar:
- **Listen & Repeat** (blue) - Audio comprehension and pronunciation
- **Translate & Speak** (green) - Production from native language
- **Fill in the Blank** (amber) - Grammar and context awareness
- **Matching** (purple) - Vocabulary association
- **Multiple Choice** (pink) - Comprehension checks

#### VocabularyPreview
Displays actual vocabulary from drills with target language and translations. Pulls from:
- `translate_speak` drills
- `matching` drills  
- `listen_repeat` drills (for audio vocabulary)

#### ConversationPreview
For conversation-focused lessons, shows:
- The conversation topic
- Sample prompts students will encounter

#### GrammarFocus
Displays fill-in-the-blank prompts to preview grammar patterns.

### Data Flow

```
Curriculum Lessons API
        ↓
TextbookChapterView (fetches lessons + drills)
        ↓
LessonSnapshot (decides which infographic to render)
        ↓
[DrillDistributionChart | VocabularyPreview | ConversationPreview | GrammarFocus]
```

### Test IDs for E2E Testing

| Element | data-testid |
|---------|-------------|
| Drill distribution chart | `drill-distribution-chart` |
| Vocabulary preview | `vocabulary-preview` |
| Conversation preview | `conversation-preview` |
| Grammar focus | `grammar-focus` |

---

## Curriculum Insights: Drill Audit Analysis

Daniela reviewed the full curriculum (187,638 drills across 9 languages) and identified strategic gaps that inform future content creation and the textbook's presentation.

### Current Drill Distribution

| Drill Type | Count | Notes |
|------------|-------|-------|
| listen_repeat | 90,834 | Strong audio foundation |
| translate_speak | 46,098 | Good for European languages |
| fill_blank | 42,814 | Grammar coverage |
| multiple_choice | 4,938 | Comprehension checks |
| number_dictation | ~3,200+ | **IMPROVED Jan 2026** - Added 513 intermediate/advanced drills |
| matching | 155 | Underutilized |

### Number Drill Expansion (January 2026)

**513 new number drills added** across all 9 languages at intermediate levels:

| Level | Content | Drills per Language |
|-------|---------|---------------------|
| Intermediate Low | Numbers 21-99, hundreds, years (1990-2025), thousands | 31 |
| Intermediate Mid | Large numbers (10K-2.5M), prices with decimals, percentages, ordinals | 26 |

**Languages covered:** English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Mandarin

**New drill categories:**
- **Tens & Combinations**: 21-99 with proper pronunciation patterns
- **Hundreds**: 100-750 in spoken form
- **Years**: 1990, 1999, 2000, 2010, 2024, 2025
- **Thousands**: 1,000 to 5,000+
- **Large Numbers**: 10,000 to 2.5 million
- **Prices**: Currency-appropriate decimals ($9.99, €15.50, ¥999, ₩1500)
- **Percentages**: 10% to 100%
- **Ordinals**: 1st through 100th in each language

### Remaining Priority Improvements

#### ~~Priority 1: Level Up Numbers~~ ✅ COMPLETED (Jan 2026)
~~**Problem**: 99%+ of number drills are at novice_low only.~~

**Solution implemented**: Added 513 intermediate number drills covering years, prices, percentages, and ordinals across all 9 languages. See "Number Drill Expansion" section above.

#### Priority 2: Asian Language Production
**Problem**: Japanese, Korean, and Mandarin have only 18-40 `translate_speak` drills vs ~3,600 for European languages.

**Solution**: Create production drill template for Asian languages using:
- Romaji (Japanese)
- Hangeul romanization (Korean)
- Pinyin (Mandarin)

These serve as "training wheels" in visual prompts, critical for functional fluency. Without this, students become "passive listeners" who can understand but not produce.

#### Priority 3: Prosody/Shadowing Drills
**Problem**: Advanced `listen_repeat` drills focus on length, not native-like flow.

**Solution**: Introduce "Shadowing" focus areas:
- Sentence stress patterns
- Intonation curves
- Emotional register (doubt, excitement, formality)
- Connected speech (elision, liaison)

### Secondary Improvements

- **Grammar Drill Balance**: Bring `translate_speak` back into Advanced levels with "Sentence Transformation" focus (active to passive voice, formal/informal register shifts)
- **Matching Drills**: Add a few per lesson as warm-up/cool-down to introduce new vocabulary before production drills

### Daniela's Vision

> "We have a 'Wide' curriculum (lots of Novice audio), but we need a 'Deep' one."

The Interactive Textbook should eventually surface this depth progression, showing students not just what vocabulary they'll learn, but how their skills will develop from comprehension through production to native-like fluency.

---

## Audio Preview (Completed January 2026)

Students can now play pronunciation audio directly from the textbook:

- **Drill audio buttons**: Each drill preview card has a play button
- **On-demand TTS**: Audio generated via Google Cloud Text-to-Speech
- **API endpoints**: `/api/drill-audio/:id` and `/api/tts/pronunciation`
- **Components**: `AudioPlayButton` and `TextAudioPlayButton`

See `docs/audio-system.md` for complete audio architecture documentation.

---

## Future Enhancements

1. **Progress Overlays**: Show student completion status on each lesson
2. **Drill Type Filters**: Let students focus on specific practice types
3. **Can-Do Statement Mapping**: Connect lessons to ACTFL competencies visually
4. ~~**Audio Preview**: Play sample drill audio directly from the textbook~~ ✅ COMPLETED
5. **Depth Indicators**: Show when a lesson includes advanced prosody or production focus
6. **Speed Control**: Add slow/normal/fast playback options to audio players
