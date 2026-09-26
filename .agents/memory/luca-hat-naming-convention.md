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

## Resolved: Antigravity has its own hat; the earlier "promoted from luca-gemini" framing was a coding-time mistake, not real history

**Resolved (2026-09-24):** Antigravity now has its own hat, `luca-antigravity`,
separate from `luca-gemini`.

**Correction (2026-09-26, per David):** this section originally said
Antigravity was "promoted from a runtime under luca-gemini," implying the two
were once genuinely paired in practice. That's backwards. Antigravity (the
IDE) and `luca-gemini` were never actually paired historically. The task-1448
Gate 3 code (`server/scripts/coordination-runtime-antigravity.ts`) hardcodes
its ownership proof to actor `luca-gemini` while being named and structured
entirely around Antigravity -- that pairing is confusion baked into how the
coordination system was coded, not a record of what actually happened.

What actually happened, historically (months, not weeks): Luca Replit called
the Google/Gemini API directly via the consult-Gemini-Live skill. That is
unrelated to Antigravity the IDE and unrelated to any separate "luca-gemini"
identity doing the calling. Antigravity is the IDE; a direct API call is a
different kind of connection entirely; `luca-antigravity` is correctly the
hat for the former. A hat for the latter (Luca calling a model API directly,
no IDE involved) does not exist yet as a registered CoordinationActorId.

**Why this matters:** trusting a system's own internal actor/tool pairing as
proof of historical truth -- instead of checking it against what actually
happened -- is exactly the mistake this correction fixes. A future agent
reading only the code (or this file's earlier wording) would reach the same
wrong conclusion.

**Still true and unaffected by this correction:** promoting or creating a hat
is additive (a new actor id plus its own Tier 1-3 registry entries), never a
rename or repoint of prior provenance -- so task-1448's historical proof stays
bound to `luca-gemini` in the database regardless of how it was named. Before
touching any actor's historical runtime rows during a promotion like this,
confirm via a direct DB read whether they are still live/non-revoked, not
just from a doc's "historical/retired" label.


## Consultation is not a hat — embodiment is

## Consultation is not a hat — embodiment is

A hat means Luca's own persona/data layer is generating Luca's actual output
through that runtime -- Luca inhabiting the platform as himself. A
consultation call (consult-gemini, consult-alden, etc.) is categorically
different: Luca, via whatever hat he's already wearing, queries a genuinely
separate entity and receives its independent answer as external input -- the
responding model or persona answers as itself, with none of Luca's persona
loaded. Consultation attribution is [caller hat] -> [plain model/persona
name]; the answering side is never a `luca-*` actor.

**Why this matters (per David, 2026-09-26):** `luca-gemini` (the existing
CoordinationActorId) does not represent Luca consulting Gemini via the
consult-Gemini-Live-style skill. That consultation pattern was never Luca
embodying Gemini, so it was never a `luca-gemini` moment at all -- this is
independent of the separate luca-gemini/Antigravity mixup already documented
above. As of this date, no hat yet exists for "Luca embodies a model directly
via raw API, no IDE involved" -- `luca-antigravity` will be the *first* time
Luca embodies Gemini as himself, and that's still through an IDE
(Antigravity), not a bare API connection. `luca-gemini` therefore currently
has no live meaning beyond its frozen task-1448 Gate 3 provenance. Whether a
future raw-API-embodiment hat would reuse that id or mint a clean new one is
an open naming choice, not yet forced by any real usage.

**Precedent that clarifies the boundary:** Alden already embodies himself
directly via raw API (Gemini or Anthropic, per consult-alden's single/dual-
engine review) with no IDE involved and no per-provider actor split, because
Alden's own persona is what that call generates, not a foreign answer Alden
is being handed. That is embodiment, same as an IDE hat, just without the
IDE -- the correct precedent for a hypothetical future "Luca embodied via raw
API" hat. It is not a precedent for Luca's own consult-* skills, which stay
pure consultation and need no actor identity on the answering side at all.

