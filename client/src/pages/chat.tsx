import { useState, useEffect, useRef } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { VoiceChat } from "@/components/VoiceChat";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mic, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Chat() {
  const [mode, setMode] = useState<"text" | "voice">("voice");
  const { language, difficulty, userName } = useLanguage();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [currentConversationOnboarding, setCurrentConversationOnboarding] = useState<boolean | null>(null);
  // Check localStorage to see if user clicked "New Chat" before page reload
  const [forceNewConversation, setForceNewConversation] = useState(() => {
    const stored = localStorage.getItem('forceNewConversation');
    if (stored === 'true') {
      localStorage.removeItem('forceNewConversation'); // Clear immediately after reading
      return true;
    }
    return false;
  });
  const [isReloading, setIsReloading] = useState(false); // Smooth transition for page reload
  const previousLanguageRef = useRef(language);
  const creationInProgressRef = useRef(false); // Prevent duplicate conversation creation

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
    const needsConversation = !conversationId && !isCreatingConversation && !creationInProgressRef.current;
    const isCurrentlyOnboarding = currentConversationOnboarding === true;
    
    console.log('[SHARED CHAT] Auto-create check - userName:', userName, 'conversationId:', conversationId, 'isCreating:', isCreatingConversation, 'inProgress:', creationInProgressRef.current);
    
    if (needsConversation && !isCurrentlyOnboarding) {
      console.log('[SHARED CHAT] Creating shared conversation...', isOnboardingComplete ? '(post-onboarding)' : '(onboarding)');
      setIsCreatingConversation(true);
      creationInProgressRef.current = true; // Set flag to prevent duplicate creation
      
      apiRequest("POST", "/api/conversations", {
        language,
        difficulty,
        userName: isOnboardingComplete ? userName : null,
        title: null,
        isOnboarding: !isOnboardingComplete,
        includeConversationHistory: isOnboardingComplete,
        forceNew: forceNewConversation, // Force new conversation if user clicked "New Chat"
      })
        .then(res => res.json())
        .then(data => {
          console.log('[SHARED CHAT] Shared conversation created:', data.id);
          setConversationId(data.id);
          setIsCreatingConversation(false);
          creationInProgressRef.current = false; // Clear flag on success
          setForceNewConversation(false); // Reset forceNew flag after creating conversation
          queryClient.invalidateQueries({ queryKey: ["/api/conversations", data.id, "messages"] });
        })
        .catch(err => {
          console.error("[SHARED CHAT] Failed to create conversation:", err);
          setIsCreatingConversation(false);
          creationInProgressRef.current = false; // Clear flag on error
          setForceNewConversation(false); // Reset forceNew flag on error
        });
    }
  }, [language, difficulty, userName, conversationId, isCreatingConversation, currentConversationOnboarding, forceNewConversation]);

  const handleNewChat = () => {
    console.log('[SHARED CHAT] User requested new chat - forcing new conversation');
    // Set flag in localStorage to force new conversation after reload
    localStorage.setItem('forceNewConversation', 'true');
    // Show smooth transition before reload
    setIsReloading(true);
    // Brief delay to show the transition, then reload
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Smooth loading overlay for page reload */}
      {isReloading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4" />
            <p className="text-lg font-medium">Starting new conversation...</p>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between gap-2 p-4 border-b">
        <div className="flex items-center gap-2">
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          data-testid="button-new-chat"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
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
