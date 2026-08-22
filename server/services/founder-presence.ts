/**
 * Founder Presence Tracker
 *
 * Simple in-memory last-active tracker. Updated on every authenticated
 * founder request. Consumed by Alden's workspace context so he knows
 * whether David is actively working or hasn't been around for a while.
 * Resets on server restart — that's intentional (stale data is worse than none).
 */

interface PresenceRecord {
  lastActiveAt: Date | null;
  sessionCount: number;  // requests in the last hour (rough activity gauge)
  sessionTimes: number[]; // rolling timestamps for the last 20 touches
}

const presence: PresenceRecord = {
  lastActiveAt: null,
  sessionCount: 0,
  sessionTimes: [],
};

export function touchFounderPresence() {
  const now = Date.now();
  presence.lastActiveAt = new Date(now);
  presence.sessionTimes.push(now);
  // Keep only last 20 touches
  if (presence.sessionTimes.length > 20) {
    presence.sessionTimes.shift();
  }
  // Count touches in the last hour
  const oneHourAgo = now - 60 * 60 * 1000;
  presence.sessionCount = presence.sessionTimes.filter(t => t > oneHourAgo).length;
}

export function getFounderPresence(): {
  lastActiveAt: Date | null;
  description: string;
  isCurrentlyActive: boolean;
} {
  const { lastActiveAt, sessionCount } = presence;
  if (!lastActiveAt) {
    return { lastActiveAt: null, description: 'Not seen since last restart', isCurrentlyActive: false };
  }

  const ageSec = (Date.now() - lastActiveAt.getTime()) / 1000;
  const ageMin = ageSec / 60;
  const ageHour = ageMin / 60;

  let description: string;
  const isCurrentlyActive = ageSec < 120; // active within last 2 minutes

  if (ageSec < 60) description = 'Active right now';
  else if (ageMin < 5) description = `Active ${Math.round(ageMin)}m ago`;
  else if (ageMin < 60) description = `Last seen ${Math.round(ageMin)} minutes ago`;
  else if (ageHour < 24) description = `Last seen ${Math.round(ageHour)} hours ago`;
  else description = `Last seen ${Math.round(ageHour / 24)} days ago`;

  if (sessionCount > 5) description += ` (${sessionCount} requests this hour — actively working)`;

  return { lastActiveAt, description, isCurrentlyActive };
}
