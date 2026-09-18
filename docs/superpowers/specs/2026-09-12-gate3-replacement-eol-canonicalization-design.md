# Gate 3 replacement EOL canonicalization

## Problem

The fourth Windows Gate 3 generation proved that exact fixed-target provider
echo tolerance works. Gemini's first call repeated the approved `read_file`
target, the server validated it, and the Windows executor read only its
hardcoded file.

The second model turn returned a valid bounded `replace_once` intent. Its
`oldText` and `newText` used LF line endings, while the Windows Git checkout
contained CRLF. The executor counted raw-string occurrences, found zero, and
failed before writing or recording a replacement tool result.

The generation is permanently retired. Its founder receipt, runtime
registration, and issued credential are revoked. PostgreSQL preserves the
interactions, claim, and successful fixed read. There is no execution or
completion.

## Invariants

1. The executor, not the model, owns the only writable path.
2. A replacement must identify exactly one logical text occurrence.
3. Line-ending representation must not make the same logical bounded edit
   host-dependent.
4. Ambiguous or malformed source text must fail before mutation.
5. Raw provider arguments remain immutable evidence.

## Considered approaches

### Canonical LF matching with source-style preservation

Classify the source as LF, CRLF, or no-line-ending text. Reject mixed LF/CRLF
and lone carriage returns. Normalize the source, `oldText`, and `newText` to LF
in memory, require exactly one canonical match, apply the replacement in
canonical form, then serialize the result using the source's original style.

This is selected.

### One-way LF-to-CRLF argument conversion

Convert model arguments to CRLF only when the source is CRLF.

This is rejected because it is asymmetric and coupled to the current
provider's output convention. A future CRLF argument against an LF source
would recreate the same defect.

### Prompt or schema enforcement

Ask Gemini to preserve the source's line endings.

This is rejected as an execution boundary. Provider behavior cannot replace
deterministic host validation.

## Text classification

The executor classifies each text value before canonicalization:

- `none`: contains no line-ending characters;
- `lf`: contains LF and no carriage return;
- `crlf`: every LF is preceded by CR and every CR is followed by LF;
- invalid: contains a lone CR or combines CRLF with an unpaired LF.

The source must be `none`, `lf`, or `crlf`. Invalid source text fails before
matching or writing.

`oldText` and `newText` must also have valid line endings. They may use LF,
CRLF, or no line endings independently of the source. Invalid model text fails
before matching or writing.

## Replacement algorithm

1. Preserve the received `oldText` and `newText` unchanged in interaction
   evidence.
2. Validate the existing fixed-target, plain-record, key, type, non-empty, and
   size constraints.
3. Read the hardcoded target through the existing safe-path checks.
4. Strictly decode the source as UTF-8.
5. Classify source, old text, and new text line endings.
6. Convert valid CRLF values to canonical LF. LF and no-ending values remain
   unchanged.
7. Count overlapping occurrences of canonical old text in canonical source.
8. Require exactly one occurrence.
9. Construct the updated canonical text.
10. Serialize every canonical LF as CRLF only when the original source style
    was CRLF. Otherwise retain LF.
11. Enforce the existing final output-size bound.
12. Write the fixed target once.

The model never chooses a path or line-ending policy.

## Audit evidence

Interaction evidence retains the raw provider arguments and validated intent
digest exactly as received.

The successful local tool result adds non-sensitive execution metadata:

- source EOL style;
- old-text EOL style;
- new-text EOL style;
- canonicalization applied;
- output EOL style.

It must not duplicate source content, model replacement text, credentials, or
private authority artifacts.

Rejected local replacements do not create a successful tool result. Their
failure code distinguishes invalid source EOL, invalid old-text EOL, invalid
new-text EOL, zero canonical matches, multiple canonical matches, unsafe path,
invalid UTF-8, and size-bound failure.

## Proof

Before another Windows generation:

1. replay the exact captured fourth-run replacement against a CRLF target;
2. prove the LF arguments match once and the updated file remains CRLF;
3. prove CRLF arguments work against an LF target and the file remains LF;
4. prove LF-to-LF and CRLF-to-CRLF paths remain correct;
5. prove no-line-ending text remains supported;
6. reject mixed source line endings;
7. reject lone-CR source text;
8. reject mixed or lone-CR `oldText`;
9. reject mixed or lone-CR `newText`;
10. reject zero and multiple matches after canonicalization;
11. prove every rejection leaves the original bytes unchanged;
12. preserve existing fixed path, UTF-8, symlink/reparse, argument, and size
    boundaries;
13. prove raw model arguments remain unchanged in immutable evidence;
14. prove successful tool-result metadata records the normalization decision;
15. rebuild and verify the Windows runtime bundle digest pin;
16. run focused runtime, adapter/HTTP, Windows executor, launcher-boundary,
    TypeScript, diff, and system-health checks;
17. obtain unconditional architect and Gemini approval;
18. publish to GitHub and production before creating entirely fresh Windows
    authority.

## Out of scope

- No arbitrary path replacement.
- No broad newline normalization of the repository.
- No reuse of any failed generation's bootstrap, key, challenge, receipt,
  attempt, runtime, profile, credential, packet, claim, or window.
- No changes to task 1448's target file, expected error, focused test command,
  or Windows no-commit rule.