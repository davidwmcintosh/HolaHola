/**
 * useWhiteboard - Manages whiteboard state for voice chat
 * 
 * Philosophy: "We provide tools, the tutor teaches"
 * Content persists until tutor explicitly clears with [CLEAR]
 * 
 * Phase 2 Extensions:
 * - Image items with async loading
 * - Drill items with interactive state management
 * - Pronunciation feedback display
 * - Auto-vocabulary extraction callback
 * 
 * Usage:
 * 1. Call processMessage() when a new tutor message arrives
 * 2. The hook parses whiteboard markup and updates items
 * 3. Items persist across messages until [CLEAR] is received
 * 4. Use clear() to manually clear (e.g., when conversation ends)
 */

import { useState, useCallback, useRef } from 'react';
import { 
  parseWhiteboardMarkup, 
  type WhiteboardItem,
  type DrillItem,
  type PronunciationItem,
  type ImageItem,
  type DrillState,
  type PronunciationFeedbackData,
  isDrillItem,
  createPronunciationItem,
} from '@shared/whiteboard-types';

interface UseWhiteboardConfig {
  onVocabularyExtracted?: (words: string[], language?: string) => void;
  onDrillStart?: (drill: DrillItem) => void;
  onDrillComplete?: (drill: DrillItem, isCorrect: boolean) => void;
}

interface UseWhiteboardReturn {
  items: WhiteboardItem[];
  isHolding: boolean;
  activeDrill: DrillItem | null;
  processMessage: (text: string, language?: string) => void;
  clear: () => void;
  addItem: (item: WhiteboardItem) => void;
  updateItem: (id: string, updates: Partial<WhiteboardItem>) => void;
  updateDrillState: (drillId: string, state: DrillState, response?: string, isCorrect?: boolean, feedback?: string) => void;
  addPronunciationFeedback: (transcript: string, analysis: Omit<PronunciationFeedbackData, 'transcript'>) => void;
  updateImageUrl: (itemId: string, imageUrl: string) => void;
  clearActiveDrill: () => void;
}

export function useWhiteboard(config?: UseWhiteboardConfig): UseWhiteboardReturn {
  const [items, setItems] = useState<WhiteboardItem[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const [activeDrill, setActiveDrill] = useState<DrillItem | null>(null);
  const lastProcessedRef = useRef<string>('');
  const configRef = useRef(config);
  configRef.current = config;

  const processMessage = useCallback((text: string, language?: string) => {
    if (!text) {
      return;
    }
    
    const parsed = parseWhiteboardMarkup(text);
    const hasActions = parsed.shouldClear || parsed.shouldHold || parsed.whiteboardItems.length > 0;
    
    if (!hasActions) {
      return;
    }
    
    if (text === lastProcessedRef.current) {
      return;
    }
    lastProcessedRef.current = text;

    console.log('[WHITEBOARD] Parsed markup:', {
      items: parsed.whiteboardItems.length,
      shouldClear: parsed.shouldClear,
      shouldHold: parsed.shouldHold,
      hasContent: parsed.whiteboardItems.length > 0,
      vocabularyWords: parsed.vocabularyWords
    });

    if (parsed.shouldClear) {
      setItems([]);
      setIsHolding(false);
      setActiveDrill(null);
      console.log('[WHITEBOARD] Cleared by [CLEAR] command');
    }

    if (parsed.shouldHold) {
      setIsHolding(true);
      console.log('[WHITEBOARD] Hold mode enabled');
    }

    if (parsed.whiteboardItems.length > 0) {
      if (parsed.shouldClear) {
        setItems(parsed.whiteboardItems);
      } else {
        setItems(prev => [...prev, ...parsed.whiteboardItems]);
      }
      console.log('[WHITEBOARD] Added items:', parsed.whiteboardItems);
      
      const drillItems = parsed.whiteboardItems.filter(isDrillItem);
      if (drillItems.length > 0) {
        const newDrill = drillItems[drillItems.length - 1];
        setActiveDrill(newDrill);
        configRef.current?.onDrillStart?.(newDrill);
        console.log('[WHITEBOARD] New drill activated:', newDrill.data.drillType);
      }
    }

    if (parsed.hasNewVocabulary && parsed.vocabularyWords.length > 0) {
      configRef.current?.onVocabularyExtracted?.(parsed.vocabularyWords, language);
      console.log('[WHITEBOARD] Vocabulary extracted:', parsed.vocabularyWords);
    }
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setIsHolding(false);
    setActiveDrill(null);
    lastProcessedRef.current = '';
    console.log('[WHITEBOARD] Manually cleared');
  }, []);

  const addItem = useCallback((item: WhiteboardItem) => {
    setItems(prev => [...prev, item]);
    
    if (isDrillItem(item)) {
      setActiveDrill(item);
      configRef.current?.onDrillStart?.(item);
    }
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<WhiteboardItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, ...updates } as WhiteboardItem;
      }
      return item;
    }));
  }, []);

  const updateDrillState = useCallback((
    drillId: string, 
    state: DrillState, 
    response?: string, 
    isCorrect?: boolean, 
    feedback?: string
  ) => {
    setItems(prev => prev.map(item => {
      if (item.id === drillId && isDrillItem(item)) {
        const updatedDrill: DrillItem = {
          ...item,
          data: {
            ...item.data,
            state,
            studentResponse: response ?? item.data.studentResponse,
            isCorrect: isCorrect ?? item.data.isCorrect,
            feedback: feedback ?? item.data.feedback,
          }
        };
        
        if (state === 'complete') {
          setActiveDrill(null);
          configRef.current?.onDrillComplete?.(updatedDrill, isCorrect ?? false);
        } else {
          setActiveDrill(updatedDrill);
        }
        
        return updatedDrill;
      }
      return item;
    }));
  }, []);

  const addPronunciationFeedback = useCallback((
    transcript: string, 
    analysis: Omit<PronunciationFeedbackData, 'transcript'>
  ) => {
    const pronItem = createPronunciationItem(transcript, analysis);
    
    setItems(prev => {
      const withoutOldPronunciation = prev.filter(item => item.type !== 'pronunciation');
      return [...withoutOldPronunciation, pronItem];
    });
    
    console.log('[WHITEBOARD] Added pronunciation feedback:', analysis.score);
  }, []);

  const updateImageUrl = useCallback((itemId: string, imageUrl: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.type === 'image') {
        const imageItem = item as ImageItem;
        return {
          ...imageItem,
          data: {
            ...imageItem.data,
            imageUrl,
            isLoading: false,
          }
        };
      }
      return item;
    }));
    console.log('[WHITEBOARD] Image URL updated for item:', itemId);
  }, []);

  const clearActiveDrill = useCallback(() => {
    setActiveDrill(null);
  }, []);

  return {
    items,
    isHolding,
    activeDrill,
    processMessage,
    clear,
    addItem,
    updateItem,
    updateDrillState,
    addPronunciationFeedback,
    updateImageUrl,
    clearActiveDrill,
  };
}
