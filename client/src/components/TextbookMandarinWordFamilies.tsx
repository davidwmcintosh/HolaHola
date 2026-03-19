import { Card, CardContent } from "@/components/ui/card";

const ZH = "text-red-700 dark:text-red-400";
const ZH_BG = "bg-red-500/10";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-wider ${ZH} mb-2`}>{children}</p>;
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-md ${ZH_BG} border border-red-300/30 dark:border-red-700/40 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

interface WordEntry { character: string; pinyin: string; type: string; meaning: string }

function FamilyCard({ root, rootPinyin, rootMeaning, words }: { root: string; rootPinyin: string; rootMeaning: string; words: WordEntry[] }) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className={`shrink-0 w-16 h-16 rounded-md ${ZH_BG} flex items-center justify-center`}>
            <span className={`text-3xl font-bold ${ZH}`}>{root}</span>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${ZH}`}>Root Character</p>
            <p className="text-xl font-bold">{root} — {rootPinyin}</p>
            <p className="text-sm text-muted-foreground">{rootMeaning}</p>
          </div>
        </div>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Character</span><span>Pinyin</span><span>Type</span><span>Meaning</span>
          </div>
          {words.map((w, i) => (
            <div key={w.character + i} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-bold text-base">{w.character}</span>
              <span className="text-muted-foreground italic">{w.pinyin}</span>
              <span className={`text-xs font-medium ${ZH}`}>{w.type}</span>
              <span className="text-muted-foreground">{w.meaning}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 说 (shuō) — to speak ──────────────────────────────────────────────────────

export function ZhShuoFamilyCard() {
  return <FamilyCard root="说" rootPinyin="shuō" rootMeaning="to speak, to say, to talk" words={[
    { character: '说', pinyin: 'shuō', type: 'verb', meaning: 'to speak, to say' },
    { character: '说话', pinyin: 'shuō huà', type: 'verb', meaning: 'to talk, to speak (words)' },
    { character: '说明', pinyin: 'shuōmíng', type: 'verb/noun', meaning: 'to explain; explanation, instructions' },
    { character: '说法', pinyin: 'shuōfa', type: 'noun', meaning: 'way of saying, statement, account' },
    { character: '说服', pinyin: 'shuōfú', type: 'verb', meaning: 'to persuade, to convince' },
    { character: '解说', pinyin: 'jiěshuō', type: 'verb/noun', meaning: 'to explain, commentary' },
    { character: '传说', pinyin: 'chuánshuō', type: 'noun', meaning: 'legend, tradition, it is said that' },
    { character: '小说', pinyin: 'xiǎoshuō', type: 'noun', meaning: 'novel, fiction' },
    { character: '演说', pinyin: 'yǎnshuō', type: 'noun/verb', meaning: 'speech, lecture, to give a speech' },
    { character: '据说', pinyin: 'jùshuō', type: 'phrase', meaning: 'it is said that, reportedly' },
  ]} />;
}

// ── 吃 (chī) — to eat ─────────────────────────────────────────────────────────

export function ZhChiFamilyCard() {
  return <FamilyCard root="吃" rootPinyin="chī" rootMeaning="to eat, to consume" words={[
    { character: '吃', pinyin: 'chī', type: 'verb', meaning: 'to eat' },
    { character: '吃饭', pinyin: 'chī fàn', type: 'phrase', meaning: 'to eat (a meal), to have a meal' },
    { character: '吃力', pinyin: 'chīlì', type: 'adj', meaning: 'strenuous, laborious, tiring' },
    { character: '吃亏', pinyin: 'chīkuī', type: 'verb', meaning: 'to suffer a loss, to be at a disadvantage' },
    { character: '吃惊', pinyin: 'chījīng', type: 'verb', meaning: 'to be startled, to be shocked' },
    { character: '好吃', pinyin: 'hǎo chī', type: 'adj', meaning: 'delicious, tasty' },
    { character: '好吃懒做', pinyin: 'hào chī lǎn zuò', type: 'idiom', meaning: 'gluttonous and lazy' },
    { character: '零食', pinyin: 'língshí', type: 'noun', meaning: 'snack (food eaten between meals)' },
    { character: '素食', pinyin: 'sùshí', type: 'noun/adj', meaning: 'vegetarian food; vegetarian' },
    { character: '饮食', pinyin: 'yǐnshí', type: 'noun', meaning: 'diet, food and drink' },
  ]} />;
}

// ── 看 (kàn) — to see ─────────────────────────────────────────────────────────

export function ZhKanFamilyCard() {
  return <FamilyCard root="看" rootPinyin="kàn" rootMeaning="to see, to look, to watch, to read" words={[
    { character: '看', pinyin: 'kàn', type: 'verb', meaning: 'to look, to watch, to read, to see' },
    { character: '看见', pinyin: 'kànjiàn', type: 'verb', meaning: 'to see, to catch sight of (resultative)' },
    { character: '看书', pinyin: 'kàn shū', type: 'phrase', meaning: 'to read (a book)' },
    { character: '看法', pinyin: 'kànfǎ', type: 'noun', meaning: 'view, opinion, way of looking at things' },
    { character: '看出', pinyin: 'kānchū', type: 'verb', meaning: 'to make out, to detect, to notice' },
    { character: '看起来', pinyin: 'kàn qǐlái', type: 'phrase', meaning: 'it looks like, it seems, apparently' },
    { character: '看重', pinyin: 'kànzhòng', type: 'verb', meaning: 'to value, to regard as important' },
    { character: '看望', pinyin: 'kànwàng', type: 'verb', meaning: 'to visit (a person), to call on' },
    { character: '看不起', pinyin: 'kān bu qǐ', type: 'verb', meaning: 'to look down on, to despise' },
    { character: '看病', pinyin: 'kàn bìng', type: 'phrase', meaning: 'to see a doctor; (doctor) to see a patient' },
  ]} />;
}

// ── 走 (zǒu) — to walk ────────────────────────────────────────────────────────

export function ZhZouFamilyCard() {
  return <FamilyCard root="走" rootPinyin="zǒu" rootMeaning="to walk, to leave, to go" words={[
    { character: '走', pinyin: 'zǒu', type: 'verb', meaning: 'to walk, to go, to leave' },
    { character: '走路', pinyin: 'zǒu lù', type: 'phrase', meaning: 'to walk (on a road)' },
    { character: '走开', pinyin: 'zǒu kāi', type: 'verb', meaning: 'to go away, to leave, to get out of the way' },
    { character: '走向', pinyin: 'zǒuxiàng', type: 'verb/noun', meaning: 'to move toward; direction, trend' },
    { character: '走廊', pinyin: 'zǒuláng', type: 'noun', meaning: 'corridor, hallway, aisle' },
    { character: '走红', pinyin: 'zǒuhóng', type: 'verb', meaning: 'to become popular, to become a hit' },
    { character: '走失', pinyin: 'zǒushī', type: 'verb', meaning: 'to get lost, to go missing' },
    { character: '走私', pinyin: 'zǒusī', type: 'verb/noun', meaning: 'to smuggle; smuggling' },
    { character: '出走', pinyin: 'chūzǒu', type: 'verb', meaning: 'to flee, to leave secretly' },
    { character: '步行', pinyin: 'bùxíng', type: 'verb/noun', meaning: 'to go on foot; walking' },
  ]} />;
}

// ── 来 (lái) — to come ────────────────────────────────────────────────────────

export function ZhLaiFamilyCard() {
  return <FamilyCard root="来" rootPinyin="lái" rootMeaning="to come, to arrive" words={[
    { character: '来', pinyin: 'lái', type: 'verb', meaning: 'to come, to arrive' },
    { character: '来自', pinyin: 'lái zì', type: 'phrase', meaning: 'to come from, to originate from' },
    { character: '来得及', pinyin: 'lái de jí', type: 'phrase', meaning: 'to have time, to be in time' },
    { character: '来不及', pinyin: 'lái bu jí', type: 'phrase', meaning: 'not have enough time, too late' },
    { character: '来临', pinyin: 'láilín', type: 'verb', meaning: 'to arrive, to approach (formal)' },
    { character: '到来', pinyin: 'dàolái', type: 'verb/noun', meaning: 'arrival, advent, to arrive' },
    { character: '未来', pinyin: 'wèilái', type: 'noun/adj', meaning: 'future, the future' },
    { character: '原来', pinyin: 'yuánlái', type: 'adj/adv', meaning: 'original; so it turns out, originally' },
    { character: '本来', pinyin: 'běnlái', type: 'adv', meaning: 'originally, at first, naturally' },
    { character: '向来', pinyin: 'xiànglái', type: 'adv', meaning: 'always (in the past), consistently' },
  ]} />;
}

// ── 做 (zuò) — to do ──────────────────────────────────────────────────────────

export function ZhZuoFamilyCard() {
  return <FamilyCard root="做" rootPinyin="zuò" rootMeaning="to do, to make, to work as" words={[
    { character: '做', pinyin: 'zuò', type: 'verb', meaning: 'to do, to make, to act as' },
    { character: '做饭', pinyin: 'zuò fàn', type: 'phrase', meaning: 'to cook (make food)' },
    { character: '做到', pinyin: 'zuò dào', type: 'verb', meaning: 'to accomplish, to achieve, to do successfully' },
    { character: '做梦', pinyin: 'zuò mèng', type: 'phrase', meaning: 'to dream; (fig.) wishful thinking' },
    { character: '做法', pinyin: 'zuòfǎ', type: 'noun', meaning: 'method of doing, practice, approach' },
    { character: '做作', pinyin: 'zuòzuò', type: 'adj', meaning: 'affected, pretentious, unnatural' },
    { character: '作业', pinyin: 'zuòyè', type: 'noun', meaning: 'homework, assignment, schoolwork' },
    { character: '工作', pinyin: 'gōngzuò', type: 'noun/verb', meaning: 'work, job; to work' },
    { character: '制作', pinyin: 'zhìzuò', type: 'verb/noun', meaning: 'to produce, to manufacture; production' },
    { character: '合作', pinyin: 'hézuò', type: 'verb/noun', meaning: 'to cooperate, to collaborate; cooperation' },
  ]} />;
}

// ── 学 (xué) — to learn ───────────────────────────────────────────────────────

export function ZhXueFamilyCard() {
  return <FamilyCard root="学" rootPinyin="xué" rootMeaning="to learn, to study; school" words={[
    { character: '学', pinyin: 'xué', type: 'verb', meaning: 'to learn, to study' },
    { character: '学习', pinyin: 'xuéxí', type: 'verb/noun', meaning: 'to study, to learn; studies' },
    { character: '学生', pinyin: 'xuésheng', type: 'noun', meaning: 'student, pupil' },
    { character: '学校', pinyin: 'xuéxiào', type: 'noun', meaning: 'school' },
    { character: '学院', pinyin: 'xuéyuàn', type: 'noun', meaning: 'college, academy, institute' },
    { character: '学问', pinyin: 'xuéwèn', type: 'noun', meaning: 'learning, knowledge, scholarship' },
    { character: '科学', pinyin: 'kēxué', type: 'noun/adj', meaning: 'science; scientific' },
    { character: '大学', pinyin: 'dàxué', type: 'noun', meaning: 'university, college' },
    { character: '文学', pinyin: 'wénxué', type: 'noun', meaning: 'literature' },
    { character: '哲学', pinyin: 'zhéxué', type: 'noun', meaning: 'philosophy' },
  ]} />;
}

// ── 好 (hǎo) — good ───────────────────────────────────────────────────────────

export function ZhHaoFamilyCard() {
  return <FamilyCard root="好" rootPinyin="hǎo / hào" rootMeaning="good; to be fond of (hào)" words={[
    { character: '好', pinyin: 'hǎo', type: 'adj', meaning: 'good, well, fine' },
    { character: '好吃', pinyin: 'hǎochī', type: 'adj', meaning: 'delicious, tasty' },
    { character: '好看', pinyin: 'hǎokàn', type: 'adj', meaning: 'good-looking, attractive; good to read' },
    { character: '好像', pinyin: 'hǎoxiàng', type: 'adv', meaning: 'it seems like, apparently, like' },
    { character: '好久', pinyin: 'hǎojiǔ', type: 'phrase', meaning: 'a long time, for a long while' },
    { character: '美好', pinyin: 'měihǎo', type: 'adj', meaning: 'beautiful, fine, wonderful' },
    { character: '友好', pinyin: 'yǒuhǎo', type: 'adj', meaning: 'friendly, amicable' },
    { character: '好奇', pinyin: 'hàoqí', type: 'adj', meaning: 'curious, inquisitive (note: hào tone)' },
    { character: '好转', pinyin: 'hǎozhuǎn', type: 'verb', meaning: 'to improve, to take a turn for the better' },
    { character: '好意', pinyin: 'hǎoyì', type: 'noun', meaning: 'good intentions, goodwill' },
  ]} />;
}

// ── 大 (dà) — big ─────────────────────────────────────────────────────────────

export function ZhDaFamilyCard() {
  return <FamilyCard root="大" rootPinyin="dà" rootMeaning="big, large, great" words={[
    { character: '大', pinyin: 'dà', type: 'adj', meaning: 'big, large, great' },
    { character: '大家', pinyin: 'dàjiā', type: 'pronoun', meaning: 'everyone, everybody' },
    { character: '大学', pinyin: 'dàxué', type: 'noun', meaning: 'university, college' },
    { character: '大人', pinyin: 'dàrén', type: 'noun', meaning: 'adult, grown-up' },
    { character: '大约', pinyin: 'dàyuē', type: 'adv', meaning: 'approximately, about, roughly' },
    { character: '伟大', pinyin: 'wěidà', type: 'adj', meaning: 'great, mighty, magnificent' },
    { character: '广大', pinyin: 'guǎngdà', type: 'adj', meaning: 'vast, broad, extensive' },
    { character: '重大', pinyin: 'zhòngdà', type: 'adj', meaning: 'significant, major, important' },
    { character: '最大', pinyin: 'zuìdà', type: 'phrase', meaning: 'the biggest, the largest' },
    { character: '大概', pinyin: 'dàgài', type: 'adv/adj', meaning: 'probably, roughly; general, approximate' },
  ]} />;
}

// ── 人 (rén) — person ─────────────────────────────────────────────────────────

export function ZhRenFamilyCard() {
  return <FamilyCard root="人" rootPinyin="rén" rootMeaning="person, people, human" words={[
    { character: '人', pinyin: 'rén', type: 'noun', meaning: 'person, human being, people' },
    { character: '人们', pinyin: 'rénmen', type: 'noun', meaning: 'people (general plural)' },
    { character: '人口', pinyin: 'rénkǒu', type: 'noun', meaning: 'population' },
    { character: '人才', pinyin: 'réncái', type: 'noun', meaning: 'talented person, capable person' },
    { character: '人生', pinyin: 'rénshēng', type: 'noun', meaning: 'life, human life, one\'s lifetime' },
    { character: '外国人', pinyin: 'wàiguórén', type: 'noun', meaning: 'foreigner' },
    { character: '中国人', pinyin: 'Zhōngguórén', type: 'noun', meaning: 'Chinese person' },
    { character: '美国人', pinyin: 'Měiguórén', type: 'noun', meaning: 'American person' },
    { character: '主人', pinyin: 'zhǔrén', type: 'noun', meaning: 'host, owner, master' },
    { character: '机器人', pinyin: 'jīqìrén', type: 'noun', meaning: 'robot (machine-person)' },
  ]} />;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

export function resolveZhFamilyCard(title: string): JSX.Element {
  const lower = title.toLowerCase();
  if (lower.includes('说') || lower.includes('shuo') || lower.includes('speak') || lower.includes('say') || lower.includes('talk')) return <ZhShuoFamilyCard />;
  if (lower.includes('吃') || lower.includes('chi') || lower.includes('eat') || lower.includes('food')) return <ZhChiFamilyCard />;
  if (lower.includes('看') || lower.includes('kan') || lower.includes('look') || lower.includes('see') || lower.includes('watch') || lower.includes('read')) return <ZhKanFamilyCard />;
  if (lower.includes('走') || lower.includes('zou') || lower.includes('walk') || lower.includes('leave')) return <ZhZouFamilyCard />;
  if (lower.includes('来') || lower.includes('lai') || lower.includes('come') || lower.includes('arrive')) return <ZhLaiFamilyCard />;
  if (lower.includes('做') || lower.includes('zuo') || lower.includes('do') || lower.includes('make')) return <ZhZuoFamilyCard />;
  if (lower.includes('学') || lower.includes('xue') || lower.includes('learn') || lower.includes('stud')) return <ZhXueFamilyCard />;
  if (lower.includes('好') || lower.includes('hao') || lower.includes('good')) return <ZhHaoFamilyCard />;
  if (lower.includes('大') || lower.includes('da') || lower.includes('big') || lower.includes('large') || lower.includes('great')) return <ZhDaFamilyCard />;
  if (lower.includes('人') || lower.includes('ren') || lower.includes('person') || lower.includes('people') || lower.includes('human')) return <ZhRenFamilyCard />;
  return <ZhShuoFamilyCard />;
}
