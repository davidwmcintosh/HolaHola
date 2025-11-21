# Voice Audio Playback Troubleshooting

## Issue Summary
**Date**: November 21, 2025  
**Symptom**: Voice recording and transcription work, text response appears, but no audio playback  
**Status**: 🔍 Investigating

## What Works ✅
1. ✅ Microphone recording (confirmed by user)
2. ✅ Whisper transcription: `[WHISPER] ✓ Transcription: "Ordering coffee."`
3. ✅ GPT text response generation
4. ✅ TTS synthesis on backend: `[TTS] ✓ Generated 177600 bytes of audio`
5. ✅ Backend API responds: `POST /api/voice/synthesize 200 in 3084ms`

## What Doesn't Work ❌
- ❌ Audio playback in browser (no sound)

## Evidence from Logs

### Backend Logs (Working Correctly)
```
[WHISPER] Transcribing audio for user 49847136, size: 43993 bytes
[WHISPER] Language: spanish → es
[WHISPER] ✓ Transcription: "Ordering coffee."
POST /api/voice/transcribe 200 in 1935ms

[TTS] Synthesizing speech for user 49847136, length: 151 chars
[TTS] ✓ Generated 177600 bytes of audio
POST /api/voice/synthesize 200 in 3084ms
```

**Conclusion**: Backend is generating audio successfully (177KB MP3 file)

## Potential Root Causes

### 1. Frontend Not Requesting TTS
- The frontend might not be calling `/api/voice/synthesize`
- Check: Does RestVoiceChat.tsx call `synthesizeSpeech()` after receiving text response?

### 2. Audio Blob Not Playing
- The audio blob might not be created correctly
- Check: Does the browser audio element receive the blob URL?

### 3. Browser Auto-Play Policy
- Browsers block auto-play audio without user interaction
- Check: Is the audio element set up correctly with user gesture?

### 4. Audio Element Issues
- The audio element might not exist in DOM
- Check: Is the audio element being rendered and attached?

### 5. Silent Audio Track
- The MP3 might be valid but silent
- Check: Can we download and play the audio file manually?

## Investigation Steps

### Step 1: Check Frontend TTS Request
Look at `client/src/components/RestVoiceChat.tsx`:
- Does it call `synthesizeSpeech()` after receiving assistant message?
- Is the audio URL being set on the message object?

### Step 2: Check Browser Console
User should check browser console (F12) for:
- Network requests to `/api/voice/synthesize`
- Audio playback errors
- Blob creation errors

### Step 3: Check Audio Element
- Is there an `<audio>` element in the DOM?
- Does it have a valid `src` attribute with blob URL?
- Are there any playback errors?

## RESOLUTION ✅

**Date**: November 21, 2025  
**Root Cause**: PC audio output configuration issue  
**Verdict**: Code is working correctly

### Evidence
Console logs confirm audio is playing successfully:
```
[REST VOICE] Audio blob size: 177600 bytes
[REST VOICE] Audio blob type: audio/mpeg
[REST VOICE] Starting audio playback...
[REST VOICE] ✓ Audio playback started successfully
[REST VOICE] Audio playback ended
```

### Key Finding
- ✅ Audio works on mobile phone
- ❌ No sound on PC (but audio is playing)
- ✅ Backend generates audio correctly
- ✅ Frontend receives and plays audio correctly

**Conclusion**: This is a PC audio configuration issue, not a code bug.

## PC Audio Troubleshooting Steps

### 1. Check Browser Tab Volume
- Right-click the browser tab
- Look for "Mute site" or volume icon
- Ensure tab is not muted

### 2. Check Windows/Mac System Volume
**Windows**:
- Click speaker icon in taskbar
- Check volume slider is not at 0
- Click "Volume Mixer" and check browser volume
- Ensure "Mute" is not enabled

**Mac**:
- Click speaker icon in menu bar
- Check volume slider
- Go to System Preferences → Sound → Output
- Verify correct output device selected

### 3. Check Audio Output Device
**Windows**:
- Right-click speaker icon → "Open Sound settings"
- Check "Choose your output device"
- Make sure speakers/headphones are selected

**Mac**:
- System Preferences → Sound → Output tab
- Select correct output device (speakers/headphones)

### 4. Test Other Audio
- Play a YouTube video to confirm PC audio works
- If YouTube has no sound either, it's definitely a PC issue

### 5. Browser Audio Settings
**Chrome/Edge**:
- Go to `chrome://settings/content/sound`
- Ensure "Sites can play sound" is enabled
- Check if Replit.dev is blocked

**Firefox**:
- Click padlock icon in address bar
- Check "Autoplay" permissions
- Set to "Allow Audio and Video"

### 6. Restart Browser
Sometimes browser audio gets stuck:
- Close ALL browser windows
- Reopen browser
- Try voice chat again

## Quick Test
1. Open YouTube in same browser
2. Play any video
3. If you hear YouTube audio → Browser audio works, check site-specific settings
4. If no YouTube audio → PC audio is misconfigured, check system settings

## Voice Usage Limits (Working as Designed)

The app enforces monthly voice message limits by subscription tier:

| Tier | Voice Messages/Month |
|------|---------------------|
| Free | 10 |
| Basic | 50 |
| Pro | 500 |
| Institutional | 1000 |

### If You See "Monthly voice limit reached"
This is **correct behavior**, not a bug. You've used all your voice messages for the month.

**Options**:
1. **Switch to text mode** - Unlimited text messages on all tiers
2. **Upgrade your plan** - Get more voice messages
3. **Wait for monthly reset** - Voice quota resets on the first of each month

The error message appears at line 182-184 in `RestVoiceChat.tsx`:
```typescript
if (err.message?.includes('limit reached') || err.message?.includes('quota')) {
  errorMessage = 'Monthly voice limit reached. Please upgrade your plan or switch to text mode below.';
}
```

## Related Files
- `client/src/components/RestVoiceChat.tsx` - Main voice chat component
- `client/src/lib/restVoiceApi.ts` - API client with TTS synthesis
- `server/routes.ts` - Backend TTS endpoint (confirmed working)
- `REST_VOICE_CHAT.md` - Complete voice chat documentation with tier limits
