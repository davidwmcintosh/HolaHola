# Gemini Audit — Proactive GL Game-Memory Naming

**Date:** August 19, 2026  
**Area:** GL game-session memory naming and privacy-safe fallback  
**Model:** `gemini-3-flash-preview`

## Change reviewed

When the GL game detector identifies a completed game, Daniela now receives a
bounded, transient copy of the session transcript and proposes:

- a descriptive, searchable title; and
- a one-sentence summary.

The known student display name is redacted before the call. The transcript is
treated as untrusted evidence and is never stored in the globally shared
`conversation_memories` row. Daniela chooses from a server-owned topic
taxonomy and copies that option's prebuilt title and summary. The parser accepts
only an exact three-line match to one server-generated option, so no free-form
model text can enter the shared row. Any timeout, model error, malformed
response, altered option, or unknown topic keeps the existing generic metadata.

## Pre-flight findings

The first proposed design gave Daniela only game type, language, turn count,
and date. Both Gemini and Daniela identified the same functional gap: metadata
alone could not produce the requested recall specificity, such as distinguishing
a farm-animal counting game from another counting game.

The first revised design passed the transcript only as transient evidence and
added:

- known-name redaction before the model call;
- explicit prompt-injection boundaries;
- a fail-closed free-form output validator;
- a hard timeout; and
- deterministic fallback before insertion and embedding.

Gemini approved that architecture with identity and possessive output guards,
but the independent architecture review found the remaining gap: heuristic
filters cannot prove that unknown PII or valid-format stored prompt injection
will never enter a globally searchable table.

The final implementation closes that boundary completely:

- the server builds a fixed list of privacy-safe topic options;
- each option includes a server-generated title and one-sentence summary;
- Daniela selects the closest topic from the transcript evidence; and
- the parser accepts only an exact match to one complete option.

The transcript can influence which safe topic is selected, but it cannot
contribute any persisted text.

## Post-build review

Gemini reviewed the final closed-candidate detector, GL stop hook, and focused
regression tests. It found no required corrections. The architecture reviewer
also approved the revised privacy boundary with no remaining security findings.
A final Gemini sign-off pass over the actual code returned:

> **APPROVED — Ship it.**

## Runtime evidence

A live call using a detected Spanish farm-animal counting transcript returned:

- **Title:** `Counting game: Farm animals (Spanish)`
- **Summary:** `A Spanish counting game focused on farm animals across 3 exchanges.`

The exact safe option passed the production parser without persisting the raw
transcript. Focused CI passed 48 assertions, including unknown-PII rejection,
stored-instruction rejection, accepted-metadata persistence and embedding, and
independent fallback persistence.