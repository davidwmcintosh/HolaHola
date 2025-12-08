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
  type SubtitleMode,
  isDrillItem,
  createPronunciationItem,
} from '@shared/whiteboard-types';

interface UseWhiteboardConfig {
  onVocabularyExtracted?: (words: string[], language?: string) => void;
  onDrillStart?: (drill: DrillItem) => void;
  onDrillComplete?: (drill: DrillItem, isCorrect: boolean) => void;
  /**
   * Maximum number of whiteboard items to display at once.
   * When exceeded, oldest non-drill items are automatically removed.
   * Drills are preserved to avoid losing interactive state.
   * Default: 4 (keeps screen clean as per "no tool stacking" principle)
   */
  maxItems?: number;
}

// Default max items - keeps screen clean per "no tool stacking" principle
const DEFAULT_MAX_ITEMS = 4;

interface UseWhiteboardReturn {
  items: WhiteboardItem[];
  isHolding: boolean;
  activeDrill: DrillItem | null;
  // Regular subtitle mode: 'off' (default), 'all', or 'target'
  regularSubtitleMode: SubtitleMode;
  // Custom overlay text (independent from regular subtitles)
  customOverlayText: string | null;
  processMessage: (text: string, language?: string) => void;
  clear: () => void;
  addItem: (item: WhiteboardItem) => void;
  addOrUpdateItems: (items: WhiteboardItem[], shouldClear?: boolean) => void;
  updateItem: (id: string, updates: Partial<WhiteboardItem>) => void;
  updateDrillState: (drillId: string, state: DrillState, response?: string, isCorrect?: boolean, feedback?: string) => void;
  addPronunciationFeedback: (transcript: string, analysis: Omit<PronunciationFeedbackData, 'transcript'>) => void;
  updateImageUrl: (itemId: string, imageUrl: string) => void;
  clearActiveDrill: () => void;
  setRegularSubtitleMode: (mode: SubtitleMode) => void;
  setCustomOverlayText: (text: string | null) => void;
}

/**
 * Enforce max items limit by removing oldest items.
 * Priority: Keep most recent drills first, then most recent non-drill items.
 * This implements the "no tool stacking" principle.
 */
function enforceMaxItems(items: WhiteboardItem[], maxItems: number): WhiteboardItem[] {
  if (items.length <= maxItems) {
    return items;
  }
  
  // Collect items with their original indices for stable ordering
  const indexedItems = items.map((item, index) => ({ item, index, isDrill: isDrillItem(item) }));
  
  // Separate drills from others
  const drills = indexedItems.filter(i => i.isDrill);
  const others = indexedItems.filter(i => !i.isDrill);
  
  // Strategy: Keep as many recent drills as possible, fill remaining slots with recent non-drills
  // If drills alone exceed maxItems, keep only the most recent drills
  const keptDrills = drills.slice(-Math.min(drills.length, maxItems));
  const remainingSlots = maxItems - keptDrills.length;
  const keptOthers = remainingSlots > 0 ? others.slice(-remainingSlots) : [];
  
  // Build set of kept indices for O(1) lookup
  const keptIndices = new Set<number>();
  for (const { index } of [...keptDrills, ...keptOthers]) {
    keptIndices.add(index);
  }
  
  // Filter original array to preserve original order
  const result = items.filter((_, index) => keptIndices.has(index));
  
  if (result.length < items.length) {
    console.log('[WHITEBOARD] Auto-trimmed to enforce max items:', {
      before: items.length,
      after: result.length,
      maxItems,
      drillsKept: keptDrills.length,
      othersKept: keptOthers.length
    });
  }
  
  return result;
}

export function useWhiteboard(config?: UseWhiteboardConfig): UseWhiteboardReturn {
  const [items, setItems] = useState<WhiteboardItem[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const [activeDrill, setActiveDrill] = useState<DrillItem | null>(null);
  // Default to 'off' - Daniela opts in when she wants subtitles
  const [regularSubtitleMode, setRegularSubtitleMode] = useState<SubtitleMode>('off');
  // Custom overlay is independent - null means not showing
  const [customOverlayText, setCustomOverlayText] = useState<string | null>(null);
  const lastProcessedRef = useRef<string>('');
  const configRef = useRef(config);
  configRef.current = config;
  
  // Get max items from config or use default
  const maxItems = config?.maxItems ?? DEFAULT_MAX_ITEMS;

  const processMessage = useCallback((text: string, language?: string) => {
    if (!text) {
      return;
    }
    
    const parsed = parseWhiteboardMarkup(text);
    const hasActions = parsed.shouldClear || parsed.shouldHold || parsed.whiteboardItems.length > 0 || 
      parsed.subtitleMode !== undefined || parsed.customOverlayText !== undefined || parsed.customOverlayHide;
    
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
      vocabularyWords: parsed.vocabularyWords,
      subtitleMode: parsed.subtitleMode,
      customOverlayText: parsed.customOverlayText,
      customOverlayHide: parsed.customOverlayHide
    });

    if (parsed.shouldClear) {
      setItems([]);
      setIsHolding(false);
      setActiveDrill(null);
      // [CLEAR] only clears whiteboard items, does NOT affect subtitle state
      // This keeps regular subtitles and custom overlay independent
      console.log('[WHITEBOARD] Cleared by [CLEAR] command');
    }

    if (parsed.shouldHold) {
      setIsHolding(true);
      console.log('[WHITEBOARD] Hold mode enabled');
    }

    // Handle regular subtitle mode: [SUBTITLE off/on/target]
    if (parsed.subtitleMode !== undefined) {
      setRegularSubtitleMode(parsed.subtitleMode);
      console.log('[WHITEBOARD] Regular subtitle mode:', parsed.subtitleMode);
    }

    // Handle custom overlay: [SHOW: text] sets it, [HIDE] clears it
    if (parsed.customOverlayHide) {
      setCustomOverlayText(null);
      console.log('[WHITEBOARD] Custom overlay hidden');
    } else if (parsed.customOverlayText !== undefined) {
      setCustomOverlayText(parsed.customOverlayText);
      console.log('[WHITEBOARD] Custom overlay text:', parsed.customOverlayText);
    }

    if (parsed.whiteboardItems.length > 0) {
      if (parsed.shouldClear) {
        // When clearing, enforce max on the new items only
        setItems(enforceMaxItems(parsed.whiteboardItems, maxItems));
      } else {
        // Add new items and enforce max (removes oldest non-drill items)
        setItems(prev => enforceMaxItems([...prev, ...parsed.whiteboardItems], maxItems));
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
  }, [maxItems]);

  const clear = useCallback(() => {
    setItems([]);
    setIsHolding(false);
    setActiveDrill(null);
    lastProcessedRef.current = '';
    console.log('[WHITEBOARD] Manually cleared');
  }, []);

  const addItem = useCallback((item: WhiteboardItem) => {
    setItems(prev => enforceMaxItems([...prev, item], maxItems));
    
    if (isDrillItem(item)) {
      setActiveDrill(item);
      configRef.current?.onDrillStart?.(item);
    }
  }, [maxItems]);

  /**
   * Add or update items from streaming client (pre-parsed items with IDs)
   * If an item with the same ID exists, it will be replaced (for enrichment updates)
   * Enforces max items limit to prevent tool stacking
   */
  const addOrUpdateItems = useCallback((newItems: WhiteboardItem[], shouldClear = false) => {
    if (shouldClear) {
      setItems(enforceMaxItems(newItems, maxItems));
      setIsHolding(false);
      setActiveDrill(null);
      console.log('[WHITEBOARD] Cleared and set items from streaming:', newItems.length);
      return;
    }
    
    setItems(prev => {
      // Create a map of existing items by ID for quick lookup
      const itemMap = new Map(prev.map(item => [item.id, item]));
      
      // Process new items - update existing or add new
      for (const newItem of newItems) {
        if (newItem.id && itemMap.has(newItem.id)) {
          // Update existing item (e.g., WORD_MAP with enriched data)
          itemMap.set(newItem.id, newItem);
          console.log('[WHITEBOARD] Updated existing item:', newItem.id, newItem.type);
        } else {
          // Add new item
          itemMap.set(newItem.id || `wb-${Date.now()}`, newItem);
          console.log('[WHITEBOARD] Added new item:', newItem.id, newItem.type);
        }
      }
      
      // Enforce max items limit after processing
      return enforceMaxItems(Array.from(itemMap.values()), maxItems);
    });
    
    // Handle drill activation
    const drillItems = newItems.filter(isDrillItem);
    if (drillItems.length > 0) {
      const newDrill = drillItems[drillItems.length - 1];
      setActiveDrill(newDrill);
      configRef.current?.onDrillStart?.(newDrill);
      console.log('[WHITEBOARD] New drill activated:', newDrill.data.drillType);
    }
  }, [maxItems]);

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
    regularSubtitleMode,
    customOverlayText,
    processMessage,
    clear,
    addItem,
    addOrUpdateItems,
    updateItem,
    updateDrillState,
    addPronunciationFeedback,
    updateImageUrl,
    clearActiveDrill,
    setRegularSubtitleMode,
    setCustomOverlayText,
  };
}
