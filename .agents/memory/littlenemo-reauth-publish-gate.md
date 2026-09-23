## Founder-stop sequence

Per `docs/superpowers/specs/2026-09-17-coordinator-v2-windows-reauthorization-compatibility-repair-design.md`
(David-approved), any fix that Windows-host reauthorization testing depends on
must clear this exact sequence:

1. commit + push exact source
2. `prepare` + verify a fresh protected source promotion
3. **stop — founder-only source publication** (only David's actual Publish
   action produces the commit marker `record` requires)
4. `prepare` + verify a fresh runtime release
5. **stop — founder-only runtime publication**
6. fast-forward LITTLENEMO to the exact published commit, verify its tree
7. replay the existing persisted reauthorization generation
8. verify the pending DB row + approval metadata
9. **stop — founder-only approval**
10. poll/sign/store the replacement credential
11. initialize + verify the runtime without creating a session

**Why:** the doc states "No step may reuse a source promotion or runtime
release prepared for different source bytes" — this is a strict,
non-reorderable chain, not parallel tracks. A `prepare` that returns
`ready_to_promote` clears only step 2; three separate founder-only stops (3,
5, 9) remain before LITTLENEMO can be touched.

**How to apply:** when asked to get a fix ready for LITTLENEMO/Windows-reauth
testing, report which step number you've reached rather than implying the
whole chain is done because CI/prepare passed.

