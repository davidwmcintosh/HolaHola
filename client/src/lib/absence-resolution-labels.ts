/**
 * Pure (non-JSX) helpers for absence resolution type labels.
 *
 * Kept separate from ExpressLanePane.tsx so they can be unit-tested
 * without a React/JSX environment.
 */

export type ResolutionType =
  | "student_returned"
  | "message_queued"
  | "dismissed"
  | null;

export interface ResolutionMeta {
  label: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  className: string;
}

/**
 * Returns the human-readable label and badge styling for a resolutionType
 * value stored in the database.
 *
 * CONTRACT: every value that can appear in danielaAbsenceNudges.resolutionType
 * must have an explicit case here. Unknown/future values fall through to the
 * generic "Resolved" fallback so the UI never shows a raw DB string.
 */
export function getResolutionMeta(type: string | null | undefined): ResolutionMeta {
  switch (type) {
    case "student_returned":
      return {
        label: "Student returned",
        badgeVariant: "default",
        className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
      };
    case "message_queued":
      return {
        label: "Message queued",
        badgeVariant: "secondary",
        className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
      };
    case "dismissed":
      return {
        label: "Dismissed",
        badgeVariant: "outline",
        className: "bg-muted text-muted-foreground border-border",
      };
    default:
      return {
        label: "Resolved",
        badgeVariant: "outline",
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}
