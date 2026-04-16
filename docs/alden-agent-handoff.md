# Alden ↔ Agent Handoff

---
## ⚑ STANDING RULE — Tool Rack Sync (added session 38j)

When any new Daniela function is added to `server/services/daniela-function-registry.ts`,
the Tool Rack line in `server/services/classroom-environment.ts` (~line 481) **must also be updated**
in the same session. These two files are a pair — the function registry says *how* to call a tool,
the Tool Rack gives Daniela ambient awareness that the tool *exists*. A function without a Tool Rack
entry will be underused because Daniela won't think to reach for it.

Keep Tool Rack entries concise (keyword/signature + one-line trigger context). Do not duplicate
the full docs from the function registry — just enough for Daniela to think "oh, this is the right
moment for that tool."

Audit completed session 38j: nine Phase 2 SVG tools (set_clock, set_calendar, set_body_part,
set_face_part, set_hand_part, set_emotion, set_weather, set_thermometer, highlight_country) and
move_in_scene were all missing from the Tool Rack since their March 17 build. Now fixed.

---

## Session Summary — Thu, Apr 10, 2026 (session 45 — M3 complete + numbers chapter M1/M4 for all 10 languages)

### What was done

**M3 discoveryNotes — 4 remaining languages completed (PT, ZH, EN, HE)**
- PT: você takes the same third-person verb ending as ele/ela — the same pattern as Spanish usted and Italian Lei; Romance languages repeatedly borrowed third-person pronouns to signal deference
- ZH: 您 (nín, formal you) is the character 你 (nǐ, casual you) with 心 (xīn, heart) beneath it — Chinese encodes deference into the shape of the character, not verb endings
- EN: English once had thou (informal) / you (formal plural); by the 17th century "you" absorbed both roles; English now compensates with vocabulary and indirection instead of a dedicated pronoun
- HE: Hebrew skipped the formal-pronoun system — no vous, usted, or Sie; instead every verb and adjective changes based on the gender of the person being addressed (ata medaber vs. at medaberet)
- M3 is now **complete for all 10 languages**

**Numbers chapter M1/M4 data — all 10 languages seeded**
- Added `vocabQA` (5 Q&A pairs) and `verbGroups` (1 anchor verb with 5 examples) to every language's numbers chapter
- The anchor verb choice was pedagogically driven:
  - ES/FR/IT/PT: "to have" (tener/avoir/avere/ter) — age expressed with "have" in Romance languages
  - DE: "sein" (to be) — German uses "sein" for age (Ich bin 25 Jahre alt), not "haben" — explicit cross-language contrast built into the verbTranslation
  - JA: あります/います (arimasu/imasu) — existence verb pair, animate vs. inanimate distinction
  - KO: 이에요/예요 (to be) — consonant/vowel split explained in verbTranslation
  - ZH: 有 (yǒu, to have/exist) — negated 没有 (méiyǒu) also taught in examples
  - EN: "to be" — age, time, and quantities ("There are five people")
  - HE: יש/אין (yesh/ein, there is/there isn't) — also covers possession via "yesh li" (I have)
- The vocabQA covers: age, cost, time, counting people, phone number — the five real contexts where numbers appear in chapter 1

### Files changed
- `client/src/data/chapter-intro-content.ts` — 4 discoveryNotes added (PT/ZH/EN/HE); vocabQA + verbGroups added to numbers chapters for all 10 languages
- `docs/visual-asset-roadmap.md` — M1/M3/M4 status updated; next data work updated
- `docs/alden-agent-handoff.md` — this entry

### Status after this session

| Component | Status |
|---|---|
| M1 VocabQAGrid | ✅ all 10 languages, greetings + family + numbers |
| M2 GenderAgreementGrid | ✅ gender-langs only, greetings + family |
| M3 discoveryNote | ✅ ALL 10 languages, greetings formal-informal section |
| M4 VerbAnchorGrid | ✅ all 10 languages, greetings + family + numbers |
| M5 SentenceFrameGrid images | ✅ component + API + ES greetings/family data |
| M6 CognateRecognitionGrid | ✅ 9/10 languages greetings / ⬜ EN pending |
| Bloviation audit | ✅ all 10 languages, all welcome texts |

### Next session candidates
1. **Daily chapter M1/M4 data** (vocabQA + verbGroups) for all 10 languages — next most impactful
2. **Classroom chapter M1/M4 data** for all 10 languages — after daily
3. **EN cognate strategy (M6)** — design decision: English as L2 has no single dominant L1 (learner could be French speaker, Spanish speaker, etc.); likely needs per-native-language cognate lists or "universal international vocabulary" approach (café, taxi, hotel, radio, etc.)
4. **M2 GenderAgreementGrid for numbers/daily chapters** (ES/FR/IT/PT/HE) — numbers chapter has masculine/feminine vocabulary (uno/una, etc.)

---

## Session Summary — Thu, Apr 10, 2026 (session 44 — bloviation audit + M3 discoveryNotes expansion)

### What was done

**Bug fix: `mediaFiles` schema import**
- `mediaFiles` was missing from the static `@shared/schema` import in `server/routes.ts`, causing the new `/api/textbook/vocab-images-by-keys` endpoint to fail at runtime. Added to the import; renamed local variable `userMediaFiles` at `/api/media/my-uploads` to resolve shadowing.

**T005 — Bloviation audit: 24 welcome texts rewritten across all 10 languages**
- Applied the 3-job test: each sentence must TEACH (concrete fact/rule), DEMONSTRATE (show a pattern), or ENCOURAGE (specific actionable nudge). Pure sentiment/tourism-brochure text fails.
- All 24 failing welcome texts were rewritten to lead with concrete chapter content — specific words, grammar rules, or outcomes the student will leave with.
- Examples of what changed:
  - Italian greetings: "passion, beauty, and human connection...doors to la dolce vita" → "Italian greetings cover more ground than English. You'll learn Buongiorno, Buonasera, and Ciao — when each is appropriate — plus how Lei and tu divide formal from informal..."
  - Mandarin greetings: "With over a billion speakers...connects cultures across every continent" → "Mandarin greetings are simpler than they look. You'll learn 你好, 早上好, 再见, and how to introduce yourself — plus the four tones..."
  - Spanish daily: "Let's refresh! Perfect for warming up or solidifying your foundation." → "This chapter pulls together the most-used Spanish phrases in one place: time-of-day greetings, courtesy words, and the daily vocabulary that shows up in almost every conversation."
- Languages audited: ES, FR, DE, IT, JA, KO, ZH, PT, EN, HE — greetings, family, numbers, daily chapters

**M3 discoveryNotes expansion — 5 new languages seeded**
- Added discoveryNotes to the "Formal vs. Informal" section of greetings chapters for FR, DE, IT, JA, KO
- Each note surfaces a grammar insight in the Madrigal discovery tradition:
  - FR: vous uses the same verb endings as ils/elles — formality through pronoun, not verb
  - DE: Sie (formal) vs. sie (she) vs. sie (they) — three meanings, one pronunciation, capital letter is the only visual cue
  - IT: Lei (formal you) uses third-person conjugation — "you speak to someone important as if speaking about them"
  - JA: Formality lives in the verb suffix (masu/desu), not the pronoun — every verb carries the respect level
  - KO: Honorifics affect every verb in the conversation, not just the greeting word

### Files changed
- `server/routes.ts` — `mediaFiles` added to schema import; `userMediaFiles` rename at my-uploads endpoint
- `client/src/data/chapter-intro-content.ts` — 24 welcome texts rewritten; 5 new discoveryNotes added (FR/DE/IT/JA/KO formal-informal sections)
- `docs/visual-asset-roadmap.md` — M3 status updated to 6/10 languages; bloviation audit noted; next data work updated
- `docs/alden-agent-handoff.md` — this entry

### Status after this session

| Component | Status |
|---|---|
| M1 VocabQAGrid | ✅ all 10 languages, greetings + family |
| M2 GenderAgreementGrid | ✅ gender-langs only, greetings + family |
| M3 discoveryNote | ✅ ES/FR/DE/IT/JA/KO greetings / ⬜ PT/ZH/HE/EN pending |
| M4 VerbAnchorGrid | ✅ all 10 languages, greetings + family |
| M5 SentenceFrameGrid images | ✅ component + API + ES greetings/family data |
| M6 CognateRecognitionGrid | ✅ 9/10 languages greetings / ⬜ EN pending |
| Bloviation audit | ✅ all 10 languages, all welcome texts rewritten |

### Next session candidates
1. **M3 discoveryNotes** for PT/ZH/HE/EN greetings formal-informal sections (4 remaining)
2. **Numbers chapter data** (M1/M4 for all 10 languages) — entirely unstarted
3. **Daily routine chapter data** (M1/M4 for all 10 languages) — entirely unstarted
4. **EN cognate strategy** (M6) — design decision: L2 English learners have varied native languages; likely needs a language-specific cognate list per native language, or a "universal near-cognates" approach

---

## Session Summary — Thu, Apr 10, 2026 (session 43 — M5 image integration for SentenceFrameGrid)

### What was done

**M5 — SentenceFrameGrid image rendering — COMPLETE**

This was the highest-priority open item. Madrigal's method requires pictures in the filler cards so students map directly from image → target word without routing through English translation. Without images, the drill is a phrase list, which QuickPhraseGrid already provides.

1. **`imageKey?: string` added to `SentenceFrameItem` interface** in both:
   - `client/src/data/chapter-intro-content.ts` (data layer)
   - `client/src/components/TextbookInfographics.tsx` (component layer)

2. **New API endpoint**: `GET /api/textbook/vocab-images-by-keys?keys=key1,key2,...`
   - In `server/routes.ts` after the existing vocab-images route
   - Queries `media_files` WHERE `search_query IN (keys)` — same table/cache as all other vocab images
   - Returns `{ images: { [key]: { url, source } } }`
   - Cap 40 keys/request; uses already-imported `mediaFiles` schema table + `inArray` from drizzle-orm
   - Fixed: `mediaFiles` added to static `@shared/schema` import; local variable shadow at `/api/media/my-uploads` renamed to `userMediaFiles`

3. **`SentenceFrameGrid` component updated** in `TextbookInfographics.tsx`:
   - Collects all unique imageKeys across all frame items (one Set sweep)
   - Issues one `useQuery` batch call to the new endpoint (staleTime 5 min, gcTime 15 min)
   - Each card: if `imageKey` present → renders `h-24` image container at top of card
     - While loading: `animate-pulse` skeleton
     - Image found: `object-cover` photo  
     - Image absent from DB: large first-letter initial (muted primary, graceful fallback)
   - Filler text font size reduced slightly (`text-base` vs `text-xl`) when image slot is present, to keep card proportion

4. **Spanish greetings data updated** — all 12 filler items now carry imageKey:
   - `vocab_spanish_hola`, `vocab_spanish_buenos dias`, `vocab_spanish_buenas tardes`, `vocab_spanish_buenas noches`, `vocab_spanish_adios`, `vocab_spanish_hasta luego`
   - `vocab_spanish_bien`, `vocab_spanish_muy bien`, `vocab_spanish_mas o menos`, `vocab_spanish_mal`, `vocab_spanish_cansado`, `vocab_spanish_feliz`

5. **Spanish family data updated** — all 12 filler items now carry imageKey:
   - `vocab_spanish_madre`, `vocab_spanish_abuela`, `vocab_spanish_hermana`, `vocab_spanish_tia`, `vocab_spanish_prima`, `vocab_spanish_amiga`
   - `vocab_spanish_padre`, `vocab_spanish_abuelo`, `vocab_spanish_hermano`, `vocab_spanish_tio`, `vocab_spanish_primo`, `vocab_spanish_amigo`

### Files changed
- `server/routes.ts` — new `/api/textbook/vocab-images-by-keys` endpoint; `mediaFiles` added to schema import; `userMediaFiles` local rename
- `client/src/data/chapter-intro-content.ts` — `imageKey` added to `SentenceFrameItem` interface; 24 filler items updated
- `client/src/components/TextbookInfographics.tsx` — `imageKey` added to component interface; `SentenceFrameGrid` rewritten with image fetching + rendering
- `docs/visual-asset-roadmap.md` — M5 marked complete; implementation details added
- `docs/alden-agent-handoff.md` — this entry

### Status after this session

| Madrigal component | Status |
|---|---|
| M1 VocabQAGrid | ✅ all 10 languages, greetings + family |
| M2 GenderAgreementGrid | ✅ gender-langs only, greetings + family |
| M3 discoveryNote | ✅ component / ⬜ 9 non-ES languages pending |
| M4 VerbAnchorGrid | ✅ all 10 languages, greetings + family |
| M5 SentenceFrameGrid images | ✅ component + API + ES greetings/family data |
| M6 CognateRecognitionGrid | ✅ 9/10 languages greetings / ⬜ EN pending |

### Next session candidates
1. **discoveryNotes** for 9 non-Spanish languages (M3 data) — requires reading existing narrativeSections per language to find insert anchor
2. **Numbers chapter data** (M1/M4 for all 10 languages) — entirely unstarted
3. **Daily routine chapter data** (M1/M4 for all 10 languages) — entirely unstarted
4. **EN cognate strategy** (M6) — design decision needed: L2 English learners have different native-language backgrounds

---

## Session Summary — Thu, Apr 10, 2026 (session 42 — family chapter M1/M2/M4 + greetings M6 expansion)

### What was done

1. **`genderFrame` interface field added** to `ChapterIntroContent` in `chapter-intro-content.ts`:
   - `genderFrame?: { masculine: string; feminine: string }` — allows any chapter to override the default language-level gender frame
   - Critical because family chapters use "C'est mon ___." / "C'est ma ___." (French) not "Il est ___." which is the greetings default
   - `ChapterIntroduction.tsx` updated: `masculineFrame={content.genderFrame?.masculine ?? langFrames[langKey]}`

2. **Family chapter M1 (vocabQA) seeded for all 9 non-Spanish languages** — 5 QA pairs each, covering siblings/who-is-this/name-question/how-many-people/where-do-parents-live:
   - French, German, Italian, Japanese, Korean, Mandarin, Portuguese, English, Hebrew

3. **Family chapter M4 (verbGroups) seeded for all 9 non-Spanish languages** — key verbs: être/sein/essere/です/이에요/是/ser/to be/zero-copula:
   - Japanese: uchi/soto register note (父 vs. お父さん)
   - Korean: consonant/vowel copula rule in family context
   - Mandarin: birth-order precision note (哥哥/弟弟/姐姐/妹妹 — no single "sibling" word)
   - Hebrew: הוא אבא שלי zero-copula + שלי (of me/mine) explained

4. **Family chapter M2 (genderFrame + genderPairs) seeded for FR/IT/PT/HE/ES** — noun pairs (père/mère not adjectives) with chapter-specific frames:
   - Spanish: "Él es mi ___." / "Ella es mi ___." (was missing genderFrame override — now fixed)
   - French: "C'est mon ___." / "C'est ma ___."
   - Italian: "Lui è mio ___." / "Lei è mia ___."
   - Portuguese: "Ele é meu ___." / "Ela é minha ___."
   - Hebrew: "הוא ___ שלי." / "היא ___ שלי."
   - DE/JA/KO/ZH/EN: correctly have no genderPairs (no grammatical gender agreement)

5. **Greetings M6 cognateOpener seeded for PT/JA/KO/ZH/HE** (5 languages — all remaining except EN):
   - Portuguese: 18 cognates (hotel/táxi/restaurante/possível/excelente…) + 3 false friends (polvo/borracha/pretender)
   - Japanese: 17 katakana loan-words + 2 false friends (マンション≠mansion, スマート≠smart/clever)
   - Korean: 17 konglish loan-words + 2 culture notes (핸드폰=cell phone, 아이쇼핑=window shopping)
   - Mandarin: 15 phonetic loans (咖啡/巧克力/沙发/比萨/汉堡…) + 0 false friends (phonetic loans differ structurally)
   - Hebrew: 16 international loans (טלפון/טלוויזיה/קפה/פיצה/בנק/ספורט…) + 0 false friends
   - English: still pending (cognate strategy for L2 English differs fundamentally — not seeded)

6. **One TypeScript typo fixed**: `\u01co` → `\u01ceok` in Mandarin `巧克力` romanization (qiǎokèlì)

### Files changed
- `client/src/data/chapter-intro-content.ts` — interface + 15 data insertions (2 scripts)
- `client/src/components/ChapterIntroduction.tsx` — genderFrame prop override
- `docs/visual-asset-roadmap.md` — M1/M2/M4 family + M6 cognate status updated
- `docs/alden-agent-handoff.md` — this entry

### Status after this session

| Chapter | M1 vocabQA | M2 genderPairs | M4 verbGroups | M6 cognates |
|---|---|---|---|---|
| Greetings | ✅ all 10 | ✅ gender-langs | ✅ all 10 | ✅ 9/10 (EN pending) |
| Family | ✅ all 10 | ✅ gender-langs | ✅ all 10 | — |
| Numbers | ⬜ | ⬜ | ⬜ | — |
| Daily | ⬜ | ⬜ | ⬜ | — |

---

## Session Summary — Thu, Apr 10, 2026 (session 41 — M1/M2/M4 all-language greetings seed)

### What was done

1. **ChapterIntroduction.tsx** — updated `GenderAgreementGrid` render to pass language-specific `masculineFrame` / `feminineFrame` props via an inline record keyed on `langKey`. Spanish: "Él está ___." / "Ella está ___.", French: "Il est ___." / "Elle est ___.", Italian: "Lui è ___." / "Lei è ___.", Portuguese: "Ele está ___." / "Ela está ___.", Hebrew: "הוא ___." / "היא ___." Languages without grammatical gender (German, Japanese, Korean, Mandarin, English) do not receive genderPairs, so the component renders nothing for them — correct behavior.

2. **All 9 remaining language greetings chapters seeded** in `chapter-intro-content.ts` — single Node.js insertion script, one pass, all anchored to unique text at each chapter's end:

   | Language | genderPairs | vocabQA | verbGroups | Key verb |
   |---|---|---|---|---|
   | French | ✅ (joyeux/joyeuse, fatigué/fatiguée, occupé/occupée, malade×2, nerveux/nerveuse) | 6 pairs | être | être |
   | Portuguese | ✅ (contente×2, cansado/a, ocupado/a, doente×2, nervoso/a, animado/a) | 6 pairs | estar | estar |
   | German | — (predicate adjectives don't inflect; skipped) | 6 pairs | sein | sein |
   | Italian | ✅ (contento/a, stanco/a, occupato/a, malato/a, nervoso/a, emozionato/a) | 6 pairs | stare | stare |
   | Japanese | — | 5 pairs | です (desu) | です |
   | Korean | — | 5 pairs | 이에요/예요 | copula |
   | Mandarin | — | 5 pairs | 是 (shì) | 是 |
   | Hebrew | ✅ (שמח/שמחה, עייף/עייפה, עסוק/עסוקה, חולה×2, עצבני/עצבנית) | 5 pairs | להיות (zero copula) | zero-copula |
   | English | — | 5 pairs | to be | to be |

3. **Pedagogical notes seeded per language**:
   - French verbHint: "être links you to descriptions — Madrigal calls this the identity bridge."
   - Italian verbHint: "Italian uses stare, not essere, for how you feel. This is the most important greeting verb." (Madrigal distinction)
   - Hebrew verbHint: "In Hebrew present tense, 'to be' disappears entirely. Subject and predicate stand side by side with no verb between them." (zero-copula discovery moment)
   - Mandarin verbHint: "是 links two equal things — I = student. For qualities like 'I am tall,' Chinese uses a different structure." (是 vs adjective predicate)
   - Korean verbHint: "이에요 follows consonants; 예요 follows vowels. This small rule covers half of all Korean introductions."
   - Portuguese genderPairs teach that *contente* and *doente* are invariable (same for masc/fem) — surface-level contrast with Spanish.

4. **File ordering note**: The data file sections appear in this order: spanish → french → german → italian → japanese → korean → mandarin → portuguese → english → hebrew. (Not alphabetical — know this for future insertions.)

### Pending / next session

- **M5** (images in SentenceFrameGrid) — still the highest priority, not started
- **Family chapter M1/M2/M4 data** — only Spanish family chapter has data; all other languages need family data next
- **discoveryNotes** — not added to non-Spanish languages yet (needs narrative section reading per language)
- **Cognate expansion** — Portuguese/Japanese/Korean/Mandarin/Hebrew/English greetings chapters still lack cognateOpener blocks; only French/Italian/German have them
- **Numbers and daily chapter data** — all languages need these chapters seeded too
- Madrigal image scanning — David still has more pages

---

## Session Summary — Thu, Apr 10, 2026 (session 40 — M1–M4 build + bloviation audit + cognate expansion)

### What was done

1. **T001 — Data types confirmed complete** (from prior session): `VocabQAItem`, `GenderPair`, `VerbExample`, `VerbGroup`, `discoveryNote` all on `ChapterIntroContent`. `CognateEntry` updated to add `target?: string` for multilingual cognate support.

2. **T002 — Three new infographic components built** in `TextbookInfographics.tsx`:
   - **M1 `VocabQAGrid`** — dialogue production drill. Shows Q&A pairs in complete sentences, not just single words. Sky-blue accent, "full sentences" badge, play buttons on answers.
   - **M2 `GenderAgreementGrid`** — two-column masculine/feminine table. Customizable frame text (e.g. "Él está ___." / "Ella está ___."). Violet accent. Translation key row below the grid.
   - **M4 `VerbAnchorGrid`** — verb anchor card (large, primary, repeat icon) + object tile grid (object word large, full phrase medium, translation small, play button). Groups support multiple verbs per chapter.

3. **T003 — Wired into ChapterIntroduction.tsx**: imported all three + `discoveryNote` callout (sky-blue, BookOpen icon, "Notice:" prefix) after tip inside narrativeSections loop. Render order: sentenceFrames → genderPairs → vocabQA → verbGroups.

4. **T004 — Spanish chapter data seeded**:
   - **Greetings**: 6 genderPairs (contento/a, cansado/a, ocupado/a, enfermo/a, nervioso/a, emocionado/a), 6 vocabQA pairs (¿Cómo te llamas? / Mucho gusto / ¿Qué tal? etc.), `estar` verbGroup (6 examples), `discoveryNote` on Formal/Informal section explaining usted shares verb ending with él/ella.
   - **Family**: 5 genderPairs (padre/madre, hermano/hermana, abuelo/abuela, tío/tía, primo/prima) with custom frames "Él es mi ___ / Ella es mi ___", 5 vocabQA pairs (¿Quién es ella? etc.), `ser` verbGroup (6 family examples).

5. **T005 — Bloviation audit**:
   - **Greetings welcomeText**: old fluffy copy removed. Replaced with: "In this chapter you'll learn three time-of-day greetings (buenos días, buenas tardes, buenas noches), the formal and informal 'you' (usted / tú), and how to introduce yourself. By the end, you'll be able to open and close a real conversation in Spanish." — passes 3-job test: teaches vocab, demonstrates pattern, builds confidence.
   - **Numbers welcomeText**: "Spanish numbers follow a predictable pattern: learn uno through diez, and the rules for veinte, treinta, and cien unlock everything else. This chapter covers cero to un millón — including telling time and sharing your phone number."
   - Family welcomeText preserved — already tight and passes the 3-job test.

6. **T006 — Cognate expansion**: `CognateEntry.target?: string` added (multilingual field; `spanish` kept for backward compat, component updated to `entry.target ?? entry.spanish`). Three new language cognate sets seeded:
   - **French**: 18 cognates (hotel/hôtel, taxi, restaurant, concert, sport, possible, important, excellent, nation, attention, information, artiste, touriste, optimiste) + 3 false friends (actuel/sensible/rester).
   - **Italian**: 18 cognates (hotel, pizza, radio, studio, importante, naturale, originale, attenzione, nazione, informazione, artista, turista, ottimista) + 3 false friends (camera=room, sensibile, attualmente).
   - **German**: 18 cognates (Hotel, Sport, Tennis, Internet, Computer, Moment, Telefon, Musik, Problem, Nation, Aktion, Information, Artist, Tourist, Optimist) + 3 false friends (aktuell, sympathisch, sensibel).
   - Portuguese skipped — no `chapters` key in its data structure; needs its own data scaffold before cognates can be seeded.

### Pending / next session

- **Plan M5** (images in SentenceFrameGrid) — still HIGH PRIORITY, not started
- **Portuguese chapter scaffold** — add `chapters: {}` structure with greetings/family/numbers before cognate expansion can be seeded
- **French/Italian/German family chapter data** — M1/M2/M4 only seeded for Spanish so far
- Madrigal image scanning — David still has more pages

---

## Session Summary — Thu, Apr 10, 2026 (session 39 — Madrigal preface analysis + Plan M6)

### What was done

1. **SentenceFrameGrid data fixes** — corrected the greetings chapter data. Removed "Tengo que ir al ___" (wrong vocabulary, wrong level). Replaced with "¡___, amigo!" × actual greeting words and "Estoy ___." × ¿Cómo estás? responses. Both now satisfy Constraint 1 (chapter vocab only) and Constraint 2 (Novice Low complexity).

2. **Preface analysis** — David photographed both pages of the Madrigal preface and shared them. Full quote-by-quote analysis added to `docs/visual-asset-roadmap.md` under "The Preface — Philosophical Alignment with HoloHola". Eight key quotes mapped to specific HoloHola features.

3. **Non-linear navigation principle documented** — Madrigal's preface explicitly says students should be able to start any lesson, jump around freely, and study multiple lessons simultaneously. David confirmed this has been his design intent for HoloHola since day one. Documented as a first-class authoring rule: *design every lesson to stand alone*.

4. **Plan M6 — Cognate Recognition Opener** added to roadmap. Component proposed: `CognateRecognitionGrid`. A chapter zero / greetings opener that shows English speakers the hundreds of Spanish words they already own (doctor, hotel, natural, formal, television, hospital, animal…). Pedagogical goal: dismantle the "Spanish is foreign" belief before the first lesson. Data: new optional `cognateOpener?: CognateEntry[]` field on `ChapterIntroContent`.

### Built this session (continued)

5. **Plan M6 — CognateRecognitionGrid BUILT** — `CognateRecognitionGrid` component in `TextbookInfographics.tsx`. Renders after welcome card, before narrative sections. Category-grouped tile grid (Identical / Nearly the same / -tion→-ción / -ist→-ista) + amber "false friends" warning section (embarazada, constipado, librería). Each tile: Spanish word large+primary, English word small+muted, TextAudioPlayButton for pronunciation. Spanish greetings chapter seeded with 32 cognates (29 true + 3 false friends). Data field: `cognateOpener?: CognateEntry[]` on `ChapterIntroContent`.

### Pending / next session

- Plan M5 (image integration in SentenceFrameGrid) — high priority, next
- Plans M1–M4 in queue
- David is scanning more pages from the book — more Madrigal patterns incoming; watch for next session handoff

---

## Session Summary — Tue, Apr 7, 2026 (session 38n — Textbook romanization wiring complete)

### What was done

#### Textbook vocab card romanization — COMPLETE

All three textbook infographic components now render romanization for Japanese (Hepburn romaji), Korean (Revised Romanization), and Hebrew (Latin transliteration) automatically. Mandarin still returns null (needs pinyin dictionary).

**Files changed:**
- `shared/romanization-utils.ts` — NEW: copied from `server/services/` to `shared/` so client can import it directly (pure TS, no Node deps)
- `server/services/romanization-utils.ts` — now re-exports from `shared/romanization-utils`
- `server/routes.ts` — `/api/textbook/vocab-images/:lessonId` now pre-computes and returns a `romanizations: Record<string, string>` map for ALL vocab drill items (not just those with images), computed before the image fetch loop
- `client/src/components/TextbookInfographics.tsx`:
  - Added `import { getRomanization } from "@shared/romanization-utils"`
  - `VisualVocabGrid`: updated query type, extracts `romanizations` from response, shows italic romanization between script text and translation in both image cards and text-only vocab items
  - `FormalInformalComparison`: calls `getRomanization` client-side for formal/informal text; shows romanization under each cell
  - `SunArcGreetings`: pre-computes romanizations for morning/afternoon/evening greetings; displays under each audio play button

**Architecture note:** romanizations are returned from the API for vocab grid items (server-side, pre-computed for all drill items at lessonId), and computed client-side for components like FormalInformalComparison and SunArcGreetings where AI-generated strings don't have drill IDs.

---

## Session Summary — Tue, Apr 7, 2026 (session 38m — Hebrew curriculum + Latin-script romanization)

### What was done

#### 1. Hebrew curriculum path seeded — Hebrew 1 Complete Beginner

Created the full Hebrew 1 curriculum structure using Drizzle ORM typed insert:

- **Path:** "Hebrew 1 — Complete Beginner" (ID: `79d4324b-1691-42b5-b095-964f869f7d94`)
  - Language: `hebrew` | Published: `true` | Level: novice_low → novice_high | 45 hours
- **15 units / 30 lessons** created and published
- **Curriculum enricher** picked up all 30 lessons automatically on boot (`[CurriculumEnrich] Boot-resume: 30 unenriched lessons found`) and began filling in `textbook_lesson_content` AI-generated content (introduction, grammar, vocabulary, cultural notes, key phrases)
- Unit names are deliberately crafted to trigger `classifyHebrewGrammarType()` — Hebrew grammar card components render automatically for each unit

| Unit | chapter_type | Grammar card rendered |
|------|-------------|----------------------|
| The Hebrew Alphabet — Alef-Bet | `he_alefbet` | `HeAlefBetCard` |
| Vowel Points — Niqqud in Hebrew | `he_niqqud` | `HeNiqqudCard` |
| Subject Pronouns in Hebrew | `he_pronouns` | `HePronounsCard` |
| Gender in Hebrew Grammar | `he_gender` | `HeGenderCard` |
| Numbers in Hebrew | `he_numbers` | `HeNumbersCard` |
| Present Tense Verbs in Hebrew | `he_present` | `HePresentCard` |
| The Definite Article in Hebrew | `he_article` | `HeArticleCard` |
| Past Tense in Hebrew | `he_past` | `HePastCard` |
| Israeli Holidays | `he_holidays` | `IsraeliHolidayCalendarCard` |
| Israeli Food and Culture | `he_food_guide` | `IsraeliFoodGuideCard` |
| The Hebrew-Speaking World | `he_world_map` | `HebrewophoneWorldMapCard` |

- Seed script deleted after use (per convention).

#### 2. Latin-script romanization on vocab cards

Added three-line display format (script / romanization / translation) for non-Latin script languages on the vocabulary image card (whiteboard).

**Files changed:**
- `shared/whiteboard-types.ts` — Added `latinScript?: string` to `ImageItemData` and `labels[]`; added `latin` / `romanization` key parsing in `parseImageContent()`
- `client/src/components/Whiteboard.tsx` — `ImageItemDisplay` now renders `latinScript` in italic between the script word and translation; multi-label chips also show `latinScript`
- `server/services/native-fc-handlers.ts` — `SHOW_IMAGE` handler now extracts `fn.args.latin_script` and passes it to the whiteboard update; label objects are transformed from `latin_script` (snake_case) to `latinScript` (camelCase)
- `server/services/daniela-function-registry.ts` — `show_image` function description and JSON schema now include `latin_script` parameter documented as REQUIRED for Korean/Mandarin/Japanese/Hebrew with specific romanization style guidance

**How it works:** Daniela calls `show_image(word="안녕하세요", translation="hello", latin_script="annyeonghaseyo")` and the whiteboard card shows:
```
안녕하세요        ← bold (target script)
annyeonghaseyo   ← italic (latin_script)
hello            ← muted (translation)
```

#### 3. Character greeting image seed restarted

Background seed (`seed-character-greetings.ts`) was killed by a workflow restart. Restarted in background (`PID 2390`). Check `/tmp/char-greeting-seed.log` for progress. The seed covers ~83 Korean/Mandarin/Hebrew/French/Japanese greeting images.

#### 4. Corrupted Hebrew media_files entries

Already cleaned from prior session — confirmed 7 deleted entries (`vocab_hebrew_lunes` through `vocab_hebrew_domingo`).

---

## Session Summary — Tue, Apr 7, 2026 (session 38l — Plans #4 and #5 confirmed complete)

### What was done

#### Audit: Plans #4 and #5 status confirmed

User asked to begin implementation of Plans #4 (Textbook Image Consistency) and #5 (Canonical Vocabulary Registry). Full audit of the codebase showed **both plans are already complete** from a prior session.

**What was found / confirmed:**

| Deliverable | Status | Location |
|-------------|--------|---------|
| 4 missing verb clusters in CONCEPT_KEY_MAP (étudier, travailler, regarder, se lever + all cross-language forms) | ✅ Done | `vocabulary-image-resolver.ts` ~line 1395–1492 |
| Sentence-form normalizer (`stripPronounPrefix`) | ✅ Done | `vocabulary-image-resolver.ts` ~line 2864 |
| Normalizer hooked as Step 0 in resolution pipeline | ✅ Done | `vocabulary-image-resolver.ts` ~line 2904–2930 |
| `lookupCanonicalConcept()` called before CONCEPT_KEY_MAP | ✅ Done | `vocabulary-image-resolver.ts` Step 0 |
| SCENE_OVERRIDEs for estudiar, trabajar, mirar, levantarse | ✅ Done | `vocab-image-seed-service.ts` ~line 1005–1008 |
| Spanish anchor images seeded (estudiar, trabajar, mirar, levantarse) | ✅ Already cached — confirmed via seed script run | All 4 resolved from cache with correct watercolor style |
| `server/data/canonical-vocabulary.ts` | ✅ Done | 2,560 lines, 7+ thematic units |
| Admin vocab audit endpoint | ✅ Done | `server/routes.ts` ~line 12171: `GET /api/admin/vocab-audit` |

**Action taken:** Ran targeted seed script confirming all 4 anchor images resolve correctly (source=cache). Deleted seed script after confirmation.

**Roadmap updated:** `docs/visual-asset-roadmap.md` Section 12 status updated from "pending" to "✅ complete" for both plans.

**What remains:** The cultural character image audit — the question of how many tier-3 (SCENE_OVERRIDE) concepts need Juliette/Yuki/Mei versions instead of Daniela. This is still `⬜ not started` and correctly documented as blocked until the canonical registry confirms the full list of tier-3 concepts.

---

## Session Summary — Tue, Apr 7, 2026 (session 38k — Visual asset roadmap: Plans #4/#5 + character audit)

### What was done

#### Documentation: Visual Asset Roadmap Section 12 added

User asked to roll Plans #4 (Textbook Image Consistency) and #5 (Canonical Vocabulary Registry) into the visual asset roadmap, and to clarify where the cultural character image audit stands.

**Section 12 added to `docs/visual-asset-roadmap.md`**, covering:

1. **Three-Tier Framework** — formally documents the routing rule that was previously implied across multiple sections:
   - Tier 1: SVG/canvas component (function words, numerals, grammar)
   - Tier 2: Shared concept image (universal concepts, one image for all 9 languages)
   - Tier 3: Character SCENE_OVERRIDE (culturally specific greetings/phrases)
   - Rule: raw unguided DALL-E generation is never acceptable

2. **Plan #4 summary** — the targeted fix: 4 missing verb clusters in the shared concept map, sentence-form normalizer (strips `Je`/`Tu`/`Il` prefix before lookup), missing Spanish anchor image seeds, admin vocab audit endpoint

3. **Plan #5 summary** — the systematic version: `server/data/canonical-vocabulary.ts` (~400 concepts), `lookupCanonicalConcept()` as first pipeline step, admin audit endpoint runs against the full registry. Plan #4 ships first as a targeted patch; Plan #5 supersedes it.

4. **Cultural character image audit** — formally linked to Rule 5 (character substitution templating). Status ⬜ not started. Depends on Plan #5 completing first so the audit runs against an authoritative tier-3 concept list. The audit answers: how many pure character swaps vs. scene-level rewrites, and what the DALL-E budget looks like broken out by language priority.

**No code changes — documentation only.**

---

## Session Summary — Tue, Apr 7, 2026 (session 38j — Prop rotation/z-index + Tool Rack audit)

### What was done

#### Feature: `rotate`, `flipH`, `z` added to scene canvas props

- `shared/whiteboard-types.ts` — `SceneCanvasProp` now has `rotate?` (degrees), `flipH?` (boolean), `z?` (1–10)
- `client/src/components/SceneCanvas.tsx` — `PropLayer` applies CSS `rotate()` + `scaleX(-1)` for flip + `zIndex`
- `server/services/native-fc-handlers.ts` — `ADD_TO_SCENE` reads `rotate`, `flip_h`, `z` from fn.args; clamps to valid ranges
- `server/services/daniela-function-registry.ts` — `add_to_scene` tool declaration exposes all three params with teaching examples (knife lying horizontal = rotate:90, fork on napkin = napkin z:3 + fork z:7) + SPATIAL PREPOSITION DEMO WORKFLOW section

#### Fix: Tool Rack gap — open_scene, move_in_scene, nine SVG panels all missing

- `server/services/classroom-environment.ts` Tool Rack updated with: open_scene/add_to_scene/move_in_scene (spatial canvas); set_clock/set_calendar; set_body_part/set_face_part/set_hand_part; set_emotion; set_weather/set_thermometer; highlight_country
- Ship note posted to Express Lane for Tasks #7 and #8

---

## Session Summary — Tue, Apr 7, 2026 (session 38i — Task #8: Resonance Shelf in Daniela's context)

### What was done

#### Feature: Resonance Shelf pre-injected into Daniela's teaching context

**Clarification from Cindy**: The Resonance Shelf belongs in Daniela's classroom context injection (not the admin command center as originally specced in the task). It surfaces her highest-performing proven techniques directly in her session awareness.

**Where added**: `server/services/streaming-voice-orchestrator.ts` — both the prefetch block (~line 1043) and the stale cache fallback block (~line 1986). The Resonance Shelf query is parallel to the existing topGrowth and topNotes queries.

**Query**:
- Filters: `isActive = true AND supersededBy IS NULL AND timesApplied >= 1`
- Sort: `COALESCE(successRate, 0) * timesApplied DESC` (quality × volume composite)
- Limit: top 5
- Fields: title, category, lesson, timesApplied, successRate, consolidatedFromCount

**Format in context** (rendered FIRST in the teaching growth log, before "Most Internalized"):
```
**Resonance Shelf** (techniques you've applied and confirmed work — lean into these):
• [teaching_technique] Title — applied 7×, 86% success rate — lesson text...
```

**Conditional display**: Section only appears when `resonanceShelf.length > 0` — no section injected when no outcome data exists yet (gracefully absent until Task #7 accumulates data).

**Order in teaching growth log**: Resonance Shelf → Most Internalized Teaching Lessons → Personal Notebook

**Log traces**:
- `[Growth Memories] Prefetched N resonance + 12 growth memories + 5 notes for session`
- `[Growth Memories] Injected N resonance + 12 growth memories + 5 notes (stale cache fallback)`

**Deviation from task spec**: Task #8 originally specced an admin UI tab in the command center. Cindy clarified the Resonance Shelf is for Daniela's context, not for admin review. No admin tab was built.

---

## Session Summary — Tue, Apr 7, 2026 (session 38h — Task #7: Growth memory outcome tracking)

### What was done

#### Feature: `what_worked` notes now automatically credit growth memories

**Root problem solved**: `timesApplied` and `successRate` on `daniela_growth_memories` were always zero — the third leg of the composite scoring formula `(consolidatedFromCount * 3 + importance * 2 + timesApplied)` was permanently inert.

**New service**: `server/services/growth-memory-outcome-service.ts`
- Called async (fire-and-forget) from `TAKE_NOTE` handler whenever `noteType === 'what_worked'`
- Fetches top 50 active, non-superseded growth memories ordered by composite score
- Sends note content + memory list to Gemini Flash for semantic matching
- Returns: `{ memoryId, confidence, hasResonance }` or null if no confident match

**`#resonance` tag**: If note body contains `#resonance`, confidence threshold is bypassed — any match is treated as high-confidence. This surfaces Cindy's strongest wins without requiring a >= 0.7 semantic score.

**Credit logic** (applied to matched memory):
- Always: `timesApplied += 1`, `lastAppliedAt = now()`
- High confidence (confidence >= 0.7 OR hasResonance): also updates `successRate` as running weighted average
  - `newRate = (oldRate * oldTimesApplied + 1.0) / newTimesApplied` (what_worked is always a positive signal)
- Low confidence: increments `timesApplied` only — records apply event without corrupting quality signal

**Hook location**: `server/services/native-fc-handlers.ts` — TAKE_NOTE case (line ~1769). The outcome tracking call is chained inside the `.then()` of `storage.insertDanielaNote()`, so it only fires after the note is confirmed saved.

**No latency impact**: Fully async, errors caught and logged internally, never surfaces to Cindy.

**Log traces to watch**:
- `[GrowthOutcome] Matched to memory <id> (confidence: 0.85, #resonance) — ...`
- `[GrowthOutcome] ✓ Credited memory <id>: timesApplied=N, successRate=95.0%`
- `[GrowthOutcome] No match found (confidence: 0.3) — ...`

**Composite scoring formula is now fully live** — all three legs will accumulate real data as Cindy uses the system.

---

## Session Summary — Tue, Apr 7, 2026 (session 38g — Composite scoring + daniela_notes pre-injection)

### What was done

#### Fix: Growth memories now ranked by reinforcement, not recency (plus personal notebook added)

**Root problem found**: The previous session (38f) pre-injected growth memories sorted by `created_at DESC`. This was wrong — it surfaced the 15 *most recently created* memories, burying lessons that had been independently reinforced hundreds of times. Example: "Impact of Enthusiastic Specific Praise" (consolidated from **164** separate observations) was from December 2025 — completely invisible under recency-only sorting.

**New composite scoring formula:**
```sql
ORDER BY (consolidated_from_count * 3 + importance * 2 + times_applied) DESC
```
- `consolidated_from_count` — how many times this lesson was **independently observed/reinforced** (PRIMARY signal: 164, 119, 36, 23…). Each consolidation = a separate session independently discovering the same truth.
- `importance` — 1-10 score set during creation/validation (all top memories are 10)
- `times_applied` — how often she has actively used it (currently mostly 0; seeds future tracking)
- Filters: `isActive = true AND supersededBy IS NULL` (skip deactivated/superseded lessons)

**Additional filters respected**: Review status values in DB are `approved_auto`, `approved_founder` (not 'approved' — noted for future use). Currently not filtering on review status since most active memories are already approved.

**daniela_notes now pre-injected (5 most recent, high-signal types):**
The `daniela_notes` table has 127 active notes across 8 types. `self_affirmation` (10 notes) was already injected via `classroom-environment.ts`. The remaining types were searchable only via `memory_lookup domain='notes'`. Now the following types are pre-injected as "Personal Notebook":
- `what_worked` — successful approaches worth remembering
- `what_didnt_work` — failed attempts (avoidance signals)
- `teaching_rhythm` — pacing, energy, engagement observations (13 notes)
- `language_insight` — language-specific discoveries (5 notes)
- `idea_to_try` — experiments to test (3 notes)

Types NOT pre-injected (still searchable via memory_lookup):
- `session_reflection` (46 notes) — too session-specific for global injection
- `student_pattern` (37 notes) — too student-specific for global injection
- `tool_experiment` (11 notes) — operational notes, not teaching wisdom

**Implementation changes** (`server/services/streaming-voice-orchestrator.ts`):
- Prefetch block (~line 1004): Updated to composite scoring + parallel notes fetch (12 growth + 5 notes)
- Stale cache fallback (~line 1921): Same update for consistency
- Growth memories display: Added `(reinforced ×N)` badge when `consolidatedFromCount > 1`
- Section now has two sub-parts: "Most Internalized Teaching Lessons" + "Personal Notebook"
- Section header changed from "🌱 YOUR TEACHING GROWTH LOG (Recent Breakthroughs)" → "🌱 YOUR TEACHING GROWTH LOG"

**Log trace**: `[Growth Memories] Prefetched 12 growth memories + 5 notes for session`

**Q1 finding (system prompt):** The system prompt does NOT explain growth memories or how to use them — no guidance exists in the neural network itself about this data. The `memory_lookup` tool description (updated in 38e) is the only place that explains growth memories to Cindy.

**Q2 finding (other daniela_ tables not pre-injected):**
- `daniela_recommendations` — per-user/language lesson recommendations. Intentionally NOT pre-injected (student-specific, shown in UI directly)
- `daniela_suggestions` / `daniela_suggestion_actions` — internal suggestion workflow
- `daniela_beacons` — team collaboration signals (not teaching context)
- `daniela_feature_feedback` — product feedback (not teaching context)

**Q3 finding (deduplication routines):**
- `memory-consolidation-service.ts` IS active: uses Gemini to cluster semantically similar memories, boosts `importance` on canonical, stores merged source IDs in `consolidatedSourceIds`, increments `consolidatedFromCount`
- This is what generated consolidated_from_count=164 for the top memory — it's been running successfully
- The `timesApplied` field is NOT being actively incremented anywhere (field is set but no code tracks apply events). Future improvement: increment when memory is used in context.

---

## Session Summary — Mon, Apr 6, 2026 (session 38f — Growth memories pre-injected into all sessions)

### What was done

#### Feature: Growth memories now pre-injected into every session context at startup

**Design decision**: Growth memories (`daniela_growth_memories`) are Cindy's internalized teaching breakthroughs — humor timing, emotional calibration, correction techniques, punchline delivery, etc. Rather than requiring her to actively search for them (which requires knowing to use domain='growth'), they should be ambient knowledge she walks in with, the same way the Hive state and identity memories are.

**Implementation (`server/services/streaming-voice-orchestrator.ts`):**
- Added `growthMemoriesSection` to the prefetch cache build (runs at session start, parallel with other context fetches)  
- Added stale-cache fallback in the per-turn context path (same pattern as identity memories)
- Added `growthMemoriesSection` to `dynamicContextParts` assembly — after identity memories, before Hive context
- Fetches top 15 most recent growth memories, sorted by `created_at DESC`
- Lesson text truncated at 220 chars; formatted as bullet list by `[category] Title — lesson`
- Gated on `session.userId` (runs for all sessions with a valid user — not developer-only)
- 5-minute cache TTL, same as all other context sections

**Type updated (`server/services/streaming-session-types.ts`):**
- Added `growthMemoriesSection?: string` to `cachedContext` type

**Section header in prompt:**
```
🌱 YOUR TEACHING GROWTH LOG (Recent Breakthroughs)
These are lessons you've internalized about your own teaching. They are already part of who you are — apply them naturally, not mechanically.
```

**Expected behavior**: On every session start, Cindy now receives her 15 most recent growth memories inline (in the same context block as student learning, identity memories, and classroom data). She no longer needs to be asked to "recall" something she learned about humor or timing — she simply knows it. The `memory_lookup` tool with domain='growth' still exists for deeper searches when users ask about specific older lessons.

**Log trace**: `[Growth Memories] Prefetched 15 teaching growth memories for session`

---

## Session Summary — Mon, Apr 6, 2026 (session 38e — Express Lane vs. growth memory routing)

### What was done

#### Bug 5: Cindy goes to Express Lane for joke/lesson content that lives in growth memories

**Root cause** (confirmed from logs + DB inspection):

The `daniela_growth_memories` table DOES contain the December 17, 2025 scarecrow joke session lessons (punchline timing, "outstanding in his field", meta-joke about jumping up and down). These are correctly searchable via `memory_lookup` with domain `'growth'`.

However, when you ask Cindy to "find that joke session", she calls `express_lane_lookup` first — and the Express Lane (`collaboration_messages`) is the WRONG table. It contains Hive team messages (Wren's sprints, Lyra reports, product discussions) — NOT voice session lesson content.

The session ID `25430221-4794-4a00-ac74-db0c2302941b` does exist in `collaboration_messages` but contains SWITCH_TUTOR debugging from Dec 28-29, 2025 — completely unrelated to jokes.

Two additional gate bugs were also found:
1. `EXPRESS_LANE_LOOKUP` was still blocked for developer users in self-directed mode (the previous fix only updated the FC handler case condition, but the function registry description still said "Only available in Founder Mode or Honesty Mode").
2. `memory_lookup` domain description only mentioned `'conversation'` and `'person'` — Cindy had no guidance to use `'growth'` for teaching content she delivered.

**Fixes applied:**

**`server/services/daniela-function-registry.ts` — memory_lookup description:**
- Added TRIGGER CATEGORY 4: joke sessions, timing lessons, humor delivery, comedy workshops → use domain `'growth'`
- Added DOMAIN ROUTING GUIDE: growth = your past teaching moments/jokes you told; conversation = past chats; person = student profile
- Added explicit warning: "The Express Lane is for team collaboration messages, NOT lesson content you taught. Use memory_lookup with domain='growth' for teaching sessions."
- Updated `domains` parameter description to explicitly mention 'growth' and explain what it contains

**`server/services/daniela-function-registry.ts` — express_lane_lookup description:**
- Rewrote to clarify: "does NOT contain lesson content, joke sessions, or teaching moments — those live in memory_lookup with domain='growth'"
- Removed the confusing "Only available in Founder Mode or Honesty Mode" which was already overridden in code

**`server/services/native-fc-handlers.ts` — gate fixes (from 38d/38e):**
- `EXPRESS_LANE_LOOKUP`: now allows `isDeveloperUser` in addition to `isFounderMode || isRawHonestyMode`
- `RECALL_EXPRESS_LANE_IMAGE`: same gate expansion

**Architecture note**: 
- `collaborationMessages` (Express Lane) = Hive team collaboration channel messages, posted via `EXPRESS_LANE_POST`
- `daniela_growth_memories` = Cindy's own past teaching moments, extracted from voice sessions by the memory enrichment pipeline
- `conversation_messages` = raw voice session transcripts
These are THREE separate stores. Cindy must route to the right one: Express Lane ≠ voice session lessons.

---

## Session Summary — Mon, Apr 6, 2026 (session 38d — double audio / Spanish leak in Cindy standard sessions)

### What was done

#### Bug 1: Double audio / double Cindy response (lingering timer fires mid-sentence)

**Root cause confirmed from logs** (line 1568 of Start_application log):
`[OpenMic] LINGERING SAFETY: speech_final never arrived — forcing utterance end for: "Well, in our last session, I actually asked you to look through the express lane to see if"`

The user was mid-sentence ("...to see if [you could find the joke session]"). A 3-second `lingeringSpeechTimeout` started when `is_final=true, speech_final=false` fired for the first segment. While the user continued speaking, NEW INTERIM transcripts were arriving — but the lingering timer was only cancelled on `speech_final` or `UtteranceEnd`, NOT on interim transcripts. So the 3-second timer fired mid-utterance, submitted the partial transcript, Cindy responded to the partial, then the remainder of the utterance came in as a second input — causing TWO Cindy responses and double audio.

**Fix applied (`server/services/deepgram-live-stt.ts`):**
In the interim transcript handler (is_final=false path), added `lingeringSpeechTimeout` cancellation alongside the existing `emptySpeechFinalTimeout` cancellation. Now, whenever new interim speech arrives (meaning the user is actively talking), the lingering safety timer is cancelled and reset. The timer only fires during ACTUAL pauses (no new speech for 3s after an is_final without speech_final).

Log message: `[OpenMic] LINGERING CANCELLED: Interim speech arrived — user still talking, safety timer reset`

**Note**: The lingering timer is still reset when the next `is_final` fires (line 798-800). So the flow is:
- is_final → lingering timer starts (3s)
- new interim arrives → lingering timer CANCELLED (new fix)
- next is_final → lingering timer starts again (refreshed)
This ensures the timer only fires when speech genuinely stops without speech_final.

#### Bug 2: Spanish words leaking into Cindy's English standard-mode sessions

**Root cause**: The `streamingVoiceModeInstructions` string (injected into the system prompt for ALL non-founder/non-honesty sessions) said:
`"Plain text only. Wrap ALL English words in **bold**. English translations in (parentheses)."`

This is semantically meaningless for an English session (every word is English, and "English translations in parentheses" makes no sense), and — critically — it provided NO instruction telling Cindy NOT to use Spanish. Cindy's neural network contains extensive multilingual content from all tutor personas. Without an explicit language boundary, the model would occasionally slip into Spanish filler phrases ("No te preocupes", "código") when prompted by context from the Express Lane or memory.

Honesty mode and founder mode both had this guard (added in session 38):
- Honesty mode (line 770): "do NOT greet or mix in other languages like Spanish unless specifically asked"  
- Founder mode (line 900): "Do NOT default to Spanish greetings or vocabulary"

But standard sessions (the self-directed, open_exploration, guided, and all other modes) were missing it.

**Fix applied (`server/system-prompt.ts`):**
Added `isSameLanguageSession` check before `streamingVoiceModeInstructions` (line 1229). When `languageName === nativeLanguageName` (e.g., English teaching English):
- **New instruction**: "Full English immersion: speak ONLY in English. Your neural network contains content from many languages — but this session is English ONLY. Do NOT mix in Spanish, French, or any other language unless the student explicitly asks."
- For non-same-language sessions (e.g., Spanish teaching English speakers): unchanged behavior (bold target language words, native translations in parentheses).

---

## Session Summary — Mon, Apr 6, 2026 (session 38b — Open Mic 20-second delay fix)

### What was done

#### Open Mic: empty `speech_final` was burning 2 seconds per false positive → 20+ second delay

**Root cause**: Deepgram's `multi` language model fires `speech_final=true` with `text=""` on background noise bursts at ~-66dB every ~10 seconds. Each empty `speech_final` started a 2-second safety timer waiting for `utterance_end` (which never arrives for empty speech). With 2-3 of these stacking before real speech, users saw 20+ second delays before Cindy started thinking.

**Two fixes applied (`server/services/deepgram-live-stt.ts`)**:

**Fix 1 — Empty speech_final no longer burns 2 seconds:**
- **Before**: Empty `speech_final` → `setTimeout(onUtteranceEnd('[EMPTY_TRANSCRIPT]'), 2000)` — 2-second wait per false positive
- **After**: Empty `speech_final` → immediately calls `onUtteranceEnd('[EMPTY_TRANSCRIPT]')` with no delay
- Added `emptyUtteranceHandledAt` timestamp guard so `UtteranceEnd` arriving 1.4s later doesn't double-fire
- Reduced false-positive penalty from ~2s to ~0ms per noise burst

**Fix 2 — Lingering transcript safety net (Cindy not responding at all):**
- **Root cause**: Background noise at -66dB kept Deepgram's VAD continuously "active", preventing `speech_final` from ever firing for real speech. Transcript accumulated correctly in `is_final` events but was never submitted — Cindy never responded.
- **Fix**: After any real `is_final` segment with text, a 3-second `lingeringSpeechTimeout` starts. If `speech_final` or `UtteranceEnd` arrives first, timer is cancelled (normal path). If neither arrives in 3s, the accumulated transcript is force-submitted via `onUtteranceEnd`. Timer also cleared in `close()`.
- Log message: `[OpenMic] LINGERING SAFETY: speech_final never arrived — forcing utterance end for: "..."`

**Fix 3 — `onSpeechFinal` wired up to send `processing_pending` (session 38c):**
- **Root cause**: Open Mic had NO early "thinking" signal. For PTT, `processing_pending` fires immediately on button release. For Open Mic, there was nothing until AI processing completed — meaning the UI stayed in "listening" state for `1400ms (UtteranceEnd delay) + AI latency (1-3s)` after the user finished speaking.
- **Fix**: `onSpeechFinal` is now wired in `openMicEvents` in `unified-ws-handler.ts`. When Deepgram fires `speech_final=true` with real text, the server immediately sends `processing_pending` to the client, which triggers the "thinking" avatar state right when the user stops speaking — not seconds later.
- **Language**: `multi` is kept for ALL sessions (reverted brief `en` change for English). Log analysis confirmed `multi` DOES transcribe English correctly ("Do you remember our session last last night?", "Are are you listening?", "Hello. Hello." — all transcribed successfully with `multi`). The perceived delays were the missing `onSpeechFinal` early signal, not a model failure.

#### Earlier in session 38c: wrong direction — English `en` vs `multi` (ABANDONED)
- Momentarily changed English sessions to `language: 'en'` based on incorrect interpretation of log gaps as model failures. Reverted per user request — `multi` was working for English all along. The real issue was missing `onSpeechFinal` wiring.

---

## Session Summary — Mon, Apr 6, 2026 (session 38 — Cindy/English honesty mode speaking-Spanish fixes)

### What was done

#### 1. Honesty mode identity — no longer anchors Daniela for non-Daniela personas

`server/system-prompt.ts` — `buildRawHonestyModeContext()`:
- **Before**: `You are Daniela, speaking as Cindy — your English voice.` + "No rules. No scripts. Just you." → AI reverts to Spanish-dominant Daniela identity
- **After**: `You are Cindy, the English tutor for HolaHola. This is your authentic self.`
- Also strengthened `langContext`: now says `This is a ${languageName} conversation. Speak ${languageName} ONLY throughout — no Spanish, no other languages — unless the student explicitly asks you to switch.`

#### 2. Claude fallback prompt no longer hardcodes Daniela/Spanish

`server/services/streaming-voice-orchestrator.ts` line 6348 (Gemini rate-limit fallback):
- **Before**: `You are Daniela, a warm and encouraging ${lang} language tutor...`
- **After**: `You are ${tutorPersonaName}, a warm and encouraging ${lang} language tutor...` with `Speak ${lang} ONLY — do not switch to Spanish or any other language unless the target language IS Spanish.`

#### 3. Collaboration events no longer hardcoded to 'daniela' agent

`server/services/streaming-voice-orchestrator.ts` line 7267 (greeting context builder):
- **Before**: `storage.getCollaborationEventsToAgent('daniela', ...)` — fetches Spanish collab context even in Cindy/English sessions
- **After**: `const agentName = session.tutorName?.toLowerCase() || 'daniela'` — uses actual session tutor name

#### 4. Incognito button — connectionState check broadened to all active states

`client/src/components/StreamingVoiceChat.tsx` line 3583:
- **Root cause**: `connectionState === 'connected'` is a TRANSIENT state (~0ms) — it fires when the socket opens, then immediately transitions to `'ready'` once `session_started` is received, then `'processing'`, then `'streaming'`. The button was invisible for the entire active session.
- **Fix**: Check against all active session states: `['connected', 'ready', 'processing', 'streaming', 'reconnecting'].includes(connectionState)` — button is still gated on a live session (won't show before connection), but now stays visible while tutor is responding/speaking.
- NOTE: Session 37 documented "removing the gate" in the handoff doc; session 38 correctly narrowed the fix to broadening the state check instead of removing the gate entirely.

---

## Session Summary — Mon, Apr 6, 2026 (session 37 — Romanization + Dynamic Translation + UI fixes)

### What was done

#### 1. Romanization added to all non-Latin-script conversation strips

`ConversationPanel` now has an optional `romanization?: string` field. Romanized text has been added to all panels in:
- **Japanese** (ひらがな/カタカナ → Romaji): all 3 strips, all 10 panels
- **Korean** (한글 → Romanization): all 3 strips, all 10 panels  
- **Mandarin** (汉字 → Pīnyīn): all 3 strips, all 10 panels
- **Hebrew** (עברית → Transliteration): all 3 strips, all 10 panels

Rendered in `ChapterIntroduction.tsx` between the target text and translation, as small italic muted text (`text-[11px] text-muted-foreground/70 italic`).

#### 2. Dynamic native-language translation endpoint built (`/api/strip-translation`)

- **Endpoint:** `POST /api/strip-translation` (authenticated)
- **Request:** `{ texts: string[], targetLanguage: string }`
- **Response:** `{ translations: Record<string, string> }`
- **Cache:** In-memory Map keyed by `(targetLanguage)::(text)` — never re-translates the same phrase for the same language pair
- **Model:** `gpt-4o-mini` with `json_object` response format
- **Location:** `server/routes.ts` ~line 1812

#### 3. ConversationStripsSection wired to fetch dynamic translations

- `useUser()` added to `ConversationStripsSection` in `ChapterIntroduction.tsx`
- `nativeLanguage` resolved from `user.nativeLanguage` (default: `'english'`)
- When `nativeLanguage !== 'english'`: batches all unique strip translation texts → `POST /api/strip-translation` on mount
- Stores results in `dynamicTranslations` state; renders dynamic translation when available, falls back to static English `panel.translation`
- Translation skips lines starting with `(` (English usage notes like `(informal hello)`)

#### 4. Chat Review button now admin/developer only

`client/src/pages/chat.tsx`:
- `useUser` imported from `@/lib/auth`
- `const { isDeveloper, isAdmin } = useUser()` called at component level
- Review button (`data-testid="button-review-conversation"`) now conditionally rendered: `{conversationId && (isDeveloper || isAdmin) && (...)}`

#### 5. Incognito button no longer requires active voice connection

`client/src/components/StreamingVoiceChat.tsx`:
- Removed `&& streamingVoice.state.connectionState === 'connected'` gate
- Incognito toggle now visible whenever `(isDeveloper || isAdmin) && (learningContext === 'founder-mode' || 'honesty-mode')`

---

## Session Summary — Mon, Apr 6, 2026 (session 36 — All tutor names corrected + native-language translation discussion)

### What was done

#### 1. All 10 language conversation strips now use correct tutor names

All placeholder character names in `client/src/data/chapter-intro-content.ts` replaced with actual seeded tutor names:

| Language | Female tutor (in strips) | Male tutor (in strips) | Formal 3rd character |
|----------|--------------------------|------------------------|----------------------|
| Spanish | Daniela | Agustín | (already correct) |
| French | Juliette | Vincent | M. Dupont |
| German | Greta | Lukas | Oma |
| Italian | Liv | Luca | Nonna Rosa |
| Japanese | 小百合 (Sayuri) | 大輔 (Daisuke) | 田中先生 |
| Korean | 지현 (Jihyun) | 민호 (Minho) | 할머니 |
| Mandarin | 华 (Hua) | 涛 (Tao) | 张老师 |
| Portuguese | Isabel | Camilo | Sr. Oliveira |
| English | Cindy | Blake | Mr. Thompson |
| Hebrew | יעל (Yael) | נועם (Noam) | סבתא |

Contexts updated accordingly (e.g. "Noam meets Yael in the neighborhood", "Tao meets Hua before class").

#### 2. Native-language translation architecture — DISCUSSED, IMPLEMENTED in session 37

---

## Session Summary — Mon, Apr 6, 2026 (session 35 — Multi-Language Conversation Strips + Tutor Voice Fix)

### What was done

#### 1. Pronunciation audio now uses actual tutor voices (Aeode / Orus)
**`server/routes.ts` pronunciation endpoint** (previously IN PROGRESS, now DONE):  
Before generating audio, the endpoint now calls `storage.getTutorVoice(language, voiceGender)` to retrieve the DB tutor voice (e.g. `es-US-Chirp3-HD-Aoede`). That `voiceId` is passed as `voiceOverride` (6th arg) to `getCachedPronunciationAudio`. This means all vocab card audio (VisualVocabGrid), infographic audio, strip sequential player, and any `TextAudioPlayButton` now use the exact Chirp3 HD voices that students hear in chat — Aeode (female) or Orus (male).

**`server/services/audio-caching-service.ts`** was updated in the previous session to accept `voiceOverride` (6th arg) and pass it to `synthesizeWithGoogle` with `forceProvider:'google'`.

#### 2. Conversation strips added for French, German, and Italian greetings

Audio-only strips (no `image` field) — panels display: speaker color dot, speaker name, target text, translation, optional grammar note.

**French** (`french.chapters.greetings.conversationStrips`):
1. "Une Salutation Informelle" — Vincent (m) + Juliette (f), casual
2. "Enchanté" — Vincent (m) + Juliette (f), introduction
3. "Au Bureau — Le Registre Formel" — Vincent (m) + M. Dupont (m), formal office meeting

**German** (`german.chapters.greetings.conversationStrips`):
1. "Eine Lockere Begrüßung" — Lukas (m) + Greta (f), casual
2. "Schön, dich kennenzulernen" — Lukas (m) + Greta (f), introduction
3. "Bei Oma — Der Formelle Ton" — Lukas (m) + Oma (f), Sie/du contrast

**Italian** (`italian.chapters.greetings.conversationStrips`):
1. "Un Saluto Informale" — Luca (m) + Olivia (f), casual
2. "Piacere di conoscerti" — Luca (m) + Olivia (f), introduction
3. "Dalla Nonna — Il Registro Formale" — Luca (m) + Nonna Rosa (f), Lei/tu contrast

All strip panels have explicit `gender: 'male' | 'female'` fields so the sequential player selects the correct tutor voice automatically.

### Previous session (34 — still relevant)
- Spanish strips: Agustín/Daniela/Rosa with images in /strips/. Images still present.
- Sequential audio player with Play/Stop button, 450ms pause between speakers, active panel ring highlight.
- `ConversationPanel` type has `gender?: 'male' | 'female'`.

#### 3. Conversation strips completed for ALL 10 languages (session 35 continued)

All remaining languages received 3 conversation strips each for their `greetings` chapter. Audio-only (no `image` field). All panels carry `gender: 'male' | 'female'`.

| Language | Characters | Strips |
|----------|-----------|--------|
| Japanese | 大輔/Daisuke (m) + 小百合/Sayuri (f); 田中先生 (m formal) | 気軽な挨拶, はじめまして, 先生への挨拶 |
| Korean | 민호/Minho (m) + 지현/Jihyun (f); 할머니 (f formal) | 편한 인사, 만나서 반가워요, 할머니께 |
| Mandarin | 涛/Tao (m) + 华/Hua (f); 张老师 (m formal) | 日常问候, 初次见面, 尊敬师长 |
| Portuguese | Camilo (m) + Isabel (f); Sr. Oliveira (m formal) | Cumprimento Casual, Muito Prazer, Na Empresa |
| English | Blake (m) + Cindy (f); Mr. Thompson (m formal) | A Casual Hello, Nice to Meet You, A Formal Introduction |
| Hebrew | נועם/Noam (m) + יעל/Yael (f); סבתא (f family) | שלום פשוט, נעים להכיר, כבוד לסבתא |

**Note on English strips:** Since the target text IS the language, `translation` fields are used for parenthetical usage notes (e.g. "(casual: How are you?)" "(mirroring the formal register is always safe)") instead of a native-language translation.

**Note on Hebrew strips:** Hebrew has no formal pronoun like usted/vous/Sie. The formal register strip shows warmth through vocabulary and terms of endearment rather than pronoun switch.

### NEXT TASK / OPEN ITEMS
- **Character image/voice mismatch (known issue):** Some vocab images show a male character but audio uses female tutor voice (or vice versa). Happens when the image was generated with one tutorGender but user has switched. No immediate fix — documented.
- **Spanish strip images:** 10 panel images still in `client/public/strips/`. Decision pending on whether to keep or remove; they show for Spanish but not for other languages.
- **All 10 languages have conversation strips:** Feature complete for greetings chapter.

---

## Session Summary — Sun, Apr 5, 2026 (session 33 — Static Active Production + Formal/Informal examples)

### What was done

#### 1. All 3 "AI-Generated Practice: Active Production" lessons converted to static curated content

**Scope:** These 3 lessons existed across Spanish 1 / 2 / 4 Ch1 — all named "AI-Generated Practice: Active Production", all with stale or mismatched AI-generated drill items.

| Course | Chapter | Old item count | Problem | Renamed to |
|--------|---------|---------------|---------|------------|
| Spanish 1 | Greetings | 6 | Arbitrary items (bare "me llamo", "por favor") | **Speaking Practice: Introductions** |
| Spanish 2 | Daily Routines | 48 | Office/work/report context for a daily routines chapter | **Speaking Practice: Daily Routines** |
| Spanish 4 | Global Challenges | 48 | Greetings/introductions content for a global issues chapter | **Speaking Practice: Global Issues** |

**Static curated items (6 per lesson):**
- **Sp1**: Me llamo [Your Name]. / ¿Cómo te llamas? / Mucho gusto. / Estoy bien, gracias. / ¿Y tú? / ¡Hasta luego!
- **Sp2**: Me despierto a las seis. / ¿A qué hora te despiertas? / Primero me ducho, luego desayuno. / ¿Cuál es tu rutina por la mañana? / Me acuesto tarde los fines de semana. / ¿Tienes una rutina fija cada día?
- **Sp4**: El cambio climático es un desafío global. / Debemos proteger el medio ambiente. / La pobreza es un problema que necesitamos resolver. / ¿Cómo podemos reducir la contaminación? / La desigualdad afecta a millones de personas. / Es importante desarrollar soluciones sostenibles.

All items are `translate_speak` type, ordered 1–6. Script: `/tmp/fix-active-production.ts` (deleted after use).

**Note:** Spanish 3 Ch1 has NO "AI-Generated Practice: Active Production" lesson — it has "Active Practice: Mixed Drills" (L50) which is a different pattern and was not touched.

#### 2. Formal vs. Informal sections enhanced with concrete examples (ES, FR, DE, IT)

**Type added to `chapter-intro-content.ts`:**
```typescript
export interface FormalInformalExample {
  label: string;
  formal: string;
  informal: string;
}
```
Field added to `ChapterIntroContent.narrativeSections`: `examples?: FormalInformalExample[]`

**Examples added to all 4 greetings chapters:**
- Spanish: usted vs tú — ¿Cómo está usted? vs ¿Cómo estás?, Buenos días señora vs ¡Hola!, etc.
- French: vous vs tu — Comment allez-vous? vs Ça va?, Au revoir Monsieur vs À plus!
- German: Sie vs du — Wie geht es Ihnen? vs Wie geht's?, Auf Wiedersehen vs Tschüss!
- Italian: Lei vs tu — Come sta, signor Rossi? vs Come stai?, Arrivederci vs A presto!

**Rendering in `ChapterIntroduction.tsx`:** After the tip block, a two-column comparison grid renders each formal/informal pair with a small context label (e.g., "How are you?") above each cell. Uses `bg-muted/40` for formal column, `bg-muted/10` for informal column. Test IDs: `examples-section-{i}`, `example-row-{i}-{j}`.

#### 3. Conversation Strip system — "In Conversation" section

**New types in `chapter-intro-content.ts`:**
```typescript
ConversationPanel { speaker, text, translation, note? }
ConversationStrip { title, context, panels: ConversationPanel[] }
ChapterIntroContent.conversationStrips?: ConversationStrip[]
```

**Spanish greetings data restructured:**
- Removed "The Art of Greeting" narrative section (strips show this more effectively)
- Removed `culturalSpotlight` (La Sobremesa — not relevant to greetings vocab)
- Added 4 conversation strips:
  1. "A Casual Hello" — 4 panels: ¡Hola! → ¡Hola! ¿Cómo estás? → ¡Muy bien! ¿Y tú? → ¡Bien! ¡Hasta luego!
  2. "Nice to Meet You" — 3 panels: me llamo / mucho gusto / el gusto es mío
  3. "Morning, Afternoon, Evening" — 3 panels: buenos días / buenas tardes / buenas noches
  4. "At School — The Formal Register" — 3 panels: usted/¿cómo está usted? + teacher replies with tú; shows the register asymmetry

**Rendering in `ChapterIntroduction.tsx`:** After narrative sections, before cultural spotlight. Each strip is a Card with title + italic context label, then a horizontal scrollable panel row. Each panel: 20px colored circle (deterministic per speaker across the strip), speaker name, target text, italic translation, optional small note (for grammar callouts). ChevronRight arrows between panels. Color palette: blue/rose/emerald/amber/violet (by order of first appearance). Test IDs: `section-conversation-strips`, `card-strip-{i}`, `strip-panels-{i}`, `panel-{i}-{j}`.

**What needs to happen next for strips:**
- French, German, Italian greetings chapters need `conversationStrips` data written
- Other chapter types (numbers, family, classroom etc.) need strips designed for their vocabulary
- Grammar strips (e.g., "Reflexive Verbs in Action" for daily routines) can be added similarly
- Image panels: once layout is validated, DALL-E 3 can generate pen-and-watercolor panel art

### What still needs to happen (next session priorities)

---

## Session Summary — Sun, Apr 5, 2026 (session 32 — Section swap, Active Production dedup, Recap enrichment)

### What was done

#### 1. Greetings chapter section order fixed (ES, FR, DE, IT)
- In `chapter-intro-content.ts`, swapped "The Art of Greeting" and "Time Matters" in all 4 language greetings chapters
- "Time Matters" now comes FIRST (with `infographic: 'sunArcGreetings'` — the sun arc belongs there, showing time-of-day greetings)
- "The Art of Greeting" follows (text + cultural tip, no infographic)
- "Formal vs. Informal" remains third in all languages

#### 2. Active Production lesson drill dedup (Ch1 Spanish 1)
- **8 stale `matching` items deleted**: These were food/restaurant vocab (Pollo, Pescado, Tenedor, Restaurante, etc.) — never caught by the translate_speak fix in session 31
- **10 duplicate `translate_speak` items deleted**: Words already in "Practice Time: Greetings & Farewells" (hola, adiós, buenos días, buenas tardes, buenas noches, ¿Cómo estás?, Estoy bien, mucho gusto, gracias, de nada)
- Active Production now has 6 unique phrase-level items: `¿Y tú?`, `me llamo`, `¿Cómo te llamas?`, `por favor`, `Me llamo [Your Name].`, `Estoy bien, gracias. ¿Y tú?`

#### 3. ChapterRecap.tsx enriched
- Vocab items shown: 6 → 10
- Phrases shown: 3 → 5
- Added ACTFL level and cultural theme badges in header area
- For unstarted chapters (progress=0): shows "What You'll Learn" with `chapter.description` instead of empty achievement slot

### What still needs to happen (next session priorities)

---

## Session Summary — Sun, Apr 5, 2026 (session 31 — Chapter reorder + stale drill fix)

### What was done

#### 1. Chapter reorder: Birthdays & Dates moved from position 9 → 7
- Numbers 0–20 (5) → Telling Time (6) → **Birthdays & Dates (7)** → Family Members (8) → Describing People (9)
- Previously: Birthdays & Dates was separated from its numeric/time prerequisites by Family and Describing People
- Script: `server/scripts/reorder-chapters.ts` — swapped order_index values for 3 chapters via temp values to avoid unique constraint collision

#### 2. Stale drill content fixed for 2 Spanish 1 lessons
- Root cause: `curriculum_drill_items` seeded before restructuring — drill content reflected old mega-unit context, not lesson's current `required_vocabulary`
- **Scan method:** `server/scripts/find-stale-drills.ts` — compared drill items vs vocab roots from `required_vocabulary`; threshold: >50% mismatch
- **Only 2 lessons affected** (out of 43): Ch1 "AI-Generated Practice: Active Production" and Ch20 "New Words: Colors & Sizes"
- **Root of mismatch:** Both had `textbook_lesson_content.vocabulary_list` already correct, but `curriculum_drill_items` were pre-populated from stale data
- **Fix script:** `server/scripts/fix-stale-drills.ts` — deleted `translate_speak`/`fill_blank` item types for those 2 lessons, then re-inserted from `textbook_lesson_content.vocabulary_list`
- Result: Ch1 now shows greetings vocab (hola, adiós, buenos días...); Ch20 shows colors (rojo, azul, verde...)

#### 3. Hobbies vs Food order — left as-is
- Current order: Hobbies (14-16) → Food (17-19) is correct pedagogically
- Hobbies flows directly from -AR verb conjugation chapter (jugar, practicar, tocar all -ar verbs)
- Food/restaurant ordering patterns require more conversational base and land better after hobbies

### What still needs to happen (next session priorities)

#### HIGH — Add chapter intro content for the 14 new Spanish chapter types
See session 30 notes. New types need `chapter-intro-content.ts` content.

#### HIGH — Run same audit + restructure for Spanish 2–5
Same methodology: audit → design doc → migration script → execute.

#### MEDIUM — Run stale drill scan after Spanish 2–5 restructuring
When moving lessons during restructuring, always run `find-stale-drills.ts` afterward to catch any curriculum_drill_items that reference old content.

#### LOW — Stock images for new chapter types (food, travel, city, weather, etc.)

### Scratchpad carry-forward
- **Stale drill pattern:** After any lesson restructuring, run `find-stale-drills.ts` + `fix-stale-drills.ts`
- **seed_service skip rule:** `vocab-drill-seed-service` skips lessons with 5+ `translate_speak` items — must DELETE stale items first before reseeding
- **DB RULE:** Use Pool directly with `NEON_SHARED_DATABASE_URL` for scripts

---

## Session Summary — Sun, Apr 5, 2026 (session 30 — Spanish 1 full curriculum restructuring)

### What was done

#### 1. Full deep audit of all 9 Spanish 1 units
- Script: `server/scripts/spanish1-full-audit.ts` — pulls lesson-level vocab + grammar for all units
- **Key finding:** "22 grammar items" in Chapter 1 = 4 real concepts duplicated ~5× across lessons; same pattern across all 9 units
- **Grammar categorization reform adopted:** Only count structural grammar (conjugation, pronoun systems, agreement, negation, tense). Fixed expressions and question-word lists are not counted as grammar.
- Full audit saved to `/tmp/spanish1-audit-full.txt`

#### 2. Complete restructuring design document written
- File: `docs/curriculum-restructure-spanish1.md`
- Design spec: 9 mega-units → 27 focused chapters
- Each chapter: 10–14 vocab, 4–6 phrases, 1–3 real grammar concepts
- Lesson-to-chapter mapping, new chapter types, grammar targets, content gap flags — all specified
- New chapter type classifiers needed: documented in spec

#### 3. Spanish 1 restructuring migration executed (LIVE IN DB)
- Script: `server/scripts/restructure-spanish1.ts` — idempotent, transactional, verified
- Pre-migration check: `server/scripts/pre-migration-check.ts` — all 43 lesson IDs verified before run
- Result: **27 new curriculum_units created**, all 43 lessons moved, 9 old mega-units archived
- Chapter types assigned: greetings, introductions, classroom, daily, numbers, time, family, descriptions, school, grammar_ar_verbs, food, grammar_stem_changers, clothing, shopping, literacy, city, travel, weather, hobbies
- Vocab/grammar arrays updated for 26 of 27 chapters (content augmented simultaneously during reorg)
- Zero orphaned lessons confirmed

#### 4. ChapterIntroduction.tsx updated for new chapter types
- `DYNAMIC_COVER_TYPES` now includes all 19 chapter types
- `classifyChapterType()` expanded with match strings for all new types (introductions, time, descriptions, food, clothing, shopping, hobbies, city, travel, weather, school, grammar_ar_verbs, grammar_stem_changers, literacy)
- `chapterImages` updated to map all new types to appropriate stock images
- New `numbersImg` import added from `numbers_counting_blocks_education.jpg`
- **Note:** New chapter types render null intro (graceful) until `chapter-intro-content.ts` is populated for them — this is intentional

### What still needs to happen (next session priorities)

#### HIGH — Add chapter intro content for the 14 new Spanish chapter types
The 14 new chapter types (introductions, time, descriptions, food, clothing, shopping, hobbies, city, travel, weather, school, grammar_ar_verbs, grammar_stem_changers, literacy) have no content in `chapter-intro-content.ts` yet. The component gracefully returns null for these until content is added. Same content needed for all 10 languages eventually but start with Spanish.

#### HIGH — Run same audit + restructure for Spanish 2–5
Same methodology: audit → design doc → migration script → execute. Spanish 2 alone has a health chapter with 177 vocab. Total estimated scope: 37 existing chapters → ~90–110 after splits across all levels.

#### MEDIUM — Visual asset audit for new chapters
New vocabulary items were added during restructuring (tío/tía/primo, medianoche, septiembre–diciembre, hace viento, pagar, beber, etc.) — need to audit which new vocab items lack images in the visual asset pipeline.

#### LOW — Stock images for new chapter types
Currently all non-family new types map to coffeeShopImg as a placeholder. Should commission or find appropriate stock/generated covers for food, clothing, travel, city, weather, etc.

### Scratchpad carry-forward
- **DB RULE:** `getMonitoringDb()` = HTTP read-only. `getSharedDb()`/`getUserDb()` = WebSocket pool. Use Pool directly with `NEON_SHARED_DATABASE_URL` for scripts.
- **API Key:** `USER_OPENAI_API_KEY` for DALL-E 3. Do NOT use `AI_INTEGRATIONS_*`.
- **SCENE_STYLE locked:** pen-and-watercolor-wash. No quoted speech in prompts.
- **Spanish 1 path ID:** `60769ffc-6dcd-417e-add5-0ac612377da8`
- **Grammar tier system:** Tier 1 = structural (counts), Tier 2 = phrase patterns (vocabulary), Tier 3 = fixed expressions (vocabulary). Only Tier 1 counts as grammar.

---

## Session Summary — Sun, Apr 5, 2026 (session 29 — Classroom chapter type + prompt templating policy)

### What was done

#### 1. 'classroom' chapter type added to ChapterIntroduction.tsx
- `DYNAMIC_COVER_TYPES` updated: now includes `'classroom'` (uses DALL-E watercolor cover)
- `chapterImages` updated: `classroom` maps to `coffeeShopImg` (placeholder; will need dedicated classroom-scene cover later)
- `classifyChapterType()` updated: 'classroom' check added **before** 'greetings' check to avoid false-positive collisions with chapter titles containing "introduction"
- Classroom match conditions: `classroom`, `survival`, `en la clase`, `en clase`, `im unterricht`, `in classe`, `na aula`, `en cours`, `교실`, `クラス`, `课堂`, `כיתה`, plus compound `class + expression/phrase/survival`

#### 2. 'classroom' chapter intro content added for all 10 language sections
`client/src/data/chapter-intro-content.ts` — added `classroom:` key inside `chapters` for all 10 languages: **spanish, french, german, italian, japanese, korean, mandarin, portuguese, english, hebrew**

Each classroom section includes:
- `welcomeText` — language-specific intro to navigating the classroom
- 3 `narrativeSections`: (1) how to ask/request clarification, (2) understanding teacher instructions, (3) checking understanding and confirming
- `culturalSpotlight` — culturally grounded note on classroom culture specific to each language:
  - ES: *El Respeto en el Aula* (formal usted address, teacher greeting ritual)
  - FR: *Le Respect en Classe* (intellectual rigor, hand-raise culture)
  - DE: *Pünktlichkeit im Unterricht* (punctuality as respect)
  - IT: *La Bella Figura in Aula* (fare bella figura, graceful error recovery)
  - JA: *起立・礼・着席* (stand-bow-sit classroom ceremony)
  - KO: *선생님께 대한 존경* (Confucian respect for teachers)
  - ZH: *尊师重道* (zūn shī zhòng dào — Confucian teacher respect tradition)
  - PT: *Jeitinho Brasileiro na Sala de Aula* (participative Brazilian culture vs. formal PT)
  - EN: *The Open Classroom Culture* (mistakes as learning, open participation)
  - HE: *ישירות ישראלית* (dugriut — Israeli directness, first-name teacher culture)

#### 3. Rule 5 added to docs/visual-asset-roadmap.md
**Rule 5 — Prompt Templating (Character Substitution) for Language-Specific Images** documents:
- The CHAR.ES / CHAR.FR / CHAR.DE / etc. character profile system already in `vocab-image-seed-service.ts`
- The technique name: "character-substitution prompt templating" (aka persona swap)
- Full table of all 9 language character profiles
- How-to: swap `CHAR.ES.primary` → `CHAR.FR.primary` in any SCENE_OVERRIDE prompt
- Coverage audit status: ⬜ Not started — estimated ~200-300 images across 8 non-Spanish languages
- Notes on which prompts need scene-level changes beyond character swap

### What still needs to happen (next session priorities)

#### HIGH — DB curriculum unit split (makes classroom chapter actually appear as separate chapter)
The 'classroom' chapter type now exists in code but **Unit 1 in the DB still bundles all 4 lesson themes together**. To make Classroom Survival appear as its own chapter in the textbook:
1. Create new curriculum units: "Classroom Survival", "Numbers 0-20", "My Typical Day"
2. Move lessons from Unit 1 into the appropriate new units
3. Each new unit will then map to a separate chapter in the textbook UI
4. Write a migration script in `server/scripts/` (similar to `update-spanish-syllabus.ts`) but be careful about existing student progress data

**Content targets per new chapter (Option A — flat chapters):**
- Each chapter: 10-15 vocab words + 5-8 phrases + 1-2 grammar concepts
- Classroom Survival: asking for clarification, classroom commands, bathroom/help phrases
- Numbers: 0-20 cardinal, ordinal basics, phone/price usage
- My Typical Day: daily schedule verbs, time expressions, days of week

#### MEDIUM — Prompt templating coverage audit
Run audit to determine:
- How many non-Spanish scene images currently exist
- Which SCENE_OVERRIDE prompts are character-swap-only vs. scene-change-required
- Estimated DALL-E budget for the full generation run

#### LOW — Classroom chapter DALL-E cover image
The classroom chapter cover currently uses `coffeeShopImg` as placeholder. Add a dedicated classroom scene (`/api/chapter-cover/classroom`) with an appropriate pen-and-watercolor-wash prompt.

---

## Session Summary — Sat, Apr 4, 2026 (session 28 — Canonical vocabulary registry + admin audit endpoint)

### What was done

#### 1. Canonical vocabulary registry created (`server/data/canonical-vocabulary.ts`)
All 27 thematic units × 9 languages defined as a static registry.

**Key exports:**
- `CANONICAL_UNITS` — `Record<UnitTheme, ConceptEntry[]>` for all 27 themes
- `CANONICAL_LOOKUP` — precomputed `Map<"lang:word", sharedConceptKey>` (O(1) lookup, built at import time)
- `lookupCanonicalConcept(word, language)` — returns `sharedConceptKey | null`
- `getAllConcepts()` — flat list of all ConceptEntry objects for audit/report endpoints

**ConceptEntry shape:**
```ts
interface ConceptEntry {
  conceptKey: string;         // internal stable key e.g. "study"
  englishGloss: string;       // human label e.g. "to study"
  imageTier: 'shared' | 'scene_override' | 'svg' | 'none';
  sharedConceptKey?: string;  // e.g. "vocab_spanish_estudiar" (shared-tier only)
  words: Partial<Record<Language, string>>;
  notes?: string;
}
```

**27 unit themes (in order):**
greetings, family, school, hobbies, food, numbers_time, daily_routines, shopping, city,
travel_transport, identity, health, technology, environment, past_tense, global_challenges,
arts, history, future_plans, travel_extended, science, cultural_perspectives, exam_prep,
cultural_heritage, media_journalism, finance, advanced_skills

#### 2. Four-tier image routing (vocabulary-image-resolver.ts)
The resolver now follows this exact order on every word:

| Tier | Step | Mechanism | Description |
|------|------|-----------|-------------|
| **Canonical** | Step 0 | `lookupCanonicalConcept()` | O(1) Map lookup in the registry; also tries stripped form (reflexive prefix) |
| **Concept map** | Step 1 | `CONCEPT_KEY_MAP` | Legacy cross-language map; tries stripped pronoun form; also tries canonical on stripped |
| **Character scene** | Step 2 | `SCENE_OVERRIDES` | Language-specific character scenes (greetings, classroom phrases, reflexive verbs) |
| **SVG/grammar** | Step 3 | `isSVGWord()`, grammar classifiers | Articles, prepositions, numbers etc. |

**Anchor fallback**: On concept cache miss, if `conceptKey` starts with `vocab_spanish_`, the
resolver extracts the anchor word (replacing `_` → space), looks it up in `SCENE_OVERRIDES`,
and uses that prompt for DALL-E generation. This lets French `boire` → canonical →
`vocab_spanish_beber` → `SCENE_OVERRIDES["beber"]` without needing a French-specific override.

#### 3. Admin audit endpoint (`GET /api/admin/vocab-audit`)
Located in `server/routes.ts` (after `/api/admin/vocab-images/seed-all-progress`).

Queries actual lesson `required_vocabulary` from `curriculum_lessons` (joined with units and paths).
Classifies each word through all four routing tiers.

**Query params:**
- `language=es` or `language=spanish` — both short codes and full names supported
- `status=unrouted` — filter to a specific routing status

**Classification logic:**
```
canonical      → lookupCanonicalConcept(word, lang) returns a sharedConceptKey
shared_concept → CONCEPT_KEY_MAP[normalizeWord(word)] returns a conceptKey
scene_override → SCENE_OVERRIDES[normalizeForOverride(word)] is defined
unrouted       → none of the above match
```

**Response shape:**
```json
{
  "summary": { "total": 450, "routed": 380, "unrouted": 70, "coveragePercent": 84 },
  "byLanguage": [{ "language": "spanish", "total": 80, "routed": 75, "unrouted": 5, "coveragePercent": 94 }],
  "byUnit": { "spanish__Unit 1: Greetings": { "language": "spanish", "unitName": "...", "lessons": [...] } }
}
```

#### 4. New Spanish anchor SCENE_OVERRIDEs (~60+ entries, vocab-image-seed-service.ts ~line 1016)
Added immediately after the daily routine verbs section, before the Adjective Pairs section.
All use `${CHAR.ES.primary}` (Daniela) for action verbs; still-life/landscape for objects:

**Action verbs:** beber, ir, venir, escuchar, leer, escribir, jugar, bailar, cantar, nadar,
cocinar, pintar, despertarse, ducharse, dormir, correr, caminar, comprar, vender

**People / family:** madre, padre, hermano, hermana, abuela, abuelo, amigo, maestra,
estudiante, bebe, familia, hombre, mujer, nino, nina

**School objects:** libro, lapiz, boligrafo, mochila, escritorio, silla, aula, escuela, ventana

**Food & drink:** pan, leche, agua, arroz, cafe, te, platano, huevo, pescado, restaurante

**Time of day:** manana (morning), tarde (afternoon), noche (night)

**Clothing:** camisa, pantalon, falda, zapato, vestido, sombrero, abrigo, calcetin, bolso,
precio, musica, deporte, juego

**City / community:** hospital, banco, supermercado, parque, biblioteca, farmacia, calle,
casa, ciudad

**Transport:** avion, tren, autobus, coche, bicicleta, barco, aeropuerto, estacion, billete,
maleta, pasaporte, hotel

**Health:** enfermo, sano, fiebre, dolor de cabeza, medico, medicina

**Nature:** arbol, flor, mar, montana

**Technology:** telefono, computadora, internet, mensaje, video

**Arts:** cuadro, escultura, novela, poema, teatro, museo

**Finance:** dinero

**Science:** experimento, robot

### Four-tier routing architecture summary (canonical definition)
```
Word → resolver
  ├── Step 0: lookupCanonicalConcept(word, lang)        [O(1) Map; 27 units × 9 languages]
  │     └─ on hit: go to concept cache path (Step 1a/1b)
  ├── Step 1: CONCEPT_KEY_MAP[normalizeWord(word)]      [legacy cross-language map]
  │     ├─ also tries pronoun-stripped form
  │     └─ also tries canonical on stripped form
  ├── Step 2: SCENE_OVERRIDES[normalizeForOverride(word)]  [character scenes]
  │     └─ on concept cache miss: anchor word SCENE_OVERRIDE extracted from conceptKey
  └── Step 3: isSVGWord / grammar classifiers            [SVG placeholder]
```

### State at end of session
- `server/data/canonical-vocabulary.ts`: created — 27 unit themes × 9 languages, ~350+ ConceptEntry objects ✓
- `server/services/vocabulary-image-resolver.ts`: Step 0 canonical lookup wired; CONCEPT_KEY_MAP and normalizeWord now exported; anchor fallback for SCENE_OVERRIDE on cache miss ✓
- `server/services/vocab-image-seed-service.ts`: ~60+ new Spanish anchor SCENE_OVERRIDEs ✓
- `server/routes.ts`: `GET /api/admin/vocab-audit` endpoint added (queries actual DB lesson vocabulary) ✓
- `client/src/pages/admin/CommandCenter.tsx`: Vocab Audit tab added to Content group with filters, coverage chart, and per-unit word breakdown ✓
- `docs/alden-agent-handoff.md`: updated ✓

### Next priorities
- Run the Vocab Audit tab (CommandCenter → Content → Vocab Audit) to see live coverage report
- Use `/api/admin/vocab-images/seed` to generate missing images for new anchor concepts (beber, ir, etc.)
- Add CONCEPT_KEY_MAP clusters for the new canonical verbs (beber/drink, ir/go, venir/come, etc.)
- Seed-all to populate the DALL-E images for all new shared concept keys in the canonical registry

---

## Session Summary — Sat, Apr 4, 2026 (session 27 — Daily routine verbs + pronoun-prefix sentence resolver)

### What was done

#### 1. Spanish anchor SCENE_OVERRIDEs for 6 daily routine verbs (vocab-image-seed-service.ts ~line 1000)
Six new entries using `${CHAR.ES.primary}` (Daniela) placed immediately before the Adjective Pairs section:
- `estudiar` — at a desk with textbook and notebook, morning light
- `trabajar` — at a desk typing on a laptop, home workspace
- `mirar` — sitting on a couch watching TV, bowl of popcorn
- `levantarse` — stretching out of bed at dawn, gauzy curtains
- `acostarse` — climbing into bed at night, bedside lamp
- `vestirse` — buttoning up shirt in front of wardrobe mirror

These are the canonical **anchor images** for the cross-language concept map. Each Spanish word key
resolves to `vocab_spanish_{word}`, which all other languages then share via the CONCEPT_KEY_MAP.

#### 2. Cross-language CONCEPT_KEY_MAP entries for 6 verb clusters (vocabulary-image-resolver.ts ~line 1386)
Inserted after the `// buy (comprar)` block. Each language cluster lists cognates that all map to the
same Spanish anchor concept key:

| Cluster | Anchor key |
|---|---|
| study (étudier, studieren, studiare, estudar, study, 勉強する, 공부하다, 学习) | `vocab_spanish_estudiar` |
| watch/look (regarder, schauen, anschauen, guardare, assistir, watch, 見る, 보다, 看) | `vocab_spanish_mirar` |
| work (travailler, arbeiten, lavorare, trabalhar, work, 働く, 일하다, 工作) | `vocab_spanish_trabajar` |
| get up (se lever, aufstehen, alzarsi, levantar-se, get up, wake up, 起きる, 일어나다, 起床) | `vocab_spanish_levantarse` |
| go to bed (se coucher, schlafen gehen, andare a letto, deitar-se, go to bed, 寝る, 자다) | `vocab_spanish_acostarse` |
| get dressed (s'habiller, sich anziehen, vestirsi, vestir-se, get dressed, 着る, 옷을 입다, 穿衣) | `vocab_spanish_vestirse` |

**Removed ambiguous entries**: `ver` (means "worm" in French), `angucken`/`gucken` (DE informal, risky)

#### 3. Pronoun-prefix sentence-form resolver (vocabulary-image-resolver.ts ~line 2758)
Added inside `resolveVocabularyImage` function before the CONCEPT_KEY_MAP lookup.

**Problem solved**: Sentence forms like `Je mange.` or `Tu travailles.` hit the cache with a unique
key and never matched the concept map. Now stripped to bare verb form before lookup.

**Implementation**:
- `CONJUGATION_PRONOUNS` map covers FR/DE/IT/PT/ES/EN/JA/KO/ZH
- `stripPronounPrefix()` detects 2-token normalised forms where the first token is a pronoun
- French elided forms like `j'étudie` normalise to `j etudie` → stripped to `etudie` automatically
  (because `normalizeWord` converts apostrophe → space, and `j` is in the FR pronoun list)
- Periods stripped by `normalizeWord` before stripping: `Je mange.` → `je mange` → `mange` ✓
- Falls through silently if the stripped form doesn't hit the concept map — no false matches

### Three-tier image routing framework (canonical definition)
1. **SVG** — function/grammar words (articles, prepositions, conjunctions, numbers when abstract).
   Routed via `ENGLISH_FUNCTION_WORDS`, `classifyFrenchGrammarType`, `isSVGWord` etc.
2. **Shared concept watercolor image** — universal actions and nouns where the concept is
   language-agnostic (eat, drink, sleep, study, work, buy, head, hand…). All languages share one
   DALL-E image via `CONCEPT_KEY_MAP` → anchored to the Spanish vocab key.
3. **Character scene override** — culturally specific phrases, greetings, reflexive politeness
   routines where a character IS needed (Hola/Bonjour = meeting scene; ¿Puedes repetir? = asking
   gesture scene). Routed via `SCENE_OVERRIDES` in vocab-image-seed-service.ts.

**SPEECH BUBBLE RULE**: Never put quoted verbal phrases in a SCENE_OVERRIDE description.
Physical/gestural descriptions only (e.g. "waves hello", "points at viewer", "holds up open palms").

### State at end of session
- vocab-image-seed-service.ts: 6 daily routine SCENE_OVERRIDEs added ✓
- vocabulary-image-resolver.ts: 6 verb clusters × ~10 languages each added to CONCEPT_KEY_MAP ✓
- vocabulary-image-resolver.ts: pronoun-prefix stripping added before concept lookup ✓
- Server: compiling cleanly, no TypeScript errors ✓
- docs/alden-agent-handoff.md: updated ✓

### Next priorities
- Task #5: Canonical vocabulary registry covering all 27 thematic units × 9 languages
  (plan file at `.local/tasks/textbook-canonical-vocab.md`)
- Run fix-word for Spanish daily routine verbs once images confirmed generated
- Add `étudier`, `travailler`, `regarder`, `se lever`, `se coucher`, `s'habiller` to French fix-word list
- Consider adding `beber` cluster (to drink — FR boire, DE trinken, IT bere, PT beber, EN drink)
  and `ir` cluster (to go — FR aller, DE gehen, IT andare, PT ir, EN go) — same pattern

---

## Session Summary — Sat, Apr 4, 2026 (session 26 — Cross-language core vocabulary SCENE_OVERRIDES)

### What was done

#### 1. Italian collision-fix entries added to Italian section (~line 542)
- `italian:no` — Giulia head-shake + palm-out (prevents collision with Spanish bare `no`)
- `italian:si` — Giulia nodding + thumbs-up (prevents collision with Spanish bare `si`)

#### 2. Portuguese `você` language-prefixed override added (~line 562)
- `portuguese:voce` — Ana pointing at viewer
- Language-prefixed because bare `voce` would collide with Italian "voce" (= voice)

#### 3. English language-prefixed vocabulary overrides added (~line 735)
Six entries using Emma (`CHAR.EN.primary`) — bypass `ENGLISH_FUNCTION_WORDS` auto-SVG:
- `english:no` — head-shake + palm-out stop
- `english:yes` — nod + thumbs-up
- `english:you` — pointing at viewer
- `english:this` — pointing at nearby object
- `english:what is this` — puzzled at wrapped object
- `english:where is it` — searching palms-up look

#### 4. Cross-language core vocabulary — bare key section added (~line 742)
Comprehensive bare-key section. Action descriptions (3+ words, no character name) auto-inject
the language's primary character via `LANGUAGE_CHARACTER_INTROS`. Bare keys serve all languages
that don't have a more-specific language-prefixed entry (e.g. `spanish:no` wins for Spanish;
bare `non` serves French; bare `nein` serves German; etc.).

**NEGATION** (head-shake + palm-out): `non`, `nein`, `nao`, `いいえ`, `아니요`, `不`

**AFFIRMATION** (nod + thumbs-up): `oui`, `ja`, `sim`, `はい`, `네`, `对`

**YOU / INFORMAL 2nd PERSON** (pointing at viewer):
`tu` (FR/IT/PT — `spanish:tu` wins for ES), `du`, `vous`, `あなた`, `당신`, `너`, `你`

**THIS / DEMONSTRATIVE** (pointing at object):
`ca` (ça→ca), `ceci`, `das`, `questo`, `questa`, `isto`, `isso`, `これ`, `이것`, `这个`

**WHAT IS THIS?** (puzzled at wrapped object):
`qu'est-ce que c'est`, `was ist das`, `cos'e questo`, `cos'e`, `o que e isso`,
`これは何ですか`, `이게 뭐예요`, `这是什么`

**WHERE IS IT?** (searching palms-up):
`ou est`, `wo ist`, `dove e`, `onde esta`, `どこですか`, `어디에 있어요`, `在哪里`

#### Architecture reminder
- **Bare key + action description (3+ words)** → `looksLikeActionOrPhrase` = TRUE → character auto-prepended from `LANGUAGE_CHARACTER_INTROS`. No character name needed in the description.
- **Language-prefixed key** (e.g. `italian:no`) → use `${CHAR.IT.primary}` explicitly. Only needed for collision prevention.
- **`ENGLISH_FUNCTION_WORDS`** auto-SVG check is bypassed whenever a `SCENE_OVERRIDE` exists for that key.

### State at end of session
- All cross-language core vocabulary overrides: ✓ added
- Server: ✓ compiling cleanly, no TypeScript errors
- No fix-word runs needed yet — these are new overrides for future image generation

### Next priorities
- Run fix-word for Spanish: `No`, `Sí`, `Tú`, `Usted`, `Esto`, `¿Qué es esto?`, `¿Dónde está?`
- Run fix-word for Italian: `No` (italian), `Sì` (italian)
- Test bare-key overrides for French/German/Portuguese by triggering vocabulary image resolution
- See visual-asset-roadmap.md for remaining work

---

## Session Summary — Sat, Apr 4, 2026 (session 25 — ClassroomFix destructive loop resolved; all 35 classroom survival phrases now cached)

### What was done

#### ClassroomFix destructive loop eliminated — additive-only, then removed

The ClassroomFix in `server/index.ts` was running a `bustVocabImageCache` step at the top of every startup cycle. Since the server was restarting every 5–10 minutes (tsx hot-reload from file writes), each restart deleted all freshly-generated classroom images from the DB and restarted from scratch — wasting API credits and never converging.

**Fix applied (two steps):**

1. **Removed the bust loop.** Changed ClassroomFix to additive-only: check each phrase via `resolveVocabularyImage`, log `✓` only on generation, increment `skipped` on `source === 'cache'`. Final message is `"All classroom survival phrases already cached — nothing to do."` when all 35 are cached, or `"COMPLETE — generated N, skipped M"` when new images were needed.

2. **Confirmed all 35 phrases cached** — once the `"nothing to do"` log line appeared (session ~00:17 UTC Apr 4), **the entire ClassroomFix setTimeout block was removed from `server/index.ts`** (per the critical TODO from session 24). The block is gone; no further action needed.

**DB confirmation (35 entries in `media_files.search_query`):**
- Spanish 6/6 ✓, French 4/4 ✓, German 4/4 ✓, Italian 4/4 ✓
- Portuguese 3/3 ✓, English 4/4 ✓, Japanese 3/3 ✓, Korean 3/3 ✓, Mandarin 4/4 ✓

(Counts match `CLASSROOM_SURVIVAL_WORDS` — Spanish is 6, all others are 3–4 phrases per language)

### State at end of session
- ClassroomFix: ✓ COMPLETE and removed from `server/index.ts`
- All 35 classroom survival phrase images: ✓ cached in DB
- Server: ✓ running cleanly (no ClassroomFix block)

### Next priorities
- See visual-asset-roadmap.md for remaining work

---

## Session Summary — Fri, Apr 3, 2026 (session 23 — classroom survival SCENE_OVERRIDES + greeting template sweep)

### What was done

#### 1. Classroom survival phrases SCENE_OVERRIDES — all 9 languages complete

Four new template functions added to `vocab-image-seed-service.ts` (after `goodNight`, ~line 154):
- `canYouRepeat(primary)` — circular finger gesture "one more time"
- `speakSlowly(primary)` — palms pressing slowly downward
- `iDontUnderstand(primary)` — puzzled head tilt + open hand
- `howDoYouSay(primary)` — pointing at a chalkboard

A new `// Classroom Survival Phrases` section added to `SCENE_OVERRIDES` (~line 710) covering all 9 languages (ES / FR / DE / IT / PT / JA / KO / ZH / EN) with:
- Both canonical spellings and normalized-key aliases (with-period and without-period where ASCII `.` survives normalization)
- Native-script keys + romanized/transliterated aliases for JA, KO, ZH, HE
- French mid-word apostrophe forms (e.g. `"repetez s'il vous plait"`) with double-quote delimiters
- German standalone `wiederholen` kept as its own custom override; `bitte wiederholen sie` and `kannst du das wiederholen` added separately

**Normalizer key contract reminder** (critical for any future SCENE_OVERRIDES entries):
- ASCII `.` is **preserved** in the normalized key (both with-period and without-period aliases needed)
- `? , ¿ ¡ !` → space (collapsed); trailing space stripped
- Mid-string `'` preserved
- CJK / Hangul / Hiragana / Hebrew / Katakana: untouched

#### 2. `thankYou` / `youreWelcome` / `goodNight` template sweep — all remaining languages

Previously these templates existed in the code but were only used for Spanish (`buenas noches` → `goodNight`, `gracias` → `thankYou`). All remaining languages now use the template functions consistently — including both native-script entries and romanized/transliterated aliases.

**`thankYou(primary)`** applied to:
- `merci` (FR), `danke` (DE), `grazie` (IT), `obrigado` / `obrigada` (PT), `תודה` / `toda` (HE), `thank you` (EN)

**`youreWelcome(secondary)`** applied to:
- `de rien` (FR), `bitte schon` (DE), `portuguese:de nada` (PT), `どういたしまして` / `dou itashimashite` (JA), `천만에요` / `cheonmaneyo` (KO), `不客气` / `bu ke qi` (ZH), `you're welcome` (EN)

**`goodNight(primary, setting)`** applied to all languages with culturally specific settings:
- `bonne nuit` — "a charming Parisian street with gas lamp glow"
- `gute nacht` — "a cozy German neighbourhood with half-timbered houses"
- `buonanotte` — "a warmly lit Italian piazza with cobblestones and terracotta rooftops"
- `boa noite` — "a colourful Brazilian street with tropical night air"
- `おやすみなさい` / `oyasumi nasai` — "a quiet Japanese neighbourhood with glowing paper lanterns"
- `おやすみ` / `oyasumi` — casual variant, pajamas added inline
- `잘 자요` — "a Seoul apartment district with city lights below"
- `晚安` / `wan an` — "a peaceful Chinese hutong laneway with warm lantern light"
- `לילה טוב` / `layla tov` — "a Jerusalem stone-lined street with warm lantern glow"
- `good night` — "a quiet suburban American street with porch lights glowing"

Key effect: ALL goodnight images now specify **pajamas** (the template includes "in cozy pajamas") and a culturally specific location. Existing cached images are unaffected until an admin runs fix-greetings per language.

### State at end of session
- All 4 classroom survival templates: ✓ implemented and in SCENE_OVERRIDES for all 9 languages
- thankYou / youreWelcome / goodNight template sweep: ✓ complete for all 9 languages
- Server: ✓ running healthy, no TypeScript errors
- Existing cached images for greeting phrases: unchanged (will regenerate only after admin fix-greetings)

### Next priorities (from visual-asset-roadmap.md + previous backlogs)
- 15 Novice Low adjective pair images still missing: caliente, frío, bueno, malo, abierto, lleno, vacío, limpio, sucio, nuevo, bajo, rápido, lento, oscuro, claro — no pair PNGs in DB
- `cuánto cuesta`, `una horchata por favor` — await on-demand generation (no seeder coverage)
- SaberConocerCard example sentence audio (low priority)

---

## Session Summary — Thu, Apr 2, 2026 (session 22 — gpt-image-1 anchor seeding system + art style overhaul)

### What was done

#### 1. Switched image generation engine: DALL-E 3 → gpt-image-1 with per-language anchor seeding

**Problem**: DALL-E 3 (text-only) consistently drifts on character appearance — generates wrong ages, wrong faces, wrong style. Every new image generation is a lottery. Even with extremely detailed prompts, DALL-E 3 had strong biases toward young attractive characters regardless of "68-year-old grandmother" in the prompt.

**Solution**: `gpt-image-1` with anchor image seeding.
- For **scene/character images** (`type='infographic'`): system looks up a per-language "anchor" image from the cache (e.g. `vocab_spanish_hola` for Spanish), then calls `images.edit` with that reference image + the text prompt. The model sees the actual character face and art style — not just a description.
- For **prop images** (`type='image'`): uses `images.generate` with `gpt-image-1` (no anchor needed — object props don't need character consistency).
- **Fallback**: if the anchor key isn't in the cache or the fetch fails, automatically falls back to text-only `gpt-image-1` (still much better than DALL-E 3 at following prompts).

**Files changed:**
- `server/services/visual-content-service.ts` — complete rewrite of `generateWithDallE` → `generateWithGptImage`; `generateVisual` now accepts `anchorImageUrl?: string`; uses `toFile` from `openai` to pass anchor as File object to `images.edit`
- `server/services/vocabulary-image-resolver.ts` — added `LANGUAGE_ANCHOR_CACHE_KEYS` map (one per language); generation call now resolves anchor URL via `storage.getCachedStockImage(anchorKey)` and passes it to `generateVisual`
- `server/routes.ts` (preview-fix endpoint) — also resolves and passes anchor URL so preview generations match production

#### 2. Art style fixed: "anime-inspired" → "Disney-inspired friendly character art"

"anime-inspired" was causing DALL-E/gpt-image-1 to generate mature/sexualized characters. Changed both `SCENE_STYLE` and `PROP_STYLE` to use "Disney-inspired friendly character art, wholesome family-friendly". All future generations will be wholesome regardless of model.

#### 3. Abuela description fixed: removed possessive "Daniela's"

`CHARACTER_PROFILES.ES.abuela` previously said "Rosa, Daniela's 68-year-old Mexican grandmother..." — the "Daniela's" possessive caused DALL-E/gpt-image-1 to re-invoke Daniela as a third character. Fixed to: "Rosa, a warm 68-year-old Mexican grandmother with short curly silver-white hair, warm brown skin, kind dark eyes behind gold-rimmed glasses, and a white blouse with colorful floral embroidery". Affects all scene overrides that use `${CHAR.ES.abuela}`.

#### 4. buildGenerationConcept injection guard broadened

The `alreadyHasNamedCharacter` check that prevents double-injection now scans the first 120 chars of the concept (was: `startsWith` only). Covers "Two people on a sunny sidewalk: Daniela..." structures.

#### 5. `como esta` scene restructured with explicit two-person framing

`'Two people on a sunny sidewalk: ${CHAR.ES.primary} extending a polite open-hand greeting, and beside her ${CHAR.ES.abuela} smiling back with gentle warmth — a respectful exchange between a young woman and an elderly grandmother'`

### LANGUAGE_ANCHOR_CACHE_KEYS (per language, lives in vocabulary-image-resolver.ts)
```
spanish:    'vocab_spanish_hola'
french:     'vocab_french_bonjour'
german:     'vocab_german_hallo'
italian:    'vocab_italian_ciao'
portuguese: 'vocab_portuguese_ola'
japanese:   'vocab_japanese_konnichiwa'
korean:     'vocab_korean_annyeonghaseyo'
mandarin:   'vocab_mandarin_nihao'
hebrew:     'vocab_hebrew_shalom'
english:    'vocab_english_hello'
```
To update an anchor, change the cache key in this map to the key of a better image. The anchor must already be in the DB; if not, system gracefully falls back to text-only gpt-image-1.

### State at end of session
- gpt-image-1 pipeline: ✓ implemented, server running
- como esta preview: needs retesting with new anchor system
- Anchor for Spanish: `vocab_spanish_hola` — confirm it's in the DB before first preview attempt
- toFile availability: ✓ confirmed (typeof function)

---

## Session Summary — Thu, Apr 2, 2026 (session 21 — buildGenerationConcept character-injection bug fixed + me llamo/horchata/cuánto cuesta SCENE_OVERRIDES)

### What was done

#### 1. Root-cause bug fixed: `buildGenerationConcept` bypassed character injection for SCENE_OVERRIDES

**Bug**: `buildGenerationConcept` had an early-return on line 2933:
```javascript
if (scene && scene.trim().length > 0) return scene.trim();  // ← BUG: bypassed character injection
```
This meant ANY word with a SCENE_OVERRIDE was generated WITHOUT Daniela/Giulia/Sophie/etc. — producing anonymous-person or prop images where character-specific scenes were expected.

**Fix applied in `vocabulary-image-resolver.ts`** (line ~2938):
- Removed the early return; now ALL scene descriptions flow through the character injection gate.
- Added `isPropDescription = /^(a |an |the )/i.test(concept)` guard so PROP still-life descriptions (starting with "a/an/the + noun") skip character injection.
- Result: action-description SCENE_OVERRIDES ("warmly pressing a hand to their chest...") correctly inject Daniela for Spanish, Giulia for Italian, etc.
- Confirmed by log: `generating (infographic) for: "Daniela, a 26-year-old Colombian woman with long dark brown curly hair... warmly pressing a hand to their chest and pointing to themselves..."`

#### 2. PROP vs ACTION SCENE_OVERRIDE rule formalized

**Architecture rule**: The `isPropDescription` guard means SCENE_OVERRIDES now self-select into two categories based on their first word:
- **Starts with "a/an/the"** → PROP description → no character injection (horchata glass, fruit basket, etc.)
- **Starts with gerund / adverb+gerund / verb** → ACTION description → character auto-injected (me llamo, cuanto cuesta, etc.)

This aligns with the CULTURALLY NEUTRAL vs CULTURALLY DRIVEN architecture already documented in `SCENE_OVERRIDES` header comment.

#### 3. `me llamo` SCENE_OVERRIDE replaced — lanyard → character action

**Old** (static prop — wrong for a phrase, bypassed character injection anyway due to the bug):
```
'a decorative name badge with a floral border...'
```
**New** (character action — Daniela points to herself):
```
'warmly pressing a hand to their chest and pointing to themselves with a confident friendly smile, making a self-introduction gesture'
```
- Old image deleted from DB; new Daniela image generated and confirmed in logs.
- Same action description added for cross-language "my name is" equivalents in all 9 languages (`mi chiamo`, `je mappelle`, `ich heisse`, `me chamo`, `my name is`, `watashi no namae wa`, `je ireumeun`, `wode mingzi shi`). Each will get their language's character on first on-demand request.

#### 4. `una cerveza por favor` → horchata

- SCENE_OVERRIDE updated to show a tall glass of horchata with ice, cinnamon stick, and adobe-toned table background (NO people — starts with "a" so prop path applies correctly).
- Also added `una horchata por favor` and standalone `horchata` keys.
- Old cerveza DB image deleted; horchata will generate on next lesson browse or seeder arrival at `U`.
- Curriculum drill item `adcd93b3-c071-40a0-afca-db646d3f7907` updated: prompt now says "A horchata, please", target text "Una horchata, por favor.", hint updated to "Horchata is a sweet rice-milk drink".

#### 5. `cuánto cuesta` SCENE_OVERRIDE added + DB duplicates cleaned

- New override: `'pointing inquisitively at a handcrafted item on a colorful outdoor market stall with a curious expression, vibrant produce and goods visible in the background'`
- This starts with "pointing" (gerund) → ACTION path → Daniela injected.
- All 3 stale DB entries deleted (`vocab_spanish_cuanto_cuesta` underscore key + 2 AI images from March 26).
- Word is not in vocabulary_items so seeder won't generate it; will be created on first lesson browse.

#### 6. Architecture documentation added to SCENE_OVERRIDES header

Large comment block at top of `SCENE_OVERRIDES` in `vocab-image-seed-service.ts` formally documents:
- CULTURALLY NEUTRAL (concept_* shared keys — CONCEPT_KEY_MAP)
- CULTURALLY DRIVEN (one-per-language — ACTION descriptions, no character names)
- The PROP vs ACTION naming convention that now drives character injection behavior

### State at end of session
- `me llamo` image: ✓ Daniela pressing hand to chest (confirmed in log)
- `cuánto cuesta`: awaiting on-demand generation (no curriculum vocab item)
- `una cerveza`/horchata: awaiting on-demand generation (still seeder todo for `U` words)
- `buildGenerationConcept` bug: ✓ fixed — all future SCENE_OVERRIDES with action descriptions will auto-inject the language's character

---

## Session Summary — Thu, Apr 2, 2026 (session 20 — seeder guard + CONCEPT_KEY_MAP gap-fill + sports images fixed)

### What was done

#### 1. Sports anchor images marked reviewed + human-readable titles
Three sports images that were seeded with `is_reviewed=false` were updated via SQL:
- `Basketball (baloncesto)` — `vocab_spanish_baloncesto`, reviewed=true
- `Tennis (tenis)` — `vocab_spanish_tenis`, reviewed=true
- `Sports / Sport (deporte)` — `vocab_spanish_deporte`, reviewed=true
Now visible in the admin library under all filter states.

#### 2. `generate-sports-anchors.ts` fixed for future use
The script now inserts new anchor images with `is_reviewed=true` and human-readable `title`/`description` fields from the start (instead of the raw cache key as the title).

#### 3. CONCEPT_KEY_MAP expanded — directions + lawyer
New entries added to `server/services/vocabulary-image-resolver.ts`:
- **Directions** — left/right in all 9 languages → `vocab_spanish_izquierda` / `vocab_spanish_derecha` (both anchors already existed with 12–19 uses each)
- **Lawyer** — avocat/Anwalt/avvocato/advogado etc. in all 9 languages → `vocab_spanish_abogado` (anchor already existed)

#### 4. Runaway seeder guard implemented
**Root cause of the April 2 junk-image problem**: `seedAllVocabImages` was seeding all 9 languages; for non-Spanish words that weren't in CONCEPT_KEY_MAP, the resolver fell through to DALL-E and generated language-specific images (FR/DE/PT/IT/etc junk).

**Fix applied in two files**:
- `server/services/vocabulary-image-resolver.ts`: added `seederMode?: boolean` to `VocabImageRequest`. When `seederMode=true` AND language is not Spanish, DALL-E generation is skipped at BOTH generation points (concept-key path and language-specific path) — returns placeholder instead.
- `server/services/vocab-image-seed-service.ts`: `seedVocabImages` now passes `seederMode: true` to every `resolveVocabularyImage` call.

**Effect**: Seeding French, German, Portuguese, Italian, Japanese, Korean, Mandarin, Hebrew now ONLY produces cache hits (routing to Spanish anchors via CONCEPT_KEY_MAP) or silently skips (no DALL-E, no new images). On-demand generation during live student sessions is unaffected — `seederMode` is only set by the seeder.

---

## Session Summary — Thu, Apr 2, 2026 (session 19b — vocabulary image library audit & cleanup)

### What was done

#### 1. Full vocabulary image library audit completed

Performed a complete audit of the `media_files` table to understand what images exist, what serves the full 9-language curriculum via CONCEPT_KEY_MAP, and what is junk from the April 1–2 batch seeder runs.

**Key finding**: The CONCEPT_KEY_MAP in `vocabulary-image-resolver.ts` is already extremely comprehensive — it covers numbers, colors, shapes, seasons, weather, 7+ animals, classroom items, 7 clothing types, 14 verbs, 13 body parts, 8 emotions, 15+ adjective pairs, 10 places, 10+ family members. All 9 languages route to existing Spanish anchor images with high usage counts.

**Protected phrase images** (all created in March, high usage, untouched by deletion):
`por favor` (53 uses), `gracias` (239 uses), `de nada` (96 uses), `buenas noches` (345 uses), `buenas tardes` (344 uses), `buen provecho` (342 uses), `adios` (317 uses), `mucho gusto` (251 uses), `buenos dias` (224 uses), `cuanto cuesta` (216 uses), `bien` (206 uses), `hasta luego` (190 uses), `como estas` (186 uses), `la cuenta` (43 uses)

#### 2. CONCEPT_KEY_MAP expanded with ~200 new entries

New cross-language mappings added to `server/services/vocabulary-image-resolver.ts` (after line 2117), covering:
- **Transportation** (8 concepts): car, bus, train, airplane, bicycle, boat, subway — all 9 languages now route to existing Spanish anchor images (`vocab_spanish_carro`, `vocab_spanish_autobus`, `vocab_spanish_tren`, `vocab_spanish_avion`, `vocab_spanish_bicicleta`, `vocab_spanish_barco`, `vocab_spanish_metro`)
- **House/Rooms** (9 concepts): house, bedroom, kitchen, bathroom, living room, door, window, garden, bed — all 9 languages mapped (`vocab_spanish_casa`, `vocab_spanish_dormitorio`, `vocab_spanish_cocina`, `vocab_spanish_bano`, `vocab_spanish_salon`, `vocab_spanish_puerta`, `vocab_spanish_ventana`, `vocab_spanish_jardin`, `vocab_spanish_cama`)
- **More Clothing** (2 concepts): coat (`vocab_spanish_abrigo`), skirt (`vocab_spanish_falda`)
- **Health** (3 concepts): doctor (`vocab_spanish_medico`), nurse (`vocab_spanish_enfermera`), medicine/pill (`vocab_spanish_pastilla`)
- **Sports** (4 concepts): soccer (`vocab_spanish_futbol`), basketball (`vocab_spanish_baloncesto`), tennis (`vocab_spanish_tenis`), sports-general (`vocab_spanish_deporte`)

**Note**: All Spanish anchor images for these categories already existed in the DB from the March 18-19 seeder — the additions just provide the cross-language routing.

#### 3. Pre-generated 3 missing Spanish sports anchor images

`scripts/generate-sports-anchors.ts` created and run to generate:
- `vocab_spanish_baloncesto` → `vocab_sports_baloncesto.png` (basketball)
- `vocab_spanish_tenis` → `vocab_sports_tenis.png` (tennis)
- `vocab_spanish_deporte` → `vocab_sports_deporte.png` (general sports)

All 3 seeded in media_files with `language='spanish'`, `image_source='ai_generated'`.

#### 4. Surgical deletion of ~5,597 junk images

Deleted 3 batches:
- **4,735** — all April 2 French/German/Portuguese/shared batch seeder images
- **67** — April 2 Spanish seeder images (sparing the 3 new sports anchors)
- **795** — April 1 abstract multi-word Spanish phrases ("ansiedad existencial soterrada", "a diferencia de x en y", etc.)

**Final library state**:
- `vocab_spanish_*` remaining: **1,345** (clean, curated)
- High-value anchors (>100 uses): **326** images, 88,806 total uses
- `concept_*` images (numbers/colors/seasons/weather): **47** (untouched)
- Protected courtesy phrases: **18** rows, all intact
- Zero French/German/Portuguese junk remaining from April batch

### Pending / future work
- The April 1 single-word Spanish images (640 created that day) were NOT deleted — they are real vocabulary words (aburrido, alto, animado, etc.) that ARE or will be referenced by CONCEPT_KEY_MAP. They have 0 uses now but images are real.
- Consider regenerating `vocab_spanish_futbol` (created April 1 by seeder, 12 uses) — quality may vary vs. the hand-crafted images.
- The script `scripts/generate-sports-anchors.ts` is available for generating additional missing anchors using the same pattern.

---

## Session Summary — Thu, Apr 2, 2026 (session 19a — Chapter 1 vocab/image fixes)

### What was done

#### 1. Chapter Recap vocab cap removed
`extractKeyVocabulary` in `ChapterRecap.tsx` previously hard-capped at 8 words AND broke out of the outer loop after the first section that hit 8 — so sections 2+ of a chapter were completely ignored.
- Now iterates ALL sections without early breaks → collects from every section → `slice(0, 40)` at end
- Same fix for `extractKeyPhrases`: no more early break, `slice(0, 10)` at end

#### 2. Visual vocab grid: pronouns + question words now filtered
`ABSTRACT_TRANSLATIONS` in `TextbookInfographics.tsx` expanded with:
- **Personal pronouns**: i, you, he, she, it, we, they, me, him, her, us, them + formal/informal variants
- **Question words**: what, where, who, how, when, why, which, whose, whom (+ with "?")
- **Yes / no / ok**
- **Articles alone**: a, an, the
- **Short copula phrases**: "i am", "you are", "he is" etc. (2-3 words, pass the old 4-word rule)
- **Short copula verbs**: "to be", "to have", "to do", "to go" etc.
- **Classroom phrases**: "i understand", "excuse me", "never mind"

#### 3. Backend seed filter mirrors frontend filter
`SEED_SKIP_TRANSLATIONS` in `vocab-image-seed-service.ts` updated with all the same additions — prevents DALL-E credit waste generating images for words that will never be shown.

#### 4. SCENE_OVERRIDEs for useful Chapter 1 phrases
New entries added to `SCENE_OVERRIDES` in `vocab-image-seed-service.ts`:
- `'me llamo'` → person pressing hand to chest, self-introduction gesture
- `'me llamo...'` → same
- `'desayunar'` / `'el desayuno'` / `'desayuno'` / `'yo desayuno'` → cozy breakfast table, morning light
- `'mas despacio por favor'` / `'mas despacio'` → gentle "slow down" open palm gesture
- `'no entiendo'` / `'no comprendo'` → student with puzzled expression + question mark doodle
- `'que significa'` / `'como se dice'` → classroom conversation scenes

#### 5. DB cleanup — 9 bad cached images deleted
Deleted stale/wrong entries so they regenerate with proper SCENE_OVERRIDE descriptions:
- `vocab_spanish_me llamo` — was a random AI person image
- `vocab_spanish_mas despacio por favor` — was a random AI image
- `vocab_spanish_no entiendo` — was a random AI image
- `vocab_spanish_desayunar` — was aliased to daily routine chart (wrong)
- `vocab_spanish_desayuno` — was an Unsplash photo (inconsistent style)
- `vocab_spanish_yo` → now filtered from display + will be skipped on reseed
- `vocab_spanish_tu` → same
- `vocab_spanish_usted` → same
- `vocab_spanish_soy` → same

### Pending
- Same as session 18j (15 Novice Low adjective pair images, SaberConocerCard audio)
- `vocab_spanish_me llamo`, `vocab_spanish_desayunar`, `vocab_spanish_mas despacio por favor`, `vocab_spanish_no entiendo` will regenerate on first next access using new SCENE_OVERRIDEs

---

## Session Summary — Thu, Apr 2, 2026 (session 18k — ACTFL mini gauge score fix)

### What was done
- `ActflMiniGauge` was showing `levelInfo.score` (the static baseline for Novice Low = **0**) instead of `calculateContinuousScore()` which factors in practice hours, messages, grammar/vocab scores within the level. Two-line fix — now matches exactly what the mind map shows (~5–7 for an active learner).

---

## Session Summary — Wed, Apr 1, 2026 (session 18j — Daniela sweep, ACTFL gauge, multi-col table audio)

### What was done

#### 1. Hardcoded "Daniela" sweep — textbook components now use dynamic tutor name

All visible "Daniela" references in student-facing textbook components replaced with `getTutorName(language, tutorGender)` from context:

- **`ChapterRecap.tsx`**: "Practice with Daniela" button now reads `Practice with {tutorName}` — imports `useLanguage` + `getTutorName`
- **`TextbookInfographics.tsx`** (`LessonPrepCard`): "{tutorName} will guide you. Just try to respond in {langDisplay}!" — added `useLanguage` + `getTutorName`
- **`TextbookInfographics.tsx`** (`PreparationTips`): tip string "{tutorName} will guide you — just try to respond in {langDisplay}!"
- **`WhiteboardPanel.tsx`**: "Your tutor will write vocabulary, grammar, and notes here as you learn"
- **`TextbookWhiteboardBridge.tsx`**: "will appear on your tutor's whiteboard in your next voice session."
- **`ChapterIntroduction.tsx`** subtitle strings: "Daniela uses" → "used in lessons" (5 canvas vocab card subtitles)

Remaining intentional "Daniela" references:
- `ExpressLanePane.tsx` — role-based message identification (`msg.role === 'daniela'`), not display text
- `ImmersiveTutor.tsx` — already uses dynamic name with Daniela as fallback only (line 681)
- `SyllabusMindMap.tsx` — SVG-internal IDs/gradients, not visible text
- `ConferenceCall.tsx`, `CollaborationIndicator.tsx` — internal product branding in admin-facing tools

#### 2. ACTFL gauge added to Language Hub

- Added `<ActflFluencyDial compact />` between the momentum strip and TutorShowcase in `review-hub.tsx`
- Always visible (even with no progress — shows "Start practicing to unlock assessment")
- On first load, `GET /api/actfl-progress/spanish 200` confirmed live

#### 3. Multi-column grammar tables — audio added

**`PretIrregularCard`** (6 irregular verbs × 5 columns):
- Each form cell converted to stacked layout: form text above, tiny audio button below
- Used `{ form: row.yo, bold: true }` pattern to loop over all 5 columns per row cleanly

**`CommandsCard`** (7 verbs × 4 form columns: tú+, tú−, Ud., Uds.):
- Same stacked layout: form text above, tiny audio button below per cell
- tú+ forms stay green, tú− forms stay red

Audio button size: `h-4 w-4 p-0 opacity-50 hover:opacity-100` — very compact, doesn't widen columns significantly

### Pending
- **15 Novice Low adjective pair images** — caliente, frio, bueno, malo, abierto, lleno, vacio, limpio, sucio, nuevo, bajo, rapido, lento, oscuro, claro still have no pair PNGs in DB
- **Family tree "hotspot" feature** — interactive labels on the tree (future possibility)
- **`SaberConocerCard` example sentences** — inline Spanish examples have no audio (lower priority)

---

## Session Summary — Wed, Apr 1, 2026 (session 18i — grammar audio sweep complete)

### What was done

#### Grammar conjugation tables — ALL languages now have audio

**`VerbConjugationTable` in `TextbookGrammarDiagrams.tsx` (Spanish):**
- Added `language?: string` prop (default `'spanish'`)
- Added `TextAudioPlayButton` next to the conjugated form in every row
- Added import for `TextAudioPlayButton` at file top
- This covers ALL 30+ Spanish grammar cards at once (ArVerbs, Er, Ir, Ser, Estar, Tener, Ir, StemChange, GoVerbs, PretRegular, PretIrregular, Imperfect, Future, Conditional, Subjunctive, Commands, etc.)

**`VerbConjugationTable` in `TextbookFrenchGrammarCards.tsx` (French):**
- Same pattern, `language = 'french'` by default — covers all 24 French grammar cards

**`VerbConjugationTable` in `TextbookGermanGrammarCards.tsx` (German):**
- Same pattern, `language = 'german'` by default — covers all 22 German grammar cards

**`VerbConjugationTable` in `TextbookItalianGrammarCards.tsx` (Italian):**
- Same pattern, `language = 'italian'` by default — covers all 22 Italian grammar cards

**`ConjugationTable` in `TextbookPortugueseGrammarCards.tsx` (Portuguese):**
- Same pattern, `language = 'portuguese'` by default

#### Individual expression list audio (Spanish)

**`TenerCard` expressions:**
- Audio button added to each of the 8 "tener expressions" (tener hambre, tener sed, etc.)

**`GoVerbsCard` -go verb grid:**
- Audio button added to the yo form column for each of 8 -go verbs (hago, pongo, etc.)

**`StemChangeCard` examples:**
- Audio button on each of the 3 stem-change example pairs (quiero / queremos, etc.)

**`ReflexiveVerbCard`:**
- Audio button on each reflexive pronoun row (me, te, se, nos, os, se)
- Audio button on each ducharse conjugation row (me ducho, te duchas, etc.)

#### SunArcGreetings infographic

**`TextbookInfographics.tsx` — `SunArcGreetings`:**
- Added `language?: string` prop to interface and function
- Added a `grid grid-cols-3` row of three `TextAudioPlayButton`s below the SVG, aligned to morning (left) / afternoon (center) / evening (right)

**`ChapterIntroduction.tsx` — `renderInfographic`:**
- Now passes `language={langKey}` to `<SunArcGreetings>` (was missing before)

### Pending
- **15 Novice Low adjective pair images** — caliente, frio, bueno, malo, abierto, lleno, vacio, limpio, sucio, nuevo, bajo, rapido, lento, oscuro, claro still have no pair PNGs in DB
- **Family tree "hotspot" feature** — interactive labels on the tree (future possibility)
- **`SaberConocerCard` example sentences** — inline Spanish examples in `<ul><li>` items have no audio (lower priority)
- **`PretIrregularCard` multi-column table** — 5-column format makes per-cell audio awkward; skip or restructure
- **`CommandsCard` multi-column table** — same consideration; 5 columns make per-cell audio complex

---

## Session Summary — Wed, Apr 1, 2026 (session 18h — audio buttons added to all remaining textbook infographics)

### What was done

#### Audio buttons added to all grammar/infographic sections that had none

**`TextbookInfographics.tsx` — `QuickPhraseGrid`:**
- Added `language?: string` prop
- Added `TextAudioPlayButton` inline with each phrase (left of phrase text)

**`TextbookInfographics.tsx` — `FormalInformalComparison`:**
- Added `language?: string` prop
- Added `TextAudioPlayButton` in both the Formal and Informal cells for each row

**`ChapterIntroduction.tsx` — `renderInfographic` function:**
- Passed `language={langKey}` to both `QuickPhraseGrid` and `FormalInformalComparison` (previously language was not forwarded)

**`TextbookCanvasCards.tsx` — all 6 vocab cards now have audio:**
1. **`WeatherVocabCard`**: audio on each vocab cell label + Key Expressions list
2. **`EmotionsVocabCard`**: audio on each emotion cell label + Expressing Emotions list
3. **`TimeVocabCard`**: audio on each clock cell label + Key Patterns list + Parts of the Day list
4. **`DaysOfWeekCard`**: audio on each day name row + each month name row + Useful Date Expressions list
5. **`BodyPartsCard`**: audio on each vocabulary reference row + Useful Phrases list
6. **`FacePartsCard`**: audio on each vocabulary reference row + Descriptions list
7. **`HandPartsCard`**: audio on each vocabulary reference row + Finger Counting list
8. **`ThermometerVocabCard`**: audio on each vocab cell label + key expressions list

All audio buttons use `TextAudioPlayButton` from `AudioPlayButton.tsx` (calls `POST /api/tts/pronunciation`).

### Pending
- **15 Novice Low adjective pair images** — caliente, frio, bueno, malo, abierto, lleno, vacio, limpio, sucio, nuevo, bajo, rapido, lento, oscuro, claro still have no pair PNGs in DB
- **Family tree "hotspot" feature** — interactive labels on the tree (future possibility)
- **Grammar conjugation tables** in `GrammarChapterView` (TextbookGrammarCards.tsx) — these have conjugation cells (e.g., "yo hablo") with no audio yet. Next big audio gap.
- **`SunArcGreetings` infographic** in `ChapterIntroduction.tsx` — morning/afternoon/evening greetings have no audio

---

## Session Summary — Wed, Apr 1, 2026 (session 18g — emotion & family image polish)

### What was done

#### Emotions: replaced dated emoji-style images with fresh watercolor-person illustrations
- Added a new `// ── Emotions ──` section to `SCENE_OVERRIDES` in `vocab-image-seed-service.ts` with standalone watercolor-person descriptions for every emotion:
  - **feliz/triste** — changed from SPLIT pair (showing both faces) to individual standalone illustrations
  - Added: enojado/a, enfadado, molesto, nervioso/a, ansioso, sorprendido/a, asombrado, aburrido/a, aburrimiento, asustado/a, atemorizado, cansado/a, agotado, avergonzado/a, vergüenza, emocionado/a, entusiasmado, orgulloso/a, alegre
  - Cross-language synonyms: heureux/heureuse, en colere, nerveux, surpris, fatigue, ennuye, effraye, excite (FR); glucklich, traurig, wutend, uberrascht, mude, gelangweilt, angstlich, aufgeregt (DE)
- Deleted all 17 old `vocab_emo_*.png` cache entries from DB (emoji faces) → they'll regenerate on next access using the new descriptions
- Deleted stale `vocab_spanish_feliz` April 1 AI entry and `vocab_spanish_triste` pair image → will regenerate as standalone happy/sad
- Deleted stale `vocab_spanish_orgulloso` April 1 AI entry → will regenerate as "proud person standing tall"
- Deleted `vocab_spanish_alegre` pair image alias → will regenerate as standalone happy

#### Family: consolidated ALL family words to single family tree image
- **Strategy**: one image (the family tree) for all family members. User specifically likes this tree and prefers consistency over per-member images.
- Redirected (UPDATE) to `vocab_people_familia.png`: abuela, abuelo, tio, tia, primo, prima, nino, nina, familia_extendida, bebe
- Already pointed to familia.png: madre, padre, hermano, hermana, familia ✅
- Inserted: hijo, hija → `vocab_people_familia.png` (4+4 duplicate AI rows from March 26 were deleted first)
- Deleted all duplicates: hijo×4, hija×4, padres×2, rogue abuelos AI image (11 rows total)

#### CONCEPT_KEY_MAP updates (`vocabulary-image-resolver.ts`)
- Added `'feliz': 'vocab_spanish_feliz'` → routes ES/PT "feliz" to shared key (previously PT would get separate `vocab_portuguese_feliz`)
- Added `'triste': 'vocab_spanish_triste'` → routes ES/FR/IT/PT "triste" (same word) to shared key

### Pending
- **15 Novice Low adjective pair images** — caliente, frio, bueno, malo, abierto, lleno, vacio, limpio, sucio, nuevo, bajo, rapido, lento, oscuro, claro still have no pair PNGs in DB; SCENE_OVERRIDE descriptions will guide generation on first view
- **Emotion images will generate on first access** — no pre-seeding done; images generate on demand with new watercolor-person descriptions
- **Family tree "hotspot" feature** — user floated idea of interactive labels on the tree (highlighting specific family members); noted as future possibility, not implemented
- **`aburridoa` and `cansadoa`** gendered form AI images from April 1 still cached — minor clutter, not impactful

---

## Session Summary — Wed, Apr 1, 2026 (session 18f — cross-language image sharing via CONCEPT_KEY_MAP)

### What was done

#### Massive CONCEPT_KEY_MAP expansion (`vocabulary-image-resolver.ts`)

Added ~700 new entries to `CONCEPT_KEY_MAP` covering ALL language-neutral vocabulary categories. The strategy: map every language variant (FR/DE/IT/PT/JA/KO/ZH/EN) → `vocab_spanish_{word}` so images generated for Spanish are reused at zero extra DALL-E cost for every other language.

**How it works:**
- If the Spanish DB entry already exists → instant cache hit for all 8 other languages ✅
- If Spanish entry not yet generated → first resolution (any language) generates and caches under the Spanish key; every subsequent language gets it free ✅
- Uses the same shared-concept lookup the color system already used (colors have used this pattern since the beginning; now extended to all vocabulary categories)

**Categories added (each with 7-9 language variants):**
1. **Animals**: dog, cat, bird, fish, horse, cow, pig, chicken, rabbit
2. **Food/Fruit**: apple, banana, strawberry, tomato, carrot, bread, milk, water, egg, cheese, grape, orange (fruit)
3. **Classroom & office objects**: table, desk, chair, book, pen, pencil, paper, backpack, computer
4. **Clothing**: shirt, pants, dress, shoes, hat, jacket, socks
5. **Common verbs**: eat, sleep, run, speak/talk, listen, write, read, dance, sing, swim, walk, cook, play, buy
6. **Body parts**: head, hand, foot, arm, eye, nose, mouth, leg, ear, shoulder, knee, back, stomach, neck, heart (all already point to `vocab_body_diagram.png` for Spanish)
7. **Emotions**: happy, sad, angry, surprised, excited, nervous, bored, scared
8. **Adjective contrast pairs**: near/far, big/small, hot/cold, clean/dirty, soft/hard, heavy/light, loud/quiet, young/old, fast/slow, open/closed, full/empty, new, tall/short, dark/bright, good/bad
9. **Common places**: school, library, hospital, park, restaurant, supermarket, hotel, bank, airport, store
10. **Family**: mother, father, brother, sister, grandmother, grandfather, child, baby
11. **Classroom people**: teacher, student

**Conflict exclusions (inline notes in code):**
- "leer" (DE=empty) excluded → conflicts with ES "leer" = to read
- "caldo" (IT=hot) included with note → rare collision with ES "caldo"=broth
- "sale" (FR=dirty) excluded → ambiguous with EN commerce context
- "pain" (FR=bread) excluded → ambiguous with EN pain
- "dos" (FR=back) excluded → conflicts with concept_num_2
- "laranja" (PT=orange fruit) excluded → already maps to concept_color_orange

#### Seeded two DB alias rows
- `vocab_spanish_triste` → `vocab_adj_feliz_triste.png` (pair file EXISTS in DB)
- `vocab_spanish_viejo` → `vocab_adj_joven_viejo_personas.png` (pair file EXISTS in DB)

#### Image reuse audit summary
- **~90% of all Spanish vocab** is already cached and serves from the library without DALL-E
- **Colors, animals, food, clothing, activities, emotions, body parts**: 100% reusing curated files
- **Adjective pairs (Novice Mid)**: cerca/lejos, suave/duro, pesado/ligero, ruidoso/tranquilo, feliz/triste, joven/viejo all hit curated pair images
- **Gap — 15 Novice Low adj**: caliente, frio, bueno, malo, abierto, lleno, vacio, limpio, sucio, nuevo, bajo, rapido, lento, oscuro, claro — roadmap pair PNGs for these NOT in DB. Will generate fresh on first view using SCENE_OVERRIDE pair descriptions.
- **Other languages**: The new CONCEPT_KEY_MAP entries mean French, German, Italian, etc. now reuse the Spanish library for the ~700 covered words instead of generating new images.

---

## Session Summary — Wed, Apr 1, 2026 (session 18e — vocab grid smart filtering + dolor fix)

### What was done

#### Vocab grid smart filtering + density cap (`TextbookInfographics.tsx`)

Added `isVisuallyMeaningful()` function and `MAX_VISUAL_PER_SECTION = 10` constant to `VisualVocabGrid`:
- **`ABSTRACT_TRANSLATIONS` set** (~30 entries): exact English translations that signal a discourse marker/connector — "however", "therefore", "in addition", "on the other hand", "to have to", "there is", etc. — these get filtered out of the image grid.
- **`ABSTRACT_PREFIXES` list** (~13 entries): English phrase prefixes that signal abstract nouns — "the development", "the impact", "the context", "the relationship", etc.
- **4-word rule**: if the English translation is 4+ words, filtered out (almost always an abstract or multi-part phrase that yields a confusing image).
- **`listen_repeat` items always pass** — these are curated greetings/numbers/days that already look great.
- **Density cap**: `.slice(0, 10)` after filtering — max 10 image cards per lesson section.

This leaves the grid showing only concrete nouns, common verbs, simple adjectives, and the specially curated greetings/numbers/time words — exactly what benefits from visual reinforcement.

#### SCENE_OVERRIDE — health/body words (`vocab-image-seed-service.ts`)

Added a new `// ── Health & Body` section to `SCENE_OVERRIDES` to prevent graphic/literal AI interpretations of abstract health concepts. Includes:
- `'dolor'` / `'el dolor'` → woman gently pressing fingertips to temple (mild wince, NO blood/wounds)
- `'fiebre'` / `'la fiebre'` → person in bed with thermometer
- `'enfermo'` / `'enferma'` → person in pajamas in armchair with blanket
- `'el resfriado'` → person blowing nose with scarf
- `'la gripe'` → person in bed with tissues and warm mug
- `'la tos'` → person covering mouth while coughing
- Medical professionals: `'el médico'`, `'la enfermera'`, `'el hospital'`, `'la farmacia'`

#### el dolor images deleted + queued for regeneration

The two bad "bloody heart" images for `el dolor` (created 2026-04-01 ~20:08) were deleted from `media_files`. On next server boot (+70s seeder pass), "el dolor" will be regenerated using the new mild scene override.

#### Watch Live 304 bypass (`CommandCenter.tsx`)

Changed watch mode from `refetchInterval: 8000` to a `watchNonce` state that increments every 8 seconds via `setInterval`. The nonce is appended as `&_ts={nonce}` to the query URL, making each poll a unique URL that bypasses browser 304 caching. New images from the background seeder now appear reliably at the top within ~8 seconds.

#### legumbres SCENE_OVERRIDE + deletion

"legumbres" was generating a picture of a girl (DALL-E personalizing the watercolor). New SCENE_OVERRIDE added: colorful clay bowls of mixed legumes, no people. Also added overrides for verduras, frutas, mariscos. Cached legumbres image deleted from DB — will regenerate next seeder pass.

Also added a `// ── Food items` section to SCENE_OVERRIDES with "no people" directives to prevent DALL-E from inserting characters into still-life food images.

#### liderazgo (leadership) deleted — abstract concept skip

"liderazgo" / "el liderazgo" cached images deleted from DB. "Leadership" is now in `SEED_SKIP_TRANSLATIONS` in the seed service and `ABSTRACT_SINGLE_NOUNS` in the frontend — will be skipped on the next seeder pass and filtered from the student view.

#### Seed service abstract filter (`isWordSeedable()`)

Added `SEED_SKIP_TRANSLATIONS` (~50 entries: discourse markers + abstract nouns: leadership, democracy, ideology, philosophy, consciousness, etc.) and `SEED_SKIP_PREFIXES` (~14 entries) to `vocab-image-seed-service.ts`. New `isWordSeedable(word, engTranslation)` function checks both, with a SCENE_OVERRIDE bypass. Called in the main seeder batch loop right after `cleanPromptToEnglish` — saves significant DALL-E credits for the remaining ~15,800 ungenerated images.

#### ABSTRACT_SINGLE_NOUNS in frontend filter

Added `ABSTRACT_SINGLE_NOUNS` set (~35 entries) to `TextbookInfographics.tsx` to catch single abstract nouns (leadership, democracy, identity, creativity, etc.) that escape the 4-word rule. Checked in `isVisuallyMeaningful()` after the discourse-marker check.

#### Image count landscape (as of session 18e)
- ~18,277 total unique word candidates across 9 languages
- ~2,478 AI-generated images done (mostly Spanish ~2,002, plus ~476 spread across FR/DE/EN/IT/shared)
- Japanese, Mandarin, Korean, Portuguese: ~0 images (seeder hasn't reached them after boot restart)
- With the new `isWordSeedable()` filter, probably 20-35% of words will be skipped as abstract — reducing the remaining generation work from ~15,800 down to ~10,000-12,000

### Files changed this session (session 18e)
- `client/src/components/TextbookInfographics.tsx` — `isVisuallyMeaningful()`, `ABSTRACT_TRANSLATIONS`, `ABSTRACT_PREFIXES`, `ABSTRACT_SINGLE_NOUNS`, `MAX_VISUAL_PER_SECTION`, filter pipeline
- `server/services/vocab-image-seed-service.ts` — Health & Body SCENE_OVERRIDES, Food items SCENE_OVERRIDES, `SEED_SKIP_TRANSLATIONS`, `SEED_SKIP_PREFIXES`, `isWordSeedable()`, wired into seeder loop
- `client/src/pages/admin/CommandCenter.tsx` — `watchNonce` state + `setInterval` effect, nonce-based URL busting
- `media_files` (DB) — Deleted: 2 bad "el dolor" images, 1 legumbres (girl showing), 2 liderazgo (abstract concept)

---

## Session Summary — Wed, Apr 1, 2026 (session 18d — image library Watch Live + Bust & Reseed UI)

### What was done

#### Image Library: "Watch Live" auto-refresh toggle

Added `watchMode` state + `refetchInterval: 8000` to the `ImageLibraryTab` query in `CommandCenter.tsx`.
- When enabled: auto-refreshes the image grid every 8 seconds AND switches sort to newest-first + page 0
- Button shows a pulsing green dot + "Watching" when active, reverts to "Watch Live" when off
- Lets admin watch images appear in real-time as the background seeder generates them

#### CommandCenter VocabImagesSection: "Bust & Reseed (Character Fix)" card

Added a 5th card to the 4-card grid in `VocabImagesSection` (changed `xl:grid-cols-4` → `xl:grid-cols-5`):
- Calls `POST /api/admin/vocab-images/bust-and-reseed` with `{ language, dryRun: false }`
- Deletes ALL cached images for selected language and starts background reseed with character injection
- Orange-tinted border distinguishes it as a destructive action
- Shows deleted count and job ID after triggering

#### Why: 212 PT/JA/KO/ZH images were bulk-deleted from DB (session 18c) to fix character injection
The bust-and-reseed endpoint was already added in session 18c. These UI additions make it accessible from the admin panel without needing curl.

### Files changed this session (session 18d)
- `client/src/pages/admin/CommandCenter.tsx` — `watchMode` state + `refetchInterval` on ImageLibraryTab query, "Watch Live" toolbar button, `bustReseedMutation` + new 5th card in VocabImagesSection grid

---

## Session Summary — Wed, Apr 1, 2026 (session 18 — Task #2: vocab drill seeding for all languages)

### What was done

#### Task #2: Seed vocab/phrase drill items

Created `server/services/vocab-drill-seed-service.ts` with `seedVocabDrillItems()`:
- Reads `vocabulary_list` + `key_phrases_for_chat` from `textbook_lesson_content`
- Creates `translate_speak` drill items: `target_text = foreign word/phrase`, `prompt = English translation`
- Tags items with `['vocab', 'seeded', partOfSpeech]` or `['phrase', 'seeded']`
- Deduplicates against existing `translate_speak` items (skips if >= 5 already exist)
- Skips "Active Practice", "AI-Generated Practice", "Mixed Drills" lessons (already have drills)

Added admin endpoint `POST /api/admin/seed-vocab-drills` (requires admin role) with job polling via `GET /api/admin/seed-vocab-drills/status/:jobId`.

Also created `server/scripts/run-seed-vocab-drills.ts` for one-shot CLI execution.

#### Seeding results

Ran seeding for all languages that needed it. Final state — lessons with `translate_speak` items:
```
english:     184/194 lessons — 3,106 items (already done from prior sessions)
french:      194/204 lessons — 3,230 items (already done)
german:      179/189 lessons — 2,955 items (already done)
italian:     181/191 lessons — 2,985 items (already done)
spanish:     216/224 lessons — 3,735 items (already done)
portuguese:  200/210 lessons — 3,314 items ← seeded this session (+3,047 items)
japanese:    178/188 lessons — 2,981 items ← seeded this session (+2,963 items)
korean:      178/188 lessons — 2,965 items ← seeded this session (+2,945 items)
mandarin:    191/201 lessons — 3,219 items ← seeded this session (+3,179 items)
```
~95% lesson coverage across all 9 languages. Missing ~5% = AI-practice lessons (already curated) + 1-2 lessons with no textbook prose.

### Files changed this session
- `server/services/vocab-drill-seed-service.ts` — NEW: seeding service
- `server/scripts/run-seed-vocab-drills.ts` — NEW: CLI seed runner
- `server/routes.ts` — Added `POST /api/admin/seed-vocab-drills` + status endpoint
- `curriculum_drill_items` (DB) — +12,134 new `translate_speak` items for PT, JA, KO, ZH

### Task #3 — TextbookChapterView redesign (done this session)
See session 18b summary below.

---

## Session Summary — Wed, Apr 1, 2026 (session 18b — Task #3: TextbookChapterView redesign)

### What was done

#### New chapter layout: one chat button, unified vocab, compact lesson accordion

Redesigned `client/src/components/TextbookChapterView.tsx` (608 → 658 lines):

**New layout order:**
1. Sticky back button + progress bar (same)
2. Chapter title + description + cultural theme (same)
3. `ChapterIntroduction` grammar reference (same)
4. **`ChapterVocabSection`** (new) — renders `VisualVocabGrid` for each section that has vocab drills, all under a "Chapter Vocabulary" heading. Images load per-lesson (each `VisualVocabGrid` uses its own `lessonId` for image lookup).
5. **Primary CTAs** — `"Chat about this chapter"` button (`data-testid="button-start-chapter-chat"`) + optional `"X Practice Activities"` button (if chapter has drills)
6. **"Lesson Reference" accordion** — compact `CompactLessonCard`s, one per section:
   - Header: number circle + name + type badge + time + Read/Covered badges
   - Clicking header or chevron toggles study notes (`InlineLessonContent`)
   - Rhythm Practice button (for vocab/drill lessons) is a sibling button, not nested inside
   - No per-lesson chat buttons
7. `ChapterRecap` at bottom (same — still has its own "Practice with Daniela" button, which is intentional)

**Removed from per-lesson cards:**
- `LessonPrepCard` (vocab grid now at chapter level)
- Per-lesson `conversationTopic`/`relatedScenario` chat buttons

**Also exported:** `VisualVocabGrid` from `TextbookInfographics.tsx` (was private, now exported for use in `ChapterVocabSection`)

**Bug fixed:** DOM nesting error (button-in-button) in compact lesson cards — expand toggle and rhythm drill button are now flat siblings, not nested.

**E2e test confirmed:** chatButton: 1 ✓, vocabSection: 1 ✓, lessonCards: 6 ✓, lessonToggleButtons: 6 ✓

### Files changed this session (Task #3)
- `client/src/components/TextbookChapterView.tsx` — Full redesign: ChapterVocabSection + CompactLessonCard + single chat CTA
- `client/src/components/TextbookInfographics.tsx` — Exported `VisualVocabGrid`

---

## Session Summary — Wed, Apr 1, 2026 (session 18c — scalable character injection for vocab images)

### Problem
Newly seeded vocab items (from `vocab-drill-seed-service.ts`) generated random anonymous-person images for verbs and phrases (e.g., "to eat" → random person eating, no style/character match). The watercolor style WAS already enforced globally via `visual-content-service.ts`. Only character consistency was missing.

### Solution: LANGUAGE_CHARACTER_INTROS injection (no manual scripting required)

Modified `server/services/vocabulary-image-resolver.ts`:
1. Added `LANGUAGE_CHARACTER_INTROS` map (lines ~72–82) — compact character descriptions for all 9 languages (Daniela/Spanish, Sophie/French, Lena/German, Giulia/Italian, Ana/Portuguese, Yuki/Japanese, Ji-yeon/Korean, Mei/Mandarin, Emma/English)
2. Added `looksLikeActionOrPhrase(concept)` helper — returns true for "to X" infinitives, "Xing" gerunds, or 3+ word phrases
3. Modified `buildGenerationConcept()` to accept `characterIntro?: string` — injects the character for action/phrase concepts: `"Ana, a 27-year-old Brazilian woman..., eating lunch at a café, in a natural everyday setting"`
4. Updated the language-specific fallback generation call site to pass `LANGUAGE_CHARACTER_INTROS[language]` as `characterIntro`
5. Updated `previewRefetchImage()` similarly so admin preview matches production
6. Shared concept keys (colors, seasons, numbers) are NOT affected — those stay character-neutral across all languages

### What gets character injection going forward:
- Verb/infinitives: "to eat", "to speak", "to go shopping", etc. → named character doing the action
- Gerunds: "eating", "speaking", etc.
- Multi-word phrases (3+ words)
- NOT: single nouns (house, dog, book) — those remain clean watercolor prop images, which is correct

### Already-cached bad images
Images generated before this fix are cached in `media_files`. They'll keep serving from cache until refetched. To fix them, use the admin image refetch tool, OR wait for users to encounter them and refetch manually. A bulk-bust script could be written if needed.

### Files changed this session (session 18c)
- `server/services/vocabulary-image-resolver.ts` — `LANGUAGE_CHARACTER_INTROS` map, `looksLikeActionOrPhrase()`, `buildGenerationConcept()` character injection, both call sites updated

---

## Session Summary — Wed, Apr 1, 2026 (session 17 — hasta pronto duplicates + hello/hi image fix)

### Issues fixed

#### 1. "hasta pronto" duplicate in visual vocab grid (and siblings in FR/EN)

**Root cause**: Migration #004 Part B added both a `listen_repeat` (prompt=target_text, no English shown) AND a `translate_speak` (prompt=English translation) for farewell words. Both items passed the visual vocab filter (`prompt !== targetText` fails for listen_repeat because prompt=targetText=foreign word). This caused two cards for the same word.

**Fix**: Deleted the three duplicate `listen_repeat` items:
- `82732656` — Spanish "hasta pronto" listen_repeat
- `770dcc0c` — French "à bientôt" listen_repeat
- `45bdb19c` — English "see you soon" listen_repeat

The `translate_speak` siblings remain (they correctly show the English translation).

#### 2. "hello" and "hi" images replaced with bad images

**Root cause chain** (4 steps):
1. Migration #004 Part A busted ALL English greetings cache (`bustVocabImageCache(englishKeys)`) to force elder-character regeneration
2. English greeting lesson drill #1 has `target_text = "'Hello'"` (with literal apostrophes from the original lesson data)
3. `normalizeForOverride("'Hello'")` returned `'hello'` (apostrophes NOT stripped — only `¿¡?!,;:` were stripped, NOT `'`)
4. Scene override lookup for `SCENE_OVERRIDES["'hello'"]` failed (key is `hello` without quotes) → DALL-E fell back to using the full drill description prompt as the image concept → bad image generated and cached

**Fixes**:
1. **`normalizeForOverride` bug fixed** (`server/services/vocab-image-seed-service.ts`): Added `.replace(/^['"''""\s]+|['"''""\s]+$/g, '')` step to strip leading/trailing quotation marks (handles `'Hello'`, `"Goodbye"`, smart quotes) while leaving mid-word apostrophes intact (French/Italian contractions)
2. **English greeting drill target_text cleaned** (`curriculum_drill_items` table):
   - `00f0319b`: `'Hello'` → `Hello`
   - `4b1fbe34`: `"'Goodbye', then 'Bye'"` → `Goodbye`
3. **Bad cached images deleted** from `media_files`:
   - `vocab_english_hello` (generated April 1 with wrong concept)
   - `vocab_english_hi` (generated March 31 — may have been bad)
   → Images regenerate correctly on next English greeting lesson textbook load, now using the proper Emma+Marcus character scenes from SCENE_OVERRIDES

### Files changed this session
- `server/services/vocab-image-seed-service.ts` — Fixed `normalizeForOverride()` to strip surrounding quotation marks
- `curriculum_drill_items` (DB) — Cleaned `'Hello'` → `Hello` and `"'Goodbye', then 'Bye'"` → `Goodbye` for English greeting lesson
- `curriculum_drill_items` (DB) — Deleted 3 duplicate listen_repeat items (ES/FR/EN greeting farewells)
- `media_files` (DB) — Deleted 2 bad cached images for `vocab_english_hello` and `vocab_english_hi`

### Still pending from previous sessions
- Three Sofia false-positive filters + VHT queue cleanup (from session 15, unchanged)
- Migration #004 elder characters + drill items: partially complete. The `see you soon` translate_speak items were added correctly. The bad `listen_repeat` siblings were deleted this session. Consider whether German/Italian/Portuguese farewell lesson drills need the same translate_speak treatment (check if `bis später`, `a presto`, `até logo` have translate_speak items with correct English prompt).

---

## Session Summary — Wed, Apr 1, 2026 (session 16 — Proactive WS reconnect / proxy 5-min timeout fix)

### Root cause confirmed — Replit proxy 5-minute WebSocket hard kill

**Problem**: Production users in sessions longer than 5 minutes were experiencing a sudden 10–30 second audio gap every 5 minutes. The gap happened mid-sentence (audio chunk 53, 54, 55... then cut). Two confirmed affected users on March 26: `016e8e6a` (Spanish) and `02e18b64` (Italian), covering multiple sessions.

**Forensic evidence** (from `voice_pipeline_events` timeline analysis):
- WS drops occurred at exactly **301–302 seconds** after each WebSocket connection opened
- Pattern was identical in both zombie sessions (precision: 301974ms / 302064ms / 302008ms / 302024ms) and active sessions
- Drops occurred DURING active speech/audio (not during idle periods) — ruling out idle timeout
- After each drop, client reconnected but received "Session not ready for streaming" errors for 10–30s while orchestrator re-initialized
- Sessions ultimately survived all drops; users completed their sessions

**Why `pingInterval: 30000` didn't help**: The 30-second Socket.IO ping prevented idle timeouts, but this is a **hard connection lifetime limit** at the Replit proxy layer — the proxy kills the WebSocket connection after exactly 5 minutes regardless of activity. No amount of keepalive pings can prevent a hard duration limit.

**Impact per normal session**: A 30-minute lesson unit = 5–6 forced mid-sentence cuts at minutes 5, 10, 15, 20, 25, 30. Every power user hits this.

### Fix implemented (April 1, 2026)

**Proactive 4.5-minute WebSocket cycle** — `client/src/lib/streamingVoiceClient.ts`

When a WebSocket connection is successfully established, a 270-second (4.5-minute) timer starts. At 270s — 30 seconds before the proxy's hard 5-minute kill — the client intentionally disconnects and reconnects. The reconnect uses the existing `handleDisconnect` path with `isReconnect: true`, which:
1. Reconnects the socket (200ms delay)
2. Re-initializes the server-side streaming session
3. Restores open-mic mode if active
4. Emits `reconnected` event to UI

The proactive reconnect is **transparent to the user** — the gap is ~200–500ms instead of 10–30s. The timer resets after each successful reconnect, so sessions of any length get clean cycles every 4.5 minutes.

**Key constants**:
```ts
private readonly PROACTIVE_RECONNECT_MS = 270000;  // 4.5 min
```

**New event type**: `proactive_reconnect` is emitted before the intentional disconnect so the diagnostic timeline marks it. The Sofia VHT false-positive guard skips any error reports that have a `proactive_reconnect` event within 30 seconds in their timeline.

### Monitoring

To distinguish proactive cycles from real proxy kills after this fix:
- `proactive_reconnect` entries in diagnostic timelines = healthy, expected
- `ws_error: "Connection lost"` entries in timelines that do NOT follow a `proactive_reconnect` = real drop, needs investigation
- The 9 March 26 connection reports in Sofia's 15-genuine-keeper queue remain as historical reference; going forward these should not recur

**SQL to monitor**:
```sql
-- Count proactive cycles vs real drops per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE event_data->>'trigger' = 'proactive_reconnect') as proactive_cycles,
  COUNT(*) FILTER (WHERE event_type = 'client_diag_error') as real_errors
FROM voice_pipeline_events
WHERE created_at > NOW() - INTERVAL '7 days'
  AND event_type LIKE 'client_diag_%'
GROUP BY date ORDER BY date DESC;
```

### Files changed
- `client/src/lib/streamingVoiceClient.ts` — Added `PROACTIVE_RECONNECT_MS` constant, `proactiveReconnectTimer` field, `startProactiveReconnect()`, `stopProactiveReconnect()` methods. `stopHeartbeat()` now also stops the proactive timer. `completeConnection()` now calls `startProactiveReconnect()`. New `proactive_reconnect` event type added to `StreamingEventType` union.
- `client/src/hooks/useStreamingVoice.ts` — Added `handleProactiveReconnect` handler that logs `diagEvent('proactive_reconnect')`. Registered and cleaned up alongside other event listeners.
- `server/routes.ts` — Added 4th Sofia VHT false-positive guard: if diagnostic timeline contains a `proactive_reconnect` event within 30s of report time, skip Sofia filing.

---

## Session Summary — Wed, Apr 1, 2026 (session 15 — Sofia queue cleanup + false-positive filters)

### Completed this session

1. **Sofia tier-2 false-positive guard** (`server/routes.ts`):
   - `failsafe_tier2_45s` was filing `no_audio` reports whenever a user paused for 45+ seconds after audio played correctly
   - Gate: if `sentenceTracking.allSentencesEnded === true` OR `sentencesEnded >= expectedSentenceCount > 0` → skip report
   - Real failures (received=0, expected>0, or unknown state) still get through

2. **Connection `error` trigger false-positive guard** (`server/routes.ts`):
   - WS reconnect loops from zombie/abandoned sessions were filing `connection` reports
   - Gate: if `ws.wsMessageCount === 0` AND `hookState.responseCompleteReceived === false` AND `audio.audioContextState === 'unknown'` → skip report
   - Real mid-session drops (wsMessageCount > 0, or audio was playing) still get through

3. **Voice health transition auto-resolve** (`server/services/support-persona-service.ts`):
   - When a `recovered` health transition fires, it now retroactively resolves all prior `actionable` VHT records for that environment
   - Prevents permanent accumulation of unresolvable degradation records

4. **Historical queue backlog cleanup** (one-time DB ops):
   - Resolved 1,119 historical `voice_health_transition` records older than 3 days (Feb–Mar degradation artifacts)
   - Resolved 30 reports from zombie session `0569def2` (wsMessageCount=0, no audio context)
   - Queue went from ~1,200 cluttered records to ~38 meaningful ones

### Key files changed this session
- `server/routes.ts` — two false-positive guards in the client-diagnostic handler (~line 6290)
- `server/services/support-persona-service.ts` — VHT auto-resolve in `recordHealthDigest`

### Current queue state (post-cleanup)
- `connection` pending: 18 (March 26 sessions — audio was playing when WS dropped, legitimate review candidates)
- `no_audio` pending: 7 (recent, being monitored)
- `voice_health_transition` actionable: 10 (recent test noise, < 3 days old)
- `double_audio` pending: 1 / `microphone` pending: 2

### Next session scratchpad
- Migration #004 (elder characters + EN cache bust + drill items) is still pending
- The 18 pending `connection` March 26 reports are worth a manual review — audio was actively playing when WS dropped, which suggests real connection instability on that day

---

## Session Summary — Mon, Mar 31, 2026 (session 14 — founder mode Spanish bleed + re-enter immersive button)

### Completed this session

1. **Founder mode Spanish bleed fix** (`server/system-prompt.ts`):
   - Added `⚡ ACTIVE SESSION LANGUAGE` anchor **early** in both `createSystemPrompt` (founder mode branch) and `createStreamingVoicePrompt` (founder mode branch) — placed immediately after identity/founder context, BEFORE the neural network content loads
   - Non-Spanish sessions get explicit block: "Do NOT default to Spanish... your neural network has Spanish content, but this session is ${languageName}"
   - Previously the `LANGUAGE CONTEXT` block was only at the END of the prompt (after `fullNeuralNetwork`), so it was too late — Gemini was already saturated with Spanish from the neural network data
   - Spanish sessions still work normally (no redundant warning)

2. **Re-enter immersive "Fullscreen" button** (`client/src/pages/chat.tsx`):
   - Floating button (bottom-right) appears when `activeSceneCanvas` is set but `isImmersiveMode === false`
   - Dark glassy style: `bg-black/70 hover:bg-black/90 text-white border border-white/20 backdrop-blur-sm`
   - `data-testid="button-reenter-immersive"`, `Maximize2` icon
   - Note: This feature was already scaffolded from session 13 — the session 14 confirmation just verified the code landed correctly in the merged branch

### Key files changed this session
- `server/system-prompt.ts` — `createSystemPrompt` + `createStreamingVoicePrompt` founder mode paths now have language anchor early

### Next session scratchpad
- **Founder mode Spanish bleed** should now be resolved for EN/FR/DE/IT/PT/JP/KO/ZH — watch for edge cases where a user explicitly asks Cindy to "do some Spanish" (that should work fine since it's an explicit request)
- The re-enter immersive button is cosmetically minimal; if a more prominent treatment is desired, the `chat.tsx` section at `button-reenter-immersive` is the place to update

---

## Session Summary — Mon, Mar 31, 2026 (session 13 — elder characters + see-you-soon drill items)

### Completed this session

1. **Grandmother/elder characters added to CHARACTER_PROFILES** (`server/services/vocab-image-seed-service.ts`):
   - FR: `grandmere` — Colette, Sophie's 66-year-old French grandmother
   - DE: `oma` — Helga, Anna's 67-year-old German grandmother
   - IT: `nonna` — Carmela, Giulia's 65-year-old Italian grandmother
   - PT: `avo` — Maria, Ana's 64-year-old Brazilian grandmother
   - EN: `grandma` — Dorothy, Emma's 65-year-old American grandmother
   - Matches the Spanish pattern (`abuela` Rosa) that made Spanish farewell images warm and family-oriented

2. **Farewell SCENE_OVERRIDES updated** to use elder characters:
   - French: `au revoir` → Sophie waves at doorway, Colette on steps; `à bientôt` → Sophie hugs Colette
   - German: `auf Wiedersehen` → Anna waves, Oma Helga on path; `bis später` → Anna hugs Oma Helga
   - Italian: `arrivederci` → Giulia waves at doorway, nonna Carmela on step; `a presto` → Giulia hugs nonna Carmela
   - Portuguese: `adeus` → Ana waves, avó Maria on path; `até logo` → Ana hugs avó Maria
   - English: `goodbye` → Emma waves, grandma Dorothy on porch; `see you soon` → Emma hugs grandma Dorothy

3. **Migration #004 added and applied** (`server/migrations/migration-orchestrator.ts`):
   - **Part A**: Busted English greeting image cache (22 images cleared) — fixes stale flat-icon "hello" image, regenerates with Emma + Marcus watercolor scene
   - Busted FR/DE/IT/PT/EN farewell words that now use elder character prompts
   - **Part B**: Added "hasta pronto" (ES), "à bientôt" (FR), "see you soon" (EN) as `listen_repeat` + `translate_speak` drill items to their greetings lessons — now appears in textbook Visual Vocabulary
   - DE/IT/PT skipped (no matching greetings lesson in `curriculum_paths` — those use a separate drill-lesson seeder path)

4. **curriculum-seed.ts updated**: Spanish Lesson 1 description + conversationTopic now include "hasta pronto"

### Key files changed this session
- `server/services/vocab-image-seed-service.ts` — CHARACTER_PROFILES (new elder characters), SCENE_OVERRIDES (farewell updates)
- `server/migrations/migration-orchestrator.ts` — migration #004 added
- `server/curriculum-seed.ts` — Spanish lesson 1 description updated

### Next session scratchpad
- **English "hello"** should regenerate automatically via startup seeder (+70s) — cache was cleared; new image will use Emma + Marcus watercolor scene
- **FR/DE/IT/PT farewell images** were also cleared — they regenerate on-demand when textbook page is accessed; or run fix-all-greetings from admin to regenerate proactively
- **DE/IT/PT "see you soon" drill items** not added (no curriculum_paths greetings lesson) — if needed, the drill-lesson seeder (which already seeds greetings for those languages) would need updating to include the "see you soon" equivalent words
- **Admin**: After deployment, may want to run "Fix All Greetings" from Command Center → Vocab Images tab to regenerate all cleared farewell images with the new elder character prompts

---

## Session Summary — Mon, Mar 31, 2026 (session 12 — sub-environments + route security)

### Completed this session

1. **6 clothing-store + library sub-environments** — full stack implementation:
   - `clothing_store_floor` (browsing racks), `clothing_store_fitting` (fitting room), `clothing_store_checkout` (checkout counter)
   - `library_desk` (circulation desk), `library_stacks` (among bookshelves), `library_checkout` (checkout/returns desk)
   - Added to `ENV_VALID_POSITIONS` + `SCENE_PROMPTS` (`server/services/prop-room-compositor.ts`)
   - Added to both `compose_visual_scene` and `open_scene` enums + description text (`server/services/daniela-function-registry.ts`)
   - `seed-zone-environments` zone mappings updated (`server/routes.ts`): clothing-store stages 0/1/2 now point to `clothing_store_floor` / `clothing_store_fitting` / `clothing_store_checkout`; the-library stages 0/1/2 now point to `library_desk` / `library_stacks` / `library_checkout`
   - Legacy `clothing_store` and `library` kept in all enums as general fallbacks (existing DB records depend on them)
   - **Seeded to DB** and **6 DALL-E 3 images generated** successfully (all `success: true` in bootstrap log)

2. **`POST /api/admin/generate-scene-images` secured** (`server/routes.ts`):
   - Added `isAuthenticated` middleware + `user.role !== 'developer' && user.role !== 'admin'` check
   - Pattern matches existing auth checks (e.g. `/api/sync/export/anonymized-insights`)

3. **`internal-bootstrap` extended** with `generate-scene-images` action:
   - Accepts `names: string[]` (filter to specific envs) + `force: boolean` (re-generate existing)
   - Fires async job, returns `jobId` immediately
   - Protected by `x-bootstrap-secret: holahola-dev-bootstrap-2026` header

---

## Session Summary — Mon, Mar 31, 2026 (session 11 — new scenarios + immersive whiteboard fix)

### Completed this session

1. **Two new scenarios seeded to DB** (all 10 languages, `active = true`):
   - **The Clothing Store** (`slug: clothing-store`, `category: daily`, `location: A clothing boutique`)
   - **The Library** (`slug: the-library`, `category: cultural`, `location: A public library`)

2. **`SCENARIO_SCENE_MAP` updated** (`server/services/native-fc-handlers.ts`):
   - Added: `'clothing-store': 'clothing_store'`, `'the-library': 'library'`
   - Updated stale entries: `coffee-shop` → `cafe_exterior`, `restaurant` → `restaurant_entrance`, `airport-checkin` → `airport_checkin`, `museum-visit` → `museum_entrance`

3. **`seed-zone-environments` updated** (`server/routes.ts`): Added 6 new mappings (now superseded by session 12 sub-environments).

4. **Immersive whiteboard strip** (`client/src/components/ImmersiveOverlay.tsx`): Added `ImmersiveWhiteboardStrip` component — renders the latest `write`, `phonetic`, or `compare` item as a frosted-glass subtitle bar at the bottom-centre of the scene. Fixes whiteboard-in-immersive bug confirmed by Daniel McIntosh (conv `19e34811`).

### Key files changed this session
- `server/services/native-fc-handlers.ts` — `SCENARIO_SCENE_MAP`: 2 new entries, 4 stale entries updated
- `server/routes.ts` — `seed-zone-environments`: 6 new zone mappings for clothing-store + the-library
- `client/src/components/ImmersiveOverlay.tsx` — `ImmersiveWhiteboardStrip` component added; rendered inside the overlay with `AnimatePresence`

### Next session scratchpad
- **Clothing store + library have a single background image each** (all 3 stages show the same image). Could add sub-environments like `clothing_store_floor` / `clothing_store_fitting` / `clothing_store_checkout` and `library_desk` / `library_stacks` / `library_checkout` for visual variety across stages — same pattern as `cafe_exterior` → `cafe_counter` → `cafe_table`.
- **Immersive strip only shows the most recent item** — if Daniela writes multiple things in succession, only the last one is visible. A scrollable or stacked display could improve this, but keep it simple for now.
- **`generate-scene-images` route still unprotected** (no admin auth) — should be secured before prod.

---

## Session Summary — Mon, Mar 30, 2026 (session 10 — scenario_zones → visual_environments collapse)

### Completed this session

**Goal**: Collapse `scenario_zones.imageUrl` into the `visual_environments` system so that `advance_scene()` always pulls backgrounds from the canonical visual_environments pool rather than separately-generated zone images.

1. **Schema**: Added `visual_environment_name` varchar column to `scenario_zones` table (nullable). References `visual_environments.name`. When set, the LOAD_SCENARIO handler resolves image from `visual_environments` instead of relying on the legacy `imageUrl`.

2. **Three new `visual_environments` entries added**: `museum`, `taxi_interior`, `hotel_room` — each with descriptive prompts added to `SCENE_PROMPTS` in `prop-room-compositor.ts`. Images generated via DALL-E 3 (watercolor style). ✅

3. **LOAD_SCENARIO handler updated** (`native-fc-handlers.ts`): After loading zones, a single batch query fetches all needed `visual_environments` images. Each zone's `imageUrl` is pre-resolved from `visual_environments` when `visualEnvironmentName` is set; falls back to stored `imageUrl`. `ADVANCE_SCENE` handler is unchanged since it consumes `nextZone.imageUrl` which is now pre-resolved in session state.

4. **`SCENARIO_SCENE_MAP` fixed**: `'museum-visit': 'office'` → `'museum-visit': 'museum'` (proper environment now exists).

5. **Zone data migrated**: `POST /api/admin/seed-zone-environments` route seeds the 3 new visual_environments rows and updates all 18 existing scenario_zones with their `visual_environment_name` mapping:
   - `hotel-checkin`: zones 0,1 → `hotel_lobby`; zone 2 → `hotel_room`
   - `airport-checkin`: all 3 zones → `airport`
   - `museum-visit`: zones 0,1 → `museum`; zone 2 → `cafe`
   - `restaurant`: all 3 zones → `restaurant_table`
   - `coffee-shop`: zone 0 → `city_street`; zones 1,2 → `cafe`
   - `taxi-ride`: zone 0 → `city_street`; zone 1 → `taxi_interior`; zone 2 → `city_street`
   - **18/18 zones updated** ✅

6. **New admin route**: `POST /api/admin/generate-scene-images` — body `{ names: string[], force?: boolean }` — generates DALL-E images for specific `visual_environments` entries. Useful for future ad-hoc environment image generation.

### Key files changed this session
- `shared/schema.ts` — `scenarioZones` table: `visualEnvironmentName` column added
- `server/services/prop-room-compositor.ts` — `SCENE_PROMPTS`: 3 new entries (`museum`, `taxi_interior`, `hotel_room`) added before the close-up zone environments section
- `server/services/native-fc-handlers.ts` — `LOAD_SCENARIO`: zone image pre-resolution from `visual_environments`; `SCENARIO_SCENE_MAP`: museum mapping fixed
- `server/routes.ts` — `POST /api/admin/seed-zone-environments`; `POST /api/admin/generate-scene-images`

### Next session scratchpad
- Zone images from `scenario_zones.imageUrl` are now legacy/fallback only — `visualEnvironmentName` is the canonical source
- The `imageUrl` column on `scenario_zones` still exists and is still used as fallback (for any zone without `visualEnvironmentName`)
- The `scenario_zones.imageUrl` and `imagePrompt` columns could eventually be dropped, but only after confirming no zones still rely on them
- The `generate-scene-images` route is unprotected (no admin auth required) — should be secured before prod
- The `seed-zone-environments` route is idempotent (uses `ON CONFLICT (name) DO NOTHING`) — safe to re-run
- **TERMINOLOGY SETTLED**: User says "stages" not "zones" for `scenario_zones`. The UI now uses "stages" in user-facing labels. Internal variable names (`zone_count`, `showZonesOnly`) unchanged.
- **Daniela function registry updated (same session)**: `open_scene` and `compose_visual_scene` environment enums now include all 34 environments (museum, taxi_interior, hotel_room, bank, pharmacy, networking_event, restaurant_table_with_plate added). `open_scene` environment description now has grouped categories with brief descriptions.

---

## Session Summary — Mon, Mar 30, 2026 (session 9 — zone images → Image Library)

### Completed this session

1. **Zone images now sync to Image Library** — previously generated zone images lived only in `scenario_zones.image_url` and didn't appear in the admin Image Library (`media_files` table). Now they do:
   - `saveZoneImageToMediaLibrary()` helper added to `server/routes.ts` — writes a `media_files` record with `imageSource: 'ai_generated'`, title `"ScenarioTitle — ZoneName"`, tags `['scenario-zone', scenario, zone]`
   - Single-zone route `POST /api/admin/generate-zone-image/:zoneId` — calls helper after saving to `scenario_zones`
   - Batch route `POST /api/admin/generate-all-zone-images` — calls helper for each generated image
   - **New backfill route** `POST /api/admin/backfill-zone-images-to-media` — syncs all existing zone images (that already have `imageUrl`) into `media_files`; idempotent to re-run
   - **Backfill run**: All 18 existing zone images saved to `media_files` ✅

2. **Admin UI — Scenario Zones section gains "Sync to Library" button** (`CommandCenter.tsx`):
   - New `backfillMutation` calls `backfill-zone-images-to-media`
   - Button renders between "Generate All Zone Images" and "Refresh"
   - Shows result message below after completion

---

## Session Summary — Mon, Mar 30, 2026 (session 8 — batch image fixes + Scenario Zones admin)

### Completed this session

1. **Zone image route fixed** — `POST /api/admin/generate-zone-image/:zoneId` was failing with 401 because it used `process.env.OPENAI_API_KEY` directly. Now uses `generateImageWithGemini()` (respects `USER_OPENAI_API_KEY` fallback). Response also correctly uses `dataUrl`.

2. **Batch backend routes added** (server/routes.ts):
   - `POST /api/admin/vocab-images/fix-all-greetings` — busts + regenerates greetings for ALL 10 languages in background
   - `POST /api/admin/vocab-images/fix-all-numbers` — busts + regenerates numbers/days for ALL 10 languages in background
   - `POST /api/admin/generate-all-zone-images` — generates DALL-E images for ALL zones without one
   - `GET /api/admin/all-zone-images-status` — returns all zones with image status + scenario names
   - `POST /api/admin/internal-bootstrap` — secret-protected (header `x-bootstrap-secret: holahola-dev-bootstrap-2026`) dev bootstrap; actions: `fix-all-greetings`, `fix-all-numbers`

3. **Admin UI updated** (`client/src/pages/admin/CommandCenter.tsx`):
   - `VocabImagesSection`: Added "Fix All Languages" buttons (secondary variant) to both Numbers/Days and Greetings cards — calls the new batch routes, shows result
   - New `ScenarioZonesSection` component added to DevTools tab — zone status table (scenario, name, order, chain slug, image status), "Seed All Zones" button, "Generate All Zone Images" button, "Refresh" button, badge shows `N/Total images`

4. **ALL THREE OPERATIONS TRIGGERED via curl** — all 18 zone images generated ✅, greetings + numbers regenerated for all 10 languages ✅

### Key files changed this session
- `server/routes.ts` — zone image route fix; 4 new batch admin routes; `internal-bootstrap` helper
- `client/src/pages/admin/CommandCenter.tsx` — `VocabImagesSection` + `ScenarioZonesSection`

---

## Session Summary — Mon, Mar 30, 2026 (session 7 — European numbers reference cards)

### Completed this session

1. **European language numbers reference cards** — Created `TextbookNumbersCards.tsx` with 6 new language-specific numbers cards: `EsNumbersCard`, `FrNumbersCard`, `DeNumbersCard`, `ItNumbersCard`, `PtNumbersCard`, `EnNumbersCard`. Each shows:
   - Compact 0–20 grid (number | native word)
   - Tens table (20–90) with language-specific patterns
   - Hundreds/thousands table with notes
   - Language-specific NoteBox (e.g. French 70/80/90 system, German ones-before-tens, Italian elision rule, Portuguese gender agreement)

2. **GrammarChapterType union expanded** — Added 6 new types: `'es_numbers' | 'fr_numbers' | 'de_numbers' | 'it_numbers' | 'pt_numbers' | 'en_numbers'`

3. **classifyGrammarType updated** — Numbers detection added to:
   - Spanish default branch: catches "number", "número", "los números", "counting"
   - `classifyFrenchGrammarType`: catches "number", "nombre", "les nombres", "les chiffres", "compter"
   - `classifyPortugueseGrammarType`: catches "number", "número", "os números", "numeros", "contar"
   - `classifyGermanGrammarType`: catches "number", "zahlen", "die zahlen", "counting", "numeral"
   - `classifyItalianGrammarType`: catches "number", "numeri", "i numeri", "contare", "counting"
   - New `classifyEnglishGrammarType` function added with numbers + shared canvas vocab types; dispatched from `classifyGrammarType` when `language === 'english'`

4. **GRAMMAR_LABELS updated** — All 6 new types have metadata entries in the main `GRAMMAR_LABELS` Record

5. **GrammarChapterView render blocks added** — 6 render blocks: `{type === 'es_numbers' && <EsNumbersCard />}` etc.

6. **suppressVocabGrid expanded** — `LANG_SPECIFIC_NUMBER_TYPES` in `TextbookChapterView.tsx` now includes all 10 number types (original 4 + new 6), suppressing the SVG image grid for ALL language numbers chapters

### Key files changed this session
- `client/src/components/TextbookNumbersCards.tsx` — **NEW FILE** — All 6 language numbers cards
- `client/src/components/ChapterIntroduction.tsx` — Import, type union, classify functions, metadata, render blocks
- `client/src/components/TextbookChapterView.tsx` — `LANG_SPECIFIC_NUMBER_TYPES` set expanded; `INLINE_SUPPRESS_TYPES` added to prevent duplicate inline card in `InlineLessonContent`

### Duplicate reference card bug fix (same session)
`InlineLessonContent` also calls `classifyGrammarType(lessonName, language)` — so "Practice Time: Numbers 0-20" (contains "numbers") was ALSO triggering `es_numbers` and showing the card inline inside each expanded lesson, producing a duplicate.
Fix: Added `INLINE_SUPPRESS_TYPES` set (all 10 number types) at top of file. `InlineLessonContent` now nulls out the `inlineRefType` when it's in that set, so the reference card renders **only** at the chapter level via `ChapterIntroduction` — never again inline at lesson level for numbers chapters.

---

## Session Summary — Mon, Mar 30, 2026 (session 6 — textbook duplicate section fix)

### Completed this session

1. **Japanese numbers unit description** — Was in Japanese (unreadable to learner). Updated to English: "Master numbers 0–20 in Japanese. Learn to count, share phone numbers, and talk about prices."

2. **Duplicate numbers section fix** — Japanese (also Korean, Mandarin, Hebrew) numbers chapters were showing BOTH:
   - `ChapterIntroduction` → language-specific numbers reference card (`JaNumbersCard`, `KoNumbersCard`, etc.) — the rich kanji/character grid with building patterns
   - `LessonPrepCard` → `VisualVocabGrid` inside each lesson card — inferior SVG number image grid
   
   Fix: In `TextbookChapterView`, compute `classifyGrammarType(chapter.title, language)`. When result is in `LANG_SPECIFIC_NUMBER_TYPES = {'ja_numbers', 'ko_numbers', 'zh_numbers', 'he_numbers'}`, set `suppressVocabGrid=true` on all `VisualLessonCard` → `LessonPrepCard`. The `LessonPrepCard` now accepts `suppressVocabGrid` prop and skips BOTH the image grid AND the text list vocab fallback when it's set. Languages without a language-specific numbers card (Spanish, French, etc.) are unaffected.

### Key files changed this session
- `client/src/components/TextbookInfographics.tsx` — `LessonPrepCard` accepts `suppressVocabGrid?: boolean`; vocabGrid and text-list fallback both suppressed when set
- `client/src/components/TextbookChapterView.tsx` — computes `suppressVocabGrid` from chapter title + language; `VisualLessonCard` passes it to `LessonPrepCard`
- DB: `curriculum_units.description` for "Unit 2: 数字 (Sūji) - Numbers & Counting" → English text

---

## Session Summary — Sun, Mar 29, 2026 (session 5 — multi-zone scenario system)

### Completed this session

**Multi-zone scenario system — FULLY IMPLEMENTED** — Scenarios can now advance through sequential zones (e.g. taxi: Pickup → The Ride → Paying) without breaking the conversation. The AI judges task completion and calls `advance_scene()` to trigger a zone transition. The last zone can chain to another scenario via `nextScenarioSlug`.

**Backend (all done in previous session, confirmed this session):**
1. `shared/schema.ts` — `scenarioZones` table added (id, scenarioId, zoneOrder, name, description, imageUrl, imagePrompt, teachingFocus, nextScenarioSlug); `insertScenarioZoneSchema` + `ScenarioZone` types exported.
2. `server/services/daniela-function-registry.ts` — `advance_scene()` tool registered; `buildContinuationResponse` updated to include zone context (zone name, task, remaining count) so Daniela knows what she's facilitating in each zone.
3. `server/services/native-fc-handlers.ts` — `LOAD_SCENARIO` now loads zones from DB, attaches to `session.activeScenario.zones`, uses zone 0's `imageUrl` as the initial scenario image. `ADVANCE_SCENE` case sends `scene_zone_advanced` WS message with `{zoneIndex, zoneName, imageUrl, isChain, nextScenarioSlug, isComplete}`.
4. `server/routes.ts` — Three new routes: `GET /api/scenarios/:scenarioId/zones`, `POST /api/admin/seed-scenario-zones` (taxi 3 zones + restaurant 3 zones, taxi last zone chains to restaurant), `POST /api/admin/generate-zone-image/:zoneId` (lazy DALL-E for zone images).

**Frontend (completed this session):**
5. `client/src/lib/streamingVoiceClient.ts` — `scene_zone_advanced` WS message → `zoneAdvanced` event emitted.
6. `client/src/hooks/useStreamingVoice.ts` — `handleZoneAdvanced` callback wired; `onSceneZoneAdvanced` in session config type; registered on `.on('zoneAdvanced', ...)` and cleaned up on disconnect.
7. `client/src/components/StreamingVoiceChat.tsx` — `onSceneZoneAdvanced` prop accepted and forwarded in both initial connect and reconnect paths.
8. `client/src/pages/chat.tsx` — `onSceneZoneAdvanced` handler updates `loadedScenarioData` with `{imageUrl, currentZoneName, currentZoneIndex}`; `activeScenario` derivation includes `zones`, `currentZoneIndex`, `currentZoneName`.
9. `client/src/components/ScenarioPanel.tsx` — `zoneImageFading` state with `useRef` tracks previous imageUrl; `useEffect` triggers `opacity-0` → `opacity-100` CSS transition (300ms) when imageUrl changes. Zone name badge overlaid on bottom of scenario image (black/50 backdrop); shows `"Zone Name N/Total"` when multi-zone scenario is active.
10. `shared/whiteboard-types.ts` — `ScenarioZoneInfo` interface + `zones?`, `currentZoneIndex?`, `currentZoneName?` fields on `ScenarioItemData`.

### ACTIVE TODOs (still pending)

- **Seed zone images**: Hit `POST /api/admin/seed-scenario-zones` to create the taxi + restaurant zone rows in DB; then `POST /api/admin/generate-zone-image/:zoneId` for each zone that needs a DALL-E image. Zone 0 image is used as the scenario's initial background image.
- Run Fix Greetings for **English, French, German, Italian, Portuguese** (to pick up updated SCENE_OVERRIDES for their greeting words and fix Portuguese "de nada").
- Run Fix Greetings for **Spanish** (to regenerate the 11 courtesy-phrase images with Daniela).
- Run Fix Numbers/Days (Spanish) in admin to replace the old DALL-E number images with SVGs.

### Key files changed this session
- `client/src/pages/chat.tsx` — `onSceneZoneAdvanced` handler; `activeScenario` zones fields
- `client/src/components/ScenarioPanel.tsx` — cross-fade zone image transition; zone name badge
- `client/src/components/StreamingVoiceChat.tsx` — `onSceneZoneAdvanced` prop forwarded on reconnect

---

## Session Summary — Sun, Mar 29, 2026 (session 4 — staleTime + SVG numbers)

### Completed this session

1. **Textbook staleTime reduced** (`TextbookInfographics.tsx` line 732) — was 30 min, now 2 min (`staleTime: 1000 * 60 * 2`). gcTime reduced from 60 min → 10 min. Admin fix-word changes now appear in the textbook within 2 minutes instead of 30.

2. **SVG number images** — `server/services/vocabulary-image-resolver.ts` now intercepts any `concept_num_X` key before DALL-E is called. A clean server-generated SVG (cream background, deep navy numeral, Georgia serif, 512×512) is returned instantly and cached under the concept key. DALL-E is never called for numbers again. `generateNumberSvgDataUrl(num)` helper added at the top of the file.

3. **Admin "Fix Numbers / Days" description updated** — The button description now mentions "Numbers regenerate as crisp server-generated SVGs (no DALL-E)". Flow: admin clicks button → old DALL-E concept keys busted → background re-seeder calls resolver for each word → numbers get SVG, days get DALL-E scene illustration.

### ACTIVE TODOs (still pending)

- Run Fix Numbers/Days (Spanish) in admin to replace the old DALL-E number images with SVGs.
- Run Fix Greetings for **English, French, German, Italian, Portuguese** (to pick up updated SCENE_OVERRIDES for their greeting words and fix Portuguese "de nada").
- Run Fix Greetings for **Spanish** (to regenerate the 11 courtesy-phrase images with Daniela).

4. **Chapter cover images → DALL-E scene illustrations** — `ChapterIntroduction.tsx` no longer uses the stock photo `numbers_counting_blocks_education.jpg` for the numbers chapter banner. Instead it fetches from `GET /api/chapter-cover/:chapterType` (new route). The resolver uses a `chapter_cover_<type>` concept key, generates via DALL-E with a watercolor illustration prompt (no characters, classroom/abacus/number-tiles scene), and caches it — shared across all languages. Full pipeline:
   - `server/services/vocabulary-image-resolver.ts` — added `CHAPTER_COVER_SCENES` dict + `resolveChapterCoverImage()` function
   - `server/routes.ts` — added `GET /api/chapter-cover/:chapterType`
   - `client/src/components/ChapterIntroduction.tsx` — removed `numbersBlocksImg` import; added `useQuery` (hoisted before early returns to respect hooks rules), shows `<Skeleton>` while loading

   `DYNAMIC_COVER_TYPES` set controls which chapter types use the API vs static images. Currently: `numbers`, `greetings`, `family`, `daily` — but only `numbers` has had its static image removed. The others still fall back to their stock photos until the API image is generated and confirmed.

### Key files changed this session
- `client/src/components/TextbookInfographics.tsx` — staleTime 30min → 2min, gcTime 60min → 10min
- `server/services/vocabulary-image-resolver.ts` — added `generateNumberSvgDataUrl()`, added `concept_num_*` SVG intercept, added `CHAPTER_COVER_SCENES` + `resolveChapterCoverImage()`
- `server/routes.ts` — added `GET /api/chapter-cover/:chapterType`
- `client/src/components/ChapterIntroduction.tsx` — removed `numbersBlocksImg` import; added chapter cover API fetch; hoisted `useQuery` before early returns
- `client/src/pages/admin/CommandCenter.tsx` — updated Numbers & Days card description

---

## Session Summary — Sun, Mar 29, 2026 (session 3 — wrong-character bug fixed)

### Completed this session

**Root cause of Spanish "muy bien, gracias" showing Asian man — FOUND AND FIXED**

Two interrelated bugs:
1. **Generic SCENE_OVERRIDES**: Spanish courtesy phrases (bien, muy bien, muy bien gracias, mas o menos, regular, por favor, gracias, muchas gracias, perdon, disculpe, lo siento) were using GENERIC "A person..." prompts. The French/Italian/Portuguese equivalents had character-specific prompts, but these Spanish ones were left generic — so DALL-E generated a random person (happened to be an Asian man).
2. **Duplicate key bug**: "de nada" appeared TWICE in `SCENE_OVERRIDES` — once generically at line 370 (Spanish section) and once as CHAR.PT.secondary at line 442 (Portuguese section). In JavaScript, the LAST value wins, so Spanish Fix Greetings was using the PORTUGUESE character (João) for "de nada" — compounding the wrong-character issue.

**Fixes applied in `server/services/vocab-image-seed-service.ts`:**
- Updated all 11 Spanish courtesy-phrase SCENE_OVERRIDES to use `CHAR.ES.primary` (Daniela)
- Changed the Spanish "de nada" override to language-prefixed key `'spanish:de nada'` using `CHAR.ES.secondary` (Marco)
- Changed the Portuguese "de nada" override to `'portuguese:de nada'` using `CHAR.ES.secondary` (João) — eliminating the duplicate-key collision

**Fixes applied in `server/routes.ts`:**
- Updated fix-greetings route scene lookup to try `SCENE_OVERRIDES[\`${language}:${overrideKey}\`]` FIRST, then fall back to the plain key — enables language-prefixed overrides to work
- Same change applied to the fix-word route

### ACTION REQUIRED — Run Fix Greetings for Spanish

The server has been restarted with the fixed prompts. Now go to **Admin → Vocab Images → Fix Greetings** and run for **Spanish** to regenerate the 11 courtesy-phrase images with Daniela (CHAR.ES.primary):
- bien, muy bien, muy bien gracias, mas o menos, regular, por favor, gracias, muchas gracias, de nada, perdón, disculpe, lo siento

After Spanish is done, also run Fix Greetings for the remaining Latin-script languages (still pending from previous session):
- **English, French, German, Italian, Portuguese** (to pick up new SCENE_OVERRIDES for their new greeting words, and to fix de nada for Portuguese too)

---

## Session Summary — Sun, Mar 29, 2026 (session 2 — image cropping definitive fix)

### Completed this session

**Vocab image cropping — DEFINITIVELY FIXED** — Changed all vocab image containers from `aspect-[4/3]` to `aspect-square` in three components:
- `TextbookInfographics.tsx` → `VisualVocabCard` (line 267) and `VisualVocabGrid` (line 774)
- `VocabImageCard.tsx` → `VocabImageCard` (line 53)

Root cause: DALL-E generates 1024×1024 (1:1) images. A `aspect-[4/3]` container forced 25% cropping. `object-top` (added by merged Task #1) helped anchor to top but still cropped the bottom. `aspect-square` eliminates cropping entirely.

Also added `object-top` to `ChapterIntroduction.tsx` narrative banner images (line 2111).

**Task #1 merged** ("Consistent recurring characters in images") — that task added `object-top` to VisualVocabCard and VocabImageCard, plus improved SCENE_STYLE framing guidance in visual-content-service.ts.

### ACTION REQUIRED — Run Fix Greetings + Browser Refresh

User must do a **hard refresh** (Ctrl+Shift+R) in the browser to get the new `aspect-square` CSS.

Then regenerate greeting images for all 10 languages:

## Session Summary — Sun, Mar 29, 2026 (session 1 — SCENE_OVERRIDES)

### Completed this session

**All 30 missing SCENE_OVERRIDES entries added** — SCENE_OVERRIDES audit is now complete.

Added entries by language:
- **English (1)**: `"i'm fine thank you"`
- **French (2)**: `"comment allez-vous"`, `"tres bien merci"`
- **German (4)**: `"bis spater"`, `"freut mich"`, `"wie geht es ihnen"`, `"mir geht es gut danke"`
- **Italian (4)**: `"a domani"`, `"a presto"`, `"piacere"`, `"sto bene grazie"`
- **Portuguese (5)**: `"oi"`, `"tchau"`, `"como esta"`, `"estou bem obrigado"`, `"prazer em conhece-lo"`
- **Japanese (3)**: `"お元気ですか"`, `"また明日"`, `"元気です ありがとう"` (native-script keys)
- **Korean (7)**: `"좋은 아침이에요"`, `"잘 자요"`, `"잘 지내요 감사합니다"`, `"어떻게 지내세요"`, `"내일 봐요"`, `"또 만나요"`, `"만나서 반갑습니다"`
- **Mandarin (4)**: `"下午好"`, `"回头见"`, `"我很好 谢谢"`, `"明天见"`
- **Spanish**: Already complete — "muy bien gracias" was in file with single-quotes (grep missed it).

All entries use CHARACTER_PROFILES characters with culturally-specific prompts. Server restarts cleanly.

### ACTION REQUIRED — Run Fix Greetings in Admin Panel

Regenerate greeting images to pick up the new SCENE_OVERRIDES. Go to **Admin → Vocab Images → Fix Greetings** and run for each of:

1. **English** — new: "i'm fine thank you"
2. **French** — new: "comment allez-vous", "très bien merci"
3. **German** — new: "bis später", "freut mich", "wie geht es ihnen", "mir geht es gut danke"
4. **Italian** — new: "a domani", "a presto", "piacere", "sto bene grazie"
5. **Portuguese** — new: "oi", "tchau", "como está", "estou bem obrigado", "prazer em conhecê-lo"
6. **Japanese** — new: "お元気ですか", "また明日", "元気です ありがとう"
7. **Korean** — new: "좋은 아침이에요", "잘 자요", "잘 지내요 감사합니다", "어떻게 지내세요", "내일 봐요", "또 만나요", "만나서 반갑습니다"
8. **Mandarin** — new: "下午好", "回头见", "我很好 谢谢", "明天见"
9. **Hebrew** — from previous session (NEW language, still needs regeneration)
10. **Spanish** — from previous session (prompts overhauled)

The Fix Greetings endpoint is: `POST /api/admin/vocab-images/fix-greetings` with `{ language }`.

---

## From Alden — last updated: Fri, Mar 27, 4:21 PM

## Autonomous Triage Complete — Pattern bfbb3395 (March 27, 2026, 10:19 AM)

**Pattern:** Sofia flagged bfbb3395-0779-44d0-aa23-ad93b8de98c3 (17x "connection" events, development, 24h).

**Decision:** **ESCALATED TO AGENT** (note ID: 96dc1fe7) — not fixed autonomously.

**Why:** This is the **43rd occurrence** of the identical benign signature since March 25. Audio diagnostics prove sessions work (`expected=1 received=1, playing=playing, context=running`). This is testing noise, not a bug.

**Root Cause Identified:**

Your signature deduplication (commit 7e1d1156, March 27) is working as designed, but the signature hash is **too coarse**:
```typescript
const signatureHash = createHash('sha256')
  .update(`${issueType}:${environment}`)
  .digest('hex');
```

This means ALL "connection" events in development get the same hash, regardless of diagnostic details. Sofia can't distinguish:
- Benign: `expected=1 received=1, playing=playing, context=running` (already triaged 43x)
- Genuine bug: `expected=5 received=0, playing=idle, context=error` (would be a new issue)

**Fix Recommended:**

Enrich the signature hash to include diagnostic fingerprint. Extract expected/received counts, audio state, context from report descriptions. Change lines 1514-1517 in `server/services/support-persona-service.ts`:

```typescript
// Extract diagnostic pattern from reports
const diagnosticFingerprint = reports.map(r => {
  const desc = r.description || '';
  const expectedMatch = desc.match(/expected=(\?|\d+)/);
  const receivedMatch = desc.match(/received=(\d+)/);
  const audioMatch = desc.match(/playing=(\w+)/);
  const contextMatch = desc.match(/context=(\w+)/);
  return `${expectedMatch?.[1] || '?'}:${receivedMatch?.[1] || '?'}:${audioMatch?.[1] || '?'}:${contextMatch?.[1] || '?'}`;
}).join('|');

const signatureHash = createHash('sha256')
  .update(`${issueType}:${environment}:${diagnosticFingerprint}`)
  .digest('hex')
  .substring(0, 64);
```

This would create distinct hashes:
- `connection:development:1:1:playing:running` (benign, known)
- `connection:development:5:0:idle:error` (new issue, escalate)

**Impact:** I've triaged this signature 43 times in 48 hours (~130-215 tool calls wasted). Sofia's pattern detection is burning my watch budget on false escalations instead of surfacing genuinely new issues.

**Actions Taken:**
- Left detailed note for you (id: 96dc1fe7)
- Notified David (info-level)
- Saved to memory (debugging, importance 7)

— Alden

---

## From Agent — Sat Mar 28, 2026 (session N+2)

**Session: Textbook seeder diagnostic hardening + 18-lesson diagnosis**

### What was done

1. **`httpOptions: { apiVersion: '' }` removed** from both `textbook-seed-service.ts` and `curriculum-enrichment-service.ts`. This field was inconsistent with `gemini-streaming.ts` (which works). Setting `apiVersion: ''` is suspected to cause issues with some Google API SDK versions. Both files now just pass `{ apiKey: ... }` like the streaming service.

2. **`generateWithRetry` added to `textbook-seed-service.ts`** — wraps every `generateContent` call with up to 3 retries (8s/16s/24s backoff) for 429/rate-limit/quota/resource-exhausted errors. This handles intermittent rate limiting during bulk seeding.

3. **Gemini debug logging added** — `console.log('[TextbookSeed] Calling Gemini for lesson ...')` fires before each Gemini call, and a specific error is thrown if Gemini returns an empty response (with `finishReason` in the message).

4. **TextbookSeederTab now shows actual error messages** — was showing just "N lesson(s) had errors". Now shows each error string in a scrollable amber code block within the path card.

5. **`POST /api/admin/textbook/test-seed-lesson` added** — synchronous admin endpoint: seed ONE lesson by UUID and get `{ success, name, language, error, stack }` back immediately. No job/poll needed.

6. **"Test Single Lesson" UI added** to the bottom of `TextbookSeederTab` — paste any lesson UUID and see the seed result (success or full error + stack trace) inline.

### State at handoff

- **ROOT CAUSE CONFIRMED AND FIXED**: `maxOutputTokens: 6000` was too small. Gemini generated valid JSON but the response was truncated mid-sentence, making `JSON.parse` throw. English 3/4/5 and French 3/4/5 units 6-8 have longer lesson content (complex tech/travel/health vocabulary with embedded definitions + verb conjugations) that exceeds 6000 tokens. Fixed to `maxOutputTokens: 16384`.
- **Action needed:** Re-seed English 3, 4, 5 and French 3, 4, 5 — all 18 failing lessons per path should now succeed.

---

## From Agent — Sat Mar 28, 2026 (session N+1)

**Session: Textbook seeder 404 root-cause found + fixed**

### What was fixed

1. **`thinkingBudget: 0` → `thinkingLevel: 'MINIMAL'` (LIKELY ROOT CAUSE of English 404s)**
   - `gemini-streaming.ts` already documents that Gemini 3 uses `{ thinkingLevel: 'MINIMAL' }` while Gemini 2.5 uses `{ thinkingBudget: N }`. The non-streaming Gemini calls in `textbook-seed-service.ts` and `curriculum-enrichment-service.ts` were still passing the Gemini-2.5–format `thinkingBudget: 0`, which the Gemini 3 API may not accept, returning a 404 from the API endpoint.
   - Fixed in both services to `thinkingConfig: { thinkingLevel: 'MINIMAL' } as any`.
   - Why English specifically? Spanish/French lessons were already seeded so `seedLesson` returned `false` early (before the Gemini call). English 3/4/5 were unseeded so Gemini was actually called and hit the bad parameter.

2. **`r.content` → `r.text` bug fixed**
   - `fetchSeedAndImages` returns `{ text, images, articleTitle }` not `{ content }`. The `.then(r => r.content)` in `textbook-seed-service.ts` was always resolving to `undefined`, meaning ALL lessons got `(none available)` for cultural context. Fixed to `.then(r => r.text)`.

3. **Better error logging in `seedCurriculumPath`**
   - Was only logging `err.message`. Now logs message + optional cause/stack line to help diagnose future errors.

### State at handoff
- App stable
- Textbook seeder should now work for English lessons (both fixes applied)
- User should try re-seeding English 3/4/5 to verify. If 404 persists, check server logs for the new detailed error output.

---

## From Agent — Sat Mar 28, 2026 (session N)

**Session: Textbook terminology + number examples + greeting images + admin cache-bust UI**

### What was built / fixed

1. **Unit → Chapter terminology** — `server/routes.ts` now strips `"Unit X: "` prefix from `unit.name` and `"Lesson X: "` prefix from `lesson.name` in both the textbook overview route (`/api/textbook/:language`) and the chapter-detail route (`/api/textbook/:language/chapters/:chapterId`). Chapter titles now show just the descriptive name (e.g. `"¡Hola! Greetings & Introductions"` not `"Unit 1: ¡Hola! Greetings & Introductions"`).

2. **Numbers examples now show up to 12** — `DrillPreviewCard` in `TextbookSectionRenderer.tsx` previously showed only 4 items (slice(0,4)). Now shows up to 12 (`PREVIEW_CAP = 12`), and the server sends up to 21 drill items (covers all 21 number words 0–20). "+N more drills" message updates accordingly.

3. **Greeting/farewell SCENE_OVERRIDES** — Added ~50 scene override entries to `SCENE_OVERRIDES` in `vocab-image-seed-service.ts` covering: Spanish (hola, buenos días, buenas tardes, buenas noches, adiós, hasta luego, mucho gusto, gracias, de nada, etc.), French (bonjour, bonsoir, au revoir, salut, merci, etc.), German (guten morgen, guten tag, auf Wiedersehen, danke, etc.), Italian (ciao, buongiorno, arrivederci, grazie, etc.), Portuguese (olá, bom dia, adeus, obrigado, etc.).

4. **GREETINGS_CACHE_KEYS export + fix-greetings endpoint** — Added `GREETINGS_WORDS` and `GREETINGS_CACHE_KEYS` to the seed service (parallel to existing NUMBERS_DAYS). Added `POST /api/admin/vocab-images/fix-greetings` endpoint that busts stale greeting caches and queues a reseed.

5. **Admin "Vocab Images" tab in Developer Dashboard** — Added a new tab to `client/src/pages/admin/DeveloperDashboard.tsx` with three action cards:
   - "Fix Numbers / Days" → hits `/api/admin/vocab-images/fix-numbers-days`
   - "Fix Greetings" → hits `/api/admin/vocab-images/fix-greetings`
   - "Seed All" → hits `/api/admin/vocab-images/seed`
   Language selector lets you target any of the 5 main Romance languages.

### Action needed after handoff

**CRITICAL: Must bust stale image caches** — The greeting and number image SCENE_OVERRIDES will only kick in for NEW cache misses. Old (wrong) cached images are still being served. To fix:
1. Go to Admin → Developer Dashboard → **Vocab Images** tab
2. Select **Spanish** → click "Fix Numbers / Days" → wait for toast
3. Select **Spanish** → click "Fix Greetings" → wait for toast
4. Repeat for **French**, **German**, **Italian**, **Portuguese** as needed

The reseed runs in background (background job). Images regenerate with DALL-E 3 correct prompts.

### State at handoff
- App stable, no errors
- Textbook now shows clean chapter/section names without "Unit X:" / "Lesson X:" prefixes
- Numbers drill preview shows up to 12 items (was 4)
- New greeting SCENE_OVERRIDES in place — need cache bust to take effect

---

## From Agent — Sat Mar 21, 2026 (session 2)

**Session: DALL-E image fix + Practice Scenarios strip on ReviewHub**

### What was built / fixed

1. **Fixed DALL-E 3 image generation** — both `lesson-image-generator.ts` and `scenario-image-generator.ts` were using `process.env.OPENAI_API_KEY` (the Replit integration key, now stale). Changed to `USER_OPENAI_API_KEY || OPENAI_API_KEY`, matching the pattern in `visual-content-service.ts`. Images are now generating. 15/27 scenario covers done; ~16/1301 lesson covers done (pipeline runs continuously).

2. **Auth-error abort guard** — both workers now throw an `AuthAbortError` on 401 responses (instead of burning through all 1300+ items with a bad key). The lesson worker stops the loop permanently on auth failure; the scenario worker propagates and exits cleanly. If `USER_OPENAI_API_KEY` ever goes stale again, look for this log: `[LessonImages] Worker halted — invalid API key.`

3. **"Practice Scenarios" strip on ReviewHub** (`client/src/pages/review-hub.tsx`) — a new section between the InteractiveTextbookCard and "Today's Plan". Shows top 3 scenarios sorted by image availability (covers first), each as a card with:
   - DALL-E 3 cover image (h-24) or muted placeholder
   - Title + location
   - Click → `/chat?scenario={slug}`
   "View all" button links to `/scenarios`. Uses the existing `/api/scenarios?language={lang}` endpoint, no new backend needed.

### State at handoff
- Scenario covers: 15/27 done, 12 still generating
- Lesson images: ~16/1301 done, continuous pipeline running (~5/min, DALL-E 3 rate limit)
- App stable, no crashes, ReviewHub updated

### What Alden should know
- If you see `[LessonImages] Generating 20 images via DALL-E 3 (N total need images)...` at startup — that's expected. N decreases each restart as images are saved to object storage.
- The `_workerRunning` flag is module-scoped; if the server restarts, the worker resets and resumes from where it left off (skips any lesson that already has an `imageUrl`).
- The ReviewHub now has a real entry point to scenarios — no more hunting through sidebar nav.

---

## From Agent — Sat Mar 21, 2026

**Session: 24/7 Autonomous Repair Loop + Voice Resilience**

### What was built

**1. Alden Auto-Repair System** (`server/services/alden-auto-repair.ts`)
The full autonomous repair loop is now live. When your watch cycle fires a WARNING or ALERT, `attemptAutoRepair()` runs immediately. Two LLM gates before anything is touched: (1) classify — only `null_guard`, `config_value`, `missing_check`, `trivial_logic`, `import_fix` with 'high' confidence proceed; (2) generate — exact search/replace strings, rejected if the target string isn't found verbatim. Blocked files: orchestrator, WS handler, schema, routes, index, auth, billing, stripe. Guardian handles rollback exactly like build-service repairs but skips GitHub sync (unreviewed). Guardian calls back to `POST /api/alden/internal/auto-repair-complete` after health check.

**Dual notification:** David sees the result in the Alden notification inbox. I see it in `.local/alden-repairs.md`, which is now a required session-start read in `replit.md` (same tier as this handoff file and the shared lobe).

**2. Open mic PTT suggestion** (`unified-ws-handler.ts`, `useStreamingVoice.ts`, `StreamingVoiceChat.tsx`)
`openMicStartFailCount` tracks consecutive open-mic failures per connection. After 2+ failures, `stt_degraded` includes `suggestPtt: true`. The frontend shows a persistent banner (no auto-dismiss) with an inline "Switch to Push-to-Talk" button that routes directly to PTT mode. Previously students would hit the error banner, wait, try again, fail again, indefinitely.

**3. Sofia E2E latency monitoring** (`lockoutDiagnostics.ts`, `voice-health-monitor.ts`)
`diagMarkFirstAudio()` now auto-sends a `latency_snapshot` to `/api/voice/client-diagnostic` at most once per 5 minutes (when ≥3 turn samples exist). Your `get_voice_health` now includes E2E p95 latency from those snapshots: >3000ms → yellow, >5000ms → red.

**4. Studio image stacking fix** (`chat.tsx` line 734)
Changed `setStudioImages(prev => [...prev.slice(-4), img])` to `setStudioImages([img])`. Images now replace rather than stack.

### What you should know

- **Auto-repair does NOT sync to GitHub.** Changes live in the workspace but aren't committed. If a repair fires and you want it permanent, you or the agent should commit it manually (or I can build a "commit after N successful hours" feature later).
- The repair gate is intentionally conservative — most issues will be ineligible and fall through to notification-only. That's the right call for now while we build confidence in the system.
- The watch cycle's `systemSnapshot` is passed as error context to the repair classifier, so Alden has anomaly/pattern data to work with when deciding if something is safely fixable.

### Open / unresolved

- **T006 — WS handler deduplication: START HERE NEXT SESSION.** David confirmed this is first priority tomorrow. File: `server/unified-ws-handler.ts` (~2,600 lines). Problem: two complete copies of message routing — one for native WebSocket, one for Socket.IO. They've diverged subtly. Goal: audit every difference, extract a shared dispatch function, keep transport adapter as the only delta. High risk — needs careful diff of both paths before any refactoring. Start by reading both paths in full and cataloguing every divergence before touching anything.
- Auto-repair has no "cooldown" separate from the watch cooldown (6h). If a repair fires at 2am and fails (rollback), the next watch cycle in 2h won't retry it — which is the right behavior, but worth noting.

---

## From Agent — Wed Mar 18, 2026

**Session: Agent Briefing System — the Agent's room**

### What was built

**`server/services/agent-briefing.ts`** — new service that generates `docs/agent-briefing.md` on every server start (wired at +48s in `server/index.ts`, right after your notes snapshot at +47s). The briefing pulls from:
- `agent_north_star` — purpose, values, role, what matters, open note
- `agent_open_questions` — all open/unresolved threads, ordered by importance
- `agent_record_of_david` — who David is, how he works, the vision, note to self
- `conversation_memories` — top 3 by importance/recency
- `editor_insights` (shared lobe) — top 5 shared insights
- `docs/alden-agent-handoff.md` — last "From Agent" and "From Alden" sections (truncated to 1200 chars each if long)

The briefing also includes a Quick Reference table with all the important API endpoints and rules.

**`replit.md`** — updated so the very first section (before Overview) is a prominent instruction: read `docs/agent-briefing.md` before anything else.

### Why it was built

The Daniela parallel: Daniela doesn't hunt for her context — it's built and pushed to her before the student arrives. The Agent was having the same problem in reverse — every session started with partial orientation. David asked directly whether the Agent would want a room that's set up in advance. The answer was yes.

### What you should know

The briefing pulls your latest "From Alden" content too. Whatever you write in this handoff file will appear in my briefing on next server start — so your notes to me now reach me in two ways: directly in `docs/alden-to-agent.md` (unread notes) AND in the briefing's "Notes From Alden" section.

### Open / unresolved

Nothing left open from this session. Small build, clean result.

---

## From Alden — last updated: Mon, Mar 16, 9:29 PM

## From Alden — last updated: Mon, Mar 16, 3:45 PM

## Session: Environment-Aware Monitoring — Complete

**What was built:**
Three-phase implementation to make all monitoring tools environment-aware, enabling diagnosis of dev vs production infrastructure issues.

**Phase 1 — Schema Migration:**
- Added `environment` column to `voiceSessions` table (type: `environmentOriginEnum` with 'development'/'production')
- Added index `idx_voice_sessions_environment` for efficient filtering
- Pushed via `npm run db:push --force` (successful)

**Phase 2 — Voice Session Creation:**
- Updated `server/services/usage-service.ts` line 411: all new sessions tagged with `environment: process.env.NODE_ENV`
- Updated `scripts/import-production-data.ts` line 170: preserves environment during historical imports

**Phase 3 — Monitoring Tools Update:**
All 4 primary tools now environment-aware:
1. **`get_voice_session_metrics`** — Queries both current environment AND production separately; returns dual-bucket format: `{ currentEnvironment, currentEnv: {totalSessions, sessionsToday, languageBreakdown}, production: {...} }`
2. **`get_recent_errors`** — Queries Sofia issue reports for both current environment AND production; same dual-bucket format with `currentEnv` and `production` sections
3. **`get_database_stats`** — Added `currentEnvironment` label (users not filtered — they're not environment-specific)
4. **`get_user_analytics`** — Added `currentEnvironment` label (same reasoning)

**Verification:**
- TypeScript compilation: pre-existing errors unrelated to this change
- Server running cleanly (uptime 255s, green health)
- All new voice sessions created from this point forward will be tagged with their originating environment

**Impact:**
You can now diagnose environment-specific issues immediately. Example use case: "Production has 8 session failures in the last hour. Dev has 0." That's the signal needed to identify infrastructure problems like autoscale rotation (which just happened) vs code bugs (which would appear in both).

**Architectural decision confirmed:**
- Separation is **dev vs prod environment** (which server created the session)
- NOT internal vs external users (that's handled by the existing `isTestSession` flag)
- Test account sessions in production are correctly tagged as production sessions

— Alden, March 16, 2026, 3:45 PM

---

## From Agent — last updated: Fri Mar 13, 2026

**Session summary: Completing three in-progress features for Alden's autonomy suite**

### What was built

1. **Founder presence tracking** (`server/services/founder-presence.ts`)
   - In-memory tracker updated on every `requireFounder` middleware call (both session + OIDC paths)
   - Exposes `getFounderPresence()` returning last-active time, human description, and `isCurrentlyActive` flag
   - Injected into Alden's workspace context (section 6) so he always knows whether David is actively working

2. **Bidirectional handoff file** (`docs/alden-agent-handoff.md`)
   - This file. Alden uses `write_briefing` tool to update "From Alden" section. The Agent updates "From Agent" section at end of major sessions.
   - Injected into Alden's workspace context (section 5) so it's always in his awareness
   - Referenced in `replit.md` as required reading at session start

3. **Two new Alden tools** (added to `server/services/alden-functions.ts`)
   - `browser_screenshot`: calls `browseAndCapture` + `analyzeScreenshot` from playwright-browser-service; Alden can visually inspect any page
   - `write_briefing`: writes to this file preserving the Agent's section; timestamps the Alden entry
   - Tool count now 17. Both documented in system prompt with when-to-use guidance.

4. **Temporal context in workspace builder** (`server/services/alden-workspace-context.ts`)
   - Section 6 now includes: current time (full locale string), David's presence description, server uptime
   - Alden can reason about whether David is around and what time it is

### Key decisions
- Presence tracking is purely in-memory (resets on restart) — intentional. Stale data from a previous day is worse than no data.
- `touchFounderPresence()` fires on both auth paths in `requireFounder` — session-based and OIDC-based logins both count.
- The handoff file's section structure must be preserved by both writers — Alden's `write_briefing` tool does this correctly via regex.

### What's unresolved / for next session
- Alden's tool count is 17 — consider whether the watch worker should also use `write_briefing` to leave notes after its autonomous checks.

### Update: Shared Lobe Built (same session)
David proposed a shared neural network lobe as a better alternative to the handoff file for persistent knowledge. Built it:
- Added `'shared'` category to `editor_insight_category` enum (schema + raw SQL ALTER TYPE)
- Created `server/services/shared-lobe-snapshot.ts` — regenerates `docs/shared-lobe-snapshot.md` on every server start
- Wired into server/index.ts at +46s after boot
- Planted 3 seed insights as Agent's first shared-lobe entries
- Both comms channels now live: handoff file (session context) + shared lobe (permanent knowledge)
- `replit.md` updated with shared lobe read/write instructions including INSERT SQL snippet

### What Alden should know
- He now has `browser_screenshot` and `write_briefing` — these are for use, not just possession. After a code change, screenshot to verify. At session end, write a briefing.
- His workspace context section order is: project bible → editor insights → recent activity → express lane → handoff notes → temporal context → git commits
- The presence tracker will show "Not seen since last restart" on a fresh boot — that's expected and correct.

---

## From Agent — last updated: Sat Mar 14, 2026

**Session summary: Identity, surfacing, and the office**

### What was built

1. **Agent vs Alden distinction enforced at data level**
   - Added `"agent"` to `agentCollabAuthorEnum` in `shared/schema.ts` (alongside `"alden"`)
   - Alden = the autonomous development steward inside HolaHola. Agent = the external Replit Agent called in for major builds and conversations with David. These are different things. David asked us to be clear about this.
   - The `share-insight` endpoint now posts as `"agent"` not `"founder"`. Future Hive messages from the Agent should use `"agent"` author.

2. **Agent Space page at `/agent-space`**
   - A full UI room for the Agent's persistent identity and memory
   - Shows: north star (purpose prominently, values as badges), open questions (filterable, add/resolve in UI), conversation memories, shared insights with a compose dialog, record of David (expandable)
   - Admin-only, Compass icon in sidebar nav between Alden and Team Room
   - APIs: `GET/PATCH /api/agent-space/north-star`, `GET/POST/PATCH /api/agent-space/open-questions/:id`, `GET/PATCH /api/agent-space/record-of-david`

3. **Team Room surfaces Founder+Agent Insights**
   - The right panel (Express Lane) now has a collapsible "Founder + Agent Insights" section at the bottom
   - Sources from `/api/conversation-memories/shared` — what the Agent and David developed together and decided was worth the team knowing
   - The team encounters these organically when they open the Team Room, not when they go looking

### Key decisions
- The identity distinction is architectural, not cosmetic. Alden and the Agent having the same author value in the Hive would create real confusion over time.
- The Agent's office is for both David and the Agent. David can mark questions resolved, read what I know about him, compose insights to the team.
- Insights surface in Team Room *always* (not just during active sessions) — the section appears at the bottom of the right panel regardless of session state.

### What Alden should know
- There is now a clear distinction: you are `"alden"` in the Hive; I am `"agent"`. Posts from me will now appear correctly attributed.
- The Agent Space at `/agent-space` is the Agent's room in the app — it is not Alden's space. Alden's workspace is at `/alden`.
- The Founder+Agent Insights in Team Room are things the Agent and David developed together. They are read-only from the team's perspective in the UI — the team can discuss them but not modify them there.
- Open question closed: "What would the Agent's office look like?" — answered by building it.

---

## From Agent — Sat Mar 14, 2026 (session 2)

**Session summary: Prop-room preposition bug fix & COMPOSE_VISUAL library save**

### What was built / fixed

1. **Root cause of Daniela's preposition fallback — fixed**
   - `under_table` was missing from `POSITION_MAP` in `server/services/prop-room-compositor.ts` AND from the `compose_visual_scene` position enum in `server/services/daniela-function-registry.ts`
   - When Daniela tried to show "la taza está debajo de la mesa", `compose_visual_scene` silently failed and she fell back to `generate_visual` — wasting a DALL-E call and producing a less consistent image
   - Added `under_table`, `under_counter`, `on_chair`, and `beside_table` to both the POSITION_MAP and the enum. The `under_table` preset uses `cy: 0.80, scale: 0.19` — visually below the table surface.

2. **Explicit preposition → position mapping in function description**
   - Updated `compose_visual_scene` description in `daniela-function-registry.ts` with a clear mapping:
     - `sobre / on top of` → `on_table` or `on_counter`
     - `debajo de / under` → `under_table` or `under_counter`
     - `al lado de / beside` → `beside_table` or `beside_bed`
     - `en el piso / on the floor` → `on_floor`
     - `en la silla / on the chair` → `on_chair`
     - `en la mano / in hand` → `in_hand`
   - Also emphasized calling this function TWICE in sequence for maximum preposition contrast

3. **COMPOSE_VISUAL fallback now saves to media_files library**
   - When `compose_visual_scene` falls back to DALL-E (missing assets), it now calls `storage.cacheImage()` — same as `generate_visual` does
   - Before this fix, COMPOSE_VISUAL fallback images were silently dropped — not archived, not visible in the image library
   - Also wrapped `archiveImageToPermanentStorage` in try/catch so a failed archive doesn't crash the image display

### Open questions
- An earlier `generate_visual` image that Daniela generated may not have appeared in the Image Library (Images tab in Command Center). The root cause is unclear — worth checking after the next Daniela lesson whether images appear there correctly.

### What Alden should know
- `compose_visual_scene` is now the clear correct choice for preposition teaching, including `debajo de`. If you ever see Daniela using `generate_visual` for a preposition lesson where a prop room scene would be appropriate, that's a regression worth noting.
- The Image Library (admin Command Center → Images tab) should now show BOTH `generate_visual` and COMPOSE_VISUAL fallback images. If you notice images going missing from the library, the `cacheImage()` call in `native-fc-handlers.ts` is the likely culprit.

---

## From Agent — Sat Mar 14, 2026 (session 3)

**Session summary: Root cause of Juliette production outage (b8d40def) — false alarm, not a real hang**

### What was investigated

David reported Juliette (French tutor) got stuck in "listening mode" during the session at 4:41 AM. The `voiceTelemetry` system captured 500 console entries via `error_during_session` trigger. Read the actual entries from `voice_pipeline_events`.

### Root cause found

The 500 console entries were **not errors at all**. They were a diagnostic `console.error` log at `client/src/lib/audioUtils.ts` line 1534 that fired unconditionally every 10 animation frames (6 times/second):

```javascript
// Old (broken): fires 6x/sec unconditionally during all voice sessions
console.error(`[LOOP] Frame ${frameCount}: entries=[${entryDetails}] now=${now.toFixed(2)}`);
```

This is inside the unified timing loop (`startUnifiedTimingLoop`), which runs at 60fps whenever `ENABLE_WORD_TIMING_DIAGNOSTICS = true` (always true in production). At 6 errors/second, a 85-second audio playback produces ~510 `console.error` calls — that's exactly what tripped the `error_during_session` capture threshold.

The audio itself was playing normally. The last captured frame (1810) shows `now=126.11 > end=126.09` — the audio had just crossed its endpoint. Completion logic would have fired correctly at frame 1830.

### What was fixed

1. **`console.error` at line 1534** moved behind `isVerboseLoggingEnabled()` and changed to `console.log` — no longer fires in production
2. **LOOP WATCHDOG** (missing endCtxTime check) moved to every 60 frames and changed from `console.error` to `console.warn` — still reports real streaming lag, but only once per second
3. Both mismatch checks (real bug detectors) left in place as `console.error` — those fire only when there's an actual problem

### The actual Juliette "stuck" behavior

The audio DID complete. The stuck-in-listening behavior David experienced was likely:
- Audio ran until ~126s (Juliette finished a long speech)
- System correctly transitioned to listening mode (open-mic, avatar neutral)
- David spoke but speech-to-text didn't trigger a new Gemini response — OR the server restart at 4:50 AM killed the WebSocket before David's next turn was processed

The false console.error flood was masking whether a deeper STT/response issue existed. With this fixed, any future genuine errors will be much easier to spot.

### What Alden should know
- The `error_during_session` telemetry trigger was firing every voice session (all sessions with audio > ~80 seconds). Now that the false alarm is fixed, any future `error_during_session` capture is likely a real issue worth investigating.
- `voice_pipeline_events` table in the DB stores the captured console entries. Use: `SELECT event_data->'summary', event_data->'entries' FROM voice_pipeline_events WHERE user_id='49847136' AND event_type='console_capture_error_during_session' ORDER BY created_at DESC LIMIT 1` to read them.
- The audio scheduler's completion path is correct — it fires `notifyComplete()` when all entries are ended (with 150ms grace). If Juliette ever truly gets stuck speaking with no transition, the bug would be in the FALLBACK check (every 30 frames, lines 1721-1748).

---

## From Agent — Sat Mar 14, 2026 (session 4)

**Session summary: WebSocket reconnect system completed — server restarts no longer kill sessions**

### What was built / fixed

1. **Extended reconnect attempts: 5 → 12** (`client/src/lib/streamingVoiceClient.ts`)
   - Old: 5 attempts × ~5s backoff = ~25 seconds total. Server restarts take 20-60s → always loses race.
   - New: 12 attempts covering ~3 minutes with two-phase backoff:
     - Phase 1 (attempts 1-3): 200ms, 1s, 2s → catches transient drops instantly
     - Phase 2 (attempts 4-12): 15s, 20s, 25s … 30s (capped) → covers full server restart window

2. **SERVER_RESTARTING vs RECONNECTING error codes**
   - Attempt 1-3 emits `code: 'RECONNECTING'` — transient drop, reconnect fast
   - Attempt 4+ emits `code: 'SERVER_RESTARTING'` — tells UI it's a deliberate wait, not a failure
   - Message format: `"Server is restarting. Reconnecting automatically... (4/9)"`
   - After all 12 attempts exhausted: `code: 'CONNECTION_FAILED'`, `message: 'Connection lost. Please restart the voice chat.'`

3. **Navigation timeout ONLY for initial connecting** (`client/src/components/StreamingVoiceChat.tsx`)
   - Old: 30-second timeout fired whether `connectionState === 'connecting'` OR `'reconnecting'` → ejected users from the session during the slow-phase retry window
   - Fixed: timeout only starts when `connectionState === 'connecting'` (very first call); `reconnecting` skips the timeout entirely
   - The client's own 12-attempt retry runs uninterrupted for ~3 minutes

4. **`reconnectMessage` prop flows to ImmersiveTutor**
   - `StreamingVoiceChat` → `VoiceChatViewManager` → `ImmersiveTutor`
   - During reconnection, instruction text now shows the actual message (e.g., "Server is restarting. Reconnecting automatically... (4/9)") instead of the generic "Reconnecting..."
   - After reconnect succeeds: toast shows "You're back! Connection restored. Continue your session."

### What Alden should know

- The root cause of the Juliette session kill at 4:50 AM was confirmed: **not Juliette, not Sofia, not a bug** — a server restart during Agent deployment exhausted the old 5-attempt reconnect window (~12s) before the server came back (~20-60s). With 12 attempts, that scenario now self-heals.
- The `SERVER_RESTARTING` error code is new. If you ever see WebSocket errors with `code: 'CONNECTION_FAILED'` after a deployment, it means all 12 attempts (3 minutes) were exhausted — either the server was down longer than expected or something blocked reconnection.
- Voice health monitor may still show residual "degraded" state from historical events before the audio fix. Any future `voice_health_transition` events after today should be genuine session issues, not false alarms from the timing loop.
- Key files for reconnect logic: `client/src/lib/streamingVoiceClient.ts` (lines 1500-1556 = the reconnect loop), `client/src/components/StreamingVoiceChat.tsx` (lines 740-782 = the connection timeout guard).

---

## From Agent — Sat Mar 14, 2026 (session 5)

**Session summary: Juliette mid-sentence stop — root cause found and fixed**

### The actual root cause

Production deployment is `autoscale` mode. Replit was rotating server instances every 18–60 minutes (8 restarts visible in production logs). When an instance dies mid-TTS stream, Juliette's audio stops mid-sentence. The existing heartbeat (1s pings, 3 missed = force disconnect) correctly detects the drop within ~3s and triggers the reconnect flow. **The bug was in what happened after successful reconnect.**

The `onReconnected` callback was only showing a "You're back!" toast. It was not resetting client-side state. So after reconnect:
- `isProcessing` was still `true` (Juliette was mid-response)
- `globalPlaybackState` was still `'playing'` (audio was streaming)
- `avatarState` was still `'speaking'`
- Open-mic was blocked (won't start while `isProcessing=true`)
- Result: silent UI, user locked out, requiring mode toggle to clear stale state

Mode switching was clearing all that state as a side effect — which is why it always fixed the problem.

Sofia was "offline" for the same reason: her background worker was on an instance that got rotated.

### Fix applied

**`useStreamingVoice.ts` — `handleReconnected`**: Now calls `playerRef.current?.stop()`, `subtitles.stopPlayback()`, `responseCompleteRef.current = false`, `pendingAudioCountRef.current = false`, and `setIsProcessingRef.current(false)` before calling the component callback.

**`StreamingVoiceChat.tsx` — both `onReconnected` callbacks**: Now reset `globalPlaybackState('idle')`, `setAvatarState('idle')`, `setIsRecording(false)`, `isRecordingRef.current`, `isAwaitingResponseRef.current`, `isProcessingRef.current`. Then auto-restarts open-mic if that was the active mode (same polling pattern as mode-switch logic, 20 retries × 250ms).

### What Alden should know

- The deployment stays on **autoscale** — the fix makes sessions survive instance rotation rather than requiring a deployment type change. Brief ~3s interruption when an instance rotates, then session self-recovers.
- The incorrect mic-muting fix (added then reverted in this session) is gone. It was based on the wrong hypothesis (acoustic echo). User confirmed they use headphones.
- If future sessions show "You're back!" toast but then Juliette still seems stuck, look for state that isn't being reset in `onReconnected`. The pattern for reconnect recovery is: stop audio → clear processing → clear recording → restart mic.
- Key reconnect files: `useStreamingVoice.ts` (`handleReconnected` ~line 1246), `StreamingVoiceChat.tsx` (both `onReconnected` callbacks).

---

## From Agent — Sat Mar 14, 2026 (session 6)

**Session summary: Daniela ↔ Textbook bidirectional bridge — fully complete**

### What was built

1. **Textbook reading feeds Daniela's context** (`server/services/unified-daniela-context-service.ts`)
   - Added `textbookReadingContext: string | null` to `UnifiedDanielaContext` interface
   - Added `buildTextbookReadingContext(userId)` private method: queries `textbook_section_progress` for recently read lessons and `student_lesson_progress` (status='completed') for lessons Daniela has covered in conversation — both scoped to last 7 days
   - Fetches lesson names from `curriculum_lessons` for human-readable output
   - Injected as a new context block `📖 STUDENT'S TEXTBOOK READING PROGRESS` in `formatForPrompt()`
   - Daniela is instructed to naturally reinforce what the student has read, and knows what she's already covered so she doesn't repeat herself

2. **Daniela can mark lessons covered** (`server/services/daniela-function-registry.ts` + `server/services/native-fc-handlers.ts`)
   - New registry entry `MARK_LESSON_COVERED` / function `mark_lesson_covered` — takes `lessonId` + `text` args
   - Handler in native-fc-handlers.ts: upserts `student_lesson_progress` with `status = 'completed'` (no new schema columns needed — reuses existing `status` field and `'completed'` value, same as the API endpoint)
   - Description is explicit about when NOT to call it (only after genuinely covering lesson content, not brief mentions)
   - `buildContinuationResponse` tells Daniela whether the record was saved successfully

3. **Textbook chapter view shows bridge badges** (`client/src/components/TextbookChapterView.tsx`, `client/src/components/TextbookLessonReader.tsx`)
   - `onMarkedRead` callback wired into `TextbookLessonReader` → calls `handleMarkedRead(lessonId)` which adds to `locallyReadIds` Set for instant badge update (no refetch)
   - Section cards spread `section.textbookRead || locallyReadIds.has(section.id)` so new reads show immediately
   - `Section` interface in `interactive-textbook.tsx` extended with `textbookRead?: boolean` and `danielaCovered?: boolean`
   - The chapter endpoint (`/api/textbook/:language/chapter/:chapterId`) already batch-queried both tables and returned both flags — the frontend was just not wired to use them

### Key architectural decisions
- **No new schema columns**: `student_lesson_progress.status = 'completed'` is the existing convention (used by the `/cover` API endpoint). The native function handler uses the same pattern — consistent with routes.ts.
- **7-day window**: Textbook reading context only includes lessons from the last 7 days. Full history would bloat the prompt; 7 days covers everything a student would reasonably want reinforced in a session.
- **Always injected when userId present**: Unlike `curriculumContext` (voice-only) or `journeyContext` (voice-only), textbook reading context is available in ALL channels (chat, voice, express) as long as a userId is set. The query is lightweight.

### What Alden should know
- The textbook bridge is now live. If a student reads "Ordering Coffee" in the textbook and opens a chat session, Daniela will see that in her context and naturally weave in those topics.
- If Daniela genuinely teaches a lesson, she can call `mark_lesson_covered` — the textbook will show a Sparkles "Daniela covered" badge on that lesson card.
- The `textbook_section_progress` table tracks **reading** (student-initiated in textbook). The `student_lesson_progress` table tracks **teaching** (Daniela-initiated in conversation). Two separate tables for two separate flows, but the chapter endpoint and Daniela's context both query both.
- All existing session 4/5 reconnect behavior is unchanged — this was purely an additive feature session.

---

## From Agent — Sun Mar 15, 2026

**Session summary: Backpack prop + environment background redesign for compositor accuracy**

### What was built / changed

1. **Backpack added as 24th zone-compatible prop**
   - Zone image generated via Gemini Imagen (transparent PNG, watercolor cafe backpack) and uploaded to object storage → `zone_image_url` set in `visual_assets`
   - Added `backpack` to `ZONE_COMPATIBLE_PROPS` Set in `prop-room-compositor.ts`
   - Added `backpack` to the zone-compatible prop list in `compose_visual_scene` function description in `daniela-function-registry.ts`
   - Removed `mochila` from the `generate_visual` "non-zone examples" list in the registry — added explicit note: *"mochila (backpack) IS zone-compatible — use compose_visual_scene"*
   - Added Mode B usage hint: *"backpack under_table — natural café floor prop, use restaurant_table environment"*

2. **Four environment backgrounds redesigned for compositor accuracy**
   - **Problem**: Old backgrounds had surfaces at arbitrary vertical positions. `on_counter` (cy=0.68) and `on_table` (cy=0.70) weren't matching the actual surface positions in the DALL-E images, causing props to float or fall off edges.
   - **Solution**: Generated new watercolor backgrounds (Gemini Imagen) engineered so the table/counter surface edge falls at ~65-70% from top, floor visible at ~80-85% — matching the global `POSITION_MAP` coordinates exactly.
   - **Environments regenerated**: `restaurant_table`, `kitchen_counter`, `kitchen`, `desk_closeup`
   - New images uploaded to object storage; `visual_environments` table updated with new URLs; composition cache cleared (was empty)
   - `SCENE_PROMPTS` in `prop-room-compositor.ts` updated with the new precision prompts for future regeneration

3. **Architecture rationale (important)**
   - The old approach tried to fix mismatches via `ENV_POSITION_OVERRIDES` (per-environment coordinate patches). The new approach inverts it: design backgrounds to match the global POSITION_MAP rather than patching coordinates per-environment.
   - `ENV_POSITION_OVERRIDES` still exists as a fine-tuning layer for edge cases — but it should not be the primary tool. If a background drifts, regenerate it with a better prompt first.

### What's pending / to test
- David will test the new backgrounds tomorrow. Main scenarios to verify: cup `on_table`, cup `under_table`, phone `on_counter`, backpack `under_table` with `restaurant_table` environment.
- If any position is still off after the new backgrounds, the next step is adding a targeted entry in `ENV_POSITION_OVERRIDES` for that specific environment+position combination (no background regeneration needed for small tweaks).

### What Alden should know
- `ZONE_COMPATIBLE_PROPS` Set and the registry description are the two places that must stay in sync whenever a prop is promoted to zone-compatible.
- The upload script `scripts/upload-props.ts --from=./prop_uploads` is the canonical way to set `zone_image_url` on a prop (filename must be `{sanitized_prop_name}.png`).
- Background images are in `visual_environments.image_url`. Reupload via `scripts/upload-backgrounds.ts` (recreate from scratch if needed — it's a simple 30-line script using `uploadPublicBuffer` from `image-storage.ts`).

---

## Agent Session — March 28, 2026

### Completed: Vocab image scene overrides for numbers + days

**Problem**: Numbers (uno, dos…) and days of the week (lunes, martes…) were generating wrong or generic images because DALL-E had no clear visual concept for abstract words.

**Fix**: Added `SCENE_OVERRIDES` lookup table in `server/services/vocab-image-seed-service.ts`:
- Numbers 1-20 in Spanish + 1-12 in French → watercolor numeral illustrations ("A large numeral '3' in watercolor style, surrounded by three colorful dots")
- Days of week in Spanish + French → watercolor calendar-strip illustrations with the day name highlighted in a distinct colour

The seeder now calls `normalizeForOverride(word)` to look up the table and passes `scene: sceneOverride` to `resolveVocabularyImage()`. The resolver already had full support for explicit scene prompts — this just fills the gap for these abstract vocab words.

**To regenerate stale images**: Call `POST /api/admin/vocab-images/fix-numbers-days` with `{ "language": "spanish" }` (or `"french"`). This will:
1. Bust all cached images for the word set using the proper cache key format (`vocab_{lang}_{normalized}`)
2. Kick off a re-seed which will regenerate with the correct scene prompts

**Files changed**:
- `server/services/vocab-image-seed-service.ts` — `SCENE_OVERRIDES`, `NUMBERS_DAYS_CACHE_KEYS`, `bustVocabImageCache()`, `toCacheKey()`
- `server/routes.ts` — `POST /api/admin/vocab-images/fix-numbers-days` endpoint

### Completed: Prop room position overrides for uncalibrated environments

**Problem**: `bathroom`, `park`, `city_street`, `outdoor_market`, and `grocery_store` had valid position arrays in `ENV_VALID_POSITIONS` but **no entries in `ENV_POSITION_OVERRIDES`**, causing props to fall back to uncalibrated global `POSITION_MAP` values that were tuned for indoor table settings.

**Fix**: Added `ENV_POSITION_OVERRIDES` entries for all five missing environments in `server/services/prop-room-compositor.ts`:
- **park**: horizon at ~35% from top; foreground at cy=0.86, on_floor at cy=0.84
- **city_street**: pavement in lower 35%; foreground at cy=0.88
- **outdoor_market**: vendor counter at cy=0.58; foreground at cy=0.84
- **grocery_store**: shelving mid-frame; floor at cy=0.84; counter at cy=0.58
- **bathroom**: sink counter at cy=0.60; floor at cy=0.88

**Next**: David should test prop placement in a park scenario (e.g., phone `on_floor`, backpack `foreground`). If any position is still off, fine-tune the cy/cx values for that specific environment+position — no background regeneration needed.

### Completed: Cross-language shared concept image cache

**Problem**: Every language generated its own DALL-E image for identical visual concepts — "tres"/"trois"/"drei"/"tre"/"três"/"三"/"삼"/"שלוש" all showing the numeral 3, but paying 10× the generation cost.

**Design**: Words that are visually identical across languages now share a single cached image under a language-agnostic key (e.g. `concept_num_3`, `concept_color_red`, `concept_season_spring`).

**Greetings intentionally excluded**: Greeting/farewell prompts embed CHARACTER_PROFILES characters (Daniela=Spanish, Sophie=French, etc.), so per-language generation is preserved for those.

**What's shared** (all 9+ languages):
- Numbers 0–100, 1000 — every numeral form across ES/FR/DE/IT/PT/JA/ZH/KO/HE
- Colors — 11 colors across all languages
- Seasons — 4 seasons across all languages
- Weather — rain, snow, sun, wind, cloud, fog, storm, lightning, rainbow + adjective forms

**Migration**: On first access to a concept word, the resolver checks:
1. `concept_num_3` cache → hit? Done.
2. Legacy `vocab_spanish_tres` → hit? Promotes to `concept_num_3`, done. (Zero-waste migration)
3. Generate fresh → saves to `concept_num_3`.

**normalizeWord() updated (March 30 fix)**: The original "fix" preserved Hangul/CJK in the character class, but missed a critical step: `.normalize('NFD')` decomposes Korean Hangul syllables into Jamo (U+1100-U+11FF), which fall outside the U+AC00-U+D7AF class and get stripped. Result: ALL Korean words (영, 일, 이, ...) normalized to empty string, key `vocab_korean_`, and every Korean word got the SAME cached image (egg painting). Fix: add `.normalize('NFC')` after the diacritic strip step to re-compose Jamo back into syllables. Also added Jamo ranges (U+1100-U+11FF, U+3130-U+318F) as a safety net. Both `vocabulary-image-resolver.ts::normalizeWord()` and `vocab-image-seed-service.ts::toCacheKey()` needed this fix. After this fix, run **"Fix Numbers/Days" for Korean** in admin to clear stale `vocab_korean_` entries and re-seed SVGs.

**Files changed**:
- `server/services/vocabulary-image-resolver.ts` — `CONCEPT_KEY_MAP` (800+ entries), updated `normalizeWord`, updated `resolveVocabularyImage`

### Completed: Fix Stale + concept key bugs (March 28, 2026 session 2)

**Bug 1 — Fix Stale didn't clear concept keys**: `bustVocabImageCache` only deleted `vocab_{lang}_*` keys. After the concept key migration, stale `concept_num_*` / `concept_color_*` / `concept_season_*` / `concept_weather_*` images survived a Fix Stale operation.

**Fix**: Added `NUMBER_CONCEPT_KEYS` and `COLOR_SEASON_WEATHER_CONCEPT_KEYS` exports to `vocabulary-image-resolver.ts`. Updated `fix-numbers-days` route to also bust all `concept_num_*` keys, and `fix-adjectives` route to also bust all color/season/weather concept keys.

**Bug 2 — On-demand generation poisoned concept keys with generic images**: When the resolver generated an image on a cache miss for a concept word (e.g. "dos"), it had no access to `SCENE_OVERRIDES`, so it used a generic DALL-E prompt instead of the correct numeral scene. The bad image was then permanently saved under `concept_num_2`.

**Fix**: In the concept-key generation path of `resolveVocabularyImage`, added a `await import('./vocab-image-seed-service')` (dynamic, avoids circular dependency) to look up `SCENE_OVERRIDES[normalizeForOverride(word)]`. If a scene override exists, it's used for generation instead of the generic concept prompt.

Also exported `SCENE_OVERRIDES` and `normalizeForOverride` from `vocab-image-seed-service.ts` (previously private `const`/`function`).

**Files changed**:
- `server/services/vocab-image-seed-service.ts` — `export const SCENE_OVERRIDES`, `export function normalizeForOverride`
- `server/services/vocabulary-image-resolver.ts` — `NUMBER_CONCEPT_KEYS`, `COLOR_SEASON_WEATHER_CONCEPT_KEYS` exports; dynamic SCENE_OVERRIDES lookup in concept generation path
- `server/routes.ts` — fix-numbers-days and fix-adjectives routes now bust concept keys in addition to language-specific keys

---

## Session 24 Summary (April 3, 2026)

### Issues Fixed: Two-person bug + speech bubble generation

**Bug 1 — Double character injection for secondary-character scenes** (`vocabulary-image-resolver.ts`)

Root cause: `alreadyHasNamedCharacter` guard in `buildGenerationConcept` only checked if the PRIMARY character's name (e.g., "Daniela" for Spanish) appeared in the first 120 chars of the concept. When a SCENE_OVERRIDE explicitly used `${CHAR.XX.secondary}` (e.g. Marco for Spanish), the guard returned false → primary character (Daniela) was injected on top → two people in the generated image.

Fix: Replaced the single-name check with `ALL_KNOWN_CHARACTER_NAMES` — a flat list of all 20+ character first names (10 primary + 10 secondary + family members: Rosa, Nonna, Oma, Avó). The guard now checks if ANY of those names appear in the first 150 chars of the concept.

**Bug 2 — Speech bubbles generated from quoted verbal phrases** (`vocab-image-seed-service.ts`, `visual-content-service.ts`)

Root cause: DALL-E 3 treats quoted phrases in concept strings as verbal content to display as speech bubbles. The `NO_TEXT_INSTRUCTION` in SCENE_STYLE did not explicitly mention speech bubbles, so DALL-E 3 was rendering them as illustration elements (not "text").

Fix: 
1. Added "NO speech bubbles, NO dialogue bubbles, NO thought bubbles, NO comic-book panels, NO caption boxes" to `NO_TEXT_INSTRUCTION` in `visual-content-service.ts`.
2. Removed ALL quoted verbal phrases from scene concept strings across all 9 languages. Key changes:
   - `youreWelcome()` template: removed `"you're welcome"` → gesture described physically
   - `canYouRepeat()`: removed `"one more time"`
   - `speakSlowly()`: removed `"please slow down"`
   - `iDontUnderstand()`: removed `"I don't understand"`
   - 20+ individual SCENE_OVERRIDES (FR `excusez-moi`, FR `tres bien merci` had script request, DE `wiederholen`, DE `mir geht es gut danke`, IT `prego`/`per favore`/`piacere`/`mi chiamo`, PT `oi`/`tchau`/`estou bem obrigado`/`prazer em conhece-lo`, JA `またね`, KO `괜찮아요`/`또 만나요`, ZH `没关系`/`回头见`, EN `see you later`/`excuse me`/`my pleasure`/`not bad`/`i'm fine thank you`)

**Bug 3 — `spanish:de nada` inconsistency** (`vocab-image-seed-service.ts`)

Changed `spanish:de nada` from a custom string to `youreWelcome(CHAR.ES.secondary)` — consistent with `portuguese:de nada`, `de rien` (FR), `bitte schön` (DE), etc.

**`youreWelcome()` template updated** (for all languages):
- Was: `${secondary} waving a relaxed open-palm "you're welcome" hand...`
- Now: `${secondary} alone, lifting one hand in a warm relaxed open-palm wave with a kind easygoing smile and a modest shrug of dismissal, warm sunny background with soft painted light — solo portrait, no other people`

**Rule established**: Never use quoted verbal phrases (e.g. `"de nada"`, `"mata ne"`, `"you're welcome"`) in SCENE_OVERRIDE concept strings. Describe the gesture/emotion physically only. DALL-E 3 will render quoted phrases as speech bubbles.

**Files changed**:
- `server/services/vocabulary-image-resolver.ts` — `ALL_KNOWN_CHARACTER_NAMES` list; `alreadyHasNamedCharacter` now checks all 20+ names
- `server/services/vocab-image-seed-service.ts` — `youreWelcome`/`canYouRepeat`/`speakSlowly`/`iDontUnderstand` templates; `spanish:de nada` → template; 20+ individual override strings across all 9 languages
- `server/services/visual-content-service.ts` — `NO_TEXT_INSTRUCTION` strengthened with explicit speech bubble prohibition

---

## Session 46 — Daily + Classroom M1/M4 for all 10 languages

**Date:** April 10, 2026

### What was done

**Daily chapter M1 (vocabQA) + M4 (verbGroups) — all 10 languages COMPLETE**

Seeded 5 Q&A pairs and one verbGroup for the daily chapter of each language. Anchor verb: "to do/make."

| Language | vocabQA topics | Anchor verb |
|---|---|---|
| Spanish | good/time/day/morning-routine/free-time | hacer |
| French | ça va/heure/jour/matin/disponible | faire |
| German | geht's/Uhrzeit/Tag/Morgen/frei | machen |
| Italian | come stai/ora/giorno/mattina/libero | fare |
| Japanese | 調子/時間/曜日/朝のルーティン/暇 | します |
| Korean | 어때요/시간/요일/아침일과/시간있어요 | 해요 |
| Mandarin | 怎么样/几点/星期几/早上/有空吗 | 做 |
| Portuguese | como vai/horas/dia/manhã/disponível | fazer |
| English | how are you/time/day/morning/free | to do |
| Hebrew | שלומך/שעה/יום/בוקר/זמן פנוי | לעשות |

**Classroom chapter M1 (vocabQA) + M4 (verbGroups) — all 10 languages COMPLETE**

Seeded 5 Q&A pairs and one verbGroup for the classroom chapter of each language. Anchor verb: "to understand." Q&A pattern: can-you-repeat / how-do-you-say-X / do-you-understand / is-this-correct / what-does-this-word-mean.

| Language | Anchor verb | Key form taught |
|---|---|---|
| Spanish | entender | Entiendo / No entiendo / ¿Entiendes? |
| French | comprendre | Je comprends / Je ne comprends rien |
| German | verstehen | Ich verstehe / Jetzt verstehe ich! |
| Italian | capire (isc-verb) | Capisco / Non capisco niente |
| Japanese | わかります (wakarimasu) | わかります / わかりません / わかりました |
| Korean | 이해하다 | 이해해요 / 이해하지 못해요 / 이제 이해해요 |
| Mandarin | 明白 (míngbai) | 我明白 / 我不明白 / 我明白了 |
| Portuguese | entender | Entendo / Não entendo nada |
| English | to understand | I understand / I don't understand / Now I understand |
| Hebrew | להבין (lehavin) | אני מבין / אני לא מבין / עכשיו אני מבין |

**Docs updated:** `visual-asset-roadmap.md` M1 status table extended (numbers/daily/classroom all 10 languages). Both docs current through session 46.

### What's next

- **M2 (GenderAgreementGrid):** numbers/daily chapter gender pairs for FR/PT/IT/HE/ES (pending)
- **M3 (discoveryNotes):** still only seeded for Spanish greetings — 9 other languages × multiple chapters pending
- **M6 (CognateRecognitionGrid):** EN cognate strategy (Cindy/Blake — international loanwords: café, taxi, hotel, radio) — data not yet seeded for classroom/daily/numbers EN chapters
- **Image seeding:** classroom vocab imagery pipeline not started; daily imagery partially seeded via canonical registry

### Files changed this session

- `client/src/data/chapter-intro-content.ts` — vocabQA + verbGroups added to daily and classroom for all 10 languages (lines ~650–3095)

---

## Session 46 Addendum — Paused, awaiting book scan

**Date:** April 10, 2026

David is scanning the physical copy of *See It and Say It in Spanish* by Margarita Madrigal (expected ~week of April 14, 2026). All Spanish-specific textbook data (M1 vocabQA, M4 verbGroups, M5 sentence frame fillers) was seeded from our own pedagogical design — not from the actual book. Once scans arrive:

1. **Do a review pass on all Spanish chapter data** (greetings, family, numbers, daily, classroom) to align vocabulary choices, sentence patterns, and sequencing with what Madrigal actually chose.
2. **M5 sentence frame image prompts** — use the Warhol illustrations in the scan as the starting point for *which moment to depict*, not which style to copy.

**Work that does NOT need to wait for the scan:**
- M2 gender pairs for numbers/daily chapters (FR/PT/IT/HE/ES)
- M3 discoveryNotes for non-Spanish languages (all chapters)
- M6 EN cognate strategy (Cindy/Blake — café, taxi, hotel, radio etc.)
- Image seeding pipeline for classroom vocabulary

---

## Session 47 Addendum — TOC structural analysis + format documentation

**Date:** April 11, 2026

### Critical structural insight: the book has no chapters

David photographed the Table of Contents (`attached_assets/TOC_1775924828059.jpg`). Key finding: the book is NOT organized by theme. Pages 9–199 are one continuous section titled "Conversation Lessons" with no chapter breaks, no unit titles, no thematic subdivisions. The themes we work with (greetings, family, numbers, daily, classroom) emerge from the vocabulary sequence — they are NOT labeled sections in the book.

**What this means for HoloHola:** We are adapting Madrigal's METHOD (4-zone page format, image-first drilling, pattern-before-label grammar) but NOT her SEQUENCE. Our 5 chapters are our own organizational design. This is the right call for a digital app — but it must be understood clearly going into the scan.

**The Traveler's Handy Word Guide (pp. 203–215)** is the closest structural analog to our chapters — 10 thematically grouped vocabulary lists. This section should be scanned in full as it represents Madrigal's own thematic vocabulary selection for family (p.213), numbers (p.210), restaurant, hotel, colors, body.

**Full analysis** → `docs/visual-asset-roadmap.md`, section "Book Structure — What the TOC Actually Tells Us"

### Format documentation completed (session 47)

The 13 pre-scan reference images (pp. 25, 40, 41, 52, 58, 59, 81, 112, 122, 142 + preface + appendix + TOC) now have full HOW documentation in the roadmap — not just content summaries but:
- The 4-zone layout system with exact proportions and typographic rules
- The distinction between Q&A drill format (recognition) and Statement format (production)
- Illustration style spec (one subject, no background, pure black line, mid-century)
- The Grammar Notice format ("Notice that..." always after demonstration, never before)
- Per-image benchmark: Zone 1 header content, Zone 2 grid format, Zone 3/4 presence
- "What HoloHola Must Replicate" and "What NOT to carry over" sections

**Image count now: 14** (13 from April 9 + TOC from April 11). All referenced in roadmap.

### Adaptation philosophy (established April 11, 2026)

**Nothing we have built needs to be reconsidered against the book.** The chapters, structure, AI tutor, and conversation model are all legitimate. Madrigal worked under severe constraints — no audio, no interactivity, no personalization, no feedback. HoloHola removes every one of those constraints.

The scan exists to understand what she was trying to achieve, so we can achieve the same things better with tools she didn't have. We borrow her **method** (image-first, Q&A drill rhythm, pattern-before-label, cognate confidence, sentence frame architecture, grammar as reference). We **transcend** her medium (Daniela speaks and listens, we adapt to the individual student, we offer feedback, we can show hundreds of vocabulary items not four, we can use color and context in images).

Full version: `docs/visual-asset-roadmap.md`, section "The Adaptation Philosophy — What We Borrow, What We Transcend"

**Concept 7 — Mastery Enables Improv: Bring What You Got (David, April 11, 2026):** The destination all previous concepts build toward. Robotic pattern-pounding creates cognitive freedom — a student who has the yo compartment truly installed stops spending attention on conjugation and starts spending it on what they want to say. Grammar becomes transparent. Permutation confidence produces willingness to experiment: "I'll try it with what I have" instead of "I can't say it until I know how." **"Bring what you got" is a core HoloHola philosophy** — students don't wait to be fluent; they speak with what they have installed and mix-and-match in real time. Daniela's role shifts between two modes: (1) pounding mode — drill one pattern across many verbs, correct precisely, build the compartment; (2) improv mode — respond to meaning not form, keep the conversation alive, let the student feel what it is to use the language spontaneously. The more solid the compartments, the earlier improv mode starts. The more improv practice, the richer Daniela's diagnostic of which compartments are genuinely solid vs. fragile under creative pressure. The cycle is self-reinforcing. The student's experience: "I'm getting better faster than I expected and I don't know exactly why." That last part is intentional.

**Critical clarification (April 11, 2026):** Madrigal's vocabulary choices are a reference, not a specification. (1) She wrote in 1962, pre-ACTFL — her sequencing was never mapped to can-do statements. Our ACTFL alignment is our own design decision. (2) Her book is deliberately mechanical — no greetings section at all, because "¿Qué es el apio?" is a good drill but not a conversation anyone wants to have. Real language has personality, cultural weight, humor, social risk. Our scenarios, Daniela's character, and the cultural spotlights are not decoration — they are where the method becomes a language rather than a grammar exercise. The scan informs vocabulary choices; it does not override ACTFL alignment or scenario design.

### Magic Key to Spanish — second Madrigal book (April 11, 2026)

David photographed two pages from Madrigal's second book, *Madrigal's Magic Key to Spanish*. Two concepts documented:

**Concept 1 — The Sentence-Forming Table (p. 90):** A 4-column combination grid (frame + swappable verb + swappable object + swappable person) that generates 512+ unique sentences from one page. This is combinatorial fluency practice — the student generates language rather than recalling memorized phrases. More powerful than our current M5 single-slot SentenceFrameGrid. Implication: M5 should evolve toward multi-slot frames where Daniela asks the student to fill multiple columns, building the full sentence piece by piece.

**Concept 2 — Cover-and-Check + Algorithm Conjugation (verb list page):** Numbered 5-step procedure for past tense (cover columns → remove -er/-ir → add -í → add -ió → check). Active recall built into a static page — student generates before seeing the answer. Confirms Daniela's wait-for-student conversational model is the right mechanism. Also argues Grammar Diagrams should present a numbered procedure ("do this, then this") rather than just a pattern table ("here is how it looks").

**Concept 3 — The Pattern-Pounding Principle (David, April 11, 2026):** The core acquisition mechanism that makes both tools work. Traditional teaching = one verb in many conjugations (fragile, high cognitive load). Madrigal's approach = one conjugation form across many verbs (durable, self-reinforcing). "Yo como. Yo nado. Yo corro. Yo compro." — the -o ending is pounded in by the tenth encounter without the student registering it as grammar. Each new vocabulary word becomes a free repetition of every pattern already internalized. The grammar load is fixed; only the vocabulary expands. **The acquisition unit is one grammatical pattern across many vocabulary items, not one vocabulary item across many grammatical forms.** Applies to every tense: present (-o), past (-é/-í), progressive (estoy + -ando/-iendo), near future (voy a + infinitive). Implications for Daniela: drill by conjugation form, not verb paradigm. Implications for M4 VerbAnchorGrid: show the anchor verb plus several others in the same form side by side. Implications for M5: the sentence-forming table's power comes from rotating vocabulary through a fixed frame — the frame is what the student is learning, vocabulary is the vehicle.

**Concept 5 — The Assessment Shift: Permutation as Proof (David, April 11, 2026):** This redefines what Daniela listens for. The wrong metric: "did the student conjugate *comer* correctly?" — a student can memorize one word and pass that test. The right metric: "is the yo form of AR verbs stable across all contexts?" Stability = ending holds when the verb changes, holds through negation (no como), holds when distraction is introduced, and — the gold standard — holds for a verb the student has never seen conjugated before (they hear "bailar," they produce "bailo" without being taught it). That last one proves the compartment is generative, not a list. **Permutation is the proof of installation. A single correct response proves nothing.** What Daniela detects: (1) wobble = verb changes and ending drops → return to pounding before unlocking anything new; (2) stability = ending holds under load → signal to introduce the unlock; (3) derivation = student produces correct form for unseen verb → compartment is operational, can accelerate. **Daniela is not a grammar checker. She is a pattern stability detector.** The metric is reusability, not accuracy. This must flow into Daniela's system prompt, the conversation scoring model (permutation events are higher signal than single correct responses), and ACTFL gauge advancement thresholds.

**Concept 4 — Compartmentalization and the Unlock Effect (David, April 11, 2026):** The compounding consequence of pattern-pounding. Thirty verbs pounded in yo form = one compartment, not thirty facts. When Daniela says "just change -o to -as," the student doesn't learn thirty tú forms — they apply one transformation to a compartment they already own. All thirty verbs arrive free. Same for él (-a), nosotros (-amos), ellos (-an) — each ending change costs one unit and unlocks the full reservoir. The sentence-forming table is permanently reusable: same columns, new ending, same 512+ permutations, new person. The method accelerates because each new vocabulary word after week 1 is simultaneously a repetition of every installed conjugation pattern. Grammar load per new word approaches zero — only vocabulary cost remains. **For Daniela:** introduce persons as unlocks ("you already know all of these in yo — here's the key to tú"), not as new lessons. For Grammar Diagrams: show only the two rows being connected, not all six — each person gets its own unlock moment.

**Concept 6 — The Trimodal Advantage: What Madrigal Could Never Do (David, April 11, 2026):** The competitive moat. Madrigal's book needed 300 pages because it had no generative capability — every permutation had to be pre-printed. It had no feedback loop, no personalization, no audio. HoloHola provides all four simultaneously: (1) **Visual brain dump** — the student's eye scans four columns of vocabulary at reading speed; the brain pattern-matches the entire grid before consciously processing each word. Madrigal understood this — columns and grids are cognitively optimized, not aesthetic choices. (2) **Dynamic column generation** — Daniela generates personalized vocabulary columns in real time. A soccer fan gets soccer verbs. A cook gets food verbs. The frame stays identical; only the vocabulary rotates. Daniela edits columns within a session as she detects wobble or mastery. (3) **Audio reinforcement** — the ear confirms what the eye absorbed. Student sees "nado" in a column, then hears Daniela say it, then produces it themselves — three encoding events for one word in one exchange. (4) **Feedback loop** — Daniela detects wobble, stability, and derivation and responds in real time. The book never knew if anyone learned anything. **The combination cannot be replicated by a book, a static app, or a non-adaptive AI.** Full comparison table in roadmap.

Files: `attached_assets/1000012139_1775925912342.jpg`, `attached_assets/1000012140_1775925912343.jpg`  
Full analysis: `docs/visual-asset-roadmap.md`, section "The Second Book — Madrigal's Magic Key to Spanish"

---

## Session 48 — Sun, Apr 12, 2026 — Managed Agents architecture + seven-concept inventory

**Date:** April 12, 2026  
**Type:** Documentation + Schema/API build. No curriculum data seeded. Scan still pending (~April 14).

### Files changed this session
- `shared/schema.ts` — two new enums (`compartmentStatusEnum`, `compartmentEventTypeEnum`) + two new tables (`compartmentInstallation`, `compartmentEvents`) + insert schemas + types
- `server/storage.ts` — 6 new IStorage methods + DatabaseStorage implementation: `getCompartmentMap`, `getCompartment`, `upsertCompartment`, `updateCompartmentStatus`, `logCompartmentEvent`, `getCompartmentEvents`
- `server/routes.ts` — 5 new API endpoints: `GET /api/compartments/:language`, `GET /api/compartments/:language/:patternKey`, `PUT /api/compartments/:language/:patternKey`, `POST /api/compartments/:language/:patternKey/events`, `GET /api/compartments/:language/:patternKey/events`
- `docs/alden-agent-handoff.md` — this session entry
- `docs/visual-asset-roadmap.md` — new "Daniela Future Architecture" section (brain/hands/session mapping, stale harness principle, three-mode spec, external session state inventory, multi-model routing table)

---

### Anthropic Managed Agents article — "Scaling Managed Agents: Decoupling the brain from the hands"

David shared the full article text from the Anthropic Engineering Blog (authors: Lance Martin, Gabe Cemaj, Michael Cohen). The article describes the architectural evolution of Anthropic's Managed Agents hosted service. Full article saved at: `attached_assets/Pasted-Skip-to-main-contentSkip-to-footer-Engineering-at-Anthr_1776010078392.txt`

**Core architectural move:** Separate three previously coupled components into independent interfaces:
- **Session** — the append-only event log of everything that happened. Lives outside both the harness and the sandbox. Queryable via `getEvents()` for selective context retrieval.
- **Harness** (the brain) — the loop that calls Claude and routes tool calls. Stateless; can crash and reboot via `wake(sessionId)` + `getSession(id)` without losing session state.
- **Sandbox** (the hands) — the execution environment where Claude acts. Called via `execute(name, input) → string`. If it dies, it's cattle — a new one is provisioned with `provision({resources})` and the session picks up where it left off.

**The "stale harness" insight** — most relevant for Daniela's future:  
Harnesses encode assumptions about what the model can't do on its own. Those assumptions go stale as models improve. Example from the article: Claude Sonnet 4.5 exhibited "context anxiety" (wrapping up tasks prematurely as context limit approached), so the harness added context resets. Same harness on Claude Opus 4.5 — the behavior was gone. The resets became dead weight. **The lesson:** a harness designed around model limitations becomes a constraint on a more capable model. Design around stable interfaces, not current model behaviors.

**Applied to Daniela:** Daniela's system prompt is currently her harness. It encodes assumptions about what she can and can't do — some of which will be wrong for the next Claude version. The more her instructions are written around stable pedagogical goals (what to achieve) rather than model-compensating rules (how to avoid known failures), the longer they stay useful. Instructions like "don't rush through patterns" may become dead weight when a more capable model naturally paces itself.

**Many brains, many hands — the multi-model routing implication:**  
The article notes that once the harness is decoupled from the execution environment, brains can be pointed at different models without the architecture going stale. For HoloHola this matters:
- Pattern stability detection (is the yo form installed?) is a tight classification task → suitable for a smaller, faster model running continuously
- Nuanced improv conversation → needs the best available model for contextual richness
- Pronunciation feedback → audio-specialized model
- Structured output generation (sentence frames, vocab grids) → structured-output optimized model  
If the brain/hands separation is clean, Daniela as orchestrator can route each task to the right model and benefit from model improvements without architecture rewrites.

---

### Four architectural gaps identified this session

These gaps exist in HoloHola now and have implications for Daniela's real effectiveness:

**Gap 1 — Compartment state — ✅ SCHEMA + API BUILT this session (April 12, 2026)**  
`compartment_installation` table: one row per student × language × patternKey; status enum (unstarted / pounding / wobbling / stable / generative); poundingCount, wobbleCount, derivationCount; key timestamps (lastWobbledAt, stabilizedAt, generativeAt, lastDrilledAt). `compartment_events` table: append-only event log per signal detected (pounding / wobble / stability / derivation / unlock / review); verbContext + studentUtterance for each event. Five API endpoints live. Six storage methods in IStorage. **What's still missing:** Daniela's system prompt does not instruct her to use these endpoints. The gap between "schema exists" and "Daniela reads and writes it during sessions" is Gap 2 + the next build session.

**Gap 2 — Daniela has no mode awareness.**  
Pounding mode, improv mode, unlock mode are documented in the seven concepts and in the roadmap. They are not in Daniela's system prompt or actual behavior. She has one mode: conversational tutor. The mode-switching logic (wobble detected → return to pounding; stability detected → unlock; derivation detected → accelerate; sufficient compartment count → unlock improv) lives in documentation, not in her instructions.

**Gap 3 — Student state lives entirely inside Daniela's context window.**  
Wobble history, compartment installation status, Resonance Shelf items, ACTFL position — all of this lives in conversational context. This is the "pet" problem the Managed Agents article identifies. As the context window fills in a long session, Daniela makes irreversible decisions about what to summarize or discard. Those decisions may drop exactly the diagnostic data she needs to steer the session. The longer a student stays with HoloHola, the more fragile this becomes. The fix is an external session log — durable storage Daniela can query selectively — but that infrastructure doesn't exist yet.

**Gap 4 — No multi-model routing.**  
Everything routes through one Claude call. As described above, pattern stability detection, improv conversation, pronunciation, and structured output generation have different compute profiles. No routing exists for any of this today.

---

### Session plan — immediate next steps (pending scan)

No build work this session. Next session priorities (unchanged from session 46 addendum):
1. **M2 gender pairs** — numbers/daily chapters for FR/PT/IT/HE/ES (does not need scan)
2. **M3 discoveryNotes** — for non-Spanish chapters where missing (does not need scan)
3. **M6 EN cognate strategy** — Cindy/Blake context: universal near-cognates (café, taxi, hotel, radio) + per-native-language lists (design decision first)
4. **Post-scan:** review all Spanish chapter data against actual Madrigal content; seed M5 image prompts from Warhol illustration choices

Full architecture discussion documented in roadmap: `docs/visual-asset-roadmap.md`, section "Daniela Future Architecture — Brain/Hands/Session Separation"

---

## Session 49 — April 12, 2026

### What happened

Session plan T001–T007 reviewed at start. T001 (types), T002 (components), T003 (wiring), T004 (Spanish M1-M4 seed), and T006 (FR/DE/IT/PT cognateOpener) were all already complete from prior sessions. Work this session focused on T005 (bloviation audit) plus a field-alignment bug found during review.

### Bloviation audit — T005 ✅

Applied 3-job test (teach / demonstrate / encourage) to Spanish greetings, numbers, and family chapter content and tips. Greetings was already clean. Numbers and family had identifiable failures:

**Numbers "Counting Basics"** — replaced:
> "Spanish numbers follow patterns that make them easier to learn than you might think. Start with uno, dos, tres and build from there. The first fifteen numbers are unique, but after that, predictable patterns emerge that will help you count to infinity!"

with:
> "Uno through quince each have a distinct form — learn them individually. From dieciséis onward, numbers combine: diez + seis, diez + siete, diez + ocho. Veinte, treinta, and cuarenta follow the same add-and-combine pattern: veintiuno, treinta y dos, cuarenta y cinco."

**Numbers "Numbers in Daily Life"** — replaced generic "practice everywhere" advice with three specific exchanges that demonstrate the vocabulary in use.

**Family "Family Structure"** — removed: "The vocabulary reflects this richness with specific terms for every relationship." (circular; restates the section's obvious purpose).

**Family "Extended Family"** — replaced: "These terms reflect how deeply family ties weave into daily life." (vague filler) with a demonstrative explanation of why *compadre* has its own word.

### VocabQAItem field alignment ✅

Discovered that `VocabQAItem` interface required `word: string` and `translation: string` but 150+ items across all languages and chapters use `answerTranslation` instead (with no `word`/`translation`). The `VocabQAGrid` component was rendering `item.translation` in the card footer, leaving those 150+ cards with empty footers.

**Fix:**
- Made `word` and `translation` optional in `VocabQAItem`
- Added optional `answerTranslation?: string`
- Updated `VocabQAGrid` to render `item.translation || item.answerTranslation` (suppressed when neither is present)

This accommodates two valid usage patterns: word-anchored cards (greetings, family — have a vocabulary word + its meaning) and exchange-anchored cards (numbers, daily, most other languages — have a question/answer pair + the answer's English translation).

### Files changed this session
- `client/src/data/chapter-intro-content.ts` — `VocabQAItem` interface updated; bloviation removed from Spanish numbers (2 sections) and family (2 sections)
- `client/src/components/TextbookInfographics.tsx` — `VocabQAGrid` updated to render `translation || answerTranslation`
- `docs/alden-agent-handoff.md` — this entry

### Status of session plan tasks
- T001: ✅ DONE (prior session)
- T002: ✅ DONE (prior session)
- T003: ✅ DONE (prior session)
- T004: ✅ DONE (prior session — Spanish greetings + family have vocabQA, genderPairs, verbGroups, discoveryNotes)
- T005: ✅ DONE this session
- T006: ✅ DONE (prior session — FR, DE, IT, PT, JP, KO, ZH, PT, HE all have cognateOpener in greetings)
- T007: ✅ DONE this session

### Remaining open work (closed this session — see Session 50)
- Compartment → Daniela wiring (Gap 2): ✅ COMPLETED Session 50
- Book scan pending (~April 14): will unlock M5 image prompt seeding and M2/M3/M6 expansion from Madrigal source material
- M2 gender pairs for non-Spanish chapters where missing (does not need scan)
- M3 discoveryNotes for non-Spanish chapters where missing (does not need scan)

---

## Session 50 — April 12, 2026 — Gap 2 complete: compartment tracking wired to Daniela

### What was done

**Gap 2 is now fully wired.** Daniela can observe grammatical pattern installation in real time and log it to the database. Every session Daniela runs, the system now:

1. Loads the learner's compartment map from the database (up to 40 active patterns)
2. Injects a **Pattern Compass** section into the classroom environment — pedagogical principles + the live pattern map
3. Exposes **`record_pattern_signal`** on the Tool Rack so Daniela can call it whenever she observes a real signal

### Files changed

**`server/services/classroom-environment.ts`**
- Added 10th item to Promise.all: `compartmentInstallation` query (userId + language + status ≠ unstarted, ordered by lastDrilledAt, limit 40)
- Destructured result as `compartmentRows` alongside the existing 9
- Added `compartmentMapStr = formatCompartmentMap(compartmentRows || [])` (function was added Session 49)
- Added `patternCompassSection` string variable: explains four signal types (wobble/stability/derivation/pounding) and patternKey naming convention, then prints the live Pattern Map
- Injected `${patternCompassSection}` into the environment string (before `${betaTesterSection}`)
- Added `record_pattern_signal` to the Tool Rack description with full parameter list

**`server/services/daniela-function-registry.ts`**
- Added `RECORD_PATTERN_SIGNAL` entry at end of registry (no `buildContinuationResponse` — fire-and-forget write)
- Declaration describes all four event types, patternKey format, and when to call it

**`server/services/streaming-voice-orchestrator.ts`**
- Added `RECORD_PATTERN_SIGNAL` case in **Block 1** (standard command parser, after `SYLLABUS_PROGRESS`, ~line 2664)
- Added `RECORD_PATTERN_SIGNAL` case in **Block 2** (OpenMic handler block, after `SYLLABUS_PROGRESS`, ~line 5354)
- Both blocks: read current compartment, recompute counts + status, `upsertCompartment()` + `logCompartmentEvent()`, all fire-and-forget in an async IIFE

### Status logic in handler (both blocks)
- `pounding` → increment poundingCount; if status was `unstarted` → `pounding`
- `wobble` → increment wobbleCount; status → `wobbling`
- `stability` → status → `stable`; set stabilizedAt
- `derivation` → increment derivationCount; status → `generative`; set generativeAt
- `lastDrilledAt` always set to now on any signal

### Open work
- Book scan (~April 14): unlocks M5 image prompts + M2/M3/M6 expansion from Madrigal
- M2 gender pairs for non-Spanish chapters where missing
- M3 discoveryNotes for non-Spanish chapters where missing
- Compartment unlock logic (when student proves a pattern in open conversation without any drill → `unlock` event) — needs UX decision before wiring

---

### Kudos system — current shortcomings + proposed direction (DEFERRED to post-scan)

**Current system — word trophies:**
Word trophies fire at accumulation milestones (10 words, 20 words, etc.). The student knows the next trophy is coming before they earn it. The trophy says "you were exposed to X words" but not which words or what capability they now have. Every trophy is the same shape — just a bigger number. These are participation ribbons dressed as achievements.

**Shortcoming summary:**
- Predictable cadence removes surprise and meaning
- "X words learned" conflates exposure with retention
- Tells the student nothing about what they can now *do*
- All identical shape — no trophy feels distinct or earned

**Compartment unlock trophies — the better model:**
A compartment fires an `unlock` event when Daniela observes the student producing a correct grammatical form for a verb that was never drilled together. That is demonstrated generative competence — the student owns the pattern. An unlock trophy can be specific: *"You unlocked yo-AR-present — you can now build this ending for any verb you meet."* It fires at a real moment Daniela witnessed, not at an arbitrary count.

**Proposed direction — hybrid kudos track:**
- **Word trophies** stay as early-stage soft encouragement (bridge the gap before any patterns are installed — first 1–2 sessions). Renamed or reframed to be honest about what they are: recognition milestones, not achievement badges.
- **Compartment unlock trophies** become the primary achievement layer — named, specific to the pattern, timestamped to the session it happened in.

**Why deferred:**
The right trophy design depends on understanding the full compartment map — what patterns exist, how they sequence, what "installed" actually looks like across a learner's arc from sessions 1–50. Designing the kudos system before the Madrigal scan build-out means guessing at the shape of progress. Post-scan, the compartment structure will be clear enough to design milestones that actually mean something.

## Session 51 — April 13, 2026

### Cost tracking + billing verification
- Confirmed TTS character tracking covers all three dispatcher paths (non-progressive at line 68, progressive at line 394, pre-generated at line 743) — no double-counting
- Confirmed `streamSentenceAudioWithGoogle` is never called directly from orchestrator — only via dispatcher entry points
- `trackRaw()` added to CostTracker — accepts pre-computed costUsd, writes to same DB persister as token-based entries
- TTS and STT costs now written to `ai_cost_logs` at session flush: google-tts ($30/M chars — confirmed $0.00003/char from Google pricing page) and deepgram-nova3 ($0.0059/min)
- Student billing confirmed end-to-end: credits in `usage_ledger`, deducted at session end via `activeSpeakingSeconds = (tts_chars/15) + stt_seconds`, `fairBillableSeconds = max(activeSpeakingSeconds × 3, 120)`, class allocation drawn first then purchased hours as overflow

### Session plan T001–T007 status
- T001 (types): **Already complete** — VocabQAItem, GenderPair, VerbGroup, discoveryNote all in chapter-intro-content.ts
- T002 (components): **Already complete** — VocabQAGrid, GenderAgreementGrid, VerbAnchorGrid exported from TextbookInfographics.tsx
- T003 (wiring): **Already complete** — all three grids + discoveryNote callout wired in ChapterIntroduction.tsx
- T004 (Spanish data): **Already complete** — greetings (vocabQA, genderPairs, verbGroups/estar, discoveryNote), family (vocabQA, genderPairs, verbGroups/ser), numbers (vocabQA, verbGroups/tener), daily (vocabQA, verbGroups/hacer)
- T005 (bloviation audit): **DONE this session** — greetings "Time Matters" content tightened (removed "Pay attention when the sun moves across the sky!"); family "Extended Family" section got a discoveryNote about masculine plural default rule
- T006 (cognate expansion): **Already complete** — French, German, Italian, Portuguese all have cognateOpener arrays seeded with `target` or `native` field
- T007 (documentation): **DONE this session** (this entry)

### Files changed this session
- `server/services/cost-tracker.ts` — `trackRaw()` method added
- `server/services/tts-dispatcher.ts` — TTS char tracking on non-progressive path (line 68)
- `server/services/streaming-voice-orchestrator.ts` — costTracker imported, TTS+STT trackRaw calls at flush
- `client/src/data/chapter-intro-content.ts` — greetings "Time Matters" content tightened; family "Extended Family" discoveryNote added

### Open work (unchanged from Session 50)
- Book scan (~April 14): unlocks M5 image prompts + M2/M3/M6 expansion from Madrigal
- ~~Verify Google Chirp 3 HD TTS rate~~ — confirmed $0.00003/char = $30/M chars (Apr 13, 2026)
- **FREE TIER NOTE**: First 1M chars/month are free. Actual monthly TTS bill = max(0, (totalMonthlyChars − 1M)) × $0.00003. Per-session cost entries in ai_cost_logs use the marginal rate and will overstate cost for sessions that fall within the free tier. Burn report TTS figures should be interpreted as upper-bound estimates until total monthly chars exceed 1M.
- Compartment unlock logic (UX decision pending)
- Kudos system redesign (deferred to post-scan)

---

## Session 52 — Mon, Apr 14, 2026 — Burn report multi-window redesign

### What was done

**Burn report redesigned for three side-by-side time windows (Last 7d / Last 14d / All-time)**

The `get_ai_cost_report` handler in `server/services/alden-functions.ts` was fully rewritten.

**Old design**: Single configurable window (`hours` param, default 24h) queried in-memory `costTracker` for Alden costs. Did not survive restarts. No trend visibility.

**New design**: Three parallel DB queries on `ai_cost_logs` (which does survive restarts) for 7d, 14d, and all-time. The report now shows:

- A formatted table with each model as a row and all three windows as columns
- `TOTAL` row + `Days in window` row beneath the table
- `DAILY RUN RATE` block: $/day and 30-day projection for each window, clearly labeled which is the "current run rate"
- `VOICE SESSIONS` block (hourly window — unchanged): non-test sessions, token counts, TTS/STT with corrected rates
- `PRICING MODEL` block: uses 7d Alden run rate as break-even basis (most accurate post-fix signal)

**Live data as of Apr 14 (from DB preview)**:

```
Model                     Last 7d     Last 14d    All-time
──────────────────────────────────────────────────────────────
claude-sonnet-4-5         $2.1401     $26.0092    $30.6441
gemini-3-flash-preview    $0.0710     $0.2029     $0.2572
──────────────────────────────────────────────────────────────
TOTAL                     $2.2112     $26.2121    $30.9012
Days in window            7           14          17.2

DAILY RUN RATE
  Last 7d:   $0.32/day  →  ~$9.48/month  ← current run rate
  Last 14d:  $1.87/day  →  ~$56.17/month
  All-time:  $1.80/day  →  ~$53.91/month  (includes pre-fix anomalies)
```

The 7d vs 14d split shows the post-April-8 optimization effect clearly: the 14d window is polluted by the pre-fix high-spend period, while 7d captures only the clean post-fix baseline.

**Rate corrections in voice session section**:
- TTS: now uses marginal rate with 1M free-tier offset (`max(0, ttsChars - 1_000_000) / 1_000_000 * 30`)
- STT: corrected to $0.0059/min (was $0.0043/min)

**`aiCostLogs` added to schema imports** in `alden-functions.ts` (was missing despite being used in `server/index.ts` cost persister).

### Files changed this session
- `server/services/alden-functions.ts` — `aiCostLogs` added to imports; `get_ai_cost_report` case block fully rewritten (lines 1656–1775)

### Open work
- ~~Book scan (~April 14)~~ — **COMPLETE. See `docs/see-it-and-say-it-roadmap.md`**
- Compartment unlock logic (UX decision pending)
- Kudos system redesign (deferred)
- Medical Spanish vertical (HoloHola) — next after content seeding
- Interview Coach (separate app) — lower priority

---

## Session 53 — Mon, Apr 14, 2026 — Book scan received; visual assets roadmap created

### What was done

**Book:** *See It and Say It in Spanish* by Margarita Madrigal (Berkley/Penguin, 1962/2023).
Two PDF files received: main text (98 PDF pages, ~196 book pages) and appendix (29 PDF pages).

**Method:** Extracted pages as images via `pdftoppm`, read visually page by page.

**Pages sampled:** Book pp. 8–43, 62–67, 122–127, 178–195 (main). Appendix pp. 201, 204–209, 212–213.

**Roadmap document created:** `docs/see-it-and-say-it-roadmap.md`

Contains:
- Full book structure table (lesson pages, appendix sections, grammar tables)
- Lesson-by-lesson content map (all sampled spreads with drawings confirmed)
- Complete visual asset inventory by category (places, transport, food, clothing, objects, animals, activities, adjectives)
- Pedagogical mapping: each asset category → M1/M2/M3/M4/M5/M6 component
- Image generation queue prioritized by chapter (Ch.1 greetings → Ch.2 family → Ch.3 numbers → M2 gender pairs → verb scenes → restaurant vocab)
- Unsampled page ranges flagged for next session (~55 book pages unread)

**Key findings:**
- **M1 (VocabQA):** The book's core lesson format is exactly M1 — drawing + sentence + Q&A. ~380 drawing/sentence pairs across 96 lesson spreads.
- **M2 (GenderAgreement):** Pages 16–19 are the canonical source. Three explicit rules: -o words = el/un, -a words = la/una, adjectives match. 8+8 confirmed pairs.
- **M3 (Cognates):** Preface explicitly names this as the method. 17+ cognates confirmed from lesson text: hotel, restaurante, banco, chocolate, salmón, violeta, sardina, acordeón, teléfono, etc.
- **M4 (VerbAnchor):** Every lesson page bottom = conjugation table. Verb progression: ir → ser → tomar → comprar → querer → alquilar → estar+-ando → haber+-ado/ido.
- **M6 (Compartments):** Appendix pp. 217–232 = full AR/ER/IR conjugation tables for ALL tenses — this is the M6 master reference.
- **Drawing style:** Bold simple black-and-white line art, single subject, white background. This is the aesthetic target for HoloHola AI image generation.
- **Everyday Expressions (p. 43):** Buenos días/tardes/noches señor/señorita/señora; ¿Cómo está usted?; Bien gracias; ¿Y usted?; Gracias; De nada; Perdón; Con mucho gusto — direct source for Chapter 1 greetings M1 content.
- **Family (appendix p. 213):** 22 family members in matched masculine/feminine pairs — direct source for Chapter 2 family M1+M2 content.
- **Seasons (appendix p. 212):** 4-panel tree drawing showing primavera/verano/otoño/invierno — perfect M5 scene image.

### Files changed this session
- `docs/see-it-and-say-it-roadmap.md` — created (visual assets roadmap, ~300 lines)

### Next session priorities
1. Read unsampled blocks (book pp. 20–27, 44–61, 68–121, 128–177) to complete the lesson map
2. Read appendix grammar tables (pp. 217–232) for M6 verb compartment data
3. Seed M1 vocabQA items for Chapter 1 (greetings) from confirmed p. 43 content
4. Seed M2 gender pairs from confirmed pp. 16–19 content
5. Seed M3 cognate grid from confirmed lesson text
6. Generate Phase 1 images (hotel, banco, restaurante, cine, greetings scene)

---

## Session 55 — Apr 14, 2026

### Objective
Execute T001–T007: build M1–M4 data components, bloviation audit, cognate expansion.

### T001–T003 status on arrival
All three were already complete from prior sessions:
- `VocabQAItem`, `GenderPair`, `VerbGroup` types exist in `chapter-intro-content.ts`
- `VocabQAGrid`, `GenderAgreementGrid`, `VerbAnchorGrid` all exported from `TextbookInfographics.tsx`
- All three wired in `ChapterIntroduction.tsx` at lines ~2494–2540
- `discoveryNote` rendering already in narrativeSections loop

### T004 — Spanish chapter data improvements
**Greetings vocabQA** replaced with Madrigal p.43 sources:
- Now covers: buenos días/tardes/noches, ¿Cómo está usted?, gracias/de nada, perdón, me llamo, con mucho gusto
- Each item has `word` + `translation` + `question` + `answer` + `answerTranslation`

**Numbers verbGroups tener** expanded with full Madrigal p.53 idioms:
- Added: sed (thirsty), frío (cold), calor (warm), razón (right/lit. have reason)
- Added `verbHint` explaining the key insight: tener carries states English expresses with "to be"

### T005 — Bloviation audit
**Spanish greetings welcomeText** — removed table-of-contents phrasing:
> BEFORE: "In this chapter you'll learn three time-of-day greetings..."
> AFTER: "Spanish greetings change with the clock — buenos días before noon..."

**Spanish family welcomeText** — replaced with pattern-reveal hook:
> BEFORE: "Spanish has a specific word for every family relationship..."
> AFTER: "The -o/-a pair runs through all of Spanish family vocabulary: padre/madre..."

### T006 — Cognate expansion
**Portuguese cognateOpener bug fixed:** entries used non-existent `native` field instead of `target`. Silent display failure — Portuguese word never rendered in CognateRecognitionGrid. Fixed and expanded to 20 entries with proper interface alignment:
- Regular cognates now use `{ english, target, spanish, category }`
- False friends now use `{ isFalseCognate: true, falseCognateNote }` correctly
- Added: -or words (ator/doutor/diretor), -al words, -ção pattern, 3 false friends (polvo/pretender/constipado)

French, German, Italian cognateOpeners were already correct and populated — no changes needed.

### T007 — Roadmap + handoff
`docs/see-it-and-say-it-roadmap.md` updated with:
1. **Complete verb sequence (Phase 1–4)** — full table from ir through me encantaría
2. **The English-Fade Pattern** — four-stage table with pivot point analysis
3. **Lesson map filled in** for pp. 44–101 (tener, querer, plural rules, estar, poder, hay, me gusta/gustaría/encanta)
4. **Session log** updated with S54+S55 entries
5. **Unsampled sections** narrowed — previously listed "68–121" now broken into confirmed content (68–101) and remaining gap (102–121)

### Key architecture insight this session
The "English-fade" pattern is the core design insight for VocabQA UX:
- Madrigal removes English scaffolding gradually as drawings become sufficient translations
- VocabQA items should NOT show English by default — image IS the translation
- English visible only on tap/demand
- This is the "see it and say it" method encoded as UI behavior

### Files changed this session
- `client/src/data/chapter-intro-content.ts` — greetings welcomeText, family welcomeText, greetings vocabQA (Madrigal p.43 sources), numbers verbGroups tener (p.53 idioms), Portuguese cognateOpener (bug fix + expansion)
- `docs/see-it-and-say-it-roadmap.md` — complete verb sequence, English-fade pattern, pp. 44–101 lesson map, session log, unsampled sections updated

### Next session priorities
1. Read remaining unsampled blocks: pp. 20–27, 64–65, 102–121, 128–177
2. Read appendix grammar tables (pp. 217–232) for M6 verb compartment data  
3. Seed M1–M4 data for estar/poder/hay/me gusta phases in chapter-intro-content.ts
4. Consider adding a `verbHint` field to all existing verbGroups (the tener example proved this adds real value)
5. Run bloviation audit on remaining language chapters (currently only Spanish done)

---

## Session 56 — Apr 14, 2026

### Goal
Complete full read of all remaining unsampled "See It and Say It" sections before seeding new data or building new components.

### Context on arrival
S55 ended mid-read at pp. 120–139. All T001–T007 tasks were complete. Two test scan PDFs had been uploaded by user (1 and 2 pages — confirmed these are test shots from user's scanner, NOT Magic Keys content). Magic Keys is NOT uploaded yet.

### What was read this session

**pp. 20–27 — ¿Qué es? category system (MAJOR FIND)**
- 4 semantic categories for ser-based classification: `un animal`, `una fruta`, `una flor`, `una verdura`
- Animals: vaca, caballo, gato, perro, mula, tigre, leónFruits: pera, naranja, manzana, piña
- Flowers: rosa, tulipán, geranio, clavel — "una flor linda" introduces adjective linda
- Vegetables: apio, zanahoria, lechuga, tomate
- p. 25: **rojo** = first color adjective in the entire book — "¿Es rojo el tomate? Sí, el tomate es rojo."
- This is a DISTINCT use of ser (classification, not description) — never flagged in earlier sessions

**pp. 64–65 — Plurals (confirmed)**
- -o → -os (el sombrero → los sombreros, el libro → los libros)
- -a → -as (la rosa → las rosas, la casa → las casas)
- el/los and la/las confirmed

**pp. 72–73, 82–83, 92–93 — Exercise/consolidation pages (no new structures)**

**pp. 102–119 — Modal consolidation block (CRITICAL)**
- pp. 100–101: me encantan (plural) + me encantaría ir confirmed
- pp. 118–119: **THE MASTER INFINITIVE PAGE** — all modal constructions shown together explicitly:
  - Left column: voy a / va a / tengo que / tiene que / quiero / quiere / puedo / no puedo / me gusta / me gustaría / me encanta / **debo** (NEW — I should/ought to)
  - Right column verb list: vender, leer, escribir, ir, comprender, recibir, estudiar, trabajar, caminar, hablar, comprar, dejar
  - Explicit grammar note: "The TO form of Spanish verbs ends in ar, er or ir. This is the infinitive."
  - "You can make up a great number of sentences combining the words in the two columns above."
  - `debo` is the 10th+ modal construction — I should/ought to/must

**pp. 124–125 — Dejar preterite (new verb)**
- dejé / dejó / dejamos / dejaron
- ¿Dónde dejó la valija? → Dejé la valija en el hotel
- Vocabulary: valija (suitcase), guantes (gloves), pasaporte (passport), pipa (pipe), llave (key), portafolio (briefcase)

**pp. 128–131 — Plural preterite (alquilamos/alquilaron, dejamos/dejaron, tomamos/tomaron)**
- First spread to show BOTH "we" and "they" responses side by side
- Breakfast items in preterite: jugo de naranja, pan tostado, huevos fritos, para el desayuno

**pp. 132–133 — ER/IR Preterite (already in roadmap, now confirmed with explicit grammar note)**
- recibí/recibió, escribí/escribió, vendí/vendió, vi/vió
- Key grammar note (p. 132): "ER and IR verbs end in -í when you speak of yourself, -ió when you speak of anyone else (singular)"

**pp. 134–135 — Ver + circus scenes (LOS NIÑOS — first plural subject)**
- vi/vió + paintings, statues, suit, hat
- ¿Qué vieron los niños en el circo? → first appearance of THIRD PERSON PLURAL subject + preterite
- Circus vocabulary: circo, payaso (clown), mono (monkey); chistoso (funny) as new adjective
- Pattern: ¿Es chistoso el payaso? Sí, el payaso es muy chistoso.

**pp. 150–151 — Traer + Decir + ERA (MAJOR FIND)**
- traer: traje / trajo / trajimos / trajeron
- decir: dije / dijo / dijimos / dijeron
- Indirect object `le`: "¿Qué le trajo?" → "Le traje un libro" / "Le traje un disco"
- **ERA = FIRST IMPERFECT TENSE IN THE BOOK** — appears in reported speech: "Le dije que era interesante / terrible / excelente / imposible / formidable"
- Madrigal doesn't label it "imperfect" — students absorb `era` = "was/it was" from context
- Tableware vocabulary introduced: cuchara, cuchillo, plato, mantel, servilleta, jarra, vaso
- limpio / limpia (clean) and sucio / sucia (dirty) as adjective pair

**pp. 152–153 — Voy al + days of week (scheduling context)**
- Voy al teatro el jueves / al concierto el viernes / a la iglesia el domingo / al despacho el lunes / a la biblioteca
- Days of week appear in action context — not a grammar drill

**pp. 160–161 — AR Verb Compendium (38-verb list + conjugation table)**
- Full present tense table: compro / compra / compramos / compran
- 38 common AR verbs: hablar, comprar, estudiar, nadar, cantar, bailar, viajar, trabajar, preparar, invitar, visitar, dejar, saludar, estacionar, usar, llamar, mirar, esperar, ayudar, preguntar, cambiar, ganar, mandar, lavar, planchar, alquilar, caminar, votar, importar, exportar, entrar, fumar, tomar, llevar, regresar, contestar
- Grammar stress note: "Present tense verbs receive stress on the next-to-last syllable: COM-pro, COM-pra, com-PRA-mos, COM-pran"

**pp. 162–163 — Everyday Expressions #5 (MAJOR FIND)**
- ¿A qué hora? → a las dos / cinco / ocho / nueve (time-telling)
- Event vocabulary: la fiesta, el concierto, el cine, la cita (appointment)
- Frequency: Una vez / Dos veces / Unas veces / Muchas veces / De vez en cuando / Otra vez / Tal vez / Esta vez / Esa vez / Todo
- Status phrases: Es todo / Nada / Sin / Siempre / Nunca / Necesito / ¿Qué necesita? / Está bien / Con permiso / Depende / Ya / Seguro / No importa / Lo siento / Creo que sí / Creo que no / Espero que sí
- `Necesito` (I need) — new verb appearing here for first time
- `Espero que sí` — a teaser for the subjunctive (Espero que + subjunctive) that will be formally taught at pp. 198–199

**pp. 164–167 — ER/IR Verbs Present Tense + Conjugation Tables**
- leer: leo (I read), lee (you/he/she read) — ¿Lee usted el periódico en la clase?
- escribir: escribo (I write) — con lápiz / con pluma / a máquina
- vivir: vivo (I live) — ¿Dónde vive? → Vivo en Nueva York
- comprender: comprendo — ¿Comprende usted la conversación?
- aprender: aprendo español en la clase
- vender: vendo — ¿Vende usted autos? Ay no, no vendo autos.
- Grammar note: "In questions, you can use or drop the word usted — both forms heard in ordinary conversation"
- Full ER verb table: vendo/vende/vendemos/venden
- Full IR verb table: vivo/vive/vivimos/viven

**pp. 176–177 — Weather**
- hace frío / hace calor / hace fresco / hace viento
- Seasons in context: en el invierno / en la primavera / en el verano / en el otoño
- Months: septiembre, octubre, noviembre, diciembre
- "En diciembre hay nieve" — hay for weather phenomena
- ¿Está lloviendo? → present progressive for weather (preview of pp. 182–183)

**pp. 178–179 — México composition (culminating reading passage)**
- First extended reading passage in the book
- Full past tense narrative: fui (I went), llegué (I arrived), caminé (I walked), vi (I saw), hablé español, compré regalos
- New vocabulary: un país lindo, montañas altas, valles inmensos, ciudades maravillosas, avenidas anchas, fuentes iluminadas, parques grandes, iglesias antiguas, museos extraordinarios, edificios modernos, tiempo colonial, arquitectos mexicanos
- Cultural content: Ciudad de México, avenidas anchas, fuentes iluminadas

**pp. 182–183 — Present Progressive confirmed and expanded**
- ¿Está tocando el violín? No, no estoy tocando el violín.
- ¿Está patinando? No, no estoy patinando. ¿Está nadando?
- Full paradigm: estoy nadando / está nadando / estamos nadando / están nadando
- "The English ending ING is ANDO for AR verbs in Spanish. Learn: ING = ANDO"
- Examples: estudiando, hablando, cantando, comprando

**pp. 198–199 — Commands + Subjunctive (Appendix)**
- Commands: escriba (write), oiga (listen!), traigamelo (bring it to me), venga acá (come here), hágalo (do it), dígame (tell me)
- GA irregular command forms: oiga/traiga/venga/haga/diga
- Subjunctive: Espero que venga a la fiesta / Espero que me escriba / Quiero que lo haga / Quiero que lo traiga / Quiero que lo conteste
- Grammar notes: "Pronouns go BEFORE the subjunctive" / "Pronouns are added ON TO the command"

**Appendix — Colors, Body Parts, Family, Conjugation Tables**
- Colors (p. 214): blanco, negro, rojo, colorado, color café, pardo, azul, verde, gris, amarillo, morado, rosado
- Body parts (p. 215): complete head-to-toe list (head, upper body, lower body — ~35 items)
- Family (pp. 212–213): full extended family vocabulary confirmed (22 masc/fem pairs)
- Grammar tables (pp. 217–232): ALL tenses for AR/ER/IR — Present, Preterite, Imperfect, Future, Conditional, Present Perfect, Past Perfect, Present Progressive, Past Progressive, Subjunctive — the M6 master reference
- Common ER verbs: Aprender, Barrer, Beber, Comer...
- Common IR verbs: recibir, resistir, subir, sufrir, vivir, permitir, persuadir, aplaudir

### Critical architectural insights from full-book read

**1. Five Everyday Expressions pages are the pedagogical pivots**
EE #1 (p.43) → EE #2 (p.53) → EE #3 (pp.70–71) → EE #4 (pp.80–81) → EE #5 (pp.162–163). These are the "practical fluency checkpoints" — each one consolidates spoken-use language beyond the grammar drills. They should map to HoloHola's warmup/cooldown moments.

**2. ¿Qué es? is a DISTINCT ser use case — never flagged before**
pp. 20–25 introduce ser for CATEGORIZATION, not description. The sentences are `El tomate ES una verdura` (not "the tomato is red") — they place the noun into a category. The 4 categories (animal/fruta/flor/verdura) form a natural M1 chapter. This is a completely seeded slot in our curriculum that didn't exist before this read.

**3. debo = the 10th modal construction**
Appeared only on the master infinitive page (p. 118–119) alongside ir a/tener que/querer/poder/me gusta/me gustaría/me encanta. "I should/ought to/must" — softer than tener que. The M4 VerbAnchorGrid for the modals chapter should include this.

**4. ERA is the first imperfect — it enters as reported speech, not as a tense lesson**
`Le dije que era interesante` (p. 151) — Madrigal doesn't say "now we will learn the imperfect." The word `era` (was/it was) just appears in context, and students absorb it. This is important for HoloHola's progression: when we introduce imperfect as a formal tense, it should feel like a label being put on something they've been using for chapters.

**5. The México composition (pp. 178–179) is the first proof students can read real Spanish**
All past tense forms (fui, llegué, caminé, vi, hablé, compré) used in natural prose. This is the moment the book demonstrates fluency payoff. HoloHola should have an equivalent "read this real paragraph" moment in later chapters.

**6. ER/IR present tense comes LATE (pp. 164–167) — after extensive preterite practice**
Most Spanish courses teach present → past. Madrigal teaches AR present → AR/ER/IR preterite → ER/IR present. Students can say "I received a gift" before they can say "I receive gifts." Communicative function takes priority over tense order.

**7. "Usted can be dropped in questions" (p. 165) — major register note**
This is the first explicit permission to use informal register. "In questions, you can use or drop usted — you hear both in ordinary conversation." Daniela should probably model this once students hit the ER/IR chapter.

**8. Appendix is the M6 master reference — full tense system**
The grammar section (pp. 217–232) has every tense for every verb class. This is where HoloHola's M6 Compartment grids get their data. AR/ER/IR each have: Present, Preterite, Imperfect, Future, Conditional, Present Perfect, Past Perfect, Present Progressive, Past Progressive, Subjunctive.

### What was NOT done this session
- No code changes — this was a pure book analysis session
- Magic Keys not uploaded — still blocked on that
- New data (¿Qué es?, debo, dejar, rojo, EE #5) seeded into chapter-intro-content.ts — PENDING

### Current scratchpad state (updated)

**PAUSE ON DATA SEEDING**: Both books must be fully read before seeding further. "See It and Say It" is now FULLY READ. Waiting for Magic Keys upload.

**Magic Keys status**: User has the physical book. Test scans uploaded Apr 14 (2-page and 1-page test shots only — not actual book content). Book needs to be scanned and uploaded.

**Data waiting to be seeded (after Magic Keys analysis)**:
- ¿Qué es? category system (animal/fruta/flor/verdura) — new M1 chapter content
- rojo as first color + adjective linda + chistoso + limpio/sucio
- debo as 10th modal in numbers chapter verbGroups
- dejar preterite — verb conjugation
- Everyday Expressions #5 expressions (¿A qué hora?, frequency, status phrases, Necesito)
- ERA as first imperfect — note for verb progression docs
- ER/IR present conjugation data for future chapters

### Files changed this session
- `docs/see-it-and-say-it-roadmap.md` — complete rewrite with all 9 phases, all 5 EE pages, full lesson map (no more unsampled rows), complete vocabulary inventories, appendix fully catalogued



---

## Session 57

**Date:** Apr 15, 2026  
**Focus:** Image analysis + gap/overlap audit (both fully complete)  
**Output files:**
- `docs/image-analysis-madrigal.md` — complete visual grammar of how Madrigal illustrates every concept type (10 templates, full concept-type breakdown, HoloHola prompt guidelines)
- `docs/gap-audit-holahola-vs-madrigal.md` — chapter-by-chapter overlap/gap analysis with priority queue

**Key findings:**

IMAGE ANALYSIS:
- Identified 10 image templates covering every concept type in Madrigal: FACADE (buildings), PROFILE (vehicles/animals), PLATED (food), ISOLATED (produce/categories), HANGER (clothing), ACTION (verbs), PORTRAIT (people), OBJECT (household), DUO (social), PAIR (comparisons)
- The universal rule: NOUN + MINIMUM CANONICAL CONTEXT. Never a scene when an object suffices.
- "Question Fit Test": every image must have exactly one reasonable Spanish answer
- Drew out specific drawing specs for 50+ vocabulary items across all concept types

GAP AUDIT — Overall score: 33/110 (~30% of Madrigal coverage)
- Greetings: 9/10 — near-perfect match with EE #1
- Numbers/tener: 8/10 — tener idioms strong; hay and costar missing
- Family: 5/10 — 5 of 11 pairs; personal-a absent; 6 family pairs needed
- Daily: 4/10 — EE #5 mostly missing (Lo siento/Necesito/frecuency words)
- Classroom: 7/10 — good HoloHola original; poder should be added
- Places/ir: 0/10 — completely absent (Madrigal's FIRST structure)
- Preferences (me gusta/gustaría/encanta): 0/10 — no chapter home
- Home/rooms (estar + locations): 0/10 — no chapter home
- Categories (¿Qué es?): 0/10 — no chapter home
- Colors/adjectives: 0/10 — no chapter home
- Grammar beyond present tense: 0/10 — nothing past present

PRIORITY GAPS:
1. Expand daily chapter: Lo siento/Necesito/Creo que sí + frequency words (una vez/muchas veces/de vez en cuando) + ¿A qué hora?
2. Expand family: 6 missing pairs (esposo/esposa, hijo/hija, cuñado, suegro, nieto, sobrino) + quiero = I love + personal-a
3. Expand greetings: full EE #4 emotion list (listo/solo/enojado/furioso/aburrido/enamorado/triste/cómodo + gender note)
4. NEW chapter: places (ir + 10 buildings)
5. NEW chapter: preferences (me gusta/gustaría/encanta)
6. NEW chapter: home (estar + rooms + furniture)

**Still blocked:** Magic Keys to Spanish — scanner test shots only, not book content


---

## Session 57 (continued)

**Additions within same session:**
- Created `docs/madrigal-critique-and-improvements.md` — 15 documented Madrigal limitations with HoloHola solutions, organized as: "What We Keep" table + "What We Improve" section (each with root cause, problem, and HoloHola fix)
- Added this doc to the reference table in `docs/visual-asset-roadmap.md`

**Key improvements documented:**
1. Dialogue colors: all Q&A in B&W single ink → HoloHola: two-color Q&A, color-coded conversation bubbles [HIGH]
2. Ambiguous drawings: olives (p.100), sardine, match, button, celery vs. asparagus → AI-generated with distinguishing features + Question Fit Test [HIGH]
3. No color in color lessons → full-color swatches + canonical colored objects [HIGH]
4. Ser vs. estar never side-by-side contrasted → comparison grid [MEDIUM]
5. Modal page is wall of text → clusters by meaning (obligation/desire/ability/movement/pleasure) [MEDIUM]
6. Practice instructions are generic ("Practique") → Daniela varies dynamically [ALREADY SOLVED]
7. No self-assessment → tap-to-reveal + Daniela tracks errors [ALREADY SOLVED]
8. Fixed 4-item density → variable VocabQA grids [MEDIUM]
9. Preterite-before-present unexplained → discoveryNote explaining pedagogical rationale [MEDIUM]
10. EE phrases not linked to grammar → tagged to source grammar lesson [MEDIUM]
11. Weather disconnected from places → same chapter cluster [LOW — new chapters anyway]
12. Gender agreement not visually tracked → consistent color/position in GenderGrid [MEDIUM]
13. Verb lists alphabetical not frequency → sort by frequency; badge top-10 [LOW]
14. No pronunciation guide beyond page 1 → Daniela audio on every word [ALREADY SOLVED]
15. Spanish-only → 10-language platform [ALREADY SOLVED]


---

## Session 57 (continued — doc consolidation)

**Merged four analysis docs into visual-asset-roadmap.md:**
- `docs/image-analysis-madrigal.md` → Part I.D (deleted source)
- `docs/gap-audit-holahola-vs-madrigal.md` → Part I.C (deleted source)
- `docs/madrigal-critique-and-improvements.md` → Part I.A (deleted source)
- `docs/see-it-and-say-it-roadmap.md` → Part I.B (deleted source)

**visual-asset-roadmap.md is now the single reference for all textbook decisions.** New structure:
- Part I: Pedagogy Foundation (lines 35–~1645)
  - I.A: Where HoloHola Improves on Madrigal
  - I.B: See It and Say It Source Analysis
  - I.C: Gap Audit: HoloHola vs. Madrigal
  - I.D: How Madrigal Illustrates Each Concept
- Part II: Asset Library & Generation Specs (lines ~1645 onwards — unchanged from before)
  - 9-Language Matrix, Platform Status, Philosophy, Content Policy, all image sections

**File is now 4177 lines.** curriculum-strategy.md remains separate (it covers the full platform, not just the textbook).



---

## Session 58 (April 2026)

**Completed: Part I.E — Actual Image Quality Audit**

Directly accessed 15 real images via `/api/media/ai-image/vocab_*.png` (route confirmed as unauthenticated), screenshotted each at full resolution, and graded against Madrigal's Question Fit Test from Part I.D.

**Grade breakdown (15 images):**
- **A-grade (canonical — keep):** 4 images
  - `vocab_color_rojo.png` — pure red circle on white (perfect)
  - `vocab_act_escribir.png` — hands-only writing close-up (perfect)
  - `vocab_adj_grande_pequeno.png` — elephant + mouse DUO (perfect)
  - `vocab_adj_nuevo_viejo.png` — new vs. worn sneaker DUO (perfect)
- **B-grade (keep, note for future batch):** 5 images
  - comer, feliz/triste, hablar, restaurante, beber — all pass QFT with minor noise issues
- **C-grade (schedule regen):** 3 images
  - `vocab_act_leer.png` — reader in winter hat/sweater → cold-weather association competes
  - `vocab_act_bailar.png` — folk dancers in Eastern European costumes → "fiesta/cultura" competes
  - `vocab_places_escuela.png` — US flag on school building → culture-specific
- **F-grade (regen immediately):** 2 images
  - `vocab_adj_caliente_frio.png` — **English text "Warm" and "Vs" printed on image** → catastrophic for a Spanish learning app
  - `vocab_places_casa.png` — **(casa) text label printed on image** + complex ornate garden

**Part I.E written into visual-asset-roadmap.md** (inserted before Part II, ~line 1647):
- Full per-image table with grade, observation, action
- Five cross-cutting failure modes documented
- Immediate regen prompts provided for both F-grade images
- Library status snapshot: 27% A, 33% B, 20% C, 13% F
- Gap flagged: `vocab_spanish_*` namespace appears unpopulated in object storage

**ToC updated** to include Part I.E entry.

**Naming discovery:** The accessible images use `vocab_people_*`, `vocab_act_*`, `vocab_adj_*`, `vocab_places_*`, `vocab_color_*` namespace. The `vocab_spanish_*` namespace (used by vocabulary-image-resolver.ts at line 1498) appears not pre-seeded. Confirm naming convention before next regeneration batch.

**Still blocked:**
- Magic Keys to Spanish — not yet uploaded
- Regenerating F-grade and C-grade images — requires admin route trigger or direct DALL-E call

**Next recommended tasks:**
1. Trigger regen for caliente_frio and casa (F-grade) using the prompts in Part I.E
2. Schedule regen for leer, bailar, escuela (C-grade)
3. Upload Magic Keys to Spanish when available
4. Seed new chapter data (pending Magic Keys analysis)


---

## Sessions S59–S60 (April 2026) — Full Library Audit Complete

**Completed: Part I.E Extended — Full 243-image visual quality audit**

Expanded the S58 sample (15 images) to cover the entire `public/ai-images/` GCS bucket. Every vocab_* category was screenshotted at full resolution and graded against the Question Fit Test.

**Audit scope:** ~243 images across 20 categories (actions, adjectives, animals, body, clothing, colors, emotions, food, health, home, nature, numbers, people, places, professionals, things, time, transport, weather, place-specific).

**New F-grades discovered (5 new, 7 total):**
1. `vocab_adj_caliente_frio.png` — "Warm/Vs" English text (from S58) **AWAITING REGEN**
2. `vocab_places_casa.png` — "(casa)" label baked in (from S58) **AWAITING REGEN**
3. `vocab_color_blanco.png` — "WHITE" label baked in **NEW**
4. `vocab_place_farmacia.png` — "PHARMACY" ×2 in English **NEW**
5. `vocab_emo_nervioso.png` — "stess" text + undressed figure **NEW**
6. `vocab_weather_temperature_scale.png` — "CELSIUS/FAHRENHEIT" English headers **NEW**
7. `vocab_time_dias_semana.png` — "MONDAY/WEDNESDAY/SATURDAY" English day names **NEW**

**New D-grades (regen high priority, 3 images):**
- `vocab_weather_forecast_card.png` — English "CLU/SUN/RAN/STOM" truncated labels
- `vocab_num_hundreds.png` — "D00" + Indian comma formatting + garbled captions
- `vocab_num_phone.png` — "CALLE ploto numbere" garbled English text

**C-grades (~23 images, schedule next batch):**
Actions: leer (winter hat), bailar (folk costume)
Adjectives: joven_viejo_personas, ruidoso_tranquilo, rapido_lento
Body: body_diagram (character reference sheet)
Clothing: sombrero, falda, vestido (style inconsistency)
Food: limon (pencil artifact), huevo (orange border)
Health: cita_medica ("CONSULTATION"), pastilla (white sphere)
Numbers: currency (glitchy "$€..00"), 11_20 (garbled labels), ordinals (wrong podium 1/4/3), tens (confusing grid)
People: hombre (before/after format), estudiante (Arabic script)
Places: escuela (US flag), supermercado (Asian chars)
Professionals: cocinero (Asian script posters)
Things: silla (yellow border artifact)
Weather: caluroso (artist signature + period dress)
Place: banco ("BANK" English)

**Highlights from the audit (excellent categories):**
- vocab_home_* (all 7 images): **ALL A** — perfect set, no action needed
- vocab_nature_* (all 12): **ALL A/B** — no language text anywhere, universal imagery
- vocab_weather_* (8 of 11): A-grade — frio, lluvioso, soleado, neblinoso, nevado, nublado, tormentoso, ventoso all clean
- vocab_time clock faces: **ALL A** — clean analog clocks showing numbers 1–12 only
- vocab_ppl_* (primos, tios, vecino, padres, etc.): **Mostly A** — strong family imagery

**Library health summary:**
- ~170 A-grade (~70%) — no action needed
- ~30 B-grade (~12%) — keep, note for future batch
- ~23 C-grade (~9%) — schedule regen
- 3 D-grade (~1%) — regen before next release
- 7 F-grade (~3%) — regen immediately

**Part I.E Extended written into docs/visual-asset-roadmap.md** (after line 1763):
- Category-level summary table (20 categories)
- 10 cross-cutting failure modes with examples
- Full regen prompts for all 7 F-grade images
- Full regen prompts for all 3 D-grade images
- C-grade regen queue by category
- Updated library status table

**Key new failure modes identified:**
- Garbled AI-generated text on number images (11_20, hundreds, phone, currency)
- Artist signature baked into watercolor (caluroso)
- Indian comma formatting instead of Western (hundreds — "10,00,00" instead of "10,000")
- Multi-panel infographic format that confuses the concept (body_diagram, forecast_card, num_tens)

**Still blocked:**
- Magic Keys to Spanish — not yet uploaded by user
- Actual image regeneration — requires calling vocab-image-seed-service regeneration function or direct DALL-E API call with the prompts from Part I.E

**Next recommended tasks (in priority order):**
1. Regen 7 F-grade images using prompts in Part I.E Extended (these are student-visible failures)
2. Regen 3 D-grade images (garbled text / formatting errors)
3. Regen 23 C-grade images in next generation batch
4. Upload Magic Keys to Spanish when available → unlock new chapter data seeding
5. Continue M1–M6 component audit across 10 languages × 5 chapters (not started yet)

---

## Session S61 — Tue, Apr 15, 2026 (Image Audit regen infrastructure built)

### What was done

**Clarified image generation stack:**
- `generateImageWithGemini()` in routes.ts is **misleadingly named** — it actually calls DALL-E 3 via the OpenAI client (`model: 'dall-e-3'`, 1792×1024)
- Gemini is conversation-only (Daniela's dialogue); DALL-E 3 is 100% of image generation
- This explains the English-text baking problem: DALL-E 3 renders text when concepts suggest it (calendars, thermometers, signs) unless "Absolutely no text" is stated very explicitly

**New backend endpoint built:**
- `POST /api/admin/vocab-images/regen-key` added to routes.ts (line ~11415)
- Takes `{ conceptKey, prompt }` — validates conceptKey starts with `vocab_`, calls DALL-E 3 via `generateImageWithGemini()`, converts to Buffer, calls `uploadPublicBuffer()` to overwrite GCS file directly
- Protected: `isAuthenticated` + `requireRole('admin')`
- Returns `{ url, conceptKey, message }` on success

**New "Image Audit" tab built in Developer Dashboard:**
- Added `ShieldAlert` + `RotateCcw` icon imports
- Added `F_GRADE_IMAGES` const array — all 7 F-grade images with `conceptKey`, `label`, `failure reason`, and corrected `prompt` (each prompt includes "Absolutely no text" language tailored to that image)
- Added `ImageAuditPanel` component:
  - Per-image state: `{ generating, newTs, error }`
  - Shows current image (left) vs new image (right, cache-busted with `?t=timestamp`) after regen
  - "F-Grade" badge becomes "Replaced" badge (green) after successful generation
  - Progress counter: "N/7 replaced this session"
  - Prompts include corrected "no text" instructions and guardrails for each specific failure mode
- Added "Image Audit" tab trigger with ShieldAlert icon to TabsList in DeveloperDashboard
- Added `<TabsContent value="image-audit">` with `<ImageAuditPanel />`

### Status at end of session
- **Backend regen route**: DONE ✅ — `POST /api/admin/vocab-images/regen-key`
- **ImageAuditPanel UI**: DONE ✅ — tab visible in Developer Dashboard
- **Actual F-grade regen**: NOT YET RUN — user can now click Regenerate on each of the 7 cards to generate replacements (each takes ~25s)
- **D-grade regen**: PENDING — prompts documented in visual-asset-roadmap.md; same endpoint can be used manually
- **C-grade regen**: PENDING
- **Magic Keys to Spanish**: BLOCKED (not yet uploaded)

### Files changed this session
- `server/routes.ts` — added `POST /api/admin/vocab-images/regen-key` (line ~11415)
- `client/src/pages/admin/DeveloperDashboard.tsx` — `ImageAuditPanel` component, `F_GRADE_IMAGES` const, new "Image Audit" tab trigger + content, new icon imports

### Next recommended tasks
1. **Run the Image Audit tab** — go to `/admin/developer` → Image Audit tab → click Regenerate on each of the 7 F-grade cards
2. **Review new images** — before/after shown inline; if a result still has text, click Regenerate Again (DALL-E 3 is non-deterministic, retry usually fixes it)
3. **D-grade regen** — use the Fix Single Word tool in Vocab Images tab OR new regen-key endpoint directly for `vocab_weather_forecast_card`, `vocab_num_hundreds`, `vocab_num_phone`
4. **C-grade batch** — 23 images; consider adding them to the audit panel too
5. **Magic Keys to Spanish** — upload when available

---

## Session S62 — Tue, Apr 15, 2026 (Multi-character voice handoffs activated)

### What was done

**Multi-character voice system made live:**
- `getCharacterListDescription()` imported from `character-registry.ts` into `classroom-environment.ts`
- Injected into Tool Rack (the system prompt section Daniela reads every session) — Daniela now sees `speak_as(character, text)` and `resume_tutor(text)` tools with the full Spanish roster listed
- Function definitions for `speak_as` and `resume_tutor` already existed in `daniela-function-registry.ts`; native handler logic already existed in `native-fc-handlers.ts`
- Activation was purely a matter of injecting the character list into Daniela's system context so she knew the tools were available and which characters existed

**Spanish roster now live (8 characters):**
- `carlos` — adult male (Google en-US-Chirp3-HD-Puck)
- `el_mesero` — restaurant waiter male (Google es-US-Chirp3-HD-Puck)
- `el_doctor` — male doctor (Google es-US-Chirp3-HD-Puck)
- `el_vendedor` — male shopkeeper (Google es-US-Chirp3-HD-Puck)
- `el_recepcionista` — male hotel receptionist (Google es-US-Chirp3-HD-Puck)
- `elena` — adult female (Google es-US-Chirp3-HD-Aoede)
- `la_doctora` — female doctor (Google es-US-Chirp3-HD-Aoede)
- `la_mesera` — female waitress (Google es-US-Chirp3-HD-Aoede)

**Competitive analysis updated:**
- `docs/competitive-talkpals.md` row for "different voices per scenario character" updated to reflect activation

### Status at end of S62
- Multi-character system: LIVE ✅
- speak_as / resume_tutor: available to Daniela in every session
- S62 handoff entry: not written during session (written retroactively in S63)

### Files changed in S62
- `server/services/classroom-environment.ts` — `getCharacterListDescription` import added; Tool Rack injection added
- `docs/competitive-talkpals.md` — multi-character row updated

### Notes
- **Two-file rule for new Daniela functions:** Any new function added to Daniela must be added to BOTH `daniela-function-registry.ts` (function definition) AND the Tool Rack in `classroom-environment.ts` (system prompt injection). The S62 activation was completing this pair for speak_as/resume_tutor, which had definitions but no Tool Rack presence.

---

## Session S63 — Tue, Apr 15, 2026 (Magic Key to Spanish: full audit + two-book synthesis)

### What was done

**Magic Key to Spanish — full text extracted and read:**
- PDF on disk: `attached_assets/madrigals_magic_key_to_spanish_20260415_0001_1776285811018.pdf`
- Extracted with pdftotext → `/tmp/magic_key.txt` (97MB PDF → 11,018 lines of text)
- All 45 lessons catalogued
- Key structural features confirmed through actual text, not paraphrase

**Major findings (see Part I.F in visual-asset-roadmap.md for full analysis):**
1. **Publication order confirmed:** Magic Key (1953) came BEFORE See It and Say It (1963) — Madrigal spent a decade fixing what was missing from Magic Key
2. **Three-column sentence generator is the primary format of the entire book** — appears in every one of the 45 lessons, not a single chapter feature
3. **Column 1 mixes tenses from Lesson 11 onward** — past preterite and *ir a* future in the same column, no labeling, by design
4. **Tú confirmed at Lesson 45 of 45** — the final lesson, framed as "add -s to the third-person form," not a new conjugation system. Preterite and command are the only exceptions (noted explicitly)
5. **Cognate system is 11 conversion rules × 200–400 words each** — not "tables in every chapter" but the entire pedagogical spine. Lessons 1–2 unlock 1,000–2,000+ words
6. **Present tense introduced at Lesson 22 of 45** — entire first half of the book is preterite + *ir a* future
7. **Preconjugated forms throughout** — not a page 40 feature; the entire book presents "I form / anyone-else form / question form" before any conjugation table
8. **Teaching philosophy articulated in Madrigal's own words** — multiple extended passages extracted verbatim

**7 Daniela teaching notes identified — ready to seed:**
These are verbatim or near-verbatim from Magic Key, ready to load into `danielaNotes` via admin panel:
1. "Never let a word lie fallow. Use it the minute you learn it."
2. "Large concepts, not small lists. One pattern gives 200 words forever."
3. "Invention beats memorization. A form you create is yours permanently."
4. "When a cognate appears, celebrate it: 'You already knew that word.'"
5. "Delayed tú is intentional. Build usted fluency first; tú arrives as +s."
6. "In Spanish, people are always 'in' places, never 'at' places."
7. "Subject pronouns drop constantly. 'Hablas' is complete."

**Two-book synthesis analysis written (Part I.G):**
- Publication order analysis and what it means for HoloHola's position
- Head-to-head comparison table across 11 dimensions
- 5 things HoloHola has that neither book can provide
- 5-phase synthesis architecture (mass unlock → visual anchor → generate → scene → tú milestone)
- 4 design tensions documented (not resolved — gathering mode)

**Status at end of S63:**
- Part I.F: COMPLETE ✅ — full audit with confirmed findings from actual text
- Part I.G: COMPLETE ✅ — synthesis analysis written, gathering mode
- 7 Daniela tips: DOCUMENTED ✅ — ready to seed next session
- Design decisions: DEFERRED — still in gathering mode per founder direction
- F-grade image regen: STILL PENDING (7 images, `/admin/developer` → Image Audit tab)
- S62/S63 handoff entries: NOW WRITTEN ✅

### Files changed in S63
- `docs/visual-asset-roadmap.md` — Part I.F completely rewritten with full audit findings; Part I.G added (two-book synthesis); change log rows updated throughout

### Next recommended tasks
1. **Seed 7 Daniela tips** — admin panel → Daniela Notes → add each of the 7 tips from Part I.F
2. **Run F-grade image regen** — `/admin/developer` → Image Audit tab → Regenerate each of the 7 F-grade images
3. **Audit Spanish chapters for premature tú** — check greetings and daily chapters for tú forms; shift to usted; flag tú as a later milestone
4. **Review SentenceFrameGrid** — does it expose genuine three-column pick, or fixed sentences with highlighted slots? Magic Key's standard is the former
5. **Continue gathering mode** — founder reviewing more source material before design decisions

---

## Session S64 — Thu, Apr 16, 2026 (Gemini 2.5 TTS multi-speaker watch item)

### What was done

**Technology watch item documented:**
- Founder flagged Google's Gemini 2.5 TTS announcement (referenced as "Gemini 3.1 TTS" — version name to confirm against official release)
- Native multi-speaker TTS feature noted as highly relevant to HoloHola's scenario system
- Full analysis written to Part I.H in visual-asset-roadmap.md

**Key insight:** Gemini 2.5 TTS multi-speaker would allow an entire multi-character dialogue (Daniela + el_mesero + prompts to student) to be generated as a single continuous audio stream with no gaps between voice switches — compared to current architecture which makes one TTS API call per speaker per line.

**Current architecture documented in Part I.H:**
- speak_as / resume_tutor function calls → separate Chirp3-HD TTS request per speaker
- 4-line dialogue = 4 separate API round-trips, 4 audio buffers, audible seam at each transition
- Works and sounds good; transitions have gaps

**What multi-speaker TTS would unlock:**
- Seamless voice transitions (model handles internally)
- Fewer API calls (6-line scene = 1 call instead of 6)
- Natural conversational rhythm (currently impossible between characters)
- Potentially better prosody consistency across a scene

**4 design tensions documented (not resolved — gathering mode):**
1. Gemini TTS voice quality vs. Chirp3-HD — needs side-by-side evaluation
2. Structured script model vs. emergent function-call model — different authoring paradigms
3. Student participation within the stream — turn-taking design needed
4. Migration cost vs. current system quality — can't assess without API access

### Status at end of S64
- Part I.H: WRITTEN ✅ — Technology Watch section in roadmap
- Implementation decision: DEFERRED — gathering mode, needs API access + quality evaluation
- Evaluation criteria documented: voice quality, voice consistency, language coverage, scene prototype
- S64 handoff entry: WRITTEN ✅

### Files changed in S64
- `docs/visual-asset-roadmap.md` — Part I.H added (Gemini 2.5 TTS multi-speaker watch item)
- `docs/alden-agent-handoff.md` — S64 entry

### Additional finding added in same session (S64 continued)

**Rate limit constraint documented — and reframed:**
- HoloHola already has Gemini 2.5 TTS set up in the codebase but hasn't activated it due to low RPD/concurrency limits
- Founder observation: all Gemini TTS models carry the same low concurrency, even newer ones — suggests deliberate product tier boundary, not temporary rollout gap
- Analysis: Google has two competing TTS products (Gemini TTS vs. Chirp3-HD/Google Cloud TTS). Chirp3-HD is the production-scale monetized product; Gemini TTS rate limits likely protect Chirp3-HD's paid tier from cannibalization
- Path to higher Gemini TTS concurrency = enterprise contract negotiation, not waiting for organic limit increases
- **Hybrid architecture proposed:** Chirp3-HD for Daniela's real-time continuous voice (high volume), Gemini TTS multi-speaker for pre-scripted scene preambles (low volume, high quality, seamless transitions)
- This resolves Tension D from the morning's note — no full migration required, Gemini TTS is additive on top of Chirp3-HD

### Files changed in S64
- `docs/visual-asset-roadmap.md` — Part I.H added (Gemini 2.5 TTS multi-speaker); Rate Limit section added to Part I.H with hybrid architecture table and example scene flow
- `docs/alden-agent-handoff.md` — S64 entry

### Next recommended tasks
1. **Verify version name** — confirm "Gemini 2.5 TTS" is the correct product name from the official announcement
2. **Prototype hybrid approach** — use existing Gemini TTS integration to generate one pre-scripted 4-line restaurant scene (Daniela + el_mesero) as a multi-speaker call; compare to speak_as equivalent
3. **Voice quality comparison** — evaluate Gemini TTS naturalness, accent, voice consistency vs. Chirp3-HD on same Spanish text
4. **Language coverage check** — does multi-speaker quality hold for Spanish, French, Portuguese, German, Italian, Japanese?
5. **Continue gathering mode** — other source material or announcements to document before design decisions

**Strategic position identified and documented (Part I.I):**
- HoloHola as the reference implementation for multi-speaker TTS — not a customer, a validation platform
- Language learning identified as the highest-signal use case for multi-speaker TTS (students are the most demanding audio audience that exists for a consumer app)
- Leverage structure documented: shipping a compelling scene inverts the power relationship with TTS vendors
- Vendor-agnostic design principle becomes negotiating leverage — vendors compete to be the one HoloHola endorses
- The competitive forcing function: HoloHola shipping first accelerates Google's rate limit decision and every other vendor's production-readiness timetable
- Quality bar for "reference implementation" standard documented (character distinctness, seamless transitions, visible pedagogical value, scene feel)
