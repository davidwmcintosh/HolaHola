import { motion, AnimatePresence } from 'framer-motion';
import type { StreamingSubtitleState } from '../hooks/useStreamingSubtitles';
import type { SubtitleMode } from '@shared/whiteboard-types';

function cleanDisplayText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\\/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface FloatingSubtitleOverlayProps {
  subtitleState: StreamingSubtitleState;
  /**
   * Regular subtitle mode controlled by [SUBTITLE off/on/target]
   * - 'off': No regular subtitles (default - Daniela opts in when needed)
   * - 'all': Show full sentence with karaoke highlighting
   * - 'target': Show only target language words with karaoke highlighting
   */
  regularSubtitleMode: SubtitleMode;
  /**
   * Custom overlay text controlled by [SHOW: text] / [HIDE]
   * Independent from regular subtitles - for teaching moments
   * When set, displays as static text above regular subtitles
   */
  customOverlayText?: string | null;
  className?: string;
}

export function FloatingSubtitleOverlay({
  subtitleState,
  regularSubtitleMode = 'off',
  customOverlayText,
  className = '',
}: FloatingSubtitleOverlayProps) {
  const {
    sentences,
    currentSentenceIndex,
    currentWordIndex,
    currentTargetWordIndex,
    visibleWordCount,
    isPlaying,
    hasTargetContent,
    visibleTargetText,
  } = subtitleState;

  // Get current sentence's word timings (authoritative source)
  const currentSentence = currentSentenceIndex >= 0 && currentSentenceIndex < sentences.length 
    ? sentences[currentSentenceIndex] 
    : null;
  const wordTimings = currentSentence?.wordTimings || [];

  // For target mode, use CURRENT SENTENCE's targetLanguageText, not aggregate visibleTargetText
  // This ensures we show the current sentence being spoken, not all completed sentences
  const currentTargetText = currentSentence?.targetLanguageText || '';
  const targetWords = regularSubtitleMode === 'target' && hasTargetContent && currentTargetText 
    ? currentTargetText.split(/\s+/).filter(w => w.length > 0)
    : null;

  // Determine if we have content to display based on mode
  // NOTE: For "all" mode, we show subtitles immediately when wordTimings exist.
  // The visibleWordCount only affects karaoke highlighting, not whether subtitles appear.
  // For "target" mode, we still need targetWords to be populated (via word mapping).
  const hasRegularSubtitles = (() => {
    if (regularSubtitleMode === 'off' || !isPlaying) return false;
    if (regularSubtitleMode === 'target') return targetWords && targetWords.length > 0;
    if (regularSubtitleMode === 'all') return wordTimings.length > 0;
    return false;
  })();

  const hasCustomOverlay = customOverlayText && customOverlayText.trim().length > 0;

  // Debug: Log why subtitles aren't showing (only when mode is not 'off')
  if (regularSubtitleMode !== 'off' && !hasRegularSubtitles && !hasCustomOverlay) {
    console.log('[SUBTITLE DEBUG] Not showing:', {
      mode: regularSubtitleMode,
      isPlaying,
      hasTargetContent,
      currentTargetText: currentTargetText?.substring(0, 50),
      targetWordsCount: targetWords?.length || 0,
      wordTimingsCount: wordTimings.length,
      visibleWordCount,
      currentSentenceIndex,
      sentencesCount: sentences.length,
    });
  }

  // Nothing to display
  if (!hasRegularSubtitles && !hasCustomOverlay) {
    return null;
  }

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-4 pointer-events-none z-20 gap-2 ${className}`}
      data-testid="floating-subtitle-overlay"
    >
      {/* Custom Overlay Layer - shows above regular subtitles */}
      {hasCustomOverlay && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-[90%] text-center px-4"
            data-testid="custom-overlay-container"
            data-mode="custom-overlay"
          >
            <p className="text-2xl md:text-3xl font-bold leading-relaxed tracking-wide text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]">
              {cleanDisplayText(customOverlayText!)}
            </p>
          </motion.div>
        </AnimatePresence>
      )}
      
      {/* Regular Subtitles Layer - with karaoke word highlighting */}
      {/* Renders from wordTimings array (all mode) or visibleTargetText (target mode) */}
      {/* Uses visibleWordCount for progressive reveal (novice mode) */}
      {/* Uses currentWordIndex/currentTargetWordIndex for karaoke highlighting */}
      {hasRegularSubtitles && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-[90%] text-center px-4"
            data-testid="regular-subtitle-container"
            data-mode={regularSubtitleMode}
          >
            <p className="text-2xl md:text-3xl font-medium leading-relaxed tracking-wide">
              {regularSubtitleMode === 'all' ? (
                // Render from wordTimings array directly (preserves Cartesia alignment)
                // visibleWordCount controls progressive reveal (ACTFL policy driven)
                // When isPlaying and visibleWordCount=0, progressive reveal is starting — show nothing
                // (updatePlaybackTime will set the correct count on the next frame).
                // When NOT playing and visibleWordCount=0, show all words as a static preview.
                wordTimings.slice(0, (isPlaying && visibleWordCount === 0) ? 0 : (visibleWordCount > 0 ? visibleWordCount : wordTimings.length)).map((timing, index) => {
                  // Karaoke highlighting: highlight words up to currentWordIndex
                  const isHighlighted = index <= currentWordIndex;
                  const isCurrentWord = index === currentWordIndex;
                  
                  return (
                    <span
                      key={`${index}-${timing.word}`}
                      className={`
                        inline-block mx-1 transition-all duration-100
                        ${isHighlighted 
                          ? 'text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]' 
                          : 'text-foreground/40'
                        }
                        ${isCurrentWord 
                          ? 'scale-110 font-bold' 
                          : ''
                        }
                      `}
                      data-testid={`subtitle-word-${index}`}
                      data-highlighted={isHighlighted}
                      data-current={isCurrentWord}
                    >
                      {timing.word.replace(/\*\*/g, '')}
                    </span>
                  );
                })
              ) : (
                // Target mode: render from visibleTargetText with progressive reveal
                // Words appear greyed out just before they're spoken (look-ahead window),
                // then highlight via currentTargetWordIndex as karaoke reaches them.
                // LOOK_AHEAD=1: show only the next target word as preview (not all at once)
                targetWords?.map((word, index) => {
                  const isHighlighted = index <= currentTargetWordIndex;
                  const isCurrentWord = index === currentTargetWordIndex;
                  const LOOK_AHEAD = 1;
                  const isVisible = index <= currentTargetWordIndex + LOOK_AHEAD;
                  
                  if (!isVisible) return null;
                  
                  return (
                    <span
                      key={`${index}-${word}`}
                      className={`
                        inline-block mx-1 transition-all duration-200
                        ${isHighlighted 
                          ? 'text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]' 
                          : 'text-foreground/40'
                        }
                        ${isCurrentWord 
                          ? 'scale-110 font-bold' 
                          : ''
                        }
                      `}
                      data-testid={`subtitle-word-${index}`}
                      data-highlighted={isHighlighted}
                      data-current={isCurrentWord}
                    >
                      {word.replace(/\*\*/g, '')}
                    </span>
                  );
                })
              )}
            </p>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
