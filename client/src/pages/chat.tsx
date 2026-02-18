import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { ChatInterface, type SupportHandoffContext } from "@/components/ChatInterface";
import { StreamingVoiceChat as VoiceChat } from "@/components/StreamingVoiceChat";
import { SupportAssistModal } from "@/components/SupportAssistModal";
import { DesktopChatLayout } from "@/components/DesktopChatLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Mic, Plus, GraduationCap, User, Phone, Heart, Sparkles, Radio, Wifi, WifiOff, Send, Loader2, ChevronRight, ChevronLeft, Brain, Code, Volume2, HelpCircle } from "lucide-react";
import { useFounderCollab } from "@/hooks/useFounderCollab";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { apiRequest, queryClient, forceNewConversation as setForceNewFlag } from "@/lib/queryClient";
import { useSidebar } from "@/components/ui/sidebar";
import { CreditBalance } from "@/components/CreditBalance";
import { useCredits } from "@/contexts/UsageContext";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DevToolsFloatingMenu } from "@/components/DevToolsFloatingMenu";
import type { WhiteboardItem, ScenarioItemData } from "@shared/whiteboard-types";
import { isScenarioItem } from "@shared/whiteboard-types";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Chat() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"text" | "voice">("voice");
  const { language, difficulty, userName } = useLanguage();
  const { learningContext, getSelectedClassName } = useLearningFilter();
  const { setOpen, setOpenMobile } = useSidebar();
  const [conversationId, setConversationId] = useState<string | null>(() => {
    // Don't restore if user explicitly wants a new conversation
    const forceNew = localStorage.getItem('forceNewConversation') === 'true';
    if (forceNew) {
      sessionStorage.removeItem('currentChatConversationId');
      return null;
    }
    // Restore conversation ID from sessionStorage on HMR/page reload
    // This prevents creating duplicate conversations when the server restarts
    const stored = sessionStorage.getItem('currentChatConversationId');
    if (stored) {
      console.log('[SHARED CHAT] Restored conversation from session:', stored);
      return stored;
    }
    return null;
  });
  const [isResumedConversation, setIsResumedConversation] = useState(false);
  const [textbookContext, setTextbookContext] = useState<string | null>(null);
  const resumeHandledRef = useRef(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isCheckingActiveSession, setIsCheckingActiveSession] = useState(true); // Start true to block auto-create until checked
  const [currentConversationOnboarding, setCurrentConversationOnboarding] = useState<boolean | null>(null);
  const previousModeRef = useRef<"text" | "voice">("voice");
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const { isExhausted, isLow, isCritical } = useCredits();
  const [className, setClassName] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  const [whiteboardItems, setWhiteboardItems] = useState<WhiteboardItem[]>([]);
  const useDesktopWhiteboard = !isMobile && mode === "voice";
  
  const [loadedScenarioData, setLoadedScenarioData] = useState<any>(null);
  const [studioImages, setStudioImages] = useState<Array<{ word: string; description: string; imageUrl: string; context?: string }>>([]);
  
  const whiteboardScenario = whiteboardItems.find(isScenarioItem)?.data as ScenarioItemData | undefined ?? null;
  const activeScenario: ScenarioItemData | null = loadedScenarioData
    ? {
        location: loadedScenarioData.location || loadedScenarioData.title,
        situation: loadedScenarioData.description,
        mood: loadedScenarioData.defaultMood,
        imageUrl: loadedScenarioData.imageUrl,
        isLoading: false,
        scenarioId: loadedScenarioData.id,
        scenarioSlug: loadedScenarioData.slug,
        props: loadedScenarioData.props,
        levelGuide: loadedScenarioData.levelGuide,
      }
    : whiteboardScenario;
  
  // Ref for whiteboard callbacks from StreamingVoiceChat (drill/text/clear)
  const whiteboardCallbacksRef = useRef<{
    clear: () => void;
    drillComplete: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
    textInputSubmit: (itemId: string, response: string) => void;
  } | null>(null);
  
  // Support handoff state - Daniela hands off to Support Agent
  const [supportHandoffContext, setSupportHandoffContext] = useState<SupportHandoffContext | null>(null);
  
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
  // Uses timestamp to auto-expire after 30 seconds (handles server restarts which can take 10-20s)
  const isSessionLocked = () => {
    const lock = sessionStorage.getItem('conversationCreationLock');
    if (!lock) return false;
    const lockTime = parseInt(lock, 10);
    return Date.now() - lockTime < 30000;
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

  // Founder Collaboration EXPRESS Lane state
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const syncMessagesEndRef = useRef<HTMLDivElement>(null);

  const { 
    state: syncState, 
    voiceState: syncVoiceState,
    connect: syncConnect, 
    disconnect: syncDisconnect, 
    sendMessage: syncSendMessage, 
    startVoiceRecording: syncStartVoice,
    stopVoiceRecording: syncStopVoice,
    replayMessage: syncReplayMessage,
    isConnected: syncIsConnected 
  } = useFounderCollab();

  // Auto-connect to founder collaboration when entering Founder Mode
  useEffect(() => {
    if (isFounderMode && !syncIsConnected) {
      console.log('[SHARED CHAT] Founder Mode active - connecting to collaboration channel');
      syncConnect();
    }
  }, [isFounderMode, syncIsConnected, syncConnect]);

  // Disconnect from founder collaboration only on unmount
  useEffect(() => {
    return () => {
      syncDisconnect();
    };
  }, [syncDisconnect]);

  // Auto-scroll sync messages
  useEffect(() => {
    if (syncMessagesEndRef.current) {
      syncMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [syncState.messages]);

  // Handle sending a sync message
  const handleSyncMessageSend = () => {
    if (syncMessage.trim() && syncIsConnected) {
      syncSendMessage('founder', syncMessage.trim());
      setSyncMessage("");
    }
  };

  // Persist conversation ID to sessionStorage so it survives HMR/page reloads
  // This prevents creating duplicate conversations when the server restarts
  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem('currentChatConversationId', conversationId);
    }
  }, [conversationId]);
  
  // NOTE: We intentionally do NOT clear currentChatConversationId on unmount.
  // HMR remounts would wipe it, defeating the purpose of persistence.
  // The stored ID is cleared only by: handleNewChat(), forceNewConversation flag,
  // or overwritten when a new conversation is created.
  
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

  // Check for active voice session on mount - allows resuming after reconnect/server restart
  // This runs BEFORE auto-create conversation logic to reuse existing sessions
  const activeSessionCheckedRef = useRef(false);
  useEffect(() => {
    // Only check once, and only if we haven't already set a conversation
    if (activeSessionCheckedRef.current || conversationId || forceNewConversation) {
      // If force new or already have conversation, skip check and allow auto-create
      if (forceNewConversation || conversationId) {
        setIsCheckingActiveSession(false);
      }
      return;
    }
    
    activeSessionCheckedRef.current = true;
    
    console.log('[SHARED CHAT] Checking for active voice session...');
    apiRequest("GET", "/api/voice/active-session")
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.hasActiveSession && data.conversationId) {
          console.log('[SHARED CHAT] Found active session, resuming:', data.conversationId);
          setConversationId(data.conversationId);
          setIsResumedConversation(true); // Mark as resumed for welcome-back greeting
        } else {
          console.log('[SHARED CHAT] No active session found');
        }
      })
      .catch(err => {
        console.log('[SHARED CHAT] Failed to check active session:', err.message);
        // Not critical - we'll just create a new conversation
      })
      .finally(() => {
        setIsCheckingActiveSession(false); // Allow auto-create to proceed
      });
  }, [conversationId, forceNewConversation]);
  
  // Handle resume parameter and textbook context from URL
  useEffect(() => {
    if (resumeHandledRef.current) return;
    
    const params = new URLSearchParams(search);
    const resumeId = params.get('resume');
    const textbookChapter = params.get('textbook_chapter');
    
    if (resumeId) {
      console.log('[SHARED CHAT] Resuming conversation from URL:', resumeId);
      resumeHandledRef.current = true;
      setConversationId(resumeId);
      setIsResumedConversation(true);
      setLocation('/chat', { replace: true });
    } else if (textbookChapter) {
      console.log('[SHARED CHAT] Navigated from textbook chapter:', textbookChapter);
      resumeHandledRef.current = true;
      setTextbookContext(textbookChapter);
      sessionStorage.setItem('textbook_chapter_context', textbookChapter);
      setForceNewConversation(true);
      setConversationId(null);
      sessionStorage.removeItem('currentChatConversationId');
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
    // Wait for active session check to complete first
    if (isCheckingActiveSession) {
      console.log('[SHARED CHAT] Auto-create check - waiting for active session check');
      return;
    }
    
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
      
      // Use class ID from learning context if in class mode, or special mode IDs
      const selectedClassId = isInClassMode ? learningContext : 
        (isHonestyMode ? 'honesty-mode' : undefined);
      
      const pendingTextbookChapter = sessionStorage.getItem('textbook_chapter_context');
      if (pendingTextbookChapter) {
        sessionStorage.removeItem('textbook_chapter_context');
      }
      
      console.log('[SHARED CHAT] Creating shared conversation...', isOnboardingComplete ? '(post-onboarding)' : '(onboarding)', 'forceNew:', forceNewConversation, 'mode:', mode, 'classId:', selectedClassId, 'founderMode:', isFounderMode, 'textbookChapter:', pendingTextbookChapter);
      setIsCreatingConversation(true);
      
      apiRequest("POST", "/api/conversations", {
        language,
        difficulty,
        userName: isOnboardingComplete ? userName : null,
        title: null,
        isOnboarding: !isOnboardingComplete,
        includeConversationHistory: isOnboardingComplete,
        forceNew: forceNewConversation,
        mode,
        classId: selectedClassId,
        founderMode: isFounderMode,
        textbookChapter: pendingTextbookChapter || undefined,
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
  }, [language, difficulty, userName, conversationId, isCreatingConversation, currentConversationOnboarding, mode, isCheckingActiveSession]);

  const handleNewChat = () => {
    console.log('[SHARED CHAT] User requested new chat - forcing new conversation');
    // Clear stored conversation and session lock to allow new conversation creation
    sessionStorage.removeItem('currentChatConversationId');
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

  // Handle voice mode click - check credits first
  const handleVoiceModeClick = useCallback(() => {
    if (isExhausted) {
      console.log('[SHARED CHAT] Voice mode blocked - credits exhausted');
      setShowInsufficientCreditsDialog(true);
      return;
    }
    setMode("voice");
  }, [isExhausted]);

  // Callback for VoiceChat to show credits dialog when attempting to call with no credits
  const handleInsufficientCredits = useCallback(() => {
    setShowInsufficientCreditsDialog(true);
  }, []);

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
            onClick={handleVoiceModeClick}
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
      <div className="flex-1 min-h-0 flex">
        <DesktopChatLayout
          whiteboardItems={whiteboardItems}
          onClearWhiteboard={whiteboardCallbacksRef.current?.clear}
          onDrillComplete={whiteboardCallbacksRef.current?.drillComplete}
          onTextInputSubmit={whiteboardCallbacksRef.current?.textInputSubmit}
          activeScenario={activeScenario}
          studioImages={studioImages}
        >
          {/* Main chat area */}
          <div className="h-full relative">
            {mode === "voice" ? (
                <VoiceChat 
                  conversationId={conversationId} 
                  setConversationId={setConversationId}
                  setCurrentConversationOnboarding={setCurrentConversationOnboarding}
                  isResumedConversation={isResumedConversation}
                  onResumeHandled={() => setIsResumedConversation(false)}
                  onLanguageHandoff={handleLanguageHandoff}
                  onLanguageHandoffComplete={completeLanguageHandoff}
                  isExhausted={isExhausted}
                  onInsufficientCredits={handleInsufficientCredits}
                  onWhiteboardItemsChange={setWhiteboardItems}
                  whiteboardCallbacksRef={whiteboardCallbacksRef}
                  useDesktopWhiteboard={useDesktopWhiteboard}
                  onScenarioLoaded={setLoadedScenarioData}
                  onScenarioEnded={() => { setLoadedScenarioData(null); setStudioImages([]); }}
                  onPropUpdate={(data) => {
                    setLoadedScenarioData((prev: any) => {
                      if (!prev?.props) return prev;
                      const updatedProps = prev.props.map((p: any) => {
                        if (p.title?.toLowerCase() !== data.propTitle.toLowerCase()) return p;
                        if (p.content?.byDifficulty) {
                          const updated = { ...p, content: { ...p.content, byDifficulty: { ...p.content.byDifficulty } } };
                          for (const level of Object.keys(updated.content.byDifficulty)) {
                            if (updated.content.byDifficulty[level]?.fields) {
                              updated.content.byDifficulty[level] = { ...updated.content.byDifficulty[level], fields: data.updatedFields };
                            }
                          }
                          return updated;
                        }
                        if (p.content?.fields) {
                          return { ...p, content: { ...p.content, fields: data.updatedFields } };
                        }
                        return p;
                      });
                      return { ...prev, props: updatedProps };
                    });
                  }}
                  onStudioImage={(img) => setStudioImages(prev => [...prev.slice(-4), img])}
                />
            ) : (
              <ChatInterface 
                conversationId={conversationId}
                setConversationId={setConversationId}
                setCurrentConversationOnboarding={setCurrentConversationOnboarding}
                onSupportHandoff={setSupportHandoffContext}
              />
            )}
          </div>
        </DesktopChatLayout>
        
        {/* Founder Collaboration Sync Panel - visible in Founder Mode */}
        {isFounderMode && (
          <div className={`border-l bg-muted/30 flex flex-col transition-all duration-200 min-h-0 ${syncPanelOpen ? 'w-80' : 'w-10'}`}>
            {/* Collapse toggle */}
            <button
              onClick={() => setSyncPanelOpen(!syncPanelOpen)}
              className="flex items-center justify-center h-10 border-b hover-elevate"
              data-testid="button-toggle-sync-panel"
            >
              {syncPanelOpen ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            
            {syncPanelOpen && (
              <>
                {/* Header */}
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-sm">EXPRESS Lane</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {syncIsConnected ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Wifi className="h-3 w-3" />
                            <span>Live</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Connected - messages persist across restarts</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <WifiOff className="h-3 w-3" />
                            <span>{syncState.connectionState === 'reconnecting' ? 'Reconnecting...' : 'Offline'}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{syncState.error || 'Connecting to EXPRESS Lane...'}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                  {syncState.messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>EXPRESS Lane ready</p>
                      <p className="text-xs mt-1">Hive collaboration: Founder + Daniela + Wren</p>
                    </div>
                  ) : (
                    syncState.messages.map((msg) => (
                      <div
                        key={msg.cursor}
                        className={`p-2 rounded text-sm ${
                          msg.role === 'founder' 
                            ? 'bg-amber-500/10 border border-amber-500/20' 
                            : msg.role === 'daniela'
                            ? 'bg-primary/10 border border-primary/20'
                            : msg.role === 'wren'
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-muted border border-border'
                        }`}
                        data-testid={`express-message-${msg.id}`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          {msg.role === 'founder' && <Code className="h-3 w-3 text-amber-500" />}
                          {msg.role === 'daniela' && <Sparkles className="h-3 w-3 text-primary" />}
                          {msg.role === 'wren' && <Radio className="h-3 w-3 text-emerald-500" />}
                          <span className="font-medium text-xs capitalize">{msg.role}</span>
                          {msg.messageType === 'voice' && (
                            <Mic className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.messageType === 'voice' && msg.role === 'daniela' && (
                            <button
                              onClick={() => syncReplayMessage(msg.id)}
                              className="p-1 rounded hover:bg-muted/50"
                              disabled={syncVoiceState.playingMessageId === msg.id}
                              data-testid={`button-replay-${msg.id}`}
                            >
                              {syncVoiceState.playingMessageId === msg.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Volume2 className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))
                  )}
                  <div ref={syncMessagesEndRef} />
                </div>
                
                {/* Voice input area */}
                <div className="p-3 border-t space-y-2">
                  {/* Live transcript display */}
                  {syncVoiceState.currentTranscript && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 animate-pulse">
                      {syncVoiceState.currentTranscript}
                    </div>
                  )}
                  
                  {/* Processing status */}
                  {syncVoiceState.processingStatus === 'thinking' && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Daniela is thinking...</span>
                    </div>
                  )}
                  {syncVoiceState.processingStatus === 'speaking' && (
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      <span>Daniela is speaking...</span>
                    </div>
                  )}
                  
                  {/* Voice error */}
                  {syncVoiceState.voiceError && (
                    <div className="text-xs text-red-500 p-2 bg-red-500/10 rounded">
                      {syncVoiceState.voiceError}
                    </div>
                  )}
                  
                  {/* Push-to-talk button with help */}
                  <div className="flex gap-2 items-center">
                    <Button
                      className={`flex-1 ${syncVoiceState.isRecording ? 'bg-red-500 hover:bg-red-600' : ''}`}
                      variant={syncVoiceState.isRecording ? "default" : "outline"}
                      onPointerDown={() => syncStartVoice()}
                      onPointerUp={() => syncStopVoice()}
                      onPointerLeave={() => syncVoiceState.isRecording && syncStopVoice()}
                      onPointerCancel={() => syncVoiceState.isRecording && syncStopVoice()}
                      disabled={!syncIsConnected || syncVoiceState.processingStatus === 'thinking' || syncVoiceState.processingStatus === 'speaking'}
                      data-testid="button-sync-voice"
                    >
                      {syncVoiceState.isRecording ? (
                        <>
                          <Mic className="h-4 w-4 mr-2 animate-pulse" />
                          <span>Release to send</span>
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-2" />
                          <span>Hold to talk</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => setSupportHandoffContext({
                        ticketId: null,
                        category: 'technical',
                        reason: 'Help request during voice chat',
                        priority: 'normal',
                      })}
                      data-testid="button-inline-help"
                      title="Need help?"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Text fallback - smaller */}
                  <div className="flex gap-2">
                    <Input
                      value={syncMessage}
                      onChange={(e) => setSyncMessage(e.target.value)}
                      placeholder="Or type..."
                      className="flex-1 text-xs h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSyncMessageSend();
                        }
                      }}
                      disabled={!syncIsConnected}
                      data-testid="input-sync-message"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleSyncMessageSend}
                      disabled={!syncIsConnected || !syncMessage.trim()}
                      data-testid="button-send-sync-message"
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
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
      
      
      {/* Support modal - triggered by Daniela handoff in text chat */}
      <SupportAssistModal
        isOpen={!!supportHandoffContext}
        onClose={() => setSupportHandoffContext(null)}
        onResolved={() => setSupportHandoffContext(null)}
        ticketId={supportHandoffContext?.ticketId || null}
        category={supportHandoffContext?.category || 'other'}
        reason={supportHandoffContext?.reason || ''}
        priority={supportHandoffContext?.priority || 'normal'}
        mode="support"
      />
    </div>
  );
}
