# Drill Lessons - Rote Practice for Language Mastery

Drill lessons provide focused, repetitive practice for foundational language skills like numbers, common phrases, and vocabulary. Unlike conversation-based lessons, drills emphasize memorization and instant recall through audio-based exercises.

## Overview

Drill lessons are designed for content that benefits from rote repetition:
- **Numbers**: Counting, phone numbers, prices, dates
- **Common phrases**: Greetings, polite expressions, survival phrases
- **Vocabulary sets**: Colors, days of the week, months, family members
- **Pronunciation practice**: Difficult sounds, minimal pairs

## Drill Types

### Listen & Repeat
Students listen to audio pronunciation and practice speaking aloud. After practicing, they self-evaluate their pronunciation:
- **Got It** - Confident in pronunciation (records mastery)
- **Needs Work** - Needs more practice (schedules for review)

This self-evaluation approach encourages honest assessment and builds metacognitive skills.

### Number Dictation
Students hear a number spoken in the target language and type what they hear. The system validates answers and supports acceptable alternatives (e.g., "5" or "five" or "cinco").

### Additional Drill Types (Coming Soon)
- **Translate & Speak**: See English text, speak the translation
- **Matching**: Match audio to written text
- **Fill in the Blank**: Complete sentences with missing words

## For Teachers

### Creating Drill Lessons

1. Navigate to **My Classes** in the sidebar
2. Select a class and open the **Syllabus Builder**
3. Click **Add Lesson** within any unit
4. Select **Drill** as the lesson type
5. Name your drill (e.g., "Numbers 1-20")

### Adding Drill Items

Each drill lesson contains multiple items. For each item, specify:

| Field | Description |
|-------|-------------|
| **Prompt** | What students see on screen (e.g., "cinco") |
| **Target Text** | The correct answer for validation |
| **Item Type** | listen_repeat, number_dictation, etc. |
| **Acceptable Alternatives** | Optional variations that count as correct |
| **Hints** | Optional clues to help struggling students |

### Best Practices

- **Keep drills focused**: 10-20 items per drill works well
- **Progress from simple to complex**: Start with easier items
- **Use consistent patterns**: Group similar content together
- **Provide hints**: Help students without giving away answers

## For Students

### Practicing Drills

1. Navigate to your enrolled class
2. Select a drill lesson from the syllabus
3. Click **Listen** to hear the audio
4. Practice speaking (for listen-repeat) or type your answer
5. Self-evaluate or check your answer
6. Continue to the next item

### Progress Tracking

Your drill progress is tracked automatically:
- **Mastered items**: Items you've answered correctly
- **Completion percentage**: How much of the drill you've completed
- **Review scheduling**: Incorrect items are scheduled for future review

### Tips for Success

- **Listen multiple times**: Replay audio as needed before answering
- **Be honest in self-evaluation**: Mark "Needs Work" if unsure
- **Practice regularly**: Short, frequent sessions are more effective than long, infrequent ones
- **Use hints sparingly**: Try to recall before using hints

## Technical Architecture

### Audio Generation

Drill audio uses Google Cloud Text-to-Speech with Neural2 voices for natural pronunciation. Audio is cached after first generation for efficient playback.

### Data Model

```
curriculumDrillItems
├── id (UUID)
├── lessonId (references curriculum lesson)
├── itemType (listen_repeat, number_dictation, etc.)
├── prompt (display text)
├── targetText (correct answer)
├── acceptableAlternatives (string array)
├── hints (string array)
├── audioUrl (cached TTS audio)
└── orderIndex (display order)

userDrillProgress
├── id (UUID)
├── userId
├── drillItemId
├── attemptCount
├── correctCount
├── lastAttemptAt
├── masteryLevel (0.0 - 1.0)
└── nextReviewAt (spaced repetition)
```

### Key Files

| File | Purpose |
|------|---------|
| `client/src/components/DrillLesson.tsx` | Main drill UI component |
| `server/services/drill-audio-service.ts` | Google TTS integration |
| `server/routes.ts` | API endpoints for drill data |
| `shared/schema.ts` | Database schema definitions |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/drill-progress/:lessonId` | GET | Get drill items with progress |
| `/api/drill-progress/attempt` | POST | Record an attempt |
| `/api/drill-audio/:itemId` | GET | Generate/retrieve audio |

## Future Enhancements

- **Voice recognition**: Automatic pronunciation scoring using STT
- **Adaptive difficulty**: Adjust item selection based on performance
- **Leaderboards**: Class-wide drill competitions
- **Offline support**: Download drills for practice without internet
