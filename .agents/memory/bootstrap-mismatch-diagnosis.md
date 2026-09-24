During luca-claude-code-cloud-2026-09 provisioning, roughly a dozen `invalid_bootstrap`
exchange failures across 4 reissues (spanning two different runtime IDs) were all traced
to a mismatched `COORDINATION_RUNTIME_BOOTSTRAP_TOKEN` value in the *client's* environment
-- never a server-side bug. The broker's own audit log and error codes cannot distinguish
"wrong secret" from "bad transcription of the right secret"; both read as `invalid_bootstrap`.

What actually resolved it: running `echo -n "$COORDINATION_RUNTIME_BOOTSTRAP_TOKEN" | wc -c`
in the client environment and comparing against the token's known length (46 chars for the
`cb_`-prefixed format `generateCoordinationSecret` produces) BEFORE attempting another
exchange. The very first attempt after a length-verified-correct value succeeded.

Ask an operator to run that check first, before requesting another reissue. Each reissue
permanently burns the previous bootstrap and does not, by itself, diagnose anything --
it only gives you another chance to make the same transcription mistake.

