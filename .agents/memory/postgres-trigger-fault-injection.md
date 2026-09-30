## Real-DB channel-independence testing via temporary triggers

Testing that two independent "best-effort" database side effects (e.g. two separate notification channels, each in its own try/catch) truly fail independently -- one channel's failure must never block the other -- is best proven with a real PostgreSQL `BEFORE INSERT ... RAISE EXCEPTION` trigger on the target table, created immediately before the call and dropped in a `finally` block, rather than monkey-patching the ORM/service method that performs the insert.

**Why:** Monkey-patching (reassigning a `storage` method, wrapping
`db.insert`) risks Proxy/writability issues and doesn't exercise the real
write path across a pooled connection the way production traffic does. A real
trigger fails the literal SQL statement the method issues, so a passing test
proves the code's actual try/catch boundaries are correctly scoped -- not
just that an injected mock was called. This approach catches a real bug class
(a broken import or schema mismatch in one channel silently also skipping the
other) that dependency-injection-only tests structurally cannot reach, since
DI never touches the real write path at all.

**How to apply:** `DROP TRIGGER IF EXISTS ... ON <table>` + `DROP FUNCTION IF
EXISTS ...` before creating (idempotent re-run), `CREATE FUNCTION ... RETURNS
trigger AS $BODY$ BEGIN RAISE EXCEPTION '...'; END; $BODY$ LANGUAGE plpgsql`
+ `CREATE TRIGGER ... BEFORE INSERT ON <table> FOR EACH ROW EXECUTE FUNCTION
...`, call the real method inside `try`, then drop both trigger and function
in `finally` so the sabotage never leaks into a later scenario or a later
test file sharing the same disposable database. Embed a unique marker string
in each scenario's row content so assertions can distinguish scenarios sharing
the same tables. Assert both that the sabotaged table has zero matching rows
(the trigger actually fired -- a sanity check on the fixture itself) and that
the sibling channel's table still has exactly one (the other channel wasn't
blocked). Gate the whole test on `getVerifiedCiDatabaseUrl()` (see
disposable-database-gate-design.md) so it never runs outside a verified
disposable Postgres instance, and confirm via a real GitHub Actions job
definition (not just the splice list) that the gate's env vars are actually
supplied there before assuming the coverage is live.
