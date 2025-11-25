import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, MessageSquare, RotateCcw } from "lucide-react";
import { type Message } from "@shared/schema";
import { type SubtitleMode } from "@/contexts/LanguageContext";
import tutorSpeakingUrl from "@assets/generated-image-2_1764099555783.png";
import tutorIdleUrl from "@assets/generated_images/Friendly_teacher_idle_state_fd4580c6.png";
import tutorListeningUrl from "@assets/generated-image-1_1764099524493.png";

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
  wordTimings?: WordTiming[]; // Word-level timing data for synchronized subtitles
  subtitleMode?: SubtitleMode; // Subtitle display mode: off, target (target language only), all
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
  wordTimings,
  subtitleMode = "target",
}: ImmersiveTutorProps) {
  const [currentWordTimings, setCurrentWordTimings] = useState<WordTiming[]>([]);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);
  const [visibleWordCount, setVisibleWordCount] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const subtitleTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Get the last assistant message for display
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");

  // Helper function to normalize words for matching (strip punctuation, quotes, accents for comparison)
  const normalizeWord = (word: string): string => {
    return word
      .toLowerCase()
      // Remove all types of quotes and apostrophes (straight, curly, smart, unicode)
      .replace(/[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2032\u2033\u2035\u2036\u0022''""„‟`´]/g, '')
      // Remove all common punctuation
      .replace(/[¡!¿?,.:;()[\]{}<>]/g, '')
      .trim();
  };

  // Helper function to filter word timings to only include target language words
  // Finds ALL occurrences of the target phrase (e.g., "Buenas noches" said twice)
  const filterTargetLanguageTimings = (
    allTimings: WordTiming[],
    targetText: string
  ): WordTiming[] => {
    if (!targetText || !allTimings.length) return [];
    
    // Parse target language text into words (normalize for matching)
    const targetWords = targetText
      .split(/\s+/)
      .map(normalizeWord)
      .filter(w => w.length > 0);
    
    if (targetWords.length === 0) return [];
    
    console.log('[SUBTITLES] Looking for target phrase:', targetWords.join(' '));
    console.log('[SUBTITLES] All timing words:', allTimings.map(t => `"${t.word}"`).join(', '));
    
    // Find ALL occurrences of the target phrase in the timing array
    // This handles cases where the tutor says "Buenas noches" multiple times
    const allOccurrences: WordTiming[] = [];
    let i = 0;
    
    while (i < allTimings.length) {
      const normalizedWord = normalizeWord(allTimings[i].word);
      
      // Check if this could be the start of a target phrase match
      if (normalizedWord === targetWords[0]) {
        // Try to match the full phrase starting here
        let matchedTimings: WordTiming[] = [allTimings[i]];
        let matched = true;
        
        for (let j = 1; j < targetWords.length; j++) {
          const nextIndex = i + j;
          if (nextIndex >= allTimings.length) {
            matched = false;
            break;
          }
          const nextNormalized = normalizeWord(allTimings[nextIndex].word);
          if (nextNormalized !== targetWords[j]) {
            matched = false;
            break;
          }
          matchedTimings.push(allTimings[nextIndex]);
        }
        
        if (matched && matchedTimings.length === targetWords.length) {
          // Found a complete match - add all words from this occurrence
          allOccurrences.push(...matchedTimings);
          console.log('[SUBTITLES] Found occurrence at index', i, ':', matchedTimings.map(t => t.word).join(' '));
          // Skip past this match to find the next occurrence
          i += targetWords.length;
          continue;
        }
      }
      i++;
    }
    
    if (allOccurrences.length > 0) {
      const occurrenceCount = allOccurrences.length / targetWords.length;
      console.log('[SUBTITLES] Found', occurrenceCount, 'occurrence(s) of target phrase,', allOccurrences.length, 'total words');
      return allOccurrences;
    }
    
    // Fallback: couldn't find exact match, return empty
    console.log('[SUBTITLES] Could not match target words, showing text without timing');
    return [];
  };

  // Update word timings when a new message is playing
  useEffect(() => {
    // Clear any existing subtitle timers to prevent stale updates
    subtitleTimersRef.current.forEach(timer => clearTimeout(timer));
    subtitleTimersRef.current = [];
    setVisibleWordCount(0);
    setHighlightedWordIndex(-1);

    if (subtitleMode === "off") {
      setCurrentWordTimings([]);
      return;
    }

    if (currentPlayingMessageId && isPlaying) {
      const message = messages.find(m => m.id === currentPlayingMessageId);
      if (message && message.role === "assistant" && wordTimings && wordTimings.length > 0) {
        
        if (subtitleMode === "target") {
          // Target mode: show only target language words with progressive reveal
          const targetText = message.targetLanguageText || "";
          if (targetText) {
            const filteredTimings = filterTargetLanguageTimings(wordTimings, targetText);
            if (filteredTimings.length > 0) {
              console.log('[SUBTITLES] Target mode: progressive reveal with', filteredTimings.length, 'words');
              setCurrentWordTimings(filteredTimings);
            } else {
              setCurrentWordTimings([]);
            }
          } else {
            setCurrentWordTimings([]);
          }
        } else if (subtitleMode === "all") {
          // All mode: show all words with progressive reveal
          console.log('[SUBTITLES] All mode: showing all', wordTimings.length, 'words');
          setCurrentWordTimings(wordTimings);
        }
      } else {
        setCurrentWordTimings([]);
      }
    } else if (!isPlaying && currentPlayingMessageId) {
      // Audio finished - Show all words for reading practice
      setVisibleWordCount(currentWordTimings.length);
      setHighlightedWordIndex(-1);
    }

    // Cleanup function: clear all subtitle timers on unmount or dependency change
    return () => {
      subtitleTimersRef.current.forEach(timer => clearTimeout(timer));
      subtitleTimersRef.current = [];
    };
  }, [currentPlayingMessageId, isPlaying, messages, subtitleMode, wordTimings]);

  // Sync word highlighting with audio playback - progressive reveal
  useEffect(() => {
    if (!isPlaying || currentWordTimings.length === 0 || !audioElementRef?.current) {
      setHighlightedWordIndex(-1);
      return;
    }

    const updateHighlight = () => {
      if (audioElementRef?.current) {
        const currentTime = audioElementRef.current.currentTime;
        
        // Find which word should be highlighted based on current time
        let currentWordIndex = -1;
        let maxVisibleIndex = -1;
        
        for (let i = 0; i < currentWordTimings.length; i++) {
          const timing = currentWordTimings[i];
          // Word is visible if we've reached its start time
          if (currentTime >= timing.startTime) {
            maxVisibleIndex = i;
          }
          // Word is highlighted if we're within its time range
          if (currentTime >= timing.startTime && currentTime < timing.endTime) {
            currentWordIndex = i;
          }
        }
        
        // Progressive reveal: show words up to and including the current one
        setVisibleWordCount(maxVisibleIndex + 1);
        setHighlightedWordIndex(currentWordIndex);
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

  // Determine which tutor image to show based on state
  const getTutorImage = () => {
    if (isPlaying) return tutorSpeakingUrl;
    if (isRecording) return tutorListeningUrl;
    return tutorIdleUrl;
  };
  const tutorImageUrl = getTutorImage();
  
  // Get the current avatar state for test IDs
  const getAvatarState = () => {
    if (isPlaying) return "speaking";
    if (isRecording) return "listening";
    return "idle";
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Fixed Tutor Visual */}
      <div className="flex-shrink-0 relative w-full aspect-square md:aspect-video max-h-[60vh] bg-gradient-to-b from-muted/30 to-background">
        <img
          src={tutorImageUrl}
          alt="Language Tutor"
          className="w-full h-full object-contain"
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
        
        {/* Subtitle Overlay - Static text display (karaoke highlighting disabled) */}
        {/* 
          KARAOKE FEATURE DISABLED: Word-by-word highlighting requires Neural2 voices with SSML marks,
          but Chirp HD provides superior voice quality for language learning. Karaoke code is preserved
          below for when Chirp HD adds SSML mark support.
          
          TODO: Periodically check Google Cloud TTS documentation for Chirp HD SSML mark support:
          https://cloud.google.com/text-to-speech/docs/ssml
          
          When available, restore karaoke by:
          1. In RestVoiceChat.tsx: Change needTimings to: subtitleMode !== "off"
          2. Uncomment the progressive reveal code below
        */}
        {(() => {
          // When subtitleMode is "off", don't show any overlay
          if (subtitleMode === "off") return null;
          
          // Get text from the current playing or last played message
          // Show subtitles during playback AND after playback for reading practice
          const currentMessage = currentPlayingMessageId 
            ? messages.find(m => m.id === currentPlayingMessageId) 
            : lastAssistantMessage;
          
          if (!currentMessage) return null;
          
          // Determine text based on mode:
          // - "target" mode: ONLY show targetLanguageText (no fallback - hides when no target text)
          // - "all" mode: show full content
          const targetText = currentMessage.targetLanguageText || "";
          const fullContent = currentMessage.content || "";
          
          // For "target" mode, only show if there's actual target language text
          // This prevents showing English content (like greetings) in target-only mode
          if (subtitleMode === "target" && !targetText) {
            return null;
          }
          
          const displayText = subtitleMode === "all" ? fullContent : targetText;
          
          // If no text at all, don't show overlay
          if (!displayText) return null;
          
          /* 
           * KARAOKE CODE - PRESERVED FOR FUTURE USE
           * Uncomment when Chirp HD supports SSML marks:
           *
           * const hasTimings = currentWordTimings.length > 0;
           * const useProgressiveMode = isPlaying && hasTimings;
           * 
           * // During progressive mode with 0 visible words, show nothing (wait for first word)
           * if (useProgressiveMode && visibleWordCount === 0) {
           *   return null;
           * }
           * 
           * // In the render, replace static text with:
           * {useProgressiveMode ? (
           *   currentWordTimings.slice(0, visibleWordCount).map((timing, index) => (
           *     <span
           *       key={index}
           *       className={`inline-block mx-1 transition-all duration-150 ${
           *         index === highlightedWordIndex
           *           ? "text-primary scale-110 font-bold"
           *           : "text-foreground"
           *       }`}
           *     >
           *       {timing.word}
           *     </span>
           *   ))
           * ) : (
           *   <span className="text-foreground">{displayText}</span>
           * )}
           */
          
          return (
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background/95 via-background/80 to-transparent">
              <div className="max-w-4xl mx-auto">
                <div 
                  className="text-xl md:text-3xl font-medium text-center leading-relaxed"
                  data-testid="text-subtitle-overlay"
                >
                  {/* Static subtitle text - Chirp HD voice quality prioritized over karaoke */}
                  <span className="text-foreground">{displayText}</span>
                </div>
              </div>
            </div>
          );
        })()}
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
