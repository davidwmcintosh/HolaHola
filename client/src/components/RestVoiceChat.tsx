import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeConversationRef = useRef<string | null>(null);

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

  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      console.log('[CLEANUP] Cleaning up voice recording resources...');
      cleanupRecording();
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
    
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (isRecording) return;
    
    try {
      setError(null);
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
        
        const recordedForConversation = activeConversationRef.current;
        const currentConversation = conversationId;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        cleanupRecording();
        
        if (recordedForConversation === currentConversation && recordedForConversation) {
          await processRecording(audioBlob, recordedForConversation);
        } else {
          console.log('[RECORDER] Discarding audio - conversation changed');
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setAvatarState('listening');
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
              Click button to record
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          {conversationId && <CompactDifficultyControl conversationId={conversationId} />}
        </div>
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
                  startRecording();
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
