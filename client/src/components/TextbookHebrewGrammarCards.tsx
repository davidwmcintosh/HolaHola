import { Card, CardContent } from "@/components/ui/card";

const HE = "text-blue-700 dark:text-blue-400";
const HE_BG = "bg-blue-500/10";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-wider ${HE} mb-2`}>{children}</p>;
}

function ConjTable({ rows, headers = ['Person', 'Hebrew', 'Transliteration'] }: { rows: [string, string, string][]; headers?: [string, string, string] }) {
  return (
    <div className="rounded-md border border-border overflow-hidden text-sm">
      <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        <span>{headers[0]}</span><span>{headers[1]}</span><span>{headers[2]}</span>
      </div>
      {rows.map(([a, b, c], i) => (
        <div key={i} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
          <span className="text-muted-foreground">{a}</span>
          <span className={`font-semibold text-right`}>{b}</span>
          <span className="text-muted-foreground italic">{c}</span>
        </div>
      ))}
    </div>
  );
}

function PhraseList({ pairs }: { pairs: [string, string][] }) {
  return (
    <div className="space-y-1 mt-1">
      {pairs.map(([he, en]) => (
        <div key={he} className="flex gap-2 text-sm">
          <span className="font-semibold shrink-0 text-right">{he}</span>
          <span className="text-muted-foreground">— {en}</span>
        </div>
      ))}
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-md ${HE_BG} border border-blue-300/30 dark:border-blue-700/40 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

// ── Alef-Bet — Hebrew Alphabet ──────────────────────────────────────────────

export function HeAlefBetCard() {
  const letters: [string, string, string, string][] = [
    ['א', 'Alef', 'ʔ (silent)', 'First letter; silent consonant; carries vowels'],
    ['ב / ב', 'Bet / Vet', 'b / v', 'Dagesh: bet (b); without dagesh: vet (v)'],
    ['ג', 'Gimel', 'g', 'Hard g as in "go"'],
    ['ד', 'Dalet', 'd', 'As in "door"'],
    ['ה', 'He', 'h', 'As in "hello"; final ה usually silent'],
    ['ו', 'Vav', 'v', 'Also used as vowel (oo/oh)'],
    ['ז', 'Zayin', 'z', 'As in "zebra"'],
    ['ח', 'Het', 'ḥ', 'Guttural — back of throat, like Spanish "j"'],
    ['ט', 'Tet', 't', 'Emphatic t (historical; identical to Tav in modern Hebrew)'],
    ['י', 'Yod', 'y', 'As in "yes"; also vowel (ee)'],
    ['כ / ך', 'Kaf / Khaf', 'k / kh', 'Dagesh: kaf (k); without: khaf (like German "Bach")'],
    ['ל', 'Lamed', 'l', 'Clear l, no dark l'],
    ['מ / ם', 'Mem', 'm', 'Final form ם used at end of word'],
    ['נ / ן', 'Nun', 'n', 'Final form ן used at end of word'],
    ['ס', 'Samekh', 's', 'As in "sun"'],
    ['ע', 'Ayin', 'ʕ (silent)', 'Pharyngeal; silent in modern Hebrew, subtle in Mizrahi'],
    ['פ / ף', 'Pe / Fe', 'p / f', 'Dagesh: pe (p); without: fe (f)'],
    ['צ / ץ', 'Tsadi', 'ts', 'Like "ts" in "cats"; final form ץ'],
    ['ק', 'Qof', 'q/k', 'Uvular in tradition; k in modern Hebrew'],
    ['ר', 'Resh', 'r', 'Uvular trill or tap; similar to French r'],
    ['שׁ / שׂ', 'Shin / Sin', 'sh / s', 'Dot right: shin (sh); dot left: sin (s)'],
    ['ת', 'Tav', 't', 'As in "top" (Ashkenazi: th in some traditions)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>אלף-בית — The Hebrew Alphabet (22 Letters)</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Letter</span><span>Name</span><span>Sound</span><span>Note</span>
          </div>
          {letters.map(([letter, name, sound, note], i) => (
            <div key={name} className={`grid grid-cols-4 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`text-lg font-bold ${HE} text-right`}>{letter}</span>
              <span className="font-semibold">{name}</span>
              <span className="text-muted-foreground">{sound}</span>
              <span className="text-muted-foreground text-xs">{note}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Reading direction:</strong> Hebrew is written and read <strong>right to left</strong>. There are no capital letters. Five letters (כ מ נ פ צ) have a special <em>final form</em> used when appearing at the end of a word.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Niqqud — Vowel Points ───────────────────────────────────────────────────

export function HeNiqqudCard() {
  const vowels: [string, string, string, string][] = [
    ['ָ', 'Qamats', 'ah', 'Long a — most common vowel'],
    ['ַ', 'Patach', 'ah', 'Short a'],
    ['ֵ', 'Tsere', 'eh (long)', 'Long e — like "hey"'],
    ['ֶ', 'Segol', 'eh (short)', 'Short e'],
    ['ִ', 'Hiriq', 'ee', 'i vowel'],
    ['ֹ', 'Holam', 'oh', 'Long o (also written ו with dot)'],
    ['ֻ', 'Qibbuts', 'oo', 'Short u'],
    ['ּ', 'Shuruk', 'oo', 'Long u — vav with dot inside'],
    ['ְ', 'Sheva', 'silent or ĕ', 'Silent at end of syllable; short ĕ mid-word'],
    ['ֲ', 'Hataf Patach', 'ah (ultra-short)', 'Under gutturals only'],
    ['ֱ', 'Hataf Segol', 'eh (ultra-short)', 'Under gutturals only'],
    ['ֳ', 'Hataf Qamats', 'oh (ultra-short)', 'Under gutturals only'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>ניקוד (Niqqud) — Vowel Points</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Symbol (on ב)</span><span>Name</span><span>Sound</span><span>Note</span>
          </div>
          {vowels.map(([sym, name, sound, note], i) => (
            <div key={name} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`text-xl font-bold ${HE}`}>ב{sym}</span>
              <span className="font-semibold">{name}</span>
              <span className="text-muted-foreground">{sound}</span>
              <span className="text-muted-foreground text-xs">{note}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Modern printed Hebrew:</strong> Niqqud (vowel dots) appear in children's books, the Bible, and poetry. Most adult texts are written <em>without</em> vowel points — readers infer them from context, root knowledge, and patterns. Learning roots (שורשים) is the key to reading unpointed text.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Pronouns ────────────────────────────────────────────────────────────────

export function HePronounsCard() {
  const rows: [string, string, string][] = [
    ['I', 'אֲנִי / אָנֹכִי', 'ani / anochi'],
    ['You (m.s.)', 'אַתָּה', 'ata'],
    ['You (f.s.)', 'אַתְּ', 'at'],
    ['He', 'הוּא', 'hu'],
    ['She', 'הִיא', 'hi'],
    ['We', 'אֲנַחְנוּ', 'anachnu'],
    ['You (m.pl.)', 'אַתֶּם', 'atem'],
    ['You (f.pl.)', 'אַתֶּן', 'aten'],
    ['They (m.)', 'הֵם', 'hem'],
    ['They (f.)', 'הֵן', 'hen'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>כינויי גוף — Subject Pronouns</SectionLabel>
        <ConjTable rows={rows} headers={['Person', 'Hebrew', 'Transliteration']} />
        <NoteBox>
          <strong>Gender matters:</strong> Hebrew distinguishes masculine (זכר) and feminine (נקבה) in 2nd and 3rd person forms — both singular and plural. This affects verb conjugation, adjectives, and nouns throughout the language. In speech, <em>ani</em> is used for "I"; <em>anochi</em> is biblical/formal.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Present Tense — Pa'al ───────────────────────────────────────────────────

export function HePresentCard() {
  const rowsLamed: [string, string, string][] = [
    ['m.s. (ani/ata/hu)', 'לומד', 'lomed — studying (m.s.)'],
    ['f.s. (ani/at/hi)', 'לומדת', 'lomedet — studying (f.s.)'],
    ['m.pl. (atem/hem)', 'לומדים', 'lomdim — studying (m.pl.)'],
    ['f.pl. (aten/hen)', 'לומדות', 'lomdot — studying (f.pl.)'],
  ];
  const rowsDaber: [string, string, string][] = [
    ['m.s.', 'מדבר', 'medaber — speaking (m.s.)'],
    ['f.s.', 'מדברת', 'medaberet — speaking (f.s.)'],
    ['m.pl.', 'מדברים', 'medabrim — speaking (m.pl.)'],
    ['f.pl.', 'מדברות', 'medabrot — speaking (f.pl.)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>הווה — Present Tense</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Hebrew present tense has 4 forms based on <strong>gender and number</strong> — not person. The same form is used for "I study," "you study," and "he studies" (all masculine singular).</p>
        <div className="mb-3">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">ל-מ-ד (lamed) — to study (Pa'al binyan)</p>
          <ConjTable rows={rowsLamed} headers={['Form', 'Hebrew', 'Transliteration']} />
        </div>
        <div>
          <p className="text-xs font-semibold mb-2 text-muted-foreground">פ-י-על (Pi'el) — to speak / לדבר (ledaber)</p>
          <ConjTable rows={rowsDaber} headers={['Form', 'Hebrew', 'Transliteration']} />
        </div>
        <NoteBox>
          <strong>No "to be" in present tense:</strong> Hebrew omits the verb "is/are" in simple present statements. אני תלמיד = "I [am] a student" · הספר טוב = "The book [is] good." Only in past and future does "to be" (היה / יהיה) appear.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Past Tense ──────────────────────────────────────────────────────────────

export function HePastCard() {
  const rows: [string, string, string][] = [
    ['I (m/f)', 'למדתי', 'lamadti — I studied'],
    ['You (m.s.)', 'למדת', 'lamadeta'],
    ['You (f.s.)', 'למדת', 'lamadet'],
    ['He', 'למד', 'lamad'],
    ['She', 'למדה', 'lamda'],
    ['We', 'למדנו', 'lamadnu'],
    ['You (m.pl.)', 'למדתם', 'lmadtem'],
    ['You (f.pl.)', 'למדתן', 'lmadten'],
    ['They (m.)', 'למדו', 'lamdu'],
    ['They (f.)', 'למדו', 'lamdu'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>עבר — Past Tense (ל-מ-ד — to learn/study)</SectionLabel>
        <ConjTable rows={rows} headers={['Person', 'Hebrew', 'Transliteration']} />
        <NoteBox>
          <strong>Suffixes carry the subject:</strong> In the past tense, the subject pronoun is usually omitted because the verb ending indicates who performed the action. Gender distinction appears in 2nd and 3rd person singular (he/she are different forms). The pattern: root + personal endings attached directly to the root.
        </NoteBox>
        <div className="mt-3">
          <SectionLabel>Common Time Markers for Past</SectionLabel>
          <PhraseList pairs={[
            ['אתמול', 'yesterday — etmol'],
            ['לפני שבוע', 'a week ago — lifney shavua'],
            ['אשתקד', 'last year — eshtakad'],
            ['כבר', 'already — kvar'],
          ]} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Future Tense ─────────────────────────────────────────────────────────────

export function HeFutureCard() {
  const rows: [string, string, string][] = [
    ['I', 'אלמד', 'elmad — I will learn'],
    ['You (m.s.)', 'תלמד', 'tilmad'],
    ['You (f.s.)', 'תלמדי', 'tilmedi'],
    ['He / It', 'ילמד', 'yilmad'],
    ['She / It', 'תלמד', 'tilmad'],
    ['We', 'נלמד', 'nilmad'],
    ['You (m.pl.)', 'תלמדו', 'tilmedu'],
    ['You (f.pl.)', 'תלמדנה', 'tilmadna'],
    ['They (m.)', 'ילמדו', 'yilmedu'],
    ['They (f.)', 'ילמדנה', 'yilmadna'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>עתיד — Future Tense (ל-מ-ד Pa'al)</SectionLabel>
        <ConjTable rows={rows} headers={['Person', 'Hebrew', 'Transliteration']} />
        <NoteBox>
          <strong>Prefix system:</strong> Future tense uses prefixes (א י ת נ) + root + suffixes. The prefix indicates person; suffix indicates gender/plural. Note: "you f.s." and "he" share the same prefix (ת tav) but are distinguished by the vowel pattern and context. Future is also used for commands (volitional).
        </NoteBox>
        <div className="mt-3">
          <SectionLabel>Common Time Markers for Future</SectionLabel>
          <PhraseList pairs={[
            ['מחר', 'tomorrow — machar'],
            ['בשבוע הבא', 'next week — bashavua haba'],
            ['עוד מעט', 'soon / in a little while — od me'at'],
            ['בקרוב', 'soon — bekarov'],
          ]} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Binyanim Overview ───────────────────────────────────────────────────────

export function HeBinyanCard() {
  const binyanim: [string, string, string, string][] = [
    ['פָּעַל', 'Pa\'al (Qal)', 'Basic action', 'כתב katav — he wrote'],
    ['נִפְעַל', 'Nif\'al', 'Passive of Pa\'al / reflexive', 'נכתב niktav — it was written'],
    ['פִּיעֵל', 'Pi\'el', 'Intensive / causative', 'דיבר diber — he spoke (intensive)'],
    ['פֻּעַל', 'Pu\'al', 'Passive of Pi\'el', 'דובר dubar — it was spoken'],
    ['הִפְעִיל', 'Hif\'il', 'Causative', 'הכניס hichnis — he caused to enter'],
    ['הֻפְעַל', 'Huf\'al', 'Passive of Hif\'il', 'הוכנס huchneas — he was made to enter'],
    ['הִתְפַּעֵל', 'Hitpa\'el', 'Reflexive / reciprocal', 'התלבש hitlabesh — he dressed himself'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>בניינים (Binyanim) — The 7 Hebrew Verb Patterns</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Hebrew verbs are organized into <strong>7 binyanim</strong> (building patterns). Each binyan applies a fixed pattern of vowels and prefixes to a 3-letter root (שורש), creating words with predictable semantic relationships.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Pattern</span><span>Name</span><span>Meaning</span><span>Example</span>
          </div>
          {binyanim.map(([pattern, name, meaning, ex], i) => (
            <div key={name} className={`grid grid-cols-4 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`font-bold text-sm ${HE}`}>{pattern}</span>
              <span className="font-semibold">{name}</span>
              <span className="text-muted-foreground text-xs">{meaning}</span>
              <span className="text-muted-foreground text-xs">{ex}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>For beginners:</strong> Focus on Pa'al (most common), Pi'el (intensive/speech verbs), and Hif'il (causative). Hitpa'el is also very frequent for reflexive actions. Pa'al and Pi'el cover the vast majority of everyday verbs.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Pi'el Binyan ────────────────────────────────────────────────────────────

export function HePiyelCard() {
  const rows: [string, string, string][] = [
    ['m.s. (present)', 'מדבר', 'medaber — speaking'],
    ['f.s. (present)', 'מדברת', 'medaberet — speaking (f)'],
    ['m.pl. (present)', 'מדברים', 'medabrim — speaking (m.pl.)'],
    ['past (he)', 'דיבר', 'diber — he spoke'],
    ['past (she)', 'דיברה', 'dibera — she spoke'],
    ['future (I)', 'אדבר', 'adaber — I will speak'],
    ['future (he)', 'ידבר', 'yedaber — he will speak'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>פִּיעֵל (Pi'el) — Intensive Binyan · Root: ד-ב-ר (speech)</SectionLabel>
        <ConjTable rows={rows} headers={['Form', 'Hebrew', 'Transliteration']} />
        <NoteBox>
          <strong>Pi'el pattern:</strong> Identified by a dagesh (dot) in the middle root letter in past tense (דִּבֵּר diber). In present: מ prefix + root pattern. Common Pi'el verbs: לדבר (to speak), לספר (to tell a story), לבקש (to request), לקבל (to receive), לשלם (to pay), לצלם (to photograph).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Hif'il Binyan ────────────────────────────────────────────────────────────

export function HeHifilCard() {
  const rows: [string, string, string][] = [
    ['m.s. (present)', 'מכניס', 'machnis — causing to enter / bringing in'],
    ['f.s. (present)', 'מכניסה', 'machnisa'],
    ['m.pl. (present)', 'מכניסים', 'machniasim'],
    ['past (he)', 'הכניס', 'hichnis — he brought in'],
    ['past (she)', 'הכניסה', 'hichnisa'],
    ['future (I)', 'אכניס', 'achnis — I will bring in'],
    ['future (he)', 'יכניס', 'yachnis'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>הִפְעִיל (Hif'il) — Causative Binyan · Root: כ-נ-ס (enter)</SectionLabel>
        <ConjTable rows={rows} headers={['Form', 'Hebrew', 'Transliteration']} />
        <NoteBox>
          <strong>Hif'il pattern:</strong> Past tense starts with הִ (hi-) prefix. Present tense starts with מַ (ma-). Future starts with יַ (ya-). Common Hif'il verbs: להכניס (to bring in), להוציא (to take out), להראות (to show), להסביר (to explain), להחליט (to decide), להגיע (to arrive).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Hitpa'el Binyan ──────────────────────────────────────────────────────────

export function HeHitpaelCard() {
  const rows: [string, string, string][] = [
    ['m.s. (present)', 'מתלבש', 'mitlabesh — getting dressed'],
    ['f.s. (present)', 'מתלבשת', 'mitlabeshet'],
    ['m.pl. (present)', 'מתלבשים', 'mitlabishim'],
    ['past (he)', 'התלבש', 'hitlabesh — he got dressed'],
    ['past (she)', 'התלבשה', 'hitlabsha'],
    ['future (I)', 'אתלבש', 'etlabesh — I will get dressed'],
    ['future (he)', 'יתלבש', 'yitlabesh'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>הִתְפַּעֵל (Hitpa'el) — Reflexive Binyan · Root: ל-ב-ש (dress)</SectionLabel>
        <ConjTable rows={rows} headers={['Form', 'Hebrew', 'Transliteration']} />
        <NoteBox>
          <strong>Hitpa'el pattern:</strong> Always begins with הִתְ (hit-) in past, מִתְ (mit-) in present, יִתְ (yit-) in future. Common Hitpa'el verbs: להתלבש (to get dressed), להתקלח (to shower), להתגלח (to shave), להתרגש (to get excited), להתנצל (to apologize), להתחיל (to begin — irregular).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Gender Agreement ─────────────────────────────────────────────────────────

export function HeGenderCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>מין דקדוקי — Grammatical Gender</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Hebrew has only two genders: <strong>masculine (זכר/zachar)</strong> and <strong>feminine (נקבה/nekeva)</strong>. Every noun, adjective, verb (past/future), and numeral must agree in gender.</p>

        <div className="mb-4">
          <SectionLabel>Typical Gender Markers</SectionLabel>
          <div className="rounded-md border border-border overflow-hidden text-sm">
            <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span>Pattern</span><span>Examples</span><span>Note</span>
            </div>
            {[
              ['Masculine — no special ending', 'ספר (sefer) — book · בית (bayit) — house', 'Most masculine nouns'],
              ['Feminine — ends in ה-', 'מחברת (machberet) — notebook · מדינה (medina) — country', 'Most common feminine ending'],
              ['Feminine — ends in ת-', 'תלמידת (talmidet) — student (f) · אמת (emet) — truth', 'Some abstract nouns'],
              ['Irregular — must memorize', 'עיר (ir) — city (fem.) · יד (yad) — hand (fem.)', 'Body parts + some nouns'],
            ].map(([pattern, ex, note], i) => (
              <div key={i} className={`grid grid-cols-3 px-3 py-2 text-sm ${i > 0 ? 'border-t border-border/50' : ''}`}>
                <span className="font-semibold">{pattern}</span>
                <span className="text-muted-foreground">{ex}</span>
                <span className="text-muted-foreground text-xs">{note}</span>
              </div>
            ))}
          </div>
        </div>

        <SectionLabel>Adjective Agreement</SectionLabel>
        <PhraseList pairs={[
          ['ספר גדול / ספרים גדולים', 'big book (m.s.) / big books (m.pl.)'],
          ['מחברת גדולה / מחברות גדולות', 'big notebook (f.s.) / big notebooks (f.pl.)'],
          ['הילד חכם', 'The boy is smart — hayelед chacham'],
          ['הילדה חכמה', 'The girl is smart — hayalda chachama'],
        ]} />
        <NoteBox>
          Adjectives in Hebrew <strong>follow the noun</strong> and must agree in gender, number, AND definiteness. A definite noun needs a definite adjective: הספר הגדול = "the big book" (not הספר גדול).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Plural Formation ──────────────────────────────────────────────────────────

export function HePluralCard() {
  const rows: [string, string, string][] = [
    ['Masculine singular → plural (-ים)', 'ילד → ילדים (yeled → yeladim)', 'boy → boys'],
    ['Feminine singular → plural (-ות)', 'ילדה → ילדות (yalda → yeladot)', 'girl → girls'],
    ['Masculine irregular', 'איש → אנשים (ish → anashim)', 'man → men'],
    ['Feminine: drop ה add ות', 'מחברת → מחברות (machberet → machbarot)', 'notebook → notebooks'],
    ['Mixed patterns (must learn)', 'שנה → שנים (shana → shanim)', 'year → years (m.pl. form!)'],
    ['Dual (pair)', 'יד → ידיים (yad → yadayim)', 'hand → hands (dual form)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>רבים — Plural Formation</SectionLabel>
        <ConjTable rows={rows} headers={['Rule', 'Example', 'English']} />
        <NoteBox>
          <strong>Dual form:</strong> Hebrew has a special <em>dual</em> for naturally paired things: ידיים (hands), עיניים (eyes), אוזניים (ears), רגליים (legs). The dual suffix is ־ַיִם (-ayim). Some words have unexpected plural genders: שנה (year) is feminine but takes a masculine plural שנים. Always check!
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Definite Article ──────────────────────────────────────────────────────────

export function HeArticleCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>ה ידיעה — The Definite Article (Ha-)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Hebrew has only one definite article: <strong>ה (ha-)</strong>, meaning "the." It is prefixed directly to the noun with a dagesh in the following letter. There is no indefinite article — a bare noun is indefinite.</p>
        <div className="mb-3">
          <SectionLabel>Article + Noun</SectionLabel>
          <PhraseList pairs={[
            ['ספר → הַסֵּפֶר', 'book → the book (haSefer)'],
            ['מחברת → הַמַּחְבֶּרֶת', 'notebook → the notebook (haMachberet)'],
            ['ילד → הַיֶּלֶד', 'boy → the boy (haYeled)'],
            ['עיר → הָעִיר', 'city → the city (haIr — vowel change before ayin)'],
          ]} />
        </div>
        <div>
          <SectionLabel>Definite Adjective Rule</SectionLabel>
          <PhraseList pairs={[
            ['ספר גדול', 'a big book (indefinite)'],
            ['הספר הגדול', 'the big book (definite — article on BOTH noun AND adjective)'],
            ['הספר גדול', 'the book is big (predicate — adjective has NO article)'],
          ]} />
        </div>
        <NoteBox>
          <strong>Prepositions + article:</strong> When ב (in), כ (like), ל (to/for) precede a definite noun, the ה of the article merges with the preposition: ב + הבית = בַּבַּיִת (babayit) = "in the house." מ (from) stays separate: מהבית = from the house.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Negation ──────────────────────────────────────────────────────────────────

export function HeNegationCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>שלילה — Negation</SectionLabel>
        <div className="mb-4">
          <SectionLabel>לא (lo) — The Main Negator</SectionLabel>
          <p className="text-sm text-muted-foreground mb-2">לא (lo) negates verbs in all tenses and adjective predicates:</p>
          <PhraseList pairs={[
            ['אני לא מדבר עברית', 'I don\'t speak Hebrew — ani lo medaber ivrit'],
            ['הוא לא בא אתמול', 'He didn\'t come yesterday — hu lo ba etmol'],
            ['זה לא טוב', 'That\'s not good — ze lo tov'],
          ]} />
        </div>
        <div className="mb-4">
          <SectionLabel>אין (ein) — Negating Existence & Possession</SectionLabel>
          <p className="text-sm text-muted-foreground mb-2">אין (ein) is the negation of יש (yesh — there is/I have):</p>
          <PhraseList pairs={[
            ['יש לי ספר', 'I have a book — yesh li sefer'],
            ['אין לי ספר', 'I don\'t have a book — ein li sefer'],
            ['יש פה מורה', 'There\'s a teacher here'],
            ['אין פה מורה', 'There\'s no teacher here'],
          ]} />
        </div>
        <div>
          <SectionLabel>אל (al) — Negative Imperative (Don\'t!)</SectionLabel>
          <PhraseList pairs={[
            ['אל תדבר!', 'Don\'t speak! — al tedaber!'],
            ['אל תלך!', 'Don\'t go! — al telech!'],
          ]} />
        </div>
        <NoteBox>
          Summary: <strong>לא</strong> negates verbs and adjectives · <strong>אין</strong> negates יש (existence/possession) · <strong>אל + future</strong> for negative commands (imperative).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Questions ────────────────────────────────────────────────────────────────

export function HeQuestionsCard() {
  const qwords: [string, string, string][] = [
    ['מה', 'ma', 'what'],
    ['מי', 'mi', 'who'],
    ['איפה / היכן', 'eifo / heichan', 'where (informal / formal)'],
    ['מתי', 'matai', 'when'],
    ['למה / מדוע', 'lama / madua', 'why (informal / formal)'],
    ['איך / כיצד', 'eich / keitsad', 'how (informal / formal)'],
    ['כמה', 'kama', 'how much / how many'],
    ['איזה / אילו', 'eize / eilu', 'which (m.s. / pl.)'],
    ['מאין', 'meayin', 'from where (whence)'],
    ['לאן', 'lean', 'to where (whither)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>שאלות — Question Words</SectionLabel>
        <ConjTable rows={qwords} headers={['Hebrew', 'Transliteration', 'Meaning']} />
        <div className="mt-3">
          <SectionLabel>Yes/No Questions</SectionLabel>
          <p className="text-sm text-muted-foreground mb-2">Add <strong>האם (ha-im)</strong> at the start for formal yes/no questions, or simply use rising intonation:</p>
          <PhraseList pairs={[
            ['האם אתה מדבר עברית?', 'Do you speak Hebrew? (formal)'],
            ['אתה מדבר עברית?', 'Do you speak Hebrew? (intonation)'],
            ['?כן / לא', 'Yes / No — ken / lo'],
          ]} />
        </div>
        <NoteBox>
          Hebrew question words typically come first in the sentence, just like English. The word order is: Question Word → Subject → Verb → Object. Unlike some languages, Hebrew doesn't invert subject and verb for questions.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Yesh / Ein — Existence ────────────────────────────────────────────────────

export function HeYeshEinCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>יש / אין — Existence & Possession</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3"><strong>יש (yesh)</strong> = "there is / I have" · <strong>אין (ein)</strong> = "there isn't / I don't have." Combined with pronoun suffixes, they express possession.</p>

        <div className="mb-3">
          <SectionLabel>Possession with Pronoun Suffixes</SectionLabel>
          <ConjTable rows={[
            ['I have', 'יש לי', 'yesh li'],
            ['You have (m.)', 'יש לך', 'yesh lecha'],
            ['You have (f.)', 'יש לך', 'yesh lach'],
            ['He has', 'יש לו', 'yesh lo'],
            ['She has', 'יש לה', 'yesh la'],
            ['We have', 'יש לנו', 'yesh lanu'],
            ['You have (pl.)', 'יש לכם / לכן', 'yesh lachem / lachen'],
            ['They have', 'יש להם / להן', 'yesh lahem / lahen'],
          ]} headers={['Meaning', 'Hebrew', 'Transliteration']} />
        </div>
        <PhraseList pairs={[
          ['יש לי שאלה', 'I have a question — yesh li she\'ela'],
          ['אין לו זמן', 'He doesn\'t have time — ein lo zman'],
          ['יש כאן בעיה', 'There\'s a problem here — yesh kan be\'aya'],
          ['אין בעיה!', 'No problem! — ein be\'aya!'],
        ]} />
      </CardContent>
    </Card>
  );
}

// ── Possession — Shel ─────────────────────────────────────────────────────────

export function HePossessionCard() {
  const rows: [string, string, string][] = [
    ['my', 'שֶׁלִּי', 'sheli'],
    ['your (m.s.)', 'שֶׁלְּךָ', 'shelecha'],
    ['your (f.s.)', 'שֶׁלָּךְ', 'shelach'],
    ['his', 'שֶׁלּוֹ', 'shelo'],
    ['her', 'שֶׁלָּהּ', 'shela'],
    ['our', 'שֶׁלָּנוּ', 'shelanu'],
    ['your (m.pl.)', 'שֶׁלָּכֶם', 'shelachem'],
    ['their', 'שֶׁלָּהֶם', 'shelahem'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>שייכות — Possession with שֶׁל (shel)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3"><strong>של (shel)</strong> = "of/belonging to." It combines with pronoun suffixes to form possessive pronouns. Placed after the noun it modifies.</p>
        <ConjTable rows={rows} headers={['Meaning', 'Hebrew', 'Transliteration']} />
        <div className="mt-3">
          <SectionLabel>Examples</SectionLabel>
          <PhraseList pairs={[
            ['הספר שלי', 'my book — hasefer sheli'],
            ['הבית שלהם', 'their house — habayit shelahem'],
            ['המכונית של דנה', 'Dana\'s car — hamekhonit shel Dana'],
          ]} />
        </div>
        <NoteBox>
          Hebrew also has <strong>construct state</strong> (סמיכות/smichut) for possession — a grammatical structure where two nouns fuse. But של + noun is the everyday spoken alternative and is fully correct in all registers.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Prepositions ──────────────────────────────────────────────────────────────

export function HePrepositionsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>מילות יחס — Prepositions (Attached & Separate)</SectionLabel>
        <div className="mb-4">
          <SectionLabel>The Four Attached Prepositions (Inseparable)</SectionLabel>
          <div className="rounded-md border border-border overflow-hidden text-sm">
            <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span>Prefix</span><span>Meaning</span><span>Example</span>
            </div>
            {[
              ['בּ (be/ba)', 'in, at, with, by', 'בבית (babayit) — at home'],
              ['כּ (ke/ka)', 'like, as, approximately', 'כמו שיר (kemo shir) — like a song'],
              ['לְ (le/la)', 'to, for, belonging to', 'לבית הספר (leveit hasefer) — to school'],
              ['מִ/מֵ (mi/me)', 'from, than', 'מישראל (miyisrael) — from Israel'],
            ].map(([prep, meaning, ex], i) => (
              <div key={i} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                <span className={`font-bold ${HE}`}>{prep}</span>
                <span className="text-muted-foreground">{meaning}</span>
                <span className="text-muted-foreground text-xs">{ex}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Common Separate Prepositions</SectionLabel>
          <PhraseList pairs={[
            ['על (al)', 'on, about'],
            ['עם (im)', 'with'],
            ['אל (el)', 'to, toward (motion)'],
            ['עד (ad)', 'until, up to'],
            ['בין (bein)', 'between'],
            ['נגד (neged)', 'against'],
            ['בלי (bli)', 'without'],
            ['בשביל (bishvil)', 'for (the sake of)'],
          ]} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Numbers ────────────────────────────────────────────────────────────────────

export function HeNumbersCard() {
  const numbers: [string, string, string, string][] = [
    ['1', 'אֶחָד / אַחַת', 'echad / achat', 'm / f'],
    ['2', 'שְׁנַיִם / שְׁתַּיִם', 'shnayim / shtayim', 'm / f'],
    ['3', 'שְׁלֹשָׁה / שָׁלֹשׁ', 'shlosha / shalosh', 'm / f'],
    ['4', 'אַרְבָּעָה / אַרְבַּע', 'arba\'a / arba', 'm / f'],
    ['5', 'חֲמִשָּׁה / חָמֵשׁ', 'chamisha / chamesh', 'm / f'],
    ['6', 'שִׁשָּׁה / שֵׁשׁ', 'shisha / shesh', 'm / f'],
    ['7', 'שִׁבְעָה / שֶׁבַע', 'shiv\'a / sheva', 'm / f'],
    ['8', 'שְׁמוֹנָה / שְׁמוֹנֶה', 'shmona / shmone', 'm / f'],
    ['9', 'תִּשְׁעָה / תֵּשַׁע', 'tish\'a / tesha', 'm / f'],
    ['10', 'עֲשָׂרָה / עֶשֶׂר', 'asara / eser', 'm / f'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>מספרים — Numbers 1–10</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>#</span><span>Hebrew</span><span>Transliteration</span><span>Note</span>
          </div>
          {numbers.map(([num, heb, translit, note], i) => (
            <div key={num} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-bold">{num}</span>
              <span className={`font-semibold ${HE}`}>{heb}</span>
              <span className="text-muted-foreground italic">{translit}</span>
              <span className="text-muted-foreground text-xs">{note}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Counterintuitive gender rule:</strong> In Hebrew, masculine numbers are used with <em>feminine</em> nouns, and feminine numbers with <em>masculine</em> nouns! Example: שלוש בנות (shalosh banot) = "three girls" (f noun → feminine number form shalosh). Larger numbers (11–19) follow a different pattern. For ordinals: ראשון (rishon) = first, שני (sheni) = second, etc.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Time Expressions ──────────────────────────────────────────────────────────

export function HeTimeCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>זמן — Time Expressions</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Relative Time</SectionLabel>
            <PhraseList pairs={[
              ['אתמול', 'yesterday — etmol'],
              ['היום', 'today — hayom'],
              ['מחר', 'tomorrow — machar'],
              ['שלשום', 'the day before yesterday — shilshom'],
              ['מחרתיים', 'the day after tomorrow — macharatayim'],
              ['עכשיו', 'now — achshav'],
              ['מאוחר יותר', 'later — me\'uchar yoter'],
              ['לפני כן', 'before — lifnei chen'],
              ['אחר כך', 'after that — achar kach'],
            ]} />
          </div>
          <div>
            <SectionLabel>Clock Time</SectionLabel>
            <PhraseList pairs={[
              ['מה השעה?', 'What time is it? — ma hasha\'a?'],
              ['השעה שתיים', 'It\'s two o\'clock — hasha\'a shtayim'],
              ['בשעה שלוש', 'At three o\'clock — besha\'a shalosh'],
              ['חצות', 'midnight — chatsot'],
              ['בוקר', 'morning — boker'],
              ['צהריים', 'noon — tsohorayim'],
              ['ערב', 'evening — erev'],
              ['לילה', 'night — layla'],
              ['רבע לשלוש', 'quarter to three — reva leshalosh'],
              ['חצי שתיים', 'half past two — chatsi shtayim'],
            ]} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Construct State (Smichut) ────────────────────────────────────────────────

export function HeConstructCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>סמיכות — Construct State (Genitive)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">The <strong>construct state (smichut)</strong> links two nouns in a genitive (possessive/relational) relationship — "X of Y." The first noun (possessed) takes a special <em>construct form</em>; the article goes only on the second noun (possessor).</p>

        <div className="mb-3">
          <SectionLabel>Common Patterns</SectionLabel>
          <div className="rounded-md border border-border overflow-hidden text-sm">
            <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span>Construct Chain</span><span>Transliteration</span><span>Meaning</span>
            </div>
            {[
              ['בֵּית סֵפֶר', 'beit sefer', 'school (lit. house of book)'],
              ['יַד הָאִישׁ', 'yad ha\'ish', 'the man\'s hand'],
              ['עִיר הַבִּירָה', 'ir habira', 'the capital city (city of the capital)'],
              ['מְנַהֵל הַבַּנְק', 'menahel habank', 'the bank manager (manager of the bank)'],
              ['כּוֹס מַיִם', 'kos mayim', 'a glass of water'],
              ['שַׁנַּת לִימּוּדִים', 'shnat limudim', 'academic year (year of studies)'],
            ].map(([heb, translit, en], i) => (
              <div key={i} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                <span className={`font-semibold ${HE}`}>{heb}</span>
                <span className="text-muted-foreground italic">{translit}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>
        <NoteBox>
          <strong>Key rules:</strong> 1) No article (ה) on the first noun — definiteness is shown only on the last noun. 2) Feminine nouns often change their ending from ה- to ת- in construct: מדינה → מדינת (medina → medinat). 3) Construct chains can be 3+ nouns: מנהל בית הספר = "the school principal."
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Adjective Agreement ────────────────────────────────────────────────────────

export function HeAdjCard() {
  const rows: [string, string, string][] = [
    ['m.s. indefinite', 'כלב גדול (kelev gadol)', 'a big dog'],
    ['f.s. indefinite', 'חתולה גדולה (chatula gdola)', 'a big cat (f.)'],
    ['m.pl. indefinite', 'כלבים גדולים (klavim gdolim)', 'big dogs'],
    ['f.pl. indefinite', 'חתולות גדולות (chatuot gdolot)', 'big cats (f.pl.)'],
    ['m.s. definite', 'הכלב הגדול (hakelev hagadol)', 'the big dog'],
    ['f.s. definite', 'החתולה הגדולה (hachatula hag-dola)', 'the big cat'],
    ['m.pl. definite', 'הכלבים הגדולים (haklavim hag-dolim)', 'the big dogs'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>תואר שם — Adjective Agreement</SectionLabel>
        <ConjTable rows={rows} headers={['Form', 'Hebrew', 'English']} />
        <div className="mt-3">
          <SectionLabel>Common Adjectives (m.s. → f.s. → m.pl. → f.pl.)</SectionLabel>
          <PhraseList pairs={[
            ['גדול / גדולה / גדולים / גדולות', 'big (gadol/gdola/gdolim/gdolot)'],
            ['קטן / קטנה / קטנים / קטנות', 'small (katan/ktana/ktanim/ktanot)'],
            ['טוב / טובה / טובים / טובות', 'good (tov/tova/tovim/tovot)'],
            ['יפה / יפה / יפים / יפות', 'beautiful — same m/f singular!'],
            ['חדש / חדשה / חדשים / חדשות', 'new (chadash/chadasha/chadashim/chadashot)'],
          ]} />
        </div>
      </CardContent>
    </Card>
  );
}
