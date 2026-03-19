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

// ── 1. Hebrew-Speaking World Map ─────────────────────────────────────────────

export function HebrewophoneWorldMapCard() {
  const communities = [
    { region: 'Israel', detail: 'Primary Hebrew-speaking country · ~7.5M native speakers', status: 'Official language' },
    { region: 'United States', detail: 'Largest diaspora · ~700K fluent speakers · major communities in NY, LA, Miami', status: 'Heritage / diaspora' },
    { region: 'France', detail: 'Large Sephardic community · ~300K Hebrew-capable speakers', status: 'Heritage / diaspora' },
    { region: 'Canada', detail: 'Toronto & Montreal Jewish communities · ~150K speakers', status: 'Heritage / diaspora' },
    { region: 'Argentina', detail: 'Buenos Aires · 3rd largest Jewish diaspora in the Americas', status: 'Heritage' },
    { region: 'Russia & FSU', detail: 'Post-Soviet aliyah communities; many returnees to Israel', status: 'Heritage' },
    { region: 'Australia', detail: 'Melbourne & Sydney communities · growing Modern Hebrew studies', status: 'Heritage' },
    { region: 'Ethiopia (Beta Israel)', detail: 'Falasha communities; most emigrated to Israel in aliyot', status: 'Historical' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>עברית בעולם — Hebrew Around the World</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Region</span><span>Community</span><span>Status</span>
              </div>
              {communities.map(({ region, detail, status }, i) => (
                <div key={region} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-semibold">{region}</span>
                  <span className="text-muted-foreground text-xs">{detail}</span>
                  <span className="text-xs text-muted-foreground italic">{status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <SectionLabel>Quick Facts</SectionLabel>
            {[
              { num: '~9M', label: 'Modern Hebrew speakers worldwide' },
              { num: '~2,000', label: 'years the language was dormant (then revived!)' },
              { num: '1948', label: 'year Hebrew became official language of Israel' },
              { num: '22', label: 'letters in the Hebrew alphabet (all consonants)' },
            ].map(({ num, label }) => (
              <div key={num} className="rounded-md bg-muted/50 border border-border/50 p-3">
                <div className={`text-xl font-bold ${HE}`}>{num}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <NoteBox>
          <strong>The revival of Hebrew:</strong> Modern Hebrew (עברית מודרנית / ivrit modernit) is one of history's most remarkable linguistic revivals. After ~2,000 years as a liturgical and literary language, Eliezer Ben-Yehuda led its revival as a spoken vernacular in the late 19th century. Today Israel is home to the world's only Hebrew-speaking society.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 2. Israeli Holiday Calendar ──────────────────────────────────────────────

export function IsraeliHolidayCalendarCard() {
  const holidays = [
    { name: 'ראש השנה', translit: 'Rosh Hashana', season: 'Sep–Oct', desc: 'Jewish New Year — apples & honey, shofar blowing, 10-day introspection period' },
    { name: 'יום כיפור', translit: 'Yom Kippur', season: 'Sep–Oct', desc: 'Day of Atonement — holiest day; 25-hour fast; all traffic stops in Israel' },
    { name: 'סוכות', translit: 'Sukkot', season: 'Oct', desc: 'Feast of Tabernacles — temporary huts (sukkot) built; 7-day harvest festival' },
    { name: 'חנוכה', translit: 'Hanukkah', season: 'Nov–Dec', desc: 'Festival of Lights — 8 nights; menorah (chanukia) lighting; sufganiyot (jelly donuts)' },
    { name: 'פורים', translit: 'Purim', season: 'Feb–Mar', desc: 'Carnival holiday — costumes, megillah reading, hamantaschen cookies, gifts (mishloach manot)' },
    { name: 'פסח', translit: 'Passover (Pesach)', season: 'Mar–Apr', desc: 'Exodus from Egypt — seder night; matzah (unleavened bread); 8 days; major family gathering' },
    { name: 'שבועות', translit: 'Shavuot', season: 'May–Jun', desc: 'Harvest festival / Torah giving — dairy foods (cheesecake!); all-night Torah study (tikkun leil)' },
    { name: 'יום העצמאות', translit: 'Yom Ha\'atzmaut', season: 'Apr–May', desc: 'Israel Independence Day — barbecues, fireworks, public celebrations across Israel' },
    { name: 'יום הזיכרון', translit: 'Yom Hazikaron', season: 'Apr–May', desc: 'Israeli Memorial Day — sirens, ceremonies, solemn observance; immediately before Independence Day' },
    { name: 'שבת', translit: 'Shabbat', season: 'Weekly', desc: 'Sabbath — Friday sunset to Saturday night; rest day; family dinner Friday night (erev Shabbat)' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>חגים ומועדים — Israeli & Jewish Holidays</SectionLabel>
        <div className="space-y-2 mt-1">
          {holidays.map(({ name, translit, season, desc }) => (
            <div key={name} className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-2 mb-1">
                <span className={`font-bold text-base ${HE}`}>{name}</span>
                <span className="font-semibold text-sm">{translit}</span>
                <span className="text-xs text-muted-foreground ml-auto">{season}</span>
              </div>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Hebrew calendar:</strong> Jewish holidays follow the Hebrew lunisolar calendar (לוח עברי), so their Gregorian dates shift each year. The Hebrew year is numbered from creation — 2025 CE = ~5785–5786 in the Hebrew calendar. Shabbat (Sabbath) occurs every week and is the central recurring observance.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 3. Israeli Food Guide ────────────────────────────────────────────────────

export function IsraeliFoodGuideCard() {
  const foods = [
    { name: 'חומוס', translit: 'Hummus', desc: 'Chickpea paste with tahini, lemon, garlic — eaten as a main dish (not just a dip!) in Israel' },
    { name: 'פלאפל', translit: 'Falafel', desc: 'Deep-fried chickpea/fava balls in pita with salad, tahini, and pickles — Israel\'s street food king' },
    { name: 'שקשוקה', translit: 'Shakshuka', desc: 'Eggs poached in spiced tomato-pepper sauce — beloved breakfast and brunch dish' },
    { name: 'סביח', translit: 'Sabich', desc: 'Pita with fried eggplant, hard-boiled egg, hummus, amba (pickled mango) — Iraqi-Jewish origin' },
    { name: 'שוורמה', translit: 'Shawarma', desc: 'Slow-roasted spiced meat (turkey/lamb) shaved and served in pita or lafa flatbread' },
    { name: 'בורקס', translit: 'Burekas', desc: 'Flaky pastry filled with cheese, potato, or spinach — Sephardic/Balkan origin; bakery staple' },
    { name: 'גפילטע פיש', translit: 'Gefilte Fish', desc: 'Poached fish patties — Ashkenazi Shabbat and Passover tradition' },
    { name: 'לביבות', translit: 'Latkes', desc: 'Potato pancakes — served at Hanukkah with sour cream or applesauce' },
    { name: 'סופגניות', translit: 'Sufganiyot', desc: 'Jelly-filled donuts — the iconic Hanukkah treat; sold everywhere in December in Israel' },
    { name: 'תה נענע', translit: 'Nana Tea', desc: 'Fresh mint tea — especially in Arab-Israeli culture; served with fresh mint leaves and sugar' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>אוכל ישראלי — Israeli & Jewish Cuisine</SectionLabel>
        <div className="grid grid-cols-1 gap-1.5 mt-1">
          {foods.map(({ name, translit, desc }) => (
            <div key={name} className="flex gap-3 py-1.5 border-b border-border/30 last:border-0">
              <div className="shrink-0 w-28">
                <div className={`font-bold text-sm ${HE}`}>{name}</div>
                <div className="text-xs font-medium">{translit}</div>
              </div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Kashrut (כשרות):</strong> Traditional Jewish dietary laws (kosher) prohibit mixing meat and dairy, and pork/shellfish. Israel has many kosher restaurants, and food labeling shows kosher certification. The diversity of Israeli cuisine reflects waves of immigration — Ashkenazi, Sephardic, Mizrahi, Ethiopian, Russian, and more.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 4. Hebrew Dialect / Variety Card ─────────────────────────────────────────

export function HebrewDialectCard() {
  const varieties = [
    {
      name: 'Modern Israeli Hebrew (Standard)',
      heb: 'עברית ישראלית מודרנית',
      speakers: 'All Israelis, ~7.5M',
      traits: 'Phonologically simplified; 5 vowels; no pharyngeal distinction between ע and א; uvular resh; everyday language of media, government, education',
    },
    {
      name: 'Mizrahi Pronunciation',
      heb: 'הגייה מזרחית',
      speakers: 'Jews from Arab/Persian countries',
      traits: 'Preserves pharyngeal ע and ח sounds; historically considered "truer" to ancient pronunciation; increasingly valued',
    },
    {
      name: 'Ashkenazi (Liturgical)',
      heb: 'הגייה אשכנזית',
      speakers: 'Diaspora communities; some ultra-Orthodox',
      traits: 'Tav pronounced as "s" · Qamats as "oy" · Used in many synagogues outside Israel; differs significantly from Israeli Hebrew',
    },
    {
      name: 'Yemenite Hebrew',
      heb: 'עברית תימנית',
      speakers: 'Yemenite Jewish community',
      traits: 'Preserves nearly all classical phonemes including all consonant distinctions; considered linguistically most conservative variety',
    },
    {
      name: 'Biblical Hebrew',
      heb: 'עברית מקראית',
      speakers: 'Studied; not spoken natively',
      traits: 'Language of the Torah (5th–4th c BCE); different vocabulary, grammar, and script conventions; studied in schools and seminaries',
    },
    {
      name: 'Rabbinic / Mishnaic Hebrew',
      heb: 'עברית חז"לית',
      speakers: 'Scholarly / liturgical',
      traits: 'Language of the Mishnah and Talmud (200 CE–500 CE); bridges biblical and modern; many everyday words derive from here',
    },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>שונות עברית — Hebrew Varieties & Registers</SectionLabel>
        <div className="space-y-3 mt-1">
          {varieties.map(({ name, heb, speakers, traits }) => (
            <div key={name} className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
              <div className="flex flex-wrap gap-2 items-baseline mb-1">
                <span className="font-semibold text-sm">{name}</span>
                <span className={`text-xs ${HE} font-semibold`}>{heb}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-0.5"><strong>Speakers:</strong> {speakers}</p>
              <p className="text-xs text-muted-foreground">{traits}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          The revival of Modern Hebrew drew from all historical layers. Modern Israeli speakers can largely read biblical texts (with a dictionary) because the core language is continuous. Ben-Yehuda coined thousands of new words by adapting Semitic roots for modern concepts like "newspaper" (עיתון) and "dictionary" (מילון).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 5. Israeli Etiquette ──────────────────────────────────────────────────────

export function IsraeliEtiquetteCard() {
  const customs = [
    {
      title: 'דוגרי (Dugri) — Direct Communication',
      desc: 'Israelis value direct, honest speech. Saying exactly what you mean is considered respectful and efficient, not rude. Indirect communication can be seen as dishonest.',
    },
    {
      title: 'חוצפה (Chutzpah) — Audacity',
      desc: 'Assertiveness and self-confidence are cultural values. Asking boldly for what you want is normal. "Chutzpah" in Israel is often a compliment.',
    },
    {
      title: 'יחסים אישיים — Personal Relations',
      desc: 'Israelis tend to be warm and informal quickly. First names are used immediately. Personal questions (about family, salary, age) are common and not considered intrusive.',
    },
    {
      title: 'שבת ויחס לדת — Shabbat & Religion',
      desc: 'Friday afternoon to Saturday night is Shabbat. Most businesses close; public transport stops in many cities. Even secular Israelis often observe family Friday dinner.',
    },
    {
      title: 'ניגון תור — Queuing',
      desc: 'Formal queuing is less rigid than in some cultures. It\'s normal to ask "מי אחרון?" (mi acharon? — who\'s last?) to join an informal queue.',
    },
    {
      title: 'אירוח — Hospitality',
      desc: 'Guests are treated generously — "Bevakasha" (please/here you go) and "yalla, tochel!" (come on, eat!) are hospitality staples. Refusing food repeatedly may seem impolite.',
    },
    {
      title: 'ביטחון — Security Awareness',
      desc: 'Security is highly visible in public spaces (airports, malls). Security questions are thorough and professional. Cooperation is expected and normal.',
    },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>נימוסים ישראליים — Israeli Etiquette & Culture</SectionLabel>
        <div className="space-y-2 mt-1">
          {customs.map(({ title, desc }) => (
            <div key={title} className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
              <p className="font-semibold text-sm mb-1">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Key phrases for politeness:</strong> בבקשה (bevakasha) = please / here you go / you're welcome · תודה (toda) = thank you · סליחה (slicha) = excuse me / sorry · כן (ken) = yes · לא (lo) = no · יאללה! (yalla!) = let's go / come on (from Arabic, widely used in Israeli Hebrew).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 6. Israeli Currency ───────────────────────────────────────────────────────

export function IsraeliCurrencyCard() {
  const notes = [
    { denom: '₪20', heb: 'עשרים שקל', portrait: 'Rachel Bluwstein (poet)', color: 'Green' },
    { denom: '₪50', heb: 'חמישים שקל', portrait: 'Shmuel Yosef Agnon (Nobel laureate)', color: 'Purple' },
    { denom: '₪100', heb: 'מאה שקל', portrait: 'Yitzhak Ben-Zvi (2nd President)', color: 'Brown/Red' },
    { denom: '₪200', heb: 'מאתיים שקל', portrait: 'Zalman Shazar (3rd President)', color: 'Blue' },
  ];
  const coins = [
    ['10 agorot', 'עשרה אגורות', 'Smallest coin in common use'],
    ['50 agorot', 'חמישים אגורות', '½ shekel'],
    ['₪1', 'שקל אחד', 'Lily design'],
    ['₪2', 'שני שקלים', 'Cornucopia design'],
    ['₪5', 'חמישה שקלים', 'Pomegranate design'],
    ['₪10', 'עשרה שקלים', 'Date palm design'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>שקל חדש (₪) — New Israeli Shekel (NIS)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">The <strong>New Israeli Shekel (שקל חדש / shekel chadash)</strong>, symbol <strong>₪</strong>, code <strong>ILS</strong>, has been Israel's currency since 1986. It is divided into 100 <strong>agorot (אגורות)</strong>.</p>

        <div className="mb-4">
          <SectionLabel>Banknotes</SectionLabel>
          <div className="rounded-md border border-border overflow-hidden text-sm">
            <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span>Value</span><span>Hebrew</span><span>Portrait</span><span>Color</span>
            </div>
            {notes.map(({ denom, heb, portrait, color }, i) => (
              <div key={denom} className={`grid grid-cols-4 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                <span className="font-bold">{denom}</span>
                <span className={`font-semibold ${HE}`}>{heb}</span>
                <span className="text-muted-foreground text-xs">{portrait}</span>
                <span className="text-muted-foreground text-xs">{color}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <SectionLabel>Coins</SectionLabel>
          <div className="grid grid-cols-2 gap-1">
            {coins.map(([value, heb, note]) => (
              <div key={value} className="rounded-md bg-muted/40 border border-border/40 p-2 text-xs">
                <span className="font-bold">{value}</span> — <span className={HE}>{heb}</span>
                <div className="text-muted-foreground">{note}</div>
              </div>
            ))}
          </div>
        </div>

        <SectionLabel>Useful Money Phrases</SectionLabel>
        <div className="space-y-1 text-sm">
          {[
            ['כמה זה עולה?', 'How much does it cost? — kama ze ole?'],
            ['יקר מדי', 'Too expensive — yakar midai'],
            ['יש לי מזומן', 'I have cash — yesh li mezuman'],
            ['קבלה, בבקשה', 'Receipt, please — kabala, bevakasha'],
            ['מחיר מוזל', 'Discounted price — mechir muzal'],
          ].map(([heb, en]) => (
            <div key={heb} className="flex gap-2">
              <span className={`font-semibold shrink-0 ${HE}`}>{heb}</span>
              <span className="text-muted-foreground">— {en}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 7. Israeli Pop Culture ───────────────────────────────────────────────────

export function IsraeliCultureCard() {
  const topics = [
    {
      title: 'סטארט-אפ ניישן — Startup Nation',
      desc: 'Israel has more NASDAQ-listed startups per capita than any other country. The tech ecosystem (especially in Tel Aviv\'s "Silicon Wadi") drives global innovation in cybersecurity, AI, agriculture tech, and medical devices.',
    },
    {
      title: 'מוזיקה ישראלית — Israeli Music',
      desc: 'From classic mizrahi music (Ofra Haza, Zohar Argov) to modern pop (Static & Ben El, Noga Erez) and Eurovision success (Dana International, Netta "Toy"). Pop songs often mix Hebrew, Arabic, and English.',
    },
    {
      title: 'טיול אחרי צבא — Post-Army Travel',
      desc: 'A strong cultural tradition: after mandatory military service, young Israelis typically travel for months — to India, South America, Southeast Asia. This "big trip" (ha-tiyul hagadol) is a rite of passage.',
    },
    {
      title: 'קולנוע ישראלי — Israeli Cinema',
      desc: 'Internationally acclaimed films: Waltz with Bashir, Foxtrot, The Band\'s Visit, Beaufort. Israeli TV series (Fauda, Homeland, Prisoners of War/Hatufim) have been adapted globally.',
    },
    {
      title: 'ערבית במאה הישראלית — Arabic in Israeli Culture',
      desc: 'Arabic is Israel\'s second official language (alongside Hebrew). Loanwords from Arabic permeate Israeli Hebrew slang: yalla (let\'s go), sababa (cool/great), walla (wow/really), achla (excellent).',
    },
    {
      title: 'ספרות עברית — Hebrew Literature',
      desc: 'Shmuel Yosef Agnon (Nobel Prize 1966) · Amos Oz · A.B. Yehoshua · David Grossman · Etgar Keret — Israel\'s literary tradition is internationally celebrated and deeply tied to national identity.',
    },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>תרבות ישראלית — Israeli Culture & Society</SectionLabel>
        <div className="space-y-3 mt-1">
          {topics.map(({ title, desc }) => (
            <div key={title} className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
              <p className={`font-semibold text-sm mb-1`}>{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Essential Israeli slang:</strong> יאללה (yalla) = let's go · סבבה (sababa) = cool/OK · וואלה (walla) = wow/really? · אחלה (achla) = excellent · בסדר (beseder) = OK/alright · נו (nu) = well?/come on · פצצה (patsatsa) = amazing (lit. "bomb") · חיים (chaim) = life — as in "l'chaim!" (to life!) the iconic Hebrew toast.
        </NoteBox>
      </CardContent>
    </Card>
  );
}
