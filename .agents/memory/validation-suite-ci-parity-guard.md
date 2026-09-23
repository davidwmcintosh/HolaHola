Cross-referencing two files' textual invocations (e.g. "is every entry required by
file A reachable from file B") by scanning raw source text for string literals is
comment-blind by default: a `// 'the-same-literal'` or `/* 'the-same-literal' */`
reads identically to a live one. A guard whose entire purpose is catching
removed/disabled functionality can be silently defeated by commenting a call out
instead of deleting it, unless comments are stripped from the source text before
matching. Strip comments from the whole text before locating the target call site,
not just inside its already-captured argument list -- a comment earlier in the
file can itself contain a stray closing-paren-like sequence that truncates a
non-greedy extraction early and drops everything after it.

A second, independent blind spot in the same kind of guard: reducing every
requirement to one extraction shape (e.g. "file-path token") means a requirement
that never takes that shape contributes zero extracted items and therefore reads
as "fully covered" by definition, not by verification. Concrete case: a shell
`run_check "label" npm run typecheck` line expands to `tsc --noEmit`, which has no
file-path token at all -- a file-path-only extractor silently drops it as a
requirement, so it can never be flagged missing no matter what CI actually runs.
The fix is a second, explicit fallback shape (e.g. a normalized "pathless command"
key) applied symmetrically to both the required side and the reachable side, with
its own self-check proving a pathless requirement absent from the reachable side
is actually caught -- not just that the normal file-path path still works.

Two adjacent gotchas worth keeping alongside these:

- A "which invocations does harness X make reachable" scanner must exclude the
  harness file itself from both the required and reachable sets it computes, or
  the line that invokes the harness permanently self-flags as missing -- the
  harness defines the reachable set, so it can never also be a member of it. When
  a fallback extraction shape is added later (see the pathless case above), the
  harness carve-out must be threaded through it too: a requirement whose only
  token was the harness self-reference is vacuously satisfied already, not a
  second, separate "pathless" gap needing its own coverage.
- An allowlist meant to prevent silently-creeping undocumented exceptions is more
  robust as a literal value in the guard's own source than in an external config
  file or env var: editing the guard's source is a visible, reviewable diff, while
  a config/env change can slip through unnoticed.

