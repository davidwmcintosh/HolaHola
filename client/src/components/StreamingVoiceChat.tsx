/**
 * StreamingVoiceChat - WebSocket-based streaming voice chat
 * 
 * This component uses STREAMING ONLY mode:
 * - Deepgram Nova-3 STT → Gemini 2.5 Flash → Cartesia Sonic-3 TTS
 * - Progressive audio delivery via WebSocket
 * - Target: <1s TTFB (Time To First Byte)
 * 
 * REST FALLBACK CODE IS PRESERVED BUT NEVER EXECUTED
 * The REST code below (starting around line 1020) is kept as emergency backup
 * but is protected by STREAMING_ONLY_MODE = true which prevents it from running.
 * DO NOT set STREAMING_ONLY_MODE to false without extensive testing.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Message, type User } from "@shared/schema";
import { processVoiceMessage, synthesizeSpeech, requestSlowRepeat, type WordTiming } from "@/lib/restVoiceApi";
import { getStreamingAudioPlayer } from "@/lib/audioUtils";
import { InstructorAvatar, type AvatarState } from "@/components/InstructorAvatar";
import { CompactDifficultyControl } from "@/components/CompactDifficultyControl";
import { LanguageSelector } from "@/components/LanguageSelector";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { VoiceChatViewManager } from "@/components/VoiceChatViewManager";
import { useStreamingVoice } from "@/hooks/useStreamingVoice";
import { usePlaybackState, getGlobalPlaybackState, setGlobalPlaybackState } from "@/lib/playbackStateStore";
import { useUser } from "@/lib/auth";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { useToast } from "@/hooks/use-toast";
import { useWhiteboard } from "@/hooks/useWhiteboard";
import { getTutorNames } from "@/lib/tutor-avatars";
import { SupportAssistModal } from "@/components/SupportAssistModal";
import { setRemediationCallback } from "@/lib/lockoutDiagnostics";
import { getStreamingVoiceClient } from "@/lib/streamingVoiceClient";
import type { VoiceInputMode, OpenMicState } from "@shared/streaming-voice-types";
import type { VoiceOverride } from "./VoiceLabPanel";

// ============================================================================
// STREAMING MODE CONFIGURATION
// ============================================================================
// STREAMING_ONLY_MODE = true means REST code is NEVER executed
// This is the production setting - do not change without extensive testing
// ============================================================================
const ENABLE_STREAMING_MODE = true;
const STREAMING_ONLY_MODE = true; // CRITICAL: Never fall back to REST

// Helper to prevent double-greetings on mobile app reloads
// Tracks WHEN last greeting played AND which message ID was synthesized
const GREETING_TIMESTAMP_KEY = 'linguaflow_last_greeting_time';
const GREETING_MESSAGE_KEY = 'linguaflow_last_greeting_message';
const GREETING_COOLDOWN_MS = 5000; // 5 seconds - prevent double-greeting on mount, but allow reconnections

// Module-level lock to prevent race conditions when multiple components mount simultaneously
// This uses a compare-and-swap pattern: check and set atomically
let greetingInProgress = false;
let synthesizedMessageId: string | null = null; // Track which message was already synthesized

// Atomically try to acquire the greeting lock
// Returns true if lock acquired, false if already locked
function tryAcquireGreetingLock(messageId: string): boolean {
  // Check if we already synthesized this specific message
  // This persists across React remounts
  if (synthesizedMessageId === messageId) {
    console.log('[VOICE GREETING] Already synthesized message:', messageId);
    return false;
  }
  
  // Also check sessionStorage for persistence across HMR
  try {
    const storedMessageId = sessionStorage.getItem(GREETING_MESSAGE_KEY);
    if (storedMessageId === messageId) {
      console.log('[VOICE GREETING] Already synthesized (from storage):', messageId);
      return false;
    }
  } catch {
    // Ignore storage errors
  }
  
  // Fast synchronous lock check - prevents race conditions on double-mount
  if (greetingInProgress) {
    console.log('[VOICE GREETING] Already in progress (sync lock)');
    return false;
  }
  
  // Check cooldown timer
  try {
    const stored = sessionStorage.getItem(GREETING_TIMESTAMP_KEY);
    if (stored) {
      const lastTime = parseInt(stored, 10);
      const elapsed = Date.now() - lastTime;
      if (elapsed < GREETING_COOLDOWN_MS) {
        console.log('[VOICE GREETING] Cooldown active - last greeting was', Math.round(elapsed / 1000), 'seconds ago');
        return false;
      }
    }
  } catch {
    // Ignore storage errors
  }
  
  // ATOMICALLY acquire lock, set message ID, and set timestamp together
  greetingInProgress = true;
  synthesizedMessageId = messageId;
  try {
    sessionStorage.setItem(GREETING_TIMESTAMP_KEY, Date.now().toString());
    sessionStorage.setItem(GREETING_MESSAGE_KEY, messageId);
  } catch {
    // Ignore storage errors
  }
  
  console.log('[VOICE GREETING] Lock acquired for message:', messageId);
  return true;
}

function clearGreetingLock(): void {
  greetingInProgress = false;
  synthesizedMessageId = null;
  try {
    sessionStorage.removeItem(GREETING_MESSAGE_KEY);
    sessionStorage.removeItem(GREETING_TIMESTAMP_KEY);
  } catch {
  }
}

interface StreamingVoiceChatProps {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  setCurrentConversationOnboarding: (isOnboarding: boolean | null) => void;
  isResumedConversation?: boolean;
  onResumeHandled?: () => void;
  onLanguageHandoff?: (tutorName: string, targetLanguage: string) => void;
  onLanguageHandoffComplete?: () => void;
  isExhausted?: boolean;
  onInsufficientCredits?: () => void;
  onWhiteboardItemsChange?: (items: import("@shared/whiteboard-types").WhiteboardItem[]) => void;
  whiteboardCallbacksRef?: React.MutableRefObject<{
    clear: () => void;
    drillComplete: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
    textInputSubmit: (itemId: string, response: string) => void;
  } | null>;
  useDesktopWhiteboard?: boolean;
  onScenarioLoaded?: (scenario: any) => void;
  onScenarioEnded?: (data: { scenarioId?: string; scenarioSlug?: string; performanceNotes?: string }) => void;
  onPropUpdate?: (data: { propTitle: string; updates: Array<{ label: string; value: string }>; updatedFields: Array<{ label: string; value: string }> }) => void;
  onStudioImage?: (image: { word: string; description: string; imageUrl: string; context?: string }) => void;
  /** Override the language sent to the server without touching the user's stored language preference.
   *  Use this for subject pages (biology, history) so their subject identifier reaches the WS handler
   *  but does NOT bleed into the user's learning-language context. */
  targetLanguageOverride?: string;
  /** Route to navigate to when an unrecoverable error occurs. Defaults to '/chat'. */
  homeRoute?: string;
}

export function StreamingVoiceChat({ 
  conversationId, 
  setConversationId, 
  setCurrentConversationOnboarding,
  isResumedConversation,
  onResumeHandled,
  onLanguageHandoff,
  onLanguageHandoffComplete,
  isExhausted,
  onInsufficientCredits,
  onWhiteboardItemsChange,
  whiteboardCallbacksRef,
  useDesktopWhiteboard = false,
  onScenarioLoaded,
  onScenarioEnded,
  onPropUpdate,
  onStudioImage,
  targetLanguageOverride,
  homeRoute = '/chat',
}: StreamingVoiceChatProps) {
  const [, navigate] = useLocation();
  const { language, difficulty, setLanguage, subtitleMode, setSubtitleMode, tutorGender, voiceSpeed, setTutorGender, setVoiceSpeed } = useLanguage();
  const { isDeveloper, isAdmin, user } = useUser();
  const { learningContext, isHonestyMode } = useLearningFilter();
  const { toast } = useToast();
  
  // Check if we're in class mode
  const isInClassMode = learningContext !== "self-directed" && 
                        learningContext !== "all" && 
                        learningContext !== "all-classes" && 
                        learningContext !== "all-learning" &&
                        learningContext !== "founder-mode" &&
                        learningContext !== "honesty-mode";
  const classId = isInClassMode ? learningContext : null;
  
  // Developer tools mutations
  const reloadCreditsMutation = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error("No class selected");
      const res = await apiRequest("POST", "/api/developer/reload-credits", { 
        classId,
        hours: 120 
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/usage/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      toast({
        title: "Credits Reloaded",
        description: `Reset to ${data.hours || 120} hours`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reload credits",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  const resetDataMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not found");
      const res = await apiRequest("POST", `/api/admin/users/${user.id}/reset-learning-data`, {
        resetVocabulary: true,
        resetGrammar: true,
        resetProgress: true,
        resetConversations: true,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/grammar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-hub"] }); // Invalidate language hub stats
      toast({
        title: "Learning Data Reset",
        description: `Cleared: ${data.deletedVocabulary || 0} words, ${data.deletedGrammar || 0} exercises`,
      });
      // Force new conversation after reset
      setConversationId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reset data",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    },
  });
  
  // Query voice config from database - this is the source of truth for tutor names
  const { data: tutorVoices } = useQuery<{ 
    language: string; 
    female: { name: string; voiceId: string; speakingRate: number } | null; 
    male: { name: string; voiceId: string; speakingRate: number } | null 
  }>({
    queryKey: ['/api/tutor-voices', language?.toLowerCase()],
    enabled: !!language,
  });
  
  // Get tutor names from database (Voice Lab is source of truth), fallback to directory
  const tutorNames = useMemo(() => {
    const fallback = getTutorNames(language);
    return {
      male: tutorVoices?.male?.name || fallback.male,
      female: tutorVoices?.female?.name || fallback.female,
    };
  }, [tutorVoices, language]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPttButtonHeld, setIsPttButtonHeld] = useState(false); // Track if PTT button is physically held (separate from MediaRecorder state)
  
  // Voice Lab: Session-level voice overrides (admin only - applies to next TTS call)
  const [voiceOverride, setVoiceOverride] = useState<VoiceOverride | null>(null);
  // Incognito mode: off-the-record voice sessions (Founder/Honesty mode only)
  const [isIncognito, setIsIncognito] = useState(false);
  const isPttButtonHeldRef = useRef(false); // Synchronous ref for guards (state is async)
  const activeInputTypeRef = useRef<'mouse' | 'touch' | 'keyboard' | null>(null); // Track which input started recording
  const [isMicPreparing, setIsMicPreparing] = useState(false); // Show "Preparing mic..." before actual recording starts
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState<string | null>(null);
  
  // Voice input mode: open-mic (default) or push-to-talk
  const [inputMode, setInputMode] = useState<VoiceInputMode>('open-mic');
  // Open mic visual state for feedback
  const [openMicState, setOpenMicState] = useState<OpenMicState>('idle');
  const openMicStateRef = useRef<OpenMicState>('idle');
  // Track if we're awaiting/playing a response (to ignore VAD events)
  const isAwaitingResponseRef = useRef(false);
  // Track previous input mode to detect mode changes
  const prevInputModeRef = useRef<VoiceInputMode>(inputMode);
  // CRITICAL: Track current inputMode for use in callbacks (avoids stale closure)
  const inputModeRef = useRef<VoiceInputMode>(inputMode);
  inputModeRef.current = inputMode; // Always keep in sync
  openMicStateRef.current = openMicState; // Always keep in sync
  // CRITICAL: Track current avatarState for use in callbacks (avoids stale closure)
  const avatarStateRef = useRef<AvatarState>(avatarState);
  avatarStateRef.current = avatarState; // Always keep in sync
  // CRITICAL: Track current connectionState for use in polling loops (avoids stale closure)
  // Note: The actual sync happens AFTER streamingVoice is initialized below
  const connectionStateRef = useRef<string>('disconnected');
  
  // OPEN MIC SAFETY: Failsafe timer to auto-recover from stuck 'processing' state
  const openMicProcessingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const OPEN_MIC_PROCESSING_TIMEOUT_MS = 35000;

  // Store last audio for replay functionality
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [isSlowRepeatLoading, setIsSlowRepeatLoading] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  
  // Whiteboard hook - tutor-controlled visual teaching aids
  const whiteboard = useWhiteboard();
  
  // Sync whiteboard items to parent for desktop panel rendering
  const onWhiteboardItemsChangeRef = useRef(onWhiteboardItemsChange);
  onWhiteboardItemsChangeRef.current = onWhiteboardItemsChange;
  useEffect(() => {
    onWhiteboardItemsChangeRef.current?.(whiteboard.items);
  }, [whiteboard.items]);
  
  // Expose whiteboard callbacks to parent via ref (for desktop panel drill/text interactions)
  // This needs to be set after streamingVoice is available, so we use a separate effect below
  const whiteboardCallbacksRefLocal = whiteboardCallbacksRef;
  
  // Cache for slow repeat audio - so subsequent presses just replay
  const slowRepeatCacheRef = useRef<{ messageId: string; audioBlob: Blob } | null>(null);
  
  // Word timing data for synchronized subtitles - persisted per message ID
  // Using a ref to persist across re-renders without causing re-renders
  const wordTimingsMapRef = useRef<Map<string, WordTiming[]>>(new Map());
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  // Note: Scroll is handled by VoiceChatViewManager - no scroll refs needed here
  const streamRef = useRef<MediaStream | null>(null);
  const currentConversationRef = useRef<string | null>(conversationId);
  const hasPlayedGreetingRef = useRef<string | null>(null); // Track which conversation's greeting was played
  const hasDanielaSpokeOnceRef = useRef<boolean>(false); // Track if Daniela has spoken at least once this session
  const isRecordingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false); // For stable keyboard handlers
  const recordingRequestedRef = useRef<boolean>(false); // Track if recording was requested (for race condition prevention)
  
  // Silence detection refs (only for auto-stop mode)
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Streaming voice mode for low-latency responses
  const streamingVoice = useStreamingVoice();
  const globalPlaybackState = usePlaybackState(); // Global store - reliable during HMR
  const streamingConnectedRef = useRef(false);
  const useStreamingMode = ENABLE_STREAMING_MODE && streamingVoice.isSupported();
  // Keep connectionStateRef in sync (must be after streamingVoice is defined)
  connectionStateRef.current = streamingVoice.state.connectionState;
  
  // Populate whiteboard callbacks ref for desktop panel (after streamingVoice is available)
  useEffect(() => {
    if (whiteboardCallbacksRefLocal) {
      whiteboardCallbacksRefLocal.current = {
        clear: whiteboard.clear,
        drillComplete: (drillId, drillType, isCorrect, responseTimeMs, toolContent) => {
          if (useStreamingMode) {
            streamingVoice.sendDrillResult(drillId, drillType, isCorrect, responseTimeMs, toolContent);
          }
        },
        textInputSubmit: (itemId, response) => {
          if (useStreamingMode) {
            streamingVoice.sendTextInput(itemId, response);
          }
        },
      };
    }
    return () => {
      if (whiteboardCallbacksRefLocal) {
        whiteboardCallbacksRefLocal.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteboardCallbacksRefLocal, useStreamingMode]);
  
  // Telephone ringing sound during connection
  const ringingAudioRef = useRef<{ 
    context: AudioContext; 
    gainNode: GainNode;
    oscillatorInterval: NodeJS.Timeout | null;
    isPlaying: boolean;
  } | null>(null);
  
  // Pre-create ringing AudioContext eagerly at mount time (within navigation gesture context)
  // This avoids the suspended-context problem when startRinging is called from useEffect later
  const ringingContextRef = useRef<AudioContext | null>(null);
  if (!ringingContextRef.current && typeof window !== 'undefined') {
    try {
      ringingContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('[RINGING] Pre-created AudioContext at mount, state:', ringingContextRef.current.state);
    } catch (e) {
      console.warn('[RINGING] Failed to pre-create AudioContext:', e);
    }
  }
  
  // Mic warm-up: cache stream for instant recording start
  const cachedStreamRef = useRef<MediaStream | null>(null);
  const micWarmedUpRef = useRef(false);
  
  // Cross-language handoff tracking
  // When true, we're reconnecting after a language switch
  const isLanguageHandoffRef = useRef(false);
  
  // Keep refs updated with current state
  useEffect(() => {
    currentConversationRef.current = conversationId;
    isRecordingRef.current = isRecording;
    isProcessingRef.current = isProcessing;
  }, [conversationId, isRecording, isProcessing]);
  
  // Reset hasDanielaSpokeOnce when conversation changes (new session)
  useEffect(() => {
    hasDanielaSpokeOnceRef.current = false;
  }, [conversationId]);
  
  // Voice Lab: Send voice override to server when it changes
  useEffect(() => {
    if (streamingVoice.state.connectionState === 'ready' || 
        streamingVoice.state.connectionState === 'processing') {
      streamingVoice.sendVoiceOverride(voiceOverride);
      console.log('[Voice Lab] Sent voice override to server:', voiceOverride);
    }
  }, [voiceOverride, streamingVoice.state.connectionState]);
  
  // Handle input mode changes - cleanup when switching modes
  // Note: Uses a ref-based approach since stopOpenMicRecording is defined later in the file
  const handleModeChangeCleanupRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    const prevMode = prevInputModeRef.current;
    
    // If switching FROM open-mic to push-to-talk, cleanup open mic state
    // NOTE: We do NOT stop audio here - let barge-in handle interruption when user speaks
    if (prevMode === 'open-mic' && inputMode === 'push-to-talk') {
      console.log('[MODE SWITCH] Switching from open-mic to push-to-talk - cleaning up mic state (audio continues)');
      
      // Use ref-based cleanup function if available
      if (handleModeChangeCleanupRef.current) {
        handleModeChangeCleanupRef.current();
      }
      
      // Stop WebSocket streaming for mic
      streamingVoice.stopStreaming();
      
      // Reset recording states only (let audio continue)
      setIsRecording(false);
      isRecordingRef.current = false;
      setOpenMicState('idle');
      isAwaitingResponseRef.current = false;
    }
    
    // If switching TO open-mic mode, AUTO-START the session
    // This eliminates the confusing extra tap requirement
    // IMPORTANT: Must wait for session to be fully ready (session_started received)
    // NOTE: We do NOT stop audio here - barge-in handles interruption when user actually speaks
    if (prevMode === 'push-to-talk' && inputMode === 'open-mic') {
      console.log('[MODE SWITCH] Switching to open-mic - will AUTO-START when session ready (audio continues until barge-in)');
      
      // Show preparing state while we start
      setOpenMicState('idle');
      
      // Poll until session is ready (connectionState === 'ready' or 'processing')
      // This ensures we don't start Open Mic before the greeting is processed
      let retryCount = 0;
      const maxRetries = 25; // 5 seconds max wait
      
      const checkAndStart = () => {
        // CRITICAL: Use ref to get current state, not stale closure value
        const currentState = connectionStateRef.current;
        console.log('[MODE SWITCH] Checking session state:', currentState, 'retry:', retryCount);
        
        // Session is ready or processing - good to start
        if ((currentState === 'ready' || currentState === 'processing') && inputModeRef.current === 'open-mic') {
          console.log('[MODE SWITCH] Session ready - AUTO-STARTING open mic, ref exists:', !!startOpenMicRecordingRef.current);
          if (startOpenMicRecordingRef.current) {
            console.log('[MODE SWITCH] Calling startOpenMicRecordingRef.current()...');
            startOpenMicRecordingRef.current().then(() => {
              console.log('[MODE SWITCH] Open mic auto-started successfully');
              // DON'T immediately show green light!
              // The playback state effect will show it when Daniela finishes speaking
              console.log('[MODE SWITCH] Mic ready, green light controlled by playback state');
            }).catch((err: any) => {
              console.error('[MODE SWITCH] Failed to auto-start open mic:', err);
              setOpenMicState('idle');
            });
          }
        } else if (currentState === 'error' || currentState === 'disconnected') {
          // Session failed - don't auto-start
          console.log('[MODE SWITCH] Session failed, not auto-starting:', currentState);
        } else if (retryCount < maxRetries && inputModeRef.current === 'open-mic') {
          // Still waiting - retry
          retryCount++;
          setTimeout(checkAndStart, 200);
        } else {
          console.log('[MODE SWITCH] Gave up waiting for session, retries:', retryCount);
        }
      };
      
      // Start checking after small delay
      setTimeout(checkAndStart, 100);
    }
    
    // Update prev mode ref
    prevInputModeRef.current = inputMode;
  }, [inputMode, streamingVoice]);
  
  useEffect(() => {
    setRemediationCallback(() => {
      console.warn('[StreamingVoiceChat] Auto-remediation: force-resetting mic state');
      setIsProcessing(false);
      isProcessingRef.current = false;
      setGlobalPlaybackState('idle');
      streamingVoice.forceResetProcessing?.();
    });
    return () => {
      setRemediationCallback(null);
    };
  }, [streamingVoice]);

  // Pre-warm microphone on component mount for instant recording
  // This requests mic permission early and caches the stream
  // NOTE: This may fail on browsers that require user gesture for mic access
  useEffect(() => {
    if (micWarmedUpRef.current) return;
    
    const warmUpMic = async () => {
      try {
        console.log('[MIC WARMUP] Pre-warming microphone (500ms after mount)...');
        const startTime = performance.now();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        cachedStreamRef.current = stream;
        micWarmedUpRef.current = true;
        console.log('[MIC WARMUP] SUCCESS! Microphone ready for instant recording (took', (performance.now() - startTime).toFixed(0), 'ms)');
      } catch (err: any) {
        console.log('[MIC WARMUP] FAILED - Browser likely requires user gesture for mic access:', err.name, err.message);
        // Not a critical error - we'll request permission on first button press
      }
    };
    
    // Small delay to let the UI render first
    const timeoutId = setTimeout(warmUpMic, 500);
    
    return () => {
      clearTimeout(timeoutId);
      // Clean up cached stream on unmount
      if (cachedStreamRef.current) {
        cachedStreamRef.current.getTracks().forEach(track => track.stop());
        cachedStreamRef.current = null;
      }
    };
  }, []);

  // MOBILE AUDIO UNLOCK: Resume AudioContext on first user interaction
  // Mobile browsers (iOS Safari, Chrome) suspend AudioContext until a user gesture
  // Since voice chat auto-connects via useEffect (not a direct tap), audio stays blocked
  useEffect(() => {
    if (!useStreamingMode) return;
    
    let unlocked = false;
    const unlockAudio = async () => {
      if (unlocked) return;
      unlocked = true;
      
      try {
        const player = getStreamingAudioPlayer();
        await player.resumeAudioContext();
        console.log('[MOBILE AUDIO] AudioContext unlocked via user gesture');
      } catch (err) {
        console.warn('[MOBILE AUDIO] Failed to unlock AudioContext:', err);
      }
      
      if (ringingAudioRef.current?.context?.state === 'suspended') {
        ringingAudioRef.current.context.resume().then(() => {
          console.log('[MOBILE AUDIO] Ringing AudioContext also resumed via user gesture');
        }).catch(() => {});
      }
      
      if (ringingContextRef.current?.state === 'suspended') {
        ringingContextRef.current.resume().then(() => {
          console.log('[MOBILE AUDIO] Pre-created ringing context resumed via user gesture');
        }).catch(() => {});
      }
      
      if (openMicAudioContextRef.current?.state === 'suspended') {
        openMicAudioContextRef.current.resume().then(() => {
          console.log('[MOBILE AUDIO] Open-mic AudioContext resumed via user gesture — mic should now capture real audio');
        }).catch(() => {});
      }
      
      document.removeEventListener('touchstart', unlockAudio, true);
      document.removeEventListener('touchend', unlockAudio, true);
      document.removeEventListener('click', unlockAudio, true);
    };
    
    document.addEventListener('touchstart', unlockAudio, true);
    document.addEventListener('touchend', unlockAudio, true);
    document.addEventListener('click', unlockAudio, true);
    
    return () => {
      document.removeEventListener('touchstart', unlockAudio, true);
      document.removeEventListener('touchend', unlockAudio, true);
      document.removeEventListener('click', unlockAudio, true);
    };
  }, [useStreamingMode]);
  
  // Telephone ringing sound functions
  const startRinging = async () => {
    if (ringingAudioRef.current?.isPlaying) return;
    
    try {
      // Reuse the pre-created context (created at mount time within gesture context)
      // Fall back to creating a new one if somehow missing
      const context = ringingContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      ringingContextRef.current = null; // Consumed — will be cleaned up via ringingAudioRef
      
      if (context.state === 'suspended') {
        try {
          await context.resume();
          console.log('[RINGING] AudioContext was suspended, resumed successfully');
        } catch (resumeErr) {
          console.warn('[RINGING] AudioContext resume failed (no user gesture yet) - ringing will be silent:', resumeErr);
        }
      }
      
      console.log('[RINGING] Using AudioContext, state:', context.state);
      
      const gainNode = context.createGain();
      gainNode.connect(context.destination);
      gainNode.gain.value = 0.15;
      
      const playRingCycle = () => {
        if (!ringingAudioRef.current?.isPlaying) return;
        
        // Resume context if it got suspended between rings (belt-and-suspenders)
        if (context.state === 'suspended') {
          context.resume().catch(() => {});
        }
        
        const osc1 = context.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 440;
        osc1.connect(gainNode);
        osc1.start(context.currentTime);
        osc1.stop(context.currentTime + 0.4);
        
        const osc2 = context.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 480;
        osc2.connect(gainNode);
        osc2.start(context.currentTime + 0.05);
        osc2.stop(context.currentTime + 0.35);
      };
      
      ringingAudioRef.current = {
        context,
        gainNode,
        oscillatorInterval: null,
        isPlaying: true,
      };
      
      playRingCycle();
      
      ringingAudioRef.current.oscillatorInterval = setInterval(() => {
        if (ringingAudioRef.current?.isPlaying) {
          playRingCycle();
        }
      }, 2500);
      
      console.log('[RINGING] Started telephone ring sound (context state:', context.state, ')');
    } catch (err) {
      console.error('[RINGING] Failed to start ring sound:', err);
    }
  };
  
  const stopRinging = () => {
    if (!ringingAudioRef.current) return;
    
    ringingAudioRef.current.isPlaying = false;
    
    if (ringingAudioRef.current.oscillatorInterval) {
      clearInterval(ringingAudioRef.current.oscillatorInterval);
    }
    
    try {
      ringingAudioRef.current.context.close();
    } catch (err) {
      // Ignore close errors
    }
    
    ringingAudioRef.current = null;
    console.log('[RINGING] Stopped telephone ring sound');
  };
  
  // Play ringing sound during voice connection
  // Ringing should continue through 'connecting' → 'connected' → 'ready' → until AUDIO PLAYS
  // IMPORTANT: Don't ring on reconnects if Daniela has already spoken (prevents mid-call ringing)
  // NOTE: Ringing is started explicitly in connectStreaming() below, not from connectionState,
  // because warm-up can pre-connect the socket causing connect() to skip the 'connecting' state.
  useEffect(() => {
    if (!useStreamingMode) return;
    
    const { connectionState } = streamingVoice.state;
    
    // Start ringing when connecting (WebSocket opening) — fallback for non-warmed connections
    // BUT only if Daniela hasn't spoken yet (prevents ringing during reconnects)
    if (connectionState === 'connecting' && !hasDanielaSpokeOnceRef.current) {
      startRinging();
    }
    
    // Stop ringing on connection failure only (not on 'ready' - wait for audio)
    if (connectionState === 'disconnected' || connectionState === 'error') {
      stopRinging();
    }
  }, [streamingVoice.state.connectionState, useStreamingMode]);
  
  // Connection timeout: If stuck ringing/connecting for too long, redirect to language hub
  // This prevents users from being stuck in a "calling" state forever
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds max to connect
  
  useEffect(() => {
    if (!useStreamingMode) return;
    
    const { connectionState } = streamingVoice.state;
    
    // Start timeout when entering connecting/reconnecting states
    if (connectionState === 'connecting' || connectionState === 'reconnecting') {
      // Clear any existing timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      connectionTimeoutRef.current = setTimeout(() => {
        console.log('[STREAMING] Connection timeout - redirecting to language hub');
        stopRinging();
        toast({
          title: "Connection timed out",
          description: "Unable to reach Daniela. Please try again.",
          variant: "destructive",
        });
        navigate(homeRoute);
      }, CONNECTION_TIMEOUT_MS);
    }
    
    // Clear timeout when connected successfully or disconnected
    if (connectionState === 'ready' || connectionState === 'disconnected') {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [streamingVoice.state.connectionState, useStreamingMode, navigate, toast]);
  
  // Handle unrecoverable connection errors - redirect to language hub
  useEffect(() => {
    const { error: streamError, connectionState } = streamingVoice.state;
    
    if (!streamError || connectionState !== 'disconnected') return;
    
    // Credits exhausted - show clear message and redirect to account
    if (streamError.includes('credits have been used up') || streamError.includes('Insufficient tutoring hours')) {
      console.log('[STREAMING] Credits exhausted - redirecting to account page');
      stopRinging();
      toast({
        title: "Session hours used up",
        description: "Visit your Account page to add more hours.",
        variant: "destructive",
      });
      setTimeout(() => {
        navigate(homeRoute);
      }, 2500);
      return;
    }
    
    // Check for unrecoverable errors (after all reconnect attempts failed or session expired)
    if (streamError.includes('Please restart') || streamError.includes('session has ended') || streamError.includes('Please start a new')) {
      console.log('[STREAMING] Unrecoverable error - redirecting to language hub');
      stopRinging();
      toast({
        title: "Session ended",
        description: "The connection was lost. Let's start fresh!",
        variant: "destructive",
      });
      setTimeout(() => {
        navigate(homeRoute);
      }, 1500);
    }
  }, [streamingVoice.state.error, streamingVoice.state.connectionState, navigate, toast]);
  
  // Separate cleanup effect for unmount only
  useEffect(() => {
    return () => {
      stopRinging();
    };
  }, []);

  // Fetch existing messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });
  
  // FIX: Stop ringing when 'ready' AND this is an existing conversation that won't get a greeting
  // For existing conversations with user messages, no auto-greeting plays, so we must stop ringing
  useEffect(() => {
    if (!useStreamingMode) return;
    
    const { connectionState } = streamingVoice.state;
    
    if (connectionState === 'ready' && messages.length > 0) {
      const userMessages = messages.filter(m => m.role === 'user');
      const aiMessages = messages.filter(m => m.role === 'assistant');
      const isNewConversation = userMessages.length === 0 && aiMessages.length <= 1;
      const willGreet = isNewConversation || isResumedConversation;
      
      // If no greeting will play, stop ringing immediately (call is "connected")
      if (!willGreet) {
        console.log('[RINGING] Stopping ring - existing conversation with no greeting');
        stopRinging();
      }
    }
  }, [streamingVoice.state.connectionState, useStreamingMode, messages, isResumedConversation]);
  
  // Fetch user details to get tutor gender preference
  const { data: userDetails } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  
  // Connect streaming voice when conversation and user data are available
  useEffect(() => {
    if (!useStreamingMode || !conversationId || !userDetails) return;
    
    // Block connection if credits are exhausted
    if (isExhausted) {
      console.log('[STREAMING] Connection blocked - credits exhausted');
      if (onInsufficientCredits) {
        onInsufficientCredits();
      }
      return;
    }
    
    const connectStreaming = async () => {
      try {
        console.log('[STREAMING] Connecting to streaming voice...');
        
        if (!hasDanielaSpokeOnceRef.current) {
          startRinging();
        }
        
        const isExplicitFounderMode = learningContext === 'founder-mode';
        
        await streamingVoice.connect({
          conversationId,
          targetLanguage: targetLanguageOverride ?? language,
          nativeLanguage: userDetails.nativeLanguage || 'english',
          difficultyLevel: difficulty,
          subtitleMode,
          tutorPersonality: userDetails.tutorPersonality || 'warm',
          tutorExpressiveness: userDetails.tutorExpressiveness || 3,
          tutorGender,  // Pass current tutor gender from context
          rawHonestyMode: isHonestyMode,  // Minimal prompting for authentic conversation
          founderMode: isExplicitFounderMode,  // Only true when explicitly selected
          onNoSpeechDetected: () => {
            console.log('[STREAMING] No speech detected - resetting processing state');
            setIsProcessing(false);
            isProcessingRef.current = false;
            setProcessingStage(null);
            pttReleaseSentRef.current = false;
          },
          onResponseComplete: (convId: string) => {
            console.log('[STREAMING] Response complete - refreshing messages for', convId);
            queryClient.invalidateQueries({ queryKey: ["/api/conversations", convId, "messages"] });
            
            const currentPlayback = getGlobalPlaybackState();
            const isAudioPlaying = currentPlayback === 'playing' || currentPlayback === 'buffering';
            
            setProcessingStage(null);
            
            if (isAudioPlaying) {
              console.log('[STREAMING] Response complete, audio playing - clearing isProcessing (mic stays locked via isAudioActive)');
            } else {
              console.log('[STREAMING] Response complete, audio idle - clearing isProcessing');
            }
            setIsProcessing(false);
            isProcessingRef.current = false;
            
            pttReleaseSentRef.current = false;  // Reset for next PTT turn
            // Reset awaiting flag for next utterance
            isAwaitingResponseRef.current = false;
            // TRUE DUPLEX: Keep green light ready if open mic is active
            if (inputModeRef.current === 'open-mic' && openMicActiveRef.current) {
              console.log('[OPEN MIC DUPLEX] Response complete - keeping green light ready');
              setOpenMicState('ready');
            } else {
              setOpenMicState('idle');
            }
            
            // CRITICAL: Restart open mic session if we're in open-mic mode
            // The server closes the session after each utterance, so we need to restart it
            // Use inputModeRef.current to get current value (avoids stale closure)
            if (inputModeRef.current === 'open-mic') {
              console.log('[OPEN MIC] Response complete - restarting session for next utterance');
              setTimeout(() => {
                // Use the ref to call the local startOpenMicRecording function
                if (startOpenMicRecordingRef.current) {
                  startOpenMicRecordingRef.current().then(() => {
                    // DON'T show green light here!
                    // The playback state effect will show it when audio actually finishes
                    console.log('[OPEN MIC] Session restarted - green light controlled by playback state');
                  }).catch((err: any) => {
                    console.error('[OPEN MIC] Failed to restart after response:', err);
                    setOpenMicState('idle');
                  });
                }
              }, 200); // Small delay to let audio finish playing
            }
            
            // Store combined audio blob for replay functionality
            const combinedBlob = streamingVoice.getCombinedAudioBlob();
            if (combinedBlob) {
              console.log('[STREAMING] Storing combined audio for replay:', combinedBlob.size, 'bytes');
              setLastAudioBlob(combinedBlob);
              
              // Find the latest assistant message ID for replay tracking
              // We need to invalidate first and let messages refresh, then set the ID
              // Since invalidation is async, we'll set lastMessageId in a separate effect
            }
          },
          onWhiteboardUpdate: (items, shouldClear) => {
            const imageItems = items.filter((item: any) => item.type === 'image' && item.data?.imageUrl);
            const otherItems = items.filter((item: any) => !(item.type === 'image' && item.data?.imageUrl));
            imageItems.forEach((img: any) => {
              onStudioImage?.({
                word: img.data.word || img.content,
                description: img.data.description || img.content,
                imageUrl: img.data.imageUrl,
                context: img.data.context,
              });
            });
            if (otherItems.length > 0 || shouldClear) {
              whiteboard.addOrUpdateItems(otherItems, shouldClear);
            }
          },
          onScenarioLoaded: (scenario) => {
            onScenarioLoaded?.(scenario);
          },
          onScenarioEnded: (data) => {
            onScenarioEnded?.(data);
          },
          onPropUpdate: (data) => {
            onPropUpdate?.(data);
          },
          onVadSpeechStarted: () => {
            // TRUE DUPLEX: Always handle VAD speech events for visual feedback
            // NOTE: We no longer interrupt on VAD alone - echo/feedback can trigger false VAD
            // Interrupt is now handled in onInterimTranscript when we have ACTUAL user speech
            console.log('[OPEN MIC] VAD speech started - avatarState=', avatarStateRef.current, 'hasDanielaSpokeOnce=', hasDanielaSpokeOnceRef.current);
            
            // PHONE CALL MODEL: Only show green light if Daniela has "answered the call" (spoken at least once)
            // This prevents the confusing premature green light before Daniela greets
            if (hasDanielaSpokeOnceRef.current) {
              setOpenMicState('listening');
            } else {
              console.log('[OPEN MIC] Daniela hasnt spoken yet - keeping mic blue (waiting for her to answer)');
            }
          },
          onVadUtteranceEnd: (transcript, empty) => {
            console.log('[OPEN MIC] VAD utterance end, transcript:', transcript, 'empty:', empty);
            if (empty) {
              console.log('[OPEN MIC] Empty transcript - resetting to listening (no AI call needed)');
              setOpenMicState('ready');
              setIsProcessing(false);
              isProcessingRef.current = false;
              isAwaitingResponseRef.current = false;
              return;
            }
            setOpenMicState('processing');
            setIsProcessing(true);
            isProcessingRef.current = true;
            isAwaitingResponseRef.current = true;
            
            // SAFETY: Start failsafe timer to recover from stuck processing state
            if (openMicProcessingTimeoutRef.current) clearTimeout(openMicProcessingTimeoutRef.current);
            openMicProcessingTimeoutRef.current = setTimeout(() => {
              const currentState = openMicStateRef.current;
              if (currentState === 'processing') {
                console.warn(`[OPEN MIC SAFETY] Processing stuck for ${OPEN_MIC_PROCESSING_TIMEOUT_MS}ms — force-recovering to ready state`);
                setOpenMicState('ready');
                setIsProcessing(false);
                isProcessingRef.current = false;
                isAwaitingResponseRef.current = false;
                setAvatarState('listening');
              }
              openMicProcessingTimeoutRef.current = null;
            }, OPEN_MIC_PROCESSING_TIMEOUT_MS);
          },
          onInterimTranscript: (transcript) => {
            console.log('[OPEN MIC] Interim transcript:', transcript);
            
            // Reinforce 'listening' state when we get actual transcribed words from Deepgram
            // Having real transcript text is the most reliable indicator the user is speaking
            if (transcript && transcript.trim().length > 0) {
              const currentOMState = openMicStateRef.current;
              if (currentOMState !== 'listening' && currentOMState !== 'processing') {
                console.log('[OPEN MIC] Interim transcript with words - forcing listening state (was:', currentOMState, ')');
                setOpenMicState('listening');
              }
              
              // BARGE-IN: Interrupt tutor when we have ACTUAL transcribed speech
              // This is more reliable than VAD alone, which can trigger on TTS echo
              if (avatarStateRef.current === 'speaking' || isAwaitingResponseRef.current) {
                console.log('[BARGE-IN] User speaking with transcript - stopping audio and sending interrupt');
                // CRITICAL: Stop audio playback immediately on client side
                streamingVoice.stop();
                // Also notify server to stop generating
                streamingVoice.sendInterrupt();
                // Reset awaiting flag so new speech is captured
                isAwaitingResponseRef.current = false;
                // Update avatar state immediately
                setAvatarState('listening');
              }
            }
          },
          onOpenMicSessionClosed: () => {
            console.log('[OPEN MIC] Server session closed');
            // CRITICAL: Reset both the active ref AND isRecording state so restart can work
            // This is needed because the server session closed unexpectedly
            if (openMicActiveRef.current) {
              console.log('[OPEN MIC] Resetting openMicActiveRef for restart');
              openMicActiveRef.current = false;
            }
            // Also reset isRecording state to allow restart
            isRecordingRef.current = false;
            setIsRecording(false);
            
            // If still in open mic mode and not awaiting response, restart the session
            // Use inputModeRef.current to get current value (avoids stale closure)
            // BUT only restart if audio has finished playing (not during greeting)
            // Check avatarStateRef to ensure Daniela isn't speaking
            if (inputModeRef.current === 'open-mic' && !isAwaitingResponseRef.current && avatarStateRef.current !== 'speaking') {
              console.log('[OPEN MIC] Restarting open mic session after server close');
              setOpenMicState('idle');
              // Use a small delay to allow any cleanup to complete
              setTimeout(() => {
                if (inputModeRef.current === 'open-mic' && startOpenMicRecordingRef.current) {
                  startOpenMicRecordingRef.current().then(() => {
                    // DON'T show green light here!
                    // The playback state effect will show it when audio actually finishes
                    console.log('[OPEN MIC] Session restarted - green light controlled by playback state');
                  }).catch((err: any) => {
                    console.error('[OPEN MIC] Failed to restart session:', err);
                    setOpenMicState('idle');
                  });
                }
              }, 100);
            } else if (inputModeRef.current === 'open-mic' && avatarStateRef.current === 'speaking') {
              console.log('[OPEN MIC] Server closed during Daniela speaking - will restart when done');
            }
          },
          onOpenMicSilenceLoop: (emptyCount, msSinceLast) => {
            console.warn(`[OPEN MIC] Silence loop: ${emptyCount} empties, ${msSinceLast}ms since last speech`);
            if (emptyCount >= 8 && inputModeRef.current === 'open-mic') {
              setOpenMicState('silence_issue');
            }
          },
          onReconnected: () => {
            console.log('[StreamingVoice] Connection restored silently');
          },
          onTutorHandoff: (handoff) => {
            const { targetGender, targetLanguage, tutorName, isLanguageSwitch, isAssistant } = handoff;
            
            // ASSISTANT HANDOFF: Navigate to assistant practice page
            if (isAssistant) {
              console.log(`[TUTOR HANDOFF] Assistant handoff to ${tutorName} - navigating to practice page`);
              // Disconnect from streaming voice before navigation
              streamingVoice.disconnect();
              streamingConnectedRef.current = false;
              // Navigate to assistant practice page
              window.location.href = '/practice';
              return;
            }
            
            if (isLanguageSwitch && targetLanguage) {
              console.log(`[TUTOR HANDOFF] Cross-language switch to ${tutorName} (${targetGender}) in ${targetLanguage}`);
              // Mark that we're in a language handoff - used to complete handoff after reconnection
              isLanguageHandoffRef.current = true;
              // CRITICAL: Clear greeting lock so new tutor can greet
              // Without this, the lock from the old tutor's session prevents the new tutor's greeting
              greetingRequestedRef.current = null;
              clearGreetingLock();
              try {
                sessionStorage.removeItem(GREETING_MESSAGE_KEY);
              } catch {
                // Ignore storage errors
              }
              console.log('[TUTOR HANDOFF] Cleared greeting lock for new tutor');
              // Notify parent to show transition overlay BEFORE language change
              // This prevents the white screen crash during context update
              onLanguageHandoff?.(tutorName || 'tutor', targetLanguage);
              // Update language context - parent will manage conversation reset
              setLanguage(targetLanguage);
            } else {
              console.log(`[TUTOR HANDOFF] Switching to ${tutorName || targetGender} tutor`);
            }
            setTutorGender(targetGender);
          },
          // Handle server-initiated subtitle mode change (tutor [SUBTITLE on/off/target] command)
          onSubtitleModeChange: (mode) => {
            console.log('[SUBTITLE] Server command to change subtitle mode to:', mode);
            // Update whiteboard's regularSubtitleMode (used by FloatingSubtitleOverlay)
            whiteboard.setRegularSubtitleMode(mode);
            // Also update context for persistence
            setSubtitleMode(mode);
          },
          // Handle server-initiated custom overlay (tutor [SHOW: text] / [HIDE] commands)
          onCustomOverlay: (action, text) => {
            console.log('[OVERLAY] Server command:', action, text?.substring(0, 50));
            whiteboard.setCustomOverlayText(action === 'show' ? (text || null) : null);
          },
        });
        streamingConnectedRef.current = true;
        console.log('[STREAMING] Connected successfully');
        
        // Complete language handoff if we were in one
        // The parent chat.tsx manages the handoff overlay and conversation reset
        // We just signal that the new connection is ready
        if (isLanguageHandoffRef.current) {
          console.log('[STREAMING] Connection ready after language handoff - signaling completion');
          isLanguageHandoffRef.current = false;
          // Signal immediately - parent will handle the reset
          // No timeout needed since the parent's safety timeout handles edge cases
          onLanguageHandoffComplete?.();
        }
      } catch (err: any) {
        console.error('[STREAMING] Failed to connect:', err.message);
        streamingConnectedRef.current = false;
        // Don't silently fail - show error to user
        setError('Voice streaming connection failed. Retrying...');
        
        // Keep handoff flag set so next retry can trigger completion
        // The safety timeout in chat.tsx will handle cleanup if all retries fail
        // DON'T clear isLanguageHandoffRef here - let it persist for retries
      }
    };
    
    connectStreaming();
    
    return () => {
      if (streamingConnectedRef.current) {
        console.log('[STREAMING] Disconnecting...');
        streamingVoice.disconnect();
        streamingConnectedRef.current = false;
      }
    };
  }, [conversationId, useStreamingMode, user, language, difficulty, subtitleMode, onLanguageHandoffComplete, isExhausted, onInsufficientCredits]);
  
  // DEBUG: Log mic lockout state changes
  // CRITICAL: Use globalPlaybackState for accurate mic lock timing (avoids stale closure issues)
  useEffect(() => {
    // Include 'streaming' as valid - it means connection is active and audio is flowing
    const connValid = streamingVoice.state.connectionState === 'ready' || 
                      streamingVoice.state.connectionState === 'connected' ||
                      streamingVoice.state.connectionState === 'streaming';
    const isAudioActive = globalPlaybackState === 'playing' || globalPlaybackState === 'buffering';
    const isUsersTurn = connValid &&
      !streamingVoice.state.isSwitchingTutor &&
      (
        // PTT ACTIVE: If user is holding PTT button, keep mic active regardless of audio state
        isPttButtonHeld ||
        // Normal case: not processing and playback is idle (using globalPlaybackState for immediate response)
        (!isProcessing && !streamingVoice.state.isProcessing && !isAudioActive) ||
        (!!streamingVoice.state.error && !streamingVoice.state.isProcessing && globalPlaybackState === 'idle')
      );
    
    console.log(`[MIC LOCKOUT DEBUG] isUsersTurn=${isUsersTurn}`, {
      connectionState: streamingVoice.state.connectionState,
      connValid,
      isSwitchingTutor: streamingVoice.state.isSwitchingTutor,
      isProcessing,
      streamIsProcessing: streamingVoice.state.isProcessing,
      globalPlaybackState,
      hookPlaybackState: streamingVoice.state.playbackState,
      isAudioActive,
      error: !!streamingVoice.state.error,
      isPttButtonHeld,
    });
  }, [isProcessing, streamingVoice.state.connectionState, streamingVoice.state.isProcessing, 
      globalPlaybackState, streamingVoice.state.isSwitchingTutor, streamingVoice.state.error, isPttButtonHeld]);
  
  // UNIVERSAL MIC LOCKOUT FAILSAFE
  // Interval-based watchdog: checks every 5s whether mic has been locked too long.
  // Uses a monotonic "last voice activity" timestamp that only updates on actual pipeline
  // events (processing start, audio chunk, response_complete, playback state changes).
  // If mic is locked and no voice activity for 35s, force-resets ALL three mic-gating states.
  // 35s is intentionally above the observed worst-case brain latency (~23.6s) so the watchdog
  // never fires before the brain has had a chance to respond.
  const lastVoiceActivityRef = useRef<number>(Date.now());
  const MIC_LOCK_MAX_IDLE_MS = 35000;
  
  useEffect(() => {
    lastVoiceActivityRef.current = Date.now();
  }, [globalPlaybackState, streamingVoice.state.isProcessing]);
  
  useEffect(() => {
    if (!useStreamingMode) return;
    
    const watchdogInterval = setInterval(() => {
      const currentPlayback = getGlobalPlaybackState();
      const isAudioActive = currentPlayback === 'playing' || currentPlayback === 'buffering';
      const isMicLocked = isProcessingRef.current || isAudioActive;
      
      if (!isMicLocked) return;
      
      const idleMs = Date.now() - lastVoiceActivityRef.current;
      if (idleMs >= MIC_LOCK_MAX_IDLE_MS) {
        console.warn(`[MIC WATCHDOG] Mic locked with no activity for ${Math.round(idleMs / 1000)}s — force-resetting ALL state`);
        setIsProcessing(false);
        isProcessingRef.current = false;
        setGlobalPlaybackState('idle');
        streamingVoice.forceResetProcessing?.();
        lastVoiceActivityRef.current = Date.now();
      }
    }, 5000);
    
    return () => clearInterval(watchdogInterval);
  }, [useStreamingMode, streamingVoice]);
  
  // Sync streaming voice state with component state
  // CRITICAL: Use globalPlaybackState from the global store, NOT streamingVoice.state.playbackState
  // The hook's internal useState has stale closure issues during HMR - global store is reliable
  useEffect(() => {
    if (!useStreamingMode) return;
    
    const { isProcessing: streamProcessing, error: streamError, connectionState } = streamingVoice.state;
    
    // Update avatar state based on streaming state
    // Only show speaking when audio is ACTUALLY playing (not just processing)
    // Processing state should show a "thinking" indicator, not speaking avatar
    // NOTE: Don't override avatar state if greeting is currently playing (via REST)
    // USING GLOBAL PLAYBACK STATE - reliable source of truth that updates during HMR
    const isStreamingPlaying = globalPlaybackState === 'playing' || globalPlaybackState === 'buffering';
    
    // Debug: Log every time this effect runs with playback state changes
    console.log('[AVATAR SYNC DEBUG - GLOBAL STORE]', {
      globalPlaybackState,
      hookPlaybackState: streamingVoice.state.playbackState,
      isStreamingPlaying,
      avatarState,
      streamProcessing,
      isProcessingRef: isProcessingRef.current,
      currentPlayingMessageId,
      inputMode: inputModeRef.current,
    });
    
    // Check if we're in the middle of greeting playback (non-streaming)
    // If currentPlayingMessageId is set but we're not streaming, a greeting is playing
    const isGreetingPlaying = currentPlayingMessageId && !isStreamingPlaying && avatarState === 'speaking';
    
    if (isGreetingPlaying) {
      // Don't override greeting playback state
      console.log('[AVATAR SYNC DEBUG] Greeting guard triggered - returning early');
      return;
    }
    
    if (isStreamingPlaying) {
      // Audio is actually playing - show speaking state
      console.log('[AVATAR SYNC DEBUG] Setting avatarState to speaking');
      setAvatarState('speaking');
      
      // CRITICAL: Clear currentPlayingMessageId when streaming starts
      // This prevents stale greeting ID from blocking avatar state reset when streaming ends
      if (currentPlayingMessageId) {
        console.log('[AVATAR STATE] Streaming playing - clearing stale currentPlayingMessageId');
        setCurrentPlayingMessageId(null);
      }
      
      // Clear isProcessing now that audio is actually playing
      // This is safe because the avatar state logic prioritizes isStreamingPlaying over isProcessing
      // We NEED to clear it here so that when audio finishes, the avatar doesn't briefly
      // show "thinking" (which would happen if isProcessing was still true when playback ends)
      if (isProcessingRef.current) {
        console.log('[AVATAR SYNC] Audio playing - clearing deferred isProcessing');
        setIsProcessing(false);
        isProcessingRef.current = false;
      }
      if (isAwaitingResponseRef.current) {
        console.log('[AVATAR SYNC] Audio playing - clearing isAwaitingResponse');
        isAwaitingResponseRef.current = false;
      }
      
      // Mark that Daniela has spoken at least once this session
      hasDanielaSpokeOnceRef.current = true;
      // Stop ringing when audio starts playing (Daniela "picks up")
      stopRinging();
      // SAFETY: Clear processing timeout since response arrived
      if (openMicProcessingTimeoutRef.current) {
        clearTimeout(openMicProcessingTimeoutRef.current);
        openMicProcessingTimeoutRef.current = null;
      }
      // TRUE DUPLEX: Keep green light ON while Daniela speaks
      // Don't check openMicActiveRef - just show green if we're in open-mic mode
      if (inputModeRef.current === 'open-mic' && openMicState !== 'ready') {
        console.log('[OPEN MIC DUPLEX] Daniela speaking - showing green light (duplex mode)');
        setOpenMicState('ready');
      }
    } else if (!streamProcessing && !isProcessingRef.current && !isAwaitingResponseRef.current) {
      // Not processing (hook) AND not processing (component) AND not awaiting response AND not playing
      // The isAwaitingResponseRef guard prevents the "thinking→listening→speaking" blip:
      // Without it, when streamProcessing clears but audio hasn't started yet, the avatar
      // briefly drops to "listening" before audio chunks arrive and push it to "speaking"
      
      // OPEN MIC: Show listening immediately when Daniela finishes speaking
      // CRITICAL: Only do this if Daniela has actually spoken at least once (prevents premature green light)
      if (inputModeRef.current === 'open-mic' && hasDanielaSpokeOnceRef.current) {
        console.log('[OPEN MIC] Playback finished - transitioning to listening');
        
        // IMMEDIATELY show listening state - don't wait for ref checks
        // This fixes the delay where avatar stays in idle/speaking for 4-10 seconds
        setOpenMicState('ready');
        setAvatarState('listening');
        
        // If session isn't active yet (rare race condition), start it
        if (!isRecordingRef.current || !openMicActiveRef.current) {
          console.log('[OPEN MIC] Session not fully active - ensuring it starts');
          if (startOpenMicRecordingRef.current) {
            startOpenMicRecordingRef.current().catch((err: any) => {
              console.error('[OPEN MIC] Failed to ensure session after playback:', err);
            });
          }
        }
      } else {
        // Not in open mic mode or Daniela hasn't spoken yet - go to idle
        setAvatarState('idle');
      }
    }
    // Note: When streamProcessing is true but not playing yet, 
    // avatar stays in current state (idle/listening) until audio actually starts
    
    // Handle streaming errors - only reset processing on CONNECTION-level errors
    // Non-fatal audio playback errors (e.g. "Failed to load because no supported source was found"
    // from 0-byte end-marker audio chunks) should NOT clear isProcessing or avatar state
    if (streamError) {
      const isConnectionError = connectionState === 'error' || connectionState === 'disconnected';
      
      if (isConnectionError) {
        console.error('[STREAMING] Connection error:', streamError);
        if (isProcessingRef.current) {
          setIsProcessing(false);
          isProcessingRef.current = false;
          setProcessingStage(null);
        }
        setAvatarState('idle');
        setError(streamError);
        streamingConnectedRef.current = false;
        if (isLanguageHandoffRef.current) {
          console.log('[STREAMING] Error during language handoff - resetting flag');
          isLanguageHandoffRef.current = false;
        }
      } else {
        console.warn('[STREAMING] Non-fatal error (not clearing processing state):', streamError);
      }
    }
    
    // Handle disconnects during handoff
    if (connectionState === 'disconnected' && isLanguageHandoffRef.current) {
      console.log('[STREAMING] Disconnected during language handoff - resetting flag');
      isLanguageHandoffRef.current = false;
    }
    
    // Clear error when connection recovers
    if (connectionState === 'connected' && streamingConnectedRef.current === false) {
      streamingConnectedRef.current = true;
      setError(null);
    }
  }, [streamingVoice.state, useStreamingMode, globalPlaybackState]);
  
  // Update lastMessageId for replay when streaming completes and messages are refreshed
  useEffect(() => {
    // When we have a lastAudioBlob but no lastMessageId, find the latest assistant message
    if (lastAudioBlob && !lastMessageId && messages.length > 0) {
      const latestAssistantMessage = [...messages]
        .reverse()
        .find(m => m.role === 'assistant');
      if (latestAssistantMessage) {
        console.log('[STREAMING] Setting lastMessageId for replay:', latestAssistantMessage.id);
        setLastMessageId(latestAssistantMessage.id);
      }
    }
  }, [lastAudioBlob, lastMessageId, messages]);

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new Audio();
    return () => {
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = null;
    };
  }, []);
  
  // Pre-warm Deepgram and TTS connections to avoid cold-start latency
  useEffect(() => {
    const warmServices = async () => {
      // Warm both services in parallel for faster startup
      const warmDeepgram = fetch('/api/voice/warm', {
        method: 'POST',
        credentials: 'include',
      }).then(res => res.json()).then(data => {
        if (data.warmed) {
          console.log(`[VOICE] Deepgram pre-warmed in ${data.latency}ms`);
        }
      }).catch(() => {
        console.log('[VOICE] Deepgram pre-warming skipped');
      });
      
      const warmTts = fetch('/api/voice/warm-tts', {
        method: 'POST',
        credentials: 'include',
      }).then(res => res.json()).then(data => {
        if (data.warmed) {
          console.log(`[VOICE] TTS pre-warmed in ${data.latency}ms`);
        }
      }).catch(() => {
        console.log('[VOICE] TTS pre-warming skipped');
      });
      
      await Promise.all([warmDeepgram, warmTts]);
    };
    warmServices();
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const client = getStreamingVoiceClient();
    client.warmUp(conversationId);
  }, [conversationId]);

  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      console.log('[CLEANUP] Cleaning up voice recording resources...');
      cleanupRecording();
    };
  }, [conversationId]);

  // Note: Auto-scroll is handled by VoiceChatViewManager which renders the message list

  // Process streaming text through whiteboard to extract markup
  // The tutor may include [WRITE]...[/WRITE] tags for visual teaching aids
  useEffect(() => {
    if (!useStreamingMode) return;
    
    const currentText = streamingVoice.subtitles.state.currentSentenceText;
    if (currentText) {
      whiteboard.processMessage(currentText);
    }
  }, [useStreamingMode, streamingVoice.subtitles.state.currentSentenceText]);
  
  // Clear whiteboard when conversation changes
  useEffect(() => {
    whiteboard.clear();
  }, [conversationId]);

  // Request AI-generated streaming greeting for new conversations
  // When streaming mode is enabled, we use the streaming pipeline for dynamic greetings
  // that are ACTFL-aware, personalized, and context-aware
  // Store the full lockKey (including -resumed suffix) to prevent duplicate triggers
  // Initialize from sessionStorage to survive HMR/remounts
  const getStoredGreetingKey = (): string | null => {
    try {
      return sessionStorage.getItem(GREETING_MESSAGE_KEY);
    } catch {
      return null;
    }
  };
  const greetingRequestedRef = useRef<string | null>(getStoredGreetingKey());
  
  // Handle resume flag clearing even if connection isn't ready - prevents re-triggering
  useEffect(() => {
    if (isResumedConversation && conversationId && onResumeHandled) {
      // Clear resume flag immediately when we detect a resume attempt
      // This prevents duplicate welcome-back greetings on component remounts
      const lockKey = `streaming-greeting-${conversationId}-resumed`;
      if (greetingRequestedRef.current === lockKey) {
        console.log('[STREAMING GREETING] Resume already handled for this conversation');
        onResumeHandled();
      }
    }
  }, [isResumedConversation, conversationId, onResumeHandled]);
  
  useEffect(() => {
    // Only for streaming mode
    if (!useStreamingMode) return;
    
    // Wait for streaming connection to be ready
    const { connectionState } = streamingVoice.state;
    if (connectionState !== 'ready') return;
    
    // Need conversation and user data
    if (!conversationId || !userDetails) return;
    
    // Don't request if recording or processing
    if (isRecording || isProcessing) return;
    
    // CRITICAL: Skip greeting on reconnected sessions to prevent double audio streams
    // When WebSocket reconnects, the session is re-initialized but we don't want a new greeting
    const client = getStreamingVoiceClient();
    if (client.isReconnectedSession) {
      console.log('[STREAMING GREETING] Skipping — this is a reconnected session (prevents double audio)');
      return;
    }
    
    // Check if this is a new conversation (no messages yet, or only AI greeting placeholder)
    const aiMessages = messages.filter(m => m.role === 'assistant');
    const userMessages = messages.filter(m => m.role === 'user');
    
    // Request greeting if: new conversation (no user messages) OR resuming a past conversation
    const isNewConversation = userMessages.length === 0 && aiMessages.length <= 1;
    const shouldGreet = isNewConversation || isResumedConversation;
    
    if (shouldGreet) {
      // ATOMICALLY try to acquire lock (using full lock key including -resumed suffix)
      // This prevents double-greetings on mobile reloads and fast switching
      const lockKey = `streaming-greeting-${conversationId}${isResumedConversation ? '-resumed' : ''}`;
      
      // Check if we already requested greeting for this exact lockKey (handles both new and resumed)
      if (greetingRequestedRef.current === lockKey) {
        console.log('[STREAMING GREETING] Already requested for this lock key:', lockKey);
        return;
      }
      
      // Try to acquire the lock
      if (!tryAcquireGreetingLock(lockKey)) {
        console.log('[STREAMING GREETING] Lock not acquired - skipping');
        // Still clear resume flag to prevent retry loops
        if (isResumedConversation && onResumeHandled) {
          onResumeHandled();
        }
        return;
      }
      
      // Mark as requested using full lockKey to distinguish new vs resumed
      greetingRequestedRef.current = lockKey;
      hasPlayedGreetingRef.current = lockKey;
      
      const greetingType = isResumedConversation ? 'RESUMED (welcome-back)' : 'NEW conversation';
      console.log(`[STREAMING GREETING] Requesting ${greetingType} AI-generated personalized greeting...`);
      
      // Request greeting through the streaming pipeline
      // The server will generate an ACTFL-aware, history-aware greeting
      // For resumed conversations, it will generate a contextual "welcome back" message
      streamingVoice.requestGreeting(userDetails.firstName ?? undefined, isResumedConversation);
      
      // Mark resume as handled so we don't keep triggering it
      if (isResumedConversation && onResumeHandled) {
        onResumeHandled();
      }
      
      // Clear lock after a delay to allow for the greeting to play
      setTimeout(() => {
        clearGreetingLock();
      }, 5000);
    }
  }, [
    useStreamingMode, 
    streamingVoice.state.connectionState, 
    conversationId, 
    userDetails, 
    messages, 
    isRecording, 
    isProcessing, 
    streamingVoice,
    isResumedConversation,
    onResumeHandled
  ]);
  
  // Fallback: REST-based greeting for non-streaming mode only
  useEffect(() => {
    // Skip if streaming mode is enabled (streaming handles greeting)
    if (useStreamingMode) return;
    
    // Only process if we have messages and conversation ID
    if (!conversationId || !messages || messages.length === 0) return;
    
    // Don't play greeting if already recording or processing
    if (isRecording || isProcessing) return;
    
    // Check if this is a new conversation with just a greeting (1 AI message, no user messages)
    const aiMessages = messages.filter(m => m.role === 'assistant');
    const userMessages = messages.filter(m => m.role === 'user');
    
    if (aiMessages.length === 1 && userMessages.length === 0) {
      const greetingMessage = aiMessages[0];
      const greetingConversationId = conversationId; // Capture for closure
      
      // ATOMICALLY try to acquire lock - this checks:
      // 1. If we already synthesized this exact message ID (module-level + sessionStorage)
      // 2. If another synthesis is in progress (sync lock)
      // 3. If cooldown is active (30 second timer)
      if (!tryAcquireGreetingLock(greetingMessage.id)) {
        console.log('[VOICE GREETING] Skipping - lock not acquired');
        return;
      }
      
      // Also mark in ref for same-instance checks
      hasPlayedGreetingRef.current = greetingMessage.id;
      
      // Generate TTS for the greeting (but don't change state yet)
      // KARAOKE ENABLED: Cartesia Sonic-3 provides estimated word timings for highlighting
      const needTimings = subtitleMode !== "off";
      console.log(`[VOICE GREETING] Generating greeting audio for new conversation (karaoke: ${needTimings})`);
      
      // Use target language voice for consistency (Spanish voice speaks English = Spanish accent)
      // This gives immersive learning experience from the very first word
      // Use friendly emotion for warm greeting (no AI-selected emotion available for initial greeting)
      synthesizeSpeech(greetingMessage.content, language, undefined, undefined, needTimings, 'friendly')
        .then(result => {
          const audioBlob = result.audioBlob;
          // Use refs to check current state (not stale closure values)
          // Don't play if:
          // 1. User started recording or processing
          // 2. Conversation changed
          if (isRecordingRef.current || isProcessingRef.current) {
            console.log('[VOICE GREETING] Skipping playback - user is now recording/processing');
            return;
          }
          
          if (currentConversationRef.current !== greetingConversationId) {
            console.log('[VOICE GREETING] Skipping playback - conversation changed');
            return;
          }
          
          if (audioPlayerRef.current) {
            // CRITICAL: Stop any existing audio playback first
            // This prevents two voices playing simultaneously
            audioPlayerRef.current.pause();
            audioPlayerRef.current.currentTime = 0;
            
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayerRef.current.src = audioUrl;
            
            // Rescale word timings to match actual audio duration for precise karaoke sync
            audioPlayerRef.current.onloadedmetadata = () => {
              if (result.wordTimings && result.wordTimings.length > 0 && audioPlayerRef.current) {
                const actualDuration = audioPlayerRef.current.duration;
                const estimatedDuration = result.wordTimings[result.wordTimings.length - 1].endTime;
                
                if (actualDuration && estimatedDuration && Math.abs(actualDuration - estimatedDuration) > 0.1) {
                  const scale = actualDuration / estimatedDuration;
                  const rescaledTimings = result.wordTimings.map(timing => ({
                    word: timing.word,
                    startTime: timing.startTime * scale,
                    endTime: Math.min(timing.endTime * scale, actualDuration),
                  }));
                  wordTimingsMapRef.current.set(greetingMessage.id, rescaledTimings);
                  console.log(`[VOICE GREETING] Rescaled timings: ${estimatedDuration.toFixed(2)}s → ${actualDuration.toFixed(2)}s`);
                } else if (subtitleMode !== "off") {
                  wordTimingsMapRef.current.set(greetingMessage.id, result.wordTimings);
                  console.log('[VOICE GREETING] Stored word timings:', greetingMessage.id, result.wordTimings.length, 'words');
                }
              }
            };
            
            // Track if we've already cleaned up (to prevent double cleanup)
            let hasCleanedUp = false;
            let fallbackTimer: NodeJS.Timeout | null = null;
            
            const cleanup = () => {
              if (hasCleanedUp) return;
              hasCleanedUp = true;
              if (fallbackTimer) clearTimeout(fallbackTimer);
              URL.revokeObjectURL(audioUrl);
              setAvatarState('idle');
              setCurrentPlayingMessageId(null);
              clearGreetingLock();
              console.log('[VOICE GREETING] Cleaned up and returned to idle');
            };
            
            audioPlayerRef.current.onended = cleanup;
            audioPlayerRef.current.onerror = cleanup;
            
            // Use 'onplaying' event to set avatar state - fires when audio ACTUALLY starts
            // This is more accurate than setting state before play() call
            audioPlayerRef.current.onplaying = () => {
              console.log('[VOICE GREETING] Audio actually started - setting avatar to speaking');
              setAvatarState('speaking');
            };
            
            // Set current playing message ID (for subtitle sync) but NOT avatar state yet
            setCurrentPlayingMessageId(greetingMessage.id);
            
            audioPlayerRef.current.play()
              .then(() => {
                console.log('[VOICE GREETING] Greeting audio playing');
                // MOBILE FIX: Add fallback timer in case onended doesn't fire
                // Estimate duration from audio blob size (roughly 16KB/second for MP3)
                const estimatedDurationMs = Math.max(5000, (audioBlob.size / 16) + 2000);
                fallbackTimer = setTimeout(() => {
                  if (!hasCleanedUp) {
                    console.log('[VOICE GREETING] Fallback timer triggered - resetting avatar state');
                    cleanup();
                  }
                }, estimatedDurationMs);
              })
              .catch(err => {
                console.error('[VOICE GREETING] Failed to play greeting:', err);
                cleanup();
              });
          }
        })
        .catch(err => {
          console.error('[VOICE GREETING] Failed to generate greeting audio:', err);
          clearGreetingLock(); // Clear lock on synthesis failure
        });
    }
  }, [useStreamingMode, messages, conversationId, language, isProcessing, isRecording, subtitleMode]);

  // Enter key keyboard shortcut for mic button (hold to talk)
  // Using refs to avoid cleanup-triggered premature stops during React re-renders
  const recordingStartTimeRef = useRef<number | null>(null);
  const isKeyboardHeldRef = useRef(false); // Track if Enter key is physically held
  const MIN_RECORDING_DURATION_MS = 500; // Minimum 500ms to avoid empty recordings
  
  // Keep existing refs in sync with state for stable keyboard handlers
  // (refs are already declared earlier in the component)
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { inputModeRef.current = inputMode; }, [inputMode]);
  useEffect(() => { isPlayingRef.current = avatarState === 'speaking'; }, [avatarState]);
  
  // Track playbackState for guards - 'buffering' happens before 'playing'
  // This catches speculative PTT audio earlier than avatarState
  // CRITICAL: Use globalPlaybackState for reliability during HMR
  const playbackStateRef = useRef<string>('idle');
  useEffect(() => { 
    console.log('[STREAMING VOICE CHAT DEBUG] playbackState changed:', globalPlaybackState);
    playbackStateRef.current = globalPlaybackState; 
  }, [globalPlaybackState]);
  
  // Stable keyboard handlers that use refs instead of state (no dependency churn)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only enable in push-to-talk mode
      if (inputModeRef.current !== 'push-to-talk') return;
      
      // Only trigger if Enter is pressed
      if (event.code !== 'Enter') return;
      
      // Ignore key repeat events (holding Enter)
      if (event.repeat) return;
      
      // Don't trigger if user is typing in any text input element
      const target = event.target as HTMLElement;
      const activeElement = document.activeElement as HTMLElement;
      
      const isTextInput = (el: HTMLElement | null) => {
        if (!el) return false;
        const tagName = el.tagName?.toUpperCase();
        return (
          tagName === 'INPUT' || 
          tagName === 'TEXTAREA' || 
          el.isContentEditable ||
          el.getAttribute('role') === 'textbox' ||
          el.closest('[contenteditable="true"]') !== null ||
          el.closest('input, textarea, [role="textbox"]') !== null
        );
      };
      
      if (isTextInput(target) || isTextInput(activeElement)) return;
      
      // Don't trigger if no conversation or processing
      if (!currentConversationRef.current || isProcessingRef.current) return;
      
      // BARGE-IN: If audio is playing, interrupt AND start recording in one keypress
      if (playbackStateRef.current !== 'idle') {
        console.log(`[KEYBOARD] Barge-in: interrupt + record - playbackState='${playbackStateRef.current}'`);
        streamingVoice.stop();
        streamingVoice.sendInterrupt();
      }
      
      // Prevent default behavior
      event.preventDefault();
      
      // Mark keyboard as held BEFORE starting recording
      isKeyboardHeldRef.current = true;
      
      // Start recording on keydown (if not already recording)
      if (!isRecordingRef.current) {
        console.log('[KEYBOARD] Enter pressed - starting recording, isKeyboardHeld=true');
        recordingStartTimeRef.current = Date.now();
        startPushToTalkRecording('keyboard');
      }
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      // Only trigger if Enter is released
      if (event.code !== 'Enter') return;
      
      // CRITICAL: Only process if keyboard was actually being held by us
      if (!isKeyboardHeldRef.current) {
        console.log('[KEYBOARD] Enter keyup ignored - keyboard was not held by PTT');
        return;
      }
      
      // Don't trigger if user is typing in any text input element
      const target = event.target as HTMLElement;
      const activeElement = document.activeElement as HTMLElement;
      
      const isTextInput = (el: HTMLElement | null) => {
        if (!el) return false;
        const tagName = el.tagName?.toUpperCase();
        return (
          tagName === 'INPUT' || 
          tagName === 'TEXTAREA' || 
          el.isContentEditable ||
          el.getAttribute('role') === 'textbox' ||
          el.closest('[contenteditable="true"]') !== null ||
          el.closest('input, textarea, [role="textbox"]') !== null
        );
      };
      
      if (isTextInput(target) || isTextInput(activeElement)) return;
      
      // ALWAYS stop recording on keyup - the guard is on keydown not keyup
      // We want to let the user release normally even during speculative PTT
      
      // Mark keyboard as released
      isKeyboardHeldRef.current = false;
      
      // Stop recording on keyup (if recording)
      if (isRecordingRef.current || isPttButtonHeldRef.current) {
        const recordingDuration = recordingStartTimeRef.current 
          ? Date.now() - recordingStartTimeRef.current 
          : 0;
        
        // Ensure minimum recording time to avoid empty recordings
        if (recordingDuration < MIN_RECORDING_DURATION_MS) {
          const remainingTime = MIN_RECORDING_DURATION_MS - recordingDuration;
          console.log(`[KEYBOARD] Recording too short (${recordingDuration}ms), waiting ${remainingTime}ms`);
          setTimeout(() => {
            console.log('[KEYBOARD] Enter released - stopping recording (delayed)');
            recordingStartTimeRef.current = null;
            stopPushToTalkRecording('keyboard');
          }, remainingTime);
        } else {
          console.log('[KEYBOARD] Enter released - stopping recording');
          recordingStartTimeRef.current = null;
          stopPushToTalkRecording('keyboard');
        }
      }
    };

    // Add stable event listeners (empty dependency array - never re-attached)
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Cleanup only on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // Empty deps - handlers use refs, not state

  const cleanupRecording = () => {
    console.log('[CLEANUP] Cleaning up recording resources...');
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clean up silence detection
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    
    setIsRecording(false);
    isRecordingRef.current = false; // Update ref immediately
  };

  const setupSilenceDetection = (stream: MediaStream) => {
    try {
      // Create audio context and analyser
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Thresholds
      const SILENCE_THRESHOLD = 10; // Volume below this is considered silence (0-255 scale)
      const SILENCE_DURATION = 2000; // 2 seconds of silence triggers auto-stop
      
      let silenceStartTime: number | null = null;
      
      // Check audio level every 100ms
      silenceCheckIntervalRef.current = setInterval(() => {
        if (!isRecordingRef.current) {
          // Stopped recording externally, cleanup
          if (silenceCheckIntervalRef.current) {
            clearInterval(silenceCheckIntervalRef.current);
            silenceCheckIntervalRef.current = null;
          }
          return;
        }
        
        analyser.getByteTimeDomainData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const value = Math.abs(dataArray[i] - 128); // Center around 0
          sum += value;
        }
        const average = sum / bufferLength;
        
        // Check if silent
        if (average < SILENCE_THRESHOLD) {
          if (silenceStartTime === null) {
            silenceStartTime = Date.now();
            console.log('[SILENCE DETECTION] Silence started');
          } else {
            const silenceDuration = Date.now() - silenceStartTime;
            if (silenceDuration >= SILENCE_DURATION) {
              console.log('[SILENCE DETECTION] 2 seconds of silence detected - auto-stopping');
              stopRecording();
            }
          }
        } else {
          // Reset silence timer if sound detected
          if (silenceStartTime !== null) {
            console.log('[SILENCE DETECTION] Sound detected - resetting silence timer');
          }
          silenceStartTime = null;
        }
      }, 100); // Check every 100ms
      
    } catch (err) {
      console.error('[SILENCE DETECTION] Failed to setup:', err);
      // Continue recording without silence detection
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    
    // Block recording if credits are exhausted
    if (isExhausted) {
      console.log('[RECORDING] Blocked - credits exhausted');
      if (onInsufficientCredits) {
        onInsufficientCredits();
      }
      return;
    }
    
    try {
      setError(null);
      
      
      // Capture conversation ID for this session
      const recordingConversationId = conversationId;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Determine best available audio codec for MediaRecorder
      // Try opus first (best for speech), fallback to vorbis, then generic webm
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=vorbis')) {
        mimeType = 'audio/webm;codecs=vorbis';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }
      console.log('[RECORDING] Using audio codec:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });
      
      // Isolated state for this recording session
      const recordingChunks: Blob[] = [];
      const sessionStream = stream; // Capture in closure
      const sessionRecorder = mediaRecorder; // Capture in closure
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('[RECORDER] Stopped, processing audio...');
        
        // Check if this is still the active session
        const isActiveSession = mediaRecorderRef.current === sessionRecorder;
        
        // Session-safe cleanup: only touch resources that belong to THIS session
        sessionStream.getTracks().forEach(track => track.stop());
        
        // Clean up silence detection resources IMMEDIATELY after stop
        if (silenceCheckIntervalRef.current) {
          clearInterval(silenceCheckIntervalRef.current);
          silenceCheckIntervalRef.current = null;
          console.log('[CLEANUP] Cleared silence detection interval');
        }
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
          console.log('[CLEANUP] Closed AudioContext');
        }
        
        analyserRef.current = null;
        
        // Only touch shared state if this is still the active session
        if (isActiveSession) {
          mediaRecorderRef.current = null;
          streamRef.current = null;
          setIsRecording(false);
          isRecordingRef.current = false; // Update ref immediately
          // DON'T set avatarState to 'idle' here - let processRecording manage it
          // This prevents flickering between listening → idle → speaking
          
        } else {
          console.log('[RECORDER] Session superseded - new recording already started');
        }
        
        // Build audio blob from this session's chunks
        const audioBlob = new Blob(recordingChunks, { type: 'audio/webm' });
        
        // Check if conversation changed by comparing to current ref value
        const currentConv = currentConversationRef.current;
        
        if (recordingConversationId === currentConv && recordingConversationId && isActiveSession) {
          console.log('[RECORDER] Processing audio for conversation:', recordingConversationId);
          await processRecording(audioBlob, recordingConversationId);
        } else {
          console.log('[RECORDER] Discarding audio - conversation changed or session superseded');
          // Only set idle when discarding - processRecording handles its own state
          setAvatarState('idle');
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true; // Update ref immediately
      setAvatarState('listening');
      
      // Start silence detection for auto-stop
      console.log('[VOICE] Starting silence detection');
      setupSilenceDetection(stream);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'Failed to access microphone');
      cleanupRecording();
    }
  };

  const stopRecording = () => {
    console.log('[STOP] Stopping recording...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Note: actual cleanup happens in onstop handler
    } else {
      // If recorder already inactive, cleanup manually
      cleanupRecording();
    }
  };

  // Push-to-talk mode: Hold down to record, release to stop
  const startPushToTalkRecording = async (inputType: 'mouse' | 'touch' | 'keyboard' = 'mouse') => {
    const startTime = performance.now();
    console.log('[PUSH-TO-TALK] Button pressed at', startTime.toFixed(0), 'ms, inputType:', inputType);
    
    if (isRecording || isMicPreparing) {
      console.log('[PUSH-TO-TALK] Already recording or preparing, ignoring');
      return;
    }
    
    try {
      setError(null);
      
      // Track that button is being held (for stable instruction text)
      // Use both state (for UI) and ref (for synchronous guards)
      console.log('[PTT-STATE-DEBUG] Setting isPttButtonHeld=TRUE at', new Date().toISOString());
      setIsPttButtonHeld(true);
      isPttButtonHeldRef.current = true;
      activeInputTypeRef.current = inputType;
      
      // Mark that recording was requested - for race condition prevention
      recordingRequestedRef.current = true;
      
      // Capture conversation ID for this session
      const recordingConversationId = conversationId;
      
      let stream: MediaStream;
      
      // Use cached stream for INSTANT recording if available
      // Must verify: stream active AND at least one audio track is live and enabled
      const cachedStream = cachedStreamRef.current;
      const audioTracks = cachedStream?.getAudioTracks() || [];
      const hasLiveTrack = audioTracks.some(track => 
        track.readyState === 'live' && track.enabled && !track.muted
      );
      
      console.log('[PUSH-TO-TALK] Cached stream status:', {
        exists: !!cachedStream,
        active: cachedStream?.active,
        trackCount: audioTracks.length,
        trackStates: audioTracks.map(t => ({ readyState: t.readyState, enabled: t.enabled, muted: t.muted })),
        hasLiveTrack
      });
      
      if (cachedStream && cachedStream.active && hasLiveTrack) {
        console.log('[PUSH-TO-TALK] Using cached stream - INSTANT start! (+' + (performance.now() - startTime).toFixed(0) + 'ms)');
        stream = cachedStream;
        cachedStreamRef.current = null; // Will re-warm after recording
        // No preparing state needed - jump straight to recording!
      } else {
        // Cached stream unusable - dispose of it if exists
        if (cachedStream) {
          console.log('[PUSH-TO-TALK] Cached stream unusable, disposing...');
          cachedStream.getTracks().forEach(track => track.stop());
          cachedStreamRef.current = null;
        }
        // No cached stream - show preparing state and request new one
        console.log('[PUSH-TO-TALK] No cached stream, requesting microphone... (+' + (performance.now() - startTime).toFixed(0) + 'ms)');
        setIsMicPreparing(true);
        
        const micStartTime = performance.now();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[PUSH-TO-TALK] getUserMedia completed in', (performance.now() - micStartTime).toFixed(0), 'ms');
        
        // Check if user released the button while we were waiting for microphone
        if (!recordingRequestedRef.current) {
          console.log('[PUSH-TO-TALK] Button released before mic ready - aborting');
          stream.getTracks().forEach(track => track.stop());
          setIsMicPreparing(false);
          return;
        }
        
        setIsMicPreparing(false);
      }
      
      streamRef.current = stream;
      
      // DIAGNOSTIC: Log audio track capabilities and settings
      const tracks = stream.getAudioTracks();
      console.log('[PTT DIAGNOSTIC] Audio tracks:', tracks.length);
      tracks.forEach((track, i) => {
        const settings = track.getSettings();
        const constraints = track.getConstraints();
        const capabilities = track.getCapabilities ? track.getCapabilities() : 'N/A';
        console.log(`[PTT DIAGNOSTIC] Track ${i} settings:`, settings);
        console.log(`[PTT DIAGNOSTIC] Track ${i} constraints:`, constraints);
        console.log(`[PTT DIAGNOSTIC] Track ${i} capabilities:`, capabilities);
        console.log(`[PTT DIAGNOSTIC] Track ${i} state:`, {
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted,
          label: track.label,
          id: track.id,
        });
      });
      
      // Determine best available audio codec for MediaRecorder
      // Try opus first (best for speech), fallback to vorbis, then generic webm
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=vorbis')) {
        mimeType = 'audio/webm;codecs=vorbis';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }
      console.log('[RECORDING] Using audio codec:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });
      
      // DIAGNOSTIC: Log MediaRecorder state
      console.log('[PTT DIAGNOSTIC] MediaRecorder created:', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state,
        audioBitsPerSecond: mediaRecorder.audioBitsPerSecond,
      });
      
      // Isolated state for this recording session
      const recordingChunks: Blob[] = [];
      const sessionStream = stream; // Capture in closure
      const sessionRecorder = mediaRecorder; // Capture in closure
      let chunkCount = 0; // DIAGNOSTIC: Track chunk count
      
      mediaRecorder.ondataavailable = (event) => {
        chunkCount++;
        console.log(`[PTT DIAGNOSTIC] ondataavailable #${chunkCount}: size=${event.data.size} bytes, type=${event.data.type}`);
        if (event.data.size > 0) {
          recordingChunks.push(event.data);
        } else {
          console.warn('[PTT DIAGNOSTIC] WARNING: Received empty chunk!');
        }
      };
      
      mediaRecorder.onstop = async () => {
        // DIAGNOSTIC: Log final chunk stats
        const totalChunkBytes = recordingChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        const trackStatesOnStop = sessionStream.getAudioTracks().map(t => ({
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted,
        }));
        console.log('[PTT DIAGNOSTIC] Recording stopped:', {
          chunkCount,
          totalChunkBytes,
          trackStatesOnStop,
          recorderState: sessionRecorder.state,
        });
        
        console.log('[PUSH-TO-TALK] Stopped, processing audio...');
        
        // IMMEDIATELY reset subtitles to prevent phantom subtitle flash
        // This must happen FIRST, before any other state changes
        // The ref-based isWaitingForContent flag ensures subtitles hide synchronously
        if (streamingConnectedRef.current) {
          console.log('[PUSH-TO-TALK] Resetting subtitles immediately');
          streamingVoice.subtitles.reset();
        }
        
        // Check if this is still the active session
        const isActiveSession = mediaRecorderRef.current === sessionRecorder;
        
        // Session-safe cleanup: only touch resources that belong to THIS session
        sessionStream.getTracks().forEach(track => track.stop());
        
        // Only touch shared state if this is still the active session
        if (isActiveSession) {
          mediaRecorderRef.current = null;
          streamRef.current = null;
          // CRITICAL: Set both isRecording=false AND isProcessing=true in the SAME sync batch
          // This prevents a render gap where neither guard is active (causing phantom subtitles)
          // The phantom appears as black text when isRecording=false but isProcessing hasn't been set yet
          setIsRecording(false);
          setIsProcessing(true); // Set immediately - no gap between recording and processing
          isRecordingRef.current = false;
          isProcessingRef.current = true; // Update ref immediately for sync checks
          // DON'T set avatarState to 'idle' here - let processRecording manage it
          // This prevents flickering between listening → idle → speaking
          
        } else {
          console.log('[PUSH-TO-TALK] Session superseded - new recording already started');
        }
        
        // Re-warm microphone for next instant recording (don't await - do in background)
        if (!cachedStreamRef.current) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(newStream => {
              cachedStreamRef.current = newStream;
              console.log('[MIC WARMUP] Re-warmed for next recording');
            })
            .catch(err => {
              console.log('[MIC WARMUP] Failed to re-warm:', err);
            });
        }
        
        // Build audio blob from this session's chunks
        const audioBlob = new Blob(recordingChunks, { type: 'audio/webm' });
        
        // DIAGNOSTIC: Log final blob details
        console.log('[PTT DIAGNOSTIC] Final blob:', {
          size: audioBlob.size,
          type: audioBlob.type,
          chunksUsed: recordingChunks.length,
        });
        
        // Check if conversation changed by comparing to current ref value
        const currentConv = currentConversationRef.current;
        
        // CRITICAL FIX: Skip audio blob processing if ptt_release was already sent
        // This prevents double AI response (one from transcript, one from audio blob)
        if (pttReleaseSentRef.current) {
          console.log('[PUSH-TO-TALK] SKIP audio blob - ptt_release already sent transcript to server');
          pttReleaseSentRef.current = false; // Reset for next turn
          // DON'T reset isProcessing here - let onResponseComplete handle it
          // This ensures the "thinking" animation shows while waiting for AI response
          // The server will send sentence_ready/audio_chunk which triggers playback,
          // and onResponseComplete will reset isProcessing when the response is done
          console.log('[PUSH-TO-TALK] Keeping isProcessing=true for thinking animation');
          return;
        }
        
        if (recordingConversationId === currentConv && recordingConversationId && isActiveSession) {
          console.log('[PUSH-TO-TALK] Processing audio for conversation:', recordingConversationId);
          await processRecording(audioBlob, recordingConversationId);
        } else {
          console.log('[PUSH-TO-TALK] Discarding audio - conversation changed or session superseded');
          // Only set idle when discarding - processRecording handles its own state
          setAvatarState('idle');
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      // Notify server that user is actively recording (prevents idle timeout)
      // This is important because push-to-talk doesn't send audio until release
      streamingVoice.sendUserActivity();
      
      // SPECULATIVE PTT: Also set up real-time PCM streaming for faster response
      // This streams audio to Deepgram in parallel with MediaRecorder
      // Server will use the interim transcript to prepare AI response
      try {
        const pttAudioContext = new AudioContext({ sampleRate: 16000 });
        pttStreamingAudioContextRef.current = pttAudioContext;
        
        const actualSampleRate = pttAudioContext.sampleRate;
        const targetSampleRate = 16000;
        const needsResampling = actualSampleRate !== targetSampleRate;
        
        console.log(`[SpeculativePTT] AudioContext sample rate: ${actualSampleRate}Hz (target: ${targetSampleRate}Hz, resampling: ${needsResampling})`);
        
        const source = pttAudioContext.createMediaStreamSource(stream);
        const processor = pttAudioContext.createScriptProcessor(4096, 1, 1);
        pttStreamingProcessorRef.current = processor;
        pttStreamingActiveRef.current = true;
        pttStreamingSequenceIdRef.current = 0;
        pttInterimTranscriptRef.current = '';
        pttReleaseSentRef.current = false; // Reset for new PTT session
        
        processor.onaudioprocess = (event) => {
          if (!pttStreamingActiveRef.current) return;
          
          let inputBuffer = event.inputBuffer.getChannelData(0);
          
          // Resample to 16kHz if needed
          if (needsResampling) {
            inputBuffer = resampleAudio(inputBuffer, actualSampleRate, targetSampleRate);
          }
          
          // Convert Float32Array to Int16Array (linear16 PCM)
          const pcm16 = new Int16Array(inputBuffer.length);
          for (let i = 0; i < inputBuffer.length; i++) {
            const s = Math.max(-1, Math.min(1, inputBuffer[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          const sequenceId = pttStreamingSequenceIdRef.current++;
          streamingVoice.sendStreamingChunk(pcm16.buffer, sequenceId);
        };
        
        source.connect(processor);
        processor.connect(pttAudioContext.destination);
        
        console.log('[SpeculativePTT] Real-time streaming started');
      } catch (pttErr) {
        console.warn('[SpeculativePTT] Failed to set up streaming (fallback to normal PTT):', pttErr);
        // Continue without streaming - normal PTT will still work
      }
      
      // PHASE 2: Mic is ready - transition to actual recording state
      // NOW the user can start speaking (they'll see "Release to send")
      setIsMicPreparing(false);
      setIsRecording(true);
      isRecordingRef.current = true;
      setAvatarState('listening');
      
      console.log('[PUSH-TO-TALK] Recording started - release to stop');
    } catch (err: any) {
      console.error('Failed to start push-to-talk recording:', err);
      setError(err.message || 'Failed to access microphone');
      setIsMicPreparing(false);
      cleanupRecording();
    }
  };

  const stopPushToTalkRecording = (inputType?: 'mouse' | 'touch' | 'keyboard' | 'force') => {
    console.log('[PTT-STOP-DEBUG] Stop requested, inputType:', inputType, 'activeInputType:', activeInputTypeRef.current, 'isHeld:', isPttButtonHeldRef.current);
    
    // Guard: If an input type is specified, it must match the active input type
    // This prevents mouse events from stopping touch recording, etc.
    // 'force' bypasses the guard for cleanup scenarios
    if (inputType && inputType !== 'force' && activeInputTypeRef.current !== inputType) {
      console.log('[PTT-STOP-DEBUG] BLOCKED - input type mismatch (expected:', activeInputTypeRef.current, 'got:', inputType, ')');
      return;
    }
    console.log('[PTT-STOP-DEBUG] Guard passed, proceeding...');
    
    // Guard: Don't stop if the button is still held (prevents speculative AI from clearing state)
    // This check uses the ref for synchronous access
    if (inputType !== 'force' && !isPttButtonHeldRef.current && !isMicPreparing) {
      console.log('[PUSH-TO-TALK] Ignoring stop - button not held and not preparing');
      return;
    }
    
    console.log('[PUSH-TO-TALK] Releasing button, stopping recording...');
    
    // Track that button is released (for stable instruction text)
    // Update both state and ref
    console.log('[PTT-STATE-DEBUG] Setting isPttButtonHeld=FALSE at', new Date().toISOString(), 'call stack:', new Error().stack);
    setIsPttButtonHeld(false);
    isPttButtonHeldRef.current = false;
    activeInputTypeRef.current = null;
    
    // Cancel any pending recording start (for race condition prevention)
    recordingRequestedRef.current = false;
    
    // Clear preparing state if still waiting for mic
    setIsMicPreparing(false);
    
    // FIX: Send ptt_release FIRST, THEN stop audio after a short delay
    // This ensures all in-flight audio reaches the server before we cut the stream
    // Without this delay, the final words of short phrases can get cut off
    pttReleaseSentRef.current = true;
    streamingVoice.sendPttRelease();
    console.log('[SpeculativePTT] Sent ptt_release - audio will stop after 100ms drain delay');
    
    // Stop streaming flag immediately to prevent new chunks, but keep processor alive briefly
    pttStreamingActiveRef.current = false;
    
    // Delay audio processor disconnect to allow final chunks to transmit
    // 100ms is enough for any queued audio buffers to flush to WebSocket
    const processor = pttStreamingProcessorRef.current;
    const audioContext = pttStreamingAudioContextRef.current;
    pttStreamingProcessorRef.current = null;
    pttStreamingAudioContextRef.current = null;
    
    setTimeout(() => {
      if (processor) {
        try { processor.disconnect(); } catch (e) { /* already disconnected */ }
      }
      if (audioContext) {
        audioContext.close().catch(() => { /* already closed */ });
      }
      console.log('[SpeculativePTT] Audio processor disconnected after drain delay');
    }, 100);
    
    // IMMEDIATELY reset subtitles to prevent phantom flash during the gap
    // between stop() being called and onstop callback firing
    // This must happen SYNCHRONOUSLY before any other async operations
    if (streamingConnectedRef.current) {
      console.log('[PUSH-TO-TALK] Resetting subtitles immediately on button release');
      streamingVoice.subtitles.reset();
    }
    
    // CRITICAL: Set isProcessing=true BEFORE cleanup for BOTH streaming and legacy paths
    // In streaming mode, there's no MediaRecorder onstop callback to set this.
    // Without this, ImmersiveTutor never shows the "thinking" state.
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsProcessing(true);
    isProcessingRef.current = true;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecording();
    }
  };
  
  // Open mic mode refs
  const openMicSequenceIdRef = useRef(0);
  const openMicStreamRef = useRef<MediaStream | null>(null);
  const openMicAudioContextRef = useRef<AudioContext | null>(null);
  const openMicProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const openMicActiveRef = useRef(false);
  
  // Speculative PTT streaming refs - stream audio in real-time during PTT for faster response
  const pttStreamingSequenceIdRef = useRef(0);
  const pttStreamingAudioContextRef = useRef<AudioContext | null>(null);
  const pttStreamingProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pttStreamingActiveRef = useRef(false);
  const pttInterimTranscriptRef = useRef('');
  // Flag to track if ptt_release was sent - prevents double response from audio_data blob
  const pttReleaseSentRef = useRef(false);
  
  // Refs for open mic functions - used by callbacks that can't access the functions directly
  const startOpenMicRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const stopOpenMicRecordingRef = useRef<(() => void) | null>(null);
  
  /**
   * Resample Float32 audio from source rate to target rate using linear interpolation
   */
  const resampleAudio = (input: Float32Array, fromRate: number, toRate: number): Float32Array => {
    if (fromRate === toRate) return input;
    
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;
      
      output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }
    
    return output;
  };

  /**
   * Start continuous recording for open mic mode.
   * Uses AudioContext for raw PCM capture (linear16) instead of MediaRecorder.
   * This avoids WebM header issues with continuous streaming.
   */
  const startOpenMicRecording = async () => {
    // Only check the ref - the actual source of truth for audio processing
    // isRecording state can be stale after cleanup
    if (openMicActiveRef.current) {
      console.log('[OPEN MIC] Already active (ref check), ignoring');
      return;
    }
    
    // Block recording if credits are exhausted
    if (isExhausted) {
      console.log('[OPEN MIC] Blocked - credits exhausted');
      if (onInsufficientCredits) {
        onInsufficientCredits();
      }
      return;
    }
    
    try {
      setError(null);
      console.log('[OPEN MIC] Starting continuous PCM recording...');
      
      // Notify server of input mode change
      streamingVoice.setInputMode('open-mic');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      openMicStreamRef.current = stream;
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      openMicAudioContextRef.current = audioContext;
      
      if (audioContext.state === 'suspended') {
        console.warn(`[OPEN MIC] AudioContext started SUSPENDED — attempting resume (may need user gesture)`);
        try {
          await audioContext.resume();
          console.log(`[OPEN MIC] AudioContext resumed successfully, state: ${audioContext.state}`);
        } catch (resumeErr) {
          console.error('[OPEN MIC] Failed to resume AudioContext:', resumeErr);
        }
      }
      
      if (audioContext.state !== 'running') {
        console.error(`[OPEN MIC] AudioContext state is "${audioContext.state}" — mic audio will be SILENT. Needs user gesture to unlock.`);
      }
      
      const actualSampleRate = audioContext.sampleRate;
      const targetSampleRate = 16000;
      const needsResampling = actualSampleRate !== targetSampleRate;
      
      console.log(`[OPEN MIC] AudioContext state: ${audioContext.state}, sample rate: ${actualSampleRate}Hz (target: ${targetSampleRate}Hz, resampling: ${needsResampling})`);
      
      const source = audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode to capture raw PCM (deprecated but widely supported)
      // Buffer size of 4096 samples
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      openMicProcessorRef.current = processor;
      openMicActiveRef.current = true;
      
      processor.onaudioprocess = (event) => {
        if (!openMicActiveRef.current) {
          // Only log occasionally to avoid spam
          if (Math.random() < 0.01) console.log('[OPEN MIC] Audio blocked - openMicActiveRef is false');
          return;
        }
        
        // TRUE DUPLEX MODE: Keep streaming audio even while Daniela speaks
        // Echo cancellation + server-side VAD will filter out TTS feedback
        // This enables real-time barge-in and continuous conversation
        
        let inputBuffer = event.inputBuffer.getChannelData(0);
        
        if (needsResampling) {
          inputBuffer = resampleAudio(inputBuffer, actualSampleRate, targetSampleRate);
        }
        
        const sequenceId = openMicSequenceIdRef.current++;
        
        if (sequenceId === 10 || sequenceId === 50 || sequenceId === 200) {
          let sum = 0;
          for (let i = 0; i < inputBuffer.length; i++) sum += inputBuffer[i] * inputBuffer[i];
          const rmsDb = 10 * Math.log10(sum / inputBuffer.length + 1e-10);
          const ctxState = openMicAudioContextRef.current?.state || 'unknown';
          console.log(`[OPEN MIC DIAG] chunk#${sequenceId} RMS=${rmsDb.toFixed(1)}dB, ctxState=${ctxState}`);
          if (rmsDb < -60) {
            console.warn(`[OPEN MIC DIAG] ⚠️ Very low audio level at chunk#${sequenceId} — mic may not be capturing. Check AudioContext state and permissions.`);
          }
        }
        
        const pcm16 = new Int16Array(inputBuffer.length);
        for (let i = 0; i < inputBuffer.length; i++) {
          const s = Math.max(-1, Math.min(1, inputBuffer[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const sent = streamingVoice.sendStreamingChunk(pcm16.buffer, sequenceId);
        
        // Track consecutive failures for logging (but don't stop recording)
        if (!sent) {
          // Only log occasionally to avoid spam (every 100 failed chunks)
          if (sequenceId % 100 === 0) {
            console.warn('[OPEN MIC] Failed to send chunk, WebSocket may be reconnecting');
          }
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setOpenMicState('idle');
      setIsRecording(true);
      isRecordingRef.current = true;
      console.log(`[OPEN MIC] Continuous PCM recording started (${actualSampleRate}Hz → ${targetSampleRate}Hz linear16)`);
    } catch (err: any) {
      console.error('[OPEN MIC] Failed to start recording:', err);
      setError(err.message || 'Failed to access microphone');
      setOpenMicState('idle');
      openMicActiveRef.current = false;
    }
  };
  
  /**
   * Stop open mic continuous recording.
   */
  const stopOpenMicRecording = () => {
    console.log('[OPEN MIC] Stopping continuous PCM recording...');
    
    // Notify server to stop streaming
    streamingVoice.stopStreaming();
    
    // Notify server of input mode change back to push-to-talk
    streamingVoice.setInputMode('push-to-talk');
    
    // Stop the ScriptProcessorNode
    openMicActiveRef.current = false;
    if (openMicProcessorRef.current) {
      openMicProcessorRef.current.disconnect();
      openMicProcessorRef.current = null;
    }
    
    // Close AudioContext
    if (openMicAudioContextRef.current) {
      openMicAudioContextRef.current.close().catch(console.error);
      openMicAudioContextRef.current = null;
    }
    
    // Stop media stream
    if (openMicStreamRef.current) {
      openMicStreamRef.current.getTracks().forEach(track => track.stop());
      openMicStreamRef.current = null;
    }
    
    openMicSequenceIdRef.current = 0;
    setOpenMicState('idle');
    setIsRecording(false);
    isRecordingRef.current = false;
  };
  
  /**
   * Handle open mic button tap - only starts if not already active
   * Once Open Mic is running, tapping does nothing (continuous listening)
   */
  const handleOpenMicTap = () => {
    if (openMicActiveRef.current) {
      // Already listening - ignore tap (no toggle behavior)
      console.log('[OPEN MIC] Already active, ignoring tap (no toggle)');
      return;
    }
    // Not active - start recording
    startOpenMicRecording();
  };
  
  // Assign functions to refs so callbacks can access them
  startOpenMicRecordingRef.current = startOpenMicRecording;
  stopOpenMicRecordingRef.current = stopOpenMicRecording;
  
  // Wire up the mode change cleanup ref
  handleModeChangeCleanupRef.current = () => {
    // Stop any active open mic recording when switching modes
    if (openMicActiveRef.current) {
      openMicActiveRef.current = false;
      
      if (openMicProcessorRef.current) {
        openMicProcessorRef.current.disconnect();
        openMicProcessorRef.current = null;
      }
      
      if (openMicAudioContextRef.current) {
        openMicAudioContextRef.current.close().catch(console.error);
        openMicAudioContextRef.current = null;
      }
      
      if (openMicStreamRef.current) {
        openMicStreamRef.current.getTracks().forEach(track => track.stop());
        openMicStreamRef.current = null;
      }
      
      openMicSequenceIdRef.current = 0;
    }
  };

  const handleToggleIncognito = () => {
    const newState = !isIncognito;
    setIsIncognito(newState);
    streamingVoice.sendToggleIncognito(newState);
  };

  const handleEndCall = () => {
    console.log('[END CALL] User requested to end voice session');
    
    // Clear greeting lock so reconnecting to the same conversation can get a fresh greeting
    greetingRequestedRef.current = null;
    clearGreetingLock();
    try {
      sessionStorage.removeItem(GREETING_MESSAGE_KEY);
    } catch { /* ignore */ }
    
    // Disconnect streaming voice FIRST - this is synchronous and immediately:
    // 1. Sets intentionalDisconnect = true (prevents auto-reconnect)
    // 2. Clears any pending reconnect timer
    // 3. Sends end_session message and closes WebSocket
    streamingVoice.disconnect();
    streamingConnectedRef.current = false;
    setIsIncognito(false);
    
    // Stop open mic recording if active
    if (openMicActiveRef.current) {
      console.log('[END CALL] Stopping open mic PCM recording');
      openMicActiveRef.current = false;
      if (openMicProcessorRef.current) {
        openMicProcessorRef.current.disconnect();
        openMicProcessorRef.current = null;
      }
      if (openMicAudioContextRef.current) {
        openMicAudioContextRef.current.close().catch(console.error);
        openMicAudioContextRef.current = null;
      }
      if (openMicStreamRef.current) {
        openMicStreamRef.current.getTracks().forEach(track => track.stop());
        openMicStreamRef.current = null;
      }
      openMicSequenceIdRef.current = 0;
    }
    
    // Stop any ongoing recording - the stop() callback will trigger cleanupRecording()
    // Only call cleanupRecording() directly if recorder isn't active
    const recorderWasActive = mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording';
    if (recorderWasActive) {
      try {
        mediaRecorderRef.current!.stop();
        // The onstop callback will handle cleanup
      } catch (e) {
        console.log('[END CALL] MediaRecorder stop error, cleaning up directly');
        cleanupRecording();
      }
    } else {
      // Recorder not active, cleanup state directly
      cleanupRecording();
    }
    
    // Stop any audio playback
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    
    // Reset all UI state
    setAvatarState('idle');
    setIsProcessing(false);
    isProcessingRef.current = false;
    setProcessingStage(null);
    setIsRecording(false);
    setIsMicPreparing(false);
    setCurrentPlayingMessageId(null);
    setError(null);
    
    // Clear whiteboard
    whiteboard.clear();
    
    // Reset subtitles
    streamingVoice.subtitles.reset();
    
    console.log('[END CALL] Voice session ended cleanly');
    
    // Navigate back to dashboard/language hub
    navigate('/');
  };

  const processRecording = async (audioBlob: Blob, targetConversationId: string) => {
    if (!targetConversationId) {
      console.log('[PROCESS] Skipping - no conversation');
      setAvatarState('idle');
      return;
    }

    setIsProcessing(true);
    isProcessingRef.current = true; // Update ref immediately
    setAvatarState('idle');

    // Try streaming mode first for low-latency responses
    // Check both the ref AND the client's actual state (not React state which may be stale)
    const isStreamingReady = streamingConnectedRef.current && streamingVoice.isReady();
    
    console.log('[STREAMING CHECK]', {
      streamingConnectedRef: streamingConnectedRef.current,
      isReady: streamingVoice.isReady(),
      isStreamingReady,
    });
    
    if (isStreamingReady) {
      try {
        console.log('[STREAMING] Using streaming mode for low-latency response');
        
        // Reset subtitles immediately to hide stale content from previous response
        // This prevents old target words from showing during the processing window
        streamingVoice.subtitles.reset();
        
        setProcessingStage('Processing...');
        // Keep avatar idle during processing - it will switch to 'speaking' 
        // when audio actually starts playing (handled by useEffect watching playbackState)
        setAvatarState('idle');
        setError(null); // Clear any previous errors
        
        // Clear previous audio for replay (new response will set these)
        setLastMessageId(null);
        // Note: lastAudioBlob will be set by onResponseComplete callback
        
        // Convert blob to ArrayBuffer
        const audioData = await audioBlob.arrayBuffer();
        
        // Send audio via streaming WebSocket
        await streamingVoice.sendAudio(audioData);
        
        // Streaming audio playback is handled by useStreamingVoice hook
        // The hook handles:
        // - Progressive audio playback
        // - Subtitle word timing
        // - State management
        
        // Wait for response to complete
        // The hook will update state as audio plays
        console.log('[STREAMING] Audio sent, awaiting progressive response...');
        
        // Refetch messages after response completes (messages are saved server-side)
        setTimeout(async () => {
          await queryClient.refetchQueries({
            queryKey: ["/api/conversations", targetConversationId, "messages"],
          });
        }, 500);
        
        return; // Exit early - streaming mode handles everything
      } catch (streamErr: any) {
        console.error('[STREAMING] Streaming failed:', streamErr.message);
        streamingConnectedRef.current = false;
        // Reset state and show error
        setIsProcessing(false);
        isProcessingRef.current = false;
        setAvatarState('idle');
        setProcessingStage(null);
        setError('Voice streaming failed. Please try again.');
        
        // Attempt to reconnect streaming
        setTimeout(async () => {
          try {
            console.log('[STREAMING] Attempting to reconnect...');
            await streamingVoice.connect({
              conversationId: targetConversationId,
              targetLanguage: targetLanguageOverride ?? language,
              nativeLanguage: user?.nativeLanguage || 'english',
              difficultyLevel: difficulty,
              subtitleMode,
              tutorPersonality: user?.tutorPersonality || 'warm',
              tutorExpressiveness: user?.tutorExpressiveness || 3,
              tutorGender,  // Pass current tutor gender from context
              rawHonestyMode: isHonestyMode,  // Minimal prompting for authentic conversation
              onWhiteboardUpdate: (items, shouldClear) => {
                const imageItems = items.filter((item: any) => item.type === 'image' && item.data?.imageUrl);
                const otherItems = items.filter((item: any) => !(item.type === 'image' && item.data?.imageUrl));
                imageItems.forEach((img: any) => {
                  onStudioImage?.({
                    word: img.data.word || img.content,
                    description: img.data.description || img.content,
                    imageUrl: img.data.imageUrl,
                    context: img.data.context,
                  });
                });
                if (otherItems.length > 0 || shouldClear) {
                  whiteboard.addOrUpdateItems(otherItems, shouldClear);
                }
              },
              onScenarioLoaded: (scenario) => {
                onScenarioLoaded?.(scenario);
              },
              onScenarioEnded: (data) => {
                onScenarioEnded?.(data);
              },
              onPropUpdate: (data) => {
                onPropUpdate?.(data);
              },
              onVadSpeechStarted: () => {
                // TRUE DUPLEX: Always handle VAD speech events for visual feedback
                // NOTE: We no longer interrupt on VAD alone - echo/feedback can trigger false VAD
                // Interrupt is now handled in onInterimTranscript when we have ACTUAL user speech
                console.log('[OPEN MIC] VAD speech started (reconnect) - avatarState=', avatarStateRef.current, 'hasDanielaSpokeOnce=', hasDanielaSpokeOnceRef.current);
                
                // PHONE CALL MODEL: Only show green light if Daniela has "answered the call" (spoken at least once)
                if (hasDanielaSpokeOnceRef.current) {
                  setOpenMicState('listening');
                } else {
                  console.log('[OPEN MIC] Daniela hasnt spoken yet - keeping mic blue (reconnect)');
                }
              },
              onVadUtteranceEnd: (transcript, empty) => {
                console.log('[OPEN MIC] VAD utterance end (reconnect), transcript:', transcript, 'empty:', empty);
                if (empty) {
                  console.log('[OPEN MIC] Empty transcript (reconnect) - resetting to listening');
                  setOpenMicState('ready');
                  setIsProcessing(false);
                  isProcessingRef.current = false;
                  isAwaitingResponseRef.current = false;
                  return;
                }
                setOpenMicState('processing');
                isAwaitingResponseRef.current = true;
                
                // SAFETY: Start failsafe timer for reconnect path too
                if (openMicProcessingTimeoutRef.current) clearTimeout(openMicProcessingTimeoutRef.current);
                openMicProcessingTimeoutRef.current = setTimeout(() => {
                  const currentState = openMicStateRef.current;
                  if (currentState === 'processing') {
                    console.warn(`[OPEN MIC SAFETY] Processing stuck for ${OPEN_MIC_PROCESSING_TIMEOUT_MS}ms (reconnect) — force-recovering`);
                    setOpenMicState('ready');
                    setIsProcessing(false);
                    isProcessingRef.current = false;
                    isAwaitingResponseRef.current = false;
                    setAvatarState('listening');
                  }
                  openMicProcessingTimeoutRef.current = null;
                }, OPEN_MIC_PROCESSING_TIMEOUT_MS);
              },
              onInterimTranscript: (transcript) => {
                console.log('[OPEN MIC] Interim transcript:', transcript);
                
                // Reinforce 'listening' state when we get actual transcribed words (reconnect path)
                if (transcript && transcript.trim().length > 0) {
                  const currentOMState = openMicStateRef.current;
                  if (currentOMState !== 'listening' && currentOMState !== 'processing') {
                    console.log('[OPEN MIC] Interim transcript with words (reconnect) - forcing listening state (was:', currentOMState, ')');
                    setOpenMicState('listening');
                  }
                  
                  // BARGE-IN: Interrupt tutor when we have ACTUAL transcribed speech
                  // This is more reliable than VAD alone, which can trigger on TTS echo
                  if (avatarStateRef.current === 'speaking' || isAwaitingResponseRef.current) {
                    console.log('[BARGE-IN] User speaking with transcript - stopping audio and sending interrupt');
                    // CRITICAL: Stop audio playback immediately on client side
                    streamingVoice.stop();
                    // Also notify server to stop generating
                    streamingVoice.sendInterrupt();
                    isAwaitingResponseRef.current = false;
                    // Update avatar state immediately
                    setAvatarState('listening');
                  }
                }
              },
              onOpenMicSessionClosed: () => {
                console.log('[OPEN MIC] Server session closed (reconnect context)');
                if (!isAwaitingResponseRef.current) {
                  setOpenMicState('idle');
                }
              },
              onOpenMicSilenceLoop: (emptyCount, msSinceLast) => {
                console.warn(`[OPEN MIC] Silence loop (reconnect): ${emptyCount} empties`);
                if (emptyCount >= 8 && inputModeRef.current === 'open-mic') {
                  setOpenMicState('silence_issue');
                }
              },
              onReconnected: () => {
                console.log('[StreamingVoice] Connection restored silently (reconnect context)');
              },
              onTutorHandoff: (handoff) => {
                const { targetGender, targetLanguage, tutorName, isLanguageSwitch, isAssistant } = handoff;
                
                if (isAssistant) {
                  console.log(`[TUTOR HANDOFF] Assistant handoff to ${tutorName} - navigating to practice page (reconnect context)`);
                  streamingVoice.disconnect();
                  streamingConnectedRef.current = false;
                  window.location.href = '/practice';
                  return;
                }
                
                if (isLanguageSwitch && targetLanguage) {
                  console.log(`[TUTOR HANDOFF] Cross-language switch to ${tutorName} (${targetGender}) in ${targetLanguage} (reconnect context)`);
                  // CRITICAL: Clear greeting lock so new tutor can greet
                  greetingRequestedRef.current = null;
                  clearGreetingLock();
                  try {
                    sessionStorage.removeItem(GREETING_MESSAGE_KEY);
                  } catch {
                    // Ignore storage errors
                  }
                  console.log('[TUTOR HANDOFF] Cleared greeting lock for new tutor (reconnect)');
                  // Update language context - this triggers tutorVoices refetch for new language
                  setLanguage(targetLanguage);
                } else {
                  console.log(`[TUTOR HANDOFF] Switching to ${tutorName || targetGender} tutor (reconnect context)`);
                }
                setTutorGender(targetGender);
              },
              // Handle server-initiated subtitle mode change (tutor [SUBTITLE on/off/target] command)
              onSubtitleModeChange: (mode) => {
                console.log('[SUBTITLE] Server command to change subtitle mode to:', mode, '(reconnect context)');
                // Update whiteboard's regularSubtitleMode (used by FloatingSubtitleOverlay)
                whiteboard.setRegularSubtitleMode(mode);
                // Also update context for persistence
                setSubtitleMode(mode);
              },
              // Handle server-initiated custom overlay (tutor [SHOW: text] / [HIDE] commands)
              onCustomOverlay: (action, text) => {
                console.log('[OVERLAY] Server command:', action, text?.substring(0, 50), '(reconnect context)');
                whiteboard.setCustomOverlayText(action === 'show' ? (text || null) : null);
              },
            });
            streamingConnectedRef.current = true;
            setError(null);
            console.log('[STREAMING] Reconnected successfully');
          } catch (reconnectErr: any) {
            console.error('[STREAMING] Reconnection failed:', reconnectErr.message);
          }
        }, 1000);
        
        return; // Don't fall through to REST mode
      }
    } else if (STREAMING_ONLY_MODE) {
      // Streaming mode required but not connected - show error
      const currentState = streamingVoice.state.connectionState;
      console.warn('[STREAMING] Not connected, state:', currentState);
      
      // Give appropriate feedback based on connection state
      if (currentState === 'reconnecting') {
        setError('Reconnecting to voice session. Please wait...');
      } else {
        setError('Voice streaming is connecting. Please try again in a moment.');
      }
      setIsProcessing(false);
      isProcessingRef.current = false;
      setAvatarState('idle');
      setProcessingStage(null);
      return; // Don't fall through to REST mode
    }

    // ========================================================================
    // ⚠️ DEAD CODE - REST FALLBACK (PRESERVED BUT NEVER EXECUTED) ⚠️
    // ========================================================================
    // This REST code is ONLY reached when STREAMING_ONLY_MODE = false
    // Currently STREAMING_ONLY_MODE = true, so this code NEVER runs.
    // 
    // This code is preserved as an emergency fallback in case streaming
    // has critical issues. To enable:
    //   1. Set STREAMING_ONLY_MODE = false at the top of this file
    //   2. Test thoroughly before deploying
    //
    // DO NOT DELETE - This is our backup pipeline.
    // ========================================================================

    try {
      // REST mode (only used when STREAMING_ONLY_MODE is false)
      // Step 1: Transcribe
      setProcessingStage('Transcribing...');
      console.log('[REST VOICE] Transcribing audio...');
      
      // Step 2: Get response
      setProcessingStage('Getting response...');
      console.log('[REST VOICE] Sending to GPT...');
      
      // Step 3: Synthesize speech
      setProcessingStage('Synthesizing speech...');
      // KARAOKE ENABLED: Cartesia Sonic-3 provides estimated word timings for highlighting
      const needTimings = subtitleMode !== "off";
      console.log(`[REST VOICE] Generating speech... (karaoke: ${needTimings})`);
      
      const result = await processVoiceMessage(audioBlob, targetConversationId, language, needTimings);
      
      console.log('[REST VOICE] ✓ Transcript:', result.userTranscript);
      console.log('[REST VOICE] ✓ Response:', result.aiResponse);
      if (result.wordTimings) {
        console.log('[REST VOICE] ✓ Word timings received:', result.wordTimings.length, 'words');
      }
      
      // Handle conversation updates (language switch, onboarding, etc.)
      if (result.conversationUpdated) {
        const updated = result.conversationUpdated;
        console.log('[VOICE] Conversation updated:', updated);
        
        // Update language context if language changed
        if (updated.language && updated.language !== language) {
          console.log('[VOICE] Updating language context:', language, '->', updated.language);
          setLanguage(updated.language);
        }
        
        // Update onboarding status
        if (updated.isOnboarding !== undefined) {
          setCurrentConversationOnboarding(updated.isOnboarding);
        }
      }
      
      // Refetch messages to get the new assistant message (waits for fetch to complete)
      await queryClient.refetchQueries({
        queryKey: ["/api/conversations", targetConversationId, "messages"],
      });
      
      // Get the latest assistant message ID for subtitle display
      const updatedMessages = queryClient.getQueryData<Message[]>(["/api/conversations", targetConversationId, "messages"]);
      const latestAssistantMessage = updatedMessages?.filter(m => m.role === 'assistant').pop();
      
      console.log('[REST VOICE] Latest assistant message for highlighting:', latestAssistantMessage?.id);
      
      // Step 4: Play response
      setProcessingStage('Playing response...');
      setAvatarState('speaking');
      
      if (audioPlayerRef.current && result.audioBlob) {
        console.log('[REST VOICE] Audio blob size:', result.audioBlob.size, 'bytes');
        console.log('[REST VOICE] Audio blob type:', result.audioBlob.type);
        
        // Store audio for replay functionality
        setLastAudioBlob(result.audioBlob);
        if (latestAssistantMessage) {
          setLastMessageId(latestAssistantMessage.id);
        }
        
        const audioUrl = URL.createObjectURL(result.audioBlob);
        audioPlayerRef.current.src = audioUrl;
        
        // Use loadedmetadata to rescale word timings to actual audio duration for precise sync
        audioPlayerRef.current.onloadedmetadata = () => {
          if (result.wordTimings && result.wordTimings.length > 0 && latestAssistantMessage && audioPlayerRef.current) {
            const actualDuration = audioPlayerRef.current.duration;
            const estimatedDuration = result.wordTimings[result.wordTimings.length - 1].endTime;
            
            if (actualDuration && estimatedDuration && Math.abs(actualDuration - estimatedDuration) > 0.1) {
              // Rescale timings proportionally to match actual audio duration
              const scale = actualDuration / estimatedDuration;
              const rescaledTimings = result.wordTimings.map(timing => ({
                word: timing.word,
                startTime: timing.startTime * scale,
                endTime: Math.min(timing.endTime * scale, actualDuration),
              }));
              wordTimingsMapRef.current.set(latestAssistantMessage.id, rescaledTimings);
              console.log(`[SUBTITLES] Rescaled timings: ${estimatedDuration.toFixed(2)}s → ${actualDuration.toFixed(2)}s (scale: ${scale.toFixed(3)})`);
            } else if (subtitleMode !== "off") {
              // No rescaling needed, store as-is
              wordTimingsMapRef.current.set(latestAssistantMessage.id, result.wordTimings);
              console.log('[SUBTITLES] Stored word timings for message:', latestAssistantMessage.id);
            }
          }
        };
        
        // Set the currently playing message ID before playing
        if (latestAssistantMessage) {
          setCurrentPlayingMessageId(latestAssistantMessage.id);
        }
        
        audioPlayerRef.current.onended = () => {
          console.log('[REST VOICE] Audio playback ended');
          URL.revokeObjectURL(audioUrl);
          setAvatarState('idle');
          setCurrentPlayingMessageId(null);
          setProcessingStage(null);
        };
        
        audioPlayerRef.current.onerror = (e) => {
          console.error('[REST VOICE] Audio playback error:', e);
          setError('Failed to play audio. The text response is still saved.');
          URL.revokeObjectURL(audioUrl);
          setAvatarState('idle');
          setCurrentPlayingMessageId(null);
          setProcessingStage(null);
        };
        
        try {
          console.log('[REST VOICE] Starting audio playback...');
          await audioPlayerRef.current.play();
          console.log('[REST VOICE] ✓ Audio playback started successfully');
        } catch (playError: any) {
          console.error('[REST VOICE] Failed to play audio:', playError);
          setError(`Audio playback blocked: ${playError.message}. Check browser autoplay settings.`);
          URL.revokeObjectURL(audioUrl);
          setAvatarState('idle');
          setCurrentPlayingMessageId(null);
          setProcessingStage(null);
        }
      } else {
        console.warn('[REST VOICE] No audio blob or audio player unavailable');
        setProcessingStage(null);
        setAvatarState('idle');
      }
      
    } catch (err: any) {
      console.error('[REST VOICE] Error:', err);
      
      // Provide helpful recovery guidance based on error type
      let errorMessage = err.message || 'Voice processing failed';
      let allowRetry = true;
      
      if (err.message?.includes('limit reached') || err.message?.includes('quota')) {
        errorMessage = 'Monthly voice limit reached. Please upgrade your plan or switch to text mode below.';
        allowRetry = false; // Quota errors can't be retried
      } else if (err.message?.includes('401') || err.message?.includes('API key') || err.message?.includes('authentication')) {
        errorMessage = 'Invalid OpenAI API key. Please update your USER_OPENAI_API_KEY in the Secrets tab or switch to text mode.';
        allowRetry = false; // Auth errors need manual intervention
      } else if (err.message?.includes('transcribe') || err.message?.includes('Whisper')) {
        errorMessage = 'Failed to transcribe audio. Try speaking more clearly or switch to text mode.';
      } else if (err.message?.includes('synthesize') || err.message?.includes('TTS')) {
        errorMessage = 'Failed to generate speech. The text response is still saved. Try refreshing or switch to text mode.';
      } else {
        errorMessage += ' Please try again or switch to text mode.';
      }
      
      setError(errorMessage);
      setAvatarState('idle');
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false; // Update ref immediately
      setProcessingStage(null);
    }
  };

  // Replay function for last audio
  const replayLastAudio = () => {
    if (!lastAudioBlob || !audioPlayerRef.current) {
      console.log('[REPLAY] No audio available to replay');
      return;
    }
    
    // Don't replay if already playing or processing
    if (avatarState === 'speaking' || isProcessing) {
      console.log('[REPLAY] Skipping - already playing or processing');
      return;
    }
    
    console.log('[REPLAY] Replaying last audio');
    setAvatarState('speaking');
    if (lastMessageId) {
      setCurrentPlayingMessageId(lastMessageId);
    }
    
    const audioUrl = URL.createObjectURL(lastAudioBlob);
    audioPlayerRef.current.src = audioUrl;
    
    audioPlayerRef.current.onended = () => {
      URL.revokeObjectURL(audioUrl);
      setAvatarState('idle');
      setCurrentPlayingMessageId(null);
    };
    
    audioPlayerRef.current.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      setAvatarState('idle');
      setCurrentPlayingMessageId(null);
    };
    
    audioPlayerRef.current.play()
      .catch(err => {
        console.error('[REPLAY] Failed to play:', err);
        URL.revokeObjectURL(audioUrl);
        setAvatarState('idle');
        setCurrentPlayingMessageId(null);
      });
  };

  // Slow repeat: Ask AI to simplify and speak slowly
  // Caches the audio so subsequent presses just replay
  const handleSlowRepeat = async () => {
    if (!conversationId || !audioPlayerRef.current) {
      console.log('[SLOW REPEAT] No conversation or audio player');
      return;
    }
    
    // Don't start if already playing or processing
    if (avatarState === 'speaking' || isProcessing || isSlowRepeatLoading) {
      console.log('[SLOW REPEAT] Skipping - already busy');
      return;
    }
    
    setError(null);
    
    // Check if we have a cached slow repeat for the current message
    if (slowRepeatCacheRef.current && slowRepeatCacheRef.current.messageId === lastMessageId) {
      console.log('[SLOW REPEAT] Using cached audio (replay)');
      
      // Play cached audio
      setAvatarState('speaking');
      const audioUrl = URL.createObjectURL(slowRepeatCacheRef.current.audioBlob);
      audioPlayerRef.current.src = audioUrl;
      
      audioPlayerRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setAvatarState('idle');
        setCurrentPlayingMessageId(null);
      };
      
      audioPlayerRef.current.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setAvatarState('idle');
        setCurrentPlayingMessageId(null);
      };
      
      try {
        await audioPlayerRef.current.play();
      } catch (err) {
        console.error('[SLOW REPEAT] Failed to play cached audio:', err);
        setAvatarState('idle');
      }
      return;
    }
    
    // No cache - fetch from API
    console.log('[SLOW REPEAT] Requesting simplified slow repeat');
    setIsSlowRepeatLoading(true);
    
    try {
      const result = await requestSlowRepeat(conversationId);
      console.log('[SLOW REPEAT] Got simplified response:', result.simplifiedText);
      
      // Cache the audio for subsequent presses
      if (lastMessageId) {
        slowRepeatCacheRef.current = {
          messageId: lastMessageId,
          audioBlob: result.audioBlob,
        };
        console.log('[SLOW REPEAT] Cached audio for message:', lastMessageId);
      }
      
      // Play the slow audio
      setAvatarState('speaking');
      const audioUrl = URL.createObjectURL(result.audioBlob);
      audioPlayerRef.current.src = audioUrl;
      
      audioPlayerRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setAvatarState('idle');
        setCurrentPlayingMessageId(null);
      };
      
      audioPlayerRef.current.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setAvatarState('idle');
        setCurrentPlayingMessageId(null);
        setError('Failed to play slow repeat audio');
      };
      
      await audioPlayerRef.current.play();
    } catch (err: any) {
      console.error('[SLOW REPEAT] Error:', err);
      setError(err.message || 'Failed to get slow repeat');
      setAvatarState('idle');
    } finally {
      setIsSlowRepeatLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background" data-testid="rest-voice-chat">
      {/* Incognito Mode Toggle - Founder/Honesty mode only */}
      {(isDeveloper || isAdmin) && (learningContext === 'founder-mode' || learningContext === 'honesty-mode') && streamingVoice.state.connectionState !== 'disconnected' && (
        <div className="absolute top-3 left-3 z-50">
          <Button
            size="sm"
            variant={isIncognito ? "destructive" : "outline"}
            onClick={handleToggleIncognito}
            className="gap-1.5 opacity-80 hover:opacity-100"
            data-testid="button-toggle-incognito"
          >
            <EyeOff className="w-3.5 h-3.5" />
            {isIncognito ? "Incognito ON" : "Incognito"}
          </Button>
        </div>
      )}
      {/* Immersive Voice Chat with View Manager - Full Screen */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <VoiceChatViewManager
          conversationId={conversationId}
          messages={messages}
          onRecordingStart={inputMode === 'open-mic' ? handleOpenMicTap : startPushToTalkRecording}
          onRecordingStop={inputMode === 'open-mic' ? () => {} : stopPushToTalkRecording}
          isRecording={isRecording}
          isMicPreparing={isMicPreparing}
          isProcessing={isProcessing}
          isPlaying={globalPlaybackState === 'playing' || globalPlaybackState === 'buffering'}
          isConnecting={useStreamingMode && (streamingVoice.state.connectionState === 'connecting' || streamingVoice.state.connectionState === 'reconnecting')}
          isReconnecting={useStreamingMode && streamingVoice.state.connectionState === 'reconnecting'}
          isUsersTurn={
            // Mic is ONLY unlocked when ALL of these are true:
            // 1. Connection is 'ready' OR 'connected' OR 'streaming' (all valid working states)
            // 2. Not processing (not waiting for AI response)
            // 3. Not playing/speaking (AI not talking) - use globalPlaybackState for reliable immediate response
            // 4. Not connecting/reconnecting
            // 5. NOT switching tutors (mic stays locked during handoff)
            // 
            // CRITICAL: Use globalPlaybackState from the global store instead of hook's internal state
            // The global store is reliable during HMR whereas hook state may have stale closures
            // 
            // SPECIAL CASE: If user is HOLDING PTT (isPttButtonHeld), keep mic active!
            // This allows speculative PTT to play audio while user still has control.
            // 
            // ALSO unlock if there's an error but connection is valid (recoverable state)
            (streamingVoice.state.connectionState === 'ready' || streamingVoice.state.connectionState === 'connected' || streamingVoice.state.connectionState === 'streaming') &&
            !streamingVoice.state.isSwitchingTutor &&  // Mic locked during tutor handoff
            (
              // PTT ACTIVE: If user is holding PTT button, keep mic active regardless of audio state
              // This is critical for speculative PTT - user maintains control while holding
              isPttButtonHeld ||
              // Normal case: not processing and playback is idle (using globalPlaybackState for reliability)
              (!isProcessing && !streamingVoice.state.isProcessing && globalPlaybackState === 'idle') ||
              // Error recovery: server says not processing even if local state got stuck
              (!!streamingVoice.state.error && !streamingVoice.state.isProcessing && globalPlaybackState === 'idle')
            )
          }
          onEndCall={handleEndCall}
          tutorGender={tutorGender}
          voiceSpeed={voiceSpeed}
          setTutorGender={(gender) => {
            setTutorGender(gender);
            if (useStreamingMode) {
              streamingVoice.updateVoice(gender);
            }
          }}
          setVoiceSpeed={setVoiceSpeed}
          femaleVoiceName={tutorNames.female}
          maleVoiceName={tutorNames.male}
          baseSpeakingRate={tutorGender === 'male' 
            ? (tutorVoices?.male?.speakingRate ?? 1.0) 
            : (tutorVoices?.female?.speakingRate ?? 1.0)}
          isDeveloper={isDeveloper || isAdmin}
          classId={classId}
          onReloadCredits={() => reloadCreditsMutation.mutate()}
          onResetData={() => resetDataMutation.mutate()}
          isReloadingCredits={reloadCreditsMutation.isPending}
          isResettingData={resetDataMutation.isPending}
          whiteboardItems={useDesktopWhiteboard ? [] : whiteboard.items}
          onClearWhiteboard={whiteboard.clear}
          onDrillComplete={(drillId, drillType, isCorrect, responseTimeMs, toolContent) => {
            if (useStreamingMode) {
              streamingVoice.sendDrillResult(drillId, drillType, isCorrect, responseTimeMs, toolContent);
            }
          }}
          onTextInputSubmit={(itemId, response) => {
            if (useStreamingMode) {
              streamingVoice.sendTextInput(itemId, response);
            }
          }}
          subtitleState={streamingVoice.subtitles.state}
          regularSubtitleMode={whiteboard.regularSubtitleMode}
          customOverlayText={whiteboard.customOverlayText}
          inputMode={inputMode}
          setInputMode={setInputMode}
          openMicState={openMicState}
          isPttButtonHeld={isPttButtonHeld}
          playbackState={globalPlaybackState}
          onInterrupt={() => {
            streamingVoice.stop();
            streamingVoice.sendInterrupt();
          }}
          voiceOverride={voiceOverride}
          onVoiceOverrideChange={setVoiceOverride}
          onHelpClick={() => setIsSupportModalOpen(true)}
        />
      </div>
      
      {/* Support modal - triggered by help button in controls */}
      <SupportAssistModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        ticketId={null}
        category="technical"
        reason="Help request during voice chat"
        priority="normal"
        mode="support"
      />
    </div>
  );
}
