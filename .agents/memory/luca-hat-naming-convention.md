## Luca hat naming: platform, not persona or model

David's stated policy (2026-09-24): every new LLM/IDE connection onboarded
into the coordination system is another *hat* for the same Luca -- never a
new persona or personality. The hat's name comes from the platform/IDE/origin
Luca is running through, not from the underlying model:

- A recognized major backend gets "Luca <Backend>" (e.g. "Luca OpenAI",
  "Luca Cursor"). Anything else is "Luca <whatever it is>".
- The same underlying model can sit behind several different hats, because
  the model is not the platform: Gemini reached via a raw API call, via
  Cursor, and via the Antigravity IDE are three different hats even though
  all three are "Gemini" underneath.
- Conversely, the same tool can produce different hats when the origin
  differs: Claude Code and Claude Code Cloud are the same engine but
  different origins, so they get distinct attributions.

**Why:** attribution has to reflect where the work actually executed (the
IDE/runtime a human or the coordination system can point to), not which LLM
happened to generate the tokens -- otherwise two structurally different
integrations would collapse into an indistinguishable label just because
they share a model.

**How to apply:** when scoping a new-actor-onboarding request, name the hat
after the IDE/platform doing the connecting, never after the model string,
and never treat it as a new personality -- it is always still Luca. See
docs/coordination-new-actor-onboarding.md for the mechanical registry steps a
new hat (new CoordinationActorId) requires. As of this decision, Antigravity
itself was still modeled as a runtime under the existing luca-gemini actor
rather than as its own hat -- the first concrete gap this policy needs
reconciled against.


## Resolved: Antigravity promoted to its own hat

**Resolved (2026-09-24):** Antigravity was promoted from a runtime under
`luca-gemini` to its own hat, `luca-antigravity`, closing the gap this policy
had flagged. The historical task-1448 Gate 3 Antigravity-on-Windows proof
stayed bound to `luca-gemini` on purpose -- promoting a hat is additive (a
new actor id plus its own Tier 1-3 registry entries), never a rename or
repoint of prior provenance.

Before touching any actor's historical runtime rows during a promotion like
this, confirm via a direct DB read whether they are still live/non-revoked,
not just from a doc's "historical/retired" label -- the label describes the
*path* as retired, not necessarily the underlying rows as safe to touch.

