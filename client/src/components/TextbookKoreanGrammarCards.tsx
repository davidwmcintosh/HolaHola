import { Card, CardContent } from "@/components/ui/card";

const KO = "text-sky-700 dark:text-sky-400";
const KO_BG = "bg-sky-500/10";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-wider ${KO} mb-2`}>{children}</p>;
}

function ConjTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="rounded-md border border-border overflow-hidden text-sm">
      <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        <span>Pronoun</span><span>Korean</span><span>Romanization</span>
      </div>
      {rows.map(([pro, ko, rom], i) => (
        <div key={i} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
          <span className="text-muted-foreground">{pro}</span>
          <span className="font-semibold">{ko}</span>
          <span className="text-muted-foreground italic">{rom}</span>
        </div>
      ))}
    </div>
  );
}

function PhraseList({ pairs }: { pairs: [string, string][] }) {
  return (
    <div className="space-y-1 mt-1">
      {pairs.map(([ko, en]) => (
        <div key={ko} className="flex gap-2 text-sm">
          <span className="font-semibold shrink-0">{ko}</span>
          <span className="text-muted-foreground">— {en}</span>
        </div>
      ))}
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-md ${KO_BG} border border-sky-300/30 dark:border-sky-700/40 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

// ── Writing System ─────────────────────────────────────────────────────────────

export function KoHangulCard() {
  const consonants: [string, string, string][] = [
    ['ㄱ', 'g/k', 'giyeok'],
    ['ㄴ', 'n', 'nieun'],
    ['ㄷ', 'd/t', 'digeut'],
    ['ㄹ', 'r/l', 'rieul'],
    ['ㅁ', 'm', 'mieum'],
    ['ㅂ', 'b/p', 'bieup'],
    ['ㅅ', 's', 'siot'],
    ['ㅇ', 'silent/ng', 'ieung'],
    ['ㅈ', 'j', 'jieut'],
    ['ㅊ', 'ch', 'chieut'],
    ['ㅋ', 'k', 'kieuk'],
    ['ㅌ', 't', 'tieut'],
    ['ㅍ', 'p', 'pieup'],
    ['ㅎ', 'h', 'hieut'],
  ];
  const vowels: [string, string, string][] = [
    ['ㅏ', 'a', 'a'],
    ['ㅓ', 'eo', 'eo'],
    ['ㅗ', 'o', 'o'],
    ['ㅜ', 'u', 'u'],
    ['ㅡ', 'eu', 'eu'],
    ['ㅣ', 'i', 'i'],
    ['ㅐ', 'ae', 'ae'],
    ['ㅔ', 'e', 'e'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>한글 — Hangul: The Korean Alphabet</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Hangul is Korea's phonetic alphabet, created in 1443 by King Sejong. It groups letters into syllable blocks: consonant + vowel (+ optional final consonant called 받침 <em>batchim</em>).</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Consonants (자음)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Letter</span><span>Sound</span><span>Name</span>
              </div>
              {consonants.map(([ltr, snd, nm], i) => (
                <div key={ltr} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-bold text-base ${KO}`}>{ltr}</span>
                  <span className="font-semibold">{snd}</span>
                  <span className="text-muted-foreground italic text-xs">{nm}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Vowels (모음)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Letter</span><span>Sound</span><span>Name</span>
              </div>
              {vowels.map(([ltr, snd, nm], i) => (
                <div key={ltr} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-bold text-base ${KO}`}>{ltr}</span>
                  <span className="font-semibold">{snd}</span>
                  <span className="text-muted-foreground italic text-xs">{nm}</span>
                </div>
              ))}
            </div>
            <NoteBox>
              <strong>Syllable blocks:</strong> 한 = ㅎ+ㅏ+ㄴ · 글 = ㄱ+ㅡ+ㄹ. Each block is one syllable. ㅇ is silent at the start of a syllable but sounds like "ng" at the end.
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Particles ──────────────────────────────────────────────────────────────────

export function KoTopicMarkerCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>은/는 — Topic Marker</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">The topic marker attaches to a noun to mark it as the topic of the sentence. 은 (eun) follows a consonant; 는 (neun) follows a vowel.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Usage Pattern</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>After consonant</span><span>After vowel</span>
              </div>
              {[
                ['학생은', '나는'],
                ['책은', '저는'],
                ['선생님은', '오빠는'],
              ].map(([c, v], i) => (
                <div key={i} className={`grid grid-cols-2 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{c}</span>
                  <span className={`font-semibold ${KO}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Example Sentences</SectionLabel>
            <PhraseList pairs={[
              ['저는 학생이에요.', 'I am a student.'],
              ['이것은 책이에요.', 'This is a book.'],
              ['오늘은 월요일이에요.', 'Today is Monday.'],
              ['한국어는 재미있어요.', 'Korean is interesting.'],
            ]} />
          </div>
        </div>
        <NoteBox>
          <strong>은/는 vs. 이/가:</strong> 은/는 marks the topic (known info, contrast), while 이/가 marks the grammatical subject (new info, emphasis). Topic ≠ Subject.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

export function KoParticlesCard() {
  const particles: [string, string, string, string][] = [
    ['이/가', 'i/ga', 'Subject marker', '고양이가 자요. (The cat sleeps.)'],
    ['을/를', 'eul/reul', 'Object marker', '밥을 먹어요. (I eat rice.)'],
    ['은/는', 'eun/neun', 'Topic marker', '저는 학생이에요. (I am a student.)'],
    ['에', 'e', 'Location/direction (static/destination)', '학교에 가요. (Go to school.)'],
    ['에서', 'eseo', 'Location (action) / from', '카페에서 공부해요. (Study at café.)'],
    ['에게/한테', 'ege/hante', 'To (a person)', '친구에게 줘요. (Give to friend.)'],
    ['로/으로', 'ro/euro', 'Direction / by means of', '버스로 가요. (Go by bus.)'],
    ['의', 'ui', 'Possessive (\'s)', '친구의 책 (friend\'s book)'],
    ['도', 'do', 'Also / too', '저도 학생이에요. (I\'m also a student.)'],
    ['만', 'man', 'Only', '물만 마셔요. (I only drink water.)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>조사 — Korean Particles (Postpositions)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean uses particles (조사) attached after nouns to show grammatical function — like case endings. Many have two forms depending on whether the noun ends in a consonant or vowel.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Particle</span><span>Function</span><span>Example</span>
          </div>
          {particles.map(([p, rom, fn, ex], i) => (
            <div key={p} className={`grid grid-cols-3 px-3 py-1.5 gap-1 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`font-bold ${KO}`}>{p} <span className="text-muted-foreground font-normal italic text-xs">({rom})</span></span>
              <span className="text-muted-foreground text-xs">{fn}</span>
              <span className="text-xs">{ex}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Core Verbs ─────────────────────────────────────────────────────────────────

export function KoIdaCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>이다 / 있다 / 없다 — To Be / To Have</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <SectionLabel>이다 (ida) — "to be"</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['Polite', '이에요/예요'],
                ['Formal', '입니다'],
                ['Negative', '이/가 아니에요'],
              ].map(([label, form], i) => (
                <div key={label} className={`flex justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${KO}`}>{form}</span>
                </div>
              ))}
            </div>
            <PhraseList pairs={[['저는 학생이에요.', 'I am a student.'], ['의사예요.', '(He/She) is a doctor.']]} />
          </div>
          <div>
            <SectionLabel>있다 (itda) — "to exist/have"</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['Polite', '있어요'],
                ['Formal', '있습니다'],
                ['Past', '있었어요'],
              ].map(([label, form], i) => (
                <div key={label} className={`flex justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${KO}`}>{form}</span>
                </div>
              ))}
            </div>
            <PhraseList pairs={[['책이 있어요.', 'I have a book. / There is a book.'], ['시간이 있어요?', 'Do you have time?']]} />
          </div>
          <div>
            <SectionLabel>없다 (eopsda) — "to not exist"</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['Polite', '없어요'],
                ['Formal', '없습니다'],
                ['Past', '없었어요'],
              ].map(([label, form], i) => (
                <div key={label} className={`flex justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${KO}`}>{form}</span>
                </div>
              ))}
            </div>
            <PhraseList pairs={[['돈이 없어요.', 'I have no money.'], ['문제없어요.', 'No problem.']]} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KoRegularVerbsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>동사 — Regular Verb Conjugation (-아요 / -어요)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean verbs end in 다 (da) in dictionary form. The polite present ending is -아요 or -어요, chosen by vowel harmony: if the last vowel in the stem is ㅏ or ㅗ → 아요; otherwise → 어요.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>ㅏ/ㅗ → -아요 stems</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Dictionary</span><span>Polite</span><span>Meaning</span>
              </div>
              {[
                ['가다', '가요', 'to go'],
                ['오다', '와요', 'to come'],
                ['자다', '자요', 'to sleep'],
                ['보다', '봐요', 'to see'],
              ].map(([d, p, m], i) => (
                <div key={d} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{d}</span>
                  <span className={`font-semibold ${KO}`}>{p}</span>
                  <span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Other vowels → -어요 stems</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Dictionary</span><span>Polite</span><span>Meaning</span>
              </div>
              {[
                ['먹다', '먹어요', 'to eat'],
                ['마시다', '마셔요', 'to drink'],
                ['읽다', '읽어요', 'to read'],
                ['쓰다', '써요', 'to write'],
              ].map(([d, p, m], i) => (
                <div key={d} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{d}</span>
                  <span className={`font-semibold ${KO}`}>{p}</span>
                  <span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>하다 (hada) verbs use 해요 (haeyo): 공부하다 → 공부해요 (to study). These are very common — most Sino-Korean nouns can form verbs with 하다.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Past Tense ─────────────────────────────────────────────────────────────────

export function KoPastTenseCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>과거형 — Past Tense (-았어요 / -었어요)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Add -았어요 (after ㅏ/ㅗ stems) or -었어요 (all other stems) to the verb stem. 하다 verbs use 했어요.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>-았어요 examples</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Present</span><span>Past</span><span>Meaning</span>
              </div>
              {[
                ['가요', '갔어요', 'went'],
                ['봐요', '봤어요', 'saw'],
                ['자요', '잤어요', 'slept'],
              ].map(([pr, pa, m], i) => (
                <div key={pr} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span>{pr}</span><span className={`font-semibold ${KO}`}>{pa}</span><span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>-었어요 examples</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Present</span><span>Past</span><span>Meaning</span>
              </div>
              {[
                ['먹어요', '먹었어요', 'ate'],
                ['마셔요', '마셨어요', 'drank'],
                ['해요', '했어요', 'did'],
              ].map(([pr, pa, m], i) => (
                <div key={pr} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span>{pr}</span><span className={`font-semibold ${KO}`}>{pa}</span><span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <PhraseList pairs={[
          ['어제 학교에 갔어요.', 'I went to school yesterday.'],
          ['밥을 먹었어요.', 'I ate rice.'],
          ['영화를 봤어요.', 'I watched a movie.'],
        ]} />
      </CardContent>
    </Card>
  );
}

// ── Negation ───────────────────────────────────────────────────────────────────

export function KoNegationCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>부정형 — Negation (안 / 못 / -지 않다)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>안 (an) — simple negation</SectionLabel>
            <PhraseList pairs={[
              ['안 먹어요.', 'I don\'t eat. (choice)'],
              ['안 가요.', 'I don\'t go.'],
              ['안 해요.', 'I don\'t do it.'],
            ]} />
            <NoteBox>Place 안 directly before the verb. For 하다 verbs: 공부 안 해요 (not 안 공부해요).</NoteBox>
          </div>
          <div>
            <SectionLabel>못 (mot) — inability negation</SectionLabel>
            <PhraseList pairs={[
              ['못 먹어요.', 'I can\'t eat. (unable)'],
              ['못 가요.', 'I can\'t go.'],
              ['공부 못 해요.', 'I can\'t study.'],
            ]} />
          </div>
        </div>
        <div className="mt-4">
          <SectionLabel>-지 않다 (ji anta) — long-form negation</SectionLabel>
          <div className="rounded-md border border-border overflow-hidden text-sm">
            <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span>Short form</span><span>Long form</span>
            </div>
            {[
              ['안 먹어요', '먹지 않아요'],
              ['안 가요', '가지 않아요'],
              ['못 해요', '하지 못해요'],
            ].map(([s, l], i) => (
              <div key={s} className={`grid grid-cols-2 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                <span>{s}</span><span className={`font-semibold ${KO}`}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Formal Speech ──────────────────────────────────────────────────────────────

export function KoFormalSpeechCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>합쇼체 — Formal Polite Speech (-습니다 / -ㅂ니다)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean has two main polite registers: the formal 합쇼체 (-습니다) used in news, presentations, and official settings, and the informal polite 해요체 (-아요/어요) for everyday conversation.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Conjugation Pattern</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Dictionary</span><span>Informal (해요체)</span><span>Formal (합쇼체)</span>
              </div>
              {[
                ['가다', '가요', '갑니다'],
                ['먹다', '먹어요', '먹습니다'],
                ['하다', '해요', '합니다'],
                ['있다', '있어요', '있습니다'],
                ['이다', '이에요/예요', '입니다'],
              ].map(([d, inf, fm], i) => (
                <div key={d} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{d}</span>
                  <span>{inf}</span>
                  <span className={`font-semibold ${KO}`}>{fm}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Formal vs. Informal</SectionLabel>
            <PhraseList pairs={[
              ['저는 학생입니다. / 저는 학생이에요.', 'I am a student.'],
              ['감사합니다. / 감사해요.', 'Thank you.'],
              ['안녕히 가십시오. / 안녕히 가세요.', 'Goodbye (to person leaving).'],
              ['죄송합니다. / 미안해요.', 'I\'m sorry.'],
            ]} />
            <NoteBox>Formal (-습니다) is more distant and respectful. Informal polite (-아/어요) is warmer — used with most people in daily life.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Adjectives ─────────────────────────────────────────────────────────────────

export function KoAdjectivesCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>형용사 — Descriptive Verbs (Korean Adjectives)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean adjectives function as "descriptive verbs" — they conjugate like verbs. They can directly end a sentence without a copula, and modify nouns using the -(으)ㄴ ending.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Common Adjectives</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Dictionary</span><span>Polite form</span><span>Meaning</span>
              </div>
              {[
                ['크다', '커요', 'big'],
                ['작다', '작아요', 'small'],
                ['좋다', '좋아요', 'good / like'],
                ['나쁘다', '나빠요', 'bad'],
                ['빠르다', '빨라요', 'fast'],
                ['느리다', '느려요', 'slow'],
                ['비싸다', '비싸요', 'expensive'],
                ['싸다', '싸요', 'cheap'],
              ].map(([d, p, m], i) => (
                <div key={d} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{d}</span>
                  <span className={`font-semibold ${KO}`}>{p}</span>
                  <span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Noun Modification (-(으)ㄴ)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['큰 집', 'big house'],
                ['작은 고양이', 'small cat'],
                ['좋은 날씨', 'good weather'],
                ['비싼 음식', 'expensive food'],
                ['예쁜 꽃', 'pretty flower'],
              ].map(([ko, en], i) => (
                <div key={ko} className={`flex justify-between px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{ko}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
            <NoteBox>Add -(으)ㄴ to the stem: 크다 → 큰, 작다 → 작은. Action verbs use -는 to modify nouns: 먹는 사람 (the person who eats).</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Question Words ─────────────────────────────────────────────────────────────

export function KoQuestionWordsCard() {
  const words: [string, string, string, string][] = [
    ['뭐 / 무엇', 'mwo / mueot', 'what', '이게 뭐예요? — What is this?'],
    ['어디', 'eodi', 'where', '화장실이 어디예요? — Where is the restroom?'],
    ['언제', 'eonje', 'when', '언제 와요? — When are you coming?'],
    ['누구', 'nugu', 'who', '이분이 누구예요? — Who is this person?'],
    ['왜', 'wae', 'why', '왜 울어요? — Why are you crying?'],
    ['어떻게', 'eotteoke', 'how', '어떻게 해요? — How do you do it?'],
    ['얼마', 'eolma', 'how much', '얼마예요? — How much is it?'],
    ['몇', 'myeot', 'how many', '몇 시예요? — What time is it?'],
    ['어느', 'eoneo', 'which', '어느 것이 좋아요? — Which one is good?'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>의문사 — Question Words</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Korean</span><span>Meaning</span><span>Example</span>
          </div>
          {words.map(([ko, rom, en, ex], i) => (
            <div key={ko} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <div>
                <span className={`font-bold ${KO}`}>{ko}</span>
                <span className="text-xs text-muted-foreground italic block">{rom}</span>
              </div>
              <span className="text-muted-foreground self-center">{en}</span>
              <span className="text-xs self-center">{ex}</span>
            </div>
          ))}
        </div>
        <NoteBox>Korean questions use the same word order as statements — the question word replaces the unknown element: 뭐 먹어요? (What are you eating?) rather than moving to the front like English.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Numbers ────────────────────────────────────────────────────────────────────

export function KoNumbersCard() {
  const sinoKorean = [
    ['1', '일 (il)'], ['2', '이 (i)'], ['3', '삼 (sam)'],
    ['4', '사 (sa)'], ['5', '오 (o)'], ['6', '육 (yuk)'],
    ['7', '칠 (chil)'], ['8', '팔 (pal)'], ['9', '구 (gu)'],
    ['10', '십 (sip)'], ['100', '백 (baek)'], ['1000', '천 (cheon)'],
  ];
  const nativeKorean = [
    ['1', '하나 (hana)'], ['2', '둘 (dul)'], ['3', '셋 (set)'],
    ['4', '넷 (net)'], ['5', '다섯 (daseot)'], ['6', '여섯 (yeoseot)'],
    ['7', '일곱 (ilgop)'], ['8', '여덟 (yeodeol)'], ['9', '아홉 (ahop)'],
    ['10', '열 (yeol)'], ['20', '스물 (seumul)'], ['100+', 'use Sino-Korean'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>숫자 — Two Number Systems</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean has two counting systems: Sino-Korean (from Chinese) and Native Korean. Each is used in different contexts.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Sino-Korean (한자어) — for dates, money, phone, floors, minutes</SectionLabel>
            <div className="grid grid-cols-2 rounded-md border border-border overflow-hidden text-sm">
              {sinoKorean.map(([n, k], i) => (
                <div key={n} className={`flex justify-between px-3 py-1.5 ${i >= 2 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-mono text-muted-foreground">{n}</span>
                  <span className={`font-semibold ${KO}`}>{k}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Native Korean (고유어) — for counting objects, age, hours</SectionLabel>
            <div className="grid grid-cols-2 rounded-md border border-border overflow-hidden text-sm">
              {nativeKorean.map(([n, k], i) => (
                <div key={n} className={`flex justify-between px-3 py-1.5 ${i >= 2 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-mono text-muted-foreground">{n}</span>
                  <span className={`font-semibold ${KO}`}>{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>
          <strong>Quick rule:</strong> Sino-Korean → dates (삼월 오일), money (오천 원), phone numbers, minutes (오십 분). Native Korean → hours (다섯 시), age (스물 살), counting items (사과 두 개). Numbers 1–4 shorten before counters: 하나→한, 둘→두, 셋→세, 넷→네.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Counters ───────────────────────────────────────────────────────────────────

export function KoCountersCard() {
  const counters: [string, string, string, string][] = [
    ['개 (gae)', 'general objects', '사과 두 개', '2 apples'],
    ['명 (myeong)', 'people (formal)', '학생 세 명', '3 students'],
    ['분 (bun)', 'people (honorific)', '선생님 두 분', '2 teachers'],
    ['권 (gwon)', 'books/volumes', '책 한 권', '1 book'],
    ['장 (jang)', 'flat objects/sheets', '종이 네 장', '4 sheets'],
    ['병 (byeong)', 'bottles', '물 한 병', '1 bottle'],
    ['잔 (jan)', 'cups/glasses', '커피 두 잔', '2 cups of coffee'],
    ['번 (beon)', 'times/occurrences', '두 번', 'two times'],
    ['시 (si)', 'o\'clock (hour)', '세 시', '3 o\'clock'],
    ['층 (cheung)', 'floors', '삼 층', '3rd floor'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>단위 명사 — Counters / Measure Words</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean requires a counter (unit noun) between the noun and the number. Pattern: <strong>Noun + Number + Counter</strong> or <strong>Number + Counter + Noun</strong>.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Counter</span><span>Used for</span><span>Example</span><span>Translation</span>
          </div>
          {counters.map(([c, u, ex, tr], i) => (
            <div key={c} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`font-bold ${KO}`}>{c}</span>
              <span className="text-muted-foreground text-xs">{u}</span>
              <span className="font-semibold text-xs">{ex}</span>
              <span className="text-muted-foreground text-xs">{tr}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Time Expressions ───────────────────────────────────────────────────────────

export function KoTimeExpressionsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>시간 표현 — Time Expressions</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Relative Time</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['그저께', 'the day before yesterday'],
                ['어제', 'yesterday'],
                ['오늘', 'today'],
                ['내일', 'tomorrow'],
                ['모레', 'the day after tomorrow'],
                ['지난주', 'last week'],
                ['이번 주', 'this week'],
                ['다음 주', 'next week'],
              ].map(([k, e], i) => (
                <div key={k} className={`flex justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{k}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Parts of the Day</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['아침', 'morning'],
                ['오전', 'AM / before noon'],
                ['점심', 'noon / lunch time'],
                ['오후', 'PM / afternoon'],
                ['저녁', 'evening'],
                ['밤', 'night'],
                ['자정', 'midnight'],
                ['새벽', 'dawn / early morning'],
              ].map(([k, e], i) => (
                <div key={k} className={`flex justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{k}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Direction / Movement ───────────────────────────────────────────────────────

export function KoDirectionMovementCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>방향과 이동 — Direction & Movement</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Motion Verbs</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['가다 (gada)', 'to go'],
                ['오다 (oda)', 'to come'],
                ['올라가다', 'to go up'],
                ['내려가다', 'to go down'],
                ['들어가다', 'to go in / enter'],
                ['나오다', 'to come out'],
                ['건너다', 'to cross'],
                ['돌아가다', 'to return / go back'],
              ].map(([k, e], i) => (
                <div key={k} className={`flex justify-between px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{k}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Location Words</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['위 (wi)', 'above / on top'],
                ['아래 (arae)', 'below / under'],
                ['앞 (ap)', 'front'],
                ['뒤 (dwi)', 'back / behind'],
                ['왼쪽 (oenjjok)', 'left side'],
                ['오른쪽 (oreunjjok)', 'right side'],
                ['안 (an)', 'inside'],
                ['옆 (yeop)', 'beside / next to'],
              ].map(([k, e], i) => (
                <div key={k} className={`flex justify-between px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{k}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <PhraseList pairs={[
          ['버스 정류장이 어디에 있어요?', 'Where is the bus stop?'],
          ['지하철역이 왼쪽에 있어요.', 'The subway station is on the left.'],
          ['학교 앞에서 만나요.', 'Let\'s meet in front of the school.'],
        ]} />
      </CardContent>
    </Card>
  );
}

// ── Giving / Receiving ─────────────────────────────────────────────────────────

export function KoGivingReceivingCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>주다 / 받다 / 드리다 — Giving & Receiving</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <SectionLabel>주다 (juda) — to give (to equal/lower)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[['Present', '줘요'], ['Past', '줬어요'], ['Formal', '줍니다']].map(([l, f], i) => (
                <div key={l} className={`flex justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{l}</span>
                  <span className={`font-semibold ${KO}`}>{f}</span>
                </div>
              ))}
            </div>
            <PhraseList pairs={[['친구에게 선물을 줘요.', 'Give a gift to a friend.']]} />
          </div>
          <div>
            <SectionLabel>받다 (batda) — to receive</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[['Present', '받아요'], ['Past', '받았어요'], ['Formal', '받습니다']].map(([l, f], i) => (
                <div key={l} className={`flex justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{l}</span>
                  <span className={`font-semibold ${KO}`}>{f}</span>
                </div>
              ))}
            </div>
            <PhraseList pairs={[['선물을 받았어요.', 'I received a gift.']]} />
          </div>
          <div>
            <SectionLabel>드리다 (deurida) — to give (to elder/superior)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[['Present', '드려요'], ['Past', '드렸어요'], ['Formal', '드립니다']].map(([l, f], i) => (
                <div key={l} className={`flex justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{l}</span>
                  <span className={`font-semibold ${KO}`}>{f}</span>
                </div>
              ))}
            </div>
            <PhraseList pairs={[['선생님께 드려요.', 'Give to the teacher.']]} />
          </div>
        </div>
        <NoteBox>Use 드리다 when the recipient is senior/superior. Use 주다 for peers or those younger. The recipient particle changes too: 에게 (neutral) → 께 (honorific).</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Potential Form ─────────────────────────────────────────────────────────────

export function KoPotentialFormCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>-(으)ㄹ 수 있다 — Potential / Can</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">To express ability or possibility, attach -(으)ㄹ 수 있어요 to the verb stem. For inability, use -(으)ㄹ 수 없어요 or 못 + verb.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Positive — can do</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['한국어를 할 수 있어요.', 'I can speak Korean.'],
                ['수영할 수 있어요.', 'I can swim.'],
                ['운전할 수 있어요?', 'Can you drive?'],
                ['피아노를 칠 수 있어요.', 'I can play piano.'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Negative — cannot do</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['한국어를 못 해요.', 'I can\'t speak Korean.'],
                ['수영할 수 없어요.', 'I can\'t swim.'],
                ['운전 못 해요.', 'I can\'t drive.'],
                ['지금은 갈 수 없어요.', 'I can\'t go right now.'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>Pattern: verb stem + (으)ㄹ 수 있다/없다. If the stem ends in a vowel or ㄹ, use -ㄹ 수 있다. If it ends in another consonant, use -을 수 있다.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Volitional / Want ─────────────────────────────────────────────────────────

export function KoVolitionalCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>-고 싶다 / -(으)ㄹ게요 — Want & Intention</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>-고 싶다 — to want to</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Attach -고 싶어요 to any verb stem to express desire.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['먹고 싶어요.', 'I want to eat.'],
                ['자고 싶어요.', 'I want to sleep.'],
                ['한국에 가고 싶어요.', 'I want to go to Korea.'],
                ['뭐 먹고 싶어요?', 'What do you want to eat?'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>-(으)ㄹ게요 — I will / I'll (promise/intention)</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Expresses the speaker's intention or promise, often responding to someone.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['내일 전화할게요.', 'I\'ll call you tomorrow.'],
                ['제가 할게요.', 'I\'ll do it.'],
                ['기다릴게요.', 'I\'ll wait.'],
                ['빨리 올게요.', 'I\'ll come quickly.'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>For "let's" (suggestion): use -자 (casual) or -(으)ㄹ까요? (polite question). 같이 가자! (Let's go together!) / 같이 갈까요? (Shall we go together?)</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Conditional ───────────────────────────────────────────────────────────────

export function KoConditionalCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>조건형 — Conditional (-(으)면)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">The conditional "if/when" is formed with -(으)면: add -면 after a vowel stem or ㄹ; add -으면 after other consonants.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Formation</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Dictionary</span><span>Conditional</span><span>Meaning</span>
              </div>
              {[
                ['가다', '가면', 'if/when go'],
                ['먹다', '먹으면', 'if/when eat'],
                ['크다', '크면', 'if/when big'],
                ['있다', '있으면', 'if there is'],
                ['하다', '하면', 'if/when do'],
              ].map(([d, c, m], i) => (
                <div key={d} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{d}</span>
                  <span className={`font-semibold ${KO}`}>{c}</span>
                  <span className="text-muted-foreground text-xs">{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Example Sentences</SectionLabel>
            <PhraseList pairs={[
              ['시간이 있으면 오세요.', 'If you have time, please come.'],
              ['비가 오면 집에 있을게요.', 'If it rains, I\'ll stay home.'],
              ['배고프면 먹어요.', 'If you\'re hungry, eat.'],
              ['한국에 가면 삼겹살 먹어요.', 'When you go to Korea, eat samgyeopsal.'],
            ]} />
          </div>
        </div>
        <NoteBox>-(으)면 covers both "if" and "when." For past conditionals, attach -았/었으면: 알았으면 좋겠어요 (I wish I knew).</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Progressive / -고 있다 ────────────────────────────────────────────────────

export function KoProgressiveCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>-고 있다 — Progressive / Ongoing Action</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Attach -고 있어요 to the verb stem to express an action currently in progress (like English "-ing"). Also expresses a resultant state.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Ongoing Action (like -ing)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['먹고 있어요.', 'I am eating.'],
                ['공부하고 있어요.', 'I am studying.'],
                ['TV를 보고 있어요.', 'I am watching TV.'],
                ['뭐 하고 있어요?', 'What are you doing?'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Resultant State</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['앉아 있어요.', 'I am sitting. (seated)'],
                ['서 있어요.', 'I am standing. (upright)'],
                ['결혼하고 있어요.', 'I am married. (state)'],
                ['입고 있어요.', 'I am wearing.'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>Past progressive: -고 있었어요 (was doing). Negative: -고 있지 않아요 or 안 -고 있어요.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Honorifics ────────────────────────────────────────────────────────────────

export function KoHonorificsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>존댓말 — Korean Honorific Speech</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean has a sophisticated honorific system. Respect is shown through verb endings, vocabulary choices, and special honorific nouns.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Honorific Vocabulary Pairs</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Regular</span><span>Honorific</span><span>Meaning</span>
              </div>
              {[
                ['먹다', '드시다', 'to eat'],
                ['자다', '주무시다', 'to sleep'],
                ['말하다', '말씀하시다', 'to speak'],
                ['있다', '계시다', 'to be (person)'],
                ['죽다', '돌아가시다', 'to pass away'],
                ['이름', '성함', 'name'],
                ['집', '댁', 'home'],
                ['나이', '연세', 'age'],
              ].map(([r, h, m], i) => (
                <div key={r} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="text-muted-foreground">{r}</span>
                  <span className={`font-semibold ${KO}`}>{h}</span>
                  <span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>-(으)시 — Honorific Marker</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Insert -(으)시 into the verb to honor the subject.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['가다 → 가세요', 'Please go / Are you going?'],
                ['앉다 → 앉으세요', 'Please sit down.'],
                ['오다 → 오세요', 'Please come / Come.'],
                ['읽다 → 읽으세요', 'Please read.'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
            <NoteBox>The suffix -세요 (imperative/question honorific) is one of the most commonly heard Korean forms. 어디 가세요? means both "Where are you going?" and "Please go" depending on context.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── -고 Connective ────────────────────────────────────────────────────────────

export function KoConnectiveCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>연결어미 — Connective Endings (-고, -아서/어서, -(으)면서)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <SectionLabel>-고 — and then / and</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Connects two actions sequentially or simultaneously.</p>
            <PhraseList pairs={[
              ['밥을 먹고 운동했어요.', 'I ate and then exercised.'],
              ['예쁘고 착해요.', 'She\'s pretty and kind.'],
            ]} />
          </div>
          <div>
            <SectionLabel>-아서/어서 — because / and so</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Shows reason/cause. Can't be used with imperative or -겠다.</p>
            <PhraseList pairs={[
              ['배가 고파서 먹었어요.', 'I was hungry so I ate.'],
              ['피곤해서 잤어요.', 'I was tired so I slept.'],
            ]} />
          </div>
          <div>
            <SectionLabel>-(으)면서 — while doing</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Two actions happening simultaneously (same subject).</p>
            <PhraseList pairs={[
              ['음악을 들으면서 공부해요.', 'I study while listening to music.'],
              ['걸으면서 먹어요.', 'I eat while walking.'],
            ]} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Comparatives ──────────────────────────────────────────────────────────────

export function KoComparativesCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>비교 — Comparisons (더, 덜, 가장/제일)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <SectionLabel>더 (deo) — more</SectionLabel>
            <PhraseList pairs={[
              ['이게 더 커요.', 'This is bigger.'],
              ['오늘이 어제보다 더 추워요.', 'Today is colder than yesterday.'],
              ['저는 커피보다 차를 더 좋아해요.', 'I like tea more than coffee.'],
            ]} />
            <NoteBox><strong>A보다 B가 더 ~:</strong> "B is more ~ than A"</NoteBox>
          </div>
          <div>
            <SectionLabel>덜 (deol) — less</SectionLabel>
            <PhraseList pairs={[
              ['이게 덜 비싸요.', 'This is less expensive.'],
              ['오늘이 덜 추워요.', 'Today is less cold.'],
              ['이게 덜 맵지요?', 'This is less spicy, right?'],
            ]} />
          </div>
          <div>
            <SectionLabel>가장 / 제일 (gajang / jeil) — most</SectionLabel>
            <PhraseList pairs={[
              ['이게 가장 커요.', 'This is the biggest.'],
              ['제일 좋아하는 음식이 뭐예요?', 'What\'s your favorite food?'],
              ['한국어가 제일 재미있어요.', 'Korean is the most interesting.'],
            ]} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Requests / Imperative ─────────────────────────────────────────────────────

export function KoRequestsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>명령형 — Requests & Imperative (-(으)세요, -아/어 주세요)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>-(으)세요 — polite imperative</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">The most common polite command form.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['앉으세요.', 'Please sit down.'],
                ['잠깐만요.', 'Just a moment, please.'],
                ['천천히 말해 주세요.', 'Please speak slowly.'],
                ['들어오세요.', 'Please come in.'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>-아/어 주세요 — please do for me</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Requests an action done for the speaker's benefit.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['도와 주세요.', 'Please help me.'],
                ['사진 찍어 주세요.', 'Please take a photo.'],
                ['다시 해 주세요.', 'Please do it again.'],
                ['가르쳐 주세요.', 'Please teach me.'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>To make a prohibition: -지 마세요 (don't). 뛰지 마세요 (Don't run). 걱정하지 마세요 (Don't worry).</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Subject/Object Markers ────────────────────────────────────────────────────

export function KoSubjectObjectCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>이/가 & 을/를 — Subject & Object Markers</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>이/가 — Subject Marker</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">이 (i) after a consonant · 가 (ga) after a vowel. Marks the grammatical subject, often emphasizing new information.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['고양이가 자요.', 'The cat is sleeping.'],
                ['비가 와요.', 'Rain is falling.'],
                ['누가 했어요?', 'Who did it?'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>을/를 — Object Marker</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">을 (eul) after a consonant · 를 (reul) after a vowel. Marks the direct object of the verb.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['밥을 먹어요.', 'I eat rice.'],
                ['영화를 봐요.', 'I watch a movie.'],
                ['한국어를 공부해요.', 'I study Korean.'],
              ].map(([k, e], i) => (
                <div key={k} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{k}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>In spoken Korean, particles are often dropped in casual speech: 밥 먹어요? (Are you eating?). Restoring them adds clarity and formality.</NoteBox>
      </CardContent>
    </Card>
  );
}
