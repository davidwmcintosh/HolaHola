/**
 * TextbookCulturalCards.tsx
 * Section 5 — Cultural Infographics
 * All pure React/SVG — no image generation required.
 * Auto-triggered by chapter title via classifyGrammarType() in ChapterIntroduction.tsx.
 *
 * Components:
 *  SpanishWorldMapCard  — 21 countries × 5 regions, capitals
 *  FestivalCalendarCard — 12-month celebration calendar
 *  DialectMapCard       — 6 dialect zones + key differences
 *  FamilyTreeCard       — SVG family tree with relationship vocabulary
 *  GreetingEtiquetteCard — country-by-country greeting customs
 *  CurrencyReferenceCard — 8 Spanish-world currencies
 */

// ─── SPANISH-SPEAKING WORLD MAP ──────────────────────────────────────────────

const REGIONS = [
  {
    name: 'North America',
    color: 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    countries: [
      { name: 'México', capital: 'Ciudad de México', abbr: 'MX' },
    ],
  },
  {
    name: 'Central America',
    color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    countries: [
      { name: 'Guatemala', capital: 'Ciudad de Guatemala', abbr: 'GT' },
      { name: 'Honduras', capital: 'Tegucigalpa', abbr: 'HN' },
      { name: 'El Salvador', capital: 'San Salvador', abbr: 'SV' },
      { name: 'Nicaragua', capital: 'Managua', abbr: 'NI' },
      { name: 'Costa Rica', capital: 'San José', abbr: 'CR' },
      { name: 'Panamá', capital: 'Ciudad de Panamá', abbr: 'PA' },
    ],
  },
  {
    name: 'Caribbean',
    color: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-700 dark:text-cyan-300',
    dot: 'bg-cyan-500',
    countries: [
      { name: 'Cuba', capital: 'La Habana', abbr: 'CU' },
      { name: 'Rep. Dominicana', capital: 'Santo Domingo', abbr: 'DO' },
      { name: 'Puerto Rico', capital: 'San Juan', abbr: 'PR' },
    ],
  },
  {
    name: 'South America',
    color: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    countries: [
      { name: 'Venezuela', capital: 'Caracas', abbr: 'VE' },
      { name: 'Colombia', capital: 'Bogotá', abbr: 'CO' },
      { name: 'Ecuador', capital: 'Quito', abbr: 'EC' },
      { name: 'Perú', capital: 'Lima', abbr: 'PE' },
      { name: 'Bolivia', capital: 'Sucre / La Paz', abbr: 'BO' },
      { name: 'Paraguay', capital: 'Asunción', abbr: 'PY' },
      { name: 'Chile', capital: 'Santiago', abbr: 'CL' },
      { name: 'Argentina', capital: 'Buenos Aires', abbr: 'AR' },
      { name: 'Uruguay', capital: 'Montevideo', abbr: 'UY' },
    ],
  },
  {
    name: 'Europe & Africa',
    color: 'bg-violet-500/15 border-violet-500/30 text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
    countries: [
      { name: 'España', capital: 'Madrid', abbr: 'ES' },
      { name: 'Guinea Ecuatorial', capital: 'Malabo', abbr: 'GQ' },
    ],
  },
];

export function SpanishWorldMapCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-world-map">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-blue-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">El Mundo Hispanohablante</p>
        <p className="text-xs text-muted-foreground text-center">21 Spanish-speaking countries across 5 regions — ~500 million native speakers</p>
      </div>
      <div className="p-3 space-y-2">
        {REGIONS.map((region) => (
          <div key={region.name} className={`rounded-md border p-2.5 ${region.color}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={`w-2 h-2 rounded-full shrink-0 ${region.dot}`} />
              <p className="text-xs font-semibold">{region.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {region.countries.map(({ name, capital, abbr }) => (
                <div key={abbr} className="flex items-baseline gap-1.5 text-xs">
                  <span className="font-medium text-foreground w-5 shrink-0 text-muted-foreground">{abbr}</span>
                  <span className="font-semibold text-foreground">{name}</span>
                  <span className="text-muted-foreground truncate">— {capital}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground text-center">Spanish is the world's 2nd most spoken language by native speakers — ahead of English</p>
      </div>
    </div>
  );
}

// ─── FESTIVAL CALENDAR ────────────────────────────────────────────────────────

const FESTIVALS: Record<string, { name: string; where: string; note: string }[]> = {
  January: [
    { name: 'Año Nuevo', where: 'All countries', note: 'New Year\'s — widespread family traditions' },
    { name: 'Día de los Reyes Magos', where: 'Spain & Latin America', note: 'Three Kings gift-giving (Jan 6)' },
  ],
  February: [
    { name: 'Carnaval', where: 'Venezuela, Uruguay, Cuba', note: 'Pre-Lent street festivals, music, costumes' },
    { name: 'Día de San Valentín', where: 'All countries', note: 'Valentine\'s Day' },
  ],
  March: [
    { name: 'Fallas de Valencia', where: 'Spain', note: 'Huge papier-mâché sculptures burned Mar 19' },
    { name: 'Día Internacional de la Mujer', where: 'All countries', note: 'International Women\'s Day (Mar 8)' },
  ],
  April: [
    { name: 'Semana Santa', where: 'All countries', note: 'Holy Week processions — esp. spectacular in Spain, Guatemala' },
    { name: 'Feria de Sevilla', where: 'Spain', note: 'Seville Spring Fair — flamenco, horses, tapas' },
  ],
  May: [
    { name: 'Día del Trabajo', where: 'All countries', note: 'Labor Day (May 1)' },
    { name: 'Cinco de Mayo', where: 'Mexico (& diaspora)', note: 'Battle of Puebla victory (1862) — popular in USA' },
  ],
  June: [
    { name: 'Día de la Música', where: 'All countries', note: 'Music Day (Jun 21) — free concerts everywhere' },
    { name: 'Inti Raymi', where: 'Peru, Ecuador, Bolivia', note: 'Inca Festival of the Sun (Jun 24)' },
  ],
  July: [
    { name: 'San Fermín', where: 'Spain', note: 'Running of the bulls in Pamplona (Jul 6–14)' },
    { name: 'Día de Independencia', where: 'Argentina (Jul 9), Colombia (Jul 20)', note: 'Independence Days' },
  ],
  August: [
    { name: 'Asunción de la Virgen', where: 'Spain & Latin America', note: 'Religious holiday (Aug 15)' },
    { name: 'La Tomatina', where: 'Spain', note: 'World\'s largest tomato fight — Buñol, Valencia (last Wed Aug)' },
  ],
  September: [
    { name: 'Fiestas Patrias', where: 'Chile (Sep 18–19), Mexico (Sep 16)', note: 'Independence celebrations' },
    { name: 'Día de la Hispanidad', where: 'Spain', note: 'National Day (Oct 12 — listed early)' },
  ],
  October: [
    { name: 'Día de la Raza', where: 'All countries', note: 'Columbus Day / Día de la Hispanidad (Oct 12)' },
    { name: 'Día de las Brujas', where: 'All countries (growing)', note: 'Halloween influence is spreading across the region' },
  ],
  November: [
    { name: 'Día de los Muertos', where: 'Mexico (& broader)', note: 'Nov 1–2 — altars, marigolds, visiting graves' },
    { name: 'Día de Todos los Santos', where: 'All countries', note: 'All Saints\' Day (Nov 1) — Catholic tradition' },
  ],
  December: [
    { name: 'Las Posadas', where: 'Mexico & Central America', note: '9 nights of processions Dec 16–24' },
    { name: 'Nochebuena', where: 'All countries', note: 'Christmas Eve family feast (Dec 24) — more important than Dec 25' },
    { name: 'Nochevieja', where: 'All countries', note: 'New Year\'s Eve — 12 grapes at midnight for luck' },
  ],
};

export function FestivalCalendarCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-festival-calendar">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-amber-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Festividades del Mundo Hispanohablante</p>
        <p className="text-xs text-muted-foreground text-center">Major celebrations across the Spanish-speaking world, month by month</p>
      </div>
      <div className="divide-y">
        {Object.entries(FESTIVALS).map(([month, events]) => (
          <div key={month} className="grid grid-cols-[80px_1fr] text-xs">
            <div className="px-3 py-2.5 bg-muted/30 font-semibold text-muted-foreground flex items-start">
              {month}
            </div>
            <div className="px-3 py-2 space-y-1.5">
              {events.map(({ name, where, note }) => (
                <div key={name}>
                  <span className="font-semibold text-foreground">{name}</span>
                  <span className="text-muted-foreground"> — {where}</span>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-tight">{note}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DIALECT MAP ──────────────────────────────────────────────────────────────

const DIALECTS = [
  {
    zone: 'Castilian Spanish',
    where: 'Spain (north & central)',
    color: 'bg-violet-500/12 border-violet-500/25 text-violet-700 dark:text-violet-300',
    phonology: ['Distinction z/c ≠ s (ceceo)', 'LL distinct from Y', 'Vosotros used'],
    vocab: ['"Coche" (car) — LATAM: carro/auto', '"Ordenador" (computer) — LATAM: computadora', '"Vale" (OK) — LATAM: bueno/okey'],
  },
  {
    zone: 'Andalusian / Canarian',
    where: 'Southern Spain, Canary Islands',
    color: 'bg-orange-500/12 border-orange-500/25 text-orange-700 dark:text-orange-300',
    phonology: ['Seseo — z/c = s (like LATAM)', 'Yeísmo (LL = Y)', 'S often aspirated or dropped at end of syllable'],
    vocab: ['"Ustedes" for plural "you" (like LATAM, not vosotros)', 'Bridge between Castilian and Latin American Spanish'],
  },
  {
    zone: 'Mexican & Central American',
    where: 'Mexico, Guatemala, Honduras, El Salvador…',
    color: 'bg-green-500/12 border-green-500/25 text-green-700 dark:text-green-300',
    phonology: ['Seseo (s = z/c)', 'Clear vowels, consonants well-articulated', '"Standard" Latin American sound to many ears'],
    vocab: ['"Camión" (bus) — not autobús', '"Padre" = cool/awesome (slang)', '"Ahorita" = right now (or not soon — context!)', '"Güey/wey" = dude (Mexico)'],
  },
  {
    zone: 'Caribbean',
    where: 'Cuba, Dominican Rep., Puerto Rico, coastal Venezuela/Colombia',
    color: 'bg-cyan-500/12 border-cyan-500/25 text-cyan-700 dark:text-cyan-300',
    phonology: ['S aspirated at syllable end (e.g. "ej-to" = "esto")', 'R may merge with L ("veldad" = "verdad")', 'Fast, rhythmic speech'],
    vocab: ['"Guagua" (bus) — Cuba/PR', '"Ñame" (yam) — Caribbean origin', '"Chévere" = cool (everywhere in Caribbean)'],
  },
  {
    zone: 'Andean',
    where: 'Peru, Ecuador, Bolivia, parts of Colombia',
    color: 'bg-amber-500/12 border-amber-500/25 text-amber-700 dark:text-amber-300',
    phonology: ['S fully pronounced (clearest in Spanish-speaking world)', 'LL retained distinct from Y', 'Indigenous Quechua/Aymara influence'],
    vocab: ['"Palta" (avocado) — from Quechua', '"Choclo" (corn) — Quechua', '"Pe" = "pues" (filler, Peru)', 'Quechua words in everyday speech'],
  },
  {
    zone: 'River Plate',
    where: 'Argentina, Uruguay',
    color: 'bg-rose-500/12 border-rose-500/25 text-rose-700 dark:text-rose-300',
    phonology: ['LL/Y pronounced as "sh" or "zh" (sheísmo)', 'Vos instead of tú (voseo)', 'Distinctive intonation — Italian immigration influence'],
    vocab: ['"Vos querés" (not "tú quieres")', '"Che" = hey/mate (Argentina)', '"Colectivo" (bus)', '"Departamento" (apartment) — not piso'],
  },
];

export function DialectMapCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-dialect-map">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-slate-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Dialectos del Español</p>
        <p className="text-xs text-muted-foreground text-center">6 major dialect zones — same language, fascinating variation</p>
      </div>
      <div className="divide-y">
        {DIALECTS.map(({ zone, where, color, phonology, vocab }) => (
          <div key={zone} className={`p-3 border-l-2 ${color}`}>
            <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1.5">
              <p className="text-xs font-bold">{zone}</p>
              <p className="text-xs text-muted-foreground italic">{where}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <p className="font-medium text-muted-foreground mb-0.5">Sound / Phonology</p>
                {phonology.map((p, i) => <p key={i} className="text-foreground leading-tight">· {p}</p>)}
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-0.5">Vocabulary</p>
                {vocab.map((v, i) => <p key={i} className="text-foreground leading-tight">· {v}</p>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FAMILY TREE ──────────────────────────────────────────────────────────────

interface FamilyNode {
  label: string;
  sublabel: string;
  x: number;
  y: number;
  color: string;
  border: string;
}

const FAMILY_NODES: FamilyNode[] = [
  { label: 'abuelo', sublabel: 'grandfather', x: 80, y: 24, color: 'fill-violet-500/20', border: 'stroke-violet-500/60' },
  { label: 'abuela', sublabel: 'grandmother', x: 220, y: 24, color: 'fill-violet-500/20', border: 'stroke-violet-500/60' },
  { label: 'abuelo', sublabel: 'grandfather', x: 480, y: 24, color: 'fill-violet-500/20', border: 'stroke-violet-500/60' },
  { label: 'abuela', sublabel: 'grandmother', x: 620, y: 24, color: 'fill-violet-500/20', border: 'stroke-violet-500/60' },
  { label: 'tío/a', sublabel: 'uncle/aunt', x: 80, y: 130, color: 'fill-blue-500/15', border: 'stroke-blue-500/50' },
  { label: 'padre', sublabel: 'father', x: 220, y: 130, color: 'fill-blue-500/15', border: 'stroke-blue-500/50' },
  { label: 'madre', sublabel: 'mother', x: 360, y: 130, color: 'fill-pink-500/15', border: 'stroke-pink-500/50' },
  { label: 'tío/a', sublabel: 'uncle/aunt', x: 500, y: 130, color: 'fill-blue-500/15', border: 'stroke-blue-500/50' },
  { label: 'primo/a', sublabel: 'cousin', x: 80, y: 235, color: 'fill-emerald-500/15', border: 'stroke-emerald-500/50' },
  { label: 'hermano/a', sublabel: 'sibling', x: 220, y: 235, color: 'fill-amber-500/15', border: 'stroke-amber-500/50' },
  { label: 'YO', sublabel: 'me', x: 360, y: 235, color: 'fill-primary/20', border: 'stroke-primary' },
  { label: 'primo/a', sublabel: 'cousin', x: 500, y: 235, color: 'fill-emerald-500/15', border: 'stroke-emerald-500/50' },
];

function FamilyLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4,3" />;
}

export function FamilyTreeCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-family-tree">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-emerald-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Árbol Genealógico — Family Vocabulary</p>
        <p className="text-xs text-muted-foreground text-center">Spanish family relationships with English translations</p>
      </div>
      <div className="p-3">
        <svg viewBox="0 0 700 310" className="w-full h-auto" aria-label="Family tree diagram">
          <FamilyLine x1={150} y1={54} x2={150} y2={130} />
          <FamilyLine x1={80} y1={130} x2={220} y2={130} />
          <FamilyLine x1={550} y1={54} x2={550} y2={130} />
          <FamilyLine x1={480} y1={130} x2={620} y2={130} />
          <FamilyLine x1={150} y1={60} x2={220} y2={60} />
          <FamilyLine x1={480} y1={60} x2={620} y2={60} />
          <FamilyLine x1={290} y1={160} x2={290} y2={200} />
          <FamilyLine x1={220} y1={160} x2={360} y2={160} />
          <FamilyLine x1={290} y1={200} x2={220} y2={235} />
          <FamilyLine x1={290} y1={200} x2={360} y2={235} />
          <FamilyLine x1={80} y1={160} x2={80} y2={235} />
          <FamilyLine x1={500} y1={160} x2={500} y2={235} />
          {FAMILY_NODES.map(({ label, sublabel, x, y, color, border }) => (
            <g key={`${label}-${x}-${y}`} transform={`translate(${x},${y})`}>
              <rect x="-45" y="-20" width="90" height="42" rx="6" className={color} stroke="hsl(var(--border))" strokeWidth="1" />
              <text textAnchor="middle" y="5" fontSize="10" fontWeight="700" className="fill-foreground">{label}</text>
              <text textAnchor="middle" y="17" fontSize="8" className="fill-muted-foreground">{sublabel}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="border-t">
        <div className="grid grid-cols-3 divide-x divide-y text-xs">
          {[
            ['esposo/a', 'husband / wife'],
            ['novio/a', 'boyfriend / girlfriend'],
            ['suegro/a', 'father / mother-in-law'],
            ['cuñado/a', 'brother / sister-in-law'],
            ['sobrino/a', 'nephew / niece'],
            ['nieto/a', 'grandson / granddaughter'],
            ['hijo único/a', 'only child'],
            ['gemelos/as', 'twins'],
            ['pariente', 'relative (general)'],
          ].map(([sp, en]) => (
            <div key={sp} className="px-2.5 py-2">
              <p className="font-semibold text-foreground">{sp}</p>
              <p className="text-muted-foreground">{en}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GREETING ETIQUETTE ───────────────────────────────────────────────────────

const GREETINGS_DATA = [
  { region: 'Spain', greeting: 'Two cheek kisses', formal: 'Handshake', notes: 'Right cheek first. Very common even between strangers. Men shake hands with each other.' },
  { region: 'Mexico', greeting: 'One cheek kiss', formal: 'Handshake', notes: 'Less effusive than Spain. Handshake most common in business. Hug (abrazo) with close friends.' },
  { region: 'Argentina & Uruguay', greeting: 'One cheek kiss', formal: 'Handshake', notes: 'Very warm — kisses between men in close friendships common. Strong abrazo culture.' },
  { region: 'Colombia', greeting: 'One cheek kiss', formal: 'Handshake', notes: 'Similar to Mexico. Formal contexts = handshake. Eye contact important during greeting.' },
  { region: 'Peru & Ecuador', greeting: 'One cheek kiss', formal: 'Handshake', notes: 'Andean influence — slightly more reserved than coastal regions.' },
  { region: 'Cuba & Caribbean', greeting: 'One cheek kiss + hug', formal: 'Handshake', notes: 'Warm, expressive. Physical contact important. Strangers may also receive a cheek kiss.' },
  { region: 'Central America', greeting: 'One cheek kiss', formal: 'Handshake', notes: 'Conservative in formal/business settings. Casual among friends and family.' },
];

export function GreetingEtiquetteCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-greeting-etiquette">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-rose-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Saludos — Greeting Customs by Region</p>
        <p className="text-xs text-muted-foreground text-center">Physical greetings vary — knowing the norms shows cultural respect</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Region</th>
              <th className="px-3 py-1.5 text-left font-semibold">Casual</th>
              <th className="px-3 py-1.5 text-left font-semibold">Formal</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody>
            {GREETINGS_DATA.map(({ region, greeting, formal, notes }, i) => (
              <tr key={region} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                <td className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">{region}</td>
                <td className="px-3 py-2 text-rose-600 dark:text-rose-400 font-medium whitespace-nowrap">{greeting}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formal}</td>
                <td className="px-3 py-2 text-muted-foreground leading-snug">{notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground text-center">Key phrase: <span className="font-semibold text-foreground">Mucho gusto en conocerte</span> = Nice to meet you (informal) &nbsp;·&nbsp; <span className="font-semibold text-foreground">Es un placer conocerle</span> = formal</p>
      </div>
    </div>
  );
}

// ─── CURRENCY REFERENCE ───────────────────────────────────────────────────────

const CURRENCIES = [
  { country: 'España', currency: 'Euro', symbol: '€', code: 'EUR', note: 'Shared with EU — most stable' },
  { country: 'México', currency: 'Peso Mexicano', symbol: '$', code: 'MXN', note: '~17–20 MXN per 1 USD (varies)' },
  { country: 'Argentina', currency: 'Peso Argentino', symbol: '$', code: 'ARS', note: 'High inflation — exchange rates change rapidly' },
  { country: 'Colombia', currency: 'Peso Colombiano', symbol: '$', code: 'COP', note: '~4,000 COP per 1 USD' },
  { country: 'Chile', currency: 'Peso Chileno', symbol: '$', code: 'CLP', note: '~900 CLP per 1 USD' },
  { country: 'Perú', currency: 'Sol', symbol: 'S/', code: 'PEN', note: '~3.7 PEN per 1 USD' },
  { country: 'Cuba', currency: 'Peso Cubano', symbol: '$', code: 'CUP', note: 'Dual currency system' },
  { country: 'Costa Rica', currency: 'Colón', symbol: '₡', code: 'CRC', note: '~530 CRC per 1 USD' },
];

export function CurrencyReferenceCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-currency">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-yellow-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Monedas del Mundo Hispanohablante</p>
        <p className="text-xs text-muted-foreground text-center">Currency vocabulary across the Spanish-speaking world</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">País</th>
              <th className="px-3 py-1.5 text-left font-semibold">Moneda</th>
              <th className="px-3 py-1.5 text-center font-semibold">Símbolo</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Note</th>
            </tr>
          </thead>
          <tbody>
            {CURRENCIES.map(({ country, currency, symbol, code, note }, i) => (
              <tr key={country} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                <td className="px-3 py-1.5 font-medium">{country}</td>
                <td className="px-3 py-1.5">{currency} <span className="text-muted-foreground">({code})</span></td>
                <td className="px-3 py-1.5 text-center font-bold text-yellow-600 dark:text-yellow-400">{symbol}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20 text-xs">
        <p className="text-muted-foreground">Useful vocabulary: <span className="text-foreground font-medium">billete</span> (banknote) · <span className="text-foreground font-medium">moneda</span> (coin) · <span className="text-foreground font-medium">cambio</span> (change/exchange) · <span className="text-foreground font-medium">tipo de cambio</span> (exchange rate) · <span className="text-foreground font-medium">cajero automático</span> (ATM)</p>
      </div>
    </div>
  );
}
