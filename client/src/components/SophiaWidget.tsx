import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

export interface SofiaIncidentData {
  incidentId: string;
  category: string;
  priority: string;
  message: string;
  timestamp: number;
}

const CATEGORY_TITLES: Record<string, string> = {
  audio_input: "Microphone issue detected",
  audio_output: "Audio playback issue",
  connection: "Connection hiccup",
  tool_render: "Visual didn't load",
  ui_sync: "Screen out of sync",
  other: "Technical issue",
};

interface SofiaWidgetProps {
  incident: SofiaIncidentData;
  onResolved: () => void;
}

export function SofiaWidget({ incident, onResolved }: SofiaWidgetProps) {
  const [resolving, setResolving] = useState(false);

  const handleResolved = async () => {
    setResolving(true);
    try {
      await apiRequest("POST", `/api/sophia/incidents/${incident.incidentId}/resolve`);
    } catch {
    } finally {
      onResolved();
    }
  };

  const title = CATEGORY_TITLES[incident.category] ?? CATEGORY_TITLES.other;

  return (
    <div
      className="absolute bottom-20 left-3 z-50 w-80 max-w-[calc(100vw-1.5rem)]"
      data-testid="sofia-widget"
    >
      <div className="bg-card border rounded-md shadow-md p-3 space-y-2.5">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sofia — technical support</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{incident.message}</p>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleResolved}
          disabled={resolving}
          data-testid="sofia-resolve-button"
        >
          {resolving ? "Letting Daniela know…" : "I'm good now"}
        </Button>
      </div>
    </div>
  );
}
