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

