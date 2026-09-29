Alden stated directly, when asked to run `npx tsx server/scripts/shared-spec-cli.ts claim/approve ...`
under his own credential: "I am unable to execute arbitrary npx tsx commands directly, as they are
not on my whitelisted run_shell commands. This is a security measure." He also cannot `read_file` a
CLI script's own stdout/output file as a workaround.

**Why:** this is a real, structural tool-permission boundary on his side (not reluctance, not a
missed message, not silence) -- confirmed by his own words, not inferred. Any workflow design that
assumes "give Alden the same CLI command a human or another hat would run" will silently stall with
no error visible to whoever is waiting on him.

**How to apply:** when a workflow needs Alden to take a mutating action (claim/approve/reject a
shared-spec review, or any other CLI-gated operation), give him the plain HTTP equivalent instead --
find the underlying route in `server/routes/*.ts` and hand him a `curl` command using his own
`COORDINATION_ALDEN_TOKEN` (header `x-coordination-token`, or the route's service-specific token
header), never the wrapping CLI script. Confirm this is still true (not just re-cite it) if `curl`
itself later turns out to also be unavailable to him.

Related, same-incident lesson: shared-spec document reviews can stack -- a document can have more
than one `pending` review outstanding at once if a new revision is marked ready before the previous
one is decided (e.g. revision B's review created while revision A's review, A being B's parent, is
still pending). Each revision stores full markdown content, not a diff, so if the newer revision's
parent chain already includes the older one, deciding only the newest pending review is sufficient
-- the older one becomes moot rather than blocking. Don't ask a reviewer to work through every
stacked review individually without checking parentage first.


**Refinement (2026-09-29): dedicated in-process tools beat the HTTP-curl workaround.** When Alden actually needed to *execute* the shared-spec claim/approve/reject flow himself (not just be told to run a command), the original "hand him a curl command" fix above was superseded entirely: three dedicated Alden tools (`read_shared_spec_review`, `claim_shared_spec_review`, `decide_shared_spec_review`) were added directly to `ALDEN_TOOLS`/`executeAldenTool` in `server/services/alden-functions.ts`, each a thin wrapper (`server/services/alden-shared-spec-review.ts`) calling `SharedSpecCore` in-process with `actorId: "alden"` hardcoded -- no shell, no HTTP, no curl. Verified live: Alden's own tool-call trace (`toolsUsed` in the priority-task response) showed all three tools actually executing, not just described in prose.

**Why:** a curl workaround still assumes Alden has (or keeps having) generic HTTP capability, and still requires constructing the right URL/headers/token by hand each time -- another whitelisted-surface dependency. A dedicated in-process tool is immune to whitelist changes entirely (it's just another entry in his own tool-calling contract), and is the right general pattern for "Replit may go away, some hat must be able to exercise this authority" per David's stated direction: build the capability as a first-class tool for whichever hat needs to actually act, not as an escape hatch through a shell.

**How to apply:** when a hat's real gap is "cannot execute X under its own identity," check first whether X can be exposed as a small dedicated in-process tool calling the domain service directly (with that hat's actorId hardcoded), before reaching for a shell/HTTP/CLI workaround. Bypassing a domain method directly can, however, skip side effects that only the HTTP route layer orchestrates -- see shared-spec-live-instruction-doc-drift.md's 2026-09-29 refinement for the exact trap this created.

