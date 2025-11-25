import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, MessageSquare, RotateCcw, Volume2 } from "lucide-react";
import { type Message } from "@shared/schema";
import Lottie from "lottie-react";
import idleBreathingAnimation from "@assets/lottie/tutor_idle_breathing.json";
import listeningPulseAnimation from "@assets/lottie/tutor_listening_pulse.json";
import speakingBreathingAnimation from "@assets/lottie/tutor_speaking_breathing.json";

interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

interface ImmersiveTutorProps {
  conversationId: string;
  messages: Message[];
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
  isProcessing?: boolean;
  isPlaying: boolean;
  currentPlayingMessageId?: string;
  onToggleView?: () => void; // Toggle between live and history view
  audioElementRef?: React.RefObject<HTMLAudioElement>; // Reference to the actual audio element
  onReplay?: () => void; // Replay last audio
  canReplay?: boolean; // Whether replay is available
}

export function ImmersiveTutor({
  conversationId,
  messages,
  onRecordingStart,
  onRecordingStop,
  isRecording,
  isProcessing = false,
  isPlaying,
  currentPlayingMessageId,
  onToggleView,
  audioElementRef,
  onReplay,
  canReplay,
}: ImmersiveTutorProps) {
  const [currentText, setCurrentText] = useState<string>("");
  const [currentWordTimings, setCurrentWordTimings] = useState<WordTiming[]>([]);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const subtitleTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Get the last assistant message for display
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");

  // Update current text and timings when a new message is playing
  useEffect(() => {
    // Clear any existing subtitle timers to prevent stale updates
    subtitleTimersRef.current.forEach(timer => clearTimeout(timer));
    subtitleTimersRef.current = [];

    if (currentPlayingMessageId && isPlaying) {
      const message = messages.find(m => m.id === currentPlayingMessageId);
      if (message && message.role === "assistant") {
        // PHASE 3: Fast foreign-language display
        // Show ONLY target language text immediately - fast and stable
        // If no targetLanguageText (e.g., greetings), show nothing (immersive learning)
        const displayText = message.targetLanguageText || "";
        setCurrentText(displayText);
        
        // Not using word timings or karaoke highlighting for speed/stability
        setCurrentWordTimings([]);
        setHighlightedWordIndex(-1);
      }
    } else if (!isPlaying && currentPlayingMessageId) {
      // Audio finished - Keep text visible for reading practice
      setCurrentWordTimings([]);
      setHighlightedWordIndex(-1);
    }

    // Cleanup function: clear all subtitle timers on unmount or dependency change
    return () => {
      subtitleTimersRef.current.forEach(timer => clearTimeout(timer));
      subtitleTimersRef.current = [];
    };
  }, [currentPlayingMessageId, isPlaying, messages]);

  // Sync word highlighting with audio playback
  useEffect(() => {
    if (!isPlaying || currentWordTimings.length === 0 || !audioElementRef?.current) {
      setHighlightedWordIndex(-1);
      return;
    }

    const updateHighlight = () => {
      if (audioElementRef?.current) {
        const currentTime = audioElementRef.current.currentTime;
        
        // Find which word should be highlighted based on current time
        const wordIndex = currentWordTimings.findIndex(
          timing => currentTime >= timing.startTime && currentTime < timing.endTime
        );
        
        setHighlightedWordIndex(wordIndex);
      }
      animationFrameRef.current = requestAnimationFrame(updateHighlight);
    };

    animationFrameRef.current = requestAnimationFrame(updateHighlight);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentWordTimings, audioElementRef]);

  // Determine avatar state and select corresponding animation (3 distinct animations)
  const avatarState = isRecording ? "listening" : isPlaying ? "speaking" : "idle";
  
  // Select unique animation for each state
  const getCurrentAnimation = () => {
    if (isRecording) return listeningPulseAnimation;
    if (isPlaying) return speakingBreathingAnimation;
    return idleBreathingAnimation;
  };
  
  const currentAnimation = getCurrentAnimation();

  // Get state configuration with icon and styles
  const getStateConfig = () => {
    if (isRecording) {
      return {
        label: "Listening to you...",
        icon: <Mic className="w-16 h-16 md:w-20 md:h-20 text-primary" />,
        opacity: 0.9,
      };
    }
    if (isPlaying) {
      return {
        label: "Teaching",
        icon: <Volume2 className="w-16 h-16 md:w-20 md:h-20 text-primary" />,
        opacity: 0.95,
      };
    }
    return {
      label: "Ready to help",
      icon: null,
      opacity: 0.7,
    };
  };

  const stateConfig = getStateConfig();

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Subtle Animation with State Icons - 3 distinct states */}
      <div className="flex-shrink-0 relative w-full aspect-square md:aspect-video max-h-[60vh] bg-gradient-to-b from-muted/30 to-background">
        <div
          className="w-full h-full flex flex-col items-center justify-center p-8 gap-4"
          data-testid={`avatar-state-${avatarState}`}
        >
          {/* Lottie animation with icon overlay - unique animation per state */}
          <div className="relative w-48 h-48 md:w-64 md:h-64">
            {/* Lottie animation (idle/listening/speaking) */}
            <Lottie
              animationData={currentAnimation}
              loop={true}
              autoplay={true}
              style={{ width: "100%", height: "100%", opacity: stateConfig.opacity }}
              rendererSettings={{
                preserveAspectRatio: "xMidYMid meet"
              }}
            />
            
            {/* State icon overlay - centered on animation */}
            {stateConfig.icon && (
              <div className="absolute inset-0 flex items-center justify-center">
                {stateConfig.icon}
              </div>
            )}
          </div>
          
          {/* Clear state label */}
          <p 
            className="text-base md:text-lg text-muted-foreground font-medium"
            aria-live="polite"
          >
            {stateConfig.label}
          </p>
        </div>
        
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
        
        {/* Subtitle Overlay */}
        {currentText && (
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background/95 via-background/80 to-transparent">
            <div className="max-w-4xl mx-auto">
              <div 
                className="text-xl md:text-3xl font-medium text-center leading-relaxed"
                data-testid="text-subtitle-overlay"
              >
                {currentWordTimings.length > 0 ? (
                  // Word-by-word highlighting
                  currentWordTimings.map((timing, index) => (
                    <span
                      key={index}
                      className={`inline-block mx-1 transition-all duration-150 ${
                        index === highlightedWordIndex
                          ? "text-primary scale-110 font-bold"
                          : "text-foreground"
                      }`}
                    >
                      {timing.word}
                    </span>
                  ))
                ) : (
                  // Fallback: show full text without highlighting
                  <span className="text-foreground">{currentText}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-0" />

      {/* Floating Microphone Button */}
      <div className="flex-shrink-0 p-6 flex justify-center items-center gap-4">
        {/* Toggle to History View */}
        {onToggleView && (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleView}
            className="h-12 w-12 md:h-14 md:w-14"
            data-testid="button-toggle-history"
          >
            <MessageSquare className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        )}

        {/* Replay Last Audio Button */}
        {onReplay && (
          <Button
            variant="outline"
            size="icon"
            onClick={onReplay}
            disabled={!canReplay}
            className="h-12 w-12 md:h-14 md:w-14"
            data-testid="button-replay"
          >
            <RotateCcw className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        )}

        {/* Main Recording Button (Push-to-Talk) */}
        <Button
          variant={isRecording ? "destructive" : "default"}
          size="icon"
          onPointerDown={(e) => {
            e.preventDefault();
            if (!isRecording && !isProcessing) {
              onRecordingStart();
            }
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            if (isRecording) {
              onRecordingStop();
            }
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            if (isRecording) {
              onRecordingStop();
            }
          }}
          onPointerLeave={(e) => {
            e.preventDefault();
            if (isRecording) {
              onRecordingStop();
            }
          }}
          onTouchCancel={(e) => {
            e.preventDefault();
            if (isRecording) {
              onRecordingStop();
            }
          }}
          disabled={isProcessing}
          className="h-20 w-20 md:h-24 md:w-24 rounded-full shadow-lg"
          data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
          aria-pressed={isRecording}
          aria-label="Press and hold to speak"
        >
          {isRecording ? (
            <MicOff className="h-10 w-10 md:h-12 md:w-12" />
          ) : (
            <Mic className="h-10 w-10 md:h-12 md:w-12" />
          )}
        </Button>
      </div>
    </div>
  );
}
