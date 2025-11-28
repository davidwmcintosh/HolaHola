import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, MessageSquare, RotateCcw, Turtle } from "lucide-react";
import { type Message } from "@shared/schema";
import { type SubtitleMode } from "@/contexts/LanguageContext";

// Female tutor avatars (default)
import femaleTutorSpeakingUrl from "@assets/tutor-speaking-No-Background_1764099971093.png";
import femaleTutorListeningUrl from "@assets/tutor-listening-no-background_1764099971094.png";

// Male tutor avatars
import maleTutorSpeakingUrl from "@assets/Boy-tutor-speaking-No-Background_1764186322050.png";
import maleTutorListeningUrl from "@assets/Boy-tutor-waiting-No-Background_1764186322051.png";

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
  isMicPreparing?: boolean; // Show "Preparing mic..." before mic is ready
  isProcessing?: boolean;
  isPlaying: boolean;
  currentPlayingMessageId?: string;
  onToggleView?: () => void; // Toggle between live and history view
  audioElementRef?: React.RefObject<HTMLAudioElement>; // Reference to the actual audio element
  onReplay?: () => void; // Replay last audio
  canReplay?: boolean; // Whether replay is available (requires stored audio blob)
  onSlowRepeat?: () => void; // Request slow, simplified repeat
  canSlowRepeat?: boolean; // Whether slow repeat is available (requires assistant message)
  isSlowRepeatLoading?: boolean; // Whether slow repeat is loading
  wordTimings?: WordTiming[]; // Word-level timing data for synchronized subtitles
  subtitleMode?: SubtitleMode; // Subtitle display mode: off, target (target language only), all
  tutorGender?: 'male' | 'female'; // Tutor avatar gender preference
  streamingText?: string; // Text from streaming voice mode
  streamingTargetText?: string; // Target language only text from streaming mode
  streamingWordIndex?: number; // Current word index for streaming subtitles
  streamingTargetWordIndex?: number; // Current word index for target-only text (enables karaoke in Target mode)
}

export function ImmersiveTutor({
  conversationId,
  messages,
  onRecordingStart,
  onRecordingStop,
  isRecording,
  isMicPreparing = false,
  isProcessing = false,
  isPlaying,
  currentPlayingMessageId,
  onToggleView,
  audioElementRef,
  onReplay,
  canReplay,
  onSlowRepeat,
  canSlowRepeat,
  isSlowRepeatLoading = false,
  wordTimings,
  subtitleMode = "target",
  tutorGender = "female",
  streamingText,
  streamingTargetText,
  streamingWordIndex = -1,
  streamingTargetWordIndex = -1,
}: ImmersiveTutorProps) {
  const [currentWordTimings, setCurrentWordTimings] = useState<WordTiming[]>([]);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);
  const [visibleWordCount, setVisibleWordCount] = useState<number>(0);
  // For target mode: track which specific word indices are visible (handles non-contiguous visibility)
  const [visibleWordIndices, setVisibleWordIndices] = useState<Set<number>>(new Set());
  const visibleWordIndicesRef = useRef<Set<number>>(new Set()); // Ref to compare against for diff-aware updates
  const animationFrameRef = useRef<number | null>(null);
  const subtitleTimersRef = useRef<NodeJS.Timeout[]>([]);
  
  // Local ref to track if WE started recording via pointer down
  // This ensures pointer up always stops recording regardless of React state timing
  const isPointerRecordingRef = useRef<boolean>(false);

  // Get the last assistant message for display
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");

  // Helper function to normalize words for matching (strip punctuation, quotes, phoneme syntax, accents for comparison)
  const normalizeWord = (word: string): string => {
    return word
      .toLowerCase()
      // Strip Cartesia phoneme syntax <<phoneme1|phoneme2>> → extract just the phonemes as the word
      .replace(/<<([^>]+)>>/g, '$1')
      // Remove phoneme pipe separators (e.g., "o|l|a" → "ola")
      .replace(/\|/g, '')
      // Remove all types of quotes and apostrophes (straight, curly, smart, unicode)
      .replace(/[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2032\u2033\u2035\u2036\u0022''""„‟`´]/g, '')
      // Remove all common punctuation
      .replace(/[¡!¿?,.:;()[\]{}<>]/g, '')
      .trim();
  };
  
  // Helper function to clean phoneme syntax for display (keep punctuation but remove <<>> syntax)
  const cleanForDisplay = (word: string): string => {
    // Replace <<phoneme>> syntax with just the phonemes joined (e.g., <<o|l|a>> → "ola")
    // Then capitalize first letter if the original was capitalized
    return word.replace(/<<([^>]+)>>/g, (_, phonemes) => {
      const cleaned = phonemes.replace(/\|/g, '');
      // Capitalize if word started with << (which replaced a capital letter)
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    });
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
      if (visibleWordIndicesRef.current.size > 0) {
        visibleWordIndicesRef.current = new Set();
        setVisibleWordIndices(new Set());
      }
      return;
    }

    const updateHighlight = () => {
      if (audioElementRef?.current) {
        const currentTime = audioElementRef.current.currentTime;
        
        // Find which word should be highlighted based on current time
        let currentWordIndex = -1;
        let maxVisibleIndex = -1;
        
        // For target mode: track specific visible indices (handles non-contiguous visibility)
        // This ensures repeated words (like "Hola" twice) appear and disappear independently
        const isTargetMode = subtitleMode === "target";
        const lingerTime = 0.5; // Words stay visible 0.5s after their end time
        const newVisibleIndices = new Set<number>();
        
        for (let i = 0; i < currentWordTimings.length; i++) {
          const timing = currentWordTimings[i];
          
          if (isTargetMode) {
            // Target mode: word is visible during its window + brief linger
            if (currentTime >= timing.startTime && currentTime < timing.endTime + lingerTime) {
              newVisibleIndices.add(i);
            }
          } else {
            // All mode: progressive reveal (words stay visible once reached)
            if (currentTime >= timing.startTime) {
              maxVisibleIndex = i;
            }
          }
          
          // Word is highlighted if we're within its time range
          if (currentTime >= timing.startTime && currentTime < timing.endTime) {
            currentWordIndex = i;
          }
        }
        
        if (isTargetMode) {
          // Diff-aware update: only update state if membership actually changed
          // This avoids re-rendering every animation frame
          const oldSet = visibleWordIndicesRef.current;
          const setsAreDifferent = newVisibleIndices.size !== oldSet.size ||
            Array.from(newVisibleIndices).some(i => !oldSet.has(i));
          
          if (setsAreDifferent) {
            visibleWordIndicesRef.current = newVisibleIndices;
            setVisibleWordIndices(newVisibleIndices);
            setVisibleWordCount(newVisibleIndices.size);
          }
        } else {
          setVisibleWordCount(maxVisibleIndex + 1);
        }
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
  }, [isPlaying, currentWordTimings, audioElementRef, subtitleMode]);

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
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Top spacer for vertical centering */}
      <div className="flex-1 min-h-4" />
      
      {/* Fixed Tutor Visual - balanced max-h for tutor and mic controls */}
      <div className="flex-shrink-0 relative w-full aspect-square md:aspect-video max-h-[50vh] bg-gradient-to-b from-muted/30 to-background">
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
        
        {/* Subtitle Overlay - Karaoke-style word highlighting with Cartesia estimated timings */}
        {(() => {
          // When subtitleMode is "off", don't show any overlay
          if (subtitleMode === "off") return null;
          
          // STREAMING MODE: Use streaming text if available
          // When streaming text is set, we're in streaming mode - don't fall through to non-streaming path
          // This prevents showing accumulated target words from the database after streaming ends
          if (streamingText) {
            // For "target" mode, use streamingTargetText if available
            const isTargetMode = subtitleMode === "target";
            const displayTextForStreaming = isTargetMode 
              ? (streamingTargetText || '') 
              : streamingText;
            
            // For "target" mode with no target text available, don't show subtitles
            if (isTargetMode && !streamingTargetText) {
              // No target language content in streaming - skip display
              return null;
            }
            
            const allWords = displayTextForStreaming.split(/\s+/).filter(w => w.length > 0);
            
            // Karaoke highlighting in streaming mode:
            // - "All" mode: use streamingWordIndex directly (full text word index), show all words
            // - "Target" mode: use streamingTargetWordIndex, show ONLY the current target word
            // Validate index is within bounds to avoid highlighting wrong words
            const rawActiveWordIndex = isTargetMode ? streamingTargetWordIndex : streamingWordIndex;
            const activeWordIndex = (rawActiveWordIndex !== undefined && rawActiveWordIndex >= 0 && rawActiveWordIndex < allWords.length) 
              ? rawActiveWordIndex 
              : -1;
            
            // In Target mode, show only the current target word (not all accumulated words)
            // This ensures only one foreign word appears at a time
            if (isTargetMode) {
              // Determine which word to show:
              // - During playback: show the current word (activeWordIndex)
              // - After playback ends: show the LAST word so student can reference it
              let wordToShowIndex = activeWordIndex;
              
              // If no active word (playback ended or not started), show the last word
              if (wordToShowIndex < 0 && allWords.length > 0) {
                wordToShowIndex = allWords.length - 1;
              }
              
              // If still no word to show, return null
              if (wordToShowIndex < 0 || allWords.length === 0) {
                return null;
              }
              
              // Show the target word (current during playback, last after playback)
              const currentWord = allWords[wordToShowIndex];
              return (
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background/95 via-background/80 to-transparent">
                  <div className="max-w-4xl mx-auto">
                    <div 
                      className="text-xl md:text-3xl font-medium text-center leading-relaxed"
                      data-testid="text-subtitle-overlay-streaming"
                    >
                      <span
                        className="inline-block mx-0.5 text-primary scale-105 font-semibold"
                        data-testid="streaming-word-current"
                      >
                        {cleanForDisplay(currentWord)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            
            // "All" mode: show all words with karaoke highlighting
            const useKaraokeInStreaming = activeWordIndex >= 0;
            
            return (
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background/95 via-background/80 to-transparent">
                <div className="max-w-4xl mx-auto">
                  <div 
                    className="text-xl md:text-3xl font-medium text-center leading-relaxed max-h-32 md:max-h-40 overflow-hidden"
                    style={{
                      maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)'
                    }}
                    data-testid="text-subtitle-overlay-streaming"
                  >
                    {allWords.map((word, index) => (
                      <span
                        key={index}
                        className={`inline-block mx-0.5 transition-all duration-150 ${
                          useKaraokeInStreaming
                            ? (index === activeWordIndex
                                ? "text-primary scale-105 font-semibold"
                                : index < activeWordIndex
                                  ? "text-foreground"
                                  : "text-muted-foreground/50")
                            : "text-foreground font-medium"
                        }`}
                        data-testid={`streaming-word-${index}`}
                      >
                        {cleanForDisplay(word)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          
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
          
          // KARAOKE MODE: Use word-by-word highlighting when we have timings
          const hasTimings = currentWordTimings.length > 0;
          const useProgressiveMode = isPlaying && hasTimings;
          
          // During progressive mode with 0 visible words, show nothing (wait for first word)
          if (useProgressiveMode && visibleWordCount === 0) {
            return null;
          }
          
          return (
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background/95 via-background/80 to-transparent">
              <div className="max-w-4xl mx-auto">
                {/* Max height with mask fade for long text - prevents overflow while staying readable */}
                <div 
                  className="text-xl md:text-3xl font-medium text-center leading-relaxed max-h-32 md:max-h-40 overflow-hidden"
                  style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)'
                  }}
                  data-testid="text-subtitle-overlay"
                >
                  {/* Karaoke-style word highlighting when playing with timings */}
                  {useProgressiveMode ? (
                    subtitleMode === "target" ? (
                      // Target mode: only render words in visibleWordIndices (handles non-contiguous visibility)
                      // This ensures repeated words like "Hola" appear and disappear independently
                      currentWordTimings.map((timing, index) => (
                        visibleWordIndices.has(index) && (
                          <span
                            key={index}
                            className={`inline-block mx-0.5 transition-all duration-150 ${
                              index === highlightedWordIndex
                                ? "text-primary scale-105 font-semibold"
                                : "text-foreground"
                            }`}
                            data-testid={`word-${index}-${index === highlightedWordIndex ? 'active' : 'visible'}`}
                          >
                            {cleanForDisplay(timing.word)}
                          </span>
                        )
                      ))
                    ) : (
                      // All mode: progressive reveal (words stay visible once reached)
                      currentWordTimings.slice(0, visibleWordCount).map((timing, index) => (
                        <span
                          key={index}
                          className={`inline-block mx-0.5 transition-all duration-150 ${
                            index === highlightedWordIndex
                              ? "text-primary scale-105 font-semibold"
                              : "text-foreground"
                          }`}
                          data-testid={`word-${index}-${index === highlightedWordIndex ? 'active' : 'visible'}`}
                        >
                          {cleanForDisplay(timing.word)}
                        </span>
                      ))
                    )
                  ) : (
                    // Static display when not playing or no timings available
                    <span className="text-foreground">{displayText}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Floating Microphone Button - compact layout with safe bottom padding */}
      <div className="flex-shrink-0 pt-2 pb-16 flex flex-col items-center gap-2">
        {/* Instruction text */}
        <p className="text-xs text-muted-foreground" data-testid="text-mic-instruction">
          {isRecording ? "Release to send" : isMicPreparing ? "Preparing mic..." : isProcessing ? "Processing..." : "Hold to speak"}
        </p>
        
        <div className="flex justify-center items-center gap-3">
        {/* Toggle to History View */}
        {onToggleView && (
          <Button
            variant="secondary"
            size="icon"
            onClick={onToggleView}
            className="h-10 w-10 md:h-12 md:w-12 bg-slate-500 hover:bg-slate-600 text-white"
            data-testid="button-toggle-history"
          >
            <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        )}

        {/* Replay Last Audio Button with label */}
        {onReplay && (
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              onClick={onReplay}
              disabled={!canReplay}
              className="h-10 w-10 md:h-12 md:w-12 bg-slate-500 hover:bg-slate-600 text-white disabled:bg-slate-300 disabled:text-slate-500"
              data-testid="button-replay"
            >
              <RotateCcw style={{ width: 24, height: 24 }} />
            </Button>
            <span className="text-[10px] text-muted-foreground">Repeat</span>
          </div>
        )}

        {/* Main Recording Button (Push-to-Talk) */}
        {/* Uses explicit touch AND pointer events for reliable mobile support */}
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
          disabled={isProcessing}
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

        {/* Slow Repeat Button with label - Ask AI to simplify and speak slowly */}
        {onSlowRepeat && (
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              onClick={onSlowRepeat}
              disabled={!canSlowRepeat || isSlowRepeatLoading || isProcessing}
              className="h-10 w-10 md:h-12 md:w-12 bg-slate-500 hover:bg-slate-600 text-white disabled:bg-slate-300 disabled:text-slate-500"
              data-testid="button-slow-repeat"
              title="Repeat slowly and simply"
            >
              <Turtle style={{ width: 24, height: 24 }} />
            </Button>
            <span className="text-[10px] text-muted-foreground">Slow</span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
