import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, MessageSquare, RefreshCw, Trash2, Loader2, PhoneOff, Radio, Handshake, BookOpen, AlertTriangle, Wrench, Sparkles, Pencil, Globe, BookMarked, Lightbulb } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { type Message } from "@shared/schema";
import { type VoiceSpeed } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DebugTimingPanel } from "./DebugTimingPanel";
import { Whiteboard } from "./Whiteboard";
import { FloatingSubtitleOverlay } from "./FloatingSubtitleOverlay";
import { CollaborationIndicator } from "./CollaborationIndicator";
import type { WhiteboardItem, SubtitleMode } from "@shared/whiteboard-types";
import type { StreamingSubtitleState } from "../hooks/useStreamingSubtitles";
import type { VoiceInputMode, OpenMicState } from "@shared/streaming-voice-types";

// Female tutor avatars (default)
import femaleTutorSpeakingUrl from "@assets/tutor-speaking-No-Background_1764099971093.png";
import femaleTutorListeningUrl from "@assets/tutor-listening-no-background_1764099971094.png";
import femaleTutorThinkingUrl from "@assets/daniela_thinking_No_Background_1766161816613.jpg";

// Male tutor avatars
import maleTutorSpeakingUrl from "@assets/Boy-tutor-speaking-No-Background_1764186322050.png";
import maleTutorListeningUrl from "@assets/Boy-tutor-waiting-No-Background_1764186322051.png";
// Male thinking uses speaking pose (no dedicated image yet)
const maleTutorThinkingUrl = maleTutorSpeakingUrl;

// Types for hive channel collaboration
interface HiveSnapshot {
  id: string;
  channelId: string;
  tutorTurn: string;
  studentTurn?: string | null;
  beaconType: string;
  beaconReason?: string | null;
  editorResponse?: string | null;
  editorRespondedAt?: string | null;
  createdAt: string;
}

interface HiveChannel {
  id: string;
  conversationId?: string | null;
  userId: string;
  sessionPhase: string;
  targetLanguage?: string | null;
  studentLevel?: string | null;
  sessionTopic?: string | null;
  startedAt: string;
  endedAt?: string | null;
}

// Collaboration Event types for real-time Daniela ↔ Architect communication
interface CollaborationEvent {
  id: string;
  eventType: string;
  senderRole: 'daniela' | 'editor' | 'founder' | 'system';
  senderId?: string | null;
  content: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

interface ImmersiveTutorProps {
  messages: Message[];
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
  isMicPreparing?: boolean;
  isProcessing?: boolean;
  isPlaying: boolean;
  isConnecting?: boolean;
  // Explicit "user's turn" flag - mic is ONLY unlocked when this is true
  // This is the inverse of mic lockout and covers ALL non-user-turn states
  isUsersTurn?: boolean;
  onToggleView?: () => void;
  onEndCall?: () => void;
  tutorGender?: 'male' | 'female';
  voiceSpeed?: VoiceSpeed;
  setTutorGender?: (gender: 'male' | 'female') => void;
  setVoiceSpeed?: (speed: VoiceSpeed) => void;
  femaleVoiceName?: string;
  maleVoiceName?: string;
  baseSpeakingRate?: number;
  isDeveloper?: boolean;
  classId?: string | null;
  // Conversation ID for hive channel tracking
  conversationId?: string | null;
  onReloadCredits?: () => void;
  onResetData?: () => void;
  isReloadingCredits?: boolean;
  isResettingData?: boolean;
  whiteboardItems?: WhiteboardItem[];
  onClearWhiteboard?: () => void;
  onDrillComplete?: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
  onTextInputSubmit?: (itemId: string, response: string) => void;
  subtitleState?: StreamingSubtitleState;
  // Regular subtitle mode: 'off' (default), 'all', or 'target'
  regularSubtitleMode?: SubtitleMode;
  // Custom overlay text (independent from regular subtitles)
  customOverlayText?: string | null;
  // Voice input mode: push-to-talk (default) or open-mic
  inputMode?: VoiceInputMode;
  setInputMode?: (mode: VoiceInputMode) => void;
  openMicState?: OpenMicState;
}

export function ImmersiveTutor({
  messages,
  onRecordingStart,
  onRecordingStop,
  isRecording,
  isMicPreparing = false,
  isProcessing = false,
  isPlaying,
  isConnecting = false,
  isUsersTurn = true,
  onToggleView,
  onEndCall,
  tutorGender = "female",
  voiceSpeed = "normal",
  setTutorGender,
  setVoiceSpeed,
  femaleVoiceName,
  maleVoiceName,
  baseSpeakingRate = 1.0,
  isDeveloper = false,
  classId,
  conversationId,
  onReloadCredits,
  onResetData,
  isReloadingCredits = false,
  isResettingData = false,
  whiteboardItems = [],
  onClearWhiteboard,
  onDrillComplete,
  onTextInputSubmit,
  subtitleState,
  regularSubtitleMode = 'off',
  customOverlayText,
  inputMode = 'push-to-talk',
  setInputMode,
  openMicState = 'idle',
}: ImmersiveTutorProps) {
  // Local ref to track if WE started recording via pointer down
  // This ensures pointer up always stops recording regardless of React state timing
  const isPointerRecordingRef = useRef<boolean>(false);
  
  // Debounce voice switching to prevent rapid clicks
  const voiceSwitchInProgressRef = useRef<boolean>(false);

  // Collaboration panel state
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  // Collaboration panel only has Hive Mind tab now (Brain Surgery and Surgery Theater retired)
  
  const { toast } = useToast();

  // Hive channel data - fetch active channel for current conversation when panel is open
  // NOTE: Always fetch when panel is open (regardless of tab) so the badge counter works
  const { data: hiveData, isLoading: hiveLoading } = useQuery<{
    channel: HiveChannel | null;
    snapshots: HiveSnapshot[];
  }>({
    queryKey: ["/api/collaboration/conversations", conversationId, "channel"],
    enabled: isDeveloper && isCollabOpen && !!conversationId,
    refetchInterval: isCollabOpen ? 5000 : false, // Auto-refresh every 5s when open for real-time updates
  });

  // Fallback: Get recent channels when no active conversation
  const { data: recentChannels, isLoading: channelsLoading } = useQuery<HiveChannel[]>({
    queryKey: ["/api/collaboration/channels"],
    enabled: isDeveloper && isCollabOpen && !conversationId,
  });

  // Collaboration events (Daniela ↔ Architect messages) - real-time feed
  // Keep polling even when sheet is closed so badge can show new events
  const { data: collabEventsData, isLoading: collabEventsLoading } = useQuery<CollaborationEvent[]>({
    queryKey: ["/api/collaboration/feed"],
    enabled: isDeveloper,
    refetchInterval: isDeveloper ? 10000 : false, // 10s background refresh for badge updates
  });
  const collabEvents = collabEventsData ?? [];

  // Track new events for visual indicator
  const [lastSeenEventCount, setLastSeenEventCount] = useState(0);
  const hasNewEvents = collabEvents.length > lastSeenEventCount && lastSeenEventCount > 0;

  // Reset new events indicator when opening panel (only hive tab exists now)
  useEffect(() => {
    if (isCollabOpen) {
      setLastSeenEventCount(collabEvents.length);
    }
  }, [isCollabOpen, collabEvents.length]);

  // Beacon type labels for display (using lucide-react icons, no emojis)
  const beaconTypeIcons: Record<string, { label: string; Icon: typeof BookOpen }> = {
    teaching_moment: { label: 'Teaching Moment', Icon: BookOpen },
    student_struggle: { label: 'Student Struggle', Icon: AlertTriangle },
    tool_usage: { label: 'Tool Usage', Icon: Wrench },
    breakthrough: { label: 'Breakthrough', Icon: Sparkles },
    correction: { label: 'Correction', Icon: Pencil },
    cultural_insight: { label: 'Cultural Insight', Icon: Globe },
    vocabulary_intro: { label: 'New Vocabulary', Icon: BookMarked },
  };

  // Determine which tutor image to show based on state and gender preference
  const getTutorImage = () => {
    // Select avatar set based on gender preference
    const speakingUrl = tutorGender === 'male' ? maleTutorSpeakingUrl : femaleTutorSpeakingUrl;
    const listeningUrl = tutorGender === 'male' ? maleTutorListeningUrl : femaleTutorListeningUrl;
    const thinkingUrl = tutorGender === 'male' ? maleTutorThinkingUrl : femaleTutorThinkingUrl;
    const idleUrl = listeningUrl; // Idle uses listening pose
    
    // Show speaking avatar when playing, dedicated thinking pose when processing
    if (isPlaying) return speakingUrl;
    if (isProcessing) return thinkingUrl;  // Hand on chin, contemplative look
    if (isRecording) return listeningUrl;
    return idleUrl;
  };
  const tutorImageUrl = getTutorImage();
  
  // Get the current avatar state for test IDs and animation
  const getAvatarState = (): "idle" | "listening" | "speaking" | "thinking" => {
    // Speaking = audio actively playing
    if (isPlaying) return "speaking";
    // Thinking = processing user input, preparing response (instant visual feedback)
    if (isProcessing) return "thinking";
    // Listening = user is recording/speaking
    if (isRecording) return "listening";
    return "idle";
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto items-center relative">
      {/* Voice Switcher - Fixed at top-left for easy access */}
      {setTutorGender && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full p-1 shadow-lg border">
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-full px-3 ${tutorGender === "female" ? "bg-blue-500 text-white hover:bg-blue-600" : ""}`}
            disabled={tutorGender === "female" || isPlaying || isProcessing}
            onClick={() => {
              if (voiceSwitchInProgressRef.current) return;
              voiceSwitchInProgressRef.current = true;
              setTutorGender("female");
              // Reset after animation/intro completes
              setTimeout(() => { voiceSwitchInProgressRef.current = false; }, 3000);
            }}
            data-testid="button-voice-female"
          >
            {femaleVoiceName || "Female"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-full px-3 ${tutorGender === "male" ? "bg-blue-500 text-white hover:bg-blue-600" : ""}`}
            disabled={tutorGender === "male" || isPlaying || isProcessing}
            onClick={() => {
              if (voiceSwitchInProgressRef.current) return;
              voiceSwitchInProgressRef.current = true;
              setTutorGender("male");
              // Reset after animation/intro completes
              setTimeout(() => { voiceSwitchInProgressRef.current = false; }, 3000);
            }}
            data-testid="button-voice-male"
          >
            {maleVoiceName || "Male"}
          </Button>
        </div>
      )}

      {/* Collaboration Panel Button - Developer/Founder only, top-right */}
      {isDeveloper && (
        <Sheet open={isCollabOpen} onOpenChange={setIsCollabOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-20 bg-background/80 backdrop-blur-sm rounded-full shadow-lg border h-10 w-10"
              data-testid="button-collaboration-panel"
              title="Hive Mind - Daniela & Editor Collaboration"
            >
              <Handshake className="h-5 w-5" />
              {hiveData?.snapshots && hiveData.snapshots.filter(s => !s.editorResponse).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {hiveData.snapshots.filter(s => !s.editorResponse).length > 9 ? '9+' : hiveData.snapshots.filter(s => !s.editorResponse).length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[350px] sm:w-[450px] flex flex-col">
            <SheetHeader className="pb-2">
              <SheetTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5" />
                Collaboration
              </SheetTitle>
              <SheetDescription>
                Daniela & Editor collaboration tools
              </SheetDescription>
            </SheetHeader>

            <Tabs value="hive" className="flex-1 flex flex-col">
              <TabsList className="w-full mb-3">
                <TabsTrigger value="hive" className="text-xs relative w-full" data-testid="tab-hive-mind">
                  <Handshake className="h-3 w-3 mr-1" />
                  Hive Mind
                  {hasNewEvents && (
                    <span className="absolute -top-1 -right-1 bg-purple-500 rounded-full h-2 w-2" />
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Hive Mind Tab */}
              <TabsContent value="hive" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
                {/* Channel status */}
                {hiveData?.channel && (
                  <div className="flex flex-wrap gap-2 py-2 border-b">
                    <Badge 
                      variant={hiveData.channel.sessionPhase === 'active' ? 'default' : 'secondary'} 
                      className="text-xs"
                    >
                      {hiveData.channel.sessionPhase === 'active' ? 'Live Session' : 
                       hiveData.channel.sessionPhase === 'post_session' ? 'Post-Session' : 'Completed'}
                    </Badge>
                    {hiveData.channel.targetLanguage && (
                      <Badge variant="outline" className="text-xs">
                        {hiveData.channel.targetLanguage}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {hiveData.snapshots.length} beacons
                    </Badge>
                  </div>
                )}

                {/* Beacon feed - Real-time Daniela-Editor dialogue */}
                <ScrollArea className="flex-1 -mx-6 px-6">
                  {hiveLoading || channelsLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading...</div>
                  ) : !conversationId ? (
                    // No active conversation - show recent channels
                    <div className="py-4">
                      <p className="text-xs text-muted-foreground mb-3">No active voice session. Recent channels:</p>
                      {recentChannels && recentChannels.length > 0 ? (
                        <div className="space-y-2">
                          {recentChannels.slice(0, 5).map((channel) => (
                            <div key={channel.id} className="p-2 rounded-lg border text-xs">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {channel.sessionPhase}
                                </Badge>
                                {channel.targetLanguage && (
                                  <span className="text-muted-foreground">{channel.targetLanguage}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(channel.startedAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No previous channels found.</p>
                      )}
                    </div>
                  ) : !hiveData?.channel ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      <p>No hive channel for this session yet.</p>
                      <p className="text-xs mt-1">Channel creates when voice session starts.</p>
                    </div>
                  ) : !hiveData.snapshots.length ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      <p>Listening for teaching moments...</p>
                      <p className="text-xs mt-1">Beacons appear when Daniela teaches or student struggles.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 py-3">
                      {hiveData.snapshots.map((snapshot) => {
                        const beaconInfo = beaconTypeIcons[snapshot.beaconType] || { label: 'Insight', Icon: Lightbulb };
                        const BeaconIcon = beaconInfo.Icon;
                        return (
                          <div
                            key={snapshot.id}
                            className={`p-3 rounded-lg border text-sm space-y-2 ${
                              snapshot.editorResponse 
                                ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/20' 
                                : 'border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20'
                            }`}
                            data-testid={`beacon-${snapshot.id}`}
                          >
                            {/* Beacon header */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <BeaconIcon className="h-4 w-4 text-primary" />
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {beaconInfo.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {new Date(snapshot.createdAt).toLocaleTimeString()}
                              </span>
                            </div>

                            {/* Tutor turn */}
                            <div className="bg-background/50 rounded p-2">
                              <p className="text-[10px] text-muted-foreground mb-1 font-medium">Daniela:</p>
                              <p className="text-xs">{snapshot.tutorTurn}</p>
                            </div>

                            {/* Student turn (if present) */}
                            {snapshot.studentTurn && (
                              <div className="bg-background/50 rounded p-2">
                                <p className="text-[10px] text-muted-foreground mb-1 font-medium">Student:</p>
                                <p className="text-xs">{snapshot.studentTurn}</p>
                              </div>
                            )}

                            {/* Beacon reason */}
                            {snapshot.beaconReason && (
                              <p className="text-[10px] text-muted-foreground italic">
                                Reason: {snapshot.beaconReason}
                              </p>
                            )}

                            {/* Editor response */}
                            {snapshot.editorResponse ? (
                              <div className="border-t pt-2 mt-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-medium text-green-700 dark:text-green-400">Editor responded:</span>
                                  {snapshot.editorRespondedAt && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(snapshot.editorRespondedAt).toLocaleTimeString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs bg-green-100/50 dark:bg-green-900/30 rounded p-2">
                                  {snapshot.editorResponse}
                                </p>
                              </div>
                            ) : (
                              <div className="border-t pt-2 mt-2">
                                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Awaiting Editor response...
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Collaboration Events Feed - Daniela ↔ Architect */}
                {collabEvents.length > 0 && (
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Radio className="h-4 w-4 text-purple-500" />
                      <span className="text-xs font-medium">Collaboration Feed</span>
                      {hasNewEvents && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-purple-500">
                          New
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {collabEvents.length} events
                      </span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {collabEvents.slice(0, 10).map((event) => (
                        <div
                          key={event.id}
                          className={`p-2 rounded-lg border text-xs ${
                            event.senderRole === 'daniela'
                              ? 'border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20'
                              : event.senderRole === 'editor'
                              ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/20'
                              : 'border-purple-500/30 bg-purple-50/30 dark:bg-purple-950/20'
                          }`}
                          data-testid={`collab-event-${event.id}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] px-1.5 py-0 ${
                                event.senderRole === 'daniela' ? 'border-blue-300 text-blue-600 dark:text-blue-400' :
                                event.senderRole === 'editor' ? 'border-green-300 text-green-600 dark:text-green-400' :
                                'border-purple-300 text-purple-600 dark:text-purple-400'
                              }`}
                            >
                              {event.senderRole === 'daniela' ? 'Daniela' : 
                               event.senderRole === 'editor' ? 'Architect' : 'Founder'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {event.eventType.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {new Date(event.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs line-clamp-2">{event.summary || event.content.slice(0, 150)}</p>
                          {!event.isResolved && (event.metadata as any)?.actionRequired && (
                            <Badge variant="secondary" className="text-[10px] mt-1">
                              Action Required
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Panel footer - channel info */}
                {hiveData?.channel && (
                  <div className="border-t pt-2 mt-auto text-[10px] text-muted-foreground">
                    Channel: {hiveData.channel.id.slice(0, 8)}... | Started: {new Date(hiveData.channel.startedAt).toLocaleTimeString()}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
      )}
      
      {/* Top spacer for vertical centering */}
      <div className="flex-1 min-h-4" />
      
      {/* Fixed Tutor Visual - larger avatar container */}
      <div className="flex-shrink-0 relative w-full max-w-lg mx-auto aspect-square max-h-[45vh] flex items-center justify-center">
        {/* 3-Way Collaboration Indicator - Founder Mode only, visible during active session */}
        <CollaborationIndicator
          isFounderMode={isDeveloper}
          tutorName={tutorGender === 'male' ? (maleVoiceName || 'Agustin') : (femaleVoiceName || 'Daniela')}
          tutorStatus={isPlaying ? 'speaking' : isProcessing ? 'thinking' : isRecording ? 'listening' : 'idle'}
          isSessionActive={isPlaying || isProcessing || isRecording || openMicState === 'listening' || openMicState === 'ready' || openMicState === 'processing'}
        />
        
        <img
          src={tutorImageUrl}
          alt="Language Tutor"
          className="max-w-full max-h-full object-contain"
          data-testid={`avatar-state-${getAvatarState()}`}
        />
        
        {/* Recording Indicator - only show in push-to-talk mode */}
        {/* In open-mic mode, the mic button already shows state clearly */}
        {isRecording && inputMode === 'push-to-talk' && (
          <div 
            className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-destructive/90 text-destructive-foreground rounded-full shadow-lg"
            data-testid="indicator-recording"
          >
            <div className="w-3 h-3 bg-destructive-foreground rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
          </div>
        )}
        
        {/* Thinking Indicator - Shows during AI response generation (push-to-talk only) */}
        {/* Only show when processing AND not recording AND not already playing */}
        {isProcessing && !isRecording && !isPlaying && inputMode === 'push-to-talk' && (
          <div 
            className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-blue-500/90 text-white rounded-full shadow-lg animate-pulse"
            data-testid="indicator-thinking"
          >
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Thinking...</span>
          </div>
        )}
        
        {/* Open Mic Status - Minimal indicator like a real phone call */}
        {/* Just a small green dot when mic is live, nothing else */}
        {inputMode === 'open-mic' && (
          <>
            {isRecording || openMicState === 'processing' || openMicState === 'ready' || openMicState === 'listening' ? (
              // MIC HOT: Small green dot - no text, no distraction
              <div 
                className="absolute top-4 right-4 w-4 h-4 bg-green-500 rounded-full shadow-lg"
                data-testid="indicator-mic-hot"
              />
            ) : (
              // MIC OFF: Small gray dot
              <div 
                className="absolute top-4 right-4 w-4 h-4 bg-gray-400 rounded-full shadow-lg opacity-50"
                data-testid="indicator-mic-off"
              />
            )}
          </>
        )}
        
        
        {/* Whiteboard Overlay - Tutor-controlled visual teaching aids */}
        {/* The tutor now controls all visual display via whiteboard tools (WRITE, PHONETIC, PLAY, etc.) */}
        {/* Students can use History view or text chat mode to read full conversations */}
        {whiteboardItems.length > 0 && (
          <Whiteboard 
            items={whiteboardItems} 
            onClear={onClearWhiteboard}
            onDrillComplete={onDrillComplete}
            onTextInputSubmit={onTextInputSubmit}
          />
        )}
        
        {/* Floating Subtitle Overlay - Karaoke-style word highlighting */}
        {/* Two independent display systems: */}
        {/* 1. Regular subtitles: [SUBTITLE off/on/target] - what Daniela is saying */}
        {/* 2. Custom overlay: [SHOW: text] / [HIDE] - teaching moments overlay */}
        {subtitleState && (
          <FloatingSubtitleOverlay 
            subtitleState={subtitleState}
            regularSubtitleMode={regularSubtitleMode}
            customOverlayText={customOverlayText}
          />
        )}
      </div>

      {/* Floating Microphone Button - compact layout with safe bottom padding */}
      <div className="flex-shrink-0 pt-2 pb-16 flex flex-col items-center gap-2">
        {/* Input Mode Toggle - Developer only (Open Mic still in development) */}
        {/* TODO: Unmask for all users when Open Mic is production-ready */}
        {/* See docs/batch-doc-updates.md for tracking */}
        {setInputMode && isDeveloper && (
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputMode('push-to-talk')}
              className={`h-7 px-2 text-xs ${inputMode === 'push-to-talk' ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600' : ''}`}
              data-testid="button-mode-push-to-talk"
            >
              <Mic className="h-3 w-3 mr-1" />
              Tap & Hold
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputMode('open-mic')}
              className={`h-7 px-2 text-xs ${inputMode === 'open-mic' ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600' : ''}`}
              data-testid="button-mode-open-mic"
            >
              <Radio className="h-3 w-3 mr-1" />
              Open Mic
            </Button>
          </div>
        )}
        
        {/* Instruction text - simple two-state model */}
        <p className="text-xs text-muted-foreground" data-testid="text-mic-instruction">
          {isConnecting 
            ? `Calling ${tutorGender === 'male' ? maleVoiceName : femaleVoiceName}...` 
            : inputMode === 'open-mic'
              ? isPlaying
                ? ""  // No instruction when Daniela is talking - indicator shows "Daniela"
                : isRecording || openMicState === 'processing' || openMicState === 'ready' || openMicState === 'listening'
                  ? ""  // No instruction when listening - indicator shows state
                  : "Tap to connect"  // Mic off
              : isRecording 
                ? "Release to send" 
                : isMicPreparing 
                  ? "Preparing mic..." 
                  : isProcessing 
                    ? "Processing..." 
                    : isPlaying || !isUsersTurn
                      ? "Please wait..."  // Locked out while Daniela speaks or connection not ready
                      : "Hold to speak"
          }
        </p>
        
        <div className="flex justify-center items-center gap-3">
        {/* End Call Button - always enabled, allows hanging up even mid-processing */}
        {onEndCall && (
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="destructive"
              size="icon"
              onClick={onEndCall}
              className="rounded-full"
              data-testid="button-end-call"
              aria-label="End voice session"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
            <span className="text-[10px] text-muted-foreground">End Call</span>
          </div>
        )}

        {/* Main Recording Button - behavior depends on input mode */}
        {/* Push-to-talk: Hold to record, release to submit */}
        {/* Open-mic: Tap to toggle listening, VAD auto-submits */}
        <div className="flex flex-col items-center gap-1">
          {inputMode === 'open-mic' ? (
            // Open Mic Mode: TRUE DUPLEX - always green when active
            <Button
              variant="default"
              size="icon"
              onClick={() => {
                console.log('[MIC BUTTON] Open mic toggle click, isRecording:', isRecording);
                if (isRecording) {
                  onRecordingStop();
                } else {
                  onRecordingStart();
                }
              }}
              className={`h-14 w-14 md:h-16 md:w-16 rounded-full shadow-lg select-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
                isRecording 
                  ? openMicState === 'listening'
                    ? 'animate-pulse bg-green-500 hover:bg-green-600'  // Pulsing: user speaking
                    : 'bg-green-500 hover:bg-green-600'  // Solid green: mic hot (duplex)
                  : ''
              }`}
              data-testid={isRecording ? "button-open-mic-active" : "button-open-mic-idle"}
              aria-pressed={isRecording}
              aria-label={isRecording ? "Mic hot - tap to stop" : "Tap to start"}
            >
              {isRecording ? (
                <Radio className="h-7 w-7 md:h-8 md:w-8" />
              ) : (
                <Mic className="h-7 w-7 md:h-8 md:w-8" />
              )}
            </Button>
          ) : (
            // Push-to-Talk Mode: Hold button
            <Button
              variant={isRecording ? "destructive" : isMicPreparing ? "secondary" : "default"}
              size="icon"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[MIC BUTTON] Touch start, isUsersTurn:', isUsersTurn);
                if (isUsersTurn && !isRecording && !isMicPreparing && !isPointerRecordingRef.current) {
                  isPointerRecordingRef.current = true;
                  onRecordingStart();
                }
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[MIC BUTTON] Touch end');
                if (isPointerRecordingRef.current || isMicPreparing) {
                  isPointerRecordingRef.current = false;
                  onRecordingStop();
                }
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                console.log('[MIC BUTTON] Touch cancel');
                if (isPointerRecordingRef.current || isMicPreparing) {
                  isPointerRecordingRef.current = false;
                  onRecordingStop();
                }
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                console.log('[MIC BUTTON] Mouse down, isUsersTurn:', isUsersTurn);
                if (isUsersTurn && !isRecording && !isMicPreparing && !isPointerRecordingRef.current) {
                  isPointerRecordingRef.current = true;
                  onRecordingStart();
                }
              }}
              onMouseUp={(e) => {
                e.preventDefault();
                console.log('[MIC BUTTON] Mouse up');
                if (isPointerRecordingRef.current || isMicPreparing) {
                  isPointerRecordingRef.current = false;
                  onRecordingStop();
                }
              }}
              onMouseLeave={(e) => {
                if (isPointerRecordingRef.current || isMicPreparing) {
                  console.log('[MIC BUTTON] Mouse leave while recording/preparing');
                  isPointerRecordingRef.current = false;
                  onRecordingStop();
                }
              }}
              disabled={!isUsersTurn}
              className={`h-14 w-14 md:h-16 md:w-16 rounded-full shadow-lg select-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ${isMicPreparing ? 'animate-pulse' : ''} ${!isUsersTurn ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
              data-testid={isRecording ? "button-stop-recording" : isMicPreparing ? "button-preparing" : "button-start-recording"}
              aria-pressed={isRecording || isMicPreparing}
              aria-label={isMicPreparing ? "Preparing microphone..." : "Press and hold to speak"}
            >
              {isRecording ? (
                <MicOff className="h-7 w-7 md:h-8 md:w-8" />
              ) : isMicPreparing ? (
                <Mic className="h-7 w-7 md:h-8 md:w-8 animate-pulse" />
              ) : (
                <Mic className="h-7 w-7 md:h-8 md:w-8" />
              )}
            </Button>
          )}
          {inputMode !== 'open-mic' && (
            <span className="text-[10px] text-muted-foreground">
              {!isUsersTurn ? "Please wait" : "Hold to speak"}
            </span>
          )}
        </div>

        {/* Slow Repeat button removed: PLAY whiteboard tool with speed control handles this */}
        {/* Hooks preserved for potential DevTools access */}

        {/* Developer Tools - Reload Credits and Reset Data */}
        {isDeveloper && (onReloadCredits || onResetData) && (
          <div className="flex flex-col items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 md:h-12 md:w-12 bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
                  data-testid="button-dev-tools-tutor"
                  title="Developer Tools"
                >
                  {(isReloadingCredits || isResettingData) ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48">
                <DropdownMenuLabel>Dev Tools</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {onReloadCredits && (
                  <DropdownMenuItem
                    onClick={onReloadCredits}
                    disabled={!classId || isReloadingCredits}
                    className="cursor-pointer"
                    data-testid="button-reload-credits-tutor"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span>Reload Credits</span>
                      {classId ? (
                        <span className="text-xs text-muted-foreground">Reset to 120 hrs</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No class</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                )}
                {onResetData && (
                  <DropdownMenuItem
                    onClick={onResetData}
                    disabled={isResettingData}
                    className="cursor-pointer text-destructive focus:text-destructive"
                    data-testid="button-reset-data-tutor"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span>Reset Data</span>
                      <span className="text-xs opacity-70">Clear all progress</span>
                    </div>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Dev Tools</span>
          </div>
        )}
        </div>
        
      </div>
      
      {/* Debug timing panel - disabled for production */}
      {/* <DebugTimingPanel /> */}
    </div>
  );
}
