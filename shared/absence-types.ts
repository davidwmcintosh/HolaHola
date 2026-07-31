/**
 * Shared absence resolution types.
 *
 * Single source of truth for the ResolutionType union, imported by both
 * the server (daniela-absence-worker.ts) and the client
 * (absence-resolution-labels.ts) so they can never drift apart.
 */

export type ResolutionType =
  | "student_returned"
  | "message_queued"
  | "dismissed"
  | null;
