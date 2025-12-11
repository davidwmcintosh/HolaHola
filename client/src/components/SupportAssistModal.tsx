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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
  ticketId,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  
  // IMPORTANT: Drill mode is currently disabled on the backend (returns 501)
  // This modal should only be used for support mode until drill sessions are implemented
  const isDrillModeDisabled = mode === 'drill';

  useEffect(() => {
    if (isOpen && reason) {
      // Drill mode is disabled - show informational message instead
      let initialMessage: string;
      if (isDrillModeDisabled) {
        initialMessage = "Drill mode voice/text chat is not yet available. Please use the standard drill exercises in the Lessons section. This feature is coming soon!";
      } else {
        initialMessage = `Hi! I'm the HolaHola Support Assistant. I understand you need help with: "${reason}"\n\nI'm here to help you resolve this. What can I do for you?`;
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
  }, [isOpen, reason, isDrillModeDisabled]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
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
    
    try {
      setIsPlaying(true);
      const response = await fetch('/api/support/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: 'english' }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.warn('[SupportAssist] TTS synthesis failed, continuing without audio');
        return;
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audioRef.current.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      await audioRef.current.play();
    } catch (error) {
      console.error('[SupportAssist] TTS error:', error);
      setIsPlaying(false);
    }
  }, [audioEnabled, isDrillModeDisabled]);

  const startRecording = useCallback(async () => {
    // Prevent recording in drill mode (backend returns 501)
    if (isDrillModeDisabled) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        await transcribeAndSend(audioBlob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('[SupportAssist] Microphone error:', error);
      toast({
        variant: "destructive",
        title: "Microphone Error",
        description: "Couldn't access microphone. Please check permissions.",
      });
    }
  }, [toast, isDrillModeDisabled]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

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
      const response = await apiRequest('POST', '/api/support/message', {
        ticketId,
        message: userMessage.content,
        category,
        mode,
        drillContext,
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
    setAudioEnabled(!audioEnabled);
    if (audioRef.current && audioEnabled) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

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
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Headphones className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground" data-testid="text-support-title">
                    {mode === 'drill' ? 'Exercise Assistant' : 'Support Assistant'}
                  </h2>
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
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  data-testid="button-close-support"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea 
              className="flex-1 p-4" 
              ref={scrollRef}
              data-testid="scroll-messages"
            >
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
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
                  <div className="flex justify-start" data-testid="loading-indicator">
                    <div className="bg-muted rounded-2xl px-4 py-3 rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          {isRecording ? 'Processing...' : 'Thinking...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {isPlaying && (
                  <div className="flex justify-start" data-testid="playing-indicator">
                    <div className="bg-primary/10 rounded-2xl px-4 py-2 rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 animate-pulse text-primary" />
                        <span className="text-sm text-primary">Speaking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

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
                <div className="flex justify-center">
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
