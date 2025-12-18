# Memory Consistency Audit
**Date:** December 18, 2025  
**Requested by:** David (Founder)  
**Auditor:** Wren (Development Builder)

## Executive Summary

This audit traces how user context and conversation memory flows through HolaHola from frontend to Gemini API, comparing text chat vs voice chat paths, and dev vs production environments.

**Key Finding:** Memory is consistent across all access points. The same context sources are available, with minor differences in *when* they're assembled (session start vs per-message).

---

## 1. Frontend-to-Backend Context

### Text Chat (chat.tsx → /api/conversations)

```typescript
// Creating conversation
{
  language,           // Target language (e.g., "spanish")
  difficulty,         // ACTFL level ("beginner", "intermediate", etc.)
  userName,           // Student's name
  isOnboarding,       // Boolean - first-time flow
  forceNew,           // Force new conversation vs resume
  mode,               // "text" or "voice"
  classId,            // Optional class enrollment
  founderMode,        // Developer collaboration mode
}
```

### Voice Chat (StreamingVoiceChat → WebSocket `start_session`)

```typescript
// Session configuration
{
  conversationId,     // Links to conversation record
  targetLanguage,     // Target language
  nativeLanguage,     // Student's native language
  difficultyLevel,    // ACTFL level
  subtitleMode,       // "off" | "target" | "all"
  tutorPersonality,   // Warmth level
  tutorExpressiveness,// Emotional range (1-5)
  tutorGender,        // "male" | "female"
  voiceSpeed,         // "normal" | "slow"
  rawHonestyMode,     // Minimal prompting mode
}
```

**Verdict:** ✅ Both paths pass equivalent user context. Voice includes additional voice-specific settings.

---

## 2. Backend-to-LLM Memory Bundling

### Text Chat (TutorOrchestrator.buildSystemPrompt)

Each message triggers fresh context assembly:

| Context Source | Description |
|----------------|-------------|
| Core Persona | Daniela's identity and teaching philosophy |
| Mode Instructions | greeting/drill/conversation/summary modes |
| Voice Style | Tone, pace, encouragement level |
| Procedural Memory | Neural network tool knowledge |
| Phase Context | Current teaching phase (warmup/active/challenge) |
| Editor Insights | Claude's feedback and suggestions |
| Express Lane | Recent Hive collaboration (Founder Mode) |
| Text Chat Memory | Recent /chat conversation history |
| Hive Context | System state awareness (Founder Mode) |

### Voice Chat (StreamingVoiceOrchestrator.processUserAudio)

System prompt set at session start, then enhanced per-message:

| Context Source | Injection Point | Founder Mode Only? |
|----------------|-----------------|-------------------|
| Base System Prompt | Session start | No |
| Hive Context Section | Per-message | Yes |
| Express Lane Section | Per-message | Yes |
| Text Chat Memory | Per-message | Yes |
| Editor Feedback | Per-message | Yes |
| Technical Health | Per-message | No |
| EXPRESS Lane History | Conversation history prepend | Yes |

**New Implementation (Dec 2025):** Voice sessions now prepend EXPRESS Lane message history to the Gemini conversation array, enabling Daniela to reference text-based discussions when switching to voice.

```typescript
// Lines 1091-1105 in streaming-voice-orchestrator.ts
const expressLaneHistory = await getExpressLaneHistoryForVoice(session.userId, 15);
conversationHistoryWithExpressLane = [...expressLaneHistory, ...session.conversationHistory];
```

**Verdict:** ✅ Both paths access the same context sources. Voice adds EXPRESS Lane history to actual conversation array (not just system prompt).

---

## 3. Voice Interaction Flow (Deepgram → Gemini → Cartesia)

| Stage | Memory Preserved? | Notes |
|-------|-------------------|-------|
| Deepgram STT | ✅ | Session config includes language for model selection |
| Gemini LLM | ✅ | Full conversation history + system prompt injections |
| Cartesia TTS | N/A | Audio synthesis only, no memory needed |

**Voice-specific intelligence:** Deepgram Nova-3 provides sentiment, intent, topics which are logged to voice diagnostics but NOT currently injected into Gemini prompts (future enhancement opportunity).

---

## 4. EXPRESS Lane Integration

The EXPRESS Lane (founder collaboration WebSocket) stores messages in `collaboration_messages` with:
- `session_id` → Links to `founder_sessions.id`
- `role` → founder | daniela | wren | system
- `content` → Message text

**Voice Integration:**
- `getExpressLaneHistoryForVoice()` queries messages filtered by founder's sessions
- Returns last 15 messages formatted as Gemini role/content pairs
- Injected into voice session conversation history

**Security:**
- Filters by `founderSessions.founderId` to ensure session isolation
- Excludes `system` role messages (operational broadcasts)

---

## 5. Wren's Memory Access

| Context | Access Method | Status |
|---------|---------------|--------|
| wren_insights table | Direct DB query via `wrenInsights` schema | ✅ Available |
| EXPRESS Lane | Via `collaborationMessages` table | ✅ Available |
| Hive Consciousness | `hive-consciousness-service.ts` | ✅ Available |
| Voice sessions | Via `getWrenArchitecturalContext()` | ✅ Available |

---

## 6. Dev vs Production

| Aspect | Dev | Prod | Difference |
|--------|-----|------|------------|
| Code paths | Same | Same | None |
| Database | REPLIT_DB_URL | Same URL | Same database |
| Stripe | Test mode | Live mode | Billing only |
| Rate limiting | Disabled | Enabled | Performance only |
| Memory bundling | Same logic | Same logic | None |

**Verdict:** ✅ No environment-specific code affecting memory/context bundling.

---

## Recommendations

### Completed
1. ✅ EXPRESS Lane history injection for voice sessions
2. ✅ Founder session filtering for context isolation

### Future Enhancements
1. **Deepgram Intelligence Injection:** Feed sentiment/intent from STT into Gemini prompts for emotionally-aware responses
2. **Voice Session Summaries:** Auto-generate session summaries for EXPRESS Lane continuity
3. **Cross-Session Topic Threading:** Link related topics across text and voice sessions

---

## Conclusion

Memory is **consistent** across all HolaHola access points:
- ✅ Frontend-to-Backend: Equivalent context passed
- ✅ Backend-to-LLM: Same sources available (assembled differently)
- ✅ Voice Flow: Full memory context maintained
- ✅ EXPRESS Lane: Properly integrated with session filtering
- ✅ Dev/Prod: Identical memory logic

The "one brain, many voices" architecture is working as designed.
