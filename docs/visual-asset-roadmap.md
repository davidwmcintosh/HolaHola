# Visual Asset Roadmap
## HolaHola — Pre-Generated Visual Library

**Created:** March 15, 2026  
**Last updated:** April 15, 2026  
**Referenced by:** `docs/curriculum-strategy.md` (Section 8)  
**Component coverage manifest:** `docs/textbook-component-coverage.json` (machine-readable, Lyra-monitored)  
**Status column key:** ⬜ Planned | 🔄 Generating | ✅ In Library

---

## Pedagogy & Image Generation Reference Documents

These documents inform what to generate, how to generate it, and what gaps remain in the curriculum. Read these before planning new image batches or new chapters.

| Document | Purpose | Key Output |
|---|---|---|
| `docs/image-analysis-madrigal.md` | How Madrigal illustrates every concept type — 10 image templates, per-category drawing specs, prompt guidelines, and the "Question Fit Test" | Use this as the brief for any new VocabQA image batch |
| `docs/gap-audit-holahola-vs-madrigal.md` | Chapter-by-chapter overlap/gap analysis: what HoloHola covers (~30% of Madrigal), what is missing, and a prioritized fill queue | Use this to decide which new chapters and vocabQA items to seed next |
| `docs/see-it-and-say-it-roadmap.md` | Full lesson map of *See It and Say It in Spanish* — all 9 phases, all 5 Everyday Expressions pages, appendix catalogued, zero unsampled gaps | Use this as the authoritative source of truth for Madrigal's content sequence |
| `docs/madrigal-critique-and-improvements.md` | What we love, what we're keeping, and what HoloHola improves — 15 specific Madrigal limitations with HoloHola solutions, including ambiguous drawings, mono-color dialogues, missing ser/estar contrast, and more | Use this when designing new VocabQA cards, conversation strips, or chapter components |
| `docs/curriculum-strategy.md` | Overall curriculum philosophy, ACTFL level mapping, M1–M6 component definitions | Use this for framing new chapter types |

**Image generation style note:** The Madrigal-derived image style (bold B&W line art, single subject, white background) described in `docs/image-analysis-madrigal.md` is the ASPIRATION for VocabQA card images. The current HoloHola image library uses a soft watercolor children's book style (see Canonical Style below). These serve different use cases — the watercolor style is for Daniela's live teaching and the prop room; the Madrigal-style line art is the target for textbook VocabQA cards. Both can coexist.

This document is the master list of every visual asset we intend to pre-create for the platform. Assets fall into eight categories. The goal is not to be exhaustive on day one — it's to be deliberate: the right visuals for the words and concepts students absolutely must learn, generated ahead of time so Daniela can surface them instantly.

Visual assets live in the `visual_assets` table. Grammar/infographic SVGs are generated as React components per language (see 9-Language Matrix below). Prop room backgrounds live in `visual_environments`.

---

## 9-Language Textbook Component Coverage Matrix

**As of March 20, 2026** — all 9 languages have complete coverage across all 5 card types. Machine-readable version at `docs/textbook-component-coverage.json`, monitored by Lyra on every analysis run.

| Language | Grammar Cards | Cultural Cards | Phonetic Guides | Word Families | Canvas Vocab | Status |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **Spanish** | ✅ 46 (GrammarDiagrams + Infographics) | ✅ 8 | ✅ 9 | ✅ 12 | ✅ 8 types | ✅ Complete |
| **French** | ✅ 24 | ✅ 7 | ✅ 9 | ✅ 10 | ✅ 8 types | ✅ Complete |
| **Portuguese** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **German** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Italian** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Japanese** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Korean** | ✅ 24 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Mandarin** | ✅ 23 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Hebrew** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 12 | ✅ 8 types | ✅ Complete |

### Component Files Per Language

| Language | Grammar | Cultural | Phonetic | Word Families |
|----------|---------|----------|----------|---------------|
| Spanish | `TextbookGrammarDiagrams.tsx` + `TextbookInfographics.tsx` | `TextbookCulturalCards.tsx` | `TextbookPhoneticGuides.tsx` | `TextbookWordFamilies.tsx` |
| French | `TextbookFrenchGrammarCards.tsx` | `TextbookFrenchCulturalCards.tsx` | `TextbookFrenchPhoneticGuides.tsx` | `TextbookFrenchWordFamilies.tsx` |
| Portuguese | `TextbookPortugueseGrammarCards.tsx` | `TextbookPortugueseCulturalCards.tsx` | `TextbookPortuguesePhoneticGuides.tsx` | `TextbookPortugueseWordFamilies.tsx` |
| German | `TextbookGermanGrammarCards.tsx` | `TextbookGermanCulturalCards.tsx` | `TextbookGermanPhoneticGuides.tsx` | `TextbookGermanWordFamilies.tsx` |
| Italian | `TextbookItalianGrammarCards.tsx` | `TextbookItalianCulturalCards.tsx` | `TextbookItalianPhoneticGuides.tsx` | `TextbookItalianWordFamilies.tsx` |
| Japanese | `TextbookJapaneseGrammarCards.tsx` | `TextbookJapaneseCulturalCards.tsx` | `TextbookJapanesePhoneticGuides.tsx` | `TextbookJapaneseWordFamilies.tsx` |
| Korean | `TextbookKoreanGrammarCards.tsx` | `TextbookKoreanCulturalCards.tsx` | `TextbookKoreanPhoneticGuides.tsx` | `TextbookKoreanWordFamilies.tsx` |
| Mandarin | `TextbookMandarinGrammarCards.tsx` | `TextbookMandarinCulturalCards.tsx` | `TextbookMandarinPhoneticGuides.tsx` | `TextbookMandarinWordFamilies.tsx` |
| Hebrew | `TextbookHebrewGrammarCards.tsx` | `TextbookHebrewCulturalCards.tsx` | `TextbookHebrewPhoneticGuides.tsx` | `TextbookHebrewWordFamilies.tsx` |

**Canvas vocab cards** (weather, emotions, time, days/months, body, face, hand, temperature): all 9 languages in a single `TextbookCanvasCards.tsx` with per-language dataset branches.

**Wiring**: All card types route through `classifyGrammarType(lessonName, language)` in `ChapterIntroduction.tsx`, which returns the correct `GrammarChapterType` enum value → `GrammarChapterView` renders the matching card. Lesson reader content is now rendered **inline** in `VisualLessonCard` (modal removed March 20, 2026).

---

## Platform Status Snapshot

**Last audited:** March 20 2026 (session 5)

### Interactive Canvas — What's Built

The `SceneCanvas` component (client-side stage model) is **fully operational**. Phase 1 (scene/props/clock) shipped earlier; Phase 2 (grammar & body diagrams) shipped March 17, 2026 — all canvas capabilities are now complete. Bilingual label system added March 18, 2026.

| Capability | Status | Notes |
|---|---|---|
| `open_scene(environment)` | ✅ Built | Loads background, clears existing scene |
| `add_to_scene(prop, position)` | ✅ Built | Overlays transparent PNG at zone coordinates; `label` = target language, `native_label` = student's L1 — both shown stacked below prop |
| `remove_from_scene(prop)` | ✅ Built | Fades out and removes prop layer |
| `set_clock(time)` | ✅ Built | SVG analog clock with rotating hands |
| `clear_scene()` | ✅ Built | Removes all props, keeps background |
| `highlight_body_part(part)` | ✅ Built | Interactive SVG body diagram; `labels` + `native_labels` maps show bilingual badges — March 17, 2026 |
| `set_face_part(parts)` | ✅ Built | SVG face close-up (ears→hair→face→eyes→nose→mouth); bilingual badge cloud — March 17, 2026 |
| `set_hand_part(parts)` | ✅ Built | SVG dorsal hand (dorsal right, mirrored for left); bilingual badge cloud — March 17, 2026 |
| `fill_conjugation(row, value)` | ✅ Built | Live conjugation table fill-in with pronoun/ending highlighting — March 17, 2026 |
| `highlight_country(country)` | ✅ Built | SVG world map with country highlight + label — March 17, 2026 |
| `set_calendar(day, month)` | ✅ Built | SVG calendar with day highlight and month label — March 17, 2026 |
| Emotion face SVG | ✅ Built | Animated face expressions (happy, sad, angry, surprised, etc.) — March 17, 2026 |
| Thermometer SVG | ✅ Built | Animated mercury fill with °C/°F display — March 17, 2026 |
| Weather icon SVG set | ✅ Built | Full set: sunny, cloudy, rainy, stormy, snowy, windy, foggy — March 17, 2026 |
| **Bilingual label system** | ✅ Built | All props and diagrams show target-language label (bold) + native-language label (muted, below) simultaneously — March 18, 2026 |

### Image Library — What Exists

| Category | Records in DB | With actual images | Notes |
|---|---|---|---|
| Food vocabulary | 1,176 | 1,176 ✅ | Complete as of Mar 18 2026 — all menu items + basics (tacos, staples, etc.) generated |
| Scene canvas props | ~40 | ~40 | glass, fork, book, stethoscope, passport, etc. — all have real images |
| Vocabulary images — Novice Low (Section 1) | 85 cache keys | 55 images ✅ | Complete Mar 19 2026 — people, places, things, colors, adjectives, activities |
| Vocabulary images — Novice Mid People | 18 cache keys | 10 images ✅ | Complete Mar 19 2026 — family pairs, community professionals, extended family scene |
| Vocabulary images — Novice Mid Animals | 11 cache keys | 10 images ✅ | Complete Mar 19 2026 — perro, gato, pájaro, pez, caballo, vaca, oveja, oso, pato, conejo |
| Vocabulary images — Novice Mid Food | 14 cache keys | 12 images ✅ | Complete Mar 19 2026 — naranja, fresa, uva, sandía, limón, tomate, zanahoria, lechuga, papa/patata, cebolla, ajo, maíz |
| Vocabulary images — Novice Mid Clothing | 10 cache keys | 8 images ✅ | Complete Mar 19 2026 — camisa, pantalón, vestido, zapatos, sombrero, chaqueta, calcetines, falda |
| Vocabulary images — Novice Mid Activities | 8 cache keys | 8 images ✅ | Complete Mar 19 2026 — comprar, pagar, cocinar, limpiar, nadar, bailar, cantar, pintar |
| Vocabulary images — Novice Mid Adjectives | 23 cache keys | 10 images ✅ | Complete Mar 19 2026 — 10 contrast pairs (cerca/lejos, alto/bajo, rápido/lento, pesado/ligero, joven/viejo, feliz/triste, fácil/difícil, ruidoso/tranquilo, oscuro/claro, duro/suave) |
| Time/weather/numbers (Section 2) | 0 | 0 | Clock + weather handled by SVG components; static reference cards not started |
| Cultural infographics (Section 5) | 0 | 0 | Not started |

**Generation pipeline (as of Mar 19 2026):** All images — seeded library and Daniela's live fallback — use **DALL-E 3** with the **canonical style** below. Library lookup is instant (cache key `vocab_spanish_{word}`); fallback generates on demand and saves to cache automatically.

**Canonical illustration style (updated Mar 19 2026):**
- Objects/props: `soft watercolor children's book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture, object centred and prominent on a clean pure white background, no background elements, clear and recognisable silhouette, language learning educational quality`
- Scenes/activities with characters: `soft watercolor children's book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture, friendly expressive characters, no visible text or labels on anything, language learning educational context, suitable for all ages`
- **IMPORTANT:** Never use "pencil outlines" — DALL-E interprets this literally and adds physical pencils to the image. Use "clean fine ink outlines" instead.
- Always append: `ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.`
- Model: **DALL-E 3**, size **1024×1024**, quality **standard**

**Novice Mid complete:** 58 images total (10 people + 10 animals + 12 food + 8 clothing + 8 activities + 10 adjective pairs), covering 84 cache keys. All seeded in DB and uploaded to object storage.

**Novice High complete:** 23 images (9 places + 10 transport + 4 professions). All seeded in DB and uploaded to object storage.

**Novice Low people refreshed Mar 19 2026:** All 7 Novice Low people images regenerated in canonical children's book style (v=1). Neighbour (vecino/a) added to Novice Mid.

**Intermediate Low complete Mar 19 2026:** 12 images — 1 body diagram (covers 15 body-part cache keys), 4 health items, 7 furniture/home items. All seeded in DB and uploaded to object storage.

**Intermediate Mid complete Mar 19 2026:** 20 images — 12 nature scenes (árbol → estrella), 8 emotion portraits (enojado → aburrido). All seeded in DB and uploaded to object storage.

**Section 2 (Weather + Time) complete Mar 19 2026:** 13 images — 9 weather scenes, 4 time reference cards (day parts, days of week, months circle, four seasons). All seeded in DB.

**Numbers complete Mar 19 2026:** 7 number cards (0-10, 11-20, tens grid, hundreds/thousands, ordinals, price/currency, phone/address). Covers cero → millón and related keys.

**Specific fixes Mar 19 2026:** avión (v=2, correct 2 wings), metro (v=2, no pencil artifacts), nervioso (v=2, culturally neutral), meses (v=2, pure visual mandala), días de semana (v=2, pure activity scenes, no text).

**ALL DALL-E WORK COMPLETE.** ~200 images total. Remaining ⬜ items are React/SVG grammar diagrams (Sections 3–7) — these are code components, not DALL-E images, and will be built as a separate coding task.

---

## Philosophy

Language learning has two visual use cases:

1. **Word → Image**: Student hears or reads a word and needs to see what it looks like. This is vocabulary acquisition. Images here must be clean, consistent, and instantly recognizable — no ambiguity.

2. **Concept → Diagram**: Student is trying to understand HOW the language works. No image of a cup teaches "preterite vs imperfect." These need diagrams — timelines, maps, tables — that make abstract grammar visible and spatial.

Both live in this roadmap. Neither is a substitute for the other.

**Personal vocabulary** (words students guide Daniela into teaching based on their own interests) is intentionally NOT in this list. Those generate on-demand via `generate_visual`. This list is the required core — the vocabulary every student at every level must know, regardless of what they personally care about.

---

## Content Policy
**Decided: April 4, 2026**

These rules govern every image generation and routing decision going forward. They exist to balance educational quality, maintenance cost, and cross-language consistency.

### Rule 1 — Shared vs. Language-Specific Images

**The dividing line is simple: does the image contain people?**

| Content type | Policy | Rationale |
|---|---|---|
| Inanimate objects (pen, chair, book, car, food items) | **Shared** | A pen is a pen in every country |
| Animals, plants, nature | **Shared** | Universally recognizable |
| Any image containing people (greetings, actions, professions, daily life) | **Language-specific** | Characters should reflect the culture being learned |
| Culture-specific objects that only exist in one culture | **Language-specific** | A croissant, an onigiri, a baguette |

**Why this rule:** Students should see characters that look like native speakers of the language they are learning. A French student should see Juliette saying "Bonjour," not Daniela. The rule is easy to apply — if there's a person in the frame, it belongs to that language.

### Rule 2 — The Spanish Baseline Problem

Spanish was chosen as the image baseline for pragmatic reasons (first language built), not design ones. This means all shared images currently feature Spanish-coded characters (Daniela, Marco). For students of other languages, the result is a predominantly Spanish-looking library with one or two language-specific images mixed in — which is mildly inconsistent but not educationally harmful.

**Long-term goal:** Shared images should be regenerated to be character-neutral (objects, hands, silhouettes, non-ethnically-coded figures) so the shared library doesn't read as Spanish. This is a non-urgent one-time re-generation task, not a blocker for current development.

**Short-term stance:** Accept the inconsistency. Students see only one language and are unlikely to notice.

### Rule 3 — Images vs. Grammar Tables, and Noun/Verb Pairing

**Do not generate a separate image for each conjugated verb form.** This creates duplicate images, wastes DALL-E budget, and teaches nothing that a table cannot teach better.

| Vocabulary type | Correct visual treatment |
|---|---|
| Infinitive verb (comer, dormir, hablar) | One image of the action |
| Conjugated form (yo como, je mange, ich esse) | Conjugation table — not a separate image |
| Verb paradigm (AR/ER/IR endings) | Grammar diagram / conjugation table |
| Phrase or sentence starter (Me gusta..., J'aimerais...) | No image needed — pattern card or dialog example |

**Noun + Verb pairing:** Where a noun and its related verb are clearly the same concept, use a single image for both and register it under both keys. Do not generate two images.

Examples:
- `desayuno` (breakfast) and `desayunar` (to eat breakfast) → one image, two keys
- `cena` (dinner) and `cenar` (to have dinner) → one image, two keys
- `almuerzo` (lunch) and `almorzar` (to have lunch) → one image, two keys
- `baño` (bath/bathroom) and `bañarse` (to bathe) → same image works for both

**The test:** If you can look at the image and it would correctly illustrate both the noun and the verb without ambiguity, register both keys to the same image. Only generate a second image when the noun and the action are visually distinct.

The existing duplicate pairs (e.g. "to eat" + "I eat" showing the same image twice) should be collapsed to a single infinitive image + a conjugation table.

### Rule 4 — When No Image Is Better Than a Wrong Image

A placeholder is preferable to a misleading image. Specific situations where skipping the image is the right choice:
- The word is abstract (justice, freedom, democracy)
- The word is a grammatical function word (the, is, but, of)
- The word's meaning is best shown through a conjugation table, timeline, or diagram
- The word is a culturally-specific phrase where no image would capture the nuance

The SVG/grammar classifier in the resolver already handles some of this. When in doubt, route to a grammar component rather than generating a generic DALL-E fallback.

### Rule 5 — Prompt Templating (Character Substitution) for Language-Specific Images

**Decided: April 5, 2026**

Spanish SCENE_OVERRIDE prompts in `vocab-image-seed-service.ts` are written as **templates**, not one-off prompts. Instead of hardcoding "a young Spanish woman with dark hair," they reference `CHAR.ES.primary` — a named character profile object. Each language has its own profile:

| Key | Character | Description |
|-----|-----------|-------------|
| `CHAR.ES` | Daniela / Marco | Spanish-coded characters (dark hair, Mediterranean features) |
| `CHAR.FR` | Juliette / Antoine | French-coded characters (lighter features, Parisian styling) |
| `CHAR.DE` | Anna / Stefan | German-coded characters |
| `CHAR.IT` | Giulia / Luca | Italian-coded characters |
| `CHAR.PT` | Sofia / Rafael | Brazilian Portuguese-coded characters |
| `CHAR.JA` | Yuki / Kenji | Japanese-coded characters |
| `CHAR.KO` | Soo-Jin / Ji-Ho | Korean-coded characters |
| `CHAR.ZH` | Mei / Wei | Mandarin Chinese-coded characters |
| `CHAR.HE` | Noa / Eitan | Israeli Hebrew-coded characters |

**How it works:** To generate a language-specific version of a Spanish scene image, swap `CHAR.ES.primary` → `CHAR.FR.primary` in the prompt text. Everything else (scene description, watercolor style, pen wash technique, scene layout, SCENE_STYLE lock) stays identical. The only change is the character reference.

**This is called:** Character-substitution prompt templating (similar to "persona swap" in AI image generation literature; related concepts: image prompt templating, character-consistent generation).

**Coverage audit needed:** Before running generation for non-Spanish languages, a full audit must determine:
1. How many language-specific scene images currently exist for each of the 8 non-Spanish languages
2. Which Spanish SCENE_OVERRIDE prompts are fully templateable (person in scene → swap character)
3. Which prompts require scene-level changes beyond character swap (e.g., a Spanish plaza background may need to become a Japanese street scene)
4. Estimated DALL-E budget for the full non-Spanish generation run

**Audit status:** ⬜ Not started — estimated ~200-300 new images across all 8 non-Spanish languages for scenes that currently have Spanish characters only.

---

## Section 1 — Core Vocabulary Images (by ACTFL Level)

Format: illustrated watercolor style, same as the current prop library.
Organization: thematic clusters. A student at Novice Low needs the Novice Low cluster plus everything below.

### Novice Low — Survival Essentials

**People**

*Grouping note: several people words are ambiguous as solo images (a woman alone could be madre, hermana, mujer, or amiga). Group and pair images are used where the relationship itself is the meaning.*

| Image | Covers | Spanish | Status | Notes |
|-------|--------|---------|--------|-------|
| Familia (group portrait) | mother, father, brother, sister, baby | madre, padre, hermano, hermana, bebé | ✅ Mar 19 2026 | `vocab_people_familia.png` — regenerated in children's book style v=1 |
| Los niños (pair) | boy, girl | niño, niña | ✅ Mar 19 2026 | `vocab_people_ninos.png` — regenerated v=1 |
| Los amigos (pair greeting) | friend (m/f) | amigo, amiga | ✅ Mar 19 2026 | `vocab_people_amigos.png` — regenerated v=1 |
| El hombre (solo) | man | hombre | ✅ Mar 19 2026 | `vocab_people_hombre.png` — regenerated v=1 |
| La mujer (solo) | woman | mujer | ✅ Mar 19 2026 | `vocab_people_mujer.png` — regenerated v=1 |
| El/la profesor/a (solo) | teacher | profesor/a | ✅ Mar 19 2026 | `vocab_people_profesor.png` — regenerated v=1 |
| El/la estudiante (solo) | student | estudiante | ✅ Mar 19 2026 | `vocab_people_estudiante.png` — regenerated v=1 |

**Places**

*Note: environment bg = used by scene canvas. These standalone images serve `show_image` and textbook vocab cards — different use case, both needed.*

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| house/home | casa | ✅ Mar 18 2026 | `vocab_places_casa.png` |
| school | escuela | ✅ Mar 18 2026 | `vocab_places_escuela.png` |
| classroom | aula | ✅ Mar 18 2026 | `vocab_places_aula.png` — also seeded: salón, clase |
| restaurant | restaurante | ✅ Mar 18 2026 | `vocab_places_restaurante.png` |
| park | parque | ✅ Mar 18 2026 | `vocab_places_parque.png` |
| hospital | hospital | ✅ Mar 18 2026 | `vocab_places_hospital.png` — exterior |
| supermarket | supermercado | ✅ Mar 18 2026 | `vocab_places_supermercado.png` — also seeded: tienda, mercado |
| bathroom | baño | ✅ Mar 18 2026 | `vocab_places_bano.png` — also seeded: servicio, lavabo |
| bedroom | dormitorio | ✅ Mar 18 2026 | `vocab_places_dormitorio.png` — also seeded: cuarto, habitación |
| kitchen | cocina | ✅ Mar 18 2026 | `vocab_places_cocina.png` |

**Things — Classroom/Home**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| book | libro | ✅ | in prop library |
| backpack | mochila | ✅ | in prop library |
| pencil | lápiz | ✅ Mar 19 2026 | `vocab_things_lapiz.png` |
| pen | bolígrafo / pluma | ✅ Mar 19 2026 | `vocab_things_boligrafo.png` — dual keys: bolígrafo (formal) + pluma (common spoken) |
| desk/table | mesa | ✅ Mar 19 2026 | `vocab_things_mesa.png` — also seeded: escritorio |
| chair | silla | ✅ Mar 19 2026 | `vocab_things_silla.png` |
| door | puerta | ✅ Mar 19 2026 | `vocab_things_puerta.png` |
| window | ventana | ✅ Mar 19 2026 | `vocab_things_ventana.png` |
| phone | teléfono | ✅ | cell_phone in prop library |
| water | agua | ✅ Mar 19 2026 | `vocab_things_agua.png` |

**Things — Food Basics**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| bread | pan | ✅ | bread_basket in prop library |
| milk | leche | ✅ Mar 19 2026 | `vocab_food_leche.png` |
| apple | manzana | ✅ | in prop library |
| banana | plátano/banana | ✅ | in prop library |
| egg | huevo | ✅ Mar 19 2026 | `vocab_food_huevo.png` |
| rice | arroz | ✅ Mar 19 2026 | `vocab_food_arroz.png` |
| coffee | café | ✅ | in prop library (multiple) |
| water | agua | ✅ | glass in prop library |

**Colors**

*Format: filled color swatch circle with the Spanish word below. Simple, flat, unambiguous — no illustrated object needed. A red swatch IS the concept.*

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| red | rojo | ✅ Mar 19 2026 | `vocab_color_rojo.png` |
| blue | azul | ✅ Mar 19 2026 | `vocab_color_azul.png` |
| yellow | amarillo | ✅ Mar 19 2026 | `vocab_color_amarillo.png` |
| green | verde | ✅ Mar 19 2026 | `vocab_color_verde.png` |
| orange | anaranjado/naranja | ✅ Mar 19 2026 | `vocab_color_anaranjado.png` — dual keys: anaranjado + naranja_color |
| purple | morado/violeta | ✅ Mar 19 2026 | `vocab_color_morado.png` — dual keys: morado (Latin Am.) + violeta (Spain) |
| pink | rosa/rosado | ✅ Mar 19 2026 | `vocab_color_rosa.png` — dual keys: rosa + rosado |
| brown | marrón/café | ✅ Mar 19 2026 | `vocab_color_marron.png` — dual keys: marron + cafe_color |
| black | negro | ✅ Mar 19 2026 | `vocab_color_negro.png` |
| white | blanco | ✅ Mar 19 2026 | `vocab_color_blanco.png` |
| grey | gris | ✅ Mar 19 2026 | `vocab_color_gris.png` |

**Adjectives — Size & Temperature (Novice Low)**

*Format: contrast pairs on one card — same object shown twice at different sizes, or two objects with contrasting temperatures. The pair format makes the meaning unambiguous without needing a sentence.*

| Pair | Spanish | Status | Notes |
|------|---------|--------|-------|
| big / small | grande / pequeño | ✅ Mar 19 2026 | `vocab_adj_grande_pequeno.png` — elephant vs mouse; dual keys |
| hot / cold | caliente / frío | ✅ Mar 19 2026 | `vocab_adj_caliente_frio.png` — steaming cup vs iced glass; dual keys |
| good / bad | bueno / malo | ✅ Mar 19 2026 | `vocab_adj_bueno_malo.png` — thumbs up vs down; dual keys |
| open / closed | abierto / cerrado | ✅ Mar 19 2026 | `vocab_adj_abierto_cerrado.png` — door both ways; dual keys |
| full / empty | lleno / vacío | ✅ Mar 19 2026 | `vocab_adj_lleno_vacio.png` — full vs empty glass; dual keys |
| clean / dirty | limpio / sucio | ✅ Mar 19 2026 | `vocab_adj_limpio_sucio.png` — clean plate vs muddy boot; dual keys |
| new / old | nuevo / viejo | ✅ Mar 19 2026 | `vocab_adj_nuevo_viejo.png` — shiny sneaker vs worn shoe; dual keys |

**Activities (simple verbs — illustrated as action)**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| to eat | comer | ✅ Mar 19 2026 | `vocab_act_comer.png` |
| to drink | beber | ✅ Mar 19 2026 | `vocab_act_beber.png` — dual keys: beber + tomar |
| to sleep | dormir | ✅ Mar 19 2026 | `vocab_act_dormir.png` |
| to read | leer | ✅ Mar 19 2026 | `vocab_act_leer.png` |
| to write | escribir | ✅ Mar 19 2026 | `vocab_act_escribir.png` |
| to walk | caminar | ✅ Mar 19 2026 | `vocab_act_caminar.png` |
| to run | correr | ✅ Mar 19 2026 | `vocab_act_correr.png` |
| to talk | hablar | ✅ Mar 19 2026 | `vocab_act_hablar.png` |
| to listen | escuchar | ✅ Mar 19 2026 | `vocab_act_escuchar.png` — dual keys: escuchar + oír |
| to play | jugar | ✅ Mar 19 2026 | `vocab_act_jugar.png` |

---

### Novice Mid — Building Blocks

**People (extended family + community)**

*Strategy: family members paired as dual-key images (same approach as Novice Low). Community helpers shown in full professional context — the setting carries the meaning. Bonus extended family gathering scene for multi-word teaching.*

| Image | Covers | Spanish | Status | Notes |
|-------|--------|---------|--------|-------|
| Abuelos (pair) | grandfather, grandmother | abuelo, abuela | ✅ Mar 19 2026 | `vocab_ppl_abuelos.png` — dual keys: abuelo + abuela |
| Tíos (pair) | uncle, aunt | tío, tía | ✅ Mar 19 2026 | `vocab_ppl_tios.png` — dual keys: tío + tía |
| Primos (pair) | cousin m/f | primo, prima | ✅ Mar 19 2026 | `vocab_ppl_primos.png` — dual keys: primo + prima |
| Médico/a | doctor | médico/a | ✅ Mar 19 2026 | `vocab_ppl_medico.png` — in clinic; also seeded: médica, doctor |
| Enfermero/a | nurse | enfermero/a | ✅ Mar 19 2026 | `vocab_ppl_enfermero.png` — in hospital; dual keys: enfermero + enfermera |
| Policía | police officer | policía | ✅ Mar 19 2026 | `vocab_ppl_policia.png` — in uniform on city street |
| Cocinero/a | cook / chef | cocinero/a | ✅ Mar 19 2026 | `vocab_ppl_cocinero.png` — in kitchen with chef's hat; dual keys |
| Bombero/a | firefighter | bombero/a | ✅ Mar 19 2026 | `vocab_ppl_bombero.png` — by fire truck in full gear; dual keys |
| Dentista | dentist | dentista | ✅ Mar 19 2026 | `vocab_ppl_dentista.png` — in dental office |
| Familia extendida (scene) | extended family gathering | abuelo, abuela, tío, tía, primo, prima + more | ✅ Mar 19 2026 | `vocab_ppl_familia_extendida.png` — multi-chip scene; key: vocab_spanish_familia_extendida |
| Vecino/a | neighbor | vecino/a | ✅ Mar 19 2026 | `vocab_ppl_vecino.png` — dual keys: vecino + vecina |

**Animals**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| dog | perro | ✅ Mar 19 2026 | `vocab_animal_perro.png` |
| cat | gato | ✅ Mar 19 2026 | `vocab_animal_gato.png` |
| bird | pájaro | ✅ Mar 19 2026 | `vocab_animal_pajaro.png` — key: pajaro |
| fish | pez | ✅ Mar 19 2026 | `vocab_animal_pez.png` — in water; also seeded: pescado |
| horse | caballo | ✅ Mar 19 2026 | `vocab_animal_caballo.png` |
| cow | vaca | ✅ Mar 19 2026 | `vocab_animal_vaca.png` |
| sheep | oveja | ✅ Mar 19 2026 | `vocab_animal_oveja.png` |
| bear | oso | ✅ Mar 19 2026 | `vocab_animal_oso.png` |
| duck | pato | ✅ Mar 19 2026 | `vocab_animal_pato.png` |
| rabbit | conejo | ✅ Mar 19 2026 | `vocab_animal_conejo.png` |

**Fruits & Vegetables**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| orange | naranja | ✅ Mar 19 2026 | `vocab_food_naranja.png` |
| strawberry | fresa | ✅ Mar 19 2026 | `vocab_food_fresa.png` — key: fresa |
| grape | uva | ✅ Mar 19 2026 | `vocab_food_uva.png` — cluster |
| watermelon | sandía | ✅ Mar 19 2026 | `vocab_food_sandia.png` — key: sandia |
| lemon | limón | ✅ Mar 19 2026 | `vocab_food_limon.png` — key: limon |
| tomato | tomate | ✅ Mar 19 2026 | `vocab_food_tomate.png` |
| carrot | zanahoria | ✅ Mar 19 2026 | `vocab_food_zanahoria.png` |
| lettuce | lechuga | ✅ Mar 19 2026 | `vocab_food_lechuga.png` |
| potato | papa/patata | ✅ Mar 19 2026 | `vocab_food_papa.png` — dual keys: papa + patata |
| onion | cebolla | ✅ Mar 19 2026 | `vocab_food_cebolla.png` |
| garlic | ajo | ✅ Mar 19 2026 | `vocab_food_ajo.png` |
| corn | maíz | ✅ Mar 19 2026 | `vocab_food_maiz.png` — key: maiz |

**Clothing**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| shirt | camisa | ✅ Mar 19 2026 | `vocab_cloth_camisa.png` |
| pants/trousers | pantalón | ✅ Mar 19 2026 | `vocab_cloth_pantalon.png` — key: pantalon |
| dress | vestido | ✅ Mar 19 2026 | `vocab_cloth_vestido.png` |
| shoes | zapatos | ✅ Mar 19 2026 | `vocab_cloth_zapatos.png` — pair |
| hat | sombrero | ✅ Mar 19 2026 | `vocab_cloth_sombrero.png` |
| jacket | chaqueta | ✅ Mar 19 2026 | `vocab_cloth_chaqueta.png` |
| socks | calcetines | ✅ Mar 19 2026 | `vocab_cloth_calcetines.png` |
| skirt | falda | ✅ Mar 19 2026 | `vocab_cloth_falda.png` |

**Activities**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| to buy | comprar | ✅ Mar 19 2026 | `vocab_act_comprar.png` |
| to pay | pagar | ✅ Mar 19 2026 | `vocab_act_pagar.png` |
| to cook | cocinar | ✅ Mar 19 2026 | `vocab_act_cocinar.png` |
| to clean | limpiar | ✅ Mar 19 2026 | `vocab_act_limpiar.png` |
| to swim | nadar | ✅ Mar 19 2026 | `vocab_act_nadar.png` |
| to dance | bailar | ✅ Mar 19 2026 | `vocab_act_bailar.png` — v=5 style fix |
| to sing | cantar | ✅ Mar 19 2026 | `vocab_act_cantar.png` — v=5 style fix |
| to paint | pintar | ✅ Mar 19 2026 | `vocab_act_pintar.png` |

**Adjectives — Spatial & Descriptive (Novice Mid)**

*Format: contrast pairs. Near/far use distance from a reference point (a door, a tree). Tall/short use two versions of the same figure. Fast/slow use motion blur or trail lines.*

| Pair | Spanish | Status | Notes |
|------|---------|--------|-------|
| near / far | cerca / lejos | ✅ Mar 19 2026 | `vocab_adj_cerca_lejos.png` — dual keys |
| tall / short | alto / bajo | ✅ Mar 19 2026 | `vocab_adj_alto_bajo.png` — dual keys |
| fast / slow | rápido / lento | ✅ Mar 19 2026 | `vocab_adj_rapido_lento.png` — dual keys |
| heavy / light | pesado / ligero | ✅ Mar 19 2026 | `vocab_adj_pesado_ligero.png` — dual keys |
| young / old | joven / viejo | ✅ Mar 19 2026 | `vocab_adj_joven_viejo_personas.png` — dual keys (person-focused) |
| happy / sad | feliz / triste | ✅ Mar 19 2026 | `vocab_adj_feliz_triste.png` — v=5 style fix; dual keys |
| easy / difficult | fácil / difícil | ✅ Mar 19 2026 | `vocab_adj_facil_dificil.png` — dual keys |
| loud / quiet | ruidoso / tranquilo | ✅ Mar 19 2026 | `vocab_adj_ruidoso_tranquilo.png` — dual keys |
| dark / light | oscuro / claro | ✅ Mar 19 2026 | `vocab_adj_oscuro_claro.png` — dual keys |
| hard / soft | duro / suave | ✅ Mar 19 2026 | `vocab_adj_duro_suave.png` — v=5 style fix; dual keys |

---

### Novice High — Travel & Social Life

**Places (travel)**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| hotel | hotel | ✅ Mar 19 2026 | `vocab_place_hotel.png` |
| airport | aeropuerto | ✅ Mar 19 2026 | `vocab_place_aeropuerto.png` |
| train station | estación de tren | ✅ Mar 19 2026 | `vocab_place_estacion_tren.png` — keys: estacion_tren + estacion |
| beach | playa | ✅ Mar 19 2026 | `vocab_place_playa.png` |
| mountain | montaña | ✅ Mar 19 2026 | `vocab_place_montana.png` — keys: montana + montaña |
| museum | museo | ✅ Mar 19 2026 | `vocab_place_museo.png` |
| pharmacy | farmacia | ✅ Mar 19 2026 | `vocab_place_farmacia.png` |
| bank | banco | ✅ Mar 19 2026 | `vocab_place_banco.png` |
| library | biblioteca | ✅ Mar 19 2026 | `vocab_place_biblioteca.png` |

**Transportation**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| bus | autobús | ✅ Mar 19 2026 | `vocab_trans_autobus.png` — keys: autobus + autobús |
| train | tren | ✅ Mar 19 2026 | `vocab_trans_tren.png` |
| airplane | avión | ✅ Mar 19 2026 | `vocab_trans_avion.png` — keys: avion + avión |
| bicycle | bicicleta | ✅ Mar 19 2026 | `vocab_trans_bicicleta.png` |
| car | coche/carro | ✅ Mar 19 2026 | `vocab_trans_coche.png` — keys: coche + carro + auto |
| boat | barco | ✅ Mar 19 2026 | `vocab_trans_barco.png` |
| taxi | taxi | ✅ Mar 19 2026 | `vocab_trans_taxi.png` |
| subway/metro | metro | ✅ Mar 19 2026 | `vocab_trans_metro.png` — keys: metro + subte |
| motorcycle | motocicleta | ✅ Mar 19 2026 | `vocab_trans_motocicleta.png` — keys: motocicleta + moto |
| walking (on foot) | a pie | ✅ Mar 19 2026 | `vocab_trans_a_pie.png` — keys: a_pie + caminar |

**Professions**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| waiter/waitress | camarero/a | ✅ Mar 19 2026 | `vocab_prof_camarero.png` — keys: camarero + camarera + mesero |
| shop clerk | dependiente/a | ✅ Mar 19 2026 | `vocab_prof_dependiente.png` — keys: dependiente + dependienta |
| firefighter | bombero/a | ✅ Mar 19 2026 | Moved up to Novice Mid — `vocab_ppl_bombero.png` |
| journalist | periodista | ✅ Mar 19 2026 | `vocab_prof_periodista.png` |
| lawyer | abogado/a | ✅ Mar 19 2026 | `vocab_prof_abogado.png` — keys: abogado + abogada |

---

### Intermediate Low — Daily Life & Body

**Body Parts**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| head | cabeza | ✅ Mar 19 2026 | `vocab_body_diagram.png` — all body terms seeded to this one diagram |
| arm | brazo | ✅ Mar 19 2026 | → body diagram |
| leg | pierna | ✅ Mar 19 2026 | → body diagram |
| hand | mano | ✅ Mar 19 2026 | → body diagram |
| foot | pie | ✅ Mar 19 2026 | → body diagram |
| eye | ojo | ✅ Mar 19 2026 | → body diagram |
| ear | oído/oreja | ✅ Mar 19 2026 | → body diagram — dual keys: oido + oreja |
| mouth | boca | ✅ Mar 19 2026 | → body diagram |
| nose | nariz | ✅ Mar 19 2026 | → body diagram |
| heart | corazón | ✅ Mar 19 2026 | → body diagram — key: corazon |
| stomach | estómago | ✅ Mar 19 2026 | → body diagram — key: estomago |
| back | espalda | ✅ Mar 19 2026 | → body diagram |
| knee | rodilla | ✅ Mar 19 2026 | → body diagram |
| shoulder | hombro | ✅ Mar 19 2026 | → body diagram |

*Note: Body diagram image (full outline labeled in Spanish) — 1 image seeded under cuerpo + all 14 body part keys.*

**Health**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| pill/tablet | pastilla | ✅ Mar 19 2026 | `vocab_health_pastilla.png` — also: tableta, comprimido |
| injection/shot | inyección | ✅ Mar 19 2026 | `vocab_health_inyeccion.png` — also: vacuna, jeringa |
| prescription | receta médica | ✅ | prescription_pad in prop library |
| thermometer | termómetro | ✅ | in prop library |
| bandage | venda | ✅ Mar 19 2026 | `vocab_health_venda.png` — also: vendaje, curita |
| appointment | cita médica | ✅ Mar 19 2026 | `vocab_health_cita_medica.png` — also: cita, consulta |

**Home Rooms & Furniture**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| living room | sala de estar | ✅ | env background in prop library |
| kitchen | cocina | ✅ | env background in prop library |
| bedroom | dormitorio | ✅ | env background in prop library |
| bathroom | baño | ✅ | env background in prop library |
| garden/yard | jardín | ✅ Mar 19 2026 | `vocab_home_jardin.png` — also: patio |
| bed | cama | ✅ Mar 19 2026 | `vocab_home_cama.png` |
| sofa | sofá | ✅ Mar 19 2026 | `vocab_home_sofa.png` — also: divan, canapé |
| wardrobe | armario | ✅ Mar 19 2026 | `vocab_home_armario.png` — also: closet, guardarropa |
| refrigerator | refrigerador | ✅ Mar 19 2026 | `vocab_home_refrigerador.png` — also: nevera, frigorifico, heladera |
| stove | estufa/cocina | ✅ Mar 19 2026 | `vocab_home_estufa.png` — also: hornilla |
| washing machine | lavadora | ✅ Mar 19 2026 | `vocab_home_lavadora.png` — also: lavarropas |

---

### Intermediate Mid — Broader World

**Nature & Environment**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| tree | árbol | ✅ Mar 19 2026 | `vocab_nature_arbol.png` |
| flower | flor | ✅ Mar 19 2026 | `vocab_nature_flor.png` |
| river | río | ✅ Mar 19 2026 | `vocab_nature_rio.png` |
| lake | lago | ✅ Mar 19 2026 | `vocab_nature_lago.png` |
| sea | mar | ✅ Mar 19 2026 | `vocab_nature_mar.png` — also: oceano |
| forest | bosque | ✅ Mar 19 2026 | `vocab_nature_bosque.png` — also: selva |
| desert | desierto | ✅ Mar 19 2026 | `vocab_nature_desierto.png` |
| volcano | volcán | ✅ Mar 19 2026 | `vocab_nature_volcan.png` |
| cloud | nube | ✅ Mar 19 2026 | `vocab_nature_nube.png` — weather section also |
| sun | sol | ✅ Mar 19 2026 | `vocab_nature_sol.png` |
| moon | luna | ✅ Mar 19 2026 | `vocab_nature_luna.png` |
| star | estrella | ✅ Mar 19 2026 | `vocab_nature_estrella.png` |

**Emotions**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| happy | feliz/alegre | ✅ Mar 19 2026 | `vocab_adj_feliz_triste.png` — dual keys (paired with sad) |
| sad | triste | ✅ Mar 19 2026 | → feliz/triste pair image |
| angry | enojado/enfadado | ✅ Mar 19 2026 | `vocab_emo_enojado.png` — also: enfadado, molesto |
| afraid | asustado | ✅ Mar 19 2026 | `vocab_emo_asustado.png` — also: atemorizado |
| surprised | sorprendido | ✅ Mar 19 2026 | `vocab_emo_sorprendido.png` — also: asombrado |
| embarrassed | avergonzado | ✅ Mar 19 2026 | `vocab_emo_avergonzado.png` — NOT embarazada (false cognate) |
| tired | cansado | ✅ Mar 19 2026 | `vocab_emo_cansado.png` — also: agotado |
| excited | emocionado | ✅ Mar 19 2026 | `vocab_emo_emocionado.png` — also: entusiasmado |
| nervous | nervioso | ✅ Mar 19 2026 | `vocab_emo_nervioso.png` — also: ansioso |
| bored | aburrido | ✅ Mar 19 2026 | `vocab_emo_aburrido.png` — also: aburrimiento |

**Abstract Concepts (Intermediate+)**

These are better served by grammar/concept diagrams than simple images. See Section 3.

---

### Intermediate High & Advanced — Targeted Supplements

At these levels, personal vocabulary diverges significantly. Visual pre-generation is less valuable. Focus effort here on:
- **False cognate warning cards** (Section 7)
- **Word family maps** for high-frequency roots (Section 6)
- **Cultural infographics** for advanced thematic topics (Section 5)

---

## Section 2 — Numbers, Time & Weather

These are cross-ACTFL. A Novice Low student needs numbers 1–10. An Advanced student still references the calendar. These assets are used at every level and should be among the first generated.

### Numbers

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| 0–10 illustrated cards | Each numeral with illustrated objects (3 apples, 7 stars) | Novice Low | ✅ Mar 19 2026 | `vocab_num_0_10.png` — 12 cache keys (cero → diez) |
| 11–20 pattern card | Illustrated grouping showing the 11–19 pattern (diez + ...) | Novice Low | ✅ Mar 19 2026 | `vocab_num_11_20.png` — 11 cache keys (once → veinte) |
| Tens 10–100 grid | Visual grid: 10, 20, 30... 100 with pattern highlight | Novice Mid | ✅ Mar 19 2026 | `vocab_num_tens.png` — 10 cache keys (veinte → cien) |
| Hundreds & thousands | Scale card: 100, 500, 1,000, 10,000, 1,000,000 with real-world size anchors | Novice High | ✅ Mar 19 2026 | `vocab_num_hundreds.png` — keys: cien, quinientos, mil, millon |
| Ordinals 1st–10th | primero, segundo... with illustrated podium/ranking | Novice Mid | ✅ Mar 19 2026 | `vocab_num_ordinals.png` — keys: primero → quinto |
| Phone/address number reading | Illustrated guide to how numbers appear in real-life context (phone numbers said in pairs) | Intermediate Low | ✅ Mar 19 2026 | `vocab_num_phone.png` — keys: numero_telefono, direccion |
| Price & currency visual | Price tags in different currencies (pesos, soles, euros) with "¿Cuánto cuesta?" | Novice High | ✅ Mar 19 2026 | `vocab_num_currency.png` — keys: precio, cuanto_cuesta, peso, euro |

### Time

> **Note (March 17 2026):** The interactive SVG analog clock (`set_clock`) is fully built in `SceneCanvas`. For lesson interactions, Daniela uses the live clock — no static image needed. The static reference cards below are for the textbook/reference view and are lower priority as a result.

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Analog clock face — hour | Static reference card — live clock handles lesson use | Novice Low | ⬜ lower priority |
| Analog clock face — half/quarter | Static reference card | Novice Mid | ⬜ lower priority |
| Clock face — full grid | 12 clocks on one reference card | Novice Mid | ⬜ lower priority |
| AM/PM scene strip | Morning → afternoon → evening → night with time expressions | Novice Low | ✅ Mar 19 2026 | `vocab_time_partes_dia.png` — keys: manana, tarde, noche |
| Days of the week card | lunes → domingo visual strip (Mon-start calendar format) | Novice Low | ✅ Mar 19 2026 | `vocab_time_dias_semana.png` — all 7 days seeded |
| Months of the year card | enero → diciembre in circular calendar format | Novice Low | ✅ Mar 19 2026 | `vocab_time_meses.png` — all 12 months seeded |
| Four seasons illustrated | primavera, verano, otoño, invierno — each as a mini landscape scene | Novice Mid | ✅ Mar 19 2026 | `vocab_time_estaciones.png` — all 4 seasons seeded |
| Duration expressions timeline | hace dos años, desde hace, hace + time — horizontal timeline diagram | Intermediate Low | ⬜ React component — see Section 3 |
| Daily routine timeline | levantarse → desayunar → ... → acostarse shown as timeline with clock icons | Intermediate Low | ✅ Mar 19 2026 | `vocab_time_rutina_diaria.png` — 7 daily routine keys seeded |
| Tense timeline overview | past ←—— present ——→ future with verb tense markers | Intermediate Low | ⬜ React component — see Section 3 |

### Weather

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Sunny / soleado | Illustrated weather icon — warm scene | Novice Low | ✅ Mar 19 2026 | `vocab_weather_soleado.png` — keys: soleado, sol_tiempo |
| Cloudy / nublado | Illustrated | Novice Low | ✅ Mar 19 2026 | `vocab_weather_nublado.png` |
| Rainy / lluvioso | Illustrated — rain falling | Novice Low | ✅ Mar 19 2026 | `vocab_weather_lluvioso.png` — also: lluvia |
| Snowy / nevado | Illustrated | Novice Low | ✅ Mar 19 2026 | `vocab_weather_nevado.png` — also: nieve |
| Stormy / tormentoso | Lightning + dark clouds | Novice Mid | ✅ Mar 19 2026 | `vocab_weather_tormentoso.png` — also: tormenta |
| Windy / ventoso | Illustrated — leaves blowing | Novice Mid | ✅ Mar 19 2026 | `vocab_weather_ventoso.png` — also: viento |
| Foggy / neblinoso | Illustrated | Novice Mid | ✅ Mar 19 2026 | `vocab_weather_neblinoso.png` — also: niebla, neblina |
| Hot / caluroso | Illustrated — sun + person sweating | Novice Low | ✅ Mar 19 2026 | `vocab_weather_caluroso.png` — also: calor |
| Cold / frío | Illustrated — person in coat, breath visible | Novice Low | ✅ Mar 19 2026 | `vocab_weather_frio.png` — keys: frio_tiempo, frio_clima |
| Weather forecast card | Full illustrated forecast showing icons + temperature + day of week (como en la tele) | Novice High | ✅ Mar 19 2026 | `vocab_weather_forecast_card.png` — keys: pronostico, tiempo_semana |
| Temperature scale | Celsius + Fahrenheit comparison — common confusion for English-speaking learners | Novice High | ✅ Mar 19 2026 | `vocab_weather_temperature_scale.png` — keys: temperatura, celsius, grados |
| ¿Qué tiempo hace? reference card | All weather expressions on one card with their corresponding images | Novice Mid | ⬜ React component — see Section 3 |

---

## Section 3 — Grammar Structure Cards

These are diagrams, not photos. Generated as code (SVG or React components) — not DALL-E images. They live in `TextbookInfographics.tsx` or as dedicated reference card components.

### Verb Conjugation Tables

> **Note (March 18 2026):** The **live interactive conjugation canvas** (`init_conjugation` / `fill_conjugation` / `clear_conjugation`) is ✅ fully built — Daniela uses it in real-time during lessons. The items below are static **textbook reference cards** (pre-generated, always visible in the textbook without Daniela). These are separate deliverables and still ⬜.

| Asset | ACTFL Level | Format | Status |
|-------|-------------|--------|--------|
| Regular -AR pattern (hablar) | Novice Low | table with pronouns + endings highlighted | ✅ Mar 19 2026 | `ArVerbsCard` in TextbookGrammarDiagrams.tsx — trigger: "-ar verb", "hablar" |
| Regular -ER pattern (comer) | Novice Low | table | ✅ Mar 19 2026 | `ErVerbsCard` |
| Regular -IR pattern (vivir) | Novice Low | table | ✅ Mar 19 2026 | `IrVerbsCard` |
| SER (full present) | Novice Low | table — with usage examples | ✅ Mar 19 2026 | `SerCard` |
| ESTAR (full present) | Novice Low | table — with usage examples | ✅ Mar 19 2026 | `EstarCard` |
| TENER (full present) | Novice Low | table + tener expressions | ✅ Mar 19 2026 | `TenerCard` |
| IR (full present) | Novice Low | table + ir + a + infinitive | ✅ Mar 19 2026 | `IrCard` |
| QUERER / PODER / VOLVER | Novice Mid | stem-change boot diagram + tables | ✅ Mar 19 2026 | `StemChangeCard` with SVG boot diagram |
| HACER / PONER / TRAER | Novice Mid | go-verb pattern | ✅ Mar 19 2026 | `GoVerbsCard` with full –go inventory |
| SABER vs CONOCER | Novice High | split table with usage contrast | ✅ Mar 19 2026 | `SaberConocerCard` |
| Reflexive verbs (ducharse) | Intermediate Low | pronoun placement diagram | ✅ Mar 19 2026 | `ReflexiveVerbCard` with placement rules |
| Preterite regular (-ar/-er/-ir) | Intermediate Low | table | ✅ Mar 19 2026 | `PretRegularCard` |
| Preterite irregular (ser/ir/tener/hacer) | Intermediate Low | grouped table | ✅ Mar 19 2026 | `PretIrregularCard` |
| Imperfect (-ar/-er/-ir) | Intermediate Low | table | ✅ Mar 19 2026 | `ImperfectCard` |
| Future (regular + irregular stems) | Intermediate Mid | table with irregulars highlighted | ✅ Mar 19 2026 | `FutureCard` |
| Conditional | Intermediate Mid | table | ✅ Mar 19 2026 | `ConditionalCard` |
| Present subjunctive | Intermediate High | table with trigger phrases | ✅ Mar 19 2026 | `SubjunctiveCard` |
| Commands (tú / usted / ustedes) | Intermediate Mid | table | ✅ Mar 19 2026 | `CommandsCard` |

### Decision Trees & Comparison Cards

| Asset | ACTFL Level | Status |
|-------|-------------|--------|
| SER vs ESTAR decision tree | Novice Low — Novice Mid | ✅ Built Mar 18 2026 — `SerEstarCard` in TextbookInfographics.tsx |
| Preterite vs Imperfect contrast diagram | Intermediate Low | ✅ Built Mar 18 2026 — `PretImperfectCard` in TextbookInfographics.tsx |
| Por vs Para decision tree | Intermediate Mid | ✅ Built Mar 18 2026 — `PorParaCard` in TextbookInfographics.tsx |
| Indicative vs Subjunctive trigger map | Intermediate High | ⬜ future — covered partially by SubjunctiveCard trigger phrases |
| Direct vs Indirect object pronoun chart | Intermediate Low | ✅ Mar 19 2026 | `ObjectPronounChart` — full DO/IO table with placement rules |
| Object pronoun placement diagram | Intermediate Low | ✅ Mar 19 2026 | included in `ObjectPronounChart` |
| Gender & article overview (el/la/un/una) | Novice Low | ✅ Mar 19 2026 | `GenderArticleCard` — rules, examples, plural forms |
| Adjective agreement diagram | Novice Mid | ✅ Mar 19 2026 | `AdjAgreeCard` — m/f × s/pl grid + placement rules |
| Stem-change verb visual (e→ie, o→ue, e→i) | Novice High | ✅ Mar 19 2026 | `StemChangeCard` — SVG boot diagram + 2 full tables |
| -GO verbs pattern card | Novice High | ✅ Mar 19 2026 | `GoVerbsCard` — 8 –go verbs with yo forms |
| Diminutives & augmentatives | Intermediate Mid | ⬜ future |

### Sentence Structure Diagrams

| Asset | ACTFL Level | Status |
|-------|-------------|--------|
| Basic SVO sentence structure | Novice Low | ✅ Mar 19 2026 | `NegationQuestionsCard` — SVO + negation + 9 question words |
| Adjective placement rules | Novice Mid | ✅ Mar 19 2026 | included in `AdjAgreeCard` |
| Negative sentence construction | Novice Low | ✅ Mar 19 2026 | included in `NegationQuestionsCard` — no/nada/nadie/nunca |
| Question formation (¿Cómo/Qué/Dónde/Cuándo/Por qué?) | Novice Low | ✅ Mar 19 2026 | included in `NegationQuestionsCard` |
| Tú vs Usted — register chart | Novice Mid | ✅ Mar 19 2026 | `TuUstedCard` — contexts, examples, regional note |

---

## Section 4 — Preposition Maps

Two formats needed: a **static reference card** showing all prepositions at once, and **dynamic compositing** (already handled by the prop room compositor for spatial prepositions in lessons).

### Spatial Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Full spatial preposition map | Overhead/isometric room view with arrows and labels for: en, sobre, debajo de, delante de, detrás de, al lado de, entre, cerca de, lejos de, dentro de, fuera de, encima de | ✅ Mar 19 2026 | `SpatialPrepositionMap` — SVG room diagram + 9-cell reference grid |
| Simplified 6-preposition card | Just the six most confused ones (sobre/en/encima de, debajo de, delante de, detrás de) with clear illustrations | ✅ Mar 19 2026 | combined into `SpatialPrepositionMap` |

*Note: Dynamic compositing via `compose_visual_scene` (Mode B) handles on/under/beside in real lessons. These static cards are for reference and textbook.*

### Motion & Direction Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Motion preposition diagram | Map-style graphic showing: a (destination), hacia (toward), desde (from), hasta (as far as), por (through/along), para (toward/for) with arrows on streets/paths | ⬜ future |

### Temporal Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Temporal preposition timeline | Horizontal timeline showing: antes de, después de, durante, desde, hasta, hace + time — all placed on the timeline relative to "now" | ✅ Mar 19 2026 | `TemporalPrepositionTimeline` — SVG timeline + 6-entry reference |

---

## Section 5 — Cultural Infographics

These give language its context — students learn words in isolation without these.

> **Status: ✅ Complete (Mar 19 2026)** — All 9 built as React/SVG components in `TextbookCulturalCards.tsx`. Food guide (5 regions, 24 dishes) and gesture card (cultural awareness framing, 3 safe recognition gestures, regional variation warning) built without image generation — consistent with all other Section 5 cards.

| Asset | Description | ACTFL Level | Status |
|-------|-------------|-------------|--------|
| Spanish-speaking world map | 21 Spanish-speaking countries labeled with capitals and flags | Novice Mid | ✅ `SpanishWorldMapCard` |
| Hispanic food guide | Regional dishes by country/region — 5 zones, 24 dishes | Intermediate Low | ✅ `HispanicFoodGuideCard` |
| Festival & holiday calendar | Major celebrations across Spanish-speaking world by month | Intermediate Low | ✅ `FestivalCalendarCard` |
| Tú vs Usted register guide | When to use which — illustrated social situations | Novice Mid | ✅ `TuUstedCard` (Section 3) |
| Gesture guide | Cultural awareness card — body language variation + 3 safe recognition gestures | Intermediate Low | ✅ `GestureAwarenessCard` |
| Currency overview | Pesos (MX, AR, CL, CO, CU, DO, PH), Soles, Euros, Bolívares, Colones — with approximate exchange anchor | Novice High | ✅ `CurrencyReferenceCard` |
| Spanish dialect map | Spain, Mexico, Caribbean, Andean, River Plate, Central American — key vocabulary/pronunciation differences | Intermediate Mid | ✅ `DialectMapCard` |
| Family structure diagram | Visual family tree with all relationship terms labeled | Novice Mid | ✅ `FamilyTreeCard` |
| Formal greetings by country | Handshake, cheek kiss, both — illustrated regional etiquette | Novice High | ✅ `GreetingEtiquetteCard` |

---

## Section 6 — Word Family Maps

Visual clusters connecting a root verb to its noun, adjective, and adverb forms. These are especially powerful at Intermediate+ where students start using words productively across contexts.

> **Status: ✅ Complete (Mar 19 2026)** — All 12 word families built in `TextbookWordFamilies.tsx`. One reusable `WordFamilyCard` component with hub-and-spoke SVG layout + `resolveWordFamilyRoot()` resolver picks the correct family from the chapter title.

| Root | Family members | ACTFL Level | Status |
|------|---------------|-------------|--------|
| hablar | habla, hablante, hablador/a, hablado | Novice Low | ✅ |
| comer | comida, comedor, comestible, comilón | Novice Low | ✅ |
| vivir | vida, viviente, vivienda, vivo/a | Novice Low | ✅ |
| trabajar | trabajo, trabajador/a, trabajable | Novice Low | ✅ |
| dormir | sueño, dormilón, dormitorio | Novice Mid | ✅ |
| viajar | viaje, viajero/a | Novice High | ✅ |
| amar | amor, amante, amado/a, amoroso/a | Novice Mid | ✅ |
| escribir | escritura, escritor/a, escrito | Novice Mid | ✅ |
| leer | lectura, lector/a, leído | Novice Mid | ✅ |
| conocer | conocimiento, conocido/a, desconocer | Novice High | ✅ |
| poder | poder (n), poderoso/a, poderío | Intermediate Low | ✅ |
| pensar | pensamiento, pensador/a, pensativo/a | Intermediate Low | ✅ |

*Format: hub-and-spoke SVG with root verb at center; branches colour-coded — verb=blue, noun=orange, adjective=green, adverb=purple.*

---

## Section 7 — False Cognate Warning Cards

These are high-impact because they prevent actual embarrassing mistakes. Single card format: English word → wrong Spanish assumption → correct Spanish word → correct usage of the look-alike.

> **Two separate deliverables — same distinction as Section 3:**
> - **Static textbook cards** (`FalseCognateCard` / `FalseCognatesGrid` in `TextbookInfographics.tsx`) — ✅ Built Mar 18 2026. Auto-detected by `classifyGrammarType()` and rendered in `ChapterIntroduction.tsx`.
> - **Dynamic Daniela tool** (e.g. `highlight_false_cognate` — surface a warning card mid-lesson when Daniela detects a student is about to use a false cognate) — ⬜ Not yet built. Separate future feature.

| English | Wrong assumption | Actual Spanish | Look-alike | Look-alike means | Status |
|---------|-----------------|----------------|-----------|-----------------|--------|
| embarrassed | embarazada | avergonzado/a | embarazada | pregnant | ✅ |
| sensible | sensible | sensato/a | sensible | sensitive | ✅ |
| to realize | realizar | darse cuenta de | realizar | to accomplish/carry out | ✅ |
| actual | actual | real, verdadero | actual | current, present-day | ✅ |
| exit | éxito | salida | éxito | success | ✅ |
| library | librería | biblioteca | librería | bookstore | ✅ |
| to assist | asistir | ayudar | asistir | to attend | ✅ |
| to introduce | introducir | presentar | introducir | to insert | ✅ |
| carpet | carpeta | alfombra | carpeta | folder/binder | ✅ |
| constipated | constipado | estreñido | constipado | having a cold | ✅ |
| to molest | molestar | acosar | molestar | to bother/annoy | ✅ |
| parents | parientes | padres | parientes | relatives | ✅ |

---

## Section 8 — Phonetic / Pronunciation Guides

Visual mouth-position or phoneme guides for sounds that don't exist in English. These are especially valuable for student self-study between sessions.

> **Status: ✅ Complete (Mar 19 2026)** — All 9 phonetic guide cards built in `TextbookPhoneticGuides.tsx`. Each is a self-contained React component with IPA notation, production notes, examples, and English contrast. Auto-triggered by chapter title via `classifyGrammarType()`.

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Spanish vowel purity chart | A, E, I, O, U — each shown as single pure sound vs English diphthong equivalent | Novice Low | ✅ `VowelPurityCard` |
| The rolled R (rr) guide | Tongue position illustration + where rr appears (perro, carro, alrededor) | Novice Mid | ✅ `RolledRCard` |
| B vs V in Spanish | Illustrated — both are essentially the same sound; contrast to English | Novice Mid | ✅ `BVSoundCard` |
| The silent H | Simple rule card + illustrated examples (hablar, hola, hotel) | Novice Low | ✅ `SilentHCard` |
| The J sound | Contrast to English H/J — illustrated with throat position | Novice Mid | ✅ `JSoundCard` |
| Ñ pronunciation | How it differs from N — examples (niño, mañana, año) | Novice Low | ✅ `NyenCard` |
| LL/Y regional variation | Map + phoneme guide — ceceo, seseo, ll-vs-y | Intermediate Low | ✅ `LLYCard` |
| Stress rules & accent marks | Visual rule card: where stress falls without accent, when accent is written | Novice High | ✅ `StressAccentCard` |
| Linking sounds (enlace) | How word-final vowel links to word-initial vowel in spoken Spanish | Intermediate Low | ✅ `LinkingSoundsCard` |

---

## Asset Creation Pipeline

### For vocabulary images (Sections 1 & 2 — weather/time illustrated cards)
1. Generate via Gemini Imagen using `generateImage()` with `removeBackground: false` (full illustrated cards)
2. Upload to object storage → insert into `visual_assets` with all 9 language translations
3. Set `object_type` to appropriate category

### For grammar/structure diagrams (Sections 3, 4, 6)
1. Build as React/SVG components in `TextbookInfographics.tsx`
2. Parameterize by language so Spanish tables can adapt to French/German etc.
3. Trigger via infographic detection logic in `TextbookChapterView.tsx`

### For weather icons specifically
- These should also be built as React SVG components (consistent style, infinitely scalable)
- Can double as animated weather conditions in future UI

### For cultural infographics (Section 5)
- Map-based ones → React SVG components (accurate geography)
- Illustration-based ones (food guide, gesture guide) → Gemini Imagen

### For false cognate cards (Section 7)
- These are pure text + simple illustration → React component, not generated images
- One reusable `FalseCognateCard` component taking the data as props

### Batch generation order (revised March 17 2026)

The original order put Numbers and Time at the top. That assumed the clock wasn't built. It is. The live SVG clock handles all lesson-time interactions — static clock reference images are now textbook supplements, not urgent. The order below reflects actual current gaps:

1. **Food menu images (Section 11)** — live feature, ~98% of items have no image, visible to students today. Spanish first, then Japanese, French, Italian in sequence.
2. **Animals (Novice Mid)** — universally loved by learners, language-agnostic images, high Daniela usage
3. **Novice Low core vocabulary** — people, basic objects, food staples not yet in the prop library (bread, milk, egg, rice)
4. **Fruits & vegetables (Novice Mid)** — visually clear-cut, language-agnostic, used across multiple scenario types
5. **Clothing (Novice Mid)** — high-frequency vocabulary cluster, all language-agnostic
6. **Days/months/seasons (Section 2)** — static reference cards to complement the live clock (clock handles lessons; these handle textbook)
7. **Weather illustrated set** — these are good candidates for SVG (see Section 9 Phase 2) but illustrated versions work for the textbook
8. **Continue vocabulary by level** — Novice High travel/transport → Intermediate body/health → Intermediate emotions

---

## Section 9 — Interactive Scene Canvas

**Status: Phase 1 complete ✅ | Phase 2 not yet started ⬜**  
**Updated:** March 17 2026 — this section previously said "not yet built." That was stale.

### Phase 1 — Prop Layer Canvas ✅ Complete

The `SceneCanvas` component is fully operational. Daniela can open a live stage, place and remove props, and run the analog clock — all client-side with no server round-trip.

**Built and working:**
```
open_scene(environment)         → loads background, establishes the stage
add_to_scene(prop, position)    → overlays transparent PNG at zone coordinates
remove_from_scene(prop)         → fades out and removes that layer
set_clock(time: "H:MM")         → SVG analog clock with rotating hands ✅ fantastic
clear_scene()                   → removes all props, keeps background
```

Both `compose_visual_scene` (snapshot model, for single static vocabulary displays) and the live canvas (stage model, for sequential lessons) now coexist. Daniela chooses based on context.

### Phase 2 — SVG Canvas Types ⬜ Not Yet Built

These are standalone React/SVG components that extend the canvas beyond prop images. Each covers an entire vocabulary domain from a single reusable component:

| Component | Daniela function | Vocabulary domain | Build complexity |
|---|---|---|---|
| Body diagram (labeled regions) | `set_body_part` + `clear_body_diagram` | Body parts, health, all levels | ✅ Built March 17 2026 |
| Conjugation table (fill-in) | `init_conjugation_table` + `fill_conjugation` + `clear_conjugation_table` | Every tense, every verb pattern | ✅ Built March 17 2026 |
| World map (Spanish-speaking countries) | `highlight_country` + `clear_world_map` | Cultural units, geography, Intermediate+ | ✅ Built March 17 2026 |
| Calendar SVG | `set_calendar` + `clear_calendar` | Dates, days, months, Novice Low | ✅ Built March 17 2026 |
| Emotion face SVG | `set_emotion` + `clear_emotion` | Emotions vocabulary, all levels | ✅ Built March 17 2026 |
| Thermometer SVG | `set_thermometer` + `clear_thermometer` | Weather/temperature, Novice High | ✅ Built March 17 2026 |
| Weather icon set | `set_weather` + `clear_weather` | Weather vocabulary, all levels | ✅ Built March 17 2026 |

**Phase 2 complete (March 17–18 2026):** All 10 grammar/visual canvas components are fully built and wired end-to-end. Daniela has 20+ new function calls total across Phase 2. All components work standalone (full-panel) or as a side-panel overlay on top of an active spatial scene. Bilingual label support (target + native language stacked) is live across all diagram types and the prop layer.

### Use Cases

**Time & Numbers**
- `set_clock(time: "3:15")` — SVG clock with rotating hands. Daniela says "son las tres y cuarto" and the clock moves. No image generation. Covers an entire unit of time vocabulary from one reusable component.
- `set_calendar(day: "miércoles", month: "marzo")` — SVG calendar highlights the correct cell.

**Progressive Scene Building (Restaurant)**
- Scene opens on an empty `restaurant_table` background
- `add_to_scene("glass", "on_table")` — water arrives
- `add_to_scene("bread_basket", "on_table")` — bread arrives
- `add_to_scene("dinner_plate", "on_table")` — el plato principal
- `remove_from_scene("dinner_plate")` — cleared after dessert
- `add_to_scene("menu_card", "on_table")` — la cuenta
- The full dining experience in one conversation, on one canvas

**Body Parts**
- Background: illustrated neutral body outline (SVG)
- `highlight_body_part("cabeza")` — that region glows or labels appear
- `highlight_body_part("hombro")` — added to the active set
- Daniela can narrate "me duele la cabeza y también el hombro" while the diagram tracks

**Conjugation Table**
- Blank table with pronoun rows
- `fill_conjugation("yo", "hablo")` — cell fills in
- `fill_conjugation("tú", "hablas")` — next cell
- Student watches the pattern emerge as Daniela explains each form

**World Map (Cultural)**
- SVG map of Spanish-speaking countries
- `highlight_country("México")` — country shades
- `add_label("México", "Ciudad de México")` — capital appears
- Daniela can tour the Spanish-speaking world, country by country

**Other uses identified**
- Shopping cart that fills as vocab is taught at el mercado
- Recipe assembly: ingredients arrive on a kitchen counter as Daniela names them
- Emotion face: SVG face that transitions between alegre / triste / sorprendido / enojado
- Weather forecast card that updates icons as Daniela discusses the week
- Thermometer that rises/falls for temperature vocabulary
- Classroom seating chart where "siéntate al lado de María" is shown spatially

### Canvas Command Architecture

Daniela emits canvas commands that the client receives via the existing WebSocket/streaming channel. The client's whiteboard panel holds the current canvas state.

**New function calls to add to Daniela's registry:**

```
open_scene(environment, label?)     → establishes background, clears any existing scene
add_to_scene(prop, position, label?)  → adds a prop layer at cx/cy from POSITION_MAP
remove_from_scene(prop)             → fades out and removes that layer
move_in_scene(prop, new_position)   → animates prop from current position to new one
clear_scene()                        → removes all props, keeps background

// Special canvas types (SVG components, no images):
set_clock(time: "HH:MM")           → rotates clock hands
set_calendar(day, month, year?)    → highlights a date
highlight_body_part(part, active: bool) → body diagram labeling
fill_table_cell(row, col, value)   → conjugation table fill-in
highlight_country(country)          → world map highlight
```

**What this replaces:**
- `compose_visual_scene` remains for the snapshot use case (static vocab cards, Mode A wide scenes)
- The canvas commands are the NEW primitive for interactive/progressive lessons (Mode B prepositions, time lessons, ordered vocabulary)

### Frontend Component Architecture

```
<SceneCanvas>
  ├── <SceneBackground src={environment.image_url} />   ← CSS background-image
  ├── <SceneLayer key={prop.name}                       ← absolute positioned
  │     src={prop.zone_image_url}
  │     cx={POSITION_MAP[position].cx}
  │     cy={POSITION_MAP[position].cy}
  │     scale={POSITION_MAP[position].scale}
  │     animate="fade-in"
  │   />
  ├── <ClockCanvas time={clockState.time} />            ← SVG component
  ├── <BodyDiagram highlighted={bodyState.parts} />     ← SVG component
  └── <ConjugationTable filled={tableState.cells} />   ← React component
</SceneCanvas>
```

### Build Sequencing Recommendation

The canvas concept has two phases:

**Phase 1 — Prop layer canvas (low risk, high value)**  
Pure client-side compositing of what we already have. No new assets needed. No new DB schema. Just a new frontend component and new Daniela function calls. Enables the progressive restaurant scene immediately with the 24 existing zone-compatible props.

**Phase 2 — SVG canvas types (medium effort, extremely high value)**  
Clock, body diagram, conjugation table, world map. Each is a standalone React/SVG component. The clock alone covers an entire vocabulary unit. The body diagram covers half of Intermediate Low health vocabulary. These should be built in Section 9's batch generation order below:

| Canvas type | Lessons it covers | Build complexity | Status |
|---|---|---|---|
| Clock (analog + hands) | All time expressions, Novice Low → Advanced | Low — pure SVG | ✅ Done |
| Body diagram | Body parts, health vocabulary, Intermediate Low | Medium — organic bezier paths | ✅ Done (organic shapes + glow) |
| Face close-up diagram | Lips, chin, cheeks, eyebrows, teeth, nostrils, ears, forehead, jaw | Medium — layered SVG regions | ✅ Done (March 2026) |
| Hand close-up diagram | Thumb, fingers, palm, wrist, knuckles, fingernails | Medium — tapered bezier paths | ✅ Done (March 2026) |
| Conjugation table | Every tense, every verb pattern | Low — React table component | ✅ Done |
| Weather icon set | Weather vocabulary, Novice Low | Low — SVG icons | ✅ Done |
| World map (Spanish-speaking) | Cultural units, Intermediate+ | Medium — SVG paths | ✅ Done |
| Emotion face | Emotions, Intermediate Mid | Low — SVG expressions | ✅ Done |
| Calendar | Dates, days, months, Novice Low | Low — SVG grid | ✅ Done |
| Thermometer | Temperature, weather, Novice High | Low — SVG fill | ✅ Done |

### Connection to Static Assets in Sections 1–8

Many of the static assets listed earlier become redundant or complementary once the canvas is built:

- **Clock reference cards (Section 2)** → still useful as textbook illustrations; the live clock handles lesson interactions
- **Body diagram (referenced in Section 1)** → the static version for textbook; the SVG version for Daniela's sessions
- **Conjugation tables (Section 3)** → the static versions are textbook/reference cards; the live fill-in version is the lesson experience
- **Preposition maps (Section 4)** → the static card is a reference; the live prop room compositor (already built) handles lesson interactions
- **Weather icons (Section 2)** → SVG canvas icons for live lessons; illustrated images for textbook/library

The roadmap sections 1–8 describe the library of reference assets. Section 9 describes how those assets come alive in real-time lessons.

---

## Asset Creation Pipeline

This roadmap is written for Spanish (our primary language) but the vocabulary images, time/weather visuals, preposition maps, and grammar structure cards all need to adapt to all 9 languages. The approach:

- **Images** (vocabulary illustrations): language-agnostic — one image per concept, any language can reference it
- **Grammar tables**: language-specific — French has different conjugation patterns, German has cases, Japanese has particles
- **Cultural infographics**: language/region-specific — French has its own culture section, Japanese has its own
- **False cognates**: language-specific — different false friends for each L1→L2 pair

Priority order for language expansion: Spanish → French → German → then others.

---

## Section 10 — Interactive Ordering Menus

**Status: Planned**  
**Origin:** Late-night brainstorm session, March 16 2026

### The Idea

The decorative menu props (`breakfast_menu`, `lunch_menu`, `dinner_menu`, `menu_card`) that sit on the table as scene dressing are not the same thing as an **interactive ordering menu**. This section describes that second thing — which doesn't exist yet and should.

When a student is doing a restaurant roleplay and Daniela hands them a menu, they should be able to **tap the menu prop on the canvas** and have a full menu overlay appear — showing actual dishes, descriptions, and prices in the target language, calibrated to their ACTFL level.

### What It Would Look Like

A modal/overlay slides up (or the canvas zooms into the menu), showing:

```
┌──────────────────────────────────────────────────────────┐
│              LA MESA ESPAÑOLA — Menú del Día              │
│──────────────────────────────────────────────────────────│
│  ENTRANTES                                                │
│  • Sopa del día ....................................... $6 │
│    Caldo de pollo con fideos y verduras frescas           │
│  • Ensalada mixta ..................................... $8 │
│    Lechuga, tomate, cebolla, aceitunas y vinagreta        │
│                                                           │
│  PLATOS PRINCIPALES                                       │
│  • Pollo asado con patatas ........................... $18 │
│    Muslo de pollo al horno con hierbas provenzales        │
│  • Pasta con salsa marinera ......................... $15  │
│    Espaguetis con tomate, ajo y albahaca fresca           │
│                                                           │
│  POSTRES                                                  │
│  • Flan casero ....................................... $6  │
│    Flan de huevo con caramelo líquido                     │
└──────────────────────────────────────────────────────────┘
```

### Data Architecture

This requires a new concept: **scenario-specific menu data** that lives in the database and is tied to:

1. **Language** — all descriptions and dish names in the target language
2. **ACTFL Level** — Novice levels get simpler vocabulary; Advanced levels get richer descriptions, less-common dishes, regional cuisine
3. **Meal type** — breakfast, lunch, dinner (matching which menu prop is on the table)
4. **Region/cuisine style** — a Mexican restaurant menu vs a Spanish tapas bar vs an Argentine parrilla should feel different even at the same ACTFL level

### Implementation Ideas

**Option A — Pre-written menu content per language/level/meal (simplest)**
- Author 3–4 menus per language (breakfast, lunch, dinner, café) × however many ACTFL levels want distinct menus (probably 3 tiers: Novice, Intermediate, Advanced)
- Store as structured JSON/DB rows: `{ dish_name, description, price, category, language, actfl_tier }`
- The menu overlay renders from this data
- Daniela references specific dishes from the menu when asking what the student wants to order

**Option B — Dynamically generated menus (more flexible)**  
- Generate menu content on the fly using the AI, scoped to language/level/region
- Cache the generated menu in the session so Daniela can reference it consistently throughout
- Allows infinite variety — every session could have a slightly different menu

**Option C — Hybrid**
- Pre-authored core menu templates per language/level that Daniela can reference
- Daniela can add or swap individual items dynamically using a function call (`add_menu_item`, `set_todays_special`)
- Gives consistency + flexibility

### What Daniela Needs

For the restaurant roleplay to work end-to-end, Daniela needs to:

1. Know what's on the menu (so she can roleplay as a waiter and suggest dishes)
2. Be able to surface the menu to the student when appropriate
3. Reference specific menu items when the student orders, comments, asks questions
4. Know which items are linguistically useful for the lesson (vocabulary targets)

A future function tool `show_menu()` could:
- Trigger the menu overlay on the student's screen
- Pass menu content to Daniela's context so she knows what's available
- Allow Daniela to highlight specific items as she speaks about them

### Connection to Plate-as-Background

The `restaurant_table_with_plate` environment (added March 16 2026) solves the food-on-plate compositing problem. The interactive menu is the natural companion — the student reads the menu, orders a dish, and Daniela adds that dish's prop at `on_plate`. The loop closes: menu → order → food appears on plate.

### Priority

**Medium — after core curriculum assets.** The restaurant roleplay already works without interactive menus (Daniela improvises). But an interactive menu with real content would make the experience significantly more authentic, more replayable, and more linguistically purposeful.

---

## Section 11 — Menu Food Item Image Queue

**Added:** March 17 2026  
**Priority:** High — the interactive ordering menus (Section 10, now built and live) display a food item image alongside every dish name. Every menu item at every ACTFL level needs its own image, or it falls back to a placeholder.

### The Decision: Images at All Levels

An earlier draft of this document restricted images to Beginner menus only, on the assumption that advanced students should be "reading, not looking." That was wrong. Images in the menu overlay serve vocabulary acquisition at every level — a beginner sees *churros* and learns the word, an advanced student sees *croquetas de jamón ibérico* and reinforces a richer mental model. Taking images away from higher levels creates a worse product for no educational gain. The menu overlay shows the image at every level. The image is the same; the text complexity around it scales with level.

**This also resolves the scale problem.** Because images live in fixed-size card containers inside the menu overlay, the presentation container controls the visual size. A croissant image and a paella image both render at the same card dimensions — relative scale is implicit and handled by layout, not by the image itself. This is fundamentally different from placing a food prop on the scene canvas where proportion to the plate matters.

### What We Have

Three data files author all menu content across 5 scenario types:

| File | Scenario types | Total items authored |
|---|---|---|
| `language-menus-restaurant-mealtime.ts` | Breakfast, Lunch | 474 items |
| `language-menus-cafe-grocery.ts` | Café, Grocery | 688 items |
| `language-menus-restaurant-festival.ts` | Dinner, Local Festival | 662 items |
| **Total** | **5 scenario types** | **1,824 authored items** |

Each file covers **10 languages × 3 ACTFL levels (Beginner / Intermediate / Advanced)**.

### How Many Unique Images

The same dish name appears across all three levels of a given language menu (Beginner: "Café con leche €1.50", Intermediate: richer description, Advanced: cultural annotation — all show the same image). So we generate **one image per unique dish name per language**, not one per level. This reduces the backlog by two-thirds compared to a naïve count.

| Scenario | Unique items/language (est.) | Languages | Total unique images |
|---|---|---|---|
| Breakfast | ~8 | 10 | ~80 |
| Lunch | ~8 | 10 | ~78 |
| Dinner (restaurant) | ~11 | 10 | ~110 |
| Café | ~12 | 10 | ~115 |
| Local Festival / Street Food | ~11 | 10 | ~110 |
| **Total** | | | **~493** |

After cross-language deduplication (items like *croissant*, *espresso*, *orange juice* appear across multiple language menus and share one image): estimated **~310–340 unique images** to generate.

### Items That Are Shared Across Languages (generate once)

- Basic coffee drinks: espresso, cappuccino, café con leche, latte, Americano
- Croissant (French, Spanish, Italian, German café menus)
- Orange juice / fresh-squeezed OJ
- Plain toast / white bread
- Sparkling water / still water
- Salad (green salad, mixed salad)
- Omelette (French/Spanish versions are visually similar enough)

### Items That Are Language-Specific (generate per cuisine)

These must be distinct — a Japanese ramen bowl and a Spanish cocido are not interchangeable. Generate separately with cultural fidelity.

| Category | Language-specific examples |
|---|---|
| Japanese | ramen, miso soup, onigiri, bento box, tamagoyaki, soba, udon, yakitori |
| Korean | bibimbap, tteokbokki, bulgogi, galbi, kimchi jjigae, dosirak |
| Mandarin | dim sum, baozi, congee, jiaozi, Peking duck, mapo tofu, tang yuan |
| Arabic | shakshuka, ful medames, manakish, kibbeh, hummus, knafeh, baklava |
| Russian | borscht, blini, pelmeni, shchi, syrniki, beef stroganoff, medovik |
| Spanish/Latin | churros, tortilla española, gazpacho, paella, tacos, enchiladas, flan |
| French | tartine, pain au chocolat, quiche, salade niçoise, coq au vin, crêpe |
| Italian | cornetto, bruschetta, caprese, pizza margherita, risotto, tiramisu |
| German | Brötchen, Brezel, Bratwurst, Schnitzel, Sauerbraten, Apfelstrudel |
| Portuguese | pastel de nata, torrada, bifana, bacalhau, caldo verde, arroz doce |

### Generation Priority

1. **Spanish** (all 5 meal types) — largest user base
2. **Japanese** (all 5 meal types) — visually very distinct, high student engagement
3. **French** (all 5) — many items overlap with existing prop library
4. **Italian** (all 5) — overlaps with French, efficient batch
5. **Korean, Mandarin, German, Portuguese, Arabic, Russian** — in order of user demand

---

## Two Tools, Two Jobs — The Core Architecture Decision

**Revised:** March 17 2026

This distinction is worth stating explicitly, because earlier thinking conflated two different things into one.

### The Scene Canvas — Immersion and Prepositions

The scene canvas (the live stage that Daniela builds during a lesson) does its best work as a **theatrical and spatial tool**. Its highest-value use cases are:

- **Preposition teaching**: the fork is to the *left* of the plate, the glass is *above* the napkin, the menu is *on* the table. The physical arrangement on the canvas is the lesson content.
- **Scene-setting and atmosphere**: a meal arrives on the plate, a bill is placed on the table, a menu card is set down. These moments create immersion and provide contextual cues.
- **Progressive scene building**: the table starts empty, then fills as the conversation unfolds. The student experiences the arc of a real meal.

What the canvas is **not** well-suited for: vocabulary acquisition from images. A food prop on a plate is small, the zone coordinates are fiddly, and there is no room for a dish name or description alongside it. Asking the canvas to also teach "what does paella look like" is asking it to do two incompatible jobs at once.

**Implication for the plate prop:** the plate on the canvas is atmospheric. It does not need to show the correct food for that student's order. A generic "main course" placeholder or a visually appealing generic dish image is entirely sufficient. The vocabulary learning happens somewhere else.

### The Menu Overlay — Vocabulary Acquisition

The slide-up menu overlay that appears when a student taps the menu prop is where **vocabulary acquisition happens**. It has everything the canvas lacks: the image, the dish name in the target language, a description, a price, and enough space to render all of it clearly. This is the right place for food images.

Critically, because images in the overlay live in **fixed-size card containers**, the rendering environment controls the visual size. A croissant and a paella both render at the same card dimensions. Relative scale between dishes is handled implicitly by layout — not by how the images were generated. This makes the image generation problem significantly simpler.

---

## Scaling Specification for Food Item Images

### For Menu Overlay Images (Primary Use Case)

Scale concerns are minimal. The overlay card container normalises all images to the same display size. The main requirements are:

1. **The food item must be the clear subject** — not lost in a background, not floating in a sea of white space
2. **The vessel must be visible** — a cup of espresso should show the cup, not just the liquid; a bowl of ramen should show the bowl, not just the noodles. This is because the vessel is often part of the vocabulary (la taza, el bol, la copa)
3. **Clean background** — white or very light, consistent with the platform's illustrated watercolor style

### For Scene Canvas Food Props (Secondary Use Case)

When a food prop is placed directly on the scene canvas (e.g. at the `on_plate` position), scale relative to the dinner plate matters because both exist in the same visual space. The dinner plate prop renders at approximately 280px wide in the scene. A food item placed at `on_plate` should look like it belongs on that plate — not larger than the plate, not so small it looks like a garnish.

> *...viewed from above at tabletop distance, full [plate/bowl/cup] visible with item in correct proportion, object centred on clean white background, no shadows, warm illustrated watercolor style.*

### Prompt Language (Both Cases)

The canonical prop style prompt handles most of this: *soft watercolor children's book illustration style, warm gentle colors, light pencil outlines, visible brushwork texture, object centred and prominent on a clean pure white background, no background elements, clear and recognisable silhouette.* Avoid adding "close-up of" or "detailed shot of" — these push generation toward macro framing that crops off the vessel.

---

## Food Props by Language & Meal — Localization Backlog

**Added:** March 16 2026  
**Priority:** High — current food props (scrambled_eggs, bacon_strips, ham_slice, hash_browns, plain_toast, omelette, fried_eggs) are Anglo-American and unsuitable for Spanish, French, Japanese, or other language lessons.

### Design Principle

Food props must reflect what a student would actually encounter in the culture they are learning. A Spanish lesson should show *churros* and *tortilla española*, not bacon and hash browns. Every language we support needs its own culturally authentic food set — split by meal category.

### Required Food Props per Language

| Language | Breakfast | Lunch / Midday | Dinner | Dessert / Snack |
|---|---|---|---|---|
| **Spanish (ES/MX/LA)** | churros, tortilla española, pan con tomate, café con leche, molletes | bocadillo, gazpacho, empanada, tacos (MX), quesadilla | paella, cocido, tamales, enchiladas, arroz con pollo | flan, tres leches, arroz con leche, churros |
| **French** | croissant ✅ (exists), tartine, pain au chocolat, café au lait | baguette sandwich, quiche lorraine, salade niçoise | coq au vin, ratatouille, bouillabaisse, steak frites | crêpe, éclair, madeleine, tarte tatin |
| **Italian** | cornetto, cappuccino, fette biscottate | bruschetta, insalata caprese, panino | pizza margherita, spaghetti bolognese, risotto, osso buco | gelato, tiramisu, cannoli, panna cotta |
| **Portuguese** | pastel de nata, torrada, galão | bifana, francesinha, caldo verde | bacalhau à brás, cozido, frango assado | pastel de nata ✅, arroz doce |
| **German** | Brötchen, Brezel, Aufschnitt | Bratwurst, Schnitzel, Kartoffelsalat | Sauerbraten, Kassler, Erbsensuppe | Schwarzwälder Kirschtorte, Apfelstrudel |
| **Japanese** | onigiri, miso soup, tamagoyaki, rice bowl | ramen, soba, bento box, udon | sushi platter, tempura, yakitori, tonkatsu | mochi, dorayaki, matcha ice cream |
| **Chinese (Mandarin)** | congee, dim sum, baozi, youtiao | dumplings/jiaozi, fried rice, spring rolls | Peking duck, hot pot, mapo tofu, kung pao chicken | tang yuan, egg tart, sesame balls |
| **Korean** | dosirak (lunchbox), juk (porridge) | bibimbap, tteokbokki, japchae | bulgogi, galbi, samgyeopsal, kimchi jjigae | bingsu, hotteok, sikhye |
| **Hebrew** | shakshuka, bourekas, labane toast, café hafuch | sabich, falafel wrap, hummus plate, Israeli salad | shwarma plate, grilled fish, couscous, stuffed peppers | rugelach, ka'ak cookies, halva |

### Meal Category Completeness (per language)

Each language needs at minimum:
- **3–5 breakfast items** (visually distinct, iconic for that culture)
- **3–5 lunch/midday items**
- **3–5 dinner items** (including at least one "special occasion" dish)
- **2–3 dessert/snack items**

### Implementation Notes

- Generate with the standard prop style: *warm illustrated watercolor style, vibrant saturated colours, soft natural shading, object centred on clean white background, no shadows or background elements*
- Name props with language prefix where needed to avoid conflicts: `es_churros`, `fr_croissant`, `ja_ramen`, etc. (or a single `churros` if it maps cleanly to one language)
- DB `object_type`: use `'food'` for all
- Consider tagging with `tags` array: `['food', 'breakfast', 'spanish']` for filtering
- The `breakfast_menu`, `lunch_menu`, `dinner_menu` image props should eventually be language-specific too (Spanish menu card, Japanese menu card, etc.)

### Existing Food Props (Anglo-American only — needs cultural counterparts)

| Prop | Language context | Notes |
|---|---|---|
| scrambled_eggs | EN only | Add es_huevos_revueltos equivalent? Or use for bilingual EN/ES lessons |
| fried_eggs | EN only | es: huevo frito |
| omelette | EN/FR | fr: omelette already correct — reuse |
| bacon_strips | EN only | Not culturally appropriate for most other languages |
| ham_slice | EN | es: jamón serrano is different visually |
| hash_browns | EN only | No direct equivalent in most cultures |
| plain_toast | Universal | Can reuse across languages |
| croissant | FR/universal | Already in prop library ✅ |
| apple | Universal | Already in prop library ✅ |
| pasta | IT/ES/universal | Already in prop library ✅ |

### Priority Order

1. **Spanish** — largest user base, most immediate need
2. **French** — high demand, many props overlap with existing
3. **Japanese** — visually very distinct, high educational value
4. **Italian** — overlaps with French, efficient to do together
5. **Hebrew** — new language, Israeli Coffee Shop scenario drives immediate need
6. **Others** — as language support expands

---

## Section 9 — Immersive Experience: Tutor in Scene

**Added:** March 18 2026  
**Status:** 🔬 Exploration  
**Priority:** Medium — high visual impact once proven

### Concept

Currently the tutor avatars (listening/thinking/talking portrait cutouts) live exclusively in the standard lesson view. The immersive scene mode is a separate fullscreen experience with only the environment background and props — no tutor visible. The idea is to place Daniela (or any tutor) visibly *inside* the scene during immersive mode, making her feel like a real person standing in the environment rather than a disembodied voice.

### Chosen Approach — Option 2: Transparent Avatar Overlay

Float the existing no-background tutor portrait on top of the scene background at a contextually natural position. For counter/bar scenes (taqueria, french_brasserie, israeli_cafe) she would appear behind the counter on one side. For table scenes (izakaya, biergarten, trattoria, korean_bbq) she would appear seated or standing at the far edge. Her three animation states (listening, thinking, talking) continue to work as normal.

**Why this approach:**
- Reuses existing transparent cutout art — no new image set needed per scene
- Tutor animation states (listening/thinking/talking) still function
- Works across all 9 cultural scene backgrounds without additional art production
- Can be toggled or positioned per scene type without a full visual overhaul

**Why not the alternatives:**
- Option 1 (bake tutor into scene art): one set of images per tutor per scene — exponentially more art to produce, tutor can't animate
- Option 3 (docked side panel): breaks immersion, defeats the point of the fullscreen scene

### Pilot Plan

Test with one scene first before rolling out to all 9:

| Step | Detail |
|------|--------|
| Choose pilot scene | `taqueria` — widest use, most developed; Daniela as the taquera behind the counter |
| Position | Bottom-left quadrant, behind the counter — scaled to ~40% of scene height |
| Anchor point | Fixed to scene coordinates, not floating UI layer |
| Animation states | Swap listening/thinking/talking cutouts on Daniela's state change as normal |
| Evaluate | Does she look natural? Is scale correct? Does she occlude props awkwardly? |
| Rollout | If pilot works, parameterize position per scene type and enable all 9 |

### Scene-Specific Position Guide (draft)

| Scene | Tutor position | Notes |
|-------|---------------|-------|
| taqueria | Behind counter, left side | Natural as the taquera |
| french_brasserie | Behind counter/zinc bar, right side | Natural as the café server |
| japanese_izakaya | Right side, standing — slightly behind table | Izakaya staff position |
| german_biergarten | Standing at end of bench, right | Open air — less natural but workable |
| italian_trattoria | Left side, standing near wall | Natural as the host/waiter |
| korean_bbq | Standing to right of table | Grillmaster position |
| chinese_teahouse | Left side, seated low | Tea ceremony host |
| israeli_cafe | Behind counter, right side | Natural as the barista |
| cafe | Behind counter, center-left | Generic barista position |

### Technical Notes

- Tutor overlay would be a new `TutorInScene` component rendered inside `ImmersiveSceneView` (or equivalent) as an absolutely positioned layer above the background but below the prop canvas
- Scene-specific position and scale stored as metadata per visual environment (or hardcoded per scene name initially for the pilot)
- No new avatar images needed unless we later want scene-specific costume variants (e.g. Daniela in a taqueria apron)
- Costume variants (Option 1-hybrid) could be a future phase if the overlay approach proves compelling

---

## Section 12 — Image Routing Architecture & Coverage Audit

**Added:** April 7, 2026
**Status:** Plans #4 + #5 ✅ complete (confirmed April 7, 2026); Cultural character audit ⬜ not started

This section captures the routing infrastructure that determines *which image a word gets* — a problem separate from whether the image itself exists. Plans #4 and #5 live here, as does the cultural character image audit that Rule 5 flagged.

---

### The Three-Tier Framework

Every vocabulary word in every lesson must resolve to exactly one of these three tiers. Raw unguided auto-generation is never acceptable — it produces stylistically inconsistent images and wastes DALL-E budget.

| Tier | When to use | Image source | Examples |
|------|-------------|--------------|---------|
| **1 — SVG / canvas component** | Function word, numeral, grammar concept, or anything better shown as a diagram | React/SVG component — no DALL-E | `je`, `le`, `3`, `AR verbs`, preterite timeline |
| **2 — Shared concept image** | Universal action or noun whose visual meaning is culturally identical everywhere | One watercolor image shared by all 9 languages | `manger/comer/eat`, `étudier/estudiar/study`, `dormir/sleep` |
| **3 — Character SCENE_OVERRIDE** | Culturally specific greeting, gesture, or phrase where character identity and scene setting matter | Language-specific DALL-E image using character-substitution prompt template | `bonjour`, `salut`, `buenos días`, `こんにちは` |

If a word doesn't match tier 1 or 2, it gets a tier 3 SCENE_OVERRIDE — never raw unguided generation.

---

### Plan #4 — Textbook Image Consistency: Shared Concept Expansion + Sentence Resolver ✅

**Confirmed complete April 7, 2026.** All deliverables were implemented in a prior session.

**Problem being fixed:** Three routing failures currently exist in the French textbook (and likely in all non-Spanish textbooks):

1. **Missing shared concept entries** — `étudier`, `se lever`, `travailler`, `regarder` have no entry in `vocabulary-image-resolver.ts`. They fall through to raw DALL-E and produce photo-realistic images that clash with the watercolor library.
2. **Sentence-form blindspot** — `Je mange`, `Tu parles`, `Il travaille` are stored and looked up as-is. The pronoun prefix means they never match `manger`, `parler`, `travailler` in the shared concept map, so each generates a fresh image from scratch.
3. **Missing Spanish anchor images** — the shared map points to `vocab_spanish_trabajar` etc., which may not yet exist in the DB.

**Deliverables:**
- Add 4 missing verb clusters to `vocabulary-image-resolver.ts` (étudier → `vocab_spanish_estudiar`, regarder → `vocab_spanish_mirar`, travailler → `vocab_spanish_trabajar`, se lever → `vocab_spanish_levantarse`)
- Sentence-form normalizer as the first step in the resolution pipeline (strips subject pronouns and leading reflexive particles before lookup)
- Seed missing Spanish anchor images via SCENE_OVERRIDEs in `vocab-image-seed-service.ts`
- Admin vocab audit endpoint: `GET /api/admin/vocab-audit?language=french&level=novice_low` returns routed vs. unrouted breakdown per word per lesson

---

### Plan #5 — Canonical Vocabulary Registry — All Chapters, All Languages ✅

**Confirmed complete April 7, 2026.** `server/data/canonical-vocabulary.ts` exists (2,560 lines, 7+ thematic units covering greetings, family, school, food, numbers/time, daily routines, travel/transport). `lookupCanonicalConcept()` is called as Step 0 in the resolution pipeline. Admin audit endpoint live at `GET /api/admin/vocab-audit`.

**Problem it solved:** Gaps in the shared concept map are discovered reactively — a student sees a bad image, then we patch it. There is no authoritative forward-looking list of what images every chapter in every language needs.

**Deliverables:**
- New file `server/data/canonical-vocabulary.ts` — master registry of ~400 concepts covering every lesson and every language, each mapped to its tier and its image key
- `lookupCanonicalConcept()` called as the first resolution step (before the existing shared concept map)
- The admin audit endpoint (from Plan #4) runs against this registry to show coverage status per language/level combination
- When a future agent asks "what images are required for Unit 3 School Life in German?" the answer lives in this file

**Dependency:** Plan #5 is the superset — Plan #4's fixes become the first entries in the canonical registry. Plan #4 can ship first as a targeted patch; Plan #5 is the full systematic version that makes the patch unnecessary going forward.

**Files:**
- `server/data/canonical-vocabulary.ts` — new
- `server/services/vocabulary-image-resolver.ts` — add `lookupCanonicalConcept()` as first pipeline step
- `server/routes.ts` — add `/api/admin/vocab-audit` endpoint
- `server/services/vocab-image-seed-service.ts` — SCENE_OVERRIDEs for missing Spanish anchors
- `docs/alden-agent-handoff.md` — architecture section update

---

## Madrigal Method Analysis — "See It and Say It in Spanish" (1962)

**Analyzed:** April 9, 2026  
**Source:** Margarita Madrigal, *See It and Say It in Spanish*, New American Library, 1962.  
**Book access:** Available for digital borrowing at archive.org (search "Madrigal See It Say It Spanish"); paperback ~$8 on Amazon. No free full-text HTML version exists — copyright renewal keeps it protected until ~2057.  
**Agent characterization (session preceding April 9, 2026):** "ruthlessly minimalist" — coined by the agent who first analyzed the book's structure and recognized its deliberate economy of means. David noted this characterization on April 11, 2026 as worth preserving in the record.

### The Adaptation Philosophy — What We Borrow, What We Transcend

**Established:** April 11, 2026

HoloHola is not a digital replica of Madrigal's book. Everything we have built and are building is legitimate — the chapters, the structure, the AI tutor, the conversation model. None of that needs to be reconsidered against the book. The book is a study in what a skilled teacher was able to achieve with the most constrained possible medium: black ink on a small paperback page, no audio, no interactivity, no personalization, no feedback loop.

The scan project exists for one reason: **to understand what Madrigal was trying to achieve, so we can achieve the same things better with tools she didn't have.**

Her constraints were severe:
- No audio — she had to build pronunciation confidence through cognates and pattern repetition alone
- No interactivity — she had to design pages that would "ask the question" and pause for the student to answer, in their own head
- No personalization — every student got the same 191 lessons in the same order
- No feedback — she never knew if the student answered correctly; she could only design the page to make errors obvious by comparison

HoloHola removes every one of those constraints. Daniela speaks. She listens. She adapts to what the student already knows. She remembers what landed and what didn't. She asks the same question ten different ways if needed. She gives the student the Warhol-style illustration of a taxi and then immediately lets them practice the word in a real conversation.

**What we borrow from Madrigal:**
- The image-first principle — see the object before reading the word
- The Q&A drill rhythm — question in one person, answer shifts to another, no metalanguage
- Pattern before label — demonstrate the structure through repetition, name it briefly afterward
- Cognate confidence as an entry point — you already own more of this language than you think
- Ruthless minimalism — every element must teach, demonstrate, or encourage; nothing else earns its space
- The Sentence Frame architecture — a fixed frame with swappable vocabulary items is the core drill unit
- Grammar as a back-of-the-book resource, not a front-door welcome

**What we transcend:**
- Audio — Daniela says the word; the student hears it before they read it, not after
- Live Q&A — Daniela actually asks and waits for a real answer, not an imagined one
- Adaptive sequencing — we do not have to teach everything in the same order to every student
- Chapter organization — we group by theme (which Madrigal couldn't do continuously) so students can navigate to what they need
- Images with color, motion, and cultural context — Warhol used black line drawings because that was what the medium allowed; we are not similarly constrained
- Infinite fillers — Madrigal could put four vocabulary items per page; we can present hundreds
- Feedback — the student knows if they got it right

The scan will help us understand the parts we're borrowing more precisely — especially the vocabulary sequencing decisions (what she chose to teach first and why) and the sentence frame patterns (which verb constructions recur most, which she used as anchor frames). Everything we have built stands. The scan makes the borrowed parts better.

**What the scan is NOT:**

Madrigal's vocabulary choices are a reference, not a specification. Two reasons we do not simply copy her content:

1. **ACTFL alignment is our design decision, not hers.** She wrote in 1962, thirteen years before ACTFL published its first proficiency guidelines. Her sequencing reflects intuition and experience — both excellent — but it was never mapped to "can-do statements" or Novice Low/Mid/High benchmarks. Our chapters were designed around ACTFL. Madrigal's content will inform our vocabulary choices; ACTFL governs our proficiency claims.

2. **Her book is deliberately mechanical — and that's a gap, not a feature.** The robotic quality is a strength for pattern-pounding and compartmentalization. But real language is not a robotic application of grammar rules. It has personality, cultural weight, humor, emotion, social risk. "¿Qué es el apio?" is a fine drill. It is not a conversation anyone has ever wanted to have. There is reportedly no greetings section in "See It and Say It" at all — which means the first thing any real human exchange requires (hello, nice to meet you, how are you actually doing) is something Madrigal never addressed. Our scenarios exist precisely because language lives in human interaction, not in vocabulary columns. Daniela's personality, the cultural spotlights, the conversation scenarios — these are not decoration on top of the method. They are where the method becomes a language rather than a grammar exercise.

---

### Book Structure — What the TOC Actually Tells Us

**Photographed:** April 11, 2026. File: `attached_assets/TOC_1775924828059.jpg`

The table of contents of *See It and Say It in Spanish* is one of the most important structural facts about the book, and it fundamentally shapes how HoloHola should adapt Madrigal's method.

---

**The actual structure of the book:**

| Section | Pages | Description |
|---|---|---|
| Pronunciation Guide | 8 | One page — phonetic key, nothing more |
| **Conversation Lessons** | **9–199** | **191 pages. No chapter titles. No theme labels. No subdivisions.** |
| Traveler's Handy Word Guide | 203–215 | 10 thematic reference lists (see below) |
| Grammar Section | 217–233 | AR / ER / IR verb tables, all tenses |
| Spanish-English Vocabulary | 233–252 | Alphabetical glossary |
| Index | 253+ | |

**The Traveler's Handy Word Guide sections (pp. 203–215):**
1. In the Restaurant (p. 203)
2. In the Hotel (p. 208)
3. In the Stores and Shops (p. 209)
4. The Numbers (p. 210)
5. The Days of the Week (p. 211)
6. The Months of the Year (p. 211)
7. The Seasons (p. 212)
8. Members of the Family (p. 213)
9. The Colors (p. 214)
10. Parts of the Body (p. 215)

---

**What this means:**

Madrigal did not organize her book by theme. Pages 9–199 are a single uninterrupted flow of progressive lessons with no chapter breaks, no unit labels, no "Week 1: Greetings" headers. The vocabulary accumulates. Each lesson assumes everything before it. The sequence is Madrigal's pedagogical decision — she chose what comes first, what comes next, and why. The themes emerge from the order of introduction, not the other way around.

**HoloHola's 5-chapter structure (greetings / family / numbers / daily / classroom) is entirely our own design.** It is not derived from Madrigal's sequencing. We extracted thematic clusters from her continuous lesson flow and organized them the way a digital app requires: discrete, navigable, self-contained units.

This is the right call — an app cannot be a 191-page scroll — but it means we are adapting her METHOD, not her SEQUENCE.

The distinction matters for the scan:
- We cannot expect the book to have a "greetings section" at page 9 and a "family section" at page 45. The content is woven together progressively.
- When we scan, we will be mining a continuous text for vocabulary clusters that belong to our thematic chapters, then extracting those and applying Madrigal's FORMAT (4-zone layout, image-first, Q&A drill, grammar notice) to our content.
- The vocabulary choices and sentence frames on the pages we find are her decisions about what a beginner needs first — those are worth respecting. But the chapter groupings are ours.

**The Traveler's Handy Word Guide (pp. 203–215) is the closest structural analog to what HoloHola does.** It groups vocabulary thematically (restaurant, hotel, family, numbers, colors) in short reference lists — the same organizational logic as our chapters. However it uses bare lists with no images and no drill structure, so it is a reference section, not a teaching section. Our chapter intros combine both: thematic grouping (from the Handy Guide's organizational logic) + drill format (from the Conversation Lessons' teaching method).

**The Grammar Section (pp. 217–233) maps to our Grammar Diagrams.** It is deliberately placed at the back — after 191 pages of encountering these patterns in context. You are not supposed to read it first. In HoloHola, Grammar Diagrams live behind a tap, not at the start of a lesson. This is the same decision.

---

**Practical implications for the scan (arriving ~April 14):**

1. **Do not look for chapter headers** — there are none. Instead, scan for when our target vocabulary first appears in the lesson sequence, and what page it's on.
2. **Track page numbers as rough difficulty indicators** — earlier pages = earlier in Madrigal's intended introduction sequence = simpler vocabulary.
3. **The Traveler's Handy Word Guide sections** (pp. 203–215) are worth scanning completely — they are the thematic reference clusters closest to our chapter structure and contain the canonical vocabulary lists for family, numbers, restaurant, hotel topics.
4. **Family vocabulary** specifically is on p. 213 — one page. Numbers on p. 210. These are Madrigal's choices for the minimal vocabulary set for each topic.
5. **For the Conversation Lessons (pp. 9–199)**, scan looking for when our theme words first appear — the Q&A page structure around them will give us the sentence frames, the verb forms, and the image subjects Madrigal chose for each concept.

---

### The Preface — Philosophical Alignment with HoloHola

**Analyzed:** April 10, 2026 (from physical copy photographed by David)

The preface of *See It and Say It in Spanish* reads almost like a product spec for HoloHola. Every major design decision in the book maps to a design decision already present in the app. The most striking overlap is that Madrigal articulated both the problem (grammar-rule frustration) and the solution (stealth acquisition through familiar patterns) in 1962, six decades before the research gave it a name.

---

**"Before he has gone very far, before he is even aware of it, he will be speaking Spanish."**

This is HoloHola's entire premise in one sentence. Daniela doesn't lecture — she talks. The student doesn't notice structure being taught because the structure arrives wrapped in a conversation they wanted to have. Grammar emerges from use. The student only discovers what they've learned when they look back.

---

**"The approach here is progressive. From the very beginning, the student is on familiar ground."**

Madrigal's first move is cognate recognition — showing English speakers how many Spanish words they already own. This is both a pedagogical tool and a psychological one: it dismantles the belief that Spanish is foreign before the student has read a single lesson. HoloHola's ACTFL Novice Low chapters implicitly rely on this but have never made it explicit. See Plan M6.

---

**"Anyone who has tried to learn by the laborious route of memorizing complex grammar rules, and has had to struggle with the numerous exceptions to these rules, will be pleasantly surprised..."**

This is the reason Daniela never opens a session by conjugating verbs. Grammar Diagrams exist in HoloHola as reference material the student reaches for when curious — they are never the primary instruction. Madrigal and HoloHola share the same pedagogy: grammar is a map you consult after you've already explored the territory on foot.

---

**"The method here followed makes the student WANT to learn."**

The Resonance Shelf tracks exactly this. When a particular conversational hook, cultural story, or vocabulary frame landed well for a specific student, Daniela remembers it and returns to that register. Making the student want to learn is not a side effect — it is the product.

---

**"The small drawings are there to make studying easier. With their help you can avoid doing difficult exercises and frustrating drills."**

This is Plan M5. Madrigal explicitly positioned her illustrations as a replacement for drills, not a supplement to them. A Sentence Frame Grid with no images is not Madrigal's method — it is the drill she was trying to eliminate. The visual anchoring is the mechanism.

---

**"You don't necessarily have to start with the first lesson. You can start wherever you wish. You can shift back and forth among the lessons; you can go on to a new lesson when you feel ready for it; you can study several lessons simultaneously, and you can keep on reviewing what you have learned, at your own convenience."**

This is the non-linear navigation principle that David has advocated for in HoloHola since the beginning. A well-structured lesson should work as the first lesson for a beginner *and* as a reference drill for an intermediate student returning to a chapter they thought they knew. Every chapter is a self-contained module, not a step in a locked sequence.

HoloHola already supports this architecturally — the ACTFL gauge shows level but doesn't lock chapter access. The chapter introduction, vocab grid, grammar diagram, conversation strips, and sentence frames are all independently useful at different stages. The principle should be documented as a first-class authoring rule: **design every lesson to stand alone**.

---

**"The most important aim of this book is to provide you with a book that will 'help you to help your students' master Spanish."**

Madrigal framed the teacher as a facilitator who uses the book as a tool, not a lecturer who delivers the content. In HoloHola this maps precisely: Daniela is the tool. The student directs the conversation. The tutor adapts.

---

**"The lessons are so presented that they can be easily adapted for dialogue teaching. You ask the questions and the student will be able to answer them."**

Every Daniela session is structured around this. She asks; the student answers. When the student is confident enough to ask questions back, that is a measurable breakthrough — it appears in the conversation context and the ACTFL scoring as a shift toward Novice High.

---

**Zero bloviation — a content authoring principle (noted April 10, 2026)**

The book is, in the words of the agent who first analyzed it, "ruthlessly minimalist." No academic preamble, no lengthy explanations of why the method works, no throat-clearing. Every sentence either teaches vocabulary, demonstrates a pattern, or builds confidence. Anything that does none of those three things is cut.

This is the model for HoloHola's chapter content. The risk in our narrative sections and welcome text is drift toward explanation-for-its-own-sake — writing that sounds educational without doing anything educational. The Madrigal test: read a sentence and ask which of the three jobs it is doing. If the answer is none, remove it.

Authoring rule: **every sentence in a chapter narrative must teach, demonstrate, or encourage — never all three at once, never none.**

The practical implication for HoloHola content: cultural spotlights, narrative section tips, and welcome text are the highest-risk areas for bloviation because they are prose rather than structured data. They should be reviewed against this standard. A tip that explains grammar in prose when a Grammar Diagram already shows it is redundant. A welcome text that describes what the student is about to learn instead of making them feel capable of learning it has the wrong job.

---

### What The Book Does (Core Pedagogy)

Madrigal's method rests on one insight: **grammar disappears when the frame never changes**. Every structural pattern is introduced once, demonstrated with multiple vocabulary fillers in the same page-spread, and never named as a grammar rule. The student internalises the frame through visual repetition and picture anchoring, not through explanation.

Six teachable patterns from the pages analysed:

1. **Pattern Repetition (Sentence Frame + Visual Fillers)**  
   One frame, 6-12 pictures, complete sentence shown under each image. Eg. *Va a tomar un ___* + taxi, tren, avión, autobús, café, sopa. The verb structure becomes automatic muscle memory; the student focuses on vocabulary.

2. **Full Q&A Pairs Under Images**  
   Each vocab card carries a model question and answer below the image: *¿Qué es el apio? El apio es una verdura.* Forces complete sentence production, not just word recognition. Meaningfully different from our current VisualVocabGrid which shows word + translation only.

3. **Minimal Conjugation Grid (4-cell, not 6)**  
   Madrigal's AR verb table is 4 cells: **yo → o**, **nosotros → amos**, **él/ella/usted → a**, **ellos/ustedes → an**. She deliberately omits the full 6-pronoun table at entry level. Learners encounter the pattern in context rather than as a paradigm to memorise.

4. **Gender Agreement Side-by-Side (estar expressions)**  
   A full page of *estar* adjective expressions shown as masculine/feminine pairs in two columns (contento/contenta, cansado/cansada, enfermo/enferma…). Visually establishes gender agreement as a natural word-pair, not as a rule to memorise.

5. **Verb-Object Drilling (same verb, many objects)**  
   The *tomar* pages group everything you can "take" — taxi, tren, avión, autobús, café, sopa, medicina — under a single verb frame. Vocabulary is organised by the verb it appears with, not just by topic category.

6. **Embedded Grammar Observations (post-example discovery)**  
   After showing a set of preterite examples, Madrigal adds a callout box: *"Notice that all the verbs in the questions end in ó. All the verbs in the answers end in é."* Rules are observed from data, never pre-stated. This is a different pedagogy from our current Grammar Diagrams (which state the rule first).

---

### Gap Analysis — What HoloHola Has vs. What's Missing

| Madrigal Pattern | HoloHola Status | Gap |
|---|---|---|
| Pattern Repetition / Sentence Frame Grid | **⬜ Built April 9, 2026** (see below) | None — now shipped |
| Full Q&A pairs under vocab images | **⬜ Not built** | VisualVocabGrid only shows word + translation; no Q&A production frame |
| Minimal 4-cell conjugation grid | **Partial** — VerbConjugationTable shows all 6 pronouns | Entry-level view could simplify to 4-cell for Novice Low |
| Gender agreement side-by-side | **Partial** — FormalInformalComparison handles Tú/Usted; no gender-pair adjective grid | No dedicated estar/adjective gender-pair component |
| Verb-object drilling | **Partial** — QuickPhraseGrid groups phrases by topic | No explicit verb-anchor grouping (all items that go with "tomar", etc.) |
| Embedded grammar observations (post-example discovery) | **Not built** | NarrativeSections exist but rules always precede examples; no discovery callout box |

---

### Sentence Frame Grid — Built April 9, 2026

**Component:** `SentenceFrameGrid` in `client/src/components/TextbookInfographics.tsx`  
**Data type:** `SentenceFrame[]` on `ChapterIntroContent.sentenceFrames` in `chapter-intro-content.ts`  
**Rendering:** After `culturalSpotlight` in `ChapterIntroduction.tsx`, inside a Card wrapper.

**Design:** Frame template shown as a header card with `___` highlighted in primary color. Below: responsive 2-4 column grid of filler cards — each shows the vocabulary word in large primary text, the full completed sentence with the filler word bolded, the English translation, and a TextAudioPlayButton. Hover-elevate on cards.

**Spanish data added (April 9, 2026):**

*Greetings chapter:*
- "Hoy estoy ___." × 8 emotional states (bien, mal, cansado, feliz, ocupado, enfermo, triste, nervioso)
- "Tengo que ir al ___." × 6 places (banco, parque, restaurante, hospital, supermercado, baño)

*Family chapter:*
- "Ella es mi ___." × 6 female relatives (madre, abuela, hermana, tía, prima, amiga)
- "Él es mi ___." × 6 male relatives (padre, abuelo, hermano, tío, primo, amigo)

**Extending to other chapters:** Add `sentenceFrames: [...]` to any chapter in `languageChapterData[language].chapters[chapterType]`. No code changes needed — the renderer is data-driven.

**Extending to other languages:** The component accepts `language` prop and passes it to `TextAudioPlayButton` for native-accent TTS. Add sentence frame data to the equivalent chapter in `languageChapterData['french']`, `languageChapterData['german']`, etc. — same interface, same renderer.

---

### Known Design Constraints (Noted April 9, 2026)

Three issues were identified immediately after shipping the first data set. These are guardrails for all future sentence frame authoring.

**Constraint 1 — Vocabulary must match the chapter it lives in**

The first draft placed "banco, parque, restaurante, hospital, supermercado" in the *Greetings* chapter under a "Tengo que ir al ___" frame. Those words are not in the greetings lesson — students have never seen them. This violates the Madrigal principle: the frame drills the structure, the fillers reinforce vocabulary the student *already knows from that chapter*.

Rule: every filler word in a `SentenceFrame` must be a word that appears in the lesson or chapter it is attached to. When authoring new frames, cross-reference the chapter's `conversationStrips` panels and its `quickPhrases` list to confirm the vocabulary is already present.

Corrected greetings data (April 9, 2026):
- Frame 1: "¡___, amigo!" — Hola, Buenos días, Buenas tardes, Buenas noches, Adiós, Hasta luego ✓ (all greetings-chapter words)
- Frame 2: "Estoy ___." — bien, muy bien, más o menos, mal, cansado, feliz ✓ (all ¿Cómo estás? responses from that chapter)

**Constraint 2 — Frame complexity must match ACTFL level**

"Tengo que ir al ___" (I have to go to the ___) is a *tener que* + infinitive construction — Novice High / Intermediate Low territory. It is not appropriate for a Level 1 / Novice Low chapter.

The simpler equivalent is "Voy a ___" (I'm going to ___) — *ir a* + destination is a single high-frequency pattern introduced in the very first lessons of most Spanish courses, and is the construction Madrigal herself uses on the transportation pages.

Rule of thumb for frame complexity by level:
- Novice Low / early Novice Mid: simple subject + verb ("Estoy ___", "Es mi ___", "¡___, amigo!")
- Late Novice Mid / Novice High: *ir a*, *tener*, *querer* + noun ("Voy a ___", "Tengo ___")
- Intermediate Low+: modal constructions, subjunctive cues ("Tengo que ___", "Quiero que ___")

**Constraint 3 — Images are fundamental, not optional (currently missing)**

Madrigal's method works because each filler card has a *picture* — the student maps directly from image to Spanish without routing through English. The current `SentenceFrameGrid` renders text-only cards, which means students are still reading an English translation to understand the filler word. This weakens the core mechanism.

This is a known gap. The component has an `imageKey` field stub on `SentenceFrameItem` (interface defined, not yet rendered). Before this component can be considered complete, every filler item needs:
1. A `imageKey` field populated with a value from the canonical vocabulary registry
2. The card to render the vocab image above the sentence (using the same object-storage URL pattern as `VisualVocabGrid`)
3. A fallback to large styled text if no image is available

Priority: **high** — without images, the Madrigal drill degrades to a phrase list, which we already have in `QuickPhraseGrid`. The visual anchoring is what makes it pedagogically distinct.

See Plan M5 below.

---

### Madrigal-Inspired Components — Status (updated April 10, 2026 session 42)

---

#### Quick status summary

| Plan | Component | Component built? | Data scope |
|------|-----------|:---:|---|
| M1 | VocabQAGrid | ✅ | ✅ All 10 languages — greetings + family + numbers + daily + classroom chapters |
| M2 | GenderAgreementGrid | ✅ | ✅ FR/PT/IT/HE/ES greetings + family; DE/JA/KO/ZH/EN intentionally empty |
| M3 | discoveryNote callout | ✅ | ✅ All 10 languages — greetings formal-informal section (session 45) |
| M4 | VerbAnchorGrid | ✅ | ✅ All 10 languages — greetings + family + numbers + daily + classroom chapters |
| M5 | SentenceFrameGrid images | ✅ | ✅ Complete — session 43 |
| M6 | CognateRecognitionGrid | ✅ | ✅ FR/IT/DE/ES greetings; ✅ PT/JA/KO/ZH/HE greetings (session 42); ⬜ EN |

**⏸ PAUSED — awaiting Madrigal book scan (expected ~week of April 14, 2026)**

Spanish chapter data (M1/M4 vocabQA + verbGroups) was seeded in the Madrigal spirit but from our own design — not from the actual book. Once the physical scan arrives, Spanish chapters should be reviewed and refined against the real vocabulary lists, sentence frames, and sequencing that Margarita Madrigal chose.

**Non-Spanish work that can proceed independently of the scan:**
- M2 gender pairs for numbers/daily chapters (FR/PT/IT/HE/ES)
- M3 discoveryNotes for non-Spanish languages (all chapters)
- M6 EN cognate data for Cindy/Blake (classroom/daily/numbers — international loanwords: café, taxi, hotel, radio)
- Image seeding pipeline for classroom vocabulary

**Spanish-specific work to hold until after scan:**
- Review/replace Spanish M1 vocabQA pairs to match the book's actual vocabulary choices
- Review/replace Spanish M4 verbGroup examples to match the book's sentence patterns
- M5 sentence frame fillers — use Warhol's chosen visual moments as the image prompt starting point (see line ~1773 for context)

---

### Pre-Scan Reference Images (13 pages photographed April 9, 2026)

All 13 images are in `attached_assets/`. Phone-camera shots — readable but not scan quality. The Monday scanner output will be the master reference. **Use these only for format/structure understanding, not pixel-level detail.**

---

#### THE FORMAT SYSTEM — How a Madrigal Page Is Built

Every drill page in the book is built from the same 4-zone layout. This consistency is itself pedagogical — the student's brain never has to figure out how to use the page.

**ZONE 1 — The Vocabulary Header (top ~15% of page)**
- Two-column block of vocabulary pairs, left and right sides of the page
- Format: `Spanish word/phrase, English translation` — Spanish in **bold**, English in regular weight
- These are the raw inputs — introduced as bare pairs before appearing in any sentence
- Always includes the verb infinitive + the key conjugated forms that will appear in the drill
- Example: `tomar, to take / ¿va a tomar? are you going to take / voy a tomar, I'm going to take` (left) and `una ensalada, a salad / chocolate, chocolate (drink)` (right)
- Small body type — roughly 9-10pt equivalent. No decoration, no box, just aligned pairs.

**ZONE 2 — The Illustrated Drill Grid (middle 60-70% of page)**
- A 2×2 grid of cells (occasionally 2×3 for pages with more vocabulary)
- Each cell = **image on top, text below** — always in that order, never reversed
- The image takes roughly 40-55% of each cell's height; the text takes the rest
- **Illustration style:** pure black ink line drawings on cream/off-white page — no fill, no shading, no color, no background. Objects drawn in 3/4 perspective, simplified but instantly recognizable. People have simple rounded heads, minimal facial features, expressive body language. The style is mid-century American illustration — not cartoonish but not realistic. Think Saul Steinberg without the irony.
- **Image subject matter:** each cell shows ONE object or ONE action — nothing compositionally complex. A taxi. A woman diving into water. A man at a desk. Never a scene with multiple focal points.
- **Two drill formats appear (sometimes mixed on the same page):**
  - *Q&A format:* Question in bold → Answer in bold, directly below. Two lines. "¿Va a tomar un taxi? / Sí, voy a tomar un taxi." The question uses usted/él/ella; the answer shifts to yo/nosotros.
  - *Statement format:* One sentence in bold below the image. "Quiero ir al parque." No question. Used when the page is building production vocabulary, not testing recognition.
- Equal white space between all four cells — the grid breathes

**ZONE 3 — The Text Extension Block (bottom ~15-20%, no illustrations)**
- Smaller type, no bold (or lighter bold than Zone 2)
- Lists additional examples using the same verb/structure — without images
- The student is expected to visualize these from memory
- Two sub-formats appear here:
  - *Additional vocabulary list:* "Tengo que ir al hotel. / Tengo que ir al hospital. / Tengo que ir al club."
  - *Conjugation expansion:* Shows other persons: "Queremos ir a la fiesta. / Queremos ir a la playa. / Van a tomar. / Vamos a tomar."

**ZONE 4 — The Grammar Notice (very bottom, appears on ~40% of pages)**
- Set in smaller, lighter type — often italics or a slightly smaller size
- Always begins with "Notice that..." — never "The rule is..." or "Remember..."
- Points at a pattern the student just saw demonstrated — never states it before the demonstration
- One or two sentences maximum
- Followed by a single practice question in both languages: "¿Va a hablar español? *Are you going to speak Spanish?*"
- Example: "Notice that all the verbs in the questions above end in ó. All the verbs in the answers end in é."
- Example: "Notice that the TO form of the verbs above ends in r."

**TYPOGRAPHY RULES (observed consistently across all pages):**
- **Bold = Spanish target language.** All Spanish — always bold, without exception
- Regular weight = English translation. The visual contrast does all the work — no color, no highlighting needed
- Sentence case throughout. No ALL CAPS headings anywhere in the lesson pages
- Page number bottom center, same small body type as Zone 3
- No rules, no borders, no background tints, no icons on lesson pages — the white space is the design

---

#### Image-by-Image Reference

| File | Page | Zone 1 header | Zone 2 grid format | Zone 3/4 |
|---|---|---|---|---|
| `1_1775836704664.jpg` | Preface | — | Dense prose, no images | Madrigal's method: progressive, familiar-first, one page per lesson. "The student is on familiar ground from the very beginning." |
| `new_1775836710104.jpg` | Intro (cont.) | — | Dense prose | "The small drawings are there to make studying easier." Each lesson = self-contained; can study in any order. For teacher: adapt for dialogue teaching, Q+A format. |
| `20260409_110822_1775755866475.jpg` | p. 40 | `tomar, to take / ¿va a tomar? / voy a tomar` (left); `una ensalada, a salad` etc. (right) | **Q&A format, 2×2:** taxi / train / airplane / bus. Question usted form, answer yo form. Images = side-profile line drawings of each vehicle | Zone 3: "Vamos a tomar, we are going to take / Van a tomar, they are going to take" — nosotros/ellos expansion, no images |
| `20260409_110831_1775755866474.jpg` | p. 41 | Note in prose: "In Spanish you do not say 'I'm going to have soup.' You say 'Voy a tomar sopa.'" | **Q&A format, 2×2:** coffee jug / ensalada / sopa bowl / celery. Same usted/yo pattern | Zone 4 at left margin: reminder note in prose (unusual placement — note runs vertically along left side) |
| `20260409_110915_1775755866474.jpg` | p. 58 | `ir, to go / quiero ir, I want to go` (left); `a, to / al, to the / al despacho, to the office` (right) | **Statement format, 2×2 + partial 3rd row:** park / cinema / theater / concert. Each image has single bold sentence below. No Q&A — production mode. | Zone 3: "Quiero ir al restaurante. / Quiero ir al hotel. / Quiero ir a México. / Quiero ir a París." then Q&A: "¿Quiere ir al parque? / ¿Quiere ir al teatro?" etc. |
| `20260409_110925_1775755866473.jpg` | p. 59 | `¿quiere ir? do you want to go / quiero ir, I want to go` (left); `a la fiesta, to the party / a la tienda, to the store / a la playa, to the beach` (right) | **Q&A format, 2×2:** fiesta (people dancing) / playa (diver) / tienda (display case) / casa (open book). usted Q, yo answer. **Bold italic on answer "Sí,"** then regular bold for the rest | Zone 3: "queremos ir" conjugation: "Queremos ir a la fiesta. / Queremos ir a la playa. / Queremos ir a la tienda. / Queremos ir a la casa." |
| `20260409_111001_1775755866472.jpg` | p. 52 | `tengo que ir, I have to go / al correo, to the post office` (left); `al, to the / al despacho, to the office` (right) | **Statement format, 2×2:** post office building / bank window / waiter walking / man at desk. Each gets one large bold sentence. **No Q&A on this page — pure production.** Images are larger than other pages — occupy more vertical space per cell | Zone 3: "Tengo que ir al hotel. / Tengo que ir al hospital. / Tengo que ir al club." then Q&A in both languages: "¿Tiene que ir? *Do you have to go?* / ¿Tiene que ir al correo?" |
| `20260409_111054_1775755866472.jpg` | p. 25 | `¿Qué es? What is?` centered at top. `una verdura, a vegetable / la zanahoria, the carrot` (left); `apio, celery / lechuga, lettuce` (right) | **Q&A format, 2×2:** celery / carrot / lettuce / tomato. Pure object illustrations — no person, no context. Question: "¿Qué es el apio?" Answer: "El apio es una verdura." Simple two-line exchange | Zone 3+4: "rojo, red" introduced as new vocabulary. Then: "¿Es rojo el tomate? Sí, el tomate es rojo." — a new mini-drill at bottom with no image, testing color adjective |
| `20260409_111123_1775755866471.jpg` | p. 142 | `jugué, I played / vi, I saw / trabajé, I worked / el jardín, the garden` (right column top). `¿Qué hizo? What did you do?` as question stem | **Q&A format, 2×2 — rotated 90° in photo:** tennis player / golfer / TV / garden/bed. Question uses hizo (he/she/did); answer uses jugué/vi/trabajé. Page also shows hacer conjugation box (hice/hizo/hicimos/hicieron) — a rare embedded table | Zone 3: "Hice limonada. / Hice mucho trabajo. / Hice la cama." etc. Full list of yo+hacer sentences without images |
| `20260409_111308_1775755866475.jpg` | Appendix | Centered heading: **LIST OF REGULAR "AR" VERBS** | **Conjugation grid** (the only 2D table format in all pages seen): `I | o | amos | we` / `you,he,she,it | a | an | you(pl)/they` — a 2×2 labeled grid showing stem+ending. Below: two-column verb list in alpha order, all bold Spanish + regular English | No Zone 4. Pure reference page — no drill, no images, no grammar note. |
| `20260409_111355_1775755866476.jpg` | p. 122 | `¿estudió? did you study? / ¿compró? did you buy?` etc. (left); `estudié, I studied / compré, I bought / pagué, I paid / nadé, I swam / una bata, a bathrobe` (right) | **Q&A format, 2×2:** man at desk studying / check/bill / swimmer underwater / coat hanging on rack. Pattern: usted Q (ó ending) / yo answer (é ending) — the visual contrast of ó vs é is the whole lesson | Zone 4: "Notice that all the verbs in the questions above end in ó. All the verbs in the answers end in é. In the past tense, AR verbs end in é when you speak of yourself, and ó when you speak of anyone else (singular)." — then: "Roberto nadó hoy. *Robert swam today.*" |
| `20260409_111420_1775755866476.jpg` | p. 112 | `voy a, I'm going (to) / estudiar, to study / hablar, to speak / en la clase, in the class / en la fiesta, at the party` (left); `cantar, to sing / comprar, to buy / bailar, to dance / español, Spanish` (right) | **Statement format, 2×2:** professor at lectern / dancers at party / students at desks / singer. Each gets one sentence: "Voy a hablar español en la clase." No Q&A — the page builds the voy a + infinitive construction through pure exposure | Zone 4: "Notice that the TO form of the verbs above ends in r. Examples: estudiar, TO study; hablar, TO speak; cantar, TO sing; comprar, TO buy." then: "¿Va a hablar español? *Are you going to speak Spanish?*" |
| `20260409_111437_1775755866476.jpg` | p. 81 | Centered heading: **EVERYDAY EXPRESSIONS** | **No images. Two-column text table**, no grid lines. Left = masculine forms, right = feminine forms. Bold Spanish on each line, regular English below. 10 pairs: contento/a, cansado/a, ocupado/a, enfermo/a, listo/a, solo/a, enojado/a, furioso/a, aburrido/a, enamorado/a | Zone 3: Additional estar expressions without gender distinction: "Está bien / mejor / mal / peor / con Roberto / triste / cómodo." Then: "Estamos contentos. / Están cansados. / Estoy contento. (man) / Estoy contenta. (woman)" — **the only page in these 13 with no illustrations at all** |

---

#### What HoloHola Must Replicate — The HOW

**Image cells:**
- Image always above text, never beside it
- Image = one subject, isolated, no background clutter
- Line illustration style (our watercolor variant should preserve the isolation and clarity — one subject, white/transparent background, no scene)
- Cell size consistent across the grid — equal breathing room between all four

**Text in drill cells:**
- Question bold, answer bold — two lines, nothing else
- No "Q:" or "A:" labels — the ¿? marks and "Sí," do all the work
- For statement-mode cells: one sentence, bold, full stop — nothing else

**The vocabulary header:**
- Always precedes the drill — raw pairs first, drill second
- Spanish bold + English regular, same line
- The verb always appears in at least two forms in the header: infinitive + first-person "I" form

**The grammar notice:**
- Bottom of card/page, smaller, lighter
- "Notice that..." — never "The rule is..."
- Only appears after the student has seen the pattern demonstrated four times
- One or two sentences max
- Followed by one practice prompt

**What NOT to carry over:**
- The extension text block (Zone 3) — our digital format lets us go deeper via interaction, not text lists
- The two-column gender table format (p. 81) — we replaced this with our M2 GenderAgreementGrid which is functionally equivalent but more scannable
- The appendix verb list — our VerbAnchorGrid replaces this with contextual examples rather than a bare list

---

### The Second Book — *Madrigal's Magic Key to Spanish*

**Photographed:** April 11, 2026  
**Files:** `attached_assets/1000012139_1775925912342.jpg` (p. 90), `attached_assets/1000012140_1775925912343.jpg` (verb list page)  
**Book:** *Madrigal's Magic Key to Spanish*, by Margarita Madrigal. A companion/sequel to *See It and Say It in Spanish*.

The two books represent different positions in the same learning arc. *See It and Say It* is conversation-first — the student speaks naturally before understanding why. *Magic Key* makes the structure explicit, using exercises and tables — but still through practice and self-discovery, never rule-recitation. Together they are the full pedagogy: first you feel the language, then you understand it.

HoloHola follows the same arc: Daniela's conversational sessions come first; Grammar Diagrams exist as the thing the student reaches for when they're ready to understand what they've already been doing.

---

#### Concept 1 — The Sentence-Forming Table (p. 90)

**What the page shows:**

A 4-column combination grid appearing under the heading **SENTENCE-FORMING EXERCISES**. The instruction: *"Combine the words below in different ways to form as many sentences as you can. Just be sure to use words from each of the columns in every sentence you form."*

Section A (question form):
- Col 1: `¿ / Va a` (fixed frame — question opener)
- Col 2: 8 verbs (comprar, trabajar, tomar, hablar, estacionar, estudiar, preparar, instalar)
- Col 3: 8 objects/contexts (una casa, mañana, la cena, por teléfono, el auto, la lección, el radio, un taxi)
- Col 4: 8 people (Roberto?, María?, Carlos?, Alicia?, el doctor?, su mamá?, su papá?, Marta?)

Section B (statement form):
- Col 1: 8 subjects (María, Carlos, Alicia, Marta, Roberto, El doctor, Mi mamá, Mi papá)
- Col 2: `va a` (fixed frame — the construction being drilled)
- Col 3: 9 verbs (exportar, importar, recitar, votar, copiar, visitar, aceptar, trabajar, tomar)
- Col 4: 8 objects (café, perfume, un poema, mañana, la lección, al paciente, la invitación, esta tarde, la cena, un taxi)

**The mathematical insight:**

Section A alone generates 8×8×8 = **512 unique valid questions** from one page. Section B generates 8×9×8 = **576 unique statements**. The student has over a thousand sentences available from a single page layout — without memorizing a single one. They are *generating* language, not recalling it.

**What this reveals about Madrigal's method:**

This is not drill-and-kill repetition. It is **combinatorial fluency practice** — the student internalizes that language is compositional. The same verb goes with different objects. The same object goes with different verbs. The frame (¿Va a...? / Subject + va a) holds constant while everything else rotates. The student stops thinking of sentences as units to memorize and starts thinking of them as things they can assemble from parts they own.

This is a fundamentally more powerful tool than our current M5 SentenceFrameGrid, which shows a fixed frame with one swappable column. Madrigal's version has **three or four swappable columns simultaneously**.

**What this means for HoloHola:**

Our M5 SentenceFrameGrid was designed as a single-slot fill-in structure — one fixed frame, one vocabulary column. The Magic Key shows us the extended version: multiple columns, each independently swappable, the student choosing freely from any combination. Daniela can implement this directly — she gives the frame, then asks the student to fill specific slots: "Tell me who. Now tell me what they're going to do. Now tell me what they're going to take." The student builds the sentence part by part, then Daniela responds to the full sentence they produced.

The translation exercise at the bottom adds the production layer: the student is given English sentences and must write Spanish using the column words as scaffolding. Daniela's equivalent: she says the English, the student produces the Spanish, she confirms. The columns are internalized support, not displayed scaffolding.

---

#### Concept 2 — The Cover-and-Check Method (verb list page)

**What the page shows:**

Five-step numbered procedure before a verb conjugation list:
1. Cover up the two right-hand columns
2. Remove "er" or "ir" from the infinitive in the left-hand column
3. Add "í" for "I"
4. Add "ió" for anybody else (third man)
5. Check your columns with those below

Then a three-column **VERB LIST**: INFINITIVES (bold italic Spanish + regular English) | I (yo past tense) | YOU, HE, SHE (él/usted past tense)

25+ ER/IR verbs: asistir/asistí/asistió, batir/batí/batió, confundir/confundí/confundió, etc.

**What this reveals about Madrigal's method:**

Three separate but related innovations on a single page:

**Innovation A — Algorithm over rule.** She does not say "the past tense of ER and IR verbs is formed by removing the infinitive ending and adding -í (yo) or -ió (él)." She gives a *numbered procedure*: cover, remove, add, add, check. A recipe, not a fact. The student follows steps, not memorizes a statement. The result is the same but the cognitive path is entirely different — procedural memory vs. declarative memory. Procedural memory is more durable.

**Innovation B — Active recall before confirmation.** The student is explicitly instructed to cover the answer columns and generate the form themselves before looking. This is self-testing built into a static page. Every cognitive science study of the last 30 years confirms that active generation beats passive reading by a factor of 2–3x for retention. Madrigal built this into a 1960 paperback without any of that research available to her.

**Innovation C — Minimum viable conjugation table.** She shows only two forms: I (yo) and he/she/you (él/ella/usted). Not the full 6-pronoun paradigm. This is the same deliberate choice she made in *See It and Say It* — beginners need I and he/she. The other forms can be derived once the pattern is clear. She never shows students more grammar than they need right now.

**What this means for HoloHola:**

The cover-and-check method is native to Daniela. She gives the infinitive. She waits. The student produces the conjugated form. She confirms or corrects. The student didn't read the answer — they generated it. This is already what Daniela does conversationally; the Magic Key confirms it's the right mechanism.

The algorithm framing (numbered steps) is something HoloHola has partially implemented in Grammar Diagrams but has not fully committed to. Grammar Diagrams currently show the pattern as a table. The Magic Key shows that a numbered procedure is more effective — it tells the student what to *do*, not just what the form *is*. This is worth applying to how Grammar Diagrams are written, not just structured.

The minimum viable conjugation principle (only yo and él/ella at first, not all six) should inform how VerbAnchorGrid presents verb information — show the two most useful forms prominently, defer the rest.

---

#### Concept 3 — The Pattern-Pounding Principle (David, April 11, 2026)

This is the insight that connects both exercises and explains why they work.

**The core mechanism:**

Traditional language teaching asks the student to memorize one verb across five or six conjugations:

> hablo / hablas / habla / hablamos / hablan

That is five separate facts attached to one word. The student has to hold the verb, the person, and the ending all simultaneously. It's fragile — if one element slips, the whole thing fails.

Madrigal's approach inverts this. Instead of drilling one verb in many forms, you drill **one form across many verbs**:

> Yo como. Yo nado. Yo corro. Yo compro. Yo estudio. Yo trabajo. Yo hablo. Yo tomo.

The student is not memorizing a conjugation table. They are having the **yo ending pounded into them** through dozens of encounters — each of which also happens to teach them a new verb. Two things are being reinforced simultaneously, but neither is being memorized as an isolated fact. The pattern (yo → -o for AR, -o for ER/IR) becomes automatic before the student has consciously registered that it exists.

The same mechanism operates in the past tense, the progressive, the future:
- Present: *como, nado, corro* → the -o is pounded in
- Past: *comí, nadé, corrí* → the -í is pounded in
- Future: *voy a comer, voy a nadar, voy a correr* → the *voy a* frame is pounded in

Each new verb the student learns is not a new piece of grammar to master — it is a new repetition of the same ending they've already been internalizing. The grammar load is fixed; only the vocabulary expands.

**Why the sentence-forming table works:**

The permutation table gives the student 512+ sentence combinations from a single page. The mathematical insight from the previous section (8×8×8) understates the pedagogical power. The real power is that every one of those 512 sentences pounds in the same construction — *¿Va a + verb + object + person?* — while incidentally introducing new vocabulary. The student is not drilling grammar. They are drilling vocabulary. The grammar is a byproduct of the repetition.

As each new word the student learns gets inserted into the same cognitive frame, the frame strengthens. The student doesn't learn "va a comprar" and "va a estudiar" as two separate phrases. They learn that *va a* is a slot, and anything that fits in a verb slot can go there. The grammar becomes a pattern-matching system rather than a lookup table.

**Why the cover-and-check verb list works:**

The five-step procedure hammers the same two endings (-í for yo, -ió for él) across 25+ verbs in a single sitting. By the time the student has covered and derived asistir → asistí / asistió, and then batir → batí / batisfió, and confundir → confundí / confundió, and repeated this for 22 more verbs — those endings are not memorized. They are *installed*. The student stopped consciously thinking about the ending after the fifth or sixth verb. The procedure runs automatically.

**What this means for HoloHola:**

The acquisition unit is **one grammatical pattern across many vocabulary items**, not **one vocabulary item across many grammatical forms**.

This has direct implications for how Daniela drills and how chapter content is structured:

1. **Daniela should drill by conjugation form, not by verb paradigm.** When introducing past tense, she doesn't conjugate one verb completely. She takes the student through ten verbs in yo-past: "¿Estudiaste? Sí, estudié. ¿Comiste? Sí, comí. ¿Nadaste? Sí, nadé." The -é ending is pounded in by the tenth exchange. The student has learned ten verbs and one conjugation, simultaneously, without ever looking at a table.

2. **The VerbAnchorGrid (M4) should show the anchor verb alongside several others in the same form.** Currently it shows one verb with examples. The pattern-pounding principle says: show the yo form of the anchor verb, then immediately show five other verbs in the same form. The anchor is the entry point; the cluster reinforces the pattern.

3. **The sentence-forming table is the native format for Daniela's oral drills.** She keeps the frame constant (*¿Va a...?*) and rotates the vocabulary. The student answers by inserting different words into the same slot. By the fifth rotation, the frame is automatic. By the fifteenth, the student is generating new combinations without prompting.

4. **Every new vocabulary word a student learns is a free repetition of every grammar pattern they've already absorbed.** This is the real return on investment of Madrigal's method — the student's vocabulary and grammar reinforce each other rather than competing for cognitive load. HoloHola should be designed so that new vocabulary is always introduced inside a known frame, never as an isolated word to be memorized.

---

#### Concept 4 — Compartmentalization and the Unlock Effect (David, April 11, 2026)

This is the compounding consequence of the Pattern-Pounding Principle. It explains why the method accelerates rather than plateaus.

**Compartmentalization:**

When you pound the yo form across thirty verbs, you are not building a list of thirty facts. You are building one compartment — a single cognitive container labeled "yo" — that holds thirty vocabulary items, all already conjugated. The ending is not a property of each verb; it is a property of the compartment. The student doesn't think "como ends in -o." They think "the yo compartment sounds like this."

Every new verb added to the compartment costs less than the one before it, because the student isn't learning a new ending — they're placing a new word into a container whose shape they already know.

**The Unlock:**

When Daniela then says — after the yo compartment has thirty verbs in it — *"just change the -o to -as"* for tú, something remarkable happens. The student is not learning thirty new verb forms. They are applying one transformation to an entire compartment they already own.

The tú compartment doesn't cost thirty units of learning. It costs **one**: the ending change. All thirty verbs come with it, instantly, as a group. The previous repetition on yo is not abandoned — it is **unlocked in a new form**.

The same unlock happens for él/ella (-a), nosotros (-amos), and ellos (-an). Each costs only one ending change. Each unlocks the full reservoir that pounding has been building since the beginning.

**The sentence-forming table becomes permanently reusable:**

The same four-column table — the same verbs, the same objects, the same frame — works for every person:
- Section A with *¿Va a...?* → unlock with *¿Vas a...?* → same 512 permutations, new person
- Section B with *María va a...* → unlock with *Yo voy a...* → same vocabulary, different ending

The student never needs a new table. They need a new key. Each key unlocks all previous work.

**The compounding return:**

This is the reason the method accelerates rather than plateaus. In a traditional course, learning tú costs exactly as much as learning yo — you start over with a new paradigm row. In Madrigal's method:

- Week 1: pound yo. Install 20 verbs in one compartment.
- Week 2: unlock tú. 20 verbs arrive free. Install 5 more in both compartments simultaneously.
- Week 3: unlock él. 25 verbs arrive free. Install 5 more in all three compartments simultaneously.
- Week 6: unlock nosotros. Now 40 verbs in four compartments, each new verb added goes into all four automatically.

By week 6, each new vocabulary word the student learns is **simultaneously a repetition of four different conjugation patterns**. The grammar load per new word approaches zero. Only the vocabulary cost remains.

**What this means for HoloHola:**

1. **Daniela introduces persons as unlocks, not new lessons.** The framing matters: "You already know all of these in yo. Here's one change that lets you use all of them with tú." Not "today we learn the tú form." She is handing the student a key to a room they've already furnished.

2. **The sequence is fixed by this logic.** You cannot unlock a compartment before building it. The person order matters: pound yo first, then unlock tú, then él, then nosotros, then ellos. This is not arbitrary — it reflects how the compounding effect works. Skipping yo to start with nosotros means there's nothing to unlock.

3. **Grammar Diagrams should be reframed as unlock events.** Instead of presenting the full 6-row paradigm as a table to read, they should present one transformation: "You know yo. Here is the key to tú." Then show only the two rows being connected — yo and tú — not all six. The others become their own unlock events when the student is ready.

4. **Each chapter chapter's VerbAnchorGrid (M4) is building a compartment.** The anchor verb is the one the student encounters most. The cluster of examples in the same form are the other verbs going into the same compartment. The M4 grid is not a vocabulary list — it is a compartment display.

5. **The unlock effect applies across tenses as well as persons.** Once the student has the yo present compartment (como, nado, corro), Daniela can unlock past: "just change -o to -é." Thirty present-tense verbs become thirty past-tense verbs for the cost of one transformation. Then progressive: "add estoy + the verb with -ando." Same thirty verbs, new tense, one cost.

---

#### Concept 5 — The Assessment Shift: Permutation as Proof (David, April 11, 2026)

This redefines what Daniela is listening for in every conversation. It is not what most language tools measure.

**The wrong metric:**

> "Did the student conjugate *comer* correctly?"

This is the metric used by grammar checkers, conjugation quizzes, and most language apps. It is not wrong — correct conjugation matters — but it is measuring the wrong thing. A student can memorize "como" and get it right every time without having installed the yo compartment at all. They just memorized one word.

**The right metric:**

> "Is the yo form of AR/ER verbs stable across all contexts?"

Stability means:
- The yo ending holds when the **verb changes** (como → nado → corro — does the -o stay automatic?)
- The yo ending holds after **negation appears** (como → no como — does the -o survive "no"?)
- The yo ending holds when **distraction is introduced** (a new subject is mentioned, then Daniela returns to yo — does the student track person correctly?)
- The yo ending holds when **vocabulary is unfamiliar** (a new verb is introduced in the infinitive — can the student produce the yo form without being taught it explicitly?)

The last one is the gold standard. If a student hears "bailar, to dance" for the first time and immediately says "bailo" when asked how they would say "I dance" — the compartment is installed. They didn't memorize "bailo." They derived it. The compartment is working.

**Permutation is the proof:**

A student who can permutate freely proves installation. A student who answers correctly once proves nothing. The distinction:

- *Correct once*: Student says "como" when asked "how do you say I eat?" — could be memorized.
- *Permutates*: Student says "como, nado, corro, compro, estudio" fluidly across a conversation without hesitation on each new verb — the compartment is installed.
- *Survives load*: Student says "no nado" correctly after just saying "como" — the yo form held through negation.
- *Derives new forms*: Student hears "bailar" and produces "bailo" — the compartment is generative, not just a list.

The sentence-forming table (Concept 1) is specifically designed to test permutation under controlled conditions. But Daniela does it conversationally — she varies the verb across a dozen natural exchanges and watches whether the ending stays automatic or requires visible effort each time.

**What Daniela is actually listening for:**

Daniela is not a grammar checker. She is a **pattern stability detector**. In every exchange involving a conjugated verb, she is running a silent diagnostic:

1. **Did the ending hold under this new verb?** — If yes, the compartment may be installed. If the student pauses noticeably or produces the infinitive instead, the compartment is still fragile.
2. **Did the ending hold through polarity change?** — Affirmative to negative is a classic disruption point. "I eat" → "I don't eat." Students who have only memorized the affirmative often lose the ending when "no" appears.
3. **Did the ending hold when the conversation moved away and returned?** — If Daniela talks about something else for several exchanges and then returns to yo, does the student still produce the right ending without effort?
4. **Can the student fill multiple slots simultaneously?** — In the sentence-forming table, can they produce subject + va a + verb + object without breaking form on any column? Simultaneous slot-filling proves that the frame is automatic, not constructed one piece at a time.

**How this changes Daniela's conversational strategy:**

When Daniela detects **wobble** (the ending drops or reverts to infinitive when the verb changes), she does not correct and move on. She returns to pounding. She cycles the same person form through several more verbs before introducing anything new. She is building the compartment back up to stability before loading it with new vocabulary.

When Daniela detects **stability** (the ending holds under load, across verbs, through negation), that is the signal to introduce the unlock. She presents the new person form as a transformation of something the student already owns solidly — not as a new lesson, but as a key.

When Daniela detects **derivation** (the student produces a correct form for a verb they've never seen conjugated), that is the signal that the compartment is fully operational. She can now accelerate — new vocabulary costs almost nothing, and unlocking new persons will happen quickly.

**The metric is reusability, not accuracy:**

A student who gets every conjugation right in a quiz may have memorized thirty individual forms. A student who can permutate across thirty verbs in yo and derive the form for a thirty-first verb they've never seen — that student has learned Spanish. The quiz cannot distinguish between them. Daniela's conversational pattern detection can.

This is the core assessment philosophy for HoloHola. It must flow into:
- Daniela's system prompt: she knows what she is listening for and why
- The conversation scoring model: permutation events and derivation events are higher-signal than single correct responses
- The ACTFL gauge advancement: a student who demonstrates permutation in yo form has cleared a real threshold, not just answered a question correctly

---

#### Concept 6 — The Trimodal Advantage: What Madrigal Could Never Do (David, April 11, 2026)

This is the competitive moat. It is not a feature list — it is a description of a combination that has never existed before.

---

**What the books could not do:**

*See It and Say It in Spanish* needed 199 pages of conversation lessons because it had no generative capability. Every permutation the student would ever need had to be pre-printed. Each column of vocabulary had to be physically typeset. Every new vocabulary set required new pages, a new print run, a new edition. The book is 300 pages because 300 pages was the only way to cover enough ground.

And it still ran out. No feedback loop meant the book could never know which compartments were installed and which were fragile. No personalization meant a 14-year-old soccer fan got the same columns as a 60-year-old traveler (taxi, restaurant, post office). No audio meant the student was imagining pronunciation, which is exactly where Spanish anxiety originates. No dynamic generation meant that when the student mastered one set of columns, the only option was to turn the page to a new set that Madrigal had designed years earlier.

---

**What HoloHola does that is categorically different:**

**1. The Visual Brain Dump — eye scanning at reading speed**

The sentence-forming table works at a speed that verbal instruction cannot match. When a student sees four columns of eight words each, the brain does not read them sequentially. It scans the entire grid in seconds and begins pattern-matching and permutating before consciously processing each item. The eye takes in "comprar / trabajar / tomar / estudiar" as a group — a vocabulary cluster — not as four separate words to be processed one at a time. This is reading-speed pattern acquisition. It is fundamentally faster than listening to four words spoken in sequence.

Madrigal understood this — it is the core reason her books are organized in columns and grids rather than in paragraphs. The column format is not aesthetically preferred; it is cognitively optimized. The student's visual system does the heavy lifting at a rate that speech cannot replicate.

**2. Daniela's Infinite Dynamic Column Generation — personalization at conversation speed**

Madrigal's columns were fixed at the moment of printing. "Taxi. Tren. Avión. Autobús." Those four words were chosen for a 1960s American traveler. They were the best choices for that student. They are not the best choices for every student.

Daniela generates new columns in real time, at conversation speed, tailored to the individual student. A student who loves cooking gets food vocabulary in the verb column. A student who plays sports gets sports verbs. A teenager gets the vocabulary they actually want to use. An executive gets professional contexts. The frame (*¿Va a + verb + object + person?*) stays identical — only the vocabulary in each column changes. The grammar pounding happens regardless of which vocabulary fills the slots.

The columns are not just personalized at setup — they adapt within a session. When Daniela detects that the student knows "comprar" cold but is hesitating on "estudiar," she generates more drill sentences with "estudiar" until the compartment strengthens. She effectively edits the column in real time based on what she is observing.

**3. Audio Confirmation — ear reinforces what the eye absorbed**

The student sees "nado" in a column. Their visual system registers it in passing as part of a cluster. Then Daniela says "nado" in a sentence — and the ear confirms what the eye already half-processed. The multi-channel encoding is significantly more durable than either channel alone. The student did not study "nado." They absorbed it visually, then heard it spoken in context, then produced it themselves in response to Daniela's question. Three encoding events for one word, in one exchange.

Madrigal had none of this. The student read. That was the entire sensory experience. Everything else — the mental image, the pronunciation, the response — had to be imagined.

**4. The Feedback Loop — adaptation based on what the student actually does**

When the student wobbles on a verb form, Daniela detects it and responds. When the student derives a new form correctly, Daniela names it and accelerates. When a student's interest shifts mid-session, Daniela rotates the vocabulary columns to match. The book never knew if anyone learned anything.

This feedback loop is what makes the method *compound* in real time, for this specific student, in this specific session. It is not just more efficient than the book — it is doing something the book was structurally incapable of doing.

---

**The combination:**

| Capability | See It and Say It | Magic Key | HoloHola |
|---|:---:|:---:|:---:|
| Visual column scanning (brain dump) | ✅ | ✅ | ✅ |
| Dynamic column generation | ✗ | ✗ | ✅ |
| Personalization to student interests | ✗ | ✗ | ✅ |
| Audio reinforcement | ✗ | ✗ | ✅ |
| Real-time feedback loop | ✗ | ✗ | ✅ |
| Pattern stability detection | ✗ | ✗ | ✅ |
| Infinite permutation capacity | ✗ | ✗ | ✅ |
| Unlock sequencing adapted to individual | ✗ | ✗ | ✅ |

Madrigal solved half the problem brilliantly with the tools she had. HoloHola completes the other half with tools she didn't have. The student gets the full method: visual pattern acquisition at reading speed, audio confirmation, dynamic vocabulary tailored to their life, a tutor who knows which compartments are installed and which need more pounding, and an infinite sentence-generating engine that never needs a new edition.

This combination cannot be replicated by a book, a static app, or a non-adaptive AI. It requires all four capabilities simultaneously. Daniela has them all.

---

#### Concept 7 — Mastery Enables Improv: Bring What You Got (David, April 11, 2026)

This is the destination that all the previous concepts are building toward. It is also a core HoloHola philosophy that must be understood by Daniela and reflected in every session design.

---

**The paradox of robotic mastery:**

The pattern-pounding approach sounds mechanical. It is mechanical — deliberately so. Pounding one conjugation form across thirty verbs until the ending is automatic is as non-spontaneous as practicing scales on a piano. But that is precisely the point. The musician who has practiced scales until their fingers move without thought is the one who can improvise. The musician who is still consciously thinking about where their fingers go cannot improvise at all — every bit of cognitive bandwidth is consumed by technique.

Language works the same way. A student who has the yo compartment installed — truly installed, not memorized — is no longer spending attention on conjugation. That attention is freed for something far more interesting: what they actually want to say. The grammar becomes transparent. The student stops being a grammar student and starts being a Spanish speaker who happens to use correct grammar.

**Mechanical mastery creates cognitive freedom. Robotic drilling enables organic conversation.**

---

**Permutation confidence = willingness to experiment:**

A student who knows they can mix and match — any verb from what they've installed, any object from what they know, any person from the compartments they've unlocked — is a student who is willing to try things. They don't need to know in advance that the sentence they're about to say is correct. They know that if the frame is right and the components are known, the sentence will work. So they try it.

This is the opposite of the paralysis most language learners experience: *"I can't say it until I know how."* The pounding-and-permutation method produces the opposite belief: *"I'll try it with what I have."* That belief is what enables conversation. Real conversation is not recall of memorized phrases — it is real-time construction from available components. Students who know how to permutate are already doing the cognitive work of a fluent speaker. They just need more vocabulary loaded into the compartments.

---

**"Bring what you got" — a HoloHola philosophy:**

The student does not wait to be fluent before speaking. They speak with what they have. Every session with Daniela is an opportunity to bring the vocabulary that is installed and use it — in new combinations, in response to unexpected questions, in topics the student actually cares about. The goal is not to execute perfect sentences from a rehearsed list. The goal is to keep the conversation moving using whatever is available.

Daniela's role in improv mode is to respond to meaning, not to police form. When a student is in improv mode — trying new combinations, taking conversational risks, constructing sentences they've never said before — Daniela does not stop to correct every small error. She responds to what the student meant, keeps the conversation alive, and lets the student feel what it is to use the language spontaneously. Error correction is for pounding sessions. Improv sessions are for deploying what's been installed.

The more the student permutates in improv sessions, the more Daniela can observe which compartments are genuinely solid and which ones are still fragile under creative pressure — which is a richer diagnostic than any structured drill provides.

---

**The accelerating cycle:**

Pounding builds compartments → compartments unlock freely → permutation confidence grows → student takes more risks → more improv practice → more opportunities for Daniela to detect wobble and stability → more targeted pounding → stronger compartments → more relaxed improv.

The cycle is self-reinforcing. Each phase feeds the next. And the student's experience of this cycle is not "I am doing drills and then having conversations." It is simply "I am getting better faster than I expected, and I don't know exactly why."

That "I don't know why" is Madrigal's original insight, alive in a new medium. The student is not aware they are learning grammar. They are aware they are speaking Spanish — and that each session, they have more to say.

---

#### The Two-Book Relationship — What It Tells Us About Sequencing

| | *See It and Say It in Spanish* | *Madrigal's Magic Key to Spanish* |
|---|---|---|
| Primary mode | Implicit acquisition through conversation | Explicit pattern recognition through exercise |
| Grammar explanation | None — grammar is demonstrated, never named | Named, but reached through procedure not rule |
| Drill type | Image-anchored Q&A (one slot, one question) | Combinatorial table (multi-slot, student-generated) |
| Self-testing | None built in — student imagines the answer | Cover-and-check explicitly built into page design |
| Intended student | Complete beginner — speaks before understanding | Student who speaks fluently and wants to understand why |

This is the arc that HoloHola naturally creates:
1. Student enters → Daniela converses → patterns are absorbed implicitly (= *See It and Say It* mode)
2. Student gains confidence → reaches for Grammar Diagrams → wants to understand the system (= *Magic Key* mode)
3. Grammar Diagrams exist as reference, not instruction — you go there when you're curious, not when you arrive

The danger to avoid: treating Grammar Diagrams as onboarding. They are the *Magic Key* — earned, not given. Daniela should lead with conversation and let the student discover grammar is available when they want it.

---

**Plan M1 — VocabQAGrid ✅ COMPLETE**

Built `VocabQAGrid` component in `TextbookInfographics.tsx`. Sky-blue accent, "full sentences" badge. Each card shows: question (italic/muted), answer (bold, play button), translation (below divider). Wired in `ChapterIntroduction.tsx`.

*Data seeded — greetings chapter:*

| Language | Q&A pairs | Key question |
|---|---|---|
| Spanish | 6 | ¿Cómo te llamas? / Mucho gusto / ¿Qué tal? |
| French | 6 | Comment vous appelez-vous? / Comment ça va? |
| Portuguese | 6 | Como se chama? / Tudo bem? |
| German | 6 | Wie heißen Sie? / Wie geht es Ihnen? |
| Italian | 6 | Come si chiama? / Come stai? |
| Japanese | 5 | はじめまして / お元気ですか？ |
| Korean | 5 | 이름이 뭐예요? / 어떻게 지내세요? |
| Mandarin | 5 | 你叫什么名字？ / 很高兴认识你。 |
| Hebrew | 5 | מה שמך? / מה נשמע? |
| English | 5 | What's your name? / How are you? |

*Data seeded — family chapter (session 42):*

| Language | Q&A pairs | Key question |
|---|---|---|
| French | 5 | Vous avez des frères et sœurs ? / Vos parents habitent où ? |
| German | 5 | Haben Sie Geschwister? / Wo wohnen Ihre Eltern? |
| Italian | 5 | Hai fratelli o sorelle? / Dove abitano i tuoi genitori? |
| Japanese | 5 | 兄弟姉妹はいますか？ / ご両親はどこにお住まいですか？ |
| Korean | 5 | 형제자매가 있어요? / 부모님은 어디에 사세요? |
| Mandarin | 5 | 你有兄弟姐妹吗？ / 你父母住在哪里？ |
| Portuguese | 5 | Você tem irmãos ou irmãs? / Onde moram seus pais? |
| English | 5 | Do you have brothers or sisters? / Where do your parents live? |
| Hebrew | 5 | יש לך אחים או אחיות? / איפה גרים ההורים שלך? |

*Data seeded — numbers chapter (session 43–44):* vocabQA (age/cost/time/counting/phone) + verbGroups for all 10 languages. Anchor verbs: tener/avoir/avere/ter (age), sein (DE), あります/います (JA), 이에요/예요 (KO), 有 (ZH), to be (EN), יש/אין (HE).

*Data seeded — daily chapter (session 46):* vocabQA (time/day/greeting/routine/availability) + verbGroups (anchor: "to do/make") for all 10 languages. ES: hacer, FR: faire, DE: machen, IT: fare, JA: します, KO: 이해하다/해요, ZH: 做, PT: fazer, EN: to do, HE: לעשות.

*Data seeded — classroom chapter (session 46):* vocabQA (repeat/how-do-you-say/understand/correct/meaning) + verbGroups (anchor: "to understand") for all 10 languages. ES: entender, FR: comprendre, DE: verstehen, IT: capire, JA: わかります, KO: 이해하다, ZH: 明白, PT: entender, EN: to understand, HE: להבין.

---

**Plan M2 — GenderAgreementGrid ✅ COMPLETE**

Built `GenderAgreementGrid` component. Two-column masculine/feminine table with **language-specific frame text** (session 41: ChapterIntroduction.tsx updated to pass per-language frames via inline record). Session 42 added `genderFrame?: { masculine; feminine }` field to `ChapterIntroContent` interface so each chapter can override the default language frame — critical for family chapters where the frame is "C'est mon ___." not "Il est ___." Violet accent. Translation key row at bottom. Wired in `ChapterIntroduction.tsx`.

*Data seeded — greetings chapter:*

| Language | Pairs | Notable teaching point |
|---|---|---|
| Spanish | 6 | estar adj: contento/a, cansado/a, ocupado/a, enfermo/a, nervioso/a, emocionado/a |
| French | 5 | être adj: joyeux/joyeuse, fatigué/fatiguée, occupé/occupée, **malade×2** (invariable!), nerveux/nerveuse |
| Portuguese | 6 | estar adj: **contente×2**, cansado/a, ocupado/a, **doente×2** (both invariable — contrast with Spanish) |
| Italian | 6 | essere adj: contento/a, stanco/a, occupato/a, malato/a, nervoso/a, emozionato/a |
| Hebrew | 5 | שמח/שמחה, עייף/עייפה, עסוק/עסוקה, **חולה×2** (invariable!), עצבני/עצבנית |
| German | — | Predicate adjectives don't inflect after *sein* — skip, no data needed |
| Japanese | — | No grammatical gender |
| Korean | — | No grammatical gender |
| Mandarin | — | No grammatical gender |
| English | — | No grammatical gender |

*Data seeded — family chapter (session 42):* genderFrame + genderPairs for FR/IT/PT/HE/ES (noun pairs, not adjectives — mon père/ma mère etc.); no genderPairs for DE/JA/KO/ZH/EN.

| Language | Family pairs | Frame used |
|---|---|---|
| Spanish | 5 | "Él es mi ___." / "Ella es mi ___." |
| French | 5 | "C'est mon ___." / "C'est ma ___." |
| Italian | 5 | "Lui è mio ___." / "Lei è mia ___." |
| Portuguese | 5 | "Ele é meu ___." / "Ela é minha ___." |
| Hebrew | 5 | "הוא ___ שלי." / "היא ___ שלי." |

*Data pending:* numbers/daily chapter gender pairs; discoveryNotes.

---

**Plan M3 — discoveryNote callout ✅ COMPONENT COMPLETE / ⬜ DATA PARTIAL**

Added `discoveryNote?: string` to `NarrativeSection` in `ChapterIntroContent`. Rendered as sky-blue callout with BookOpen icon and "Notice:" prefix — distinct from amber `tip` callout. Wired in `ChapterIntroduction.tsx`.

*Data seeded:* Spanish greetings only — "Notice: usted shares its verb ending with él and ella…"

*Data pending:* discoveryNotes for all 9 non-Spanish languages (requires reading each language's narrative sections to find the right attachment point).

---

**Plan M4 — VerbAnchorGrid ✅ COMPLETE**

Built `VerbAnchorGrid` component. Verb anchor card (large primary text + Repeat2 icon + "Verb Anchor" badge) + grid of example tiles (object word large/primary, full phrase small/secondary, translation muted, play button). Supports multiple verb groups per chapter. Wired in `ChapterIntroduction.tsx`.

*Data seeded — greetings chapter:*

| Language | Verb | verbHint highlight |
|---|---|---|
| Spanish | estar | "estar captures a temporary state — how something IS right now" |
| French | être | "être links you to descriptions — Madrigal calls this the identity bridge" |
| Portuguese | estar | "estar captures how something is right now — feelings, health, situations in flux" |
| German | sein | "sein links you to descriptions and identities — just as ser does in Spanish" |
| Italian | stare | "Italian uses stare, not essere, for how you feel" (key Madrigal distinction) |
| Japanese | です (desu) | "です ends nearly every polite Japanese sentence — the politeness seal" |
| Korean | 이에요/예요 | "이에요 follows consonants; 예요 follows vowels — covers half of all Korean introductions" |
| Mandarin | 是 (shì) | "是 links two equal things — I = student. For qualities, Chinese uses a different structure" |
| Hebrew | להיות (zero copula) | "In Hebrew present tense, 'to be' disappears entirely" (zero-copula discovery) |
| English | to be | "Every greetings answer in English uses 'to be'" |

*Data seeded — family chapter (session 42):*

| Language | Verb | Key pedagogical note |
|---|---|---|
| French | être | C'est mon père / Ce sont mes parents — singular vs. plural "c'est" |
| German | sein | Das ist mein Vater — mein/meine articles show up here |
| Italian | essere | È mio padre / È mia madre — possessives without article (unlike French) |
| Japanese | です (desu) | 父です vs. お父さんです — uchi/soto register distinction |
| Korean | 이에요/예요 | 아버지예요 (vowel) vs. 학생이에요 (consonant) rule in family context |
| Mandarin | 是 (shì) | Birth-order precision: 哥哥/弟弟/姐姐/妹妹 — no single word for sibling |
| Portuguese | ser | Ele é meu pai / Ela é minha mãe — ser for identity (not estar) |
| English | to be | He is / She is / They are — plural grandparents example |
| Hebrew | — (zero copula) | הוא אבא שלי — present-tense identity; שלי = "of me/mine" |

*Data pending:* numbers/daily chapter verb groups for all languages.

---

**Plan M5 — Image Integration for SentenceFrameGrid ✅ COMPLETE (session 43)**

The current `SentenceFrameGrid` is text-only. Madrigal's method is fundamentally image-driven — each filler card should show a picture so the student maps directly from image to Spanish without routing through English. Without images the drill degrades to a phrase list, which `QuickPhraseGrid` already provides.

Add an optional `imageKey?: string` field to `SentenceFrameItem` (already in the interface spec). When present, the card renders the vocab image from object storage at the top using the same URL pattern as `VisualVocabGrid`. Fallback: large styled filler text if no image is available.

**Implementation complete (session 43):**

1. **`imageKey?: string` field added** to `SentenceFrameItem` interface in both `chapter-intro-content.ts` and `TextbookInfographics.tsx`
2. **`GET /api/textbook/vocab-images-by-keys?keys=...`** — new batch endpoint added to `server/routes.ts`. Queries `media_files` WHERE `search_query IN (keys)` using the static `mediaFiles` schema import + `inArray` from drizzle-orm. Returns `{ images: { [key]: { url, source } } }`. Cap: 40 keys per request.
3. **`SentenceFrameGrid` updated** — collects all unique imageKeys across all frames, issues a single batch query, renders a `h-24` image container at the top of each card (animate-pulse skeleton while loading; first-letter initial if key has no image in DB). Filler text font size scales down slightly when image slot is present to maintain card proportion.
4. **Spanish greetings data updated** — all 12 filler items now carry `imageKey`:
   - Frame 1 ("¡___, amigo!"): hola/buenos dias/buenas tardes/buenas noches/adios/hasta luego → images confirmed in DB from GREETINGS_WORDS seed
   - Frame 2 ("Estoy ___."): bien/muy bien/mas o menos/mal/cansado/feliz → cansado + feliz confirmed in DB; others have graceful fallback
5. **Spanish family data updated** — all 12 filler items now carry `imageKey`:
   - Frame 1 ("Ella es mi ___."): madre/abuela/hermana/tia/prima/amiga → madre + hermana confirmed in DB
   - Frame 2 ("Él es mi ___."): padre/abuelo/hermano/tio/primo/amigo → padre + hermano confirmed in DB
6. `mediaFiles` added to static `@shared/schema` import in routes.ts; shadowing local variable at `/api/media/my-uploads` renamed to `userMediaFiles`

**Fallback contract:** when an `imageKey` has no match in `media_files`, the component shows the first letter of the filler word (large, muted primary) in the image slot — the card degrades gracefully and remains fully functional.

Authoring note: for the greetings "¡___, amigo!" frame, images would show time-of-day scenes (sunrise = Buenos días, afternoon sun = Buenas tardes, etc.) — these do not yet exist and would need to be generated.

**Image quality principle (noted April 10, 2026):**

Madrigal's book illustrations were drawn by Andy Warhol, working as a commercial illustrator before his Pop Art career. He was technically capable of far more sophisticated work and chose simple line drawings deliberately. The pedagogical reason is clear in retrospect: a realistic image competes with the language. The student's eye starts reading the picture instead of the word. A simple outline of a telephone says "telephone" and immediately gets out of the way.

The implication for HoloHola: the bar for SentenceFrameGrid images is *concept clarity*, not *visual quality*. A student needs to look at the card and know what the filler word means in under one second — then their attention returns to the sentence frame structure, which is the point of the drill. Our AI-generated watercolor images already meet this bar; the abstracted style removes detail that would distract.

**The one failure mode to avoid:** an image that is ambiguous at a glance. If "cansado" (tired) produced an image that could mean "bored" or "sad" instead, the drill misfires. This is an authoring and generation prompt problem, not a rendering quality problem. Choose concepts that have unambiguous visual representations. When in doubt, test by showing the image without the word and asking whether the meaning is immediate.

**Scanned pages as prompt fodder (noted April 10, 2026):**

David is scanning pages from the physical book. The scans are not being used to copy the images directly (copyright, and our watercolor style is better suited to HoloHola anyway). They are being used as a reference for *which moment in a concept is worth illustrating*.

This is a more useful kind of visual reference than a stock image library. Warhol's choices reveal the image that makes a word unambiguous — not the object itself, but the action or relationship that carries the meaning. A picture of a car is just a car. A picture of someone stepping out of a car at an airport tells you *viajar* (to travel) without a single word.

When generating images for M5 sentence frame fillers: look at the scanned page for the corresponding concept first. Use Warhol's chosen moment as the starting point for the AI generation prompt. The goal is not to match his style but to match his instinct about *what to show*.

**Plan M6 — CognateRecognitionGrid ✅ COMPONENT COMPLETE / ⬜ DATA PARTIAL**

Madrigal's preface opens by showing how many English words the student already owns in Spanish — this is both a pedagogical move and a psychological one. The student's belief that "Spanish is foreign" is dismantled before lesson one.

**Component:** `CognateRecognitionGrid` built in `TextbookInfographics.tsx` (session 40). Tiled grid of word-pair cards — English small/secondary → target-language large/primary. Category-grouped. Supports a `target?: string` field on each entry so any language can supply its own word instead of `spanish`. Component reads `entry.target ?? entry.spanish` for multi-language support. False friends rendered with distinct red "false friend" badge and `falseCognateNote` tooltip.

**Optional field:** `cognateOpener?: CognateEntry[]` on `ChapterIntroContent`. Each `CognateEntry`: `{ english, spanish?, target?, category, isFalseCognate?, falseCognateNote? }`.

**Data seeded — greetings chapter:**

| Language | Cognates | False friends | Status |
|---|---|---|---|
| Spanish | 18 (hotel, taxi, restaurant, sport, possible, important, excellent…) | 3 (embarazada, librería, actual) | ✅ |
| French | 18 (hôtel, taxi, restaurant, concert, possible, important, excellent…) | 3 (actuel, sensible, rester) | ✅ |
| Italian | 18 (hotel, pizza, radio, studio, importante, naturale, originale…) | 3 (camera, sensibile, attualmente) | ✅ |
| German | 18 (Hotel, Sport, Tennis, Internet, Computer, Moment, Telefon…) | 3 (aktuell, sympathisch, sensibel) | ✅ |
| Portuguese | 18 (hotel, táxi, restaurante, possível, importante, excelente, natural…) | 3 (polvo, borracha, pretender) | ✅ session 42 |
| Japanese | 17 (katakana: ホテル, タクシー, レストラン, コーヒー, テレビ, バス, スポーツ…) | 2 (マンション≠mansion, スマート≠smart) | ✅ session 42 |
| Korean | 17 (konglish: 호텔, 택시, 레스토랑, 커피, 텔레비전, 버스, 스포츠…) | 2 (핸드폰=cell phone, 아이쇼핑=window shopping) | ✅ session 42 |
| Mandarin | 15 (phonetic loans: 咖啡, 巧克力, 沙发, 比萨, 汉堡, 吉他, 幽默, 浪漫…) | 0 (no convenient false-friend category) | ✅ session 42 |
| Hebrew | 16 (international loans: טלפון, טלוויזיה, קפה, פיצה, בנק, ספורט, מוזיקה…) | 0 | ✅ session 42 |
| English | — | — | ⬜ Pending (English-as-L2 cognate strategy differs; Cindy/Blake context) |

*Note on non-Romance languages:* Japanese/Korean "cognates" are actually phonetic loans (katakana/konglish) rather than structural cognates — the component can still be used but the educational framing must change from "same spelling" to "same sound." This is a design decision to make when authoring the data.

**Non-linear navigation alignment:** Because each lesson is designed to stand alone, this card works at any ACTFL level — a Novice Low student gets the confidence rush, an intermediate student returning to the chapter gets a foundation reminder.

---

## Daniela Future Architecture — Brain/Hands/Session Separation

**Established:** April 12, 2026  
**Source:** Anthropic Engineering Blog — "Scaling Managed Agents: Decoupling the brain from the hands" (Lance Martin, Gabe Cemaj, Michael Cohen). Article saved at `attached_assets/Pasted-Skip-to-main-contentSkip-to-footer-Engineering-at-Anthr_1776010078392.txt`

This section documents where HoloHola's architecture should evolve, based on the Managed Agents pattern. Nothing here is built yet — this is the target architecture as we understand it today.

---

### The Brain/Hands/Session Framework Applied to HoloHola

The article identifies three components that should be decoupled into stable interfaces:

**Session** → the durable record of everything that happened, queryable selectively, living outside any individual Claude call.  
**Brain (harness)** → the reasoning and decision layer. Stateless; can fail and restart without losing session state because state lives in the session.  
**Hands (sandbox/tools)** → the execution layer. Each tool is `execute(name, input) → string`. The brain doesn't know or care what the hands are made of.

**For HoloHola:**

| Managed Agents concept | HoloHola equivalent |
|---|---|
| Session log | Student session state: compartment installation map, wobble events, Resonance Shelf, ACTFL position, pounding history |
| Brain (harness) | Daniela — the pedagogy reasoning layer |
| Hands (tools) | M1–M6 components, image pipeline, pronunciation model, ACTFL gauge, scoring model, sentence frame generator |
| `getEvents()` | Daniela queries the student's compartment state to decide: pound / unlock / improv |
| `execute(name, input) → string` | Every Daniela tool call: generate vocab grid, retrieve image, evaluate pronunciation, update ACTFL |

---

### The Stale Harness Problem

Harnesses encode assumptions about what the current model can't do on its own. Those assumptions go stale as models improve.

**Article example:** Claude Sonnet 4.5 exhibited context anxiety — wrapping up tasks prematurely as context limit approached. The harness added automatic context resets. When the same harness ran on Claude Opus 4.5, the behavior was gone. The resets had become dead weight.

**Applied to Daniela's system prompt:** Daniela's instructions are her harness. Instructions written to compensate for known model weaknesses become constraints on a more capable model. Instructions like "after every answer, explicitly check whether the student is ready to continue" may become unnecessary as models develop better natural pacing. Instructions like "do not attempt more than two vocabulary items in one exchange" encode assumptions that better models won't need.

**Design principle going forward:** Write Daniela's instructions around stable pedagogical goals, not model-compensating rules.
- **Stable goal (good):** "The unit of teaching is one grammatical pattern across many verbs, not one verb across many forms."
- **Model-compensating rule (goes stale):** "After each third response, summarize what the student has learned so far." — this may be compensating for context that a better model handles naturally.

Every instruction in Daniela's system prompt should be audited: *Is this a pedagogical principle that would be true regardless of which model runs it? Or is this compensating for something the current model struggles with?* The first category is durable. The second is dead weight waiting to happen.

---

### What Should Live Outside Daniela's Context Window

Currently all student state lives inside Daniela's context window. This is the "pet" problem — one context fill-up away from losing everything. The session state that should be externalized:

**Compartment installation map** — per-pattern status: `unstarted | pounding | wobbling | stable | generative`
- Examples: `yo-AR-present: stable`, `tú-AR-present: pounding`, `él-AR-present: unstarted`
- This is what Daniela uses to decide mode. It doesn't currently exist as a data structure.

**Pounding history** — which verbs have been drilled, in which form, how many times, last wobble timestamp

**Resonance Shelf** — vocabulary and phrases that had strong positive responses (student lit up, asked to hear it again, used it spontaneously). Already named in multiple sessions; not yet persisted outside the conversation.

**ACTFL position** — current level + trajectory (improving / plateauing / regressing per component)

**Wobble log** — timestamped record of every pattern instability event. Daniela should be able to query "has the yo form wobbled in the last 10 minutes?" without needing that data in her active context.

**Session metadata** — total session time, mode distribution (pounding vs. improv minutes), most recent unlock event

When this state lives in durable external storage, Daniela can run long sessions without context pressure, a session can resume after interruption without losing diagnostic history, and multiple session events can be aggregated over time to identify slow-developing weaknesses the student doesn't know they have.

---

### Daniela's Three Modes (not yet implemented)

The seven pedagogical concepts describe two Daniela modes; the full picture is three:

**Pounding mode**
- Triggered by: wobble detected, new compartment being built, student explicitly requests drilling
- Behavior: drill one grammatical pattern across many vocabulary items; correct form precisely; do not let inaccurate forms pass; rotate verbs not persons; detect stability before exiting
- Exit condition: stability across at least 3 unseen verbs (derivation achieved); OR student fatigue signal

**Unlock mode**
- Triggered by: stability confirmed in one person; next person in sequence not yet introduced
- Behavior: frame the new person as "you already own this — just change the ending"; demonstrate the transformation on 2–3 verbs from the existing compartment; let the student apply it before adding new vocabulary
- Duration: brief — unlock is a moment, not a session; transitions directly to pounding for the new person
- Key framing: "the key to tú costs one change and opens everything you already built"

**Improv mode**
- Triggered by: multiple compartments confirmed stable; student begins generating novel combinations; student takes conversational initiative
- Behavior: respond to meaning not form; keep the conversation alive; let errors pass unless they create communication failure; treat what the student produces as data, not as a test
- What Daniela listens for in improv: creative pressure reveals which compartments are genuinely solid vs. fragile — richer diagnostic than pounding alone
- Exit condition: wobble appears under creative pressure → return to targeted pounding for that compartment only

**Mode is not binary.** A session can open in improv (student is warmed up, wants to talk), dip into pounding when a wobble appears, hit a brief unlock moment, and return to improv — all in one conversation.

---

### Multi-Model Routing (future target)

Once brain/hands separation is clean, Daniela as orchestrator can route different tasks to the most appropriate model. This is the "many brains, many hands" principle from the article.

| Task | Appropriate model profile |
|---|---|
| Pattern stability detection | Small, fast, structured-output — runs continuously, classifies wobble/stable/generative |
| Improv conversation | Best available model — needs contextual richness, cultural awareness, nuanced response |
| Pronunciation evaluation | Audio-specialized model |
| Sentence frame generation | Structured-output optimized |
| Image key resolution | Retrieval, not generation — cached DB query |
| ACTFL gauge update | Structured-output + rules-based threshold logic |

No routing exists today. Everything goes through one Claude call. As the component count grows, the routing benefit grows proportionally — Daniela's core reasoning stays focused on pedagogy while specialized tools handle execution at the right cost/capability tradeoff.

---

### Cultural Character Image Audit (Rule 5 follow-on)

**Status:** ⬜ Not started
**Depends on:** Plan #5 canonical registry completing first

The canonical registry (Plan #5) will identify all tier-3 (SCENE_OVERRIDE) concepts. Currently every tier-3 image uses Spanish characters — Daniela and Marco. A French student seeing `bonjour` should see Juliette, not Daniela. The audit determines how many new images that actually means, and what generating them costs.

**The audit answers four questions:**

1. How many tier-3 concepts exist per language (current rough estimate: ~100 concepts × 8 non-Spanish languages = ~800 image slots)
2. Which are **pure character swaps** — same scene, just swap `CHAR.ES.primary → CHAR.FR.primary` — these can be batch-generated efficiently since only the character description changes
3. Which require **scene-level rewrites** — a Spanish plaza background is wrong for a French street scene even with a French-looking character; these need prompt authoring before generation
4. What the DALL-E budget looks like broken out by language priority

**Character profile map (for prompt templating):**

| Key | Characters | Cultural coding |
|-----|-----------|----------------|
| `CHAR.ES` | Daniela / Marco | Spanish/Latin American |
| `CHAR.FR` | Juliette / Antoine | French, Parisian styling |
| `CHAR.DE` | Anna / Stefan | German |
| `CHAR.IT` | Giulia / Luca | Italian |
| `CHAR.PT` | Sofia / Rafael | Brazilian Portuguese |
| `CHAR.JA` | Yuki / Kenji | Japanese |
| `CHAR.KO` | Soo-Jin / Ji-Ho | Korean |
| `CHAR.ZH` | Mei / Wei | Mandarin Chinese |
| `CHAR.HE` | Noa / Eitan | Israeli Hebrew |

**Recommended sequencing:** Complete Plan #5 (canonical registry) first so the audit runs against an authoritative list. Do not start generating language-specific character images until the registry tells us exactly which ones are needed — otherwise we risk generating images for concepts that will later be reclassified to tier 2 (shared) and can be served by the existing Spanish image anyway.

