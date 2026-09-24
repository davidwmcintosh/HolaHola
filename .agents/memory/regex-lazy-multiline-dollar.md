## Lazy regex + multiline $ silently truncates a match

A regex meant to lazily consume "everything up to a following marker or the
end of the document" typically looks like:

```js
new RegExp(`PREFIX[\\s\\S]*?(?=\\nNEXT_MARKER|$)`)
```

Adding the `m` (multiline) flag to that pattern breaks it silently. With `m`,
`$` matches before *every* line's terminator, not just at the true end of the
input. Because the quantifier is lazy, the engine stops at the *first*
position satisfying the lookahead -- which is now the end of the first line
of the block, not the end of the document. The match (and anything built on
it, like a `.replace()`) then only ever covers the first line of the intended
span, silently leaving the rest of that block's old content sitting in the
output instead of being replaced.

**Why:** in JavaScript, `$` without `m` already matches only the true end of
the input (unlike some other regex flavors that match before a trailing
newline), so `m` was never needed to make `$` reachable there at all -- it
only adds extra, unwanted reachability at every line break, which defeats the
"don't stop until you truly must" point of the lazy quantifier. A fixture
where the block being matched is a single line, or is the last thing in the
document, will not expose this -- the bug only shows up when the intended
match spans multiple lines *and* something else follows it.

**How to apply:** whenever pairing a lazy `[\s\S]*?` (or `.*?`) with
`(?=OTHER_MARKER|$)` to consume up to a marker-or-end, do not add the `m`
flag unless `^`/`$` are also doing real per-line anchoring work elsewhere in
the same pattern. Test with a fixture where the target block has multiple
lines of body content *and* a further section follows it -- that is the
minimal case that distinguishes "matched the whole block" from "matched only
its first line."

