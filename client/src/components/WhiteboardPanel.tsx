import { Pencil, ChevronLeft, ChevronRight, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelWhiteboard } from "./Whiteboard";
import type { WhiteboardItem } from "@shared/whiteboard-types";

interface WhiteboardPanelProps {
  items: WhiteboardItem[];
  onClear?: () => void;
  onDrillComplete?: (drillId: string, drillType: string, isCorrect: boolean, responseTimeMs: number, toolContent?: string) => void;
  onTextInputSubmit?: (itemId: string, response: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function WhiteboardPanel({
  items,
  onClear,
  onDrillComplete,
  onTextInputSubmit,
  isCollapsed,
  onToggleCollapse,
}: WhiteboardPanelProps) {
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 w-10 border-l bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          data-testid="button-expand-whiteboard-panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {items.length > 0 && (
          <div className="mt-3 flex flex-col items-center gap-1">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{items.length}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[320px] border-l bg-muted/30 min-h-0 overflow-hidden" data-testid="panel-whiteboard">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Whiteboard</span>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">({items.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onClear && items.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              data-testid="button-clear-whiteboard-panel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            data-testid="button-collapse-whiteboard-panel"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {items.length > 0 ? (
          <PanelWhiteboard
            items={items}
            onClear={onClear}
            onDrillComplete={onDrillComplete}
            onTextInputSubmit={onTextInputSubmit}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Whiteboard is clear</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Daniela will write vocabulary, grammar, and notes here as you learn
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
