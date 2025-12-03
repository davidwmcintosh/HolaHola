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

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Message, type User } from "@shared/schema";
import { processVoiceMessage, synthesizeSpeech, requestSlowRepeat, type WordTiming } from "@/lib/restVoiceApi";
import { InstructorAvatar, type AvatarState } from "@/components/InstructorAvatar";
import { CompactDifficultyControl } from "@/components/CompactDifficultyControl";
import { LanguageSelector } from "@/components/LanguageSelector";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { VoiceChatViewManager } from "@/components/VoiceChatViewManager";
import { useStreamingVoice } from "@/hooks/useStreamingVoice";
import { useUser } from "@/lib/auth";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { useToast } from "@/hooks/use-toast";

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
const GREETING_COOLDOWN_MS = 30000; // 30 seconds - prevent greeting if one played recently

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
  // Note: We don't clear synthesizedMessageId or sessionStorage
  // This ensures the same greeting is never re-synthesized
}

interface StreamingVoiceChatProps {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  setCurrentConversationOnboarding: (isOnboarding: boolean | null) => void;
  isResumedConversation?: boolean;
  onResumeHandled?: () => void;
}

export function StreamingVoiceChat({ 
  conversationId, 
  setConversationId, 
  setCurrentConversationOnboarding,
  isResumedConversation,
  onResumeHandled
}: StreamingVoiceChatProps) {
  const { language, difficulty, setLanguage, subtitleMode, tutorGender, voiceSpeed, setTutorGender, setVoiceSpeed } = useLanguage();
  const { isDeveloper, isAdmin, user } = useUser();
  const { learningContext } = useLearningFilter();
  const { toast } = useToast();
  
  // Check if we're in class mode
  const isInClassMode = learningContext !== "self-directed" && 
                        learningContext !== "all" && 
                        learningContext !== "all-classes" && 
                        learningContext !== "all-learning";
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
  
  // Query voice names for the current language
  const { data: tutorVoices } = useQuery<{ 
    language: string; 
    female: { name: string; voiceId: string; speakingRate: number } | null; 
    male: { name: string; voiceId: string; speakingRate: number } | null 
  }>({
    queryKey: ['/api/tutor-voices', language?.toLowerCase()],
    enabled: !!language,
  });
  
  // Helper to extract just the first name from voice name (e.g., "Daniela - Relaxed Woman" -> "Daniela")
  const getVoiceFirstName = (fullName: string | undefined, fallback: string): string => {
    if (!fullName) return fallback;
    const dashIndex = fullName.indexOf(' - ');
    return dashIndex > 0 ? fullName.substring(0, dashIndex) : fullName;
  };
  const [isRecording, setIsRecording] = useState(false);
  const [isMicPreparing, setIsMicPreparing] = useState(false); // Show "Preparing mic..." before actual recording starts
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState<string | null>(null);
  
  // Store last audio for replay functionality
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [isSlowRepeatLoading, setIsSlowRepeatLoading] = useState(false);
  
  // Cache for slow repeat audio - so subsequent presses just replay
  const slowRepeatCacheRef = useRef<{ messageId: string; audioBlob: Blob } | null>(null);
  
  // Word timing data for synchronized subtitles - persisted per message ID
  // Using a ref to persist across re-renders without causing re-renders
  const wordTimingsMapRef = useRef<Map<string, WordTiming[]>>(new Map());
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentConversationRef = useRef<string | null>(conversationId);
  const hasPlayedGreetingRef = useRef<string | null>(null); // Track which conversation's greeting was played
  const isRecordingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const recordingRequestedRef = useRef<boolean>(false); // Track if recording was requested (for race condition prevention)
  
  // Silence detection refs (only for auto-stop mode)
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Streaming voice mode for low-latency responses
  const streamingVoice = useStreamingVoice();
  const streamingConnectedRef = useRef(false);
  const useStreamingMode = ENABLE_STREAMING_MODE && streamingVoice.isSupported();
  
  // Mic warm-up: cache stream for instant recording start
  const cachedStreamRef = useRef<MediaStream | null>(null);
  const micWarmedUpRef = useRef(false);
  
  // Keep refs updated with current state
  useEffect(() => {
    currentConversationRef.current = conversationId;
    isRecordingRef.current = isRecording;
    isProcessingRef.current = isProcessing;
  }, [conversationId, isRecording, isProcessing]);
  
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

  // Fetch existing messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });
  
  // Fetch user details to get tutor gender preference
  const { data: userDetails } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  
  // Connect streaming voice when conversation and user data are available
  useEffect(() => {
    if (!useStreamingMode || !conversationId || !userDetails) return;
    
    const connectStreaming = async () => {
      try {
        console.log('[STREAMING] Connecting to streaming voice...');
        await streamingVoice.connect({
          conversationId,
          targetLanguage: language,
          nativeLanguage: userDetails.nativeLanguage || 'english',
          difficultyLevel: difficulty,
          subtitleMode,
          tutorPersonality: userDetails.tutorPersonality || 'warm',
          tutorExpressiveness: userDetails.tutorExpressiveness || 3,
          // Invalidate messages query when streaming completes to show persisted messages
          onResponseComplete: (convId: string) => {
            console.log('[STREAMING] Response complete - refreshing messages for', convId);
            queryClient.invalidateQueries({ queryKey: ["/api/conversations", convId, "messages"] });
            
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
        });
        streamingConnectedRef.current = true;
        console.log('[STREAMING] Connected successfully');
      } catch (err: any) {
        console.error('[STREAMING] Failed to connect:', err.message);
        streamingConnectedRef.current = false;
        // Don't silently fail - show error to user
        setError('Voice streaming connection failed. Retrying...');
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
  }, [conversationId, useStreamingMode, user, language, difficulty, subtitleMode]);
  
  // Sync streaming voice state with component state
  useEffect(() => {
    if (!useStreamingMode) return;
    
    const { isProcessing: streamProcessing, playbackState, error: streamError, connectionState } = streamingVoice.state;
    
    // Update avatar state based on streaming state
    // Only show speaking when audio is ACTUALLY playing (not just processing)
    // Processing state should show a "thinking" indicator, not speaking avatar
    // NOTE: Don't override avatar state if greeting is currently playing (via REST)
    const isStreamingPlaying = playbackState === 'playing' || playbackState === 'buffering';
    
    // Check if we're in the middle of greeting playback (non-streaming)
    // If currentPlayingMessageId is set but we're not streaming, a greeting is playing
    const isGreetingPlaying = currentPlayingMessageId && !isStreamingPlaying && avatarState === 'speaking';
    
    if (isGreetingPlaying) {
      // Don't override greeting playback state
      return;
    }
    
    if (isStreamingPlaying) {
      // Audio is actually playing - show speaking state
      setAvatarState('speaking');
    } else if (!streamProcessing) {
      // Not processing AND not playing - reset to idle
      setAvatarState('idle');
      if (isProcessingRef.current) {
        setIsProcessing(false);
        isProcessingRef.current = false;
        setProcessingStage(null);
      }
    }
    // Note: When streamProcessing is true but not playing yet, 
    // avatar stays in current state (idle/listening) until audio actually starts
    
    // Handle streaming errors - show them since we don't have REST fallback
    if (streamError) {
      console.error('[STREAMING] Error:', streamError);
      // Reset processing state and avatar
      if (isProcessingRef.current) {
        setIsProcessing(false);
        isProcessingRef.current = false;
        setProcessingStage(null);
      }
      setAvatarState('idle');
      setError(streamError);
      
      if (connectionState === 'error') {
        streamingConnectedRef.current = false;
      }
    }
    
    // Clear error when connection recovers
    if (connectionState === 'connected' && streamingConnectedRef.current === false) {
      streamingConnectedRef.current = true;
      setError(null);
    }
  }, [streamingVoice.state, useStreamingMode]);
  
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
      
      // Wait for both in parallel
      await Promise.all([warmDeepgram, warmTts]);
    };
    warmServices();
  }, []);

  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      console.log('[CLEANUP] Cleaning up voice recording resources...');
      cleanupRecording();
    };
  }, [conversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
  const recordingStartTimeRef = useRef<number | null>(null);
  const MIN_RECORDING_DURATION_MS = 500; // Minimum 500ms to avoid empty recordings
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if Enter is pressed
      if (event.code !== 'Enter') return;
      
      // Ignore key repeat events (holding Enter)
      if (event.repeat) return;
      
      // Don't trigger if user is typing in an input/textarea/contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) return;
      
      // Don't trigger if no conversation or processing
      if (!conversationId || isProcessing) return;
      
      // Prevent default behavior
      event.preventDefault();
      
      // Start recording on keydown (if not already recording)
      if (!isRecording) {
        console.log('[KEYBOARD] Enter pressed - starting recording');
        recordingStartTimeRef.current = Date.now();
        startPushToTalkRecording();
      }
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      // Only trigger if Enter is released
      if (event.code !== 'Enter') return;
      
      // Don't trigger if user is typing in an input/textarea/contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) return;
      
      // Stop recording on keyup (if recording)
      if (isRecording) {
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
            stopPushToTalkRecording();
          }, remainingTime);
        } else {
          console.log('[KEYBOARD] Enter released - stopping recording');
          recordingStartTimeRef.current = null;
          stopPushToTalkRecording();
        }
      }
    };

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [conversationId, isRecording, isProcessing]);

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
    
    try {
      setError(null);
      
      
      // Capture conversation ID for this session
      const recordingConversationId = conversationId;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
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
  const startPushToTalkRecording = async () => {
    const startTime = performance.now();
    console.log('[PUSH-TO-TALK] Button pressed at', startTime.toFixed(0), 'ms');
    
    if (isRecording || isMicPreparing) {
      console.log('[PUSH-TO-TALK] Already recording or preparing, ignoring');
      return;
    }
    
    try {
      setError(null);
      
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
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
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
        
        // Check if conversation changed by comparing to current ref value
        const currentConv = currentConversationRef.current;
        
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

  const stopPushToTalkRecording = () => {
    console.log('[PUSH-TO-TALK] Releasing button, stopping recording...');
    
    // Cancel any pending recording start (for race condition prevention)
    recordingRequestedRef.current = false;
    
    // Clear preparing state if still waiting for mic
    setIsMicPreparing(false);
    
    // IMMEDIATELY reset subtitles to prevent phantom flash during the gap
    // between stop() being called and onstop callback firing
    // This must happen SYNCHRONOUSLY before any other async operations
    if (streamingConnectedRef.current) {
      console.log('[PUSH-TO-TALK] Resetting subtitles immediately on button release');
      streamingVoice.subtitles.reset();
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecording();
    }
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
        setAvatarState('speaking');
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
              targetLanguage: language,
              nativeLanguage: user?.nativeLanguage || 'english',
              difficultyLevel: difficulty,
              subtitleMode,
              tutorPersonality: user?.tutorPersonality || 'warm',
              tutorExpressiveness: user?.tutorExpressiveness || 3,
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
      console.warn('[STREAMING] Not connected, waiting for connection...');
      setError('Voice streaming is connecting. Please try again in a moment.');
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
      {/* Immersive Voice Chat with View Manager - Full Screen */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <VoiceChatViewManager
          conversationId={conversationId}
          messages={messages}
          onRecordingStart={startPushToTalkRecording}
          onRecordingStop={stopPushToTalkRecording}
          isRecording={isRecording}
          isMicPreparing={isMicPreparing}
          isProcessing={isProcessing}
          isPlaying={avatarState === 'speaking'}
          isConnecting={useStreamingMode && (streamingVoice.state.connectionState === 'connecting' || streamingVoice.state.connectionState === 'connected')}
          currentPlayingMessageId={currentPlayingMessageId ?? undefined}
          audioElementRef={audioPlayerRef}
          onReplay={replayLastAudio}
          canReplay={!!lastAudioBlob && !isProcessing && avatarState !== 'speaking'}
          onSlowRepeat={handleSlowRepeat}
          canSlowRepeat={messages.some(m => m.role === 'assistant') && !isProcessing && avatarState !== 'speaking'}
          isSlowRepeatLoading={isSlowRepeatLoading}
          wordTimings={currentPlayingMessageId ? wordTimingsMapRef.current.get(currentPlayingMessageId) : undefined}
          tutorGender={tutorGender}
          streamingText={useStreamingMode ? streamingVoice.subtitles.state.currentSentenceText : undefined}
          streamingTargetText={useStreamingMode ? streamingVoice.subtitles.state.currentSentenceTargetText : undefined}
          hasTargetContent={useStreamingMode ? streamingVoice.subtitles.state.hasTargetContent : undefined}
          streamingWordIndex={useStreamingMode ? streamingVoice.subtitles.state.currentWordIndex : undefined}
          streamingVisibleWordCount={useStreamingMode ? streamingVoice.subtitles.state.visibleWordCount : undefined}
          streamingTargetWordIndex={useStreamingMode ? streamingVoice.subtitles.state.currentTargetWordIndex : undefined}
          isWaitingForContent={useStreamingMode ? streamingVoice.subtitles.state.isWaitingForContent : undefined}
          getIsWaitingForContent={useStreamingMode ? streamingVoice.subtitles.getIsWaitingForContent : undefined}
          activeBlockIndex={useStreamingMode ? streamingVoice.subtitles.state.activeBlockIndex : undefined}
          activeBlockText={useStreamingMode ? streamingVoice.subtitles.state.activeBlockText : undefined}
          teachingBlockText={useStreamingMode ? streamingVoice.subtitles.state.teachingBlockText : undefined}
          hasShownTeachingBlock={useStreamingMode ? streamingVoice.subtitles.state.hasShownTeachingBlock : undefined}
          voiceSpeed={voiceSpeed}
          setTutorGender={(gender) => {
            setTutorGender(gender);
            // Also update the voice in the active streaming session
            if (useStreamingMode) {
              streamingVoice.updateVoice(gender);
            }
          }}
          setVoiceSpeed={setVoiceSpeed}
          femaleVoiceName={getVoiceFirstName(tutorVoices?.female?.name, "Female")}
          maleVoiceName={getVoiceFirstName(tutorVoices?.male?.name, "Male")}
          baseSpeakingRate={tutorGender === 'male' 
            ? (tutorVoices?.male?.speakingRate ?? 1.0) 
            : (tutorVoices?.female?.speakingRate ?? 1.0)}
          isDeveloper={isDeveloper || isAdmin}
          classId={classId}
          onReloadCredits={() => reloadCreditsMutation.mutate()}
          onResetData={() => resetDataMutation.mutate()}
          isReloadingCredits={reloadCreditsMutation.isPending}
          isResettingData={resetDataMutation.isPending}
        />
      </div>
    </div>
  );
}
