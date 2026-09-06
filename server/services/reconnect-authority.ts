/**
 * Serialization boundary for durable reconnect ownership.
 * Persistence must settle before DELETE ... RETURNING is attempted; any failure
 * is fail-closed and grants no ownership.
 */
export async function winDurableReconnectAuthority(
  persistencePromise: Promise<void>,
  deleteReturning: () => Promise<unknown[]>,
): Promise<boolean> {
  try {
    await persistencePromise;
    const rows = await deleteReturning();
    return rows.length > 0;
  } catch {
    return false;
  }
}