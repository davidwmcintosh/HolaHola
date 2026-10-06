## Related scanner and mutation evidence

Related guard/self-check lessons remain in their original topic records:

- [Duplicate detector fixture gaps](duplicate-detector-fixture-gaps.md):
  one detector's mutation check does not prove sibling detectors.
- [Mutation-guard scenario coverage](mutation-guard-scenario-coverage.md):
  test both never-fires and always-fires behavior, not only one direction.
- [Scanner self-test fixture race](scanner-selftest-fixture-race.md):
  live-directory fixtures can race another scanner's directory traversal.
- [Text-scan guards can flag themselves](grep-guard-self-reference-false-positive.md):
  comments or fixture strings in the guard itself can match its target pattern.

**Why:** These related pointers are grouped to keep the shared memory index
below its visibility threshold without deleting or rewriting the original
lessons, evidence, or topic records.

**How to apply:** Open the relevant linked topic when changing a static scanner
or mutation self-check. Index consolidation is not permission to discard the
original source records or treat all four failure modes as the same issue.

