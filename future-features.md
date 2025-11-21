# Future Features & Enhancements

This document tracks potential features and improvements for future development.

## Voice Mode Enhancements

### Open Mic Mode with Voice Activity Detection (VAD)

**Current State:** Voice mode uses push-to-talk only (manual button control).

**Proposed Feature:** Add an "Open Mic" mode that automatically detects when the user is speaking and when they stop.

**How It Works:**
1. User enables "Open Mic" mode via toggle button
2. System automatically starts recording when enabled
3. Voice Activity Detection (VAD) monitors audio levels in real-time
4. When silence is detected for 1.5 seconds, recording auto-stops
5. Audio is processed and sent to AI
6. User can speak again to trigger new recording

**Benefits:**
- More natural conversation flow
- Hands-free operation
- Faster back-and-forth dialogue

**Technical Implementation Notes:**
- Requires Web Audio API for real-time audio analysis
- Use AnalyserNode to monitor frequency data
- Implement silence threshold detection (e.g., average < 10)
- Need session-based state management to prevent race conditions
- Each recording session should be isolated with its own:
  - MediaRecorder instance
  - Audio chunks array
  - Timers (silence detection)
  - Conversation ID reference

**Challenges to Address:**
1. **State Management:** Shared refs between recording sessions cause corruption when conversations change
2. **Cleanup Timing:** Old recording sessions must not interfere with new ones
3. **Conversation Changes:** Audio from old conversation must be discarded, not sent to new conversation
4. **Auto-Restart Logic:** Complex timing around when to restart recording after AI response

**Estimated Effort:** 30-60 minutes for proper session-based refactor

**Priority:** Low - Push-to-talk provides reliable functionality; open mic is a nice-to-have enhancement

**Implementation Strategy (when ready):**
1. Create `useVoiceRecorder` hook with session encapsulation
2. Each session gets isolated state (recorder, chunks, timers, conversationId)
3. Cleanup functions operate on session-specific resources
4. Mode toggle safely transitions between push-to-talk and open mic
5. Comprehensive testing of conversation switches and mode changes

---

## Other Potential Features

### Pronunciation Practice Module
- Record user pronunciation
- Compare to native speaker pronunciation
- Provide visual feedback (waveform comparison)
- Highlight specific phonemes that need improvement

### Conversation Scenarios
- Pre-built conversation templates (ordering food, asking directions, etc.)
- AI takes on specific roles (waiter, hotel clerk, friend)
- Guided practice with prompts and corrections

### Offline Voice Support
- Download TTS voices for offline use
- Cache common AI responses
- Local speech recognition fallback

### Multi-Language Mixing
- Allow switching between languages mid-conversation
- "Explain in English" quick action for confusing target language content
- Bilingual dictionary lookups during conversation

---

*Last Updated: November 21, 2025*
