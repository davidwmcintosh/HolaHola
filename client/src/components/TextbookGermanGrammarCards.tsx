/**
 * TextbookGermanGrammarCards.tsx
 * Section 3 & 4 — German grammar reference cards.
 * Mirrors the structure of TextbookFrenchGrammarCards.tsx.
 * Auto-triggered via classifyGermanGrammarType() in ChapterIntroduction.tsx.
 *
 * Cards (22 total):
 *  Section 3 — Verbs & Core Grammar
 *    DeSeinCard, DeHabenCard, DeWerdenCard
 *    DeRegularVerbsCard, DeModalVerbsCard, DeReflexiveCard
 *    DePerfektCard, DePrateritumCard, DePerfVsPratCard
 *    DeFuturCard, DeKonjunktiv2Card
 *    DeNegationCard, DeDefiniteArticlesCard, DeIndefiniteArticlesCard
 *    DeAdjEndingsCard, DeAccusativeCard, DeDativeCard, DeCasesOverviewCard
 *    DeSeparableVerbsCard, DeWordOrderCard
 *    DeQuestionsCard, DePronounsCard
 */

import { TextAudioPlayButton } from "@/components/AudioPlayButton";

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

interface ConjRow { pronoun: string; form: string; stemEnd?: number; }
interface VerbTableData {
  verb: string; tense: string; englishTense: string;
  rows: ConjRow[]; note?: string; accentColor?: string;
}

function splitForm(form: string, stemEnd?: number): [string, string] {
  if (stemEnd === undefined) return ['', form];
  return [form.slice(0, stemEnd), form.slice(stemEnd)];
}

function VerbConjugationTable({ data, language = 'german' }: { data: VerbTableData; language?: string }) {
  const accent = data.accentColor ?? 'text-red-600 dark:text-red-400';
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b bg-gradient-to-r from-red-500/10 to-transparent flex items-baseline justify-between gap-2 flex-wrap">
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
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">
                      {stem && <span>{stem}</span>}
                      {ending && <span className="text-red-600 dark:text-red-400">{ending}</span>}
                      {!stem && !ending && <span>{form}</span>}
                    </span>
                    <TextAudioPlayButton text={form} language={language} size="sm" variant="ghost" className="shrink-0 opacity-60 hover:opacity-100" />
                  </div>
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

function RuleCard({ title, subtitle, color = 'from-red-500/10', children }: {
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

function InfoRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2 border-b last:border-0 text-sm">
      <span className="font-semibold min-w-28 shrink-0">{label}</span>
      <div>
        <span>{value}</span>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── SEIN ─────────────────────────────────────────────────────────────────────

const SEIN_PRASENS: VerbTableData = {
  verb: 'sein', tense: 'Präsens', englishTense: 'present — to be',
  accentColor: 'text-violet-600 dark:text-violet-400',
  note: 'Sein is fully irregular — memorise all 6 forms. Essential for Perfekt with motion/state verbs.',
  rows: [
    { pronoun: 'ich', form: 'bin' },
    { pronoun: 'du', form: 'bist' },
    { pronoun: 'er / sie / es', form: 'ist' },
    { pronoun: 'wir', form: 'sind' },
    { pronoun: 'ihr', form: 'seid' },
    { pronoun: 'sie / Sie', form: 'sind' },
  ],
};

export function DeSeinCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={SEIN_PRASENS} />
      <RuleCard title="Key uses of SEIN" color="from-violet-500/10">
        <div className="divide-y text-xs">
          <InfoRow label="Identity" value="Ich bin Lehrer. — I am a teacher." />
          <InfoRow label="Origin/nationality" value="Sie ist Österreicherin. — She's Austrian." />
          <InfoRow label="Location (state)" value="Das Buch ist auf dem Tisch. — The book is on the table." />
          <InfoRow label="Perfekt auxiliary" value="Er ist gegangen. — He has gone. (motion verbs)" />
          <InfoRow label="Age" value="Er ist dreißig Jahre alt. — He is thirty years old." />
        </div>
      </RuleCard>
      <RuleCard title="Sein vs. Haben — which auxiliary?" color="from-amber-500/10"
        subtitle="Use sein with motion (gehen, kommen, fahren) and change-of-state (aufwachen, werden, sterben) verbs">
        <div className="divide-y text-xs">
          <InfoRow label="Sein (motion)" value="Ich bin nach Berlin gefahren." sub="I drove to Berlin." />
          <InfoRow label="Haben (action)" value="Ich habe das Buch gelesen." sub="I read the book." />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── HABEN ────────────────────────────────────────────────────────────────────

const HABEN_PRASENS: VerbTableData = {
  verb: 'haben', tense: 'Präsens', englishTense: 'present — to have',
  accentColor: 'text-amber-600 dark:text-amber-400',
  note: 'haben is slightly irregular — du hast (not habst), er hat. Used as Perfekt auxiliary for most verbs.',
  rows: [
    { pronoun: 'ich', form: 'habe', stemEnd: 3 },
    { pronoun: 'du', form: 'hast' },
    { pronoun: 'er / sie / es', form: 'hat' },
    { pronoun: 'wir', form: 'haben', stemEnd: 3 },
    { pronoun: 'ihr', form: 'habt', stemEnd: 3 },
    { pronoun: 'sie / Sie', form: 'haben', stemEnd: 3 },
  ],
};

export function DeHabenCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={HABEN_PRASENS} />
      <RuleCard title="Key uses of HABEN" color="from-amber-500/10">
        <div className="divide-y text-xs">
          <InfoRow label="Possession" value="Ich habe ein Auto. — I have a car." />
          <InfoRow label="Hunger/thirst" value="Ich habe Hunger / Durst. — I'm hungry / thirsty." />
          <InfoRow label="Fear" value="Er hat Angst. — He is afraid." />
          <InfoRow label="Time" value="Hast du Zeit? — Do you have time?" />
          <InfoRow label="Perfekt auxiliary" value="Sie hat gegessen. — She has eaten." />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── WERDEN ───────────────────────────────────────────────────────────────────

const WERDEN_PRASENS: VerbTableData = {
  verb: 'werden', tense: 'Präsens', englishTense: 'present — to become / will (future)',
  accentColor: 'text-blue-600 dark:text-blue-400',
  note: 'werden has a vowel change in du/er forms: du wirst, er wird. Triple function: become, future, Konjunktiv II.',
  rows: [
    { pronoun: 'ich', form: 'werde', stemEnd: 4 },
    { pronoun: 'du', form: 'wirst' },
    { pronoun: 'er / sie / es', form: 'wird' },
    { pronoun: 'wir', form: 'werden', stemEnd: 4 },
    { pronoun: 'ihr', form: 'werdet', stemEnd: 4 },
    { pronoun: 'sie / Sie', form: 'werden', stemEnd: 4 },
  ],
};

export function DeWerdenCard() {
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={WERDEN_PRASENS} />
      <RuleCard title="Three uses of WERDEN" color="from-blue-500/10">
        <div className="divide-y text-xs">
          <InfoRow label="To become" value="Er wird Arzt. — He is becoming a doctor." />
          <InfoRow label="Future (Futur I)" value="Ich werde morgen kommen. — I will come tomorrow." />
          <InfoRow label="Passive voice" value="Das Buch wird gelesen. — The book is being read." />
          <InfoRow label="Konjunktiv II" value="Ich würde gerne kommen. — I would like to come." />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── REGULAR VERBS ────────────────────────────────────────────────────────────

const SPIELEN: VerbTableData = {
  verb: 'spielen', tense: 'Präsens', englishTense: 'present — to play',
  note: 'Most German verbs follow this pattern: remove -en, then add endings: -e, -st, -t, -en, -t, -en.',
  rows: [
    { pronoun: 'ich', form: 'spiele', stemEnd: 5 },
    { pronoun: 'du', form: 'spielst', stemEnd: 5 },
    { pronoun: 'er / sie / es', form: 'spielt', stemEnd: 5 },
    { pronoun: 'wir', form: 'spielen', stemEnd: 5 },
    { pronoun: 'ihr', form: 'spielt', stemEnd: 5 },
    { pronoun: 'sie / Sie', form: 'spielen', stemEnd: 5 },
  ],
};

const LERNEN: VerbTableData = {
  verb: 'lernen', tense: 'Präsens', englishTense: 'present — to learn',
  note: 'Same pattern as spielen. Note: if stem ends in -t/-d, add -est/-et (du arbeitest).',
  rows: [
    { pronoun: 'ich', form: 'lerne', stemEnd: 4 },
    { pronoun: 'du', form: 'lernst', stemEnd: 4 },
    { pronoun: 'er / sie / es', form: 'lernt', stemEnd: 4 },
    { pronoun: 'wir', form: 'lernen', stemEnd: 4 },
    { pronoun: 'ihr', form: 'lernt', stemEnd: 4 },
    { pronoun: 'sie / Sie', form: 'lernen', stemEnd: 4 },
  ],
};

export function DeRegularVerbsCard() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <VerbConjugationTable data={SPIELEN} />
        <VerbConjugationTable data={LERNEN} />
      </div>
      <RuleCard title="Regular -EN Verb Endings" subtitle="Remove -en infinitive, add personal endings">
        <div className="p-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left pb-1 font-medium text-muted-foreground">Pronoun</th>
                <th className="text-left pb-1 font-medium text-muted-foreground">Ending</th>
                <th className="text-left pb-1 font-medium text-muted-foreground">Example (mach-)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['ich', '-e', 'mache'],
                ['du', '-st', 'machst'],
                ['er/sie/es', '-t', 'macht'],
                ['wir', '-en', 'machen'],
                ['ihr', '-t', 'macht'],
                ['sie/Sie', '-en', 'machen'],
              ].map(([p, e, ex]) => (
                <tr key={p} className="py-1">
                  <td className="py-1 font-medium text-muted-foreground">{p}</td>
                  <td className="py-1 font-semibold text-red-600 dark:text-red-400">{e}</td>
                  <td className="py-1">{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── MODAL VERBS ──────────────────────────────────────────────────────────────

export function DeModalVerbsCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Die Modalverben — Modal Verbs" subtitle="Modal verbs modify the infinitive at the end of the clause">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-semibold">Infinitiv</th>
                <th className="px-3 py-2 text-left font-semibold">Meaning</th>
                <th className="px-3 py-2 text-left font-semibold">ich</th>
                <th className="px-3 py-2 text-left font-semibold">du</th>
                <th className="px-3 py-2 text-left font-semibold">er/sie/es</th>
                <th className="px-3 py-2 text-left font-semibold">wir</th>
                <th className="px-3 py-2 text-left font-semibold">ihr</th>
                <th className="px-3 py-2 text-left font-semibold">sie/Sie</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['können', 'can/be able to', 'kann', 'kannst', 'kann', 'können', 'könnt', 'können'],
                ['müssen', 'must/have to', 'muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen'],
                ['wollen', 'want to', 'will', 'willst', 'will', 'wollen', 'wollt', 'wollen'],
                ['sollen', 'should/supposed to', 'soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen'],
                ['dürfen', 'may/allowed to', 'darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen'],
                ['mögen', 'to like (möchten=would like)', 'mag', 'magst', 'mag', 'mögen', 'mögt', 'mögen'],
              ].map(([inf, meaning, ich, du, er, wir, ihr, sie]) => (
                <tr key={inf} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5 font-semibold text-red-600 dark:text-red-400">{inf}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{meaning}</td>
                  <td className="px-3 py-1.5">{ich}</td>
                  <td className="px-3 py-1.5">{du}</td>
                  <td className="px-3 py-1.5">{er}</td>
                  <td className="px-3 py-1.5">{wir}</td>
                  <td className="px-3 py-1.5">{ihr}</td>
                  <td className="px-3 py-1.5">{sie}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Modal Verb Sentence Pattern" color="from-amber-500/10"
        subtitle="Modal in second position, infinitive goes to the END of the clause">
        <div className="divide-y text-xs">
          <InfoRow label="Ich kann Deutsch sprechen." value="I can speak German." />
          <InfoRow label="Wir müssen jetzt gehen." value="We have to go now." />
          <InfoRow label="Sie möchte einen Kaffee." value="She would like a coffee." sub="möchten = polite want" />
          <InfoRow label="Er darf nicht rauchen." value="He is not allowed to smoke." />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── REFLEXIVE VERBS ──────────────────────────────────────────────────────────

export function DeReflexiveCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Reflexive Verben — Reflexive Verbs"
        subtitle="Subject acts on itself — reflexive pronoun matches subject">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-semibold">Pronoun</th>
                <th className="px-3 py-2 text-left font-semibold">Akk. refl.</th>
                <th className="px-3 py-2 text-left font-semibold">Dat. refl.</th>
                <th className="px-3 py-2 text-left font-semibold">Example (sich waschen)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['ich', 'mich', 'mir', 'Ich wasche mich.'],
                ['du', 'dich', 'dir', 'Du wäschst dich.'],
                ['er/sie/es', 'sich', 'sich', 'Er wäscht sich.'],
                ['wir', 'uns', 'uns', 'Wir waschen uns.'],
                ['ihr', 'euch', 'euch', 'Ihr wascht euch.'],
                ['sie/Sie', 'sich', 'sich', 'Sie waschen sich.'],
              ].map(([p, akk, dat, ex]) => (
                <tr key={p}>
                  <td className="px-3 py-1.5 font-medium text-muted-foreground">{p}</td>
                  <td className="px-3 py-1.5 font-semibold text-red-600 dark:text-red-400">{akk}</td>
                  <td className="px-3 py-1.5 font-semibold text-blue-600 dark:text-blue-400">{dat}</td>
                  <td className="px-3 py-1.5">{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Common Reflexive Verbs" color="from-amber-500/10">
        <div className="grid grid-cols-2 divide-x">
          <div className="divide-y text-xs">
            {[
              ['sich freuen', 'to be happy/look forward to'],
              ['sich fühlen', 'to feel'],
              ['sich setzen', 'to sit down'],
              ['sich anziehen', 'to get dressed'],
              ['sich erinnern', 'to remember'],
            ].map(([v, en]) => (
              <div key={v} className="px-3 py-1.5 flex flex-col">
                <span className="font-semibold">{v}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
          <div className="divide-y text-xs">
            {[
              ['sich beeilen', 'to hurry'],
              ['sich ausruhen', 'to rest'],
              ['sich interessieren', 'to be interested in'],
              ['sich waschen', 'to wash (oneself)'],
              ['sich vorstellen', 'to introduce oneself / imagine'],
            ].map(([v, en]) => (
              <div key={v} className="px-3 py-1.5 flex flex-col">
                <span className="font-semibold">{v}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── PERFEKT ──────────────────────────────────────────────────────────────────

export function DePerfektCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Das Perfekt — Conversational Past"
        subtitle="Used in spoken German for all past events: haben/sein + past participle (Partizip II)">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-semibold text-amber-600 dark:text-amber-400">mit HABEN (most verbs)</p>
              <div className="space-y-0.5 text-xs">
                <p>Ich habe <strong>gespielt</strong>. — I played.</p>
                <p>Sie hat <strong>gegessen</strong>. — She ate.</p>
                <p>Wir haben <strong>gelernt</strong>. — We learned.</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-blue-600 dark:text-blue-400">mit SEIN (motion/state change)</p>
              <div className="space-y-0.5 text-xs">
                <p>Er ist <strong>gegangen</strong>. — He went.</p>
                <p>Sie ist <strong>gefahren</strong>. — She drove.</p>
                <p>Ich bin <strong>aufgewacht</strong>. — I woke up.</p>
              </div>
            </div>
          </div>
        </div>
      </RuleCard>
      <RuleCard title="Forming Partizip II (Past Participle)" color="from-amber-500/10">
        <div className="divide-y text-xs">
          <InfoRow label="Weak verbs" value="ge- + stem + -(e)t" sub="spielen → gespielt, machen → gemacht, arbeiten → gearbeitet" />
          <InfoRow label="Strong verbs" value="ge- + changed stem + -en" sub="gehen → gegangen, sehen → gesehen, trinken → getrunken" />
          <InfoRow label="Mixed verbs" value="ge- + changed stem + -t" sub="bringen → gebracht, denken → gedacht, kennen → gekannt" />
          <InfoRow label="Separable verbs" value="prefix + ge + stem + ending" sub="aufmachen → aufgemacht, einkaufen → eingekauft" />
          <InfoRow label="Inseparable (be-/er-/ver-/zer-)" value="NO ge- prefix" sub="besuchen → besucht, verstehen → verstanden, erklären → erklärt" />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── PRÄTERITUM ───────────────────────────────────────────────────────────────

export function DePrateritumCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Das Präteritum — Narrative/Written Past"
        subtitle="Used in formal writing, literature, and news. Also sein/haben/modals in speech.">
        <div className="grid grid-cols-2 divide-x text-xs">
          <div>
            <p className="px-3 py-2 font-semibold border-b bg-muted/30 text-center">Sein (war)</p>
            {[['ich','war'],['du','warst'],['er/sie/es','war'],['wir','waren'],['ihr','wart'],['sie/Sie','waren']].map(([p,f],i)=>(
              <div key={p} className={`flex justify-between px-3 py-1 ${i%2===0?'bg-muted/20':''}`}>
                <span className="text-muted-foreground">{p}</span>
                <span className="font-semibold">{f}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="px-3 py-2 font-semibold border-b bg-muted/30 text-center">Haben (hatte)</p>
            {[['ich','hatte'],['du','hattest'],['er/sie/es','hatte'],['wir','hatten'],['ihr','hattet'],['sie/Sie','hatten']].map(([p,f],i)=>(
              <div key={p} className={`flex justify-between px-3 py-1 ${i%2===0?'bg-muted/20':''}`}>
                <span className="text-muted-foreground">{p}</span>
                <span className="font-semibold">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </RuleCard>
      <RuleCard title="Weak Verbs in Präteritum" color="from-amber-500/10"
        subtitle="Stem + -te endings: -te, -test, -te, -ten, -tet, -ten">
        <div className="divide-y text-xs">
          <InfoRow label="spielen" value="ich spielte, du spieltest, er spielte, wir spielten" />
          <InfoRow label="machen" value="ich machte, du machtest, er machte, wir machten" />
          <InfoRow label="Strong verbs" value="Vowel change + no ending on ich/er" sub="gehen→ging, sehen→sah, fahren→fuhr, trinken→trank" />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── PERFEKT VS PRÄTERITUM ────────────────────────────────────────────────────

export function DePerfVsPratCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Perfekt vs. Präteritum — When to Use Each"
        subtitle="Both mean past tense, but register and context differ">
        <div className="grid grid-cols-2 divide-x text-xs">
          <div>
            <p className="px-3 py-2 font-semibold border-b bg-amber-500/10 text-center text-amber-700 dark:text-amber-300">PERFEKT</p>
            <div className="divide-y">
              {[
                ['Spoken German', 'Everyday conversation'],
                ['Southern Germany', 'Austria, Switzerland'],
                ['Recent events', '"I did something"'],
                ['Example', '"Ich habe Fußball gespielt."'],
              ].map(([k,v]) => (
                <div key={k} className="px-3 py-1.5">
                  <span className="font-semibold">{k}: </span><span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="px-3 py-2 font-semibold border-b bg-blue-500/10 text-center text-blue-700 dark:text-blue-300">PRÄTERITUM</p>
            <div className="divide-y">
              {[
                ['Written German', 'Novels, news, reports'],
                ['Northern Germany', 'Formal speech'],
                ['Historical events', 'Narrative distance'],
                ['Example', '"Ich spielte Fußball damals."'],
              ].map(([k,v]) => (
                <div key={k} className="px-3 py-1.5">
                  <span className="font-semibold">{k}: </span><span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RuleCard>
      <RuleCard title="Always Präteritum in speech" color="from-violet-500/10"
        subtitle="Even in casual conversation, these always use Präteritum (not Perfekt)">
        <div className="divide-y text-xs">
          <InfoRow label="sein" value="Ich war müde. — I was tired. (NOT: ich bin müde gewesen)" />
          <InfoRow label="haben" value="Er hatte Hunger. — He was hungry. (NOT: er hat Hunger gehabt)" />
          <InfoRow label="Modal verbs" value="Sie musste gehen. — She had to go. (NOT: sie hat gehen müssen)" />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── FUTUR I ──────────────────────────────────────────────────────────────────

export function DeFuturCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Futur I — The Future Tense"
        subtitle="werden (conjugated) + infinitive at the end of the clause">
        <div className="divide-y text-xs">
          {[
            ['ich werde … machen', 'I will do …'],
            ['du wirst … lernen', 'you will learn …'],
            ['er/sie/es wird … kommen', 'he/she/it will come …'],
            ['wir werden … gehen', 'we will go …'],
            ['ihr werdet … schreiben', 'you all will write …'],
            ['sie/Sie werden … reisen', 'they/you will travel …'],
          ].map(([de, en]) => (
            <div key={de} className="flex justify-between px-4 py-2">
              <span className="font-semibold">{de}</span>
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
      </RuleCard>
      <RuleCard title="Present tense often replaces future" color="from-amber-500/10"
        subtitle="With a time expression, Präsens is more natural than Futur I">
        <div className="divide-y text-xs">
          <InfoRow label="Futur I" value="Ich werde morgen arbeiten." sub="Formal / emphasis on certainty" />
          <InfoRow label="Präsens (natural)" value="Ich arbeite morgen." sub="More common in everyday speech" />
          <InfoRow label="Probability" value="Das wird stimmen." sub="That will / must be correct. (Futur I for deduction)" />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── KONJUNKTIV II ────────────────────────────────────────────────────────────

export function DeKonjunktiv2Card() {
  return (
    <div className="space-y-3">
      <RuleCard title="Konjunktiv II — The Subjunctive"
        subtitle="Hypotheticals, polite requests, wishes, and unreal conditions">
        <div className="divide-y text-xs">
          <InfoRow label="würde + infinitive" value="Main pattern for most verbs" sub="Ich würde gerne kommen. — I would like to come." />
          <InfoRow label="wäre" value="Konjunktiv II of sein" sub="Wenn ich reich wäre… — If I were rich…" />
          <InfoRow label="hätte" value="Konjunktiv II of haben" sub="Wenn ich Zeit hätte… — If I had time…" />
          <InfoRow label="könnte" value="Konjunktiv II of können" sub="Könntest du mir helfen? — Could you help me?" />
          <InfoRow label="müsste" value="Konjunktiv II of müssen" sub="Das müsste funktionieren. — That should work." />
        </div>
      </RuleCard>
      <RuleCard title="Polite Requests & Wishes" color="from-blue-500/10">
        <div className="divide-y text-xs">
          <InfoRow label="Wish" value="Ich wünschte, ich wäre dort." sub="I wish I were there." />
          <InfoRow label="Polite request" value="Hätten Sie einen Moment Zeit?" sub="Would you have a moment?" />
          <InfoRow label="Advice" value="Du solltest mehr schlafen." sub="You should sleep more." />
          <InfoRow label="Unreal condition" value="Wenn ich fliegen könnte, würde ich überall hinreisen." sub="If I could fly, I would travel everywhere." />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── NEGATION ─────────────────────────────────────────────────────────────────

export function DeNegationCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Die Verneinung — Negation"
        subtitle="German has two main negators: NICHT and KEIN">
        <div className="divide-y text-xs">
          <InfoRow label="NICHT" value="Negates verbs, adjectives, adverbs, and specific nouns" sub="Ich komme nicht. — I'm not coming." />
          <InfoRow label="KEIN/KEINE" value="Negates nouns (replaces ein/eine or bare nouns)" sub="Ich habe kein Auto. — I don't have a car." />
        </div>
      </RuleCard>
      <RuleCard title="NICHT — Position Rules" color="from-amber-500/10">
        <div className="divide-y text-xs">
          <InfoRow label="After object, before adverb" value="Ich sehe ihn nicht oft. — I don't see him often." />
          <InfoRow label="Before predicate adj." value="Das ist nicht gut. — That is not good." />
          <InfoRow label="Before separable prefix" value="Er macht die Tür nicht auf." sub="He doesn't open the door." />
          <InfoRow label="Before past participle" value="Sie hat nicht gearbeitet." sub="She didn't work." />
          <InfoRow label="Before infinitive" value="Er will nicht kommen." sub="He doesn't want to come." />
        </div>
      </RuleCard>
      <RuleCard title="KEIN — Declension" color="from-blue-500/10"
        subtitle="Kein takes the same endings as the indefinite article ein">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left">Case</th>
              <th className="px-3 py-1.5 text-left">Mask.</th>
              <th className="px-3 py-1.5 text-left">Fem.</th>
              <th className="px-3 py-1.5 text-left">Neut.</th>
              <th className="px-3 py-1.5 text-left">Plural</th>
            </tr></thead>
            <tbody className="divide-y">
              {[
                ['Nom.','kein','keine','kein','keine'],
                ['Akk.','keinen','keine','kein','keine'],
                ['Dat.','keinem','keiner','keinem','keinen'],
                ['Gen.','keines','keiner','keines','keiner'],
              ].map(([c,m,f,n,p]) => (
                <tr key={c} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5 font-semibold text-muted-foreground">{c}</td>
                  <td className="px-3 py-1.5">{m}</td>
                  <td className="px-3 py-1.5">{f}</td>
                  <td className="px-3 py-1.5">{n}</td>
                  <td className="px-3 py-1.5">{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── DEFINITE ARTICLES / GENDER ───────────────────────────────────────────────

export function DeDefiniteArticlesCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Der, Die, Das — Bestimmter Artikel"
        subtitle="Every German noun has a gender: Maskulinum (m), Femininum (f), or Neutrum (n)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left">Fall</th>
              <th className="px-3 py-1.5 text-left">Mask. (der)</th>
              <th className="px-3 py-1.5 text-left">Fem. (die)</th>
              <th className="px-3 py-1.5 text-left">Neut. (das)</th>
              <th className="px-3 py-1.5 text-left">Plural (die)</th>
            </tr></thead>
            <tbody className="divide-y">
              {[
                ['Nominativ','der','die','das','die'],
                ['Akkusativ','den','die','das','die'],
                ['Dativ','dem','der','dem','den (+n)'],
                ['Genitiv','des (+s)','der','des (+s)','der'],
              ].map(([c,m,f,n,p]) => (
                <tr key={c} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5 font-semibold text-muted-foreground">{c}</td>
                  <td className="px-3 py-1.5 font-semibold text-blue-600 dark:text-blue-400">{m}</td>
                  <td className="px-3 py-1.5 font-semibold text-red-600 dark:text-red-400">{f}</td>
                  <td className="px-3 py-1.5 font-semibold text-green-600 dark:text-green-400">{n}</td>
                  <td className="px-3 py-1.5">{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Gender Tips — Common Patterns" color="from-amber-500/10">
        <div className="grid grid-cols-3 divide-x text-xs">
          <div>
            <p className="px-3 py-2 font-semibold border-b text-blue-700 dark:text-blue-300 text-center">DER (masc.)</p>
            <div className="divide-y">
              {['-er (Lehrer)','-(l)ing (König)','-ismus','days, months','-ant, -ent'].map(s=>(
                <div key={s} className="px-3 py-1">{s}</div>
              ))}
            </div>
          </div>
          <div>
            <p className="px-3 py-2 font-semibold border-b text-red-700 dark:text-red-300 text-center">DIE (fem.)</p>
            <div className="divide-y">
              {['-ung (Zeitung)','-heit/-keit','-schaft/-ion','-tät/-tion','-ik (Musik)'].map(s=>(
                <div key={s} className="px-3 py-1">{s}</div>
              ))}
            </div>
          </div>
          <div>
            <p className="px-3 py-2 font-semibold border-b text-green-700 dark:text-green-300 text-center">DAS (neut.)</p>
            <div className="divide-y">
              {['-chen/-lein (dim.)','Ge- prefix','-ment, -um','-nis (often)','-tum'].map(s=>(
                <div key={s} className="px-3 py-1">{s}</div>
              ))}
            </div>
          </div>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── INDEFINITE ARTICLES ──────────────────────────────────────────────────────

export function DeIndefiniteArticlesCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Ein, Eine — Unbestimmter Artikel"
        subtitle="The indefinite article changes form by case AND gender">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left">Fall</th>
              <th className="px-3 py-1.5 text-left">Mask.</th>
              <th className="px-3 py-1.5 text-left">Fem.</th>
              <th className="px-3 py-1.5 text-left">Neut.</th>
              <th className="px-3 py-1.5 text-left">Plural (kein)</th>
            </tr></thead>
            <tbody className="divide-y">
              {[
                ['Nom.','ein','eine','ein','— / keine'],
                ['Akk.','einen','eine','ein','— / keine'],
                ['Dat.','einem','einer','einem','— / keinen'],
                ['Gen.','eines','einer','eines','— / keiner'],
              ].map(([c,m,f,n,p]) => (
                <tr key={c}>
                  <td className="px-3 py-1.5 font-semibold text-muted-foreground">{c}</td>
                  <td className="px-3 py-1.5">{m}</td>
                  <td className="px-3 py-1.5">{f}</td>
                  <td className="px-3 py-1.5">{n}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Zero article and kein" color="from-blue-500/10">
        <div className="divide-y text-xs">
          <InfoRow label="Indefinite plural" value="Ich sehe Bücher. — I see books." sub="No article with plural indefinite nouns" />
          <InfoRow label="Kein negates ein" value="Ich habe kein Buch. — I don't have a book." />
          <InfoRow label="Keine negates die/plural" value="Ich habe keine Bücher. — I have no books." />
          <InfoRow label="Professions (no article)" value="Er ist Arzt. — He is a doctor." sub="No article after sein with professions" />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── ADJECTIVE ENDINGS ────────────────────────────────────────────────────────

export function DeAdjEndingsCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Adjektivendungen — Adjective Endings"
        subtitle="Endings depend on: article type (definite/indefinite/none) + gender + case">
        <div className="space-y-3 p-3">
          <div>
            <p className="text-xs font-semibold mb-1 text-muted-foreground">After definite article (der/die/das)</p>
            <table className="w-full text-xs border rounded overflow-hidden">
              <thead><tr className="bg-muted/30 border-b">
                <th className="px-2 py-1 text-left">Case</th>
                <th className="px-2 py-1 text-left">Mask.</th>
                <th className="px-2 py-1 text-left">Fem.</th>
                <th className="px-2 py-1 text-left">Neut.</th>
                <th className="px-2 py-1 text-left">Plural</th>
              </tr></thead>
              <tbody className="divide-y">
                {[
                  ['Nom.','-e','-e','-e','-en'],
                  ['Akk.','-en','-e','-e','-en'],
                  ['Dat.','-en','-en','-en','-en'],
                  ['Gen.','-en','-en','-en','-en'],
                ].map(([c,...rest])=>(
                  <tr key={c}>
                    <td className="px-2 py-1 font-semibold text-muted-foreground">{c}</td>
                    {rest.map((v,i)=><td key={i} className="px-2 py-1 font-semibold text-red-600 dark:text-red-400">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1 text-muted-foreground">After indefinite article (ein/eine)</p>
            <table className="w-full text-xs border rounded overflow-hidden">
              <thead><tr className="bg-muted/30 border-b">
                <th className="px-2 py-1 text-left">Case</th>
                <th className="px-2 py-1 text-left">Mask.</th>
                <th className="px-2 py-1 text-left">Fem.</th>
                <th className="px-2 py-1 text-left">Neut.</th>
                <th className="px-2 py-1 text-left">Plural (kein)</th>
              </tr></thead>
              <tbody className="divide-y">
                {[
                  ['Nom.','-er','-e','-es','-en'],
                  ['Akk.','-en','-e','-es','-en'],
                  ['Dat.','-en','-en','-en','-en'],
                  ['Gen.','-en','-en','-en','-en'],
                ].map(([c,...rest])=>(
                  <tr key={c}>
                    <td className="px-2 py-1 font-semibold text-muted-foreground">{c}</td>
                    {rest.map((v,i)=><td key={i} className="px-2 py-1 font-semibold text-blue-600 dark:text-blue-400">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── ACCUSATIVE CASE ──────────────────────────────────────────────────────────

export function DeAccusativeCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Der Akkusativ — Direct Object Case"
        subtitle="The accusative marks the direct object — only masculine articles change from nominative">
        <div className="divide-y text-xs">
          <InfoRow label="Only masc. changes" value="der → den, ein → einen" sub="Feminine, neuter, plural stay the same as nominative" />
          <InfoRow label="Example (masc.)" value="Ich sehe den Mann." sub="I see the man. (der Mann → den Mann)" />
          <InfoRow label="Example (fem.)" value="Ich kaufe die Tasche." sub="I buy the bag. (same as nominative)" />
          <InfoRow label="Example (neut.)" value="Er liest das Buch." sub="He reads the book. (same as nominative)" />
        </div>
      </RuleCard>
      <RuleCard title="Akkusativ Prepositions" color="from-amber-500/10"
        subtitle="These prepositions ALWAYS take accusative — memorize them">
        <div className="grid grid-cols-2 gap-3 p-3 text-xs">
          {[
            ['durch', 'through — durch den Park'],
            ['für', 'for — für meinen Vater'],
            ['gegen', 'against — gegen den Wind'],
            ['ohne', 'without — ohne einen Plan'],
            ['um', 'around/at — um das Haus'],
            ['bis', 'until/up to — bis nächsten Montag'],
            ['entlang', 'along — den Fluss entlang'],
            ['wider', 'against (formal) — wider Erwarten'],
          ].map(([p, ex]) => (
            <div key={p} className="flex flex-col gap-0.5 p-2 rounded-md bg-muted/40">
              <span className="font-semibold text-red-600 dark:text-red-400">{p}</span>
              <span className="text-muted-foreground">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── DATIVE CASE ──────────────────────────────────────────────────────────────

export function DeDativeCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Der Dativ — Indirect Object Case"
        subtitle="Marks the indirect object (recipient) — all articles change">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left">Article type</th>
              <th className="px-3 py-1.5 text-left">Mask.</th>
              <th className="px-3 py-1.5 text-left">Fem.</th>
              <th className="px-3 py-1.5 text-left">Neut.</th>
              <th className="px-3 py-1.5 text-left">Plural</th>
            </tr></thead>
            <tbody className="divide-y">
              {[
                ['Definite','dem','der','dem','den (+n)'],
                ['Indefinite','einem','einer','einem','keinen'],
              ].map(([t,m,f,n,p])=>(
                <tr key={t}>
                  <td className="px-3 py-1.5 font-semibold text-muted-foreground">{t}</td>
                  <td className="px-3 py-1.5 font-semibold text-blue-600 dark:text-blue-400">{m}</td>
                  <td className="px-3 py-1.5 font-semibold text-red-600 dark:text-red-400">{f}</td>
                  <td className="px-3 py-1.5 font-semibold text-green-600 dark:text-green-400">{n}</td>
                  <td className="px-3 py-1.5">{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Dativ Prepositions" color="from-blue-500/10"
        subtitle="These prepositions ALWAYS take dative — memorize them">
        <div className="grid grid-cols-2 gap-2 p-3 text-xs">
          {[
            ['aus', 'out of / from — aus dem Haus'],
            ['bei', 'at / with — bei meiner Mutter'],
            ['mit', 'with — mit dem Zug'],
            ['nach', 'after / to (cities) — nach Berlin'],
            ['seit', 'since/for — seit einer Stunde'],
            ['von', 'from / of — von dem (vom) Lehrer'],
            ['zu', 'to — zu dem (zum) Bahnhof'],
            ['gegenüber', 'across from — dem Park gegenüber'],
          ].map(([p, ex]) => (
            <div key={p} className="flex flex-col gap-0.5 p-2 rounded-md bg-muted/40">
              <span className="font-semibold text-blue-600 dark:text-blue-400">{p}</span>
              <span className="text-muted-foreground">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── CASES OVERVIEW ───────────────────────────────────────────────────────────

export function DeCasesOverviewCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Die vier Fälle — The Four German Cases"
        subtitle="Who does what to whom — Nominativ / Akkusativ / Dativ / Genitiv">
        <div className="divide-y text-xs">
          <InfoRow label="Nominativ (Nom.)" value="Subject — does the action" sub="Der Mann kauft. — The man buys." />
          <InfoRow label="Akkusativ (Akk.)" value="Direct object — receives the action" sub="Er kauft den Wagen. — He buys the car." />
          <InfoRow label="Dativ (Dat.)" value="Indirect object — recipient" sub="Er gibt dem Kind ein Buch. — He gives the child a book." />
          <InfoRow label="Genitiv (Gen.)" value="Possession / of-relationship" sub="Das Buch des Mannes. — The man's book." />
        </div>
      </RuleCard>
      <RuleCard title="Two-way prepositions (Wechselpräpositionen)" color="from-amber-500/10"
        subtitle="an, auf, hinter, in, neben, über, unter, vor, zwischen — Akkusativ = movement toward, Dativ = position">
        <div className="grid grid-cols-2 gap-3 p-3 text-xs">
          <div>
            <p className="font-semibold mb-1 text-red-600 dark:text-red-400">Akkusativ (Wohin? → movement)</p>
            <p>Ich gehe <strong>in den</strong> Park. — I'm going into the park.</p>
            <p className="mt-1">Sie stellt das Glas <strong>auf den</strong> Tisch.</p>
          </div>
          <div>
            <p className="font-semibold mb-1 text-blue-600 dark:text-blue-400">Dativ (Wo? → location)</p>
            <p>Ich bin <strong>in dem (im)</strong> Park. — I'm in the park.</p>
            <p className="mt-1">Das Glas steht <strong>auf dem</strong> Tisch.</p>
          </div>
        </div>
      </RuleCard>
    </div>
  );
}

// ─── SEPARABLE VERBS ──────────────────────────────────────────────────────────

export function DeSeparableVerbsCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Trennbare Verben — Separable Verbs"
        subtitle="The prefix splits off and goes to the END of the main clause">
        <div className="divide-y text-xs">
          <InfoRow label="Pattern" value="PREFIX + verb — prefix moves to end in conjugated sentences" />
          <InfoRow label="aufmachen (to open)" value="Ich mache die Tür auf. — I open the door." />
          <InfoRow label="anrufen (to call)" value="Er ruft sie an. — He calls her." />
          <InfoRow label="einkaufen (to shop)" value="Wir kaufen heute ein. — We're shopping today." />
          <InfoRow label="aufwachen (to wake up)" value="Sie wacht um 7 Uhr auf." sub="She wakes up at 7 o'clock." />
          <InfoRow label="zurückkommen (to return)" value="Wann kommst du zurück?" sub="When are you coming back?" />
        </div>
      </RuleCard>
      <RuleCard title="Common Separable Prefixes" color="from-amber-500/10">
        <div className="grid grid-cols-3 gap-2 p-3 text-xs">
          {[
            ['ab-','abreisen — to depart'],
            ['an-','ankommen — to arrive'],
            ['auf-','aufmachen — to open'],
            ['aus-','ausschalten — to turn off'],
            ['ein-','einladen — to invite'],
            ['mit-','mitkommen — to come along'],
            ['nach-','nachdenken — to think about'],
            ['vor-','vorstellen — to introduce'],
            ['zurück-','zurückgeben — to give back'],
          ].map(([p, ex]) => (
            <div key={p} className="p-1.5 rounded bg-muted/40">
              <span className="font-semibold text-red-600 dark:text-red-400">{p} </span>
              <span className="text-muted-foreground text-[10px]">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── WORD ORDER ───────────────────────────────────────────────────────────────

export function DeWordOrderCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Die Wortstellung — German Word Order"
        subtitle="Verb is ALWAYS second in main clauses; verb goes LAST in subordinate clauses">
        <div className="divide-y text-xs">
          <InfoRow label="V2 Rule (Hauptsatz)" value="Conjugated verb is always in position 2" sub="Morgen fahre ich nach Berlin. (adverb first → verb inverts)" />
          <InfoRow label="Normal order" value="Ich fahre morgen nach Berlin." sub="Subject in position 1, verb in position 2" />
          <InfoRow label="Inverted order" value="Morgen fahre ich nach Berlin." sub="Adverb first → subject after verb (but verb still #2)" />
          <InfoRow label="Questions" value="Fährt er nach Berlin? / Wann fährt er?" sub="Verb first (yes/no), W-word + verb (info questions)" />
        </div>
      </RuleCard>
      <RuleCard title="Subordinate Clauses — Verb LAST" color="from-amber-500/10"
        subtitle="After conjunctions: weil, dass, wenn, ob, obwohl, bevor, nachdem, damit…">
        <div className="divide-y text-xs">
          <InfoRow label="weil (because)" value="Ich komme nicht, weil ich krank bin." sub="Because I'm sick — verb goes last" />
          <InfoRow label="dass (that)" value="Er sagt, dass er kommt." sub="He says that he's coming" />
          <InfoRow label="wenn (when/if)" value="Wenn du Zeit hast, ruf mich an." sub="If you have time, call me." />
          <InfoRow label="ob (whether)" value="Ich weiß nicht, ob er kommt." sub="I don't know whether he's coming." />
          <InfoRow label="Modal in subord." value="…weil er kommen muss." sub="Infinitive BEFORE modal: muss comes last" />
        </div>
      </RuleCard>
    </div>
  );
}

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

export function DeQuestionsCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Fragen stellen — Forming Questions"
        subtitle="Yes/No questions: invert verb-subject. W-questions: W-word + verb + subject">
        <div className="divide-y text-xs">
          <InfoRow label="Ja/Nein (yes/no)" value="Verb moves to position 1" sub="Kommst du? — Are you coming?" />
          <InfoRow label="W-Fragen" value="W-word → verb → subject → rest" sub="Wohin fährst du? — Where are you going?" />
          <InfoRow label="Embedded question" value="Verb goes LAST (subordinate clause rule)" sub="Ich weiß nicht, warum er geht." />
        </div>
      </RuleCard>
      <RuleCard title="W-Fragewörter — Question Words" color="from-amber-500/10">
        <div className="grid grid-cols-2 gap-2 p-3 text-xs">
          {[
            ['Wer?','Who? (Nom.) — Wer ist das?'],
            ['Wen?','Whom? (Akk.) — Wen siehst du?'],
            ['Wem?','To whom? (Dat.) — Wem gibst du das?'],
            ['Was?','What? — Was machst du?'],
            ['Wo?','Where? (location) — Wo bist du?'],
            ['Wohin?','Where to? (motion) — Wohin gehst du?'],
            ['Woher?','Where from? — Woher kommst du?'],
            ['Wann?','When? — Wann kommt er?'],
            ['Wie?','How? — Wie heißt du?'],
            ['Warum?','Why? — Warum weinst du?'],
            ['Wie viel?','How much? — Wie viel kostet das?'],
            ['Welch-?','Which? — Welches Buch?'],
          ].map(([q, ex]) => (
            <div key={q} className="flex flex-col gap-0.5">
              <span className="font-semibold text-red-600 dark:text-red-400">{q}</span>
              <span className="text-muted-foreground">{ex}</span>
            </div>
          ))}
        </div>
      </RuleCard>
    </div>
  );
}

// ─── PERSONAL PRONOUNS ────────────────────────────────────────────────────────

export function DePronounsCard() {
  return (
    <div className="space-y-3">
      <RuleCard title="Personalpronomen — Personal Pronouns"
        subtitle="Pronouns change form by case — Nominativ / Akkusativ / Dativ">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left">Person</th>
              <th className="px-3 py-1.5 text-left">Nom.</th>
              <th className="px-3 py-1.5 text-left">Akk.</th>
              <th className="px-3 py-1.5 text-left">Dat.</th>
            </tr></thead>
            <tbody className="divide-y">
              {[
                ['1st sg.','ich','mich','mir'],
                ['2nd sg. (inf.)','du','dich','dir'],
                ['3rd masc.','er','ihn','ihm'],
                ['3rd fem.','sie','sie','ihr'],
                ['3rd neut.','es','es','ihm'],
                ['1st pl.','wir','uns','uns'],
                ['2nd pl.','ihr','euch','euch'],
                ['3rd pl. / formal','sie / Sie','sie / Sie','ihnen / Ihnen'],
              ].map(([p,n,a,d]) => (
                <tr key={p} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5 text-muted-foreground">{p}</td>
                  <td className="px-3 py-1.5 font-semibold">{n}</td>
                  <td className="px-3 py-1.5 font-semibold text-red-600 dark:text-red-400">{a}</td>
                  <td className="px-3 py-1.5 font-semibold text-blue-600 dark:text-blue-400">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RuleCard>
      <RuleCard title="Formal Sie vs. informal du/ihr" color="from-violet-500/10">
        <div className="divide-y text-xs">
          <InfoRow label="du" value="Singular informal — friends, family, children, peers" />
          <InfoRow label="ihr" value="Plural informal — same relationships as du" />
          <InfoRow label="Sie" value="Formal singular AND plural — always capitalised" sub="Stranger, boss, older person — Sprechen Sie Deutsch?" />
          <InfoRow label="Switching" value="Germans take formality seriously — wait to be offered 'du'" />
        </div>
      </RuleCard>
    </div>
  );
}
