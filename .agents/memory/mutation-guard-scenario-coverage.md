A guard that refuses on some condition can be broken in more than one direction, and a single mutation-guard scenario does not prove both. Confirmed while proving a content-hash drift guard (GitWorkingTreeLiveSyncProvider.syncExclusive() in server/services/shared-spec-live-sync.ts, which refuses to overwrite a live-instruction document unless the file's on-disk hash is a member of a known-revisions set): mutating the guard to a no-op ("never refuses") and mutating it to always-empty-known-set ("always refuses") are two independent failure modes, and each is caught by a disjoint subset of the project's existing regression tests. Proving the no-op mutation fails the test suite says nothing about whether the always-refuses mutation would also be caught -- and vice versa.

**Why:** the two mutations break the guard in opposite directions (permissive vs. overly strict), so only tests that specifically exercise that direction's expected outcome (a write that should succeed vs. a write that should be refused) will fail against it. A test suite can look fully protective against one direction while having zero coverage of the other, and only running both mutation scenarios separately reveals the gap.

**How to apply:** when writing a mutation-guard self-check for a guard with more than one way to be silently broken, enumerate the distinct failure directions first (e.g. "never fires" vs. "always fires"/"fires too broadly"), then run each mutation as its own independent scenario against the specific regression tests that direction should break -- do not assume one mutation's pass/fail result generalizes to the other. It is fine, and expected, for the two scenarios to map to non-overlapping test subsets.

## Not every guard has a clean 1:1 scenario-to-test mapping

The original content-hash drift guard (pre-write) happened to have a clean mapping: each
of its two failure directions is caught by exactly one purpose-built dedicated test, and
is invisible to the other direction's test. This is not guaranteed. Confirmed on a sibling
guard in the same file (`shared-spec-live-sync.ts`'s POST-COMMIT verification check,
`hashSharedSpecMarkdown(writtenBytes) !== target.contentHash`): its "always refuses" failure
direction breaks essentially every happy-path test that expects `state: "synced"` (four
separate tests in `shared-spec-live-sync.test.ts`, confirmed by direct mutation), because
no single test was purpose-built to prove "the guard must not over-fire" -- that property is
just an incidental side effect of every ordinary success-path test.

**Why:** a guard's "fires too often" direction is often only provable as a side effect of
many unrelated tests, not one dedicated test, when the guard sits on the happy path itself
(as opposed to a guard that only activates in a specific edge case, which tends to get its
own dedicated test for each direction).

**How to apply:** when a mutation scenario's "expect FAIL" step breaks more than one test,
do not try to enumerate all of them in the wrapper script's `unitTestNamePattern` -- pick
the single simplest/most-canonical one as the proof (matching the convention already used
for the clean-mapping case), and say so explicitly in the header comment so a future reader
doesn't assume the omitted ones are uncovered by coincidence.

