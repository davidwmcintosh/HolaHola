import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { StreamingVoiceChat } from "@/components/StreamingVoiceChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Microscope } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCredits } from "@/contexts/UsageContext";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { WhiteboardItem } from "@shared/whiteboard-types";

export default function BiologyTutor() {
  const [, setLocation] = useLocation();
  const { setLanguage, language } = useLanguage();
  const { isExhausted } = useCredits();
  const isMobile = useIsMobile();

  const [conversationId, setConversationId] = useState<string | null>(() => {
    const stored = sessionStorage.getItem('biologyConversationId');
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

  useEffect(() => {
    previousLanguageRef.current = language;
    setLanguage('biology');

    return () => {
      setLanguage(previousLanguageRef.current);
      sessionStorage.removeItem('biologyConversationId');
    };
  }, []);

  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem('biologyConversationId', conversationId);
    }
  }, [conversationId]);

  const handleBack = () => {
    setLocation('/');
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        data-testid="biology-header"
      >
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleBack}
            data-testid="button-back-biology"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
              <Microscope className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div
                className="text-sm font-semibold leading-tight"
                data-testid="text-biology-tutor-name"
              >
                Evelyn
              </div>
              <div className="text-xs text-muted-foreground leading-tight">Biology</div>
            </div>
          </div>
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
