/**
 * TextbookGermanWordFamilies.tsx
 * Section 6 — German word family reference cards.
 *
 * Families (10):
 *   sprechen (speak)  → DeSPRECHENFamilyCard
 *   lieben (love)     → DeLIEBENFamilyCard
 *   sehen (see)       → DeSEHENFamilyCard
 *   machen (make/do)  → DeMACHENFamilyCard
 *   gehen (go)        → DeGEHENFamilyCard
 *   kommen (come)     → DeKOMMENFamilyCard
 *   haben (have)      → DeHABENFamilyCard
 *   wissen (know)     → DeWISSENFamilyCard
 *   finden (find)     → DeFINDENFamilyCard
 *   denken (think)    → DeDENKENFamilyCard
 *
 * Resolver: resolveDeFamilyCard(chapterTitle)
 */

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

interface WordEntry { word: string; type: string; english: string; example?: string }

function FamilyCard({ root, rootDe, color = 'from-red-500/10', words, note }: {
  root: string;
  rootDe: string;
  color?: string;
  words: WordEntry[];
  note?: string;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={`px-4 py-3 border-b bg-gradient-to-r ${color} to-transparent`}>
        <p className="text-sm font-semibold text-center">{root} — Word Family</p>
        <p className="text-xs text-muted-foreground text-center">Root: <span className="font-mono font-medium">{rootDe}</span></p>
      </div>
      <div className="divide-y">
        {words.map(({ word, type, english, example }) => (
          <div key={word} className="flex gap-3 px-4 py-2 text-xs">
            <span className="font-semibold min-w-36 shrink-0">{word}</span>
            <span className="text-muted-foreground min-w-24 shrink-0 italic">{type}</span>
            <div>
              <span>{english}</span>
              {example && <p className="text-muted-foreground mt-0.5">{example}</p>}
            </div>
          </div>
        ))}
      </div>
      {note && (
        <div className="px-4 py-2.5 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">{note}</p>
        </div>
      )}
    </div>
  );
}

// ─── SPRECHEN ─────────────────────────────────────────────────────────────────

export function DeSPRECHENFamilyCard() {
  return (
    <FamilyCard
      root="sprechen"
      rootDe="sprech- / sprach-"
      color="from-red-500/10"
      note="sprechen has a vowel change: ich spreche, du sprichst, er spricht. Prät: sprach. Perfekt: gesprochen."
      words={[
        { word: 'sprechen', type: 'verb', english: 'to speak', example: 'Sprechen Sie Deutsch?' },
        { word: 'ansprechen', type: 'verb (sep.)', english: 'to address, speak to', example: 'Er spricht mich an.' },
        { word: 'besprechen', type: 'verb (insep.)', english: 'to discuss', example: 'Wir besprechen das Thema.' },
        { word: 'versprechen', type: 'verb (insep.)', english: 'to promise', example: 'Ich verspreche es dir.' },
        { word: 'die Sprache', type: 'noun (f.)', english: 'language', example: 'Die deutsche Sprache.' },
        { word: 'der Sprecher', type: 'noun (m.)', english: 'speaker', example: 'der Sprecher im Radio' },
        { word: 'das Gespräch', type: 'noun (n.)', english: 'conversation', example: 'ein Gespräch führen' },
        { word: 'sprachlich', type: 'adjective', english: 'linguistic, language-related', example: 'sprachliche Fähigkeiten' },
        { word: 'die Aussprache', type: 'noun (f.)', english: 'pronunciation / discussion', example: 'gute Aussprache haben' },
      ]}
    />
  );
}

// ─── LIEBEN ───────────────────────────────────────────────────────────────────

export function DeLIEBENFamilyCard() {
  return (
    <FamilyCard
      root="lieben"
      rootDe="lieb-"
      color="from-pink-500/10"
      note="lieben is a weak (regular) verb. lieb as adjective means dear/kind. Liebe as noun = love."
      words={[
        { word: 'lieben', type: 'verb', english: 'to love', example: 'Ich liebe dich.' },
        { word: 'die Liebe', type: 'noun (f.)', english: 'love', example: 'die Liebe auf den ersten Blick' },
        { word: 'lieb', type: 'adjective', english: 'dear, kind, sweet', example: 'Lieber Hans, … (letter opening)' },
        { word: 'liebevoll', type: 'adjective', english: 'loving, affectionate', example: 'eine liebevolle Mutter' },
        { word: 'verliebt', type: 'adjective', english: 'in love', example: 'Ich bin verliebt.' },
        { word: 'sich verlieben', type: 'verb (refl.)', english: 'to fall in love', example: 'Sie haben sich verliebt.' },
        { word: 'der Liebling', type: 'noun (m.)', english: 'darling, favourite', example: 'Du bist mein Liebling.' },
        { word: 'Lieblingsfarbe', type: 'noun (f.)', english: 'favourite colour', example: 'Was ist deine Lieblingsfarbe?' },
        { word: 'lieblich', type: 'adjective', english: 'lovely, sweet (taste/scenery)', example: 'ein lieblicher Wein' },
      ]}
    />
  );
}

// ─── SEHEN ────────────────────────────────────────────────────────────────────

export function DeSEHENFamilyCard() {
  return (
    <FamilyCard
      root="sehen"
      rootDe="seh- / sah- / gesehen"
      color="from-blue-500/10"
      note="sehen has a vowel change: du siehst, er sieht. Prät: sah. Perfekt: hat gesehen."
      words={[
        { word: 'sehen', type: 'verb', english: 'to see', example: 'Ich sehe es nicht.' },
        { word: 'ansehen', type: 'verb (sep.)', english: 'to look at, watch', example: 'Wir sehen einen Film an.' },
        { word: 'aussehen', type: 'verb (sep.)', english: 'to look (appearance)', example: 'Du siehst gut aus!' },
        { word: 'fernsehen', type: 'verb (sep.)', english: 'to watch TV', example: 'Er sieht viel fern.' },
        { word: 'das Sehen', type: 'noun (n.)', english: 'sight, seeing', example: 'auf Wiedersehen!' },
        { word: 'die Sehenswürdigkeit', type: 'noun (f.)', english: 'sight, tourist attraction', example: 'die Sehenswürdigkeiten Berlins' },
        { word: 'sichtbar', type: 'adjective', english: 'visible', example: 'sichtbare Fortschritte' },
        { word: 'unsichtbar', type: 'adjective', english: 'invisible', example: 'unsichtbare Kräfte' },
        { word: 'das Gesicht', type: 'noun (n.)', english: 'face (from sehen)', example: 'ein schönes Gesicht' },
      ]}
    />
  );
}

// ─── MACHEN ───────────────────────────────────────────────────────────────────

export function DeMACHENFamilyCard() {
  return (
    <FamilyCard
      root="machen"
      rootDe="mach-"
      color="from-amber-500/10"
      note="machen is a regular weak verb — the most versatile 'do/make' verb in German."
      words={[
        { word: 'machen', type: 'verb', english: 'to do, make', example: 'Was machst du?' },
        { word: 'aufmachen', type: 'verb (sep.)', english: 'to open', example: 'Mach die Tür auf!' },
        { word: 'zumachen', type: 'verb (sep.)', english: 'to close', example: 'Mach das Fenster zu.' },
        { word: 'anmachen', type: 'verb (sep.)', english: 'to turn on', example: 'Mach das Licht an.' },
        { word: 'ausmachen', type: 'verb (sep.)', english: 'to turn off / arrange', example: 'Mach das Radio aus.' },
        { word: 'die Macht', type: 'noun (f.)', english: 'power, might', example: 'politische Macht' },
        { word: 'mächtig', type: 'adjective', english: 'powerful, mighty', example: 'ein mächtiger Staat' },
        { word: 'machbar', type: 'adjective', english: 'feasible, doable', example: 'Das ist machbar.' },
        { word: 'Nichts zu machen', type: 'expression', english: 'Nothing to be done / no problem', example: 'Nichts zu machen! — Can\'t be helped.' },
      ]}
    />
  );
}

// ─── GEHEN ────────────────────────────────────────────────────────────────────

export function DeGEHENFamilyCard() {
  return (
    <FamilyCard
      root="gehen"
      rootDe="geh- / ging- / gegangen"
      color="from-green-500/10"
      note="gehen is irregular (strong). Prät: ging. Perfekt: ist gegangen (uses SEIN). Also: Wie geht es dir? = How are you?"
      words={[
        { word: 'gehen', type: 'verb', english: 'to go, walk', example: 'Ich gehe in die Schule.' },
        { word: 'angehen', type: 'verb (sep.)', english: 'to concern / turn on', example: 'Das geht dich nichts an.' },
        { word: 'ausgehen', type: 'verb (sep.)', english: 'to go out', example: 'Wir gehen heute Abend aus.' },
        { word: 'eingehen', type: 'verb (sep.)', english: 'to enter into / go in', example: 'auf ein Thema eingehen' },
        { word: 'vergehen', type: 'verb (insep.)', english: 'to pass (time), fade', example: 'Die Zeit vergeht schnell.' },
        { word: 'spazieren gehen', type: 'verb phrase', english: 'to go for a walk', example: 'Gehen wir spazieren!' },
        { word: 'der Gang', type: 'noun (m.)', english: 'hallway, gear, gait', example: 'erster Gang (first gear)' },
        { word: 'der Ausgang', type: 'noun (m.)', english: 'exit, outcome', example: 'Wo ist der Ausgang?' },
        { word: 'der Eingang', type: 'noun (m.)', english: 'entrance, entry', example: 'am Eingang warten' },
      ]}
    />
  );
}

// ─── KOMMEN ───────────────────────────────────────────────────────────────────

export function DeKOMMENFamilyCard() {
  return (
    <FamilyCard
      root="kommen"
      rootDe="komm- / kam- / gekommen"
      color="from-violet-500/10"
      note="kommen is a strong verb. Prät: kam. Perfekt: ist gekommen (uses SEIN — motion verb)."
      words={[
        { word: 'kommen', type: 'verb', english: 'to come', example: 'Woher kommst du?' },
        { word: 'ankommen', type: 'verb (sep.)', english: 'to arrive', example: 'Der Zug kommt um 9 an.' },
        { word: 'bekommen', type: 'verb (insep.)', english: 'to get, receive', example: 'Ich bekomme ein Paket.' },
        { word: 'vorkommen', type: 'verb (sep.)', english: 'to occur, seem', example: 'Das kommt mir seltsam vor.' },
        { word: 'zurückkommen', type: 'verb (sep.)', english: 'to come back', example: 'Wann kommst du zurück?' },
        { word: 'mitkommen', type: 'verb (sep.)', english: 'to come along', example: 'Kommst du mit?' },
        { word: 'die Ankunft', type: 'noun (f.)', english: 'arrival', example: 'Ankunft: 14:30 Uhr' },
        { word: 'der Einkomme', type: 'noun (m.)', english: 'income (Einkommen)', example: 'ein gutes Einkommen' },
        { word: 'willkommen', type: 'adjective/interj.', english: 'welcome', example: 'Herzlich willkommen!' },
      ]}
    />
  );
}

// ─── HABEN (WORD FAMILY) ──────────────────────────────────────────────────────

export function DeHABENFamilyCard() {
  return (
    <FamilyCard
      root="haben"
      rootDe="hab- / hat- / gehabt"
      color="from-amber-500/10"
      note="haben is slightly irregular. Also note: das Habit (habit), die Habe (belongings/property) share the Latin root."
      words={[
        { word: 'haben', type: 'verb', english: 'to have', example: 'Ich habe Hunger.' },
        { word: 'enthalten', type: 'verb (insep.)', english: 'to contain', example: 'Das enthält Gluten.' },
        { word: 'verhalten (sich)', type: 'verb (refl.)', english: 'to behave', example: 'Verhalte dich ruhig.' },
        { word: 'das Verhalten', type: 'noun (n.)', english: 'behavior', example: 'gutes Verhalten zeigen' },
        { word: 'die Habe', type: 'noun (f.)', english: 'belongings, property (formal)', example: 'all seine Habe' },
        { word: 'der Inhalt', type: 'noun (m.)', english: 'content, contents', example: 'der Inhalt des Buches' },
        { word: 'innehaben', type: 'verb (sep.)', english: 'to hold (a position)', example: 'Er hat das Amt inne.' },
        { word: 'Hab und Gut', type: 'expression', english: 'all one\'s worldly goods', example: 'Er verlor Hab und Gut.' },
        { word: 'die Habgier', type: 'noun (f.)', english: 'greed, avarice', example: 'von Habgier getrieben' },
      ]}
    />
  );
}

// ─── WISSEN ───────────────────────────────────────────────────────────────────

export function DeWISSENFamilyCard() {
  return (
    <FamilyCard
      root="wissen"
      rootDe="wiss- / wusst- / gewusst"
      color="from-teal-500/10"
      note="wissen = to know (facts). Kennen = to know (people/places). ich weiß, du weißt, er weiß (irregular present)."
      words={[
        { word: 'wissen', type: 'verb', english: 'to know (facts)', example: 'Ich weiß es nicht.' },
        { word: 'das Wissen', type: 'noun (n.)', english: 'knowledge', example: 'sein Wissen erweitern' },
        { word: 'die Wissenschaft', type: 'noun (f.)', english: 'science', example: 'Naturwissenschaft — natural science' },
        { word: 'der Wissenschaftler', type: 'noun (m.)', english: 'scientist', example: 'ein Wissenschaftler forscht' },
        { word: 'wissentlich', type: 'adjective/adverb', english: 'knowingly, deliberately', example: 'wissentlich lügen' },
        { word: 'unwissentlich', type: 'adjective/adverb', english: 'unknowingly', example: 'unwissentlich falsch liegen' },
        { word: 'das Gewissen', type: 'noun (n.)', english: 'conscience', example: 'ein schlechtes Gewissen haben' },
        { word: 'gewissenhaft', type: 'adjective', english: 'conscientious', example: 'gewissenhafte Arbeit' },
        { word: 'bewusst', type: 'adjective', english: 'conscious, aware, deliberate', example: 'sich bewusst sein' },
      ]}
    />
  );
}

// ─── FINDEN ───────────────────────────────────────────────────────────────────

export function DeFINDENFamilyCard() {
  return (
    <FamilyCard
      root="finden"
      rootDe="find- / fand- / gefunden"
      color="from-orange-500/10"
      note="finden is a strong verb. Prät: fand. Perfekt: hat gefunden. Also means 'to think/feel about something'."
      words={[
        { word: 'finden', type: 'verb', english: 'to find / think', example: 'Ich finde das schön.' },
        { word: 'stattfinden', type: 'verb (sep.)', english: 'to take place, occur', example: 'Das Konzert findet statt.' },
        { word: 'erfinden', type: 'verb (insep.)', english: 'to invent', example: 'Wer hat das Telefon erfunden?' },
        { word: 'empfinden', type: 'verb (insep.)', english: 'to feel, sense', example: 'Ich empfinde Freude.' },
        { word: 'der Fund', type: 'noun (m.)', english: 'find, discovery', example: 'ein archäologischer Fund' },
        { word: 'der Erfinder', type: 'noun (m.)', english: 'inventor', example: 'Einstein war ein Erfinder.' },
        { word: 'die Erfindung', type: 'noun (f.)', english: 'invention', example: 'eine bahnbrechende Erfindung' },
        { word: 'das Empfinden', type: 'noun (n.)', english: 'feeling, perception', example: 'feines Empfinden haben' },
        { word: 'das Fundbüro', type: 'noun (n.)', english: 'lost and found office', example: 'Gehen Sie zum Fundbüro.' },
      ]}
    />
  );
}

// ─── DENKEN ───────────────────────────────────────────────────────────────────

export function DeDENKENFamilyCard() {
  return (
    <FamilyCard
      root="denken"
      rootDe="denk- / dacht- / gedacht"
      color="from-indigo-500/10"
      note="denken is a mixed verb: regular endings but vowel change. Prät: dachte. Perfekt: hat gedacht."
      words={[
        { word: 'denken', type: 'verb', english: 'to think', example: 'Ich denke, also bin ich.' },
        { word: 'nachdenken', type: 'verb (sep.)', english: 'to think about, reflect', example: 'Denk darüber nach!' },
        { word: 'bedenken', type: 'verb (insep.)', english: 'to consider, bear in mind', example: 'Bedenke die Konsequenzen.' },
        { word: 'umdenken', type: 'verb (sep.)', english: 'to rethink, change mindset', example: 'Wir müssen umdenken.' },
        { word: 'der Gedanke', type: 'noun (m.)', english: 'thought, idea', example: 'ein guter Gedanke' },
        { word: 'das Denken', type: 'noun (n.)', english: 'thinking, thought process', example: 'kritisches Denken' },
        { word: 'denkbar', type: 'adjective', english: 'conceivable, imaginable', example: 'denkbar einfach — extremely simple' },
        { word: 'das Andenken', type: 'noun (n.)', english: 'souvenir, keepsake', example: 'ein Andenken kaufen' },
        { word: 'das Denkmal', type: 'noun (n.)', english: 'monument, memorial', example: 'das Holocaust-Denkmal' },
      ]}
    />
  );
}

// ─── RESOLVER ─────────────────────────────────────────────────────────────────

export function resolveDeFamilyCard(chapterTitle: string): React.ReactNode {
  const lower = chapterTitle.toLowerCase();
  if (lower.includes('sprech') || lower.includes('sprach') || lower.includes('speak') || lower.includes('sprach')) return <DeSPRECHENFamilyCard />;
  if (lower.includes('lieb') || lower.includes('love')) return <DeLIEBENFamilyCard />;
  if (lower.includes('seh') || lower.includes('see') || lower.includes('sicht') || lower.includes('gesicht')) return <DeSEHENFamilyCard />;
  if (lower.includes('mach') || lower.includes('macht') || lower.includes('make') || lower.includes('do')) return <DeMACHENFamilyCard />;
  if (lower.includes('geh') || lower.includes('gang') || lower.includes('go')) return <DeGEHENFamilyCard />;
  if (lower.includes('komm') || lower.includes('come') || lower.includes('ankunft') || lower.includes('arrival')) return <DeKOMMENFamilyCard />;
  if (lower.includes('hab') || lower.includes('inhalt') || lower.includes('have')) return <DeHABENFamilyCard />;
  if (lower.includes('wiss') || lower.includes('wiss') || lower.includes('know') || lower.includes('wissensch')) return <DeWISSENFamilyCard />;
  if (lower.includes('find') || lower.includes('erfind') || lower.includes('found')) return <DeFINDENFamilyCard />;
  if (lower.includes('denk') || lower.includes('gedank') || lower.includes('think')) return <DeDENKENFamilyCard />;
  return <DeSPRECHENFamilyCard />;
}
