# Voice Chat Setup Guide

⚠️ **CURRENT SYSTEM**: REST-based voice pipeline using Deepgram Nova-3 (STT) + Gemini 2.5 Flash (Chat) + Google Cloud Chirp 3 HD (TTS)

## Overview

The voice chat feature provides Push-to-Talk speech-to-speech conversation with an AI language tutor using a production-stable REST-based pipeline optimized for language learning.

**Current System**: Deepgram Nova-3 STT → Gemini 2.5 Flash Chat → Google Cloud Chirp 3 HD TTS

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
  - `POST /api/voice/transcribe` - Deepgram Nova-3 speech-to-text (auto-detect mode)
  - `POST /api/voice/synthesize` - Google Cloud Chirp 3 HD text-to-speech
  - Tier-based usage enforcement with atomic quota tracking
  - Language code mapping (spanish → es, french → fr, etc.)

- **storage.ts**: Usage tracking
  - `checkVoiceUsage()` - Verify user has remaining quota
  - `incrementVoiceUsage()` - Atomically update usage count
  - Monthly usage reset logic
  - Tiered limits (Free: 10, Basic: 50, Pro: 500, Institutional: 1000)

## Requirements

### API Keys for Voice Features
Voice features use the following API keys (managed automatically via Replit AI Integrations):

- **DEEPGRAM_API_KEY**: For speech-to-text (student input)
- **GOOGLE_CLOUD_TTS_CREDENTIALS**: For text-to-speech (tutor voice)

**Note**: Text chat uses Gemini 2.5 Flash via Replit AI Integrations (no user API key needed).

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

### Controls

**Top Navigation Badges** (tap to toggle):
- **Live/History**: Switch between live conversation view and message history
- **Subtitles**: Cycle through subtitle modes:
  - **Off**: No subtitles (pure audio immersion)
  - **Target**: Shows only target language words (e.g., Spanish words only)
  - **All**: Shows full transcript of what the tutor says

**Bottom Buttons**:
- **History** (left): Toggle to view conversation history
- **Replay** (center-left): Replay the last tutor audio response
- **Microphone** (center): Press and hold to record your voice
- **Settings**: Access subtitle preferences in Settings > Voice Settings

## Features

- **Push-to-Talk Recording**: Hold to record, release to send
- **3-Mode Subtitle System**: Off (pure immersion), Target (target language only), All (full transcript)
- **Replay Button**: Re-listen to the last tutor response for pronunciation practice
- **Split Response Architecture**: Fast text response (~3.6s) with background enrichment
- **Live Transcription**: Deepgram Nova-3 with <300ms latency and 54.3% better accuracy for non-native speakers
- **Usage Tracking**: Monthly quota limits based on subscription tier
- **Tier-Based Model Selection**: Gemini 2.5 Flash (Free/Basic/Institutional), Gemini 2.5 Pro (Pro)
- **Multi-language Support**: Works with Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Russian
- **Difficulty Adaptation**: AI adjusts language complexity based on level
- **Seamless Mode Switching**: Switch between voice and text anytime
- **Auto-Detect Language**: Deepgram automatically detects the language you speak
- **Cold-Start Optimization**: Deepgram pre-warming reduces first response from ~20s to ~3s

## Troubleshooting

### Voice transcription errors
- Speak more clearly or louder
- Check microphone input levels
- Deepgram auto-detects language, so you can speak in any language
- Try recording again
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
- Deepgram Nova-3 handles automatic format conversion and language detection
- TTS Output: MP3, 24kHz, mono (Google Cloud Chirp 3 HD)
- Browser playback: Native HTML5 Audio API

### API Flow
1. Browser records audio using MediaRecorder
2. POST audio blob to `/api/voice/transcribe` (Deepgram Nova-3 STT with auto-detect)
3. POST transcribed text to `/api/conversations/:id/messages` (Gemini 2.5 Flash chat)
4. POST AI response to `/api/voice/synthesize` (Google Cloud Chirp 3 HD TTS)
5. Return audio blob to browser for playback
6. Increment usage quota atomically

### Security
- API keys managed by Replit AI Integrations (never exposed to frontend)
- Backend handles all AI API calls
- Session-based authentication (Replit Auth OIDC)
- Server-side usage quota enforcement
- Atomic SQL updates prevent race conditions

## Performance

- **Voice Pipeline**: ~9s total (~1s Deepgram + ~4.4s Gemini + ~3.3s TTS)
- **Split Response**: ~3.6s for text response (background enrichment queued)
- **STT Latency**: <300ms with Deepgram Nova-3 (real-time streaming capable)
- **Background Processing**: Vocabulary extraction and image generation via `setImmediate()`

## Benefits of Current Stack

1. **Better Accuracy**: Deepgram Nova-3 has 54.3% better WER for non-native speakers
2. **Faster Response**: <300ms STT latency vs batch-only alternatives
3. **No User API Keys**: All AI services managed via Replit AI Integrations
4. **Cost Efficient**: 28% cheaper STT, 33% cheaper text chat vs OpenAI
5. **Auto-Detect Language**: Students can ask questions in any language
6. **Authentic Pronunciation**: Google Cloud Chirp 3 HD for native-quality voice

## Limitations

1. **Usage Quotas**: Monthly limits based on subscription tier
2. **Browser Support**: Requires MediaRecorder API (modern browsers only)
3. **Network Dependency**: Requires stable internet connection
4. **Mobile**: iOS requires Safari for best compatibility

## Migration History

### November 2025: OpenAI → Gemini/Deepgram Migration

**Migration Benefits**:
- ✅ 54.3% better transcription accuracy for language learners (Deepgram Nova-3)
- ✅ <300ms STT latency (vs batch-only Whisper)
- ✅ 33% cost reduction on text chat (Gemini 2.5 Flash vs GPT-4o-mini)
- ✅ 28% cost reduction on STT (Deepgram vs Whisper)
- ✅ Removed user API key requirement (better UX)
- ✅ 2M token context window (15x larger for long-term learning)

**Components Changed**:
- **STT**: OpenAI Whisper → Deepgram Nova-3
- **Text Chat**: GPT-4o-mini → Gemini 2.5 Flash
- **Image Generation**: DALL-E 3 → Gemini Flash-Image
- **TTS**: Google Cloud Chirp 3 HD (unchanged - already optimal)

**Total Migration Cost**: $7 (6.5 hours of agent development time)
**Annual Savings**: ~$600/year at 500 hours/month usage

## Documentation

For detailed technical documentation, see:
- `replit.md` - System architecture overview
- `LLM-Migration-Analysis.md` - Migration analysis and decision rationale
- `Development-Cost-Projections.md` - Cost estimation reference
