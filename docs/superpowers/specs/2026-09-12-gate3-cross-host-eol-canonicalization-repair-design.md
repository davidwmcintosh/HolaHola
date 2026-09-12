# Gate 3 cross-host EOL canonicalization repair

## Problem

The first Gate 3 artifact repair made the server substitute the exact starting
commit before hashing. A second real Windows generation proved that substitution
alone does not establish cross-host byte identity.

Windows read `server/templates/task-1448.md` from its checkout with CRLF line
endings. Replit read the same Git source with LF line endings. After substituting
the same starting commit:

- Windows produced SHA-256
  `432d600cc3038dbaddbfbbe37ba9df8d8936cd5bae6f6f3c3e4df516542bf48a`;
- Replit produced SHA-256
  `b547dec52f1dcf549449721fb0d938355e55f5228009fe9995706d65217b4f3b`.

The assignment producer failed closed before database mutation. The founder
receipt was revoked, canonical PostgreSQL showed zero downstream authority or
execution rows, and Windows cleanup ended in
`ANTIGRAVITY_GATE3_UNINITIALIZED`.

## Required invariant

The approved task artifact is one canonical UTF-8 byte sequence independent of
checkout line-ending conversion.

Both Windows preparation and server assignment must:

1. accept LF and CRLF template line endings;
2. reject any lone carriage return as malformed;
3. normalize every CRLF sequence to LF;
4. require exactly one case-sensitive
   `__FINAL_STARTING_COMMIT__` placeholder;
5. replace it with the validated starting commit;
6. encode the canonical text as UTF-8 exactly once; and
7. hash, write, persist, and replay those exact bytes.

The server remains the assignment authority and never accepts caller-supplied
prepared task text.

## Design

### Shared pure materializer

Create a focused pure module for Gate 3 task-artifact materialization. It
receives decoded template text and the validated starting commit, then returns
the canonical text, bytes, and SHA-256 together.

The materializer will:

- reject empty input;
- reject input whose source or canonical output exceeds the existing 64 KiB
  bound;
- reject `\r` not immediately followed by `\n`;
- normalize CRLF to LF;
- validate exact placeholder cardinality after line-ending validation;
- substitute the commit once;
- UTF-8 encode once; and
- derive SHA-256 from that returned byte sequence.

The pure module must not read files, access the database, or inspect host
configuration.

### Windows preparation

`prepare-antigravity-provisioning.ts` will call the shared materializer after it
reads the checked-in template. It will write the materializer's canonical LF
text to `.local/tasks/task-1448.md` and place the returned digest in the public
bundle.

If an artifact already exists, idempotent preparation succeeds only when its
exact bytes equal the canonical materialized bytes. CRLF-equivalent existing
content is not accepted as equal after the authority digest has been chosen.

### Server assignment

The assignment-window service retains its no-follow, bounded, read-through-EOF,
strict UTF-8 file handling. It passes the decoded text to the shared
materializer and compares the returned digest with the public bundle before
opening the assignment transaction.

The returned canonical text and digest remain the single captured artifact used
for event creation, inbox projection, packet construction, audit evidence, and
replay checks. No later code rereads or rematerializes the template.

### Repository policy

Add this exact defense-in-depth rule:

```gitattributes
server/templates/task-1448.md text eol=lf
```

Correctness must not depend on the rule. The runtime materializer still accepts
CRLF and produces LF so copied, existing, or externally modified checkouts
cannot restore host-dependent authority.

## Failure handling

Malformed line endings, empty or oversized input, placeholder mismatch, or
artifact digest mismatch fail before assignment transaction entry and create no
assignment, window, packet, claim, credential exchange, execution, or
completion.

Each failed real generation remains permanently retired. Its challenge,
receipt, attempt, bootstrap, key, runtime/profile identifiers, bundle, packet,
claim, credential, and generation must never be reused.

## Required proof

### Independent canonical oracle

Tests must contain a separately written canonical LF expected string and its
fixed SHA-256. They must not calculate expected output by calling the shared
materializer or by normalizing producer output.

### Cross-host integration regression

One regression must:

1. give Windows preparation a CRLF template fixture;
2. verify the generated task artifact contains LF and no CR bytes;
3. verify its exact bytes and digest equal the independent canonical oracle;
4. give server assignment the logically identical LF fixture;
5. verify assignment accepts the Windows public bundle; and
6. verify the persisted artifact text and digest equal the same independent
   oracle.

This test must exercise the real preparation and assignment boundaries rather
than comparing two direct calls to the shared helper.

### Adversarial coverage

Focused coverage must also prove:

- LF, CRLF, and mixed LF/CRLF input converge on the canonical LF bytes;
- lone CR fails closed;
- zero, multiple, and wrong-case placeholders fail closed;
- empty and over-bound source input fail closed;
- substitution that crosses the output bound fails closed;
- existing CRLF artifact bytes are not accepted as equal to canonical LF;
- the same-inode growth-after-stat regression remains effective; and
- every pre-transaction failure leaves zero partial authority rows.

## Scope

Implementation is limited to:

- a focused pure Gate 3 artifact materializer;
- Windows preparation and its focused tests;
- assignment-window materialization and its disposable PostgreSQL tests;
- the exact `.gitattributes` rule; and
- required batch, handoff, audit, and durable cross-host-digest documentation.

There are no schema, Windows launcher, runtime executor, prompt, credential,
task-objective, task 1449, or task 1450 changes.

## Verification and publication gate

Before any third Windows initialization:

1. focused materializer, preparation, and assignment-window tests pass;
2. assignment-window database tests run against disposable PostgreSQL only;
3. adjacent runtime and HTTP suites remain green;
4. TypeScript, diff checks, and system health pass;
5. an independent architect approves the actual final diff;
6. Gemini reviews the actual final code until it returns exact unconditional
   `APPROVED — Ship it.`;
7. only the reviewed repair and required records are published to GitHub;
8. production is republished and returns healthy; and
9. a new Windows generation uses entirely fresh authority and identifiers.

The next real proof must compare the new Windows public artifact digest with the
server's locally materialized canonical LF digest before Phase A. A mismatch
retires the local Windows generation before founder approval, preventing a third
receipt from needing revocation for this class of error.