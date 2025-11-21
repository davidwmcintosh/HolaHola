import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Volume2, Radio } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { type Message } from "@shared/schema";
import { processVoiceMessage } from "@/lib/restVoiceApi";
import { InstructorAvatar, type AvatarState } from "@/components/InstructorAvatar";
import { CompactDifficultyControl } from "@/components/CompactDifficultyControl";
import { LanguageSelector } from "@/components/LanguageSelector";
import { queryClient } from "@/lib/queryClient";

interface RestVoiceChatProps {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  setCurrentConversationOnboarding: (isOnboarding: boolean | null) => void;
}

export function RestVoiceChat({ conversationId, setConversationId, setCurrentConversationOnboarding }: RestVoiceChatProps) {
  const { language, difficulty } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [voiceMode, setVoiceMode] = useState<'push-to-talk' | 'open-mic'>('push-to-talk');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCleaningUpRef = useRef(false); // Prevent cleanup loops
  const activeConversationRef = useRef<string | null>(null); // Track which conversation is being recorded

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

  // Open mic mode: Auto-start recording on initial load
  useEffect(() => {
    if (voiceMode === 'open-mic' && !isRecording && !isProcessing && conversationId && !isCleaningUpRef.current) {
      console.log('[OPEN MIC] Auto-starting initial recording...');
      startRecording(true);
    } else if (voiceMode === 'push-to-talk' && isRecording && !isProcessing) {
      // If switching to push-to-talk while recording, stop
      console.log('[PUSH TO TALK] Stopping recording due to mode switch');
      cleanupRecording();
    }
  }, [voiceMode, conversationId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[UNMOUNT] Cleaning up voice recording resources...');
      isCleaningUpRef.current = true; // Block any further recording attempts
      cleanupRecording();
    };
  }, []);

  // Cleanup on conversation change (but allow restart)
  useEffect(() => {
    return () => {
      if (conversationId) {
        console.log('[CONVERSATION CHANGE] Cleaning up for new conversation...');
        cleanupRecording();
        // Note: Don't set isCleaningUpRef here - we want to allow recording to restart
      }
    };
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyzerRef.current = null;
    }
    
    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    setIsRecording(false);
  };

  const startRecording = async (isOpenMic = false) => {
    // Prevent starting if already recording or cleaning up
    if (isRecording || isCleaningUpRef.current) {
      console.log('[START] Skipping - already recording or cleaning up');
      return;
    }
    
    // Wait a bit if there's a pending cleanup
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[START] Waiting for previous recorder to stop...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    try {
      setError(null);
      isCleaningUpRef.current = false;
      
      // Capture current conversation ID for this recording session
      activeConversationRef.current = conversationId;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('[RECORDER] Stopped, processing audio...');
        
        // Check if this recording is still valid for current conversation
        const recordedForConversation = activeConversationRef.current;
        const currentConversation = conversationId;
        
        // Process the recorded audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Cleanup resources before processing
        cleanupRecording();
        
        // Only process if conversation hasn't changed
        if (recordedForConversation === currentConversation && recordedForConversation) {
          console.log('[RECORDER] Processing audio for conversation:', recordedForConversation);
          await processRecording(audioBlob, recordedForConversation);
        } else {
          console.log('[RECORDER] Discarding audio - conversation changed from', recordedForConversation, 'to', currentConversation);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setAvatarState('listening');
      
      // Set up voice activity detection for open mic mode
      if (isOpenMic) {
        console.log('[OPEN MIC] Setting up voice activity detection...');
        setupVoiceActivityDetection(stream);
      }
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'Failed to access microphone');
      cleanupRecording();
    }
  };

  const setupVoiceActivityDetection = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyzer = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyzer.smoothingTimeConstant = 0.8;
      analyzer.fftSize = 1024;
      
      microphone.connect(analyzer);
      
      audioContextRef.current = audioContext;
      analyzerRef.current = analyzer;
      
      // Monitor audio levels
      monitorAudioLevel();
    } catch (err) {
      console.error('[OPEN MIC] Failed to setup VAD:', err);
    }
  };

  const monitorAudioLevel = () => {
    if (!analyzerRef.current || voiceMode !== 'open-mic') return;
    
    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkLevel = () => {
      if (!analyzerRef.current || voiceMode !== 'open-mic') return;
      
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      
      // Silence threshold (adjust as needed)
      const SILENCE_THRESHOLD = 10;
      const SILENCE_DURATION = 1500; // 1.5 seconds of silence before stopping
      
      if (average < SILENCE_THRESHOLD) {
        // User stopped talking - start silence timer
        if (!silenceTimeoutRef.current) {
          console.log('[OPEN MIC] Silence detected, starting timer...');
          silenceTimeoutRef.current = setTimeout(() => {
            console.log('[OPEN MIC] Silence duration reached, stopping recording...');
            stopRecording();
          }, SILENCE_DURATION);
        }
      } else {
        // User is talking - clear silence timer
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      }
      
      // Continue monitoring
      requestAnimationFrame(checkLevel);
    };
    
    checkLevel();
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

  const processRecording = async (audioBlob: Blob, targetConversationId: string) => {
    if (!targetConversationId || isCleaningUpRef.current) {
      console.log('[PROCESS] Skipping - no conversation or cleaning up');
      setAvatarState('idle');
      return;
    }

    setIsProcessing(true);
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
      console.log('[REST VOICE] Generating speech...');
      
      const result = await processVoiceMessage(audioBlob, targetConversationId, language);
      
      console.log('[REST VOICE] ✓ Transcript:', result.userTranscript);
      console.log('[REST VOICE] ✓ Response:', result.aiResponse);
      
      // Step 4: Play response
      setProcessingStage('Playing response...');
      setAvatarState('speaking');
      
      if (audioPlayerRef.current && result.audioBlob) {
        console.log('[REST VOICE] Audio blob size:', result.audioBlob.size, 'bytes');
        console.log('[REST VOICE] Audio blob type:', result.audioBlob.type);
        
        const audioUrl = URL.createObjectURL(result.audioBlob);
        audioPlayerRef.current.src = audioUrl;
        
        audioPlayerRef.current.onended = () => {
          console.log('[REST VOICE] Audio playback ended');
          URL.revokeObjectURL(audioUrl);
          setAvatarState('idle');
          setProcessingStage(null);
        };
        
        audioPlayerRef.current.onerror = (e) => {
          console.error('[REST VOICE] Audio playback error:', e);
          setError('Failed to play audio. The text response is still saved.');
          URL.revokeObjectURL(audioUrl);
          setAvatarState('idle');
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
          setProcessingStage(null);
        }
      } else {
        console.warn('[REST VOICE] No audio blob or audio player unavailable');
        setProcessingStage(null);
        setAvatarState('idle');
      }
      
      // Refresh messages
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", targetConversationId, "messages"],
      });
      
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
      setProcessingStage(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background" data-testid="rest-voice-chat">
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <InstructorAvatar state={avatarState} />
          <div>
            <h2 className="text-lg font-semibold">Voice Practice</h2>
            <p className="text-sm text-muted-foreground">
              {voiceMode === 'push-to-talk' ? 'Click to talk' : 'Continuous listening'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          {conversationId && <CompactDifficultyControl conversationId={conversationId} />}
        </div>
      </div>
      
      {/* Voice Mode Toggle */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-center gap-2">
        <Button
          variant={voiceMode === 'push-to-talk' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setVoiceMode('push-to-talk')}
          disabled={isProcessing}
          data-testid="button-push-to-talk"
        >
          <Mic className="h-4 w-4 mr-2" />
          Push to Talk
        </Button>
        <Button
          variant={voiceMode === 'open-mic' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setVoiceMode('open-mic')}
          disabled={isProcessing}
          data-testid="button-open-mic"
        >
          <Radio className="h-4 w-4 mr-2" />
          Open Mic
        </Button>
      </div>

      {/* Messages - matches ChatInterface.tsx layout */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="space-y-3 md:space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 md:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card className={`p-3 md:p-4 max-w-[85%] md:max-w-2xl rounded-2xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </Card>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Mic control area - inside Card like text input */}
        <div className="p-3 md:p-4 border-t shrink-0">
          {/* Error display */}
          {error && (
            <div className="mb-3 p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Processing status */}
          {processingStage && (
            <div className="mb-3 p-3 bg-accent rounded-md flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-sm">{processingStage}</p>
            </div>
          )}

          {/* Mic button */}
          <div className="flex justify-center items-center">
            <Button
              size="icon"
              variant={isRecording ? 'destructive' : 'default'}
              className="h-14 w-14 rounded-full"
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording(voiceMode === 'open-mic');
                }
              }}
              disabled={isProcessing || !conversationId}
              data-testid="button-mic-toggle"
              aria-pressed={isRecording}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
