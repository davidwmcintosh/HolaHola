/**
 * SupportAssistModal - Student-facing Support Chat Interface
 * 
 * Part of Tri-Lane Hive architecture: This modal appears when Daniela hands off
 * to the Support Agent via CALL_SUPPORT command.
 * 
 * DUAL PURPOSE:
 * 1. Live support handoffs from Daniela (voice or text)
 * 2. Offline drills/exercises voice prompts and feedback
 * 
 * Behavior:
 * - Slides in from bottom as an overlay (doesn't replace voice chat)
 * - Supports BOTH voice and text input modes
 * - Student can toggle between voice/text
 * - Uses Google Cloud TTS (Chirp HD) for voice responses
 * - Student can resolve issue and return to tutoring
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Send, 
  Loader2, 
  Headphones, 
  MessageCircle,
  CheckCircle2,
  ArrowLeft,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Keyboard,
  HeartHandshake,
  PhoneOff,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getClientDiagnosticsSnapshot } from "@/lib/streamingVoiceClient";

type InputMode = 'text' | 'voice';

interface SupportMessage {
  id: string;
  role: 'user' | 'support';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface SupportAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved?: () => void;
  ticketId: string | null;
  category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
  reason: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  mode?: 'support' | 'drill';
  drillContext?: {
    lessonId?: string;
    exerciseType?: string;
    prompt?: string;
  };
}

const categoryLabels: Record<string, string> = {
  technical: 'Technical Issue',
  account: 'Account Help',
  billing: 'Billing Question',
  content: 'Content Feedback',
  feedback: 'General Feedback',
  other: 'Other',
};

const categoryColors: Record<string, string> = {
  technical: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  account: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  billing: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  content: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
  feedback: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30',
  other: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  normal: 'bg-blue-500 text-white',
  low: 'bg-gray-400 text-white',
};

export function SupportAssistModal({
  isOpen,
  onClose,
  onResolved,
  ticketId: propTicketId,
  category,
  reason,
  priority,
  mode = 'support',
  drillContext,
}: SupportAssistModalProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [ticketId, setTicketId] = useState<string | null>(propTicketId);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const playbackSessionRef = useRef<number>(0); // Session ID for cancellation - each new playback gets a unique ID
  const { toast } = useToast();
  
  // IMPORTANT: Drill mode is currently disabled on the backend (returns 501)
  // This modal should only be used for support mode until drill sessions are implemented
  const isDrillModeDisabled = mode === 'drill';

  // Auto-create ticket when opened without one
  useEffect(() => {
    if (isOpen && !propTicketId && !ticketId && !isCreatingTicket && mode === 'support') {
      const createTicket = async () => {
        setIsCreatingTicket(true);
        try {
          const response = await apiRequest('POST', '/api/support/tickets', {
            category,
            subject: reason || 'Help request',
            description: reason || 'User requested help from voice chat',
          });
          const data = await response.json();
          if (data.id) {
            setTicketId(data.id);
            console.log('[SupportAssist] Auto-created ticket:', data.id);
          }
        } catch (error) {
          console.error('[SupportAssist] Failed to create ticket:', error);
          toast({
            variant: "destructive",
            title: "Connection Error",
            description: "Couldn't connect to support. Please try again.",
          });
        } finally {
          setIsCreatingTicket(false);
        }
      };
      createTicket();
    }
  }, [isOpen, propTicketId, ticketId, isCreatingTicket, mode, category, reason, toast]);

  // Reset ticketId when modal is closed or prop changes
  useEffect(() => {
    if (!isOpen) {
      setTicketId(null);
    } else if (propTicketId) {
      setTicketId(propTicketId);
    }
  }, [isOpen, propTicketId]);

  useEffect(() => {
    if (isOpen && reason && (ticketId || isDrillModeDisabled)) {
      // Drill mode is disabled - show informational message instead
      let initialMessage: string;
      if (isDrillModeDisabled) {
        initialMessage = "Drill mode voice/text chat is not yet available. Please use the standard drill exercises in the Lessons section. This feature is coming soon!";
      } else {
        initialMessage = `Hi, I'm Sofia! I'm here to help with any questions or issues you're having.\n\nI see you need help with: "${reason}"\n\nTell me more about what's going on, and I'll do my best to get you sorted out quickly.`;
      }
      
      setMessages([{
        id: 'initial',
        role: 'support',
        content: initialMessage,
        timestamp: new Date(),
      }]);
      setIsResolved(false);
      
      if (audioEnabled && !isDrillModeDisabled) {
        synthesizeAndPlay(initialMessage);
      }
    }
  }, [isOpen, reason, isDrillModeDisabled, ticketId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      // Increment session ID to invalidate any ongoing playback loops
      playbackSessionRef.current++;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const synthesizeAndPlay = useCallback(async (text: string) => {
    if (!audioEnabled || isDrillModeDisabled) return;
    
    // Capture current session ID at start - any increment means this playback is stale
    const mySessionId = ++playbackSessionRef.current;
    
    // Stop any currently playing audio from previous playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    try {
      setIsPlaying(true);
      
      // Split text into sentences for progressive playback
      // This allows the first sentence to play while the rest are being synthesized
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      if (sentences.length === 0) {
        setIsPlaying(false);
        return;
      }
      
      // Play sentences sequentially - first one starts immediately
      for (let i = 0; i < sentences.length; i++) {
        // Check if this playback session is still current
        if (playbackSessionRef.current !== mySessionId) {
          console.log('[SupportAssist] Playback session superseded, stopping');
          return; // Don't set isPlaying=false, newer session owns that
        }
        
        const sentence = sentences[i];
        
        // Skip very short segments (e.g., just punctuation)
        if (sentence.length < 3) continue;
        
        try {
          const response = await fetch('/api/support/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sentence, language: 'english' }),
            credentials: 'include',
          });
          
          // Check session after fetch
          if (playbackSessionRef.current !== mySessionId) return;
          
          if (!response.ok) {
            console.warn(`[SupportAssist] TTS synthesis failed for sentence ${i}, skipping`);
            continue;
          }
          
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          
          // Wait for this sentence to finish playing before moving to the next
          await new Promise<void>((resolve) => {
            // Final session check before playing
            if (playbackSessionRef.current !== mySessionId) {
              URL.revokeObjectURL(audioUrl);
              resolve();
              return;
            }
            
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            
            const cleanup = () => {
              URL.revokeObjectURL(audioUrl);
              resolve();
            };
            
            audio.onended = cleanup;
            audio.onerror = cleanup;
            audio.onpause = cleanup; // Also resolve on pause (for cancellation)
            
            audio.play().catch(cleanup);
          });
        } catch (sentenceError) {
          console.warn(`[SupportAssist] Error with sentence ${i}, continuing:`, sentenceError);
        }
      }
      
      // Only update isPlaying if we're still the current session
      if (playbackSessionRef.current === mySessionId) {
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('[SupportAssist] TTS error:', error);
      if (playbackSessionRef.current === mySessionId) {
        setIsPlaying(false);
      }
    }
  }, [audioEnabled, isDrillModeDisabled]);

  const transcribeAndSend = useCallback(async (audioBlob: Blob) => {
    // Prevent voice message in drill mode (backend returns 501)
    if (isDrillModeDisabled) {
      toast({
        variant: "destructive",
        title: "Feature Unavailable",
        description: "Drill mode voice chat is not yet available.",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('ticketId', ticketId || '');
      formData.append('category', category);
      formData.append('mode', mode);
      if (drillContext) {
        formData.append('drillContext', JSON.stringify(drillContext));
      }
      
      const response = await fetch('/api/support/voice-message', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to process voice message');
      }
      
      const data = await response.json();
      
      if (data.transcript) {
        const userMessage: SupportMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: data.transcript,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
      }
      
      if (data.reply) {
        const supportMessage: SupportMessage = {
          id: `support-${Date.now()}`,
          role: 'support',
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, supportMessage]);
        
        if (audioEnabled) {
          await synthesizeAndPlay(data.reply);
        }
      }
    } catch (error) {
      console.error('[SupportAssist] Voice message error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Couldn't process your voice message. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, category, mode, drillContext, isDrillModeDisabled, audioEnabled, synthesizeAndPlay, toast]);

  const startRecording = useCallback(async () => {
    // Prevent recording in drill mode (backend returns 501)
    if (isDrillModeDisabled) return;
    
    try {
      // Check if MediaRecorder and getUserMedia are available
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error('[SupportAssist] getUserMedia not supported');
        toast({
          variant: "destructive",
          title: "Not Supported",
          description: "Voice recording is not supported in this browser. Please use text input instead.",
        });
        return;
      }
      
      console.log('[SupportAssist] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      console.log('[SupportAssist] Microphone access granted, tracks:', stream.getAudioTracks().length);
      
      // Check for supported MIME types with fallback
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }
      console.log('[SupportAssist] Using MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('[SupportAssist] Audio chunk received, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = (event: any) => {
        console.error('[SupportAssist] MediaRecorder error:', event.error);
        toast({
          variant: "destructive",
          title: "Recording Error",
          description: "An error occurred while recording. Please try again.",
        });
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.onstop = async () => {
        console.log('[SupportAssist] Recording stopped, chunks:', audioChunksRef.current.length);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('[SupportAssist] Created blob, size:', audioBlob.size);
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size === 0) {
          console.error('[SupportAssist] Empty audio blob');
          toast({
            variant: "destructive",
            title: "Recording Empty",
            description: "No audio was captured. Please check your microphone and try again.",
          });
          return;
        }
        
        await transcribeAndSend(audioBlob);
      };
      
      // Start recording with timeslice to get ondataavailable events during recording
      mediaRecorder.start(1000);
      console.log('[SupportAssist] Recording started');
      setIsRecording(true);
    } catch (error: any) {
      console.error('[SupportAssist] Microphone error:', error);
      
      // Provide specific error messages based on the error type
      let errorMessage = "Couldn't access microphone. Please check permissions.";
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = "Microphone access was denied. Please allow microphone access in your browser settings.";
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = "No microphone found. Please connect a microphone and try again.";
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = "Microphone is busy or unavailable. Please close other apps using the microphone.";
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "Microphone doesn't meet requirements. Please try a different microphone.";
      } else if (error.name === 'SecurityError') {
        errorMessage = "Microphone access blocked for security reasons. Try using HTTPS.";
      }
      
      toast({
        variant: "destructive",
        title: "Microphone Error",
        description: errorMessage,
      });
    }
  }, [toast, isDrillModeDisabled, transcribeAndSend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[SupportAssist] Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const handleSendMessage = useCallback(async () => {
    // Prevent text message in drill mode (backend returns 501)
    if (isDrillModeDisabled) {
      toast({
        variant: "destructive",
        title: "Feature Unavailable",
        description: "Drill mode text chat is not yet available.",
      });
      return;
    }
    
    // Wait for ticket to be created
    if (!ticketId) {
      toast({
        title: "Please wait",
        description: "Connecting to support...",
      });
      return;
    }
    
    if (!inputValue.trim() || isLoading) return;

    const userMessage: SupportMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Capture client telemetry for issue debugging (especially voice issues)
      const clientTelemetry = getClientDiagnosticsSnapshot();
      
      const response = await apiRequest('POST', '/api/support/message', {
        ticketId,
        message: userMessage.content,
        category,
        mode,
        drillContext,
        clientTelemetry,
      });
      
      const data = await response.json();

      const supportMessage: SupportMessage = {
        id: `support-${Date.now()}`,
        role: 'support',
        content: data.reply || "I've noted your message. Our team will follow up shortly.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, supportMessage]);
      
      if (audioEnabled) {
        await synthesizeAndPlay(supportMessage.content);
      }
    } catch (error) {
      console.error('[SupportChat] Error sending message:', error);
      
      const fallbackMessage: SupportMessage = {
        id: `support-${Date.now()}`,
        role: 'support',
        content: "I apologize, but I'm having trouble processing your message right now. Please try again in a moment, or you can email us at support@holahola.com.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, ticketId, category, mode, drillContext, isDrillModeDisabled, audioEnabled, synthesizeAndPlay, toast]);

  const handleResolve = useCallback(async () => {
    setIsLoading(true);
    try {
      if (ticketId) {
        await apiRequest('POST', `/api/support/tickets/${ticketId}/resolve`, {});
      }
      setIsResolved(true);
      toast({
        title: "Issue Resolved",
        description: "Glad we could help! Returning you to your lesson.",
      });
      
      setTimeout(() => {
        onResolved?.();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('[SupportChat] Error resolving ticket:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Couldn't mark as resolved. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, toast, onResolved, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleAudio = () => {
    const wasEnabled = audioEnabled;
    setAudioEnabled(!audioEnabled);
    if (audioRef.current && wasEnabled) {
      // Increment session ID to invalidate ongoing playback loop
      playbackSessionRef.current++;
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleEndCall = useCallback(() => {
    // Stop any playing audio immediately
    playbackSessionRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    
    // Stop any active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    
    // Close the modal
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          data-testid="support-modal-overlay"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            data-testid="support-modal-content"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-semibold">
                    S
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold text-foreground" data-testid="text-support-title">
                    {mode === 'drill' ? 'Exercise Assistant' : 'Sofia'}
                  </h2>
                  <p className="text-xs text-muted-foreground">Support Specialist</p>
                  <div className="flex items-center gap-2">
                    {mode === 'support' && (
                      <>
                        <Badge 
                          variant="outline" 
                          className={categoryColors[category]}
                          data-testid={`badge-category-${category}`}
                        >
                          {categoryLabels[category]}
                        </Badge>
                        {priority !== 'normal' && (
                          <Badge 
                            className={priorityColors[priority]}
                            data-testid={`badge-priority-${priority}`}
                          >
                            {priority}
                          </Badge>
                        )}
                      </>
                    )}
                    {mode === 'drill' && drillContext?.exerciseType && (
                      <Badge variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30">
                        {drillContext.exerciseType}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleAudio}
                  data-testid="button-toggle-audio"
                >
                  {audioEnabled ? (
                    <Volume2 className="h-5 w-5" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
                <Button 
                  variant="destructive"
                  size="sm"
                  onClick={handleEndCall}
                  className="gap-1.5"
                  data-testid="button-end-call"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Call
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div 
              className="flex-1 min-h-0 overflow-y-auto p-4" 
              ref={scrollRef}
              data-testid="scroll-messages"
            >
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    {message.role === 'support' && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-xs font-semibold">
                          S
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-2 justify-start" data-testid="loading-indicator">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-xs font-semibold">
                        S
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-2xl px-4 py-3 rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          {isRecording ? 'Processing...' : 'Sofia is thinking...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {isPlaying && (
                  <div className="flex gap-2 justify-start" data-testid="playing-indicator">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-xs font-semibold">
                        S
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-primary/10 rounded-2xl px-4 py-2 rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 animate-pulse text-primary" />
                        <span className="text-sm text-primary">Sofia is speaking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Resolution Banner */}
            {isResolved && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 mb-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2"
                data-testid="banner-resolved"
              >
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  Issue resolved! Returning to your lesson...
                </span>
              </motion.div>
            )}

            {/* Input Mode Toggle - Hidden for disabled drill mode */}
            {!isDrillModeDisabled && (
              <div className="px-4 pt-2">
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="text" data-testid="tab-text-mode">
                      <Keyboard className="h-4 w-4 mr-2" />
                      Text
                    </TabsTrigger>
                    <TabsTrigger value="voice" data-testid="tab-voice-mode">
                      <Mic className="h-4 w-4 mr-2" />
                      Voice
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Input Area - Disabled for drill mode */}
            <div className="p-4 border-t space-y-3">
              {isDrillModeDisabled ? (
                <div className="text-center py-4">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    data-testid="button-close-drill-disabled"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Return to Lessons
                  </Button>
                </div>
              ) : inputMode === 'text' ? (
                <div className="flex gap-2">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your issue..."
                    className="min-h-[60px] resize-none"
                    disabled={isLoading || isResolved}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading || isResolved}
                    size="icon"
                    className="h-[60px] w-[60px]"
                    data-testid="button-send"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant={isRecording ? "destructive" : "default"}
                    size="lg"
                    className={`h-16 w-16 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isLoading || isResolved}
                    data-testid="button-voice-record"
                  >
                    {isRecording ? (
                      <MicOff className="h-6 w-6" />
                    ) : (
                      <Mic className="h-6 w-6" />
                    )}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {isRecording ? "Tap to stop" : "Tap to speak"}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              {mode === 'support' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                    disabled={isResolved}
                    data-testid="button-back-to-lesson"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Lesson
                  </Button>
                  <Button
                    variant="default"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleResolve}
                    disabled={isLoading || isResolved}
                    data-testid="button-mark-resolved"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Issue Resolved
                  </Button>
                </div>
              )}
              
              {mode === 'drill' && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    data-testid="button-close-drill"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Close
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SupportAssistModal;
