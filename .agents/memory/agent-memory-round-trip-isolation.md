## Round-trip / regenerateAll snapshot-diff tests need solo isolation

A test that snapshots a DB-projected file, calls a *global* regenerate function (one that re-renders from ALL rows across every topic/entry, not just the rows this test itself wrote), then diffs the result byte-for-byte against the snapshot is vulnerable to any writer inserting a row into that database between the snapshot and the regenerate call — including a sibling test file racing in the same `npx tsx --test <fileA> <fileB> <fileC>` invocation, since Node's test runner executes multiple files concurrently by default.

Giving each file its own `mkdtemp()`'d scratch file directory does not fix this. The file directory is not the shared resource; the database is. A `regenerateAll()`-style function reads global DB state, so a sibling's concurrent CLI write lands in the vulnerable window regardless of which directory each test's own rendered files get written to.

Confirmed directly in `server/scripts/test-agent-memory-round-trip-postgres.test.ts`: a failure diff showed fixture entries from all three sibling test files ("From A"/"From B", "A Title", "Entry One"/"Entry Two") interleaved in one shared `MEMORY.md`, even though each file had legitimately distinct throwaway topic slugs.

**Fix:** run the file containing the global snapshot-diff assertion completely alone, as its own sequential gate/CI step, never bundled with any sibling file under default Node test-runner concurrency. Apply this to any future test with the same "snapshot a global projection, regenerate, diff exactly" shape — not just this one file. Files that only do positive pattern-matching or scoped-row DB assertions (no global byte-exact diff) remain safe to bundle together.

