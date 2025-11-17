# Voice Chat Setup Guide

## Overview

The voice chat feature provides real-time speech-to-speech conversation with an AI language tutor using the OpenAI Realtime API. This allows for more immersive language practice with natural voice interactions.

## Architecture

### Frontend Components
- **VoiceChat.tsx**: Main component handling voice conversations
  - WebSocket connection to backend proxy
  - Audio recording using Web Audio API
  - Audio playback with buffering
  - Live transcription display
  - Visual feedback for recording/speaking states

- **audioUtils.ts**: Audio handling utilities
  - `AudioRecorder`: Captures microphone input in PCM16 format
  - `AudioPlayer`: Plays received audio with queueing

### Backend Components
- **realtime-proxy.ts**: WebSocket proxy server
  - Forwards client connections to OpenAI Realtime API
  - Manages authentication securely
  - Configures session parameters (language, difficulty, voice)

## Requirements

### OpenAI Realtime API Access
The voice chat feature requires access to the OpenAI Realtime API, which may not be included in Replit AI Integrations. You have two options:

#### Option 1: Use Replit AI Integrations (Recommended)
- Check if `AI_INTEGRATIONS_OPENAI_BASE_URL` supports the Realtime API
- If available, the feature will work out of the box
- No additional configuration needed

#### Option 2: Use Your Own OpenAI API Key
If Replit AI Integrations doesn't support the Realtime API:

1. Get an OpenAI API key with Realtime API access from https://platform.openai.com
2. Update environment variables:
   ```bash
   AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
   AI_INTEGRATIONS_OPENAI_API_KEY=your_openai_api_key_here
   ```
3. Restart the application

### Browser Requirements
- Modern browser with Web Audio API support (Chrome, Firefox, Safari, Edge)
- Microphone permissions granted
- Secure context (HTTPS or localhost)

## Usage

1. Navigate to the Chat page
2. Select "Voice" mode using the toggle button
3. Choose your target language and difficulty level
4. Click the microphone button to start recording
5. Speak in your target language
6. AI tutor will respond with voice and text
7. Click the button again to stop recording

## Features

- **Voice Activity Detection (VAD)**: Automatically detects when you stop speaking
- **Live Transcription**: See what you said and what the AI responds
- **Natural Turn-Taking**: Interrupt-friendly conversation flow
- **Multi-language Support**: Works with Spanish, French, German, etc.
- **Difficulty Adaptation**: AI adjusts language complexity based on level

## Troubleshooting

### "Connection error" Message
- The OpenAI Realtime API may not be available through your current setup
- Try using the text-based chat mode as an alternative
- Or provide your own OpenAI API key with Realtime API access

### "Failed to access microphone"
- Check browser permissions
- Ensure you're using HTTPS or localhost
- Try a different browser

### No audio playback
- Check system volume and browser audio settings
- Ensure speakers/headphones are connected
- Try refreshing the page

### Laggy or delayed responses
- Check network connection
- The Realtime API has ~500ms latency typically
- Consider using text mode for slow connections

## Technical Details

### Audio Format
- Input: PCM16, 24kHz, mono
- Output: PCM16, 24kHz, mono
- Encoding: Base64 over WebSocket

### API Events
The implementation uses the OpenAI Realtime API GA interface with events:
- `session.update`: Configure session
- `input_audio_buffer.append`: Send audio chunks
- `response.output_audio.delta`: Receive audio chunks
- `response.output_audio_transcript.done`: Get transcription

### Security
- API keys never exposed to frontend
- Backend WebSocket proxy handles authentication
- Ephemeral connections (no persistent storage)

## Limitations

1. **API Availability**: Requires OpenAI Realtime API access
2. **Browser Support**: Limited to modern browsers
3. **Network Dependency**: Requires stable internet connection
4. **Mobile**: May have performance issues on older devices
5. **Cost**: Realtime API is more expensive than text-based chat

## Future Enhancements

Potential improvements:
- [ ] Offline mode with local speech recognition
- [ ] Voice selection (different AI tutor voices)
- [ ] Conversation recording/playback
- [ ] Background noise suppression
- [ ] Mobile app with native audio handling
- [ ] Fallback to STT + Chat + TTS pipeline
