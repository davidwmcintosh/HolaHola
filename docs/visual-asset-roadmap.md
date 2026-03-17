# Visual Asset Roadmap
## HolaHola — Pre-Generated Visual Library

**Created:** March 15, 2026  
**Referenced by:** `docs/curriculum-strategy.md` (Section 8)  
**Status column key:** ⬜ Planned | 🔄 Generating | ✅ In Library

This document is the master list of every visual asset we intend to pre-create for the platform. Assets fall into eight categories. The goal is not to be exhaustive on day one — it's to be deliberate: the right visuals for the words and concepts students absolutely must learn, generated ahead of time so Daniela can surface them instantly.

Visual assets live in the `visual_assets` table. Grammar/infographic SVGs are generated as React components in `TextbookInfographics.tsx`. Prop room backgrounds live in `visual_environments`.

---

## Platform Status Snapshot

**Last audited:** March 17 2026

### Interactive Canvas — What's Built

The `SceneCanvas` component (client-side stage model) is **fully operational**. Section 9 of this document described it as "not yet built" — that is now out of date.

| Capability | Status | Notes |
|---|---|---|
| `open_scene(environment)` | ✅ Built | Loads background, clears existing scene |
| `add_to_scene(prop, position)` | ✅ Built | Overlays transparent PNG at zone coordinates |
| `remove_from_scene(prop)` | ✅ Built | Fades out and removes prop layer |
| `set_clock(time)` | ✅ Built | SVG analog clock with rotating hands — **fantastic** |
| `clear_scene()` | ✅ Built | Removes all props, keeps background |
| `highlight_body_part(part)` | ⬜ Not built | Body diagram SVG — planned |
| `fill_conjugation(row, value)` | ⬜ Not built | Conjugation table fill-in — planned |
| `highlight_country(country)` | ⬜ Not built | World map SVG — planned |
| `set_calendar(day, month)` | ⬜ Not built | Calendar SVG — planned |
| Emotion face SVG | ⬜ Not built | Planned |
| Thermometer SVG | ⬜ Not built | Planned |
| Weather icon SVG set | ⬜ Not built | Planned (also useful as static images) |

### Image Library — What Exists

| Category | Records in DB | With actual images | Notes |
|---|---|---|---|
| Food vocabulary | 1,176 | 20 | 1,156 entries are text/translation metadata only — images not yet generated |
| Scene canvas props | ~40 | ~40 | glass, fork, book, stethoscope, passport, etc. — all have real images |
| Vocabulary images (Section 1) | 0 | 0 | Nothing generated yet |
| Time/weather/numbers (Section 2) | 0 | 0 | Clock handled by SVG component; others not started |
| Cultural infographics (Section 5) | 0 | 0 | Not started |

**What this means for generation priority:** The food menu images are the most visible gap — the menus are live, students can open them, but ~98% fall back to placeholders. Core vocabulary images (Section 1) are entirely absent. Everything else in this roadmap is genuinely planned but not started.

---

## Philosophy

Language learning has two visual use cases:

1. **Word → Image**: Student hears or reads a word and needs to see what it looks like. This is vocabulary acquisition. Images here must be clean, consistent, and instantly recognizable — no ambiguity.

2. **Concept → Diagram**: Student is trying to understand HOW the language works. No image of a cup teaches "preterite vs imperfect." These need diagrams — timelines, maps, tables — that make abstract grammar visible and spatial.

Both live in this roadmap. Neither is a substitute for the other.

**Personal vocabulary** (words students guide Daniela into teaching based on their own interests) is intentionally NOT in this list. Those generate on-demand via `generate_visual`. This list is the required core — the vocabulary every student at every level must know, regardless of what they personally care about.

---

## Section 1 — Core Vocabulary Images (by ACTFL Level)

Format: illustrated watercolor style, same as the current prop library.
Organization: thematic clusters. A student at Novice Low needs the Novice Low cluster plus everything below.

### Novice Low — Survival Essentials

**People**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| mother | madre | ⬜ | |
| father | padre | ⬜ | |
| brother | hermano | ⬜ | sibling pair image? |
| sister | hermana | ⬜ | |
| baby | bebé | ⬜ | |
| boy/child | niño | ⬜ | |
| girl/child | niña | ⬜ | |
| man | hombre | ⬜ | |
| woman | mujer | ⬜ | |
| friend | amigo/amiga | ⬜ | |
| teacher | profesor/a | ⬜ | |
| student | estudiante | ⬜ | |

**Places**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| house/home | casa | ⬜ | exterior view |
| school | escuela | ⬜ | |
| classroom | aula | ⬜ | already have environment bg |
| restaurant | restaurante | ⬜ | already have environment bg |
| park | parque | ⬜ | already have environment bg |
| hospital | hospital | ⬜ | exterior |
| supermarket | supermercado | ⬜ | exterior |
| bathroom | baño | ⬜ | |
| bedroom | dormitorio | ⬜ | already have environment bg |
| kitchen | cocina | ⬜ | already have environment bg |

**Things — Classroom/Home**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| book | libro | ✅ | in prop library |
| backpack | mochila | ✅ | in prop library |
| pencil | lápiz | ⬜ | |
| pen | bolígrafo | ⬜ | |
| desk/table | mesa | ⬜ | |
| chair | silla | ⬜ | |
| door | puerta | ⬜ | |
| window | ventana | ⬜ | |
| phone | teléfono | ✅ | cell_phone in prop library |
| water | agua | ⬜ | glass of water |

**Things — Food Basics**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| bread | pan | ✅ | bread_basket in prop library |
| milk | leche | ⬜ | glass + carton |
| apple | manzana | ✅ | in prop library |
| banana | plátano/banana | ✅ | in prop library |
| egg | huevo | ⬜ | |
| rice | arroz | ⬜ | bowl of rice |
| coffee | café | ✅ | in prop library (multiple) |
| water | agua | ✅ | glass in prop library |

**Activities (simple verbs — illustrated as action)**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| to eat | comer | ⬜ | person eating |
| to drink | beber | ⬜ | person drinking |
| to sleep | dormir | ⬜ | |
| to read | leer | ⬜ | |
| to write | escribir | ⬜ | |
| to walk | caminar | ⬜ | |
| to run | correr | ⬜ | |
| to talk | hablar | ⬜ | |
| to listen | escuchar | ⬜ | |
| to play | jugar | ⬜ | |

---

### Novice Mid — Building Blocks

**People (community)**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| grandfather | abuelo | ⬜ | |
| grandmother | abuela | ⬜ | |
| uncle | tío | ⬜ | |
| aunt | tía | ⬜ | |
| cousin | primo/prima | ⬜ | |
| neighbor | vecino/a | ⬜ | |
| doctor | médico/a | ⬜ | in white coat |
| nurse | enfermero/a | ⬜ | |
| police officer | policía | ⬜ | |
| cook/chef | cocinero/a | ⬜ | |

**Animals**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| dog | perro | ⬜ | |
| cat | gato | ⬜ | |
| bird | pájaro | ⬜ | |
| fish | pez | ⬜ | in water; pez vs pescado distinction |
| horse | caballo | ⬜ | |
| cow | vaca | ⬜ | |
| sheep | oveja | ⬜ | |
| bear | oso | ⬜ | |
| duck | pato | ⬜ | |
| rabbit | conejo | ⬜ | |

**Fruits & Vegetables**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| orange | naranja | ⬜ | |
| strawberry | fresa | ⬜ | |
| grape | uva | ⬜ | cluster |
| watermelon | sandía | ⬜ | |
| lemon | limón | ⬜ | |
| tomato | tomate | ⬜ | |
| carrot | zanahoria | ⬜ | |
| lettuce | lechuga | ⬜ | |
| potato | papa/patata | ⬜ | regional note |
| onion | cebolla | ⬜ | |
| garlic | ajo | ⬜ | |
| corn | maíz | ⬜ | |

**Clothing**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| shirt | camisa | ⬜ | |
| pants/trousers | pantalón | ⬜ | |
| dress | vestido | ⬜ | |
| shoes | zapatos | ⬜ | pair |
| hat | sombrero | ⬜ | |
| jacket | chaqueta | ⬜ | |
| socks | calcetines | ⬜ | |
| skirt | falda | ⬜ | |

**Activities**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| to buy | comprar | ⬜ | person at store |
| to pay | pagar | ⬜ | |
| to cook | cocinar | ⬜ | |
| to clean | limpiar | ⬜ | |
| to swim | nadar | ⬜ | |
| to dance | bailar | ⬜ | |
| to sing | cantar | ⬜ | |
| to paint | pintar | ⬜ | |

---

### Novice High — Travel & Social Life

**Places (travel)**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| hotel | hotel | ⬜ | exterior |
| airport | aeropuerto | ⬜ | already have env bg |
| train station | estación de tren | ⬜ | |
| beach | playa | ⬜ | |
| mountain | montaña | ⬜ | |
| museum | museo | ⬜ | |
| pharmacy | farmacia | ⬜ | |
| bank | banco | ⬜ | |
| library | biblioteca | ⬜ | |

**Transportation**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| bus | autobús | ⬜ | |
| train | tren | ⬜ | |
| airplane | avión | ⬜ | |
| bicycle | bicicleta | ⬜ | |
| car | coche/carro | ⬜ | regional note |
| boat | barco | ⬜ | |
| taxi | taxi | ⬜ | |
| subway/metro | metro | ⬜ | |
| motorcycle | motocicleta | ⬜ | |
| walking (on foot) | a pie | ⬜ | illustrated as feet walking |

**Professions**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| waiter/waitress | camarero/a | ⬜ | |
| shop clerk | dependiente/a | ⬜ | |
| firefighter | bombero/a | ⬜ | |
| journalist | periodista | ⬜ | |
| lawyer | abogado/a | ⬜ | |

---

### Intermediate Low — Daily Life & Body

**Body Parts**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| head | cabeza | ⬜ | part of body diagram |
| arm | brazo | ⬜ | |
| leg | pierna | ⬜ | |
| hand | mano | ⬜ | |
| foot | pie | ⬜ | |
| eye | ojo | ⬜ | |
| ear | oído/oreja | ⬜ | both terms |
| mouth | boca | ⬜ | |
| nose | nariz | ⬜ | |
| heart | corazón | ⬜ | |
| stomach | estómago | ⬜ | |
| back | espalda | ⬜ | |
| knee | rodilla | ⬜ | |
| shoulder | hombro | ⬜ | |

*Note: Body diagram image (full outline labeled in Spanish) counts as one image but covers all terms.*

**Health**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| pill/tablet | pastilla | ⬜ | already have medicine_bottle prop |
| injection/shot | inyección | ⬜ | |
| prescription | receta médica | ✅ | prescription_pad in prop library |
| thermometer | termómetro | ✅ | in prop library |
| bandage | venda | ⬜ | |
| appointment | cita médica | ⬜ | calendar/clock visual |

**Home Rooms & Furniture**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| living room | sala de estar | ⬜ | already have env bg |
| kitchen | cocina | ⬜ | already have env bg |
| bedroom | dormitorio | ⬜ | already have env bg |
| bathroom | baño | ⬜ | already have env bg |
| garden/yard | jardín | ⬜ | |
| bed | cama | ⬜ | |
| sofa | sofá | ⬜ | |
| wardrobe | armario | ⬜ | |
| refrigerator | refrigerador | ⬜ | |
| stove | estufa/cocina | ⬜ | |
| washing machine | lavadora | ⬜ | |

---

### Intermediate Mid — Broader World

**Nature & Environment**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| tree | árbol | ⬜ | |
| flower | flor | ⬜ | |
| river | río | ⬜ | |
| lake | lago | ⬜ | |
| sea | mar | ⬜ | |
| forest | bosque | ⬜ | |
| desert | desierto | ⬜ | |
| volcano | volcán | ⬜ | |
| cloud | nube | ⬜ | weather section also |
| sun | sol | ⬜ | |
| moon | luna | ⬜ | |
| star | estrella | ⬜ | |

**Emotions**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| happy | feliz/alegre | ⬜ | face + scene |
| sad | triste | ⬜ | |
| angry | enojado/enfadado | ⬜ | regional note |
| afraid | asustado | ⬜ | |
| surprised | sorprendido | ⬜ | |
| embarrassed | avergonzado | ⬜ | NOT embarazada — false cognate |
| tired | cansado | ⬜ | |
| excited | emocionado | ⬜ | |
| nervous | nervioso | ⬜ | |
| bored | aburrido | ⬜ | |

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
| 0–10 illustrated cards | Each numeral with illustrated objects (3 apples, 7 stars) | Novice Low | ⬜ |
| 11–20 pattern card | Illustrated grouping showing the 11–19 pattern (diez + ...) | Novice Low | ⬜ |
| Tens 10–100 grid | Visual grid: 10, 20, 30... 100 with pattern highlight | Novice Mid | ⬜ |
| Hundreds & thousands | Scale card: 100, 500, 1,000, 10,000, 1,000,000 with real-world size anchors (people, city, country) | Novice High | ⬜ |
| Ordinals 1st–10th | primero, segundo... with illustrated podium/ranking | Novice Mid | ⬜ |
| Phone/address number reading | Illustrated guide to how numbers appear in real-life context (phone numbers said in pairs) | Intermediate Low | ⬜ |
| Price & currency visual | Price tags in different currencies (pesos, soles, euros) with "¿Cuánto cuesta?" | Novice High | ⬜ |

### Time

> **Note (March 17 2026):** The interactive SVG analog clock (`set_clock`) is fully built in `SceneCanvas`. For lesson interactions, Daniela uses the live clock — no static image needed. The static reference cards below are for the textbook/reference view and are lower priority as a result.

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Analog clock face — hour | Static reference card — live clock handles lesson use | Novice Low | ⬜ lower priority |
| Analog clock face — half/quarter | Static reference card | Novice Mid | ⬜ lower priority |
| Clock face — full grid | 12 clocks on one reference card | Novice Mid | ⬜ lower priority |
| AM/PM scene strip | Morning → afternoon → evening → night with time expressions | Novice Low | ⬜ |
| Days of the week card | lunes → domingo visual strip (Mon-start calendar format) | Novice Low | ⬜ |
| Months of the year card | enero → diciembre in circular calendar format | Novice Low | ⬜ |
| Four seasons illustrated | primavera, verano, otoño, invierno — each as a mini landscape scene | Novice Mid | ⬜ |
| Duration expressions timeline | hace dos años, desde hace, hace + time — horizontal timeline diagram | Intermediate Low | ⬜ |
| Daily routine timeline | levantarse → desayunar → ... → acostarse shown as timeline with clock icons | Intermediate Low | ⬜ |
| Tense timeline overview | past ←—— present ——→ future with verb tense markers | Intermediate Low | ⬜ |

### Weather

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Sunny / soleado | Illustrated weather icon — warm scene | Novice Low | ⬜ |
| Cloudy / nublado | Illustrated | Novice Low | ⬜ |
| Rainy / lluvioso | Illustrated — rain falling | Novice Low | ⬜ |
| Snowy / nevado | Illustrated | Novice Low | ⬜ |
| Stormy / tormentoso | Lightning + dark clouds | Novice Mid | ⬜ |
| Windy / ventoso | Illustrated — leaves blowing | Novice Mid | ⬜ |
| Foggy / neblinoso | Illustrated | Novice Mid | ⬜ |
| Hot / caluroso | Illustrated — sun + person sweating | Novice Low | ⬜ |
| Cold / frío | Illustrated — person in coat, breath visible | Novice Low | ⬜ |
| Weather forecast card | Full illustrated forecast showing icons + temperature + day of week (como en la tele) | Novice High | ⬜ |
| Temperature scale | Celsius + Fahrenheit comparison — common confusion for English-speaking learners | Novice High | ⬜ |
| ¿Qué tiempo hace? reference card | All weather expressions on one card with their corresponding images | Novice Mid | ⬜ |

---

## Section 3 — Grammar Structure Cards

These are diagrams, not photos. Generated as code (SVG or React components) — not DALL-E images. They live in `TextbookInfographics.tsx` or as dedicated reference card components.

### Verb Conjugation Tables

| Asset | ACTFL Level | Format | Status |
|-------|-------------|--------|--------|
| Regular -AR pattern (hablar) | Novice Low | table with pronouns + endings highlighted | ⬜ |
| Regular -ER pattern (comer) | Novice Low | table | ⬜ |
| Regular -IR pattern (vivir) | Novice Low | table | ⬜ |
| SER (full present) | Novice Low | table — with usage examples | ⬜ |
| ESTAR (full present) | Novice Low | table — with usage examples | ⬜ |
| TENER (full present) | Novice Low | table | ⬜ |
| IR (full present) | Novice Low | table + ir + a + infinitive | ⬜ |
| QUERER / PODER / VOLVER | Novice Mid | stem-change o→ue visual | ⬜ |
| HACER / PONER / TRAER | Novice Mid | go-verb pattern | ⬜ |
| SABER vs CONOCER | Novice High | split table with usage contrast | ⬜ |
| Reflexive verbs (ducharse) | Intermediate Low | pronoun placement diagram | ⬜ |
| Preterite regular (-ar/-er/-ir) | Intermediate Low | table | ⬜ |
| Preterite irregular (ser/ir/tener/hacer) | Intermediate Low | grouped table | ⬜ |
| Imperfect (-ar/-er/-ir) | Intermediate Low | table | ⬜ |
| Future (regular + irregular stems) | Intermediate Mid | table with irregulars highlighted | ⬜ |
| Conditional | Intermediate Mid | table | ⬜ |
| Present subjunctive | Intermediate High | table with trigger phrases | ⬜ |
| Commands (tú / usted / ustedes) | Intermediate Mid | table | ⬜ |

### Decision Trees & Comparison Cards

| Asset | ACTFL Level | Status |
|-------|-------------|--------|
| SER vs ESTAR decision tree | Novice Low — Novice Mid | ⬜ |
| Preterite vs Imperfect contrast diagram | Intermediate Low | ⬜ |
| Por vs Para decision tree | Intermediate Mid | ⬜ |
| Indicative vs Subjunctive trigger map | Intermediate High | ⬜ |
| Direct vs Indirect object pronoun chart | Intermediate Low | ⬜ |
| Object pronoun placement diagram | Intermediate Low | ⬜ |
| Gender & article overview (el/la/un/una) | Novice Low | ⬜ |
| Adjective agreement diagram | Novice Mid | ⬜ |
| Stem-change verb visual (e→ie, o→ue, e→i) | Novice High | ⬜ |
| -GO verbs pattern card | Novice High | ⬜ |
| Diminutives & augmentatives | Intermediate Mid | ⬜ |

### Sentence Structure Diagrams

| Asset | ACTFL Level | Status |
|-------|-------------|--------|
| Basic SVO sentence structure | Novice Low | ⬜ |
| Adjective placement rules | Novice Mid | ⬜ |
| Negative sentence construction | Novice Low | ⬜ |
| Question formation (¿Cómo/Qué/Dónde/Cuándo/Por qué?) | Novice Low | ⬜ |
| Tú vs Usted — register chart | Novice Mid | ⬜ |

---

## Section 4 — Preposition Maps

Two formats needed: a **static reference card** showing all prepositions at once, and **dynamic compositing** (already handled by the prop room compositor for spatial prepositions in lessons).

### Spatial Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Full spatial preposition map | Overhead/isometric room view with arrows and labels for: en, sobre, debajo de, delante de, detrás de, al lado de, entre, cerca de, lejos de, dentro de, fuera de, encima de | ⬜ |
| Simplified 6-preposition card | Just the six most confused ones (sobre/en/encima de, debajo de, delante de, detrás de) with clear illustrations | ⬜ |

*Note: Dynamic compositing via `compose_visual_scene` (Mode B) handles on/under/beside in real lessons. These static cards are for reference and textbook.*

### Motion & Direction Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Motion preposition diagram | Map-style graphic showing: a (destination), hacia (toward), desde (from), hasta (as far as), por (through/along), para (toward/for) with arrows on streets/paths | ⬜ |

### Temporal Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Temporal preposition timeline | Horizontal timeline showing: antes de, después de, durante, desde, hasta, hace + time — all placed on the timeline relative to "now" | ⬜ |

---

## Section 5 — Cultural Infographics

These give language its context — students learn words in isolation without these.

| Asset | Description | ACTFL Level | Status |
|-------|-------------|-------------|--------|
| Spanish-speaking world map | 21 Spanish-speaking countries labeled with capitals and flags | Novice Mid | ⬜ |
| Hispanic food guide | Regional dishes by country/region — illustrated mini-map | Intermediate Low | ⬜ |
| Festival & holiday calendar | Major celebrations across Spanish-speaking world by month | Intermediate Low | ⬜ |
| Tú vs Usted register guide | When to use which — illustrated social situations | Novice Mid | ⬜ |
| Gesture guide | 8–12 common Spanish/Hispanic gestures with illustrated hands and explanations | Intermediate Low | ⬜ |
| Currency overview | Pesos (MX, AR, CL, CO, CU, DO, PH), Soles, Euros, Bolívares, Colones — with approximate exchange anchor | Novice High | ⬜ |
| Spanish dialect map | Spain, Mexico, Caribbean, Andean, River Plate, Central American — key vocabulary/pronunciation differences | Intermediate Mid | ⬜ |
| Family structure diagram | Visual family tree with all relationship terms labeled | Novice Mid | ⬜ |
| Formal greetings by country | Handshake, cheek kiss, both — illustrated regional etiquette | Novice High | ⬜ |

---

## Section 6 — Word Family Maps

Visual clusters connecting a root verb to its noun, adjective, and adverb forms. These are especially powerful at Intermediate+ where students start using words productively across contexts.

| Root | Family members | ACTFL Level | Status |
|------|---------------|-------------|--------|
| hablar | habla, hablante, hablador/a, hablado | Novice Low | ⬜ |
| comer | comida, comedor, comestible, comilón | Novice Low | ⬜ |
| vivir | vida, viviente, vivienda, vivo/a | Novice Low | ⬜ |
| trabajar | trabajo, trabajador/a, trabajable | Novice Low | ⬜ |
| dormir | sueño, dormilón, dormitorio | Novice Mid | ⬜ |
| viajar | viaje, viajero/a | Novice High | ⬜ |
| amar | amor, amante, amado/a, amoroso/a | Novice Mid | ⬜ |
| escribir | escritura, escritor/a, escrito | Novice Mid | ⬜ |
| leer | lectura, lector/a, leído | Novice Mid | ⬜ |
| conocer | conocimiento, conocido/a, desconocer | Novice High | ⬜ |
| poder | poder (n), poderoso/a, poderío | Intermediate Low | ⬜ |
| pensar | pensamiento, pensador/a, pensativo/a | Intermediate Low | ⬜ |

*Format: branching diagram from the root verb with color-coded word class (verb = blue, noun = orange, adjective = green, adverb = purple).*

---

## Section 7 — False Cognate Warning Cards

These are high-impact because they prevent actual embarrassing mistakes. Single card format: English word → wrong Spanish assumption → correct Spanish word → correct usage of the look-alike.

| English | Wrong assumption | Actual Spanish | Look-alike | Look-alike means | Status |
|---------|-----------------|----------------|-----------|-----------------|--------|
| embarrassed | embarazada | avergonzado/a | embarazada | pregnant | ⬜ |
| sensible | sensible | sensato/a | sensible | sensitive | ⬜ |
| to realize | realizar | darse cuenta de | realizar | to accomplish/carry out | ⬜ |
| actual | actual | real, verdadero | actual | current, present-day | ⬜ |
| exit | éxito | salida | éxito | success | ⬜ |
| library | librería | biblioteca | librería | bookstore | ⬜ |
| to assist | asistir | ayudar | asistir | to attend | ⬜ |
| to introduce | introducir | presentar | introducir | to insert | ⬜ |
| carpet | carpeta | alfombra | carpeta | folder/binder | ⬜ |
| constipated | constipado | estreñido | constipado | having a cold | ⬜ |
| to molest | molestar | acosar | molestar | to bother/annoy | ⬜ |
| parents | parientes | padres | parientes | relatives | ⬜ |

---

## Section 8 — Phonetic / Pronunciation Guides

Visual mouth-position or phoneme guides for sounds that don't exist in English. These are especially valuable for student self-study between sessions.

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Spanish vowel purity chart | A, E, I, O, U — each shown as single pure sound vs English diphthong equivalent | Novice Low | ⬜ |
| The rolled R (rr) guide | Tongue position illustration + where rr appears (perro, carro, alrededor) | Novice Mid | ⬜ |
| B vs V in Spanish | Illustrated — both are essentially the same sound; contrast to English | Novice Mid | ⬜ |
| The silent H | Simple rule card + illustrated examples (hablar, hola, hotel) | Novice Low | ⬜ |
| The J sound | Contrast to English H/J — illustrated with throat position | Novice Mid | ⬜ |
| Ñ pronunciation | How it differs from N — examples (niño, mañana, año) | Novice Low | ⬜ |
| LL/Y regional variation | Map + phoneme guide — ceceo, seseo, ll-vs-y | Intermediate Low | ⬜ |
| Stress rules & accent marks | Visual rule card: where stress falls without accent, when accent is written | Novice High | ⬜ |
| Linking sounds (enlace) | How word-final vowel links to word-initial vowel in spoken Spanish | Intermediate Low | ⬜ |

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
| Body diagram (labeled regions) | `highlight_body_part(part)` | Body parts, health, Intermediate Low | Medium |
| Conjugation table (fill-in) | `fill_conjugation(row, value)` | Every tense, every verb pattern | Low |
| World map (Spanish-speaking countries) | `highlight_country(country)` | Cultural units, geography, Intermediate+ | Medium |
| Calendar SVG | `set_calendar(day, month)` | Dates, days, months, Novice Low | Low |
| Emotion face SVG | `set_emotion(state)` | Emotions vocabulary, Intermediate Mid | Low |
| Thermometer SVG | `set_temperature(celsius)` | Weather/temperature, Novice High | Low |
| Weather icon set | `show_weather(condition)` | Weather vocabulary, Novice Low | Low |

**Build sequence recommendation:** Conjugation table first (low complexity, extremely high usage across every grammar lesson), then calendar (complements the existing clock perfectly), then body diagram, then world map.

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

| Canvas type | Lessons it covers | Build complexity |
|---|---|---|
| Clock (analog + hands) | All time expressions, Novice Low → Advanced | Low — pure SVG |
| Body diagram | Body parts, health vocabulary, Intermediate Low | Medium — labeled regions |
| Conjugation table | Every tense, every verb pattern | Low — React table component |
| Weather icon set | Weather vocabulary, Novice Low | Low — SVG icons |
| World map (Spanish-speaking) | Cultural units, Intermediate+ | Medium — SVG paths |
| Emotion face | Emotions, Intermediate Mid | Low — SVG expressions |
| Calendar | Dates, days, months, Novice Low | Low — SVG grid |
| Thermometer | Temperature, weather, Novice High | Low — SVG fill |

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

The standard prop style prompt already handles most of this: *warm illustrated watercolor style, vibrant saturated colours, soft natural shading, object centred on clean white background, no shadows or background elements.* Avoid adding "close-up of" or "detailed shot of" — these push generation toward macro framing that crops off the vessel.

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
5. **Others** — as language support expands

