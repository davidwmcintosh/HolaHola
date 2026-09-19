---
name: Guardian grounding — turn-binding and causal correlation
description: Async Guardian/Archive grounding results belong only to the utterance that requested them, and must be correlated to later tool-call batches, not coarse model turns.
---

## 1. Turn-bound grounding

Every asynchronous Guardian or Archive-grounding request must carry the exact student utterance and the candidate assertion it evaluates. Its result is valid while that utterance remains active. It may remain dormant for exactly the immediately following turn only when the finalized new utterance explicitly reopens that exact assertion topic. Otherwise discard it; never merge it into generic next-turn context.

**Why:** an honest failed verification of an earlier guitar assertion once redirected Daniela away from David's current counting-game question. Truthfulness alone is not enough when the truth belongs to the wrong conversational moment.

**How to apply:** for any new delayed context source in a live session — whether it begins before, during, or after Daniela's response — bind it to a turn identity at request time, check that identity when it resolves and again before delivery, and make current-utterance context explicitly primary. Failed verification should stay scoped to the candidate under evaluation while the response answers the current question. Gemini Live automatic-VAD transcription has text and `finished` but no utterance ID, and streams independently from model output — consume finishes in input order. If delayed text makes a new-turn boundary ambiguous, mark it untrusted and forbid prior-turn correction delivery; withholding useful context is safer than matching against mixed utterances.

## 2. Causal correlation to tool-call batches

Guardian evidence must use function-call batch order, not only a Gemini model-turn ID: one model turn can contain multiple tool-call batches. Link an Archive call only when it arrives in a strictly later batch than the specific Guardian delivery, while retaining the same student-turn epoch.

**Why:** a turn-wide tool-name heuristic both falsely credits unrelated Archive calls and can incorrectly call unknown delivery a miss. Model-turn IDs are too coarse to distinguish a pre-dispatch Archive request from one issued after Gemini consumes the injected response.

**How to apply:** any new Guardian injection channel must record the current monotonic batch marker. Later Archive-use diagnostics must keep delivery unknown when no causally subsequent, same-epoch Archive batch is observed.
