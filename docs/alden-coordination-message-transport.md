# Alden coordination message transport

Inbox discovery and complete-body reading are separate read-only operations.
The inbox returns at most five events with the original service paging window.
Small bodies have `contentComplete: true` and `content`. Larger bodies have
`contentComplete: false`, `contentPreview`, and `contentRead` arguments.
`window.complete` describes discovery paging only, not reading of previewed
bodies.

Call `read_coordination_message` with the exact `thread_id`, `event_id`, and
`offset: 0`. Continue with the returned `nextOffset` as `offset` until
`complete: true`. Join the content chunks in offset order. Offsets count UTF-16
code units; chunk boundaries preserve surrogate pairs. Each response identifies
the source event and the SHA-256 of its complete UTF-8 text.

The read tool uses the canonical thread-participation check as Alden before
looking up the exact event. Neither tool acknowledges, changes ownership, or
moves an inbox cursor. No new credentials or cross-thread permission are added.

Inbox previews are bounded by their serialized JSON size, including escaping.
Both chat providers and the background worker pass these structured results
without slicing; any envelope exceeding 12,000 characters fails explicitly.
Unrelated tools retain their existing transport behavior.

The authenticated priority-task response includes `coordinationReadReceipts`
assembled from executed tool results, not from Alden's generated text. They
identify the actual event, source digest and read offsets/window bounds. They
exclude content, previews, credentials and signed window tokens, and are not
stored as raw tool results in Alden's conversation history.

## Verification boundary

Hermetic checks cover full paging metadata, escaped bodies, chunk reassembly,
invalid offsets, denied thread access, missing events and provider wiring.
They do not prove deployed retrieval or historical incident causality.
Production acceptance requires observed tool execution and a recipient-facing
reply on the original report thread, independently verified by a participant.
Publication and native Windows fixture operations need separate approval.

This change is not native offline Authenticode verification evidence.

## Observed development status — 2026-10-06

- The focused hermetic suite passed all 15 tests; the provider declaration
  projection guard passed. The final diff passed whitespace checks.
- Both providers executed inbox and chunk reads on the original reconstruction
  report. Server-generated receipts confirmed the actual event, offsets and
  source digest. Anthropic read all 7,169 UTF-16 units across eight contiguous
  chunks, ending with `complete: true`.
- Both providers advanced inbox pages in development. The final Gemini probe
  confirmed that the submitted continuation token's SHA-256 matched the token
  returned by the prior page; source window bounds and acknowledged cursor
  remained unchanged. One earlier Gemini attempt received an invalid-signature
  error; its input token was not captured, so its cause is not established.
  Token validation was not weakened.
- Initial full compilation attempts timed out or were interrupted; a 2 GiB
  compiler attempt exhausted its heap. The final full `tsc --noEmit` run, with
  a 4 GiB heap cap and the same project configuration, passed (exit 0).
- The restarted app served `/api/version` with HTTP 200 and its landing page
  rendered in the preview.
- Production publication has not been performed. Original-thread recipient
  acknowledgement after publication and independently approved native Windows
  fixtures/pins/receipts remain outstanding.
