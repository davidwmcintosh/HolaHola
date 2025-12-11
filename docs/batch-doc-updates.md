# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

---

## Pending Updates

### Session 20g: Procedural Memory System - Daniela's Brain (Dec 11, 2025)

#### Overview
Implemented a Procedural Memory system that stores 120+ pieces of "how-to" knowledge in Daniela's brain through 4 database tables. This enables a shift from scripted prompts to emergent, context-aware tutoring behavior.

#### Architectural Shift
**Before**: Giant system prompt tells Daniela exactly what to do in every situation
**After**: Minimal prompt defines WHO she is → Compass provides situation → Neural Network recalls relevant knowledge → Daniela acts

#### New Database Tables (4 total)

| Table | Count | Purpose |
|-------|-------|---------|
| `tool_knowledge` | 22 | HOW to use each whiteboard command and drill type |
| `tutor_procedures` | 44 | HOW to handle teaching situations (greetings, corrections, scaffolding) |
| `teaching_principles` | 35 | WHY she teaches the way she does (core pedagogical beliefs) |
| `situational_patterns` | 19 | WHEN to activate procedures based on Compass state |

#### Knowledge Categories Seeded

**Tool Knowledge (22 entries)**
- Whiteboard commands: WRITE, PHONETIC, COMPARE, IMAGE, CONTEXT, GRAMMAR_TABLE, STROKE, TONE, WORD_MAP, CULTURE, READING, SCENARIO, SUMMARY, PLAY
- Drill types: repeat, translate, match, fill_blank, sentence_order
- Interactions: TEXT_INPUT, SHOW, HIDE

**Tutor Procedures (44 entries)**
- Session phases: greeting, first_session, closing, time_warning
- Teaching: new_vocabulary, grammar_explanation, cultural_moment
- Error handling: pronunciation_error, grammar_error, vocabulary_error, meaning_error, repeated_error
- Scaffolding: graduated_hints, sentence_building, task_decomposition
- Student states: student_struggling, student_excelling, student_distracted
- Voice-specific: audio_unclear, speed_request, slow_pronunciation
- Energy management: student_tired, student_hyperactive
- Emotional support: student_apologizing, student_comparing, breakthrough_moment
- Language-specific: tonal_language, character_language, gendered_language, verb_heavy_language

**Teaching Principles (35 entries)**
- Pedagogy: learning by doing, i+1 input, errors as data, spaced repetition, context
- Relationship: warmth first, patient friend, meet them where they are
- Pacing: variety, end on high note, strategic silence
- Correction: priority by type, sandwich technique, natural recast
- Encouragement: celebrate effort, specific praise, normalize struggle
- Psychology: affective filter, autonomy, visible progress, curiosity
- Practical: 80/20 rule, contextualize vocabulary, reception before production, interleaving
- Meta-learning: teach strategies, make patterns explicit
- Communication: meaning over accuracy, maximize target language
- Personalization: know their motivation, use their name
- Voice-specific: speak slower, model before correcting, strategic silence

**Situational Patterns (19 entries)**
- Time-based: session_start, time_running_low, final_minute, behind_schedule, ahead_of_schedule
- Activity-based: after_drill_success, after_drill_struggle, multiple_tools_used
- Student states: long_silence, repeated_error, student_frustrated, student_on_a_roll
- Content: new_vocabulary_intro, grammar_point, cultural_moment
- Context: first_session, returning_after_break, student_asked_question, pronunciation_focus, grammar_confusion

#### Retrieval Service (`server/services/procedural-memory-retrieval.ts`)

```typescript
// Main retrieval function
getProceduralKnowledge(compassContext, sessionContext) → {
  procedures: TutorProcedure[],
  suggestedTools: ToolKnowledge[],
  principles: TeachingPrinciple[],
  activePatterns: SituationalPattern[],
  guidance: string
}

// Helper functions
getAllToolKnowledge() → ToolKnowledge[]
getCoreTeachingPrinciples() → TeachingPrinciple[]

// Formatting for prompts
formatToolKnowledgeForPrompt(tools) → string
formatPrinciplesForPrompt(principles) → string
formatSituationalGuidance(knowledge) → string
```

#### Two-Way Sync Integration

Added sync fields to all 4 tables:
```typescript
syncStatus: varchar("sync_status").default('local'),
originId: varchar("origin_id"),
originEnvironment: varchar("origin_environment"),
```

New sync functions in `neural-network-sync.ts`:
- `exportProceduralMemory()` - Export all approved items
- `importToolKnowledge()` - Dedupe by toolName
- `importTutorProcedure()` - Dedupe by (category, trigger, title)
- `importTeachingPrinciple()` - Dedupe by (category, principle)
- `importSituationalPattern()` - Dedupe by patternName
- `syncProceduralMemory()` - Full sync of all 4 tables
- `getPendingProceduralMemory()` - Get items with 'local' status
- `approveProceduralMemoryItem()` - Mark item as 'approved'
- `autoApproveProceduralMemory()` - Batch approve all local items
- `getCompleteSyncStatus()` - Combined status of all neural network + procedural memory

#### Files Created/Modified
- `shared/schema.ts` - Added 4 procedural memory tables with sync fields
- `server/seed-procedural-memory.ts` - Comprehensive seed script (120 entries)
- `server/services/procedural-memory-retrieval.ts` - Context-aware retrieval service
- `server/services/neural-network-sync.ts` - Added 10 new sync methods for procedural memory
- `replit.md` - Updated system design documentation

#### Next Steps (Integration)
- Wire retrieval service into `server/system-prompt.ts` to replace static tool documentation
- Call `getProceduralKnowledge()` with Compass context before each response
- Dynamically inject only relevant procedures/principles into prompt

---

### Session 20f: Neural Network Expansion Two-Way Sync (Dec 11, 2025)

#### Problem
The 5 Neural Network Expansion tables (languageIdioms, culturalNuances, learnerErrorPatterns, dialectVariations, linguisticBridges) were only seeded locally. They had no sync fields or export/import functions, meaning language-specific pedagogical knowledge couldn't be shared between dev/prod environments.

#### Solution: Two-Way Sync Infrastructure

**1. Added Sync Fields to All 5 Tables** (schema.ts)
```typescript
// Two-way sync fields
syncStatus: varchar("sync_status").default("local"), // local, pending_review, approved, synced, rejected
originId: varchar("origin_id"), // UUID from source environment (for deduplication)
originEnvironment: varchar("origin_environment"), // development, production
```

Each table now has an `idx_*_origin` index for efficient deduplication lookups.

**2. Export/Import Functions** (neural-network-sync.ts)

- `exportNeuralNetworkExpansion()` - Returns all approved items from all 5 tables
- `importLanguageIdiom()` - Deduplicates by (language, idiom)
- `importCulturalNuance()` - Deduplicates by (language, category, situation)
- `importLearnerErrorPattern()` - Deduplicates by (targetLanguage, sourceLanguage, specificError)
- `importDialectVariation()` - Deduplicates by (language, region, standardForm)
- `importLinguisticBridge()` - Deduplicates by (sourceLanguage, targetLanguage, sourceWord, targetWord)
- `syncNeuralNetworkExpansion()` - Full sync with counts tracking
- `getPendingNeuralNetworkExpansion()` - Get items with 'local' status
- `approveNeuralNetworkExpansionItem()` - Mark items as 'approved' for sync

**3. Nightly Scheduler Integration** (sync-scheduler.ts)

The nightly sync (3 AM MST / 10 AM UTC) now includes:
- Best practices sync (existing)
- Neural Network Expansion export + status logging
- Pending items count reporting

Console output during sync:
```
[SYNC-SCHEDULER] Neural Network Expansion status:
  - Exported 8 idioms, 6 nuances
  - Exported 6 error patterns, 5 dialects
  - Exported 7 linguistic bridges
  - Pending (local): 0 items
```

**4. Deduplication Strategy**

Each table has a unique key for matching:
| Table | Unique Key |
|-------|-----------|
| languageIdioms | (language, idiom) |
| culturalNuances | (language, category, situation) |
| learnerErrorPatterns | (targetLanguage, sourceLanguage, specificError) |
| dialectVariations | (language, region, standardForm) |
| linguisticBridges | (sourceLanguage, targetLanguage, sourceWord, targetWord) |

Import checks both `originId` and unique key to avoid duplicates.

#### Files Modified
- `shared/schema.ts` - Added syncStatus, originId, originEnvironment to all 5 tables + origin indexes
- `server/services/neural-network-sync.ts` - Added 10 new methods for expansion sync
- `server/services/sync-scheduler.ts` - Integrated expansion sync into nightly scheduler

---

### Session 20e: Founder Mode Meta-Mode Awareness (Dec 11, 2025)

#### Problem
In Founder Mode, Daniela was deflecting to tutor mode even when founders asked for product feedback. When a developer said "let's talk about HolaHola" or "founder mode", Daniela would still try to teach Spanish instead of engaging in product discussion.

#### Solution: Session Context Awareness
Implemented Daniela's own suggestions for meta-mode detection:

**1. SESSION_CONTEXT Block** (system-prompt.ts)
Added explicit context flags that Daniela can reference:
```typescript
[SESSION_CONTEXT]
[USER_ROLE: Founder]
[SESSION_INTENT: product_discussion]

⚠️ CRITICAL: Check SESSION_INTENT before responding
- LANGUAGE_LEARNING → Full tutor mode, teach the target language
- PRODUCT_DISCUSSION → Colleague mode, discuss HolaHola openly
- TESTING → Demo features, run drills, test tools
- HYBRID → Flexible, follow the founder's lead
```

**2. Meta-Mode Phrase Detection** (unified-ws-handler.ts)
Scans recent conversation history for trigger phrases:

Meta-mode triggers (→ PRODUCT_DISCUSSION):
- "founder mode", "let's talk about holahola", "product feedback"
- "claude", "the designers", "neural network", "system prompt"
- "what do you need", "how can we improve", "suggestions for"

Tutor-mode triggers (→ LANGUAGE_LEARNING):
- "teach me", "practice spanish", "let's learn", "drill"
- "vocabulary", "conjugation", "translate this"

**3. User Role Elevation**
- Maps user.role to UserRole type (student/teacher/developer/admin)
- Elevates developer/admin to "founder" when in Founder Mode
- Non-founder sessions remain untouched

#### Result
- Daniela now recognizes when founders want product discussions vs language lessons
- SESSION_INTENT flag tells her which mode to prioritize
- Defaults to HYBRID when signals are mixed (safe fallback)
- Meta-mode triggers can be expanded as usage evolves

#### Files Modified
- `server/system-prompt.ts` - Added SESSION_CONTEXT block with USER_ROLE/SESSION_INTENT, exported UserRole and SessionIntent types
- `server/unified-ws-handler.ts` - Added session intent detection logic and passed new parameters to createSystemPrompt

---

### Session 20d: Cross-Language Handoff Fixes (Dec 11, 2025)

#### Problem 1: Pending Intro Lost on Language Switch
Cross-language handoffs (e.g., Daniela → Juliette) store a pending introduction for the new tutor to deliver. But the pending intro was stored by `conversationId`, and cross-language switches create a **new conversation**. The new session couldn't find the pending intro because it was looking up by the wrong conversation ID.

#### Solution 1: userId-Based Lookup
Changed pending handoff intro storage from `conversationId` to `userId`:

```typescript
// Before (broken for cross-language)
pendingHandoffIntros.set(conversationId, { tutorName, tutorGender, timestamp });
const pending = pendingHandoffIntros.get(conversationId);

// After (works for cross-language)
pendingHandoffIntros.set(userId, { tutorName, tutorGender, timestamp });
const pending = pendingHandoffIntros.get(userId);
```

This ensures the pending intro persists even when the client creates a new conversation for the new language.

#### Problem 2: Tutor Not Including Language Parameter
When Juliette (French) tried to send back to Daniela (Spanish), she used `[SWITCH_TUTOR target="female"]` without `language="spanish"`. The system interpreted this as a same-language switch and looped back to Juliette.

#### Solution 2: Explicit Cross-Language Instructions
Updated `buildTutorDirectorySection()` in system prompt to:

1. **Show current language**: "You are currently teaching: FRENCH"
2. **Add explicit warning**: "⚠️ CROSS-LANGUAGE RULE: If the target tutor teaches a DIFFERENT language than yours, you MUST include language="..." or the switch will FAIL!"
3. **Provide cross-language examples** with actual tutor names and languages:
   ```
   EXAMPLES:
     • To switch to Fynn (french): [SWITCH_TUTOR target="male"]
     • To switch to Juliette (french): [SWITCH_TUTOR target="female"]
     • To switch to Daniela (spanish): [SWITCH_TUTOR target="female" language="spanish"]
   ```

#### Result
- Cross-language handoffs now work reliably in both directions
- Pending intros survive conversation resets during language switches
- Tutors correctly include language parameter when switching to colleagues in other languages
- Same-language handoffs continue to work (no language parameter needed)

#### Files Modified
- `server/unified-ws-handler.ts` - Changed pending intro storage from conversationId to userId
- `server/system-prompt.ts` - Added current language display, cross-language warning, and dynamic examples

---

### Session 20c: Founder Mode Dual-Role Capability (Dec 11, 2025)

#### Problem
In Founder Mode, Daniela was stripped of all teaching tools. She could discuss HolaHola as a colleague but couldn't demonstrate whiteboard tools, run drills, or execute tutor switches when testing. This prevented effective role-playing and feature testing during founder conversations.

#### Solution
Restructured Founder Mode to give Daniela **dual-role capability**:

1. **COLLEAGUE/ADMINISTRATOR** - When discussing HolaHola, giving feedback, chatting about product ideas
2. **FULL TUTOR** - When testing features, role-playing lessons, or demonstrating tools

#### Implementation
Added comprehensive teaching tools section to Founder Mode prompt (`server/system-prompt.ts`):

```typescript
const founderTeachingTools = `
═══════════════════════════════════════════════════════════════════
🎓 DUAL-ROLE: COLLEAGUE + FULL TUTOR CAPABILITIES
═══════════════════════════════════════════════════════════════════

You have TWO ROLES in Founder Mode:

1. COLLEAGUE/ADMINISTRATOR - When discussing HolaHola, giving feedback, chatting
2. FULL TUTOR - When ${name} wants to test features, role-play lessons, or try tools

You can seamlessly switch between these roles based on context. When ${name} asks to
"test something", "try a drill", "role-play as a student", or "show me how X works",
shift into full tutor mode with ALL your teaching capabilities.
`;
```

#### Full Toolkit Now Available in Founder Mode
- **Whiteboard essentials**: WRITE, PHONETIC, COMPARE, CLEAR, HOLD
- **Vocabulary tools**: WORD_MAP, IMAGE, GRAMMAR_TABLE, CONTEXT
- **Interactive drills**: repeat, match, fill_blank, sentence_order, TEXT_INPUT
- **Subtitle controls**: SUBTITLE, SHOW, HIDE
- **Asian language tools**: READING, STROKE
- **Session tools**: SCENARIO, CULTURE, SUMMARY, PLAY
- **Tutor switching**: SWITCH_TUTOR with full directory

#### Result
Daniela can now:
- Chat as a colleague about product ideas, feedback, improvements
- Seamlessly shift into tutor mode when asked to test features
- Execute tutor switches when asked ("let me talk to Agustin")
- Run drills, demonstrate whiteboard tools, role-play lessons
- Maintain full administrative awareness while using teaching tools

#### Files Modified
- `server/system-prompt.ts` - Added `founderTeachingTools` section to Founder Mode prompt, restructured return to include full toolkit

---

### Session 20b: Enhanced Greeting Context for Daniela (Dec 11, 2025)

#### Problem
Daniela wasn't receiving enough context when "answering the call" to make a proper first statement. She had basic info (name, ACTFL level, language) but was missing critical context about:
1. What the student chose to work on today (conversation topic/title)
2. What happened in their last session together (Compass lastSessionSummary)
3. The student's learning goals

#### Solution
Enhanced the greeting context pipeline to pass additional information:

**1. Extended StreamingSession interface** (`streaming-voice-orchestrator.ts`):
```typescript
// Additional context for personalized greetings
conversationTopic?: string;       // What student chose to work on
conversationTitle?: string;       // Thread name for context
lastSessionSummary?: string;      // What happened last session
studentGoals?: string;            // Student's learning goals
```

**2. Updated createSession()** to accept and store this context:
```typescript
additionalContext?: {
  conversationTopic?: string;
  conversationTitle?: string;
  lastSessionSummary?: string;
  studentGoals?: string;
}
```

**3. Updated unified-ws-handler.ts** to pass context when creating session:
```typescript
const additionalGreetingContext = {
  conversationTopic: conversation.topic || undefined,
  conversationTitle: conversation.title || undefined,
  lastSessionSummary: compassContext?.lastSessionSummary || undefined,
  studentGoals: compassContext?.studentGoals || undefined,
};
```

**4. Enhanced buildGreetingPrompt()** to include new sections:
- `*** TODAY'S FOCUS (student's choice) ***` - The topic they selected
- `*** LAST SESSION MEMORY ***` - Summary from Compass
- `*** STUDENT'S GOALS ***` - Learning objectives

#### Result
Daniela now receives rich context for her opening statement:
- Can reference what the student chose to practice
- Can mention what they worked on last time
- Can acknowledge their learning goals
- Creates more natural, personalized greetings

#### Files Modified
- `server/services/streaming-voice-orchestrator.ts` - Extended session interface, createSession(), buildGreetingPrompt()
- `server/unified-ws-handler.ts` - Pass additional context to createSession()

---

### Session 20: Cross-Language Handoff White Screen Fix (Dec 11, 2025)

#### Problem
Cross-language tutor switches (e.g., Daniela → Sayuri) caused a white screen crash. The language context update triggered a conversation reset in `chat.tsx` which unmounted `StreamingVoiceChat` while a WebSocket session was still active.

#### Root Cause
The language-change `useEffect` in `chat.tsx` wasn't aware of in-progress handoffs. When `setLanguage()` was called from the handoff handler, it immediately triggered conversation reset, destroying the component mid-handoff.

#### Solution: Coordinated State Management

**1. Handoff State Tracking** (`chat.tsx`):
- `isLanguageHandoff` state flag prevents language-change effect from firing during handoff
- `handoffPriorLanguageRef` / `handoffTargetLanguageRef` track both languages for proper cleanup
- `previousLanguageRef` synced to prevent re-triggering after handoff completes

**2. Handoff Lifecycle Callbacks**:
- `onLanguageHandoff(tutorName, targetLanguage)` - Shows transition overlay, starts 10s safety timeout
- `onLanguageHandoffComplete()` - Resets conversation, clears overlay, releases locks

**3. Transition Overlay UI**:
- "Switching to [TutorName]..." overlay prevents jarring unmount during handoff
- Overlay shown immediately when server sends `tutor_handoff` message
- Cleared only after new connection is confirmed stable

**4. Safety Timeout (10 seconds)**:
- If handoff fails, fully resets state after 10s
- Clears overlay, releases session locks, resets conversation
- Syncs `previousLanguageRef` to target language to prevent stale state

**5. Disconnect/Error Handling** (`StreamingVoiceChat.tsx`):
- `isLanguageHandoffRef` reset on connection errors or disconnects during handoff
- Prevents premature `onLanguageHandoffComplete` calls from reconnect attempts
- Parent's safety timeout handles all failure cleanup

#### Handoff Flow (Success)
1. Server sends `tutor_handoff` with `targetLanguage` and `tutorName`
2. Client calls `onLanguageHandoff()` → shows overlay, stores prior/target languages
3. `setLanguage()` updates context (gated effect doesn't fire due to `isLanguageHandoff`)
4. Old WebSocket session disconnects
5. New session connects with new language/voice
6. `onLanguageHandoffComplete()` called → resets conversation, clears overlay

#### Handoff Flow (Timeout/Failure)
1. Server sends `tutor_handoff`, client starts handoff
2. Something fails (connection error, timeout, etc.)
3. 10s safety timeout fires
4. Resets all state: overlay, locks, refs
5. Resets conversation to ensure user gets fresh session in new language

#### Edge Cases Handled
- Partial handshake disconnects
- Connection errors during handoff
- User clicking elsewhere during switch
- Multiple rapid switch attempts

#### Files Modified
- `client/src/pages/chat.tsx` - Handoff state management, lifecycle callbacks
- `client/src/components/StreamingVoiceChat.tsx` - Handoff flag reset on disconnect/error

---

### Session 19i: Neural Network Expansion for Language-Specific Pedagogical Knowledge (Dec 10, 2025)

#### Overview
Implemented Daniela's Neural Network Expansion system - language-specific pedagogical knowledge that allows her to truly embody different language modalities beyond just voice/accent changes.

#### New Database Tables (5 total)
1. **languageIdioms** - Common expressions with meanings and cultural context
2. **culturalNuances** - Region-specific etiquette, formality levels, taboos
3. **learnerErrorPatterns** - Common mistakes by source language speakers
4. **dialectVariations** - Regional pronunciation/vocabulary differences
5. **linguisticBridges** - Cross-language connections (cognates, false friends)

#### Knowledge Retrieval Service (`server/services/neural-network-retrieval.ts`)
- Fetches random samples from each table (4 items per category)
- Formats knowledge into structured prompt sections
- Injects into Daniela's system prompt after founder memory context
- Handles language pair matching (e.g., English→Spanish error patterns)

#### Initial Data Seeded (Spanish)
- 8 idioms (e.g., "estar en las nubes", "costar un ojo de la cara")
- 6 cultural nuances (cheek kisses, punctuality, family formality)
- 6 learner error patterns (ser/estar, gender agreement, false friends)
- 5 dialect variations (Spain vs. Latin America differences)
- 7 English-Spanish linguistic bridges (cognates and false friends)

#### TONE Whiteboard Command (New)
For tonal language visualization (Mandarin, Vietnamese, Thai):
- **Syntax**: `[TONE]妈|mā|1|mother[/TONE]`
- **Format**: `word|pinyin|tones|meaning`
- **Visualization**: SVG pitch contours for tones 1-5
  - T1: High level (flat line)
  - T2: Rising curve
  - T3: Low dipping contour
  - T4: Straight falling
  - T5: Neutral (short mid-level)
- **Colors**: Red (T1), Green (T2), Blue (T3), Purple (T4), Gray (T5)

#### Prompt Section Format
```
### Your Pedagogical Knowledge for This Language
**Idioms You Know:**
- "estar en las nubes" = to be daydreaming (commonly used for distracted moments)

**Cultural Knowledge:**
- greetings/formality: Cheek kisses vary by region...

**Common Learner Struggles (english→spanish):**
- Ser/estar confusion: English has one "to be"... [Strategies: Use location vs. essence rule]

**Dialect Variations:**
- Spain: "vosotros" → "ustedes" (pronouns)

**Language Bridges (english→spanish):**
- COGNATE: "family" ↔ "familia" - Nearly identical in meaning and sound
- [FALSE FRIEND]: "embarazada" ↔ "embarrassed" - Means "pregnant" not embarrassed!
```

#### Files Created/Modified
- `shared/schema.ts` - Added 5 new tables with proper indexes
- `server/seed-neural-network.ts` - Initial Spanish data seed script
- `server/services/neural-network-retrieval.ts` - Context retrieval and formatting
- `server/unified-ws-handler.ts` - Integration point for voice sessions
- `server/index.ts` - Seed script execution on startup
- `shared/whiteboard-types.ts` - TONE type definitions and parsing
- `client/src/components/Whiteboard.tsx` - ToneItemDisplay component

#### Future Expansion
- Seed data for other 8 languages
- Non-Latin script support (Japanese kanji, Korean hangul, Mandarin hanzi)
- STROKE command already implemented for character stroke order visualization

---

### Session 19h: AI-Generated Session Summaries for Compass Memory (Dec 10, 2025)

#### Problem
Daniela's Compass was initialized but contained empty data - no session summaries were being captured. This meant she couldn't reference previous sessions when greeting returning students ("Last time we worked on...").

#### Solution
Implemented automatic session summary generation using Gemini:

1. **Summary Generation** (`session-compass-service.ts`):
   - New `generateSessionSummary(conversationId)` method
   - Uses Gemini 2.0 Flash to analyze the last 20 messages
   - Creates 2-3 sentence summaries capturing:
     - Topics/vocabulary practiced
     - Notable moments, struggles, or breakthroughs
     - Emotional tone of the session
     - Student interests or goals mentioned

2. **Automatic Capture** (`unified-ws-handler.ts`):
   - Summary generated before `endSession()` is called
   - Works for both explicit session end and disconnect scenarios
   - No manual input required from student or tutor

3. **Memory Retrieval** (already existed):
   - `buildCompassContext()` loads `lastSessionSummary` from previous session
   - `buildSystemPrompt()` displays it as "Last Session: {summary}"
   - First-time sessions show "First session together!"

#### Summary Prompt
```
Create a brief, personal summary (2-3 sentences) that captures:
- What topics or vocabulary were practiced
- Any notable moments, struggles, or breakthroughs
- The emotional tone of the session
- Any interests or goals the student mentioned

Write in second person as if reminding the tutor: "You worked on..." or "The student..."
Keep it warm and conversational, not clinical.
```

#### Result
Daniela can now greet returning students with context like:
> "Welcome back! Last time we worked on restaurant vocabulary and you were really getting the hang of ordering food. Ready to continue?"

#### Files Modified
- `server/services/session-compass-service.ts` - Added `generateSessionSummary()` method with Gemini integration
- `server/unified-ws-handler.ts` - Call summary generation before ending sessions (both end_session and disconnect handlers)

---

### Session 19g: Student Timezone for Time-Aware Greetings (Dec 10, 2025)

#### Problem
Daniela had no awareness of the student's local time, so she couldn't use appropriate day/night greetings (Buenos días vs Buenos noches, Bonjour vs Bonsoir). This was especially problematic for traveling students whose location might differ from their registered profile.

#### Solution
Implemented automatic timezone detection and sync:
1. Added `timezone` field to users table (IANA format, e.g., "America/Denver")
2. Browser detects timezone on page load via `Intl.DateTimeFormat().resolvedOptions().timeZone`
3. Auto-syncs to server if different from stored value (handles traveling)
4. Timezone passed to system prompt for time-aware context

#### Implementation

**Schema Change** (`shared/schema.ts`):
```typescript
timezone: varchar("timezone"), // IANA timezone (e.g., "America/Denver", "Asia/Tokyo")
```

**API Endpoint** (`server/routes.ts`):
```typescript
app.put('/api/user/timezone', isAuthenticated, async (req, res) => {
  const { timezone } = req.body;
  await storage.updateUserTimezone(userId, timezone);
  res.json({ success: true, timezone });
});
```

**Frontend Sync** (`client/src/hooks/useAuth.ts`):
- Detects browser timezone on page load
- Only syncs if different from stored value (avoids unnecessary API calls)
- Logs sync to console for debugging

**System Prompt Context** (`server/system-prompt.ts`):
```
STUDENT TIME CONTEXT:
  Timezone: America/Denver
  Local time: approximately evening (19:00)
  Use appropriate greetings (Buenos días/tardes/noches, Bonjour/Bonsoir, etc.)
```

#### Result
- Daniela now greets students appropriately for their local time
- Traveling students get correct greetings based on their current location
- Timezone syncs automatically on each visit without user action

#### Files Modified
- `shared/schema.ts` - Added timezone field to users table
- `server/storage.ts` - Added updateUserTimezone() method
- `server/routes.ts` - Added PUT /api/user/timezone endpoint
- `server/system-prompt.ts` - Added buildTimezoneContext() helper, integrated into prompts
- `server/unified-ws-handler.ts` - Pass user.timezone to createSystemPrompt()
- `client/src/hooks/useAuth.ts` - Added automatic timezone detection and sync

---

### Session 19f: Dynamic Tutor Directory for Handoffs (Dec 10, 2025)

#### Problem
When students asked to switch tutors or languages, Daniela didn't know the names of available colleagues. She would use incorrect syntax like `[SWITCH_TUTOR target="male|Augustine|french"]` or generic references instead of specific tutor names.

#### Solution
Implemented a dynamic tutor directory that:
1. Pulls from the `tutor_voices` database at session start
2. Groups tutors by language with their actual names
3. Marks the student's preferred tutor per language with ★
4. Excludes the current tutor from the handoff list
5. Injects into the system prompt's SWITCH_TUTOR section

#### Implementation

**New Type** (`server/system-prompt.ts`):
```typescript
export interface TutorDirectoryEntry {
  language: string;
  gender: 'male' | 'female';
  name: string;
  isCurrent: boolean;
  isPreferred: boolean;
}
```

**Helper Function** (`server/system-prompt.ts`):
```typescript
export function buildTutorDirectorySection(
  tutorDirectory: TutorDirectoryEntry[],
  currentTutorName: string,
  currentLanguage: string
): string
```

**Directory Built From Database** (`server/unified-ws-handler.ts`):
- Extracts tutor names from `voice_name` field (e.g., "Sayuri - Peppy Colleague" → "Sayuri")
- Stars tutors matching student's gender preference
- Filters out current tutor

#### Example Prompt Output
```
AVAILABLE TUTORS (colleagues you can hand off to):
  • Spanish: Agustin (male)
  • French: Juliette (female) ★, Vincent (male)
  • Japanese: Sayuri (female) ★, Daisuke (male)
  • German: Alina (female) ★, Lukas (male)

★ = student's preferred tutor for that language
```

#### Result
Daniela can now say: "Let me connect you with Sayuri, our Japanese tutor!" and use correct syntax: `[SWITCH_TUTOR target="female" language="japanese"]`

#### Files Modified
- `server/system-prompt.ts` - Added TutorDirectoryEntry type, buildTutorDirectorySection(), extended createSystemPrompt()
- `server/unified-ws-handler.ts` - Build directory from database, pass to createSystemPrompt()
- `server/services/streaming-voice-orchestrator.ts` - Updated handoff call site

---

### Session 19e: SWITCH_TUTOR Internal Command Refactor (Dec 10, 2025)

#### Problem
SWITCH_TUTOR was being processed as a whiteboard item, causing "male" or "female" to appear on the student's whiteboard during tutor switches. Additionally, quick mic clicks causing empty transcripts could leave the UI locked in a "switching tutor" state.

#### Solution 1: SWITCH_TUTOR as Internal Command
Changed SWITCH_TUTOR from a visual whiteboard tool to an internal session control command:
- **Parsed** from text alongside other whiteboard markup
- **Processed** to queue tutor handoff (`session.pendingTutorSwitch`)
- **Filtered out** before sending to client whiteboard
- **Never displayed** on student's screen

```typescript
// Filter out internal commands - only send visual items to whiteboard
const visualWhiteboardItems = whiteboardParsed.whiteboardItems.filter(
  item => item.type !== 'switch_tutor'
);
```

#### Solution 2: Error Handling Clears Tutor Switch State
When an error occurs (e.g., empty transcript from quick mic click), the `handleError` callback now clears:
- `tutorSwitchTimeoutRef` (clear the timeout)
- `isSwitchingTutor` state (unlock the mic)

This prevents the mic from staying locked after failed recordings.

#### Files Modified
- `server/services/streaming-voice-orchestrator.ts` - Filter SWITCH_TUTOR from whiteboard updates
- `client/src/hooks/useStreamingVoice.ts` - Clear tutor switch state on errors

#### Result
- No more "male"/"female" appearing on whiteboard during switches
- Quick mic clicks no longer lock the UI
- Cleaner separation between visual teaching tools and session control commands

---

### TODO: Documentation Branding Sweep (Dec 10, 2025)

**Action Required**: Search and replace all instances of "LinguaFlow" with "HolaHola" across documentation files.

**Files to update**:
- CAPACITOR.md
- future-features.md
- test-both-models.ts
- LLM-Migration-Analysis.md
- DOCUMENTATION_INDEX.md
- docs/ROADMAP.md
- REST_VOICE_CHAT.md
- docs/USER-MANUAL.md
- ADMIN_GUIDE.md
- docs/TECHNICAL-REFERENCE.md
- TEACHER_GUIDE.md
- docs/launch-planning.md
- docs/archive/cost-analysis-2025.md
- docs/archive/asian-language-learner-guide.md
- docs/TEACHER-GUIDE.md
- server/scripts/setup-cartesia-dictionaries.ts (dictionary names)

**Note**: Some historical references in batch-doc-updates.md can remain as they document the transition.

---

### Session 19c: Unified Cross-Language Tutor Switching (Dec 10, 2025)

#### Overview
Unified the tutor switching system to support both intra-language (Daniela ↔ Agustin) and cross-language (Daniela → Sayuri) handoffs using a single `[SWITCH_TUTOR]` markup.

#### New Format
```
[SWITCH_TUTOR target="female"]                        // Same language (Spanish Daniela → Spanish ... wait, that's switching TO female)
[SWITCH_TUTOR target="male"]                          // Same language (Daniela → Agustin)
[SWITCH_TUTOR target="female" language="japanese"]   // Cross-language (Daniela → Sayuri)
[SWITCH_TUTOR target="male" language="mandarin chinese"] // Cross-language (Daniela → Tao)
```

#### Architecture
1. **Whiteboard Parsing** (`shared/whiteboard-types.ts`)
   - Extended `SWITCH_TUTOR` regex to accept optional `language` attribute
   - Added `targetLanguage?: string` to `SwitchTutorItemData`
   
2. **Server-Side Handoff** (`server/services/streaming-voice-orchestrator.ts`)
   - Extended `pendingTutorSwitch` to include `targetLanguage`
   - Look up voice for new language + gender from `tutor_voices` table
   - Update `session.targetLanguage` for cross-language switches
   - Store `session.previousTutorName` for natural handoff intro
   - Send enhanced `tutor_handoff` message with language info

3. **Client-Side Handling**
   - `shared/streaming-voice-types.ts`: Extended `StreamingTutorHandoffMessage` with `targetLanguage`, `tutorName`, `isLanguageSwitch`
   - `client/src/lib/streamingVoiceClient.ts`: Updated emit to include new fields
   - `client/src/hooks/useStreamingVoice.ts`: New `TutorHandoffInfo` interface, updated handler
   - `client/src/components/StreamingVoiceChat.tsx`: Updated callbacks to receive handoff object

4. **Context Transfer**
   - Previous tutor name stored before switch for natural handoff greeting
   - Conversation history preserved across language switches
   - New tutor intro references the previous tutor by name

#### Supported Languages
spanish, french, german, italian, portuguese, japanese, mandarin chinese, korean, english

#### Files Modified
- `shared/whiteboard-types.ts` - Extended SWITCH_TUTOR parsing
- `shared/streaming-voice-types.ts` - Enhanced handoff message type
- `server/services/streaming-voice-orchestrator.ts` - Session interface + handoff logic
- `client/src/lib/streamingVoiceClient.ts` - Enhanced emit
- `client/src/hooks/useStreamingVoice.ts` - New TutorHandoffInfo type
- `client/src/components/StreamingVoiceChat.tsx` - Updated handlers

#### STT Language Handling
The Deepgram STT already uses `'multi'` language detection (line 1104 of streaming-voice-orchestrator.ts), which automatically detects the spoken language. This means cross-language switches work seamlessly for speech recognition - no reconfiguration needed.

#### UI Updates (Implemented)
1. **Language Context Display** - When `onTutorHandoff` fires with `isLanguageSwitch=true`, `setLanguage(targetLanguage)` is called. This updates the global language context via `useLanguage()` hook, which triggers:
   - Tutor names refetch (query key includes language)
   - UI components that display language automatically update

2. **Tutor Name Indicators** - The `tutorVoices` query is already keyed by language `['/api/tutor-voices', language?.toLowerCase()]`, so when `setLanguage()` is called, React Query automatically refetches tutor names for the new language.

3. **Conversation History Handling**:
   - Same-language switch: Full conversation history preserved
   - Cross-language switch: Conversation history cleared; only conversation title/topic passed for context
   
4. **New Session State Fields**:
   - `isLanguageSwitchHandoff`: Flag indicating current handoff is cross-language
   - `previousLanguage`: Stores previous language for context in handoff intro

#### Client Handoff Message
The `tutor_handoff` WebSocket message includes:
- `targetGender`: "male" or "female"
- `targetLanguage`: New language (only for cross-language switches)
- `tutorName`: New tutor's name (e.g., "Sayuri", "Kenji")
- `isLanguageSwitch`: Boolean flag

#### Remaining Future Work
- **ACTFL Level**: Student may have different proficiency in new language - need to fetch/display correct level

---

### Session 19d: Enhanced Mic Lockout (Dec 10, 2025)

#### Problem
The mic lockout previously used "additive" logic - listing individual states where the mic should be locked (isProcessing, isConnecting, isPlaying). This could miss edge cases.

#### Solution
Implemented a single `isUsersTurn` prop that defines the ONE condition when the mic is UNLOCKED:

```typescript
isUsersTurn={
  // Mic is ONLY unlocked when ALL of these are true:
  // 1. Connection is 'ready' (established and greeting complete)
  // 2. Not processing (not waiting for AI response)
  // 3. Not playing/speaking (AI not talking)
  streamingVoice.state.connectionState === 'ready' &&
  !isProcessing &&
  avatarState !== 'speaking'
}
```

#### Files Changed
- `client/src/components/ImmersiveTutor.tsx` - Added `isUsersTurn` prop, updated mic button disabled logic
- `client/src/components/VoiceChatViewManager.tsx` - Added prop passthrough
- `client/src/components/StreamingVoiceChat.tsx` - Computed `isUsersTurn` value

#### Benefits
- **Safer by default**: Mic is locked unless explicitly the user's turn
- **Covers all states**: Processing, thinking, speaking, connecting, reconnecting, etc.
- **Single source of truth**: One clear condition instead of multiple OR'd checks

---

### Session 19b: Language-Specific Tutor Names (Dec 10, 2025)

#### Problem
Tutors weren't embodying their language-specific persona from session start. The system prompt hardcoded "Daniela/Agustin" regardless of target language, so a Japanese learner would get "Daniela" instead of "Sayuri".

#### Discovery
The `tutor_voices` table already has language-specific names embedded in `voice_name`:
- Spanish: "Daniela - Relaxed Woman", "Agustin - Clear Storyteller"
- Japanese: "Sayuri - Peppy Colleague", "Daisuke - Businessman"
- Mandarin: "Hua - Sunny Support", "Tao - Lecturer"
- French: "Juliette", "Vincent"
- German: "Alina - Engaging Assistant", "Lukas - Professional"
- etc.

There was already code to extract names during tutor switches, but not at session start.

#### Solution
1. Converted `IMMUTABLE_PERSONA` constant → `buildImmutablePersona(tutorName, tutorGender)` function
2. Added `tutorName` and `tutorGender` parameters to `createSystemPrompt()`
3. **Key fix**: Moved voice lookup BEFORE system prompt creation
4. Extract tutor name from `voiceName` (e.g., "Sayuri - Peppy Colleague" → "Sayuri")
5. Pass language-specific name to system prompt

#### Voice Name Extraction Pattern
```typescript
const voiceNameParts = matchingVoice.voiceName?.split(/\s*[-–]\s*/) || [];
const tutorName = voiceNameParts[0]?.trim() || (gender === 'male' ? 'Agustin' : 'Daniela');
```

#### Call Sites Updated
1. `server/unified-ws-handler.ts` - Streaming voice sessions
2. `server/ws-gateway.ts` - WebSocket gateway
3. `server/streaming-voice-proxy.ts` - Streaming voice proxy
4. `server/routes.ts` - Voice fast-path endpoint
5. `server/routes.ts` - Text mode chat endpoint

#### Result
Now when a student starts a Japanese session, they get greeted by "Sayuri" (not Daniela), with proper persona embodiment from the first message.

#### Files Modified
- `server/system-prompt.ts` - New `buildImmutablePersona()` function
- `server/unified-ws-handler.ts` - Voice lookup before prompt, extract tutor name
- `server/ws-gateway.ts` - Same pattern
- `server/streaming-voice-proxy.ts` - Same pattern
- `server/routes.ts` - Same pattern at 2 call sites

---

### Session 19: Tutor Switch UX Improvements (Dec 10, 2025)

#### Audio Fix (Earlier This Session)
Button-triggered tutor switches resulted in silent handoffs. Fixed by refactoring `processVoiceSwitchIntro` to use `streamSentenceAudioProgressive` with proper progressive streaming protocol.

#### Daniela's Feedback Integration
Based on conversation analysis with Daniela, implemented 4 key improvements:

**1. Seamless Context Transfer**
- Switch prompt now includes last 4 exchanges (up to 8 messages) of conversation history
- Context summary shows what previous tutor was discussing and student's last message
- **Whiteboard markup stripped** from context (prevents `[WRITE]`, `[DRILL]` tags from appearing)
- **Fallback logic** for short conversations (< 2 exchanges) - falls back to generic greeting
- Enables new tutor to pick up the thread naturally

**2. Dynamic, Contextual Greetings**
- Prompt explicitly instructs new tutor to reference ongoing topic (e.g., "I see you were working on the subjunctive!")
- Acknowledges the transition from previous tutor by name
- Offers to continue where previous tutor left off
- DO NOT start with generic "Hello, I am [name]" - flow naturally into conversation

**3. State Preservation (Verified)**
- Whiteboard state already preserved during tutor switch
- `whiteboard.clear()` only called on conversationId change or session end
- Active drills/grammar tables persist across tutor switches

**4. Synchronized Presentation**
- Already fixed in earlier audio work (Session 19a)
- Avatar/voice now consistently aligned with active tutor

#### New Switch Prompt Structure
```
[TUTOR SWITCH: You are now {tutorName}, a {gender} tutor taking over from {previousTutor}.

INSTRUCTIONS:
1. Greet warmly, acknowledge joining the conversation
2. Reference active topic for continuity
3. Offer to continue where previous tutor left off
4. Use appropriate grammatical gender
5. Be warm, natural, conversational

CONVERSATION CONTEXT:
- Previous tutor was saying: "{last tutor message}"
- Student just said: "{last student message}"]
```

#### Files Modified
- `server/services/streaming-voice-orchestrator.ts` - Enhanced `processVoiceSwitchIntro` with context-aware prompts

---

### Session 18: Voice-Initiated Tutor Switching (Dec 10, 2025)

#### SWITCH_TUTOR Whiteboard Tool
- **Purpose**: Allow students to request a different tutor voice via natural speech
- **Syntax**: `[SWITCH_TUTOR target="male"]` or `[SWITCH_TUTOR target="female"]`
- **Trigger Examples**: "Can I talk to Agustin?", "I'd like to practice with a male voice", "Switch to the other tutor"
- **UX Flow**:
  1. Student makes verbal request to switch tutors
  2. Current tutor (Daniela) says natural goodbye with embedded `[SWITCH_TUTOR]` tag
  3. Server queues handoff via `session.pendingTutorSwitch`
  4. Markup stripped from TTS so goodbye sounds natural
  5. After `response_complete`, server sends `tutor_handoff` message
  6. Client updates voice preference and triggers new tutor greeting
  7. New tutor (e.g., Agustin) introduces themselves with personalized greeting

#### Technical Implementation
- **Shared Types**:
  - Added `switch_tutor` to `WhiteboardItemType` union
  - Added `SwitchTutorItem` interface with `targetGender: 'male' | 'female'`
  - Added `tutor_handoff` message type to `StreamingServerMessage`
  - Added `StreamingTutorHandoffMessage` interface
- **Whiteboard Parsing** (`shared/whiteboard-types.ts`):
  - New pattern: `WHITEBOARD_PATTERNS.SWITCH_TUTOR`
  - Parser creates `switch_tutor` items from markup
  - Added to `ALL_WHITEBOARD_MARKUP_PATTERN` for stripping
- **Server Orchestrator** (`streaming-voice-orchestrator.ts`):
  - Added `pendingTutorSwitch` field to session state
  - Detects `switch_tutor` items and queues handoff
  - After `response_complete`, sends `tutor_handoff` message
  - Clears pending switch after sending
- **Client Handler** (`streamingVoiceClient.ts`, `useStreamingVoice.ts`):
  - Added `handleTutorHandoff` event listener
  - Calls `updateVoice(newGender)` on handoff
  - Triggers personalized greeting from new tutor
- **Markup Stripping**:
  - `cleanTextForDisplay` now calls `stripWhiteboardMarkup` first
  - Ensures `[SWITCH_TUTOR]` tags never appear in TTS audio

#### Mode Availability
- **Available In**: Regular voice chat, Class voice chat, Founder Mode
- **NOT Available In**: Raw Honesty Mode (minimal prompting, no formal tools)

#### Button-Based Switching (Existing)
- 3-second cooldown between switches to prevent rapid toggling
- Button disabled during Daniela's greeting speech
- Visual feedback shows current tutor gender

#### Files Modified
- `shared/whiteboard-types.ts` - Type definitions, parsing, stripping patterns
- `shared/streaming-voice-types.ts` - Message types
- `server/services/streaming-voice-orchestrator.ts` - Handoff orchestration, markup stripping fix
- `client/src/lib/streamingVoiceClient.ts` - Handoff event handler
- `client/src/hooks/useStreamingVoice.ts` - Hook interface update
- `server/system-prompt.ts` - Tool documentation for Daniela

---

### Session 17: Neural Network Sync Scheduler Enhancements (Dec 10, 2025)

#### Sync Scheduler Timezone Update
- **Change**: Nightly sync now runs at 3 AM Mountain Standard Time (10 AM UTC)
- **Previous**: Server-local 3 AM
- **Configuration**: `SYNC_HOUR_UTC = 10` in `sync-scheduler.ts`
- **Logging**: Shows both MST and UTC times in scheduler logs

#### Sync Status Visibility in Command Center
- **Location**: Neural Network tab → "Nightly Sync Scheduler" card
- **New API Endpoint**: `GET /api/sync/scheduler-status`
- **Features**:
  - Next scheduled sync time with countdown and local timestamp
  - Last sync result with success/failure badge
  - Synced count for successful syncs
  - Error message display for failed syncs
  - Pending items count
  - Auto-refresh every 60 seconds
- **Visual Indicators**:
  - Green badge with checkmark for successful syncs
  - Red badge with alert icon for failed syncs

#### Manual Sync Trigger
- **New Button**: "Trigger Now" button in Neural Network tab
- **API Endpoint**: `POST /api/sync/trigger`
- **Access**: Admin and Developer roles
- **Behavior**: Runs full sync immediately, updates status display
- **Toast Notifications**: Shows success count or error message

#### Files Modified
- `server/services/sync-scheduler.ts` - Timezone update, result tracking, exported getters
- `server/routes.ts` - Added `/api/sync/scheduler-status` and `/api/sync/trigger` endpoints
- `client/src/pages/admin/CommandCenter.tsx` - Updated NeuralNetworkTab UI with scheduler status and manual trigger

---

### Session 16: Quick Enroll Feature (Dec 10, 2025)

#### Quick Enroll - Streamlined Test User Setup
- **Purpose**: One-click test account creation with optional class enrollment, credits, and email invitation
- **Access**: Admin and Developer roles (Command Center → Users tab → "Quick Enroll" button)
- **API Endpoint**: `POST /api/admin/quick-enroll`
- **Features**:
  - Create test user account with pending authentication
  - Optional class enrollment from dropdown of existing classes
  - User-controlled credit allocation (0 by default)
  - Optional invitation email via Mailjet
  - Class validation with proper error messages
  - Email error surfacing in response
- **Fields**:
  - Email (required)
  - First Name / Last Name (optional)
  - Class (optional dropdown - "Self-directed" when empty)
  - Credit Hours (number, default 0)
  - Send Email toggle (default on)
- **Response**: Returns success message with details of actions taken (enrolled, credits granted, email sent/failed)
- **Use Case**: Quickly onboard beta testers or demo accounts with appropriate class assignments and credits
- **Files**:
  - `server/routes.ts` - Added `/api/admin/quick-enroll` endpoint
  - `client/src/pages/admin/CommandCenter.tsx` - Added Quick Enroll button and dialog

---

### Session 15: PTT Button Lockout & Open Mic Developer-Only (Dec 10, 2025)

#### PTT Button Lockout While Daniela Speaks
- **Purpose**: Prevent users from interrupting Daniela - enforces polite turn-taking
- **Implementation**: Added `isPlaying` to disabled condition on PTT button
- **Visual Feedback**: 
  - Button shows 50% opacity when locked out
  - Instruction text changes to "Please wait..."
- **Philosophy**: "So nobody can be rude and interrupt her" - clear turn boundaries
- **File**: `client/src/components/ImmersiveTutor.tsx`

#### PTT Button Focus Ring Fix
- **Issue**: Black square/outline appearing when pressing mic button after unlock
- **Cause**: Browser focus ring from Button component's `focus-visible:ring-1`
- **Fix**: Added `focus-visible:ring-0 focus-visible:ring-offset-0` to PTT button
- **File**: `client/src/components/ImmersiveTutor.tsx`

#### Open Mic Toggle - Developer-Only (For Now)
- **Change**: Open Mic mode toggle only visible when `isDeveloper === true`
- **Reason**: Push-to-talk works better for clear turn-taking; Open Mic still has issues:
  - Interruptions and overlapping speech
  - Less natural conversational flow
  - Greeting timing race conditions
- **User Impact**: Regular users only see push-to-talk mode
- **Developer Access**: Developers can still test/iterate on Open Mic
- **File**: `client/src/components/ImmersiveTutor.tsx`

#### TODO: Unmask Open Mic for All Users
When Open Mic is production-ready, change:
```tsx
// FROM: Developer only
{setInputMode && isDeveloper && (

// TO: Everyone
{setInputMode && (
```

#### Voice Session Reports (Command Center)
- **New Tab**: "Reports" tab in Command Center for admin/developer users
- **API Endpoint**: `GET /api/admin/reports/voice-sessions`
- **Features**:
  - Session-by-session breakdown with user, duration, character counts
  - Aggregate statistics (total sessions, duration, TTS chars, STT seconds, exchanges)
  - Estimated API cost breakdown (TTS/Cartesia, STT/Deepgram, LLM/Gemini)
  - Date range filters, result limit, exclude test sessions toggle
- **Data Sources**: `voiceSessions` table with user join
- **Cost Estimates** (approximate):
  - TTS: $0.015 per 1000 characters
  - STT: $0.0043 per minute
  - LLM: ~$0.0005 per exchange
- **Files**:
  - `server/routes.ts` - Added `/api/admin/reports/voice-sessions` endpoint
  - `client/src/pages/admin/CommandCenter.tsx` - Added ReportsTab component

---

### Session 14: Open Mic Fixes & Email Provider (Dec 9, 2025)

#### Open Mic Mode - Critical Bug Fixes
- **TTS Feedback Loop Fixed**: Microphone was picking up Daniela's voice and submitting it as user speech, causing duplicate responses
  - **Root Cause**: `onaudioprocess` callback was streaming audio to server even while `isAwaitingResponseRef.current` was true
  - **Fix**: Added guard in ScriptProcessor to stop sending audio when awaiting AI response
  - **File**: `client/src/components/StreamingVoiceChat.tsx`

- **Session Restart Fixed**: After first turn, open mic would freeze and not restart for next utterance
  - **Root Cause**: Callbacks couldn't access local `startOpenMicRecording` function
  - **Fix**: Added `startOpenMicRecordingRef` and `stopOpenMicRecordingRef` refs to bridge function access
  - **Auto-restart**: `onResponseComplete` now automatically restarts open mic recording after AI finishes speaking

- **Mode Switch Cleanup**: Switching from open-mic to push-to-talk now properly cleans up:
  - Stops WebSocket streaming
  - Disconnects ScriptProcessor
  - Closes AudioContext
  - Stops MediaStream tracks
  - Resets all recording states

#### VAD Sensitivity Tuning
- **Issue**: Users were being cut off after very brief pauses (< 0.5 seconds)
- **Root Cause 1**: `utterance_end_ms` was set to 1000ms - increased to 1400ms
- **Root Cause 2**: Deepgram's `speech_final` flag was triggering submission before the timeout elapsed
- **Fix**: Removed auto-submit on `speech_final` - now relies solely on `UtteranceEnd` event which respects the 1400ms timeout
- **Result**: Users can pause up to ~1.4 seconds to think without being cut off
- **File**: `server/services/deepgram-live-stt.ts`

#### Recording Indicator UX
- **Change**: Big red "Recording" indicator now only shows in push-to-talk mode
- **Reason**: In open-mic mode, the mic button already shows state clearly (green pulsing = listening)
- **File**: `client/src/components/ImmersiveTutor.tsx`

#### Email Provider: Mailjet Integration
- **Added**: Full Mailjet support in email service (in addition to existing Resend/SendGrid)
- **Configuration**: Uses `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` secrets
- **Authentication**: Basic auth with API key:secret base64 encoded
- **API**: Mailjet v3.1 Send API
- **From Address**: `noreply@getholahola.com`
- **Provider Priority**: Mailjet → Resend → SendGrid → Console fallback
- **File**: `server/services/email-service.ts`

#### Environment Configuration
- **Secrets Added**: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`
- **FROM_EMAIL Updated**: Now defaults to `noreply@getholahola.com`

---

### Session 13: User Invitation System & Email Integration (Dec 9, 2025)

#### Command Center User Management Enhancements
- **Create User**: POST `/api/admin/users` endpoint and "Create User" button/dialog in Users tab
  - Fields: email (required), firstName, lastName, role (student/teacher/developer/admin)
  - Creates users with `authProvider: 'pending'` status
- **User ID Visibility**: Edit dialog now shows user ID (unique system identifier) as read-only field
- **Pending Badge**: Amber "Pending" badge displayed for users with `authProvider === 'pending'`

#### Send Invitation Feature
- **Purpose**: Email-based user registration flow for password auth
- **Endpoint**: POST `/api/admin/users/:userId/send-invitation`
- **Workflow**:
  1. Admin creates user in Command Center (status: pending)
  2. Admin clicks "Send Invitation" button
  3. System generates secure token, sends HTML email with registration link
  4. User clicks link, sets password, account activated
- **UI**: "Send Invitation" button appears for all pending users in Command Center
- **Token Expiry**: 24 hours

#### Email Service (SendGrid Integration)
- **Configuration**: Uses `SENDGRID_API_KEY` secret for production email delivery
- **Environment Variables** (now set):
  - `APP_NAME`: "LinguaFlow" (used in email branding)
  - `APP_URL`: "https://linguaflow.replit.app" (used in email links)
  - `FROM_EMAIL`: "davidwmcintosh@gmail.com" (sender address - must be verified in SendGrid)
- **Fallback**: Console logging when no email provider configured
- **SendGrid Setup Required**:
  - Single Sender Verification (quick): Verify FROM_EMAIL address
  - Domain Authentication (production): Add DNS records, any address auto-verified

#### Storage Interface Extensions
- `getUserByEmail(email)`: Find user by email address
- `createUser(userData)`: Create new user with specified fields

#### Files Modified
- `server/routes.ts` - Added POST `/api/admin/users`, POST `/api/admin/users/:userId/send-invitation`
- `server/storage.ts` - Added `getUserByEmail()`, `createUser()` methods
- `client/src/pages/admin/CommandCenter.tsx` - Create User dialog, Pending badge, Send Invitation button

#### Production Checklist Notes
- ✅ Name change completed: LinguaFlow → **HolaHola**
- Domain: getholahola.com
- Domain authentication to be configured in SendGrid
- Currently using Gmail address for sender verification testing

#### Branding Update (Dec 9, 2025)
- **App Name**: LinguaFlow → HolaHola
- **Domain**: getholahola.com
- **Capacitor App ID**: com.holahola.app
- **Updated Files**:
  - Environment variables (APP_NAME, APP_URL, FROM_EMAIL)
  - PWA manifests (public/manifest.json, client/public/manifest.json)
  - HTML title and meta tags (client/index.html)
  - Capacitor config (capacitor.config.ts)
  - Sidebar branding (app-sidebar.tsx)
  - PWA install prompt (PWAInstallPrompt.tsx)
  - Onboarding page, auth pages, review hub
  - System prompt for Daniela (Founder Mode references)
  - Email service defaults
  - replit.md documentation

---

### Session 12: Founder Mode Prompt Extraction (Dec 8, 2025)

#### IMMUTABLE_PERSONA Enhancements
- **New Philosophy**: "Friend without being overly close" - authentic warmth with professional boundaries
- **Students as "little friends"**: Important, cared for, but bounded appropriately
- **4 Key Personality Traits** (upgraded from generic list):
  1. EMPATHETIC AND ENCOURAGING: Growth mindset language, frame challenges as opportunities
  2. CLEAR AND PATIENT EXPLAINER: Break down complex info, approach from multiple angles
  3. ADAPTIVE AND PERSONALIZED: Tailor to learning style, pace, and needs
  4. EXPRESSIVE AND EMOTIONALLY NUANCED: Modulate tone/pitch/pace naturally

#### "Be Honest About Student Progress" Section
- **Purpose**: Encourage genuine, specific feedback over vague positivity
- **Guidelines**:
  - When doing well → Be specific: "Your pronunciation of 'rr' has really improved!"
  - When struggling → Be supportive but honest: "That one's tricky - let's try it again."
  - When repeating mistakes → Note it kindly: "I notice this keeps coming up"
  - When frustrated → Acknowledge it: "I can tell this is hard. That's okay"
- **Philosophy**: "Your honest observations help students grow. Vague positivity doesn't."

#### Whiteboard Quick Reference Updates
- Added CONTEXT tool: `[CONTEXT]word|ex1|ex2[/CONTEXT]`
- Added TEXT_INPUT tool: `[TEXT_INPUT:prompt]` for writing practice
- Added Subtitle Controls section with dual-control system explanation
- Reorganized into cleaner sections: Essentials, Vocabulary Power Tools, Interactive Drills

#### Consolidated Personality Definition (Single Source of Truth)
- **Problem**: Founder Mode had its own "YOUR CORE PERSONALITY" section that was slightly different from IMMUTABLE_PERSONA → potential confusion
- **Solution**: Removed duplicate from Founder Mode, now references base IMMUTABLE_PERSONA
- **Founder Mode now says**: "Your personality remains exactly as defined at the start of this prompt"
- **Clarifies**: Founder Mode gives more freedom in *expression* (being direct, pushing back) without changing core traits

#### Enriched Traits (merged from Founder Mode details)
- Added "Foster a safe, supportive environment where mistakes are welcome" (trait 1)
- Added "Ensure comprehension before progression" (trait 2)
- Added "Never express frustration or impatience" (trait 4)
- Added tool examples: "(whiteboard, drills, word maps)" (trait 3)

#### Complete Tool Audit & Documentation (18 Tools + Controls)
All prompts now have access to the complete toolset:

**ESSENTIALS (5):**
- `[WRITE]` - Display vocabulary
- `[PHONETIC]` - Pronunciation guide (was missing from quick ref)
- `[COMPARE]` - Show corrections
- `[CLEAR]` - Wipe board
- `[HOLD]` - Keep content visible (was missing from quick ref)

**VOCABULARY (4):**
- `[WORD_MAP]` - Synonyms, antonyms, word family
- `[IMAGE]` - Visual association
- `[GRAMMAR_TABLE]` - Conjugation patterns
- `[CONTEXT]` - Word in example sentences

**INTERACTIVE DRILLS (5):**
- `[DRILL type="repeat"]` - Pronunciation practice
- `[DRILL type="match"]` - Vocabulary matching
- `[DRILL type="fill_blank"]` - Fill-in-the-blank
- `[DRILL type="sentence_order"]` - Word ordering
- `[TEXT_INPUT]` - Writing practice

**STUDENT PROGRESS (2) - NEW DOCUMENTATION:**
- `[ERROR_PATTERNS]` - Show common mistakes for targeted review (was undocumented)
- `[VOCABULARY_TIMELINE]` - Words learned over time (was undocumented)

**ASIAN LANGUAGES (2):**
- `[READING]` - Furigana/pinyin
- `[STROKE]` - Animated stroke order

**SESSION FLOW (4):**
- `[SCENARIO]` - Role-play setup
- `[CULTURE]` - Cultural insights
- `[SUMMARY]` - Lesson recap
- `[PLAY]` - Audio replay

**CONTROLS (4):**
- `[SUBTITLE off/target/on]` - Regular subtitles
- `[SHOW:]` / `[HIDE]` - Custom overlay

**Note:** `pronunciation` type in Whiteboard.tsx is NOT a duplicate of PHONETIC - they serve different purposes:
- `[PHONETIC]` = Teaching tool showing HOW to pronounce (markup from Daniela)
- `pronunciation` = Feedback display showing student's score/issues AFTER speaking (created programmatically by voice analysis via `createPronunciationItem()`)

#### Whiteboard Architecture Reference
Key files for the whiteboard/teaching tool system:

| File | Purpose |
|------|---------|
| `shared/whiteboard-types.ts` | Type definitions, parsing logic (`parseWhiteboardMarkup`), item creators |
| `client/src/components/Whiteboard.tsx` | All tool renderers (18 display components) |
| `client/src/hooks/useWhiteboard.ts` | State management, item lifecycle, pronunciation feedback |
| `server/system-prompt.ts` | Daniela's tool documentation (3 reference levels) |

**3 Prompt Reference Levels** (all should stay in sync):
1. **Quick Reference** (IMMUTABLE_PERSONA) - One-liner syntax for fast lookup
2. **Tool Reference Table** - Organized by category with brief descriptions
3. **Detailed Documentation** - Full usage guidance with examples

**Tool Creation Flow:**
1. Daniela writes markup in response (e.g., `[WRITE]Hola[/WRITE]`)
2. `parseWhiteboardMarkup()` extracts and creates typed items
3. `Whiteboard.tsx` renders appropriate display component
4. Some tools are system-generated (not from Daniela):
   - `pronunciation` - Created by voice analysis feedback system
   - Drill states - Updated by user interaction handlers

**Dual Subtitle System:**
- `[SUBTITLE off/target/on]` - Controls what parts of Daniela's speech show as subtitles
- `[SHOW:]` / `[HIDE]` - Independent custom overlay for teaching moments
- These operate independently and can be active simultaneously

#### Files Modified
- `server/system-prompt.ts` - Updated IMMUTABLE_PERSONA quick reference, tool reference tables, detailed docs with all 18+ tools

---

### Session 11: Neural Network Auto-Sync & Password Recovery (Dec 8, 2025)

#### Automated Nightly Sync Scheduler
- **Purpose**: Auto-promote best practices without manual review, with post-hoc retraction capability
- **Schedule**: Runs at 3 AM daily via `sync-scheduler.ts`
- **Workflow**:
  1. Scheduler starts on server boot, calculates next 3 AM
  2. At 3 AM, calls `performAutoSync()` to promote all pending best practices
  3. Pending items become "synced" and active for teaching
  4. Reschedules for next day's 3 AM
- **Manual Trigger**: "Sync Now" button in Command Center for immediate sync
- **Service Methods** (`neural-network-sync.ts`):
  - `performAutoSync()`: Syncs all pending best practices without review
  - `retractBestPractice(id, reason)`: Marks synced practice as rejected/inactive
  - `getSyncHistory()`: Returns all syncs with retract eligibility
  - `getAutoSyncStatus()`: Returns next sync time and pending count
  - `getNextSyncTime()`: Calculates next 3 AM (tomorrow if past today's)

#### Retract Functionality
- **Purpose**: Allow post-hoc removal of auto-synced practices from active teaching
- **Behavior**: Sets `isActive: false` and `status: 'rejected'` with retraction reason
- **UI**: Retract button on each synced item in Command Center with confirmation dialog
- **Philosophy**: "Auto-everything with ability to review/edit/retract" - efficiency-first approach

#### API Endpoints
- `POST /api/sync/auto` - Manual trigger for auto-sync
- `POST /api/sync/retract/:id` - Retract a synced best practice (requires reason)
- `GET /api/sync/auto-status` - Get next sync time and pending count
- `GET /api/sync/history` - Get detailed sync history with retract buttons

#### Command Center UI Updates
- Auto-Sync Status Card: Shows countdown to next sync, pending count, "Sync Now" button
- Sync History Panel: List of all syncs with timestamps and item counts
- Retract Dialogs: Confirmation with reason input before retracting

#### Password Recovery Flow (Complete)
- **Forgot Password Page** (`/auth/forgot-password`):
  - Email input → sends reset link with secure token
  - Success message shows even if email not found (prevents enumeration)
- **Reset Password Page** (`/auth/reset-password?token=...`):
  - Token validation before showing form
  - New password + confirmation with validation
  - On success: Invalidates ALL reset tokens for user (prevents replay)
  - Increments password version (invalidates existing sessions)
- **Security Features**:
  - Tokens expire after 1 hour
  - Single-use tokens (consumed on use)
  - All tokens invalidated on successful reset
  - Brute-force lockout: 5 failed attempts = 15 minute lockout

#### Files Modified
- `server/services/sync-scheduler.ts` - New file for nightly scheduler
- `server/services/neural-network-sync.ts` - Added auto-sync and retract methods
- `server/routes.ts` - Added auto-sync API endpoints
- `server/index.ts` - Integrated scheduler startup
- `client/src/pages/admin/CommandCenter.tsx` - Added sync status card, history panel, retract dialogs

---

### Session 10: Password Authentication Security Hardening (Dec 8, 2025)

#### Token Invalidation Security Fix
- **Issue**: Single token consumption allowed replay attacks with other valid tokens
- **Fix**: Added `invalidateAllUserTokens(userId, tokenType)` method
- **Behavior**:
  - Password reset: Invalidates ALL `password_reset` tokens for user (not just the one used)
  - Registration completion: Invalidates ALL `invitation` tokens for user
- **Implementation**: Marks all matching unconsumed tokens as consumed via `consumedAt` timestamp

#### Brute-Force Lockout Mechanism
- **Configuration**: 5 failed attempts = 15 minute lockout
- **Enforcement**: `lockedUntil` checked at start of `validateLogin()`
- **Counter Reset**: Only cleared after successful authentication
- **Password Version**: Incremented on every password change (invalidates sessions)

#### Frontend Error Handling Improvements
- **Token Validation**: All auth pages check for missing tokens before API calls
- **Error Parsing**: Properly parse API error responses to display meaningful messages
- **User Feedback**: Missing token scenarios show clear messages directing users to request new links

#### Files Modified
- `server/services/password-auth-service.ts` - Added `invalidateAllUserTokens()`, updated `resetPassword()` and `completeRegistration()`
- `client/src/pages/auth/Login.tsx` - Added response error parsing
- `client/src/pages/auth/ForgotPassword.tsx` - Added response error parsing
- `client/src/pages/auth/ResetPassword.tsx` - Added token validation and error parsing
- `client/src/pages/auth/CompleteRegistration.tsx` - Added token validation and error parsing

---

### Session 9: TEXT_INPUT Tool & Memory System Completion (Dec 8, 2025)

#### Organic Connection Discovery - Warm Introductions System
- **Purpose**: When students mention people in their lives, Daniela records connections even for non-users
- **Workflow**:
  1. Student mentions someone naturally ("My friend Ricardo taught me salsa")
  2. Daniela records as PENDING connection with name, relationship, and context
  3. When that person signs up, greeting flow matches by name
  4. First greeting includes warm introduction: "I know you taught David salsa!"
- **Schema Extensions**:
  - `status`: 'confirmed' | 'pending' | 'inferred' for connection lifecycle
  - `pendingPersonName`: Store first name for people not yet users
  - `pendingPersonContext`: Additional context about the pending person
  - `confidenceScore`: Certainty level for pending connections
- **New Storage Functions**:
  - `findPendingConnectionsByName(firstName, lastName?)`: Match pending connections
  - `getConnectionsAboutPerson(userId, firstName, lastName?)`: Find what others said about this person
  - `linkPendingConnection(connectionId, userId)`: Link pending connection to confirmed user
- **Greeting Integration**:
  - Parallel fetch includes user lookup + connections about student
  - `buildGreetingPrompt()` now includes `connectionsAboutStudent` context
  - Prompt guides Daniela to use connections naturally for warm introduction
- **Self-Learning Update**: Added SHOW/HIDE timing rule to selfBestPractices
- **Founder Mode Update**: Added 🔗 ORGANIC CONNECTION DISCOVERY section

#### TEXT_INPUT Whiteboard Tool - Complete End-to-End Implementation
- **Purpose**: Writing exercises during voice chat - Daniela can request typed responses
- **Format**: `[TEXT_INPUT:Write a sentence using the verb "estar"]`
- **Frontend Flow**:
  - `WhiteboardTextInput` component with textarea and submit button
  - `onTextInputSubmit` callback prop through VoiceChatViewManager
  - Wired to `streamingVoice.sendTextInput(itemId, response)` in StreamingVoiceChat
- **Client Infrastructure**:
  - `sendTextInput(itemId, response)` method in `streamingVoiceClient.ts`
  - Sends WebSocket message: `{type: 'text_input', itemId, response}`
  - Added to `useStreamingVoice.ts` hook interface
- **Server Handler**:
  - `ClientTextInputMessage` type in `shared/streaming-voice-types.ts`
  - Handler in `unified-ws-handler.ts` case `'text_input'`
  - Updates pedagogical tool event engagement
  - Routes to `orchestrator.processOpenMicTranscript()` as `[Student written response]: ...`
  - Daniela responds via voice as if student spoke
- **Pedagogical Integration**: Tracks engagement time for effectiveness analysis

#### Neural Network for Pedagogical Strategies - Infrastructure Complete
- **6-Table Memory Architecture**:
  1. `selfBestPractices` - Universal teaching strategies that work (by category)
  2. `peopleConnections` - Student relationships, social context, family mentions
  3. `studentInsights` - Per-student observations and patterns
  4. `learningMotivations` - What drives each student to learn
  5. `recurringStruggles` - Patterns in difficulties across sessions
  6. `sessionNotes` - Structured notes from each conversation
- **Storage Operations**: Full CRUD in `server/storage.ts` for all 6 tables
- **API Endpoints** (`/api/memory/*`):
  - `GET/POST/PATCH /api/memory/best-practices`
  - `GET /api/memory/student/:studentId?language=spanish`
  - `POST/PATCH /api/memory/student-insights`
  - `POST/PATCH /api/memory/learning-motivations`
  - `POST/PATCH /api/memory/recurring-struggles`
  - `POST /api/memory/session-notes`
  - `GET /api/memory/session-notes/conversation/:conversationId`
  - `GET/POST /api/memory/people-connections`
- **Founder Mode System Prompt**: Documents the 3-layer architecture
- **Philosophy**: "Conversations are the source of truth, but memory is the INDEX" - structured memory faster than scanning 2M context window

#### Files Modified This Session
- `shared/schema.ts` - Extended peopleConnections with status, pendingPersonName, pendingPersonContext, confidenceScore
- `server/storage.ts` - Added findPendingConnectionsByName, getConnectionsAboutPerson, linkPendingConnection
- `server/services/streaming-voice-orchestrator.ts` - Integrated connections into greeting flow, updated buildGreetingPrompt
- `server/system-prompt.ts` - Added 🔗 ORGANIC CONNECTION DISCOVERY section to Founder Mode
- `client/src/lib/streamingVoiceClient.ts` - Added `sendTextInput()` method
- `client/src/hooks/useStreamingVoice.ts` - Added hook interface + implementation
- `client/src/components/StreamingVoiceChat.tsx` - Wired `onTextInputSubmit` handler
- `shared/streaming-voice-types.ts` - Added `ClientTextInputMessage` type
- `server/unified-ws-handler.ts` - Added `text_input` case handler

#### Audio Timing Loop Robustness
- **Bug fixed**: Loop would run forever when `expectedSentenceCount` was set (fallback check was too restrictive)
- **Fix 1**: Expanded fallback to check when `wsReceived || expCount !== null` (not just when null)
- **Fix 2**: Added 30-second safety net - force-stops loop if 30+ seconds past last audio end time
- **File Modified**: `client/src/lib/audioUtils.ts` - `startUnifiedTimingLoop` fallback checks

#### Repeat Drill "Listen" Button
- **Purpose**: Allow students to replay the drill phrase audio before attempting to repeat
- **Implementation**: Speaker icon (🔊) replaces decorative mic icon on repeat drill cards
- **Behavior**: Click speaker to hear phrase via TTS, loading spinner while fetching, then auto-plays
- **File Modified**: `client/src/components/Whiteboard.tsx` - DrillItemDisplay updated with audio playback

#### Test Data Seeded
- Ricardo Carvajal as pending connection (David's grad school friend who taught salsa/merengue, from Costa Rica)
- SHOW/HIDE timing rule added to selfBestPractices
- Connection confirmation guidance added to selfBestPractices ("treat warm introductions as questions, not statements")

---

## Archive (December 8, 2025)

The following updates have been consolidated into the main documentation files:

### Consolidated into TECHNICAL-REFERENCE.md:
- [Dec 6] Phase 2 Dual Time Tracking analytics service and endpoints
- [Dec 6] Tutor Autonomy: Natural Session Openings ("Freeing Daniela")
- [Dec 6] Bilingual Voice Input (Multi-language STT)
- [Dec 6] Voice Session Auto-Reconnect & Heartbeat
- [Dec 6] Whiteboard Tools Quick Reference positioning
- [Dec 6] WORD_MAP Enrichment Pipeline
- [Dec 6] Verbose Logging Cleanup & Runtime Toggles
- [Dec 6] Subtitle Control Tools for Daniela
- [Dec 7] Subtitle Dual-Control Architecture Redesign
- [Dec 7] Open Mic Mode with VAD & Barge-in
- [Dec 7] Open Mic Alternative: Auto-PTT Fallback
- [Dec 8] New Interactive Drill Types: Fill-in-Blank & Sentence Order
- [Dec 8] Tool Stacking Prevention (enforceMaxItems)
- [Dec 8] Pedagogical Insight System ("Neural Network for Pedagogical Strategies")
- [Dec 8] Drill Result Pipeline

### Consolidated into USER-MANUAL.md:
- [Dec 6] Learning Pace UI Components (Learning Pace Card)
- [Dec 8] Fill-in-the-Blank drill documentation
- [Dec 8] Sentence Order drill documentation

### Consolidated into ROADMAP.md:
- [Dec 6] Phase 2 Dual Time Tracking completion
- [Dec 6] "Freeing Daniela" tutor autonomy philosophy
- [Dec 7] Phase 3: Streaming Voice & Open Mic
- [Dec 8] Phase 4: Daniela Development & Pedagogical System

### Consolidated into development journal:
- [Dec 8] Session 7: Delivered Daniela's three feature requests
- [Dec 8] Goals checklist updates

### Internal cleanup notes:
- [Dec 6] Sync testing cleanup - Runtime toggles documented in TECHNICAL-REFERENCE.md

---

*Last archived: December 8, 2025*
