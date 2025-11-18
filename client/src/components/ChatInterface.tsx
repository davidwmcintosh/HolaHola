import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation, Message } from "@shared/schema";
import { InstructorAvatar, type AvatarState } from "@/components/InstructorAvatar";
import { AccentButtons } from "@/components/AccentButtons";
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

  // Create or reuse conversation when language/difficulty changes
  // NOTE: userName is NOT in dependencies - changing the name during onboarding
  // should NOT create a new conversation
  useEffect(() => {
    const getOrCreateConversation = async () => {
      try {
        const response = await apiRequest("POST", "/api/conversations", {
          language,
          difficulty,
          userName: userName || "Student",
        });
        const data = await response.json();
        setConversationId(data.id);
      } catch (error) {
        console.error("Failed to create conversation:", error);
      }
    };
    
    getOrCreateConversation();
  }, [language, difficulty]);

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
      
      // Check if conversation was updated (onboarding completed or language auto-switched)
      if (data.conversationUpdated) {
        const updated = data.conversationUpdated;
        console.log('[FRONTEND] Conversation updated:', updated);
        
        // Update language context if language changed
        if (updated.language && updated.language !== language) {
          console.log('[FRONTEND] Updating language context:', language, '->', updated.language);
          setLanguage(updated.language);
        }
        
        // Update userName in context if name was extracted
        if (updated.userName && updated.userName !== userName) {
          console.log('[FRONTEND] Updating userName context:', userName, '->', updated.userName);
          setUserName(updated.userName);
        }
      }
      
      // Record practice for streak tracking (once per day)
      try {
        const today = new Date().toDateString();
        if (lastStreakRecordDateRef.current !== today) {
          const result = await recordPractice();
          lastStreakRecordDateRef.current = today;
          
          if (result.streakIncreased) {
            toast({
              title: `🔥 ${result.newStreak} Day Streak!`,
              description: "Keep practicing daily to maintain your streak!",
            });
          }
        }
      } catch (error) {
        console.error('Failed to update streak:', error);
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
    <Card className="flex flex-col h-[600px]">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Conversation Practice</h2>
            <p className="text-sm text-muted-foreground">Practice {languageDisplayName} with AI tutor</p>
          </div>
          <InstructorAvatar state={avatarState} className="w-24" />
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {isLoading ? (
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
            placeholder="Type your message..."
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
            data-testid="input-chat-message"
          />
          <Button 
            size="icon" 
            onClick={handleSend}
            disabled={!input.trim() || sendMessageMutation.isPending}
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
  );
}
