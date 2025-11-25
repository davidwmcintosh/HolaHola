import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { type Message } from "@shared/schema";
import { processVoiceMessage, synthesizeSpeech, requestSlowRepeat, type WordTiming } from "@/lib/restVoiceApi";
import { InstructorAvatar, type AvatarState } from "@/components/InstructorAvatar";
import { CompactDifficultyControl } from "@/components/CompactDifficultyControl";
import { LanguageSelector } from "@/components/LanguageSelector";
import { queryClient } from "@/lib/queryClient";
import { VoiceChatViewManager } from "@/components/VoiceChatViewManager";

// Module-level set to track greetings played this session
// Persists across component unmounts/remounts (fixes double-greeting on mobile apps)
const playedGreetingsThisSession = new Set<string>();

interface RestVoiceChatProps {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  setCurrentConversationOnboarding: (isOnboarding: boolean | null) => void;
}

export function RestVoiceChat({ conversationId, setConversationId, setCurrentConversationOnboarding }: RestVoiceChatProps) {
  const { language, difficulty, setLanguage, subtitleMode } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
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
  
  // Silence detection refs (only for auto-stop mode)
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep refs updated with current state
  useEffect(() => {
    currentConversationRef.current = conversationId;
    isRecordingRef.current = isRecording;
    isProcessingRef.current = isProcessing;
  }, [conversationId, isRecording, isProcessing]);

  // Fetch existing messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new Audio();
    return () => {
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = null;
    };
  }, []);
  
  // Pre-warm Deepgram connection to avoid cold-start latency on first recording
  useEffect(() => {
    const warmDeepgram = async () => {
      try {
        const response = await fetch('/api/voice/warm', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await response.json();
        if (data.warmed) {
          console.log(`[VOICE] Deepgram pre-warmed in ${data.latency}ms`);
        }
      } catch (error) {
        // Warming is optional - don't block on failure
        console.log('[VOICE] Pre-warming skipped');
      }
    };
    warmDeepgram();
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

  // Auto-play greeting message in new conversations
  useEffect(() => {
    // Only process if we have messages and conversation ID
    if (!conversationId || !messages || messages.length === 0) return;
    
    // Don't play greeting if already recording or processing
    if (isRecording || isProcessing) return;
    
    // Check if we already played this conversation's greeting (module-level check)
    // This prevents double-greeting on mobile apps where component remounts quickly
    if (playedGreetingsThisSession.has(conversationId)) {
      console.log('[VOICE GREETING] Already played for this conversation, skipping');
      return;
    }
    
    // Check if this is a new conversation with just a greeting (1 AI message, no user messages)
    const aiMessages = messages.filter(m => m.role === 'assistant');
    const userMessages = messages.filter(m => m.role === 'user');
    
    if (aiMessages.length === 1 && userMessages.length === 0) {
      const greetingMessage = aiMessages[0];
      const greetingConversationId = conversationId; // Capture for closure
      
      // IMMEDIATELY mark as played at module level to prevent race conditions
      // This prevents duplicate greeting synthesis when component remounts (mobile apps, React Strict Mode)
      playedGreetingsThisSession.add(greetingConversationId);
      hasPlayedGreetingRef.current = greetingConversationId;
      
      // Generate TTS for the greeting (but don't change state yet)
      // KARAOKE DISABLED: Always use Chirp HD for best voice quality
      // TODO: Re-enable when Chirp HD supports SSML mark tags for word-level timing
      // Original code: const needTimings = subtitleMode !== "off";
      const needTimings = false; // Always Chirp HD - karaoke disabled until Chirp supports SSML marks
      console.log('[VOICE GREETING] Generating greeting audio for new conversation (using Chirp HD)');
      
      // Use target language voice for consistency (Spanish voice speaks English = Spanish accent)
      // This gives immersive learning experience from the very first word
      synthesizeSpeech(greetingMessage.content, language, undefined, undefined, needTimings)
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
          
          // Store word timings for karaoke highlighting if received
          if (result.wordTimings && result.wordTimings.length > 0) {
            wordTimingsMapRef.current.set(greetingMessage.id, result.wordTimings);
            console.log('[VOICE GREETING] Stored word timings for greeting:', greetingMessage.id, result.wordTimings.length, 'words');
          }
          
          if (audioPlayerRef.current) {
            const audioUrl = URL.createObjectURL(audioBlob);
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
            
            // Set speaking state and current playing message before playing
            setAvatarState('speaking');
            setCurrentPlayingMessageId(greetingMessage.id);
            
            audioPlayerRef.current.play()
              .then(() => {
                console.log('[VOICE GREETING] Greeting audio playing');
                // Note: hasPlayedGreetingRef already set at start to prevent race conditions
              })
              .catch(err => {
                console.error('[VOICE GREETING] Failed to play greeting:', err);
                setAvatarState('idle');
                setCurrentPlayingMessageId(null);
                URL.revokeObjectURL(audioUrl);
              });
          }
        })
        .catch(err => {
          console.error('[VOICE GREETING] Failed to generate greeting audio:', err);
        });
    }
  }, [messages, conversationId, language, isProcessing, isRecording, subtitleMode]);

  // Enter key keyboard shortcut for mic button
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if Enter is pressed
      if (event.code !== 'Enter') return;
      
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
      
      // Toggle recording using push-to-talk mode
      if (isRecording) {
        console.log('[KEYBOARD] Enter pressed - stopping recording');
        stopPushToTalkRecording();
      } else {
        console.log('[KEYBOARD] Enter pressed - starting recording');
        startPushToTalkRecording();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
          setAvatarState('idle');
          
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
        console.log('[PUSH-TO-TALK] Stopped, processing audio...');
        
        // Check if this is still the active session
        const isActiveSession = mediaRecorderRef.current === sessionRecorder;
        
        // Session-safe cleanup: only touch resources that belong to THIS session
        sessionStream.getTracks().forEach(track => track.stop());
        
        // Only touch shared state if this is still the active session
        if (isActiveSession) {
          mediaRecorderRef.current = null;
          streamRef.current = null;
          setIsRecording(false);
          isRecordingRef.current = false;
          setAvatarState('idle');
          
        } else {
          console.log('[PUSH-TO-TALK] Session superseded - new recording already started');
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
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setAvatarState('listening');
      
      console.log('[PUSH-TO-TALK] Recording started - release to stop');
    } catch (err: any) {
      console.error('Failed to start push-to-talk recording:', err);
      setError(err.message || 'Failed to access microphone');
      
      cleanupRecording();
    }
  };

  const stopPushToTalkRecording = () => {
    console.log('[PUSH-TO-TALK] Releasing button, stopping recording...');
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

    try {
      // Step 1: Transcribe
      setProcessingStage('Transcribing...');
      console.log('[REST VOICE] Transcribing audio...');
      
      // Step 2: Get response
      setProcessingStage('Getting response...');
      console.log('[REST VOICE] Sending to GPT...');
      
      // Step 3: Synthesize speech
      setProcessingStage('Synthesizing speech...');
      // KARAOKE DISABLED: Always use Chirp HD for best voice quality
      // TODO: Re-enable when Chirp HD supports SSML mark tags for word-level timing
      // Original code: const needTimings = subtitleMode !== "off";
      const needTimings = false; // Always Chirp HD - karaoke disabled until Chirp supports SSML marks
      console.log('[REST VOICE] Generating speech... (using Chirp HD)');
      
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
        
        // Store word timings for subtitle synchronization - persist by message ID
        if (result.wordTimings && subtitleMode !== "off" && latestAssistantMessage) {
          wordTimingsMapRef.current.set(latestAssistantMessage.id, result.wordTimings);
          console.log('[SUBTITLES] Stored word timings for message:', latestAssistantMessage.id);
        }
        
        const audioUrl = URL.createObjectURL(result.audioBlob);
        audioPlayerRef.current.src = audioUrl;
        
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
          isProcessing={isProcessing}
          isPlaying={avatarState === 'speaking'}
          currentPlayingMessageId={currentPlayingMessageId ?? undefined}
          audioElementRef={audioPlayerRef}
          onReplay={replayLastAudio}
          canReplay={!!lastAudioBlob && !isProcessing && avatarState !== 'speaking'}
          onSlowRepeat={handleSlowRepeat}
          isSlowRepeatLoading={isSlowRepeatLoading}
          wordTimings={currentPlayingMessageId ? wordTimingsMapRef.current.get(currentPlayingMessageId) : undefined}
        />
      </div>
    </div>
  );
}
