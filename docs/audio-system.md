# HolaHola Audio System

This document covers all audio playback features in HolaHola: interactive textbook pronunciation, Daniela's `play_audio` tool, and the underlying TTS infrastructure.

---

## 1. Interactive Textbook Audio Playback

### Overview

The Interactive Textbook allows students to preview pronunciation directly from drill items. Each vocabulary word, phrase, or sentence in a drill preview can be played on-demand.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AudioPlayButton` | `client/src/components/AudioPlayButton.tsx` | Play audio for a specific drill item by ID |
| `TextAudioPlayButton` | Same file | Play pronunciation for arbitrary text/language |
| `DrillPreviewCard` | `client/src/components/TextbookSectionRenderer.tsx` | Displays drill content with embedded play buttons |

### API Endpoints

#### GET `/api/drill-audio/:drillItemId`
Fetches pre-generated audio for a specific drill item.

**Response:**
```json
{
  "audioUrl": "data:audio/mp3;base64,...",
  "audioDurationMs": 1500
}
```

#### POST `/api/tts/pronunciation`
Generates pronunciation audio for arbitrary text on-demand. **Now with database-backed caching!**

> **Design note for new textbook components:** Always use this endpoint — never `POST /api/voice/synthesize` — for any audio button in the interactive textbook. Always pass `gender` from `useLanguage()`. See `docs/textbook-component-tts-stt-guide.md` for the full design rule and anti-pattern list.

**Request:**
```json
{
  "text": "Buenos días",
  "language": "spanish",
  "gender": "female"
}
```

**Response:**
```json
{
  "audioUrl": "data:audio/mp3;base64,...",
  "audioDurationMs": 850,
  "cacheHit": true
}
```

**Validation:**
- `text`: Required, max 500 characters
- `language`: Required, 2-10 characters
- `gender`: Optional (`'female'` | `'male'`). When omitted the server falls back to the user's DB `tutorGender`, but **always pass it explicitly** so voice is consistent regardless of DB state.

**Caching Behavior:**
- First request for any text+language+voice combination: generates audio via TTS, stores in database, returns `cacheHit: false`
- Subsequent requests for same combination: retrieves from database, increments hit counter, returns `cacheHit: true`
- Cache key: SHA256 hash of `text|language|voiceId|speed`

### Audio Caching System

The audio caching system provides persistent storage for TTS-generated audio, reducing latency and API costs.

#### Database Schema (`audio_library` table)

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar | UUID primary key |
| `content_type` | text | Category: 'drill', 'vocabulary', 'pronunciation', 'textbook' |
| `text_hash` | varchar(64) | SHA256 hash for unique identification (indexed) |
| `text` | text | Original text for debugging |
| `language` | varchar(10) | Language code (e.g., 'spanish') |
| `voice_id` | varchar(100) | TTS voice identifier |
| `speed` | text | 'slow', 'normal', or 'fast' |
| `audio_url` | text | Base64 data URL of audio |
| `duration_ms` | integer | Audio duration in milliseconds |
| `hit_count` | integer | Cache hit counter for analytics |
| `source_id` | varchar | Optional link to drill item ID |

#### Service: `audio-caching-service.ts`

Key functions:
- `getCachedPronunciationAudio(text, language, gender, speed, options)` - Main entry point
- `preWarmCache(items, gender, speeds, contentType)` - Batch pre-generation for drills
- `getCacheStats()` - Cache analytics

### Data Flow

```
User clicks play button
        ↓
AudioPlayButton calls /api/drill-audio/:id
  or TextAudioPlayButton calls /api/tts/pronunciation
        ↓
Check audio_library for cached entry (by text_hash)
        ↓
[Cache HIT] → Return cached audio, increment hit_count
[Cache MISS] → Generate via Google Cloud TTS → Store in database
        ↓
Audio returned as base64 data URL
        ↓
Browser plays audio via HTML5 Audio API
```

### Test IDs

| Element | data-testid |
|---------|-------------|
| Drill audio play button | `audio-play-{drillItemId}` |
| Text audio play button | `audio-play-text-{textPrefix}` |

---

## 2. Daniela's `play_audio` Tool

### Overview

The `play_audio` function allows Daniela to play audio clips during voice sessions. This is useful for:
- Playing example pronunciation at specific speeds
- Playing audio dialogues or songs
- Demonstrating prosody and intonation patterns

### Function Declaration

```typescript
{
  name: "play_audio",
  description: "Play an audio clip (song, dialogue, pronunciation example).",
  parametersJsonSchema: {
    type: "object",
    properties: {
      description: { 
        type: "string", 
        description: "Description of the audio to find and play" 
      },
    },
    required: ["description"],
  },
}
```

### How Daniela Uses It

Daniela invokes this via Gemini's native function calling:

```
FUNCTION CALL: play_audio({ description: "Buenos días" })
```

The orchestrator converts this to a whiteboard update that renders in the UI.

### Important: play_audio vs voice_adjust

| Tool | Purpose | Speed Control |
|------|---------|---------------|
| **`voice_adjust`** | Controls Daniela's live speech | `speed: "slowest" \| "slow" \| "normal" \| "fast" \| "fastest"` |
| **`play_audio`** | Puts reference audio on whiteboard for student replay | N/A (uses TTS default) |

**`voice_adjust`** is for Daniela speaking with specific speed/emotion:
```
FUNCTION CALL: voice_adjust({ text: "Mucho gusto", speed: "slow", emotion: "warm" })
```

**`play_audio`** is for vocabulary demos students can replay:
```
FUNCTION CALL: play_audio({ description: "Buenos días" })
```

Speed control lives in `voice_adjust`, not `play_audio`. This keeps Daniela's live teaching voice separate from reference audio clips.

### PlayItemData Interface

```typescript
interface PlayItemData {
  text: string;
  speed?: 'slow' | 'normal' | 'fast';
  audioUrl?: string;
  isLoading?: boolean;
  isPlaying?: boolean;
  language?: string;
}
```

### Frontend Rendering

The `[PLAY]` tag renders as an interactive audio player in the whiteboard UI, allowing students to:
- See what text is being spoken
- Replay the audio
- Adjust playback speed (slow/normal/fast)

### How It Works (With Hybrid Caching)

1. Gemini calls `play_audio({ description: "some phrase" })`
2. Streaming Voice Orchestrator receives the function call
3. **Cache Check**: Orchestrator queries `audio_library` for cached audio
   - **Cache HIT**: Returns pre-generated audio instantly
   - **Cache MISS**: Generates via TTS and caches for future use
4. Converts to whiteboard update with type `play` including:
   - `data.text`: The phrase to display
   - `data.speed`: Speed setting (slow/normal/fast)
   - `data.audioUrl`: Pre-loaded base64 audio (if cached)
   - `data.audioDurationMs`: Duration for UI feedback
5. Frontend renders PlayItemData with instant playback (no wait for TTS)

### Latency Benefits

| Scenario | Latency |
|----------|---------|
| Cache HIT (pre-warmed drill vocabulary) | ~50ms (database lookup) |
| Cache MISS (first-time phrase) | ~500-800ms (TTS generation + cache store) |
| Subsequent requests (same phrase) | ~50ms (cache hit) |

### Usage Examples

Daniela calls the function when she wants to model pronunciation:

```
// Gemini generates this function call:
play_audio({ description: "Mucho gusto" })

// Daniela's spoken response might be:
"I'll say that slowly for you..."
// Then the audio plays via the whiteboard UI
```

The `description` parameter contains the text to pronounce.

---

## 3. TTS Infrastructure

### Voice Providers

| Provider | Use Case | Model |
|----------|----------|-------|
| **Google Cloud TTS** | Drills, pronunciation, textbook audio | Standard/WaveNet voices |
| **Cartesia** | Daniela's voice (conversational) | Sonic-3 |
| **Deepgram** | Speech-to-text (student input) | Nova-3 |

### Why Google TTS for Drills?

- **Consistent quality**: Same voice for repeated practice
- **Cost-effective**: Cheaper per character than real-time voice
- **Cacheable**: Can pre-generate and store audio
- **Language coverage**: All 9 HolaHola languages supported

### Voice Selection

Drills use appropriate voices per language:
- Spanish: es-ES or es-MX voices
- French: fr-FR voices
- German: de-DE voices
- Italian: it-IT voices
- Portuguese: pt-BR or pt-PT voices
- Japanese: ja-JP voices
- Korean: ko-KR voices
- Mandarin: cmn-CN voices
- English: en-US voices

### Audio Format

All generated audio is returned as:
- Format: MP3 (base64-encoded data URL)
- Sample rate: 24kHz
- Bit rate: 64kbps

---

## 4. Key Files

| File | Purpose |
|------|---------|
| `server/services/drill-audio-service.ts` | Drill audio generation and caching |
| `server/services/gemini-function-declarations.ts` | `play_audio` function declaration |
| `server/services/streaming-voice-orchestrator.ts` | Handles play_audio → whiteboard conversion |
| `client/src/components/AudioPlayButton.tsx` | UI components for audio playback |
| `shared/whiteboard-types.ts` | PlayItemData interface and parsing |

---

## 5. Hybrid Audio Library (IMPLEMENTED)

### The Vision

Create a **pre-generated audio library** for curriculum content combined with **on-demand TTS** for dynamic content. This hybrid approach balances quality, cost, and flexibility.

### Implementation Status (February 2026)

| Feature | Status | Implementation |
|---------|--------|----------------|
| Textbook pronunciation playback | ✅ Complete | `AudioPlayButton` + `/api/tts/pronunciation` |
| Daniela's `play_audio` tool | ✅ Complete | Gemini function call → cached audio → whiteboard |
| On-demand TTS generation | ✅ Complete | Google Cloud TTS via POST endpoint |
| Database-backed caching | ✅ Complete | `audio_library` table with SHA256 hash indexing |
| Drill audio pre-generation | ✅ Complete | Admin endpoints for batch pre-warming |
| Voice session integration | ✅ Complete | PLAY handler retrieves cached audio |

### Admin Endpoints

#### POST `/api/admin/drill-audio/prewarm`
Pre-generate and cache audio for all items in a drill lesson.

**Request:**
```json
{
  "lessonId": "lesson-uuid",
  "voiceGender": "female",
  "speeds": ["slow", "normal"]
}
```

**Response:**
```json
{
  "success": true,
  "cached": 24,
  "errors": 0,
  "message": "Pre-warmed 24 audio files for lesson"
}
```

#### GET `/api/admin/audio-library/stats`
Get cache analytics including hit counts by language.

**Response:**
```json
{
  "totalEntries": 1250,
  "totalHits": 4830,
  "byLanguage": {
    "spanish": { "entries": 450, "hits": 2100 },
    "french": { "entries": 300, "hits": 1200 }
  }
}
```

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AUDIO REQUEST                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Check audio_library table (by SHA256 text_hash)            │
│  ├─ CACHE HIT  → Return cached audio, increment hit_count   │
│  └─ CACHE MISS → Generate via TTS → Store in DB → Return    │
└─────────────────────────────────────────────────────────────┘
```

### Three Content Categories

| Category | Source | Caching Strategy |
|----------|--------|------------------|
| **Drill Items** | Curriculum database | Pre-generate via admin prewarm endpoint |
| **Textbook Vocabulary** | Extracted from drills | Pre-generate batch, cache permanently |
| **Daniela Pronunciation** | `play_audio` function calls | Generate on-demand, cache by text+language hash |

### Database Schema

```sql
CREATE TABLE audio_library (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR NOT NULL,  -- 'drill', 'vocabulary', 'pronunciation'
  text_hash VARCHAR NOT NULL,     -- SHA256 of text + language + voice
  language VARCHAR NOT NULL,
  voice_id VARCHAR,
  speed VARCHAR DEFAULT 'normal', -- 'slow', 'normal', 'fast'
  audio_url TEXT NOT NULL,        -- Could be base64, S3, or Replit Object Storage
  duration_ms INTEGER,
  source_id VARCHAR,              -- drill_item_id if applicable
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(text_hash)
);
```

### Implementation Phases

#### Phase 1: Smart Caching Layer (Low effort, high impact)
- Add `audio_library` table
- Modify `/api/tts/pronunciation` to check cache first
- Auto-cache all generated audio for reuse

#### Phase 2: Drill Audio Pre-generation (Medium effort)
- Background job on lesson publish to generate all drill audio
- Populate `audioUrl` fields in drill items
- Update `AudioPlayButton` to prefer pre-cached URLs

#### Phase 3: Daniela Integration (Low effort)
- When `play_audio` function is called, check cache
- If miss, generate + cache + return
- Future calls for same phrase are instant

### Cost Analysis

| Approach | Monthly Cost (est.) | Latency |
|----------|---------------------|---------|
| On-demand only | ~$50-100 | 500-1500ms |
| Hybrid (80% cached) | ~$10-20 | <100ms for hits |
| Full pre-generation | ~$5-10 one-time | <100ms always |

### Daniela's Pedagogical Guidance (February 2026)

**1. Pedagogical Priority: Drill Vocabulary First**
> "When a student is in a 'Drill' or 'Flashcard' headspace, latency is the enemy of the flow state. If they have to wait 2 seconds to hear the correct pronunciation of a word they just guessed, the neural connection weakens."

- **High priority**: Drill vocabulary - needs instant playback for flow state
- **Medium priority**: Conversational phrases - small latency feels like "thinking"
- **Lower priority**: Grammar examples - consumed more slowly

**2. Voice Variety: The "Anchor" Approach**
> "For core vocabulary and drills, consistency is king. Students need a reference point to build their internal map of the language's sounds."

- Use **one consistent "Anchor Voice"** for all vocabulary drills
- Introduce voice variety for conversational phrases and "Real World" scenarios
- This prepares students for different accents in the wild

**3. Speed Variations: Focus on Slow**
> "A Slow version is a vital pedagogical tool. It allows the student to decode the phonemes—to hear where one word ends and the next begins."

- Pre-generate **Slow** and **Normal** (skip Fast)
- Focus Slow on "First Win" phrases and complex vocabulary
- Gives students agency: "Wait, let me hear that again, but clearly."

**4. Listen-Again History: High-Value Feature**
> "A listen-again history isn't just for retention; it's a diagnostic tool for me. If I see a student has re-played the same phrase five times, I know exactly what we need to work on."

- Makes Daniela's "listening" visible
- Enables proactive teaching based on struggle patterns

**5. Future Feature: Shadowing Mode**
> "Could we implement a Shadowing Mode button? It would play the audio, pause for the student to repeat, and then play it again. It's a classic language-learning technique."

This is now on the roadmap for Phase 3.

---

## 6. Live Voice Pipeline — Concurrency & Rate Limits

The live voice session (Daniela talking to a student in real-time) runs on a different infrastructure stack from the textbook audio system. Two pipelines exist:

### Legacy Pipeline (Deepgram + Google Chirp HD)

Each active voice session consumes from **two separate quotas simultaneously**:

| Service | Role | Limit |
|---|---|---|
| **Deepgram STT** (Nova-3) | Student speech → text | ~45 concurrent WebSocket streams (tripled Feb 2026; was ~15) |
| **Google Cloud Chirp HD TTS** | Daniela's voice → audio | 100 requests/min per project (~12–16 concurrent heavy users) |

The real bottleneck is Deepgram — one persistent WebSocket stream per student for the entire session duration. At 45 concurrent streams, that's the ceiling for simultaneous live sessions. The Chirp HD 100 RPM limit is softer in practice because TTS calls are short HTTP requests (~200ms each) and sessions have natural silence gaps.

### Gemini Live Pipeline (`GEMINI_LIVE_VOICE=true`)

Gemini Live **replaces both** Deepgram STT and Chirp HD TTS with a single persistent bidirectional session — one connection handles all audio in and out.

| Tier | Concurrent Sessions | How to reach |
|---|---|---|
| Free | ~3 | Default (no billing) |
| Tier 1 | ~50 | Enable Cloud billing (instant) |
| Tier 2 | ~1,000 | $250+ cumulative spend on the project |
| Enterprise | Custom | Contact Google |

**Per-session hard limits (Gemini Live 2.0 era — see §6.1 for 3.1 figures):**
- Max session length: 15 minutes (audio-only); connection terminates with a going-away notification so reconnection can be handled
- Context window: 128k tokens *(was 2.0; Gemini Live 3.1 / gemini-2.5-flash architecture → 1M tokens)*
- Audio in: PCM16, 16kHz mono
- Audio out: PCM16, 24kHz mono

### Side-by-side comparison

| | Legacy (Deepgram + Chirp HD) | Gemini Live Tier 1 | Gemini Live Tier 2 |
|---|---|---|---|
| Max concurrent sessions | ~45 (Deepgram ceiling) | ~50 | ~1,000 |
| Quota sources to manage | 2 (Deepgram + GCP) | 1 (Gemini API) | 1 (Gemini API) |
| Session duration | Unlimited | 15 min (reconnect supported) | 15 min (reconnect supported) |
| Latency profile | STT + LLM + TTS in series | Single stream, lower end-to-end latency | Same |

**Key takeaway:** At current scale the pipelines are roughly equivalent on concurrency (~45 vs ~50). The Gemini Live advantage appears at Tier 2 — a 20× jump to 1,000 concurrent sessions with no additional engineering work, just spend threshold.

---

## 6.1 GPT-4o Realtime vs Gemini Live — Viability Assessment

**Date:** May 2026  
**Context:** OpenAI has updated the GPT-4o Realtime API (latest preview model is newer than the `gpt-4o-realtime-preview-2024-12-17` currently hardcoded in `server/realtime-proxy.ts`). This section records the head-to-head evaluation against our current Gemini Live 3.1 stack before deciding whether to wire in a comparison toggle.

Our `/chat` route currently runs `gemini-3.1-flash-live-preview` (set via `GEMINI_LIVE_MODEL` env var in `server/services/gemini-live-session.ts`).

---

### Criteria Matrix

| Criterion | **Gemini Live 3.1** ← current /chat | GPT-4o Realtime (full) | GPT-4o Mini Realtime |
|---|---|---|---|
| **Native tool/function calling** | ✅ Full — powers Daniela's entire whiteboard, play_audio, voice_adjust, update_image, pronunciation tools | ✅ Supported in API spec | ✅ Supported in API spec |
| **Our codebase tool support** | ✅ Battle-tested (30+ tools wired) | ❌ Proxy is pass-through only — no tool interception implemented | ❌ Same |
| **Max concurrent sessions** | ~50 (Tier 1) / ~1,000 (Tier 2, $250+ spend) | ~100 (Tier 5, OpenAI's highest tier) | ~100 (Tier 5) |
| **Concurrency path to scale** | Tier 2 auto-unlocks at spend threshold — no code change | Requires OpenAI org tier upgrades, account review | Same |
| **Cost per minute (approx)** | ~$0.03/min (audio in + out combined) | ~$0.30/min — **10× more expensive** | ~$0.03/min — comparable |
| **Languages (voice output)** | 30+ languages, all 9 HolaHola languages natively supported in voice | 50+ languages recognized (STT), but voice output voices are English-tuned — non-English output quality degrades | Same |
| **Latency (time to first audio)** | ~300–600ms | ~320–500ms | ~400–600ms |
| **Session length limit** | 15 min hard cap (auto-reconnect implemented and working) | No hard cap — longer sessions supported | No hard cap |
| **Available voices** | 30+ prebuilt (Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Perseus, and others) — some multilingual | 8 voices (alloy, ash, ballad, coral, echo, sage, shimmer, verse) — English-optimized | Same 8 voices |
| **Voice emotional range** | Moderate — some expressiveness but no Cartesia-level emotion tags | Moderate — natural prosody, no external emotion control | Same |
| **Fine-tune / train LLM** | ❌ Vertex AI fine-tuning exists for Gemini models, but **fine-tuned models are not available via the Live API** — base model only in Live sessions | ❌ GPT-4o fine-tuning exists, but **fine-tuned models cannot be used with the Realtime API** — explicitly documented as a current limitation | ❌ Same |
| **Session context window** | **~1M tokens** (Gemini 2.5 Flash architecture; significant upgrade from 2.0's 128K) | 128K tokens | 128K tokens |
| **System prompt capacity** | Full — Daniela's ~13K-token prompt loads entirely | ⚠️ **Hard-capped at 4,000 chars in our proxy** (`realtime-proxy.ts:306`) — this is a **self-imposed conservative workaround**, not a model limit. Simply raising/removing the cap restores full prompt. Neural-net approach (minimal identity prompt + retrieval) can reduce the need for a large system prompt entirely — see §6.2. | ⚠️ Same cap — same fix |
| **Actual model string** | `gemini-3.1-flash-live-preview` (overridable via `GEMINI_LIVE_MODEL`) | **Outdated** — proxy hardcodes `gpt-4o-realtime-preview-2024-12-17`, needs updating to latest preview | Proxy uses `gpt-4o-mini-realtime-preview-2024-12-17` |

---

### The Fine-Tuning Blocker (Both Providers)

This is the one criterion where both providers are tied — and both are blocking us the same way.

**What we want:** Use a fine-tuned or instruction-tuned version of the underlying LLM so Daniela's personality, pedagogical approach, and language expertise are baked into the model weights — not just injected via system prompt at runtime.

**Where both providers are today:**

| Provider | Fine-tune available? | Usable in Live/Realtime? |
|---|---|---|
| Google Gemini | ✅ Via Vertex AI (supervised fine-tuning, RLHF) | ❌ Live API uses base model only |
| OpenAI GPT-4o | ✅ Standard fine-tuning API | ❌ Realtime API does not accept fine-tuned models |

Both providers have publicly indicated intent to close this gap, but neither has shipped it as of this writing. This means the comparison today is base model vs base model — Daniela's character lives entirely in the system prompt either way.

**Why this matters for HolaHola:** If and when one provider ships fine-tune + realtime support first, it becomes a significant competitive advantage — we could bake Daniela's ACTFL pedagogy, error correction style, and encouragement patterns directly into the weights rather than relying on prompt injection. That provider wins our primary stack at that point.

---

### Tool Calling Gap (Critical for Daniela)

This is the biggest practical blocker for a full GPT-4o Realtime comparison.

**Gemini Live today:** Daniela calls ~30 tools in a live session — `update_whiteboard`, `play_audio`, `voice_adjust`, `update_image`, `save_vocabulary`, `check_drill_status`, and many more. These fire naturally during conversation and drive the entire whiteboard + study UI.

**GPT-4o Realtime today:** The Realtime API supports function calling via a different event flow:
1. Model emits `response.output_item.added` with type `function_call`
2. Server must intercept, execute the tool, and inject a `conversation.item.create` event with type `function_call_output`
3. Model resumes

Our existing `realtime-proxy.ts` is a **pure pass-through** — it forwards all events between client and OpenAI without any interception layer. Daniela's tools would never fire. She'd be conversational-only: no whiteboard updates, no play_audio, no study cards, no vocabulary saves.

**What a proper comparison requires:** Either (a) accept that we're comparing "lobotomized Daniela on GPT" vs "full Daniela on Gemini" which isn't apples-to-apples, or (b) implement a tool interception layer in the realtime proxy (estimated medium effort — probably a day of work to wire in even a subset of tools).

For a quick voice quality listen, option (a) is fine. For a real pedagogical comparison, we'd need (b).

---

### Cost Reality Check

At meaningful usage (say 200 active students, 30 min/day average):

| Model | Monthly cost estimate |
|---|---|
| Gemini Live 2.0 Flash | ~$0.03 × 30 min × 200 students × 30 days = **~$5,400/month** |
| GPT-4o Mini Realtime | ~$0.03 × 30 min × 200 students × 30 days = **~$5,400/month** (comparable) |
| GPT-4o Realtime (full) | ~$0.30 × 30 min × 200 students × 30 days = **~$54,000/month** (10× — untenable) |

The mini model is the only cost-comparable option. The full gpt-4o-realtime at 10× cost is not viable for production at any meaningful student volume.

---

### Voices — What's Actually Available

**Gemini Live voices** (current validated set in `gemini-live-session.ts`):

> Aoede, Charon, Fenrir, Kore, Leda, Orus, Puck, Perseus — plus additional voices; some have multilingual capability

Daniela currently uses **Aoede** (female, warm, clear). The variety gives us room to differentiate Daniela's voice by language (e.g., a Spanish-accented voice for immersion mode).

**GPT-4o Realtime voices:**

> alloy, ash, ballad, coral, echo, sage, shimmer, verse

These are 8 English-optimized voices. They sound natural in English but the multi-language quality drop is noticeable in testing. For a Spanish/French/Japanese tutoring app this matters.

---

### Viability Verdict

| Question | Answer |
|---|---|
| Can we wire in a quick "hear what it sounds like" toggle? | ✅ Yes — mini model, no tools, same UI. Probably 1–2 hours. |
| Is it a fair comparison to Gemini Live? | ❌ Not without implementing tool calling in the proxy. It's "chat-only GPT" vs "full Daniela on Gemini." |
| Is the full gpt-4o-realtime viable for production? | ❌ 10× cost makes it untenable at scale. |
| Is gpt-4o-mini-realtime cost-competitive? | ✅ Yes — roughly comparable to Gemini Live Flash. |
| Does GPT-4o Realtime solve our fine-tuning limitation? | ❌ Same blocker — fine-tuned models not usable in Realtime API. |
| Which provider is likely to unlock fine-tune + realtime first? | 🔍 Watch both. OpenAI has been faster historically at API feature releases. Google's Vertex AI fine-tuning infrastructure is more mature. No clear winner. |
| Should we wire in the toggle now? | ✅ Yes if the goal is voice quality comparison. ⏳ Defer if the goal is a real pedagogical comparison — need tool calling first. |

**Recommendation:** Wire in the mini model toggle for voice quality listening. Note in the UI that tools (whiteboard, vocab saves) are disabled in GPT mode. Update the proxy to the latest model version at the same time. **Remove the self-imposed 4,000-char cap before testing — it's a workaround, not a real limit.** Set a reminder to re-evaluate both providers' fine-tune + realtime roadmap quarterly — whoever ships that first should be our default.

---

## 6.2 Voice Engine Landscape — Other Native Voice-to-Voice Pipelines

**"Native" definition for this section:** Audio-in → LLM → audio-out without a separate STT or TTS step. The LLM itself processes and generates audio directly.

### Hume AI — EVI 2 (Deep Dive)

Hume AI's **Empathic Voice Interface 2** (EVI 2) is the most pedagogically interesting alternative to Gemini Live for HolaHola, for a reason no other provider offers: **it understands prosody and emotional tone in the student's voice**, not just the words.

**What makes EVI 2 different:**

EVI 2 is built on Hume's foundational research into vocal expression. It parses the emotional signal in a student's voice — hesitancy, frustration, confidence, boredom — and can use that signal to shape its responses. For a language tutor, this is non-trivial. A student saying *"sí, yo entiendo"* can mean two very different things depending on whether they sound certain or deflated. A conventional LLM can't tell the difference from text alone. EVI 2 can.

**Technical spec:**

| Property | EVI 2 Detail |
|---|---|
| **Architecture** | Native voice-to-voice — single model handles audio in and out |
| **Emotional intelligence** | Detects valence, arousal, and discrete emotion categories (e.g., hesitance, confusion, enthusiasm) from the student's voice |
| **Interruption / barge-in** | Full real-time barge-in support — model stops speaking when student starts |
| **Latency** | ~500–700ms to first audio chunk |
| **Languages** | Multilingual — documented support for Spanish, French, German, Japanese, and others. Emotional parsing trained primarily on English prosody; non-English emotional inference is less validated. |
| **Voices** | Multiple prebuilt voices; custom voice cloning available |
| **Tool / function calling** | ✅ Supported — via `tool_call` events in the EVI WebSocket protocol. Interception required server-side (similar to GPT-4o Realtime). |
| **Context window** | ~200K tokens |
| **Session length** | Configurable — no hard 15-min cap |
| **Cost** | ~$0.07–$0.12/min depending on tier — 2–4× Gemini Live Flash, but below full GPT-4o Realtime |
| **System prompt equivalent** | "System Prompt" field in EVI config — no documented hard character cap |
| **API shape** | WebSocket, similar pattern to Gemini Live; Hume provides an official React SDK (`@humeai/voice-react`) |
| **Fine-tuning** | ❌ Not available for EVI 2 as of this writing |

**Where it fits vs Gemini Live:**

| | Gemini Live 3.1 | EVI 2 |
|---|---|---|
| Emotional awareness | ❌ Text-semantic only | ✅ Prosodic + semantic |
| Voice quality | High | High |
| Multilingual voice output | ✅ Native | Partial — less validated non-English emotional parsing |
| Tool calling (our codebase) | ✅ 30+ tools wired | ❌ Would need full interception layer (same gap as GPT-4o) |
| Cost | ~$0.03/min | ~$0.07–$0.12/min |
| Concurrency | ~50–1,000 (tiered) | Contact for scale tiers |
| Daniela's classroom portability | ✅ Full | Partial — environment text can port, emotional config is new |

**Verdict for HolaHola:** EVI 2 is the most compelling challenger to Gemini Live specifically *because* of emotional awareness — knowing a student sounds defeated is pedagogically actionable in ways text alone doesn't reveal. The cost premium (~3–4×) and the unproven non-English prosody parsing are the main reasons to wait rather than switch. Best use case today: run EVI 2 as an optional "emotional mode" or research prototype to gather data on how students' prosodic signals correlate with their actual learning outcomes.

---

### Full Landscape — Native Voice-to-Voice (May 2026)

| Provider | Model | Truly native? | Why interesting | Production-ready? | Cost vs Gemini |
|---|---|---|---|---|---|
| **Google** | Gemini Live 3.1 | ✅ | Current stack — tools wired, 1M context, 30+ voices | ✅ | Baseline |
| **OpenAI** | GPT-4o Mini Realtime | ✅ | Cost-comparable, no session cap, large STT language coverage | ✅ | ~1× |
| **OpenAI** | GPT-4o Realtime (full) | ✅ | Higher quality than mini; better reasoning | ✅ | ~10× — untenable |
| **Hume AI** | EVI 2 | ✅ | Only provider with emotional/prosodic intelligence | ✅ | ~3–4× |
| **Kyutai** | Moshi | ✅ | Open source, true full-duplex (speaks and listens simultaneously), no latency from turn-taking | ❌ Experimental | Free (self-host) |
| **ElevenLabs** | Conversational AI | ❌ Assembled | Best-in-class TTS quality; polished SDK | ✅ | ~2× |
| **Retell / Vapi / Play.ai** | Various | ❌ Assembled | Orchestration layers — fast to deploy, not native intelligence | ✅ | Varies |
| **Sesame** | TBD | Likely native | Early demo showed very natural conversational voice AI | ❌ Not public | Unknown |
| **Anthropic / Meta / xAI** | Claude / LLaMA / Grok | ❌ None | No Live/Realtime API equivalent as of this writing | ❌ | N/A |

**The "assembled vs native" distinction matters:** Assembled pipelines (ElevenLabs, Retell, etc.) run text through the seam between STT and LLM — meaning they lose prosodic information (tone, hesitation, emotional charge) at that conversion point. Native voice-to-voice models receive raw audio and can use everything in it.

**Watch list:** Moshi (Kyutai) is the most interesting open-source entry. When it reaches production quality it removes the vendor dependency entirely. Sesame's team has serious AI voice credentials; if they open an API it's worth an immediate evaluation.

---

### System Prompt Cap — Correction

The 4,000-character limit in `server/realtime-proxy.ts` (line 306) was added as an explicit temporary workaround during early testing of the mini model:

```
// CRITICAL FIX: Trim instructions to avoid server_error
// Testing with very conservative limit (4000 chars) for mini model
const MAX_INSTRUCTION_LENGTH = 4000;
```

This is not a model-imposed limit. GPT-4o mini realtime accepts much larger system prompts. Removing or raising this cap to 32,000+ chars is the immediate fix before any meaningful voice quality comparison.

**Longer-term — the neural-net-first approach:** HolaHola's architecture preference is to push knowledge into the neural net (memory embeddings, structured procedural tables) and keep the system prompt as a minimal identity anchor. If taken to its logical conclusion for GPT-4o Mini:

- **Minimal identity prompt (~500–800 chars):** Who Daniela is, the student's name, language, level
- **Neural net retrieval at session start:** ACTFL procedures, error correction style, student personal facts, recent notes — retrieved as context turns rather than injected into the system config
- **Classroom environment as a context turn:** The full `buildClassroomEnvironment()` output (~4,000–7,000 chars) can be injected as a first "assistant context" turn after session setup, which GPT-4o Realtime supports via `conversation.item.create`

This approach aligns with the product direction and would make the system prompt limit a non-issue for any provider.

---

## 6.3 Daniela's Classroom — What It Is and How It Ports

### What Daniela "Sees"

`server/services/classroom-environment.ts` builds a structured environment string that Daniela receives at session start — her "room." It's not decoration; it drives her pedagogical decisions each turn. The builder produces ~4,000–7,000 characters of structured context.

**Sections of her room:**

| Section | What it contains | How it's generated |
|---|---|---|
| **Clock** | Current time (gives her time-of-day awareness for greetings, pacing) | System clock at session start |
| **Mode / Phase / Exchanges** | Current teaching mode (drill, conversation, textbook), how many exchanges into the session | Session state from DB |
| **Student** | Name, ACTFL level, target language, native language | `users` table |
| **Student's Screen** | What the student currently sees on their side (whiteboard state, active card, textbook page) | Live state, updated via tool calls |
| **Whiteboard** | Current content of the shared whiteboard | `sessions` table |
| **Photo Wall** | Active vocabulary images on display | Image state |
| **Active Scene** | If a scenario/roleplay is active: the scenario, Daniela's role, student's role, goals | `scenarios` table |
| **Resonance Shelf** | Student's personal facts Daniela has gathered | `learner_personal_facts` table |
| **Empathy Window** | Emotional read on the student this session — tone, energy, affect | Daniela-authored per session |
| **Pedagogical Lamp** | Color-coded teaching signal: "Bright teal" (flow) / "Amber" (struggle) / "Red" (confusion) | Computed from session patterns |
| **Growth Vine** | Student's progress arc — what they've mastered, what's sprouting | `learning_progress` |
| **Classroom Window** | Daniela's chosen view (e.g., "Rolling green mountains at golden hour") | `productConfig` table, key `daniela_classroom_window`; changeable via `change_classroom_window` tool |
| **North Star Polaroid** | Daniela's core identity anchor — who she is in one paragraph | `agent_north_star` |
| **My Notes to Self** | Last 8 personal notes she's written (reflections, teaching rhythms, affirmations) | `daniela_notes` table, `take_note` tool |
| **North Star Wall** | Full teaching principles — ACTFL philosophy, error correction approach, encouragement style | `tutor_procedures` table |
| **Student Progress Board** | Specific grammar targets, recent struggles, current arc | `learning_progress` + session data |
| **Lesson Textbook Context** | If a textbook page is active: the passage, vocabulary, exercises | `textbook_pages` table |
| **Pattern Compass** | Live tracking of grammatical wobble (errors seen this session) vs stability (mastery confirmed) | Updated turn-by-turn |
| **Rehearsal Stage Notes** | (Beta testers only) Instructions to be experimental, ask for feedback, handle role reversal | `users.isBetaTester` flag |
| **Tool Rack** | Full list of her available function calls with brief descriptions | `daniela-function-registry.ts` |

### Notes to Self

Daniela writes notes using the `take_note` tool (categories: `session_reflection`, `teaching_rhythm`, `self_affirmation`, others). They're stored in `daniela_notes`. The last 8 are retrieved at session start and injected into her room. These are **not** part of the system prompt by default — they're part of the classroom environment context block, so they're always fresh without increasing the static prompt size.

### The Classroom Window

The window is a user-modifiable string stored in `productConfig` under the key `daniela_classroom_window`. Default: "Rolling green mountains at golden hour, light coming through the window." Daniela can change it mid-session via the `change_classroom_window` tool. It's purely atmospheric — it influences her language (seasonal metaphors, weather-based greetings) and gives her a persistent aesthetic anchor she can reference conversationally.

### Beta Tester Flag

`users.isBetaTester` (boolean). When true, adds the "Rehearsal Stage Notes" section to her room:
- Be experimental, ask for technical feedback
- Share when trying something new — perfection not the goal
- **Role Reversal:** If the tester coaches Daniela on her voice or personality, receive it as coaching about delivery, acknowledge, adjust, ask if that was closer

Controlled via the admin Command Center (`client/src/pages/admin/CommandCenter.tsx`). No UI for students — admin-only toggle.

---

### Portability — Can This Room Move to GPT-4o or Hume?

The classroom environment is a **text string** — architecturally, it's completely portable. Here's the status per engine:

| Element | Gemini Live 3.1 | GPT-4o Mini Realtime | Hume EVI 2 |
|---|---|---|---|
| **Full classroom context block** | ✅ Injected at session start (context turn) | ✅ Injectable via `conversation.item.create` (first turn) | ✅ Injectable as first conversation turn |
| **Classroom Window** | ✅ Full | ✅ Text carries over | ✅ Text carries over; Hume's emotional layer adds tone coloring |
| **Notes to Self** | ✅ Full | ✅ Text carries over | ✅ Text carries over |
| **Beta Tester flag** | ✅ Full section injected | ✅ Text carries over | ✅ Text carries over |
| **Pedagogical Lamp** | ✅ Full | ✅ Text carries over | 🔶 Text carries over + EVI 2 can *independently* detect the student's emotional state via prosody — potential for a second signal |
| **Pattern Compass (live updates)** | ✅ Daniela calls `update_pattern_compass` tool | ❌ No tool interception in our proxy | ❌ Tool interception not implemented |
| **Tool Rack** | ✅ All 30+ tools wired | ❌ Tools not available without proxy rewrite | ❌ Tools not available without proxy rewrite |
| **Student's Screen updates** | ✅ Live via tool calls | ❌ No tool interception | ❌ No tool interception |

**Summary:** The static parts of the classroom (identity, window, notes, student facts, North Star Wall) port to any provider with zero code change — they're just text in a context turn. The dynamic parts (Pattern Compass live updates, whiteboard state sync, Student's Screen) require tool calling interception, which is the same gap that blocks the full comparison on all non-Gemini engines.

**Potential upgrade with EVI 2:** The Pedagogical Lamp is currently Daniela's own judgment call. EVI 2 could give us a *second, independent signal* from actual prosody — we could compare Daniela's read ("student sounds like they're in flow") against EVI 2's emotional detection ("student voice shows moderate uncertainty") and surface that divergence as a teaching signal. This has no equivalent in any other voice provider.

---

## 7. Future Enhancements

1. **Speed Control UI**: Add slow/normal/fast buttons to textbook audio players
2. **Audio Caching**: Pre-generate and cache common drill audio
3. **Pronunciation Comparison**: Record student attempt and compare to model
4. **Prosody Visualization**: Show pitch/stress patterns alongside audio
5. **Playlist Mode**: Play all vocabulary in a lesson sequentially
