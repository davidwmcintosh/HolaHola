---
name: pre-merge-handoff
description: Checklist for responsibly landing a cross-cutting change — complete handoff note, no stray/bundled files, no unverified trust. Distilled from a real session that got several of these wrong before catching it.
---

# Pre-Merge Handoff Checklist

Use before landing anything bigger than a routine fix — a new subsystem, a
new required secret, a changed workflow, anything the other interface
(Claude Code ↔ Replit, or any future tool) will have to make sense of
without you in the room. Every step here came from something that actually
went wrong or almost did in one real session, not from a hypothetical.

## 1. List what's actually going out — don't work from memory

```bash
git log origin/main..HEAD --oneline
```

Memory of "what I did" misses things — a handoff note written from memory
one session missed two real shipped changes (a dependency cleanup and a
relocated file) that were sitting right there in this exact command's
output. Cross-check the handoff note against this list, not the other way
around.

## 2. Write the handoff entry in the same commit batch, not after

Add a `## From <interface> — <date> (<short label>)` entry to
`docs/alden-agent-handoff.md` covering, for every commit from step 1: what
shipped, why (especially any deliberate deviation from a design doc), new
secrets required and where they need to live, and what's still unresolved.
This file is git-tracked and already checked at the other interface's
session start — and (once `scripts/post-merge.sh`'s surfacing addition has
landed) printed automatically the moment it's pulled, mid-session or not.
Writing it after the fact, once, produced a real reconciliation-cold
problem for the other interface — see `docs/shared-agent-instructions.md`'s
Engineering Handoff section for the standing rule this exists to satisfy.

## 3. Before staging, triage everything `git status` shows — don't sweep it all in

- **Yours, part of this change** — stage and commit normally.
- **Pre-existing, unrelated changes already sitting in the working tree** —
  don't bundle them into your commit and don't discard them. If they share
  a file with your change, split them out: `git diff <file> > patch`,
  extract just your hunk, `git apply --cached` that hunk only, leave the
  rest as the working-tree diff it already was.
- **Untracked files** — check what they actually are before deciding
  anything, even if the name looks innocuous. A misplaced-but-legitimate
  file gets relocated into a real tracked location, not left loose or
  discarded. Anything that looks like a credential (a `.env`-shaped backup,
  a key, a token) is flagged, never committed, and the user deletes it
  themselves — that's a real line, not a formality. Pure scratch/log dumps
  get flagged for deletion the same way, not quietly committed because they
  were sitting there.

## 4. If this is the first real use of a new safety mechanism, prove the failure path first

Before trusting a new gate (a migration validator, a promotion pipeline,
anything that's supposed to catch a bad case), deliberately construct the
bad case and confirm it's actually caught — and confirm the cleanup happens
on that failure path too, not just on success. A mechanism that's only ever
been exercised on the happy path hasn't been tested, it's been hoped about.

## 5. Verify, don't trust a summary — yours or an agent's

For anything security- or infra-sensitive, independently re-check before
calling it done: re-run the command yourself, re-read the actual diff,
re-query the actual state. A background agent's or your own prior
message's account of "what happened" describes intent, not a substitute for
looking.
