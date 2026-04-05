# Visual Asset Roadmap
## HolaHola — Pre-Generated Visual Library

**Created:** March 15, 2026  
**Last updated:** March 20, 2026  
**Referenced by:** `docs/curriculum-strategy.md` (Section 8)  
**Component coverage manifest:** `docs/textbook-component-coverage.json` (machine-readable, Lyra-monitored)  
**Status column key:** ⬜ Planned | 🔄 Generating | ✅ In Library

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

