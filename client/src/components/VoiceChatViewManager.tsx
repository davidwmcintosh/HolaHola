import { useState, useRef, TouchEvent } from "react";
import { ImmersiveTutor } from "./ImmersiveTutor";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Radio } from "lucide-react";
import { type Message, type Conversation } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { type WordTiming } from "@/lib/restVoiceApi";

interface VoiceChatViewManagerProps {
  conversationId: string | null;
  messages: Message[];
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
  isProcessing?: boolean;
  isPlaying: boolean;
  currentPlayingMessageId?: string;
  audioElementRef?: React.RefObject<HTMLAudioElement>;
  onReplay?: () => void;
  canReplay?: boolean;
  wordTimings?: WordTiming[];
  subtitlesEnabled?: boolean;
}

export function VoiceChatViewManager({
  conversationId,
  messages,
  onRecordingStart,
  onRecordingStop,
  isRecording,
  isProcessing,
  isPlaying,
  currentPlayingMessageId,
  audioElementRef,
  onReplay,
  canReplay,
  wordTimings,
  subtitlesEnabled,
}: VoiceChatViewManagerProps) {
  const [view, setView] = useState<"live" | "history">("live");
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Fetch conversation metadata (includes resume info) - Week 1 Feature
  const { data: conversationData } = useQuery<Conversation & { resumeMetadata?: { 
    isResuming: boolean; 
    totalMessages: number; 
    contextLimit: number; 
    lastActiveAt: string; 
  } }>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

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
      <div className="flex flex-col h-full">
        {view === "live" ? (
          conversationId ? (
            <div className="flex-1 min-h-0">
              <ImmersiveTutor
                conversationId={conversationId}
                messages={messages}
                onRecordingStart={onRecordingStart}
                onRecordingStop={onRecordingStop}
                isRecording={isRecording}
                isProcessing={isProcessing}
                isPlaying={isPlaying}
                currentPlayingMessageId={currentPlayingMessageId}
                onToggleView={toggleView}
                audioElementRef={audioElementRef}
                onReplay={onReplay}
                canReplay={canReplay}
                wordTimings={wordTimings}
                subtitlesEnabled={subtitlesEnabled}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading conversation...</p>
            </div>
          )
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar pt-16">
            <div className="space-y-3 md:space-y-4 max-w-4xl mx-auto">
              {/* Resume conversation indicator - Week 1 Feature */}
              {conversationData?.resumeMetadata?.isResuming && (
                <div 
                  className="mb-4 p-3 rounded-lg bg-muted/50 border border-border/50 flex items-center gap-2 text-sm"
                  data-testid="resume-indicator"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="font-medium">Resuming conversation</span>
                    <span className="text-muted-foreground">
                      · {conversationData.resumeMetadata.totalMessages} messages · Last active {
                        new Date(conversationData.resumeMetadata.lastActiveAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric'
                        })
                      }
                    </span>
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 md:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <Card className={`p-3 md:p-4 max-w-[85%] md:max-w-2xl rounded-2xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
