/**
 * Pure helper functions for AbsenceHistoryPanel (ExpressLanePane.tsx).
 *
 * Extracted so they can be imported directly by both the component and the
 * test suite, ensuring tests exercise the real production logic.
 */

import type { AbsenceFilterType } from "./absence-filter-storage";

export type { AbsenceFilterType };

export type ResolutionType = "student_returned" | "message_queued" | "dismissed";

export interface ResolvedNudge {
  nudgeId: string;
  userId: string;
  firstName: string | null;
  daysSinceLastSession: number;
  lastSessionDate: string | null;
  resolvedAt: string;
  resolutionType: ResolutionType;
}

export interface AbsenceFilterEntry {
  key: AbsenceFilterType;
  label: string;
  count: number;
}

/**
 * Returns whether the filter-button container should be rendered.
 * Mirrors the `allHistory.length > 0` gate in AbsenceHistoryPanel.
 */
export function shouldRenderFilterButtons(allHistory: ResolvedNudge[]): boolean {
  return allHistory.length > 0;
}

/**
 * Builds the fetch URL for the given active filter.
 * Mirrors the `queryFn` URL construction in AbsenceHistoryPanel.
 */
export function buildHistoryUrl(activeFilter: AbsenceFilterType): string {
  return activeFilter === "all"
    ? "/api/admin/absence-nudges/history"
    : `/api/admin/absence-nudges/history?resolutionType=${activeFilter}`;
}

/**
 * Returns true when `key` is the currently-active filter — used to decide
 * which button gets the active CSS class. Mirrors the `activeFilter === key`
 * expression inside the filter-button map.
 */
export function isActiveButton(activeFilter: AbsenceFilterType, key: AbsenceFilterType): boolean {
  return activeFilter === key;
}

/**
 * Builds the full filters array as AbsenceHistoryPanel does.
 * Mirrors the `filters` array construction inside the component.
 */
export function buildFilters(allHistory: ResolvedNudge[]): AbsenceFilterEntry[] {
  const counts = {
    student_returned: allHistory.filter((n) => n.resolutionType === "student_returned").length,
    message_queued: allHistory.filter((n) => n.resolutionType === "message_queued").length,
    dismissed: allHistory.filter((n) => n.resolutionType === "dismissed").length,
  };
  return [
    { key: "all", label: "All", count: allHistory.length },
    { key: "student_returned", label: "Returned", count: counts.student_returned },
    { key: "message_queued", label: "Messaged", count: counts.message_queued },
    { key: "dismissed", label: "Dismissed", count: counts.dismissed },
  ];
}
