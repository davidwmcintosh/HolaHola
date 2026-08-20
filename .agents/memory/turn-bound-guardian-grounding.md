---
name: Turn-bound Guardian grounding
description: Protect live conversation continuity when asynchronous Archive checks resolve after the student has changed topics.
---

## Rule

Every asynchronous Guardian or Archive-grounding request must carry the exact
student utterance and the candidate assertion it evaluates. Its result is valid
while that utterance remains active. It may remain dormant for exactly the
immediately following turn only when the finalized new utterance explicitly
reopens that exact assertion topic. Otherwise discard it; never merge it into
generic next-turn context.

**Why:** An honest failed verification of an earlier guitar assertion redirected
Daniela away from David's current counting-game question. Truthfulness alone is
not enough when the truth belongs to the wrong conversational moment.

**How to apply:** For any new delayed context source in a live session—whether
it begins before, during, or after Daniela's response—bind it to a turn
identity at request time, check that identity when it resolves and again before
delivery, and make current-utterance context explicitly primary. Failed
verification should stay scoped to the candidate under evaluation while the
response answers the current question. Gemini Live automatic-VAD transcription
has text and `finished` but no utterance ID, and it streams independently from
model output. Consume finishes in input order. If delayed text makes a new-turn
boundary ambiguous, mark it untrusted and forbid prior-turn correction delivery;
withholding useful context is safer than matching against mixed utterances.