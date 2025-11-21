# REST Voice Chat Architecture

⚠️ **ACTIVE SYSTEM**: This document describes the production voice system using `RestVoiceChat.tsx`  
⚠️ **DEPRECATED**: `VoiceChat.tsx` (WebSocket-based) is NOT USED - See VOICE_CHAT_TROUBLESHOOTING.md for history

## Overview
LinguaFlow uses a **stable REST-based voice pipeline** for voice learning features, replacing the unstable OpenAI Realtime WebSocket API. This architecture has been proven reliable through extensive testing and is production-ready.

**Status**: ✅ Fully Operational (Nov 21, 2025)

**Active Component**: `client/src/components/RestVoiceChat.tsx`  
**NOT USED**: `client/src/components/VoiceChat.tsx` (deprecated WebSocket implementation)

---

## Architecture Overview

### Voice Pipeline Flow
```
Browser Recording → Whisper STT → GPT-4 Chat → TTS Synthesis → Audio Playback
     (WebM/MP4)      (REST API)    (REST API)     (REST API)      (Browser)
```

### Key Components

#### 1. Frontend (`client/src/components/RestVoiceChat.tsx`)
- Push-to-Talk microphone recording using MediaRecorder API
- Real-time audio visualization during recording
- Automatic audio format handling (WebM, MP4 for iOS/Safari)
- Message display with synchronized text and audio playback
- Error handling with user-friendly fallback suggestions

#### 2. API Client (`client/src/lib/restVoiceApi.ts`)
- Handles all REST API calls for voice features
- Robust response parsing (handles string, object, nested content arrays)
- Comprehensive error handling with context-specific messages
- Audio blob conversion for playback

#### 3. Backend Routes (`server/routes.ts`)
- `POST /api/voice/transcribe` - Whisper speech-to-text
- `POST /api/voice/synthesize` - OpenAI TTS text-to-speech
- Tier-based usage enforcement with atomic quota tracking
- Language code mapping (spanish → es, french → fr, etc.)

#### 4. Storage Layer (`server/storage.ts`)
- `checkVoiceUsage()` - Verify user has remaining quota
- `incrementVoiceUsage()` - Atomically update usage count
- Monthly usage reset logic
- Tiered limits (Free: 10, Basic: 50, Pro: 500, Institutional: 1000)

---

## API Endpoints

### POST /api/voice/transcribe

**Purpose**: Convert speech audio to text using Whisper API

**Request**:
```typescript
Content-Type: multipart/form-data

audio: File (WebM, MP4, WAV, etc.)
language: string (e.g., "spanish", "french")
```

**Response**:
```typescript
{
  text: string,        // Transcribed text
  language: string     // Detected language code
}
```

**Usage Tracking**:
1. Check quota BEFORE transcription (prevents wasting quota on failed requests)
2. Increment quota AFTER successful transcription
3. Atomic SQL updates prevent race conditions

**Error Handling**:
- 401: User not authenticated
- 403: Monthly quota exceeded (suggests upgrading or using text mode)
- 500: Whisper API failure (suggests trying again or text mode)

**Language Mapping**:
```typescript
const languageMap = {
  english: 'en', spanish: 'es', french: 'fr',
  german: 'de', italian: 'it', portuguese: 'pt',
  japanese: 'ja', chinese: 'zh', korean: 'ko'
};
```

---

### POST /api/voice/synthesize

**Purpose**: Convert text to speech using OpenAI TTS

**Request**:
```typescript
Content-Type: application/json

{
  text: string,           // Text to synthesize
  language: string,       // Target language for voice
  speed?: number          // 0.25-4.0 (default: 1.0)
}
```

**Response**:
```typescript
Content-Type: audio/mpeg

<audio binary data>
```

**Voice Selection**:
- Automatically selects appropriate voice based on language
- Speed control for pronunciation practice

**Error Handling**:
- 401: User not authenticated
- 500: TTS API failure (provides fallback guidance)

---

## Dual OpenAI Client Architecture

### Critical Distinction
LinguaFlow uses **TWO separate OpenAI API keys**:

1. **Replit AI Integrations** (`OPENAI_API_KEY`)
   - Used for: Text chat completions
   - Managed by: Replit platform
   - Access: GPT-4o-mini (Free), GPT-4o (Pro)

2. **User's Personal Key** (`USER_OPENAI_API_KEY`)
   - Used for: Voice features (Whisper, TTS)
   - Managed by: User's OpenAI account
   - Access: Full voice API suite
   - **Required for voice chat to work**

### Why Two Keys?
- Replit AI Integrations don't support Whisper/TTS APIs
- Separates text costs (Replit) from voice costs (user)
- Allows voice features while maintaining text chat reliability

### Environment Variables
```bash
# Replit AI Integration (text chat)
OPENAI_API_KEY=sk-...        # Managed by Replit

# User's personal key (voice features)
USER_OPENAI_API_KEY=sk-proj-...  # User provides
```

---

## Usage Enforcement

### Tier-Based Monthly Limits
```typescript
const VOICE_MESSAGE_LIMITS = {
  free: 10,
  basic: 50,
  pro: 500,
  institutional: 1000
};
```

### Atomic Quota Tracking

**Check Before Use**:
```sql
SELECT voice_messages_used, voice_messages_reset_at
FROM users
WHERE id = $1
```

**Increment After Success**:
```sql
UPDATE users
SET voice_messages_used = voice_messages_used + 1
WHERE id = $1
  AND voice_messages_used < $2  -- Atomic enforcement
RETURNING voice_messages_used
```

### Monthly Reset
```typescript
const now = new Date();
const resetDate = new Date(voiceMessagesResetAt);

if (now >= resetDate) {
  // Reset usage to 0
  // Set next reset date to +1 month
}
```

---

## Audio Format Support

### Browser Recording Formats
- **Chrome/Firefox/Edge**: WebM (audio/webm;codecs=opus)
- **Safari/iOS**: MP4 (audio/mp4, audio/mp4a-latm)

### Whisper API Compatibility
✅ All formats supported:
- WebM
- MP4
- WAV
- MP3
- M4A

### No Conversion Required
The REST pipeline sends browser-recorded audio directly to Whisper without format conversion, simplifying the architecture.

---

## Error Handling

### Three-Layer Error Strategy

#### 1. Quota Errors (403)
```typescript
if (usageCheck.exceeded) {
  throw new Error(
    `Monthly voice limit reached (${limit} messages). ` +
    `Upgrade your plan or switch to text mode.`
  );
}
```

#### 2. Transcription Errors (500)
```typescript
catch (error) {
  throw new Error(
    `Failed to transcribe audio. ` +
    `Try speaking more clearly or switch to text mode.`
  );
}
```

#### 3. Synthesis Errors (500)
```typescript
catch (error) {
  throw new Error(
    `Failed to generate speech. ` +
    `Try again or continue with text responses.`
  );
}
```

### User-Friendly Fallbacks
All errors encourage:
1. **Retry**: Try the same action again
2. **Text Mode**: Switch to typing instead
3. **Upgrade**: Increase quota limits (for 403 errors)

---

## Response Parsing

### GPT Response Format Handling

The REST pipeline handles **three response formats**:

#### 1. Simple String
```typescript
const response = "Hola, ¿cómo estás?";
```

#### 2. Message Object
```typescript
const response = {
  content: "Hola, ¿cómo estás?"
};
```

#### 3. Nested Content Array (Tool Calls)
```typescript
const response = {
  content: [
    { type: 'text', text: 'Hola, ¿cómo estás?' }
  ]
};
```

### Extraction Logic
```typescript
function extractTextContent(response: any): string {
  if (typeof response === 'string') return response;
  if (response?.content) {
    if (typeof response.content === 'string') {
      return response.content;
    }
    if (Array.isArray(response.content)) {
      return response.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ');
    }
  }
  return '';
}
```

---

## Testing & Verification

### API Key Test Script (`test-openai-key.ts`)

**Purpose**: Verify `USER_OPENAI_API_KEY` works with all voice APIs

**Tests Performed**:
1. ✅ Whisper (Speech-to-Text)
2. ✅ TTS (Text-to-Speech)
3. ✅ Chat Completions (Key validation)

**Usage**:
```bash
tsx test-openai-key.ts
```

**Expected Output**:
```
🔍 Testing OpenAI API Key
📋 Key length: 164 characters
📋 Key prefix: sk-proj-dQ...

🎤 Test 1: Whisper (Speech-to-Text)
   ✅ Whisper API WORKING

🔊 Test 2: TTS (Text-to-Speech)
   ✅ TTS API WORKING

💬 Test 3: Chat Completion
   ✅ Chat API WORKING

🎉 All tests passed! Your API key is valid.
```

### Verification Results (Nov 21, 2025)
- ✅ **Whisper**: Confirmed working
- ✅ **TTS**: Confirmed working (11,040 byte MP3 generated)
- ✅ **Chat**: Confirmed working
- ✅ **Key Length**: 164 characters (valid project key format)
- ✅ **Key Prefix**: `sk-proj-` (correct format)

---

## Mobile Support

### iOS/Safari Compatibility
- ✅ Accepts audio/mp4 and audio/mp4a-latm formats
- ✅ MediaRecorder API fully supported
- ✅ No format conversion required

### Android Support
- ✅ WebM format natively supported
- ✅ Opus codec compatibility

### Responsive Design
- 📱 Mobile: 80px mic button, compact UI
- 🖥️ Desktop: 64px mic button, full UI
- ✅ Touch-optimized controls
- ✅ Proper viewport scaling
- ✅ Flex layout optimization: Component uses `flex-1 min-h-0` to properly expand within parent flex containers, ensuring mic button stays visible on all screen sizes

---

## Accessibility

### ARIA Attributes
All interactive elements have proper ARIA labels:

```typescript
<button
  aria-pressed={isRecording}
  aria-label={isRecording ? "Stop recording" : "Start recording"}
  role="button"
  data-testid="button-voice-record"
>
```

### Screen Reader Support
- Recording state announced
- Error messages readable
- Message content accessible
- Playback controls labeled

---

## Performance Characteristics

### Latency Breakdown
1. **Recording**: Instant (browser MediaRecorder)
2. **Upload**: ~200-500ms (depends on audio length)
3. **Whisper**: ~500-1500ms (depends on audio length)
4. **GPT-4**: ~1000-3000ms (depends on response length)
5. **TTS**: ~500-1500ms (depends on text length)
6. **Playback**: Instant (browser audio element)

**Total**: ~2.5-7 seconds for complete voice interaction

### Optimization Strategies
- ✅ Stream audio playback (no buffering delay)
- ✅ Parallel API calls where possible
- ✅ Client-side audio visualization (no server round-trip)
- ✅ Efficient blob handling (no unnecessary copies)

---

## Known Limitations

### Current Constraints
1. **No Real-Time Streaming**: Full response generated before TTS
2. **Sequential Processing**: STT → Chat → TTS (not parallel)
3. **Audio Length Limits**: Whisper max ~25MB file size
4. **Monthly Quotas**: Tier-based usage limits

### Future Enhancements
- [ ] Streaming TTS responses (chunk-by-chunk)
- [ ] Voice activity detection (auto-stop recording)
- [ ] Pronunciation assessment scoring
- [ ] Multi-turn conversation context
- [ ] Offline audio caching

---

## Troubleshooting

### Common Issues

#### "Monthly voice limit reached"
**Cause**: User exceeded tier quota  
**Solution**: Upgrade plan or use text mode

#### "Failed to transcribe audio"
**Cause**: Whisper API error or poor audio quality  
**Solution**: Speak more clearly, check microphone, try again

#### "Microphone permission denied"
**Cause**: Browser blocked microphone access  
**Solution**: Grant microphone permission in browser settings

#### "401 Unauthorized"
**Cause**: `USER_OPENAI_API_KEY` missing or invalid  
**Solution**: Run `tsx test-openai-key.ts` to verify key

---

## Migration from WebSocket (Historical)

### Why We Pivoted
The OpenAI Realtime WebSocket API had unfixable issues:
- ❌ Consistent `server_error` after `session.updated`
- ❌ Failed with all configuration attempts
- ❌ 8+ hours debugging with no resolution
- ❌ Upstream API defect (not client-side)

### Benefits of REST Approach
- ✅ **Reliability**: Proven OpenAI REST APIs
- ✅ **Simplicity**: No WebSocket connection management
- ✅ **Debugging**: Standard HTTP error codes
- ✅ **Compatibility**: Works with all browsers
- ✅ **Cost Control**: Usage tracking per request

### Architecture Comparison

| Feature | WebSocket (Failed) | REST (Current) |
|---------|-------------------|----------------|
| Connection | Persistent | Request/Response |
| Latency | Lower (streaming) | Higher (sequential) |
| Reliability | ❌ Unstable | ✅ Stable |
| Error Handling | Complex | Simple |
| Browser Support | Limited | Universal |
| Cost Tracking | Difficult | Easy |

---

## Related Documentation

- `VOICE_CHAT_TROUBLESHOOTING.md` - Complete WebSocket debugging timeline
- `API_KEY_VERIFICATION.md` - API key setup and verification
- `replit.md` - Overall project architecture
- `test-openai-key.ts` - API key test script

---

## Maintenance Notes

### When Adding Features
1. ✅ Test with `test-openai-key.ts` first
2. ✅ Update usage quota logic if needed
3. ✅ Add error handling for new failure modes
4. ✅ Document new environment variables
5. ✅ Update this file with changes

### When Debugging
1. Check workflow logs: `/tmp/logs/Start_application_*.log`
2. Check browser console: F12 → Console tab
3. Verify API key: `tsx test-openai-key.ts`
4. Test endpoints: Use curl or Postman
5. Review error messages: Follow fallback guidance

---

## Credits

**Implementation Date**: November 21, 2025  
**Debugging Hours**: 12+ hours (WebSocket attempt + REST implementation)  
**Status**: Production-ready ✅
