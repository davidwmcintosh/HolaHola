# Interactive Textbook - Functional Specification

**Created:** January 9, 2026  
**Status:** Planning / Initial Development  
**Owner:** David & Team HolaHola

---

## Executive Summary

Transform the current syllabus system into an **Interactive Textbook** - a visually engaging, scroll-through learning experience where students can read, practice, and review all in one place. Daniela remains the star of the show; the textbook serves as an organized, reference-friendly companion to voice sessions.

---

## Vision

### The Problem
- Sidebar navigation is scattered (Practice with assistant, etc.)
- Syllabus feels like a static checklist rather than engaging content
- Practice Explorer is disconnected from curriculum
- Hard to find and review specific topics quickly
- Learning feels slow and rigid

### The Solution
An **Interactive Textbook** that:
- Consolidates everything into the Language Hub
- Presents chapters with rich visual content (images, diagrams, scenarios)
- Embeds drills inline as you learn
- Groups related items for natural rhythm ("uno, dos, tres... cuatro, cinco, seis...")
- Provides chapter recaps for reinforcement
- Flows progress into the mind map visualization
- Shares visual assets with Daniela's voice sessions

---

## Core Principles

1. **Daniela is the star** - The textbook supports and enhances voice sessions, not replaces them
2. **Visual and engaging** - Images, fun layouts, and natural groupings
3. **Rhythm over rigidity** - Group items naturally (numbers in batches, days of week together)
4. **One place for everything** - Easy to find, easy to review
5. **Fully replayable** - Students can revisit any section for more repetitions
6. **Connected context** - Visual assets used in textbook carry over to voice sessions

---

## Information Architecture

### Language Hub (Restructured)

```
Language Hub
├── Meet Your Tutors
│   ├── Main Tutors (Daniela, Agustin, etc.)
│   └── Assistant Tutors (Aris, etc.) - moved from sidebar
│
├── Interactive Textbook (replaces Syllabus link)
│   ├── Chapter 1: Greetings & Introductions
│   │   ├── Rich content sections with images
│   │   ├── Embedded mini-drills
│   │   └── Chapter Recap & Practice
│   ├── Chapter 2: Numbers & Counting
│   │   ├── Visual number groupings
│   │   ├── Rhythm Drill (uno-diez as a flow)
│   │   └── Chapter Recap & Practice
│   ├── Chapter 3: Days, Months & Time
│   └── ... (more chapters)
│
├── Review Hub
│   ├── Flashcards
│   └── Recent Conversations
│
└── Mind Map (shows learning journey across chapters)
```

---

## Feature Specifications

### 1. Interactive Textbook Page

**Entry Point:** Language Hub card → "Interactive Textbook"

**Chapter Navigation:**
- Visual chapter list with progress indicators
- Each chapter shows: title, description, completion %, visual preview
- Click to expand into chapter view

**Chapter View:**
- Scrollable sections with rich content
- Section types:
  - **Content Section**: Text + images explaining concepts
  - **Vocabulary Section**: Word cards with images
  - **Drill Section**: Inline practice exercises
  - **Rhythm Drill Section**: Grouped items for batch practice
  - **Recap Section**: End-of-chapter review

### 2. Rich Section Renderer

**Content Blocks:**
- Paragraphs with explanatory text
- Images (stock photos, AI-generated contextual images)
- Vocabulary cards with translations and audio
- Cultural notes and tips
- Example dialogues

**Visual Style:**
- Clean, magazine-like layout
- Generous whitespace
- Large, high-quality images
- Mobile-friendly scrolling

### 3. Rhythm Drill Component

**Concept:** Instead of drilling one item at a time, group related items for natural flow.

**Example - Numbers 1-10:**
```
┌─────────────────────────────────────────┐
│  🎵 Say them with rhythm!               │
│                                         │
│  uno, dos, tres...                      │
│  cuatro, cinco, seis...                 │
│  siete, ocho...                         │
│  ¡nueve y DIEZ!                         │
│                                         │
│  [🎤 Record All]                        │
└─────────────────────────────────────────┘
```

**Flow:**
1. Display items in natural rhythmic grouping
2. Student records entire sequence (or clicks play to hear native)
3. Azure pronunciation assessment analyzes ALL items at once
4. System identifies which specific items need work
5. "Great flow! Let's practice 'siete' - the 's' was a bit soft"

**Applicable to:**
- Numbers (1-10, 11-20, by tens, etc.)
- Days of the week
- Months of the year
- Alphabet chunks
- Colors by category
- Common phrase sets

### 4. Visual Assets Library

**Purpose:** Reusable images that appear in:
- Textbook sections
- Daniela's whiteboard during voice sessions
- Flashcard decks

**Example Assets:**
- Restaurant menu (for ordering practice)
- Market scene (for shopping vocabulary)
- Family tree (for family members)
- City map (for directions)
- Kitchen scene (for food and cooking)

**Storage:**
- Curriculum assets table linking images to lessons
- Both stock images and AI-generated contextual images
- Alt text for accessibility

### 5. Chapter Recap & Practice

**Location:** End of each chapter

**Components:**
- Summary of key vocabulary/phrases
- Quick review quiz
- "Practice with Daniela" button (launches voice session on this topic)
- "Review Flashcards" button (filtered to chapter vocabulary)
- Progress achievement (badge/milestone)

### 6. Mind Map Integration

**Current:** Mind map shows learning concepts and connections

**Enhanced:**
- Chapter completion reflected in mind map nodes
- Visual journey from chapter to chapter
- "Master paths" showing strong areas
- Areas needing attention highlighted

### 7. Progress Tracking

**Per Section:**
- Viewed / Not viewed
- Drills completed
- Score/performance on rhythm drills

**Per Chapter:**
- Overall completion percentage
- Time spent
- Strengths and areas for improvement

**Synced to:**
- User progress table
- Mind map visualization
- Daniela's context (she knows where you are in the textbook)

---

## User Experience Flows

### Flow 1: First-Time Textbook User

1. User clicks "Interactive Textbook" from Language Hub
2. Welcome screen explains the textbook concept
3. First chapter is highlighted as "Start Here"
4. User scrolls through engaging content
5. Encounters first embedded drill, completes it
6. Reaches chapter recap, celebrates progress
7. Mind map updates to show first node completed

### Flow 2: Returning to Review

1. User needs to remember how to order food
2. Opens Interactive Textbook → Chapter: At the Restaurant
3. Quickly scans visual menu section
4. Practices key phrases with rhythm drill
5. Feels confident, launches voice session with Daniela
6. Daniela references the same menu they just reviewed

### Flow 3: Numbers Rhythm Drill

1. User reaches Numbers chapter
2. Sees rhythm grouping: "uno, dos, tres..."
3. Clicks "Record All"
4. Says entire sequence with natural rhythm
5. System analyzes: "siete" and "nueve" need work
6. Targeted feedback with correct pronunciation
7. User repeats just those two, or tries full sequence again

---

## Technical Architecture

### Data Model Extensions

```typescript
// New fields for curriculum_lessons
lessonContent: jsonb // Rich content blocks
lessonAssets: text[] // Image URLs/asset IDs
drillGroupings: jsonb // Rhythm drill configurations

// New table: textbook_section_progress
id: uuid
userId: text
lessonId: uuid
sectionType: text // 'content' | 'drill' | 'rhythm' | 'recap'
completed: boolean
score: number // For drills
createdAt: timestamp
updatedAt: timestamp

// New table: curriculum_assets
id: uuid
assetType: text // 'image' | 'audio' | 'video'
assetUrl: text
altText: text
tags: text[]
languageCode: text
lessonIds: uuid[] // Which lessons use this asset
```

### Component Structure

```
client/src/pages/
├── interactive-textbook.tsx (main page)

client/src/components/textbook/
├── ChapterList.tsx
├── ChapterView.tsx
├── SectionRenderer.tsx
├── ContentSection.tsx
├── VocabularySection.tsx
├── DrillSection.tsx
├── RhythmDrill.tsx
├── ChapterRecap.tsx
└── TextbookProgress.tsx
```

### API Endpoints

```
GET /api/textbook/chapters/:language
GET /api/textbook/chapter/:chapterId
GET /api/textbook/section/:sectionId
POST /api/textbook/progress (update section progress)
GET /api/textbook/assets/:lessonId
POST /api/pronunciation/batch-analyze (for rhythm drills)
```

---

## Phased Implementation

### Phase 1: Foundation ✅ COMPLETE
- [x] Create this functional spec document
- [x] Restructure Language Hub navigation
- [x] Build Interactive Textbook page skeleton
- [x] Connect to existing syllabus/curriculum data (8 chapters from Spanish 1)

### Phase 2: Content Experience ✅ COMPLETE
- [x] Rich section renderer component (TextbookSectionRenderer)
- [x] Content and vocabulary section types
- [x] Basic drill embedding
- [x] Chapter navigation and progress

### Phase 3: Rhythm Drills ✅ COMPONENT BUILT
- [x] Rhythm drill component (RhythmDrill)
- [x] Batch pronunciation analysis wired
- [ ] Targeted feedback for specific items
- [ ] Configuration system for drill groupings

---

## Remaining Work (Consolidated Next Steps)

### 1. Chapter Recap & Practice
- Add end-of-chapter summary sections
- "Practice with Daniela" button (launches voice session on topic)
- "Review Flashcards" button (filtered to chapter vocabulary)
- Achievement badges for chapter completion

### 2. Visual Assets Library
- Asset storage table (curriculum_assets)
- Image integration in content sections
- Stock photos and AI-generated contextual images
- Menu, scene, and scenario assets for realistic practice

### 3. Whiteboard Connection
- Connect textbook visual assets to Daniela's voice sessions
- She can reference images you just studied in the textbook
- Shared context between reading and speaking practice

### 4. Mind Map Integration
- Chapter nodes visible in mind map visualization
- Progress reflected in learning journey
- Visual paths showing completed vs. upcoming content

### 5. Progress Tracking & Replay
- Remember where you left off in each chapter
- Section completion status (viewed, drills completed)
- Replay any section for more repetitions
- Score tracking on rhythm drills

### 6. Mobile Optimization
- Polish scrolling experience for phones
- Touch-friendly drill interactions
- Responsive layouts for all screen sizes

### 7. Content Authoring
- Rich content for all chapters (not just skeleton)
- Vocabulary cards with images and audio
- Cultural notes and example dialogues
- Teacher customization options

---

## Success Metrics

- **Engagement:** Time spent in textbook vs. previous syllabus
- **Completion:** Chapter completion rates
- **Rhythm Drill Usage:** Batch drills completed, improvement on flagged items
- **Cross-Feature Flow:** Users moving from textbook → voice session
- **Review Behavior:** Return visits to completed chapters

---

## Open Questions

1. **Content Authoring:** How do teachers create/customize textbook content for their classes?
2. **Offline Access:** Should chapters be downloadable for offline study?
3. **Social Features:** Should students see classmates' progress in the textbook?
4. **Gamification:** Badges, streaks, or achievements for textbook completion?

---

## Appendix: Example Chapter Structure

### Chapter 2: Numbers & Counting

**Section 2.1: Numbers 1-10**
- Visual: Colorful number cards with Spanish/English
- Audio: Native speaker pronunciation
- Cultural note: How Spanish speakers count on fingers

**Section 2.2: Rhythm Practice**
- Rhythm drill: "uno, dos, tres... cuatro, cinco, seis..."
- Batch recording and analysis
- Targeted feedback

**Section 2.3: Numbers 11-20**
- Visual: Pattern explanation (once = 11, doce = 12...)
- Connection: How teens are formed from 1-10

**Section 2.4: Numbers by Tens**
- Visual: 10, 20, 30... up to 100
- Rhythm drill: "diez, veinte, treinta..."

**Section 2.5: Putting It Together**
- Real-world scenarios: prices, phone numbers, ages
- Interactive: "What's your phone number?"

**Chapter Recap**
- Key vocabulary summary
- Quick quiz: Match numbers to Spanish
- "Practice with Daniela" button
- Achievement: "Number Master" badge

---

*This document will be updated as the feature evolves. Last updated: January 9, 2026 (Progress updated)*
