/**
 * TextbookWordFamilies.tsx
 * Section 6 — Word Family Maps
 * One reusable hub-and-spoke SVG component + data for 12 root verbs.
 * Color-coded by word class: verb=blue, noun=orange, adjective=green, adverb=purple.
 * Auto-triggered by chapter title via classifyGrammarType() in ChapterIntroduction.tsx.
 */

type WordClass = 'verb' | 'noun' | 'adjective' | 'adverb';

interface FamilyMember {
  word: string;
  type: WordClass;
  meaning: string;
  example?: string;
}

interface WordFamilyData {
  root: string;
  rootMeaning: string;
  level: string;
  members: FamilyMember[];
  note?: string;
}

// ─── COLOR MAP ────────────────────────────────────────────────────────────────

const CLASS_STYLES: Record<WordClass, { bg: string; border: string; text: string; tag: string }> = {
  verb: { bg: 'fill-blue-500/15', border: 'stroke-blue-500/50', text: 'fill-blue-700 dark:fill-blue-300', tag: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  noun: { bg: 'fill-amber-500/15', border: 'stroke-amber-500/50', text: 'fill-amber-700 dark:fill-amber-300', tag: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  adjective: { bg: 'fill-emerald-500/15', border: 'stroke-emerald-500/50', text: 'fill-emerald-700 dark:fill-emerald-300', tag: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  adverb: { bg: 'fill-violet-500/15', border: 'stroke-violet-500/50', text: 'fill-violet-700 dark:fill-violet-300', tag: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
};

const CLASS_LABELS: Record<WordClass, string> = {
  verb: 'verb', noun: 'noun', adjective: 'adjective', adverb: 'adverb',
};

// ─── WORD FAMILY DATA ─────────────────────────────────────────────────────────

const WORD_FAMILIES: Record<string, WordFamilyData> = {
  hablar: {
    root: 'hablar', rootMeaning: 'to speak / to talk', level: 'Novice Low',
    members: [
      { word: 'habla', type: 'noun', meaning: 'speech, way of speaking', example: 'El habla de Andalucía.' },
      { word: 'hablante', type: 'noun', meaning: 'speaker', example: 'hablante nativo' },
      { word: 'hablador/a', type: 'adjective', meaning: 'talkative, chatty', example: 'Es muy habladora.' },
      { word: 'hablado', type: 'adjective', meaning: 'spoken (as in spoken language)', example: 'el español hablado' },
    ],
    note: 'Hablante is also used as an adjective: un país hispanohablante (a Spanish-speaking country).',
  },
  comer: {
    root: 'comer', rootMeaning: 'to eat', level: 'Novice Low',
    members: [
      { word: 'comida', type: 'noun', meaning: 'food, meal', example: 'La comida está lista.' },
      { word: 'comedor', type: 'noun', meaning: 'dining room, canteen', example: 'El comedor escolar.' },
      { word: 'comestible', type: 'adjective', meaning: 'edible', example: 'plantas comestibles' },
      { word: 'comilón/a', type: 'noun', meaning: 'big eater, glutton', example: 'Es un comilón.' },
    ],
  },
  vivir: {
    root: 'vivir', rootMeaning: 'to live', level: 'Novice Low',
    members: [
      { word: 'vida', type: 'noun', meaning: 'life', example: '¡Qué vida tan buena!' },
      { word: 'vivienda', type: 'noun', meaning: 'housing, dwelling', example: 'vivienda de alquiler' },
      { word: 'viviente', type: 'adjective', meaning: 'living, alive', example: 'ser viviente' },
      { word: 'vivo/a', type: 'adjective', meaning: 'alive, bright, clever', example: 'Color rojo vivo.' },
    ],
  },
  trabajar: {
    root: 'trabajar', rootMeaning: 'to work', level: 'Novice Low',
    members: [
      { word: 'trabajo', type: 'noun', meaning: 'work, job', example: 'Busco trabajo.' },
      { word: 'trabajador/a', type: 'noun', meaning: 'worker, employee', example: 'un buen trabajador' },
      { word: 'trabajador/a', type: 'adjective', meaning: 'hard-working, diligent', example: 'Es muy trabajadora.' },
    ],
    note: 'Trabajador/a serves double duty: noun (worker) and adjective (hard-working).',
  },
  dormir: {
    root: 'dormir', rootMeaning: 'to sleep', level: 'Novice Mid',
    members: [
      { word: 'sueño', type: 'noun', meaning: 'sleep, dream, sleepiness', example: 'Tengo mucho sueño.' },
      { word: 'dormitorio', type: 'noun', meaning: 'bedroom', example: 'Mi dormitorio es pequeño.' },
      { word: 'dormilón/a', type: 'adjective', meaning: 'sleepyhead, one who loves to sleep', example: 'Eres un dormilón.' },
    ],
    note: 'Sueño = both sleepiness (Tengo sueño) and dreams (Tuve un sueño). Context tells the difference.',
  },
  viajar: {
    root: 'viajar', rootMeaning: 'to travel', level: 'Novice High',
    members: [
      { word: 'viaje', type: 'noun', meaning: 'trip, journey', example: '¡Buen viaje!' },
      { word: 'viajero/a', type: 'noun', meaning: 'traveler', example: 'un viajero frecuente' },
      { word: 'viajero/a', type: 'adjective', meaning: 'traveling, nomadic', example: 'alma viajera' },
    ],
    note: '¡Buen viaje! = Have a good trip! (very common phrase)',
  },
  amar: {
    root: 'amar', rootMeaning: 'to love', level: 'Novice Mid',
    members: [
      { word: 'amor', type: 'noun', meaning: 'love', example: '¡Te quiero, mi amor!' },
      { word: 'amante', type: 'noun', meaning: 'lover, fan/enthusiast of', example: 'amante de la música' },
      { word: 'amado/a', type: 'adjective', meaning: 'beloved, loved', example: 'mi amada' },
      { word: 'amoroso/a', type: 'adjective', meaning: 'loving, affectionate', example: 'una carta amorosa' },
    ],
    note: 'Amar is more intense/poetic than querer. Both mean "to love" but querer is used more in everyday speech.',
  },
  escribir: {
    root: 'escribir', rootMeaning: 'to write', level: 'Novice Mid',
    members: [
      { word: 'escritura', type: 'noun', meaning: 'writing, handwriting', example: 'La escritura cuneiforme.' },
      { word: 'escritor/a', type: 'noun', meaning: 'writer, author', example: 'Gabriel García Márquez fue escritor.' },
      { word: 'escrito', type: 'adjective', meaning: 'written', example: 'un examen escrito' },
    ],
  },
  leer: {
    root: 'leer', rootMeaning: 'to read', level: 'Novice Mid',
    members: [
      { word: 'lectura', type: 'noun', meaning: 'reading, a reading/text', example: 'Hora de lectura.' },
      { word: 'lector/a', type: 'noun', meaning: 'reader', example: 'un lector voraz' },
      { word: 'leído', type: 'adjective', meaning: 'read, well-read (person)', example: 'Es muy leído.' },
    ],
  },
  conocer: {
    root: 'conocer', rootMeaning: 'to know (a person/place)', level: 'Novice High',
    members: [
      { word: 'conocimiento', type: 'noun', meaning: 'knowledge, awareness', example: 'conocimiento general' },
      { word: 'conocido/a', type: 'noun', meaning: 'acquaintance', example: 'Es un conocido mío.' },
      { word: 'conocido/a', type: 'adjective', meaning: 'known, famous', example: 'un actor muy conocido' },
      { word: 'desconocer', type: 'verb', meaning: 'to not know, to be unaware of', example: 'Desconozco la respuesta.' },
    ],
    note: 'Desconocer = des + conocer. The prefix des- often means un- or the reverse of the root verb.',
  },
  poder: {
    root: 'poder', rootMeaning: 'to be able to / can', level: 'Intermediate Low',
    members: [
      { word: 'poder', type: 'noun', meaning: 'power, authority', example: 'el poder del presidente' },
      { word: 'poderoso/a', type: 'adjective', meaning: 'powerful', example: 'un ejército poderoso' },
      { word: 'poderío', type: 'noun', meaning: 'might, dominance', example: 'el poderío económico' },
    ],
    note: 'Poder functions as both the infinitive (to be able to) AND a noun (power) — same spelling, different role.',
  },
  pensar: {
    root: 'pensar', rootMeaning: 'to think', level: 'Intermediate Low',
    members: [
      { word: 'pensamiento', type: 'noun', meaning: 'thought, thinking', example: '¿Cuál es tu pensamiento?' },
      { word: 'pensador/a', type: 'noun', meaning: 'thinker (person)', example: 'Descartes fue un gran pensador.' },
      { word: 'pensativo/a', type: 'adjective', meaning: 'thoughtful, pensive', example: 'Estaba pensativa.' },
    ],
    note: 'Pensamiento also means pansy (the flower) in Spanish — same word, very different contexts!',
  },
};

// ─── HUB-AND-SPOKE SVG COMPONENT ─────────────────────────────────────────────

function WordFamilySpoke({ data }: { data: WordFamilyData }) {
  const members = data.members;
  const n = members.length;
  const cx = 200;
  const cy = 200;
  const radius = 130;
  const startAngle = -Math.PI / 2;

  const positions = members.map((_, i) => {
    const angle = startAngle + (2 * Math.PI * i) / n;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-sm mx-auto h-auto" aria-label={`Word family map for ${data.root}`}>
      {positions.map(({ x, y }, i) => {
        const member = members[i];
        const styles = CLASS_STYLES[member.type];
        return (
          <line
            key={`line-${i}`}
            x1={cx} y1={cy} x2={x} y2={y}
            stroke="hsl(var(--border))" strokeWidth="1.5"
          />
        );
      })}
      <rect x={cx - 55} y={cy - 22} width="110" height="44" rx="8"
        fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="700" className="fill-primary">{data.root}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" className="fill-muted-foreground">{data.rootMeaning}</text>
      {positions.map(({ x, y }, i) => {
        const member = members[i];
        const styles = CLASS_STYLES[member.type];
        const labelRight = x > cx + 20;
        const labelLeft = x < cx - 20;
        return (
          <g key={`node-${i}`} transform={`translate(${x},${y})`}>
            <rect x="-52" y="-20" width="104" height="40" rx="6"
              className={styles.bg} stroke="hsl(var(--border))" strokeWidth="1" />
            <text textAnchor="middle" y="2" fontSize="10" fontWeight="700" className={styles.text}>{member.word}</text>
            <text textAnchor="middle" y="14" fontSize="7.5" className="fill-muted-foreground">{member.meaning}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── FULL WORD FAMILY CARD ────────────────────────────────────────────────────

export function WordFamilyCard({ root, className = '' }: { root?: string; className?: string }) {
  const data = root ? WORD_FAMILIES[root] : null;
  if (!data) return null;
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid={`grammar-card-word-family-${data.root}`}>
      <div className="px-4 py-2.5 border-b bg-gradient-to-r from-indigo-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Word Family — Familia de palabras: <span className="text-primary">{data.root}</span></p>
        <p className="text-xs text-muted-foreground text-center">{data.rootMeaning} · {data.level}</p>
      </div>
      <div className="p-2">
        <WordFamilySpoke data={data} />
      </div>
      <div className="border-t">
        <div className="flex gap-2 px-3 py-2 flex-wrap">
          {(Object.keys(CLASS_LABELS) as WordClass[]).map(cls => (
            <span key={cls} className={`text-xs px-2 py-0.5 rounded border font-medium ${CLASS_STYLES[cls].tag}`}>{cls}</span>
          ))}
        </div>
      </div>
      <div className="border-t divide-y">
        {data.members.map((m) => {
          const styles = CLASS_STYLES[m.type];
          return (
            <div key={`${m.word}-${m.type}`} className="px-3 py-2 flex gap-3 items-baseline text-xs">
              <span className={`font-bold w-28 shrink-0 ${styles.tag} px-1.5 py-0.5 rounded border text-center`}>{m.word}</span>
              <span className="text-muted-foreground w-20 shrink-0">{CLASS_LABELS[m.type]}</span>
              <span className="text-foreground flex-1">{m.meaning}</span>
              {m.example && <span className="text-muted-foreground italic hidden md:block">{m.example}</span>}
            </div>
          );
        })}
      </div>
      {data.note && (
        <div className="px-3 py-2 border-t bg-amber-500/5 border-amber-500/20">
          <p className="text-xs text-amber-700 dark:text-amber-300">{data.note}</p>
        </div>
      )}
    </div>
  );
}

// ─── RESOLVER: pick word family from chapter title ────────────────────────────

export function resolveWordFamilyRoot(title: string): string | null {
  const lower = title.toLowerCase();
  for (const root of Object.keys(WORD_FAMILIES)) {
    if (lower.includes(root)) return root;
  }
  return null;
}
