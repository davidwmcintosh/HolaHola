/**
 * useDanielaContext — Page Context Registration
 *
 * Pages call this hook with a PageContext descriptor so Daniela's
 * ambient session knows what the student is currently looking at.
 * The context is cleared automatically when the page unmounts.
 *
 * Example:
 *   useDanielaContext({
 *     pageId: "interactive-textbook",
 *     pageLabel: "Interactive Textbook",
 *     subject: "Spanish",
 *     currentContent: "Chapter 3 — Present Tense",
 *   });
 */

import { useEffect, useRef } from "react";
import { useDanielaSession, type PageContext } from "@/contexts/DanielaSessionContext";

export function useDanielaContext(ctx: PageContext | null): void {
  const { registerPageContext } = useDanielaSession();

  // Stable key so the effect only re-runs when meaningful content changes
  const ctxKey = ctx
    ? `${ctx.pageId}::${ctx.subject ?? ""}::${ctx.currentContent ?? ""}`
    : null;

  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (ctxKey === prevKeyRef.current) return;
    prevKeyRef.current = ctxKey;
    registerPageContext(ctx);
    return () => {
      // Only clear if this effect's registration is still the active one
      if (prevKeyRef.current === ctxKey) {
        registerPageContext(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey]);
}
