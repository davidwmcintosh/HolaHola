# Voice Streaming Debug Consolidated

**Last Updated:** December 24, 2025  
**Status:** ACTIVE DEBUGGING - Avatar animation broken despite audio playing

---

## Table of Contents

1. [Current Issue](#current-issue)
2. [Voice Stack Architecture](#voice-stack-architecture)
3. [Audio Player Singleton Pattern](#audio-player-singleton-pattern)
4. [Multi-Subscriber Callback Pattern](#multi-subscriber-callback-pattern)
5. [Debugging Timeline](#debugging-timeline)
6. [What We Know Works](#what-we-know-works)
7. [What's Not Working](#whats-not-working)
8. [Key Files](#key-files)
9. [Debug Commands](#debug-commands)
10. [Proposed Fix: DOM Event Bridge](#proposed-fix-dom-event-bridge)
11. [Related Docs](#related-docs)

---

## Current Issue

**Summary:** Avatar stuck on 'idle' despite audio playing correctly. Multi-subscriber callback pattern implemented to survive Vite HMR, but React state updates not reaching component tree.

**User Impact:** During voice chat, the tutor avatar does not animate (speaking state) even though audio is playing and subtitles are displaying.

**Regression Point:** Feature was "working splendidly" before ~20 audio-related commits in December 2024.

---

## Voice Stack Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HolaHola Voice Pipeline                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   User Audio                                                                 │
│       │                                                                      │
│       ▼                                                                      │
│   ┌──────────────────┐                                                       │
│   │  Deepgram Nova-3 │  ← STT (Speech-to-Text)                               │
│   │  (LIVE API)      │    Streaming transcription, multi-language            │
│   └────────┬─────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │  Gemini 2.5 Flash│  ← LLM (Daniela's "brain")                            │
│   │  (Streaming)     │    Sentence-by-sentence response generation           │
│   └────────┬─────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│   ┌──────────────────┐                                                       │
│   │  Cartesia Sonic-3│  ← TTS (Text-to-Speech)                               │
│   │  (WebSocket)     │    90ms latency, word timestamps, emotions            │
│   └────────┬─────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│       Audio Output                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Providers

| Stage | Provider | Model | Latency | Features |
|-------|----------|-------|---------|----------|
| STT | Deepgram | Nova-3 | Real-time | VAD, multi-language, streaming |
| LLM | Google | Gemini 2.5 Flash | ~1.5s first token | Sentence streaming |
| TTS | Cartesia | Sonic-3 | <90ms | Word timestamps, 60+ emotions |
| TTS Backup | Google Cloud | WaveNet | ~200ms | Language-specific voices |

---

## Audio Player Singleton Pattern

The `StreamingAudioPlayer` is a window-level singleton to persist across React re-renders and Vite HMR:

```typescript
// client/src/lib/audioUtils.ts
declare global {
  interface Window {
    __streamingAudioPlayer?: StreamingAudioPlayer;
  }
}

export function getStreamingAudioPlayer(): StreamingAudioPlayer {
  if (!window.__streamingAudioPlayer) {
    window.__streamingAudioPlayer = new StreamingAudioPlayer();
  }
  return window.__streamingAudioPlayer;
}
```

### Why Singleton?
- Audio playback must survive component unmount/remount
- Vite HMR replaces component code but singleton persists
- Prevents audio interruption during development

### The Problem
- Singleton survives HMR, but callbacks stored in singleton point to dead React tree
- Component remounts with fresh state, but callback closures still reference old state setters
- Result: State updates fire but don't reach live component

---

## Multi-Subscriber Callback Pattern

**Implemented December 24, 2025** to solve HMR callback staleness.

### Architecture

```typescript
// client/src/lib/audioUtils.ts
class StreamingAudioPlayer {
  private subscribers: Map<string, StreamingPlaybackCallbacks> = new Map();
  
  subscribe(subscriberId: string, callbacks: StreamingPlaybackCallbacks): void {
    this.subscribers.set(subscriberId, callbacks);
  }
  
  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId);
  }
  
  private notifyStateChange(state: StreamingPlaybackState): void {
    Array.from(this.subscribers.entries()).forEach(([id, callbacks]) => {
      callbacks.onStateChange?.(state);
    });
  }
}
```

### Hook Integration

```typescript
// client/src/hooks/useStreamingVoice.ts
const callbackIdRef = useRef(`cb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
const setPlaybackStateRef = useRef(setPlaybackState);
setPlaybackStateRef.current = setPlaybackState; // Sync on every render

useEffect(() => {
  const player = getStreamingAudioPlayer();
  const subscriberId = callbackIdRef.current;
  
  player.subscribe(subscriberId, {
    onStateChange: (state) => {
      setPlaybackStateRef.current(state); // Use ref to get latest setter
    },
  });
  
  return () => {
    player.unsubscribe(subscriberId);
  };
}, []);
```

### Why This Should Work
1. Each component instance gets unique subscriber ID
2. Cleanup removes stale callbacks on unmount
3. Ref pattern ensures callback always calls current state setter
4. Server telemetry confirms `subscriberCount: 1` - subscription is working

### Why It Doesn't Work (Current Investigation)
- Server shows state transitions: `idle → buffering → playing → idle`
- Server shows `subscriberCount: 1` in telemetry
- Browser console does NOT show callback logs
- Avatar stays stuck on 'idle'

**Hypothesis:** Callback is registered but not being invoked, OR callback is invoked but console.log is suppressed/filtered.

---

## Debugging Timeline

### December 24, 2025 - Session 1

| Time | Action | Result |
|------|--------|--------|
| Initial | Identified HMR as root cause via architect | Confirmed singleton preserves but callbacks stale |
| Attempt 1 | Implemented multi-subscriber pattern | Server shows subscriberCount: 1 |
| Attempt 2 | Added callback ref pattern for state setter | No change - avatar still idle |
| Attempt 3 | Added extensive console.log debugging | Logs NOT appearing in browser console |
| Attempt 4 | Added window-level debug variables | Pending user test |
| Current | Consolidating knowledge, considering DOM event bridge | |

### Commits Made
- `5237269d` - Add enhanced debugging for audio playback state synchronization

---

## What We Know Works

1. **Audio Playback** - Sound plays correctly through speakers
2. **Subtitles** - Word-level highlighting works
3. **Server Telemetry** - State transitions logged: `idle → buffering → playing → idle`
4. **Subscriber Registration** - `subscriberCount: 1` in telemetry
5. **WebSocket Communication** - Audio chunks arrive and play
6. **TTS Service** - Cartesia generating audio correctly

---

## What's Not Working

1. **Avatar Animation** - Stays on 'idle' despite playbackState should be 'playing'
2. **Browser Console Logs** - `[PLAYBACK CALLBACK]` logs NOT appearing
3. **React State Updates** - `setPlaybackState` called via ref but component not re-rendering
4. **Debug Effects** - `[AVATAR SYNC DEBUG]` logs NOT appearing

---

## Key Files

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `client/src/lib/audioUtils.ts` | Audio player singleton, multi-subscriber pattern | 525-576, 1925-1955 |
| `client/src/hooks/useStreamingVoice.ts` | Voice hook, callback subscription | 214-292, 1140-1175 |
| `client/src/components/StreamingVoiceChat.tsx` | Main voice UI, avatar sync effect | 862-915, 2846, 2916 |
| `client/src/components/VoiceChatViewManager.tsx` | Passes props to ImmersiveTutor | 178-215 |
| `client/src/components/ImmersiveTutor.tsx` | Avatar rendering, tutorStatus logic | 628 |
| `server/unified-ws-handler.ts` | WebSocket handling, telemetry | 2228 |

### Avatar State Flow

```
audioUtils.ts (setState)
    ↓ notifyStateChange(state)
useStreamingVoice.ts (onStateChange callback)
    ↓ setPlaybackStateRef.current(state)
useStreamingVoice.ts (playbackState state)
    ↓ return { state: { playbackState } }
StreamingVoiceChat.tsx (streamingVoice.state.playbackState)
    ↓ useEffect detects change
    ↓ isPlaying = playbackState === 'playing' || playbackState === 'buffering'
    ↓ <VoiceChatViewManager isPlaying={isPlaying} playbackState={playbackState} />
VoiceChatViewManager.tsx
    ↓ <ImmersiveTutor isPlaying={isPlaying} playbackState={playbackState} />
ImmersiveTutor.tsx
    ↓ tutorStatus={isPlaying ? 'speaking' : ...}
```

---

## Debug Commands

### Browser Console

```javascript
// Check if callbacks are firing
window.__lastPlaybackCallback    // Last callback invocation details
window.__playbackStateSetCount   // Number of state sets attempted

// Enable verbose logging
window._debugVoice = true;

// Check audio player state
window.__streamingAudioPlayer?.state
window.__streamingAudioPlayer?.subscribers.size

// Force state change (testing only)
window.__streamingAudioPlayer?.setState?.('playing')
```

### Log Prefixes to Look For

```
[CALLBACK SETUP]           - Hook subscribing to player
[PLAYBACK CALLBACK]        - Callback invoked with state
[AUDIO PLAYER]             - Player state changes
[STREAMING VOICE CHAT DEBUG] - Parent component receiving state
[AVATAR SYNC DEBUG]        - Avatar sync effect running
[IMMERSIVE TUTOR PROP]     - ImmersiveTutor receiving prop changes
[MIC LOCKOUT DEBUG]        - Mic lockout state calculations
```

---

## Proposed Fix: DOM Event Bridge

**Strategic recommendation from architect:** Implement parallel DOM-level event dispatching.

### Why
- Guarantees avatar animation works immediately
- Bypasses React callback staleness issue
- Easy to remove once callback mechanism is fixed

### Implementation

```typescript
// In audioUtils.ts - notifyStateChange
private notifyStateChange(state: StreamingPlaybackState): void {
  // Existing subscriber notification
  Array.from(this.subscribers.entries()).forEach(([id, callbacks]) => {
    callbacks.onStateChange?.(state);
  });
  
  // NEW: Parallel DOM event for reliability
  window.dispatchEvent(new CustomEvent('streaming-playback-state', {
    detail: { state, timestamp: Date.now() }
  }));
}
```

```typescript
// In useStreamingVoice.ts - add event listener
useEffect(() => {
  const handlePlaybackState = (e: CustomEvent) => {
    setPlaybackState(e.detail.state);
  };
  window.addEventListener('streaming-playback-state', handlePlaybackState as EventListener);
  return () => window.removeEventListener('streaming-playback-state', handlePlaybackState as EventListener);
}, []);
```

### Testing After Implementation
1. Start voice chat
2. Check `window.__lastPlaybackCallback` - should show recent timestamps
3. Check avatar animates when audio plays
4. Verify both callback AND event paths work

---

## Related Docs

| Document | Focus |
|----------|-------|
| `docs/open-mic-debugging.md` | Open mic mode, VAD, bilingual support |
| `docs/daniela-voice-stack-consultation.md` | Provider choices, latency vs quality |
| `docs/batch-doc-updates.md` | Session history, voice diagnostics features |
| `docs/voice-intelligence-session-checkpoint.md` | Voice intelligence system |

---

## Version History

| Date | Change |
|------|--------|
| Dec 24, 2025 | Created consolidated debug doc |
| Dec 24, 2025 | Multi-subscriber pattern implemented |
| Dec 24, 2025 | DOM event bridge proposed |
