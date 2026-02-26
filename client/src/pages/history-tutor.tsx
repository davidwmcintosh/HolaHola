import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { StreamingVoiceChat } from "@/components/StreamingVoiceChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Landmark } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCredits } from "@/contexts/UsageContext";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { WhiteboardItem } from "@shared/whiteboard-types";

const TUTORS = [
  { name: "Clio", gender: "female" as const, tagline: "Narrative and inclusive" },
  { name: "Marcus", gender: "male" as const, tagline: "Structural and analytical" },
];

export default function HistoryTutor() {
  const [, setLocation] = useLocation();
  const { setLanguage, language, tutorGender, setTutorGender } = useLanguage();
  const { isExhausted } = useCredits();
  const isMobile = useIsMobile();

  const [conversationId, setConversationId] = useState<string | null>(() => {
    const stored = sessionStorage.getItem('historyConversationId');
    return stored || null;
  });
  const [currentConversationOnboarding, setCurrentConversationOnboarding] = useState<boolean | null>(null);
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [whiteboardItems, setWhiteboardItems] = useState<WhiteboardItem[]>([]);

  const whiteboardCallbacksRef = useRef<{
    clear: () => void;
    drillComplete: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
    textInputSubmit: (itemId: string, response: string) => void;
  } | null>(null);

  const previousLanguageRef = useRef<string>(language);
  const previousGenderRef = useRef<'male' | 'female'>(tutorGender);

  useEffect(() => {
    previousLanguageRef.current = language;
    previousGenderRef.current = tutorGender;
    setLanguage('history');

    return () => {
      setLanguage(previousLanguageRef.current);
      setTutorGender(previousGenderRef.current);
      sessionStorage.removeItem('historyConversationId');
    };
  }, []);

  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem('historyConversationId', conversationId);
    }
  }, [conversationId]);

  const activeTutor = TUTORS.find(t => t.gender === tutorGender) ?? TUTORS[0];

  const handleTutorSwitch = (gender: 'male' | 'female') => {
    if (gender === tutorGender) return;
    setTutorGender(gender);
    setConversationId(null);
    sessionStorage.removeItem('historyConversationId');
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        data-testid="history-header"
      >
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation('/')}
            data-testid="button-back-history"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-900/30">
              <Landmark className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div
                className="text-sm font-semibold leading-tight"
                data-testid="text-history-tutor-name"
              >
                {activeTutor.name}
              </div>
              <div className="text-xs text-muted-foreground leading-tight">History</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-md border p-1" data-testid="history-tutor-picker">
          {TUTORS.map(t => (
            <button
              key={t.gender}
              onClick={() => handleTutorSwitch(t.gender)}
              data-testid={`button-tutor-${t.name.toLowerCase()}`}
              className={[
                "px-3 py-1 text-xs rounded transition-colors",
                tutorGender === t.gender
                  ? "bg-amber-600 text-white"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.name}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <StreamingVoiceChat
          conversationId={conversationId}
          setConversationId={setConversationId}
          setCurrentConversationOnboarding={setCurrentConversationOnboarding}
          isExhausted={isExhausted}
          onInsufficientCredits={() => setShowInsufficientCreditsDialog(true)}
          onWhiteboardItemsChange={setWhiteboardItems}
          whiteboardCallbacksRef={whiteboardCallbacksRef}
          useDesktopWhiteboard={!isMobile}
        />
      </div>

      <InsufficientCreditsDialog
        open={showInsufficientCreditsDialog}
        onClose={() => setShowInsufficientCreditsDialog(false)}
      />
    </div>
  );
}
