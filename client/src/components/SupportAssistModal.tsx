/**
 * SupportAssistModal - Student-facing Support Chat Interface
 * 
 * Part of Tri-Lane Hive architecture: This modal appears when Daniela hands off
 * to the Support Agent via CALL_SUPPORT command.
 * 
 * Behavior:
 * - Slides in from bottom as an overlay (doesn't replace voice chat)
 * - Shows support ticket context and allows text-based chat
 * - Student can resolve issue and return to tutoring
 * - Supports real-time messaging via WebSocket
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
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SupportMessage {
  id: string;
  role: 'user' | 'support';
  content: string;
  timestamp: Date;
}

interface SupportAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved?: () => void;
  ticketId: string | null;
  category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
  reason: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
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
}: SupportAssistModalProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && reason) {
      setMessages([{
        id: 'initial',
        role: 'support',
        content: `Hi! I'm the HolaHola Support Assistant. I understand you need help with: "${reason}"\n\nI'm here to help you resolve this. What can I do for you?`,
        timestamp: new Date(),
      }]);
      setIsResolved(false);
    }
  }, [isOpen, reason]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
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
      });
      
      const data = await response.json();

      const supportMessage: SupportMessage = {
        id: `support-${Date.now()}`,
        role: 'support',
        content: data.reply || "I've noted your message. Our team will follow up shortly.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, supportMessage]);
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
  }, [inputValue, isLoading, ticketId, category]);

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
                  <h2 className="font-semibold text-foreground" data-testid="text-support-title">Support Assistant</h2>
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                data-testid="button-close-support"
              >
                <X className="h-5 w-5" />
              </Button>
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
                        <span className="text-sm text-muted-foreground">Thinking...</span>
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

            {/* Input Area */}
            <div className="p-4 border-t space-y-3">
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

              {/* Action Buttons */}
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SupportAssistModal;
