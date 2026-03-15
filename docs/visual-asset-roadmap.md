# Visual Asset Roadmap
## HolaHola — Pre-Generated Visual Library

**Created:** March 15, 2026  
**Referenced by:** `docs/curriculum-strategy.md` (Section 8)  
**Status column key:** ⬜ Planned | 🔄 Generating | ✅ In Library

This document is the master list of every visual asset we intend to pre-create for the platform. Assets fall into eight categories. The goal is not to be exhaustive on day one — it's to be deliberate: the right visuals for the words and concepts students absolutely must learn, generated ahead of time so Daniela can surface them instantly.

Visual assets live in the `visual_assets` table. Grammar/infographic SVGs are generated as React components in `TextbookInfographics.tsx`. Prop room backgrounds live in `visual_environments`.

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
| bread | pan | ⬜ | |
| milk | leche | ⬜ | glass + carton |
| apple | manzana | ✅ | in prop library |
| banana | plátano/banana | ✅ | in prop library |
| egg | huevo | ⬜ | |
| rice | arroz | ⬜ | bowl of rice |
| coffee | café | ✅ | in prop library (multiple) |

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

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Analog clock face — hour | Clean clock showing full hours with Spanish labels | Novice Low | ⬜ |
| Analog clock face — half/quarter | Son las tres y media, tres y cuarto, tres menos cuarto | Novice Mid | ⬜ |
| Clock face — full grid | 12 clocks showing every hour variant in one reference image | Novice Mid | ⬜ |
| AM/PM scene strip | Morning scene → afternoon scene → evening scene → night scene with time expressions | Novice Low | ⬜ |
| Days of the week card | lunes → domingo visual strip (with Mon-start calendar format, common in Spanish-speaking world) | Novice Low | ⬜ |
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

### Batch generation order (recommended)
1. **Numbers 0–20** — highest usage, all levels
2. **Time (clocks + days + months + seasons)** — used in every lesson at every level  
3. **Weather set** — early vocabulary, all illustrations
4. **Core vocabulary Novice Low** — people, places, things, activities
5. **Grammar diagrams** — SER/ESTAR/TENER tables + decision trees
6. **Preposition maps** — spatial first (ties into prop room lessons)
7. **Continue vocabulary by level** — Novice Mid → Novice High → Intermediate

---

## Cross-Language Notes

This roadmap is written for Spanish (our primary language) but the vocabulary images, time/weather visuals, preposition maps, and grammar structure cards all need to adapt to all 9 languages. The approach:

- **Images** (vocabulary illustrations): language-agnostic — one image per concept, any language can reference it
- **Grammar tables**: language-specific — French has different conjugation patterns, German has cases, Japanese has particles
- **Cultural infographics**: language/region-specific — French has its own culture section, Japanese has its own
- **False cognates**: language-specific — different false friends for each L1→L2 pair

Priority order for language expansion: Spanish → French → German → then others.
