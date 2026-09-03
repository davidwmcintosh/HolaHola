/**
 * Shared identity-anchor logic for every OAuth/OIDC login provider
 * (currently Replit; soon Google, GitHub, Apple).
 *
 * Extracted from server/replitAuth.ts, where this was first built and proven
 * after a real incident: a beta tester invited by email, who then used the
 * Google/Replit button, ended up with two accounts -- one holding her actual
 * credits, one empty -- because the login path upserted by the provider's
 * own subject id with no check for an existing account under the same
 * email (Sep 2026). Every new provider must go through this same helper
 * rather than reimplementing the lookup, or the exact same bug recurs per
 * provider.
 */
import { storage } from "../storage";

export type OAuthProviderName = 'replit' | 'google' | 'github' | 'apple';

export interface OAuthProfile {
  /** Required, not inferred from anything -- storage.upsertUser's insert would
   *  otherwise silently fall back to the authProvider column's default
   *  ('replit'), which was only ever correct for Replit by coincidence. */
  provider: OAuthProviderName;
  /** The provider's own unique id for this user (e.g. Replit/Google/GitHub sub, Apple's user id). */
  subjectId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  /** Optional role upgrade hint. Only Replit's test-flow claims populate this today. */
  role?: 'admin' | 'developer' | 'teacher' | 'student';
  /** Only Replit's test-flow claims populate this today. */
  isTestAccount?: boolean;
}

/**
 * Resolves which user id a login should actually attach to. A provider's own
 * subjectId is normally that id, but if an account with this email already
 * exists under a DIFFERENT id (created via the password/invite flow, or a
 * prior login through a different provider), that existing account is
 * canonical -- this is what stops a new OAuth login from silently creating a
 * second, credit-less account for someone who already has one.
 */
export async function resolveCanonicalUserId(email: string | undefined, subjectId: string): Promise<string> {
  if (email) {
    const existing = await storage.getUserByEmail(email);
    if (existing && existing.id !== subjectId) {
      return existing.id;
    }
  }
  return subjectId;
}

/**
 * Resolves the canonical account for this profile and upserts it. Returns
 * the canonical user id the caller should use for the session.
 *
 * Relies on storage.upsertUser's existing behavior of never overwriting
 * authProvider on an existing row (onConflictDoUpdate only touches
 * email/name/profileImageUrl/role/isTestAccount) -- this is what lets a
 * password-created account log in via a future OAuth provider without
 * losing its authProvider='password' label. Do not "fix" that; it's
 * intentional and depended upon.
 */
export async function linkOrCreateOAuthUser(profile: OAuthProfile): Promise<string> {
  const canonicalId = await resolveCanonicalUserId(profile.email, profile.subjectId);

  await storage.upsertUser({
    id: canonicalId,
    // Only takes effect on insert (a brand-new account) -- onConflictDoUpdate
    // never overwrites an existing row's authProvider, by design (see above).
    authProvider: profile.provider,
    // Stored lowercase to match getUserByEmail's lookup convention -- an
    // unlowercased email could silently defeat a future match.
    email: profile.email?.toLowerCase(),
    firstName: profile.firstName,
    lastName: profile.lastName,
    profileImageUrl: profile.profileImageUrl,
    role: profile.role,
    isTestAccount: profile.isTestAccount || undefined,
  });

  return canonicalId;
}
