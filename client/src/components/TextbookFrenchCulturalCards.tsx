/**
 * TextbookFrenchCulturalCards.tsx
 * Section 5 — French cultural reference cards.
 * Mirrors the structure of TextbookCulturalCards.tsx for Spanish.
 *
 * Cards:
 *  FrancophoneWorldMapCard   — where French is spoken around the globe
 *  FrenchHolidayCalendarCard — major French/Francophone public holidays
 *  FrenchFoodGuideCard       — regional French cuisine (7 regions)
 *  FrenchDialectZonesCard    — Francophone regional speech varieties
 *  LaBiseEtiquetteCard       — the French cheek-kiss greeting, region by region
 *  FrenchCurrencyCard        — currencies across the Francophone world
 *  FrGestureAwarenessCard    — cultural body-language awareness
 */

// ─── FRANCOPHONE WORLD MAP ────────────────────────────────────────────────────

export function FrancophoneWorldMapCard() {
  const regions: {
    name: string;
    color: string;
    countries: string[];
    note?: string;
  }[] = [
    {
      name: 'Europe',
      color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
      countries: ['France', 'Belgique', 'Suisse', 'Luxembourg', 'Monaco', 'Andorre (partial)'],
    },
    {
      name: 'Amérique du Nord',
      color: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
      countries: ['Canada (Québec, Nouveau-Brunswick, Manitoba)', 'Haïti', 'Guadeloupe', 'Martinique', 'Saint-Martin', 'Saint-Pierre-et-Miquelon'],
    },
    {
      name: 'Afrique du Nord & Proche-Orient',
      color: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
      countries: ['Maroc', 'Algérie', 'Tunisie', 'Mauritanie', 'Liban'],
    },
    {
      name: 'Afrique subsaharienne',
      color: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
      countries: ["Sénégal", "Côte d'Ivoire", "Cameroun", "Mali", "Burkina Faso", "Niger", "Gabon", "Congo", "RDC", "Guinée", "Togo", "Bénin", "Rwanda", "Burundi"],
    },
    {
      name: 'Océan Indien & Pacifique',
      color: 'bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700',
      countries: ['Madagascar', 'Réunion', 'Mayotte', 'Comores', 'Maurice', 'Nouvelle-Calédonie', 'Polynésie française'],
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="card-fr-francophone-map">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-500/10 to-teal-500/10">
        <p className="text-sm font-semibold text-center">La Francophonie — Where French Is Spoken</p>
        <p className="text-xs text-muted-foreground text-center">~274 million speakers across 5 continents · official language in 29 countries</p>
      </div>

      {/* Visual world band */}
      <div className="px-4 py-3 border-b">
        <div className="flex rounded overflow-hidden h-5 w-full">
          {[
            { color: 'bg-blue-400 dark:bg-blue-600', pct: '14%', label: 'Europe' },
            { color: 'bg-amber-400 dark:bg-amber-600', pct: '12%', label: 'N. America' },
            { color: 'bg-orange-400 dark:bg-orange-600', pct: '14%', label: 'N. Africa' },
            { color: 'bg-green-500 dark:bg-green-600', pct: '52%', label: 'Sub-Saharan Africa' },
            { color: 'bg-teal-400 dark:bg-teal-600', pct: '8%', label: 'Indian/Pacific' },
          ].map(({ color, pct, label }) => (
            <div key={label} className={`${color} flex items-center justify-center overflow-hidden`} style={{ width: pct }}>
              <span className="text-white text-[8px] font-semibold truncate px-0.5 hidden sm:block">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">Africa is home to the largest and fastest-growing French-speaking population in the world</p>
      </div>

      <div className="divide-y">
        {regions.map(({ name, color, countries }) => (
          <div key={name} className="px-4 py-2.5 flex gap-3">
            <span className={`mt-0.5 shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${color} w-44`}>{name}</span>
            <p className="text-xs text-muted-foreground">{countries.join(' · ')}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">La Francophonie</span> is both the community of French speakers and the Organisation Internationale de la Francophonie (OIF), a cultural and political body linking 88 member states.
        </p>
      </div>
    </div>
  );
}

// ─── FRENCH HOLIDAY CALENDAR ─────────────────────────────────────────────────

export function FrenchHolidayCalendarCard() {
  const holidays: { date: string; name: string; en: string; note?: string }[] = [
    { date: '1 janvier', name: 'Jour de l\'An', en: 'New Year\'s Day', note: 'Réveillon celebrations the night before' },
    { date: 'janv./fév.', name: 'L\'Épiphanie', en: 'Epiphany / Three Kings Day', note: 'La galette des rois — almond cake with a hidden figurine' },
    { date: 'mars/avril', name: 'Mardi Gras', en: 'Shrove Tuesday / Mardi Gras', note: 'Crêpes! Carnival celebrations in Nice and elsewhere' },
    { date: 'mars/avril', name: 'Pâques', en: 'Easter Sunday + Monday', note: 'Les cloches volent (bells fly to Rome) · children hunt for chocolate eggs' },
    { date: '1 mai', name: 'Fête du Travail', en: 'Labour Day', note: 'Give a sprig of muguet (lily of the valley) for luck' },
    { date: '8 mai', name: 'Victoire 1945', en: 'VE Day (WWII Victory)', note: 'Commemorates the end of WWII in Europe' },
    { date: 'mai/juin', name: 'Ascension · Pentecôte', en: 'Ascension · Whit Monday', note: 'Both are public holidays (jours fériés)' },
    { date: '21 juin', name: 'Fête de la Musique', en: 'Music Day', note: 'Free concerts everywhere — musicians perform outdoors all evening' },
    { date: '14 juillet', name: 'Fête Nationale', en: 'Bastille Day', note: 'France\'s national day · fireworks, military parade on Champs-Élysées' },
    { date: '15 août', name: 'Assomption', en: 'Assumption of Mary', note: 'Many French leave for summer holidays this week' },
    { date: '1 novembre', name: 'Toussaint', en: 'All Saints\' Day', note: 'Families visit graves; schoolchildren have a 2-week break' },
    { date: '11 novembre', name: 'Armistice', en: 'Remembrance Day', note: 'Commemorates end of WWI (1918)' },
    { date: '25 décembre', name: 'Noël', en: 'Christmas', note: 'Réveillon dinner on Dec 24 · le Père Noël · bûche de Noël (Yule log cake)' },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="card-fr-holidays">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-red-500/10 to-blue-500/10">
        <p className="text-sm font-semibold text-center">Le Calendrier des Fêtes — French Holiday Calendar</p>
        <p className="text-xs text-muted-foreground text-center">France has 11 official jours fériés (public holidays) per year</p>
      </div>
      <div className="divide-y text-xs max-h-96 overflow-y-auto">
        {holidays.map(({ date, name, en, note }) => (
          <div key={name} className="px-4 py-2 grid grid-cols-[6rem_1fr] gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground pt-0.5">{date}</span>
            <div>
              <p className="font-semibold text-foreground">{name}</p>
              <p className="text-muted-foreground">{en}</p>
              {note && <p className="text-[10px] text-muted-foreground/80 mt-0.5 italic">{note}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">Les <span className="font-semibold text-foreground">ponts</span> (bridges): when a holiday falls on a Thursday, many people also take Friday off, creating a 4-day weekend — a beloved French tradition.</p>
      </div>
    </div>
  );
}

// ─── FRENCH REGIONAL FOOD GUIDE ───────────────────────────────────────────────

export function FrenchFoodGuideCard() {
  const regions: {
    name: string;
    color: string;
    emoji_label: string;
    specialties: string[];
  }[] = [
    {
      name: 'Île-de-France (Paris)',
      color: 'from-slate-500/10',
      emoji_label: 'The capital — where French cuisine meets the world',
      specialties: ['Baguette tradition', 'Croissant', 'Macarons', 'Steak frites', 'Soupe à l\'oignon', 'Paris-Brest (pastry)', 'Café au lait'],
    },
    {
      name: 'Normandie',
      color: 'from-yellow-500/10',
      emoji_label: 'Dairy, apples, and the sea',
      specialties: ['Camembert de Normandie (AOP)', 'Calvados (apple brandy)', 'Cidre normand', 'Moules marinières', 'Tarte Tatin', 'Crème fraîche', 'Poulet à la vallée d\'Auge'],
    },
    {
      name: 'Bretagne',
      color: 'from-cyan-500/10',
      emoji_label: 'Crêpes, seafood, and Celtic heritage',
      specialties: ['Crêpes (wheat)', 'Galettes (buckwheat)', 'Kouign-amann (buttery pastry)', 'Plateau de fruits de mer', 'Cidre breton', 'Beurre salé (salted butter)', 'Homard breton'],
    },
    {
      name: 'Bordeaux & Aquitaine',
      color: 'from-red-500/10',
      emoji_label: 'Wine capital of the world',
      specialties: ['Bordeaux reds (Merlot, Cabernet Sauvignon)', 'Canelé (rum/vanilla pastry)', 'Entrecôte bordelaise', 'Foie gras', 'Huîtres d\'Arcachon (oysters)', 'Pruneau d\'Agen', 'Sauternes (dessert wine)'],
    },
    {
      name: 'Provence',
      color: 'from-orange-500/10',
      emoji_label: 'Mediterranean flavors — herbs, olive oil, and sunshine',
      specialties: ['Bouillabaisse (fish stew)', 'Ratatouille', 'Salade niçoise', 'Tapenade (olive paste)', 'Rosé de Provence', 'Herbes de Provence', 'Calisson (almond candy)'],
    },
    {
      name: 'Lyon & Rhône-Alpes',
      color: 'from-amber-500/10',
      emoji_label: 'The gastronomic capital of France',
      specialties: ['Quenelles (pike dumplings)', 'Andouillette sausage', 'Poulet de Bresse (AOP)', 'Gratin dauphinois', 'Bugnes (fried pastry)', 'Beaujolais wine', 'Fondue savoyarde'],
    },
    {
      name: 'Alsace',
      color: 'from-rose-500/10',
      emoji_label: 'Franco-German fusion at its finest',
      specialties: ['Choucroute garnie (sauerkraut + sausage)', 'Flammekueche (Tarte flambée)', 'Bretzel alsacien', 'Vin d\'Alsace (Riesling, Gewurztraminer)', 'Baeckeoffe (slow-cooked stew)', 'Kugelhopf (raisin cake)', 'Munster cheese'],
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="card-fr-food-guide">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-500/10 to-orange-500/10">
        <p className="text-sm font-semibold text-center">La Gastronomie Française — Regional Food Guide</p>
        <p className="text-xs text-muted-foreground text-center">French cuisine (UNESCO Intangible Heritage) — 7 iconic regions</p>
      </div>
      <div className="divide-y">
        {regions.map(({ name, color, emoji_label, specialties }) => (
          <div key={name} className={`px-4 py-3 bg-gradient-to-r ${color} to-transparent`}>
            <p className="text-xs font-bold text-foreground">{name}</p>
            <p className="text-[10px] text-muted-foreground mb-1.5 italic">{emoji_label}</p>
            <div className="flex flex-wrap gap-1.5">
              {specialties.map(dish => (
                <span key={dish} className="text-[10px] bg-muted/60 text-foreground px-2 py-0.5 rounded">{dish}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">France has over <span className="font-semibold text-foreground">500 distinct cheeses</span> and many wines with <span className="font-semibold text-foreground">Appellation d'Origine Protégée (AOP)</span> certification — a guarantee of regional authenticity.</p>
      </div>
    </div>
  );
}

// ─── FRENCH DIALECT ZONES ─────────────────────────────────────────────────────

export function FrenchDialectZonesCard() {
  const zones: {
    name: string;
    region: string;
    color: string;
    features: string[];
    examples: string[];
  }[] = [
    {
      name: 'Français standard',
      region: 'France (Île-de-France, broadcast media)',
      color: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20',
      features: ['The reference variety taught in schools worldwide', 'Soixante-dix (70), quatre-vingts (80), quatre-vingt-dix (90)'],
      examples: ['J\'ai soixante-dix ans.', 'Il est quatre-vingt-cinq.'],
    },
    {
      name: 'Français québécois',
      region: 'Québec, Canada',
      color: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20',
      features: ['Different vocabulary: char (car), magasiner (to shop), fin de semaine (weekend)', 'Distinct pronunciation: diphtongs, "tu" as question tag', 'More English loanwords in everyday speech'],
      examples: ['Je m\'en vas au dépanneur.', 'C\'est-tu correct?', 'Y fait frette!'],
    },
    {
      name: 'Français belge',
      region: 'Wallonie, Belgium + Brussels',
      color: 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20',
      features: ['Septante (70) instead of soixante-dix', 'Nonante (90) instead of quatre-vingt-dix', 'Different vocabulary: drache (heavy rain), à tantôt (see you later)'],
      examples: ['Il a septante ans.', 'Ça fait nonante euros.', 'Il drache dehors!'],
    },
    {
      name: 'Français suisse',
      region: 'Switzerland (Romandie)',
      color: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20',
      features: ['Septante (70), huitante (80), nonante (90)', 'Different meal times: déjeuner = lunch, souper = dinner (vs dîner in France)', 'Slower, more precise articulation'],
      examples: ['Huitante personnes sont venues.', 'On se retrouve pour le souper?'],
    },
    {
      name: 'Français africain',
      region: 'West & Central Africa, Indian Ocean',
      color: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20',
      features: ['Fastest-growing variety (population growth in Africa)', 'Rich local vocabulary, loan words from African languages', 'Often preserves distinctions lost in European French'],
      examples: ['Un Sénégalais peut dire "waw" pour oui.', 'Ivoirien: "djan" = copain/ami'],
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="card-fr-dialects">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-500/10 to-green-500/10">
        <p className="text-sm font-semibold text-center">Les Variétés du Français — French Around the World</p>
        <p className="text-xs text-muted-foreground text-center">One language, many voices — all are valid French</p>
      </div>
      <div className="divide-y">
        {zones.map(({ name, region, color, features, examples }) => (
          <div key={name} className="px-4 py-3">
            <div className={`inline-block text-[10px] font-semibold border px-2 py-0.5 rounded mb-1.5 ${color}`}>{name}</div>
            <p className="text-[10px] text-muted-foreground mb-1.5">{region}</p>
            <ul className="space-y-0.5 text-xs mb-1.5">
              {features.map(f => <li key={f} className="flex gap-1.5"><span className="text-indigo-500 shrink-0">•</span><span>{f}</span></li>)}
            </ul>
            {examples.length > 0 && (
              <p className="text-[10px] italic text-muted-foreground">{examples.join(' · ')}</p>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">All varieties are equally valid. When you meet a Francophone, their regional French is their cultural identity — never correct it unless asked.</p>
      </div>
    </div>
  );
}

// ─── LA BISE ETIQUETTE ────────────────────────────────────────────────────────

export function LaBiseEtiquetteCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="card-fr-la-bise">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-pink-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">La Bise — The French Cheek-Kiss Greeting</p>
        <p className="text-xs text-muted-foreground text-center">An iconic French social ritual — warmth, familiarity, and regional variation</p>
      </div>

      <div className="px-4 py-3 border-b">
        <p className="text-xs font-semibold mb-2">How many kisses? It depends on where you are:</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { region: 'Paris / Île-de-France', count: '2 kisses', note: 'Standard national default' },
            { region: 'Provence (Marseille, Nice)', count: '3 kisses', note: 'Right cheek first is typical' },
            { region: 'Nord & Pas-de-Calais', count: '4 kisses', note: 'One of the highest counts in France' },
            { region: 'Bretagne', count: '2–3 kisses', note: 'Varies by community' },
            { region: 'Québec (Canada)', count: '1–2 kisses', note: 'Less formal, right cheek first' },
            { region: 'Belgique, Suisse', count: '1–3 kisses', note: 'Varies by country and relationship' },
          ].map(({ region, count, note }) => (
            <div key={region} className="bg-muted/30 rounded p-2">
              <p className="font-semibold text-foreground">{region}</p>
              <p className="font-bold text-pink-600 dark:text-pink-400">{count}</p>
              <p className="text-muted-foreground text-[10px]">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="divide-y text-xs">
        {[
          {
            label: 'When is la bise done?',
            text: 'Between women, between a woman and a man (who are friends), and in some circles between men. In formal or professional settings, a handshake is standard.'
          },
          {
            label: 'Which cheek first?',
            text: 'There\'s no universal rule — just lean and let it happen. If you both go the same way, laugh it off. It happens to everyone, including the French.'
          },
          {
            label: 'Is it actually a kiss?',
            text: 'Not really — it\'s more of a cheek-to-cheek touch while making a kissing sound in the air. Lips rarely touch the cheek.'
          },
          {
            label: 'Post-COVID etiquette',
            text: 'La bise declined significantly during and after COVID-19. Many people now offer an alternative: a wave, a fist bump, or simply "on ne fait pas la bise aujourd\'hui." Always follow the other person\'s lead.'
          },
        ].map(({ label, text }) => (
          <div key={label} className="px-4 py-2.5">
            <p className="font-semibold text-pink-700 dark:text-pink-300 mb-0.5">{label}</p>
            <p className="text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">When in doubt: wait and see what the French person does first. Mirroring is always the safest approach. You can also ask Daniela about any greeting situation you encounter!</p>
      </div>
    </div>
  );
}

// ─── FRENCH CURRENCY ─────────────────────────────────────────────────────────

export function FrenchCurrencyCard() {
  const currencies: {
    name: string;
    code: string;
    symbol: string;
    used_in: string;
    notes: string;
    color: string;
  }[] = [
    {
      name: 'Euro',
      code: 'EUR',
      symbol: '€',
      used_in: 'France, Belgique, Luxembourg, Monaco, Mayotte, Réunion, Guadeloupe, Martinique, Saint-Martin, Saint-Pierre-et-Miquelon',
      notes: 'France was a founding eurozone member (2002). Pre-euro: Franc français (FF).',
      color: 'text-blue-700 dark:text-blue-300',
    },
    {
      name: 'Dollar canadien',
      code: 'CAD',
      symbol: '$',
      used_in: 'Canada (Québec, Nouveau-Brunswick, Ontario français)',
      notes: 'Québec uses dollars and cents. Canadians also say "piastre" informally for dollar.',
      color: 'text-red-700 dark:text-red-300',
    },
    {
      name: 'Franc suisse',
      code: 'CHF',
      symbol: 'Fr.',
      used_in: 'Suisse (Romandie)',
      notes: 'Not the euro — Switzerland is not EU. Very stable currency. 1 CHF ≈ 1.10 EUR.',
      color: 'text-rose-700 dark:text-rose-300',
    },
    {
      name: 'Franc CFA (UEMOA)',
      code: 'XOF',
      symbol: 'CFA',
      used_in: 'Sénégal, Côte d\'Ivoire, Mali, Burkina Faso, Niger, Togo, Bénin, Guinée-Bissau',
      notes: 'West African CFA franc — pegged to the Euro. Managed by Banque Centrale des États de l\'Afrique de l\'Ouest.',
      color: 'text-green-700 dark:text-green-300',
    },
    {
      name: 'Franc CFA (CEMAC)',
      code: 'XAF',
      symbol: 'FCFA',
      used_in: 'Cameroun, Gabon, Congo, RCA, Guinée équatoriale, Tchad',
      notes: 'Central African CFA franc — also pegged to Euro. Different from West African XOF.',
      color: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      name: 'Gourde haïtienne',
      code: 'HTG',
      symbol: 'G',
      used_in: 'Haïti',
      notes: 'USD also widely used in Haiti. French and Haitian Creole are both official languages.',
      color: 'text-amber-700 dark:text-amber-300',
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="card-fr-currency">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-yellow-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Les Monnaies de la Francophonie — Currencies</p>
        <p className="text-xs text-muted-foreground text-center">French is spoken with 6+ different currencies around the world</p>
      </div>
      <div className="divide-y">
        {currencies.map(({ name, code, symbol, used_in, notes, color }) => (
          <div key={code} className="px-4 py-3">
            <div className="flex items-baseline gap-3 mb-1">
              <span className={`text-xl font-bold ${color}`}>{symbol}</span>
              <span className="font-semibold text-foreground">{name}</span>
              <span className="text-xs text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded">{code}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-0.5"><span className="font-medium text-foreground">Utilisé en: </span>{used_in}</p>
            <p className="text-[10px] text-muted-foreground italic">{notes}</p>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">Useful phrases: <span className="font-medium text-foreground">Ça coûte combien?</span> (How much does it cost?) · <span className="font-medium text-foreground">Vous acceptez les cartes?</span> (Do you accept cards?)</p>
      </div>
    </div>
  );
}

// ─── GESTURE AWARENESS (FRENCH) ───────────────────────────────────────────────

export function FrGestureAwarenessCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="card-fr-gesture-awareness">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Les Gestes Français — Body Language Awareness</p>
        <p className="text-xs text-muted-foreground text-center">A cultural awareness guide — not a how-to. Always observe context.</p>
      </div>

      {/* Frame: cultural awareness */}
      <div className="px-4 py-3 border-b bg-amber-50/50 dark:bg-amber-950/10">
        <p className="text-xs text-muted-foreground">
          The French use gestures as a natural extension of speech. You don't need to imitate them — just recognising what they mean helps you understand conversations more fully. French gestures are generally expressive, nuanced, and tied closely to specific meanings.
        </p>
      </div>

      {/* Recognition-only gestures */}
      <div className="divide-y text-xs">
        {[
          {
            name: 'La barbe (the beard)',
            meaning: 'Boring / what a drag',
            description: 'Stroking an imaginary beard with the back of the fingers up the chin. Equivalent of "this is so tedious."',
          },
          {
            name: 'Mon œil (my eye)',
            meaning: 'I don\'t believe you / yeah right',
            description: 'Pulling the lower eyelid down with one finger. A discreet expression of skepticism.',
          },
          {
            name: 'Le bof (shrug)',
            meaning: 'Indifference / "meh"',
            description: 'A relaxed shrug with pouted lips and raised eyebrows. The quintessential French expression of mild indifference. Often accompanied by "bof" or "c\'est pas terrible."',
          },
          {
            name: 'Le truc parfait',
            meaning: 'That\'s perfect / excellent',
            description: 'Fingers gathered and kissed then released in a chef\'s kiss. Expresses that something is delicious or beautifully done.',
          },
          {
            name: 'Ça ne me dit rien',
            meaning: 'I\'m not interested / doesn\'t appeal to me',
            description: 'Tilting the head sideways with a slight frown, sometimes with a slow hand wave.',
          },
        ].map(({ name, meaning, description }) => (
          <div key={name} className="px-4 py-2.5">
            <div className="flex gap-2 items-baseline mb-0.5">
              <span className="font-semibold text-amber-700 dark:text-amber-300">{name}</span>
              <span className="text-muted-foreground text-[10px]">— {meaning}</span>
            </div>
            <p className="text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>

      {/* Regional variation warning */}
      <div className="px-4 py-2.5 border-t bg-amber-50/50 dark:bg-amber-950/10">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-amber-700 dark:text-amber-300">Regional variation:</span> Gestures mean different things in different parts of the Francophone world. A gesture common in France may be unfamiliar in Québec or have a different meaning in West Africa. When in doubt, ask Daniela or a local speaker.
        </p>
      </div>
    </div>
  );
}
