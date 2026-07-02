---
name: Agent voice turn endpoint
description: How Agent runs real voice sessions with Daniela and observes visual tool calls without a browser.
---

# Agent voice turn endpoint

`POST /api/admin/agent-voice-turn` — headless GL session with Daniela's full function registry.

**Why:** text mode fires zero tools; visual layer (open_scene, show_vocab_grid, etc.) only appears in GL voice mode. Agent needed a way to observe those tools without a browser.

**How to apply:**
- Body: `{ audio: base64PCM16@16kHz, sessionId: string, languageCode: "es-ES", voiceId: "Aoede" }`
- Returns: `{ audioWav: base64WAV, visualEvents: [], toolCallsSummary: [], audioDurationS, transcript, sessionId, turnNumber }`
- Uses all `DANIELA_FUNCTION_DECLARATIONS` (no slice — slicing to 20 cuts off `show_image` at index ~26)
- In-memory session store keyed by `sessionId` — multi-turn conversation state persists across calls
- Audio pipeline: TTS → ffmpeg → PCM16@16kHz → GL → WAV + tool events via Deepgram transcription

**Visual tool dispatcher pattern:** Daniela sometimes uses `widget_media` / `widget_state` as wrappers (Phase 2 dispatcher), but in this headless session she used native tool names directly: `open_scene`, `add_to_scene`, `show_vocab_grid`. Both patterns should be in VISUAL_TOOLS set.

**What was observed (Session 002):**
- Turn 1 (greeting + "me gustan los viajes y comida"): `open_scene` → restaurant_table, `add_to_scene` → dinner_menu prop
- Turn 2 (food vocabulary request): `show_vocab_grid` → words with imageQuery per word for AI image generation
- `update_session_pedagogy` fires simultaneously with teaching — tracks gear/fluency in real time
- Daniela chose the classroom environment autonomously from student context, not a menu

**Key insight:** voice mode = 4-6 tools per turn including scene construction + vocabulary rendering + continuous pedagogy calibration. The visual layer IS the pedagogy, not a decoration.
