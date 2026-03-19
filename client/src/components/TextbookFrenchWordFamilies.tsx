/**
 * TextbookFrenchWordFamilies.tsx
 * Section 6 — French word family reference cards.
 * Mirrors TextbookWordFamilies.tsx for Spanish.
 *
 * 10 verb families:
 *  parler, aimer, voir, faire, dire, aller, venir, prendre, savoir, croire
 */

interface WordEntry {
  word: string;
  pos: string;
  meaning: string;
  example?: string;
}

interface WordFamilyData {
  root: string;
  rootMeaning: string;
  latin?: string;
  color: string;
  headerColor: string;
  members: WordEntry[];
}

function WordFamilyCard({ data }: { data: WordFamilyData }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid={`word-family-fr-${data.root}`}>
      <div className={`px-4 py-3 border-b bg-gradient-to-r ${data.headerColor} to-transparent`}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`font-bold text-base ${data.color}`}>{data.root}</span>
          <span className="text-sm text-muted-foreground">— {data.rootMeaning}</span>
          {data.latin && (
            <span className="text-[10px] text-muted-foreground/70 italic ml-auto">Latin: {data.latin}</span>
          )}
        </div>
      </div>
      <div className="divide-y">
        {data.members.map(({ word, pos, meaning, example }) => (
          <div key={word} className="px-4 py-2 flex gap-3 text-xs">
            <div className="w-36 shrink-0">
              <span className={`font-bold ${data.color}`}>{word}</span>
              <span className="text-[10px] text-muted-foreground ml-1.5 border border-muted-foreground/30 px-1 py-0.5 rounded">{pos}</span>
            </div>
            <div className="flex-1">
              <span className="text-foreground">{meaning}</span>
              {example && <p className="text-muted-foreground italic text-[10px] mt-0.5">{example}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PARLER (to speak) ────────────────────────────────────────────────────────

const PARLER_FAMILY: WordFamilyData = {
  root: 'parler',
  rootMeaning: 'to speak',
  latin: 'parabolare (to tell parables)',
  color: 'text-blue-700 dark:text-blue-300',
  headerColor: 'from-blue-500/10',
  members: [
    { word: 'parler', pos: 'v.', meaning: 'to speak, to talk', example: 'Je parle français.' },
    { word: 'la parole', pos: 'n.f.', meaning: 'word, speech (the act of speaking)', example: 'Prendre la parole — to take the floor (begin speaking).' },
    { word: 'le parleur', pos: 'n.m.', meaning: 'talker, speaker (person who talks a lot)' },
    { word: 'parlant(e)', pos: 'adj.', meaning: 'speaking, eloquent; lifelike (portrait)', example: 'Un portrait parlant — a lifelike portrait.' },
    { word: 'le parlement', pos: 'n.m.', meaning: 'parliament (originally: "a speaking place")' },
    { word: 'le parlementaire', pos: 'n.m.', meaning: 'member of parliament; parliamentary (adj.)' },
    { word: 'le parloir', pos: 'n.m.', meaning: 'visiting room (in a prison or convent)' },
    { word: 'le pourparler', pos: 'n.m.', meaning: 'talks, negotiations (les pourparlers = peace talks)', example: 'Des pourparlers de paix.' },
  ],
};

export function FrParlerFamilyCard() { return <WordFamilyCard data={PARLER_FAMILY} />; }

// ─── AIMER (to like/love) ─────────────────────────────────────────────────────

const AIMER_FAMILY: WordFamilyData = {
  root: 'aimer',
  rootMeaning: 'to love, to like',
  latin: 'amare (to love)',
  color: 'text-rose-700 dark:text-rose-300',
  headerColor: 'from-rose-500/10',
  members: [
    { word: 'aimer', pos: 'v.', meaning: 'to love, to like', example: 'J\'aime la musique. / Je t\'aime.' },
    { word: "l'amour", pos: 'n.m.', meaning: 'love (romantic, deep affection)', example: 'Tomber amoureux — to fall in love.' },
    { word: "l'amant / l'amante", pos: 'n.', meaning: 'lover (romantic partner, often illicit)' },
    { word: 'amoureux/euse', pos: 'adj.', meaning: 'in love, loving', example: 'Je suis amoureux d\'elle.' },
    { word: 'aimable', pos: 'adj.', meaning: 'kind, likeable, pleasant', example: 'C\'est très aimable de votre part.' },
    { word: 'bien-aimé(e)', pos: 'adj./n.', meaning: 'beloved (poetic/formal)', example: 'Mon bien-aimé.' },
    { word: "l'amabilité", pos: 'n.f.', meaning: 'kindness, amiability' },
    { word: "l'ami / l'amie", pos: 'n.', meaning: 'friend (from same Latin root via different path)', example: 'Mon meilleur ami.' },
  ],
};

export function FrAimerFamilyCard() { return <WordFamilyCard data={AIMER_FAMILY} />; }

// ─── VOIR (to see) ────────────────────────────────────────────────────────────

const VOIR_FAMILY: WordFamilyData = {
  root: 'voir',
  rootMeaning: 'to see',
  latin: 'videre (to see)',
  color: 'text-violet-700 dark:text-violet-300',
  headerColor: 'from-violet-500/10',
  members: [
    { word: 'voir', pos: 'v.', meaning: 'to see', example: 'Je vois la tour Eiffel.' },
    { word: 'la vue', pos: 'n.f.', meaning: 'sight, view, vision', example: 'Une belle vue sur la mer.' },
    { word: 'visible', pos: 'adj.', meaning: 'visible, able to be seen' },
    { word: 'visuel/le', pos: 'adj.', meaning: 'visual', example: 'Un effet visuel impressionnant.' },
    { word: 'la vision', pos: 'n.f.', meaning: 'vision (sight or a visionary idea)' },
    { word: 'prévoir', pos: 'v.', meaning: 'to foresee, to plan ahead', example: 'J\'ai prévu du mauvais temps.' },
    { word: 'revoir', pos: 'v.', meaning: 'to see again', example: 'Au revoir — goodbye (until we see each other again).' },
    { word: 'entrevoir', pos: 'v.', meaning: 'to catch a glimpse of' },
    { word: 'surveiller', pos: 'v.', meaning: 'to watch over, to monitor', example: 'Surveiller les enfants.' },
    { word: "l'évidence", pos: 'n.f.', meaning: 'evidence, obvious fact (from same Latin root)', example: "C'est une évidence." },
  ],
};

export function FrVoirFamilyCard() { return <WordFamilyCard data={VOIR_FAMILY} />; }

// ─── FAIRE (to do/make) ───────────────────────────────────────────────────────

const FAIRE_FAMILY: WordFamilyData = {
  root: 'faire',
  rootMeaning: 'to do, to make',
  latin: 'facere (to do, to make)',
  color: 'text-amber-700 dark:text-amber-300',
  headerColor: 'from-amber-500/10',
  members: [
    { word: 'faire', pos: 'v.', meaning: 'to do, to make', example: 'Qu\'est-ce que tu fais?' },
    { word: 'le fait', pos: 'n.m.', meaning: 'fact, deed, act', example: 'En fait — in fact.' },
    { word: 'faisable', pos: 'adj.', meaning: 'feasible, doable' },
    { word: 'défaire', pos: 'v.', meaning: 'to undo, to untie', example: 'Défaire ses bagages — to unpack.' },
    { word: 'satisfaire', pos: 'v.', meaning: 'to satisfy', example: 'Satisfaire les besoins de quelqu\'un.' },
    { word: 'parfaire', pos: 'v.', meaning: 'to perfect, to put the finishing touches on' },
    { word: 'refaire', pos: 'v.', meaning: 'to redo, to do again', example: 'Refaire sa vie — to start a new life.' },
    { word: 'la façon', pos: 'n.f.', meaning: 'way, manner (from same root)', example: 'De toute façon — anyway.' },
    { word: 'la facture', pos: 'n.f.', meaning: 'invoice, bill; workmanship', example: 'Payer la facture.' },
    { word: 'la fabrication', pos: 'n.f.', meaning: 'manufacturing, production (same Latin root)', example: 'Fabriqué en France.' },
  ],
};

export function FrFaireFamilyCard() { return <WordFamilyCard data={FAIRE_FAMILY} />; }

// ─── DIRE (to say/tell) ───────────────────────────────────────────────────────

const DIRE_FAMILY: WordFamilyData = {
  root: 'dire',
  rootMeaning: 'to say, to tell',
  latin: 'dicere (to say)',
  color: 'text-emerald-700 dark:text-emerald-300',
  headerColor: 'from-emerald-500/10',
  members: [
    { word: 'dire', pos: 'v.', meaning: 'to say, to tell', example: 'Qu\'est-ce qu\'il a dit?' },
    { word: 'le dit', pos: 'n.m.', meaning: 'what is said; the saying (also: ledit = the said/aforementioned)' },
    { word: 'la diction', pos: 'n.f.', meaning: 'diction, way of speaking' },
    { word: 'la dictée', pos: 'n.f.', meaning: 'dictation (school exercise — teacher reads, students write)' },
    { word: 'interdire', pos: 'v.', meaning: 'to forbid, to ban', example: 'Il est interdit de fumer ici.' },
    { word: 'maudire', pos: 'v.', meaning: 'to curse, to damn' },
    { word: 'contredire', pos: 'v.', meaning: 'to contradict', example: 'Ne me contredis pas!' },
    { word: 'prédire', pos: 'v.', meaning: 'to predict, to foretell' },
    { word: 'le dicton', pos: 'n.m.', meaning: 'saying, proverb', example: '"Après la pluie, le beau temps" — French proverb.' },
    { word: 'soi-disant', pos: 'adj./adv.', meaning: 'so-called, self-proclaimed', example: 'Un soi-disant expert.' },
  ],
};

export function FrDireFamilyCard() { return <WordFamilyCard data={DIRE_FAMILY} />; }

// ─── ALLER (to go) ────────────────────────────────────────────────────────────

const ALLER_FAMILY: WordFamilyData = {
  root: 'aller',
  rootMeaning: 'to go',
  latin: 'ambulare / ire / vadere (three Latin sources merged!)',
  color: 'text-green-700 dark:text-green-300',
  headerColor: 'from-green-500/10',
  members: [
    { word: 'aller', pos: 'v.', meaning: 'to go', example: 'Où vas-tu?' },
    { word: "l'aller", pos: 'n.m.', meaning: 'outward journey, one-way trip', example: 'Un aller simple — one-way ticket.' },
    { word: "l'allée", pos: 'n.f.', meaning: 'alley, driveway, path (lined with trees)', example: 'Une allée de platanes.' },
    { word: "s'en aller", pos: 'v.pron.', meaning: 'to go away, to leave', example: 'Je m\'en vais. — I\'m leaving.' },
    { word: 'la randonnée', pos: 'n.f.', meaning: 'hike, trek (related sense: going on foot)', example: 'Faire une randonnée en montagne.' },
    { word: 'le va-et-vient', pos: 'n.m.', meaning: 'coming and going, back and forth', example: 'Le va-et-vient des voitures.' },
    { word: 'le vélo / le voyage', pos: 'n.m.', meaning: 'Note: voyage comes from via (road), not aller' },
    { word: 'au revoir', pos: 'expr.', meaning: 'goodbye (au = to the, revoir = seeing again)', example: 'Au revoir! À bientôt!' },
  ],
};

export function FrAllerFamilyCard() { return <WordFamilyCard data={ALLER_FAMILY} />; }

// ─── VENIR (to come) ─────────────────────────────────────────────────────────

const VENIR_FAMILY: WordFamilyData = {
  root: 'venir',
  rootMeaning: 'to come',
  latin: 'venire (to come)',
  color: 'text-cyan-700 dark:text-cyan-300',
  headerColor: 'from-cyan-500/10',
  members: [
    { word: 'venir', pos: 'v.', meaning: 'to come', example: 'Elle vient de Paris.' },
    { word: 'revenir', pos: 'v.', meaning: 'to come back', example: 'Je reviens dans une heure.' },
    { word: 'devenir', pos: 'v.', meaning: 'to become', example: 'Il veut devenir médecin.' },
    { word: 'parvenir', pos: 'v.', meaning: 'to manage to, to reach', example: 'Elle est parvenue à le convaincre.' },
    { word: 'prévenir', pos: 'v.', meaning: 'to warn, to notify', example: 'Prévenir quelqu\'un d\'un danger.' },
    { word: 'convenir', pos: 'v.', meaning: 'to suit, to agree', example: 'Ça me convient. — That suits me.' },
    { word: 'la venue', pos: 'n.f.', meaning: 'arrival, coming', example: 'La venue du printemps.' },
    { word: "l'avenir", pos: 'n.m.', meaning: 'future (à + venir = what is coming)', example: "L'avenir appartient à ceux qui se lèvent tôt." },
    { word: 'venir de + inf.', pos: 'expr.', meaning: 'to have just done something', example: 'Je viens de manger. — I just ate.' },
  ],
};

export function FrVenirFamilyCard() { return <WordFamilyCard data={VENIR_FAMILY} />; }

// ─── PRENDRE (to take) ────────────────────────────────────────────────────────

const PRENDRE_FAMILY: WordFamilyData = {
  root: 'prendre',
  rootMeaning: 'to take',
  latin: 'prehendere (to seize, to grasp)',
  color: 'text-orange-700 dark:text-orange-300',
  headerColor: 'from-orange-500/10',
  members: [
    { word: 'prendre', pos: 'v.', meaning: 'to take', example: 'Prends le bus! — Take the bus!' },
    { word: 'la prise', pos: 'n.f.', meaning: 'grip, seizure, catch; electrical outlet', example: 'Une prise de courant.' },
    { word: 'apprendre', pos: 'v.', meaning: 'to learn (also: to teach)', example: 'J\'apprends le français.' },
    { word: 'comprendre', pos: 'v.', meaning: 'to understand', example: 'Je ne comprends pas.' },
    { word: 'entreprendre', pos: 'v.', meaning: 'to undertake, to embark on' },
    { word: "l'entreprise", pos: 'n.f.', meaning: 'company, business; undertaking', example: "Une grande entreprise." },
    { word: "l'entrepreneur", pos: 'n.m.', meaning: 'entrepreneur, contractor' },
    { word: 'reprendre', pos: 'v.', meaning: 'to take back, to resume', example: 'On reprend le travail demain.' },
    { word: 'surprendre', pos: 'v.', meaning: 'to surprise, to catch in the act', example: 'Ça m\'a surpris.' },
    { word: 'le prénom', pos: 'n.m.', meaning: 'first name (pré + nom = taken before the surname)', example: 'Mon prénom est Marie.' },
  ],
};

export function FrPrendreFamilyCard() { return <WordFamilyCard data={PRENDRE_FAMILY} />; }

// ─── SAVOIR (to know) ─────────────────────────────────────────────────────────

const SAVOIR_FAMILY: WordFamilyData = {
  root: 'savoir',
  rootMeaning: 'to know (facts/how to do)',
  latin: 'sapere (to taste, to know)',
  color: 'text-indigo-700 dark:text-indigo-300',
  headerColor: 'from-indigo-500/10',
  members: [
    { word: 'savoir', pos: 'v.', meaning: 'to know (a fact); to know how to', example: 'Je sais nager. — I know how to swim.' },
    { word: 'le savoir', pos: 'n.m.', meaning: 'knowledge, learning (the sum of what one knows)' },
    { word: 'le savoir-faire', pos: 'n.m.', meaning: 'know-how, skill, expertise', example: 'Le savoir-faire français.' },
    { word: 'le savoir-vivre', pos: 'n.m.', meaning: 'good manners, social etiquette' },
    { word: 'savant(e)', pos: 'adj./n.', meaning: 'learned, scholarly; scientist', example: 'Un savant fou — a mad scientist.' },
    { word: 'la sagesse', pos: 'n.f.', meaning: 'wisdom (from same Latin root)', example: 'La sagesse des anciens.' },
    { word: 'sage', pos: 'adj.', meaning: 'wise; well-behaved (of children)', example: 'Sois sage! — Be good!' },
    { word: 'à savoir', pos: 'expr.', meaning: 'namely, that is to say', example: 'Deux langues, à savoir le français et l\'anglais.' },
  ],
};

export function FrSavoirFamilyCard() { return <WordFamilyCard data={SAVOIR_FAMILY} />; }

// ─── CROIRE (to believe) ─────────────────────────────────────────────────────

const CROIRE_FAMILY: WordFamilyData = {
  root: 'croire',
  rootMeaning: 'to believe, to think',
  latin: 'credere (to believe)',
  color: 'text-fuchsia-700 dark:text-fuchsia-300',
  headerColor: 'from-fuchsia-500/10',
  members: [
    { word: 'croire', pos: 'v.', meaning: 'to believe, to think', example: 'Je crois que oui. — I think so.' },
    { word: 'la croyance', pos: 'n.f.', meaning: 'belief, conviction', example: 'Les croyances religieuses.' },
    { word: 'croyable', pos: 'adj.', meaning: 'believable', example: 'C\'est à peine croyable! — Hardly believable!' },
    { word: 'incroyable', pos: 'adj.', meaning: 'incredible, unbelievable', example: 'C\'est incroyable!' },
    { word: 'le croyant', pos: 'n.m.', meaning: 'believer (religious)', example: 'Les croyants et les non-croyants.' },
    { word: 'la crédulité', pos: 'n.f.', meaning: 'credulity, gullibility (from same Latin root)' },
    { word: 'le crédit', pos: 'n.m.', meaning: 'credit, credibility (from credere)', example: 'Donner crédit à quelqu\'un.' },
    { word: 'accréditer', pos: 'v.', meaning: 'to accredit, to give credibility to' },
    { word: 'incrédule', pos: 'adj.', meaning: 'incredulous, skeptical', example: 'Il m\'a regardé d\'un air incrédule.' },
  ],
};

export function FrCroireFamilyCard() { return <WordFamilyCard data={CROIRE_FAMILY} />; }
