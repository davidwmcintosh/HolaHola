/**
 * useWhiteboard - Manages whiteboard state for voice chat
 * 
 * Philosophy: "We provide tools, the tutor teaches"
 * Content persists until tutor explicitly clears with [CLEAR]
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
  type WhiteboardItem
} from '@shared/whiteboard-types';

interface UseWhiteboardReturn {
  items: WhiteboardItem[];
  isHolding: boolean;
  processMessage: (text: string) => void;
  clear: () => void;
  addItem: (item: WhiteboardItem) => void;
}

export function useWhiteboard(): UseWhiteboardReturn {
  const [items, setItems] = useState<WhiteboardItem[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const lastProcessedRef = useRef<string>('');

  const processMessage = useCallback((text: string) => {
    if (!text || text === lastProcessedRef.current) {
      return;
    }
    lastProcessedRef.current = text;

    const parsed = parseWhiteboardMarkup(text);
    
    if (!parsed.shouldClear && !parsed.shouldHold && parsed.whiteboardItems.length === 0) {
      return;
    }

    console.log('[WHITEBOARD] Parsed markup:', {
      items: parsed.whiteboardItems.length,
      shouldClear: parsed.shouldClear,
      shouldHold: parsed.shouldHold,
      hasContent: parsed.whiteboardItems.length > 0
    });

    // Process commands first
    if (parsed.shouldClear) {
      setItems([]);
      setIsHolding(false);
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
    }
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setIsHolding(false);
    lastProcessedRef.current = '';
    console.log('[WHITEBOARD] Manually cleared');
  }, []);

  const addItem = useCallback((item: WhiteboardItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  return {
    items,
    isHolding,
    processMessage,
    clear,
    addItem
  };
}
