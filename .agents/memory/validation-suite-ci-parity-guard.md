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

Two adjacent gotchas worth keeping alongside this one:

- A "which invocations does harness X make reachable" scanner must exclude the
  harness file itself from both the required and reachable sets it computes, or
  the line that invokes the harness permanently self-flags as missing -- the
  harness defines the reachable set, so it can never also be a member of it.
- An allowlist meant to prevent silently-creeping undocumented exceptions is more
  robust as a literal value in the guard's own source than in an external config
  file or env var: editing the guard's source is a visible, reviewable diff, while
  a config/env change can slip through unnoticed.

