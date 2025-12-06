import { motion, AnimatePresence } from 'framer-motion';
import type { StreamingSubtitleState } from '../hooks/useStreamingSubtitles';

interface FloatingSubtitleOverlayProps {
  subtitleState: StreamingSubtitleState;
  isVisible: boolean;
  className?: string;
}

export function FloatingSubtitleOverlay({
  subtitleState,
  isVisible,
  className = '',
}: FloatingSubtitleOverlayProps) {
  const {
    currentSentenceText,
    currentWordIndex,
    visibleWordCount,
    isPlaying,
    hasTargetContent,
    currentSentenceTargetText,
  } = subtitleState;

  if (!isVisible || !isPlaying) {
    return null;
  }

  const displayText = hasTargetContent && currentSentenceTargetText 
    ? currentSentenceTargetText 
    : currentSentenceText;

  if (!displayText) {
    return null;
  }

  const words = displayText.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`absolute bottom-0 left-0 right-0 flex justify-center items-end pb-4 pointer-events-none z-20 ${className}`}
        data-testid="floating-subtitle-overlay"
      >
        <div 
          className="max-w-[90%] text-center px-4"
          data-testid="subtitle-text-container"
        >
          <p className="text-2xl md:text-3xl font-medium leading-relaxed tracking-wide">
            {words.map((word, index) => {
              const isHighlighted = index <= currentWordIndex;
              const isCurrentWord = index === currentWordIndex;
              
              return (
                <span
                  key={`${index}-${word}`}
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
                  {word}
                </span>
              );
            })}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
