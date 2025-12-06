import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, MessageSquare, RefreshCw, Trash2, Loader2 } from "lucide-react";
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
import type { WhiteboardItem } from "@shared/whiteboard-types";

// Female tutor avatars (default)
import femaleTutorSpeakingUrl from "@assets/tutor-speaking-No-Background_1764099971093.png";
import femaleTutorListeningUrl from "@assets/tutor-listening-no-background_1764099971094.png";

// Male tutor avatars
import maleTutorSpeakingUrl from "@assets/Boy-tutor-speaking-No-Background_1764186322050.png";
import maleTutorListeningUrl from "@assets/Boy-tutor-waiting-No-Background_1764186322051.png";

interface ImmersiveTutorProps {
  messages: Message[];
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
  isMicPreparing?: boolean;
  isProcessing?: boolean;
  isPlaying: boolean;
  isConnecting?: boolean;
  onToggleView?: () => void;
  tutorGender?: 'male' | 'female';
  voiceSpeed?: VoiceSpeed;
  setTutorGender?: (gender: 'male' | 'female') => void;
  setVoiceSpeed?: (speed: VoiceSpeed) => void;
  femaleVoiceName?: string;
  maleVoiceName?: string;
  baseSpeakingRate?: number;
  isDeveloper?: boolean;
  classId?: string | null;
  onReloadCredits?: () => void;
  onResetData?: () => void;
  isReloadingCredits?: boolean;
  isResettingData?: boolean;
  whiteboardItems?: WhiteboardItem[];
  onClearWhiteboard?: () => void;
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
  onToggleView,
  tutorGender = "female",
  voiceSpeed = "normal",
  setTutorGender,
  setVoiceSpeed,
  femaleVoiceName,
  maleVoiceName,
  baseSpeakingRate = 1.0,
  isDeveloper = false,
  classId,
  onReloadCredits,
  onResetData,
  isReloadingCredits = false,
  isResettingData = false,
  whiteboardItems = [],
  onClearWhiteboard,
}: ImmersiveTutorProps) {
  // Local ref to track if WE started recording via pointer down
  // This ensures pointer up always stops recording regardless of React state timing
  const isPointerRecordingRef = useRef<boolean>(false);

  // Determine which tutor image to show based on state and gender preference
  const getTutorImage = () => {
    // Select avatar set based on gender preference
    const speakingUrl = tutorGender === 'male' ? maleTutorSpeakingUrl : femaleTutorSpeakingUrl;
    const listeningUrl = tutorGender === 'male' ? maleTutorListeningUrl : femaleTutorListeningUrl;
    const idleUrl = listeningUrl; // Idle uses listening pose
    
    if (isPlaying) return speakingUrl;
    if (isRecording) return listeningUrl;
    return idleUrl;
  };
  const tutorImageUrl = getTutorImage();
  
  // Get the current avatar state for test IDs
  const getAvatarState = () => {
    if (isPlaying) return "speaking";
    if (isRecording) return "listening";
    return "idle";
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto items-center">
      {/* Top spacer for vertical centering */}
      <div className="flex-1 min-h-4" />
      
      {/* Fixed Tutor Visual - larger avatar container */}
      <div className="flex-shrink-0 relative w-full max-w-lg mx-auto aspect-square max-h-[45vh] flex items-center justify-center">
        <img
          src={tutorImageUrl}
          alt="Language Tutor"
          className="max-w-full max-h-full object-contain"
          data-testid={`avatar-state-${getAvatarState()}`}
        />
        
        {/* Recording Indicator */}
        {isRecording && (
          <div 
            className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-destructive/90 text-destructive-foreground rounded-full shadow-lg"
            data-testid="indicator-recording"
          >
            <div className="w-3 h-3 bg-destructive-foreground rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
          </div>
        )}
        
        {/* Processing Indicator */}
        {isProcessing && (
          <div 
            className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-primary/90 text-primary-foreground rounded-full shadow-lg"
            data-testid="indicator-processing"
          >
            <div className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Processing</span>
          </div>
        )}
        
        
        {/* Whiteboard Overlay - Tutor-controlled visual teaching aids */}
        {/* The tutor now controls all visual display via whiteboard tools (WRITE, PHONETIC, PLAY, etc.) */}
        {/* Students can use History view or text chat mode to read full conversations */}
        {whiteboardItems.length > 0 && (
          <Whiteboard 
            items={whiteboardItems} 
            onClear={onClearWhiteboard}
          />
        )}
      </div>

      {/* Floating Microphone Button - compact layout with safe bottom padding */}
      <div className="flex-shrink-0 pt-2 pb-16 flex flex-col items-center gap-2">
        {/* Instruction text */}
        <p className="text-xs text-muted-foreground" data-testid="text-mic-instruction">
          {isConnecting ? `Calling ${tutorGender === 'male' ? maleVoiceName : femaleVoiceName}...` : isRecording ? "Release to send" : isMicPreparing ? "Preparing mic..." : isProcessing ? "Processing..." : "Hold to speak"}
        </p>
        
        <div className="flex justify-center items-center gap-3">
        {/* History toggle removed from bottom - already available via Live/History badges at top */}
        {/* Replay button removed: PLAY whiteboard tool handles repetition */}

        {/* Main Recording Button (Push-to-Talk) */}
        {/* Uses explicit touch AND pointer events for reliable mobile support */}
        {/* Wrapped in flex-col to match Repeat/Slow Repeat button structure for alignment */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant={isRecording ? "destructive" : isMicPreparing ? "secondary" : "default"}
            size="icon"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[MIC BUTTON] Touch start');
              if (!isRecording && !isMicPreparing && !isProcessing && !isPointerRecordingRef.current) {
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
              console.log('[MIC BUTTON] Mouse down');
              if (!isRecording && !isMicPreparing && !isProcessing && !isPointerRecordingRef.current) {
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
            disabled={isProcessing || isConnecting}
            className={`h-14 w-14 md:h-16 md:w-16 rounded-full shadow-lg select-none ${isMicPreparing ? 'animate-pulse' : ''}`}
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
          <span className="text-[10px] text-muted-foreground">Hold or ENTER</span>
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
        
        {/* Tutor Voice Toggle */}
        {setTutorGender && (
          <div className="flex items-center justify-center gap-1 mt-2">
            <Button
              variant={tutorGender === "female" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTutorGender("female")}
              data-testid="button-voice-female"
            >
              {femaleVoiceName}
            </Button>
            <Button
              variant={tutorGender === "male" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTutorGender("male")}
              data-testid="button-voice-male"
            >
              {maleVoiceName}
            </Button>
          </div>
        )}
      </div>
      
      {/* Debug timing panel - disabled for production */}
      {/* <DebugTimingPanel /> */}
    </div>
  );
}
