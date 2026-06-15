---
name: Image engine assignments
description: Which Gemini function to call for each image use case; Imagen 4 permanently rejected.
---

## Rule

All image generation uses `gemini-2.5-flash-image` via one of four functions in `server/services/google-image-service.ts`. Engine choice is determined by **style constant**, not by model — there is only one model.

| Function | Style constant | When to use |
|---|---|---|
| `generateCharacterScene(concept, language?)` | `SCENE_STYLE` | Daniela/character scenes, social phrase cards, `show_image()` during voice chat — reference image passed for character consistency |
| `generateEnvironmentScene(concept, profileKey?)` | `ENV_STYLE` | Landscapes, locations, classroom backgrounds, comparison widget background — **no characters** |
| `generatePropImage(concept)` | `PROP_STYLE` | Single object on white background — vocabulary prop cards |
| `generateFromCustomPrompt(prompt)` | caller-supplied | Lesson headers, scenario covers, menu food, prop room compositor, admin one-off regen |

## Imagen 4 — permanently rejected

Imagen 4 (`imagen-4.0-generate-001`) was evaluated May 2026 and **rejected** due to API instability: 503 RAI failures and 500 internal errors in production. The `generateWithImagen()` function was briefly introduced then removed. **Do not reintroduce it.** The authoritative record is `docs/visual-asset-roadmap.md` → "Final Engine Assignment (revised May 11, 2026)".

**Why:** The roadmap documents a two-engine Gemini Flash strategy as the final decision. Any future PR or agent suggestion to add Imagen 4 back should be refused until the roadmap is explicitly updated with a new stability assessment.

## Comparison background specifically

The grammar comparison widget background (two chalkboards, classroom wall) is an **environment scene** — no characters, wide establishing shot — and must use `generateEnvironmentScene`. The concept string passed to it should be a plain scene description only; ENV_STYLE handles all style directives internally. Do not duplicate "no people / no characters / no text" in the concept — they are already in ENV_STYLE.

Cache key: `vocab_comparison_bg_shared` (language-agnostic, one shared image for all languages).

## Prompt discipline

When calling `generateEnvironmentScene` or `generateCharacterScene`, the `concept` parameter is just the scene description. Do not embed style instructions (cartoon style, no characters, watercolor, etc.) in the concept — they conflict with or duplicate the style constant. The style constant is the single source of truth for style.
