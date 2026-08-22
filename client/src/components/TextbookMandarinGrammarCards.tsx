import { Card, CardContent } from "@/components/ui/card";

const ZH = "text-red-700 dark:text-red-400";
const ZH_BG = "bg-red-500/10";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-wider ${ZH} mb-2`}>{children}</p>;
}

function ConjTable({ rows, headers = ['Pronoun', 'Character', 'Pinyin'] }: { rows: [string, string, string][]; headers?: [string, string, string] }) {
  return (
    <div className="rounded-md border border-border overflow-hidden text-sm">
      <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        <span>{headers[0]}</span><span>{headers[1]}</span><span>{headers[2]}</span>
      </div>
      {rows.map(([a, b, c], i) => (
        <div key={i} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
          <span className="text-muted-foreground">{a}</span>
          <span className="font-semibold">{b}</span>
          <span className="text-muted-foreground italic">{c}</span>
        </div>
      ))}
    </div>
  );
}

function PhraseList({ pairs }: { pairs: [string, string][] }) {
  return (
    <div className="space-y-1 mt-1">
      {pairs.map(([zh, en]) => (
        <div key={zh} className="flex gap-2 text-sm">
          <span className="font-semibold shrink-0">{zh}</span>
          <span className="text-muted-foreground">— {en}</span>
        </div>
      ))}
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-md ${ZH_BG} border border-red-300/30 dark:border-red-700/40 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

// ── Tones & Pinyin ─────────────────────────────────────────────────────────────

export function ZhPinyinTonesCard() {
  const tones: [string, string, string, string, string][] = [
    ['1st — 阴平', 'ā', 'High flat', 'High, steady pitch — like singing "aaah"', '妈 (mā) — mother'],
    ['2nd — 阳平', 'á', 'Rising', 'Rise like a question — "really?"', '麻 (má) — hemp, numb'],
    ['3rd — 上声', 'ǎ', 'Dip-rise', 'Fall then rise — like a doubtful "hm?"', '马 (mǎ) — horse'],
    ['4th — 去声', 'à', 'Falling', 'Sharp fall — like a firm command "stop!"', '骂 (mà) — to scold'],
    ['Neutral — 轻声', 'a', 'Light, short', 'Unstressed, quick — attached to particles', '吗 (ma) — question particle'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>声调 (Shēngdiào) — The Four Tones</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-5 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Tone</span><span>Mark</span><span>Pattern</span><span>Description</span><span>Example</span>
          </div>
          {tones.map(([name, mark, pattern, desc, ex], i) => (
            <div key={name} className={`grid grid-cols-5 px-3 py-2 text-sm ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold">{name}</span>
              <span className={`text-xl font-bold ${ZH}`}>{mark}</span>
              <span className="text-muted-foreground">{pattern}</span>
              <span className="text-muted-foreground">{desc}</span>
              <span className="font-medium">{ex}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Tone sandhi:</strong> Two 3rd tones in a row → first becomes 2nd tone: 你好 (nǐ hǎo → ní hǎo). 不 (bù) becomes bú before another 4th tone: 不是 → búshì. 一 (yī) changes with context: yí before 4th, yì before 1st/2nd/3rd.
        </NoteBox>
        <div className="mt-4">
          <SectionLabel>Pinyin Finals — Vowel Endings</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {['a','o','e','i','u','ü','ai','ei','ao','ou','an','en','ang','eng','ong','ia','ie','ua','uo','üe','ian','in','uan','ün','iang','ing','uang','ueng','iong'].map(f => (
              <span key={f} className={`px-2 py-0.5 rounded-md ${ZH_BG} text-sm font-mono`}>{f}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Hanzi Character Basics ─────────────────────────────────────────────────────

export function ZhHanziBasicsCard() {
  const strokes: [string, string][] = [
    ['横 héng', 'Horizontal stroke — left to right (一)'],
    ['竖 shù', 'Vertical stroke — top to bottom (丨)'],
    ['撇 piě', 'Left-falling stroke (丿)'],
    ['捺 nà', 'Right-falling stroke (㇏)'],
    ['折 zhé', 'Turning stroke — changes direction'],
    ['钩 gōu', 'Hook — added to other strokes'],
  ];
  const radicals: [string, string, string][] = [
    ['氵(water)', '海 hǎi — sea, 河 hé — river, 游 yóu — swim', 'Left side'],
    ['木 (wood)', '树 shù — tree, 桌 zhuō — table, 椅 yǐ — chair', 'Top or left'],
    ['口 (mouth)', '吃 chī — eat, 喝 hē — drink, 说 shuō — say', 'Left side'],
    ['人/亻(person)', '他 tā — he, 们 men — plural, 你 nǐ — you', 'Left side'],
    ['心/忄(heart)', '想 xiǎng — think, 情 qíng — feeling, 快 kuài — fast', 'Bottom or left'],
    ['日 (sun/day)', '明 míng — bright, 时 shí — time, 晴 qíng — sunny', 'Top or left'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>汉字 — How Characters Work</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">Mandarin uses ~50,000 characters; daily literacy needs ~2,000–3,000. Characters are built from strokes → components → radicals.</p>
            <SectionLabel>笔画 Bǐhuà — Stroke Types</SectionLabel>
            <div className="space-y-1 mt-1">
              {strokes.map(([s, d]) => (
                <div key={s} className="flex gap-2 text-sm">
                  <span className="font-semibold w-24 shrink-0">{s}</span>
                  <span className="text-muted-foreground">{d}</span>
                </div>
              ))}
            </div>
            <NoteBox>Stroke order rule: top→bottom, left→right, outside→inside. Consistent stroke order helps with memory and handwriting recognition.</NoteBox>
          </div>
          <div>
            <SectionLabel>部首 Bùshǒu — Common Radicals</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Radical</span><span>Examples</span><span>Position</span>
              </div>
              {radicals.map(([r, ex, pos], i) => (
                <div key={r} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-semibold">{r}</span>
                  <span className="text-muted-foreground text-xs">{ex}</span>
                  <span className="text-muted-foreground text-xs">{pos}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 是 (shì) — To Be ───────────────────────────────────────────────────────────

export function ZhShiCard() {
  const conj: [string, string, string][] = [
    ['我 wǒ', '我是...', 'Wǒ shì... — I am...'],
    ['你 nǐ', '你是...', 'Nǐ shì... — You are...'],
    ['他/她/它', '他是...', 'Tā shì... — He/She/It is...'],
    ['我们 wǒmen', '我们是...', 'Wǒmen shì... — We are...'],
    ['你们 nǐmen', '你们是...', 'Nǐmen shì... — You (pl.) are...'],
    ['他们 tāmen', '他们是...', 'Tāmen shì... — They are...'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>是 (Shì) — To Be</SectionLabel>
            <ConjTable rows={conj} headers={['Subject', 'Character', 'Pinyin + English']} />
            <NoteBox>
              是 does NOT change form — no conjugation! Negation: 不是 (bù shì) — "is not". Question: 你是学生吗? (Are you a student?) or 你是不是学生? (Affirmative-negative pattern).
            </NoteBox>
          </div>
          <div>
            <SectionLabel>Key Structures with 是</SectionLabel>
            <PhraseList pairs={[
              ['我是老师。', 'I am a teacher. (Wǒ shì lǎoshī.)'],
              ['这是什么？', 'What is this? (Zhè shì shénme?)'],
              ['他不是美国人。', 'He is not American. (Tā bú shì Měiguórén.)'],
              ['你是哪国人？', 'What nationality are you? (Nǐ shì nǎ guó rén?)'],
              ['我是中国人。', 'I am Chinese. (Wǒ shì Zhōngguórén.)'],
              ['是的 / 不是', 'Yes (shì de) / No (bú shì)'],
            ]} />
            <NoteBox>是 is NOT used with adjectives: "I am tall" = 我很高 (Wǒ hěn gāo), NOT 我是高. 很 (hěn — very) bridges subject and adjective.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 有 (yǒu) — To Have ────────────────────────────────────────────────────────

export function ZhYouCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>有 (Yǒu) — To Have / There Is</SectionLabel>
            <PhraseList pairs={[
              ['我有一本书。', 'I have a book. (Wǒ yǒu yī běn shū.)'],
              ['你有钱吗？', 'Do you have money? (Nǐ yǒu qián ma?)'],
              ['我没有时间。', 'I don\'t have time. (Wǒ méi yǒu shíjiān.)'],
              ['有没有水？', 'Is there any water? (Yǒu méi yǒu shuǐ?)'],
              ['这里有人吗？', 'Is there anyone here? (Zhèlǐ yǒu rén ma?)'],
            ]} />
            <NoteBox>
              Negation of 有 uses 没 (méi), NOT 不: 我没有 ✓ — 我不有 ✗. The same 没 is used for past actions: 我没去 (I didn't go) — replaces 不 in past.
            </NoteBox>
          </div>
          <div>
            <SectionLabel>有 as Existential — There Is / Are</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Chinese</span><span>English</span>
              </div>
              {[
                ['桌子上有一本书。', 'There is a book on the table.'],
                ['教室里没有人。', 'There is no one in the classroom.'],
                ['冰箱里有水果。', 'There is fruit in the fridge.'],
                ['这个城市有很多公园。', 'This city has many parks.'],
                ['有意思 / 没意思', 'Interesting / Uninteresting'],
              ].map(([zh, en], i) => (
                <div key={zh} className={`grid grid-cols-2 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-semibold">{zh}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 在 (zài) — Location / To Be At ────────────────────────────────────────────

export function ZhZaiCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>在 (Zài) — At / In / To Be Located</SectionLabel>
            <PhraseList pairs={[
              ['我在家。', 'I am at home. (Wǒ zài jiā.)'],
              ['他在哪里？', 'Where is he? (Tā zài nǎlǐ?)'],
              ['书在桌子上。', 'The book is on the table. (Shū zài zhuōzi shàng.)'],
              ['我在学中文。', 'I am studying Chinese. (progressive)'],
              ['你在做什么？', 'What are you doing?'],
            ]} />
            <NoteBox>在 + location: subject location. 在 + verb: progressive action (I am doing...). Position words follow the location: 上(shàng) above, 下(xià) below, 里(lǐ) inside, 旁边(pángbiān) beside.</NoteBox>
          </div>
          <div>
            <SectionLabel>Location Words (方位词)</SectionLabel>
            <div className="grid grid-cols-2 gap-x-4 mt-1">
              {[
                ['上 shàng', 'on top, above'],
                ['下 xià', 'below, under'],
                ['里 lǐ', 'inside'],
                ['外 wài', 'outside'],
                ['前 qián', 'in front'],
                ['后 hòu', 'behind'],
                ['左 zuǒ', 'left'],
                ['右 yòu', 'right'],
                ['旁边 pángbiān', 'beside'],
                ['中间 zhōngjiān', 'in the middle'],
              ].map(([zh, en]) => (
                <div key={zh} className="flex gap-2 text-sm py-0.5">
                  <span className="font-semibold w-24 shrink-0">{zh}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Action Verbs ────────────────────────────────────────────────────────────────

export function ZhActionVerbsCard() {
  const verbs: [string, string, string][] = [
    ['吃 chī', 'to eat', '我吃米饭。(I eat rice.)'],
    ['喝 hē', 'to drink', '我喝茶。(I drink tea.)'],
    ['说 shuō', 'to speak/say', '我说中文。(I speak Chinese.)'],
    ['看 kàn', 'to see/watch', '我看电影。(I watch movies.)'],
    ['听 tīng', 'to listen', '我听音乐。(I listen to music.)'],
    ['写 xiě', 'to write', '我写汉字。(I write characters.)'],
    ['读 dú', 'to read aloud', '我读书。(I read/study.)'],
    ['去 qù', 'to go', '我去学校。(I go to school.)'],
    ['来 lái', 'to come', '他来了！(He has come!)'],
    ['买 mǎi', 'to buy', '我买苹果。(I buy apples.)'],
    ['卖 mài', 'to sell', '他卖水果。(He sells fruit.)'],
    ['做 zuò', 'to do/make', '我做饭。(I cook.)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>动词 (Dòngcí) — Action Verbs</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Mandarin verbs do NOT conjugate for person or number. The same form works for all subjects. Tense is shown by time words and aspect particles.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Verb</span><span>Meaning</span><span>Example</span>
          </div>
          {verbs.map(([v, m, ex], i) => (
            <div key={v} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold">{v}</span>
              <span className="text-muted-foreground">{m}</span>
              <span className="text-muted-foreground text-xs">{ex}</span>
            </div>
          ))}
        </div>
        <NoteBox>Basic sentence order: Subject + Time + Place + Verb + Object. Time and place come BEFORE the verb — opposite of English.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Modal Verbs ────────────────────────────────────────────────────────────────

export function ZhModalVerbsCard() {
  const modals: [string, string, string, string][] = [
    ['会 huì', 'can (learned skill)', '我会说中文。', 'I can speak Chinese.'],
    ['能 néng', 'can (physically able/permitted)', '你能帮我吗？', 'Can you help me?'],
    ['可以 kěyǐ', 'may (permission)', '我可以进来吗？', 'May I come in?'],
    ['要 yào', 'want to / need to / will', '我要喝水。', 'I want/need to drink water.'],
    ['想 xiǎng', 'would like to / want to', '我想去中国。', 'I\'d like to go to China.'],
    ['应该 yīnggāi', 'should / ought to', '你应该休息。', 'You should rest.'],
    ['必须 bìxū', 'must / have to', '我必须工作。', 'I must work.'],
    ['得 děi', 'have to (colloquial)', '我得走了。', 'I have to go now.'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>能愿动词 — Modal Verbs</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Modal</span><span>Core Meaning</span><span>Example</span><span>Translation</span>
          </div>
          {modals.map(([m, d, ex, en], i) => (
            <div key={m} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold">{m}</span>
              <span className="text-muted-foreground text-xs">{d}</span>
              <span className="font-medium text-xs">{ex}</span>
              <span className="text-muted-foreground text-xs">{en}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>会 vs 能 vs 可以:</strong> 会 = learned ability (can because you studied it). 能 = capacity/permission (physically possible or allowed). 可以 = permission primarily. These overlap in casual speech but nuance matters in formal contexts.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Aspect Particle 了 ────────────────────────────────────────────────────────

export function ZhLeAspectCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>了 (Le) — Completion Aspect</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">了 marks that an action has been completed. It is NOT a past tense marker — it marks aspect, not time.</p>
            <PhraseList pairs={[
              ['我吃了。', 'I\'ve eaten. / I ate (it).'],
              ['他买了一本书。', 'He bought a book.'],
              ['我们看了那个电影。', 'We watched that movie.'],
              ['她来了。', 'She has come (and is here).'],
              ['我学了三年中文。', 'I\'ve studied Chinese for 3 years.'],
            ]} />
          </div>
          <div>
            <SectionLabel>了 as Change-of-State</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">Sentence-final 了 signals a new situation or change.</p>
            <PhraseList pairs={[
              ['我懂了！', 'Now I understand! (new realization)'],
              ['他去中国了。', 'He has gone to China (situation changed).'],
              ['天黑了。', 'It\'s gotten dark (change).'],
              ['我不吃了。', 'I\'m done eating (stopping action).'],
              ['好了，我们走吧。', 'OK, let\'s go (situation settled).'],
            ]} />
            <NoteBox>
              <strong>Past without 了:</strong> Habitual past uses time words: 昨天我去学校 (Yesterday I went to school) — 了 optional here. 过 (guò) marks past experience: 我去过中国 (I have been to China before).
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Negation ───────────────────────────────────────────────────────────────────

export function ZhNegationCard() {
  const rules: [string, string, string, string][] = [
    ['不 bù', 'General negation', '我不去。(I\'m not going.)', 'Habitual, present, future, adj'],
    ['没 méi', 'Negates 有 & past events', '我没有钱。(I don\'t have money.)', 'Use with 有 and completed actions'],
    ['不是 bú shì', 'Negates identity', '他不是老师。(He\'s not a teacher.)', 'Negation of 是'],
    ['不用 bù yòng', 'Don\'t need to', '你不用担心。(You don\'t need to worry.)', 'Weaker than 不必'],
    ['别 bié', 'Don\'t! (command)', '别说话！(Don\'t talk!)', 'Negative imperative'],
    ['不太 bù tài', 'Not very / not that', '我不太累。(I\'m not that tired.)', 'Softened negation'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>否定 (Fǒudìng) — Negation</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Word</span><span>Usage</span><span>Example</span><span>Notes</span>
          </div>
          {rules.map(([w, u, ex, n], i) => (
            <div key={w} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold">{w}</span>
              <span className="text-muted-foreground text-xs">{u}</span>
              <span className="text-xs">{ex}</span>
              <span className="text-muted-foreground text-xs">{n}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>不 tone change:</strong> 不 is normally 4th tone (bù) but becomes 2nd (bú) before another 4th tone: 不是 → búshì, 不去 → búqù.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Questions ─────────────────────────────────────────────────────────────────

export function ZhQuestionsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>疑问句 — Question Formation (3 Methods)</SectionLabel>
            <div className="space-y-3 mt-1 text-sm">
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold mb-1">Method 1 — 吗 (ma) particle</p>
                <p>Add 吗 to the end of any statement.</p>
                <p className="text-muted-foreground mt-1">你是学生。→ 你是学生吗？ (Are you a student?)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold mb-1">Method 2 — Affirmative-Negative (A-not-A)</p>
                <p>Verb + 不/没 + Verb: Nǐ shì bu shì…?</p>
                <p className="text-muted-foreground mt-1">你去不去？(Are you going or not?) 你有没有？(Do you have it?)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold mb-1">Method 3 — Question Words (疑问词)</p>
                <p>Replace the unknown element with a question word.</p>
                <p className="text-muted-foreground mt-1">他是老师。→ 他是什么？(What is he?) / 谁是老师？(Who is the teacher?)</p>
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>呢 (ne) — Returning Questions</SectionLabel>
            <PhraseList pairs={[
              ['我很好，你呢？', 'I\'m fine, and you?'],
              ['他去了，她呢？', 'He went, what about her?'],
              ['我叫大明，你呢？', 'My name is Daming, and yours?'],
            ]} />
            <div className="mt-4">
              <SectionLabel>Tag & Confirmation Particles</SectionLabel>
              <PhraseList pairs={[
                ['对吧？ duì ba', 'Right? / Isn\'t it?'],
                ['是吗？ shì ma', 'Really? / Is that so?'],
                ['好吗？ hǎo ma', 'OK? / Is that good?'],
                ['好不好？ hǎo bu hǎo', 'How about it? (A-not-A)'],
                ['嗯 ń / ng', 'Hmm? / Yes (affirmation)'],
              ]} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Question Words ─────────────────────────────────────────────────────────────

export function ZhQuestionWordsCard() {
  const qwords: [string, string, string][] = [
    ['什么 shénme', 'what', '这是什么？— What is this?'],
    ['谁 shéi / shuí', 'who', '他是谁？— Who is he?'],
    ['哪 nǎ / 哪个 nǎge', 'which', '你要哪个？— Which one do you want?'],
    ['哪里/哪儿 nǎlǐ/nǎr', 'where', '你在哪里？— Where are you?'],
    ['什么时候 shénme shíhòu', 'when', '你什么时候来？— When are you coming?'],
    ['为什么 wèishénme', 'why', '你为什么不去？— Why aren\'t you going?'],
    ['怎么 zěnme', 'how (manner)', '你怎么去？— How will you get there?'],
    ['怎么样 zěnmeyàng', 'how (condition/opinion)', '天气怎么样？— How\'s the weather?'],
    ['多少 duōshǎo', 'how many/much (>10)', '多少钱？— How much money?'],
    ['几 jǐ', 'how many (<10)', '你有几个兄弟？— How many brothers?'],
    ['多 duō', 'how (degree)', '你多高？— How tall are you?'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>疑问词 (Yíwèncí) — Question Words</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Unlike English, question words stay in position — they replace the unknown element in normal sentence order.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Word</span><span>Meaning</span><span>Example</span>
          </div>
          {qwords.map(([w, m, ex], i) => (
            <div key={w} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold">{w}</span>
              <span className="text-muted-foreground">{m}</span>
              <span className="text-muted-foreground text-xs">{ex}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Numbers ────────────────────────────────────────────────────────────────────

export function ZhNumbersCard() {
  const nums: [string, string, string][] = [
    ['零 líng', '0', 'zero'],
    ['一 yī', '1', 'one'],
    ['二 èr / 两 liǎng', '2', 'two (两 before measure words)'],
    ['三 sān', '3', 'three'],
    ['四 sì', '4', 'four'],
    ['五 wǔ', '5', 'five'],
    ['六 liù', '6', 'six'],
    ['七 qī', '7', 'seven'],
    ['八 bā', '8', 'eight'],
    ['九 jiǔ', '9', 'nine'],
    ['十 shí', '10', 'ten'],
    ['百 bǎi', '100', 'hundred'],
    ['千 qiān', '1,000', 'thousand'],
    ['万 wàn', '10,000', 'ten-thousand (key unit!)'],
    ['亿 yì', '100,000,000', 'hundred million'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>数字 (Shùzì) — Numbers</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Character</span><span>Value</span><span>Notes</span>
              </div>
              {nums.map(([c, v, n], i) => (
                <div key={c} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-semibold">{c}</span>
                  <span className="text-muted-foreground">{v}</span>
                  <span className="text-muted-foreground text-xs">{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Building Numbers</SectionLabel>
            <div className="space-y-1 text-sm">
              {[
                ['11', '十一 shíyī'],
                ['20', '二十 èrshí'],
                ['21', '二十一 èrshíyī'],
                ['100', '一百 yī bǎi'],
                ['101', '一百零一 yī bǎi líng yī'],
                ['1,000', '一千 yī qiān'],
                ['10,000', '一万 yī wàn'],
                ['100,000', '十万 shí wàn'],
                ['1,000,000', '一百万 yī bǎi wàn'],
                ['100,000,000', '一亿 yī yì'],
              ].map(([en, zh]) => (
                <div key={en} className="flex gap-4">
                  <span className="w-24 text-muted-foreground">{en}</span>
                  <span className="font-semibold">{zh}</span>
                </div>
              ))}
            </div>
            <NoteBox>
              <strong>万 system:</strong> Chinese groups by 10,000 (万), not 1,000 like English. 1,000,000 = 一百万 (100 ten-thousands). Phone numbers and years use digits individually: 二零二四 (2024).
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Measure Words ──────────────────────────────────────────────────────────────

export function ZhMeasureWordsCard() {
  const measures: [string, string, string][] = [
    ['个 gè', 'General (default)', '一个人 (one person), 两个苹果 (two apples)'],
    ['本 běn', 'Bound items (books)', '三本书 (three books), 一本字典 (a dictionary)'],
    ['张 zhāng', 'Flat things (paper, tables)', '一张纸 (a piece of paper), 两张桌子 (two tables)'],
    ['条 tiáo', 'Long flexible (fish, roads)', '一条鱼 (a fish), 一条裤子 (a pair of pants)'],
    ['件 jiàn', 'Clothing items / matters', '两件衬衫 (two shirts), 一件事 (one matter)'],
    ['只 zhī', 'Animals (small), one of pair', '一只猫 (a cat), 两只手 (two hands)'],
    ['双 shuāng', 'Pairs (shoes, chopsticks)', '一双鞋 (a pair of shoes)'],
    ['杯 bēi', 'Cups / glasses of liquid', '一杯水 (a glass of water), 两杯咖啡 (two coffees)'],
    ['碗 wǎn', 'Bowls of food', '一碗米饭 (a bowl of rice), 两碗面 (two bowls of noodles)'],
    ['瓶 píng', 'Bottles', '一瓶水 (a bottle of water)'],
    ['位 wèi', 'Polite: persons', '两位老师 (two teachers — respectful)'],
    ['次 cì', 'Times / occurrences', '去了三次 (went three times)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>量词 (Liàngcí) — Measure Words</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Every noun requires a measure word between numbers and the noun: Number + Measure + Noun. There is no plural "s" in Mandarin.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Measure Word</span><span>Used For</span><span>Examples</span>
          </div>
          {measures.map(([m, u, ex], i) => (
            <div key={m} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold">{m}</span>
              <span className="text-muted-foreground text-xs">{u}</span>
              <span className="text-muted-foreground text-xs">{ex}</span>
            </div>
          ))}
        </div>
        <NoteBox>When unsure of the right measure word, 个 (gè) is the safe default for most nouns in spoken Mandarin.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Time Expressions ──────────────────────────────────────────────────────────

export function ZhTimeExpressionsCard() {
  const times: [string, string][] = [
    ['现在 xiànzài', 'now'],
    ['今天 jīntiān', 'today'],
    ['昨天 zuótiān', 'yesterday'],
    ['明天 míngtiān', 'tomorrow'],
    ['今年 jīnnián', 'this year'],
    ['上午 shàngwǔ', 'morning (AM)'],
    ['下午 xiàwǔ', 'afternoon (PM)'],
    ['晚上 wǎnshàng', 'evening/night'],
    ['早上 zǎoshàng', 'early morning'],
    ['上个月 shàng gè yuè', 'last month'],
    ['下个星期 xià gè xīngqī', 'next week'],
    ['每天 měitiān', 'every day'],
  ];
  const clock: [string, string][] = [
    ['几点了？', 'What time is it?'],
    ['两点 liǎng diǎn', '2:00 o\'clock'],
    ['三点半 sān diǎn bàn', '3:30 (half past three)'],
    ['四点一刻 sì diǎn yīkè', '4:15 (quarter past four)'],
    ['差五分六点', '5:55 (five to six)'],
    ['上午八点 shàngwǔ bā diǎn', '8:00 AM'],
    ['下午三点 xiàwǔ sān diǎn', '3:00 PM'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>时间词 — Time Words</SectionLabel>
            <div className="grid grid-cols-2 gap-x-4 mt-1">
              {times.map(([zh, en]) => (
                <div key={zh} className="flex gap-2 text-sm py-0.5">
                  <span className="font-semibold shrink-0">{zh}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>时刻 — Telling the Time</SectionLabel>
            <PhraseList pairs={clock} />
            <NoteBox>
              Time order in Mandarin: Year → Month → Day → Time of day → Hour. Time words come BEFORE the verb: 我明天去 (I'm going tomorrow) — NOT 我去明天.
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Direction & Movement ──────────────────────────────────────────────────────

export function ZhDirectionCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>趋向补语 — Direction Complements</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">Direction complements follow verbs to indicate direction of movement toward or away from speaker.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Complement</span><span>Meaning</span><span>Example</span>
              </div>
              {[
                ['来 lái', 'toward speaker', '进来 (come in)'],
                ['去 qù', 'away from speaker', '出去 (go out)'],
                ['上来 shànglái', 'come up', '走上来 (walk up here)'],
                ['下去 xiàqù', 'go down', '走下去 (walk down there)'],
                ['进来 jìnlái', 'come in', '请进来！(Please come in!)'],
                ['出去 chūqù', 'go out', '他跑出去了。(He ran out.)'],
                ['回来 huílái', 'come back', '你什么时候回来？'],
                ['过来 guòlái', 'come over', '你过来一下。(Come over here.)'],
              ].map(([c, m, ex], i) => (
                <div key={c} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-semibold">{c}</span>
                  <span className="text-muted-foreground text-xs">{m}</span>
                  <span className="text-xs">{ex}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Movement Verbs</SectionLabel>
            <PhraseList pairs={[
              ['去 qù — to go', '我去北京。(I\'m going to Beijing.)'],
              ['来 lái — to come', '请来我家。(Please come to my house.)'],
              ['走 zǒu — to walk/leave', '我们走吧。(Let\'s go.)'],
              ['跑 pǎo — to run', '他跑得很快。(He runs fast.)'],
              ['骑 qí — to ride (bike)', '我骑自行车。(I ride a bicycle.)'],
              ['开车 kāi chē — to drive', '我开车去。(I\'m driving there.)'],
              ['坐 zuò — to sit / take (transport)', '我坐地铁。(I take the subway.)'],
              ['飞 fēi — to fly', '飞机飞得很快。(The plane flies fast.)'],
            ]} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Resultative Complements ────────────────────────────────────────────────────

export function ZhResultativeCard() {
  const results: [string, string, string][] = [
    ['好 hǎo', 'completion / done right', '做好了 (finished doing it correctly)'],
    ['完 wán', 'completion / finished', '吃完了 (finished eating)'],
    ['到 dào', 'reaching a goal / until', '找到了 (found it!)'],
    ['见 jiàn', 'perceiving (seeing/hearing)', '看见了 (saw it)'],
    ['懂 dǒng', 'understanding', '听懂了 (heard and understood)'],
    ['会 huì', 'mastery achieved', '学会了 (learned it successfully)'],
    ['错 cuò', 'done incorrectly', '说错了 (said it wrong)'],
    ['清楚 qīngchǔ', 'clearly / clearly perceived', '说清楚 (say it clearly)'],
    ['不了 buliǎo', 'unable to complete', '吃不了 (can\'t finish eating)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>结果补语 (Jiéguǒ Bǔyǔ) — Resultative Complements</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Resultative complements attach directly to verbs to show the result or outcome of an action — a uniquely Chinese feature.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Complement</span><span>Meaning</span><span>Example</span>
          </div>
          {results.map(([c, m, ex], i) => (
            <div key={c} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold">{c}</span>
              <span className="text-muted-foreground text-xs">{m}</span>
              <span className="text-xs">{ex}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          Potential form: insert 得 (positive) or 不 (negative) between verb and complement: 看得见 (can see) / 看不见 (can't see). 吃得完 (can finish) / 吃不完 (can't finish).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── 把 Construction ────────────────────────────────────────────────────────────

export function ZhBaCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>把 (Bǎ) — Object-Fronting Construction</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">把 moves the object before the verb to emphasize what happens TO or WITH the object. The verb must show result or completion.</p>
            <div className="p-3 rounded-md bg-muted/40 text-sm space-y-2">
              <p className="font-semibold">Structure: Subject + 把 + Object + Verb + Result/Complement</p>
              <p className="text-muted-foreground">Normal: 我吃了那个苹果。(I ate that apple.)</p>
              <p className="text-muted-foreground">把: 我把那个苹果吃完了。(I ate that apple up — result emphasized)</p>
            </div>
            <NoteBox>把 requires a specific, definite object and a verb that shows effect/disposal/change. Cannot use bare verbs: 我把书看 ✗ → 我把书看完了 ✓.</NoteBox>
          </div>
          <div>
            <SectionLabel>把 Examples</SectionLabel>
            <PhraseList pairs={[
              ['把门关上。', 'Close the door. (Bǎ mén guān shàng.)'],
              ['我把作业做完了。', 'I finished my homework.'],
              ['他把钱用完了。', 'He used up all the money.'],
              ['请把这个给她。', 'Please give this to her.'],
              ['我把手机放在桌子上。', 'I put my phone on the table.'],
              ['别把书弄脏了！', 'Don\'t dirty the book!'],
            ]} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Comparison ─────────────────────────────────────────────────────────────────

export function ZhComparisonCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>比较 (Bǐjiào) — Comparison Structures</SectionLabel>
            <div className="space-y-3 text-sm">
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">比 bǐ — A is [more] than B</p>
                <p className="text-muted-foreground">A + 比 + B + Adjective (+度量)</p>
                <p className="mt-1">他比我高。(He is taller than me.)</p>
                <p className="text-muted-foreground">他比我高三厘米。(He is 3 cm taller than me.)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">没有 méiyǒu — A is not as [adj] as B</p>
                <p className="text-muted-foreground">A + 没有 + B + Adjective</p>
                <p className="mt-1">我没有他高。(I am not as tall as him.)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">一样 yīyàng — A is as [adj] as B / same</p>
                <p className="text-muted-foreground">A + 跟/和 + B + 一样 (+Adj)</p>
                <p className="mt-1">我跟你一样高。(I\'m as tall as you.)</p>
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>更 gèng (even more) & 最 zuì (most)</SectionLabel>
            <PhraseList pairs={[
              ['他更高。', 'He is even taller.'],
              ['今天比昨天更冷。', 'Today is even colder than yesterday.'],
              ['她是最高的。', 'She is the tallest. (She is the most tall.)'],
              ['中国是世界上最大的国家之一。', 'China is one of the largest countries in the world.'],
              ['哪个更好？', 'Which one is better?'],
              ['这个最便宜。', 'This one is the cheapest.'],
            ]} />
            <NoteBox>
              Do NOT use 更 or 最 inside a 比 sentence: 他比我更高 ✓ — idiomatic. Add 还 (hái) for "even more": 他比我还高 (He is even taller than me — surprising).
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 的/地/得 Particles ─────────────────────────────────────────────────────────

export function ZhDeParticlesCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>的 / 地 / 得 — The Three "De" Particles</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">All three are pronounced "de" but serve distinct grammatical functions and use different characters.</p>
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-border">
            <p className="font-semibold text-sm mb-1">的 de — Structural particle (modifier → noun)</p>
            <p className="text-xs text-muted-foreground mb-2">Connects adjectives/nouns/phrases to the noun they modify. = English 's or "of"</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['我的书', 'my book (I\'s book)'],
                ['漂亮的女孩', 'a beautiful girl'],
                ['红色的车', 'a red car'],
                ['他买的苹果', 'the apples he bought'],
              ].map(([zh, en]) => (
                <div key={zh} className="flex gap-2"><span className="font-semibold">{zh}</span><span className="text-muted-foreground">{en}</span></div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-md border border-border">
            <p className="font-semibold text-sm mb-1">地 de — Adverbial particle (manner → verb)</p>
            <p className="text-xs text-muted-foreground mb-2">Connects adverbs/manner phrases to the verb they modify. = English "-ly"</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['高兴地笑', 'to laugh happily'],
                ['认真地学习', 'to study seriously'],
                ['慢慢地走', 'to walk slowly'],
                ['大声地说', 'to speak loudly'],
              ].map(([zh, en]) => (
                <div key={zh} className="flex gap-2"><span className="font-semibold">{zh}</span><span className="text-muted-foreground">{en}</span></div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-md border border-border">
            <p className="font-semibold text-sm mb-1">得 de — Degree/result complement (verb → degree)</p>
            <p className="text-xs text-muted-foreground mb-2">Connects verbs to complements showing degree, manner of result, or potential.</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['说得很好', 'speaks very well'],
                ['跑得快', 'runs fast'],
                ['写得很漂亮', 'writes beautifully'],
                ['高兴得跳起来', 'so happy (they) jumped'],
              ].map(([zh, en]) => (
                <div key={zh} className="flex gap-2"><span className="font-semibold">{zh}</span><span className="text-muted-foreground">{en}</span></div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Progressive ────────────────────────────────────────────────────────────────

export function ZhProgressiveCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>进行体 — Progressive / Ongoing Actions</SectionLabel>
            <div className="space-y-3 text-sm">
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">在 zài + Verb (ongoing)</p>
                <p className="text-muted-foreground">我在吃饭。(I am eating.)</p>
                <p className="text-muted-foreground">他在睡觉。(He is sleeping.)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">正在 zhèngzài + Verb (right now)</p>
                <p className="text-muted-foreground">我正在工作。(I am working right now.)</p>
                <p className="text-muted-foreground">她正在打电话。(She is making a phone call.)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">Verb + 着 zhe (durative — state)</p>
                <p className="text-muted-foreground">门开着。(The door is open — ongoing state.)</p>
                <p className="text-muted-foreground">他戴着帽子。(He is wearing a hat — has it on.)</p>
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>呢 (ne) at Sentence End</SectionLabel>
            <p className="text-sm text-muted-foreground mb-2">Adding 呢 emphasizes ongoing action.</p>
            <PhraseList pairs={[
              ['我吃饭呢。', 'I\'m (in the middle of) eating.'],
              ['他睡觉呢！别吵！', 'He\'s sleeping! Don\'t be noisy!'],
              ['你在哪里呢？', 'Where are you (right now)?'],
            ]} />
            <div className="mt-4">
              <SectionLabel>Continuous Structures</SectionLabel>
              <PhraseList pairs={[
                ['一直 yīzhí', 'continuously, all along'],
                ['还在 hái zài', 'still (doing)'],
                ['一边...一边...', 'doing A while doing B'],
                ['我一边吃饭一边看书。', 'I eat while reading.'],
              ]} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Complements of Degree ──────────────────────────────────────────────────────

export function ZhDegreeComplementCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>程度补语 — Complements of Degree (Verb + 得)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">得 (de) links a verb to a phrase describing how well or to what degree the action is performed.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Structure: Verb + 得 + Complement</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Chinese</span><span>English</span>
              </div>
              {[
                ['他说得很好。', 'He speaks very well.'],
                ['你跑得太快了！', 'You run too fast!'],
                ['她唱得真好听。', 'She sings really beautifully.'],
                ['我写得不太好。', 'I don\'t write very well.'],
                ['他睡得晚。', 'He goes to sleep late.'],
                ['我学得很慢。', 'I learn quite slowly.'],
              ].map(([zh, en], i) => (
                <div key={zh} className={`grid grid-cols-2 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-semibold">{zh}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>With Objects (repeat verb)</SectionLabel>
            <p className="text-sm text-muted-foreground mb-2">If a verb has an object, the verb must be repeated after the object before 得.</p>
            <PhraseList pairs={[
              ['她说中文说得很好。', 'She speaks Chinese very well.'],
              ['他唱歌唱得太棒了！', 'He sings so amazingly!'],
              ['我做饭做得不好。', 'I don\'t cook well.'],
            ]} />
            <NoteBox>Common degree expressions: 很 (very), 非常 (extremely), 太...了 (too...), 真 (truly), 不太 (not very), 有点 (a bit).</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Topic-Comment Structure ────────────────────────────────────────────────────

export function ZhTopicCommentCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>话题-评论结构 — Topic-Comment Structure</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">Mandarin is a topic-prominent language. The topic (what we're talking about) comes first, then the comment (what we say about it).</p>
            <div className="space-y-2 text-sm">
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">Topic first (no "as for" needed)</p>
                <p className="text-muted-foreground">这本书，我看过。(This book, I've read it.)</p>
                <p className="text-muted-foreground">北京，我去了三次。(Beijing, I've been three times.)</p>
                <p className="text-muted-foreground">这个人，我不认识。(This person, I don't know.)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">Double subject</p>
                <p className="text-muted-foreground">大象，鼻子很长。(Elephants, their noses are long.)</p>
                <p className="text-muted-foreground">中国，人口很多。(China, its population is huge.)</p>
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>Sentence Final Particles</SectionLabel>
            <PhraseList pairs={[
              ['吗 ma — question', '你去吗？(Are you going?)'],
              ['呢 ne — follow-up', '你呢？(And you?)'],
              ['吧 ba — assumption/suggestion', '你累了吧？(You must be tired.)'],
              ['啊 a — exclamation', '真好啊！(That\'s great!)'],
              ['嘛 ma — obviousness', '他是老师嘛。(He IS a teacher, after all.)'],
              ['了 le — change of state', '我懂了。(I understand now.)'],
            ]} />
            <NoteBox>Topic-comment allows Mandarin sentences without a subject: 冷死了。(So cold! [I\'m dying of cold.]) — the topic "I" is dropped because it's understood from context.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Chéngyǔ — 4-Character Idioms ──────────────────────────────────────────────

export function ZhChengYuCard() {
  const chengyus: [string, string, string, string][] = [
    ['一石二鸟', 'yī shí èr niǎo', 'One stone, two birds', 'Kill two birds with one stone'],
    ['半途而废', 'bàntú ér fèi', 'Halfway give up', 'To quit halfway / give up midway'],
    ['马到成功', 'mǎ dào chéng gōng', 'Horse arrives, success achieved', 'Instant success; victory is assured'],
    ['一帆风顺', 'yī fān fēng shùn', 'One sail, smooth wind', 'Smooth sailing; going well'],
    ['亡羊补牢', 'wáng yáng bǔ láo', 'Lost sheep, fix pen', 'Better late than never'],
    ['四面八方', 'sì miàn bā fāng', 'Four faces, eight directions', 'From all directions / everywhere'],
    ['千方百计', 'qiān fāng bǎi jì', 'Thousand ways, hundred plans', 'By every possible means'],
    ['一步一个脚印', 'yī bù yī gè jiǎoyìn', 'One step, one footprint', 'Step by step; steady progress'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>成语 (Chéngyǔ) — 4-Character Idioms</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Chéngyǔ are fixed 4-character expressions derived from classical Chinese stories and history. They carry deep cultural meaning and appear frequently in educated speech and writing.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Character</span><span>Pinyin</span><span>Literal</span><span>Meaning</span>
          </div>
          {chengyus.map(([ch, py, lit, en], i) => (
            <div key={ch} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold">{ch}</span>
              <span className="text-muted-foreground italic">{py}</span>
              <span className="text-muted-foreground text-xs">{lit}</span>
              <span className="text-xs">{en}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
