export type UserRole = 'student' | 'teacher' | 'developer' | 'admin';

/**
 * Role Hierarchy:
 * - admin (Super Admin): Has ALL permissions (teacher + developer + student)
 * - developer: Has teacher + student permissions
 * - teacher: Has teacher permissions only
 * - student: Has student permissions only
 */

export function hasTeacherAccess(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === 'admin' || role === 'developer' || role === 'teacher';
}

export function hasStudentAccess(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === 'admin' || role === 'developer' || role === 'student';
}

export function hasDeveloperAccess(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === 'admin' || role === 'developer';
}

export function hasAdminAccess(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === 'admin';
}
