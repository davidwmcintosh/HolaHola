import { useState, useRef, TouchEvent } from "react";
import { ImmersiveTutor } from "./ImmersiveTutor";
import { RestVoiceChat } from "./RestVoiceChat";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Radio } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  targetLanguageText?: string;
  wordTimingsJson?: string;
}

interface VoiceChatViewManagerProps {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  setCurrentConversationOnboarding: (isOnboarding: boolean | null) => void;
  messages: Message[];
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
  isPlaying: boolean;
  currentPlayingMessageId?: string;
}

export function VoiceChatViewManager({
  conversationId,
  setConversationId,
  setCurrentConversationOnboarding,
  messages,
  onRecordingStart,
  onRecordingStop,
  isRecording,
  isPlaying,
  currentPlayingMessageId,
}: VoiceChatViewManagerProps) {
  const [view, setView] = useState<"live" | "history">("live");
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Handle swipe gestures
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger swipe if horizontal movement is greater than vertical
    // and exceeds threshold (50px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0 && view === "history") {
        // Swipe right: history → live
        setView("live");
      } else if (deltaX < 0 && view === "live") {
        // Swipe left: live → history
        setView("history");
      }
    }
  };

  const toggleView = () => {
    setView(prev => prev === "live" ? "history" : "live");
  };

  return (
    <div 
      className="h-full relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* View Indicator Badges */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        <Badge
          variant={view === "live" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setView("live")}
          data-testid="badge-live-view"
        >
          <Radio className="h-3 w-3 mr-1" />
          Live
        </Badge>
        <Badge
          variant={view === "history" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setView("history")}
          data-testid="badge-history-view"
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          History
        </Badge>
      </div>

      {/* View Content */}
      <div className="h-full">
        {view === "live" ? (
          conversationId ? (
            <ImmersiveTutor
              conversationId={conversationId}
              messages={messages}
              onRecordingStart={onRecordingStart}
              onRecordingStop={onRecordingStop}
              isRecording={isRecording}
              isPlaying={isPlaying}
              currentPlayingMessageId={currentPlayingMessageId}
              onToggleView={toggleView}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading conversation...</p>
            </div>
          )
        ) : (
          <RestVoiceChat
            conversationId={conversationId}
            setConversationId={setConversationId}
            setCurrentConversationOnboarding={setCurrentConversationOnboarding}
          />
        )}
      </div>
    </div>
  );
}
