/**
 * Shared absence resolution types.
 *
 * Single source of truth for the ResolutionType union, imported by both
 * the server (daniela-absence-worker.ts) and the client
 * (absence-resolution-labels.ts) so they can never drift apart.
 *
 * RESOLUTION_TYPE_VALUES is a runtime const tuple so Zod can build an
 * enum from it — keeps compile-time types and runtime validation in sync.
 */

export const RESOLUTION_TYPE_VALUES = [
  "student_returned",
  "message_queued",
  "dismissed",
] as const;

export type ResolutionType = typeof RESOLUTION_TYPE_VALUES[number] | null;
