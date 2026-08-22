/**
 * TextbookGermanCulturalCards.tsx
 * Section 5 — German cultural reference cards.
 *
 * Cards:
 *  GermanSpeakingWorldCard    — DACH + other German-speaking regions
 *  GermanHolidayCalendarCard  — major German/Austrian/Swiss public holidays
 *  GermanFoodGuideCard        — regional German cuisine
 *  GermanDialectCard          — dialect zones across German-speaking world
 *  GermanEtiquetteCard        — greeting customs, punctuality, formality
 *  GermanCurrencyCard         — Euro + Swiss Franc
 *  GermanGestureCard          — cultural body-language awareness
 */

// ─── GERMAN-SPEAKING WORLD MAP ────────────────────────────────────────────────

export function GermanSpeakingWorldCard() {
  const regions: {
    name: string;
    color: string;
    countries: string[];
    speakers?: string;
    note?: string;
  }[] = [
    {
      name: 'Deutschland',
      color: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
      countries: ['Deutschland (83 Mio.) — official language, 16 federal states (Bundesländer)'],
      speakers: '~83 million native',
    },
    {
      name: 'Österreich',
      color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
      countries: ['Österreich (9 Mio.) — Austrian German (Österreichisches Deutsch); "Servus" & "Grüß Gott"'],
      speakers: '~9 million native',
    },
    {
      name: 'Schweiz',
      color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
      countries: ['Schweiz / Suisse / Svizzera (8.7 Mio.) — Swiss German (Schweizerdeutsch); 4 official languages'],
      speakers: '~5.3 million German speakers',
    },
    {
      name: 'Liechtenstein & Luxemburg',
      color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
      countries: ['Liechtenstein — German is sole official language', 'Luxemburg — German one of three official languages (with French & Luxembourgish)'],
    },
    {
      name: 'German minorities & regions',
      color: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
      countries: ['Südtirol / Alto Adige (Italy)', 'Elsass (France, historical)', 'Ostbelgien (Belgium)', 'Communities in USA, Brazil, Namibia, Kazakhstan'],
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-500/10 to-red-500/10">
        <p className="text-sm font-semibold text-center">Die deutschsprachige Welt — The German-Speaking World</p>
        <p className="text-xs text-muted-foreground text-center">~100 million native speakers · official language in 6 countries · DACH region</p>
      </div>

      {/* Visual DACH band */}
      <div className="px-4 py-3 border-b">
        <div className="flex rounded overflow-hidden h-5 w-full">
          {[
            { color: 'bg-amber-400 dark:bg-amber-600', pct: '70%', label: 'Deutschland' },
            { color: 'bg-red-400 dark:bg-red-600', pct: '15%', label: 'Österreich' },
            { color: 'bg-red-600 dark:bg-red-800', pct: '10%', label: 'Schweiz' },
            { color: 'bg-blue-400 dark:bg-blue-600', pct: '5%', label: 'Andere' },
          ].map(({ color, pct, label }) => (
            <div key={label} className={`${color} flex items-center justify-center overflow-hidden`} style={{ width: pct }}>
              <span className="text-white text-[8px] font-semibold truncate px-0.5 hidden sm:block">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">DACH = Deutschland · Österreich · Schweiz — the three major German-speaking nations</p>
      </div>

      <div className="divide-y">
        {regions.map(({ name, color, countries, speakers }) => (
          <div key={name} className="px-4 py-2.5 flex gap-3">
            <span className={`mt-0.5 shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${color} w-40`}>{name}</span>
            <div className="flex-1">
              <div className="text-xs space-y-0.5">
                {countries.map(c => <p key={c}>{c}</p>)}
                {speakers && <p className="text-muted-foreground">{speakers}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground text-center">
          German is the most widely spoken native language in the European Union.
        </p>
      </div>
    </div>
  );
}

// ─── GERMAN HOLIDAY CALENDAR ──────────────────────────────────────────────────

export function GermanHolidayCalendarCard() {
  const holidays: { date: string; de: string; en: string; note?: string }[] = [
    { date: '1. Jan', de: 'Neujahr', en: 'New Year\'s Day', note: 'Nationwide' },
    { date: 'März/Apr', de: 'Karfreitag', en: 'Good Friday', note: 'Nationwide' },
    { date: 'März/Apr', de: 'Ostermontag', en: 'Easter Monday', note: 'Nationwide' },
    { date: '1. Mai', de: 'Tag der Arbeit', en: 'Labour Day', note: 'Nationwide' },
    { date: 'Mai/Jun', de: 'Christi Himmelfahrt', en: 'Ascension Day', note: 'Nationwide' },
    { date: 'Mai/Jun', de: 'Pfingstmontag', en: 'Whit Monday', note: 'Nationwide' },
    { date: '3. Okt', de: 'Tag der Deutschen Einheit', en: 'German Unity Day', note: 'Nationwide — Oct 3, 1990 reunification' },
    { date: '25. Dez', de: '1. Weihnachtstag', en: 'Christmas Day', note: 'Nationwide' },
    { date: '26. Dez', de: '2. Weihnachtstag', en: 'Boxing Day', note: 'Nationwide — unique to German tradition' },
    { date: 'Sept/Okt', de: 'Oktoberfest', en: 'Oktoberfest (Munich)', note: 'Bavaria — world\'s largest folk festival' },
    { date: '11. Nov', de: 'Karneval / Fasching', en: 'Carnival season begins', note: 'Rhineland, Bavaria, Austria' },
    { date: '6. Dez', de: 'Nikolaustag', en: 'St. Nicholas Day', note: 'Children receive gifts/sweets' },
    { date: 'Nov/Dez', de: 'Weihnachtsmärkte', en: 'Christmas markets', note: 'Advent tradition — begins 4 weeks before Christmas' },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-500/10 to-red-500/10">
        <p className="text-sm font-semibold text-center">Feiertage & Feste — German Holidays & Festivals</p>
        <p className="text-xs text-muted-foreground text-center">9 nationwide holidays in Germany + regional additions in each Bundesland</p>
      </div>
      <div className="divide-y">
        {holidays.map(({ date, de, en, note }) => (
          <div key={de} className="flex gap-3 px-4 py-2 text-xs">
            <span className="w-20 shrink-0 font-mono text-muted-foreground">{date}</span>
            <span className="font-semibold min-w-48">{de}</span>
            <span className="text-muted-foreground flex-1">{en}{note ? ` — ${note}` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GERMAN FOOD GUIDE ────────────────────────────────────────────────────────

export function GermanFoodGuideCard() {
  const regions = [
    {
      name: 'Bayern (Bavaria)',
      color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
      dishes: ['Weißwurst (white sausage)', 'Brezn (pretzels)', 'Schweinsbraten (roast pork)', 'Obatzda (cheese dip)', 'Weißbier (wheat beer)'],
    },
    {
      name: 'Rheinland & NRW',
      color: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
      dishes: ['Sauerbraten (marinated pot roast)', 'Himmel und Äd (mashed potato & apple)', 'Reibekuchen (potato pancakes)', 'Kölsch beer'],
    },
    {
      name: 'Norddeutschland',
      color: 'bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700',
      dishes: ['Labskaus (corned beef & potato hash)', 'Fischbrötchen (fish sandwiches)', 'Rote Grütze (red berry compote)', 'Grünkohl mit Pinkel (kale & sausage)'],
    },
    {
      name: 'Österreich (Austria)',
      color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
      dishes: ['Wiener Schnitzel', 'Tafelspitz (boiled beef)', 'Kaiserschmarrn (torn pancake)', 'Sachertorte (chocolate cake)', 'Strudel'],
    },
    {
      name: 'Schweiz (Switzerland)',
      color: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      dishes: ['Käsefondue', 'Raclette', 'Rösti (potato cake)', 'Zürcher Geschnetzeltes', 'Birchermüesli'],
    },
  ];

  const staples = [
    ['Brot & Brötchen', 'Germany has 300+ bread varieties — the most in the world'],
    ['Wurst', '1500+ sausage varieties — Bratwurst, Currywurst, Leberwurst…'],
    ['Käse', 'Emmental (CH), Allgäuer Bergkäse (BY), Limburger — excellent regional cheeses'],
    ['Bier', 'German Reinheitsgebot (purity law) since 1516 — water, malt, hops, yeast only'],
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-500/10 to-orange-500/10">
        <p className="text-sm font-semibold text-center">Deutsche Küche — German Cuisine</p>
        <p className="text-xs text-muted-foreground text-center">Regional specialties across Deutschland · Österreich · Schweiz</p>
      </div>

      <div className="divide-y">
        {regions.map(({ name, color, dishes }) => (
          <div key={name} className="px-4 py-2.5 flex gap-3">
            <span className={`mt-0.5 shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${color} w-36`}>{name}</span>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1">
                {dishes.map(d => (
                  <span key={d} className="text-[11px] bg-muted/60 px-2 py-0.5 rounded-sm border border-border/50">{d}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t">
        <p className="text-xs font-semibold mb-2">Staples of the German table</p>
        <div className="space-y-1">
          {staples.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs">
              <span className="font-semibold min-w-28 shrink-0">{k}</span>
              <span className="text-muted-foreground">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GERMAN DIALECT CARD ──────────────────────────────────────────────────────

export function GermanDialectCard() {
  const dialects = [
    {
      name: 'Hochdeutsch',
      color: 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600',
      desc: 'Standard German — what you learn in class. Used in media, government, education.',
      features: ['Basis of all teaching', 'TV/radio standard', 'Written standard everywhere'],
    },
    {
      name: 'Bairisch (Bavarian)',
      color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
      desc: 'Spoken in Bayern + Austria. Very distinctive — can be hard for northern Germans.',
      features: ['Grüß Gott instead of Hallo', 'Servus = Hi/Bye', '"I mog di" = Ich mag dich', 'k → hard g sounds'],
    },
    {
      name: 'Kölsch / Ripuarisch',
      color: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
      desc: 'Rhineland dialects — Cologne, Düsseldorf area. Also the name of the local beer.',
      features: ['Dat = das', 'Joot = gut (good)', 'Softer consonants', 'Very melodic intonation'],
    },
    {
      name: 'Plattdeutsch (Low German)',
      color: 'bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700',
      desc: 'Northern Germany — Hamburg, Bremen. Considered a separate language by linguists.',
      features: ['Moin = Hello (any time)', 'p/t/k not shifted', 'Dat, wat, ik (not das, was, ich)', 'Closely related to Dutch/English'],
    },
    {
      name: 'Schweizerdeutsch',
      color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
      desc: 'Swiss German — almost never written; Swiss write Standard German. Very difficult for other German speakers.',
      features: ['Kein ß (always ss)', 'ch everywhere (even Chind = Kind)', 'Grüezi = Guten Tag', 'Highly varied by canton'],
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-slate-500/10 to-blue-500/10">
        <p className="text-sm font-semibold text-center">Deutsche Dialekte — German Dialect Zones</p>
        <p className="text-xs text-muted-foreground text-center">Same written standard — very different spoken varieties across the German-speaking world</p>
      </div>
      <div className="divide-y">
        {dialects.map(({ name, color, desc, features }) => (
          <div key={name} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${color} mt-0.5`}>{name}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{desc}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {features.map(f => (
                    <span key={f} className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded border border-border/40">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GERMAN ETIQUETTE ─────────────────────────────────────────────────────────

export function GermanEtiquetteCard() {
  const sections = [
    {
      title: 'Greetings',
      color: 'from-blue-500/10',
      items: [
        ['Guten Morgen', 'Good morning — until about 10–11am'],
        ['Guten Tag', 'Good day — standard daytime greeting'],
        ['Guten Abend', 'Good evening — after ~6pm'],
        ['Hallo / Hi', 'Informal — with friends and peers'],
        ['Tschüss / Auf Wiedersehen', 'Goodbye — informal vs. formal'],
        ['Handshake', 'Standard greeting — firm, direct eye contact'],
        ['Cheek kisses', 'Not typical in Germany — hugs among close friends only'],
      ],
    },
    {
      title: 'Formality & Du/Sie',
      color: 'from-amber-500/10',
      items: [
        ['Sie (formal)', 'Use with strangers, older people, colleagues, authority'],
        ['du (informal)', 'Friends, family, children, fellow students'],
        ['Offering "du"', '"Wir können uns duzen." — Wait to be offered!'],
        ['First names', 'Not used until "du" is offered — use Herr/Frau + surname'],
        ['Academic titles', 'Always use: "Herr Doktor Müller" — Doktor/Professor important in Germany, Austria'],
      ],
    },
    {
      title: 'Punctuality & Direct Communication',
      color: 'from-green-500/10',
      items: [
        ['Pünktlichkeit', 'Punctuality is extremely important — being late is impolite'],
        ['Directness', 'Germans value direct, clear communication — no is no'],
        ['Privacy', 'Personal questions are not expected in small talk'],
        ['Small talk', 'Less common than in Anglo cultures — get to the point'],
        ['Knocking', 'Always knock before entering a closed room'],
      ],
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-500/10 to-amber-500/10">
        <p className="text-sm font-semibold text-center">Etikette & Umgangsformen — German Etiquette</p>
        <p className="text-xs text-muted-foreground text-center">Punctuality, formality, and directness are central German cultural values</p>
      </div>
      <div className="divide-y">
        {sections.map(({ title, color, items }) => (
          <div key={title}>
            <div className={`px-4 py-2 bg-gradient-to-r ${color} to-transparent border-b`}>
              <p className="text-xs font-semibold">{title}</p>
            </div>
            <div className="divide-y">
              {items.map(([k, v]) => (
                <div key={k} className="flex gap-3 px-4 py-1.5 text-xs">
                  <span className="font-semibold min-w-36 shrink-0">{k}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GERMAN CURRENCY ──────────────────────────────────────────────────────────

export function GermanCurrencyCard() {
  const currencies = [
    { country: 'Deutschland', currency: 'Euro (€)', code: 'EUR', rate: '1 EUR ≈ 1.08 USD', note: 'Since 2002, replaced Deutsche Mark (DM)' },
    { country: 'Österreich', currency: 'Euro (€)', code: 'EUR', rate: '1 EUR ≈ 1.08 USD', note: 'Since 2002, replaced Österreichischer Schilling' },
    { country: 'Schweiz', currency: 'Schweizer Franken', code: 'CHF', rate: '1 CHF ≈ 1.12 USD', note: 'Switzerland did NOT adopt the Euro — CHF is highly stable' },
    { country: 'Liechtenstein', currency: 'Schweizer Franken', code: 'CHF', rate: '1 CHF ≈ 1.12 USD', note: 'Uses Swiss Franc by agreement with Switzerland' },
    { country: 'Luxemburg', currency: 'Euro (€)', code: 'EUR', rate: '1 EUR ≈ 1.08 USD', note: 'Since 2002, replaced Luxembourgish Franc' },
  ];

  const euroNotes = ['5€', '10€', '20€', '50€', '100€', '200€', '500€'];
  const euroCoins = ['1¢', '2¢', '5¢', '10¢', '20¢', '50¢', '1€', '2€'];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-500/10 to-yellow-500/10">
        <p className="text-sm font-semibold text-center">Währungen — Currencies in the German-Speaking World</p>
        <p className="text-xs text-muted-foreground text-center">Most use the Euro · Switzerland and Liechtenstein use the Swiss Franc</p>
      </div>
      <div className="divide-y">
        {currencies.map(({ country, currency, code, rate, note }) => (
          <div key={country} className="flex gap-3 px-4 py-2.5 text-xs">
            <span className="font-semibold min-w-28 shrink-0">{country}</span>
            <div className="flex-1">
              <span className="font-semibold">{currency} </span>
              <span className="text-muted-foreground">({code}) — {rate}</span>
              <p className="text-muted-foreground mt-0.5">{note}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold mb-1">Euro Scheine (notes)</p>
            <div className="flex flex-wrap gap-1">
              {euroNotes.map(n => <span key={n} className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 font-mono text-[10px]">{n}</span>)}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-1">Euro Münzen (coins)</p>
            <div className="flex flex-wrap gap-1">
              {euroCoins.map(c => <span key={c} className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 font-mono text-[10px]">{c}</span>)}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">Tipp: In Germany, cash (Bargeld) is still king — many shops and restaurants don't accept cards.</p>
      </div>
    </div>
  );
}

// ─── GERMAN GESTURE CARD ──────────────────────────────────────────────────────

export function GermanGestureCard() {
  const gestures = [
    {
      gesture: 'Daumen hoch',
      meaning: 'Thumbs up — good job, agreement',
      note: 'Very common and positive — equivalent to "great!"',
      caution: false,
    },
    {
      gesture: 'Klopfen auf den Tisch',
      meaning: 'Knocking on table — applause at a lecture/meeting',
      note: 'Germans knock on the desk/table instead of clapping at lectures and academic settings',
      caution: false,
    },
    {
      gesture: 'Zeigefinger an die Schläfe',
      meaning: 'Index finger to temple — "you\'re crazy"',
      note: 'Considered rude — avoid using this',
      caution: true,
    },
    {
      gesture: 'Prost! (clinking glasses)',
      meaning: 'Cheers! — always look in the eyes when clinking',
      note: 'Not making eye contact is considered bad luck and rude in German culture',
      caution: false,
    },
    {
      gesture: 'Überkreuzte Finger',
      meaning: 'Crossed fingers — wishing luck (Drück mir die Daumen!)',
      note: 'Germans say "press your thumbs" not "cross your fingers" — but crossed fingers also understood',
      caution: false,
    },
    {
      gesture: 'Mittelfinger',
      meaning: 'Middle finger — highly offensive',
      note: 'Can result in a fine in Germany if directed at someone in traffic (§185 StGB - Beleidigung)',
      caution: true,
    },
    {
      gesture: 'Hand wave (palm down)',
      meaning: 'Brushing away — dismissal, "forget it"',
      note: 'Waving the hand palm down dismissively signals disinterest or rejection',
      caution: false,
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-slate-500/10 to-blue-500/10">
        <p className="text-sm font-semibold text-center">Gesten & Körpersprache — German Gestures</p>
        <p className="text-xs text-muted-foreground text-center">Germans tend to be reserved — body language is measured and purposeful</p>
      </div>
      <div className="divide-y">
        {gestures.map(({ gesture, meaning, note, caution }) => (
          <div key={gesture} className="px-4 py-2.5">
            <div className="flex items-start gap-2">
              {caution && (
                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 mt-0.5">CAUTION</span>
              )}
              <div>
                <span className="text-xs font-semibold">{gesture}</span>
                <span className="text-xs text-muted-foreground"> — {meaning}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
