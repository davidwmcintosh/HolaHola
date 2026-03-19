/**
 * TextbookJapaneseGrammarCards.tsx
 * Section 3 & 4 — Japanese grammar reference cards.
 * Mirrors the structure of TextbookItalianGrammarCards.tsx.
 * Auto-triggered via classifyJapaneseGrammarType() in ChapterIntroduction.tsx.
 *
 * Cards (22 total):
 *  Section 3 — Writing Systems & Core Grammar
 *    JaHiraganaCard, JaKatakanaCard, JaKanjiBasicsCard
 *    JaParticlesCard, JaVerbGroupsCard, JaTEFormCard
 *    JaPastTenseCard, JaNegativeFormCard, JaPoliteFormCard
 *    JaAdjectivesCard, JaNounPhrasesCard, JaQuestionWordsCard
 *    JaNumbersCard, JaCountersCard, JaTimeExpressionsCard
 *    JaDirectionMovementCard, JaGivingReceivingCard, JaPotentialFormCard
 *    JaVolitionalFormCard, JaConditionalCard, JaTeIruCard
 *    JaHonorificsCard
 */

import { Card, CardContent } from '@/components/ui/card';

// ─── Color theme ──────────────────────────────────────────────────────────────
const V = 'text-violet-700 dark:text-violet-400';
const VBg = 'bg-violet-500/10';

// ─── Shared mini-components ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </h3>
  );
}

interface JaRow { jp: string; romaji: string; en: string; note?: string }

function JaTable({ rows, headers = ['Japanese', 'Romaji', 'English'] }: { rows: JaRow[]; headers?: string[] }) {
  return (
    <div className="rounded-md border border-border overflow-hidden text-sm">
      <div className="grid bg-muted/40 border-b border-border" style={{ gridTemplateColumns: `2fr 2fr 3fr` }}>
        {headers.map(h => (
          <div key={h} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">{h}</div>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`grid ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: `2fr 2fr 3fr` }}>
          <div className={`px-3 py-1.5 font-bold ${V}`}>{r.jp}</div>
          <div className="px-3 py-1.5 italic text-muted-foreground">{r.romaji}</div>
          <div className="px-3 py-1.5">{r.en}{r.note && <span className="text-xs text-muted-foreground ml-1">({r.note})</span>}</div>
        </div>
      ))}
    </div>
  );
}

function PatternBox({ pattern, romaji, meaning, example, exRomaji, exEn }: {
  pattern: string; romaji: string; meaning: string;
  example?: string; exRomaji?: string; exEn?: string;
}) {
  return (
    <div className="rounded-md border border-border p-3 space-y-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-base font-bold ${V}`}>{pattern}</span>
        <span className="text-xs italic text-muted-foreground">{romaji}</span>
        <span className="text-xs text-foreground">— {meaning}</span>
      </div>
      {example && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{example}</span>
          {exRomaji && <span className="italic ml-1">({exRomaji})</span>}
          {exEn && <span className="ml-1">— {exEn}</span>}
        </div>
      )}
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rounded-md ${VBg} border border-violet-500/20 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

// ─── 1. Hiragana ──────────────────────────────────────────────────────────────
export function JaHiraganaCard() {
  const rows = [
    { vowel: 'a', chars: ['あ','い','う','え','お'], romaji: ['a','i','u','e','o'] },
    { vowel: 'k', chars: ['か','き','く','け','こ'], romaji: ['ka','ki','ku','ke','ko'] },
    { vowel: 's', chars: ['さ','し','す','せ','そ'], romaji: ['sa','shi','su','se','so'] },
    { vowel: 't', chars: ['た','ち','つ','て','と'], romaji: ['ta','chi','tsu','te','to'] },
    { vowel: 'n', chars: ['な','に','ぬ','ね','の'], romaji: ['na','ni','nu','ne','no'] },
    { vowel: 'h', chars: ['は','ひ','ふ','へ','ほ'], romaji: ['ha','hi','fu','he','ho'] },
    { vowel: 'm', chars: ['ま','み','む','め','も'], romaji: ['ma','mi','mu','me','mo'] },
    { vowel: 'y', chars: ['や','','ゆ','','よ'], romaji: ['ya','—','yu','—','yo'] },
    { vowel: 'r', chars: ['ら','り','る','れ','ろ'], romaji: ['ra','ri','ru','re','ro'] },
    { vowel: 'w', chars: ['わ','','','','を'], romaji: ['wa','—','—','—','wo'] },
    { vowel: 'n', chars: ['ん','','','',''], romaji: ['n','','','',''] },
  ];
  const vowels = ['a','i','u','e','o'];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>ひらがな — Hiragana Writing System</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Hiragana is the primary phonetic syllabary used for native Japanese words, grammar particles, and verb endings. Each character represents one mora (syllable).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-2 py-1 text-xs text-muted-foreground border border-border/40 w-8">Row</th>
                {vowels.map(v => (
                  <th key={v} className={`px-2 py-1 text-xs font-bold border border-border/40 ${V}`}>{v.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vowel + r.chars[0]} className="border border-border/40">
                  <td className="px-2 py-1 text-xs font-bold text-muted-foreground border border-border/40">{r.vowel.toUpperCase()}-</td>
                  {r.chars.map((ch, ci) => (
                    <td key={ci} className="px-1 py-1 border border-border/40">
                      {ch ? (
                        <>
                          <div className={`text-lg font-bold ${V}`}>{ch}</div>
                          <div className="text-[10px] text-muted-foreground">{r.romaji[ci]}</div>
                        </>
                      ) : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NoteBox>
          Hiragana has 46 base characters. Add ゛(dakuten) for voiced sounds: か→が、さ→ざ、た→だ、は→ば. Add ゜(handakuten) for は row: は→ぱ.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 2. Katakana ──────────────────────────────────────────────────────────────
export function JaKatakanaCard() {
  const rows = [
    { vowel: 'a', chars: ['ア','イ','ウ','エ','オ'], romaji: ['a','i','u','e','o'] },
    { vowel: 'k', chars: ['カ','キ','ク','ケ','コ'], romaji: ['ka','ki','ku','ke','ko'] },
    { vowel: 's', chars: ['サ','シ','ス','セ','ソ'], romaji: ['sa','shi','su','se','so'] },
    { vowel: 't', chars: ['タ','チ','ツ','テ','ト'], romaji: ['ta','chi','tsu','te','to'] },
    { vowel: 'n', chars: ['ナ','ニ','ヌ','ネ','ノ'], romaji: ['na','ni','nu','ne','no'] },
    { vowel: 'h', chars: ['ハ','ヒ','フ','ヘ','ホ'], romaji: ['ha','hi','fu','he','ho'] },
    { vowel: 'm', chars: ['マ','ミ','ム','メ','モ'], romaji: ['ma','mi','mu','me','mo'] },
    { vowel: 'y', chars: ['ヤ','','ユ','','ヨ'], romaji: ['ya','—','yu','—','yo'] },
    { vowel: 'r', chars: ['ラ','リ','ル','レ','ロ'], romaji: ['ra','ri','ru','re','ro'] },
    { vowel: 'w', chars: ['ワ','','','','ヲ'], romaji: ['wa','—','—','—','wo'] },
    { vowel: 'n', chars: ['ン','','','',''], romaji: ['n','','','',''] },
  ];
  const vowels = ['a','i','u','e','o'];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>カタカナ — Katakana Writing System</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Katakana is used primarily for foreign loanwords (外来語), foreign names, onomatopoeia, and scientific terms. The long vowel mark ー extends vowel sounds.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-2 py-1 text-xs text-muted-foreground border border-border/40 w-8">Row</th>
                {vowels.map(v => (
                  <th key={v} className={`px-2 py-1 text-xs font-bold border border-border/40 ${V}`}>{v.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vowel + r.chars[0]}>
                  <td className="px-2 py-1 text-xs font-bold text-muted-foreground border border-border/40">{r.vowel.toUpperCase()}-</td>
                  {r.chars.map((ch, ci) => (
                    <td key={ci} className="px-1 py-1 border border-border/40">
                      {ch ? (
                        <>
                          <div className={`text-lg font-bold ${V}`}>{ch}</div>
                          <div className="text-[10px] text-muted-foreground">{r.romaji[ci]}</div>
                        </>
                      ) : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NoteBox>
          Examples: コーヒー (kōhī = coffee), テレビ (terebi = TV), アイスクリーム (aisukurīmu = ice cream), スマートフォン (sumātofon = smartphone).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 3. Kanji Basics ──────────────────────────────────────────────────────────
export function JaKanjiBasicsCard() {
  const basicKanji = [
    { kanji: '日', on: 'ニチ・ジツ', kun: 'ひ・か', en: 'sun / day', ex: '日本 (nihon = Japan), 毎日 (mainichi = every day)' },
    { kanji: '月', on: 'ゲツ・ガツ', kun: 'つき', en: 'moon / month', ex: '月曜日 (getsuyōbi = Monday), 来月 (raigetsu = next month)' },
    { kanji: '山', on: 'サン', kun: 'やま', en: 'mountain', ex: '富士山 (Fujisan), 山田 (Yamada, surname)' },
    { kanji: '川', on: 'セン', kun: 'かわ', en: 'river', ex: '川口 (Kawaguchi), 小川 (ogawa = stream)' },
    { kanji: '人', on: 'ジン・ニン', kun: 'ひと', en: 'person', ex: '日本人 (nihonjin = Japanese person)' },
    { kanji: '水', on: 'スイ', kun: 'みず', en: 'water', ex: '水曜日 (suiyōbi = Wednesday), 水泳 (suiei = swimming)' },
    { kanji: '火', on: 'カ', kun: 'ひ', en: 'fire', ex: '火曜日 (kayōbi = Tuesday), 花火 (hanabi = fireworks)' },
    { kanji: '木', on: 'モク・ボク', kun: 'き', en: 'tree / wood', ex: '木曜日 (mokuyōbi = Thursday), 木村 (Kimura, surname)' },
  ];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>漢字 — Kanji Basics</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Kanji are logographic characters borrowed from Chinese. Each kanji has <strong>on-yomi</strong> (Chinese-derived reading, shown in katakana) and <strong>kun-yomi</strong> (native Japanese reading, shown in hiragana).</p>
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground" style={{ gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 3fr' }}>
            <div className="px-3 py-1.5">Kanji</div>
            <div className="px-3 py-1.5">On-yomi</div>
            <div className="px-3 py-1.5">Kun-yomi</div>
            <div className="px-3 py-1.5">Meaning</div>
            <div className="px-3 py-1.5">Examples</div>
          </div>
          {basicKanji.map((k, i) => (
            <div key={k.kanji} className={`grid items-center ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 3fr' }}>
              <div className={`px-3 py-2 text-xl font-bold ${V}`}>{k.kanji}</div>
              <div className="px-3 py-2 text-xs font-medium">{k.on}</div>
              <div className="px-3 py-2 text-xs">{k.kun}</div>
              <div className="px-3 py-2 text-xs text-muted-foreground">{k.en}</div>
              <div className="px-3 py-2 text-xs text-muted-foreground">{k.ex}</div>
            </div>
          ))}
        </div>
        <NoteBox>
          Japan has 2,136 jōyō kanji (常用漢字) for everyday use. Elementary school students learn 1,026 kyōiku kanji (教育漢字) across 6 years.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 4. Particles ─────────────────────────────────────────────────────────────
export function JaParticlesCard() {
  const particles = [
    { p: 'は', rom: 'wa', role: 'Topic marker', ex: '私は学生です', exRom: 'Watashi wa gakusei desu', exEn: 'I am a student' },
    { p: 'が', rom: 'ga', role: 'Subject marker', ex: '猫が好きです', exRom: 'Neko ga suki desu', exEn: 'I like cats' },
    { p: 'を', rom: 'wo/o', role: 'Object marker', ex: 'ご飯を食べます', exRom: 'Gohan wo tabemasu', exEn: 'I eat rice' },
    { p: 'に', rom: 'ni', role: 'Direction / time / indirect obj', ex: '東京に行きます', exRom: 'Tōkyō ni ikimasu', exEn: 'I go to Tokyo' },
    { p: 'で', rom: 'de', role: 'Location of action / means', ex: '図書館で勉強します', exRom: 'Toshokan de benkyō shimasu', exEn: 'I study at the library' },
    { p: 'の', rom: 'no', role: 'Possessive / noun modifier', ex: '私の本', exRom: 'Watashi no hon', exEn: 'my book' },
    { p: 'と', rom: 'to', role: 'And / with (person)', ex: '友達と行きます', exRom: 'Tomodachi to ikimasu', exEn: 'I go with my friend' },
    { p: 'も', rom: 'mo', role: 'Also / too', ex: '私も学生です', exRom: 'Watashi mo gakusei desu', exEn: 'I am also a student' },
    { p: 'か', rom: 'ka', role: 'Question marker', ex: 'これは何ですか', exRom: 'Kore wa nan desu ka', exEn: 'What is this?' },
    { p: 'から', rom: 'kara', role: 'From (place/time/reason)', ex: '大阪から来ました', exRom: 'Ōsaka kara kimashita', exEn: 'I came from Osaka' },
    { p: 'まで', rom: 'made', role: 'Until / up to', ex: '6時まで働きます', exRom: 'Roku-ji made hatarakimasu', exEn: 'I work until 6' },
    { p: 'へ', rom: 'e', role: 'Direction (formal)', ex: '学校へ行く', exRom: 'Gakkō e iku', exEn: 'go to school' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>助詞 — Particles</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Particles are grammatical markers attached to nouns and phrases to indicate their role in the sentence. They are the backbone of Japanese sentence structure.</p>
        <div className="space-y-2">
          {particles.map(({ p, rom, role, ex, exRom, exEn }) => (
            <div key={p} className="rounded-md border border-border p-2.5">
              <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                <span className={`text-xl font-bold ${V}`}>{p}</span>
                <span className="text-xs italic text-muted-foreground">({rom})</span>
                <span className="text-xs font-semibold text-foreground">— {role}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className={`font-medium ${V} mr-1`}>{ex}</span>
                <span className="italic">({exRom})</span>
                <span className="ml-1">— {exEn}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 5. Verb Groups ──────────────────────────────────────────────────────────
export function JaVerbGroupsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>動詞のグループ — Verb Groups</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Japanese verbs belong to three groups that determine conjugation patterns. All verbs end in a syllable from the う (u) column in dictionary form.</p>
        <div className="space-y-4">
          <div className="rounded-md border border-border overflow-hidden">
            <div className={`px-3 py-2 border-b ${VBg} flex items-center gap-2`}>
              <span className={`font-bold text-sm ${V}`}>Group 1 — Godan Verbs (五段動詞)</span>
              <span className="text-xs text-muted-foreground">Also called u-verbs or Class 1</span>
            </div>
            <p className="px-3 py-2 text-xs text-muted-foreground">End in any う-row syllable EXCEPT る (or る verbs where the preceding syllable is NOT /i/ or /e/).</p>
            <JaTable rows={[
              { jp: '書く', romaji: 'kaku', en: 'to write', note: 'ku-verb' },
              { jp: '飲む', romaji: 'nomu', en: 'to drink', note: 'mu-verb' },
              { jp: '話す', romaji: 'hanasu', en: 'to speak', note: 'su-verb' },
              { jp: '会う', romaji: 'au', en: 'to meet', note: 'u-verb' },
              { jp: '待つ', romaji: 'matsu', en: 'to wait', note: 'tsu-verb' },
              { jp: '帰る', romaji: 'kaeru', en: 'to return home', note: 'exception: godan despite -ru' },
            ]} />
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <div className={`px-3 py-2 border-b ${VBg} flex items-center gap-2`}>
              <span className={`font-bold text-sm ${V}`}>Group 2 — Ichidan Verbs (一段動詞)</span>
              <span className="text-xs text-muted-foreground">Also called ru-verbs or Class 2</span>
            </div>
            <p className="px-3 py-2 text-xs text-muted-foreground">End in る, preceded by an /i/ or /e/ vowel sound. Drop る to conjugate (stem stays constant).</p>
            <JaTable rows={[
              { jp: '食べる', romaji: 'taberu', en: 'to eat', note: 'e + ru' },
              { jp: '起きる', romaji: 'okiru', en: 'to wake up', note: 'i + ru' },
              { jp: '見る', romaji: 'miru', en: 'to see/watch', note: 'i + ru' },
              { jp: '教える', romaji: 'oshieru', en: 'to teach', note: 'e + ru' },
            ]} />
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <div className={`px-3 py-2 border-b ${VBg}`}>
              <span className={`font-bold text-sm ${V}`}>Group 3 — Irregular Verbs (不規則動詞)</span>
            </div>
            <JaTable rows={[
              { jp: 'する', romaji: 'suru', en: 'to do', note: 'most common irregular' },
              { jp: 'くる', romaji: 'kuru', en: 'to come', note: 'highly irregular' },
              { jp: 'N + する', romaji: 'N + suru', en: 'to do [N]', note: '勉強する, 運動する...' },
            ]} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 6. て-form ──────────────────────────────────────────────────────────────
export function JaTEFormCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>て形 — Te-form</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">The て-form (te-form) is an essential connecting form used for sequential actions, requests, permissions, and many grammatical patterns.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Group 1 — Godan て-form rules</SectionLabel>
            <JaTable headers={['Ending', '→ Te-form', 'Example']} rows={[
              { jp: '〜う・つ・る', romaji: '→ って', en: '会う→会って, 待つ→待って' },
              { jp: '〜む・ぬ・ぶ', romaji: '→ んで', en: '飲む→飲んで, 遊ぶ→遊んで' },
              { jp: '〜く', romaji: '→ いて', en: '書く→書いて' },
              { jp: '〜ぐ', romaji: '→ いで', en: '泳ぐ→泳いで' },
              { jp: '〜す', romaji: '→ して', en: '話す→話して' },
              { jp: '行く (exception)', romaji: '→ 行って', en: '(not 行いて)' },
            ]} />
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>Group 2 — Ichidan て-form</SectionLabel>
              <NoteBox>Drop る, add て: 食べる → 食べて, 起きる → 起きて, 見る → 見て</NoteBox>
            </div>
            <div>
              <SectionLabel>Group 3 — Irregular て-form</SectionLabel>
              <NoteBox>する → して | くる → きて</NoteBox>
            </div>
            <div>
              <SectionLabel>Common て-form patterns</SectionLabel>
              <div className="space-y-1.5">
                {[
                  { pattern: '〜てください', en: 'Please do ~' },
                  { pattern: '〜てもいいですか', en: 'May I ~?' },
                  { pattern: '〜てはいけません', en: 'You must not ~' },
                  { pattern: '〜てから', en: 'After doing ~' },
                  { pattern: '〜ています', en: 'Is doing ~ / State of ~' },
                ].map(({ pattern, en }) => (
                  <div key={pattern} className="flex gap-2 text-sm">
                    <span className={`font-bold ${V} shrink-0`}>{pattern}</span>
                    <span className="text-muted-foreground">— {en}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 7. Past Tense ───────────────────────────────────────────────────────────
export function JaPastTenseCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>過去形 — Past Tense (た形)</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">The た-form (ta-form / plain past) is formed with the same rules as て-form but with た/だ instead of て/で. It expresses completed actions.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Formation rules (same as て-form)</SectionLabel>
            <JaTable headers={['Te-form', '→ Ta-form']} rows={[
              { jp: '〜って', romaji: '→ 〜った', en: '会って → 会った (met)' },
              { jp: '〜んで', romaji: '→ 〜んだ', en: '飲んで → 飲んだ (drank)' },
              { jp: '〜いて', romaji: '→ 〜いた', en: '書いて → 書いた (wrote)' },
              { jp: '〜いで', romaji: '→ 〜いだ', en: '泳いで → 泳いだ (swam)' },
              { jp: '〜して', romaji: '→ 〜した', en: '話して → 話した (spoke)' },
              { jp: 'Group 2: 〜て', romaji: '→ 〜た', en: '食べて → 食べた (ate)' },
            ]} />
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>Polite past (〜ました)</SectionLabel>
              <JaTable headers={['Polite present', '→ Polite past']} rows={[
                { jp: '食べます', romaji: '→ 食べました', en: 'ate (polite)' },
                { jp: '飲みます', romaji: '→ 飲みました', en: 'drank (polite)' },
                { jp: 'です', romaji: '→ でした', en: 'was (polite)' },
                { jp: 'します', romaji: '→ しました', en: 'did (polite)' },
              ]} />
            </div>
            <div>
              <SectionLabel>Past negative forms</SectionLabel>
              <div className="space-y-1">
                {[
                  { jp: '食べませんでした', rom: 'tabemasendeshita', en: 'did not eat (polite)' },
                  { jp: '食べなかった', rom: 'tabenakatta', en: 'did not eat (plain)' },
                  { jp: 'じゃなかった', rom: 'ja nakatta', en: 'was not (plain)' },
                  { jp: 'ではありませんでした', rom: 'dewa arimasendeshita', en: 'was not (formal)' },
                ].map(({ jp, rom, en }) => (
                  <div key={jp} className="text-xs flex gap-1 flex-wrap">
                    <span className={`font-bold ${V}`}>{jp}</span>
                    <span className="italic text-muted-foreground">({rom})</span>
                    <span className="text-muted-foreground">— {en}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 8. Negative Form ────────────────────────────────────────────────────────
export function JaNegativeFormCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>否定形 — Negative Forms</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Verb negation patterns</SectionLabel>
            <JaTable rows={[
              { jp: '食べない', romaji: 'tabenai', en: 'do not eat (plain)', note: 'Group 2' },
              { jp: '食べません', romaji: 'tabemasen', en: 'do not eat (polite)', note: 'Group 2' },
              { jp: '書かない', romaji: 'kakanai', en: 'do not write (plain)', note: 'Group 1' },
              { jp: '書きません', romaji: 'kakimasen', en: 'do not write (polite)', note: 'Group 1' },
              { jp: 'しない', romaji: 'shinai', en: 'do not do (plain)', note: 'Irregular' },
              { jp: 'しません', romaji: 'shimasen', en: 'do not do (polite)', note: 'Irregular' },
              { jp: '来ない', romaji: 'konai', en: 'do not come (plain)', note: 'Irregular' },
            ]} />
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>Noun/adjective negation</SectionLabel>
              <div className="space-y-1.5">
                {[
                  { jp: 'N じゃない', rom: 'N ja nai', en: 'not N (casual)' },
                  { jp: 'N ではない', rom: 'N dewa nai', en: 'not N (formal)' },
                  { jp: 'N じゃありません', rom: 'N ja arimasen', en: 'not N (polite)' },
                  { jp: 'い-adj → くない', rom: '→ kunai', en: '高い → 高くない (not tall)' },
                  { jp: 'な-adj → じゃない', rom: '→ ja nai', en: '静か → 静かじゃない' },
                ].map(({ jp, rom, en }) => (
                  <PatternBox key={jp} pattern={jp} romaji={rom} meaning={en} />
                ))}
              </div>
            </div>
            <NoteBox>
              Group 1 negative stem: change the final う-vowel to あ-row, then add ない. Exception: う → わない (not あない). E.g., 買う → 買わない.
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 9. Polite Form ──────────────────────────────────────────────────────────
export function JaPoliteFormCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>丁寧語 — Polite Form (です・ます)</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Japanese has distinct speech levels. The です/ます (desu/masu) register is used in most everyday social situations and is the first level beginners learn.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>ます-form conjugation</SectionLabel>
            <JaTable headers={['Form', 'Japanese', 'Example']} rows={[
              { jp: 'Non-past (+)', romaji: '〜ます', en: '食べます — eat/will eat' },
              { jp: 'Non-past (−)', romaji: '〜ません', en: '食べません — do not eat' },
              { jp: 'Past (+)', romaji: '〜ました', en: '食べました — ate' },
              { jp: 'Past (−)', romaji: '〜ませんでした', en: '食べませんでした — did not eat' },
              { jp: 'Request', romaji: '〜ませんか', en: '食べませんか — shall we eat?' },
              { jp: 'Volitional', romaji: '〜ましょう', en: '食べましょう — let\'s eat' },
            ]} />
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>です with nouns & adjectives</SectionLabel>
              <JaTable headers={['Type', 'Polite (+)', 'Polite (−)']} rows={[
                { jp: 'Noun', romaji: 'Nです', en: 'N じゃありません' },
                { jp: 'い-adj', romaji: '〜いです', en: '〜くないです' },
                { jp: 'な-adj', romaji: 'NAです', en: 'NA じゃないです' },
              ]} />
            </div>
            <div>
              <SectionLabel>Conversion: plain → polite</SectionLabel>
              <div className="text-xs space-y-1">
                <div>Group 2: drop る, add ます → 食べる → 食べます</div>
                <div>Group 1: change to い-row, add ます → 書く → 書きます</div>
                <div>Group 3: する → します, くる → きます</div>
              </div>
            </div>
            <NoteBox>
              In formal writing or very formal speech, use ございます (gozaimasu) instead of あります, and でございます instead of です.
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 10. Adjectives ──────────────────────────────────────────────────────────
export function JaAdjectivesCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>形容詞 — Adjectives (い vs な)</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>い-adjectives (イ形容詞)</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">End in い. Conjugate by changing the い ending.</p>
            <JaTable headers={['Form', 'Pattern', 'Example']} rows={[
              { jp: 'Plain (+)', romaji: '〜い', en: '高い (takai = tall/expensive)' },
              { jp: 'Plain (−)', romaji: '〜くない', en: '高くない (not tall)' },
              { jp: 'Past (+)', romaji: '〜かった', en: '高かった (was tall)' },
              { jp: 'Past (−)', romaji: '〜くなかった', en: '高くなかった' },
              { jp: 'Adverb', romaji: '〜く', en: '高く (highly)' },
              { jp: 'Modify noun', romaji: '〜い + N', en: '高い山 (tall mountain)' },
            ]} />
            <NoteBox>Exception: いい (good) → よい/よくない/よかった</NoteBox>
          </div>
          <div>
            <SectionLabel>な-adjectives (ナ形容詞)</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Do NOT end in い (or look like い but are な type). Add な before nouns; use です/じゃない for predicates.</p>
            <JaTable headers={['Form', 'Pattern', 'Example']} rows={[
              { jp: 'Plain (+)', romaji: 'NA (+ だ)', en: '静かだ (shizuka da = quiet)' },
              { jp: 'Plain (−)', romaji: 'NA + じゃない', en: '静かじゃない' },
              { jp: 'Past (+)', romaji: 'NA + だった', en: '静かだった' },
              { jp: 'Past (−)', romaji: 'NA + じゃなかった', en: '静かじゃなかった' },
              { jp: 'Modify noun', romaji: 'NA + な + N', en: '静かな部屋 (quiet room)' },
              { jp: 'Adverb', romaji: 'NA + に', en: '静かに (quietly)' },
            ]} />
            <div className="mt-2 text-xs text-muted-foreground">
              Common な-adj: 好き (suki=like), 嫌い (kirai=dislike), 上手 (jōzu=skilled), 下手 (heta=poor at), きれい (kirei=pretty), 有名 (yūmei=famous)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 11. Noun Phrases ────────────────────────────────────────────────────────
export function JaNounPhrasesCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>名詞句 — Noun Phrases & の Particle</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>の as noun modifier</SectionLabel>
            <div className="space-y-1.5">
              {[
                { pattern: 'N₁のN₂', rom: 'N₁ no N₂', mean: 'N₂ of/belonging to N₁', ex: '私の本 (watashi no hon) — my book' },
                { pattern: '日本の食べ物', rom: 'nihon no tabemono', mean: 'Japanese food', ex: 'origin modifier' },
                { pattern: '木の机', rom: 'ki no tsukue', mean: 'wooden desk', ex: 'material modifier' },
                { pattern: '昨日の新聞', rom: 'kinō no shinbun', mean: "yesterday's newspaper", ex: 'time modifier' },
              ].map(({ pattern, rom, mean, ex }) => (
                <PatternBox key={pattern} pattern={pattern} romaji={rom} meaning={mean} example={ex} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>の as nominalizer</SectionLabel>
              <p className="text-xs text-muted-foreground mb-2">の can turn a verb phrase into a noun phrase (like English "-ing" or "the fact that").</p>
              <div className="space-y-1.5">
                {[
                  { jp: '音楽を聴くのが好きです', rom: 'Ongaku wo kiku no ga suki desu', en: 'I like listening to music' },
                  { jp: '泳ぐのは楽しい', rom: 'Oyogu no wa tanoshii', en: 'Swimming is fun' },
                  { jp: '彼が来るのを待っています', rom: 'Kare ga kuru no wo matte imasu', en: 'I am waiting for him to come' },
                ].map(({ jp, rom, en }) => (
                  <div key={jp} className="text-xs border border-border/60 rounded-md p-2">
                    <div className={`font-bold ${V}`}>{jp}</div>
                    <div className="italic text-muted-foreground">{rom}</div>
                    <div>{en}</div>
                  </div>
                ))}
              </div>
            </div>
            <NoteBox>
              こと (koto) is a more formal/written alternative to の as nominalizer: 日本語を話すことができます (I can speak Japanese).
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 12. Question Words ──────────────────────────────────────────────────────
export function JaQuestionWordsCard() {
  const qWords = [
    { jp: '何（なに/なん）', rom: 'nani / nan', en: 'what', ex: '何ですか？ (nan desu ka?) — What is it?' },
    { jp: 'どこ', rom: 'doko', en: 'where', ex: 'どこに行きますか？ — Where are you going?' },
    { jp: 'だれ / どなた', rom: 'dare / donata', en: 'who / who (polite)', ex: 'だれですか？ — Who is it?' },
    { jp: 'いつ', rom: 'itsu', en: 'when', ex: 'いつ来ますか？ — When are you coming?' },
    { jp: 'どう / いかが', rom: 'dō / ikaga', en: 'how / how (polite)', ex: 'どうですか？ — How is it?' },
    { jp: 'なぜ / どうして', rom: 'naze / dōshite', en: 'why', ex: 'なぜですか？ — Why?' },
    { jp: 'どれ', rom: 'dore', en: 'which (of 3+)', ex: 'どれがあなたのですか？ — Which one is yours?' },
    { jp: 'どの + N', rom: 'dono + N', en: 'which [N]', ex: 'どの本ですか？ — Which book?' },
    { jp: 'どんな + N', rom: 'donna + N', en: 'what kind of [N]', ex: 'どんな音楽？ — What kind of music?' },
    { jp: 'いくら', rom: 'ikura', en: 'how much (price)', ex: 'いくらですか？ — How much is it?' },
    { jp: 'いくつ', rom: 'ikutsu', en: 'how many / how old', ex: 'いくつですか？ — How old are you?' },
    { jp: 'どのくらい', rom: 'dono kurai', en: 'how long / how much', ex: 'どのくらいかかりますか？ — How long does it take?' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>疑問詞 — Question Words</SectionLabel>
        <NoteBox>In Japanese, the question word can appear anywhere in the sentence (not just the beginning). End the sentence with か (ka) to form a question in polite speech.</NoteBox>
        <div className="mt-3 space-y-1.5">
          {qWords.map(({ jp, rom, en, ex }) => (
            <div key={jp} className="rounded-md border border-border/60 p-2 text-xs">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`font-bold text-sm ${V}`}>{jp}</span>
                <span className="italic text-muted-foreground">({rom})</span>
                <span className="font-medium">— {en}</span>
              </div>
              <div className="text-muted-foreground mt-0.5">{ex}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 13. Numbers ─────────────────────────────────────────────────────────────
export function JaNumbersCard() {
  const nums = [
    ['1', '一', 'いち (ichi)'], ['2', '二', 'に (ni)'], ['3', '三', 'さん (san)'],
    ['4', '四', 'し/よん (shi/yon)'], ['5', '五', 'ご (go)'], ['6', '六', 'ろく (roku)'],
    ['7', '七', 'しち/なな (shichi/nana)'], ['8', '八', 'はち (hachi)'], ['9', '九', 'く/きゅう (ku/kyū)'],
    ['10', '十', 'じゅう (jū)'], ['100', '百', 'ひゃく (hyaku)'], ['1,000', '千', 'せん (sen)'],
    ['10,000', '万', 'まん (man)'], ['100,000,000', '億', 'おく (oku)'], ['0', '零/ゼロ', 'れい/ぜろ (rei/zero)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>数字 — Numbers</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {nums.map(([n, k, r]) => (
            <div key={n} className="rounded-md border border-border/60 p-2 text-center">
              <div className="text-sm font-mono text-muted-foreground">{n}</div>
              <div className={`text-xl font-bold ${V}`}>{k}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{r}</div>
            </div>
          ))}
        </div>
        <SectionLabel>Building larger numbers</SectionLabel>
        <JaTable rows={[
          { jp: '二十 (20)', romaji: 'nijū', en: 'two-ten (2×10)' },
          { jp: '三百 (300)', romaji: 'sanbyaku', en: 'three-hundred' },
          { jp: '四千 (4,000)', romaji: 'yonsen', en: 'four-thousand' },
          { jp: '五万 (50,000)', romaji: 'goman', en: 'five-ten-thousand' },
          { jp: '百二十三 (123)', romaji: 'hyaku nijūsan', en: 'hundred two-ten three' },
        ]} />
        <NoteBox>
          Japanese groups numbers by 万 (10,000) not 1,000. So 1,000,000 = 百万 (hyaku-man = hundred-ten-thousands). 4 and 7 have alternate readings: し/よん and しち/なな.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 14. Counters ────────────────────────────────────────────────────────────
export function JaCountersCard() {
  const counters = [
    { c: '〜本 (hon)', obj: 'long, thin objects', ex: '鉛筆三本 (san-bon enpitsu) — 3 pencils' },
    { c: '〜枚 (mai)', obj: 'flat, thin objects', ex: '紙二枚 (ni-mai kami) — 2 sheets of paper' },
    { c: '〜冊 (satsu)', obj: 'bound volumes (books)', ex: '本五冊 (go-satsu hon) — 5 books' },
    { c: '〜台 (dai)', obj: 'machines, vehicles', ex: '車一台 (ichi-dai kuruma) — 1 car' },
    { c: '〜匹 (hiki)', obj: 'small animals', ex: '猫三匹 (san-biki neko) — 3 cats' },
    { c: '〜頭 (tō)', obj: 'large animals', ex: '馬二頭 (ni-tō uma) — 2 horses' },
    { c: '〜羽 (wa)', obj: 'birds, rabbits', ex: '鳥四羽 (yon-wa tori) — 4 birds' },
    { c: '〜個 (ko)', obj: 'small round objects', ex: 'りんご二個 (ni-ko ringo) — 2 apples' },
    { c: '〜杯 (hai)', obj: 'cups, bowls', ex: 'お茶一杯 (ippai ocha) — 1 cup of tea' },
    { c: '〜人 (nin/ri)', obj: 'people', ex: '三人 (san-nin) — 3 people; 一人 (hitori), 二人 (futari)' },
    { c: '〜階 (kai)', obj: 'floors of a building', ex: '三階 (san-kai) — 3rd floor' },
    { c: '〜回 (kai)', obj: 'number of times', ex: '二回 (ni-kai) — twice' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>助数詞 — Counters</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Japanese uses specific counter words depending on what is being counted. The counter follows the number and the pronunciation often changes (rendaku/euphony).</p>
        <div className="rounded-md border border-border overflow-hidden">
          {counters.map(({ c, obj, ex }, i) => (
            <div key={c} className={`grid items-start text-xs ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '1.8fr 1.8fr 3fr' }}>
              <div className={`px-3 py-2 font-bold ${V}`}>{c}</div>
              <div className="px-3 py-2 text-muted-foreground">{obj}</div>
              <div className="px-3 py-2 text-muted-foreground">{ex}</div>
            </div>
          ))}
        </div>
        <NoteBox>
          The general counter つ (tsu) works for 1–9: 一つ (hitotsu), 二つ (futatsu), 三つ (mittsu), 四つ (yottsu), 五つ (itsutsu), 六つ (muttsu), 七つ (nanatsu), 八つ (yattsu), 九つ (kokonotsu), 十 (tō).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 15. Time Expressions ────────────────────────────────────────────────────
export function JaTimeExpressionsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>時間表現 — Time Expressions</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Days relative to today</SectionLabel>
            <JaTable rows={[
              { jp: 'おととい', romaji: 'ototoi', en: 'day before yesterday' },
              { jp: '昨日（きのう）', romaji: 'kinō', en: 'yesterday' },
              { jp: '今日（きょう）', romaji: 'kyō', en: 'today' },
              { jp: '明日（あした）', romaji: 'ashita', en: 'tomorrow' },
              { jp: 'あさって', romaji: 'asatte', en: 'day after tomorrow' },
            ]} />
            <div className="mt-3">
              <SectionLabel>Weeks & months</SectionLabel>
              <JaTable rows={[
                { jp: '先週', romaji: 'senshū', en: 'last week' },
                { jp: '今週', romaji: 'konshū', en: 'this week' },
                { jp: '来週', romaji: 'raishū', en: 'next week' },
                { jp: '先月', romaji: 'sengetsu', en: 'last month' },
                { jp: '今月', romaji: 'kongetsu', en: 'this month' },
                { jp: '来月', romaji: 'raigetsu', en: 'next month' },
                { jp: '去年', romaji: 'kyonen', en: 'last year' },
                { jp: '今年', romaji: 'kotoshi', en: 'this year' },
                { jp: '来年', romaji: 'rainen', en: 'next year' },
              ]} />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>Clock time</SectionLabel>
              <JaTable rows={[
                { jp: '〜時 (ji)', romaji: '～-ji', en: 'o\'clock' },
                { jp: '〜分 (fun/pun)', romaji: '～-fun/pun', en: 'minutes' },
                { jp: '午前 (gozen)', romaji: 'gozen', en: 'AM' },
                { jp: '午後 (gogo)', romaji: 'gogo', en: 'PM' },
                { jp: '何時ですか？', romaji: 'Nanji desu ka?', en: 'What time is it?' },
                { jp: '三時半', romaji: 'san-ji han', en: '3:30 (half past three)' },
              ]} />
            </div>
            <div>
              <SectionLabel>Frequency expressions</SectionLabel>
              <JaTable rows={[
                { jp: 'いつも', romaji: 'itsumo', en: 'always' },
                { jp: 'よく', romaji: 'yoku', en: 'often' },
                { jp: 'ときどき', romaji: 'tokidoki', en: 'sometimes' },
                { jp: 'たまに', romaji: 'tama ni', en: 'occasionally' },
                { jp: 'あまり〜ない', romaji: 'amari ~ nai', en: 'not very often' },
                { jp: 'ぜんぜん〜ない', romaji: 'zenzen ~ nai', en: 'never / not at all' },
              ]} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 16. Direction & Movement ────────────────────────────────────────────────
export function JaDirectionMovementCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>方向・移動 — Direction & Movement</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Core movement verbs</SectionLabel>
            <JaTable rows={[
              { jp: '行く', romaji: 'iku', en: 'to go' },
              { jp: '来る', romaji: 'kuru', en: 'to come' },
              { jp: '帰る', romaji: 'kaeru', en: 'to return/go home' },
              { jp: '出かける', romaji: 'dekakeru', en: 'to go out' },
              { jp: '乗る', romaji: 'noru', en: 'to ride / board' },
              { jp: '降りる', romaji: 'oriru', en: 'to get off' },
              { jp: '渡る', romaji: 'wataru', en: 'to cross (a road/bridge)' },
              { jp: '曲がる', romaji: 'magaru', en: 'to turn' },
            ]} />
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>Direction patterns with に / へ</SectionLabel>
              <div className="space-y-1.5">
                {[
                  { pattern: 'Place に/へ 行く', rom: 'Place ni/e iku', mean: 'go to [place]', ex: '学校に行く' },
                  { pattern: 'Place に/へ 来る', rom: 'Place ni/e kuru', mean: 'come to [place]', ex: '家に来る' },
                  { pattern: 'Place から 来る', rom: 'Place kara kuru', mean: 'come from [place]', ex: '日本から来ました' },
                  { pattern: '右/左に 曲がる', rom: 'migi/hidari ni magaru', mean: 'turn right/left', ex: '次の角を右に曲がる' },
                  { pattern: 'まっすぐ 行く', rom: 'massugu iku', mean: 'go straight', ex: 'まっすぐ行ってください' },
                ].map(({ pattern, rom, mean, ex }) => (
                  <PatternBox key={pattern} pattern={pattern} romaji={rom} meaning={mean} example={ex} />
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>Transportation に乗る</SectionLabel>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  { jp: '電車', rom: 'densha', en: 'train' },
                  { jp: 'バス', rom: 'basu', en: 'bus' },
                  { jp: 'タクシー', rom: 'takushī', en: 'taxi' },
                  { jp: '飛行機', rom: 'hikōki', en: 'airplane' },
                  { jp: '自転車', rom: 'jitensha', en: 'bicycle' },
                  { jp: '地下鉄', rom: 'chikatetsu', en: 'subway' },
                ].map(({ jp, rom, en }) => (
                  <div key={jp} className="border border-border/60 rounded-md p-1.5 text-center">
                    <div className={`font-bold ${V}`}>{jp}</div>
                    <div className="text-muted-foreground">{rom} — {en}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 17. Giving & Receiving ──────────────────────────────────────────────────
export function JaGivingReceivingCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>やり・もらい表現 — Giving & Receiving</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Japanese has distinct verbs for giving/receiving depending on the social relationship and direction. This is one of the most culturally unique aspects of Japanese grammar.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Physical giving/receiving</SectionLabel>
            <div className="space-y-2">
              {[
                { jp: 'あげる', rom: 'ageru', en: 'to give (speaker → others, equal → equal)', social: 'neutral' },
                { jp: 'くれる', rom: 'kureru', en: 'to give (others → speaker/in-group)', social: 'toward me' },
                { jp: 'もらう', rom: 'morau', en: 'to receive (speaker receives)', social: 'receive' },
                { jp: 'さしあげる', rom: 'sashiageru', en: 'to give (humble — speaker → superior)', social: 'humble' },
                { jp: 'くださる', rom: 'kudasaru', en: 'to give (honorific — superior → speaker)', social: 'honorific' },
                { jp: 'いただく', rom: 'itadaku', en: 'to receive (humble — from superior)', social: 'humble' },
              ].map(({ jp, rom, en, social }) => (
                <div key={jp} className="rounded-md border border-border/60 p-2 text-xs">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`font-bold text-sm ${V}`}>{jp}</span>
                    <span className="italic text-muted-foreground">({rom})</span>
                    <span className="font-medium text-[10px] uppercase tracking-wider text-violet-500/70">[{social}]</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{en}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>〜てあげる / 〜てくれる / 〜てもらう</SectionLabel>
              <p className="text-xs text-muted-foreground mb-2">These combine with the て-form to express doing something for someone.</p>
              <div className="space-y-1.5">
                {[
                  { pattern: 'V-て + あげる', rom: 'do [V] for someone (outward)', ex: '教えてあげる — I\'ll teach (for you)' },
                  { pattern: 'V-て + くれる', rom: 'do [V] for me (inward)', ex: '教えてくれる — (He) teaches me' },
                  { pattern: 'V-て + もらう', rom: 'have someone do [V] for me', ex: '教えてもらう — I have (him) teach me' },
                  { pattern: 'V-て + ください', rom: 'please do [V] (request)', ex: '教えてください — Please teach me' },
                ].map(({ pattern, rom, ex }) => (
                  <PatternBox key={pattern} pattern={pattern} romaji={rom} meaning={ex} />
                ))}
              </div>
            </div>
            <NoteBox>
              The choice between あげる, くれる, and もらう depends on the perspective (who is the giver, receiver, and whether the speaker is involved). This is culturally important and marks in-group (内) vs out-group (外) relationships.
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 18. Potential Form ──────────────────────────────────────────────────────
export function JaPotentialFormCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>可能形 — Potential Form (can do ~)</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Formation rules</SectionLabel>
            <JaTable rows={[
              { jp: 'Group 1: 〜う→〜える', romaji: 'u-row → e-row + る', en: '書く → 書ける (can write)' },
              { jp: '飲む → 飲める', romaji: 'nomu → nomeru', en: 'can drink' },
              { jp: '話す → 話せる', romaji: 'hanasu → hanaseru', en: 'can speak' },
              { jp: '会う → 会える', romaji: 'au → aeru', en: 'can meet' },
              { jp: 'Group 2: 〜る → 〜られる', romaji: 'drop る, add られる', en: '食べる → 食べられる (can eat)' },
              { jp: '見る → 見られる', romaji: 'miru → mirareru', en: 'can see/watch' },
              { jp: 'Group 3: する → できる', romaji: 'suru → dekiru', en: 'can do' },
              { jp: 'くる → こられる', romaji: 'kuru → korareru', en: 'can come' },
            ]} />
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>できる — the key potential verb</SectionLabel>
              <div className="space-y-1.5">
                {[
                  { jp: '日本語ができます', rom: 'Nihongo ga dekimasu', en: 'I can speak Japanese' },
                  { jp: '料理ができますか？', rom: 'Ryōri ga dekimasu ka?', en: 'Can you cook?' },
                  { jp: '〜ことができる', rom: '~ koto ga dekiru', en: 'be able to do ~ (formal)' },
                  { jp: '泳ぐことができます', rom: 'Oyogu koto ga dekimasu', en: 'I can swim' },
                ].map(({ jp, rom, en }) => (
                  <div key={jp} className="text-xs border border-border/60 rounded-md p-2">
                    <div className={`font-bold ${V}`}>{jp}</div>
                    <div className="italic text-muted-foreground">{rom}</div>
                    <div>{en}</div>
                  </div>
                ))}
              </div>
            </div>
            <NoteBox>
              In colloquial speech, Group 2 potential 〜られる is often shortened to 〜れる: 食べれる (tabereru) instead of 食べられる (taberareru). This is called ら抜き言葉 (ra-nuki kotoba).
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 19. Volitional Form ─────────────────────────────────────────────────────
export function JaVolitionalFormCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>意志形 — Volitional Form & Desire</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>〜ましょう / 〜よう (Let's ~)</SectionLabel>
            <JaTable rows={[
              { jp: '食べましょう', romaji: 'tabemasho', en: 'Let\'s eat (polite)' },
              { jp: '食べよう', romaji: 'tabeyō', en: 'Let\'s eat (plain)' },
              { jp: '行きましょう', romaji: 'ikimashō', en: 'Let\'s go (polite)' },
              { jp: '行こう', romaji: 'ikō', en: 'Let\'s go (plain)' },
              { jp: '〜ましょうか', romaji: 'mashō ka', en: 'Shall we ~? / Shall I ~?' },
            ]} />
            <div className="mt-3">
              <SectionLabel>Formation</SectionLabel>
              <div className="text-xs space-y-0.5 text-muted-foreground">
                <div>Group 2: drop る, add よう → 食べる → 食べよう</div>
                <div>Group 1: change to お-row, add う → 書く → 書こう, 飲む → 飲もう</div>
                <div>Group 3: する → しよう, くる → こよう</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>〜たい — want to ~</SectionLabel>
              <p className="text-xs text-muted-foreground mb-2">Add たい to the verb stem (ます-stem). Conjugates like an い-adjective.</p>
              <JaTable rows={[
                { jp: '食べたい', romaji: 'tabetai', en: 'want to eat' },
                { jp: '食べたくない', romaji: 'tabetakunai', en: 'don\'t want to eat' },
                { jp: '行きたいです', romaji: 'ikitai desu', en: 'want to go (polite)' },
                { jp: '日本に行きたい', romaji: 'Nihon ni ikitai', en: 'I want to go to Japan' },
              ]} />
            </div>
            <div>
              <SectionLabel>〜たがる — (3rd person) wants to ~</SectionLabel>
              <NoteBox>
                For 3rd person desires, use 〜たがる: 彼は日本に行きたがっている (Kare wa Nihon ni ikitagatte iru) — He wants to go to Japan.
              </NoteBox>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 20. Conditional ─────────────────────────────────────────────────────────
export function JaConditionalCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>条件形 — Conditional Forms</SectionLabel>
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            {[
              {
                form: '〜たら', rom: 'tara', mean: 'if/when/after (sequential or hypothetical)',
                rule: 'Add ら to the past た-form',
                ex: '雨が降ったら、家にいます (If it rains, I\'ll stay home)',
              },
              {
                form: '〜ば', rom: 'ba', mean: 'if (hypothetical condition, formal)',
                rule: 'Group 1: change to え-row + ば. Group 2: drop る, add れば',
                ex: '安ければ買います (If it\'s cheap, I\'ll buy it)',
              },
              {
                form: '〜なら', rom: 'nara', mean: 'if/given that (assumes condition is true)',
                rule: 'Add なら to plain form of verb/adj/noun',
                ex: '日本語なら話せます (If it\'s Japanese, I can speak it)',
              },
            ].map(({ form, rom, mean, rule, ex }) => (
              <div key={form} className="rounded-md border border-border p-3 space-y-1">
                <div className={`text-lg font-bold ${V}`}>{form}</div>
                <div className="text-xs italic text-muted-foreground">({rom})</div>
                <div className="text-xs font-medium">{mean}</div>
                <div className="text-xs text-muted-foreground">Formation: {rule}</div>
                <div className="text-xs border-t border-border/40 pt-1 mt-1">{ex}</div>
              </div>
            ))}
          </div>
          <div>
            <SectionLabel>〜と — natural/inevitable condition</SectionLabel>
            <PatternBox
              pattern="V(plain) + と"
              romaji="V + to"
              meaning="whenever/if ~ (natural result, habitual)"
              example="このボタンを押すと、ドアが開きます"
              exRomaji="Kono botan wo osu to, doa ga akimasu"
              exEn="When you press this button, the door opens"
            />
          </div>
          <NoteBox>
            〜たら is the most versatile and common conditional. 〜ば is more formal/written. 〜と is used for automatic/natural results (instructions, vending machines, directions). 〜なら adds a nuance of "given that / if indeed."
          </NoteBox>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 21. て + いる ──────────────────────────────────────────────────────────
export function JaTeIruCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>〜ています — Te-form + いる</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">The pattern V-て + いる (te + iru) has two main meanings depending on the verb type: ongoing actions (activity verbs) or resultant states (change-of-state verbs).</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>1. Ongoing action (activity verbs)</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Describes what is happening right now or habitually.</p>
            <JaTable rows={[
              { jp: '食べています', romaji: 'tabete imasu', en: 'is eating (right now)' },
              { jp: '勉強しています', romaji: 'benkyō shite imasu', en: 'is studying' },
              { jp: '働いています', romaji: 'hataraite imasu', en: 'is working / works (job)' },
              { jp: '走っています', romaji: 'hashitte imasu', en: 'is running' },
            ]} />
          </div>
          <div>
            <SectionLabel>2. Resultant state (change verbs)</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Describes the ongoing state resulting from a completed action.</p>
            <JaTable rows={[
              { jp: '結婚しています', romaji: 'kekkon shite imasu', en: 'is married (result of marrying)' },
              { jp: '死んでいます', romaji: 'shinde imasu', en: 'is dead (result of dying)' },
              { jp: '着ています', romaji: 'kite imasu', en: 'is wearing (result of putting on)' },
              { jp: '知っています', romaji: 'shitte imasu', en: 'know (result of learning)' },
            ]} />
          </div>
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <NoteBox>
            Negative: 〜ていません (teimasen) — is not doing. Plain: 〜ている (te iru). Colloquial contraction: 〜てる (teru): 食べてる (tabeteru).
          </NoteBox>
          <div className="rounded-md border border-border/60 p-2 text-xs space-y-0.5">
            <div className="font-semibold text-foreground">Habitual use:</div>
            <div className={`${V} font-bold`}>毎朝コーヒーを飲んでいます</div>
            <div className="italic text-muted-foreground">Maiasa kōhī wo nonde imasu</div>
            <div>I drink coffee every morning. (habit)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 22. Honorifics ──────────────────────────────────────────────────────────
export function JaHonorificsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>敬語 — Honorific Language</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Japanese has a formal system of speech levels (敬語, keigo). The three main types are: 丁寧語 (polite), 尊敬語 (respectful/exalting), and 謙譲語 (humble/lowering).</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Common verb transformations</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-xs">
              <div className="grid bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr' }}>
                <div className="px-3 py-1.5">Plain</div>
                <div className="px-3 py-1.5">尊敬語 (respectful)</div>
                <div className="px-3 py-1.5">謙譲語 (humble)</div>
              </div>
              {[
                ['いる (be)', 'いらっしゃる', 'おる'],
                ['行く (go)', 'いらっしゃる', 'まいる'],
                ['来る (come)', 'いらっしゃる', 'まいる'],
                ['する (do)', 'なさる', 'いたす'],
                ['言う (say)', 'おっしゃる', '申す'],
                ['食べる/飲む', 'めしあがる', 'いただく'],
                ['もらう (receive)', '—', 'いただく'],
                ['あげる (give)', '—', 'さしあげる'],
                ['くれる (give me)', 'くださる', '—'],
                ['見る (see)', 'ご覧になる', '拝見する'],
                ['知る (know)', 'ご存知', '存じる'],
              ].map(([plain, keicho, kenjō], i) => (
                <div key={i} className={`grid ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr' }}>
                  <div className="px-3 py-1.5 text-muted-foreground">{plain}</div>
                  <div className={`px-3 py-1.5 font-medium ${V}`}>{keicho}</div>
                  <div className="px-3 py-1.5 font-medium">{kenjō}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>お〜 / ご〜 prefixes</SectionLabel>
              <div className="space-y-1 text-xs">
                {[
                  { jp: 'お名前', rom: 'o-namae', en: 'your name (honorific)' },
                  { jp: 'お仕事', rom: 'o-shigoto', en: 'your work (honorific)' },
                  { jp: 'ご家族', rom: 'go-kazoku', en: 'your family (honorific)' },
                  { jp: 'ご連絡', rom: 'go-renraku', en: 'your contact / the contact' },
                  { jp: 'おいしい', rom: 'oishii', en: 'delicious (お is embedded)' },
                ].map(({ jp, rom, en }) => (
                  <div key={jp} className="flex gap-2">
                    <span className={`font-bold ${V}`}>{jp}</span>
                    <span className="italic text-muted-foreground">({rom})</span>
                    <span>— {en}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>Title suffixes (〜さん、〜様、〜君...)</SectionLabel>
              <div className="space-y-0.5 text-xs">
                {[
                  { s: '〜さん', rom: '-san', en: 'Mr./Ms./Mrs. — general polite' },
                  { s: '〜様', rom: '-sama', en: 'very formal/reverential' },
                  { s: '〜君', rom: '-kun', en: 'for boys/close male relationships' },
                  { s: '〜ちゃん', rom: '-chan', en: 'cute/endearing (children, close friends)' },
                  { s: '〜先生', rom: '-sensei', en: 'teacher/doctor/expert' },
                  { s: '（呼び捨て）', rom: 'yobisute', en: 'no suffix — very close/subordinate' },
                ].map(({ s, rom, en }) => (
                  <div key={s} className="flex gap-2">
                    <span className={`font-bold ${V} shrink-0 w-20`}>{s}</span>
                    <span className="italic text-muted-foreground w-16 shrink-0">({rom})</span>
                    <span className="text-muted-foreground">{en}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
