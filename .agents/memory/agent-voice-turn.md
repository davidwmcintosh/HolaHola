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

## Exact audio generation pipeline (copy-paste ready)

```javascript
// Step 1: Call /api/tts/pronunciation — returns { audioUrl: "data:audio/mpeg;base64,...", audioDurationMs, cacheHit }
// NOT raw audio. NOT audioContent. The field is audioUrl, a data URI.
const resp = execSync(`curl -s -X POST http://localhost:5000/api/tts/pronunciation \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SC}" \
  -d '${JSON.stringify({text, language:"es", gender:"female"})}'`).toString();
const parsed = JSON.parse(resp);
const b64mp3 = parsed.audioUrl.split(',')[1];   // strip "data:audio/mpeg;base64,"

// Step 2: Write MP3, convert to PCM16 @ 16kHz mono with ffmpeg
fs.writeFileSync('/tmp/_tmp.mp3', Buffer.from(b64mp3, 'base64'));
execSync('ffmpeg -i /tmp/_tmp.mp3 -ar 16000 -ac 1 -f s16le /tmp/_tmp.raw -y 2>/dev/null');

// Step 3: Re-encode as base64 — this is what agent-voice-turn expects
const audio = fs.readFileSync('/tmp/_tmp.raw').toString('base64');
```

**Critical detail:** GOOGLE_TTS_API_KEY is NOT set in the env. The only working TTS path is `/api/tts/pronunciation` via session cookie. The response shape is `{ audioUrl, audioDurationMs, cacheHit }` — not `audioContent`, not raw bytes.

## Sending a turn

```bash
# Use -d @- (stdin) to avoid shell escaping issues with large base64 payloads
const body = JSON.stringify({ audio, sessionId: SESSION_ID, languageCode: 'es-ES', voiceId: 'Aoede' });
execSync(`curl -s -X POST http://localhost:5000/api/admin/agent-voice-turn \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SC}" \
  --max-time 90 \
  -d @-`, { input: body, maxBuffer: 50*1024*1024, timeout: 95000 })
```

**Timeout note:** Turn 3 with sentence-builder requests can hit the 60s GL timeout. Increase `--max-time` to 90+ and Node `timeout` to 95000+.

## Visual tool dispatcher pattern

Daniela routes through dispatchers — the actual GL tool names are wrappers:
- `widget_media` → routes show_daily_plan, show_vocab_grid, open_scene, etc.
- `teaching_content` → routes show_vocab_grid, show_sentence_builder, update_lesson_context, vocab_card, etc.
- Direct native names also fire: `open_scene`, `add_to_scene`, `show_vocab_grid`

Both dispatcher and native patterns appear in `toolCallsSummary`. Check `t.name` AND `t.args.type`/`t.args.widget` for full picture.

## What was observed (Session 003 — Lesson Arc test, Jul 2 2026)

- Turn 1 ("quiero aprender vocabulario de comida en el restaurante"):
  - `widget_media(show_daily_plan)` — lesson plan widget
  - `teaching_content(vocab_card)` — single vocab card ("el agua / water")
- Turn 2 ("Muéstrame las palabras en una cuadrícula con imágenes"):
  - `teaching_content(show_vocab_grid)` — vocab grid with images ✓
  - `update_session_phase(WARM_UP)` — phase tracking
- Turn 3 ("practiquemos construyendo frases") → timed out (60s GL limit)
  - No transcript was captured on any turn — Deepgram transcription may not be running in headless mode

**Key insight:** voice mode = 4-6 tools per turn including scene construction + vocabulary rendering + continuous pedagogy calibration. The visual layer IS the pedagogy, not a decoration.

**Previous session (002):**
- Turn 1 (greeting + "me gustan los viajes y comida"): `open_scene` → restaurant_table, `add_to_scene` → dinner_menu prop
- Turn 2 (food vocabulary request): `show_vocab_grid` → words with imageQuery per word for AI image generation
- `update_session_pedagogy` fires simultaneously with teaching — tracks gear/fluency in real time
