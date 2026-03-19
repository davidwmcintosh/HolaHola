/**
 * TextbookFrenchGrammarCards.tsx
 * Section 3 & 4 — French grammar reference cards.
 * Mirrors the structure of TextbookGrammarDiagrams.tsx for Spanish.
 * Auto-triggered via classifyFrenchGrammarType() in ChapterIntroduction.tsx.
 *
 * Cards (24 total):
 *  Section 3 — Verbs & Grammar
 *    ÊtreCard, AvoirCard, AllerCard, FaireCard
 *    FrErVerbsCard, FrIrVerbsCard, FrReVerbsCard
 *    FrModalsCard, FrReflexiveCard
 *    FrPasseComposeAvoirCard, FrPasseComposeEtreCard
 *    FrImparfaitCard, FrPcVsImpCard
 *    FrFutureCard, FrConditionalCard, FrSubjunctiveCard
 *    FrNegationCard, FrArticlesGenderCard, FrAdjAgreeCard
 *    FrObjectPronounsCard, FrTuVousCard, FrQuestionsCard
 *  Section 4 — Prepositions
 *    FrSpatialPrepCard, FrTemporalPrepCard
 */

// ─── SHARED VERB TABLE ───────────────────────────────────────────────────────

interface ConjRow { pronoun: string; form: string; stemEnd?: number; }
interface VerbTableData {
  verb: string; tense: string; englishTense: string;
  rows: ConjRow[]; note?: string; accentColor?: string;
}

function splitForm(form: string, stemEnd?: number): [string, string] {
  if (stemEnd === undefined) return ['', form];
  return [form.slice(0, stemEnd), form.slice(stemEnd)];
}

function VerbConjugationTable({ data }: { data: VerbTableData }) {
  const accent = data.accentColor ?? 'text-indigo-600 dark:text-indigo-400';
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b bg-gradient-to-r from-indigo-500/10 to-transparent flex items-baseline justify-between gap-2 flex-wrap">
        <span className={`font-bold text-sm ${accent}`}>{data.verb.toUpperCase()}</span>
        <span className="text-xs text-muted-foreground">{data.tense} — {data.englishTense}</span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {data.rows.map(({ pronoun, form, stemEnd }, i) => {
            const [stem, ending] = splitForm(form, stemEnd);
            return (
              <tr key={i} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                <td className="px-3 py-1.5 font-medium text-muted-foreground w-28">{pronoun}</td>
                <td className="px-3 py-1.5 font-semibold">
                  {stem && <span>{stem}</span>}
                  {ending && <span className="text-blue-600 dark:text-blue-400">{ending}</span>}
                  {!stem && !ending && <span>{form}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.note && (
        <div className="px-3 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">{data.note}</p>
        </div>
      )}
    </div>
  );
}

function TwoTableCard({ left, right, title, subtitle, headerColor = 'from-indigo-500/10' }: {
  left: VerbTableData; right: VerbTableData; title: string; subtitle?: string; headerColor?: string;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={`px-4 py-2.5 border-b bg-gradient-to-r ${headerColor} to-transparent`}>
        <p className="text-sm font-semibold text-center">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground text-center">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 divide-x">
        <VerbConjugationTable data={left} />
        <VerbConjugationTable data={right} />
      </div>
    </div>
  );
}

function RuleCard({ title, subtitle, color = 'from-indigo-500/10', children }: {
  title: string; subtitle?: string; color?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={`px-4 py-2.5 border-b bg-gradient-to-r ${color} to-transparent`}>
        <p className="text-sm font-semibold text-center">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground text-center">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── ÊTRE ────────────────────────────────────────────────────────────────────

const ETRE: VerbTableData = {
  verb: 'être', tense: 'Présent', englishTense: 'present — to be',
  accentColor: 'text-violet-600 dark:text-violet-400',
  note: 'Être is fully irregular — memorise all six forms. Also used as auxiliary for passé composé.',
  rows: [
    { pronoun: 'je', form: 'suis' },
    { pronoun: 'tu', form: 'es' },
    { pronoun: 'il / elle / on', form: 'est' },
    { pronoun: 'nous', form: 'sommes' },
    { pronoun: 'vous', form: 'êtes' },
    { pronoun: 'ils / elles', form: 'sont' },
  ],
};

export function ÊtreCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={ETRE} />
      <RuleCard title="Uses of être" color="from-violet-500/10">
        <div className="divide-y text-xs">
          {[
            { label: 'Identity / description', ex: 'Je suis étudiant. — I am a student.' },
            { label: 'Nationality / origin', ex: 'Elle est française. — She is French.' },
            { label: 'Time / date', ex: 'Il est trois heures. — It is three o\'clock.' },
            { label: 'Location (with adjectives)', ex: 'Le café est fermé. — The café is closed.' },
            { label: 'Auxiliary for PC (motion/state verbs)', ex: 'Elle est allée. — She went.' },
          ].map(({ label, ex }) => (
            <div key={label} className="px-4 py-2 flex gap-3">
              <span className="font-medium text-violet-700 dark:text-violet-300 w-44 flex-shrink-0">{label}</span>
              <span className="text-muted-foreground italic">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── AVOIR ───────────────────────────────────────────────────────────────────

const AVOIR: VerbTableData = {
  verb: 'avoir', tense: 'Présent', englishTense: 'present — to have',
  accentColor: 'text-amber-600 dark:text-amber-400',
  note: 'Avoir is the primary auxiliary for passé composé and is used in many fixed expressions.',
  rows: [
    { pronoun: "j'", form: 'ai' },
    { pronoun: 'tu', form: 'as' },
    { pronoun: 'il / elle / on', form: 'a' },
    { pronoun: 'nous', form: 'avons' },
    { pronoun: 'vous', form: 'avez' },
    { pronoun: 'ils / elles', form: 'ont' },
  ],
};

export function AvoirCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={AVOIR} />
      <RuleCard title="Expressions avec avoir" subtitle="avoir + noun (not être + adjective as in English)" color="from-amber-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            { fr: 'avoir faim', en: 'to be hungry' },
            { fr: 'avoir soif', en: 'to be thirsty' },
            { fr: 'avoir chaud', en: 'to be hot' },
            { fr: 'avoir froid', en: 'to be cold' },
            { fr: 'avoir peur', en: 'to be afraid' },
            { fr: 'avoir raison', en: 'to be right' },
            { fr: 'avoir tort', en: 'to be wrong' },
            { fr: 'avoir ...ans', en: 'to be ...years old' },
            { fr: "avoir l'air", en: 'to look / seem' },
            { fr: 'avoir besoin de', en: 'to need' },
          ].map(({ fr, en }) => (
            <div key={fr} className="px-3 py-1.5 flex gap-2">
              <span className="font-semibold text-amber-700 dark:text-amber-300 w-32">{fr}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── ALLER ───────────────────────────────────────────────────────────────────

const ALLER: VerbTableData = {
  verb: 'aller', tense: 'Présent', englishTense: 'present — to go',
  accentColor: 'text-green-600 dark:text-green-400',
  note: 'Fully irregular. Also used for futur proche: aller + infinitif.',
  rows: [
    { pronoun: 'je', form: 'vais' },
    { pronoun: 'tu', form: 'vas' },
    { pronoun: 'il / elle / on', form: 'va' },
    { pronoun: 'nous', form: 'allons' },
    { pronoun: 'vous', form: 'allez' },
    { pronoun: 'ils / elles', form: 'vont' },
  ],
};

export function AllerCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={ALLER} />
      <RuleCard title="Le futur proche — Near Future" subtitle="aller + infinitif = going to do something" color="from-green-500/10">
        <div className="divide-y text-xs">
          {[
            { fr: 'Je vais manger.', en: 'I am going to eat.' },
            { fr: 'Tu vas partir?', en: 'Are you going to leave?' },
            { fr: 'Elle va étudier.', en: 'She is going to study.' },
            { fr: 'Nous allons voyager.', en: 'We are going to travel.' },
            { fr: 'Ils vont arriver demain.', en: 'They are going to arrive tomorrow.' },
          ].map(({ fr, en }) => (
            <div key={fr} className="px-4 py-2 flex gap-4">
              <span className="font-semibold text-green-700 dark:text-green-300 w-40">{fr}</span>
              <span className="text-muted-foreground italic">{en}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Compare: Je mange maintenant (I eat now) vs Je vais manger (I'm going to eat)</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── FAIRE ───────────────────────────────────────────────────────────────────

const FAIRE: VerbTableData = {
  verb: 'faire', tense: 'Présent', englishTense: 'present — to do / to make',
  accentColor: 'text-orange-600 dark:text-orange-400',
  note: 'Irregular in the vous form (faites). Very common — used in weather and many expressions.',
  rows: [
    { pronoun: 'je', form: 'fais' },
    { pronoun: 'tu', form: 'fais' },
    { pronoun: 'il / elle / on', form: 'fait' },
    { pronoun: 'nous', form: 'faisons' },
    { pronoun: 'vous', form: 'faites' },
    { pronoun: 'ils / elles', form: 'font' },
  ],
};

export function FaireCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={FAIRE} />
      <RuleCard title="Expressions avec faire" color="from-orange-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            { fr: 'faire la cuisine', en: 'to cook' },
            { fr: 'faire les courses', en: 'to go shopping' },
            { fr: 'faire une promenade', en: 'to take a walk' },
            { fr: 'faire du sport', en: 'to do sport' },
            { fr: 'faire la vaisselle', en: 'to wash the dishes' },
            { fr: 'faire attention', en: 'to pay attention' },
            { fr: 'il fait beau', en: "it's nice weather" },
            { fr: 'il fait chaud / froid', en: "it's hot / cold" },
            { fr: 'faire connaissance', en: 'to meet (get acquainted)' },
            { fr: 'faire partie de', en: 'to be part of' },
          ].map(({ fr, en }) => (
            <div key={fr} className="px-3 py-1.5 flex gap-2">
              <span className="font-semibold text-orange-700 dark:text-orange-300 w-36">{fr}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── REGULAR -ER VERBS ────────────────────────────────────────────────────────

const PARLER: VerbTableData = {
  verb: 'parler', tense: 'Présent', englishTense: 'present — to speak',
  note: 'Drop -er, add: -e, -es, -e, -ons, -ez, -ent. Over 90% of French verbs are -ER.',
  rows: [
    { pronoun: 'je', form: 'parle', stemEnd: 4 },
    { pronoun: 'tu', form: 'parles', stemEnd: 4 },
    { pronoun: 'il / elle / on', form: 'parle', stemEnd: 4 },
    { pronoun: 'nous', form: 'parlons', stemEnd: 4 },
    { pronoun: 'vous', form: 'parlez', stemEnd: 4 },
    { pronoun: 'ils / elles', form: 'parlent', stemEnd: 4 },
  ],
};

export function FrErVerbsCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={PARLER} />
      <RuleCard title="More -ER verb examples" color="from-blue-500/10">
        <div className="grid grid-cols-3 gap-0 text-xs divide-y">
          {[
            ['aimer', 'to like/love'], ['travailler', 'to work'], ['habiter', 'to live (reside)'],
            ['écouter', 'to listen'], ['regarder', 'to watch'], ['chercher', 'to look for'],
            ['manger', 'to eat*'], ['voyager', 'to travel*'], ['commencer', 'to start*'],
          ].map(([fr, en]) => (
            <div key={fr} className="px-3 py-1.5 flex gap-2">
              <span className="font-semibold text-blue-700 dark:text-blue-300 w-24">{fr}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">* manger/voyager: add -e before -ons (mangeons). commencer: add cédille before -ons (commençons). Spelling keeps pronunciation consistent.</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── REGULAR -IR VERBS (type 2: finir) ───────────────────────────────────────

const FINIR: VerbTableData = {
  verb: 'finir', tense: 'Présent', englishTense: 'present — to finish',
  note: 'Type-2 -IR verbs: add -iss- before plural endings. Pattern: -is, -is, -it, -issons, -issez, -issent.',
  rows: [
    { pronoun: 'je', form: 'finis', stemEnd: 3 },
    { pronoun: 'tu', form: 'finis', stemEnd: 3 },
    { pronoun: 'il / elle / on', form: 'finit', stemEnd: 3 },
    { pronoun: 'nous', form: 'finissons', stemEnd: 3 },
    { pronoun: 'vous', form: 'finissez', stemEnd: 3 },
    { pronoun: 'ils / elles', form: 'finissent', stemEnd: 3 },
  ],
};

export function FrIrVerbsCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={FINIR} />
      <RuleCard title="More -IR (type 2) examples" subtitle="Note: partir/sortir/dormir are -IR but type 1 — different pattern" color="from-emerald-500/10">
        <div className="grid grid-cols-3 gap-0 text-xs divide-y">
          {[
            ['choisir', 'to choose'], ['remplir', 'to fill'], ['réussir', 'to succeed'],
            ['grandir', 'to grow up'], ['obéir', 'to obey'], ['réfléchir', 'to think/reflect'],
            ['bâtir', 'to build'], ['nourrir', 'to feed'], ['ralentir', 'to slow down'],
          ].map(([fr, en]) => (
            <div key={fr} className="px-3 py-1.5 flex gap-2">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300 w-24">{fr}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── REGULAR -RE VERBS ────────────────────────────────────────────────────────

const VENDRE: VerbTableData = {
  verb: 'vendre', tense: 'Présent', englishTense: 'present — to sell',
  note: 'Drop -re, add: -s, -s, (nothing), -ons, -ez, -ent. The il/elle form has NO ending.',
  rows: [
    { pronoun: 'je', form: 'vends', stemEnd: 4 },
    { pronoun: 'tu', form: 'vends', stemEnd: 4 },
    { pronoun: 'il / elle / on', form: 'vend', stemEnd: 4 },
    { pronoun: 'nous', form: 'vendons', stemEnd: 4 },
    { pronoun: 'vous', form: 'vendez', stemEnd: 4 },
    { pronoun: 'ils / elles', form: 'vendent', stemEnd: 4 },
  ],
};

export function FrReVerbsCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={VENDRE} />
      <RuleCard title="-RE verbs — the third conjugation class" subtitle="Unique to French — no direct equivalent in Spanish or English" color="from-cyan-500/10">
        <div className="grid grid-cols-3 gap-0 text-xs divide-y">
          {[
            ['attendre', 'to wait (for)'], ['entendre', 'to hear'], ['répondre', 'to answer'],
            ['perdre', 'to lose'], ['rendre', 'to give back'], ['descendre', 'to go down'],
            ['confondre', 'to confuse'], ['fondre', 'to melt'], ['tordre', 'to twist'],
          ].map(([fr, en]) => (
            <div key={fr} className="px-3 py-1.5 flex gap-2">
              <span className="font-semibold text-cyan-700 dark:text-cyan-300 w-24">{fr}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Key tell: attendre means "to wait for" — no preposition needed: J'attends le bus. (I wait for the bus.)</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── MODAL-LIKE VERBS (pouvoir / vouloir / devoir) ────────────────────────────

const POUVOIR: VerbTableData = {
  verb: 'pouvoir', tense: 'Présent', englishTense: 'can / to be able to',
  rows: [
    { pronoun: 'je', form: 'peux' },
    { pronoun: 'tu', form: 'peux' },
    { pronoun: 'il / elle / on', form: 'peut' },
    { pronoun: 'nous', form: 'pouvons' },
    { pronoun: 'vous', form: 'pouvez' },
    { pronoun: 'ils / elles', form: 'peuvent' },
  ],
};

const VOULOIR: VerbTableData = {
  verb: 'vouloir', tense: 'Présent', englishTense: 'want / to want to',
  rows: [
    { pronoun: 'je', form: 'veux' },
    { pronoun: 'tu', form: 'veux' },
    { pronoun: 'il / elle / on', form: 'veut' },
    { pronoun: 'nous', form: 'voulons' },
    { pronoun: 'vous', form: 'voulez' },
    { pronoun: 'ils / elles', form: 'veulent' },
  ],
};

const DEVOIR: VerbTableData = {
  verb: 'devoir', tense: 'Présent', englishTense: 'must / to have to',
  rows: [
    { pronoun: 'je', form: 'dois' },
    { pronoun: 'tu', form: 'dois' },
    { pronoun: 'il / elle / on', form: 'doit' },
    { pronoun: 'nous', form: 'devons' },
    { pronoun: 'vous', form: 'devez' },
    { pronoun: 'ils / elles', form: 'doivent' },
  ],
};

export function FrModalsCard() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-gradient-to-r from-purple-500/10 to-transparent">
          <p className="text-sm font-semibold text-center">Verbes modaux — Modal-like Verbs</p>
          <p className="text-xs text-muted-foreground text-center">All followed by infinitive — pouvoir / vouloir / devoir</p>
        </div>
        <div className="grid grid-cols-3 divide-x">
          <VerbConjugationTable data={POUVOIR} />
          <VerbConjugationTable data={VOULOIR} />
          <VerbConjugationTable data={DEVOIR} />
        </div>
      </div>
      <RuleCard title="Usage patterns" color="from-purple-500/10">
        <div className="divide-y text-xs">
          {[
            { verb: 'pouvoir + inf.', ex: 'Je peux venir. — I can come.', note: 'ability or permission' },
            { verb: 'vouloir + inf.', ex: 'Tu veux manger? — Do you want to eat?', note: 'desire' },
            { verb: 'devoir + inf.', ex: 'Elle doit travailler. — She must work.', note: 'obligation' },
            { verb: 'devoir + noun', ex: 'Je dois de l\'argent. — I owe money.', note: 'to owe' },
            { verb: 'vouloir bien', ex: 'Je veux bien. — I would be glad to.', note: 'willingness' },
          ].map(({ verb, ex, note }) => (
            <div key={verb} className="px-4 py-2 flex gap-3 flex-wrap">
              <span className="font-semibold text-purple-700 dark:text-purple-300 w-32">{verb}</span>
              <span className="italic text-foreground flex-1">{ex}</span>
              <span className="text-muted-foreground">({note})</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── REFLEXIVE VERBS ─────────────────────────────────────────────────────────

const SE_LEVER: VerbTableData = {
  verb: 'se lever', tense: 'Présent', englishTense: 'present — to get up',
  note: 'Stem change: lève in singular and ils/elles (accent grave). Reflexive pronoun agrees with subject.',
  rows: [
    { pronoun: 'je me', form: 'lève', stemEnd: 3 },
    { pronoun: 'tu te', form: 'lèves', stemEnd: 3 },
    { pronoun: 'il / elle / on se', form: 'lève', stemEnd: 3 },
    { pronoun: 'nous nous', form: 'levons', stemEnd: 3 },
    { pronoun: 'vous vous', form: 'levez', stemEnd: 3 },
    { pronoun: 'ils / elles se', form: 'lèvent', stemEnd: 3 },
  ],
};

export function FrReflexiveCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={SE_LEVER} />
      <RuleCard title="Les verbes pronominaux — Reflexive Verbs" subtitle="Subject acts on itself — reflexive pronoun always present" color="from-rose-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            ['se lever', 'to get up'], ["s'appeler", 'to be called'],
            ['se coucher', 'to go to bed'], ['se laver', 'to wash oneself'],
            ['se réveiller', 'to wake up'], ['se dépêcher', 'to hurry'],
            ['se souvenir de', 'to remember'], ['se promener', 'to go for a walk'],
            ['se reposer', 'to rest'], ["s'amuser", 'to enjoy oneself'],
          ].map(([fr, en]) => (
            <div key={fr} className="px-3 py-1.5 flex gap-2">
              <span className="font-semibold text-rose-700 dark:text-rose-300 w-32">{fr}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Negation: Je ne me lève pas. &nbsp;·&nbsp; Infinitive: Nous allons nous lever tôt.</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── PASSÉ COMPOSÉ (AVOIR) ────────────────────────────────────────────────────

const PC_PARLER: VerbTableData = {
  verb: 'parler → parlé', tense: 'Passé composé', englishTense: 'past — to have spoken',
  accentColor: 'text-blue-600 dark:text-blue-400',
  note: 'avoir + past participle. Regular -ER past participle: drop -er, add -é.',
  rows: [
    { pronoun: "j'ai", form: 'parlé' },
    { pronoun: 'tu as', form: 'parlé' },
    { pronoun: 'il / elle / on a', form: 'parlé' },
    { pronoun: 'nous avons', form: 'parlé' },
    { pronoun: 'vous avez', form: 'parlé' },
    { pronoun: 'ils / elles ont', form: 'parlé' },
  ],
};

export function FrPasseComposeAvoirCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={PC_PARLER} />
      <RuleCard title="Past participles with avoir" subtitle="-ER → -é · -IR → -i · -RE → -u · plus many irregulars" color="from-blue-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            { inf: 'parler', pp: 'parlé', type: '-ER regular' },
            { inf: 'finir', pp: 'fini', type: '-IR regular' },
            { inf: 'vendre', pp: 'vendu', type: '-RE regular' },
            { inf: 'avoir', pp: 'eu', type: 'irregular' },
            { inf: 'être', pp: 'été', type: 'irregular' },
            { inf: 'faire', pp: 'fait', type: 'irregular' },
            { inf: 'voir', pp: 'vu', type: 'irregular' },
            { inf: 'prendre', pp: 'pris', type: 'irregular' },
            { inf: 'mettre', pp: 'mis', type: 'irregular' },
            { inf: 'dire', pp: 'dit', type: 'irregular' },
          ].map(({ inf, pp, type }) => (
            <div key={inf} className="px-3 py-1.5 flex gap-2">
              <span className="font-medium w-20">{inf}</span>
              <span className="font-bold text-blue-700 dark:text-blue-300 w-16">{pp}</span>
              <span className="text-muted-foreground text-[10px]">({type})</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── PASSÉ COMPOSÉ (ÊTRE) ─────────────────────────────────────────────────────

const PC_ALLER: VerbTableData = {
  verb: 'aller → allé(e)', tense: 'Passé composé', englishTense: 'past — to have gone',
  accentColor: 'text-violet-600 dark:text-violet-400',
  note: 'Past participle AGREES with the subject in gender and number — add -e (f), -s (m.pl), -es (f.pl).',
  rows: [
    { pronoun: 'je suis', form: 'allé(e)' },
    { pronoun: 'tu es', form: 'allé(e)' },
    { pronoun: 'il est / elle est', form: 'allé / allée' },
    { pronoun: 'nous sommes', form: 'allé(e)s' },
    { pronoun: 'vous êtes', form: 'allé(e)(s)' },
    { pronoun: 'ils sont / elles sont', form: 'allés / allées' },
  ],
};

export function FrPasseComposeEtreCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={PC_ALLER} />
      <RuleCard title="La Maison d'Être — House of être verbs" subtitle="17 verbs use être as auxiliary (motion & state changes) + all reflexives" color="from-violet-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            ['aller / venir', 'to go / to come'],
            ['arriver / partir', 'to arrive / to leave'],
            ['entrer / sortir', 'to enter / to go out'],
            ['monter / descendre', 'to go up / to go down'],
            ['naître / mourir', 'to be born / to die'],
            ['rester', 'to stay'],
            ['tomber', 'to fall'],
            ['passer', 'to pass (by)'],
            ['retourner', 'to return'],
            ['devenir / revenir', 'to become / to come back'],
          ].map(([fr, en]) => (
            <div key={fr} className="px-3 py-1.5 flex gap-2">
              <span className="font-semibold text-violet-700 dark:text-violet-300 w-36">{fr}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Memory aid: DR & MRS VANDERTRAMPP · All reflexive verbs also use être.</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── IMPARFAIT ────────────────────────────────────────────────────────────────

const IMP_PARLER: VerbTableData = {
  verb: 'parler (imp.)', tense: 'Imparfait', englishTense: 'imperfect — was speaking / used to speak',
  accentColor: 'text-teal-600 dark:text-teal-400',
  note: 'Stem = nous form of present minus -ons. Add: -ais, -ais, -ait, -ions, -iez, -aient.',
  rows: [
    { pronoun: 'je', form: 'parlais', stemEnd: 4 },
    { pronoun: 'tu', form: 'parlais', stemEnd: 4 },
    { pronoun: 'il / elle / on', form: 'parlait', stemEnd: 4 },
    { pronoun: 'nous', form: 'parlions', stemEnd: 4 },
    { pronoun: 'vous', form: 'parliez', stemEnd: 4 },
    { pronoun: 'ils / elles', form: 'parlaient', stemEnd: 4 },
  ],
};

export function FrImparfaitCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={IMP_PARLER} />
      <RuleCard title="When to use the imparfait" color="from-teal-500/10">
        <div className="divide-y text-xs">
          {[
            { use: 'Ongoing background action', ex: 'Il pleuvait quand je suis sorti. — It was raining when I left.' },
            { use: 'Habitual / repeated past', ex: 'Chaque été, nous allions à la mer. — Every summer we went to the sea.' },
            { use: 'Description of past state', ex: 'La maison était belle. — The house was beautiful.' },
            { use: 'Time / weather in the past', ex: 'Il était midi. — It was noon.' },
            { use: 'After "si" (hypotheticals)', ex: 'Si j\'avais de l\'argent... — If I had money...' },
          ].map(({ use, ex }) => (
            <div key={use} className="px-4 py-2 flex flex-col gap-0.5">
              <span className="font-semibold text-teal-700 dark:text-teal-300">{use}</span>
              <span className="text-muted-foreground italic">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── PC vs IMPARFAIT ─────────────────────────────────────────────────────────

export function FrPcVsImpCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-blue-500/10 to-teal-500/10">
        <p className="text-sm font-semibold text-center">Passé composé vs Imparfait</p>
        <p className="text-xs text-muted-foreground text-center">Two ways to talk about the past — context and meaning decide which one</p>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-wide">Passé composé</p>
          <ul className="space-y-1.5 text-xs">
            {[
              'Completed, one-time action',
              'Action with a defined endpoint',
              'Sequence of events',
              'Sudden interrupting action',
              'Action that happened X times',
            ].map(t => <li key={t} className="flex gap-1.5"><span className="text-blue-500 flex-shrink-0">•</span><span>{t}</span></li>)}
          </ul>
          <div className="mt-3 p-2 bg-blue-500/5 rounded text-xs italic text-muted-foreground">
            <p>Il a mangé une pomme.</p>
            <p>Hier, elle est partie à 8h.</p>
            <p>J'ai visité Paris trois fois.</p>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs font-bold text-teal-700 dark:text-teal-300 mb-2 uppercase tracking-wide">Imparfait</p>
          <ul className="space-y-1.5 text-xs">
            {[
              'Ongoing background action',
              'Habitual / repeated past action',
              'Description of past state',
              'Action in progress (interrupted)',
              'Time, weather, age in past',
            ].map(t => <li key={t} className="flex gap-1.5"><span className="text-teal-500 flex-shrink-0">•</span><span>{t}</span></li>)}
          </ul>
          <div className="mt-3 p-2 bg-teal-500/5 rounded text-xs italic text-muted-foreground">
            <p>Il mangeait quand je suis entré.</p>
            <p>Quand j'étais jeune, j'habitais ici.</p>
            <p>La rue était calme.</p>
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-center text-muted-foreground">
        Classic combo: <span className="font-semibold text-foreground">Il lisait (imp.) quand le téléphone a sonné (PC).</span> — He was reading when the phone rang.
      </div>
    </div>
  );
}

// ─── FUTUR SIMPLE ─────────────────────────────────────────────────────────────

const FUT_PARLER: VerbTableData = {
  verb: 'parler', tense: 'Futur simple', englishTense: 'future — will speak',
  accentColor: 'text-sky-600 dark:text-sky-400',
  note: 'Keep the full infinitive as stem (-re verbs drop final -e). Add: -ai, -as, -a, -ons, -ez, -ont.',
  rows: [
    { pronoun: 'je', form: 'parlerai', stemEnd: 6 },
    { pronoun: 'tu', form: 'parleras', stemEnd: 6 },
    { pronoun: 'il / elle / on', form: 'parlera', stemEnd: 6 },
    { pronoun: 'nous', form: 'parlerons', stemEnd: 6 },
    { pronoun: 'vous', form: 'parlerez', stemEnd: 6 },
    { pronoun: 'ils / elles', form: 'parleront', stemEnd: 6 },
  ],
};

export function FrFutureCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={FUT_PARLER} />
      <RuleCard title="Irregular future stems" subtitle="Same stems used for conditional — just change the endings" color="from-sky-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            { inf: 'être', stem: 'ser-' },
            { inf: 'avoir', stem: 'aur-' },
            { inf: 'aller', stem: 'ir-' },
            { inf: 'faire', stem: 'fer-' },
            { inf: 'venir', stem: 'viendr-' },
            { inf: 'voir', stem: 'verr-' },
            { inf: 'pouvoir', stem: 'pourr-' },
            { inf: 'vouloir', stem: 'voudr-' },
            { inf: 'devoir', stem: 'devr-' },
            { inf: 'savoir', stem: 'saur-' },
          ].map(({ inf, stem }) => (
            <div key={inf} className="px-3 py-1.5 flex gap-2">
              <span className="font-medium w-20">{inf}</span>
              <span className="font-bold text-sky-700 dark:text-sky-300">{stem}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Example: il sera (he will be) · j'irai (I will go) · elle fera (she will do)</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── CONDITIONNEL ─────────────────────────────────────────────────────────────

const COND_PARLER: VerbTableData = {
  verb: 'parler', tense: 'Conditionnel présent', englishTense: 'conditional — would speak',
  accentColor: 'text-indigo-600 dark:text-indigo-400',
  note: 'Same stem as futur simple + imparfait endings: -ais, -ais, -ait, -ions, -iez, -aient.',
  rows: [
    { pronoun: 'je', form: 'parlerais', stemEnd: 6 },
    { pronoun: 'tu', form: 'parlerais', stemEnd: 6 },
    { pronoun: 'il / elle / on', form: 'parlerait', stemEnd: 6 },
    { pronoun: 'nous', form: 'parlerions', stemEnd: 6 },
    { pronoun: 'vous', form: 'parleriez', stemEnd: 6 },
    { pronoun: 'ils / elles', form: 'parleraient', stemEnd: 6 },
  ],
};

export function FrConditionalCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={COND_PARLER} />
      <RuleCard title="Uses of the conditionnel" color="from-indigo-500/10">
        <div className="divide-y text-xs">
          {[
            { use: 'Hypothetical / "would"', ex: 'Je mangerais là-bas. — I would eat there.' },
            { use: 'Polite requests', ex: 'Je voudrais un café. — I would like a coffee.' },
            { use: 'Condition (si + imparfait → conditionnel)', ex: 'Si j\'avais du temps, je voyagerais. — If I had time, I would travel.' },
            { use: 'Reported/uncertain information', ex: 'Il serait à Paris. — He is reportedly in Paris.' },
            { use: 'Suggestion', ex: 'Tu devrais dormir. — You should sleep.' },
          ].map(({ use, ex }) => (
            <div key={use} className="px-4 py-2 flex flex-col gap-0.5">
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">{use}</span>
              <span className="text-muted-foreground italic">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── SUBJONCTIF PRÉSENT ───────────────────────────────────────────────────────

const SUBJ_PARLER: VerbTableData = {
  verb: 'parler', tense: 'Subjonctif présent', englishTense: 'subjunctive — that I speak',
  accentColor: 'text-fuchsia-600 dark:text-fuchsia-400',
  note: 'Stem = ils form of present minus -ent. Add: -e, -es, -e, -ions, -iez, -ent. Used after trigger phrases.',
  rows: [
    { pronoun: 'que je', form: 'parle', stemEnd: 4 },
    { pronoun: 'que tu', form: 'parles', stemEnd: 4 },
    { pronoun: "qu'il / qu'elle", form: 'parle', stemEnd: 4 },
    { pronoun: 'que nous', form: 'parlions', stemEnd: 4 },
    { pronoun: 'que vous', form: 'parliez', stemEnd: 4 },
    { pronoun: "qu'ils / qu'elles", form: 'parlent', stemEnd: 4 },
  ],
};

export function FrSubjunctiveCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={SUBJ_PARLER} />
      <RuleCard title="Trigger phrases — when to use subjunctive" color="from-fuchsia-500/10">
        <div className="divide-y text-xs">
          {[
            { trigger: 'il faut que', ex: 'Il faut que tu viennes. — You must come.' },
            { trigger: 'vouloir que', ex: 'Je veux qu\'il parte. — I want him to leave.' },
            { trigger: 'bien que / quoique', ex: 'Bien qu\'il soit tard... — Although it is late...' },
            { trigger: 'pour que', ex: 'Pour que tu comprennes... — So that you understand...' },
            { trigger: 'avant que', ex: 'Avant qu\'elle arrive. — Before she arrives.' },
            { trigger: "à moins que", ex: "À moins qu'il pleuve. — Unless it rains." },
          ].map(({ trigger, ex }) => (
            <div key={trigger} className="px-4 py-2 flex gap-3">
              <span className="font-semibold text-fuchsia-700 dark:text-fuchsia-300 w-32">{trigger}</span>
              <span className="text-muted-foreground italic">{ex}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Key irregulars: être → sois/soit/soient · avoir → aie/ait/aient · aller → aille · faire → fasse · pouvoir → puisse</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── NEGATION ────────────────────────────────────────────────────────────────

export function FrNegationCard() {
  return (
    <RuleCard title="La Négation — Negation in French" subtitle="ne...pas is just the beginning — French has a rich negation system" color="from-red-500/10">
      <div className="divide-y text-xs">
        {[
          { pattern: 'ne ... pas', meaning: 'not', ex: 'Je ne parle pas. — I don\'t speak.' },
          { pattern: 'ne ... jamais', meaning: 'never', ex: 'Il ne ment jamais. — He never lies.' },
          { pattern: 'ne ... plus', meaning: 'no longer / not anymore', ex: 'Elle n\'habite plus ici. — She no longer lives here.' },
          { pattern: 'ne ... rien', meaning: 'nothing', ex: 'Je ne vois rien. — I see nothing.' },
          { pattern: 'ne ... personne', meaning: 'nobody', ex: 'Tu ne vois personne? — You see nobody?' },
          { pattern: 'ne ... que', meaning: 'only', ex: 'Je n\'ai que dix euros. — I only have ten euros.' },
          { pattern: 'ne ... ni...ni', meaning: 'neither...nor', ex: 'Il n\'a ni faim ni soif. — He is neither hungry nor thirsty.' },
          { pattern: 'ne ... aucun(e)', meaning: 'no / not any', ex: 'Je n\'ai aucun doute. — I have no doubt.' },
        ].map(({ pattern, meaning, ex }) => (
          <div key={pattern} className="px-4 py-2.5 flex flex-col gap-0.5">
            <div className="flex items-baseline gap-3">
              <span className="font-bold text-red-700 dark:text-red-300 w-28">{pattern}</span>
              <span className="font-medium text-foreground">{meaning}</span>
            </div>
            <span className="text-muted-foreground italic">{ex}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">Word order: ne before verb, second element after verb. In spoken French, ne is often dropped: Je sais pas. (informal only)</p>
      </div>
    </RuleCard>
  );
}

// ─── ARTICLES & GENDER ────────────────────────────────────────────────────────

export function FrArticlesGenderCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Les Articles — French Articles" subtitle="Every noun has a gender — the article tells you which" color="from-yellow-500/10">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Type</th>
                <th className="px-3 py-1.5 text-center font-semibold">Masculin</th>
                <th className="px-3 py-1.5 text-center font-semibold">Féminin</th>
                <th className="px-3 py-1.5 text-center font-semibold">Voyelle/H</th>
                <th className="px-3 py-1.5 text-center font-semibold">Pluriel</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { type: 'Défini (the)', m: 'le', f: 'la', v: "l'", pl: 'les' },
                { type: 'Indéfini (a / an)', m: 'un', f: 'une', v: 'un/une', pl: 'des' },
                { type: 'Partitif (some)', m: 'du', f: 'de la', v: "de l'", pl: 'des' },
              ].map(({ type, m, f, v, pl }, i) => (
                <tr key={type} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                  <td className="px-3 py-2 font-medium text-muted-foreground">{type}</td>
                  <td className="px-3 py-2 text-center font-bold text-yellow-700 dark:text-yellow-300">{m}</td>
                  <td className="px-3 py-2 text-center font-bold text-pink-700 dark:text-pink-300">{f}</td>
                  <td className="px-3 py-2 text-center font-semibold text-muted-foreground">{v}</td>
                  <td className="px-3 py-2 text-center font-semibold">{pl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Gender tips — there are no absolute rules, but patterns help" color="from-yellow-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            { rule: 'Often masculine', detail: '-age, -ment, -eau, -eur (machines) → le garage, le document' },
            { rule: 'Often feminine', detail: '-tion, -sion, -ure, -ance, -ence → la nation, la culture' },
            { rule: 'Days, months, languages', detail: 'Masculine: le lundi, janvier, le français' },
            { rule: 'Countries', detail: '-e ending usually feminine: la France, l\'Espagne · exceptions: le Mexique' },
          ].map(({ rule, detail }) => (
            <div key={rule} className="px-3 py-2 flex flex-col gap-0.5">
              <span className="font-semibold text-yellow-700 dark:text-yellow-300">{rule}</span>
              <span className="text-muted-foreground">{detail}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Best approach: always learn gender with the noun. un arbre (tree), une fleur (flower) — not just arbre, fleur.</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── ADJECTIVE AGREEMENT ─────────────────────────────────────────────────────

export function FrAdjAgreeCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="L'accord des adjectifs — Adjective Agreement" subtitle="French adjectives agree in gender (m/f) and number (sing/pl)" color="from-pink-500/10">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Masc. sing.</th>
                <th className="px-3 py-1.5 text-left font-semibold">Fém. sing.</th>
                <th className="px-3 py-1.5 text-left font-semibold">Masc. pl.</th>
                <th className="px-3 py-1.5 text-left font-semibold">Fém. pl.</th>
                <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['grand', 'grande', 'grands', 'grandes', 'tall / big'],
                ['petit', 'petite', 'petits', 'petites', 'small'],
                ['heureux', 'heureuse', 'heureux', 'heureuses', 'happy'],
                ['beau', 'belle', 'beaux', 'belles', 'beautiful'],
                ['bon', 'bonne', 'bons', 'bonnes', 'good'],
                ['vieux', 'vieille', 'vieux', 'vieilles', 'old'],
                ['nouveau', 'nouvelle', 'nouveaux', 'nouvelles', 'new'],
                ['blanc', 'blanche', 'blancs', 'blanches', 'white'],
              ].map(([ms, fs, mp, fp, en], i) => (
                <tr key={ms} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                  <td className="px-3 py-1.5 font-semibold">{ms}</td>
                  <td className="px-3 py-1.5 font-semibold text-pink-700 dark:text-pink-300">{fs}</td>
                  <td className="px-3 py-1.5 font-semibold">{mp}</td>
                  <td className="px-3 py-1.5 font-semibold text-pink-700 dark:text-pink-300">{fp}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{en}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Position — before or after the noun?" subtitle="Most adjectives follow the noun. BAGS adjectives precede it." color="from-pink-500/10">
        <div className="px-4 py-3 text-xs space-y-2">
          <div className="flex items-baseline gap-3">
            <span className="font-bold text-pink-700 dark:text-pink-300 w-12">B A G S</span>
            <span className="font-semibold">Beauty · Age · Goodness · Size</span>
          </div>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {[
              ['beau/belle', 'beautiful → une belle ville'],
              ['nouveau/vieux', 'new/old → un vieux château'],
              ['bon/mauvais', 'good/bad → un bon repas'],
              ['grand/petit', 'big/small → une petite maison'],
              ['jeune/court', 'young/short → un jeune homme'],
              ['long/gros', 'long/big → un long voyage'],
            ].map(([adj, ex]) => (
              <div key={adj} className="flex gap-2">
                <span className="font-medium w-24">{adj}</span>
                <span className="text-muted-foreground">{ex}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground pt-1">All other adjectives follow the noun: une voiture rouge (a red car), un homme intelligent (an intelligent man).</p>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── OBJECT PRONOUNS ─────────────────────────────────────────────────────────

export function FrObjectPronounsCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Les Pronoms Objets — Object Pronouns" subtitle="COD = direct object · COI = indirect object" color="from-cyan-500/10">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Person</th>
                <th className="px-3 py-1.5 text-center font-semibold text-blue-700 dark:text-blue-300">COD (direct)</th>
                <th className="px-3 py-1.5 text-center font-semibold text-teal-700 dark:text-teal-300">COI (indirect)</th>
                <th className="px-3 py-1.5 text-center font-semibold text-purple-700 dark:text-purple-300">Réfléchi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['1st sing.', 'me (m\')', 'me (m\')', 'me (m\')'],
                ['2nd sing.', 'te (t\')', 'te (t\')', 'te (t\')'],
                ['3rd m. sing.', 'le (l\')', 'lui', 'se (s\')'],
                ['3rd f. sing.', 'la (l\')', 'lui', 'se (s\')'],
                ['1st pl.', 'nous', 'nous', 'nous'],
                ['2nd pl.', 'vous', 'vous', 'vous'],
                ['3rd pl.', 'les', 'leur', 'se (s\')'],
              ].map(([person, cod, coi, ref], i) => (
                <tr key={person} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                  <td className="px-3 py-1.5 text-muted-foreground">{person}</td>
                  <td className="px-3 py-1.5 text-center font-bold text-blue-700 dark:text-blue-300">{cod}</td>
                  <td className="px-3 py-1.5 text-center font-bold text-teal-700 dark:text-teal-300">{coi}</td>
                  <td className="px-3 py-1.5 text-center font-bold text-purple-700 dark:text-purple-300">{ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Order of pronouns before the verb" color="from-cyan-500/10">
        <div className="px-4 py-3">
          <div className="flex items-center gap-1 text-xs font-mono text-center justify-center flex-wrap gap-y-2">
            {['me/te/se/nous/vous', '>', 'le/la/les', '>', 'lui/leur', '>', 'y', '>', 'en', '>', 'verb'].map((item, i) => (
              <span key={i} className={item === '>' ? 'text-muted-foreground' :
                'bg-muted/40 px-2 py-1 rounded font-semibold text-foreground'}>{item}</span>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>Je <span className="font-semibold text-blue-700 dark:text-blue-300">le</span> vois. — I see him/it.</p>
            <p>Elle <span className="font-semibold text-teal-700 dark:text-teal-300">lui</span> parle. — She speaks to him/her.</p>
            <p>Il <span className="font-semibold text-blue-700 dark:text-blue-300">me</span> <span className="font-semibold text-blue-700 dark:text-blue-300">le</span> donne. — He gives it to me.</p>
            <p>Tu <span className="font-semibold">y</span> penses? — Are you thinking about it?</p>
          </div>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── TU vs VOUS ───────────────────────────────────────────────────────────────

export function FrTuVousCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-emerald-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Tu vs Vous — Register in French</p>
        <p className="text-xs text-muted-foreground text-center">One of the most culturally important choices you make as a French speaker</p>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2 uppercase tracking-wide">TU — Informal</p>
          <ul className="space-y-1.5 text-xs">
            {['Close friends & family', 'Children (speaking to them)', 'Fellow students / colleagues your age', 'Pets', 'In casual written messages (texts)', 'Between young adults (France, under ~30)'].map(t =>
              <li key={t} className="flex gap-1.5"><span className="text-emerald-500">•</span><span>{t}</span></li>)}
          </ul>
        </div>
        <div className="p-4">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-wide">VOUS — Formal or Plural</p>
          <ul className="space-y-1.5 text-xs">
            {['Strangers, shop staff, service workers', 'Elders (unless they offer tu)', 'Professional settings', 'Formal written communication', 'Speaking to groups of any size', 'New acquaintances (until invited otherwise)'].map(t =>
              <li key={t} className="flex gap-1.5"><span className="text-blue-500">•</span><span>{t}</span></li>)}
          </ul>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20 divide-y text-xs space-y-0">
        <p className="pb-2 text-muted-foreground">The invitation: <span className="font-semibold text-foreground">«&nbsp;On peut se tutoyer.&nbsp;»</span> — We can use tu with each other. This is a social milestone.</p>
        <p className="pt-2 text-muted-foreground">In Québec: tu is used more freely. In professional contexts in France, vous is default even between long-term colleagues.</p>
      </div>
    </div>
  );
}

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

export function FrQuestionsCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Former une question — 3 Ways to Ask Questions" subtitle="All three are grammatically correct; register varies" color="from-amber-500/10">
        <div className="divide-y text-xs">
          {[
            {
              method: '1. Intonation (Informal)', usage: 'spoken / everyday',
              ex: 'Tu parles français? → You speak French?',
              note: 'Just raise your voice at the end. Most common in daily speech.',
            },
            {
              method: '2. Est-ce que (Neutral)', usage: 'spoken & written',
              ex: 'Est-ce que tu parles français?',
              note: "Est-ce que → 'Is it that...' Drops the need for inversion. Best option for learners.",
            },
            {
              method: '3. Inversion (Formal)', usage: 'formal / written',
              ex: 'Parles-tu français? · A-t-il un stylo?',
              note: 'Verb then subject, joined by hyphen. -t- added between vowels: a-t-il, a-t-elle.',
            },
          ].map(({ method, usage, ex, note }) => (
            <div key={method} className="px-4 py-2.5">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-bold text-amber-700 dark:text-amber-300">{method}</span>
                <span className="text-muted-foreground text-[10px] border border-muted-foreground/30 px-1.5 py-0.5 rounded">{usage}</span>
              </div>
              <p className="font-semibold italic mb-0.5">{ex}</p>
              <p className="text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
      </RuleCard>
      <RuleCard title="Question words — les mots interrogatifs" color="from-amber-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            ['Qui', 'Who — Qui parle?'],
            ['Que / Qu\'est-ce que', 'What — Que fais-tu?'],
            ['Quand', 'When — Quand arrives-tu?'],
            ['Où', 'Where — Où habites-tu?'],
            ['Pourquoi', 'Why — Pourquoi tu ris?'],
            ['Comment', 'How — Comment ça va?'],
            ['Combien (de)', 'How many/much'],
            ['Quel(le)(s)', 'Which — Quel livre?'],
          ].map(([q, en]) => (
            <div key={q} className="px-3 py-1.5 flex gap-2">
              <span className="font-bold text-amber-700 dark:text-amber-300 w-28">{q}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── SECTION 4: PREPOSITIONS ─────────────────────────────────────────────────

export function FrSpatialPrepCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Les Prépositions de Lieu — Spatial Prepositions" color="from-indigo-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            ['dans', 'in, inside — dans la maison'],
            ['sur', 'on, on top of — sur la table'],
            ['sous', 'under — sous le lit'],
            ['devant', 'in front of — devant la porte'],
            ['derrière', 'behind — derrière le canapé'],
            ['entre', 'between — entre les deux arbres'],
            ['à côté de', 'next to — à côté du café'],
            ['en face de', 'across from — en face de la gare'],
            ['près de', 'near — près du parc'],
            ['loin de', 'far from — loin de la ville'],
            ['au-dessus de', 'above — au-dessus du nuage'],
            ['au-dessous de', 'below — au-dessous de la fenêtre'],
          ].map(([prep, ex]) => (
            <div key={prep} className="px-3 py-1.5 flex gap-2">
              <span className="font-bold text-indigo-700 dark:text-indigo-300 w-28">{prep}</span>
              <span className="text-muted-foreground">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
      <RuleCard title="Prepositions with cities and countries" subtitle="French uses à for cities, en/au/aux for countries" color="from-indigo-500/10">
        <div className="grid grid-cols-2 gap-0 divide-y text-xs">
          {[
            ['à + city', 'Je suis à Paris.'],
            ['en + f. country', 'en France, en Espagne'],
            ['au + m. country', 'au Canada, au Japon'],
            ['aux + pl. country', 'aux États-Unis'],
            ['de + city', 'Je viens de Lyon.'],
            ['de/du/d\'', 'Je reviens du Maroc.'],
          ].map(([rule, ex]) => (
            <div key={rule} className="px-3 py-2 flex gap-2">
              <span className="font-semibold text-indigo-700 dark:text-indigo-300 w-32">{rule}</span>
              <span className="text-muted-foreground italic">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

export function FrTemporalPrepCard() {
  return (
    <RuleCard title="Les Prépositions de Temps — Temporal Prepositions" color="from-sky-500/10">
      <div className="grid grid-cols-2 gap-0 divide-y text-xs">
        {[
          ['avant (de)', 'before — avant le dîner / avant de partir'],
          ['après', 'after — après le cours'],
          ['depuis', 'since/for (ongoing) — depuis deux ans'],
          ['pendant', 'during/for (completed) — pendant l\'été'],
          ['pour', 'for (intended duration) — pour trois jours'],
          ['dans', 'in (future) — dans une heure'],
          ['il y a', 'ago — il y a deux heures'],
          ['dès', 'from / as soon as — dès le matin'],
          ["jusqu'à", 'until — jusqu\'à midi'],
          ['en', 'in (duration) — en une heure (it took...)'],
          ['au moment de', 'at the moment of — au moment du départ'],
          ['à partir de', 'starting from — à partir de lundi'],
        ].map(([prep, ex]) => (
          <div key={prep} className="px-3 py-1.5 flex gap-2">
            <span className="font-bold text-sky-700 dark:text-sky-300 w-28">{prep}</span>
            <span className="text-muted-foreground">{ex}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">depuis vs pendant: Je travaille ici depuis 2020 (still ongoing). J'ai travaillé là pendant 3 ans (completed).</p>
      </div>
    </RuleCard>
  );
}
