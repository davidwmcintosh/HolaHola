import { useState, useEffect, useRef } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { RestVoiceChat as VoiceChat } from "@/components/RestVoiceChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Mic, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSidebar } from "@/components/ui/sidebar";

export default function Chat() {
  const [mode, setMode] = useState<"text" | "voice">("voice");
  const { language, difficulty, userName } = useLanguage();
  const { setOpen, setOpenMobile } = useSidebar();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [currentConversationOnboarding, setCurrentConversationOnboarding] = useState<boolean | null>(null);
  const previousModeRef = useRef<"text" | "voice">("voice");
  // Check localStorage to see if user clicked "New Chat" before page reload
  // Default to false so page reloads reuse existing conversations
  const [forceNewConversation, setForceNewConversation] = useState(() => {
    const stored = localStorage.getItem('forceNewConversation');
    if (stored === 'true') {
      localStorage.removeItem('forceNewConversation'); // Clear immediately after reading
      return true;
    }
    // Default to false - reuse existing conversation on page load
    return false;
  });
  const [isReloading, setIsReloading] = useState(false); // Smooth transition for page reload
  const previousLanguageRef = useRef(language);
  const creationInProgressRef = useRef(false); // Prevent duplicate conversation creation

  // Auto-close sidebar when entering voice chat area
  // This runs once on mount - works for Call Tutor, New Chat, and Start Practicing
  useEffect(() => {
    setOpen(false);      // Close desktop sidebar
    setOpenMobile(false); // Close mobile sidebar
  }, [setOpen, setOpenMobile]);

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
  
  // Reset conversationId when mode changes to trigger new conversation creation with correct mode
  // Only reset if conversation is empty (no messages) to avoid losing user's conversation
  useEffect(() => {
    if (mode !== previousModeRef.current && conversationId) {
      console.log('[SHARED CHAT] Mode changed from', previousModeRef.current, 'to', mode, '- checking if conversation is empty');
      // Check if current conversation has any messages
      apiRequest("GET", `/api/conversations/${conversationId}/messages`)
        .then(res => res.json())
        .then(messages => {
          if (messages.length === 0) {
            console.log('[SHARED CHAT] Conversation is empty - resetting to create new conversation with mode:', mode);
            setConversationId(null);
          } else {
            console.log('[SHARED CHAT] Conversation has', messages.length, 'messages - keeping existing conversation');
          }
          previousModeRef.current = mode;
        })
        .catch(err => {
          console.error('[SHARED CHAT] Failed to check messages:', err);
          previousModeRef.current = mode;
        });
    } else if (mode !== previousModeRef.current) {
      // No conversation yet, just update the ref
      previousModeRef.current = mode;
    }
  }, [mode, conversationId]);
  
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
    
    console.log('[SHARED CHAT] Auto-create check - userName:', userName, 'conversationId:', conversationId, 'isCreating:', isCreatingConversation, 'inProgress:', creationInProgressRef.current, 'mode:', mode);
    
    if (needsConversation && !isCurrentlyOnboarding) {
      console.log('[SHARED CHAT] Creating shared conversation...', isOnboardingComplete ? '(post-onboarding)' : '(onboarding)', 'forceNew:', forceNewConversation, 'mode:', mode);
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
        mode, // Pass current mode (text or voice) to backend for greeting logic
      })
        .then(res => res.json())
        .then(data => {
          console.log('[SHARED CHAT] Shared conversation created:', data.id, 'mode:', mode);
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
  }, [language, difficulty, userName, conversationId, isCreatingConversation, currentConversationOnboarding, forceNewConversation, mode]);

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
      
      {/* Header - Mode Toggle visible in both voice and text modes */}
      <div className="flex items-center justify-between gap-2 p-4 border-b">
        <div className="flex items-center gap-3">
          {/* Voice button - prominent and primary */}
          <Button
            variant={mode === "voice" ? "default" : "outline"}
            size="default"
            onClick={() => setMode("voice")}
            data-testid="button-voice-mode"
          >
            <Mic className="h-4 w-4 mr-2" />
            Voice Learning
            {mode === "voice" && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Recommended
              </Badge>
            )}
          </Button>
          
          {/* Text button - subtle fallback option */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("text")}
            data-testid="button-text-mode"
            className="text-muted-foreground"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Type instead
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
      <div className="flex-1 min-h-0">
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
