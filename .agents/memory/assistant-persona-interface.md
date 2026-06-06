---
name: AssistantPersona interface
description: The AssistantPersona type in assistant-tutor-config.ts — what fields it has after June 2026 cleanup.
---

## Current shape (after June 6, 2026)
```ts
export interface AssistantPersona {
  name: string;
  language: string;
  gender: 'female' | 'male';
  role: string;
  coreMission: string;
  teachingPrinciples: string[];
  frustrationHandling: string[];
}
```

**Why:** `personality` (traits/description) and `voice` (tone/pace/pitch/clarity) fields were removed as part of Daniela personality unification. Those fields were scripted personality traits — not functional context.

**How to apply:** Don't re-add `personality` or `voice` to this interface. If you need to extend it, add functional/pedagogical fields only. The `/api/assistant/persona` endpoint in `routes.ts` was also updated to drop those fields from its response.
