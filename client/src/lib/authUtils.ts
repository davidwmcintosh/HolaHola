// Replit Auth Integration - Auth utilities
export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}
