import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2, Mic, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation, Message } from "@shared/schema";
import { InstructorAvatar, type AvatarState } from "@/components/InstructorAvatar";
import { AccentButtons } from "@/components/AccentButtons";
import { CompactDifficultyControl } from "@/components/CompactDifficultyControl";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useStreak } from "@/hooks/use-streak";
import { useToast } from "@/hooks/use-toast";

export function ChatInterface() {
  const { language, setLanguage, difficulty, userName, setUserName } = useLanguage();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousAssistantCountRef = useRef(0);
  const lastStreakRecordDateRef = useRef<string | null>(null);
  const { recordPractice } = useStreak();
  const { toast } = useToast();

  // Reset conversationId when language changes to trigger new conversation creation
  useEffect(() => {
    setConversationId(null);
  }, [language]);

  // Auto-create conversation when page loads
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  
  useEffect(() => {
    // Check if we should create a conversation
    const isOnboardingComplete = userName && userName.trim() !== "";
    const needsConversation = !conversationId && !isCreatingConversation;
    
    console.log('[AUTO-CREATE] Effect triggered - userName:', userName, 'conversationId:', conversationId, 'isCreating:', isCreatingConversation, 'isComplete:', isOnboardingComplete);
    
    if (needsConversation) {
      console.log('[AUTO-CREATE] Starting conversation creation...', isOnboardingComplete ? '(post-onboarding)' : '(onboarding)');
      setIsCreatingConversation(true);
      
      // Create conversation - either onboarding or regular with history
      apiRequest("POST", "/api/conversations", {
        language,
        difficulty,
        userName: isOnboardingComplete ? userName : null,
        title: null,
        isOnboarding: !isOnboardingComplete,
        includeConversationHistory: isOnboardingComplete, // Only include history for post-onboarding conversations
      })
        .then(res => res.json())
        .then(data => {
          console.log('[AUTO-CREATE] Conversation created:', data.id);
          setConversationId(data.id);
          setIsCreatingConversation(false);
          // Invalidate and refetch messages for the new conversation
          queryClient.invalidateQueries({ queryKey: ["/api/conversations", data.id, "messages"] });
        })
        .catch(err => {
          console.error("Failed to create conversation:", err);
          setIsCreatingConversation(false);
        });
    }
  }, [language, difficulty, userName, conversationId, isCreatingConversation]);

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
      
      // Check if conversation was switched by the AI
      if (data.switchedConversation) {
        const switched = data.switchedConversation;
        console.log('[CONVERSATION SWITCH] Switching from', switched.switchedFrom, 'to', switched.id);
        
        // Update conversationId to load the previous conversation
        setConversationId(switched.id);
        
        // Show toast notification
        toast({
          title: "Conversation Switched",
          description: `Continuing: ${switched.title || 'Previous conversation'}`,
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
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
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
      {/* Compact toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-4">
          <InstructorAvatar state={avatarState} className="w-12" />
          <div>
            <h2 className="text-lg font-semibold">Practice {languageDisplayName}</h2>
            <p className="text-xs text-muted-foreground">Chat with your AI tutor</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <LanguageSelector compact />
          <CompactDifficultyControl conversationId={conversationId} />
        </div>
      </div>

      {/* Chat area */}
      <Card className="flex flex-col flex-1 m-4 mt-0">
        <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {!conversationId ? (
            <div className="flex flex-col justify-center items-center h-full text-center text-muted-foreground p-8">
              <MessageSquare className="h-16 w-16 mb-4 opacity-50 animate-pulse" />
              <p className="text-lg font-medium mb-2">Preparing conversation...</p>
              <p className="text-sm">Your AI tutor will be with you momentarily</p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">
              <p>Start a conversation with your AI tutor!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.role}`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-2xl rounded-2xl p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-base leading-relaxed">{message.content}</p>
                    <p className="text-xs mt-2 opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={scrollRef} />
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
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
            className="resize-none min-h-12"
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
