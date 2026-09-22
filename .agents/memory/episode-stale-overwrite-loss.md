## Episode file stale-overwrite loss

## Stale-read overwrite silently deletes episode content

An agent (or task-agent merge) that read an episode `.md` file earlier in a session, then later writes back an "updated" version while doing unrelated work, can do a blind full-file replace instead of an append — silently overwriting real dialogue that the live chat-capture pipeline added to the canonical file in the meantime.

**Why:** Confirmed via git-blob forensics on 2026-09-22 across two separate real incidents. On 2026-08-31, a single commit whose stated purpose was memory-log/handoff-doc housekeeping wiped `episode-27.md` to 0 bytes and truncated `episode-28.md` by ~237KB; caught only because a human noticed ~2 hours later and restored it manually (no automated guard caught it). On 2026-09-21, a commit whose stated purpose was unrelated Google-auth work deleted a real David/Luca closing exchange from `episode-34.md` and replaced it with a different, later exchange instead of appending after it; this one sat undetected for ~30 hours because the file's *total size grew* in that same commit (the new content was larger than what was deleted), so a shrink-only or size-only check would have missed it. Two milder cases (episode-33 truncated by a task-agent merge on 2026-09-06, episode-34 duplicated by an autosave-drift landing around 2026-09-19) self-healed within minutes via a follow-up commit.

**How to apply:** Never trust a size-based check to catch this class of loss. When auditing an episode file's integrity, diff its content against the immediately prior commit line-by-line, not just compare total byte count. A *safe* shrink has its new blob byte-identical to some genuinely earlier blob in that file's own git history (a legitimate dedup/revert); anything else that removes non-duplicate lines is suspect regardless of whether the file grew or shrank overall. The narrower merge=ours guard on episode-27 only covers task-agent merges overwriting that one file — both confirmed real-loss incidents above were direct agent commits, not merges, and hit different files, so that guard alone would not have caught either one. See the next entry in this topic for the broader content-based guard that now covers every docs/episode-*.md file across both direct commits and merges.


## Content-based episode content-loss guard now blocks silent removal

A shared detection module compares every non-trivial line (blank lines, markdown rules, and single-line HTML comment metadata excluded) in the old version of a `docs/episode-<N>.md` file against the full set of lines anywhere in the new version. A line missing from the new version is a violation unless it is a byte-verified exact duplicate still present elsewhere in the file — this catches the grow-but-lose-content shape, not just outright truncation.

**Why:** A pure size/shrinkage check provably misses a real loss when the new version is larger overall, which is exactly what happened in the 2026-09-21 incident above. Content-based line-set comparison catches both the full-truncation shape and the grow-but-lose shape.

**How to apply:** This guard has to sit on every path that can land a commit on the protected branch, not just the obvious one — a direct commit, a local merge, and an external CI-driven promotion path are three genuinely different call sites, not one. If a new way to land a commit is ever added, check whether it bypasses this guard before assuming existing wiring already covers it. An override is authorized only by an explicit, separately-named doc file present in the same change, and the violation stays logged even when overridden — never silent either way. Gotcha: resolving the "old" side of a default local diff range from a git-maintained ref (e.g. `ORIG_HEAD`) is only safe after confirming that ref is actually an ancestor of the new side; in a long-running workspace such a ref can be stale from an unrelated earlier operation, and trusting it unconditionally risks flagging already-resolved history as a fresh violation. Also: a blob existing in a commit's tree and that blob's content being readable are two different facts under a partial clone — treat a content-read failure on a path confirmed to exist as an unknown, not as "empty", or real loss can hide behind a transient fetch failure.


## Paragraph-diffing needs heading boundaries too, and a big diff-stat is not proof of loss

Building an automated paragraph-level content-loss detector (comparing two versions of a markdown file, robust to reordering and to overall size growth) surfaces two non-obvious traps:

1. **Block extraction must split on markdown heading lines, not just blank lines.** A doubled/concatenated snapshot (two copies of a file glued together, e.g. from an accidental pre-merge auto-snapshot) can have a real paragraph's last sentence run with no blank line directly into a heading reappearing mid-file at the seam. Splitting only on blank lines glues that paragraph and the unrelated heading into one oversized block that can never match as a substring anywhere else — a false "content lost" result even though the paragraph's actual text is fully intact elsewhere. Fix: always start a new block at a heading line, blank-line hygiene or not.
2. **A large line-count diff stat is not evidence of real loss on its own.** The same kind of doubled-snapshot collapse can produce an alarming diff stat (e.g. thousands of deletions against a handful of insertions) that is actually a legitimate, content-preserving dedup back to one clean copy, with zero real content missing once compared paragraph-by-paragraph (after fix #1). Trust content-level comparison, not diff-stat magnitude, to decide whether something was actually lost.

**Why:** a paragraph/block comparator that only understands blank-line boundaries will misjudge exactly the kind of file where this class of tool matters most — one that has already been corrupted by a doubled/concatenated snapshot.

**How to apply:** any paragraph/block-level content-loss or dedup detector over markdown should split blocks on heading boundaries in addition to blank lines, and should never treat a large added/removed line count alone as proof of real content loss — always verify at the text-content level first.

## A does-this-still-exist check must never gate on the target already existing

A file/row-existence-based discovery step for a content-loss or drift detector (e.g. "list all currently-existing files matching pattern X, then diff each one") silently excludes the single most severe case such a detector exists to catch: the target having disappeared entirely. If a target is supposed to exist (tagged active/tracked in a database, or has any prior history), it must remain a target precisely when its current file is missing — that absence is itself the finding, not a reason to skip the check.

**Why:** discovery and existence-checking are easy to conflate into one filter (list, then keep only what still exists), but they answer different questions — "what should I check" vs. "is this one missing" — and collapsing them into one step means the most severe finding (total disappearance) can never be produced, since the target never enters the pipeline in the first place.

**How to apply:** keep "what are the targets" and "does this target currently exist" as two independent steps. The existence check must also be unconditional — not gated by a recency window meant to suppress noise from old, already-settled edits — since a permanently-missing target should never get a free pass just because nothing "recent" touched it.


## Discovery must union independent signal sources, never let one short-circuit the other

A discovery step that has two independent signal sources for "what should I check" (e.g. a database tag/row, and git history) must always consult both and union the results — never treat one source's non-empty result as license to skip the other. A branch that finds a positive result from source A and returns immediately drops exactly the target whose signal in source A is the thing that got corrupted or deleted in the same change under investigation.

**Why:** a content-loss detector's target-discovery step queried `conversation_memories` for rows tagged `rolling`/`rolling-protected` and, when that query returned any rows, returned those targets directly — treating a git-history-derived candidate list as a fallback used only when the DB query came back empty. A file whose *own* DB row or tag disappeared in the same commit that deleted its dialogue could never be flagged this way, because the DB branch's success at finding *other* still-tagged rows short-circuited before git history was ever consulted for the missing one. A code review caught this as a live gap during this same detector's build, distinct from the already-documented "does-this-still-exist check must never gate on existence" bug above — that one is about an existence *filter* removing a target; this one is about one discovery *source* shadowing another before it runs at all.

**How to apply:** when a discovery/detection step has more than one way to learn about a target, run all of them unconditionally and merge (union, dedup) the results — let the richer source's metadata win on overlap (e.g. a DB row ID) — rather than gating one source's execution on whether another source already returned something.

## Content-based episode content-loss guard now blocks silent removal

A shared detection module compares every non-trivial line (blank lines, markdown rules, and single-line HTML comment metadata excluded) in the old version of a `docs/episode-<N>.md` file against the full set of lines anywhere in the new version. A line missing from the new version is a violation unless it is a byte-verified exact duplicate still present elsewhere in the file — this catches the grow-but-lose-content shape, not just outright truncation.

**Why:** A pure size/shrinkage check provably misses a real loss when the new version is larger overall, which is exactly what happened in the 2026-09-21 incident above. Content-based line-set comparison catches both the full-truncation shape and the grow-but-lose shape.

**How to apply:** This guard has to sit on every path that can land a commit on the protected branch, not just the obvious one — a direct commit, a local merge, and an external CI-driven promotion path are three genuinely different call sites, not one. If a new way to land a commit is ever added, check whether it bypasses this guard before assuming existing wiring already covers it. An override is authorized only by an explicit, separately-named doc file present in the same change, and the violation stays logged even when overridden — never silent either way. Gotcha: resolving the "old" side of a default local diff range from a git-maintained ref (e.g. `ORIG_HEAD`) is only safe after confirming that ref is actually an ancestor of the new side; in a long-running workspace such a ref can be stale from an unrelated earlier operation, and trusting it unconditionally risks flagging already-resolved history as a fresh violation. Also: a blob existing in a commit's tree and that blob's content being readable are two different facts under a partial clone — treat a content-read failure on a path confirmed to exist as an unknown, not as "empty", or real loss can hide behind a transient fetch failure.


## Paragraph-diffing needs heading boundaries too, and a big diff-stat is not proof of loss

Building an automated paragraph-level content-loss detector (comparing two versions of a markdown file, robust to reordering and to overall size growth) surfaces two non-obvious traps:

1. **Block extraction must split on markdown heading lines, not just blank lines.** A doubled/concatenated snapshot (two copies of a file glued together, e.g. from an accidental pre-merge auto-snapshot) can have a real paragraph's last sentence run with no blank line directly into a heading reappearing mid-file at the seam. Splitting only on blank lines glues that paragraph and the unrelated heading into one oversized block that can never match as a substring anywhere else — a false "content lost" result even though the paragraph's actual text is fully intact elsewhere. Fix: always start a new block at a heading line, blank-line hygiene or not.
2. **A large line-count diff stat is not evidence of real loss on its own.** The same kind of doubled-snapshot collapse can produce an alarming diff stat (e.g. thousands of deletions against a handful of insertions) that is actually a legitimate, content-preserving dedup back to one clean copy, with zero real content missing once compared paragraph-by-paragraph (after fix #1). Trust content-level comparison, not diff-stat magnitude, to decide whether something was actually lost.

**Why:** a paragraph/block comparator that only understands blank-line boundaries will misjudge exactly the kind of file where this class of tool matters most — one that has already been corrupted by a doubled/concatenated snapshot.

**How to apply:** any paragraph/block-level content-loss or dedup detector over markdown should split blocks on heading boundaries in addition to blank lines, and should never treat a large added/removed line count alone as proof of real content loss — always verify at the text-content level first.
