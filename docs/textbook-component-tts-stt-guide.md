# Textbook Component TTS / STT Design Guide
## HoloHola — Authoritative Reference for Voice in Interactive Textbook Components

**Created:** April 18, 2026  
**Must be read before:** building any new interactive textbook section, vocabulary component, drill renderer, or pronunciation button.  
**Companion docs:** `docs/audio-system.md` (infrastructure detail), `docs/visual-asset-roadmap.md` Part I.K + I.R (architecture principles)

---

## The Cardinal Rule

> **Every audio button in every textbook component must call `/api/tts/pronunciation` and pass `gender` from `LanguageContext`.**

There are two TTS pipelines in this codebase:

| Pipeline | Endpoint | Used for |
|---|---|---|
| **Pronunciation pipeline** | `POST /api/tts/pronunciation` | All interactive textbook audio |
| **Chat/streaming pipeline** | `POST /api/voice/synthesize` | Daniela's live chat voice, Whiteboard narration, Aris practice |

Only the pronunciation pipeline is appropriate for textbook components. Using the chat pipeline in a textbook component introduces voice gender bugs, bypasses caching, and produces a different voice than what the student hears during class. The bug was first discovered in April 2026 when `SeeItSayItLoop` used `synthesizeSpeech` (chat pipeline) while `VisualVocabGrid` used `TextAudioPlayButton` (pronunciation pipeline) — students heard two different voices on the same page.

---

## The Standard Pattern — Use This Every Time

### Option A: Use `TextAudioPlayButton` directly (preferred)

For any listen icon button that plays a single word or short phrase, use the pre-built component. It handles loading state, error state, audio cleanup, and gender resolution automatically.

```tsx
import { TextAudioPlayButton } from "@/components/AudioPlayButton";

// Inside your component — language comes from props, gender from LanguageContext
<TextAudioPlayButton
  text="Buenos días"
  language={language}          // e.g. "spanish"
  gender={tutorGender}         // from useLanguage() — see below
  size="sm"
  variant="ghost"
/>
```

### Option B: Call the endpoint directly (for custom audio logic)

When you need custom loading state (e.g., per-card index tracking), call the endpoint yourself — but still use `/api/tts/pronunciation` and still pass `gender`.

```tsx
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";

// Inside your component
const { tutorGender } = useLanguage();

const speakText = async (text: string) => {
  const response = await apiRequest("POST", "/api/tts/pronunciation", {
    text,
    language,                   // string, e.g. "spanish"
    gender: tutorGender ?? "female",
  });
  const data = await response.json();
  const audio = new Audio(data.audioUrl);
  await audio.play();
};
```

### Getting `tutorGender` from context

```tsx
import { useLanguage } from "@/contexts/LanguageContext";

export function MyTextbookComponent({ language }: { language: string }) {
  const { tutorGender } = useLanguage();
  // tutorGender is 'female' | 'male', defaults to 'female' if not set
  // ...
}
```

---

## What NOT to Use

| Anti-pattern | Why it breaks |
|---|---|
| `import { synthesizeSpeech } from "@/lib/restVoiceApi"` | Chat pipeline — sends `voice: 'nova'` (OpenAI name) to Google TTS, constructs an invalid voice name, produces wrong-gender voice, no caching |
| Calling `/api/voice/synthesize` directly from a textbook component | Same as above |
| `new SpeechSynthesisUtterance(...)` without the API fallback wrapper | Browser TTS — acceptable as a fallback if the API fails, but never as the primary path |
| Hardcoding `gender: 'female'` | Breaks for users with `tutorGender: 'male'` — always read from `LanguageContext` |
| Passing no gender at all | Server falls back to user's DB profile, which is usually correct — but it adds a DB lookup on every request, bypasses caching, and has caused gender mismatches historically. Always be explicit. |

---

## How Gender Resolution Works (Server Side)

The `/api/tts/pronunciation` endpoint (`server/routes.ts` line ~13396) resolves voice in this priority order:

1. `gender` from request body → used as the voice gender
2. `user?.tutorGender` from DB → fallback if no gender in request
3. `'female'` → hard fallback of last resort

It then calls `storage.getTutorVoice(language, voiceGender)` to look up the admin-configured tutor voice from the Voice Lab. If found, that specific voice ID (Cartesia or Google named voice) is used. If not, it selects the appropriate Google Neural2 voice from `GOOGLE_ASSISTANT_VOICE_MAP`:

| Language | Female | Male |
|---|---|---|
| Spanish | `es-US-Neural2-A` | `es-US-Neural2-C` |
| English | `en-US-Neural2-F` | `en-US-Neural2-D` |
| French | `fr-FR-Neural2-A` | `fr-FR-Neural2-D` |
| German | `de-DE-Neural2-A` | `de-DE-Neural2-B` |
| Italian | `it-IT-Neural2-A` | `it-IT-Neural2-C` |
| Portuguese | `pt-BR-Neural2-A` | `pt-BR-Neural2-B` |
| Japanese | `ja-JP-Neural2-B` | `ja-JP-Neural2-C` |
| Korean | `ko-KR-Neural2-A` | `ko-KR-Neural2-C` |

Audio is cached in the `audio_library` table by SHA256 hash of `text|language|voiceId|speed`. Repeated requests for the same word are free (no TTS API call).

---

## STT Pipeline (Student Speech Recording and Evaluation)

For any textbook component that records the student's voice and evaluates pronunciation or fluency:

### Standard Flow

```
Student presses Mic button
        ↓
MediaRecorder → WebM/OGG audio blob
        ↓
POST /api/voice/transcribe (Deepgram nova-3)
        ↓
Transcribed text compared to target (fuzzy match or AI eval)
        ↓
Component transitions to 'mastered' or 'needs-work' state
```

### Key Files

| File | Role |
|---|---|
| `client/src/lib/restVoiceApi.ts` | `transcribeAudio(blob)` — sends audio to Deepgram, returns text |
| `server/routes.ts` ~line 7200 | `POST /api/voice/transcribe` — Deepgram integration |
| `server/services/stt-service.ts` | STT abstraction layer |

### Recording Pattern

```tsx
import { transcribeAudio } from "@/lib/restVoiceApi";

const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const chunksRef = useRef<Blob[]>([]);

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  chunksRef.current = [];
  recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
  recorder.onstop = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const result = await transcribeAudio(blob);
    // result.text — the transcription
    // Compare against target, update card state
  };
  recorder.start();
  mediaRecorderRef.current = recorder;
};

const stopRecording = () => {
  mediaRecorderRef.current?.stop();
};
```

### Evaluation Strategy

The current textbook components use simple fuzzy matching (normalized lowercase, strip accents and punctuation). A component is considered "correct" when the transcription matches the target at ≥ 75% similarity. Future components may call Daniela for AI-based fluency evaluation via a dedicated `/api/textbook/evaluate-speech` endpoint (not yet built — tracked in Part I.R build sequence step 4).

---

## Component Inventory (Textbook Page — as of April 2026)

| Component | File | TTS method | STT? |
|---|---|---|---|
| `VisualVocabGrid` | `TextbookInfographics.tsx` | `TextAudioPlayButton` → `/api/tts/pronunciation` | No |
| `SeeItSayItLoop` (vocab cards) | `SeeItSayItLoop.tsx` | `apiRequest` → `/api/tts/pronunciation` + `tutorGender` | Yes (mic button, per card) |
| `SeeItSayItLoop` (phrase row) | `SeeItSayItLoop.tsx` | Same | No |
| `SeeAndSayInfographics` | `SeeAndSayInfographics.tsx` | `TextAudioPlayButton` → `/api/tts/pronunciation` | No |
| `TextbookCanvasCards` | `TextbookCanvasCards.tsx` | `TextAudioPlayButton` → `/api/tts/pronunciation` | No |
| StreamingVoiceChat (Daniela) | `StreamingVoiceChat.tsx` | `/api/voice/synthesize` (chat pipeline — correct for this component) | Yes (full streaming) |

---

## Checklist — Before Shipping a New Textbook Component with Audio

- [ ] All listen buttons call `/api/tts/pronunciation` — not `synthesizeSpeech` or `/api/voice/synthesize`
- [ ] `gender: tutorGender` is passed explicitly — read from `useLanguage()`
- [ ] `language` prop is passed through (never hardcode `"spanish"`)
- [ ] If using `TextAudioPlayButton`, confirmed it receives `gender={tutorGender}` not `gender={undefined}`
- [ ] If recording student audio, using `transcribeAudio` from `restVoiceApi` (not raw `fetch` to Deepgram)
- [ ] No direct import of `synthesizeSpeech` in any textbook page component

---

## Quick Reference — API Shape

### POST `/api/tts/pronunciation`

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

**Validation:** `text` max 500 chars · `language` 2–10 chars · `gender` optional (`'female'` | `'male'`)

---

## Reference to Visual Asset Roadmap

Before building any new textbook section, also read:

- **Part I.K** — Interactive Textbook Architecture (Daniela leads every page; observable behavior principle)
- **Part I.R** — Textbook Data Model and Build Sequence (which data fields drive which components; 8-step micro-sequence)

These sections establish *what* to build. This guide establishes *how* to wire audio in whatever you build.
