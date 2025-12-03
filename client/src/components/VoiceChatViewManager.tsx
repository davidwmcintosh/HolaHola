import { useState, useRef, TouchEvent, useMemo } from "react";
import { ImmersiveTutor } from "./ImmersiveTutor";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Radio, Captions, CaptionsOff } from "lucide-react";
import { type Message, type Conversation } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { type WordTiming } from "@/lib/restVoiceApi";
import { useLanguage, type SubtitleMode, type VoiceSpeed } from "@/contexts/LanguageContext";
import { getEffectiveSubtitleMode } from "@/lib/subtitlePolicies";

interface VoiceChatViewManagerProps {
  conversationId: string | null;
  messages: Message[];
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
  isMicPreparing?: boolean;
  isProcessing?: boolean;
  isPlaying: boolean;
  isConnecting?: boolean;  // True while WebSocket/Cartesia is warming up
  currentPlayingMessageId?: string;
  audioElementRef?: React.RefObject<HTMLAudioElement>;
  onReplay?: () => void;
  canReplay?: boolean;
  onSlowRepeat?: () => void;
  canSlowRepeat?: boolean;
  isSlowRepeatLoading?: boolean;
  wordTimings?: WordTiming[];
  tutorGender?: 'male' | 'female';
  streamingText?: string;
  streamingTargetText?: string;
  hasTargetContent?: boolean;  // Server-driven: whether current sentence has target language content
  streamingWordIndex?: number;
  streamingVisibleWordCount?: number;  // Number of words to show (progressive reveal)
  streamingTargetWordIndex?: number;  // Word index in target-only text for Target mode karaoke
  isWaitingForContent?: boolean;  // True after subtitle reset, false when new content arrives
  getIsWaitingForContent?: () => boolean;  // Synchronous getter for immediate access
  // Block-based rendering for target mode
  activeBlockIndex?: number;
  activeBlockText?: string;
  teachingBlockText?: string;
  hasShownTeachingBlock?: boolean;
  voiceSpeed?: VoiceSpeed;
  setTutorGender?: (gender: 'male' | 'female') => void;
  setVoiceSpeed?: (speed: VoiceSpeed) => void;
  femaleVoiceName?: string;
  maleVoiceName?: string;
  baseSpeakingRate?: number; // Base speaking rate from Cartesia voice config
  // Dev tools props
  isDeveloper?: boolean;
  classId?: string | null;
  onReloadCredits?: () => void;
  onResetData?: () => void;
  isReloadingCredits?: boolean;
  isResettingData?: boolean;
}

export function VoiceChatViewManager({
  conversationId,
  messages,
  onRecordingStart,
  onRecordingStop,
  isRecording,
  isMicPreparing = false,
  isProcessing,
  isPlaying,
  isConnecting = false,
  currentPlayingMessageId,
  audioElementRef,
  onReplay,
  canReplay,
  onSlowRepeat,
  canSlowRepeat,
  isSlowRepeatLoading,
  wordTimings,
  tutorGender = "female",
  streamingText,
  streamingTargetText,
  hasTargetContent,
  streamingWordIndex,
  streamingVisibleWordCount,
  streamingTargetWordIndex,
  isWaitingForContent,
  getIsWaitingForContent,
  activeBlockIndex,
  activeBlockText,
  teachingBlockText,
  hasShownTeachingBlock,
  voiceSpeed,
  setTutorGender,
  setVoiceSpeed,
  femaleVoiceName,
  maleVoiceName,
  baseSpeakingRate,
  isDeveloper = false,
  classId,
  onReloadCredits,
  onResetData,
  isReloadingCredits = false,
  isResettingData = false,
}: VoiceChatViewManagerProps) {
  const [view, setView] = useState<"live" | "history">("live");
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  
  // Get subtitles toggle and difficulty from context (3 states: off, target, all)
  const { subtitleMode, setSubtitleMode, difficulty } = useLanguage();
  
  // ACTFL-level-aware mode convergence: At higher levels, Target and All modes converge
  // This reduces cognitive load for advanced learners where the distinction is minimal
  const effectiveSubtitleMode = useMemo(() => {
    return getEffectiveSubtitleMode(subtitleMode, difficulty);
  }, [subtitleMode, difficulty]);
  
  // Cycle through subtitle modes: off → target → all → off
  const cycleSubtitleMode = () => {
    const modes: SubtitleMode[] = ["off", "target", "all"];
    const currentIndex = modes.indexOf(subtitleMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setSubtitleMode(modes[nextIndex]);
  };
  
  // Get display text for current subtitle mode (no icons to save space)
  // Shows raw user selection, but indicates when mode is converged (advanced learners)
  const getSubtitleLabel = () => {
    switch (subtitleMode) {
      case "off": return "No Subtitles";
      case "target": 
        // If mode converged to "all", show a hint but preserve user's preference
        return effectiveSubtitleMode === "all" ? "All (Auto)" : "Target Subtitles";
      case "all": return "All Subtitles";
    }
  };

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
      {/* View Indicator Badges - Order: Live, Subtitles, History */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {/* Live Button - Primary when active */}
        <Badge
          variant={view === "live" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setView("live")}
          data-testid="badge-live-view"
        >
          <Radio className="h-3 w-3 mr-1" />
          Live
        </Badge>
        
        {/* Subtitles Button - White/secondary styling, no icon to save space */}
        {/* Use effectiveSubtitleMode for visual state to match actual behavior */}
        <Badge
          variant={effectiveSubtitleMode !== "off" ? "secondary" : "outline"}
          className="cursor-pointer"
          onClick={cycleSubtitleMode}
          data-testid="badge-subtitles-toggle"
        >
          {getSubtitleLabel()}
        </Badge>
        
        {/* History Button - Blue styling */}
        <Badge
          variant={view === "history" ? "default" : "outline"}
          className={`cursor-pointer ${view === "history" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
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
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ImmersiveTutor
                conversationId={conversationId}
                messages={messages}
                onRecordingStart={onRecordingStart}
                onRecordingStop={onRecordingStop}
                isRecording={isRecording}
                isMicPreparing={isMicPreparing}
                isProcessing={isProcessing}
                isPlaying={isPlaying}
                isConnecting={isConnecting}
                currentPlayingMessageId={currentPlayingMessageId}
                audioElementRef={audioElementRef}
                onReplay={onReplay}
                canReplay={canReplay}
                onSlowRepeat={onSlowRepeat}
                canSlowRepeat={canSlowRepeat}
                isSlowRepeatLoading={isSlowRepeatLoading}
                wordTimings={wordTimings}
                subtitleMode={effectiveSubtitleMode}
                tutorGender={tutorGender}
                streamingText={streamingText}
                streamingTargetText={streamingTargetText}
                hasTargetContent={hasTargetContent}
                streamingWordIndex={streamingWordIndex}
                streamingVisibleWordCount={streamingVisibleWordCount}
                streamingTargetWordIndex={streamingTargetWordIndex}
                isWaitingForContent={isWaitingForContent}
                getIsWaitingForContent={getIsWaitingForContent}
                activeBlockIndex={activeBlockIndex}
                activeBlockText={activeBlockText}
                teachingBlockText={teachingBlockText}
                hasShownTeachingBlock={hasShownTeachingBlock}
                voiceSpeed={voiceSpeed}
                setTutorGender={setTutorGender}
                setVoiceSpeed={setVoiceSpeed}
                femaleVoiceName={femaleVoiceName}
                maleVoiceName={maleVoiceName}
                baseSpeakingRate={baseSpeakingRate}
                isDeveloper={isDeveloper}
                classId={classId}
                onReloadCredits={onReloadCredits}
                onResetData={onResetData}
                isReloadingCredits={isReloadingCredits}
                isResettingData={isResettingData}
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
