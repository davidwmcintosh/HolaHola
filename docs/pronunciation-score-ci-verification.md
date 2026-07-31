# Pronunciation Score Blank-Guard — CI Verification Record

## Summary

The `pronunciation-score-blank-guard.test.ts` test file is wired into `npm test`
in `package.json` and runs automatically in CI with no extra configuration.
All 25 cases pass in a single `npx tsx --test` invocation.

## Test file

```
client/src/components/pronunciation-score-blank-guard.test.ts
```

## CI command (package.json "test" script, excerpt)

The file is listed **explicitly** in the `npm test` command alongside the other
blank-guard tests:

```
npx tsx --test \
  ...
  client/src/components/pronunciation-score-blank-guard.test.ts \
  ...
```

**No glob expansion is used.** Each guard test is named verbatim in the command
so that a rename or move causes an immediate `ENOENT` failure rather than
silently dropping the test from the run.

## Smoke-check results (verified July 31 2026)

```
▶ Layer 1 — useStreamingVoice hook guard (handlePronunciationScoreShown)
  ✔ rejects when phrase is whitespace-only ("   ")
  ✔ rejects when phrase is an empty string
  ✔ rejects when phrase is missing (undefined)
  ✔ rejects when phrase is a non-string type (number)
  ✔ rejects when wordScores is an empty array
  ✔ rejects when wordScores is missing (undefined)
  ✔ rejects when wordScores is not an array (object)
  ✔ rejects when overallScore is missing
  ✔ rejects when overallScore is a string instead of number
  ✔ rejects when data is null
  ✔ accepts valid phrase, wordScores, and overallScore
  ✔ accepts phrase with surrounding whitespace around real content
  ✔ accepts data with optional fields (encouragement, id, timestamp)
✔ Layer 1 (3.03 ms)

▶ Layer 2 — StreamingVoiceChat component guard (onPronunciationScoreShown)
  ✔ calls toast and does NOT set card when phrase is whitespace-only
  ✔ calls toast and does NOT set card when phrase is empty string
  ✔ calls toast and does NOT set card when wordScores is empty array
  ✔ calls toast and does NOT set card when wordScores is missing
  ✔ calls toast and does NOT set card when data is null
  ✔ calls toast and does NOT set card when overallScore is missing
  ✔ toast fires with the correct title and variant
  ✔ calls setPronunciationScore and does NOT call toast for valid data
  ✔ passes the full data object (including optional fields) to setPronunciationScore
✔ Layer 2 (2.41 ms)

▶ End-to-end guard chain (hook → component callback)
  ✔ whitespace-only phrase is rejected at Layer 1 before reaching Layer 2
  ✔ empty wordScores is rejected at Layer 1 before reaching Layer 2
  ✔ valid data passes Layer 1 AND is accepted by Layer 2
✔ End-to-end guard chain (1.20 ms)

ℹ tests 25  pass 25  fail 0  duration_ms ~600
```

## Explicit-list pattern — convention for future blank-guard tests

All blank-guard test files follow the same registration pattern:

1. **File location**: `client/src/components/<feature>-blank-guard.test.ts`
2. **Test runner**: Node.js built-in (`node:test` + `node:assert/strict`) — no
   extra packages required.
3. **Registration**: Add the path **by name** to the `npx tsx --test …` glob in
   the `"test"` script in `package.json`. Do **not** use directory globs or
   wildcards — an explicit path makes missing files immediately visible as errors.
4. **Guard structure**: Mirror the production guard logic verbatim in a
   standalone helper function inside the test file. If the production guard
   changes, the mirror must be updated to match; the test failing on that update
   is the desired signal.
5. **Layers**: Cover both the hook-level guard (Layer 1) and the component
   callback guard (Layer 2), plus an end-to-end chain test that runs both in
   sequence.

### Checklist when adding a new blank-guard test

- [ ] Create `client/src/components/<feature>-blank-guard.test.ts`
- [ ] Mirror each guard layer as a standalone function (no imports from production code)
- [ ] Add the file path **verbatim** to the `"test"` script in `package.json`
- [ ] Run `npm test` locally and confirm the new suite name appears in the output
- [ ] Confirm exit code is 0

## Relevant files

| File | Role |
|------|------|
| `client/src/components/pronunciation-score-blank-guard.test.ts` | Test suite (25 cases) |
| `client/src/components/cultural-context-blank-guard.test.ts` | Sibling guard test |
| `client/src/components/grammar-correction-blank-guard.test.ts` | Sibling guard test |
| `client/src/components/spotlight-blank-guard.test.ts` | Sibling guard test |
| `package.json` ("test" script) | Explicit-list registration |
