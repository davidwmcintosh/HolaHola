# Voice Chat Setup Guide

⚠️ **IMPORTANT**: This documentation covers the REST-based voice system (`RestVoiceChat.tsx`).  
The old WebSocket-based system (`VoiceChat.tsx`) is DEPRECATED and no longer used.

## Overview

The voice chat feature provides Push-to-Talk speech-to-speech conversation with an AI language tutor using a stable REST-based pipeline. This architecture replaced the unstable OpenAI Realtime WebSocket API with proven, production-ready REST endpoints.

**Current System**: REST-based voice pipeline (Whisper STT → GPT-4 Chat → TTS)

## Architecture

### Frontend Components
- **RestVoiceChat.tsx**: Main component for voice conversations (ACTIVE SYSTEM)
  - Push-to-Talk microphone recording using MediaRecorder API
  - REST API calls for transcription, chat, and synthesis
  - Automatic audio format handling (WebM, MP4 for iOS/Safari)
  - Message display with synchronized text and audio playback
  - Error handling with user-friendly fallback suggestions

- **restVoiceApi.ts**: API client for voice features
  - Handles all REST API calls
  - Robust response parsing (handles string, object, nested content arrays)
  - Comprehensive error handling with context-specific messages
  - Audio blob conversion for playback

### Backend Components
- **routes.ts**: REST API endpoints
  - `POST /api/voice/transcribe` - Whisper speech-to-text
  - `POST /api/voice/synthesize` - OpenAI TTS text-to-speech
  - Tier-based usage enforcement with atomic quota tracking
  - Language code mapping (spanish → es, french → fr, etc.)

- **storage.ts**: Usage tracking
  - `checkVoiceUsage()` - Verify user has remaining quota
  - `incrementVoiceUsage()` - Atomically update usage count
  - Monthly usage reset logic
  - Tiered limits (Free: 10, Basic: 50, Pro: 500, Institutional: 1000)

## Requirements

### OpenAI API Key for Voice Features
Voice features require a **User's Personal OpenAI API Key** (`USER_OPENAI_API_KEY`) for Whisper STT and TTS:

1. Get an OpenAI API key from https://platform.openai.com
2. Add it as a secret named `USER_OPENAI_API_KEY` in the Secrets tab
3. Restart the application

**Note**: Text chat uses `OPENAI_API_KEY` (Replit AI Integrations), while voice uses `USER_OPENAI_API_KEY`. This separates text costs from voice costs.

### Browser Requirements
- Modern browser with MediaRecorder API support (Chrome, Firefox, Safari, Edge)
- Microphone permissions granted
- Secure context (HTTPS or localhost)

## Usage

1. Navigate to the Call Tutor page (/chat)
2. Click "Voice Learning" (recommended button)
3. Choose your target language and difficulty level
4. Press and hold the large microphone button to record
5. Speak in your target language
6. Release the button when done speaking
7. AI tutor will respond with voice and text
8. Click "Type instead" to switch to text mode

## Features

- **Push-to-Talk Recording**: Hold to record, release to send
- **Split Response Architecture**: Fast text response (~3.6s) with background enrichment
- **Live Transcription**: See what you said and what the AI responds
- **Usage Tracking**: Monthly quota limits based on subscription tier
- **Tier-Based Model Selection**: gpt-4o-mini (Free/Basic/Institutional), gpt-4o (Pro)
- **Multi-language Support**: Works with Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Russian
- **Difficulty Adaptation**: AI adjusts language complexity based on level
- **Seamless Mode Switching**: Switch between voice and text anytime

## Troubleshooting

### "Invalid OpenAI API key" Error
- Verify `USER_OPENAI_API_KEY` is set correctly in Secrets tab
- Ensure the API key has access to Whisper and TTS models
- Try regenerating the API key in OpenAI dashboard
- Fallback: Use "Type instead" for text-only chat

### "Monthly voice limit reached" Error
- Free tier: 10 voice messages/month
- Basic tier: 50 voice messages/month
- Pro tier: 500 voice messages/month
- Institutional tier: 1000 voice messages/month
- Fallback: Use text mode or upgrade subscription

### "Failed to access microphone"
- Check browser permissions
- Ensure you're using HTTPS or localhost
- Try a different browser
- iOS users: Use Safari for best compatibility

### "Failed to transcribe audio"
- Speak more clearly or louder
- Check microphone input levels
- Try recording again
- Fallback: Use text mode

### "Failed to generate speech"
- The text response is still saved to conversation
- Refresh the page to retry
- Fallback: Use text mode for this conversation

### No audio playback
- Check system volume and browser audio settings
- Ensure speakers/headphones are connected
- Try refreshing the page

## Technical Details

### Audio Format
- Input: WebM (Chrome/Firefox) or MP4 (Safari/iOS)
- Whisper API handles automatic format conversion
- TTS Output: MP3, 24kHz, mono
- Browser playback: Native HTML5 Audio API

### API Flow
1. Browser records audio using MediaRecorder
2. POST audio blob to `/api/voice/transcribe` (Whisper STT)
3. POST transcribed text to `/api/conversations/:id/messages` (GPT chat)
4. POST AI response to `/api/voice/synthesize` (TTS)
5. Return audio blob to browser for playback
6. Increment usage quota atomically

### Security
- API keys never exposed to frontend
- Backend handles all OpenAI API calls
- Session-based authentication (Replit Auth OIDC)
- Server-side usage quota enforcement
- Atomic SQL updates prevent race conditions

## Performance

- **Voice Pipeline**: ~9s total (1s Whisper + 4.4s GPT + 3.3s TTS)
- **Split Response**: ~3.6s for text response (background enrichment queued)
- **Background Processing**: Vocabulary extraction and image generation via `setImmediate()`

## Limitations

1. **API Key Required**: Needs `USER_OPENAI_API_KEY` for voice features
2. **Usage Quotas**: Monthly limits based on subscription tier
3. **Browser Support**: Requires MediaRecorder API (modern browsers only)
4. **Network Dependency**: Requires stable internet connection
5. **Mobile**: iOS requires Safari for best compatibility
6. **Cost**: Whisper + TTS costs are separate from text chat

## Migration from WebSocket System

**Old System** (DEPRECATED):
- Component: `VoiceChat.tsx`
- Architecture: WebSocket to OpenAI Realtime API
- Status: Unstable, removed from production

**New System** (ACTIVE):
- Component: `RestVoiceChat.tsx`
- Architecture: REST endpoints (Whisper + GPT + TTS)
- Status: Production-stable, actively maintained

**Why We Switched**:
- WebSocket Realtime API was unstable (server_error issues)
- REST pipeline is proven and reliable
- Better error handling and recovery
- Atomic usage tracking prevents quota issues
- Split response architecture reduces latency

## Documentation

For detailed technical documentation, see:
- `REST_VOICE_CHAT.md` - Complete REST voice architecture
- `VOICE_CHAT_TROUBLESHOOTING.md` - WebSocket failure history and REST pivot
- `replit.md` - System architecture overview
