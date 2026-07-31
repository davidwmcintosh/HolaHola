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
 * must have an explicit case here. The exhaustiveness check in the default
 * branch turns a missing case into a TypeScript compile error, so a new
 * resolutionType value cannot be added to the union without also adding a
 * matching label here.
 */
export function getResolutionMeta(type: ResolutionType): ResolutionMeta {
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
    case null:
      return {
        label: "Resolved",
        badgeVariant: "outline",
        className: "bg-muted text-muted-foreground border-border",
      };
    default: {
      // Exhaustiveness check: if a new value is added to ResolutionType without
      // a matching case above, TypeScript will error here at compile time.
      const _exhaustive: never = type;
      return {
        label: "Resolved",
        badgeVariant: "outline",
        className: "bg-muted text-muted-foreground border-border",
      };
    }
  }
}
