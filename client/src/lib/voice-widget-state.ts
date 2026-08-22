/**
 * voice-widget-state.ts — Pure state derivation for FloatingVoiceWidget.
 *
 * Extracted from FloatingVoiceWidget.tsx so the logic can be unit-tested
 * without a DOM or React renderer.  Both the component and the test suite
 * import from here; a regression in either file will be caught.
 *
 * ⚠️  REFACTOR GUARD — if you rename, split, or change the exports of this
 * file you MUST also update the following consumer and test:
 *   • client/src/components/floating-voice-widget-state.test.ts  (26 cases)
 *     — imports computeWidgetLabel, computeWidgetClasses, deriveVoiceStatus
 *   The test is listed by name (not glob) in the npm test script and in
 *   .github/workflows/ci.yml, so a rename will break CI immediately.
 *
 * Keep this file free of React / DOM imports.
 */

import type { VoiceStatus } from "@/contexts/DanielaSessionContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WidgetInputState {
  /** Active conversationId, or null when no session exists. */
  sessionConversationId: string | null;
  /** Fine-grained voice status published by StreamingVoiceChat. */
  voiceStatus: VoiceStatus;
  /** True when the session has been inactive for ≥ 8 minutes. */
  isDormant: boolean;
}

export interface WidgetDerivedState {
  hasSession: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  isActive: boolean;
}

export interface WidgetClasses {
  ringClass: string;
  pulseClass: string;
}

// ─── Derived booleans ─────────────────────────────────────────────────────────

/**
 * Derives the boolean flags that FloatingVoiceWidget uses to select
 * its label, icon, and CSS classes.
 */
export function deriveWidgetState(input: WidgetInputState): WidgetDerivedState {
  const { sessionConversationId, voiceStatus, isDormant } = input;
  const hasSession = sessionConversationId !== null && !isDormant;
  const isSpeaking = voiceStatus === "speaking";
  const isListening = voiceStatus === "listening";
  const isThinking = voiceStatus === "thinking" || voiceStatus === "connecting";
  const isActive = hasSession && voiceStatus !== "idle";
  return { hasSession, isSpeaking, isListening, isThinking, isActive };
}

// ─── Label ────────────────────────────────────────────────────────────────────

/**
 * Returns the aria-label string shown on data-testid="button-floating-voice-widget".
 * This is also the tooltip text.
 */
export function computeWidgetLabel(input: WidgetInputState): string {
  const { hasSession, isSpeaking, isListening, isThinking, isActive } =
    deriveWidgetState(input);

  return isActive
    ? isSpeaking
      ? "Daniela is speaking"
      : isListening
      ? "Daniela is listening"
      : isThinking
      ? "Daniela is thinking…"
      : "Session active — return to Daniela"
    : hasSession
    ? "Session paused — tap to resume"
    : "Talk to Daniela";
}

// ─── CSS classes ──────────────────────────────────────────────────────────────

/**
 * Returns the Tailwind ring class and optional pulse class for the widget button.
 */
export function computeWidgetClasses(input: WidgetInputState): WidgetClasses {
  const { hasSession, isSpeaking, isListening, isThinking } =
    deriveWidgetState(input);

  let ringClass =
    "border-muted-foreground/30 text-muted-foreground bg-background";
  let pulseClass = "";

  if (isSpeaking) {
    ringClass = "border-primary bg-primary text-primary-foreground";
    pulseClass = "animate-pulse";
  } else if (isListening) {
    ringClass =
      "border-green-500 text-green-600 dark:text-green-400 bg-green-500/10";
    pulseClass = "animate-pulse";
  } else if (isThinking) {
    ringClass =
      "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10";
    pulseClass = "animate-pulse";
  } else if (hasSession) {
    ringClass = "border-primary/50 text-primary bg-background";
  }

  return { ringClass, pulseClass };
}

// ─── VoiceStatus publisher ────────────────────────────────────────────────────

/**
 * Maps (avatarState, connectionState) → VoiceStatus.
 *
 * This is the same logic that lives in StreamingVoiceChat.tsx's useEffect
 * (Task #32 wiring, ~line 2264).  Both files import from here so that
 * a change to the mapping is always reflected in both the component and
 * the test.
 *
 * Priority order (highest first):
 *  1. connectionState connecting / reconnecting → "connecting"
 *  2. avatarState speaking                      → "speaking"
 *  3. avatarState thinking                      → "thinking"
 *  4. avatarState listening                     → "listening"
 *  5. anything else                             → "idle"
 */
export function deriveVoiceStatus(
  avatarState: "idle" | "listening" | "speaking" | "thinking",
  connectionState: string,
): VoiceStatus {
  if (connectionState === "connecting" || connectionState === "reconnecting") {
    return "connecting";
  }
  if (avatarState === "speaking") return "speaking";
  if (avatarState === "thinking") return "thinking";
  if (avatarState === "listening") return "listening";
  return "idle";
}
