/**
 * TextbookItalianGrammarCards.tsx
 * Section 3 & 4 — Italian grammar reference cards.
 * Mirrors the structure of TextbookGermanGrammarCards.tsx.
 * Auto-triggered via classifyItalianGrammarType() in ChapterIntroduction.tsx.
 *
 * Cards (22 total):
 *  Section 3 — Verbs & Core Grammar
 *    ItEssereCard, ItAvereCard, ItStareCard
 *    ItRegularVerbsCard, ItModalVerbsCard, ItReflexiveCard
 *    ItPassatoProssimoCard, ItImperfettoCard, ItPastComparisonCard
 *    ItFuturoCard, ItCondizionaleCard
 *    ItNegationCard, ItDefiniteArticlesCard, ItIndefiniteArticlesCard
 *    ItAdjAgreementCard, ItArticulatedPrepCard, ItObjectPronounsCard
 *    ItSubjectPronounsCard, ItQuestionsCard, ItPartitiveCard
 *    ItImperativeCard, ItComparativesCard
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

function VerbConjugationTable({ data, language = 'italian' }: { data: VerbTableData; language?: string }) {
  const accent = data.accentColor ?? 'text-green-700 dark:text-green-400';
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b bg-gradient-to-r from-green-500/10 to-transparent flex items-baseline justify-between gap-2 flex-wrap">
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
                      {ending && <span className="text-green-700 dark:text-green-400">{ending}</span>}
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

function GrammarCard({ title, subtitle, color = 'from-green-500/10', children }: {
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

function RuleRow({ label, rule, example }: { label: string; rule: string; example?: string }) {
  return (
    <div className="flex gap-3 px-4 py-2 border-b last:border-0 text-xs">
      <span className="font-semibold text-green-700 dark:text-green-400 min-w-32 shrink-0">{label}</span>
      <div>
        <span className="font-medium">{rule}</span>
        {example && <p className="text-muted-foreground mt-0.5 italic">{example}</p>}
      </div>
    </div>
  );
}

// ─── ESSERE ───────────────────────────────────────────────────────────────────

export function ItEssereCard() {
  const present: VerbTableData = {
    verb: 'essere', tense: 'Presente', englishTense: 'Present tense',
    rows: [
      { pronoun: 'io', form: 'sono' },
      { pronoun: 'tu', form: 'sei' },
      { pronoun: 'lui / lei / Lei', form: 'è' },
      { pronoun: 'noi', form: 'siamo' },
      { pronoun: 'voi', form: 'siete' },
      { pronoun: 'loro', form: 'sono' },
    ],
    note: 'Essere = "to be." Used for identity, origin, descriptions, and as auxiliary for passato prossimo.',
  };
  const passato: VerbTableData = {
    verb: 'essere', tense: 'Passato Prossimo', englishTense: 'Compound past',
    rows: [
      { pronoun: 'io', form: 'sono stato/a' },
      { pronoun: 'tu', form: 'sei stato/a' },
      { pronoun: 'lui / lei', form: 'è stato/a' },
      { pronoun: 'noi', form: 'siamo stati/e' },
      { pronoun: 'voi', form: 'siete stati/e' },
      { pronoun: 'loro', form: 'sono stati/e' },
    ],
    note: 'Essere uses ITSELF as auxiliary. Past participle stato agrees in gender & number.',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={present} />
      <VerbConjugationTable data={passato} />
      <GrammarCard title="Essere — Key Uses">
        <RuleRow label="Identity" rule="Sono italiano." example="I am Italian." />
        <RuleRow label="Origin" rule="Sono di Roma." example="I am from Rome." />
        <RuleRow label="Description" rule="Il cielo è blu." example="The sky is blue." />
        <RuleRow label="Location" rule="La banca è qui." example="The bank is here. (place/thing)" />
        <RuleRow label="Time / date" rule="Sono le tre." example="It is three o'clock." />
        <RuleRow label="Aux for motion" rule="Sono andato/a." example="I went. (with essere)" />
      </GrammarCard>
    </div>
  );
}

// ─── AVERE ────────────────────────────────────────────────────────────────────

export function ItAvereCard() {
  const present: VerbTableData = {
    verb: 'avere', tense: 'Presente', englishTense: 'Present tense',
    rows: [
      { pronoun: 'io', form: 'ho' },
      { pronoun: 'tu', form: 'hai' },
      { pronoun: 'lui / lei / Lei', form: 'ha' },
      { pronoun: 'noi', form: 'abbiamo' },
      { pronoun: 'voi', form: 'avete' },
      { pronoun: 'loro', form: 'hanno' },
    ],
    note: 'Avere = "to have." Also used as auxiliary for transitive verbs in passato prossimo.',
  };
  const passato: VerbTableData = {
    verb: 'avere', tense: 'Passato Prossimo', englishTense: 'Compound past',
    rows: [
      { pronoun: 'io', form: 'ho avuto' },
      { pronoun: 'tu', form: 'hai avuto' },
      { pronoun: 'lui / lei', form: 'ha avuto' },
      { pronoun: 'noi', form: 'abbiamo avuto' },
      { pronoun: 'voi', form: 'avete avuto' },
      { pronoun: 'loro', form: 'hanno avuto' },
    ],
    note: 'Avere uses ITSELF as auxiliary. Past participle avuto is invariable with avere.',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={present} />
      <VerbConjugationTable data={passato} />
      <GrammarCard title="Avere — Common Expressions">
        <RuleRow label="avere fame" rule="to be hungry" example="Ho fame. — I'm hungry." />
        <RuleRow label="avere sete" rule="to be thirsty" example="Hai sete? — Are you thirsty?" />
        <RuleRow label="avere caldo/freddo" rule="to be hot/cold" example="Ho freddo. — I'm cold." />
        <RuleRow label="avere paura" rule="to be afraid" example="Ha paura. — She's afraid." />
        <RuleRow label="avere ragione" rule="to be right" example="Hai ragione! — You're right!" />
        <RuleRow label="avere bisogno di" rule="to need" example="Ho bisogno di aiuto. — I need help." />
      </GrammarCard>
    </div>
  );
}

// ─── STARE ────────────────────────────────────────────────────────────────────

export function ItStareCard() {
  const present: VerbTableData = {
    verb: 'stare', tense: 'Presente', englishTense: 'Present tense',
    rows: [
      { pronoun: 'io', form: 'sto' },
      { pronoun: 'tu', form: 'stai' },
      { pronoun: 'lui / lei / Lei', form: 'sta' },
      { pronoun: 'noi', form: 'stiamo' },
      { pronoun: 'voi', form: 'state' },
      { pronoun: 'loro', form: 'stanno' },
    ],
    note: 'Stare = "to stay/be." Used for health/feelings, location of people, and the gerund progressive.',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={present} />
      <GrammarCard title="Stare — Key Uses vs. Essere">
        <RuleRow label="Health / mood" rule="Come stai? — Sto bene!" example="How are you? — I'm well!" />
        <RuleRow label="Location (people)" rule="Sto a casa." example="I'm at home. (where I am now)" />
        <RuleRow label="Gerund progressive" rule="stare + gerundio" example="Sto mangiando. — I'm eating." />
        <RuleRow label="Stare per + inf." rule="about to do sth." example="Sto per partire. — I'm about to leave." />
        <RuleRow label="Note: essere" rule="permanent identity/traits" example="Sono stanco. — I am tired. (state/feeling)" />
        <RuleRow label="Key difference" rule="stare = temporary state" example="Sono romano. vs. Sto a Roma." />
      </GrammarCard>
    </div>
  );
}

// ─── REGULAR VERBS ────────────────────────────────────────────────────────────

export function ItRegularVerbsCard() {
  const arVerb: VerbTableData = {
    verb: 'parlare (-are)', tense: 'Presente', englishTense: 'speak',
    rows: [
      { pronoun: 'io', form: 'parlo', stemEnd: 4 },
      { pronoun: 'tu', form: 'parli', stemEnd: 4 },
      { pronoun: 'lui / lei', form: 'parla', stemEnd: 4 },
      { pronoun: 'noi', form: 'parliamo', stemEnd: 4 },
      { pronoun: 'voi', form: 'parlate', stemEnd: 4 },
      { pronoun: 'loro', form: 'parlano', stemEnd: 4 },
    ],
  };
  const ereVerb: VerbTableData = {
    verb: 'vedere (-ere)', tense: 'Presente', englishTense: 'see',
    rows: [
      { pronoun: 'io', form: 'vedo', stemEnd: 3 },
      { pronoun: 'tu', form: 'vedi', stemEnd: 3 },
      { pronoun: 'lui / lei', form: 'vede', stemEnd: 3 },
      { pronoun: 'noi', form: 'vediamo', stemEnd: 3 },
      { pronoun: 'voi', form: 'vedete', stemEnd: 3 },
      { pronoun: 'loro', form: 'vedono', stemEnd: 3 },
    ],
  };
  const ireVerb: VerbTableData = {
    verb: 'partire (-ire)', tense: 'Presente', englishTense: 'leave/depart',
    rows: [
      { pronoun: 'io', form: 'parto', stemEnd: 4 },
      { pronoun: 'tu', form: 'parti', stemEnd: 4 },
      { pronoun: 'lui / lei', form: 'parte', stemEnd: 4 },
      { pronoun: 'noi', form: 'partiamo', stemEnd: 4 },
      { pronoun: 'voi', form: 'partite', stemEnd: 4 },
      { pronoun: 'loro', form: 'partono', stemEnd: 4 },
    ],
    note: 'Some -ire verbs add -isc-: capire → capisco, capisci, capisce, capiamo, capite, capiscono.',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={arVerb} />
      <VerbConjugationTable data={ereVerb} />
      <VerbConjugationTable data={ireVerb} />
    </div>
  );
}

// ─── MODAL VERBS ──────────────────────────────────────────────────────────────

export function ItModalVerbsCard() {
  const dovere: VerbTableData = {
    verb: 'dovere', tense: 'Presente', englishTense: 'must / have to',
    rows: [
      { pronoun: 'io', form: 'devo' },
      { pronoun: 'tu', form: 'devi' },
      { pronoun: 'lui / lei', form: 'deve' },
      { pronoun: 'noi', form: 'dobbiamo' },
      { pronoun: 'voi', form: 'dovete' },
      { pronoun: 'loro', form: 'devono' },
    ],
  };
  const potere: VerbTableData = {
    verb: 'potere', tense: 'Presente', englishTense: 'can / be able to',
    rows: [
      { pronoun: 'io', form: 'posso' },
      { pronoun: 'tu', form: 'puoi' },
      { pronoun: 'lui / lei', form: 'può' },
      { pronoun: 'noi', form: 'possiamo' },
      { pronoun: 'voi', form: 'potete' },
      { pronoun: 'loro', form: 'possono' },
    ],
  };
  const volere: VerbTableData = {
    verb: 'volere', tense: 'Presente', englishTense: 'want to',
    rows: [
      { pronoun: 'io', form: 'voglio' },
      { pronoun: 'tu', form: 'vuoi' },
      { pronoun: 'lui / lei', form: 'vuole' },
      { pronoun: 'noi', form: 'vogliamo' },
      { pronoun: 'voi', form: 'volete' },
      { pronoun: 'loro', form: 'vogliono' },
    ],
    note: 'Modals + infinitive: Devo lavorare. Posso venire? Voglio mangiare. The auxiliary in passato prossimo is determined by the following infinitive.',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={dovere} />
      <VerbConjugationTable data={potere} />
      <VerbConjugationTable data={volere} />
    </div>
  );
}

// ─── REFLEXIVE VERBS ──────────────────────────────────────────────────────────

export function ItReflexiveCard() {
  const lavarsi: VerbTableData = {
    verb: 'lavarsi', tense: 'Presente', englishTense: 'to wash oneself',
    rows: [
      { pronoun: 'io', form: 'mi lavo' },
      { pronoun: 'tu', form: 'ti lavi' },
      { pronoun: 'lui / lei', form: 'si lava' },
      { pronoun: 'noi', form: 'ci laviamo' },
      { pronoun: 'voi', form: 'vi lavate' },
      { pronoun: 'loro', form: 'si lavano' },
    ],
    note: 'Reflexive pronouns (mi, ti, si, ci, vi, si) go BEFORE the verb in simple tenses.',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={lavarsi} />
      <GrammarCard title="Reflexive Pronouns & Common Verbs">
        <RuleRow label="mi" rule="myself (io)" example="Mi sveglio alle sette. — I wake up at seven." />
        <RuleRow label="ti" rule="yourself (tu)" example="Ti senti bene? — Do you feel well?" />
        <RuleRow label="si" rule="himself/herself/itself" example="Si chiama Marco. — His name is Marco." />
        <RuleRow label="ci" rule="ourselves (noi)" example="Ci vediamo domani. — We'll see each other tomorrow." />
        <RuleRow label="vi" rule="yourselves (voi)" example="Vi alzate tardi? — Do you get up late?" />
        <RuleRow label="si" rule="themselves (loro)" example="Si svegliano presto. — They wake up early." />
      </GrammarCard>
      <GrammarCard title="Common Reflexive Verbs">
        <RuleRow label="alzarsi" rule="to get up" example="Mi alzo alle sei." />
        <RuleRow label="vestirsi" rule="to get dressed" example="Si veste in fretta." />
        <RuleRow label="sedersi" rule="to sit down" example="Siediti! — Sit down!" />
        <RuleRow label="sentirsi" rule="to feel" example="Mi sento stanco." />
        <RuleRow label="chiamarsi" rule="to be named" example="Mi chiamo Lucia." />
        <RuleRow label="divertirsi" rule="to have fun" example="Ci divertiamo molto!" />
      </GrammarCard>
    </div>
  );
}

// ─── PASSATO PROSSIMO ─────────────────────────────────────────────────────────

export function ItPassatoProssimoCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Passato Prossimo — Formula"
        subtitle="avere / essere + participio passato">
        <RuleRow label="With avere" rule="ho / hai / ha / abbiamo / avete / hanno + pp" example="Ho mangiato. — I ate / I have eaten." />
        <RuleRow label="With essere" rule="sono / sei / è / siamo / siete / sono + pp*" example="Sono andato/a. — I went. (*agrees in gender)" />
        <RuleRow label="-are → -ato" rule="parlare → parlato" example="Ho parlato con lei." />
        <RuleRow label="-ere → -uto" rule="vedere → visto (irreg.)" example="Ho visto il film." />
        <RuleRow label="-ire → -ito" rule="partire → partito" example="È partito ieri." />
        <RuleRow label="Agreement" rule="with essere only" example="Siamo usciti/e. — We went out." />
      </GrammarCard>
      <GrammarCard title="Essere vs Avere as Auxiliary">
        <RuleRow label="ESSERE verbs" rule="motion, change of state, reflexives" example="andare, venire, arrivare, partire, nascere, morire, restare, essere, diventare" />
        <RuleRow label="AVERE verbs" rule="transitive + most others" example="mangiare, bere, vedere, leggere, capire, fare" />
        <RuleRow label="Tip: ADVENT" rule="Arrive, Depart, Visit, Enter, Navigate, Turn" example="Common 'essere' categories" />
      </GrammarCard>
      <GrammarCard title="Common Irregular Participi Passati">
        <RuleRow label="fare" rule="fatto" example="Ho fatto i compiti." />
        <RuleRow label="dire" rule="detto" example="Hai detto la verità?" />
        <RuleRow label="scrivere" rule="scritto" example="Ho scritto una lettera." />
        <RuleRow label="leggere" rule="letto" example="Hai letto il libro?" />
        <RuleRow label="aprire" rule="aperto" example="Ho aperto la finestra." />
        <RuleRow label="mettere" rule="messo" example="Ho messo le chiavi qui." />
      </GrammarCard>
    </div>
  );
}

// ─── IMPERFETTO ───────────────────────────────────────────────────────────────

export function ItImperfettoCard() {
  const parlare: VerbTableData = {
    verb: 'parlare', tense: 'Imperfetto', englishTense: 'used to speak / was speaking',
    rows: [
      { pronoun: 'io', form: 'parlavo', stemEnd: 4 },
      { pronoun: 'tu', form: 'parlavi', stemEnd: 4 },
      { pronoun: 'lui / lei', form: 'parlava', stemEnd: 4 },
      { pronoun: 'noi', form: 'parlavamo', stemEnd: 4 },
      { pronoun: 'voi', form: 'parlavate', stemEnd: 4 },
      { pronoun: 'loro', form: 'parlavano', stemEnd: 4 },
    ],
    note: '-ere verbs: vedevo, vedevi... / -ire verbs: partivo, partivi... Essere is irregular: ero, eri, era, eravamo, eravate, erano.',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={parlare} />
      <GrammarCard title="Imperfetto — When to Use">
        <RuleRow label="Habitual past" rule="repeated/routine actions" example="Da bambino giocavo sempre fuori. — As a child I always played outside." />
        <RuleRow label="Ongoing past" rule="background action in progress" example="Mentre mangiavo, suonò il telefono. — While I was eating, the phone rang." />
        <RuleRow label="States / feelings" rule="emotions, conditions, time, weather" example="Era tardi. Faceva freddo. Mi sentivo stanco." />
        <RuleRow label="Age in the past" rule="Avevo dieci anni." example="I was ten years old." />
        <RuleRow label="Descriptions" rule="physical/emotional descriptions" example="La casa era grande e bellissima." />
      </GrammarCard>
    </div>
  );
}

// ─── PASSATO PROSSIMO vs IMPERFETTO ───────────────────────────────────────────

export function ItPastComparisonCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Passato Prossimo vs Imperfetto"
        subtitle="The most important distinction in Italian past tenses">
        <RuleRow label="Passato Prossimo" rule="completed actions — specific time" example="Ieri ho mangiato la pizza. (I ate pizza yesterday.)" />
        <RuleRow label="Imperfetto" rule="ongoing/habitual — background" example="Ogni venerdì mangiavo la pizza. (I used to eat pizza every Friday.)" />
        <RuleRow label="Together" rule="imperfetto = background; PP = foreground" example="Mentre dormivo (imp), è arrivato (PP). — While I was sleeping, he arrived." />
        <RuleRow label="Emotions/states" rule="almost always imperfetto" example="Avevo paura. Era buio. — I was afraid. It was dark." />
        <RuleRow label="Sudden events" rule="almost always passato prossimo" example="È caduto! — He fell!" />
        <RuleRow label="Key triggers PP" rule="ieri, una volta, improvvisamente" example="yesterday, once, suddenly" />
        <RuleRow label="Key triggers Imp" rule="sempre, spesso, di solito, ogni giorno" example="always, often, usually, every day" />
      </GrammarCard>
    </div>
  );
}

// ─── FUTURO SEMPLICE ──────────────────────────────────────────────────────────

export function ItFuturoCard() {
  const parlare: VerbTableData = {
    verb: 'parlare', tense: 'Futuro Semplice', englishTense: 'will speak',
    rows: [
      { pronoun: 'io', form: 'parlerò', stemEnd: 5 },
      { pronoun: 'tu', form: 'parlerai', stemEnd: 5 },
      { pronoun: 'lui / lei', form: 'parlerà', stemEnd: 5 },
      { pronoun: 'noi', form: 'parleremo', stemEnd: 5 },
      { pronoun: 'voi', form: 'parlerete', stemEnd: 5 },
      { pronoun: 'loro', form: 'parleranno', stemEnd: 5 },
    ],
    note: '-ere/-ire verbs drop final -e: vedere → vedrò / partire → partirò. Essere: sarò, sarai, sarà... Avere: avrò, avrai, avrà...',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={parlare} />
      <GrammarCard title="Futuro — Uses & Irregular Stems">
        <RuleRow label="Future plans" rule="Domani andrò a Roma." example="Tomorrow I will go to Rome." />
        <RuleRow label="Probability / wonder" rule="Sarà vero? / Avrà trent'anni." example="Can it be true? / He's probably thirty." />
        <RuleRow label="essere → sar-" rule="sarò, sarai, sarà..." example="Non ci sarà nessuno." />
        <RuleRow label="avere → avr-" rule="avrò, avrai, avrà..." example="Avrai tempo?" />
        <RuleRow label="andare → andr-" rule="andrò, andrai, andrà..." example="Andremo in vacanza." />
        <RuleRow label="fare → far-" rule="farò, farai, farà..." example="Che tempo farà?" />
      </GrammarCard>
    </div>
  );
}

// ─── CONDIZIONALE ─────────────────────────────────────────────────────────────

export function ItCondizionaleCard() {
  const volere: VerbTableData = {
    verb: 'volere', tense: 'Condizionale Presente', englishTense: 'would want',
    rows: [
      { pronoun: 'io', form: 'vorrei' },
      { pronoun: 'tu', form: 'vorresti' },
      { pronoun: 'lui / lei', form: 'vorrebbe' },
      { pronoun: 'noi', form: 'vorremmo' },
      { pronoun: 'voi', form: 'vorreste' },
      { pronoun: 'loro', form: 'vorrebbero' },
    ],
    note: 'Pattern: futuro stem + endings -ei, -esti, -ebbe, -emmo, -este, -ebbero. Vorrei = polite "I would like."',
  };
  return (
    <div className="space-y-3">
      <VerbConjugationTable data={volere} />
      <GrammarCard title="Condizionale — Endings & Key Uses">
        <RuleRow label="Endings" rule="-ei, -esti, -ebbe, -emmo, -este, -ebbero" example="parlerei, parleresti, parlerebbe..." />
        <RuleRow label="Polite requests" rule="Vorrei un caffè." example="I would like a coffee." />
        <RuleRow label="Wishes" rule="Mi piacerebbe andare." example="I would like to go." />
        <RuleRow label="Hypothetical" rule="Sarebbe bello!" example="That would be nice!" />
        <RuleRow label="Advice" rule="Dovresti studiare." example="You should study." />
        <RuleRow label="potere → potr-" rule="potrei, potresti, potrebbe..." example="Potresti aiutarmi?" />
      </GrammarCard>
    </div>
  );
}

// ─── NEGATION ─────────────────────────────────────────────────────────────────

export function ItNegationCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Italian Negation — NON + verb"
        subtitle="Non always goes immediately before the conjugated verb">
        <RuleRow label="Simple negation" rule="Non + verb" example="Non parlo italiano. — I don't speak Italian." />
        <RuleRow label="With object" rule="Non + verb + obj" example="Non capisco niente. — I don't understand anything." />
        <RuleRow label="Non…mai" rule="never" example="Non vado mai al mercato." />
        <RuleRow label="Non…ancora" rule="not yet" example="Non ho ancora mangiato." />
        <RuleRow label="Non…più" rule="no longer / not anymore" example="Non abito più a Milano." />
        <RuleRow label="Non…niente/nulla" rule="nothing" example="Non ho capito niente." />
        <RuleRow label="Non…nessuno" rule="nobody" example="Non c'è nessuno." />
        <RuleRow label="Non…né…né" rule="neither…nor" example="Non mangio né carne né pesce." />
      </GrammarCard>
      <GrammarCard title="Double Negatives (Normal in Italian!)">
        <RuleRow label="Key rule" rule="Italian uses double negatives regularly" example="Non vedo nessuno. — I don't see anyone. (lit. I don't see nobody.)" />
        <RuleRow label="Nessuno solo" rule="nessuno alone before verb = single neg." example="Nessuno parla. — Nobody speaks." />
        <RuleRow label="Mai alone" rule="Mai at start = emphatic negative" example="Mai dire mai! — Never say never!" />
      </GrammarCard>
    </div>
  );
}

// ─── DEFINITE ARTICLES ────────────────────────────────────────────────────────

export function ItDefiniteArticlesCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Articoli Determinativi — Definite Articles"
        subtitle="Seven forms: il, lo, la, l', i, gli, le">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left border border-border/50">Gender / Number</th>
                <th className="px-3 py-2 text-center border border-border/50">Before consonant</th>
                <th className="px-3 py-2 text-center border border-border/50">Before s+cons, z, gn, ps, x, y</th>
                <th className="px-3 py-2 text-center border border-border/50">Before vowel</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-1.5 border border-border/50 font-medium">Maschile Singolare</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">il</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">lo</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">l'</td>
              </tr>
              <tr className="bg-muted/30">
                <td className="px-3 py-1.5 border border-border/50 font-medium">Maschile Plurale</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">i</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">gli</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">gli</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 border border-border/50 font-medium">Femminile Singolare</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">la</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">la</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">l'</td>
              </tr>
              <tr className="bg-muted/30">
                <td className="px-3 py-1.5 border border-border/50 font-medium">Femminile Plurale</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">le</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">le</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">le</td>
              </tr>
            </tbody>
          </table>
        </div>
        <RuleRow label="il libro" rule="the book (m. sing.)" example="→ i libri (the books)" />
        <RuleRow label="lo zaino" rule="the backpack (m. sing.)" example="→ gli zaini (the backpacks)" />
        <RuleRow label="l'amico" rule="the friend (m. sing.)" example="→ gli amici (the friends)" />
        <RuleRow label="la casa" rule="the house (f. sing.)" example="→ le case (the houses)" />
        <RuleRow label="l'amica" rule="the (female) friend" example="→ le amiche (the friends)" />
      </GrammarCard>
    </div>
  );
}

// ─── INDEFINITE ARTICLES ──────────────────────────────────────────────────────

export function ItIndefiniteArticlesCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Articoli Indeterminativi — Indefinite Articles"
        subtitle="Four forms: un, uno, una, un'">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left border border-border/50">Gender</th>
                <th className="px-3 py-2 text-center border border-border/50">Before consonant</th>
                <th className="px-3 py-2 text-center border border-border/50">Before s+cons, z, gn, ps…</th>
                <th className="px-3 py-2 text-center border border-border/50">Before vowel</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-1.5 border border-border/50 font-medium">Maschile</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">un</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">uno</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">un</td>
              </tr>
              <tr className="bg-muted/30">
                <td className="px-3 py-1.5 border border-border/50 font-medium">Femminile</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">una</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">una</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">un'</td>
              </tr>
            </tbody>
          </table>
        </div>
        <RuleRow label="un libro" rule="a book (m.)" example="un amico — a (male) friend" />
        <RuleRow label="uno zaino" rule="a backpack (m. before z)" example="uno studente — a student" />
        <RuleRow label="una casa" rule="a house (f.)" example="una porta — a door" />
        <RuleRow label="un'amica" rule="a (female) friend (f. before vowel)" example="un'ora — an hour" />
        <RuleRow label="Plural: no article" rule="Use partitive or omit" example="Voglio delle mele. / Voglio mele." />
      </GrammarCard>
    </div>
  );
}

// ─── ADJECTIVE AGREEMENT ──────────────────────────────────────────────────────

export function ItAdjAgreementCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Accordo degli Aggettivi — Adjective Agreement"
        subtitle="Adjectives agree in gender and number with the noun they modify">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left border border-border/50">Type</th>
                <th className="px-3 py-2 text-center border border-border/50">M. Sing.</th>
                <th className="px-3 py-2 text-center border border-border/50">F. Sing.</th>
                <th className="px-3 py-2 text-center border border-border/50">M. Plur.</th>
                <th className="px-3 py-2 text-center border border-border/50">F. Plur.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-1.5 border border-border/50 font-medium">-o/-a type</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">-o</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">-a</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">-i</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">-e</td>
              </tr>
              <tr className="bg-muted/30">
                <td className="px-3 py-1.5 border border-border/50 font-medium">-e type</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">-e</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">-e</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">-i</td>
                <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">-i</td>
              </tr>
            </tbody>
          </table>
        </div>
        <RuleRow label="bello/bella" rule="-o/-a type" example="un bel libro / una bella casa / bei libri / belle case" />
        <RuleRow label="grande" rule="-e type (same m/f)" example="un grande uomo / una grande donna / grandi uomini" />
        <RuleRow label="Position" rule="usually AFTER noun" example="un libro interessante, una ragazza simpatica" />
        <RuleRow label="Exceptions" rule="bello, brutto, buono, nuovo, piccolo, vecchio, caro, grande often go before noun" example="un bel ragazzo, un buon amico" />
        <RuleRow label="Bello forms" rule="like definite article!" example="bel/bello/bella/bell'/bei/begli/belle" />
      </GrammarCard>
    </div>
  );
}

// ─── ARTICULATED PREPOSITIONS ─────────────────────────────────────────────────

export function ItArticulatedPrepCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Preposizioni Articolate — Preposition + Article Contractions"
        subtitle="di, a, da, in, su always contract with definite articles">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-center border border-border/50">Prep.</th>
                <th className="px-3 py-2 text-center border border-border/50">+il</th>
                <th className="px-3 py-2 text-center border border-border/50">+lo</th>
                <th className="px-3 py-2 text-center border border-border/50">+la</th>
                <th className="px-3 py-2 text-center border border-border/50">+l'</th>
                <th className="px-3 py-2 text-center border border-border/50">+i</th>
                <th className="px-3 py-2 text-center border border-border/50">+gli</th>
                <th className="px-3 py-2 text-center border border-border/50">+le</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['di', 'del', 'dello', 'della', "dell'", 'dei', 'degli', 'delle'],
                ['a', 'al', 'allo', 'alla', "all'", 'ai', 'agli', 'alle'],
                ['da', 'dal', 'dallo', 'dalla', "dall'", 'dai', 'dagli', 'dalle'],
                ['in', 'nel', 'nello', 'nella', "nell'", 'nei', 'negli', 'nelle'],
                ['su', 'sul', 'sullo', 'sulla', "sull'", 'sui', 'sugli', 'sulle'],
              ].map(([prep, ...forms], i) => (
                <tr key={prep} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                  <td className="px-3 py-1.5 border border-border/50 text-center font-bold text-green-700 dark:text-green-400">{prep}</td>
                  {forms.map((f, j) => (
                    <td key={j} className="px-3 py-1.5 border border-border/50 text-center text-xs">{f}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RuleRow label="di + il = del" rule="Parlo del film." example="I'm talking about the movie." />
        <RuleRow label="a + la = alla" rule="Vado alla scuola." example="I'm going to school." />
        <RuleRow label="su + i = sui" rule="Il libro è sui libri." example="The book is on the books." />
        <RuleRow label="con, per, tra, fra" rule="DO NOT contract" example="con il ragazzo (NOT col — archaic)" />
      </GrammarCard>
    </div>
  );
}

// ─── OBJECT PRONOUNS ──────────────────────────────────────────────────────────

export function ItObjectPronounsCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Pronomi Oggetto — Object Pronouns"
        subtitle="Direct (lo, la, li, le) and indirect (gli, le, loro) pronouns">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left border border-border/50">Person</th>
                <th className="px-3 py-2 text-center border border-border/50">Direct</th>
                <th className="px-3 py-2 text-center border border-border/50">Indirect</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['io', 'mi (me)', 'mi (to me)'],
                ['tu', 'ti (you)', 'ti (to you)'],
                ['lui', 'lo (him / it m.)', 'gli (to him)'],
                ['lei', 'la (her / it f.)', 'le (to her)'],
                ['Lei (formal)', 'La', 'Le'],
                ['noi', 'ci (us)', 'ci (to us)'],
                ['voi', 'vi (you pl.)', 'vi (to you pl.)'],
                ['loro', 'li/le (them m/f)', 'gli / loro (to them)'],
              ].map(([person, direct, indirect], i) => (
                <tr key={person} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                  <td className="px-3 py-1.5 border border-border/50 font-medium text-muted-foreground">{person}</td>
                  <td className="px-3 py-1.5 border border-border/50 text-center font-semibold text-green-700 dark:text-green-400">{direct}</td>
                  <td className="px-3 py-1.5 border border-border/50 text-center font-semibold">{indirect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RuleRow label="Position" rule="BEFORE conjugated verb" example="Lo mangio. — I eat it. / Gli scrivo. — I write to him." />
        <RuleRow label="With infinitive" rule="attach to end of infinitive (drop -e)" example="Voglio vederlo. — I want to see it." />
        <RuleRow label="Agreement" rule="direct obj. pronoun agrees with pp in passato prossimo" example="La ho vista. → L'ho vista. — I saw her." />
      </GrammarCard>
    </div>
  );
}

// ─── SUBJECT PRONOUNS ─────────────────────────────────────────────────────────

export function ItSubjectPronounsCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Pronomi Soggetto — Subject Pronouns"
        subtitle="Italian is a pro-drop language — subject pronouns are usually omitted">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left border border-border/50">Person</th>
                <th className="px-3 py-2 text-center border border-border/50">Singular</th>
                <th className="px-3 py-2 text-center border border-border/50">Plural</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1st', 'io (I)', 'noi (we)'],
                ['2nd', 'tu (you, informal)', 'voi (you all)'],
                ['3rd m.', 'lui (he) / esso (it m.)', 'loro (they)'],
                ['3rd f.', 'lei (she) / essa (it f.)', 'loro (they)'],
                ['Formal', 'Lei (you formal)', 'Loro (you formal pl.)'],
              ].map(([p, sing, plur], i) => (
                <tr key={p} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                  <td className="px-3 py-1.5 border border-border/50 font-medium text-muted-foreground">{p}</td>
                  <td className="px-3 py-1.5 border border-border/50 text-center font-semibold text-green-700 dark:text-green-400">{sing}</td>
                  <td className="px-3 py-1.5 border border-border/50 text-center font-semibold">{plur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RuleRow label="Pro-drop rule" rule="Subject pronouns usually omitted" example="(Io) parlo italiano. — (I) speak Italian." />
        <RuleRow label="Used for emphasis" rule="Stress or contrast" example="Lo so IO, non tu! — I know it, not you!" />
        <RuleRow label="Lei (capital)" rule="Formal 'you' — uses 3rd person" example="Lei parla italiano, signor Rossi?" />
        <RuleRow label="lui / lei" rule="him/her as well as he/she" example="Context determines meaning" />
      </GrammarCard>
    </div>
  );
}

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

export function ItQuestionsCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Formare le Domande — Forming Questions"
        subtitle="Italian forms questions mostly through intonation — no mandatory inversion">
        <RuleRow label="Intonation (most common)" rule="Same word order as statement, rising tone" example="Parli italiano? — Do you speak Italian?" />
        <RuleRow label="Tag question" rule="…vero? / …no? / …giusto?" example="È bello, vero? — It's nice, isn't it?" />
        <RuleRow label="Inversion (formal)" rule="Verb before subject" example="Parla Lei italiano? — Do you speak Italian? (formal)" />
      </GrammarCard>
      <GrammarCard title="Question Words — Parole Interrogative">
        <RuleRow label="Chi?" rule="Who?" example="Chi sei? — Who are you?" />
        <RuleRow label="Che cosa? / Cosa? / Che?" rule="What?" example="Cosa fai? — What are you doing?" />
        <RuleRow label="Quando?" rule="When?" example="Quando arrivi? — When do you arrive?" />
        <RuleRow label="Dove?" rule="Where?" example="Dove abiti? — Where do you live?" />
        <RuleRow label="Come?" rule="How?" example="Come stai? — How are you?" />
        <RuleRow label="Perché?" rule="Why? / Because" example="Perché studi? — Why do you study?" />
        <RuleRow label="Quanto/a/i/e?" rule="How much/many?" example="Quanto costa? — How much does it cost?" />
        <RuleRow label="Quale/i?" rule="Which?" example="Quale preferisci? — Which do you prefer?" />
      </GrammarCard>
    </div>
  );
}

// ─── PARTITIVE ARTICLES ───────────────────────────────────────────────────────

export function ItPartitiveCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Articolo Partitivo — Partitive Articles"
        subtitle="Express 'some' / 'any' — formed from di + definite article">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left border border-border/50">Partitive</th>
                <th className="px-3 py-2 text-center border border-border/50">Used before</th>
                <th className="px-3 py-2 text-left border border-border/50">Example</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['del', 'm. sing. (consonant)', 'del pane — some bread'],
                ['dello', 'm. sing. (s+cons, z, gn…)', 'dello zucchero — some sugar'],
                ["dell'", 'm. or f. sing. (vowel)', "dell'acqua — some water"],
                ['della', 'f. sing. (consonant)', 'della pasta — some pasta'],
                ['dei', 'm. plur. (consonant)', 'dei libri — some books'],
                ['degli', 'm. plur. (s+cons, vowel)', 'degli studenti — some students'],
                ['delle', 'f. plur.', 'delle mele — some apples'],
              ].map(([form, when, ex], i) => (
                <tr key={form} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                  <td className="px-3 py-1.5 border border-border/50 font-bold text-green-700 dark:text-green-400">{form}</td>
                  <td className="px-3 py-1.5 border border-border/50 text-muted-foreground">{when}</td>
                  <td className="px-3 py-1.5 border border-border/50">{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RuleRow label="Omit in negative" rule="Non ho pane. (not 'del pane')" example="I don't have (any) bread." />
        <RuleRow label="Qualche + sing." rule="means 'some / a few'" example="Ho qualche libro. — I have some books." />
        <RuleRow label="Alcuni/e" rule="plural 'some'" example="Alcune ragazze sono qui. — Some girls are here." />
      </GrammarCard>
    </div>
  );
}

// ─── IMPERATIVE ───────────────────────────────────────────────────────────────

export function ItImperativeCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="L'Imperativo — Commands"
        subtitle="Used to give orders, instructions, and invitations">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left border border-border/50">Person</th>
                <th className="px-3 py-2 text-center border border-border/50">-are (parlare)</th>
                <th className="px-3 py-2 text-center border border-border/50">-ere (vedere)</th>
                <th className="px-3 py-2 text-center border border-border/50">-ire (partire)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['tu', 'parla!', 'vedi!', 'parti!'],
                ['Lei (formal)', 'parli!', 'veda!', 'parta!'],
                ['noi', 'parliamo!', 'vediamo!', 'partiamo!'],
                ['voi', 'parlate!', 'vedete!', 'partite!'],
              ].map(([p, a, e, i], idx) => (
                <tr key={p} className={idx % 2 === 0 ? '' : 'bg-muted/30'}>
                  <td className="px-3 py-1.5 border border-border/50 font-medium text-muted-foreground">{p}</td>
                  <td className="px-3 py-1.5 border border-border/50 text-center font-semibold text-green-700 dark:text-green-400">{a}</td>
                  <td className="px-3 py-1.5 border border-border/50 text-center font-semibold text-green-700 dark:text-green-400">{e}</td>
                  <td className="px-3 py-1.5 border border-border/50 text-center font-semibold text-green-700 dark:text-green-400">{i}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RuleRow label="Tu -are note" rule="-are verbs use -a (NOT -i) for tu!" example="Parla! — Speak! (not Parli!)" />
        <RuleRow label="Negation (tu)" rule="non + infinitive" example="Non parlare! — Don't speak!" />
        <RuleRow label="Reflexive attach" rule="pronouns attach to end" example="Siediti! — Sit down! / Alzatevi! — Stand up!" />
        <RuleRow label="Irregular: essere" rule="sii / sia / siamo / siate" example="Sii gentile! — Be kind!" />
        <RuleRow label="Irregular: avere" rule="abbi / abbia / abbiamo / abbiate" example="Abbi pazienza! — Be patient!" />
      </GrammarCard>
    </div>
  );
}

// ─── COMPARATIVES & SUPERLATIVES ──────────────────────────────────────────────

export function ItComparativesCard() {
  return (
    <div className="space-y-3">
      <GrammarCard title="Comparativi e Superlativi — Comparing Things"
        subtitle="più/meno…di/che for comparisons; -issimo or il più for superlatives">
        <RuleRow label="più + adj + di" rule="more than (different subjects)" example="Mario è più alto di Luca. — Mario is taller than Luca." />
        <RuleRow label="più + adj + che" rule="more than (same subject / two elements)" example="È più simpatico che intelligente." />
        <RuleRow label="meno + adj + di/che" rule="less than" example="L'italiano è meno difficile del russo." />
        <RuleRow label="tanto…quanto" rule="as…as (adj/adv)" example="È tanto bella quanto intelligente." />
        <RuleRow label="così…come" rule="as…as (alternative)" example="È così alto come me." />
      </GrammarCard>
      <GrammarCard title="Superlatives">
        <RuleRow label="Relative superlative" rule="il/la/i/le più + adj" example="È il più bello. — He's the most handsome." />
        <RuleRow label="Absolute superlative" rule="adj + -issimo/a/i/e" example="bellissimo, bravissima, buonissimo" />
        <RuleRow label="molto / tanto" rule="alternative to -issimo" example="È molto bravo. = È bravissimo." />
      </GrammarCard>
      <GrammarCard title="Irregular Comparatives">
        <RuleRow label="buono" rule="migliore / ottimo" example="Il vino italiano è migliore. / È un vino ottimo." />
        <RuleRow label="cattivo" rule="peggiore / pessimo" example="È peggiore di prima. / Un tempo pessimo." />
        <RuleRow label="grande" rule="maggiore / massimo" example="Il maggior problema è… / Il massimo rispetto." />
        <RuleRow label="piccolo" rule="minore / minimo" example="Il minor sforzo. / Al minimo costo." />
      </GrammarCard>
    </div>
  );
}
