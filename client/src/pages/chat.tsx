import { useState, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { ChatInterface } from "@/components/ChatInterface";
import { StreamingVoiceChat as VoiceChat } from "@/components/StreamingVoiceChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Mic, Plus, GraduationCap, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { apiRequest, queryClient, forceNewConversation as setForceNewFlag } from "@/lib/queryClient";
import { useSidebar } from "@/components/ui/sidebar";
import { CreditBalance } from "@/components/CreditBalance";
import { useCredits } from "@/contexts/UsageContext";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Chat() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"text" | "voice">("voice");
  const { language, difficulty, userName } = useLanguage();
  const { learningContext, getSelectedClassName } = useLearningFilter();
  const { setOpen, setOpenMobile } = useSidebar();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isResumedConversation, setIsResumedConversation] = useState(false);
  const resumeHandledRef = useRef(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [currentConversationOnboarding, setCurrentConversationOnboarding] = useState<boolean | null>(null);
  const previousModeRef = useRef<"text" | "voice">("voice");
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const { isExhausted, isLow, isCritical } = useCredits();
  const [className, setClassName] = useState<string | null>(null);
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
  
  // Check if we're in class mode (learning context is a class ID, not a filter option)
  const isInClassMode = learningContext !== "self-directed" && 
                        learningContext !== "all" && 
                        learningContext !== "all-classes" && 
                        learningContext !== "all-learning";

  // Auto-close sidebar when entering voice chat area
  // This runs ONLY ONCE on initial mount - works for Call Tutor, New Chat, and Start Practicing
  // Empty dependency array ensures user can reopen sidebar after initial close
  const hasClosedSidebarRef = useRef(false);
  useEffect(() => {
    if (!hasClosedSidebarRef.current) {
      hasClosedSidebarRef.current = true;
      setOpen(false);      // Close desktop sidebar
      setOpenMobile(false); // Close mobile sidebar
    }
  }, [setOpen, setOpenMobile]);

  // Handle resume parameter from URL - allows resuming a specific conversation
  useEffect(() => {
    if (resumeHandledRef.current) return;
    
    const params = new URLSearchParams(search);
    const resumeId = params.get('resume');
    
    if (resumeId) {
      console.log('[SHARED CHAT] Resuming conversation from URL:', resumeId);
      resumeHandledRef.current = true;
      setConversationId(resumeId);
      setIsResumedConversation(true); // Mark as resumed to trigger welcome-back greeting
      // Clear the URL parameter to avoid re-resuming on refresh
      setLocation('/chat', { replace: true });
    }
  }, [search, setLocation]);

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
  
  // Track the current conversation's onboarding status and class info
  useEffect(() => {
    if (conversationId) {
      apiRequest("GET", `/api/conversations/${conversationId}`)
        .then(res => res.json())
        .then(async (data) => {
          setCurrentConversationOnboarding(data.isOnboarding);
          
          // Fetch class info if conversation has a classId
          if (data.classId) {
            try {
              const classRes = await apiRequest("GET", `/api/classes/${data.classId}`);
              const classData = await classRes.json();
              setClassName(classData.name || null);
            } catch {
              setClassName(null);
            }
          } else {
            setClassName(null);
          }
        })
        .catch(() => {
          setCurrentConversationOnboarding(null);
          setClassName(null);
        });
    } else {
      setCurrentConversationOnboarding(null);
      setClassName(null);
    }
  }, [conversationId]);
  
  // Auto-create shared conversation
  useEffect(() => {
    const isOnboardingComplete = userName && userName.trim() !== "";
    const isCurrentlyOnboarding = currentConversationOnboarding === true;
    
    // ATOMIC check-and-set: We must set the ref BEFORE checking other conditions
    // to prevent race conditions when React batches multiple useEffect calls
    if (creationInProgressRef.current) {
      console.log('[SHARED CHAT] Auto-create check - skipped (already in progress)');
      return;
    }
    
    const needsConversation = !conversationId && !isCreatingConversation;
    
    console.log('[SHARED CHAT] Auto-create check - userName:', userName, 'conversationId:', conversationId, 'isCreating:', isCreatingConversation, 'mode:', mode);
    
    if (needsConversation && !isCurrentlyOnboarding) {
      // Set ref FIRST before any async work to prevent race conditions
      creationInProgressRef.current = true;
      
      // Use class ID from learning context if in class mode
      const selectedClassId = isInClassMode ? learningContext : undefined;
      
      console.log('[SHARED CHAT] Creating shared conversation...', isOnboardingComplete ? '(post-onboarding)' : '(onboarding)', 'forceNew:', forceNewConversation, 'mode:', mode, 'classId:', selectedClassId);
      setIsCreatingConversation(true);
      
      apiRequest("POST", "/api/conversations", {
        language,
        difficulty,
        userName: isOnboardingComplete ? userName : null,
        title: null,
        isOnboarding: !isOnboardingComplete,
        includeConversationHistory: isOnboardingComplete,
        forceNew: forceNewConversation, // Force new conversation if user clicked "New Chat"
        mode, // Pass current mode (text or voice) to backend for greeting logic
        classId: selectedClassId, // Pass selected class from learning context
      })
        .then(res => res.json())
        .then(async (data) => {
          console.log('[SHARED CHAT] Shared conversation created:', data.id, 'classId:', data.classId, 'mode:', mode);
          setConversationId(data.id);
          setIsCreatingConversation(false);
          // NOTE: We intentionally do NOT reset creationInProgressRef here
          // This ensures only ONE conversation is created per page load
          // The ref will reset on page navigation or reload
          setForceNewConversation(false); // Reset forceNew flag after creating conversation
          queryClient.invalidateQueries({ queryKey: ["/api/conversations", data.id, "messages"] });
          
          // Immediately set class name if conversation has a classId
          if (data.classId) {
            try {
              const classRes = await apiRequest("GET", `/api/classes/${data.classId}`);
              const classData = await classRes.json();
              console.log('[SHARED CHAT] Linked to class:', classData.name);
              setClassName(classData.name || null);
            } catch {
              setClassName(null);
            }
          } else {
            setClassName(null);
          }
        })
        .catch(err => {
          console.error("[SHARED CHAT] Failed to create conversation:", err);
          setIsCreatingConversation(false);
          creationInProgressRef.current = false; // Only clear on error to allow retry
          setForceNewConversation(false); // Reset forceNew flag on error
        });
    }
    // NOTE: forceNewConversation is intentionally NOT in dependencies
    // We only read its current value when creating, we don't need to re-run when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, difficulty, userName, conversationId, isCreatingConversation, currentConversationOnboarding, mode]);

  const handleNewChat = () => {
    console.log('[SHARED CHAT] User requested new chat - forcing new conversation');
    // Use shared utility to set force flag
    setForceNewFlag();
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
      <div className="flex flex-wrap items-center justify-center md:justify-between gap-2 p-3 md:p-4 border-b">
        <div className="flex items-center gap-2">
          {/* Voice button - prominent and primary */}
          <Button
            variant={mode === "voice" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("voice")}
            data-testid="button-voice-mode"
          >
            <Mic className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Voice Learning</span>
            {mode === "voice" && (
              <Badge variant="secondary" className="ml-1 md:ml-2 text-xs hidden sm:inline">
                Best
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
            <MessageSquare className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Type instead</span>
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Class or Self-Directed indicator - uses learning context for immediate display */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="flex items-center gap-1 text-xs"
                data-testid="badge-practice-mode"
              >
                {isInClassMode ? (
                  <>
                    <GraduationCap className="h-3 w-3" />
                    <span className="hidden sm:inline max-w-[120px] truncate">{getSelectedClassName()}</span>
                    <span className="sm:hidden">Class</span>
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3" />
                    <span className="hidden sm:inline">Self-Directed</span>
                    <span className="sm:hidden">Solo</span>
                  </>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isInClassMode 
                  ? `Practicing in: ${getSelectedClassName()}` 
                  : 'Self-Directed Practice'}</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Credit balance display - only in voice mode */}
          {mode === "voice" && (
            <CreditBalance 
              variant="compact" 
              showWarning={false}
            />
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            data-testid="button-new-chat"
          >
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">New Chat</span>
          </Button>
        </div>
      </div>
      
      {/* Insufficient credits dialog */}
      <InsufficientCreditsDialog
        open={showInsufficientCreditsDialog}
        onOpenChange={setShowInsufficientCreditsDialog}
      />
      <div className="flex-1 min-h-0">
        {mode === "voice" ? (
          <VoiceChat 
            conversationId={conversationId} 
            setConversationId={setConversationId}
            setCurrentConversationOnboarding={setCurrentConversationOnboarding}
            isResumedConversation={isResumedConversation}
            onResumeHandled={() => setIsResumedConversation(false)}
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
