import { useState, useEffect, useRef } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { VoiceChat } from "@/components/VoiceChat";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mic } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Chat() {
  const [mode, setMode] = useState<"text" | "voice">("voice");
  const { language, difficulty, userName } = useLanguage();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [currentConversationOnboarding, setCurrentConversationOnboarding] = useState<boolean | null>(null);
  const previousLanguageRef = useRef(language);

  // Reset conversationId when language changes to trigger new conversation creation
  // BUT NOT if we're currently in onboarding (to prevent race condition)
  useEffect(() => {
    // Only reset if language actually changed AND we're not in onboarding
    if (language !== previousLanguageRef.current && currentConversationOnboarding !== true) {
      console.log('[SHARED CHAT] Language changed from', previousLanguageRef.current, 'to', language, '- resetting conversation');
      setConversationId(null);
      previousLanguageRef.current = language;
    }
  }, [language, currentConversationOnboarding]);
  
  // Track the current conversation's onboarding status
  useEffect(() => {
    if (conversationId) {
      apiRequest("GET", `/api/conversations/${conversationId}`)
        .then(res => res.json())
        .then(data => {
          setCurrentConversationOnboarding(data.isOnboarding);
        })
        .catch(() => {
          setCurrentConversationOnboarding(null);
        });
    } else {
      setCurrentConversationOnboarding(null);
    }
  }, [conversationId]);
  
  // Auto-create shared conversation
  useEffect(() => {
    const isOnboardingComplete = userName && userName.trim() !== "";
    const needsConversation = !conversationId && !isCreatingConversation;
    const isCurrentlyOnboarding = currentConversationOnboarding === true;
    
    console.log('[SHARED CHAT] Auto-create check - userName:', userName, 'conversationId:', conversationId, 'isCreating:', isCreatingConversation);
    
    if (needsConversation && !isCurrentlyOnboarding) {
      console.log('[SHARED CHAT] Creating shared conversation...', isOnboardingComplete ? '(post-onboarding)' : '(onboarding)');
      setIsCreatingConversation(true);
      
      apiRequest("POST", "/api/conversations", {
        language,
        difficulty,
        userName: isOnboardingComplete ? userName : null,
        title: null,
        isOnboarding: !isOnboardingComplete,
        includeConversationHistory: isOnboardingComplete,
      })
        .then(res => res.json())
        .then(data => {
          console.log('[SHARED CHAT] Shared conversation created:', data.id);
          setConversationId(data.id);
          setIsCreatingConversation(false);
          queryClient.invalidateQueries({ queryKey: ["/api/conversations", data.id, "messages"] });
        })
        .catch(err => {
          console.error("[SHARED CHAT] Failed to create conversation:", err);
          setIsCreatingConversation(false);
        });
    }
  }, [language, difficulty, userName, conversationId, isCreatingConversation, currentConversationOnboarding]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-center gap-2 p-4 border-b">
        <Button
          variant={mode === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("text")}
          data-testid="button-text-mode"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Text
        </Button>
        <Button
          variant={mode === "voice" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("voice")}
          data-testid="button-voice-mode"
        >
          <Mic className="h-4 w-4 mr-2" />
          Voice
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {mode === "voice" ? (
          <VoiceChat 
            conversationId={conversationId} 
            setConversationId={setConversationId}
            setCurrentConversationOnboarding={setCurrentConversationOnboarding}
          />
        ) : (
          <ChatInterface 
            conversationId={conversationId}
            setConversationId={setConversationId}
            setCurrentConversationOnboarding={setCurrentConversationOnboarding}
          />
        )}
      </div>
    </div>
  );
}
