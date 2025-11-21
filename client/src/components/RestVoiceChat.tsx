import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Process the recorded audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processRecording(audioBlob);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setAvatarState('listening');
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    if (!conversationId) {
      setError('No active conversation');
      setAvatarState('idle');
      return;
    }

    setIsProcessing(true);
    setAvatarState('idle'); // Processing state

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
      
      const result = await processVoiceMessage(audioBlob, conversationId, language);
      
      console.log('[REST VOICE] ✓ Transcript:', result.userTranscript);
      console.log('[REST VOICE] ✓ Response:', result.aiResponse);
      
      // Step 4: Play response
      setProcessingStage('Playing response...');
      setAvatarState('speaking');
      
      if (audioPlayerRef.current) {
        const audioUrl = URL.createObjectURL(result.audioBlob);
        audioPlayerRef.current.src = audioUrl;
        
        audioPlayerRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setAvatarState('idle');
          setProcessingStage(null);
        };
        
        await audioPlayerRef.current.play();
      }
      
      // Refresh messages
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversationId, "messages"],
      });
      
    } catch (err: any) {
      console.error('[REST VOICE] Error:', err);
      
      // Provide helpful recovery guidance based on error type
      let errorMessage = err.message || 'Voice processing failed';
      let allowRetry = true;
      
      if (err.message?.includes('limit reached') || err.message?.includes('quota')) {
        errorMessage = 'Monthly voice limit reached. Please upgrade your plan or switch to text mode below.';
        allowRetry = false; // Quota errors can't be retried
      } else if (err.message?.includes('transcribe') || err.message?.includes('Whisper')) {
        errorMessage = 'Failed to transcribe audio. Try speaking more clearly or switch to text mode.';
      } else if (err.message?.includes('synthesize') || err.message?.includes('TTS')) {
        errorMessage = 'Failed to generate speech. The text response is still saved. Try refreshing or switch to text mode.';
      } else {
        errorMessage += ' Please try again or switch to text mode.';
      }
      
      setError(errorMessage);
      setAvatarState('idle');
      
      // Reset recording state so user can switch modes after quota errors
      if (!allowRetry) {
        setIsRecording(false);
      }
    } finally {
      setIsProcessing(false);
      setProcessingStage(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="rest-voice-chat">
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b bg-card/50">
        <div className="flex items-center gap-3">
          <InstructorAvatar state={avatarState} />
          <div>
            <h2 className="text-lg font-semibold">Voice Practice (NEW)</h2>
            <p className="text-sm text-muted-foreground">
              REST-based stable voice chat
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          {conversationId && <CompactDifficultyControl conversationId={conversationId} />}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card className={`p-3 max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </Card>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Error display */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Processing status */}
      {processingStage && (
        <div className="mx-4 mb-2 p-3 bg-accent rounded-md flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-sm">{processingStage}</p>
        </div>
      )}

      {/* Mic control */}
      <div className="flex justify-center items-center p-6 border-t bg-card/50">
        <Button
          size="icon"
          variant={isRecording ? 'destructive' : 'default'}
          className="h-20 w-20 rounded-full"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing || !conversationId}
          data-testid="button-mic-toggle"
        >
          {isProcessing ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>
      </div>
    </div>
  );
}
