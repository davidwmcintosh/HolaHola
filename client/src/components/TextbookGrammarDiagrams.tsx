/**
 * TextbookGrammarDiagrams.tsx
 * Static grammar reference cards for the textbook view.
 * Auto-triggered by chapter title via classifyGrammarType() in ChapterIntroduction.tsx.
 *
 * Sections:
 *  A. Reusable VerbConjugationTable + data constants
 *  B. Individual verb/tense cards (AR, ER, IR, SER, ESTAR, TENER, IR, stem-change, -go, preterite, imperfect, future, conditional, subjunctive, commands)
 *  C. Comparison/decision cards (gender+articles, adjective agreement, object pronouns, negation, questions, tú/usted, saber/conocer, reflexives)
 *  D. Section 4 — Preposition maps (spatial SVG room, temporal timeline)
 */

import { TextAudioPlayButton } from "@/components/AudioPlayButton";

// ─── A. REUSABLE BASE ────────────────────────────────────────────────────────

interface ConjRow {
  pronoun: string;
  form: string;
  stemEnd?: number;
}

interface VerbTableData {
  verb: string;
  tense: string;
  englishTense: string;
  rows: ConjRow[];
  stemChange?: string;
  accent?: string;
  note?: string;
  accentColor?: string;
}

function splitForm(form: string, stemEnd?: number): [string, string] {
  if (stemEnd === undefined) return ['', form];
  return [form.slice(0, stemEnd), form.slice(stemEnd)];
}

function VerbConjugationTable({ data, compact = false, language = 'spanish' }: { data: VerbTableData; compact?: boolean; language?: string }) {
  const accent = data.accentColor ?? 'text-indigo-600 dark:text-indigo-400';
  const endingColor = 'text-blue-600 dark:text-blue-400';
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-gradient-to-r from-indigo-500/10 to-transparent flex items-baseline justify-between gap-2 flex-wrap">
        <span className={`font-bold text-sm ${accent}`}>{data.verb.toUpperCase()}</span>
        <span className="text-xs text-muted-foreground">{data.tense} — {data.englishTense}</span>
        {data.stemChange && (
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 ml-auto">{data.stemChange}</span>
        )}
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
                      {ending && <span className={endingColor}>{ending}</span>}
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

function TwoTableCard({ left, right, title, subtitle, headerColor = 'from-indigo-500/10' }: {
  left: VerbTableData; right: VerbTableData; title: string; subtitle?: string; headerColor?: string;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid={`grammar-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={`px-4 py-2.5 border-b bg-gradient-to-r ${headerColor} to-transparent`}>
        <p className="text-sm font-semibold text-center">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground text-center">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 divide-x">
        <VerbConjugationTable data={left} compact />
        <VerbConjugationTable data={right} compact />
      </div>
    </div>
  );
}

// ─── B. VERB DATA ─────────────────────────────────────────────────────────────

const HABLAR: VerbTableData = {
  verb: 'hablar', tense: 'Presente', englishTense: 'present — to speak',
  note: 'All regular -AR verbs follow this pattern: drop -ar, add these endings.',
  rows: [
    { pronoun: 'yo', form: 'hablo', stemEnd: 4 },
    { pronoun: 'tú', form: 'hablas', stemEnd: 4 },
    { pronoun: 'él / ella / Ud.', form: 'habla', stemEnd: 4 },
    { pronoun: 'nosotros/as', form: 'hablamos', stemEnd: 4 },
    { pronoun: 'vosotros/as', form: 'habláis', stemEnd: 4 },
    { pronoun: 'ellos / Uds.', form: 'hablan', stemEnd: 4 },
  ],
};

const COMER: VerbTableData = {
  verb: 'comer', tense: 'Presente', englishTense: 'present — to eat',
  note: 'All regular -ER verbs follow this pattern: drop -er, add these endings.',
  rows: [
    { pronoun: 'yo', form: 'como', stemEnd: 3 },
    { pronoun: 'tú', form: 'comes', stemEnd: 3 },
    { pronoun: 'él / ella / Ud.', form: 'come', stemEnd: 3 },
    { pronoun: 'nosotros/as', form: 'comemos', stemEnd: 3 },
    { pronoun: 'vosotros/as', form: 'coméis', stemEnd: 3 },
    { pronoun: 'ellos / Uds.', form: 'comen', stemEnd: 3 },
  ],
};

const VIVIR: VerbTableData = {
  verb: 'vivir', tense: 'Presente', englishTense: 'present — to live',
  note: 'All regular -IR verbs follow this pattern: drop -ir, add these endings.',
  rows: [
    { pronoun: 'yo', form: 'vivo', stemEnd: 3 },
    { pronoun: 'tú', form: 'vives', stemEnd: 3 },
    { pronoun: 'él / ella / Ud.', form: 'vive', stemEnd: 3 },
    { pronoun: 'nosotros/as', form: 'vivimos', stemEnd: 3 },
    { pronoun: 'vosotros/as', form: 'vivís', stemEnd: 3 },
    { pronoun: 'ellos / Uds.', form: 'viven', stemEnd: 3 },
  ],
};

const SER_PRES: VerbTableData = {
  verb: 'ser', tense: 'Presente', englishTense: 'to be (permanent)',
  accentColor: 'text-blue-600 dark:text-blue-400',
  note: 'SER = identity, origin, profession, time, material, personality.',
  rows: [
    { pronoun: 'yo', form: 'soy' },
    { pronoun: 'tú', form: 'eres' },
    { pronoun: 'él / ella / Ud.', form: 'es' },
    { pronoun: 'nosotros/as', form: 'somos' },
    { pronoun: 'vosotros/as', form: 'sois' },
    { pronoun: 'ellos / Uds.', form: 'son' },
  ],
};

const ESTAR_PRES: VerbTableData = {
  verb: 'estar', tense: 'Presente', englishTense: 'to be (state/location)',
  accentColor: 'text-amber-600 dark:text-amber-400',
  note: 'ESTAR = location, health, emotion, condition, in-progress actions.',
  rows: [
    { pronoun: 'yo', form: 'estoy' },
    { pronoun: 'tú', form: 'estás' },
    { pronoun: 'él / ella / Ud.', form: 'está' },
    { pronoun: 'nosotros/as', form: 'estamos' },
    { pronoun: 'vosotros/as', form: 'estáis' },
    { pronoun: 'ellos / Uds.', form: 'están' },
  ],
};

const TENER_PRES: VerbTableData = {
  verb: 'tener', tense: 'Presente', englishTense: 'to have',
  stemChange: 'yo: tengo (–go)',
  note: 'Uses tener + que + infinitive to express obligation: Tengo que estudiar.',
  rows: [
    { pronoun: 'yo', form: 'tengo' },
    { pronoun: 'tú', form: 'tienes', stemEnd: 3 },
    { pronoun: 'él / ella / Ud.', form: 'tiene', stemEnd: 3 },
    { pronoun: 'nosotros/as', form: 'tenemos', stemEnd: 3 },
    { pronoun: 'vosotros/as', form: 'tenéis', stemEnd: 3 },
    { pronoun: 'ellos / Uds.', form: 'tienen', stemEnd: 3 },
  ],
};

const IR_PRES: VerbTableData = {
  verb: 'ir', tense: 'Presente', englishTense: 'to go',
  note: 'IR + a + infinitive = future plans: Voy a estudiar (I\'m going to study).',
  rows: [
    { pronoun: 'yo', form: 'voy' },
    { pronoun: 'tú', form: 'vas' },
    { pronoun: 'él / ella / Ud.', form: 'va' },
    { pronoun: 'nosotros/as', form: 'vamos' },
    { pronoun: 'vosotros/as', form: 'vais' },
    { pronoun: 'ellos / Uds.', form: 'van' },
  ],
};

const PODER_PRES: VerbTableData = {
  verb: 'poder', tense: 'Presente', englishTense: 'to be able to / can',
  stemChange: 'o → ue (boot verb)',
  accentColor: 'text-amber-600 dark:text-amber-400',
  rows: [
    { pronoun: 'yo', form: 'puedo' },
    { pronoun: 'tú', form: 'puedes' },
    { pronoun: 'él / ella / Ud.', form: 'puede' },
    { pronoun: 'nosotros/as', form: 'podemos' },
    { pronoun: 'vosotros/as', form: 'podéis' },
    { pronoun: 'ellos / Uds.', form: 'pueden' },
  ],
};

const QUERER_PRES: VerbTableData = {
  verb: 'querer', tense: 'Presente', englishTense: 'to want',
  stemChange: 'e → ie (boot verb)',
  accentColor: 'text-amber-600 dark:text-amber-400',
  rows: [
    { pronoun: 'yo', form: 'quiero' },
    { pronoun: 'tú', form: 'quieres' },
    { pronoun: 'él / ella / Ud.', form: 'quiere' },
    { pronoun: 'nosotros/as', form: 'queremos' },
    { pronoun: 'vosotros/as', form: 'queréis' },
    { pronoun: 'ellos / Uds.', form: 'quieren' },
  ],
};

const HACER_PRES: VerbTableData = {
  verb: 'hacer', tense: 'Presente', englishTense: 'to do / to make',
  stemChange: 'yo: hago (–go)',
  note: 'Other –go verbs: poner → pongo, traer → traigo, salir → salgo, venir → vengo.',
  rows: [
    { pronoun: 'yo', form: 'hago' },
    { pronoun: 'tú', form: 'haces', stemEnd: 3 },
    { pronoun: 'él / ella / Ud.', form: 'hace', stemEnd: 3 },
    { pronoun: 'nosotros/as', form: 'hacemos', stemEnd: 3 },
    { pronoun: 'vosotros/as', form: 'hacéis', stemEnd: 3 },
    { pronoun: 'ellos / Uds.', form: 'hacen', stemEnd: 3 },
  ],
};

const PRETERITE_HABLAR: VerbTableData = {
  verb: 'hablar', tense: 'Pretérito', englishTense: '-AR preterite',
  accentColor: 'text-purple-600 dark:text-purple-400',
  rows: [
    { pronoun: 'yo', form: 'hablé', stemEnd: 4 },
    { pronoun: 'tú', form: 'hablaste', stemEnd: 4 },
    { pronoun: 'él / ella / Ud.', form: 'habló', stemEnd: 4 },
    { pronoun: 'nosotros/as', form: 'hablamos', stemEnd: 4 },
    { pronoun: 'vosotros/as', form: 'hablasteis', stemEnd: 4 },
    { pronoun: 'ellos / Uds.', form: 'hablaron', stemEnd: 4 },
  ],
};

const PRETERITE_COMER: VerbTableData = {
  verb: 'comer / vivir', tense: 'Pretérito', englishTense: '-ER/-IR preterite',
  accentColor: 'text-purple-600 dark:text-purple-400',
  rows: [
    { pronoun: 'yo', form: 'comí', stemEnd: 3 },
    { pronoun: 'tú', form: 'comiste', stemEnd: 3 },
    { pronoun: 'él / ella / Ud.', form: 'comió', stemEnd: 3 },
    { pronoun: 'nosotros/as', form: 'comimos', stemEnd: 3 },
    { pronoun: 'vosotros/as', form: 'comisteis', stemEnd: 3 },
    { pronoun: 'ellos / Uds.', form: 'comieron', stemEnd: 3 },
  ],
};

const IMPERFECT_HABLAR: VerbTableData = {
  verb: 'hablar', tense: 'Imperfecto', englishTense: '-AR imperfect',
  accentColor: 'text-teal-600 dark:text-teal-400',
  rows: [
    { pronoun: 'yo', form: 'hablaba', stemEnd: 4 },
    { pronoun: 'tú', form: 'hablabas', stemEnd: 4 },
    { pronoun: 'él / ella / Ud.', form: 'hablaba', stemEnd: 4 },
    { pronoun: 'nosotros/as', form: 'hablábamos', stemEnd: 4 },
    { pronoun: 'vosotros/as', form: 'hablabais', stemEnd: 4 },
    { pronoun: 'ellos / Uds.', form: 'hablaban', stemEnd: 4 },
  ],
};

const IMPERFECT_COMER: VerbTableData = {
  verb: 'comer / vivir', tense: 'Imperfecto', englishTense: '-ER/-IR imperfect',
  accentColor: 'text-teal-600 dark:text-teal-400',
  note: 'Only 3 irregular imperfects: ser → era, ir → iba, ver → veía',
  rows: [
    { pronoun: 'yo', form: 'comía', stemEnd: 3 },
    { pronoun: 'tú', form: 'comías', stemEnd: 3 },
    { pronoun: 'él / ella / Ud.', form: 'comía', stemEnd: 3 },
    { pronoun: 'nosotros/as', form: 'comíamos', stemEnd: 3 },
    { pronoun: 'vosotros/as', form: 'comíais', stemEnd: 3 },
    { pronoun: 'ellos / Uds.', form: 'comían', stemEnd: 3 },
  ],
};

const FUTURE_HABLAR: VerbTableData = {
  verb: 'hablar', tense: 'Futuro', englishTense: 'future — any verb',
  accentColor: 'text-rose-600 dark:text-rose-400',
  note: 'Regular future: keep the full infinitive, then add endings. Irregular stems: tener→tendr, haber→habr, poder→podr, saber→sabr, hacer→har.',
  rows: [
    { pronoun: 'yo', form: 'hablaré' },
    { pronoun: 'tú', form: 'hablarás' },
    { pronoun: 'él / ella / Ud.', form: 'hablará' },
    { pronoun: 'nosotros/as', form: 'hablaremos' },
    { pronoun: 'vosotros/as', form: 'hablaréis' },
    { pronoun: 'ellos / Uds.', form: 'hablarán' },
  ],
};

const CONDITIONAL_HABLAR: VerbTableData = {
  verb: 'hablar', tense: 'Condicional', englishTense: 'conditional — would',
  accentColor: 'text-orange-600 dark:text-orange-400',
  note: 'Same irregular stems as future. Conditional = infinitive + -ía, -ías, -ía, -íamos, -íais, -ían.',
  rows: [
    { pronoun: 'yo', form: 'hablaría' },
    { pronoun: 'tú', form: 'hablarías' },
    { pronoun: 'él / ella / Ud.', form: 'hablaría' },
    { pronoun: 'nosotros/as', form: 'hablaríamos' },
    { pronoun: 'vosotros/as', form: 'hablaríais' },
    { pronoun: 'ellos / Uds.', form: 'hablarían' },
  ],
};

const SUBJUNCTIVE_HABLAR: VerbTableData = {
  verb: 'hablar', tense: 'Subjuntivo (pres.)', englishTense: 'present subjunctive',
  accentColor: 'text-violet-600 dark:text-violet-400',
  note: 'Triggers: querer que, esperar que, recomendar que, es importante que, no creer que…',
  rows: [
    { pronoun: 'yo', form: 'hable', stemEnd: 4 },
    { pronoun: 'tú', form: 'hables', stemEnd: 4 },
    { pronoun: 'él / ella / Ud.', form: 'hable', stemEnd: 4 },
    { pronoun: 'nosotros/as', form: 'hablemos', stemEnd: 4 },
    { pronoun: 'vosotros/as', form: 'habléis', stemEnd: 4 },
    { pronoun: 'ellos / Uds.', form: 'hablen', stemEnd: 4 },
  ],
};

const SUBJUNCTIVE_COMER: VerbTableData = {
  verb: 'comer / vivir', tense: 'Subjuntivo (pres.)', englishTense: 'present subjunctive',
  accentColor: 'text-violet-600 dark:text-violet-400',
  rows: [
    { pronoun: 'yo', form: 'coma', stemEnd: 3 },
    { pronoun: 'tú', form: 'comas', stemEnd: 3 },
    { pronoun: 'él / ella / Ud.', form: 'coma', stemEnd: 3 },
    { pronoun: 'nosotros/as', form: 'comamos', stemEnd: 3 },
    { pronoun: 'vosotros/as', form: 'comáis', stemEnd: 3 },
    { pronoun: 'ellos / Uds.', form: 'coman', stemEnd: 3 },
  ],
};

// ─── B. COMPOSITE VERB CARDS ──────────────────────────────────────────────────

export function ArVerbsCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-ar-verbs">
      <VerbConjugationTable data={HABLAR} />
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-semibold mb-1.5 text-muted-foreground">More regular -AR verbs</p>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
          {['trabajar (to work)', 'caminar (to walk)', 'escuchar (to listen)', 'mirar (to watch)', 'comprar (to buy)', 'necesitar (to need)'].map(v => (
            <span key={v} className="text-foreground">{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ErVerbsCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-er-verbs">
      <VerbConjugationTable data={COMER} />
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-semibold mb-1.5 text-muted-foreground">More regular -ER verbs</p>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
          {['beber (to drink)', 'leer (to read)', 'correr (to run)', 'comprender (to understand)', 'aprender (to learn)', 'vender (to sell)'].map(v => (
            <span key={v} className="text-foreground">{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IrVerbsCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-ir-verbs">
      <VerbConjugationTable data={VIVIR} />
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-semibold mb-1.5 text-muted-foreground">More regular -IR verbs</p>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
          {['escribir (to write)', 'subir (to go up)', 'abrir (to open)', 'recibir (to receive)', 'decidir (to decide)', 'compartir (to share)'].map(v => (
            <span key={v} className="text-foreground">{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SerCard({ className = '' }: { className?: string }) {
  const SER_CORE = [
    { pronoun: 'yo', form: 'soy', english: 'I am' },
    { pronoun: 'él / ella / Ud.', form: 'es', english: 'he/she/you is' },
    { pronoun: 'nosotros/as', form: 'somos', english: 'we are' },
    { pronoun: 'ellos / Uds.', form: 'son', english: 'they/you all are' },
  ];

  const USE_CASES = [
    { label: 'Description', example: 'El caballo es negro.' },
    { label: 'Nationality', example: 'Ella es mexicana.' },
    { label: 'Profession', example: 'Él es doctor.' },
    { label: 'Identity', example: 'Soy estudiante.' },
    { label: 'Origin', example: 'Somos de España.' },
    { label: 'Time', example: 'Son las dos.' },
  ];

  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-ser">
      {/* Essential forms — core 4 only, no tú / no vosotros */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b bg-gradient-to-r from-blue-500/10 to-transparent flex items-baseline gap-2">
          <span className="font-bold text-sm text-blue-600 dark:text-blue-400">SER</span>
          <span className="text-xs text-muted-foreground">— to be (permanent characteristics)</span>
        </div>
        <div className="divide-y">
          {SER_CORE.map(({ pronoun, form, english }) => (
            <div key={pronoun} className="flex items-center px-3 py-2 gap-3">
              <span className="text-xs text-muted-foreground w-28 shrink-0">{pronoun}</span>
              <span className="font-bold text-sm text-blue-600 dark:text-blue-400 w-16 shrink-0">{form}</span>
              <TextAudioPlayButton text={form} language="spanish" size="sm" variant="ghost" className="shrink-0 opacity-60 hover:opacity-100" />
              <span className="text-xs text-muted-foreground">{english}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Use cases */}
      <div className="grid grid-cols-2 gap-2">
        {USE_CASES.map(({ label, example }) => (
          <div key={label} className="rounded-md border bg-muted/20 p-2.5">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">{label}</p>
            <p className="text-xs font-medium">{example}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EstarCard({ className = '' }: { className?: string }) {
  return <VerbConjugationTable data={ESTAR_PRES} />;
}

export function TenerCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-tener">
      <VerbConjugationTable data={TENER_PRES} />
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-semibold mb-2 text-muted-foreground">Tener expressions</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {[
            ['tener hambre', 'to be hungry'],
            ['tener sed', 'to be thirsty'],
            ['tener frío / calor', 'to be cold / hot'],
            ['tener sueño', 'to be sleepy'],
            ['tener miedo', 'to be afraid'],
            ['tener razón', 'to be right'],
            ['tener … años', 'to be … years old'],
            ['tener que + inf.', 'to have to (do sth.)'],
          ].map(([sp, en]) => (
            <div key={sp} className="flex items-center gap-1.5">
              <TextAudioPlayButton text={sp} language="spanish" size="sm" variant="ghost" className="shrink-0 opacity-60 hover:opacity-100 -ml-1" />
              <span className="font-medium text-foreground">{sp}</span>
              <span className="text-muted-foreground">— {en}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IrCard({ className = '' }: { className?: string }) {
  return <VerbConjugationTable data={IR_PRES} />;
}

export function StemChangeCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-stem-change">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-gradient-to-r from-amber-500/10 to-transparent">
          <p className="text-sm font-semibold text-center">Stem-changing verbs — "Boot Verbs"</p>
          <p className="text-xs text-muted-foreground text-center">The stem changes in all forms except nosotros & vosotros</p>
        </div>
        <div className="p-4">
          <StemChangeSVG />
        </div>
        <div className="grid grid-cols-3 divide-x border-t">
          {[
            { change: 'e → ie', verbs: 'querer, entender, preferir, venir, cerrar, pensar', ex: 'quiero / queremos' },
            { change: 'o → ue', verbs: 'poder, volver, dormir, encontrar, contar, costar', ex: 'puedo / podemos' },
            { change: 'e → i', verbs: 'pedir, seguir, servir, repetir, conseguir', ex: 'pido / pedimos' },
          ].map(({ change, verbs, ex }) => (
            <div key={change} className="p-3">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">{change}</p>
              <p className="text-xs text-muted-foreground mb-1">{verbs}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-foreground">{ex}</p>
                <TextAudioPlayButton text={ex} language="spanish" size="sm" variant="ghost" className="shrink-0 opacity-60 hover:opacity-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <VerbConjugationTable data={QUERER_PRES} />
        <VerbConjugationTable data={PODER_PRES} />
      </div>
    </div>
  );
}

function StemChangeSVG() {
  const pronouns = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
  const isBooted = [true, true, true, false, false, true];
  return (
    <svg viewBox="0 0 360 80" className="w-full h-auto" aria-label="Boot verb diagram">
      {pronouns.map((p, i) => {
        const x = 30 + i * 54;
        const y = 40;
        return (
          <g key={p}>
            <rect
              x={x - 22} y={isBooted[i] ? y - 22 : y - 18}
              width={44} height={isBooted[i] ? 44 : 36}
              rx="6" fill={isBooted[i] ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted) / 0.5)'}
              stroke={isBooted[i] ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))'}
              strokeWidth="1"
            />
            <text x={x} y={y - 4} textAnchor="middle" fontSize="9" fontWeight="600"
              fill={isBooted[i] ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}>{p}</text>
            <text x={x} y={y + 10} textAnchor="middle" fontSize="7.5"
              fill={isBooted[i] ? 'hsl(var(--amber-500, 217 91% 60%))' : 'hsl(var(--muted-foreground))'}
              className={isBooted[i] ? 'fill-amber-600 dark:fill-amber-400' : 'fill-muted-foreground'}>
              {isBooted[i] ? 'changes' : 'no change'}
            </text>
          </g>
        );
      })}
      <text x="180" y="74" textAnchor="middle" fontSize="8" className="fill-muted-foreground">← stem changes inside the "boot" →</text>
    </svg>
  );
}

export function GoVerbsCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-go-verbs">
      <VerbConjugationTable data={HACER_PRES} />
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-semibold mb-2 text-muted-foreground">All –go verbs — only yo is irregular</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {[
            ['hacer', 'hago', 'to do/make'],
            ['poner', 'pongo', 'to put'],
            ['traer', 'traigo', 'to bring'],
            ['salir', 'salgo', 'to leave'],
            ['venir', 'vengo', 'to come'],
            ['tener', 'tengo', 'to have'],
            ['decir', 'digo', 'to say'],
            ['oír', 'oigo', 'to hear'],
          ].map(([verb, yo, en]) => (
            <div key={verb} className="flex items-center gap-1.5">
              <span className="font-medium text-foreground w-12">{verb}</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold w-14">{yo}</span>
              <TextAudioPlayButton text={yo} language="spanish" size="sm" variant="ghost" className="shrink-0 opacity-60 hover:opacity-100 -mx-1" />
              <span className="text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SaberConocerCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-saber-conocer">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-cyan-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">SABER vs CONOCER — both mean "to know"</p>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 mb-1">SABER</p>
          <p className="text-xs text-muted-foreground mb-2">factual knowledge, how to do sth.</p>
          <div className="text-xs space-y-1.5 mb-3">
            <div><span className="font-medium">yo sé</span> · tú sabes · él sabe</div>
            <div>nosotros sabemos · ellos saben</div>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• facts: Sé que Madrid es la capital.</li>
            <li>• languages: ¿Sabes español?</li>
            <li>• how to: Sé cocinar.</li>
            <li>• information: No sé su número.</li>
          </ul>
        </div>
        <div className="p-4">
          <p className="text-sm font-bold text-teal-600 dark:text-teal-400 mb-1">CONOCER</p>
          <p className="text-xs text-muted-foreground mb-2">familiarity with people/places</p>
          <div className="text-xs space-y-1.5 mb-3">
            <div><span className="font-medium">yo conozco</span> · tú conoces · él conoce</div>
            <div>nosotros conocemos · ellos conocen</div>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• people: Conozco a María.</li>
            <li>• places: ¿Conoces Barcelona?</li>
            <li>• acquaintance: No conozco ese libro.</li>
            <li>• meeting sb: ¡Mucho gusto en conocerte!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ReflexiveVerbCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-reflexive">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-pink-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Reflexive Verbs — Verbos reflexivos</p>
        <p className="text-xs text-muted-foreground text-center">the subject does the action to themselves</p>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Reflexive pronouns</p>
          <div className="space-y-1 text-xs">
            {[['yo', 'me'], ['tú', 'te'], ['él/ella', 'se'], ['nosotros', 'nos'], ['vosotros', 'os'], ['ellos', 'se']].map(([p, r]) => (
              <div key={p} className="flex items-center gap-2">
                <span className="w-16 text-muted-foreground">{p}</span>
                <span className="font-bold text-pink-600 dark:text-pink-400">{r}</span>
                <TextAudioPlayButton text={`${r} ${p}`} language="spanish" size="sm" variant="ghost" className="shrink-0 opacity-60 hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">ducharse — to shower</p>
          <div className="space-y-1 text-xs mb-3">
            {[['yo', 'me ducho'], ['tú', 'te duchas'], ['él', 'se ducha'], ['nosotros', 'nos duchamos'], ['ellos', 'se duchan']].map(([p, f]) => (
              <div key={p} className="flex items-center gap-2">
                <span className="w-16 text-muted-foreground">{p}</span>
                <span className="font-medium">{f}</span>
                <TextAudioPlayButton text={f} language="spanish" size="sm" variant="ghost" className="shrink-0 opacity-60 hover:opacity-100" />
              </div>
            ))}
          </div>
          <div className="bg-muted/30 rounded p-2 text-xs">
            <p className="font-medium mb-1">Placement rules</p>
            <p className="text-muted-foreground">Before conjugated verb: <span className="font-medium text-foreground">Me lavo</span> las manos.</p>
            <p className="text-muted-foreground mt-0.5">After infinitive: Voy a <span className="font-medium text-foreground">lavarme</span>.</p>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground text-center">Common reflexives: levantarse · acostarse · vestirse · peinarse · llamarse · sentarse</p>
      </div>
    </div>
  );
}

export function PretRegularCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-pret-regular">
      <div className="grid grid-cols-2 gap-3">
        <VerbConjugationTable data={PRETERITE_HABLAR} />
        <VerbConjugationTable data={PRETERITE_COMER} />
      </div>
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-semibold mb-1.5 text-muted-foreground">Preterite trigger words</p>
        <p className="text-xs text-foreground">ayer · anoche · el lunes · la semana pasada · hace dos días · de repente · una vez · por fin · ya</p>
      </div>
    </div>
  );
}

export function PretIrregularCard({ className = '' }: { className?: string }) {
  const irregulars = [
    { verb: 'ser / ir', yo: 'fui', tu: 'fuiste', el: 'fue', nos: 'fuimos', ellos: 'fueron' },
    { verb: 'tener', yo: 'tuve', tu: 'tuviste', el: 'tuvo', nos: 'tuvimos', ellos: 'tuvieron' },
    { verb: 'hacer', yo: 'hice', tu: 'hiciste', el: 'hizo', nos: 'hicimos', ellos: 'hicieron' },
    { verb: 'estar', yo: 'estuve', tu: 'estuviste', el: 'estuvo', nos: 'estuvimos', ellos: 'estuvieron' },
    { verb: 'poder', yo: 'pude', tu: 'pudiste', el: 'pudo', nos: 'pudimos', ellos: 'pudieron' },
    { verb: 'venir', yo: 'vine', tu: 'viniste', el: 'vino', nos: 'vinimos', ellos: 'vinieron' },
  ];
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-pret-irregular">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-purple-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Irregular Preterites — Pretéritos irregulares</p>
        <p className="text-xs text-muted-foreground text-center">No accent marks. No standard stem.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Verb</th>
              <th className="px-2 py-1.5 text-center font-semibold">yo</th>
              <th className="px-2 py-1.5 text-center font-semibold">tú</th>
              <th className="px-2 py-1.5 text-center font-semibold">él/ella</th>
              <th className="px-2 py-1.5 text-center font-semibold">nosotros</th>
              <th className="px-2 py-1.5 text-center font-semibold">ellos</th>
            </tr>
          </thead>
          <tbody>
            {irregulars.map((row, i) => (
              <tr key={row.verb} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                <td className="px-3 py-2 font-semibold text-purple-600 dark:text-purple-400">{row.verb}</td>
                {[
                  { form: row.yo, bold: true },
                  { form: row.tu, bold: false },
                  { form: row.el, bold: false },
                  { form: row.nos, bold: false },
                  { form: row.ellos, bold: false },
                ].map(({ form, bold }) => (
                  <td key={form} className="px-2 py-1 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={bold ? 'font-medium' : ''}>{form}</span>
                      <TextAudioPlayButton text={form} language="spanish" size="sm" variant="ghost" className="h-4 w-4 p-0 opacity-50 hover:opacity-100" />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">Note: ser and ir share the same preterite forms — context clarifies meaning.</p>
      </div>
    </div>
  );
}

export function ImperfectCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="grammar-card-imperfect">
      <div className="grid grid-cols-2 gap-3">
        <VerbConjugationTable data={IMPERFECT_HABLAR} />
        <VerbConjugationTable data={IMPERFECT_COMER} />
      </div>
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-semibold mb-1.5 text-muted-foreground">Imperfect trigger words</p>
        <p className="text-xs text-foreground">siempre · todos los días · generalmente · a veces · cuando era niño/a · antes · de niño/a · frecuentemente · cada semana</p>
      </div>
    </div>
  );
}

export function FutureCard({ className = '' }: { className?: string }) {
  return <VerbConjugationTable data={FUTURE_HABLAR} />;
}

export function ConditionalCard({ className = '' }: { className?: string }) {
  return <VerbConjugationTable data={CONDITIONAL_HABLAR} />;
}

export function SubjunctiveCard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3`} data-testid="grammar-card-subjunctive">
      <div className="grid grid-cols-2 gap-3">
        <VerbConjugationTable data={SUBJUNCTIVE_HABLAR} />
        <VerbConjugationTable data={SUBJUNCTIVE_COMER} />
      </div>
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-semibold mb-1.5 text-muted-foreground">Common subjunctive triggers (que + subjunctive)</p>
        <div className="grid grid-cols-2 gap-x-4 text-xs text-foreground">
          <div className="space-y-0.5">
            <p>querer que — to want that</p>
            <p>esperar que — to hope that</p>
            <p>recomendar que — to recommend</p>
            <p>pedir que — to ask that</p>
          </div>
          <div className="space-y-0.5">
            <p>es importante que — it's important</p>
            <p>es posible que — it's possible</p>
            <p>no creer que — not to believe</p>
            <p>dudar que — to doubt that</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandsCard({ className = '' }: { className?: string }) {
  const data = [
    { verb: 'hablar', tu: 'habla', tuNeg: 'no hables', ud: 'hable', uds: 'hablen' },
    { verb: 'comer', tu: 'come', tuNeg: 'no comas', ud: 'coma', uds: 'coman' },
    { verb: 'vivir', tu: 'vive', tuNeg: 'no vivas', ud: 'viva', uds: 'vivan' },
    { verb: 'ir', tu: 've', tuNeg: 'no vayas', ud: 'vaya', uds: 'vayan' },
    { verb: 'ser', tu: 'sé', tuNeg: 'no seas', ud: 'sea', uds: 'sean' },
    { verb: 'tener', tu: 'ten', tuNeg: 'no tengas', ud: 'tenga', uds: 'tengan' },
    { verb: 'hacer', tu: 'haz', tuNeg: 'no hagas', ud: 'haga', uds: 'hagan' },
  ];
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-commands">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-rose-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Commands — Imperativos</p>
        <p className="text-xs text-muted-foreground text-center">tú (affirmative) · tú (negative) · Ud. · Uds.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Verb</th>
              <th className="px-3 py-1.5 text-center text-green-700 dark:text-green-400 font-semibold">tú (+)</th>
              <th className="px-3 py-1.5 text-center text-red-600 dark:text-red-400 font-semibold">tú (−)</th>
              <th className="px-3 py-1.5 text-center font-semibold">Ud.</th>
              <th className="px-3 py-1.5 text-center font-semibold">Uds.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.verb} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                <td className="px-3 py-2 font-semibold text-foreground">{row.verb}</td>
                <td className="px-2 py-1 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-medium text-green-700 dark:text-green-400">{row.tu}</span>
                    <TextAudioPlayButton text={row.tu} language="spanish" size="sm" variant="ghost" className="h-4 w-4 p-0 opacity-50 hover:opacity-100" />
                  </div>
                </td>
                <td className="px-2 py-1 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-red-600 dark:text-red-400">{row.tuNeg}</span>
                    <TextAudioPlayButton text={row.tuNeg} language="spanish" size="sm" variant="ghost" className="h-4 w-4 p-0 opacity-50 hover:opacity-100" />
                  </div>
                </td>
                <td className="px-2 py-1 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{row.ud}</span>
                    <TextAudioPlayButton text={row.ud} language="spanish" size="sm" variant="ghost" className="h-4 w-4 p-0 opacity-50 hover:opacity-100" />
                  </div>
                </td>
                <td className="px-2 py-1 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{row.uds}</span>
                    <TextAudioPlayButton text={row.uds} language="spanish" size="sm" variant="ghost" className="h-4 w-4 p-0 opacity-50 hover:opacity-100" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground">Tú affirmative = él/ella present. Ud./Uds. = present subjunctive. Negative tú = present subjunctive.</p>
      </div>
    </div>
  );
}

// ─── C. COMPARISON / DECISION CARDS ─────────────────────────────────────────

export function GenderArticleCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-gender-articles">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-sky-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Gender & Articles — Género y artículos</p>
        <p className="text-xs text-muted-foreground text-center">every Spanish noun has a gender — and it matters</p>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base font-bold text-blue-600 dark:text-blue-400">Masculino</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-blue-500/10 px-2 py-1 text-center">
                <p className="font-bold text-blue-600 dark:text-blue-400">el</p>
                <p className="text-muted-foreground">definite</p>
              </div>
              <div className="rounded bg-blue-500/5 px-2 py-1 text-center">
                <p className="font-bold text-blue-600 dark:text-blue-400">un</p>
                <p className="text-muted-foreground">indefinite</p>
              </div>
            </div>
            <div className="space-y-1 mt-2">
              <p className="font-medium text-muted-foreground mb-1">Examples</p>
              {[['el libro', 'un libro', 'book'], ['el chico', 'un chico', 'boy'], ['el café', 'un café', 'coffee']].map(([def, ind, en]) => (
                <div key={en} className="flex gap-1.5 items-baseline">
                  <span className="font-medium">{def}</span><span className="text-muted-foreground">·</span>
                  <span>{ind}</span><span className="text-muted-foreground text-xs">({en})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base font-bold text-pink-600 dark:text-pink-400">Femenino</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-pink-500/10 px-2 py-1 text-center">
                <p className="font-bold text-pink-600 dark:text-pink-400">la</p>
                <p className="text-muted-foreground">definite</p>
              </div>
              <div className="rounded bg-pink-500/5 px-2 py-1 text-center">
                <p className="font-bold text-pink-600 dark:text-pink-400">una</p>
                <p className="text-muted-foreground">indefinite</p>
              </div>
            </div>
            <div className="space-y-1 mt-2">
              <p className="font-medium text-muted-foreground mb-1">Examples</p>
              {[['la chica', 'una chica', 'girl'], ['la casa', 'una casa', 'house'], ['la noche', 'una noche', 'night']].map(([def, ind, en]) => (
                <div key={en} className="flex gap-1.5 items-baseline">
                  <span className="font-medium">{def}</span><span className="text-muted-foreground">·</span>
                  <span>{ind}</span><span className="text-muted-foreground text-xs">({en})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 border-t bg-muted/20 space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground">Rules of thumb</p>
        <div className="grid grid-cols-2 gap-x-4 text-xs text-foreground">
          <p><span className="text-blue-600 dark:text-blue-400 font-medium">–o endings</span> → usually masculine</p>
          <p><span className="text-pink-600 dark:text-pink-400 font-medium">–a endings</span> → usually feminine</p>
          <p><span className="text-blue-600 dark:text-blue-400 font-medium">–ema, –ama, –or</span> → often masculine</p>
          <p><span className="text-pink-600 dark:text-pink-400 font-medium">–ción, –sión, –dad, –tad</span> → feminine</p>
        </div>
        <p className="text-xs text-muted-foreground">Plural: los chicos · las chicas · unos libros · unas casas</p>
      </div>
    </div>
  );
}

export function AdjAgreeCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-adjective-agreement">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-emerald-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Adjective Agreement — Concordancia</p>
        <p className="text-xs text-muted-foreground text-center">adjectives must match the noun in gender and number</p>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 text-xs mb-4">
          <div />
          <div className="text-center font-semibold text-blue-600 dark:text-blue-400">Masculine</div>
          <div className="text-center font-semibold text-pink-600 dark:text-pink-400">Feminine</div>
          {[
            ['Singular', 'alto', 'alta'],
            ['Plural', 'altos', 'altas'],
          ].map(([label, m, f]) => (
            <>
              <div key={label} className="font-medium text-muted-foreground flex items-center">{label}</div>
              <div className="rounded bg-blue-500/10 px-3 py-2 text-center font-bold text-blue-600 dark:text-blue-400">{m}</div>
              <div className="rounded bg-pink-500/10 px-3 py-2 text-center font-bold text-pink-600 dark:text-pink-400">{f}</div>
            </>
          ))}
        </div>
        <div className="space-y-2 text-xs border-t pt-3">
          <p className="font-semibold text-muted-foreground mb-1">Placement rules</p>
          <div className="space-y-1">
            <p><span className="font-medium">Usually after noun:</span> el chico <span className="text-emerald-600 dark:text-emerald-400 font-medium">alto</span> · la chica <span className="text-emerald-600 dark:text-emerald-400 font-medium">alta</span></p>
            <p><span className="font-medium">Before noun (subjective/literary):</span> <span className="text-amber-600 dark:text-amber-400 font-medium">gran</span> hombre · <span className="text-amber-600 dark:text-amber-400 font-medium">buena</span> persona</p>
            <p><span className="font-medium">Invariable adjectives</span> (same for all): <span className="text-foreground font-medium">grande · interesante · optimista · azul</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ObjectPronounChart({ className = '' }: { className?: string }) {
  const rows = [
    { person: 'yo', direct: 'me', indirect: 'me' },
    { person: 'tú', direct: 'te', indirect: 'te' },
    { person: 'él / ella / Ud.', direct: 'lo / la', indirect: 'le' },
    { person: 'nosotros', direct: 'nos', indirect: 'nos' },
    { person: 'vosotros', direct: 'os', indirect: 'os' },
    { person: 'ellos / Uds.', direct: 'los / las', indirect: 'les' },
  ];
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-object-pronouns">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-fuchsia-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Object Pronouns — Pronombres de objeto</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Subject</th>
              <th className="px-3 py-1.5 text-center font-semibold text-fuchsia-600 dark:text-fuchsia-400">Direct (DO)</th>
              <th className="px-3 py-1.5 text-center font-semibold text-violet-600 dark:text-violet-400">Indirect (IO)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.person} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                <td className="px-3 py-1.5 text-muted-foreground">{row.person}</td>
                <td className="px-3 py-1.5 text-center font-bold text-fuchsia-600 dark:text-fuchsia-400">{row.direct}</td>
                <td className="px-3 py-1.5 text-center font-bold text-violet-600 dark:text-violet-400">{row.indirect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t bg-muted/20 space-y-1.5 text-xs">
        <p><span className="font-semibold">Direct (DO):</span> answers "what?" or "whom?" — <span className="italic">Compré el libro → <span className="text-fuchsia-600 dark:text-fuchsia-400 font-medium">Lo</span> compré.</span></p>
        <p><span className="font-semibold">Indirect (IO):</span> answers "to/for whom?" — <span className="italic">Le di el libro a María → <span className="text-violet-600 dark:text-violet-400 font-medium">Le</span> lo di.</span></p>
        <p className="text-muted-foreground">Order when both present: IO + DO + verb &nbsp;·&nbsp; le/les + lo/la/los/las → <span className="font-medium text-foreground">se</span> lo/la</p>
      </div>
    </div>
  );
}

export function NegationQuestionsCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-negation-questions">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-slate-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Sentence Structure Essentials</p>
      </div>
      <div className="grid grid-cols-1 divide-y">
        <div className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Basic word order — SVO</p>
          <div className="flex gap-2 items-center flex-wrap">
            {[['Subject', 'María', 'text-blue-600 dark:text-blue-400'], ['Verb', 'compra', 'text-green-600 dark:text-green-400'], ['Object', 'la manzana', 'text-amber-600 dark:text-amber-400']].map(([label, word, color]) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className={`text-xs font-bold ${color}`}>{word}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Negation — place <span className="text-red-600 dark:text-red-400 font-bold">no</span> before the verb</p>
          <div className="space-y-1 text-xs">
            <div className="flex gap-2"><span className="text-foreground font-medium">Hablo español.</span><span className="text-muted-foreground">→</span><span className="font-medium"><span className="text-red-600 dark:text-red-400">No</span> hablo español.</span></div>
            <div className="flex gap-2"><span className="text-foreground font-medium">Tengo hambre.</span><span className="text-muted-foreground">→</span><span className="font-medium"><span className="text-red-600 dark:text-red-400">No</span> tengo hambre.</span></div>
            <div className="flex flex-wrap gap-x-3 text-muted-foreground mt-1.5">
              <span>no … nada (nothing)</span><span>no … nadie (nobody)</span><span>no … nunca (never)</span><span>no … ningún (no…)</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Question words — Palabras interrogativas</p>
          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
            {[['¿Qué?', 'What?'], ['¿Quién?', 'Who?'], ['¿Dónde?', 'Where?'], ['¿Cuándo?', 'When?'], ['¿Cómo?', 'How?'], ['¿Por qué?', 'Why?'], ['¿Cuánto?', 'How much?'], ['¿Cuál?', 'Which?'], ['¿Adónde?', 'Where to?']].map(([sp, en]) => (
              <div key={sp}>
                <span className="font-medium text-foreground">{sp}</span>
                <span className="text-muted-foreground ml-1">{en}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TuUstedCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-tu-usted">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-orange-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Tú vs Usted — Register guide</p>
        <p className="text-xs text-muted-foreground text-center">both mean "you" — but the wrong choice can seem rude or overly formal</p>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <p className="text-base font-bold text-orange-600 dark:text-orange-400 mb-1">Tú</p>
          <p className="text-xs text-muted-foreground mb-2">informal — use with equals & friends</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• friends & classmates</li>
            <li>• family members (siblings, cousins)</li>
            <li>• children</li>
            <li>• peers of similar age</li>
            <li>• social media / texting</li>
          </ul>
          <p className="text-xs font-medium text-foreground mt-2">¿<span className="text-orange-500 font-bold">Tú</span> hablas inglés?</p>
        </div>
        <div className="p-4">
          <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 mb-1">Usted (Ud.)</p>
          <p className="text-xs text-muted-foreground mb-2">formal — respect & professional contexts</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• strangers (esp. adults)</li>
            <li>• elderly people</li>
            <li>• bosses & authority figures</li>
            <li>• customers / service situations</li>
            <li>• formal writing and speeches</li>
          </ul>
          <p className="text-xs font-medium text-foreground mt-2">¿<span className="text-indigo-500 font-bold">Usted</span> habla inglés?</p>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground text-center">Regional note: In Latin America, <span className="font-medium text-foreground">ustedes</span> is used for all plural "you" (formal + informal). Vosotros is Spain only.</p>
      </div>
    </div>
  );
}

// ─── D. SECTION 4 — PREPOSITION MAPS ─────────────────────────────────────────

export function SpatialPrepositionMap({ className = '' }: { className?: string }) {
  const preps = [
    { label: 'encima de / sobre', en: 'on top of', x: 195, y: 100, anchor: 'middle' },
    { label: 'debajo de', en: 'under', x: 195, y: 250, anchor: 'middle' },
    { label: 'delante de', en: 'in front of', x: 195, y: 310, anchor: 'middle' },
    { label: 'detrás de', en: 'behind', x: 195, y: 50, anchor: 'middle' },
    { label: 'al lado de', en: 'beside', x: 30, y: 185, anchor: 'start' },
    { label: 'a la derecha de', en: 'to the right of', x: 360, y: 185, anchor: 'end' },
    { label: 'dentro de', en: 'inside', x: 195, y: 185, anchor: 'middle' },
    { label: 'entre', en: 'between', x: 195, y: 145, anchor: 'middle' },
  ];
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-spatial-prepositions">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-lime-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Spatial Prepositions — Preposiciones de lugar</p>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 390 340" className="w-full h-auto" aria-label="Spatial prepositions room diagram">
          <rect x="1" y="1" width="388" height="338" rx="8" fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--border))" strokeWidth="1" />
          <rect x="130" y="140" width="130" height="90" rx="4"
            fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
          <rect x="155" y="125" width="80" height="15" rx="2"
            fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
          <rect x="175" y="110" width="40" height="15" rx="2"
            fill="hsl(var(--muted) / 0.6)" stroke="hsl(var(--border))" strokeWidth="1" />
          <rect x="180" y="115" width="30" height="10" rx="1"
            fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary) / 0.4)" strokeWidth="1" />
          <text x="195" y="190" textAnchor="middle" fontSize="9" className="fill-muted-foreground" fontWeight="500">table</text>
          {[
            { x: 195, y: 106, label: '↑ encima de', color: '#6366f1' },
            { x: 195, y: 240, label: '↓ debajo de', color: '#6366f1' },
            { x: 195, y: 320, label: '→ delante de', color: '#10b981' },
            { x: 195, y: 34, label: '← detrás de', color: '#10b981' },
            { x: 40, y: 180, label: 'al lado de ↔', color: '#f59e0b' },
            { x: 350, y: 180, label: '↔ a la der.', color: '#f59e0b' },
          ].map(({ x, y, label, color }) => (
            <text key={label} x={x} y={y} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={color}>{label}</text>
          ))}
          <text x="195" y="170" textAnchor="middle" fontSize="8" className="fill-primary" fontWeight="700" opacity="0.8">dentro de →</text>
        </svg>
      </div>
      <div className="border-t">
        <div className="grid grid-cols-3 gap-0 divide-x divide-y text-xs">
          {[
            ['en / dentro de', 'in, inside', '#6366f1'],
            ['sobre / encima de', 'on, on top of', '#6366f1'],
            ['debajo de', 'under, below', '#6366f1'],
            ['delante de', 'in front of', '#10b981'],
            ['detrás de', 'behind', '#10b981'],
            ['al lado de', 'next to, beside', '#f59e0b'],
            ['entre', 'between', '#f59e0b'],
            ['cerca de', 'near, close to', '#f59e0b'],
            ['lejos de', 'far from', '#f59e0b'],
          ].map(([sp, en, color]) => (
            <div key={sp} className="px-2.5 py-2">
              <p className="font-semibold" style={{ color }}>{sp}</p>
              <p className="text-muted-foreground">{en}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TemporalPrepositionTimeline({ className = '' }: { className?: string }) {
  const items = [
    { label: 'antes de', en: 'before', x: 60 },
    { label: 'desde', en: 'since', x: 130 },
    { label: 'durante', en: 'during', x: 195 },
    { label: 'hasta', en: 'until', x: 265 },
    { label: 'después de', en: 'after', x: 335 },
  ];
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-temporal-prepositions">
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-sky-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Temporal Prepositions — Preposiciones de tiempo</p>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 390 120" className="w-full h-auto" aria-label="Temporal prepositions timeline">
          <defs>
            <marker id="arrow-temp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground) / 0.6)" />
            </marker>
          </defs>
          <line x1="20" y1="60" x2="375" y2="60" stroke="hsl(var(--border))" strokeWidth="2" markerEnd="url(#arrow-temp)" />
          <circle cx="195" cy="60" r="5" fill="hsl(var(--primary))" />
          <text x="195" y="78" textAnchor="middle" fontSize="8.5" className="fill-primary font-semibold" fontWeight="700">AHORA</text>
          {items.map(({ label, en, x }) => (
            <g key={label}>
              <circle cx={x} cy="60" r="3.5" fill="hsl(var(--muted-foreground) / 0.4)" stroke="hsl(var(--border))" strokeWidth="1" />
              <line x1={x} y1={x < 195 ? 45 : 57} x2={x} y2={x < 195 ? 57 : 45} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3,2" />
              <text x={x} y={x < 195 ? 38 : 40} textAnchor="middle" fontSize="9" fontWeight="700" className="fill-sky-600 dark:fill-sky-400">{label}</text>
              <text x={x} y={x < 195 ? 26 : 28} textAnchor="middle" fontSize="7.5" className="fill-muted-foreground">{en}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="border-t">
        <div className="grid grid-cols-2 divide-x text-xs">
          <div className="p-3 space-y-1.5">
            {[
              ['antes de', 'before — antes de comer, lávate las manos.'],
              ['desde', 'since — Vivo aquí desde 2020.'],
              ['durante', 'during — No hables durante la clase.'],
            ].map(([sp, ex]) => (
              <div key={sp}>
                <span className="font-semibold text-sky-600 dark:text-sky-400">{sp}</span>
                <span className="text-muted-foreground ml-1">{ex}</span>
              </div>
            ))}
          </div>
          <div className="p-3 space-y-1.5">
            {[
              ['hasta', 'until — Trabaja hasta las seis.'],
              ['después de', 'after — ¿Qué haces después de clase?'],
              ['hace + tiempo', 'ago — Llegué hace dos horas.'],
            ].map(([sp, ex]) => (
              <div key={sp}>
                <span className="font-semibold text-sky-600 dark:text-sky-400">{sp}</span>
                <span className="text-muted-foreground ml-1">{ex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
