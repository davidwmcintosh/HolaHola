import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { StreamingVoiceChat } from "@/components/StreamingVoiceChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, BookOpen, Library } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCredits } from "@/contexts/UsageContext";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { ReadingModulePanel } from "@/components/ReadingModulePanel";
import type { WhiteboardItem } from "@shared/whiteboard-types";

const TUTORS = [
  { name: "Morgan", gender: "female" as const },
  { name: "Sterling", gender: "male" as const },
];

export default function BusinessTutor() {
  const [, setLocation] = useLocation();
  const { tutorGender, setTutorGender } = useLanguage();
  const { isExhausted } = useCredits();
  const isMobile = useIsMobile();

  const [conversationId, setConversationId] = useState<string | null>(() => {
    return sessionStorage.getItem('businessConversationId') || null;
  });
  const [currentConversationOnboarding, setCurrentConversationOnboarding] = useState<boolean | null>(null);
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [whiteboardItems, setWhiteboardItems] = useState<WhiteboardItem[]>([]);
  const [showReadingPanel, setShowReadingPanel] = useState(false);

  const whiteboardCallbacksRef = useRef<{
    clear: () => void;
    drillComplete: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
    textInputSubmit: (itemId: string, response: string) => void;
  } | null>(null);

  const creatingConversationRef = useRef(false);

  useEffect(() => {
    return () => {
      sessionStorage.removeItem('businessConversationId');
    };
  }, []);

  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem('businessConversationId', conversationId);
      return;
    }
    if (creatingConversationRef.current) return;
    creatingConversationRef.current = true;

    apiRequest("POST", "/api/conversations", {
      language: "business",
      difficulty: "beginner",
      userName: "Student",
      title: null,
      isOnboarding: false,
    })
      .then(r => r.json())
      .then(data => {
        setConversationId(data.id);
      })
      .catch(err => {
        console.error("[Business] Failed to create conversation:", err);
        creatingConversationRef.current = false;
      });
  }, [conversationId]);

  const activeTutor = TUTORS.find(t => t.gender === tutorGender) ?? TUTORS[0];

  const handleTutorSwitch = (gender: 'male' | 'female') => {
    if (gender === tutorGender) return;
    setTutorGender(gender);
    setConversationId(null);
    sessionStorage.removeItem('businessConversationId');
    creatingConversationRef.current = false;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0 gap-2 flex-wrap"
        data-testid="business-header"
      >
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation('/')}
            data-testid="button-back-business"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-violet-100 dark:bg-violet-900/30">
              <Briefcase className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight" data-testid="text-business-tutor-name">
                {activeTutor.name}
              </div>
              <div className="text-xs text-muted-foreground leading-tight">Business</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation('/reading-library?subject=principles-management')}
            title="Reading Library"
            data-testid="button-reading-library-business"
          >
            <Library className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </Button>
          <Button
            size="icon"
            variant={showReadingPanel ? "default" : "ghost"}
            onClick={() => setShowReadingPanel(p => !p)}
            title="Reading Module"
            data-testid="button-toggle-reading-panel"
            className={showReadingPanel ? "bg-violet-600 text-white" : ""}
          >
            <BookOpen className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1 rounded-md border p-1" data-testid="business-tutor-picker">
            {TUTORS.map(t => (
              <button
                key={t.gender}
                onClick={() => handleTutorSwitch(t.gender)}
                data-testid={`button-tutor-${t.name.toLowerCase()}`}
                className={[
                  "px-3 py-1 text-xs rounded transition-colors",
                  tutorGender === t.gender
                    ? "bg-violet-600 text-white"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 overflow-hidden transition-all duration-300 ${showReadingPanel && !isMobile ? 'min-w-0' : ''}`}>
          <StreamingVoiceChat
            conversationId={conversationId}
            setConversationId={setConversationId}
            setCurrentConversationOnboarding={setCurrentConversationOnboarding}
            isExhausted={isExhausted}
            onInsufficientCredits={() => setShowInsufficientCreditsDialog(true)}
            onWhiteboardItemsChange={setWhiteboardItems}
            whiteboardCallbacksRef={whiteboardCallbacksRef}
            useDesktopWhiteboard={!isMobile && !showReadingPanel}
            targetLanguageOverride="business"
            homeRoute="/business-tutor"
          />
        </div>

        {showReadingPanel && (
          <div
            className={
              isMobile
                ? "absolute inset-0 z-40 bg-background"
                : "w-96 shrink-0 overflow-hidden"
            }
            data-testid="reading-panel-container"
          >
            <ReadingModulePanel
              subject="business"
              onClose={() => setShowReadingPanel(false)}
            />
          </div>
        )}
      </div>

      <InsufficientCreditsDialog
        open={showInsufficientCreditsDialog}
        onOpenChange={(open) => setShowInsufficientCreditsDialog(open)}
      />
    </div>
  );
}
