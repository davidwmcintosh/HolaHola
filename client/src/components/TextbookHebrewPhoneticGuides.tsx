import { Card, CardContent } from "@/components/ui/card";

const HE = "text-blue-700 dark:text-blue-400";
const HE_BG = "bg-blue-500/10";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-wider ${HE} mb-2`}>{children}</p>;
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-md ${HE_BG} border border-blue-300/30 dark:border-blue-700/40 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

// ── 1. Alef-Bet Consonant Chart ───────────────────────────────────────────────

export function HeAlefBetChartCard() {
  const letters: [string, string, string, string][] = [
    ['א', 'Alef', 'ʔ / silent', 'Glottal stop; silent in modern Israeli Hebrew'],
    ['ב', 'Bet', 'b', 'Dagesh: b; no dagesh: v (vet)'],
    ['ג', 'Gimel', 'g', 'Hard g; in some communities: j (dj)'],
    ['ד', 'Dalet', 'd', 'Standard d; historical: voiced dental fricative'],
    ['ה', 'He', 'h', 'Like English h; often silent at end of word'],
    ['ו', 'Vav', 'v', 'Consonant v; also vowel holder for oo/oh'],
    ['ז', 'Zayin', 'z', 'Like zoo'],
    ['ח', 'Het', 'x / ḥ', 'Voiceless velar fricative — like Bach or Spanish jota'],
    ['ט', 'Tet', 't', 'Emphatic t (originally pharyngealized; now same as tav in Modern Hebrew)'],
    ['י', 'Yod', 'y', 'Like yes; also vowel for /i/'],
    ['כ / ך', 'Kaf', 'k / x', 'Dagesh: k; no dagesh: kh (like het)'],
    ['ל', 'Lamed', 'l', 'Clear l — no dark l as in English'],
    ['מ / ם', 'Mem', 'm', 'Standard m; final form ם'],
    ['נ / ן', 'Nun', 'n', 'Standard n; final form ן'],
    ['ס', 'Samekh', 's', 'Standard s — identical to sin (שׂ) in Modern Hebrew'],
    ['ע', 'Ayin', 'ʕ / silent', 'Pharyngeal; silent in Modern Israeli; pronounced in Mizrahi & Yemenite'],
    ['פ / ף', 'Pe', 'p / f', 'Dagesh: p; no dagesh: f (fe)'],
    ['צ / ץ', 'Tsadi', 'ts', 'Affricate — like "cats"; final form ץ'],
    ['ק', 'Qof', 'k', 'Uvular in tradition; plain k in Modern Hebrew'],
    ['ר', 'Resh', 'r', 'Uvular trill/fricative — similar to French r; or alveolar tap'],
    ['שׁ', 'Shin', 'ʃ (sh)', 'Dot on right: sh as in "shoe"'],
    ['שׂ', 'Sin', 's', 'Dot on left: s — identical to samekh in Modern Hebrew'],
    ['ת', 'Tav', 't', 'Standard t; Ashkenazi: s in some words (shabbos)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>האלף-בית המלא — Complete Consonant Chart</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Letter</span><span>Name</span><span>Sound (IPA)</span><span>Production</span>
          </div>
          {letters.map(([letter, name, sound, note], i) => (
            <div key={name} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`text-lg font-bold ${HE} text-right`}>{letter}</span>
              <span className="font-semibold">{name}</span>
              <span className="text-muted-foreground">{sound}</span>
              <span className="text-muted-foreground text-xs">{note}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>BeGaDKeFaT letters:</strong> The 6 letters ב ג ד כ פ ת were historically pronounced differently with or without a dagesh. Today, only ב, כ, פ retain this distinction (b/v, k/kh, p/f). The others (ג, ד, ת) are pronounced the same with or without dagesh in Modern Hebrew.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 2. Vowel System (Niqqud) ─────────────────────────────────────────────────

export function HeVowelSystemCard() {
  const vowels: [string, string, string, string][] = [
    ['ָ (Qamats)', 'ah [aː]', 'Long', 'אָב (av) — father · דָּבָר (davar) — thing'],
    ['ַ (Patach)', 'ah [a]', 'Short', 'יַד (yad) — hand · אַתָּה (ata) — you (m)'],
    ['ֵ (Tsere)', 'ey [eː]', 'Long', 'שֵׁם (shem) — name · בֵּן (ben) — son'],
    ['ֶ (Segol)', 'eh [ɛ]', 'Short', 'מֶלֶך (melech) — king · יֶלֶד (yeled) — boy'],
    ['ִ (Hiriq)', 'ee [i]', 'Short/long', 'מִי (mi) — who · בִּגְדָה (bigda) — treason'],
    ['ֹ (Holam)', 'oh [oː]', 'Long', 'תּוֹרָה (tora) — Torah · שָׁלוֹם (shalom) — peace'],
    ['ֻ (Qibbuts)', 'oo [u]', 'Short', 'חֻפָּה (chupa) — wedding canopy'],
    ['ּ (Shuruk)', 'oo [uː]', 'Long', 'שׁוּק (shuk) — market · תּוּ (tu) — note (music)'],
    ['ְ (Sheva)', 'silent / ĕ', 'Ultra-short', 'בְּרָכָה (bracha) — blessing; silent at syllable end'],
    ['ֲ (Hataf Patach)', 'ah (very short)', 'Reduced', 'אֲנִי (ani) — I; only under gutturals א ה ח ע'],
    ['ֱ (Hataf Segol)', 'eh (very short)', 'Reduced', 'אֱלֹהִים (elohim) — God; only under gutturals'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>ניקוד — The Hebrew Vowel System</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Hebrew vowels are written as <strong>dots and dashes below, above, or inside letters</strong> (niqqud). Printed Hebrew for adults omits niqqud — readers rely on context and root knowledge.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Vowel</span><span>Sound</span><span>Length</span><span>Example</span>
          </div>
          {vowels.map(([vowel, sound, length, ex], i) => (
            <div key={vowel} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`font-bold ${HE}`}>{vowel}</span>
              <span className="text-muted-foreground">{sound}</span>
              <span className="text-muted-foreground">{length}</span>
              <span className="text-muted-foreground text-xs">{ex}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Modern Israeli simplification:</strong> Modern Israeli Hebrew has collapsed many classical vowel distinctions. Qamats, Patach, and Hataf-Patach all sound like /a/. Tsere and Segol both sound like /e/. The result: effectively 5 vowels (a, e, i, o, u) in casual speech, much simpler than classical systems.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 3. Guttural Letters ──────────────────────────────────────────────────────

export function HeGutturalsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>אותיות הגרון — Guttural Letters</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Hebrew has four <strong>guttural letters</strong>: א, ה, ח, ע (and sometimes ר). They are produced in the throat and follow special grammatical rules, particularly in verb conjugation.</p>

        <div className="rounded-md border border-border overflow-hidden text-sm mb-4">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Letter</span><span>Sound</span><span>Note</span>
          </div>
          {[
            ['א (Alef)', 'Glottal stop / silent', 'In Modern Hebrew, fully silent; no dagesh ever'],
            ['ה (He)', 'h (or silent)', 'Often silent word-final; no dagesh ever'],
            ['ח (Het)', 'Voiceless pharyngeal fricative', 'Like "Bach" in German; strong in Mizrahi pronunciation'],
            ['ע (Ayin)', 'Voiced pharyngeal fricative (silent in Modern)', 'Strong "guttural" in Arabic; silent in Israeli Hebrew'],
            ['ר (Resh)', 'Uvular trill or fricative', 'Not historically pharyngeal, but behaves like guttural in grammar'],
          ].map(([letter, sound, note], i) => (
            <div key={letter} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`font-bold ${HE}`}>{letter}</span>
              <span className="text-muted-foreground">{sound}</span>
              <span className="text-muted-foreground text-xs">{note}</span>
            </div>
          ))}
        </div>

        <SectionLabel>Grammatical Effects of Gutturals</SectionLabel>
        <div className="space-y-2 text-sm">
          {[
            ['No dagesh', 'Gutturals never take a dagesh (the dot indicating doubled/hard consonant)'],
            ['Hataf vowels', 'When a sheva (ְ) would appear under a guttural, it becomes a hataf (composite) vowel instead'],
            ['Patach furtivum', 'Before final ח, a patach (a) vowel is inserted: רוּחַ (ruach) = wind; ל וּחַ (luach) = board'],
            ['Article vowel change', 'The definite article ה changes its vowel before gutturals: הָ before א ע; הֶ before ח ה unaccented'],
          ].map(([rule, ex]) => (
            <div key={rule} className="rounded-md bg-muted/40 border border-border/40 px-3 py-2">
              <span className={`font-semibold ${HE}`}>{rule}: </span>
              <span className="text-muted-foreground text-xs">{ex}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 4. Shin / Sin Distinction ─────────────────────────────────────────────────

export function HeShimSinCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>שׁ vs שׂ — Shin and Sin</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">The letter <strong>שׁ</strong> represents TWO distinct sounds, distinguished only by a dot (shin-dot):</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="rounded-md border border-border/50 bg-muted/20 p-3">
            <p className={`font-bold text-2xl mb-2 ${HE}`}>שׁ</p>
            <p className="font-semibold">Shin — dot on the RIGHT</p>
            <p className="text-sm text-muted-foreground">Sound: <strong>sh</strong> as in "shoe"</p>
            <p className="text-sm text-muted-foreground mt-1">Examples:</p>
            <div className="space-y-0.5 text-sm">
              {[
                ['שָׁלוֹם (shalom)', 'peace / hello'],
                ['שֵׁם (shem)', 'name'],
                ['שָׁנָה (shana)', 'year'],
              ].map(([he, en]) => (
                <div key={he}><span className={`font-semibold ${HE}`}>{he}</span> — {en}</div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border/50 bg-muted/20 p-3">
            <p className={`font-bold text-2xl mb-2 ${HE}`}>שׂ</p>
            <p className="font-semibold">Sin — dot on the LEFT</p>
            <p className="text-sm text-muted-foreground">Sound: <strong>s</strong> as in "sun"</p>
            <p className="text-sm text-muted-foreground mt-1">Examples:</p>
            <div className="space-y-0.5 text-sm">
              {[
                ['שָׂמֵחַ (same\'ach)', 'happy'],
                ['שָׂפָה (safa)', 'language / lip'],
                ['שָׂדֶה (sadeh)', 'field'],
              ].map(([he, en]) => (
                <div key={he}><span className={`font-semibold ${HE}`}>{he}</span> — {en}</div>
              ))}
            </div>
          </div>
        </div>

        <NoteBox>
          <strong>Practical note:</strong> In unvowelized text (standard adult Hebrew), both shin and sin look identical: <span className={`font-bold ${HE}`}>ש</span>. You must know from context or root knowledge which sound to use. In practice, sin (שׂ) is far less common than shin (שׁ), and in many words it has merged with samekh (ס) in pronunciation.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 5. Dagesh ────────────────────────────────────────────────────────────────

export function HeDageshCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>דגש — Dagesh (The Dot in a Letter)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">A <strong>dagesh</strong> (דָּגֵשׁ) is a dot placed <em>inside</em> a Hebrew letter. It has two distinct functions depending on the letter:</p>

        <div className="mb-4">
          <SectionLabel>1. Dagesh Kal (Light Dagesh) — BeGaDKeFaT Letters</SectionLabel>
          <p className="text-sm text-muted-foreground mb-2">In the six letters <strong>ב ג ד כ פ ת</strong>, dagesh changes the pronunciation:</p>
          <div className="rounded-md border border-border overflow-hidden text-sm">
            <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span>Letter</span><span>With Dagesh</span><span>Without Dagesh</span><span>Active today?</span>
            </div>
            {[
              ['ב', 'b (bet)', 'v (vet)', 'Yes'],
              ['ג', 'g', 'gh (historical)', 'No — always g'],
              ['ד', 'd', 'dh (historical)', 'No — always d'],
              ['כ', 'k (kaf)', 'kh (khaf)', 'Yes'],
              ['פ', 'p (pe)', 'f (fe)', 'Yes'],
              ['ת', 't', 'th / s (historical)', 'No — always t (Modern)'],
            ].map(([letter, with_d, without_d, active], i) => (
              <div key={letter} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                <span className={`text-xl font-bold ${HE}`}>{letter}</span>
                <span className="text-muted-foreground">{with_d}</span>
                <span className="text-muted-foreground">{without_d}</span>
                <span className="text-muted-foreground text-xs">{active}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>2. Dagesh Chazak (Strong Dagesh) — Doubling</SectionLabel>
          <p className="text-sm text-muted-foreground mb-2">In all other letters (and in BeGaDKeFaT too), dagesh indicates a <em>doubled</em> consonant (historically). Important in Pi'el verb conjugation and other patterns:</p>
          <div className="space-y-1 text-sm">
            {[
              ['דִּבֵּר (diber)', 'he spoke — middle ב has strong dagesh = doubled b (Pi\'el marker)'],
              ['שִׁבֵּר (shiber)', 'he broke — Pi\'el; ב dagesh'],
              ['רִפֵּא (ripe)', 'he healed — Pi\'el pattern'],
            ].map(([heb, en]) => (
              <div key={heb} className="rounded-md bg-muted/40 border border-border/40 px-3 py-1.5">
                <span className={`font-semibold ${HE}`}>{heb}</span>
                <span className="text-muted-foreground"> — {en}</span>
              </div>
            ))}
          </div>
        </div>
        <NoteBox>
          Gutturals (א ה ח ע) and resh (ר) <strong>never</strong> take a dagesh. This causes compensatory lengthening of the preceding vowel in some grammatical contexts (qamats instead of patach, etc.).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 6. Stress Patterns ──────────────────────────────────────────────────────

export function HeStressCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>הטעמה — Stress Patterns in Hebrew</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Modern Hebrew stress is <strong>mostly word-final (milra — מִלְרַע)</strong>, meaning the last syllable is stressed. Some words have penultimate stress (mil'el — מִלְעֵיל) and must be memorized.</p>

        <div className="mb-4">
          <SectionLabel>Milra — Final Stress (Most Common)</SectionLabel>
          <div className="space-y-1 text-sm">
            {[
              ['שָׁלוֹם', 'sha-LOM — peace/hello'],
              ['תּוֹדָה', 'to-DA — thank you'],
              ['יְרוּשָׁלַיִם', 'yeru-sha-LA-yim — Jerusalem'],
              ['בָּרוּךְ', 'ba-RUCH — blessed'],
            ].map(([heb, en]) => (
              <div key={heb} className="flex gap-3">
                <span className={`font-bold shrink-0 ${HE}`}>{heb}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <SectionLabel>Mil'el — Penultimate Stress (Must Memorize)</SectionLabel>
          <div className="space-y-1 text-sm">
            {[
              ['שֻׁלְחָן', 'SHUL-chan — table'],
              ['סֵפֶר', 'SE-fer — book'],
              ['יֶלֶד', 'YE-led — boy'],
              ['בֹּקֶר', 'BO-ker — morning'],
            ].map(([heb, en]) => (
              <div key={heb} className="flex gap-3">
                <span className={`font-bold shrink-0 ${HE}`}>{heb}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Stress and Meaning Distinction</SectionLabel>
          <div className="space-y-1 text-sm">
            {[
              ['בָּא (BA) vs. בָּא (ba-A)', 'BA = come! (imperative, stress on first) · ba-A = he came (stress shift varies by dialect)'],
              ['שָׁמַרְנוּ (sha-MAR-nu)', 'we kept — but future נִשְׁמֹר (nish-MOR) — we will keep'],
            ].map(([ex, note]) => (
              <div key={ex} className="rounded-md bg-muted/40 border border-border/40 px-3 py-2">
                <div className={`font-semibold text-sm ${HE}`}>{ex}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{note}</div>
              </div>
            ))}
          </div>
        </div>
        <NoteBox>
          Modern Israeli Hebrew has largely regularized stress to final syllables, especially in casual speech. But knowing penultimate-stress words like יֶלֶד (yeled), סֵפֶר (sefer), and מֶלֶך (melech) is essential to sound natural.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 7. Modern vs. Biblical Pronunciation ────────────────────────────────────

export function HeModernBiblicalCard() {
  const diffs: [string, string, string][] = [
    ['ח (Het)', 'Voiceless pharyngeal /ħ/', 'Voiceless velar /x/ (like Bach) or aspirated h'],
    ['ע (Ayin)', 'Voiced pharyngeal /ʕ/', 'Silent (not pronounced)'],
    ['ק (Qof)', 'Uvular stop /q/', 'Velar stop /k/ (same as כ with dagesh)'],
    ['ר (Resh)', 'Alveolar trill or tap /r/', 'Uvular fricative /ʁ/ (like French r)'],
    ['Qamats ָ', '/aː/ — long a', '/a/ — same as patach; length distinction lost'],
    ['Sheva ְ', 'Ultra-short /ĕ/ in many positions', 'Often reduced to zero (silent) in casual speech'],
    ['Long vs. short vowels', 'Distinct in classical meter (poetry)', 'Not distinguished in modern pronunciation'],
    ['Tav ת', '/t/ (Sephardic) · /s/ (Ashkenazi)', '/t/ in all Israeli Hebrew'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>עברית מקראית vs. מודרנית — Biblical vs. Modern Hebrew Pronunciation</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Feature</span><span>Biblical / Classical</span><span>Modern Israeli</span>
          </div>
          {diffs.map(([feature, classical, modern], i) => (
            <div key={feature} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`font-semibold ${HE}`}>{feature}</span>
              <span className="text-muted-foreground text-xs">{classical}</span>
              <span className="text-muted-foreground text-xs">{modern}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Which to learn?</strong> For communication in Israel → Modern Israeli Hebrew pronunciation. For reading Torah, Talmud, or classical poetry → understand classical distinctions. Mizrahi-accented Hebrew (Ethiopian, Yemenite, Iraqi) preserves more classical phonemes and is considered by linguists to be historically closer to ancient pronunciation.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 8. Sheva and Vowel Reduction ─────────────────────────────────────────────

export function HeVowelReductionCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>שׁוָא ותנועות מוקטנות — Sheva & Vowel Reduction</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">The <strong>sheva (ְ)</strong> is one of the most important — and tricky — vowel signs in Hebrew. It has two functions: <em>silent</em> (sheva nach) and <em>mobile/pronounced</em> (sheva na).</p>

        <div className="mb-4">
          <SectionLabel>Sheva Nach (Silent Sheva)</SectionLabel>
          <p className="text-sm text-muted-foreground mb-2">Closes a syllable — completely silent. Appears at end of syllables:</p>
          <div className="space-y-1 text-sm">
            {[
              ['מַלְכָּה (malka)', 'queen — the ל has silent sheva: mal-ka'],
              ['בִּרְכָּה (bracha)', 'blessing — ר has silent sheva: bir-cha'],
            ].map(([heb, en]) => (
              <div key={heb} className="flex gap-2">
                <span className={`font-semibold shrink-0 ${HE}`}>{heb}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <SectionLabel>Sheva Na (Mobile Sheva) — Pronounced as short e</SectionLabel>
          <p className="text-sm text-muted-foreground mb-2">Appears at the beginning of a syllable — pronounced as a very short /ĕ/:</p>
          <div className="space-y-1 text-sm">
            {[
              ['בְּרָכָה (beracha)', 'blessing — initial ב has mobile sheva: be-ra-cha'],
              ['מְלָכִים (melakim)', 'kings — מ has mobile sheva: me-la-kim'],
            ].map(([heb, en]) => (
              <div key={heb} className="flex gap-2">
                <span className={`font-semibold shrink-0 ${HE}`}>{heb}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Patach Furtivum — Glide Before Final Guttural</SectionLabel>
          <p className="text-sm text-muted-foreground mb-2">A special patach inserted before a final ח, ה, or ע — pronounced <em>before</em> the guttural, not after:</p>
          <div className="space-y-1 text-sm">
            {[
              ['רוּחַ (ruach)', 'spirit/wind — pronounced roo-AH, not roo-chah'],
              ['שִׂמְחָה (simcha)', 'joy — special guttural pattern'],
              ['אֶרֶץ (erets)', 'land — final tsadi, no furtivum'],
            ].map(([heb, en]) => (
              <div key={heb} className="flex gap-2">
                <span className={`font-semibold shrink-0 ${HE}`}>{heb}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>
        <NoteBox>
          In Modern spoken Hebrew, many of these distinctions are blurred — mobile sheva often sounds just like a very brief pause. Mastering sheva is more important for reading and singing liturgy than for everyday conversation, but understanding it helps with recognizing root patterns.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 9. Pronunciation Overview ────────────────────────────────────────────────

export function HePronunciationOverviewCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>מדריך הגייה — Hebrew Pronunciation Overview</SectionLabel>

        <div className="space-y-3">
          {[
            {
              title: 'Start with the alphabet',
              detail: 'Learn all 22 letters and their sounds first. Pay special attention to: ח (voiceless guttural), ע (silent in Modern Hebrew), ר (uvular), and the BeGaDKeFaT alternations (b/v, k/kh, p/f).',
            },
            {
              title: 'Right-to-left reading',
              detail: 'Train your eye to scan right-to-left. Start with pointed (niqqud) texts — children\'s books, prayer books — before moving to unpointed adult texts.',
            },
            {
              title: 'Master the 5 vowel sounds',
              detail: 'Modern Hebrew has /a/, /e/, /i/, /o/, /u/. Focus on correct vowels in roots — wrong vowels change word meaning or make you sound unnatural.',
            },
            {
              title: 'The r sound (ר)',
              detail: 'Israeli Hebrew uses a uvular r similar to French — produced at the back of the throat, not the English /r/ tip. Practice: "gargling" motion with breath.',
            },
            {
              title: 'Stress: mostly final',
              detail: 'Default to stressing the LAST syllable. Common exceptions (penultimate stress) must be memorized: יֶלֶד (YE-led), סֵפֶר (SE-fer), בֹּקֶר (BO-ker).',
            },
            {
              title: 'Connect through roots',
              detail: 'Learning 3-letter roots (שורשים/shorashim) dramatically accelerates vocabulary. Once you know כ-ת-ב (to write), you instantly recognize כתיבה (writing), מכתב (letter), כתב (journalist), כתובת (address).',
            },
          ].map(({ title, detail }) => (
            <div key={title} className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
              <p className={`font-semibold text-sm mb-1 ${HE}`}>{title}</p>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Common beginner challenges:</strong> (1) Reading without vowel points — requires patience and root knowledge. (2) Gender agreement — every adjective, verb, and number must match the noun's gender. (3) The root system — different from European languages but once understood, makes vocabulary extremely systematic. (4) Writing direction — give it time; your brain adapts.
        </NoteBox>
      </CardContent>
    </Card>
  );
}
