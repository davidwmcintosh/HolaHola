/**
 * TextbookItalianWordFamilies.tsx
 * Section 6 — Italian word family reference cards.
 *
 * Families (10):
 *   parlare (speak)  → ItPARLAREFamilyCard
 *   essere (be)      → ItESSEREFamilyCard
 *   avere (have)     → ItAVEREFamilyCard
 *   fare (do/make)   → ItFAREFamilyCard
 *   andare (go)      → ItANDAREFamilyCard
 *   venire (come)    → ItVENIREFamilyCard
 *   vedere (see)     → ItVEDEREFamilyCard
 *   sapere (know)    → ItSAPEREFamilyCard
 *   trovare (find)   → ItTROVAREFamilyCard
 *   pensare (think)  → ItPENSAREFamilyCard
 *
 * Resolver: resolveItFamilyCard(chapterTitle)
 */

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

interface WordEntry { word: string; type: string; english: string; example?: string }

function FamilyCard({ root, rootIt, color = 'from-green-500/10', words, note }: {
  root: string;
  rootIt: string;
  color?: string;
  words: WordEntry[];
  note?: string;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={`px-4 py-3 border-b bg-gradient-to-r ${color} to-transparent`}>
        <p className="text-sm font-semibold text-center">{root} — Word Family</p>
        <p className="text-xs text-muted-foreground text-center">Root: <span className="font-mono font-medium">{rootIt}</span></p>
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
          <p className="text-xs text-muted-foreground italic">{note}</p>
        </div>
      )}
    </div>
  );
}

// ─── PARLARE ──────────────────────────────────────────────────────────────────

export function ItPARLAREFamilyCard() {
  return (
    <FamilyCard
      root="PARLARE"
      rootIt="parl-"
      color="from-green-500/10"
      words={[
        { word: 'parlare', type: 'verbo', english: 'to speak, to talk', example: 'Parli italiano? — Do you speak Italian?' },
        { word: 'parlato', type: 'participio / agg.', english: 'spoken; past participle', example: 'Ho parlato con lui. — I spoke with him.' },
        { word: 'la parola', type: 'sostantivo (f.)', english: 'word', example: 'Non capisco questa parola.' },
        { word: 'le parole', type: 'sostantivo (f. pl.)', english: 'words; lyrics', example: 'Le parole di questa canzone...' },
        { word: 'il parlare', type: 'sostantivo (m.)', english: 'speaking, talk, speech', example: 'Il parlare troppo stanca.' },
        { word: 'il parlamento', type: 'sostantivo (m.)', english: 'parliament', example: 'Il Parlamento italiano ha due camere.' },
        { word: 'il parlamentare', type: 'sost. / agg.', english: 'parliamentarian; parliamentary', example: 'Un dibattito parlamentare.' },
        { word: 'la parlata', type: 'sostantivo (f.)', english: 'dialect, local speech', example: 'La parlata siciliana è unica.' },
        { word: 'il parlante', type: 'sostantivo (m.)', english: 'speaker (person)', example: 'Un parlante nativo di italiano.' },
        { word: 'sparlaare di', type: 'verbo', english: 'to badmouth, gossip about', example: 'Smettila di sparlare degli altri!' },
        { word: 'il pourparler', type: 'locuzione', english: 'talks, negotiations (from Fr.)', example: 'I pourparler diplomatici.' },
      ]}
      note="PARL- is the core Italian root. Note: 'la lingua' (language/tongue) and 'il discorso' (speech/discourse) are related vocabulary."
    />
  );
}

// ─── ESSERE ───────────────────────────────────────────────────────────────────

export function ItESSEREFamilyCard() {
  return (
    <FamilyCard
      root="ESSERE"
      rootIt="ess- / en- / -ente"
      color="from-blue-500/10"
      words={[
        { word: "essere", type: 'verbo', english: 'to be', example: 'Sono italiano. — I am Italian.' },
        { word: "l'essere", type: 'sostantivo (m.)', english: 'being, existence; creature', example: "Gli esseri umani. — Human beings." },
        { word: "l'essenza", type: 'sostantivo (f.)', english: 'essence, core nature', example: "L'essenza dell'arte." },
        { word: 'essenziale', type: 'aggettivo', english: 'essential, fundamental', example: 'È essenziale studiare ogni giorno.' },
        { word: 'essenzialmente', type: 'avverbio', english: 'essentially, fundamentally', example: 'È essenzialmente un problema di comunicazione.' },
        { word: "l'entità", type: 'sostantivo (f.)', english: 'entity, extent', example: "L'entità del danno è grande." },
        { word: 'presente', type: 'agg. / sost.', english: 'present; gift', example: 'Sei presente alla riunione?' },
        { word: 'assente', type: 'agg. / sost.', english: 'absent', example: 'È assente oggi.' },
        { word: "l'assenza", type: 'sostantivo (f.)', english: 'absence', example: "La sua assenza ci dispiace." },
        { word: "la presenza", type: 'sostantivo (f.)', english: 'presence', example: "La sua presenza è rassicurante." },
      ]}
      note="ESSERE is the most fundamental Italian verb. Its Latin root esse connects to English 'essence,' 'entity,' 'present,' 'absent.'"
    />
  );
}

// ─── AVERE ────────────────────────────────────────────────────────────────────

export function ItAVEREFamilyCard() {
  return (
    <FamilyCard
      root="AVERE"
      rootIt="av- / -abile / -abilità"
      color="from-amber-500/10"
      words={[
        { word: 'avere', type: 'verbo', english: 'to have', example: 'Ho un fratello. — I have a brother.' },
        { word: "l'avere", type: 'sostantivo (m.)', english: 'assets, possessions; credit (accounting)', example: "Dare e avere — debit and credit." },
        { word: "l'avere bisogno di", type: 'locuzione verbale', english: 'to need', example: "Ho bisogno di aiuto." },
        { word: "l'avventura", type: 'sostantivo (f.)', english: 'adventure; affair', example: "Che avventura! — What an adventure!" },
        { word: "l'avvenire", type: 'sostantivo (m.)', english: 'the future', example: "Pensare all'avvenire." },
        { word: "l'avvento", type: 'sostantivo (m.)', english: 'advent, arrival', example: "L'avvento della tecnologia." },
        { word: 'avvenire', type: 'verbo', english: 'to happen, to occur', example: "Cosa è avvenuto? — What happened?" },
        { word: "l'avversario", type: 'sostantivo (m.)', english: 'adversary, opponent', example: "Un avversario temibile." },
        { word: "l'avvenimento", type: 'sostantivo (m.)', english: 'event, occurrence', example: "Un avvenimento storico." },
        { word: 'avere voglia di', type: 'locuzione verbale', english: 'to feel like, to want to', example: "Ho voglia di pizza!" },
      ]}
      note="AVERE derives from Latin habere. Many Italian expressions use avere where English uses 'to be': avere fame (to be hungry), avere caldo (to be hot)."
    />
  );
}

// ─── FARE ─────────────────────────────────────────────────────────────────────

export function ItFAREFamilyCard() {
  return (
    <FamilyCard
      root="FARE"
      rootIt="far- / fatt- / -fazione"
      color="from-orange-500/10"
      words={[
        { word: 'fare', type: 'verbo', english: 'to do, to make', example: 'Cosa fai? — What are you doing?' },
        { word: 'il fatto', type: 'sostantivo (m.)', english: 'fact, event; done', example: 'Il fatto è che... — The fact is that...' },
        { word: 'fatto/a', type: 'aggettivo / participio', english: 'made, done', example: 'Fatto in Italia — Made in Italy.' },
        { word: 'la fattoria', type: 'sostantivo (f.)', english: 'farm, farmhouse', example: 'Una bella fattoria in Toscana.' },
        { word: 'il fattore', type: 'sostantivo (m.)', english: 'factor, element', example: 'Un fattore decisivo.' },
        { word: 'la soddisfazione', type: 'sostantivo (f.)', english: 'satisfaction', example: 'Grande soddisfazione personale.' },
        { word: 'soddisfare', type: 'verbo', english: 'to satisfy', example: 'Questo non mi soddisfa.' },
        { word: "l'affari (pl.)", type: 'sostantivo (m. pl.)', english: 'business, affairs, things', example: 'Come vanno gli affari? — How is business?' },
        { word: 'la manifattura', type: 'sostantivo (f.)', english: 'manufacturing, manufacture', example: 'La manifattura italiana è rinomata.' },
        { word: 'fare bella figura', type: 'locuzione', english: 'to make a good impression', example: 'In Italia è importante fare bella figura.' },
      ]}
      note="FARE is one of the most irregular Italian verbs (faccio, fai, fa, facciamo, fate, fanno) but also one of the most used. 'Fare' = to do + to make + many weather expressions."
    />
  );
}

// ─── ANDARE ───────────────────────────────────────────────────────────────────

export function ItANDAREFamilyCard() {
  return (
    <FamilyCard
      root="ANDARE"
      rootIt="and- / -ata"
      color="from-cyan-500/10"
      words={[
        { word: 'andare', type: 'verbo', english: 'to go', example: 'Dove vai? — Where are you going?' },
        { word: "l'andata", type: 'sostantivo (f.)', english: 'outward journey, departure', example: 'Un biglietto di sola andata. — A one-way ticket.' },
        { word: "l'andata e ritorno", type: 'locuzione', english: 'round trip', example: 'Vorrei un biglietto A/R.' },
        { word: "l'andamento", type: 'sostantivo (m.)', english: 'trend, progress, development', example: "L'andamento del mercato." },
        { word: 'andare bene', type: 'locuzione verbale', english: 'to be fine, to work', example: 'Va bene! — OK! / That works!' },
        { word: 'andare via', type: 'locuzione verbale', english: 'to go away, to leave', example: 'Devo andare via. — I have to go.' },
        { word: 'andare a + inf.', type: 'costrutto', english: 'to be going to (near future)', example: 'Vado a mangiare. — I am going to eat.' },
        { word: 'andarci', type: 'verbo pronominale', english: 'to go there', example: 'Ci vado spesso. — I go there often.' },
        { word: 'andarsene', type: 'verbo pronominale', english: 'to go away, to leave (emphatic)', example: 'Me ne vado! — I am out of here!' },
        { word: "l'andatura", type: 'sostantivo (f.)', english: 'gait, pace, speed', example: "Camminare con un'andatura sicura." },
      ]}
      note="ANDARE is irregular: vado, vai, va, andiamo, andate, vanno. As a motion verb, it uses ESSERE as auxiliary in passato prossimo: sono andato/a."
    />
  );
}

// ─── VENIRE ───────────────────────────────────────────────────────────────────

export function ItVENIREFamilyCard() {
  return (
    <FamilyCard
      root="VENIRE"
      rootIt="ven- / -venire / -vento"
      color="from-violet-500/10"
      words={[
        { word: 'venire', type: 'verbo', english: 'to come', example: 'Vieni con me! — Come with me!' },
        { word: 'la venuta', type: 'sostantivo (f.)', english: 'arrival, coming', example: 'La venuta di primavera.' },
        { word: "l'avvenire", type: 'sostantivo (m.)', english: 'the future (lit. that which comes)', example: "Pensare all'avvenire." },
        { word: 'avvenire', type: 'verbo', english: 'to happen, to occur', example: "È avvenuto qualcosa di strano." },
        { word: 'convenire', type: 'verbo', english: 'to be convenient, to agree', example: 'Conviene aspettare. — It is better to wait.' },
        { word: 'la convenienza', type: 'sostantivo (f.)', english: 'convenience; advantage; bargain', example: 'Comprare per convenienza.' },
        { word: "l'avvento", type: 'sostantivo (m.)', english: 'advent, arrival (formal/religious)', example: "L'avvento del Natale." },
        { word: "l'evento", type: 'sostantivo (m.)', english: 'event', example: 'Un evento importante.' },
        { word: "l'inventore / l'invenzione", type: 'sost.', english: 'inventor / invention', example: "Un'invenzione straordinaria." },
        { word: 'prevenire', type: 'verbo', english: 'to prevent', example: 'Prevenire è meglio che curare. — Prevention is better than cure.' },
      ]}
      note="VENIRE is irregular: vengo, vieni, viene, veniamo, venite, vengono. Uses ESSERE as auxiliary: sono venuto/a. Latin root venire is ancestor of 'venue,' 'event,' 'advent,' 'prevention' in English."
    />
  );
}

// ─── VEDERE ───────────────────────────────────────────────────────────────────

export function ItVEDEREFamilyCard() {
  return (
    <FamilyCard
      root="VEDERE"
      rootIt="ved- / vis- / -visione"
      color="from-teal-500/10"
      words={[
        { word: 'vedere', type: 'verbo', english: 'to see', example: 'Hai visto quel film? — Have you seen that film?' },
        { word: 'visto / veduto', type: 'participio passato', english: 'seen (past participle)', example: 'Ho visto tutto. — I have seen everything.' },
        { word: 'la vista', type: 'sostantivo (f.)', english: 'sight, vision, view', example: 'Che bella vista! — What a beautiful view!' },
        { word: 'visibile', type: 'aggettivo', english: 'visible', example: 'Le stelle sono visibili stanotte.' },
        { word: 'invisibile', type: 'aggettivo', english: 'invisible', example: 'Un fantasma invisibile.' },
        { word: 'la visione', type: 'sostantivo (f.)', english: 'vision, viewing, sight', example: 'Una visione chiara del futuro.' },
        { word: 'la televisione', type: 'sostantivo (f.)', english: 'television', example: 'Guardo la televisione la sera.' },
        { word: 'la visita', type: 'sostantivo (f.)', english: 'visit; medical check-up', example: 'Ho una visita medica domani.' },
        { word: 'visitare', type: 'verbo', english: 'to visit; to examine (medical)', example: 'Voglio visitare Roma.' },
        { word: 'il pregiudizio', type: 'sostantivo (m.)', english: 'prejudice (pre-judging)', example: 'Senza pregiudizi — without prejudice.' },
      ]}
      note="VEDERE has irregular past participle: visto (also veduto). Latin root videre gives English: vision, visible, television, visit, evidence, video, vista."
    />
  );
}

// ─── SAPERE ───────────────────────────────────────────────────────────────────

export function ItSAPEREFamilyCard() {
  return (
    <FamilyCard
      root="SAPERE"
      rootIt="sap- / sav- / -sapore"
      color="from-rose-500/10"
      words={[
        { word: 'sapere', type: 'verbo', english: 'to know (facts, how to)', example: 'Lo so! — I know it! / Sai ballare? — Do you know how to dance?' },
        { word: "la sapienza", type: 'sostantivo (f.)', english: 'wisdom, knowledge (formal)', example: 'La sapienza degli anziani.' },
        { word: 'sapiente', type: 'aggettivo', english: 'wise, learned, knowledgeable', example: 'Un professore sapiente.' },
        { word: 'il sapere', type: 'sostantivo (m.)', english: 'knowledge, learning, wisdom', example: 'Il sapere è potere. — Knowledge is power.' },
        { word: 'il sapore', type: 'sostantivo (m.)', english: 'taste, flavour', example: 'Che buon sapore! — What a great taste!' },
        { word: 'saporito', type: 'aggettivo', english: 'tasty, flavorful', example: 'Un piatto molto saporito.' },
        { word: 'insapore', type: 'aggettivo', english: 'tasteless, bland', example: 'Un cibo insapore.' },
        { word: 'saputo', type: 'aggettivo', english: 'known; know-it-all (colloquial)', example: 'Lo sapevo! — I knew it! / Un saputo — a know-it-all.' },
        { word: 'la consapevolezza', type: 'sostantivo (f.)', english: 'awareness, consciousness', example: 'La consapevolezza di sé.' },
        { word: 'inconsapevole', type: 'aggettivo', english: 'unaware, unconscious', example: 'Era inconsapevole del pericolo.' },
      ]}
      note="SAPERE is irregular: so, sai, sa, sappiamo, sapete, sanno. Note: sapere = to know facts/how to; conoscere = to know people/places. Latin root sapio also gives 'sapient,' 'savvy,' 'sage' in English."
    />
  );
}

// ─── TROVARE ──────────────────────────────────────────────────────────────────

export function ItTROVAREFamilyCard() {
  return (
    <FamilyCard
      root="TROVARE"
      rootIt="trov-"
      color="from-indigo-500/10"
      words={[
        { word: 'trovare', type: 'verbo', english: 'to find', example: 'Ho trovato le chiavi! — I found the keys!' },
        { word: 'trovarsi', type: 'verbo pron.', english: 'to be located; to feel (somewhere)', example: 'Come ti trovi a Roma? — How do you find it in Rome?' },
        { word: 'il trovatore', type: 'sostantivo (m.)', english: 'troubadour (medieval poet-musician)', example: "Il trovatore — famous Verdi opera." },
        { word: "la trovata", type: 'sostantivo (f.)', english: 'bright idea, clever solution, gimmick', example: "Che trovata geniale! — What a brilliant idea!" },
        { word: 'ritrovare', type: 'verbo', english: 'to find again; to rediscover', example: 'Ho ritrovato un vecchio amico.' },
        { word: 'il ritrovamento', type: 'sostantivo (m.)', english: 'discovery, find (archaeology)', example: 'Un ritrovamento archeologico.' },
        { word: 'ritrovarsi', type: 'verbo pron.', english: 'to find oneself; to meet up again', example: 'Ci ritroviamo alle sei. — We meet up at six.' },
        { word: 'trovare da ridire', type: 'locuzione', english: 'to find fault with', example: 'Trova sempre da ridire.' },
        { word: 'scoprire', type: 'verbo (correlato)', english: 'to discover (related concept)', example: 'Scoprire qualcosa di nuovo.' },
        { word: 'la scoperta', type: 'sostantivo (f.)', english: 'discovery', example: 'Una grande scoperta scientifica.' },
      ]}
      note="TROVARE is a regular -are verb. The prefix ri- (like English re-) adds the idea of 'again': ritrovare = to find again. The word 'troubadour' comes from this family via Old Occitan."
    />
  );
}

// ─── PENSARE ──────────────────────────────────────────────────────────────────

export function ItPENSAREFamilyCard() {
  return (
    <FamilyCard
      root="PENSARE"
      rootIt="pens- / pens-iero"
      color="from-pink-500/10"
      words={[
        { word: 'pensare', type: 'verbo', english: 'to think', example: 'Cosa pensi? — What do you think?' },
        { word: 'pensare a', type: 'locuzione verbale', english: 'to think about (someone/something)', example: 'Penso a te. — I think of you.' },
        { word: 'pensare di + inf.', type: 'costrutto', english: 'to intend/plan to', example: 'Penso di andare. — I intend to go.' },
        { word: 'il pensiero', type: 'sostantivo (m.)', english: 'thought; worry; small gift', example: 'Un bel pensiero! — A nice thought / sweet gesture!' },
        { word: "il pensatore / la pensatrice", type: 'sost.', english: 'thinker', example: "Il Pensatore di Rodin." },
        { word: 'pensieroso/a', type: 'aggettivo', english: 'thoughtful, pensive', example: 'Sembri pensieroso. — You seem thoughtful.' },
        { word: 'ripensare', type: 'verbo', english: 'to rethink; to think back', example: 'Ripensandoci... — Thinking about it again...' },
        { word: 'ripensamento', type: 'sostantivo (m.)', english: 'second thought, change of mind', example: 'Ho avuto un ripensamento.' },
        { word: 'ripensarci', type: 'verbo pron.', english: 'to change one\'s mind', example: 'Ho ripensato. — I changed my mind.' },
        { word: 'il compenso', type: 'sostantivo (m.)', english: 'compensation, fee, payment', example: 'In compenso... — On the other hand...' },
      ]}
      note="PENSARE is a regular -are verb. Latin root pensare (to weigh, consider) also gives English: pensive, pension, compensate, expense, ponder."
    />
  );
}

// ─── RESOLVER ─────────────────────────────────────────────────────────────────

export function resolveItFamilyCard(chapterTitle: string): React.ReactElement | null {
  const t = chapterTitle.toLowerCase();
  if (t.includes('parlare') || t.includes('speak') || t.includes('parola')) return <ItPARLAREFamilyCard />;
  if (t.includes('essere') || t.includes('essere') || t.includes('to be')) return <ItESSEREFamilyCard />;
  if (t.includes('avere') || t.includes('have') || t.includes('to have')) return <ItAVEREFamilyCard />;
  if (t.includes('fare') || t.includes('do') || t.includes('make')) return <ItFAREFamilyCard />;
  if (t.includes('andare') || t.includes('go') || t.includes('andata')) return <ItANDAREFamilyCard />;
  if (t.includes('venire') || t.includes('come') || t.includes('venuta')) return <ItVENIREFamilyCard />;
  if (t.includes('vedere') || t.includes('see') || t.includes('vista')) return <ItVEDEREFamilyCard />;
  if (t.includes('sapere') || t.includes('know') || t.includes('sapore')) return <ItSAPEREFamilyCard />;
  if (t.includes('trovare') || t.includes('find') || t.includes('trova')) return <ItTROVAREFamilyCard />;
  if (t.includes('pensare') || t.includes('think') || t.includes('pensiero')) return <ItPENSAREFamilyCard />;
  return <ItPARLAREFamilyCard />;
}
