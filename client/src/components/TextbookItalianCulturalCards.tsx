/**
 * TextbookItalianCulturalCards.tsx
 * Section 5 — Italian cultural reference cards.
 *
 * Cards:
 *  ItalophoneWorldCard       — Italy + Italian-speaking regions of the world
 *  ItalianHolidayCalendarCard — major Italian public holidays
 *  ItalianFoodGuideCard       — Italian regional cuisine overview
 *  ItalianDialectCard         — dialect zones across Italy
 *  ItalianEtiquetteCard       — greeting customs, social norms
 *  ItalianCurrencyCard        — Euro in Italy
 *  ItalianGestureCard         — famous Italian hand gestures
 */

// ─── ITALOPHONE WORLD MAP ─────────────────────────────────────────────────────

export function ItalophoneWorldCard() {
  const regions: {
    name: string;
    color: string;
    countries: string[];
    speakers?: string;
    note?: string;
  }[] = [
    {
      name: 'Italia',
      color: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
      countries: ['Italia (60 Mio.) — official language; 20 regions, each with distinct dialects and cuisine'],
      speakers: '~58 million native',
    },
    {
      name: 'San Marino & Vaticano',
      color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
      countries: [
        'Repubblica di San Marino — tiny republic inside Italy; Italian is official language',
        'Città del Vaticano — Italian is primary working language alongside Latin',
      ],
      speakers: '~34,000 total',
    },
    {
      name: 'Svizzera — Ticino & Grigioni',
      color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
      countries: ['Cantone Ticino & parts of Grigioni — Italian is one of four national languages of Switzerland (~700,000 speakers)'],
      speakers: '~700,000 in Switzerland',
    },
    {
      name: 'Istria & Dalmazia',
      color: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
      countries: [
        'Istria (Slovenia & Croatia) — recognized Italian-speaking minority (~25,000)',
        'Zara / Zadar — historical Venetian presence; small Italian community today',
      ],
      note: 'Historical Venetian Empire left lasting Italian linguistic influence along the Adriatic coast.',
    },
    {
      name: 'Comunità italiane nel mondo',
      color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700',
      countries: [
        'Argentina, Brasile, Uruguay — large Italian diaspora (Est. ~25 million Italian-origin)',
        'USA — ~17 million of Italian descent; strong heritage language communities',
        'Australia, Canada, Germania — significant Italian expatriate communities',
      ],
      speakers: '~67 million worldwide (native + heritage)',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-transparent">
          <p className="text-sm font-semibold text-center">Il Mondo Italofono — The Italian-Speaking World</p>
          <p className="text-xs text-muted-foreground text-center">~67 million speakers worldwide</p>
        </div>
        <div className="divide-y">
          {regions.map(({ name, color, countries, speakers, note }) => (
            <div key={name} className={`p-3 border-l-4 ${color}`}>
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-sm font-semibold">{name}</span>
                {speakers && <span className="text-xs text-muted-foreground">{speakers}</span>}
              </div>
              <ul className="mt-1 space-y-0.5">
                {countries.map(c => (
                  <li key={c} className="text-xs text-muted-foreground">• {c}</li>
                ))}
              </ul>
              {note && <p className="text-xs text-muted-foreground italic mt-1">{note}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-semibold mb-2">Quick facts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
          <span>• Italian is the 4th most studied language in the world</span>
          <span>• Romanzo language — descended from Vulgar Latin</span>
          <span>• Official language of Italy, San Marino, Vatican City, and Switzerland</span>
          <span>• Strong legacy in arts, opera, cuisine, fashion, and architecture</span>
          <span>• Italian unification (Risorgimento) 1861 — Florentine Tuscan became standard Italian</span>
          <span>• Regional dialects (siciliano, veneziano, napoletano…) are still widely spoken</span>
        </div>
      </div>
    </div>
  );
}

// ─── ITALIAN HOLIDAY CALENDAR ─────────────────────────────────────────────────

export function ItalianHolidayCalendarCard() {
  const holidays: { date: string; name: string; english: string; note?: string }[] = [
    { date: '1 gennaio', name: "Capodanno", english: "New Year's Day", note: "Big celebrations with fireworks at midnight — La notte di San Silvestro." },
    { date: '6 gennaio', name: 'Epifania / La Befana', english: 'Epiphany', note: "La Befana brings gifts to children — more important than Christmas for many families!" },
    { date: 'marzo/aprile', name: 'Pasqua', english: 'Easter Sunday', note: "Colombe (dove-shaped cake) and chocolate eggs are traditional. 'Natale con i tuoi, Pasqua con chi vuoi.'" },
    { date: 'marzo/aprile', name: "Pasquetta (Lunedì dell'Angelo)", english: 'Easter Monday', note: "Public holiday — Italians traditionally go on a picnic (gita fuori porta)." },
    { date: '25 aprile', name: 'Festa della Liberazione', english: 'Liberation Day', note: "Celebrates end of Nazi occupation and Fascism in 1945." },
    { date: '1 maggio', name: 'Festa dei Lavoratori', english: "International Workers' Day / Labour Day", note: "Large outdoor concerts and marches across Italy." },
    { date: '2 giugno', name: 'Festa della Repubblica', english: 'Republic Day', note: "Commemorates the 1946 referendum establishing the Italian Republic. Military parade in Rome." },
    { date: '15 agosto', name: 'Ferragosto', english: 'Assumption of Mary', note: "Italy's famous summer holiday — many businesses close for the entire week. Beaches are packed." },
    { date: '1 novembre', name: 'Ognissanti / Tutti i Santi', english: "All Saints' Day", note: "Families visit cemeteries to honour the dead. Followed by Il Giorno dei Morti (Nov 2)." },
    { date: '8 dicembre', name: "Immacolata Concezione", english: 'Immaculate Conception', note: "Traditional start of Christmas season — Christmas trees are put up and nativity scenes prepared." },
    { date: '25 dicembre', name: 'Natale', english: 'Christmas Day', note: "Panettone, pandoro, and the presepe (nativity scene). Gifts traditionally brought by Babbo Natale." },
    { date: '26 dicembre', name: 'Santo Stefano', english: "St. Stephen's Day / Boxing Day", note: "Public holiday — traditionally spent with extended family." },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Festività Italiane — Italian Public Holidays</p>
        <p className="text-xs text-muted-foreground text-center">12 national public holidays (giorni festivi)</p>
      </div>
      <div className="divide-y">
        {holidays.map(({ date, name, english, note }) => (
          <div key={name} className="px-4 py-2.5 text-xs">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-mono text-muted-foreground shrink-0 min-w-24">{date}</span>
              <span className="font-semibold text-green-700 dark:text-green-400">{name}</span>
              <span className="text-muted-foreground">— {english}</span>
            </div>
            {note && <p className="mt-0.5 text-muted-foreground italic pl-24">{note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ITALIAN FOOD GUIDE ───────────────────────────────────────────────────────

export function ItalianFoodGuideCard() {
  const regions: { region: string; specialties: string[]; note?: string }[] = [
    { region: 'Nord — Piemonte & Valle d\'Aosta', specialties: ['Risotto', 'Fonduta (fondue)', 'Tartufo bianco (white truffle)', 'Brasato al Barolo', 'Gianduia chocolate'], note: 'Rich, butter-based cuisine; world-famous wines (Barolo, Barbaresco).' },
    { region: 'Nord — Lombardia (Milano)', specialties: ['Risotto alla milanese (saffron)', 'Ossobuco', 'Cotoletta alla milanese (veal cutlet)', 'Panettone', 'Gorgonzola cheese'] },
    { region: 'Nord-Est — Veneto & Friuli', specialties: ['Pasta e fagioli', 'Fegato alla veneziana (calf liver)', 'Tiramisu', 'Polenta', 'Prosecco & Amarone wines'] },
    { region: 'Centro — Toscana (Firenze)', specialties: ['Bistecca alla fiorentina (T-bone)', 'Ribollita (bread soup)', 'Pappa al pomodoro', 'Pici pasta', 'Chianti & Brunello wines'], note: 'Cucina povera — simple, hearty peasant food elevated to art.' },
    { region: 'Centro — Roma & Lazio', specialties: ['Carbonara (no cream!)', 'Cacio e pepe', 'Amatriciana', 'Supplì (fried rice balls)', 'Carciofi alla romana'] },
    { region: 'Sud — Napoli & Campania', specialties: ['Pizza napoletana (UNESCO heritage!)', 'Mozzarella di bufala', 'Sfogliatella pastry', 'Spaghetti alle vongole', 'Limoncello'], note: 'Birthplace of pizza. Tomato-based, olive oil cuisine.' },
    { region: 'Sud — Sicilia & Sardegna', specialties: ['Arancini (fried rice balls)', 'Caponata (sweet & sour aubergine)', 'Granita & brioche', 'Pane carasau (flatbread)', 'Bottarga (cured fish roe)'], note: 'Arab, Norman, and Spanish influences create unique flavour profiles.' },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-transparent">
          <p className="text-sm font-semibold text-center">La Cucina Italiana — Italian Regional Cuisine</p>
          <p className="text-xs text-muted-foreground text-center">UNESCO Intangible Cultural Heritage — every region has its own proud culinary tradition</p>
        </div>
        <div className="divide-y">
          {regions.map(({ region, specialties, note }) => (
            <div key={region} className="px-4 py-2.5 text-xs">
              <p className="font-semibold text-green-700 dark:text-green-400">{region}</p>
              <p className="text-muted-foreground mt-0.5">{specialties.join(' · ')}</p>
              {note && <p className="mt-0.5 text-muted-foreground italic">{note}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-semibold mb-2">Essential Italian Food Vocabulary</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          {[
            ['il primo', '1st course — pasta, risotto, soup'],
            ['il secondo', '2nd course — meat or fish'],
            ["l'antipasto", 'appetizer / starter'],
            ['il contorno', 'side dish — vegetables'],
            ['il dolce', 'dessert'],
            ['il caffè', 'espresso — always last!'],
            ['Buon appetito!', 'Enjoy your meal!'],
            ['Il conto, per favore', 'The bill, please.'],
          ].map(([word, def]) => (
            <div key={word} className="flex gap-1">
              <span className="font-semibold shrink-0">{word}</span>
              <span className="text-muted-foreground">— {def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ITALIAN DIALECT CARD ─────────────────────────────────────────────────────

export function ItalianDialectCard() {
  const dialects: { zone: string; color: string; varieties: string; note: string }[] = [
    {
      zone: 'Nord — Gallo-italico',
      color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
      varieties: 'Piemontese, Lombardo, Ligure, Emiliano-Romagnolo',
      note: 'Influence of French and Celtic. Shorter vowels; some nasal sounds. "Cà" for "casa."',
    },
    {
      zone: 'Nord-Est — Venetico',
      color: 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700',
      varieties: 'Veneziano, Vicentino, Veronese, Friulano, Ladino',
      note: 'Venetian was once a major Mediterranean trade language. Distinctive "el" article.',
    },
    {
      zone: 'Centro — Toscano',
      color: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
      varieties: 'Fiorentino, Senese, Pisano, Aretino',
      note: 'Standard Italian is based on Florentine Tuscan. The "gorgia toscana" softens c/g sounds.',
    },
    {
      zone: 'Centro — Laziale & Umbro-Marchigiano',
      color: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
      varieties: 'Romano, Umbro, Marchigiano',
      note: 'Roman dialect uses "aho" for emphasis. "Nun" for "non." Strong regional pride.',
    },
    {
      zone: 'Sud — Meridionale',
      color: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
      varieties: 'Napoletano, Calabrese, Pugliese, Abruzzese, Molisano',
      note: 'Richer vocabulary from Arabic, Spanish, Greek. Double consonants more pronounced.',
    },
    {
      zone: 'Estremo Sud — Siciliano & Sardo',
      color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
      varieties: 'Siciliano, Sardo (Logudorese, Campidanese)',
      note: 'Sicilian is sometimes considered a separate language. Sardinian (Sardo) is officially recognized as a distinct Romance language.',
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">I Dialetti Italiani — Italian Dialect Zones</p>
        <p className="text-xs text-muted-foreground text-center">Italy has dozens of regional varieties — all Italians understand standard Italian (italiano standard)</p>
      </div>
      <div className="divide-y">
        {dialects.map(({ zone, color, varieties, note }) => (
          <div key={zone} className={`p-3 border-l-4 ${color}`}>
            <p className="text-sm font-semibold">{zone}</p>
            <p className="text-xs font-medium mt-0.5">{varieties}</p>
            <p className="text-xs text-muted-foreground italic mt-0.5">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ITALIAN ETIQUETTE ────────────────────────────────────────────────────────

export function ItalianEtiquetteCard() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-transparent">
          <p className="text-sm font-semibold text-center">Galateo Italiano — Italian Social Etiquette</p>
        </div>
        <div className="divide-y text-xs">
          <div className="px-4 py-2.5">
            <p className="font-semibold text-green-700 dark:text-green-400 mb-1">Greeting Customs</p>
            <div className="space-y-0.5 text-muted-foreground">
              <p>• <span className="font-medium text-foreground">Cheek kisses (baci)</span> — standard greeting between friends: two kisses, right cheek first (varies by region). Often accompanied by a warm hug.</p>
              <p>• <span className="font-medium text-foreground">Handshake (stretta di mano)</span> — standard in business; firm but not aggressive.</p>
              <p>• <span className="font-medium text-foreground">Tu vs. Lei</span> — use "Lei" (formal "you") with elders, strangers, and in business. Tu with friends, family, peers.</p>
              <p>• "Ciao" is informal only — use "Buongiorno / Buonasera" with strangers and in formal contexts.</p>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold text-green-700 dark:text-green-400 mb-1">Dining Etiquette</p>
            <div className="space-y-0.5 text-muted-foreground">
              <p>• <span className="font-medium text-foreground">Never rush eating</span> — meals are social events; lingering is expected and appreciated.</p>
              <p>• <span className="font-medium text-foreground">No cappuccino after 11am</span> — Italians only drink milky coffee in the morning. Espresso any time.</p>
              <p>• <span className="font-medium text-foreground">Bread is not an appetizer</span> — bread (il pane) accompanies the meal; don't fill up on it before ordering.</p>
              <p>• <span className="font-medium text-foreground">Pasta is not a side dish</span> — it's always a separate course (il primo).</p>
              <p>• Splitting the bill (fare alla romana) is common among friends.</p>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold text-green-700 dark:text-green-400 mb-1">Social & Cultural Norms</p>
            <div className="space-y-0.5 text-muted-foreground">
              <p>• <span className="font-medium text-foreground">Bella figura</span> — making a good impression; looking and acting your best is deeply valued.</p>
              <p>• <span className="font-medium text-foreground">Punctuality is flexible</span> — being 10–15 minutes late is normal socially (but not in business).</p>
              <p>• <span className="font-medium text-foreground">Sunday is family day</span> — family lunches on Sunday are sacred in many households.</p>
              <p>• Dress code matters — Italians are known for fashion-consciousness (fare bella figura).</p>
              <p>• When entering a church: cover shoulders and knees (essentials for tourists).</p>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold text-green-700 dark:text-green-400 mb-1">Useful Phrases</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 text-muted-foreground">
              <span><span className="font-medium text-foreground">Permesso</span> — Excuse me (asking to pass)</span>
              <span><span className="font-medium text-foreground">Mi dispiace</span> — I'm sorry</span>
              <span><span className="font-medium text-foreground">Prego</span> — You're welcome / Please / Go ahead</span>
              <span><span className="font-medium text-foreground">Grazie mille</span> — Thank you very much</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ITALIAN CURRENCY ─────────────────────────────────────────────────────────

export function ItalianCurrencyCard() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-transparent">
          <p className="text-sm font-semibold text-center">La Valuta Italiana — Italian Currency</p>
        </div>
        <div className="divide-y text-xs">
          <div className="px-4 py-2.5">
            <p className="font-semibold text-green-700 dark:text-green-400">Euro (€) — EUR</p>
            <p className="text-muted-foreground mt-0.5">Italy adopted the Euro in 2002, replacing the Italian Lira (₤). The Euro is used by all 20 Italian regions and shared by 20 EU countries.</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Coins — Monete</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>1 cent, 2 cent, 5 cent</span>
              <span>10 cent, 20 cent, 50 cent</span>
              <span>1 euro (€1,00)</span>
              <span>2 euro (€2,00)</span>
            </div>
            <p className="mt-1 text-muted-foreground italic">Italian euro coins have famous designs: the Colosseum, Leonardo da Vinci's Vitruvian Man, Botticelli's Venus, Dante Alighieri, and Castel del Monte.</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Banknotes — Banconote</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>€5 — grey</span>
              <span>€10 — red</span>
              <span>€20 — blue</span>
              <span>€50 — orange</span>
              <span>€100 — green</span>
              <span>€200 / €500 — yellow/purple</span>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Useful Money Expressions</p>
            <div className="space-y-0.5 text-muted-foreground">
              <p><span className="font-medium text-foreground">Quanto costa?</span> — How much does it cost?</p>
              <p><span className="font-medium text-foreground">Il conto, per favore.</span> — The bill, please.</p>
              <p><span className="font-medium text-foreground">Posso pagare con la carta?</span> — Can I pay by card?</p>
              <p><span className="font-medium text-foreground">Hai il resto?</span> — Do you have change?</p>
              <p><span className="font-medium text-foreground">È incluso il servizio?</span> — Is service included?</p>
              <p><span className="font-medium text-foreground">Italiani scrivono</span> — Italians write: €1.234,56 (dot = thousands, comma = decimals)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ITALIAN GESTURE CARD ─────────────────────────────────────────────────────

export function ItalianGestureCard() {
  const gestures: { name: string; gesture: string; meaning: string; usage: string }[] = [
    {
      name: 'Il gesto delle dita a mazzetto',
      gesture: 'Fingers bunched together, tips touching, hand shaken',
      meaning: 'What do you want? / What are you talking about? / So what?',
      usage: 'The most iconic Italian gesture — used in all regions, especially in the south.',
    },
    {
      name: 'Va bene / Tutto bene',
      gesture: 'Thumb and forefinger form a circle (OK sign)',
      meaning: "OK / That's perfect / All good",
      usage: 'Positive affirmation — very common in everyday conversation.',
    },
    {
      name: 'Non me ne frega niente',
      gesture: 'Back of hand tapped under chin, flicked forward',
      meaning: "I don't care / I couldn't care less",
      usage: 'Can be rude depending on context and tone.',
    },
    {
      name: 'Che buono! (Delicious!)',
      gesture: 'Forefinger pressed to cheek and rotated',
      meaning: 'Delicious! Excellent! Amazing!',
      usage: 'For food, but also for anything wonderful.',
    },
    {
      name: 'Ho fame / Mangiare',
      gesture: 'Fingers and thumb brought to lips repeatedly',
      meaning: "I'm hungry / Let's eat / It's delicious",
      usage: 'Very common, especially in the south.',
    },
    {
      name: 'Soldi (Money)',
      gesture: 'Thumb rubbing over fingers like counting bills',
      meaning: 'Money / It costs a lot / Pay up',
      usage: 'Universal meaning — used across all regions.',
    },
    {
      name: 'Occhio! (Watch out!)',
      gesture: 'Forefinger pulling down lower eyelid',
      meaning: 'Watch out! / Be careful / Pay attention',
      usage: 'Informal warning — often used by older generations.',
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">I Gesti Italiani — Italian Gestures</p>
        <p className="text-xs text-muted-foreground text-center">Italy has ~250 distinct gestures — a rich non-verbal language used alongside speech</p>
      </div>
      <div className="divide-y">
        {gestures.map(({ name, gesture, meaning, usage }) => (
          <div key={name} className="px-4 py-2.5 text-xs">
            <p className="font-semibold text-green-700 dark:text-green-400">{name}</p>
            <p className="text-muted-foreground mt-0.5"><span className="font-medium text-foreground">Gesture:</span> {gesture}</p>
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Meaning:</span> {meaning}</p>
            <p className="text-muted-foreground italic">{usage}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
