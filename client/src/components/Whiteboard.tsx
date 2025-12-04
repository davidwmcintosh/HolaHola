/**
 * Whiteboard - Tutor-controlled visual teaching aid
 * 
 * Philosophy: "We provide tools, the tutor teaches"
 * The AI tutor decides WHEN and WHAT to display - students don't toggle this.
 * 
 * Behavior:
 * - Content persists until tutor explicitly sends [CLEAR]
 * - Multiple items stack vertically (new items appear at bottom)
 * - Each item type has its own visual treatment
 * - Mobile: Overlay at bottom of screen (above subtitles)
 * - Desktop: Same positioning, larger text
 */

import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Volume2, ArrowLeftRight, X } from "lucide-react";
import type { WhiteboardItem, WhiteboardItemType } from "@shared/whiteboard-types";

interface WhiteboardProps {
  items: WhiteboardItem[];
  onClear?: () => void;
}

const getItemIcon = (type: WhiteboardItemType) => {
  switch (type) {
    case "write":
      return <Pencil className="h-4 w-4" />;
    case "phonetic":
      return <Volume2 className="h-4 w-4" />;
    case "compare":
      return <ArrowLeftRight className="h-4 w-4" />;
    default:
      return null;
  }
};

const getItemStyle = (type: WhiteboardItemType): string => {
  switch (type) {
    case "write":
      return "bg-primary/10 border-primary/30 text-foreground";
    case "phonetic":
      return "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 font-mono";
    case "compare":
      return "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted border-border text-foreground";
  }
};

const WhiteboardItemDisplay = ({ item, index }: { item: WhiteboardItem; index: number }) => {
  const icon = getItemIcon(item.type);
  const style = getItemStyle(item.type);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`flex items-start gap-2 px-4 py-3 rounded-lg border ${style}`}
      data-testid={`whiteboard-item-${item.type}-${index}`}
    >
      {icon && (
        <span className="flex-shrink-0 mt-0.5 opacity-60">
          {icon}
        </span>
      )}
      <span className="text-lg md:text-xl font-medium leading-relaxed">
        {item.content}
      </span>
    </motion.div>
  );
};

export function Whiteboard({ items, onClear }: WhiteboardProps) {
  if (items.length === 0) {
    return null;
  }
  
  return (
    <div 
      className="fixed bottom-28 left-0 right-0 z-40 px-4 pointer-events-none"
      data-testid="whiteboard-container"
    >
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="relative bg-background/95 backdrop-blur-md rounded-xl border border-border shadow-lg p-4">
          {onClear && (
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Clear whiteboard"
              data-testid="button-clear-whiteboard"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          <AnimatePresence mode="sync">
            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <WhiteboardItemDisplay 
                  key={`${item.type}-${item.content}-${index}`} 
                  item={item} 
                  index={index} 
                />
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact whiteboard variant for inline display
 * Used when whiteboard should appear within the chat flow
 */
export function InlineWhiteboard({ items }: { items: WhiteboardItem[] }) {
  if (items.length === 0) {
    return null;
  }
  
  return (
    <div 
      className="my-3 rounded-lg border border-border bg-muted/50 p-3"
      data-testid="inline-whiteboard"
    >
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <WhiteboardItemDisplay 
            key={`${item.type}-${item.content}-${index}`} 
            item={item} 
            index={index} 
          />
        ))}
      </div>
    </div>
  );
}
