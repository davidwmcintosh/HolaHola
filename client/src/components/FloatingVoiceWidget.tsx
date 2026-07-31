/**
 * FloatingVoiceWidget — Ambient Daniela Presence
 *
 * A persistent floating button that lets the student know Daniela's
 * voice session is alive (or available) from any page.  It is hidden
 * on /chat because that page has its own full UI.
 *
 * States:
 *  • idle / no session  → muted mic icon  → tap navigates to /chat
 *  • session exists, dormant → mic icon, subtle primary ring
 *  • session connecting → pulsing amber
 *  • session listening  → pulsing green
 *  • session speaking   → pulsing primary (Daniela is talking)
 *  • session thinking   → pulsing amber
 */

import { useLocation } from "wouter";
import { Mic, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDanielaSession } from "@/contexts/DanielaSessionContext";
import {
  computeWidgetLabel,
  computeWidgetClasses,
  deriveWidgetState,
} from "@/lib/voice-widget-state";

export function FloatingVoiceWidget() {
  const [currentPath, navigate] = useLocation();
  const { sessionConversationId, voiceStatus, isDormant } = useDanielaSession();

  // Not shown on the dedicated chat page — it has its own full UI
  if (currentPath === "/chat") return null;

  const widgetInput = { sessionConversationId, voiceStatus, isDormant };
  const { hasSession, isSpeaking, isListening, isActive } =
    deriveWidgetState(widgetInput);
  const { ringClass, pulseClass } = computeWidgetClasses(widgetInput);
  const label = computeWidgetLabel(widgetInput);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`fixed z-50 h-12 w-12 rounded-full shadow-lg border-2 bottom-20 sm:bottom-4 right-[max(1rem,env(safe-area-inset-right))] transition-all duration-300 ${ringClass}`}
          onClick={() => navigate("/chat")}
          aria-label={label}
          data-testid="button-floating-voice-widget"
        >
          {isActive ? (
            <Radio className={`h-5 w-5 ${pulseClass}`} />
          ) : (
            <Mic className={`h-5 w-5 ${hasSession ? "" : "opacity-60"}`} />
          )}

          {/* Active session indicator dot */}
          {hasSession && (
            <span
              className={`absolute top-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-background ${
                isActive ? "bg-green-500" : "bg-primary/50"
              }`}
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
