import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2, Mic, MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation, Message } from "@shared/schema";
import { InstructorAvatar, type AvatarState } from "@/components/InstructorAvatar";
import { AccentButtons } from "@/components/AccentButtons";
import { CompactDifficultyControl } from "@/components/CompactDifficultyControl";
import { LanguageSelector } from "@/components/LanguageSelector";
import { MessageMedia } from "@/components/MessageMedia";
import { useStreak } from "@/hooks/use-streak";
import { useToast } from "@/hooks/use-toast";

interface ChatInterfaceProps {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  setCurrentConversationOnboarding: (isOnboarding: boolean | null) => void;
}

export function ChatInterface({ conversationId, setConversationId, setCurrentConversationOnboarding }: ChatInterfaceProps) {
  const { language, setLanguage, difficulty, userName, setUserName } = useLanguage();
  const [input, setInput] = useState("");
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousAssistantCountRef = useRef(0);
  const lastStreakRecordDateRef = useRef<string | null>(null);
  const { recordPractice } = useStreak();
  const { toast } = useToast();

  // Fetch conversation metadata (includes resume info)
  const { data: conversationData } = useQuery<Conversation & { resumeMetadata?: { 
    isResuming: boolean; 
    totalMessages: number; 
    contextLimit: number; 
    lastActiveAt: string; 
  } }>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  // Fetch messages for current conversation
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        role: "user",
        content,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }
      return data;
    },
    onSuccess: async (data: any) => {
      // Mark that we're waiting for assistant response
      setWaitingForResponse(true);
      
      // Update conversation onboarding status if the server sent updated info
      if (data.conversationUpdated) {
        setCurrentConversationOnboarding(data.conversationUpdated.isOnboarding);
        console.log('[CONVERSATION UPDATE] Updated isOnboarding:', data.conversationUpdated.isOnboarding);
      }
      
      // Check if conversation was switched by the AI
      if (data.switchedConversation) {
        const switched = data.switchedConversation;
        console.log('[CONVERSATION SWITCH] Switching from', switched.switchedFrom, 'to', switched.id);
        console.log('[CONVERSATION SWITCH] Context summary:', switched.contextSummary);
        
        // Update conversationId to load the previous conversation
        setConversationId(switched.id);
        
        // Show toast notification with context summary if available
        toast({
          title: switched.title || 'Resuming Previous Conversation',
          description: switched.contextSummary || `Continuing: ${switched.title || 'Previous conversation'}`,
          duration: 8000, // Longer duration for context summary
        });
        
        // Messages will auto-reload via the queryKey change
        return; // Skip the rest of processing since we're switching conversations
      }
      
      // Check if conversation was updated (onboarding completed or language auto-switched)
      let skipStreakRecording = false;
      if (data.conversationUpdated) {
        const updated = data.conversationUpdated;
        console.log('[FRONTEND] Conversation updated:', updated);
        
        // Skip streak recording if still in onboarding OR if language just changed (onboarding completion)
        const languageJustChanged = updated.language && updated.language !== language;
        skipStreakRecording = updated.isOnboarding || languageJustChanged;
        
        // Update language context if language changed
        if (languageJustChanged) {
          console.log('[FRONTEND] Updating language context:', language, '->', updated.language);
          setLanguage(updated.language);
        }
        
        // Update userName in context if name was extracted
        if (updated.userName && updated.userName !== userName) {
          console.log('[FRONTEND] Updating userName context:', userName, '->', updated.userName);
          setUserName(updated.userName);
        }
      }
      
      // Record practice for streak tracking (once per day, only after onboarding is fully complete)
      if (!skipStreakRecording) {
        try {
          const today = new Date().toDateString();
          console.log('[STREAK] Checking streak record - lastRecorded:', lastStreakRecordDateRef.current, 'today:', today);
          if (lastStreakRecordDateRef.current !== today) {
            console.log('[STREAK] Recording practice for language:', language);
            const result = await recordPractice();
            lastStreakRecordDateRef.current = today;
            console.log('[STREAK] Practice recorded, result:', result);
            
            if (result.streakIncreased) {
              toast({
                title: `🔥 ${result.newStreak} Day Streak!`,
                description: "Keep practicing daily to maintain your streak!",
              });
            }
          } else {
            console.log('[STREAK] Already recorded practice today, skipping');
          }
        } catch (error) {
          console.error('Failed to update streak:', error);
        }
      } else {
        console.log('[STREAK] Skipping streak recording (onboarding or language change)');
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
    },
    onError: (error: Error) => {
      console.error("Failed to send message:", error);
      setWaitingForResponse(false);
    },
  });

  // Detect when assistant response arrives
  useEffect(() => {
    const assistantMessageCount = messages.filter(m => m.role === "assistant").length;
    
    if (assistantMessageCount > previousAssistantCountRef.current && waitingForResponse) {
      // New assistant message arrived, stop waiting
      setWaitingForResponse(false);
    }
    
    previousAssistantCountRef.current = assistantMessageCount;
  }, [messages, waitingForResponse]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewportRef.current && messagesEndRef.current) {
      // Smooth scroll the viewport to the bottom
      const viewport = scrollViewportRef.current;
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId) return;

    const messageContent = input;
    setInput("");
    
    await sendMessageMutation.mutateAsync(messageContent);
  };

  const handleInsertAccent = (character: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Use functional update to avoid race conditions with stale input state
    setInput((currentInput) => {
      const newValue = currentInput.substring(0, start) + character + currentInput.substring(end);
      return newValue;
    });
    
    // Restore cursor position after character insertion
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + character.length, start + character.length);
    }, 0);
  };

  // Determine avatar state based on conversation activity
  // "speaking" when AI is generating response, "idle" otherwise
  const avatarState: AvatarState = waitingForResponse ? "speaking" : "idle";

  // Get display name for current language
  const languageDisplayName = language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <div className="flex flex-col h-full">
      {/* Chat area - mobile optimized, clean interface matching voice mode */}
      <Card className="flex flex-col flex-1 m-3 md:m-4 overflow-hidden">
          <div 
            ref={scrollViewportRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar"
          >
            <div className="space-y-3 md:space-y-4">
          {!conversationId ? (
            <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground p-6 md:p-8">
              <MessageSquare className="h-12 md:h-16 w-12 md:w-16 mb-3 md:mb-4 opacity-50 animate-pulse" />
              <p className="text-base md:text-lg font-medium mb-1 md:mb-2">Preparing conversation...</p>
              <p className="text-xs md:text-sm">Your AI tutor will be with you momentarily</p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 md:h-8 w-6 md:w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">
              <p className="text-sm md:text-base">Start a conversation with your AI tutor!</p>
            </div>
          ) : (
            <>
              {/* Resume conversation indicator - Week 1 Feature */}
              {conversationData?.resumeMetadata?.isResuming && (
                <div 
                  className="mb-4 p-3 rounded-lg bg-muted/50 border border-border/50 flex items-center gap-2 text-sm"
                  data-testid="resume-indicator"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="font-medium">Resuming conversation</span>
                    <span className="text-muted-foreground">
                      · {conversationData.resumeMetadata.totalMessages} messages · Last active {
                        new Date(conversationData.resumeMetadata.lastActiveAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric'
                        })
                      }
                    </span>
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 md:gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.role}`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 md:h-10 w-8 md:w-10 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 md:h-5 w-4 md:w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[85%] md:max-w-2xl rounded-2xl p-3 md:p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm md:text-base leading-relaxed">{message.content}</p>
                    {message.role === "assistant" && message.mediaJson && (
                      <MessageMedia media={JSON.parse(message.mediaJson)} />
                    )}
                    <p className="text-xs mt-2 opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-8 md:h-10 w-8 md:w-10 flex-shrink-0">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-4 md:h-5 w-4 md:w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
            </div>
          </div>

      {/* Input area - mobile optimized */}
      <div className="p-3 md:p-4 border-t shrink-0">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder={conversationId ? "Type your message..." : "Create a conversation to start chatting"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="resize-none min-h-11 md:min-h-12 text-sm md:text-base"
            rows={1}
            disabled={!conversationId}
            data-testid="input-chat-message"
          />
          <Button 
            size="icon" 
            onClick={handleSend}
            disabled={!conversationId || !input.trim() || sendMessageMutation.isPending}
            data-testid="button-send-message"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <AccentButtons language={language} onInsert={handleInsertAccent} />
      </div>
    </Card>
    </div>
  );
}
