/**
 * Persistence helpers for the absence-history filter in AbsenceHistoryPanel.
 *
 * Exported so they can be unit-tested directly without a React environment.
 */

export type AbsenceFilterType =
  | "all"
  | "student_returned"
  | "message_queued"
  | "dismissed";

export const ABSENCE_FILTER_KEY = "absence-history-filter";

const VALID_FILTERS: ReadonlySet<string> = new Set<AbsenceFilterType>([
  "all",
  "student_returned",
  "message_queued",
  "dismissed",
]);

/**
 * Reads the stored filter value from localStorage.
 * Returns the stored value if it is a known valid filter; falls back to "all"
 * for any missing, empty, or unrecognised value.
 */
export function readAbsenceFilterFromStorage(): AbsenceFilterType {
  try {
    const stored = localStorage.getItem(ABSENCE_FILTER_KEY);
    if (stored !== null && VALID_FILTERS.has(stored)) {
      return stored as AbsenceFilterType;
    }
  } catch {
    // localStorage unavailable (e.g. SSR, private-browsing restrictions)
  }
  return "all";
}

/**
 * Persists the chosen filter value to localStorage.
 * Silently no-ops when localStorage is unavailable.
 */
export function writeAbsenceFilterToStorage(filter: AbsenceFilterType): void {
  try {
    localStorage.setItem(ABSENCE_FILTER_KEY, filter);
  } catch {
    // localStorage unavailable
  }
}
