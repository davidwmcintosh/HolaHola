import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, MessageSquare } from "lucide-react";
import { type Message } from "@shared/schema";
import tutorSpeakingUrl from "@assets/generated_images/Teacher_speaking_animatedly_62a6f01b.png";
import tutorIdleUrl from "@assets/generated_images/Friendly_teacher_idle_state_fd4580c6.png";

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
}: ImmersiveTutorProps) {
  const [currentText, setCurrentText] = useState<string>("");
  const [currentWordTimings, setCurrentWordTimings] = useState<WordTiming[]>([]);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);
  const animationFrameRef = useRef<number | null>(null);

  // Get the last assistant message for display
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");

  // Update current text and timings when a new message is playing
  useEffect(() => {
    if (currentPlayingMessageId && isPlaying) {
      const message = messages.find(m => m.id === currentPlayingMessageId);
      if (message && message.role === "assistant") {
        // Handle subtitle sequence if available (encouragement + teaching word)
        if (message.subtitlesJson) {
          try {
            const subtitles = JSON.parse(message.subtitlesJson);
            if (Array.isArray(subtitles) && subtitles.length > 0) {
              // Show first subtitle (encouragement)
              setCurrentText(subtitles[0].text);
              
              // After duration (or 2s default), show next subtitle (teaching word)
              if (subtitles.length > 1) {
                const duration = subtitles[0].duration || 2000;
                setTimeout(() => {
                  setCurrentText(subtitles[1].text);
                }, duration);
              }
              return;
            }
          } catch (e) {
            console.error("Failed to parse subtitle sequence:", e);
          }
        }
        
        // Fallback: Show ONLY target language text (Spanish, French, etc.)
        setCurrentText(message.targetLanguageText || "");
        
        // Parse word timings if available
        if (message.wordTimingsJson) {
          try {
            const timings = JSON.parse(message.wordTimingsJson);
            setCurrentWordTimings(timings);
          } catch (e) {
            console.error("Failed to parse word timings:", e);
            setCurrentWordTimings([]);
          }
        } else {
          setCurrentWordTimings([]);
        }
      }
    } else if (!isPlaying && currentPlayingMessageId) {
      // Audio finished - KEEP the teaching word visible but clear word-level highlighting
      // This allows students to see the word they should practice saying
      setCurrentWordTimings([]);
      setHighlightedWordIndex(-1);
      // Note: currentText is intentionally NOT cleared - the teaching word remains visible
    }
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

  // Determine which tutor image to show
  const tutorImageUrl = isPlaying ? tutorSpeakingUrl : tutorIdleUrl;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Fixed Tutor Visual */}
      <div className="flex-shrink-0 relative w-full aspect-square md:aspect-video max-h-[60vh] bg-gradient-to-b from-muted/30 to-background">
        <img
          src={tutorImageUrl}
          alt="Language Tutor"
          className="w-full h-full object-contain"
          data-testid={isPlaying ? "avatar-state-speaking" : "avatar-state-idle"}
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
