import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { ChatInterface } from "@/components/ChatInterface";
import { StreamingVoiceChat as VoiceChat } from "@/components/StreamingVoiceChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Mic, Plus, GraduationCap, User, Phone, Heart, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { apiRequest, queryClient, forceNewConversation as setForceNewFlag } from "@/lib/queryClient";
import { useSidebar } from "@/components/ui/sidebar";
import { CreditBalance } from "@/components/CreditBalance";
import { useCredits } from "@/contexts/UsageContext";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DevToolsFloatingMenu } from "@/components/DevToolsFloatingMenu";

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
  
  // Cross-language handoff state - prevents white screen during tutor switch
  const [isLanguageHandoff, setIsLanguageHandoff] = useState(false);
  const [handoffTutorName, setHandoffTutorName] = useState<string | null>(null);
  const languageHandoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track both prior and target languages during handoff for proper cleanup
  const handoffPriorLanguageRef = useRef<string | null>(null);
  const handoffTargetLanguageRef = useRef<string | null>(null);
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
  
  // Session-level lock for conversation creation (survives remounts/HMR)
  // Uses timestamp to auto-expire after 10 seconds (handles stale locks from crashes)
  const isSessionLocked = () => {
    const lock = sessionStorage.getItem('conversationCreationLock');
    if (!lock) return false;
    const lockTime = parseInt(lock, 10);
    // Lock expires after 10 seconds
    return Date.now() - lockTime < 10000;
  };
  const acquireSessionLock = () => {
    sessionStorage.setItem('conversationCreationLock', Date.now().toString());
  };
  const releaseSessionLock = () => {
    sessionStorage.removeItem('conversationCreationLock');
  };
  
  // Check if we're in class mode (learning context is a class ID, not a filter option)
  const isInClassMode = learningContext !== "self-directed" && 
                        learningContext !== "all" && 
                        learningContext !== "all-classes" && 
                        learningContext !== "all-learning" &&
                        learningContext !== "founder-mode" &&
                        learningContext !== "honesty-mode";
  
  // Check if we're in Founder Mode (developer-only open collaboration)
  const isFounderMode = learningContext === "founder-mode";
  
  // Check if we're in Honesty Mode (minimal prompting for authentic exploration)
  const isHonestyMode = learningContext === "honesty-mode";

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

  // Handle cross-language handoff - callback passed to VoiceChat
  // This shows a transition screen and delays conversation reset
  const handleLanguageHandoff = useCallback((tutorName: string, targetLanguage: string) => {
    console.log('[SHARED CHAT] Cross-language handoff started:', tutorName, 'in', targetLanguage);
    setIsLanguageHandoff(true);
    setHandoffTutorName(tutorName);
    // Track both prior and target languages for proper cleanup
    handoffPriorLanguageRef.current = previousLanguageRef.current;
    handoffTargetLanguageRef.current = targetLanguage;
    
    // Clear any existing timeout
    if (languageHandoffTimeoutRef.current) {
      clearTimeout(languageHandoffTimeoutRef.current);
    }
    
    // Safety timeout: fully reset handoff state after 10 seconds if something goes wrong
    // This includes releasing locks and resetting conversation to ensure proper cleanup
    languageHandoffTimeoutRef.current = setTimeout(() => {
      console.log('[SHARED CHAT] Handoff timeout - fully resetting state, releasing locks, and resetting conversation');
      setIsLanguageHandoff(false);
      setHandoffTutorName(null);
      // Sync ref to the target language we're transitioning to
      // The language context has already been updated, so set ref to target
      // This ensures future language changes are detected correctly
      if (handoffTargetLanguageRef.current) {
        previousLanguageRef.current = handoffTargetLanguageRef.current;
      }
      handoffPriorLanguageRef.current = null;
      handoffTargetLanguageRef.current = null;
      // Release locks to prevent permanent lockout
      releaseSessionLock();
      creationInProgressRef.current = false;
      // Reset conversation to create new one in the new language
      // This ensures user isn't stuck in old conversation after failed handoff
      setConversationId(null);
    }, 10000);
  }, []);
  
  // Complete the handoff by resetting conversation ID after transition
  const completeLanguageHandoff = useCallback(() => {
    console.log('[SHARED CHAT] Completing language handoff - resetting conversation');
    
    // Clear the timeout
    if (languageHandoffTimeoutRef.current) {
      clearTimeout(languageHandoffTimeoutRef.current);
      languageHandoffTimeoutRef.current = null;
    }
    
    // Update the ref FIRST to prevent the language-change effect from firing
    // Use tracked target language if available, otherwise use current language state
    previousLanguageRef.current = handoffTargetLanguageRef.current || language;
    handoffPriorLanguageRef.current = null;
    handoffTargetLanguageRef.current = null;
    
    // Release locks to allow new conversation creation
    releaseSessionLock();
    creationInProgressRef.current = false;
    
    // Reset conversation to trigger new creation in new language
    setConversationId(null);
    setIsLanguageHandoff(false);
    setHandoffTutorName(null);
  }, [language]);
  
  // Reset conversationId when language changes to trigger new conversation creation
  // BUT NOT if we're currently in onboarding OR during a cross-language handoff
  useEffect(() => {
    // Skip during handoff - the handoff flow manages conversation reset
    if (isLanguageHandoff) {
      console.log('[SHARED CHAT] Language changed during handoff - skipping reset (handoff manages it)');
      previousLanguageRef.current = language;
      return;
    }
    
    // Only reset if language actually changed AND we're not in onboarding
    if (language !== previousLanguageRef.current && currentConversationOnboarding !== true) {
      console.log('[SHARED CHAT] Language changed from', previousLanguageRef.current, 'to', language, '- resetting conversation');
      setConversationId(null);
      previousLanguageRef.current = language;
    }
  }, [language, currentConversationOnboarding, isLanguageHandoff]);
  
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
    
    // ATOMIC check-and-set: Check both ref AND session lock to handle:
    // 1. Same component instance (ref)
    // 2. Vite HMR remounts / React StrictMode double-mounts (sessionStorage)
    if (creationInProgressRef.current || isSessionLocked()) {
      console.log('[SHARED CHAT] Auto-create check - skipped (already in progress or session locked)');
      return;
    }
    
    const needsConversation = !conversationId && !isCreatingConversation;
    
    console.log('[SHARED CHAT] Auto-create check - userName:', userName, 'conversationId:', conversationId, 'isCreating:', isCreatingConversation, 'mode:', mode);
    
    if (needsConversation && !isCurrentlyOnboarding) {
      // Set BOTH locks FIRST before any async work to prevent race conditions
      creationInProgressRef.current = true;
      acquireSessionLock();
      
      // Use class ID from learning context if in class mode
      const selectedClassId = isInClassMode ? learningContext : undefined;
      
      console.log('[SHARED CHAT] Creating shared conversation...', isOnboardingComplete ? '(post-onboarding)' : '(onboarding)', 'forceNew:', forceNewConversation, 'mode:', mode, 'classId:', selectedClassId, 'founderMode:', isFounderMode);
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
        founderMode: isFounderMode, // Enable Founder Mode for developer open collaboration
      })
        .then(res => res.json())
        .then(async (data) => {
          console.log('[SHARED CHAT] Shared conversation created:', data.id, 'classId:', data.classId, 'mode:', mode);
          setConversationId(data.id);
          setIsCreatingConversation(false);
          // NOTE: We intentionally do NOT reset creationInProgressRef or session lock here
          // This ensures only ONE conversation is created per page load
          // The ref will reset on page navigation, session lock expires after 10s
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
          releaseSessionLock(); // Release session lock on error to allow retry
          setForceNewConversation(false); // Reset forceNew flag on error
        });
    }
    // NOTE: forceNewConversation is intentionally NOT in dependencies
    // We only read its current value when creating, we don't need to re-run when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, difficulty, userName, conversationId, isCreatingConversation, currentConversationOnboarding, mode]);

  const handleNewChat = () => {
    console.log('[SHARED CHAT] User requested new chat - forcing new conversation');
    // Clear session lock to allow new conversation creation after reload
    releaseSessionLock();
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
      
      {/* Cross-language handoff overlay - shows during tutor switch to new language */}
      {isLanguageHandoff && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-300">
          <div className="text-center space-y-4">
            <Phone className="h-12 w-12 mx-auto text-primary animate-pulse" />
            <div className="space-y-2">
              <p className="text-xl font-semibold">Connecting to {handoffTutorName || 'new tutor'}...</p>
              <p className="text-muted-foreground">Switching languages</p>
            </div>
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
                className={`flex items-center gap-1 text-xs ${isHonestyMode ? 'border-rose-500/50 text-rose-600 dark:text-rose-400' : isFounderMode ? 'border-amber-500/50 text-amber-600 dark:text-amber-400' : ''}`}
                data-testid="badge-practice-mode"
              >
                {isHonestyMode ? (
                  <>
                    <Heart className="h-3 w-3" />
                    <span className="hidden sm:inline">Honesty Mode</span>
                    <span className="sm:hidden">Honesty</span>
                  </>
                ) : isFounderMode ? (
                  <>
                    <Sparkles className="h-3 w-3" />
                    <span className="hidden sm:inline">Founder Mode</span>
                    <span className="sm:hidden">Founder</span>
                  </>
                ) : isInClassMode ? (
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
              <p>{isHonestyMode 
                  ? 'Honesty Mode: Minimal prompting for authentic exploration'
                  : isFounderMode 
                  ? 'Founder Mode: Open collaboration with Daniela'
                  : isInClassMode 
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
            onLanguageHandoff={handleLanguageHandoff}
            onLanguageHandoffComplete={completeLanguageHandoff}
          />
        ) : (
          <ChatInterface 
            conversationId={conversationId}
            setConversationId={setConversationId}
            setCurrentConversationOnboarding={setCurrentConversationOnboarding}
          />
        )}
      </div>
      
      {/* Developer testing tools - shows conversation ID and developer actions */}
      <DevToolsFloatingMenu 
        classId={isInClassMode ? learningContext : null}
        conversationId={conversationId}
        onCreditsReloaded={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/usage/status"] });
        }}
        onDataReset={() => {
          setConversationId(null);
          setForceNewConversation(true);
        }}
      />
    </div>
  );
}
