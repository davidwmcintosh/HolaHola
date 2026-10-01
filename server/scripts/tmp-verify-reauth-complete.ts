import { db } from '../db';
import { coordinationV2HostReauthorizationRequests, coordinationV2HostCredentials, coordinationV2HostEnrollments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'fs';

async function main() {
  const host = (await db.select().from(coordinationV2HostEnrollments)
    .where(eq(coordinationV2HostEnrollments.hostKey, 'LITTLENEMO')))[0];
  const request = (await db.select().from(coordinationV2HostReauthorizationRequests)
    .where(eq(coordinationV2HostReauthorizationRequests.id, '0bcec1d6-867e-40f2-b644-61c0065dd960')))[0];
  const credentials = host
    ? await db.select().from(coordinationV2HostCredentials)
        .where(eq(coordinationV2HostCredentials.hostEnrollmentId, host.id))
    : [];
  writeFileSync('/tmp/verify-complete.json', JSON.stringify({
    hostStatus: host?.status,
    request: request ? { state: request.state, resultCredentialId: request.resultCredentialId, completedAt: request.completedAt } : null,
    credentials: credentials.map(c => ({ id: c.id, capability: c.capability, revokedAt: c.revokedAt, expiresAt: c.expiresAt, issuedAt: c.issuedAt, issuedBy: c.issuedBy })),
  }, null, 2));
  process.exit(0);
}
main().catch((err) => { writeFileSync('/tmp/verify-complete-error.json', String(err?.stack ?? err)); process.exit(1); });
