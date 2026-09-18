---
name: GitHub branch protection — classic vs ruleset layering
description: Classic branch protection and the newer repository ruleset system can both apply to the same branch at once, and classic protection has no bypass concept at all — read this before configuring or debugging any branch-protection bypass.
---

# GitHub branch protection — classic vs ruleset layering

GitHub has two independent branch-protection systems that can both be active on
the same branch simultaneously, with no automatic reconciliation between them:

1. **Classic branch protection** (`GET/PUT/DELETE /repos/{owner}/{repo}/branches/{branch}/protection`).
   Its `required_status_checks` has **no bypass-actor concept whatsoever**. The
   only override is `enforce_admins`, and that only exempts human GitHub
   Organization/repo admins from *all* protections — it does not exempt bots,
   GitHub Apps, deploy keys, or any other non-admin credential from anything.
2. **Rulesets** (`GET/PUT /repos/{owner}/{repo}/rulesets/{id}`), the newer
   system. Rulesets support fine-grained `bypass_actors` (specific
   Integration/App ids, Teams, OrgAdmin, DeployKey, etc., each with their own
   `bypass_mode`).

**A ruleset bypass_actor configured correctly does not bypass classic
protection.** If both are active and both require the same status check, a
push authorized as a ruleset bypass actor still gets rejected by classic
protection with the generic-looking `GH013: Repository rule violations...
Required status check "test" is expected` error — indistinguishable at first
glance from a ruleset-level rejection. The only way to tell them apart is to
fetch both configurations directly and compare, since GitHub's own error
message doesn't say which system is the actual source of the block.

**Why:** these are genuinely separate features shipped years apart; GitHub
never merged their bypass models. A repo migrated onto rulesets often still
has classic protection sitting underneath from before, doing nothing except
this kind of belt on top of the ruleset's (functionally superset) suspenders
until an actual bypass path is tested end-to-end.

**How to apply:** before trusting any "bypass" configuration on a protected
branch — whether debugging a mysteriously-rejected push or setting one up for
the first time — fetch *both* `.../branches/{branch}/protection` (classic) and
`.../rulesets` (list, then GET each by id) and check both for the same
`required_status_checks`/equivalent rule. If classic protection is a strict
subset of what the ruleset already enforces (and if it predates the ruleset
and isn't independently relied upon), removing it is usually correct — the
ruleset becomes the single source of truth for a bypass to have any real
effect. Never assume a ruleset bypass_actor works just because it's configured
and returned 200 on the PUT; test the actual push.

## `DeployKey` bypass_actor is unscoped

A ruleset bypass_actor entry with `actor_type: "DeployKey"` has no `actor_id`
— it grants bypass to **any** deploy key currently or later registered on the
repository, not one specific key. This is broader than it looks next to an
`Integration`/`OAuthApp` bypass entry (which *is* pinned to one numeric
`actor_id`). When narrowing a bypass surface from a deploy key to a specific
GitHub App, removing the `DeployKey` entry entirely (rather than trying to
scope it) is the only way to close this — there's no per-key variant.

## A credential can be load-bearing for more than one purpose

Before revoking a credential you've migrated *one* consumer off of (e.g. a git
push mechanism), grep the whole repo for every other consumer, not just the
one you were working on. An SSH deploy key used for pushing (write, the
security-sensitive direction) may simultaneously be relied on elsewhere for
read-only fetch (e.g. a production runtime materializing an exact-commit
source snapshot for verification, since its container image omits `.git`) —
a legitimate, lower-risk use with a completely different threat model. Closing
the actual hole (removing the credential's *bypass/write* privilege at the
gate that mattered) does not require deleting the credential outright if other
legitimate uses still need it; conflating "migrate this one call site" with
"the credential must die everywhere" risks breaking unrelated, currently-live
or in-flight work over a security property that was never at risk from that
other use in the first place.
