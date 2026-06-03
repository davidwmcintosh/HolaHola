/**
 * DanielaSessionContext — Ambient Session Layer
 *
 * Keeps Daniela's session state visible to the whole app so the
 * FloatingVoiceWidget and pages can read it without prop-drilling.
 *
 * chat.tsx is the authoritative owner of the voice session; it
 * publishes conversationId and voice status here so every other
 * component can react.
 *
 * Pages register their context via useDanielaContext() so Daniela
 * can see what the student is currently working on.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageContext {
  pageId: string;
  pageLabel: string;
  subject?: string;
  currentContent?: string;
}

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "thinking";

interface DanielaSessionContextValue {
  // Published by chat.tsx ─────────────────────────────────────────
  /** The conversationId of the currently active voice session. */
  sessionConversationId: string | null;
  publishConversationId: (id: string | null) => void;

  /** Fine-grained voice state from StreamingVoiceChat. */
  voiceStatus: VoiceStatus;
  publishVoiceStatus: (status: VoiceStatus) => void;

  // Page context ──────────────────────────────────────────────────
  /** Context registered by the page the student is currently on. */
  pageContext: PageContext | null;
  registerPageContext: (ctx: PageContext | null) => void;

  // Dormancy ──────────────────────────────────────────────────────
  /** True when there has been no voice activity for 8 minutes. */
  isDormant: boolean;
  /** Call to reset the dormancy timer (e.g. on any user action). */
  signalActivity: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DORMANCY_MS = 8 * 60 * 1000; // 8 minutes

// ─── Context ──────────────────────────────────────────────────────────────────

const DanielaSessionContext =
  createContext<DanielaSessionContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DanielaSessionProvider({ children }: { children: ReactNode }) {
  const [sessionConversationId, setSessionConversationId] = useState<
    string | null
  >(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isDormant, setIsDormant] = useState(false);

  const dormancyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetDormancyTimer = useCallback(() => {
    setIsDormant(false);
    if (dormancyTimerRef.current) clearTimeout(dormancyTimerRef.current);
    dormancyTimerRef.current = setTimeout(() => {
      setIsDormant(true);
    }, DORMANCY_MS);
  }, []);

  const publishConversationId = useCallback(
    (id: string | null) => {
      setSessionConversationId(id);
      if (id) resetDormancyTimer();
    },
    [resetDormancyTimer]
  );

  const publishVoiceStatus = useCallback(
    (status: VoiceStatus) => {
      setVoiceStatus(status);
      if (status !== "idle") resetDormancyTimer();
    },
    [resetDormancyTimer]
  );

  const registerPageContext = useCallback((ctx: PageContext | null) => {
    setPageContext(ctx);
  }, []);

  const signalActivity = useCallback(() => {
    resetDormancyTimer();
  }, [resetDormancyTimer]);

  useEffect(() => {
    return () => {
      if (dormancyTimerRef.current) clearTimeout(dormancyTimerRef.current);
    };
  }, []);

  return (
    <DanielaSessionContext.Provider
      value={{
        sessionConversationId,
        publishConversationId,
        voiceStatus,
        publishVoiceStatus,
        pageContext,
        registerPageContext,
        isDormant,
        signalActivity,
      }}
    >
      {children}
    </DanielaSessionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDanielaSession(): DanielaSessionContextValue {
  const ctx = useContext(DanielaSessionContext);
  if (!ctx) {
    throw new Error("useDanielaSession must be used inside DanielaSessionProvider");
  }
  return ctx;
}
