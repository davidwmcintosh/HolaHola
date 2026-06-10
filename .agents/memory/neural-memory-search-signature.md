---
name: neuralMemorySearch.search signature bug
description: searchMemory takes (studentId, query, ...) not (query, options) — wrong call caused toLowerCase crash.
---

`neuralMemorySearch.search` is aliased to `searchMemory(studentId, query, domains?, subjectFilter?)`.
A call like `search(queryString, { limit: 5 })` passes an object as the `query` parameter → `TypeError: query.toLowerCase is not a function`.

For Daniela's context loading (no specific student), use `neuralMemorySearch.searchTeaching(query, language?)` instead — it takes `(query, language)` without a studentId.

**Why:** The search object exports both `search` (student-scoped memory) and `searchTeaching` (pedagogical knowledge). They have different first parameters.

**How to apply:** When adding neural network calls in unified-daniela-context-service.ts, check which search function is appropriate. Student-specific = searchMemory(studentId, query). Teaching knowledge = searchTeaching(query, language).
