/**
 * TextbookPortugueseWordFamilies.tsx
 * Portuguese word family cards for Textbook Section 6.
 * Uses the same hub-and-spoke WordFamilyCard component pattern.
 *
 * Exports (10 family cards + resolver):
 *  PtFalarFamilyCard    — falar (to speak)
 *  PtAmarFamilyCard     — amar (to love)
 *  PtVerFamilyCard      — ver (to see)
 *  PtFazerFamilyCard    — fazer (to do/make)
 *  PtDizerFamilyCard    — dizer (to say)
 *  PtIrFamilyCard       — ir (to go)
 *  PtVirFamilyCard      — vir (to come)
 *  PtTomarFamilyCard    — tomar (to take)
 *  PtSaberFamilyCard    — saber (to know)
 *  PtQuererFamilyCard   — querer (to want/love)
 *  resolvePtWordFamilyCard() — title → card resolver
 */

import { Card, CardContent } from "@/components/ui/card";

interface WordNode {
  word: string;
  type: 'root' | 'verb' | 'noun' | 'adjective' | 'adverb' | 'compound';
  translation: string;
  note?: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{children}</p>;
}

const TYPE_COLORS: Record<WordNode['type'], string> = {
  root:      'bg-primary/15 border-primary/40 text-primary',
  verb:      'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-400',
  noun:      'bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-400',
  adjective: 'bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-400',
  adverb:    'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-400',
  compound:  'bg-muted border-border text-muted-foreground',
};

function PtWordFamilyCard({ family, contextPhrases }: {
  family: WordNode[];
  contextPhrases: [string, string][];
}) {
  const root = family.find(n => n.type === 'root')!;
  const others = family.filter(n => n.type !== 'root');

  const byType = (type: WordNode['type']) => others.filter(n => n.type === type);

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: word web */}
          <div>
            <SectionLabel>Word Family — {root.word}</SectionLabel>
            {/* Root */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border mb-3 ${TYPE_COLORS.root}`}>
              <span className="text-lg font-bold">{root.word}</span>
              <span className="text-xs">{root.translation}</span>
            </div>
            {/* Groups by type */}
            {(['verb', 'noun', 'adjective', 'adverb', 'compound'] as WordNode['type'][]).map(type => {
              const nodes = byType(type);
              if (!nodes.length) return null;
              return (
                <div key={type} className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{type}s</div>
                  <div className="flex flex-wrap gap-1.5">
                    {nodes.map(n => (
                      <div key={n.word} className={`px-2 py-1 rounded-sm border text-xs ${TYPE_COLORS[type]}`}>
                        <span className="font-semibold">{n.word}</span>
                        {n.note && <span className="ml-1 opacity-70">({n.note})</span>}
                        <div className="opacity-80 leading-tight">{n.translation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Right: context phrases */}
          <div>
            <SectionLabel>Context Phrases</SectionLabel>
            <div className="space-y-2">
              {contextPhrases.map(([pt, en]) => (
                <div key={pt} className="flex flex-col gap-0.5 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm font-semibold">{pt}</span>
                  <span className="text-xs text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 1. FALAR ─────────────────────────────────────────────────────────────────

export function PtFalarFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'falar', type: 'root', translation: 'to speak' },
        { word: 'falei', type: 'verb', translation: 'I spoke' },
        { word: 'falava', type: 'verb', translation: 'I was speaking / used to speak' },
        { word: 'falarei', type: 'verb', translation: 'I will speak' },
        { word: 'falado', type: 'adjective', translation: 'spoken (past participle)' },
        { word: 'falando', type: 'verb', translation: 'speaking (gerund)' },
        { word: 'falador/a', type: 'adjective', translation: 'talkative' },
        { word: 'falante', type: 'noun', translation: 'speaker (person)' },
        { word: 'fala', type: 'noun', translation: 'speech, talk' },
        { word: 'falha', type: 'noun', translation: 'fault, failure (related form)' },
        { word: 'conversar', type: 'compound', translation: 'to converse (related verb)', note: 'same semantic field' },
        { word: 'palestrante', type: 'noun', translation: 'speaker (at event)', note: 'from palestra' },
      ]}
      contextPhrases={[
        ['Você fala português?', 'Do you speak Portuguese?'],
        ['Falo um pouco.', 'I speak a little.'],
        ['Falei com ela ontem.', 'I spoke with her yesterday.'],
        ['Ele é muito falador.', 'He is very talkative.'],
        ['A fala dele é clara.', 'His speech is clear.'],
        ['Estamos falando sobre o projeto.', 'We are talking about the project.'],
      ]}
    />
  );
}

// ─── 2. AMAR ──────────────────────────────────────────────────────────────────

export function PtAmarFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'amar', type: 'root', translation: 'to love' },
        { word: 'amei', type: 'verb', translation: 'I loved' },
        { word: 'amava', type: 'verb', translation: 'I used to love' },
        { word: 'amarei', type: 'verb', translation: 'I will love' },
        { word: 'amado/a', type: 'adjective', translation: 'loved, beloved' },
        { word: 'amando', type: 'verb', translation: 'loving (gerund)' },
        { word: 'amante', type: 'noun', translation: 'lover, fan of' },
        { word: 'amor', type: 'noun', translation: 'love' },
        { word: 'amável', type: 'adjective', translation: 'lovable, kind' },
        { word: 'amoroso/a', type: 'adjective', translation: 'loving, affectionate' },
        { word: 'desamor', type: 'compound', translation: 'lack of love, indifference' },
        { word: 'bem-amado/a', type: 'compound', translation: 'beloved, well-loved' },
      ]}
      contextPhrases={[
        ['Eu te amo.', 'I love you. (romantic)'],
        ['Amo você.', 'I love you. (BR-PT variant)'],
        ['Amor de mãe é incondicional.', 'A mother\'s love is unconditional.'],
        ['Ela é muito amável.', 'She is very kind/lovable.'],
        ['Amei esse filme!', 'I loved that movie!'],
        ['São apaixonados — amam-se muito.', 'They are in love — they love each other very much.'],
      ]}
    />
  );
}

// ─── 3. VER ───────────────────────────────────────────────────────────────────

export function PtVerFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'ver', type: 'root', translation: 'to see' },
        { word: 'vi', type: 'verb', translation: 'I saw' },
        { word: 'via', type: 'verb', translation: 'I used to see / I was seeing' },
        { word: 'verei', type: 'verb', translation: 'I will see' },
        { word: 'visto', type: 'adjective', translation: 'seen (past participle)' },
        { word: 'vendo', type: 'verb', translation: 'seeing (gerund)' },
        { word: 'visão', type: 'noun', translation: 'vision, sight' },
        { word: 'vista', type: 'noun', translation: 'view, sight' },
        { word: 'visível', type: 'adjective', translation: 'visible' },
        { word: 'invisível', type: 'compound', translation: 'invisible' },
        { word: 'rever', type: 'compound', translation: 'to see again, to review' },
        { word: 'prever', type: 'compound', translation: 'to foresee, to predict' },
      ]}
      contextPhrases={[
        ['Você viu o jogo?', 'Did you see the game?'],
        ['Vejo você amanhã.', 'I\'ll see you tomorrow.'],
        ['A vista daqui é linda.', 'The view from here is beautiful.'],
        ['A visão dele sobre o assunto é interessante.', 'His vision on the topic is interesting.'],
        ['Preciso rever minhas notas.', 'I need to review my notes.'],
        ['Até logo! / A gente se vê!', 'See you later! (BR informal)'],
      ]}
    />
  );
}

// ─── 4. FAZER ─────────────────────────────────────────────────────────────────

export function PtFazerFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'fazer', type: 'root', translation: 'to do, to make' },
        { word: 'fiz', type: 'verb', translation: 'I did/made' },
        { word: 'fazia', type: 'verb', translation: 'I used to do/make' },
        { word: 'farei', type: 'verb', translation: 'I will do/make' },
        { word: 'feito', type: 'adjective', translation: 'done, made (past participle)' },
        { word: 'fazendo', type: 'verb', translation: 'doing/making (gerund)' },
        { word: 'feito', type: 'noun', translation: 'deed, achievement' },
        { word: 'feitura', type: 'noun', translation: 'making, crafting' },
        { word: 'desfazer', type: 'compound', translation: 'to undo, to unmake' },
        { word: 'refazer', type: 'compound', translation: 'to redo, to remake' },
        { word: 'satisfazer', type: 'compound', translation: 'to satisfy' },
        { word: 'bem-feito', type: 'compound', translation: 'well-made; serves you right (idiom)' },
      ]}
      contextPhrases={[
        ['O que você está fazendo?', 'What are you doing?'],
        ['Fiz o dever de casa.', 'I did my homework.'],
        ['Ela faz bolos maravilhosos.', 'She makes wonderful cakes.'],
        ['Faz calor hoje.', 'It\'s hot today. (weather idiom)'],
        ['Faço 30 anos amanhã.', 'I turn 30 tomorrow. (BR idiom)'],
        ['O que foi feito disso?', 'What became of that?'],
      ]}
    />
  );
}

// ─── 5. DIZER ─────────────────────────────────────────────────────────────────

export function PtDizerFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'dizer', type: 'root', translation: 'to say, to tell' },
        { word: 'disse', type: 'verb', translation: 'I/he/she said' },
        { word: 'dizia', type: 'verb', translation: 'used to say' },
        { word: 'direi', type: 'verb', translation: 'I will say' },
        { word: 'dito', type: 'adjective', translation: 'said (past participle)' },
        { word: 'dizendo', type: 'verb', translation: 'saying (gerund)' },
        { word: 'dito', type: 'noun', translation: 'saying, proverb' },
        { word: 'ditado', type: 'noun', translation: 'dictation; saying/proverb' },
        { word: 'dizer que', type: 'compound', translation: 'to say that…' },
        { word: 'predizer', type: 'compound', translation: 'to predict, to foretell' },
        { word: 'contraditório/a', type: 'compound', translation: 'contradictory' },
        { word: 'bendizer', type: 'compound', translation: 'to bless, to speak well of' },
      ]}
      contextPhrases={[
        ['O que você disse?', 'What did you say?'],
        ['Diga-me a verdade.', 'Tell me the truth.'],
        ['Como se diz "hello" em português?', 'How do you say "hello" in Portuguese?'],
        ['Dizem que vai chover.', 'They say it\'s going to rain.'],
        ['Quer dizer que…', 'That means that… (quer dizer = "it means")'],
        ['Dito e feito!', 'No sooner said than done!'],
      ]}
    />
  );
}

// ─── 6. IR ────────────────────────────────────────────────────────────────────

export function PtIrFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'ir', type: 'root', translation: 'to go' },
        { word: 'fui', type: 'verb', translation: 'I went' },
        { word: 'ia', type: 'verb', translation: 'I used to go / was going' },
        { word: 'irei', type: 'verb', translation: 'I will go' },
        { word: 'ido', type: 'adjective', translation: 'gone (past participle)' },
        { word: 'indo', type: 'verb', translation: 'going (gerund)' },
        { word: 'ida', type: 'noun', translation: 'going, departure; one-way (trip)' },
        { word: 'vinda', type: 'noun', translation: 'coming, arrival', note: 'from vir' },
        { word: 'vir', type: 'compound', translation: 'to come (opposite of ir)' },
        { word: 'passagem de ida e volta', type: 'compound', translation: 'round-trip ticket' },
        { word: 'ir embora', type: 'compound', translation: 'to go away, to leave' },
        { word: 'ir e vir', type: 'compound', translation: 'comings and goings' },
      ]}
      contextPhrases={[
        ['Onde você vai?', 'Where are you going?'],
        ['Vou ao supermercado.', 'I\'m going to the supermarket.'],
        ['Fomos à praia no fim de semana.', 'We went to the beach on the weekend.'],
        ['Vamos! / Bora!', 'Let\'s go! (Bora = BR informal)'],
        ['Ela foi embora cedo.', 'She left early.'],
        ['Como foi? / Como foi a viagem?', 'How did it go? / How was the trip?'],
      ]}
    />
  );
}

// ─── 7. VIR ───────────────────────────────────────────────────────────────────

export function PtVirFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'vir', type: 'root', translation: 'to come' },
        { word: 'vim', type: 'verb', translation: 'I came' },
        { word: 'vinha', type: 'verb', translation: 'I used to come / was coming' },
        { word: 'virei', type: 'verb', translation: 'I will come' },
        { word: 'vindo', type: 'adjective', translation: 'coming (past participle / gerund)' },
        { word: 'vinda', type: 'noun', translation: 'coming, arrival; welcome' },
        { word: 'bem-vindo/a', type: 'compound', translation: 'welcome (greeting)' },
        { word: 'benvindo', type: 'compound', translation: 'welcome (EU-PT spelling)' },
        { word: 'provir', type: 'compound', translation: 'to come from, to originate' },
        { word: 'devir', type: 'compound', translation: 'becoming (philosophical term)' },
        { word: 'vir a ser', type: 'compound', translation: 'to become, to turn out to be' },
        { word: 'por vir', type: 'compound', translation: 'yet to come, future' },
      ]}
      contextPhrases={[
        ['Você vem amanhã?', 'Are you coming tomorrow?'],
        ['Vim assim que pude.', 'I came as soon as I could.'],
        ['Bem-vindo ao Brasil!', 'Welcome to Brazil!'],
        ['De onde você vem?', 'Where are you from?'],
        ['O melhor ainda está por vir.', 'The best is yet to come.'],
        ['Ela veio de Portugal.', 'She came from Portugal.'],
      ]}
    />
  );
}

// ─── 8. TOMAR ─────────────────────────────────────────────────────────────────

export function PtTomarFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'tomar', type: 'root', translation: 'to take, to have (drink/food)' },
        { word: 'tomei', type: 'verb', translation: 'I took/had' },
        { word: 'tomava', type: 'verb', translation: 'I used to take/have' },
        { word: 'tomarei', type: 'verb', translation: 'I will take/have' },
        { word: 'tomado', type: 'adjective', translation: 'taken (past participle)' },
        { word: 'tomando', type: 'verb', translation: 'taking/having (gerund)' },
        { word: 'tomada', type: 'noun', translation: 'socket, outlet (BR); taken (f. adj)' },
        { word: 'retomar', type: 'compound', translation: 'to resume, to retake' },
        { word: 'tomar conta', type: 'compound', translation: 'to take care of' },
        { word: 'tomar café', type: 'compound', translation: 'to have coffee/breakfast (BR)' },
        { word: 'tomar decisão', type: 'compound', translation: 'to make a decision' },
        { word: 'tomar banho', type: 'compound', translation: 'to take a bath/shower' },
      ]}
      contextPhrases={[
        ['Você quer tomar um café?', 'Do you want to have a coffee?'],
        ['Tome o ônibus 47.', 'Take bus 47.'],
        ['Tomei uma decisão importante.', 'I made an important decision.'],
        ['Quem está tomando conta das crianças?', 'Who is taking care of the children?'],
        ['Ela retomou o trabalho.', 'She resumed work.'],
        ['Vou tomar um banho rápido.', 'I\'m going to take a quick shower.'],
      ]}
    />
  );
}

// ─── 9. SABER ─────────────────────────────────────────────────────────────────

export function PtSaberFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'saber', type: 'root', translation: 'to know (facts/how to)' },
        { word: 'soube', type: 'verb', translation: 'I found out / knew (perfeito)' },
        { word: 'sabia', type: 'verb', translation: 'I knew / used to know' },
        { word: 'saberei', type: 'verb', translation: 'I will know' },
        { word: 'sabido', type: 'adjective', translation: 'known; clever (past participle)' },
        { word: 'sabendo', type: 'verb', translation: 'knowing (gerund)' },
        { word: 'sabedoria', type: 'noun', translation: 'wisdom, knowledge' },
        { word: 'sabedor/a', type: 'adjective', translation: 'knowledgeable, wise' },
        { word: 'saber que', type: 'compound', translation: 'to know that…' },
        { word: 'saber fazer', type: 'compound', translation: 'to know how to do' },
        { word: 'conhecer', type: 'compound', translation: 'to know (person/place) — different meaning', note: 'contrasts with saber' },
        { word: 'ignoran', type: 'compound', translation: 'ignorance (opposite)', note: 'from ignorância' },
      ]}
      contextPhrases={[
        ['Você sabe falar português?', 'Do you know how to speak Portuguese?'],
        ['Não sei a resposta.', 'I don\'t know the answer.'],
        ['Ela soube da notícia.', 'She found out the news.'],
        ['Sabe quem é ele?', 'Do you know who he is?'],
        ['Sabedoria vem com a experiência.', 'Wisdom comes with experience.'],
        ['Quem sabe? / Não sei.', 'Who knows? / I don\'t know.'],
      ]}
    />
  );
}

// ─── 10. QUERER ───────────────────────────────────────────────────────────────

export function PtQuererFamilyCard() {
  return (
    <PtWordFamilyCard
      family={[
        { word: 'querer', type: 'root', translation: 'to want; to love (people)' },
        { word: 'quis', type: 'verb', translation: 'I wanted' },
        { word: 'queria', type: 'verb', translation: 'I wanted / would like' },
        { word: 'quererei', type: 'verb', translation: 'I will want' },
        { word: 'querido/a', type: 'adjective', translation: 'dear, loved (past participle)' },
        { word: 'querendo', type: 'verb', translation: 'wanting (gerund)' },
        { word: 'querer dizer', type: 'compound', translation: 'to mean ("want to say")' },
        { word: 'bem-querer', type: 'compound', translation: 'affection, fondness' },
        { word: 'desquerer', type: 'compound', translation: 'to stop loving (informal)' },
        { word: 'querida/caro', type: 'compound', translation: 'Dear… (letter salutation)' },
        { word: 'quem quer que', type: 'compound', translation: 'whoever' },
        { word: 'seja o que for', type: 'compound', translation: 'whatever it may be' },
      ]}
      contextPhrases={[
        ['O que você quer?', 'What do you want?'],
        ['Queria um café, por favor.', 'I would like a coffee, please. (polite)'],
        ['Eu te quero muito.', 'I love you very much. / I care for you a lot.'],
        ['O que quer dizer essa palavra?', 'What does this word mean?'],
        ['Querida Maria, …', 'Dear Maria, … (letter)'],
        ['Quem não quer ser feliz?', 'Who doesn\'t want to be happy?'],
      ]}
    />
  );
}

// ─── Resolver function ────────────────────────────────────────────────────────

export function resolvePtWordFamilyCard(title: string): React.ReactElement {
  const lower = title.toLowerCase();
  if (lower.includes('falar') || lower.includes('speak') || lower.includes('fala')) return <PtFalarFamilyCard />;
  if (lower.includes('amar') || lower.includes('love') || lower.includes('amor')) return <PtAmarFamilyCard />;
  if (lower.includes('ver ') || lower.includes('ver,') || lower.includes('visão') || lower.includes('sight') || lower.includes('seeing')) return <PtVerFamilyCard />;
  if (lower.includes('fazer') || lower.includes('make') || lower.includes('feito')) return <PtFazerFamilyCard />;
  if (lower.includes('dizer') || lower.includes('say') || lower.includes('dito')) return <PtDizerFamilyCard />;
  if (lower.includes('ir ') || lower.includes('going') || lower.includes('vou')) return <PtIrFamilyCard />;
  if (lower.includes('vir') || lower.includes('come') || lower.includes('bem-vindo')) return <PtVirFamilyCard />;
  if (lower.includes('tomar') || lower.includes('take') || lower.includes('tomada')) return <PtTomarFamilyCard />;
  if (lower.includes('saber') || lower.includes('know') || lower.includes('sabedoria')) return <PtSaberFamilyCard />;
  if (lower.includes('querer') || lower.includes('want') || lower.includes('querido')) return <PtQuererFamilyCard />;
  return <PtFalarFamilyCard />;
}
