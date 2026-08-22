/**
 * TextbookJapaneseWordFamilies.tsx
 * Section 6 — Japanese kanji-based word families (10 families).
 * Auto-triggered via resolveJaFamilyCard(chapterTitle) in ChapterIntroduction.tsx.
 *
 * Families (kanji root → compound words + readings):
 *   食 (eat/food), 日 (sun/day/Japan), 水 (water), 学 (study),
 *   人 (person), 時 (time), 大 (big/great), 行 (go/travel),
 *   見 (see/look), 気 (spirit/energy)
 */

import { Card, CardContent } from '@/components/ui/card';

const V = 'text-violet-700 dark:text-violet-400';
const VBg = 'bg-violet-500/10';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </h3>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rounded-md ${VBg} border border-violet-500/20 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

interface KanjiWord {
  kanji: string;
  kana: string;
  romaji: string;
  en: string;
  reading?: 'on' | 'kun' | 'mixed';
}

function KanjiFamilyCard({
  rootKanji, rootMeaning, rootOn, rootKun, words, insight,
}: {
  rootKanji: string;
  rootMeaning: string;
  rootOn: string;
  rootKun: string;
  words: KanjiWord[];
  insight: string;
}) {
  const onWords = words.filter(w => w.reading === 'on');
  const kunWords = words.filter(w => w.reading === 'kun');
  const mixed = words.filter(w => w.reading === 'mixed' || !w.reading);

  function WordList({ list }: { list: KanjiWord[] }) {
    if (!list.length) return null;
    return (
      <div className="rounded-md border border-border overflow-hidden">
        {list.map((w, i) => (
          <div key={w.kanji + w.kana} className={`grid items-center text-xs ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '1.8fr 1.4fr 1.2fr 2fr' }}>
            <div className={`px-3 py-2 font-bold ${V}`}>{w.kanji}</div>
            <div className="px-3 py-2 text-muted-foreground">{w.kana}</div>
            <div className="px-3 py-2 italic text-muted-foreground text-[11px]">{w.romaji}</div>
            <div className="px-3 py-2">{w.en}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className={`flex items-start gap-4 mb-4 p-3 rounded-md ${VBg} border border-violet-500/20`}>
          <div className="text-center shrink-0">
            <div className={`text-5xl font-bold ${V}`}>{rootKanji}</div>
            <div className="text-sm font-semibold mt-1">{rootMeaning}</div>
          </div>
          <div className="text-xs space-y-1">
            <div><span className="font-semibold text-muted-foreground">On-yomi:</span> <span className={`font-bold ${V}`}>{rootOn}</span></div>
            <div><span className="font-semibold text-muted-foreground">Kun-yomi:</span> <span className={`font-bold ${V}`}>{rootKun}</span></div>
            <div className="text-muted-foreground pt-1">{insight}</div>
          </div>
        </div>

        <div className="space-y-3">
          {onWords.length > 0 && (
            <div>
              <SectionLabel>On-yomi compounds (音読み)</SectionLabel>
              <WordList list={onWords} />
            </div>
          )}
          {kunWords.length > 0 && (
            <div>
              <SectionLabel>Kun-yomi compounds (訓読み)</SectionLabel>
              <WordList list={kunWords} />
            </div>
          )}
          {mixed.length > 0 && (
            <div>
              <SectionLabel>Mixed & irregular readings</SectionLabel>
              <WordList list={mixed} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 1. 食 (eat / food) ───────────────────────────────────────────────────────
export function JaShokuFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="食"
      rootMeaning="eat / food"
      rootOn="ショク・ジキ (Shoku / Jiki)"
      rootKun="た(べる)・く(う) (ta-beru / ku-u)"
      insight="One of the most productive kanji in daily life — appears in restaurant names, menus, nutrition labels, and everyday conversation."
      words={[
        { kanji: '食べる', kana: 'たべる', romaji: 'taberu', en: 'to eat', reading: 'kun' },
        { kanji: '食べ物', kana: 'たべもの', romaji: 'tabemono', en: 'food (edible items)', reading: 'kun' },
        { kanji: '食べ放題', kana: 'たべほうだい', romaji: 'tabehōdai', en: 'all-you-can-eat', reading: 'kun' },
        { kanji: '食事', kana: 'しょくじ', romaji: 'shokuji', en: 'a meal / dining', reading: 'on' },
        { kanji: '食堂', kana: 'しょくどう', romaji: 'shokudō', en: 'dining hall / cafeteria', reading: 'on' },
        { kanji: '食品', kana: 'しょくひん', romaji: 'shokuhin', en: 'foodstuffs / groceries', reading: 'on' },
        { kanji: '食欲', kana: 'しょくよく', romaji: 'shokuyoku', en: 'appetite', reading: 'on' },
        { kanji: '食料', kana: 'しょくりょう', romaji: 'shokuryō', en: 'food supplies', reading: 'on' },
        { kanji: '食文化', kana: 'しょくぶんか', romaji: 'shoku bunka', en: 'food culture', reading: 'on' },
        { kanji: '外食', kana: 'がいしょく', romaji: 'gaishoku', en: 'eating out', reading: 'on' },
        { kanji: '断食', kana: 'だんじき', romaji: 'danjiki', en: 'fasting', reading: 'on' },
        { kanji: '食器', kana: 'しょっき', romaji: 'shokki', en: 'tableware / dishes', reading: 'mixed' },
      ]}
    />
  );
}

// ─── 2. 日 (sun / day / Japan) ────────────────────────────────────────────────
export function JaNichiFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="日"
      rootMeaning="sun / day / Japan"
      rootOn="ニチ・ジツ (Nichi / Jitsu)"
      rootKun="ひ・か (hi / ka)"
      insight="Arguably the most important kanji in Japanese — it appears in the country name 日本 (nihon/nippon) and nearly every date-related expression."
      words={[
        { kanji: '日本', kana: 'にほん', romaji: 'nihon', en: 'Japan', reading: 'on' },
        { kanji: '日本語', kana: 'にほんご', romaji: 'nihongo', en: 'Japanese language', reading: 'on' },
        { kanji: '毎日', kana: 'まいにち', romaji: 'mainichi', en: 'every day', reading: 'on' },
        { kanji: '日曜日', kana: 'にちようび', romaji: 'nichiyōbi', en: 'Sunday', reading: 'on' },
        { kanji: '日記', kana: 'にっき', romaji: 'nikki', en: 'diary / journal', reading: 'on' },
        { kanji: '今日', kana: 'きょう', romaji: 'kyō', en: 'today', reading: 'mixed' },
        { kanji: '昨日', kana: 'きのう', romaji: 'kinō', en: 'yesterday', reading: 'mixed' },
        { kanji: '日の出', kana: 'ひので', romaji: 'hinode', en: 'sunrise', reading: 'kun' },
        { kanji: '日差し', kana: 'ひざし', romaji: 'hizashi', en: 'sunlight / sunshine', reading: 'kun' },
        { kanji: '休日', kana: 'きゅうじつ', romaji: 'kyūjitsu', en: 'holiday / day off', reading: 'on' },
        { kanji: '誕生日', kana: 'たんじょうび', romaji: 'tanjōbi', en: 'birthday', reading: 'on' },
        { kanji: '日本人', kana: 'にほんじん', romaji: 'nihonjin', en: 'Japanese person', reading: 'on' },
      ]}
    />
  );
}

// ─── 3. 水 (water) ───────────────────────────────────────────────────────────
export function JaSuiFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="水"
      rootMeaning="water"
      rootOn="スイ (Sui)"
      rootKun="みず (mizu)"
      insight="Water-related vocabulary spans daily life, sports, weather, and the days of the week — 水曜日 (Wednesday) literally means 'water day'."
      words={[
        { kanji: '水', kana: 'みず', romaji: 'mizu', en: 'water', reading: 'kun' },
        { kanji: '水道', kana: 'すいどう', romaji: 'suidō', en: 'water supply / plumbing', reading: 'on' },
        { kanji: '水曜日', kana: 'すいようび', romaji: 'suiyōbi', en: 'Wednesday', reading: 'on' },
        { kanji: '水泳', kana: 'すいえい', romaji: 'suiei', en: 'swimming', reading: 'on' },
        { kanji: '水族館', kana: 'すいぞくかん', romaji: 'suizokukan', en: 'aquarium', reading: 'on' },
        { kanji: '水分', kana: 'すいぶん', romaji: 'suibun', en: 'moisture / water content', reading: 'on' },
        { kanji: '水面', kana: 'すいめん', romaji: 'suimen', en: 'water surface', reading: 'on' },
        { kanji: '洪水', kana: 'こうずい', romaji: 'kōzui', en: 'flood', reading: 'on' },
        { kanji: '冷水', kana: 'れいすい', romaji: 'reisui', en: 'cold water', reading: 'on' },
        { kanji: '水玉', kana: 'みずたま', romaji: 'mizutama', en: 'polka dot / water drop', reading: 'kun' },
        { kanji: '水やり', kana: 'みずやり', romaji: 'mizuyari', en: 'watering (plants)', reading: 'kun' },
      ]}
    />
  );
}

// ─── 4. 学 (study / learning) ─────────────────────────────────────────────────
export function JaGakuFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="学"
      rootMeaning="study / learning"
      rootOn="ガク (Gaku)"
      rootKun="まな(ぶ) (mana-bu)"
      insight="学 is the backbone of Japanese educational vocabulary — from elementary school to university to academic disciplines."
      words={[
        { kanji: '学ぶ', kana: 'まなぶ', romaji: 'manabu', en: 'to learn / study', reading: 'kun' },
        { kanji: '学校', kana: 'がっこう', romaji: 'gakkō', en: 'school', reading: 'on' },
        { kanji: '学生', kana: 'がくせい', romaji: 'gakusei', en: 'student', reading: 'on' },
        { kanji: '大学', kana: 'だいがく', romaji: 'daigaku', en: 'university', reading: 'on' },
        { kanji: '大学院', kana: 'だいがくいん', romaji: 'daigakuin', en: 'graduate school', reading: 'on' },
        { kanji: '学習', kana: 'がくしゅう', romaji: 'gakushū', en: 'learning / study', reading: 'on' },
        { kanji: '科学', kana: 'かがく', romaji: 'kagaku', en: 'science', reading: 'on' },
        { kanji: '文学', kana: 'ぶんがく', romaji: 'bungaku', en: 'literature', reading: 'on' },
        { kanji: '数学', kana: 'すうがく', romaji: 'sūgaku', en: 'mathematics', reading: 'on' },
        { kanji: '哲学', kana: 'てつがく', romaji: 'tetsugaku', en: 'philosophy', reading: 'on' },
        { kanji: '学力', kana: 'がくりょく', romaji: 'gakuryoku', en: 'academic ability', reading: 'on' },
        { kanji: '独学', kana: 'どくがく', romaji: 'dokugaku', en: 'self-study', reading: 'on' },
      ]}
    />
  );
}

// ─── 5. 人 (person) ──────────────────────────────────────────────────────────
export function JaJinFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="人"
      rootMeaning="person / people"
      rootOn="ジン・ニン (Jin / Nin)"
      rootKun="ひと (hito)"
      insight="人 has three common readings depending on context: ひと (hito) as a standalone word, じん (jin) for nationality/occupation suffixes, and にん (nin) for counting people."
      words={[
        { kanji: '人', kana: 'ひと', romaji: 'hito', en: 'person / people', reading: 'kun' },
        { kanji: '人々', kana: 'ひとびと', romaji: 'hitobito', en: 'people (plural)', reading: 'kun' },
        { kanji: '日本人', kana: 'にほんじん', romaji: 'nihonjin', en: 'Japanese person', reading: 'on' },
        { kanji: '外国人', kana: 'がいこくじん', romaji: 'gaikokujin', en: 'foreigner', reading: 'on' },
        { kanji: '人口', kana: 'じんこう', romaji: 'jinkō', en: 'population', reading: 'on' },
        { kanji: '人気', kana: 'にんき', romaji: 'ninki', en: 'popularity', reading: 'on' },
        { kanji: '三人', kana: 'さんにん', romaji: 'san-nin', en: 'three people', reading: 'on' },
        { kanji: '一人', kana: 'ひとり', romaji: 'hitori', en: 'one person / alone', reading: 'mixed' },
        { kanji: '二人', kana: 'ふたり', romaji: 'futari', en: 'two people / couple', reading: 'mixed' },
        { kanji: '大人', kana: 'おとな', romaji: 'otona', en: 'adult', reading: 'mixed' },
        { kanji: '子ども', kana: 'こども', romaji: 'kodomo', en: 'child', reading: 'kun' },
        { kanji: '人生', kana: 'じんせい', romaji: 'jinsei', en: 'life (one\'s life journey)', reading: 'on' },
      ]}
    />
  );
}

// ─── 6. 時 (time) ─────────────────────────────────────────────────────────────
export function JaJiFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="時"
      rootMeaning="time / hour / occasion"
      rootOn="ジ (Ji)"
      rootKun="とき (toki)"
      insight="時 is central to all time-related Japanese vocabulary. 時間 (time/hours), 時刻 (clock time), and 時代 (era) are built on this kanji."
      words={[
        { kanji: '時', kana: 'とき', romaji: 'toki', en: 'time / occasion / moment', reading: 'kun' },
        { kanji: '時間', kana: 'じかん', romaji: 'jikan', en: 'time / hours (duration)', reading: 'on' },
        { kanji: '時刻', kana: 'じこく', romaji: 'jikoku', en: 'time (point) / clock time', reading: 'on' },
        { kanji: '時代', kana: 'じだい', romaji: 'jidai', en: 'era / period / age', reading: 'on' },
        { kanji: '時々', kana: 'ときどき', romaji: 'tokidoki', en: 'sometimes', reading: 'kun' },
        { kanji: '〜時 (o\'clock)', kana: '〜じ', romaji: '~-ji', en: 'o\'clock: 三時 = 3 o\'clock', reading: 'on' },
        { kanji: '何時', kana: 'なんじ', romaji: 'nanji', en: 'what time?', reading: 'on' },
        { kanji: '同時', kana: 'どうじ', romaji: 'dōji', en: 'simultaneous / at the same time', reading: 'on' },
        { kanji: '時計', kana: 'とけい', romaji: 'tokei', en: 'clock / watch', reading: 'mixed' },
        { kanji: '一時的', kana: 'いちじてき', romaji: 'ichijiteki', en: 'temporary', reading: 'on' },
        { kanji: '時給', kana: 'じきゅう', romaji: 'jikyū', en: 'hourly wage', reading: 'on' },
      ]}
    />
  );
}

// ─── 7. 大 (big / great) ─────────────────────────────────────────────────────
export function JaDaiFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="大"
      rootMeaning="big / great / major"
      rootOn="ダイ・タイ (Dai / Tai)"
      rootKun="おお(きい) (ō-kii)"
      insight="大 is one of the most versatile kanji — it combines with nearly any noun to create 'big/major/grand' versions: 大学 (university), 大人 (adult), 大好き (love very much)."
      words={[
        { kanji: '大きい', kana: 'おおきい', romaji: 'ōkii', en: 'big / large (い-adjective)', reading: 'kun' },
        { kanji: '大人', kana: 'おとな', romaji: 'otona', en: 'adult', reading: 'mixed' },
        { kanji: '大学', kana: 'だいがく', romaji: 'daigaku', en: 'university', reading: 'on' },
        { kanji: '大好き', kana: 'だいすき', romaji: 'daisuki', en: 'love / really like', reading: 'on' },
        { kanji: '大嫌い', kana: 'だいきらい', romaji: 'daikirai', en: 'hate / really dislike', reading: 'on' },
        { kanji: '大変', kana: 'たいへん', romaji: 'taihen', en: 'terrible / tough / very (adv)', reading: 'on' },
        { kanji: '大事', kana: 'だいじ', romaji: 'daiji', en: 'important / precious', reading: 'on' },
        { kanji: '大丈夫', kana: 'だいじょうぶ', romaji: 'daijōbu', en: 'alright / no problem / OK', reading: 'on' },
        { kanji: '偉大', kana: 'いだい', romaji: 'idai', en: 'great / magnificent', reading: 'on' },
        { kanji: '拡大', kana: 'かくだい', romaji: 'kakudai', en: 'expansion / enlargement', reading: 'on' },
        { kanji: '大雪', kana: 'おおゆき', romaji: 'ōyuki', en: 'heavy snow', reading: 'kun' },
        { kanji: '大阪', kana: 'おおさか', romaji: 'Ōsaka', en: 'Osaka (city)', reading: 'kun' },
      ]}
    />
  );
}

// ─── 8. 行 (go / travel) ─────────────────────────────────────────────────────
export function JaKoFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="行"
      rootMeaning="go / travel / conduct"
      rootOn="コウ・ギョウ・アン (Kō / Gyō / An)"
      rootKun="い(く)・おこな(う) (i-ku / okonau)"
      insight="行 has three on-yomi readings — this is unusually complex even for kanji. The most common are こう (kō) in compounds about travel/banks, ぎょう (gyō) in compounds about conduct/lines, and い (i) as the verb 'to go'."
      words={[
        { kanji: '行く', kana: 'いく', romaji: 'iku', en: 'to go', reading: 'kun' },
        { kanji: '旅行', kana: 'りょこう', romaji: 'ryokō', en: 'travel / trip', reading: 'on' },
        { kanji: '銀行', kana: 'ぎんこう', romaji: 'ginkō', en: 'bank', reading: 'on' },
        { kanji: '行動', kana: 'こうどう', romaji: 'kōdō', en: 'action / behavior', reading: 'on' },
        { kanji: '行事', kana: 'ぎょうじ', romaji: 'gyōji', en: 'event / function', reading: 'on' },
        { kanji: '行列', kana: 'ぎょうれつ', romaji: 'gyōretsu', en: 'queue / line / procession', reading: 'on' },
        { kanji: '実行', kana: 'じっこう', romaji: 'jikkō', en: 'execution / implementation', reading: 'on' },
        { kanji: '行方', kana: 'ゆくえ', romaji: 'yukue', en: 'whereabouts / destination', reading: 'kun' },
        { kanji: '歩行', kana: 'ほこう', romaji: 'hokō', en: 'walking / on foot', reading: 'on' },
        { kanji: '先行', kana: 'せんこう', romaji: 'senkō', en: 'preceding / going ahead', reading: 'on' },
        { kanji: '行方不明', kana: 'ゆくえふめい', romaji: 'yukue fumei', en: 'missing / whereabouts unknown', reading: 'mixed' },
      ]}
    />
  );
}

// ─── 9. 見 (see / look) ──────────────────────────────────────────────────────
export function JaKenFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="見"
      rootMeaning="see / look / view"
      rootOn="ケン (Ken)"
      rootKun="み(る)・み(える)・み(せる) (mi-ru / mi-eru / mi-seru)"
      insight="見 has a rich set of kun-yomi verb forms that distinguish between active looking (見る), becoming visible (見える), and showing/displaying (見せる)."
      words={[
        { kanji: '見る', kana: 'みる', romaji: 'miru', en: 'to see / watch / look', reading: 'kun' },
        { kanji: '見える', kana: 'みえる', romaji: 'mieru', en: 'to be visible / can be seen', reading: 'kun' },
        { kanji: '見せる', kana: 'みせる', romaji: 'miseru', en: 'to show / display', reading: 'kun' },
        { kanji: '見物', kana: 'けんぶつ', romaji: 'kenbutsu', en: 'sightseeing / viewing', reading: 'on' },
        { kanji: '見学', kana: 'けんがく', romaji: 'kengaku', en: 'field trip / study tour', reading: 'on' },
        { kanji: '意見', kana: 'いけん', romaji: 'iken', en: 'opinion / view', reading: 'on' },
        { kanji: '発見', kana: 'はっけん', romaji: 'hakken', en: 'discovery', reading: 'on' },
        { kanji: '外見', kana: 'がいけん', romaji: 'gaiken', en: 'appearance / outward look', reading: 'on' },
        { kanji: '見本', kana: 'みほん', romaji: 'mihon', en: 'sample / example', reading: 'mixed' },
        { kanji: '見直し', kana: 'みなおし', romaji: 'minaoshi', en: 'review / reconsideration', reading: 'kun' },
        { kanji: '一見', kana: 'いっけん', romaji: 'ikken', en: 'at first glance', reading: 'on' },
        { kanji: '見送り', kana: 'みおくり', romaji: 'miokuri', en: 'send-off / seeing someone off', reading: 'kun' },
      ]}
    />
  );
}

// ─── 10. 気 (spirit / energy / feeling) ──────────────────────────────────────
export function JaKiFamilyCard() {
  return (
    <KanjiFamilyCard
      rootKanji="気"
      rootMeaning="spirit / energy / feeling / air"
      rootOn="キ・ケ (Ki / Ke)"
      rootKun="(no standalone kun-yomi)"
      insight="気 is one of the most culturally significant kanji — it represents life energy, mood, atmosphere, and awareness. 気持ち (kimochi = feeling) and 元気 (genki = energetic/well) are among the first words learners encounter."
      words={[
        { kanji: '元気', kana: 'げんき', romaji: 'genki', en: 'energetic / healthy / fine', reading: 'on' },
        { kanji: '気持ち', kana: 'きもち', romaji: 'kimochi', en: 'feeling / mood / sensation', reading: 'on' },
        { kanji: '天気', kana: 'てんき', romaji: 'tenki', en: 'weather', reading: 'on' },
        { kanji: '病気', kana: 'びょうき', romaji: 'byōki', en: 'illness / sickness', reading: 'on' },
        { kanji: '気分', kana: 'きぶん', romaji: 'kibun', en: 'mood / feeling / atmosphere', reading: 'on' },
        { kanji: '空気', kana: 'くうき', romaji: 'kūki', en: 'air / atmosphere', reading: 'on' },
        { kanji: '電気', kana: 'でんき', romaji: 'denki', en: 'electricity / electric light', reading: 'on' },
        { kanji: '人気', kana: 'にんき', romaji: 'ninki', en: 'popularity', reading: 'on' },
        { kanji: '気をつける', kana: 'きをつける', romaji: 'ki wo tsukeru', en: 'to be careful / take care', reading: 'on' },
        { kanji: '気になる', kana: 'きになる', romaji: 'ki ni naru', en: 'to be concerned / to worry', reading: 'on' },
        { kanji: '気楽', kana: 'きらく', romaji: 'kiraku', en: 'carefree / easygoing', reading: 'on' },
        { kanji: '本気', kana: 'ほんき', romaji: 'honki', en: 'serious / genuine intent', reading: 'on' },
      ]}
    />
  );
}

// ─── Resolver ─────────────────────────────────────────────────────────────────
export function resolveJaFamilyCard(chapterTitle: string): React.ReactNode {
  const t = chapterTitle.toLowerCase();

  // 食 — food/eat
  if (t.includes('食') || t.includes('shoku') || t.includes('eat') || t.includes('food') || t.includes('taberu')) return <JaShokuFamilyCard />;
  // 日 — sun/day/Japan
  if (t.includes('日') || t.includes('nichi') || t.includes('sun') || t.includes('nihon') || t.includes('japan')) return <JaNichiFamilyCard />;
  // 水 — water
  if (t.includes('水') || t.includes('sui') || t.includes('mizu') || t.includes('water')) return <JaSuiFamilyCard />;
  // 学 — study
  if (t.includes('学') || t.includes('gaku') || t.includes('study') || t.includes('learn') || t.includes('school')) return <JaGakuFamilyCard />;
  // 人 — person
  if (t.includes('人') || t.includes('jin') || t.includes('nin') || t.includes('person') || t.includes('people')) return <JaJinFamilyCard />;
  // 時 — time
  if (t.includes('時') || t.includes('jikan') || t.includes('time') || t.includes('hour')) return <JaJiFamilyCard />;
  // 大 — big
  if (t.includes('大') || t.includes('dai') || t.includes('big') || t.includes('great') || t.includes('ōkii')) return <JaDaiFamilyCard />;
  // 行 — go
  if (t.includes('行') || t.includes('iku') || t.includes('go') || t.includes('travel') || t.includes('kō')) return <JaKoFamilyCard />;
  // 見 — see
  if (t.includes('見') || t.includes('miru') || t.includes('see') || t.includes('look') || t.includes('ken')) return <JaKenFamilyCard />;
  // 気 — spirit/energy
  if (t.includes('気') || t.includes('ki') || t.includes('spirit') || t.includes('energy') || t.includes('feeling') || t.includes('genki')) return <JaKiFamilyCard />;

  // Default: 気 family (most common beginner vocabulary)
  return <JaKiFamilyCard />;
}
