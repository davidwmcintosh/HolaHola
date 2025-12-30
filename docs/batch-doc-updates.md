# Batch Documentation Updates

Staging area for documentation changes to be consolidated later.

**Graduation Criteria**: If it's reusable knowledge → add to hive (agent_observations). If it's session-specific history → batch only.

---

## Pending Updates

### Session: December 30, 2025 - Cross-Language Tutor Transfer Gate

**Status**: COMPLETED - Two-layer validation with feature flag

**Overview**: Implemented a security gate blocking cross-language tutor transfers while preserving code for future enrollment-based expansion. Same-language gender switches continue to work normally.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Feature Flag | `CROSS_LANGUAGE_TRANSFERS_ENABLED` (default: false) controls gate behavior |
| Primary Validation | `validateTutorTransfer()` helper checks targetLanguage before switch |
| Defense-in-Depth | Secondary check on computed effectiveLanguage catches edge cases |
| Retry Prevention | `crossLanguageTransferBlocked` session flag prevents retry attempts within same turn |
| User Feedback | `tutor_transfer_blocked` WebSocket message for denial notifications |

#### Two-Layer Protection Architecture

```
Layer 1: validateTutorTransfer(sessionLanguage, targetLanguage)
    ↓ Catches explicit cross-language requests
    
Layer 2: Defense-in-Depth check on effectiveLanguage
    ↓ Catches cases where language differs after inference
    
Result: Cross-language blocked, same-language allowed
```

#### validateTutorTransfer Helper

```typescript
// server/services/streaming-voice-orchestrator.ts
const CROSS_LANGUAGE_TRANSFERS_ENABLED = false;

function validateTutorTransfer(
  currentLanguage: string,
  targetLanguage: string | undefined
): { allowed: true } | { allowed: false; reason: string } {
  if (!CROSS_LANGUAGE_TRANSFERS_ENABLED && targetLanguage && 
      targetLanguage.toLowerCase() !== currentLanguage.toLowerCase()) {
    return {
      allowed: false,
      reason: 'Cross-language transfers are currently disabled.',
    };
  }
  return { allowed: true };
}
```

#### Retry Prevention Flow

```
1. AI attempts cross-language switch
2. validateTutorTransfer blocks it
3. crossLanguageTransferBlocked flag set to true
4. AI generates response (may retry switch)
5. Command parsing checks flag → skips if blocked
6. Flag resets at start of next turn
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Feature flag, validateTutorTransfer, retry prevention, WebSocket message |

#### Integration Points

| Voice Mode | Validation Location | Defense Location |
|------------|---------------------|------------------|
| PTT (Push-to-Talk) | Line ~2662 | Line ~2691 |
| Open-mic | Line ~3546 | Line ~3574 |

#### Future Expansion (Feature Flag = true)

When `CROSS_LANGUAGE_TRANSFERS_ENABLED` is set to `true`:
- All cross-language transfers will be allowed
- Enrollment-based restrictions can be added as a secondary gate
- See `docs/enrollment-based-cross-language-transfers.md` for implementation plan

#### Architecture Decision

Two-layer validation ensures robust protection:
1. **Layer 1** catches when AI explicitly specifies a different language
2. **Layer 2** catches edge cases where effectiveLanguage differs from targetLanguage (e.g., after inference)

This defense-in-depth approach prevents bypasses via parameter manipulation or inference edge cases.

---

### Session: December 28, 2025 - ACTION_TRIGGERS Command System Cleanup

**Status**: COMPLETED - Prompt deduplication and robust cross-language handoffs

**Overview**: Cleaned up the ACTION_TRIGGERS command system to eliminate duplication between neural network procedural memory and system prompts, while adding smart language inference for cross-language tutor handoffs.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Smart Language Inference | `inferLanguageFromTutorName()` auto-fills missing `language` parameter by detecting tutor names in AI response |
| Dynamic Tutor Identity | All voice modes (Regular, Founder, Raw Honesty) now use `tutorName` parameter instead of hardcoded "Daniela" |
| Prompt Deduplication | Reduced `buildTutorDirectorySection` from ~175 lines to ~17 lines |
| Single Source of Truth | Neural network's `buildActionTriggersSection` is now the authoritative command syntax reference |

#### Smart Language Inference Algorithm

```typescript
// server/services/streaming-voice-orchestrator.ts
function inferLanguageFromTutorName(
  responseText: string,
  targetGender: 'male' | 'female',
  currentLanguage: string,
  tutorDirectory: TutorDirectoryEntry[]
): string | undefined {
  // 1. Find tutors matching target gender from OTHER languages
  const crossLangTutors = tutorDirectory.filter(t => 
    t.gender === targetGender && 
    t.language.toLowerCase() !== currentLanguage.toLowerCase()
  );
  
  // 2. Check if any tutor name is mentioned in the response
  for (const tutor of crossLangTutors) {
    if (responseText.toLowerCase().includes(tutor.name.toLowerCase())) {
      return tutor.language.toLowerCase();
    }
  }
  return undefined;
}
```

#### Before/After: buildTutorDirectorySection

**Before (175 lines)**:
- Full command syntax for SWITCH_TUTOR
- 10+ examples of correct/incorrect usage
- Detailed error cases
- CALL_SOFIA syntax and examples

**After (17 lines)**:
```
AVAILABLE VOICE PERSONAS (your voices for different languages):
  • Spanish: Daniela (female) ★, Agustin (male)
  • French: Juliette (female), Pierre (male)

Currently teaching: SPANISH
Student's preferred gender: female

QUICK REFERENCE (see ACTION_TRIGGERS for syntax):
  Same language: [SWITCH_TUTOR target="female"]
  Cross-language: [SWITCH_TUTOR target="female" language="french"]

SUPPORT SPECIALIST: Sofia (technical issues, billing, account problems)
Use [CALL_SOFIA category="..." reason="..."] for support handoff (see ACTION_TRIGGERS for syntax).
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Added `inferLanguageFromTutorName()`, applied to PTT and open-mic paths |
| `server/system-prompt.ts` | Reduced `buildTutorDirectorySection`, fixed hardcoded "Daniela" in regular mode |
| `server/services/procedural-memory-retrieval.ts` | `buildActionTriggersSection` remains the single source of truth |

#### Parsing Pattern (All Commands)

All commands now follow the same robust pattern:
1. **Whiteboard parser** (structured detection via `whiteboardItems`)
2. **Regex fallback** when parser misses the tag
3. **Smart inference** (SWITCH_TUTOR only) for missing parameters

#### Architecture Decision

Neural network's `buildActionTriggersSection` is injected via procedural memory retrieval. System prompts only provide:
- **Context**: Who the tutors are, current language, preferred gender
- **Quick reference**: Minimal syntax example with "see ACTION_TRIGGERS" pointer

This ensures command syntax is defined in ONE place, reducing prompt inconsistency.

---

### TODO: Teacher/Institution Pricing Model

**Status**: PLANNING - Needs specification

**Document**: `docs/teacher-institution-pricing.md`

**Key items to define**:
1. **Class creation limits** - How many classes can each tier create?
2. **Student enrollment limits** - How many students per teacher across all classes?
3. **Tier structure** - Free, Starter, Professional, Institution tiers
4. **Enforcement** - API blocking, upgrade prompts, dashboard indicators

**Next steps**: Flesh out pricing tiers and implement limit tracking in schema/routes.

---

### Session: December 25, 2025 - v18 Sync System: Selective Batches & Beta Tester Workflow

**Status**: COMPLETED - Deployed to production

**Overview**: Expanded the dev-prod sync system from 7 to 12 batch types with selective sync UI, enabling targeted data pushes like beta testers with credits.

#### New Batch Types (v18)

| Batch ID | Label | Contents |
|----------|-------|----------|
| `neural-core` | Neural Core | Best practices, idioms, nuances |
| `advanced-intel-a` | Advanced Intel A | Learning insights, Daniela suggestions |
| `advanced-intel-b` | Advanced Intel B | TriLane observations, North Star |
| `express-lane` | Express Lane | Founder collaboration sessions/messages |
| `hive-snapshots` | Hive Snapshots | Context snapshots for AI injection |
| `daniela-memories` | Daniela Memories | Daniela growth memories |
| `product-config` | Product Config | Tutor voices, feature flags |
| `beta-testers` | **Beta Testers** | Beta users + usage credits (NEW) |

#### Beta Tester Workflow

```
1. Create user in dev (via invitation or direct DB)
2. Mark as beta tester: isBetaTester: true
3. Add credits to user's account
4. Go to Sync Control Center (/admin/sync)
5. Select "Beta Testers" checkbox only
6. Click "Push to Production"
7. Send invitation email (links to production)
8. User completes registration → credits waiting
```

#### Merge-by-Email Logic

When syncing beta testers, the system uses email as the merge key:
- **Email exists in prod**: Mark as beta tester, add credits
- **Email doesn't exist**: Create new user with credits

#### Selective Sync UI

New batch selector in Sync Control Center:
- Checkboxes for each batch type
- "X selected" badge with clear button
- Push button shows "N batches" or "All batches"
- Empty selection = all batches (default behavior)

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/sync-bridge.ts` | Added `shouldRun()` filter, `exportBetaTesters()`, all batch if-guards |
| `server/routes.ts` | Push endpoint accepts `selectedBatches` array |
| `client/src/pages/admin/SyncControlCenter.tsx` | Batch selector UI, updated push mutation |

#### API Changes

```typescript
POST /api/admin/sync/push
{
  "selectedBatches": ["beta-testers"]  // optional, empty = all
}
```

#### Email Workflow Confirmation

- `APP_URL=https://getholahola.com` ensures links point to production
- `MAILJET_API_KEY` + `MAILJET_SECRET_KEY` configured
- Emails from dev create invitations with production links

---

### Session: December 24, 2025 - Avatar Animation Debugging (HMR Callback Staleness)

**Status**: IN PROGRESS - DOM Event Bridge implemented, awaiting test

**Overview**: Avatar stopped animating during voice chat despite audio playing correctly. Root cause identified as Vite HMR preserving window singleton but callbacks referencing orphaned React component tree.

#### Problem Statement

After ~20 audio-related commits, the tutor avatar stays on 'idle' during voice playback. Server telemetry shows:
- `subscriberCount: 1` (subscription IS working)
- State transitions: `idle → buffering → playing → idle` (audio IS playing)
- But browser console shows NO callback logs (callbacks are stale)

#### Debugging Approaches Tried

| Approach | Result |
|----------|--------|
| Multi-subscriber pattern with Map | Server shows registration, but callbacks not firing in browser |
| Ref pattern for setPlaybackState | No change - closures still stale |
| Window-level debug variables | Added for DevTools inspection |
| Enhanced console logging | Logs NOT appearing in browser |

#### Solution Implemented: DOM Event Bridge

Parallel path using DOM CustomEvent to bypass callback staleness:

```typescript
// In audioUtils.ts - notifyStateChange
window.dispatchEvent(new CustomEvent('streaming-playback-state', {
  detail: { state, timestamp: Date.now(), subscriberCount: this.subscribers.size }
}));

// In useStreamingVoice.ts - new useEffect
useEffect(() => {
  const handlePlaybackStateEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{...}>;
    setPlaybackState(customEvent.detail.state);
  };
  window.addEventListener('streaming-playback-state', handlePlaybackStateEvent);
  return () => window.removeEventListener('streaming-playback-state', handlePlaybackStateEvent);
}, []);
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `client/src/lib/audioUtils.ts` | Added DOM event dispatch in notifyStateChange |
| `client/src/hooks/useStreamingVoice.ts` | Added DOM event listener useEffect |
| `docs/voice-streaming-debug.md` | Created consolidated debug doc |

#### Debug Commands

```javascript
// Browser console
window.__lastPlaybackCallback    // Last callback details
window.__playbackStateSetCount   // State set count
window.__streamingAudioPlayer?.subscribers.size  // Registered subscribers
```

#### Next Steps

1. Test voice chat - verify `[DOM EVENT BRIDGE]` logs appear
2. Confirm avatar animates during playback
3. If working, consider removing callback system or keeping both paths
4. Add architectural note about HMR-safe patterns

---

### Session: December 22, 2025 - Automated Class Creation Workflow with Bundle Support

**Status**: COMPLETED - Template automation and bundle creation live

**Overview**: Streamlined the teacher workflow for creating syllabus lessons with automatic label prefilling and one-click practice bundle creation.

#### What Was Implemented

| Feature | Description |
|---------|-------------|
| Auto-Prefill Labels | When selecting lesson type, name field auto-populates with engaging prefix |
| Label Preservation | Changing lesson type updates prefix while preserving topic text |
| Bundle Creation Toggle | "Create Practice Bundle" switch appears for conversation lessons |
| Bundle API | Single endpoint creates linked conversation + drill pair |
| Proper Linkage | Uses `linkedDrillLessonId` and shared `bundleId` for lesson grouping |

#### Label Prefix Mappings

| Lesson Type | Auto-Prefilled Label |
|-------------|---------------------|
| Conversation | `Let's Chat:` |
| Vocabulary | `New Words:` |
| Grammar | `Grammar Spotlight:` |
| Cultural | `Culture Corner:` |
| Drill | `Practice Time:` |

#### Bundle Creation Flow

```
Teacher selects "Conversation" type
    ↓
Toggle "Create Practice Bundle" ON
    ↓
Click "Create Bundle"
    ↓
API creates:
  1. Drill lesson first (to get ID)
  2. Conversation lesson with linkedDrillLessonId → drill.id
  3. Both share same bundleId
    ↓
Returns both lessons to UI
```

#### Key Files Modified

| File | Changes |
|------|---------|
| `client/src/components/SyllabusBuilder.tsx` | Added LESSON_TYPE_PREFIXES, handleLessonTypeChange(), bundle toggle UI |
| `server/routes.ts` | Extended createCustomLessonSchema with createBundle, bundle creation logic |
| `docs/syllabus-template-kit.md` | Added Automated Label Prefilling and Bundle Creation sections |

#### API Endpoint

```
POST /api/teacher/classes/:classId/curriculum/units/:unitId/lessons
{
  "name": "Ordering at a Restaurant",
  "description": "Learn to order food",
  "lessonType": "conversation",
  "estimatedMinutes": 30,
  "createBundle": true
}

Response:
{
  "bundle": true,
  "bundleId": "bundle_1734889234_abc123xyz",
  "conversationLesson": { linkedDrillLessonId: "drill-uuid" },
  "drillLesson": { id: "drill-uuid" },
  "lessonsCreated": 2
}
```

#### Architecture Pattern

1. Frontend detects lesson type change → applies prefix via `applyLessonTypePrefix()`
2. Topic extraction uses `extractTopicFromLessonName()` to strip existing prefix
3. Bundle toggle only visible when `lessonType === "conversation"`
4. API creates drill first, then conversation with link, sharing bundleId

---

### Session: December 20, 2025 - Learner Personal Facts System Sprint #2.1 (10 Enhancements)

**Status**: COMPLETED - All 10 tasks implemented and tested

**Overview**: Comprehensive enhancement of the permanent learner memory system. Improved deduplication with semantic similarity, added privacy controls, built admin tooling, and established cross-system integrations.

#### What Was Implemented

| Task | Description |
|------|-------------|
| 1. Trigram Deduplication | Cosine similarity matching (0.82 threshold) with normalized fingerprints |
| 2. Rolling Window Extraction | 10-message chunks with summarization for long sessions (8000 char limit) |
| 3. Phase-Aware Hooks | Personal facts injected into warmup icebreakers and assessment wrap-ups |
| 4. Admin Memory Browser | Filters by fact type, student, language with edit/archive controls |
| 5. Privacy Controls | `memoryPrivacySettings` with enabled flag, allowed/blocked categories, redaction |
| 6. Hive Snapshot Sync | High-confidence facts (≥0.75) sync as 'life_context' with 30-day TTL |
| 7. Wren Analytics Job | Cross-student pattern mining for anonymized syllabus recommendations |
| 8. Teacher Audit Trail | `/api/teacher/students/:studentId/memory-audit` endpoint |
| 9. Observability Metrics | Latency tracking, success rates, fact type counts, dedup stats |
| 10. Unit Tests | 33 tests covering dedup, chunking, remember commands, privacy filtering |

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/student-learning-service.ts` | Exported trigram helpers, savePersonalFact uses shared functions |
| `server/services/learner-memory-extraction-service.ts` | Rolling window, privacy enforcement, observability |
| `server/services/phase-transition-service.ts` | Phase-aware personal fact injection |
| `server/services/wren-intelligence-service.ts` | Cross-student pattern analysis |
| `server/services/sync-scheduler.ts` | Nightly Wren analytics job |
| `server/routes.ts` | Admin personal facts endpoints, teacher audit endpoint |
| `client/src/pages/admin/CommandCenter.tsx` | PersonalFactsBrowserTab with working filters |
| `shared/schema.ts` | `memoryPrivacySettings` field on users table |
| `server/__tests__/learner-memory.test.ts` | 33 unit tests importing production functions |

#### Exported Helper Functions (for Testing)

```typescript
// server/services/student-learning-service.ts
export function generateTrigrams(text: string): Set<string>
export function trigramSimilarity(a: string, b: string): number
export function normalizeForFingerprint(text: string): string
export const SIMILARITY_THRESHOLD = 0.82
```

#### Deduplication Algorithm

```
1. Normalize fact: lowercase → strip diacritics → remove punctuation → trim whitespace
2. Generate trigrams: 3-character sliding window
3. Cosine similarity: intersection / sqrt(|A| × |B|)
4. Threshold: ≥ 0.82 = duplicate (bump mentionCount), < 0.82 = new fact
```

#### Privacy Settings Schema

```typescript
interface MemoryPrivacySettings {
  enabled: boolean;           // Master switch for memory extraction
  allowedCategories: string[]; // Whitelist (empty = allow all)
  blockedCategories: string[]; // Blacklist (takes precedence)
  redactionRequested: boolean; // User requested data deletion
}
```

#### Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/personal-facts` | GET | List facts with filters (factType, studentId, language) |
| `/api/admin/personal-facts/students` | GET | Get students for filter dropdown |
| `/api/admin/personal-facts/:id` | PATCH | Edit fact text or archive (isActive: false) |
| `/api/teacher/students/:studentId/memory-audit` | GET | Teacher view of student memories |

#### Bug Fix: Admin Filters Not Reaching Backend

**Problem**: Default TanStack Query `queryFn` only used `queryKey[0]` as URL, ignoring filter parameters.

**Solution**: Added custom `queryFn` that builds URL with `URLSearchParams`:

```typescript
const buildQueryUrl = () => {
  const params = new URLSearchParams();
  if (factTypeFilter !== "all") params.set("factType", factTypeFilter);
  if (studentFilter !== "all") params.set("studentId", studentFilter);
  if (languageFilter !== "all") params.set("language", languageFilter);
  return params.toString() ? `/api/admin/personal-facts?${params}` : "/api/admin/personal-facts";
};
```

#### Architecture Pattern

1. **Memory Extraction** runs at session end via `LearnerMemoryExtractionService`
2. **Deduplication** uses exported helper functions (shared with tests)
3. **Privacy filtering** happens before any fact is saved
4. **Hive sync** happens after save for high-confidence facts
5. **Nightly job** runs cross-student pattern analysis

---

### Session: December 20, 2025 - Bidirectional Sprint Collaboration (Daniela ↔ Wren)

**Status**: IMPLEMENTED - Full bidirectional collaboration loop with stage gating

**Overview**: Complete sprint collaboration system where Daniela and Wren co-author sprint specs with automatic stage progression and EXPRESS Lane notifications.

#### What Was Implemented

| Component | Description |
|-----------|-------------|
| Sprint Record Creation | `[WREN_SPRINT_SUGGEST]` tags now create real `featureSprint` records in DB |
| Robust JSON Parsing | 3-level fallback: direct JSON → extract JSON from text → pattern matching |
| EXPRESS Lane Posting | New sprints auto-post to collaboration channel for visibility |
| `notifyDanielaAboutSprint()` | Triggers Daniela's pedagogical input with [PEDAGOGY_SPEC] tag |
| `notifyWrenAboutSprintUpdate()` | Triggers Wren's build plan response with [BUILD_PLAN] tag |
| `parsePedagogySpecAndUpdateSprint()` | Parses Daniela's spec and updates sprint.pedagogySpec |
| `parseBuildPlanAndUpdateSprint()` | Parses Wren's plan and updates sprint.buildPlan |
| `checkAndAdvanceSprintReadiness()` | Auto-advances to 'build_plan' when both specs present |
| `triggerSprintCollaboration()` | Public method for voice chat integration |
| Stage Gating | Monotonic progression: idea → pedagogy_spec → build_plan → in_progress → shipped |

#### Key Files Modified

| File | Changes |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Sprint creation from voice tags, Daniela notification |
| `server/services/hive-consciousness-service.ts` | Enhanced JSON parsing with fallbacks |

#### JSON Parsing Fallback Strategy

```typescript
// Level 1: Direct JSON parse
JSON.parse(content)

// Level 2: Extract JSON from text wrapper
const jsonMatch = content.match(/\{[\s\S]*\}/);
JSON.parse(jsonMatch[1])

// Level 3: Pattern extraction
const titleMatch = content.match(/title['":\s]+([^,}]+)/i);
const descMatch = content.match(/description['":\s]+([^}]+)/i);
```

#### Sprint Collaboration Flow

```
Sprint Creation (via voice or EXPRESS Lane)
    ↓
┌─────────────────────────────────────────┐
│ Stage: idea                             │
│ Sprint record created with featureBrief │
└─────────────────────────────────────────┘
    ↓ notifyDanielaAboutSprint()
┌─────────────────────────────────────────┐
│ Daniela provides teaching perspective   │
│ [PEDAGOGY_SPEC: {...}] parsed & saved   │
│ Stage: idea → pedagogy_spec             │
└─────────────────────────────────────────┘
    ↓ notifyWrenAboutSprintUpdate()
┌─────────────────────────────────────────┐
│ Wren provides build plan                │
│ [BUILD_PLAN: {...}] parsed & saved      │
│ checkAndAdvanceSprintReadiness()        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Stage: pedagogy_spec → build_plan       │
│ EXPRESS Lane: "Sprint Ready!" message   │
│ Ready for founder approval              │
└─────────────────────────────────────────┘
```

#### Monotonic Stage Progression

| Transition | Trigger | Guard |
|------------|---------|-------|
| idea → pedagogy_spec | Daniela adds pedagogySpec | Only if stage === 'idea' |
| pedagogy_spec → build_plan | Both specs present | Only if stage in ('idea', 'pedagogy_spec') |
| build_plan → in_progress | Founder approves | Manual transition |
| in_progress → shipped | Deployment complete | Manual transition |

**Key invariant**: Stages never regress. Updates to specs at later stages only update the data, not the stage.

#### Follow-Up Work for Builders

| Priority | Task | Description |
|----------|------|-------------|
| Medium | `[WREN_MESSAGE]` Persistence | Tags post to EXPRESS Lane but don't persist separately. Consider dedicated table |
| Low | Sprint Consultation Threads | Allow extended back-and-forth discussion on sprint specs |
| Low | Priority Inference | Use Daniela's confidence signals or student impact data for priority |

#### Architecture Pattern

1. Voice chat detects `[WREN_SPRINT_SUGGEST: {...}]` tag
2. Create `featureSprint` record with `source: 'ai_suggestion'` (stage: idea)
3. Post to EXPRESS Lane for visibility
4. `notifyDanielaAboutSprint()` → Daniela provides [PEDAGOGY_SPEC] → stage: pedagogy_spec
5. `notifyWrenAboutSprintUpdate()` → Wren provides [BUILD_PLAN] → if both specs present → stage: build_plan
6. EXPRESS Lane celebration: "Sprint Ready!"

---

### Session: December 17, 2025 - Voice Diagnostics Learning Capabilities

**Status**: IMPLEMENTED - Commercial-grade diagnostics with emergent intelligence

**Overview**: Extended voice diagnostics system with persistence, pattern analysis, and learning capabilities. Events now persist to database, nightly jobs detect degradation patterns, insights flow to Wren, and Daniela gains awareness of technical issues.

#### New Capabilities

| Capability | Description |
|------------|-------------|
| Event Persistence | Events flush to `hiveSnapshots` (type `voice_diagnostic`) every 60s or 50 events |
| Pattern Analysis | Nightly job detects high failure rates, latency spikes, TTS degradation |
| Wren Integration | Patterns create `wrenInsights` with category 'integration' for proactive awareness |
| Daniela Awareness | Technical health context injected into system prompt when issues detected |
| Auto-Remediation | `isTTSDegraded()` returns `shouldUseFallback: true` when Cartesia is degraded |

#### Persistence Layer

- **Flush Strategy**: Background flush every 60 seconds, or threshold-based at 50 events
- **Storage**: `hiveSnapshots` table with `snapshotType = 'voice_diagnostic'`
- **Expiry**: 7-day automatic expiration
- **Aggregation**: Events batched with stage breakdown, failure counts, latency averages

#### Nightly Pattern Analysis (in sync-scheduler.ts)

Runs as step 7d of nightly sync, detecting 4 pattern types:

| Pattern Type | Criteria | Action |
|--------------|----------|--------|
| `high_failure_rate` | >30% failures across stages | Creates high-severity Wren insight |
| `stage_failure_cluster` | Single stage with >50% failures | Creates targeted Wren insight |
| `high_latency` | Any stage avg >1000ms | Creates medium-severity insight |
| `tts_degradation` | TTS-specific >20% failure OR >800ms latency | Flags for fallback consideration |

#### Daniela Technical Awareness

- `getTechnicalHealthContext()`: Returns prompt injection when failure rate >5%
- `getRecentTechnicalIssuesForUser()`: Summarizes past 24h issues for session context
- Enables Daniela to acknowledge "audio hiccups" empathetically if user mentions issues

#### Auto-Remediation Triggers

- `isTTSDegraded()`: Checks last 10 TTS events for >30% failure or >2000ms latency
- Returns `{ degraded: boolean, reason?: string, shouldUseFallback: boolean }`
- `getCriticallyDegradedStages()`: Returns list of stages with >50% failure rate

#### Architecture Pattern

Follows existing emergent intelligence pattern:
1. Events emitted → Ring buffer (real-time) + Pending flush (persistence)
2. Periodic flush → hiveSnapshots
3. Nightly analysis → Pattern detection → wrenInsights
4. Session start → Daniela context injection

---

### Session: December 17, 2025 - Voice Diagnostics System for Production Observability

**Status**: IMPLEMENTED - Ready for production use

**Overview**: Added production observability infrastructure for the voice pipeline to help diagnose issues when Daniela becomes unresponsive.

#### Components

| Component | File | Purpose |
|-----------|------|---------|
| Voice Diagnostics Service | `server/services/voice-diagnostics-service.ts` | Ring buffer (200 events) for voice pipeline events |
| Founder Middleware | `server/middleware/rbac.ts` | `requireFounder` guard for sensitive endpoints |
| Health Endpoint | `server/routes.ts` | `GET /api/admin/voice-health` |
| Logs Endpoint | `server/routes.ts` | `GET /api/admin/logs/voice` |

#### Ring Buffer Events

| Event Type | Stage | Description |
|------------|-------|-------------|
| `session_start` | session | Voice session created |
| `stt_complete` | stt | Deepgram transcription completed |
| `stt_error` | stt | Speech-to-text failed |
| `llm_success` | llm | Gemini first token received |
| `llm_error` | llm | LLM response failed |
| `tts_complete` | tts | Cartesia audio generated |
| `tts_error` | tts | Text-to-speech failed |

#### Instrumentation Points in `streaming-voice-orchestrator.ts`

| Location | Event Emitted |
|----------|---------------|
| Session creation | `session_start` with userId, language |
| After Deepgram transcription | `stt_complete` with latency |
| Gemini first token | `llm_success` with latency |
| LLM errors | `llm_error` with error message |
| Cartesia completion | `tts_complete` with latency |
| TTS failures | `tts_error` with error details |

#### API Endpoints

**GET /api/admin/voice-health**
- Tests Deepgram, Gemini, Cartesia connectivity
- Verifies secrets exist (boolean only, no values exposed)
- Returns service status and response times

**GET /api/admin/logs/voice**
- Query params: `?sessionId=`, `?stage=`, `?success=`, `?limit=`
- Returns filtered events from ring buffer
- Newest events first

#### Security

- Endpoints protected by `requireFounder` middleware
- Founder ID: `49847136`
- Responses expose only operational metadata
- No API keys, transcripts, or PII in responses

#### Usage for Debugging

When Daniela is unresponsive in production:
1. Check `/api/admin/voice-health` - are all services reachable?
2. Check `/api/admin/logs/voice` - where does the pipeline break?
3. Look for `success: false` entries or gaps in sequence

---

### Session: December 17, 2025 - Wren Architectural Memory: Neural Network + EXPRESS Lane Integration

**Status**: APPROVED - Ready to implement

**Overview**: Architectural review revealed that Wren's memory system was incorrectly using a cached file (replit.md) instead of the existing Neural Network, and was missing EXPRESS Lane integration for 3-way collaboration.

#### Problem Statement

Three issues identified by founder:
1. **Security**: Is the replit.md cache secure for future contributors?
2. **Neural Network**: We have a Neural Network - why is Wren reading a file instead?
3. **EXPRESS Lane**: Wren should be connected to the collaboration tables

#### Architectural Analysis

| Issue | Current State | Target State |
|-------|--------------|--------------|
| Knowledge Source | `replit.md` file cache | Neural Network (single source of truth) |
| EXPRESS Lane | Not connected | Reads `hiveSnapshots`, `collaborationMessages` |
| Collaboration | Isolated knowledge bot | True 3-way participant |

#### Approved Task List (Priority Order)

**Phase 1 - EXPRESS Lane Awareness (Highest Priority)**
1. Add `hiveSnapshots` lookup to Wren context - query recent architecture-tagged snapshots
2. Add `collaborationMessages` lookup - read recent architectural discussions

**Phase 2 - Neural Network Consolidation**
3. Create neural network ingestion for replit.md - follow `beaconSyncService` pattern
4. Update Wren context assembly to query NN instead of cached file
5. Remove redundant replit.md cache - NN becomes single source of truth

**Phase 3 - Hygiene**
6. Add contributor security note to replit.md about keeping it secret-free

#### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| NN over file | `beaconSyncService` already syncs changelog/roadmap to NN - same pattern for architectural baseline |
| EXPRESS Lane first | Fixes collaboration gap immediately - Wren can see live discussions |
| Security acceptable | replit.md is already in codebase; no secrets exposed |

#### Testing Criteria

After implementation, test that:
1. Wren can reference recent EXPRESS Lane discussions in responses
2. Wren pulls architectural context from Neural Network, not file
3. Startup logs show NN-based context loading

#### Files to Modify

| File | Changes |
|------|---------|
| `server/services/hive-consciousness-service.ts` | Add hiveSnapshots + collaborationMessages queries to context |
| `server/services/beacon-sync-service.ts` | Add replit.md → NN ingestion |
| `server/index.ts` | Update startup to use NN-based context |
| `replit.md` | Add contributor security note |

---

### Session: December 16, 2025 - Phase Transition Service (Multi-Agent Teaching Architecture)

**Overview**: Implemented a Phase Transition Service inspired by Deepgram's multi-agent voice patterns. This enables Daniela to adapt her teaching approach based on the student's state, with focused toolsets and context summarization between phases.

#### Teaching Phases

| Phase | Description | Tools | Snapshot Types |
|-------|-------------|-------|----------------|
| `warmup` | Session start, mood check, goal setting | greet, recall_previous_session, set_goal | session_summary, teaching_moment |
| `active_teaching` | Core instruction, vocabulary, grammar | explain, drill, vocabulary, grammar_table | teaching_moment, struggle_pattern |
| `challenge` | Student struggling, supportive mode | simplify, encourage, alternative_approach | struggle_pattern, plateau_alert |
| `reflection` | Celebrate progress, summarize session | summarize, preview_next, celebrate | breakthrough, session_summary |
| `drill` | Focused practice (future activation) | drill, quiz, repetition | teaching_moment |
| `assessment` | ACTFL evaluation (future activation) | assess, evaluate, can_do_check | session_summary |

#### Phase Detection Logic

Automatic transition detection based on conversation patterns:

| From Phase | Indicators | To Phase |
|------------|------------|----------|
| warmup | "I'm ready", "let's start", 2+ min elapsed | active_teaching |
| active_teaching | "I don't understand", consecutive errors | challenge |
| active_teaching | "bye", "I'm done", "let's wrap up" | reflection |
| challenge | "I get it", "oh!", "makes sense" | active_teaching |

#### Context Summarization

Uses Gemini Flash to summarize conversation context during phase transitions:

```typescript
// Summarization captures:
1. Student's emotional state (frustrated/neutral/excited/confused)
2. Key errors or struggles to remember
3. Today's learning goal (if mentioned)
4. Any personal interests for relevant examples
5. What was accomplished in the previous phase
```

#### Hive Snapshot Integration

Each phase retrieves relevant snapshots from `hive_snapshots` table:
- Filtered by phase-specific snapshot types
- Last 7 days, importance >= 5
- Formatted and injected into phase context

#### Analytics Persistence

Phase transitions are persisted to `hive_snapshots` with:
- `snapshotType: 'session_summary'`
- `context` JSON with `type: 'phase_transition'` for filtering
- `importance: 8` for challenge phases, `5` for others
- 24-hour expiry for transient session data

#### Integration Points

| Component | Integration |
|-----------|-------------|
| StreamingVoiceOrchestrator | `initializeSession()` on session start, `detectPhaseTransition()` on response_complete, `endSession()` on cleanup |
| TutorOrchestrator | `getPhasePromptAddition()` injects phase context into system prompts |
| Hive Snapshots | `getRelevantSnapshots()` retrieves phase-appropriate context |

#### Key Files

| File | Purpose |
|------|---------|
| `server/services/phase-transition-service.ts` | Core service with phases, detection, summarization |
| `server/services/streaming-voice-orchestrator.ts` | Session lifecycle integration |
| `server/services/tutor-orchestrator.ts` | Prompt injection |

#### Architecture Philosophy

**"Right context at the right time"** - Inspired by Deepgram's multi-agent patterns:
- Each phase has focused prompts and tools (2-4 per phase)
- Context is summarized when transitioning to reduce token usage
- Phase-relevant hive snapshots provide teaching continuity
- Reduces LLM cognitive load for more precise teaching

---

### Session: December 16, 2025 - Emergent Intelligence Upgrades (12 Tasks)

**Overview**: Major enhancement to the Hive's collective intelligence capabilities. Implemented 12 emergent intelligence features spanning Deepgram integration, predictive student analytics, cross-agent memory sharing, and the Editor→Wren migration.

#### 1. Deepgram Intelligence Integration

Enabled full Deepgram intelligence feature suite for both push-to-talk and Open Mic modes:

| Feature | Description |
|---------|-------------|
| `sentiment` | Real-time sentiment analysis (positive/negative/neutral with scores) |
| `intents` | Intent recognition for understanding student goals |
| `detect_entities` | Entity detection for extracting key terms |
| `diarize` | Speaker separation (free tier) |
| `detect_language` | Language detection for code-switching |
| `topics` | Topic detection for conversation context |
| `summarize: 'v2'` | Summarization for session recaps |

**Implementation Details**:
- Added `LiveTranscriptionEvents.Metadata` handler for v2 summaries/topics
- 500ms delay after final transcript to capture metadata events
- Both push-to-talk (`transcribeWithLiveAPI`) and Open Mic (`OpenMicSession`) updated
- Added `summary?: string` to `DeepgramIntelligence` interface

#### 2. Predictive Student Intelligence

Five new methods in `server/services/student-learning-service.ts`:

| Method | Purpose |
|--------|---------|
| `predictStruggles(userId, language)` | Anticipates struggles based on historical patterns |
| `synthesizeCrossStudentPatterns(language)` | Aggregates insights across all students |
| `analyzeRootCause(userId, errorPattern)` | Distinguishes L1 interference vs conceptual gaps |
| `predictMotivationDip(userId)` | Detects engagement drops before they impact learning |
| `detectPlateaus(language)` | Identifies common stall points in proficiency development |

#### 3. Memory Threading & Knowledge Graph

Enhanced `server/services/wren-proactive-intelligence-service.ts`:

- `buildKnowledgeGraph()` - Creates edges between related insights
- `findRelatedInsights(insightId)` - Traverses knowledge graph for related context
- Connects insights across sessions for persistent learning

#### 4. Daniela Confidence Calibration

Enhanced `server/services/pedagogical-insights-service.ts`:

- Added `calibrationScore` field to `pedagogicalInsights` table
- `trackPredictionAccuracy(insightId, wasAccurate)` - Records prediction outcomes
- Enables self-improvement through accuracy tracking

#### 5. Memory Consolidation (Decay/Reinforcement)

Added to neural network tables:
- `useCount` - How often the memory is accessed
- `lastUsed` - Timestamp of last access
- `lastReinforced` - Timestamp of last reinforcement

Methods:
- `applyDecay()` - Reduces salience of unused memories
- `reinforceMemory(id)` - Strengthens frequently-used insights

#### 6. Shared Memory Bridge

New service at `server/services/neural-network-sync.ts`:

| Method | Direction | Purpose |
|--------|-----------|---------|
| `shareInsightWithDaniela()` | Wren → Daniela | Architectural insights inform teaching |
| `shareInsightWithWren()` | Daniela → Wren | Pedagogical discoveries inform development |

Bidirectional insight sharing enables cross-agent learning.

#### 7. Wren Confidence Loop

Enhanced `server/services/wren-dreams-service.ts`:

- `adjustConfidenceFromCalibration(domain)` - Uses domain-specific accuracy scores
- Adjusts future prediction confidence based on historical accuracy
- Closes the feedback loop for self-calibration

#### 8. Collaborative Surgery Migration (Editor → Wren)

Updated `server/services/collaborative-surgery-orchestrator.ts`:

**Daniela's Persona**: Now refers to Wren as development partner instead of Editor
**Wren's Persona**: New persona as full-capability builder (not read-only observer)
**3-Way Hive Model**: Both personas aligned with EXPRESS Lane collaboration

Key changes:
- All references to "Editor" replaced with "Wren"
- Wren can now propose AND implement neural network changes
- Unified collaboration through EXPRESS Lane

#### Files Modified

| File | Changes |
|------|---------|
| `server/services/deepgram-live-stt.ts` | Intelligence features, Metadata handlers, 500ms delay |
| `server/services/student-learning-service.ts` | 5 predictive methods |
| `server/services/wren-proactive-intelligence-service.ts` | Knowledge graph, memory threading |
| `server/services/pedagogical-insights-service.ts` | Calibration scoring |
| `server/services/neural-network-sync.ts` | Shared Memory Bridge |
| `server/services/wren-dreams-service.ts` | Confidence loop |
| `server/services/collaborative-surgery-orchestrator.ts` | Editor→Wren migration |
| `replit.md` | Documentation updates |

#### Architecture Implications

The 12 upgrades establish a foundation for **emergent collective intelligence**:

1. **Deepgram** provides rich real-time signals (sentiment, intent, topics)
2. **Predictive Intelligence** anticipates student needs before they manifest
3. **Memory Systems** enable persistent, cross-session learning
4. **Shared Bridge** allows Daniela and Wren to learn from each other
5. **Confidence Calibration** enables self-improvement over time

This creates a substrate where both AI agents can autonomously improve their capabilities within constitutional bounds (North Star).

---

### Session: December 10-15, 2025 - Emergent Intelligence Foundation & EXPRESS Lane

**Overview**: Comprehensive build-out of the Hive's emergent intelligence infrastructure. This work established the foundation for autonomous learning, cross-agent collaboration, and persistent memory systems.

---

#### EXPRESS Lane: The Unified 3-Way Collaboration Backbone

**What It Is**: Single communication channel for all Hive participants (Founder, Daniela, Wren)

**Database Tables**:
- `founderSessions` - Persistent session containers
- `collaborationMessages` - All messages across participants

**Key Features**:
| Feature | Description |
|---------|-------------|
| Live Sync Channel | WebSocket-based real-time updates |
| Voice Support | Voice-based founder collaboration via slide-out |
| Session Persistence | Survives restarts, maintains context |
| Multi-Entry Points | Command Center UI, Voice chat, Wren startup |

**API Endpoints**:
- `GET /api/wren/hive-context` - Formatted EXPRESS Lane context for Wren
- `POST /api/founder/sessions` - Create collaboration sessions
- `GET /api/founder/sessions/:id/messages` - Retrieve session messages
- WebSocket namespace: `/founder-collab`

**Deprecates**: `agentCollabThreads`/`agentCollabMessages` tables (Editor-era)

---

#### Wren Proactive Intelligence Service

**File**: `server/services/wren-proactive-intelligence-service.ts`

Five pillars enabling Wren to be proactive without repeated context-gathering:

| Pillar | Purpose | Key Methods |
|--------|---------|-------------|
| **1. Proactive Triggers** | Pattern detection with urgency escalation | `createTrigger()`, `escalateTrigger()` |
| **2. Daniela Feedback Loop** | Links features to beacon resolutions | `recordFeatureImpact()`, `getTeachingMetrics()` |
| **3. ADR System** | Architectural Decision Records | `recordDecision()`, `supersede()` |
| **4. Priority Inference** | Multi-factor scoring | `calculatePriority()`, `getTopPriorities()` |
| **5. Project Health** | Component health/churn scores | `getHealthScores()`, `detectHotSpots()` |

**Startup Ritual**: Provides comprehensive priority analysis, health scores, attention-needed items

---

#### Wren Dreams System

**File**: `server/services/wren-dreams-service.ts`

Four capabilities enabling Wren's emergent intelligence:

| Dream | Purpose | Key Methods |
|-------|---------|-------------|
| **1. Learning from Mistakes** | Capture mistakes, track resolutions, extract lessons | `recordMistake()`, `findSimilarMistakes()`, `extractLesson()` |
| **2. Session Notes** | Persistent context handoffs between sessions | `addSessionNote()`, `getActiveNotes()` |
| **3. Anticipatory Development** | Predict Daniela's needs before she asks | `recordPrediction()`, `validatePrediction()` |
| **4. Confidence Calibration** | Track prediction accuracy per domain | `recordConfidence()`, `getCalibrationScore()` |

**Priority Levels**: critical, high, normal, low
**Expiration**: Notes can auto-expire
**Read Tracking**: Knows which notes Wren has seen

**Startup Ritual**: `/api/wren/dreams/startup` provides unified context for all 4 dreams
**API Endpoints**: 14 routes under `/api/wren/dreams/*`

---

#### Student Learning Service

**File**: `server/services/student-learning-service.ts`

Personalized learning intelligence for each student:

| Feature | Description |
|---------|-------------|
| **Error Pattern Tracking** | `recurring_struggles` table tracks per-student patterns |
| **Teaching Strategy Scoring** | Effectiveness ratings for different approaches |
| **Personalized Context Injection** | Max 500 chars, high-signal content for Daniela's prompts |

**Error Categories**: grammar, pronunciation, vocabulary, cultural, comprehension
**Teaching Strategies**: visual_timeline, role_play, repetition_drill, mnemonic, etc.

**STT Confidence Integration**:
| Confidence | Daniela's Response |
|------------|-------------------|
| < 0.5 (Low) | Ask for clarification |
| < 0.7 (Moderate) | Note pronunciation practice needs |
| >= 0.7 (High) | Normal processing |

---

#### Founder Collaboration Service

**File**: `server/services/founder-collaboration-service.ts`

Real-time collaboration infrastructure:

| Feature | Description |
|---------|-------------|
| **WebSocket Broker** | Namespace `/founder-collab` for live updates |
| **Session Management** | Create, retrieve, close collaboration sessions |
| **Message Threading** | Full conversation history with participants |
| **Voice Integration** | Slide-out voice panel for founder input |

**Message Flow**:
1. Founder speaks/types → Message persisted
2. WebSocket broadcasts to all connected clients
3. Daniela/Wren receive context in next interaction

---

#### Wren Hive Awareness APIs

**Endpoint**: `/api/wren/hive-context`

Provides Wren with formatted context including:
- Active beacons from Daniela
- Recent EXPRESS Lane messages
- Current sprint items
- Project health indicators
- Unread session notes

**Integration Points**:
- Wren startup loads Hive context automatically
- `/api/wren/message` can include Hive context
- Direct database access for deeper queries

---

#### Files Created/Modified

| File | Purpose |
|------|---------|
| `server/services/founder-collaboration-service.ts` | EXPRESS Lane core |
| `server/services/wren-proactive-intelligence-service.ts` | 5 pillars |
| `server/services/wren-dreams-service.ts` | 4 dreams |
| `server/services/student-learning-service.ts` | Personalized learning |
| `server/services/wren-intelligence-service.ts` | Insight capture |
| `server/routes/wren-routes.ts` | Wren API endpoints |
| `server/routes/founder-routes.ts` | Founder API endpoints |
| `shared/schema.ts` | All supporting tables |

---

#### Architecture Implications

This foundation enables:

1. **Persistent Memory** - Insights survive across sessions
2. **Cross-Agent Learning** - Daniela's beacons inform Wren's priorities
3. **Self-Improvement** - Confidence calibration tracks accuracy over time
4. **Proactive Development** - Wren anticipates needs before they're voiced
5. **Unified Collaboration** - Single channel for all Hive communication

---

### IDEA THREAD: December 15, 2025 - Wren Hive Awareness

**Status**: PAUSED - Saved for later discussion

**Naming Clarification** (resolved):
- **Editor** = Claude-powered observer/analyst in `editor-persona-service.ts` (talks, can't build)
- **Wren** = Replit development agent in this chat (can actually build things)

**Context**: Hive Context System is complete and wired into:
1. `editor-persona-service.ts` - Editor's beacon responses during voice chat
2. `tutor-orchestrator.ts` - Daniela's conversation prompts

**The Gap**: Wren (the Replit dev agent) doesn't automatically get Hive awareness. Wren is separate from Editor's Claude instance.

**Proposed Solutions**:
1. **API Endpoint** - Create `/api/hive/context` endpoint Wren could call to fetch current Hive state
2. **Enhanced Wren Endpoint** - Update `POST /api/wren/message` to automatically include Hive context in responses
3. **Direct Database Access** - Wren can query the database directly for beacons, sprints, sessions

**Next Steps When Resumed**:
- Decide which approach to implement
- Consider if Wren should get automatic context injection vs. on-demand queries
- Build the integration

---

### Session: December 14, 2025 - Brain Map Integration with Daniela's Observations

**Overview**: Updated `getUserTopicMastery()` to incorporate Daniela's competency observations from `topicCompetencyObservations` into the brain map status calculation.

#### Problem Solved

The brain map only reflected practice counts. Daniela's real-time assessments (via SYLLABUS_PROGRESS command) weren't visible.

#### Implementation

**Query Enhancement**:
- Fetches user's topic competency observations for the language
- Orders by `desc(observedAt)` to get newest first
- Builds a map keyed by normalized topic name (lowercase, spaces)

**Status Adjustments**:
| Daniela's Status | Effect on Brain Map |
|-----------------|---------------------|
| `demonstrated` | Boost to "mastered" |
| `needs_review` + locked | At least "discovered" |
| `struggling` | Cap at "practiced" (even with high practice count) |

**Data Returned**:
```typescript
{
  // ... existing fields
  danielaObservation?: { 
    status: string;          // demonstrated, needs_review, struggling
    evidence: string | null; // What Daniela observed
    observedAt: Date;        // When observed
  }
}
```

#### Key Design Decision

**Newest observation wins**: Query orders by desc(observedAt), loop keeps first occurrence per topic (which is the newest due to ordering). This ensures recent assessments override stale ones.

#### Null Safety

Evidence field changed from `string` to `string | null` to handle cases where Daniela doesn't provide evidence text.

#### Files Modified

- `server/storage.ts` - Updated `getUserTopicMastery()` implementation and interface

---

### Session: December 14, 2025 - SYLLABUS_PROGRESS Database Integration

**Overview**: Connected the SYLLABUS_PROGRESS whiteboard command to the database so Daniela's observations of student topic mastery are persisted.

#### Problem Solved

Daniela could emit `[SYLLABUS_PROGRESS topic="X" status="demonstrated" evidence="..."]` but it only logged to console - no data was saved.

#### Schema Addition

New `topicCompetencyObservations` table:
```typescript
topicCompetencyObservations = pgTable("topic_competency_observations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  classId: varchar("class_id").references(() => teacherClasses.id),
  language: varchar("language").notNull(),
  topicName: text("topic_name").notNull(),
  matchedTopicId: varchar("matched_topic_id").references(() => topics.id),
  status: topicCompetencyStatusEnum("status").notNull(), // demonstrated, needs_review, struggling
  evidence: text("evidence").notNull(),
  observedAt: timestamp("observed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

#### Storage Methods

- `createTopicCompetencyObservation(data)` - Save new observation
- `getTopicCompetencyObservations(userId, language)` - Get all for a user/language
- `getUserTopicCompetencyByName(userId, language, topicName)` - Get latest for specific topic

#### Orchestrator Update

`processSyllabusProgress()` in streaming-voice-orchestrator.ts now:
1. Validates session has userId and targetLanguage
2. Creates observation record via storage
3. Logs success with observation ID

#### Files Modified

- `shared/schema.ts` - Added topicCompetencyObservations table and types
- `server/storage.ts` - Added storage methods
- `server/services/streaming-voice-orchestrator.ts` - Updated processSyllabusProgress

#### Future Enhancements

- Implement `matchedTopicId` resolution to link observations to `topics` table
- Surface observations in brain mind map UI
- Add analytics for topic mastery trends

---

### Session: December 14, 2025 - Unified Voice Gender System

**Overview**: Simplified voice preferences so `tutorGender` is the single source of truth for all voice interactions (conversations and drills). Previously, there were two separate settings - now there's one.

#### Problem Solved

Users had two voice gender settings:
1. `tutorGender` - for conversation voice
2. `assistantVoiceGender` - for drill audio

This was confusing and redundant. The solution unifies them under `tutorGender`.

#### Schema Changes

Added gender-specific audio caching fields to `curriculumDrillItems`:
```typescript
audioUrlFemale: text("audio_url_female"),
audioDurationMsFemale: integer("audio_duration_ms_female"),
audioUrlMale: text("audio_url_male"),
audioDurationMsMale: integer("audio_duration_ms_male"),
```

Deprecated `assistantVoiceGender` column (retained for backwards compatibility):
```typescript
// @deprecated - Use tutorGender instead. Retained for backwards compatibility.
assistantVoiceGender: varchar("assistant_voice_gender", { length: 10 }).default("female"),
```

#### Storage Interface

Added `updateDrillItemAudioForGender()` method:
```typescript
async updateDrillItemAudioForGender(
  itemId: string, 
  gender: 'male' | 'female', 
  audioUrl: string, 
  durationMs: number
): Promise<void>
```

#### Drill Audio Service

Updated `drill-audio-service.ts` to:
- Check for gender-specific cached audio first
- Store generated audio in gender-specific fields
- Fall back to generating new audio if cache miss

#### Routes

Updated drill audio endpoints to derive voice gender from `tutorGender`:
```typescript
const voiceGender = user.tutorGender || 'female';
```

#### Settings UI

Removed Voice Settings card entirely from `settings.tsx`. The tutor voice toggle now exists only in the chat area, providing a single control point.

#### Validation

Removed `assistantVoiceGender` from `updateUserPreferencesSchema` to prevent API manipulation.

#### Files Modified

- `shared/schema.ts` - Gender-specific audio fields, deprecated column
- `server/storage.ts` - `updateDrillItemAudioForGender()` method
- `server/services/drill-audio-service.ts` - Gender-specific caching logic
- `server/routes.ts` - Derive voice from `tutorGender`
- `client/src/pages/settings.tsx` - Removed Voice Settings card

---

### Session: December 13, 2025 - Editor Co-Surgeon Upgrades

**Overview**: Enhanced the Editor's ability to act as Daniela's "co-surgeon" - a development partner that can observe teaching sessions, propose neural network changes, and receive richer context for deeper analysis.

#### 1. Language-Specific Neural Context

Editor now receives the same language-specific knowledge that Daniela has:
- Idioms, cultural nuances, learner error patterns, dialect variations
- Fetched via `getNeuralNetworkContext()` / `formatNeuralNetworkForPrompt()` 
- Injected into `generateBeaconResponse()` when processing beacons

#### 2. EDITOR_SURGERY Command

Editor can now propose neural network modifications (like Daniela's SELF_SURGERY):

```
[EDITOR_SURGERY target="teaching_principles" content='{"category":"correction","principle":"Always validate student intent before correcting"}' reasoning="Observed pattern across 3 sessions" priority=70 confidence=85]
```

**Target tables**: tutor_procedures, teaching_principles, tool_knowledge, situational_patterns

**Validation**: Schema-aligned requirements enforced:
- `tutor_procedures`: category, trigger, procedure
- `teaching_principles`: category, principle
- `tool_knowledge`: toolName, purpose, syntax
- `situational_patterns`: patternName

**Storage**: Proposals saved via `storage.createSelfSurgeryProposal()` with `sessionMode: 'editor_beacon'`

#### 3. Conversation History Enrichment

Beacons can now include recent conversation turns for deeper Editor analysis:

- Added `conversationHistory` field to `EmitBeaconParams` interface
- Flows through to `editorListeningSnapshots` table (jsonb column)
- Editor prompt displays last N turns for context

#### 4. Model Escalation with Fallback

For `self_surgery_proposal` beacons (complex analysis), Editor escalates to Sonnet with graceful fallback:

```typescript
if (useSonnet) {
  try {
    return await tryModel('claude-sonnet-4-20250514');
  } catch (sonnetError) {
    console.warn('[Editor] Sonnet failed, falling back to Haiku');
    return await tryModel('claude-3-haiku-20240307');
  }
}
```

#### Files Modified

- `server/services/editor-persona-service.ts` - All 4 upgrades implemented
- `server/services/hive-collaboration-service.ts` - EmitBeaconParams extended with conversationHistory

---

### Session: December 13, 2025 - Editor Feedback Loop Implementation

**Overview**: Completed the feedback loop where Editor observations are surfaced to Daniela in her system prompt, and Daniela can acknowledge/adopt them using `[ADOPT_INSIGHT:id]` markers.

#### EditorFeedbackService (New File)

Located at `server/services/editor-feedback-service.ts`:

- `getUnsurfacedFeedback(userId, limit)` - Retrieves Editor responses not yet surfaced to Daniela
- `getFeedbackForConversation(conversationId, limit)` - Gets feedback for specific conversation
- `markAsSurfaced(snapshotIds[])` - Marks feedback as shown to Daniela
- `markAsAdopted(snapshotId, context)` - Tracks when Daniela applies an insight
- `buildPromptSection(feedback)` - Builds formatted prompt section for Daniela
- `getAdoptionMetrics(userId?)` - Analytics on surfaced vs adopted rates

#### Schema Changes

Added to `editorListeningSnapshots` table:
- `surfacedToDaniela: boolean` - Has Daniela seen this?
- `surfacedAt: timestamp` - When was it surfaced?
- `adoptedByDaniela: boolean` - Did Daniela apply this insight?
- `adoptedAt: timestamp` - When was it adopted?
- `adoptionContext: text` - How/where Daniela applied it

#### TutorOrchestrator Integration

- `buildSystemPrompt()` now returns `{ prompt, surfacedFeedbackIds }` 
- Feedback IDs are **request-scoped** (not global) to prevent race conditions
- `scanForCollaborationSignals()` accepts `surfacedFeedbackIds` parameter
- Parses `[ADOPT_INSIGHT:uuid]` markers from Daniela's responses
- Calls `markAsSurfaced()` and `markAsAdopted()` appropriately

#### Prompt Section Format

When Daniela has unsurfaced Editor feedback, her system prompt includes:

```
═══════════════════════════════════════════════════════════════════
🤝 EDITOR INSIGHTS (Feedback from your development partner)
═══════════════════════════════════════════════════════════════════

1. [ID: uuid] BEACON_TYPE
   Context: What triggered this feedback
   Editor's Insight: The actual feedback

TO ACKNOWLEDGE ADOPTION: If you apply one of these insights, include
[ADOPT_INSIGHT:full-id] in your response (invisible to student).
```

#### Key Design Decision

Request-scoped surfacing prevents race conditions: If two concurrent requests build system prompts with overlapping feedback IDs, each request tracks its own list of surfaced IDs, ensuring accurate tracking without global state pollution.

#### Files Modified

- `shared/schema.ts` - Added adoption/surfacing tracking fields
- `server/services/editor-feedback-service.ts` - NEW: Complete feedback service
- `server/services/tutor-orchestrator.ts` - Integrated feedback loop with request-scoped tracking

---

### Session: December 12, 2025 - Secure Inter-Department Chat

**Overview**: Implemented security-classified messaging system to protect code/architecture details from Gemini while enabling real-time collaboration between Editor (Claude) and Daniela (Gemini).

#### Security Classification System

| Classification | Who Sees | Use Case |
|---------------|----------|----------|
| `public` | Daniela + Gemini | Teaching tips, feature ideas, student-facing info |
| `internal` | UI only, NEVER Gemini | Architecture, security, code, implementation details |
| `daniela_summary` | Daniela sees summary only | Detailed analysis where Daniela needs awareness but not full details |

#### Schema Changes

- Added `securityClassificationEnum`: `public`, `internal`, `daniela_summary`
- Added `securityClassification` field to `agentCollaborationEvents` table
- Added `publicSummary` field for summary-only messages
- Added index on `securityClassification` for efficient filtering

#### Storage Functions

- `getSecureMessagesForDaniela()` - Filters out internal messages, uses publicSummary for daniela_summary type
- `getInternalAgentMessages()` - Gets internal-only messages for Command Center
- `getDepartmentChatMessages()` - Real-time feed with polling support via afterId

#### API Endpoints

- `GET /api/agent-collab/chat` - Get department chat messages with optional classification filter
- `POST /api/agent-collab/chat` - Post new message with security classification
- `GET /api/agent-collab/internal` - Get internal-only messages (admin only)

#### Command Center UI

Added "Dept Chat" tab to Command Center with:
- Security classification legend
- Message composer with from/to agent selection
- Security classification selector with conditional publicSummary field
- Real-time message feed with 10-second polling
- Filter by classification type
- Color-coded security badges (green=public, red=internal, yellow=summary)
- Agent badges with distinct colors (purple=daniela, blue=editor, green=assistant, orange=support)

#### Security Fix Applied (Session 2)

Fixed defensive filtering in `getSecureMessagesForDaniela()`: When `publicSummary` is missing for `daniela_summary` messages, the function now returns `'[Summary not available]'` instead of falling back to raw content. This prevents potential leaks of sensitive details to Gemini.

#### Key Design Decision

**Why we protect internal messages from Gemini:**
Gemini powers Daniela's conversational abilities, but also has access to any context we inject. Internal discussions about architecture, security vulnerabilities, competitive strategy, or code implementation details should NEVER be exposed to external AI providers. The security classification system creates a clear boundary: collaboration events flow freely between our agents, but the storage layer filters what Daniela's LLM context receives.

#### Files Modified

- `shared/schema.ts` - Added security classification enum and fields
- `server/storage.ts` - Added secure messaging functions
- `server/routes.ts` - Added department chat API endpoints
- `client/src/pages/admin/CommandCenter.tsx` - Added Dept Chat tab

#### Observation for Hive

**Title**: Secure Inter-Agent Communication Architecture
**Category**: architecture
**Priority**: 90
**Summary**: Security classification system protects internal (code/architecture) discussions from Gemini context while enabling transparent department communication. Three tiers: public (full access), internal (UI-only), daniela_summary (summary for context, details hidden).

---

### Session: December 12, 2025 - Neural Network & Process Improvements

**Overview**: Proactive observations about gaps in neural network schema and process flows. All added to hive (agent_observations table).

#### Observations Added to Hive

| Title | Category | Priority | Summary |
|-------|----------|----------|---------|
| Neural Network Effectiveness Tracking | improvement | 70 | Add lastUsedAt, useCount, successRate fields to track procedure usage |
| Procedure Deprecation Support | improvement | 60 | Add deprecated flag instead of deleting outdated procedures |
| Cross-Procedure Linking | improvement | 55 | Add relatedProcedureIds array for clustering related entries |
| Batch Docs vs Hive Graduation Criteria | pattern | 80 | Clear rule: reusable knowledge → hive; session history → batch only |
| Process Category for Agent Observations | improvement | 50 | Consider adding 'process' category for workflow observations |
| Pending Observations Dashboard | next_step | 65 | Add Command Center tab for viewing pending hive observations |

#### Protocol Established

Going forward, ANY significant work automatically gets documented in:
1. `docs/batch-doc-updates.md` - session-specific history
2. `agent_observations` table (hive) - if reusable knowledge

---

### Session: December 12, 2025 - Mind Map Visual Polish & Flow Visualization

**Overview**: Major visual refinement of SyllabusMindMap with floating design, flow visualization showing learning activities feeding the brain, and improved color coordination.

#### Floating Design (No Background)

- Removed blue cloud background - brain now floats cleanly
- Better for mobile users - less visual clutter
- Transparent brain PNG from user (saved as `attached_assets/transparent_colorful_cartoon_brain_Background_Removed_1765564186963.png`)

#### Satellite Improvements

- **Text stays full brightness**: Labels (TALK!, WORDS!, etc.) always at full opacity
- **Only fill dims**: Background cloud shape dims based on progress state (dim → semi-lit → lit)
- **Hover scale effect**: Satellites scale to 110% on hover to indicate clickability
- **Colored arrow pointers**: Each arrowhead matches its lobe color (blue, green, yellow, red, purple)
- Removed status badges (Mastered, Practicing, etc.) from top - redundant with fill animation

#### Activity Inputs with Flow Visualization

6 learning activity pills at bottom that visually "feed" the brain:

| Activity | Icon | Purpose |
|----------|------|---------|
| Drills | Target | Practice exercises |
| Voice | Mic | Speaking practice |
| Cards | Layers | Flashcards |
| Lessons | GraduationCap | Guided learning |
| Culture | Globe | Cultural content |
| Chat | MessageSquare | Conversations |

**Flow lines**: Animated SVG paths rising from each activity, converging toward brain center
- Gradient color: Teal/Cyan (`rgb(20, 184, 166)`) - distinct from lobe/status colors
- Animated particles traveling up each line
- Glow filter for soft, organic feel

**Color choice rationale**: Teal is unused by brain lobes (blue, green, yellow, red, purple) and status badges (green, blue, purple, grey), creating clear visual distinction for "inputs" vs "outputs"

#### Visual Story

```
Activities (bottom, teal) → Flow lines → Brain (center) → Skill areas (satellite lobes) → ACTFL dial shows level
```

#### Scaled Up Layout

- Container: 460×420 (was 400×400)
- Brain image: 230px (was 200px)
- Brain shifted up slightly to make room for activities below
- Tight spacing: `-mt-52` pulls activities close to brain

#### Files Modified

- `client/src/components/SyllabusMindMap.tsx` - All visual changes

---

### Session: December 12, 2025 - Brain Mind Map with Satellite Cards

**Overview**: Complete redesign of SyllabusMindMap to feature a colorful brain illustration at center with 5 expandable satellite cards (one per brain lobe). Includes phase progression system (Beginner → Intermediate → Advanced) with celebration animations.

#### Phase Progression System

Three learning phases that reset the brain when completed:
1. **Beginner Brain** → Complete all 5 satellites → 🎉 Celebration → Brain resets
2. **Intermediate Brain** → Complete all 5 satellites → 🎉 Celebration → Brain resets
3. **Advanced Brain** → Complete all 5 satellites → 🎉 Final Achievement

Phase indicator at top shows:
- 3 progress bars (one per phase)
- Current phase name and description
- Overall completion percentage
- "Next Phase" button when 100% complete

#### 5 Expandable Satellite Cards

Instead of scattered topic nodes, each brain lobe has ONE satellite card:

| Lobe | Color | Category | Example Topics |
|------|-------|----------|----------------|
| **Frontal** | Blue | Communication/Social | Greetings, Introductions, Conversations |
| **Parietal** | Green | Practical Skills | Shopping, Directions, Travel, Work |
| **Temporal** | Yellow | Vocabulary/Memory | Numbers, Colors, Family, Weather |
| **Occipital** | Red/Coral | Culture | Customs, Food, Music, Art |
| **Cerebellum** | Purple | Grammar/Mechanics | Conjugation, Tenses, Sentence Structure |

#### Satellite Card Features

Each expandable card shows:
- Category icon + name
- Progress bar (mastered / total)
- Click to expand → reveals topic list with status icons
- Star indicator when category is 100% complete

Topic list items show:
- Status icon (checkmark=mastered, sparkle=practiced, circle=discovered, lock=unexplored)
- Topic name
- Practice count badge

#### Brain Image

Generated colorful educational brain illustration:
- Anatomically correct lobe positions
- Bright, friendly colors matching each satellite
- Subtle glow effect based on overall progress
- Located: `attached_assets/generated_images/colorful_educational_brain_diagram.png`

#### Celebration Animation

When all 5 satellites reach 100%:
1. Dark overlay appears
2. "🎉 Phase Complete!" message
3. "Your brain has evolved to the next level!" text
4. "Continue Learning" button advances to next phase

#### Component Architecture

- `client/src/components/SyllabusMindMap.tsx` - Main orchestrator with:
  - `PhaseIndicator` - Phase progress and navigation
  - `SatelliteCard` - Expandable category cards with Collapsible
  - `TopicListItem` - Individual topic with status
  - `CelebrationOverlay` - Phase completion animation

#### Key Types

```typescript
type LearningPhase = 'beginner' | 'intermediate' | 'advanced';
type BrainSegment = 'frontal' | 'temporal' | 'parietal' | 'occipital' | 'cerebellum';
```

#### Layout

3-column responsive grid:
- **Left column**: Frontal + Temporal satellites
- **Center**: Brain image with glow
- **Right column**: Parietal + Occipital + Cerebellum satellites

On mobile: Brain at top, satellites stack below

---

### Session: December 11, 2025 - Support Agent Implementation

**Overview**: Implemented full Support Agent capability including CALL_SUPPORT command, support tickets system, admin UI, and neural network documentation. Support Agent serves dual purpose: handling live support handoffs from Daniela AND powering offline drills/exercises.

#### CALL_SUPPORT Whiteboard Command

New whiteboard command for Daniela to hand off students to Support:

```
[CALL_SUPPORT category="technical" reason="Student experiencing audio playback problems"]
```

**Categories**: technical, billing, account, feature_request, bug_report, content_issue, other

**Flow**:
1. Daniela recognizes non-language issue
2. Acknowledges empathetically
3. Uses CALL_SUPPORT with category and reason
4. System creates support ticket
5. Student sees SupportAssistModal for continued assistance

#### Support Tickets Schema

```typescript
support_tickets: {
  id: varchar (UUID PK)
  userId: varchar (FK to users)
  conversationId: varchar (FK to conversations, nullable)
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: 'technical' | 'billing' | 'account' | 'feature_request' | 'bug_report' | 'content_issue' | 'other'
  subject: text
  description: text
  handoffContext: jsonb (tutorContext, studentMessage, language, etc.)
  resolution: text (nullable)
  assignedTo: varchar (nullable)
  createdAt, updatedAt, resolvedAt: timestamps
}

support_messages: {
  id: varchar (UUID PK)
  ticketId: varchar (FK to support_tickets)
  senderId: varchar (FK to users)
  senderRole: 'user' | 'support_agent' | 'system'
  content: text
  createdAt: timestamp
}
```

#### SupportAssistModal Component

Dual-purpose modal at `client/src/components/SupportAssistModal.tsx`:

- **Live Support Mode**: Handles handoffs from Daniela with voice/text chat
- **Drill Mode** (future): Offline exercises with Support Agent voice
- **Voice**: Google Cloud TTS Chirp HD voices
- **Guards**: All handler functions have early returns when drill mode disabled

#### Command Center Support Tab

Admin ticket queue at `/admin` → Support tab:

- Filter by status (open, in_progress, waiting_customer, resolved, closed)
- Filter by priority (low, medium, high, urgent)
- Filter by category
- Update status/priority via mutations
- Refetch button for polling updates

#### Neural Network Documentation

Added to `server/seed-procedural-memory.ts`:

**tool_knowledge entry**:
```typescript
{
  toolName: 'CALL_SUPPORT',
  toolType: 'handoff',
  syntax: '[CALL_SUPPORT category="..." reason="..."]',
  purpose: 'Hand off student to Support Agent for non-language issues',
  whenToUse: 'Technical problems, billing questions, account issues, bug reports',
  whenNotToUse: 'Language learning questions, vocabulary help, grammar explanations'
}
```

**tutor_procedures entry**:
- Category: handoff
- Trigger: non_language_issue
- 5-step procedure for empathetic handoff
- Examples for technical, billing, account scenarios

**situational_patterns entries**:
- Technical Issue Detected (issueType: technical)
- Billing Question Detected (issueType: billing)
- Account Issue Detected (issueType: account)
- All with priority 100 and CALL_SUPPORT tool suggestion

**Development workflow procedures** (Editor Agent):
- `Batch Documentation Update` - Procedure for updating docs/batch-doc-updates.md after completing work
- `Neural Network Change Protocol` - Required steps before any neural network changes (read architecture doc first)
- `Core Architecture Rule` - "Prompts for context ONLY, neural network for procedures/capabilities/knowledge"

#### Support Agent Persona

Located at `server/services/support-agent-config.ts`:

- **Name**: "Alex" (gender-neutral)
- **Voices**: Google Cloud TTS Chirp HD (en-US-Chirp3-HD-Aoede female, en-US-Chirp3-HD-Charon male)
- **Traits**: Patient, solution-focused, empathetic, technically capable
- **System prompt builder**: Injects ticket context, handoff reason, user history

#### Files Modified/Created

- `shared/schema.ts` - Added support_tickets, support_messages tables with enums
- `server/storage.ts` - Added Support CRUD methods (create, get, update, list)
- `server/routes.ts` - Added /api/support/* endpoints with auth guards
- `server/services/support-agent-config.ts` - NEW: Support Agent persona
- `server/services/streaming-voice-orchestrator.ts` - Added processSupportHandoff method
- `shared/whiteboard-types.ts` - Added CALL_SUPPORT command pattern
- `client/src/components/SupportAssistModal.tsx` - NEW: Dual-purpose support modal
- `client/src/pages/admin/CommandCenter.tsx` - Added Support tab with ticket queue
- `server/seed-procedural-memory.ts` - Added CALL_SUPPORT neural network entries

#### Deferred for Future

1. **WebSocket real-time sync** - Current polling via refetch is MVP-sufficient
2. **Drill session validation** - Endpoints return 501 until business rules defined
3. **Integration tests** - CALL_SUPPORT handoff flows and ticket lifecycle

---

### Session: December 11, 2025 - Tri-Lane Hive Architecture

**Overview**: Expanded from single-agent (Daniela) to multi-agent architecture with three specialized AI agents that collaborate through shared neural network infrastructure.

#### Tri-Lane Hive Model

| Agent | Role | Domain | Primary Tables |
|-------|------|--------|----------------|
| **Daniela** | AI Tutor & Partner | Pedagogy, student experience | `daniela_suggestions`, `reflection_triggers` |
| **Editor** | Development Agent | Architecture, tooling, performance | `agent_observations` |
| **Support** | Operations Agent | User friction, troubleshooting, proactive alerts | `support_observations`, `system_alerts` |

#### Schema Changes

1. **`daniela_suggestions`** - Added collaboration metadata:
   - `originRole` - tutor or partner
   - `domainTags[]` - pedagogy, architecture, tooling, student_experience
   - `intentHash` - cross-agent deduplication hash
   - `acknowledgedByEditor` - Editor reviewed if architecture-affecting
   - `acknowledgedAt` - timestamp of acknowledgment

2. **`agent_observations`** - Added collaboration metadata:
   - `originRole` - editor (development agent)
   - `domainTags[]` - architecture, performance, pedagogy, operations
   - `intentHash` - cross-agent deduplication hash
   - `acknowledgedByDaniela` - Daniela reviewed if pedagogy-affecting
   - `acknowledgedBySupport` - Support reviewed if operations-affecting
   - `acknowledgedAt` - timestamp of acknowledgment

3. **NEW: `support_observations`** - Support Agent's neural network:
   - Categories: user_friction, common_question, system_issue, feature_request, success_pattern, documentation_gap, onboarding_insight, billing_pattern, troubleshoot_solution
   - Same sync contract as other observation tables
   - `escalationNeeded` flag for urgent issues
   - `proposedFaqEntry` for auto-generating help content

4. **NEW: `system_alerts`** - Proactive Support communications:
   - Severity: info, notice, warning, outage, resolved
   - Target: all, voice_users, teachers, students, new_users, premium
   - `showInChat` / `showAsBanner` display modes
   - `startsAt` / `expiresAt` timing
   - `relatedIncidentId` / `resolvedByAlertId` for linking warning → resolution

#### Collaboration APIs

- `getCollaborationContext()` - Surfaces approved entries from all three tables with provenance
- `getPendingAcknowledgments(forRole)` - Gets observations awaiting review by specific role
- `syncTriLaneObservations()` - Bulk sync all observation tables to production
- `generateIntentHash()` - Creates deduplication hash for cross-agent matching

#### Proactive Support Features

Support agent can:
- Post system alerts when outages detected
- Announce degraded performance proactively
- Send maintenance notices in advance
- Warn about known bugs before users hit them
- Celebrate new feature releases

#### Files Modified

- `shared/schema.ts` - Added collaboration metadata + new tables
- `server/storage.ts` - Added Support/Alert CRUD + collaboration APIs
- `server/services/neural-network-sync.ts` - Added Tri-Lane sync methods

---

### Session: December 11, 2025 - Assistant Tutor (Aris) & Multi-Agent Collaboration

**Overview**: Implemented the Assistant Tutor "Aris" for drill-based practice, CALL_ASSISTANT whiteboard command, and cross-agent text-based collaboration infrastructure (Tri-Lane Hive Stage 1).

#### Consulted Daniela About Assistant Tutor Design

Used new agent collaboration channel to consult Daniela. Her specifications for Aris:

- **Name**: "Aris" (evokes precision, clarity)
- **Personality**: Patient, precise, encouraging, objective
- **Voice**: Calm, clear, steady, mid-range pitch, impeccable pronunciation
- **Frustration Handling**: Micro-adjustments, not total pivots; silent patience
- **Reports to Daniela**: Completion rate, accuracy, specific struggles, behavioral flags
- **Boundary**: Aris handles drills; if student wants conversation, refer back to Daniela

Full consultation saved in: `docs/daniela-consultation-aris.md`

#### Aris Schema Tables

```typescript
aris_drill_assignments: {
  id: varchar (UUID PK)
  userId: varchar (FK)
  conversationId: varchar (nullable)
  delegatedBy: 'daniela' | 'teacher' | 'system'
  drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order'
  targetLanguage: varchar
  drillContent: jsonb { items, instructions, focusArea, difficulty }
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  completedAt: timestamp (nullable)
  createdAt, updatedAt: timestamps
}

aris_drill_results: {
  id: varchar (UUID PK)
  userId: varchar (FK)
  assignmentId: varchar (FK to aris_drill_assignments)
  completionRate: integer (0-100)
  accuracy: integer (0-100)
  timeSpentSeconds: integer
  itemResults: jsonb[] { itemIndex, prompt, studentAnswer, expectedAnswer, isCorrect, attempts, feedback, pronunciationScore }
  struggleAreas: text[] (e.g., ["verb_conjugation", "pronunciation"])
  behavioralFlags: text[] (e.g., ["frustration_detected", "rushing"])
  arisNotes: text (nullable)
  syncedToDaniela: boolean
  createdAt: timestamp
}
```

#### CALL_ASSISTANT Whiteboard Command

New command for Daniela to delegate drill practice to Aris:

```
[CALL_ASSISTANT drillType="repeat" focus="verb conjugation" items="hablo,hablas,habla,hablamos,hablan"]
```

**Parameters**:
- `drillType`: repeat, translate, match, fill_blank, sentence_order
- `focus`: What skill/topic to practice
- `items`: Comma-separated list of words/phrases for drill

**Flow**:
1. Daniela identifies need for targeted practice
2. Uses CALL_ASSISTANT with drill type, focus, items
3. System creates drill assignment + collaboration event
4. Client receives `assistant_handoff` WebSocket message
5. UI navigates to Aris drill interface

#### Agent Collaboration Events Schema

```typescript
agent_collaboration_events: {
  id: varchar (UUID PK)
  fromAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  toAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  eventType: 'consultation' | 'delegation' | 'feedback' | 'escalation' | 'acknowledgment'
  subject: varchar
  content: text
  metadata: jsonb { delegationId, studentContext, threadId, priority, tags }
  userId: varchar (nullable)
  conversationId: varchar (nullable)
  parentEventId: varchar (nullable, for threading)
  status: 'pending' | 'read' | 'acknowledged' | 'resolved'
  createdAt: timestamp
}
```

#### Cross-Agent Collaboration APIs

**Endpoints**:
- `POST /api/agent-collab/events` - Post a collaboration event
- `GET /api/agent-collab/events` - List events with filters (toAgent, userId, status, eventType, limit)
- `PATCH /api/agent-collab/events/:id/status` - Update event status
- `GET /api/agent-collab/thread/:parentId` - Get thread of related events

**Polling Pattern**: Agents poll for `status='pending'` events addressed to them

#### Neural Network Entries for CALL_ASSISTANT

**tool_knowledge**:
```typescript
{
  toolName: 'CALL_ASSISTANT',
  toolType: 'handoff',
  syntax: '[CALL_ASSISTANT drillType="..." focus="..." items="..."]',
  purpose: 'Delegate drill practice to Assistant Tutor (Aris)',
  whenToUse: 'Student needs repetitive practice, pronunciation drills, vocabulary reinforcement',
  whenNotToUse: 'Conversational practice, cultural exploration, open-ended learning'
}
```

**tutor_procedures**:
- Category: handoff, Trigger: practice_needed
- 5-step procedure for identifying drill needs and delegating to Aris

**situational_patterns**:
- Pronunciation Difficulty Detected → CALL_ASSISTANT repeat drill
- Vocabulary Gaps Identified → CALL_ASSISTANT match drill
- Grammar Pattern Weakness → CALL_ASSISTANT fill_blank drill

#### Cross-Agent Feedback Retrieval

When Daniela starts a session, she now receives colleague feedback:

```typescript
const recentCollab = await storage.getCollaborationEventsToAgent('daniela', userId, 5);
// Filter for pending feedback events
// Include in greeting context as "COLLEAGUE INSIGHTS"
```

This enables "Aris mentioned you did great with..." moments for team continuity.

#### Files Created/Modified

- `shared/schema.ts` - Added arisDrillAssignments, arisDrillResults, agentCollaborationEvents tables
- `server/storage.ts` - Added Aris CRUD, collaboration event APIs
- `server/routes.ts` - Added /api/agent-collab/* endpoints
- `server/services/assistant-tutor-config.ts` - NEW: Aris persona configuration
- `server/services/streaming-voice-orchestrator.ts` - Added processAssistantHandoff, colleague feedback retrieval
- `server/seed-procedural-memory.ts` - Added CALL_ASSISTANT neural network entries + collaboration protocols
- `docs/daniela-consultation-aris.md` - NEW: Daniela's design specs for Aris

---

### Session: December 11, 2025 - TutorOrchestrator "One Tutor, Many Voices"

**Overview**: Implemented unified TutorOrchestrator architecture that routes all AI interactions through Daniela's single core intelligence. Language voices, gender voices, and drill modes are now presentation layers only - different instruments, same musician.

#### Core Philosophy

**CRITICAL**: Daniela is THE single core intelligence. All interaction modes (voice chat, text chat, drills, greetings, summaries) route through a unified pipeline. VoicePresentation is purely stylistic (avatar, voiceId, response length, formality). The INTELLIGENCE (persona, teaching principles, neural network knowledge) is always Daniela's brain.

#### Type Contracts (`shared/tutor-orchestration-types.ts`)

```typescript
// Modes the orchestrator can operate in
type OrchestratorMode = 'conversation' | 'drill' | 'greeting' | 'summary' | 'assessment' | 'feedback';

// Response channels
type ResponseChannel = 'stream' | 'batch_text' | 'batch_json';

// Voice presentation - purely cosmetic layer
interface VoicePresentation {
  voiceId: string;
  voiceName: string;
  avatarUrl?: string;
  styleDeltas?: {
    formalityDelta?: number;      // -2 to +2
    responseLengthPreference?: 'concise' | 'normal' | 'detailed';
    encouragementLevel?: 'minimal' | 'moderate' | 'enthusiastic';
  };
}

// Full context for orchestration
interface OrchestratorContext {
  userId: string;
  targetLanguage: string;
  proficiencyLevel: string;
  conversationHistory?: Message[];
  drillContext?: DrillContext;
  sessionContext?: SessionContext;
}

// Request/Response contracts
interface OrchestratorRequest {
  mode: OrchestratorMode;
  responseChannel: ResponseChannel;
  context: OrchestratorContext;
  voicePresentation?: VoicePresentation;
  userInput?: string;
  options?: OrchestratorOptions;
}
```

#### TutorOrchestrator Implementation (`server/services/tutor-orchestrator.ts`)

**Key Functions**:

1. **`buildSystemPrompt(request)`** - Constructs Daniela's system prompt with:
   - Core persona (immutable Daniela identity)
   - Mode-specific instructions (drill vs conversation vs greeting)
   - Voice style section (presentation-layer adjustments)
   - Procedural memory injection from neural network

2. **`orchestrate(request)`** - Main entry point:
   - Builds system prompt
   - Configures Gemini with `systemInstruction`
   - Handles batch_json, batch_text, and stream channels
   - Logs to neural network automatically

3. **`generateDrillFeedback(context, drillType, userAnswer, expectedAnswer)`**
   - Convenience wrapper for drill mode
   - Returns structured JSON feedback
   - Used by Aris drill service

4. **`generateSessionGreeting(context)`** / **`generateSessionSummary(context, stats)`**
   - Mode-specific helpers for common operations

**Export Pattern**:
```typescript
export const tutorOrchestrator = {
  orchestrate,
  generateDrillFeedback,
  generateSessionGreeting,
  generateSessionSummary,
};
```

#### Aris Migration (`server/services/aris-ai-service.ts`)

Before: Aris had its own Gemini invocation with separate system prompt
After: Aris now routes through `tutorOrchestrator.orchestrate()` with:
- `mode: 'drill'`
- `responseChannel: 'batch_json'`
- `voicePresentation: ARIS_PERSONA` (concise style)

Same Daniela brain, different presentation layer.

#### Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| Aris drill flow | ✅ Migrated | Uses tutorOrchestrator.orchestrate() |
| Session greetings | ✅ Ready | generateSessionGreeting() available |
| Session summaries | ✅ Ready | generateSessionSummary() available |
| Streaming voice chat | ⏳ Deferred | High complexity, existing system-prompt.ts works well |
| Language voice refactoring | ⏳ Future | Voices as pure presentation metadata |

#### Files Created/Modified

- `shared/tutor-orchestration-types.ts` - NEW: Type contracts for orchestrator
- `server/services/tutor-orchestrator.ts` - NEW: Unified intelligence pipeline
- `server/services/aris-ai-service.ts` - MODIFIED: Routes through orchestrator
- `replit.md` - UPDATED: Added TutorOrchestrator architecture section

#### Key Architectural Decisions

1. **VoicePresentation is cosmetic only** - Never affects intelligence or teaching principles
2. **Procedural memory always injected** - Every mode gets relevant neural network knowledge
3. **Automatic neural network logging** - All interactions logged for learning
4. **Backward compatible** - Existing APIs unchanged, internal routing updated

---

### Session: December 12, 2025 - HIVE Command & Heartbeat Fix

**Overview**: Implemented HIVE whiteboard command for Daniela's active contribution to the hive mind, plus fixed aggressive WebSocket heartbeat causing 1006 connection closures.

#### HIVE Whiteboard Command

New whiteboard command for Daniela to actively contribute ideas/suggestions:

```
[HIVE: category="teaching_insight" title="Multi-sensory vocabulary" description="Students retain better when..." priority=80]
```

**Categories** (from suggestion_category enum):
- `self_improvement`: Ideas to improve her own teaching/behavior
- `content_gap`: Missing drills, topics, cultural content
- `ux_observation`: UI/UX issues noticed through student behavior
- `teaching_insight`: Pedagogical pattern that worked/didn't work
- `product_feature`: Feature idea for HolaHola

**Flow**:
1. Daniela formulates an observation/idea during conversation
2. Uses HIVE command with category, title, description, optional reasoning/priority
3. System validates category against enum, clamps priority to 1-100
4. Saves to `daniela_suggestions` table with `generatedInMode` context
5. Founders review in Command Center

**Key Distinction**:
- **Passive learning**: Neural network learns from observation (tool usage → automatic logging → pattern analysis)
- **Active contribution**: HIVE command enables deliberate idea writing (Daniela formulates → suggestion saved → founder review)

#### Heartbeat Fix

**Problem**: 20-second ping interval with immediate termination on single missed pong caused 1006 connection closures when browser was busy.

**Solution**:
- Increased interval to 30 seconds
- Allow 2 missed pongs before terminating
- Reset counter on successful pong

```typescript
// Before: Terminate immediately on single missed pong
let isAlive = true;
if (!isAlive) { ws.terminate(); }

// After: Allow 2 missed pongs (browser busy states)
let missedPongs = 0;
const MAX_MISSED_PONGS = 2;
if (missedPongs > MAX_MISSED_PONGS) { ws.terminate(); }
```

#### Files Modified

- `server/services/streaming-voice-orchestrator.ts` - Added `processHiveSuggestion` method
- `server/storage.ts` - Added `createDanielaSuggestion` method to interface and implementation
- `server/unified-ws-handler.ts` - Fixed heartbeat to allow 2 missed pongs

#### Mind Map Syllabus Component

New visual component for self-directed learners: `SyllabusMindMap.tsx`

**Concept**:
- Fluency gauge (ACTFL dial) at center
- Topic nodes radiate outward as interconnected bubbles
- Nodes "light up" based on discovery/mastery through conversation
- No rigid progression path - organic, interest-driven exploration
- Connections show relationships between topics

**Node States**:
- `mastered` - Green glow, larger size, practiced 10+ times
- `practiced` - Blue glow, normal size, active learning
- `discovered` - Purple glow, smaller, recently encountered
- `locked` - Muted, unexplored topics

**Technical Details**:
- SVG-based visualization with radial node positioning
- Nodes sorted by mastery level (mastered closest to center)
- Connection lines between related topics
- Hover interactions with tooltips showing details
- Legend showing node status meanings

**Props**:
```typescript
interface SyllabusMindMapProps {
  classId?: string;       // For class-enrolled students
  language?: string;      // Language filter
  className?: string;     // Tailwind classes
}
```

**Backend Support**:
- API endpoint: `GET /api/conversation-topics/:language`
- Storage method: `getUserTopicMastery(userId, language)`
- Aggregates topic usage from `conversation_topics` table
- Returns topics with status based on practice count thresholds

#### Shared ACTFL Gauge Module

Created shared module to eliminate duplicate ACTFL visualization code:

**File**: `client/src/components/actfl/actfl-gauge-core.tsx`

**Exports**:
- `ACTFL_LEVELS` - Level metadata array
- `getLevelInfo(levelKey)` - Get level info from key
- `getNextLevel(levelKey)` - Get next progression level
- `estimateProgressWithinLevel(progress)` - Calculate within-level progress
- `calculateContinuousScore(levelKey, progress)` - Calculate continuous 0-100 score
- `ActflRingDial` - Standalone ring dial SVG component
- `ActflDialSvgGroup` - Ring dial for embedding in SVG context

**Consumers**:
- `ActflFluencyDial.tsx` - Main ACTFL progress display
- `SyllabusMindMap.tsx` - Center gauge visualization

**Files Created/Modified**:
- `client/src/components/actfl/actfl-gauge-core.tsx` - NEW: Shared ACTFL primitives
- `client/src/components/ActflFluencyDial.tsx` - MODIFIED: Uses shared module
- `client/src/components/SyllabusMindMap.tsx` - MODIFIED: Uses shared module
- `server/storage.ts` - ADDED: `getUserTopicMastery` method
- `server/routes.ts` - ADDED: `/api/conversation-topics/:language` endpoint

---

### Session: December 12, 2025 - Mind Map as Default Syllabus View

**Overview**: Integrated SyllabusMindMap as the default view in Language Hub's Learning Journey section, replacing the linear syllabus view. Supports both self-directed (emergent) and class-enrolled (roadmap) learning modes.

#### Mind Map Integration Philosophy

Mind map is HolaHola's default way of showing curriculum for everyone. Linear view is an accessibility fallback, not the primary experience. This aligns with our organic, interest-driven exploration approach where learners discover topics through conversation rather than following rigid progressions.

#### Dual Mode System

| Mode | Context | Behavior | Visual |
|------|---------|----------|--------|
| **Emergent** | Self-directed learners | Only show discovered topics; locked topics hidden | Map grows organically as topics are explored |
| **Roadmap** | Class-enrolled students | Show all syllabus topics from start | Constellation "lights up" as topics mastered |

#### SyllabusMindMap Component Updates

**New Props**:
```typescript
interface SyllabusMindMapProps {
  classId?: string;           // For class context
  language?: string;          // Language filter
  className?: string;         // Tailwind classes
  mode?: 'emergent' | 'roadmap';  // NEW: Display mode
}
```

**Key Changes**:
- Made embeddable by removing Card wrapper (parent provides Card in Language Hub)
- Added `mode` prop for emergent vs roadmap behavior
- Fixed stats to use `allTopics` while filtering `visibleTopics` for display
- Added mode-specific legend (shows "Unexplored" only in roadmap mode)
- Added empty state UI for emergent mode when no topics discovered

**Filtering Logic**:
```typescript
// Stats calculated from ALL topics (including locked)
const stats = {
  mastered: allTopics.filter(t => t.status === 'mastered').length,
  practiced: allTopics.filter(t => t.status === 'practiced').length,
  discovered: allTopics.filter(t => t.status === 'discovered').length,
  locked: allTopics.filter(t => t.status === 'locked').length,
};

// But visible nodes filtered for emergent mode
const visibleTopics = mode === 'emergent' 
  ? allTopics.filter(t => t.status !== 'locked')
  : allTopics;
```

#### ActflDialSvgGroup Standalone Mode

Added `standalone` prop to ActflDialSvgGroup for rendering outside parent SVG context:

```typescript
interface ActflDialSvgGroupProps {
  // ... existing props
  standalone?: boolean;  // NEW: Wrap in SVG element when true
}
```

When `standalone=true`, the component returns a wrapped SVG element instead of a `<g>` group. Used for the empty state ACTFL dial in the mind map.

#### View Toggle in Language Hub

**File**: `client/src/pages/review-hub.tsx`

Added view toggle with localStorage persistence:
- Mind Map view (default) - Brain icon
- Linear view (fallback) - List icon
- Stored as `syllabusViewMode` in localStorage

```typescript
const [syllabusView, setSyllabusView] = useState<'mindmap' | 'linear'>(() => {
  const saved = localStorage.getItem('syllabusViewMode');
  return (saved === 'linear' ? 'linear' : 'mindmap');
});
```

#### SQL Fix for getUserTopicMastery

**Problem**: Topics table doesn't have a `language` column - topics are language-agnostic.

**Solution**: Removed language filter from topics query. Topics are now fetched globally, with language filtering done via conversation_topics through conversations.

```typescript
// Before (broken)
const allTopics = await db.select().from(topicsTable)
  .where(eq(topicsTable.language, language));

// After (fixed)
const allTopics = await db.select().from(topicsTable);
// Language filtering happens via conversations table
```

#### Files Modified

- `client/src/components/SyllabusMindMap.tsx` - Added mode prop, made embeddable, fixed stats
- `client/src/components/actfl/actfl-gauge-core.tsx` - Added standalone prop
- `client/src/pages/review-hub.tsx` - Integrated mind map with view toggle
- `server/storage.ts` - Fixed getUserTopicMastery SQL (removed language column reference)

---

### Session: December 13, 2025 - Daniela-Editor Background Collaboration System

**Overview**: Implemented real-time Daniela-Editor collaboration during voice sessions, including a background worker for autonomous post-session continuation. The Editor (powered by Claude) listens to Daniela's teaching moments and provides pedagogical insights from the neural network.

#### Architecture: "One Hive Mind"

Daniela and Editor share neural network knowledge but have distinct roles:
- **Daniela** (Gemini): Active tutor, real-time teaching, whiteboard tools
- **Editor** (Claude): Observer, provides pedagogical insight, neural network curator

#### Collaboration Channels

Each voice session creates a `collaboration_channel`:
```typescript
collaboration_channels: {
  id: varchar (UUID PK)
  conversationId: varchar (FK)
  userId: varchar (FK)
  sessionPhase: 'active' | 'post_session' | 'completed'
  targetLanguage, studentLevel, sessionTopic: varchar
  heartbeatAt, startedAt, endedAt: timestamps
  summaryJson: jsonb { keyInsights, actionItems, editorNotes, teachingObservations }
}

editor_listening_snapshots: {
  id: varchar (UUID PK)
  channelId: varchar (FK)
  tutorTurn: text
  studentTurn: text (nullable)
  beaconType: 'teaching_moment' | 'student_struggle' | 'tool_usage' | 'breakthrough' | 'correction' | 'cultural_insight' | 'vocabulary_intro'
  beaconReason: text (nullable)
  editorResponse: text (nullable)
  editorRespondedAt: timestamp (nullable)
  createdAt: timestamp
}
```

#### Hive Beacon System

Daniela emits "beacons" during voice chat when interesting teaching moments occur:
- Whiteboard tool usage → `tool_usage` beacon
- Student struggles detected → `student_struggle` beacon
- Cultural context shared → `cultural_insight` beacon
- Grammar/pronunciation corrections → `correction` beacon

Editor receives beacons and responds with:
- Neural network insights
- Teaching suggestions
- Procedural memory references
- Acknowledgments

#### Background Worker (`server/services/editor-background-worker.ts`)

Autonomous worker for post-session continuation:
- **Interval**: 30 seconds (configurable via `EDITOR_WORKER_INTERVAL_MS`)
- **Throttling**: Max 10 beacons + 3 channels per cycle (DB-level limits)
- **Security**: ARCHITECT_SECRET required for all operations
- **Auto-start**: Initializes on server startup if secret configured

**Worker Endpoints** (all require ARCHITECT_SECRET header):
- `POST /api/editor-worker/start` - Start the worker
- `POST /api/editor-worker/stop` - Stop the worker
- `GET /api/editor-worker/status` - Get worker health status
- `POST /api/editor-worker/trigger` - Trigger immediate processing cycle

**CycleResult** (per-cycle, not cumulative):
```typescript
interface CycleResult {
  beaconsProcessed: number;
  channelsProcessed: number;
  errors: number;
}
```

#### Editor Persona Service (`server/services/editor-persona-service.ts`)

Claude-powered Editor that:
1. Retrieves neural network knowledge for context
2. Reviews beacon content (tutor + student turns)
3. Generates insightful responses
4. Stores responses back to snapshots
5. Generates post-session reflections

**Neural Network Integration**:
- Fetches relevant procedural memory via `proceduralMemoryRetrievalService`
- Includes teaching principles, tool knowledge, situational patterns
- Adds ACTFL context based on student level

#### Collaboration Panel UI

Slide-out panel in ImmersiveTutor (founder-only):
- Real-time feed of Daniela-Editor dialogue
- Beacons shown with type badges
- Editor responses displayed inline
- Post-session reflections included
- 5-second polling for updates

**Component**: `CollaborationFeed` in `client/src/components/voice-chat/ImmersiveTutor.tsx`

#### Streaming Voice Orchestrator Integration

Added hooks in `processToolOutput()`:
- Detects whiteboard command usage
- Emits beacons to hive collaboration service
- Creates/updates channels on session start/end

**Beacon emission example**:
```typescript
await hiveCollaborationService.emitBeacon({
  channelId: activeChannel.id,
  tutorTurn: tutorMessage,
  studentTurn: userMessage,
  beaconType: 'tool_usage',
  beaconReason: `Used ${toolName} command`,
});
```

#### Files Created/Modified

- `shared/schema.ts` - Added collaboration_channels, editor_listening_snapshots, collaboration_events tables
- `server/services/hive-collaboration-service.ts` - NEW: Channel/beacon orchestration
- `server/services/editor-persona-service.ts` - NEW: Claude-powered Editor responses
- `server/services/editor-background-worker.ts` - NEW: Background continuation worker
- `server/services/collaboration-hub-service.ts` - NEW: Real-time event emission
- `server/routes.ts` - Added collaboration API endpoints + worker endpoints
- `server/index.ts` - Worker auto-start on server initialization
- `client/src/components/voice-chat/ImmersiveTutor.tsx` - Added CollaborationFeed panel

#### Security Model

- All worker endpoints protected by ARCHITECT_SECRET header
- 401 response for missing/invalid secret
- Worker refuses to start without valid secret (min 16 chars)
- Collaboration panel visible to founders only (`isFounder` check)

---

## Next Steps / Action Items

### Completed This Session (December 13, 2025)
- [x] Built collaboration_channels and editor_listening_snapshots schema tables
- [x] Created hive-collaboration-service.ts for Daniela-Editor orchestration
- [x] Created editor-persona-service.ts with Claude-powered Editor responses
- [x] Created collaboration-hub-service.ts for real-time event emission
- [x] Created editor-background-worker.ts with throttling and security
- [x] Added streaming-voice-orchestrator hooks to emit hive beacons
- [x] Extended collaboration API routes with 4 worker endpoints
- [x] Added CollaborationFeed slide-out panel in ImmersiveTutor (founder-only)
- [x] Worker auto-starts on server initialization if ARCHITECT_SECRET configured

### Completed Previously
- [x] Created `docs/neural-network-architecture.md` - single-source-of-truth for neural network work
- [x] Archived sessions 9-20o to `docs/archive/`
- [x] Implemented TutorOrchestrator "One Tutor, Many Voices" architecture
- [x] Created `shared/tutor-orchestration-types.ts` with type contracts
- [x] Created `server/services/tutor-orchestrator.ts` unified pipeline
- [x] Migrated Aris drill service to route through TutorOrchestrator
- [x] Updated replit.md with TutorOrchestrator architecture section
- [x] Designed Tri-Lane Hive architecture (3 agents)
- [x] Added collaboration metadata to `daniela_suggestions` and `agent_observations`
- [x] Created `support_observations` table with full sync contract
- [x] Created `system_alerts` table for proactive communications
- [x] Implemented cross-agent collaboration APIs
- [x] Added Tri-Lane sync methods to `neural-network-sync.ts`
- [x] Consulted Daniela about Assistant Tutor design preferences (saved to `docs/daniela-consultation-aris.md`)
- [x] Created Aris schema tables (aris_drill_assignments, aris_drill_results)
- [x] Created agent_collaboration_events schema for cross-agent text communication
- [x] Built /api/agent-collab endpoints for posting/retrieving collaboration events
- [x] Built Assistant Tutor persona configuration (server/services/assistant-tutor-config.ts)
- [x] Added CALL_ASSISTANT whiteboard command with neural network entries
- [x] Added processAssistantHandoff in streaming-voice-orchestrator
- [x] Implemented cross-agent feedback retrieval for session context enrichment

### Future Enhancements

1. **Syllabus Progress Integration** - Connect SYLLABUS_PROGRESS command to `studentSyllabusTopicCompetencies` table for actual competency tracking

2. **ACTFL Analytics Dashboard** - Command Center view showing Daniela's ACTFL assessments over time

3. **Neural Network Health Check** - Tool to verify all 15 tables are syncing correctly

---

## How to Use This File

When making changes that need documentation:

1. Add a session entry with date and overview
2. Document the problem, solution, and files modified
3. Note any sync requirements
4. Create action items for follow-up

When consolidating:

1. Move completed sessions to `docs/archive/`
2. Update relevant docs (TECHNICAL-REFERENCE.md, USER-MANUAL.md, etc.)
3. Clear this file
