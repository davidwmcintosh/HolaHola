import { db } from '../db';
import { coordinationV2HostReauthorizationRequests, coordinationV2HostEnrollments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'fs';

async function main() {
  const host = (await db.select().from(coordinationV2HostEnrollments)
    .where(eq(coordinationV2HostEnrollments.hostKey, 'LITTLENEMO')))[0];
  const requests = host
    ? await db.select().from(coordinationV2HostReauthorizationRequests)
        .where(eq(coordinationV2HostReauthorizationRequests.hostEnrollmentId, host.id))
    : [];
  writeFileSync('/tmp/reauth-check.json', JSON.stringify({ host, requests }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  writeFileSync('/tmp/reauth-check-error.json', JSON.stringify({ message: String(err?.message ?? err), stack: err?.stack }, null, 2));
  process.exit(1);
});
