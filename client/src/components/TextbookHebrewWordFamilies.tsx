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

interface WordEntry {
  word: string;
  translit: string;
  pos: string;
  meaning: string;
}

function HeRootFamilyCard({ root, rootTranslit, meaning, words, binyan }: {
  root: string;
  rootTranslit: string;
  meaning: string;
  words: WordEntry[];
  binyan?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className={`inline-block rounded-md ${HE_BG} border border-blue-300/30 dark:border-blue-700/40 px-3 py-1 mb-3`}>
          <span className={`text-lg font-bold ${HE} mr-2`}>{root}</span>
          <span className="text-sm font-semibold">{rootTranslit}</span>
          <span className="text-sm text-muted-foreground ml-2">— {meaning}</span>
          {binyan && <span className="text-xs text-muted-foreground ml-2">({binyan})</span>}
        </div>
        <SectionLabel>משפחת מילים — Word Family</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Hebrew</span><span>Translit.</span><span>Part of Speech</span><span>Meaning</span>
          </div>
          {words.map(({ word, translit, pos, meaning: m }, i) => (
            <div key={word} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`font-semibold text-right ${HE}`}>{word}</span>
              <span className="text-muted-foreground italic">{translit}</span>
              <span className="text-muted-foreground text-xs">{pos}</span>
              <span className="text-muted-foreground">{m}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>The Semitic root system:</strong> Hebrew builds vocabulary by applying different vowel patterns and affixes to the same 3-letter root (שורש/shoresh). Recognizing the root lets you guess the meaning of unfamiliar words — a huge vocabulary accelerator.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Root: ד-ב-ר (speech/word) ────────────────────────────────────────────────

export function HeDBRFamilyCard() {
  return (
    <HeRootFamilyCard
      root="ד-ב-ר"
      rootTranslit="D-B-R"
      meaning="speech, word, thing"
      binyan="Pa'al / Pi'el"
      words={[
        { word: 'לְדַבֵּר', translit: 'ledaber', pos: 'verb (Pi\'el)', meaning: 'to speak' },
        { word: 'דִּיבּוּר', translit: 'dibur', pos: 'noun (m.)', meaning: 'speech, speaking' },
        { word: 'דָּבָר', translit: 'davar', pos: 'noun (m.)', meaning: 'word, thing, matter' },
        { word: 'דְּבָרִים', translit: 'devarim', pos: 'noun (m.pl.)', meaning: 'words, things (also Deuteronomy)' },
        { word: 'מְדַבֵּר', translit: 'medaber', pos: 'adjective', meaning: 'speaking (m.s.)' },
        { word: 'דַּבְּרָן', translit: 'dabran', pos: 'noun (m.)', meaning: 'talkative person, chatterbox' },
        { word: 'מִדְבָּר', translit: 'midbar', pos: 'noun (m.)', meaning: 'desert, wilderness (place where one "speaks"/wanders)' },
        { word: 'דִּבּוּרִי', translit: 'diburi', pos: 'adjective', meaning: 'verbal, spoken' },
      ]}
    />
  );
}

// ── Root: כ-ת-ב (writing) ────────────────────────────────────────────────────

export function HeKTVFamilyCard() {
  return (
    <HeRootFamilyCard
      root="כ-ת-ב"
      rootTranslit="K-T-V"
      meaning="writing"
      binyan="Pa'al / Pi'el"
      words={[
        { word: 'לִכְתּוֹב', translit: 'lichtov', pos: 'verb (Pa\'al)', meaning: 'to write' },
        { word: 'כְּתִיבָה', translit: 'ktiva', pos: 'noun (f.)', meaning: 'writing, handwriting' },
        { word: 'מִכְתָּב', translit: 'michtav', pos: 'noun (m.)', meaning: 'letter (correspondence)' },
        { word: 'כָּתַב', translit: 'katav', pos: 'noun (m.)', meaning: 'journalist, reporter; script' },
        { word: 'כְּתֹבֶת', translit: 'ktovet', pos: 'noun (f.)', meaning: 'address; inscription; tattoo' },
        { word: 'כְּתוּב', translit: 'katuv', pos: 'adjective', meaning: 'written' },
        { word: 'כְּתָב יָד', translit: 'ktav yad', pos: 'noun phrase', meaning: 'handwriting (lit. hand-writing)' },
        { word: 'כְּתָב עֵת', translit: 'ktav et', pos: 'noun phrase', meaning: 'periodical, journal' },
      ]}
    />
  );
}

// ── Root: ל-מ-ד (learning) ───────────────────────────────────────────────────

export function HeLMDFamilyCard() {
  return (
    <HeRootFamilyCard
      root="ל-מ-ד"
      rootTranslit="L-M-D"
      meaning="learning, teaching"
      binyan="Pa'al / Pi'el"
      words={[
        { word: 'לִלְמוֹד', translit: 'lilmod', pos: 'verb (Pa\'al)', meaning: 'to learn, to study' },
        { word: 'לְלַמֵּד', translit: 'lelamd', pos: 'verb (Pi\'el)', meaning: 'to teach' },
        { word: 'לִמּוּד', translit: 'limud', pos: 'noun (m.)', meaning: 'study, learning; lesson' },
        { word: 'מוֹרֶה / מוֹרָה', translit: 'more / mora', pos: 'noun (m./f.)', meaning: 'teacher (m./f.)' },
        { word: 'תַּלְמִיד / תַּלְמִידָה', translit: 'talmid / talmida', pos: 'noun', meaning: 'student (m./f.)' },
        { word: 'לָמְדָן', translit: 'lamdan', pos: 'noun (m.)', meaning: 'scholar, learned person' },
        { word: 'מֶלְמָד', translit: 'melmed', pos: 'noun (m.)', meaning: 'teaching staff (historical: Torah teacher)' },
        { word: 'לִימוּדִים', translit: 'limudim', pos: 'noun (m.pl.)', meaning: 'studies, curriculum' },
      ]}
    />
  );
}

// ── Root: ה-ל-כ (going/walking) ─────────────────────────────────────────────

export function HeHLKFamilyCard() {
  return (
    <HeRootFamilyCard
      root="ה-ל-כ"
      rootTranslit="H-L-K"
      meaning="going, walking"
      binyan="Pa'al / Hif'il"
      words={[
        { word: 'לָלֶכֶת', translit: 'lalecet', pos: 'verb (Pa\'al)', meaning: 'to go, to walk' },
        { word: 'הֲלִיכָה', translit: 'halicha', pos: 'noun (f.)', meaning: 'walking, gait; manner of conduct' },
        { word: 'הֶלֶךְ', translit: 'helech', pos: 'noun (m.)', meaning: 'traveler, wanderer' },
        { word: 'מַהֲלָךְ', translit: 'mahalach', pos: 'noun (m.)', meaning: 'process, course, way' },
        { word: 'הִלֵּךְ', translit: 'hilech', pos: 'verb (Pi\'el)', meaning: 'to walk back and forth (biblical)' },
        { word: 'מַהֲלָכִים', translit: 'mahalachim', pos: 'noun (m.pl.)', meaning: 'proceedings, maneuvers' },
        { word: 'הוֹלֵךְ', translit: 'holech', pos: 'verb (present m.s.)', meaning: 'going, walking' },
        { word: 'דֶּרֶךְ', translit: 'derech', pos: 'noun (f.)', meaning: 'way, road, manner (related concept)' },
      ]}
    />
  );
}

// ── Root: א-כ-ל (eating) ────────────────────────────────────────────────────

export function HeAKLFamilyCard() {
  return (
    <HeRootFamilyCard
      root="א-כ-ל"
      rootTranslit="A-K-L"
      meaning="eating, food"
      binyan="Pa'al"
      words={[
        { word: 'לֶאֱכוֹל', translit: 'le\'echol', pos: 'verb (Pa\'al)', meaning: 'to eat' },
        { word: 'אֲכִילָה', translit: 'achila', pos: 'noun (f.)', meaning: 'eating, consumption' },
        { word: 'אֹכֶל', translit: 'ochel', pos: 'noun (m.)', meaning: 'food' },
        { word: 'מַאֲכָל', translit: 'ma\'achal', pos: 'noun (m.)', meaning: 'dish, food item, delicacy' },
        { word: 'אוֹכֵל', translit: 'ochel', pos: 'verb (present m.s.)', meaning: 'eating (he eats)' },
        { word: 'מִסְעָדָה', translit: 'mis\'ada', pos: 'noun (f.)', meaning: 'restaurant (related: place of eating)' },
        { word: 'אֲכִילָה כְּשֵׁרָה', translit: 'achila kshera', pos: 'phrase', meaning: 'kosher eating' },
        { word: 'בֵּית אוֹכֶל', translit: 'beit ochel', pos: 'noun phrase', meaning: 'canteen, dining hall' },
      ]}
    />
  );
}

// ── Root: ש-מ-ע (hearing) ────────────────────────────────────────────────────

export function HeSHMFamilyCard() {
  return (
    <HeRootFamilyCard
      root="ש-מ-ע"
      rootTranslit="SH-M-A"
      meaning="hearing, listening, obeying"
      binyan="Pa'al / Hif'il"
      words={[
        { word: 'לִשְׁמוֹעַ', translit: 'lishmo\'a', pos: 'verb (Pa\'al)', meaning: 'to hear, to listen' },
        { word: 'שְׁמִיעָה', translit: 'shmia', pos: 'noun (f.)', meaning: 'hearing, audition' },
        { word: 'שֵׁמַע', translit: 'shema', pos: 'noun (m.)', meaning: 'report, reputation; the Shema prayer' },
        { word: 'מִשְׁמַעַת', translit: 'mishma\'at', pos: 'noun (f.)', meaning: 'discipline, obedience' },
        { word: 'מַאֲזִין', translit: 'ma\'azin', pos: 'noun (m.)', meaning: 'listener; (Hif\'il participle)' },
        { word: 'הֶשְׁמִיעַ', translit: 'hishmia', pos: 'verb (Hif\'il past)', meaning: 'he made heard, he sounded' },
        { word: 'שָׁמוּעַ', translit: 'shamua', pos: 'adjective/noun', meaning: 'heard; rumor, hearsay' },
        { word: 'שִׁמְעוֹן', translit: 'Shimon', pos: 'proper noun', meaning: 'Simon/Simeon (lit. "he who hears")' },
      ]}
    />
  );
}

// ── Root: ר-א-ה (seeing) ────────────────────────────────────────────────────

export function HeRAHFamilyCard() {
  return (
    <HeRootFamilyCard
      root="ר-א-ה"
      rootTranslit="R-A-H"
      meaning="seeing, looking"
      binyan="Pa'al / Hif'il"
      words={[
        { word: 'לִרְאוֹת', translit: 'lirot', pos: 'verb (Pa\'al)', meaning: 'to see' },
        { word: 'רְאִיָּה', translit: 're\'iya', pos: 'noun (f.)', meaning: 'sight, vision, seeing' },
        { word: 'מַרְאֶה', translit: 'mar\'eh', pos: 'noun (m.)', meaning: 'sight, appearance; mirror' },
        { word: 'רְאִי', translit: 're\'i', pos: 'noun (m.)', meaning: 'mirror' },
        { word: 'הֶרְאָה', translit: 'her\'a', pos: 'verb (Hif\'il past)', meaning: 'he showed' },
        { word: 'מַרְאִית עַיִן', translit: 'mar\'it ayin', pos: 'noun phrase', meaning: 'appearance (to the eye)' },
        { word: 'נִרְאֶה', translit: 'nir\'eh', pos: 'verb (Nif\'al)', meaning: 'it seems / it appears / seems like' },
        { word: 'רוֹאֶה', translit: 'ro\'eh', pos: 'verb (present m.s.)', meaning: 'seeing (he sees)' },
      ]}
    />
  );
}

// ── Root: י-ד-ע (knowing) ────────────────────────────────────────────────────

export function HeYDAFamilyCard() {
  return (
    <HeRootFamilyCard
      root="י-ד-ע"
      rootTranslit="Y-D-A"
      meaning="knowing, knowledge"
      binyan="Pa'al / Hif'il"
      words={[
        { word: 'לָדַעַת', translit: 'lada\'at', pos: 'verb (Pa\'al)', meaning: 'to know' },
        { word: 'יֶדַע', translit: 'yeda', pos: 'noun (m.)', meaning: 'knowledge, information, data' },
        { word: 'מֵידָע', translit: 'meida', pos: 'noun (m.)', meaning: 'information (modern usage)' },
        { word: 'יְדִיעָה', translit: 'yedi\'a', pos: 'noun (f.)', meaning: 'knowledge; news item' },
        { word: 'יָדוּעַ', translit: 'yadu\'a', pos: 'adjective', meaning: 'known, famous, well-known' },
        { word: 'מַדָּע', translit: 'mada', pos: 'noun (m.)', meaning: 'science (lit. "that which is known")' },
        { word: 'מַדְעָן', translit: 'mad\'an', pos: 'noun (m.)', meaning: 'scientist' },
        { word: 'הוֹדִיעַ', translit: 'hodia', pos: 'verb (Hif\'il past)', meaning: 'he informed / announced' },
      ]}
    />
  );
}

// ── Root: א-ה-ב (love) ───────────────────────────────────────────────────────

export function HeAHBFamilyCard() {
  return (
    <HeRootFamilyCard
      root="א-ה-ב"
      rootTranslit="A-H-V"
      meaning="love, liking"
      binyan="Pa'al"
      words={[
        { word: 'לֶאֱהוֹב', translit: 'le\'ehov', pos: 'verb (Pa\'al)', meaning: 'to love, to like' },
        { word: 'אַהֲבָה', translit: 'ahava', pos: 'noun (f.)', meaning: 'love' },
        { word: 'אָהוּב', translit: 'ahuv', pos: 'adjective (m.)', meaning: 'beloved, loved, favorite' },
        { word: 'אֲהוּבָה', translit: 'ahuva', pos: 'adjective (f.) / name', meaning: 'beloved (f.); a common Hebrew name' },
        { word: 'אוֹהֵב', translit: 'ohev', pos: 'verb (present m.s.)', meaning: 'loving (he loves)' },
        { word: 'חֲבִיב', translit: 'chaviv', pos: 'adjective', meaning: 'dear, beloved (slightly different root, related concept)' },
        { word: 'לְאַהֵב', translit: 'le\'ahev', pos: 'verb (Pi\'el)', meaning: 'to cause to love; to endear (causative)' },
        { word: 'אַהֲבַת חִנָּם', translit: 'ahavat chinam', pos: 'phrase', meaning: 'unconditional love (lit. free love)' },
      ]}
    />
  );
}

// ── Root: ע-ז-ר (helping) ────────────────────────────────────────────────────

export function HeAZRFamilyCard() {
  return (
    <HeRootFamilyCard
      root="ע-ז-ר"
      rootTranslit="A-Z-R"
      meaning="helping, aid"
      binyan="Pa'al / Hif'il"
      words={[
        { word: 'לַעֲזוֹר', translit: 'la\'azor', pos: 'verb (Pa\'al)', meaning: 'to help, to assist' },
        { word: 'עֶזְרָה', translit: 'ezra', pos: 'noun (f.)', meaning: 'help, assistance, aid' },
        { word: 'עֵזֶר', translit: 'ezer', pos: 'noun (m.)', meaning: 'help, helper (biblical: עֵזֶר כְּנֶגְדּוֹ = matching helper)' },
        { word: 'עוֹזֵר', translit: 'ozer', pos: 'noun/adj (m.)', meaning: 'helper, assistant (m.)' },
        { word: 'עוֹזֶרֶת', translit: 'ozeret', pos: 'noun/adj (f.)', meaning: 'helper, housekeeper (f.)' },
        { word: 'בֵּית עֶזְרָה', translit: 'beit ezra', pos: 'noun phrase', meaning: 'aid organization, charity house' },
        { word: 'עֶזְרָה רִאשׁוֹנָה', translit: 'ezra rishona', pos: 'noun phrase', meaning: 'first aid' },
        { word: 'עָזַר', translit: 'azar', pos: 'proper noun', meaning: 'Ezra (the prophet/scribe — lit. "help")' },
      ]}
    />
  );
}

// ── Root: ש-מ-ח (joy) ────────────────────────────────────────────────────────

export function HeSMHFamilyCard() {
  return (
    <HeRootFamilyCard
      root="ש-מ-ח"
      rootTranslit="S-M-CH"
      meaning="joy, happiness"
      binyan="Pa'al / Pi'el"
      words={[
        { word: 'לִשְׂמוֹחַ', translit: 'lismoa\'ch', pos: 'verb (Pa\'al)', meaning: 'to be happy, to rejoice' },
        { word: 'שִׂמְחָה', translit: 'simcha', pos: 'noun (f.)', meaning: 'joy, happiness; a celebration/party' },
        { word: 'שָׂמֵחַ', translit: 'same\'ach', pos: 'adjective (m.)', meaning: 'happy, joyful' },
        { word: 'שְׂמֵחָה', translit: 'smeha', pos: 'adjective (f.)', meaning: 'happy (f.)' },
        { word: 'לְשַׂמֵּחַ', translit: 'lesamea\'ch', pos: 'verb (Pi\'el)', meaning: 'to make happy, to cheer up' },
        { word: 'מְשַׂמֵּחַ', translit: 'mesamea\'ch', pos: 'adjective', meaning: 'pleasing, gratifying' },
        { word: 'חַג שָׂמֵחַ!', translit: 'chag same\'ach!', pos: 'phrase', meaning: 'Happy holiday! (universal Jewish greeting)' },
        { word: 'מַזָּל טוֹב!', translit: 'mazal tov!', pos: 'phrase', meaning: 'Congratulations! (lit. good luck/fortune)' },
      ]}
    />
  );
}

// ── Resolver ─────────────────────────────────────────────────────────────────

export function resolveHeFamilyCard(title: string): JSX.Element {
  const lower = title.toLowerCase();
  if (lower.includes('דבר') || lower.includes('d-b-r') || lower.includes('dbr') || lower.includes('speak') || lower.includes('word')) return <HeDBRFamilyCard />;
  if (lower.includes('כתב') || lower.includes('k-t-v') || lower.includes('ktv') || lower.includes('writ') || lower.includes('letter')) return <HeKTVFamilyCard />;
  if (lower.includes('למד') || lower.includes('l-m-d') || lower.includes('lmd') || lower.includes('learn') || lower.includes('teach') || lower.includes('study')) return <HeLMDFamilyCard />;
  if (lower.includes('הלכ') || lower.includes('h-l-k') || lower.includes('hlk') || lower.includes('walk') || lower.includes('go') || lower.includes('went')) return <HeHLKFamilyCard />;
  if (lower.includes('אכל') || lower.includes('a-k-l') || lower.includes('akl') || lower.includes('eat') || lower.includes('food')) return <HeAKLFamilyCard />;
  if (lower.includes('שמע') || lower.includes('sh-m-a') || lower.includes('sma') || lower.includes('hear') || lower.includes('listen')) return <HeSHMFamilyCard />;
  if (lower.includes('ראה') || lower.includes('r-a-h') || lower.includes('rah') || lower.includes('see') || lower.includes('look') || lower.includes('vision')) return <HeRAHFamilyCard />;
  if (lower.includes('ידע') || lower.includes('y-d-a') || lower.includes('yda') || lower.includes('know') || lower.includes('knowledge') || lower.includes('science')) return <HeYDAFamilyCard />;
  if (lower.includes('אהב') || lower.includes('a-h-v') || lower.includes('ahv') || lower.includes('love') || lower.includes('like')) return <HeAHBFamilyCard />;
  if (lower.includes('עזר') || lower.includes('a-z-r') || lower.includes('azr') || lower.includes('help') || lower.includes('assist')) return <HeAZRFamilyCard />;
  if (lower.includes('שמח') || lower.includes('s-m-ch') || lower.includes('smch') || lower.includes('joy') || lower.includes('happy') || lower.includes('happi')) return <HeSMHFamilyCard />;
  return <HeDBRFamilyCard />;
}
