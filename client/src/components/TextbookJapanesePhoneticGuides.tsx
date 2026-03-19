/**
 * TextbookJapanesePhoneticGuides.tsx
 * Section 8 — Japanese phonetic & writing system guides (9 cards).
 * Auto-triggered via classifyJapaneseGrammarType() → ja_* phonetic types.
 *
 * Cards:
 *   JaHiraganaChartCard, JaKatakanaChartCard, JaVowelSoundsCard,
 *   JaConsonantSoundsCard, JaLongVowelsCard, JaDoubleConsonantsCard,
 *   JaPitchAccentCard, JaLoanwordsCard, JaNSoundCard
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

function PhoneticBadge({ label, romaji, ipa }: { label: string; romaji: string; ipa?: string }) {
  return (
    <div className="rounded-md border border-border p-2 text-center">
      <div className={`text-xl font-bold ${V}`}>{label}</div>
      <div className="text-sm font-medium">{romaji}</div>
      {ipa && <div className="text-xs text-muted-foreground font-mono">/{ipa}/</div>}
    </div>
  );
}

// ─── 1. Complete Hiragana Chart ───────────────────────────────────────────────
export function JaHiraganaChartCard() {
  const main = [
    { row: 'vowels', chars: [['あ','a'],['い','i'],['う','u'],['え','e'],['お','o']] },
    { row: 'k', chars: [['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko']] },
    { row: 's', chars: [['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so']] },
    { row: 't', chars: [['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to']] },
    { row: 'n', chars: [['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no']] },
    { row: 'h', chars: [['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho']] },
    { row: 'm', chars: [['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo']] },
    { row: 'y', chars: [['や','ya'],['',''],['ゆ','yu'],['',''],['よ','yo']] },
    { row: 'r', chars: [['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro']] },
    { row: 'w', chars: [['わ','wa'],['',''],['',''],['',''],['を','wo']] },
    { row: 'n', chars: [['ん','n'],['',''],['',''],['',''],['',''],] },
  ];
  const dakuten = [
    { row: 'g', chars: [['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go']] },
    { row: 'z', chars: [['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo']] },
    { row: 'd', chars: [['だ','da'],['ぢ','ji'],['づ','zu'],['で','de'],['ど','do']] },
    { row: 'b', chars: [['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo']] },
    { row: 'p', chars: [['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po']] },
  ];
  const combo = [
    ['きゃ kya','きゅ kyu','きょ kyo'],
    ['しゃ sha','しゅ shu','しょ sho'],
    ['ちゃ cha','ちゅ chu','ちょ cho'],
    ['にゃ nya','にゅ nyu','にょ nyo'],
    ['ひゃ hya','ひゅ hyu','ひょ hyo'],
    ['みゃ mya','みゅ myu','みょ myo'],
    ['りゃ rya','りゅ ryu','りょ ryo'],
    ['ぎゃ gya','ぎゅ gyu','ぎょ gyo'],
    ['じゃ ja','じゅ ju','じょ jo'],
    ['びゃ bya','びゅ byu','びょ byo'],
    ['ぴゃ pya','ぴゅ pyu','ぴょ pyo'],
  ];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>ひらがな完全表 — Complete Hiragana Chart</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>基本 — Basic characters (46)</SectionLabel>
            <div className="overflow-x-auto">
              <table className="text-center border-collapse text-sm w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="border border-border/40 px-1 py-1 text-xs text-muted-foreground w-6">Row</th>
                    {['A','I','U','E','O'].map(v => (
                      <th key={v} className={`border border-border/40 px-2 py-1 text-xs ${V}`}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {main.map((r, ri) => (
                    <tr key={ri}>
                      <td className={`border border-border/40 px-1 py-0.5 text-xs ${V} font-bold`}>{r.row.toUpperCase()}</td>
                      {r.chars.map(([ch, rom], ci) => (
                        <td key={ci} className="border border-border/40 px-1 py-0.5">
                          {ch ? <><div className={`text-base font-bold ${V}`}>{ch}</div><div className="text-[9px] text-muted-foreground">{rom}</div></> : <span className="text-muted-foreground/20">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>濁音・半濁音 — Voiced & semi-voiced (25)</SectionLabel>
              <div className="overflow-x-auto">
                <table className="text-center border-collapse text-sm w-full">
                  <tbody>
                    {dakuten.map((r, ri) => (
                      <tr key={ri}>
                        <td className={`border border-border/40 px-1 py-0.5 text-xs ${V} font-bold`}>{r.row.toUpperCase()}</td>
                        {r.chars.map(([ch, rom], ci) => (
                          <td key={ci} className="border border-border/40 px-1 py-0.5">
                            <div className={`text-base font-bold ${V}`}>{ch}</div>
                            <div className="text-[9px] text-muted-foreground">{rom}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <SectionLabel>拗音 — Combination characters (ya/yu/yo)</SectionLabel>
              <div className="grid grid-cols-3 gap-0.5">
                {combo.map((row, i) => (
                  row.map((cell, j) => (
                    <div key={`${i}-${j}`} className={`border border-border/40 rounded-sm p-1 text-center text-xs`}>
                      <span className={`font-bold ${V}`}>{cell.split(' ')[0]}</span>
                      <span className="text-muted-foreground ml-1">{cell.split(' ')[1]}</span>
                    </div>
                  ))
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 2. Complete Katakana Chart ───────────────────────────────────────────────
export function JaKatakanaChartCard() {
  const main = [
    { row: 'vowels', chars: [['ア','a'],['イ','i'],['ウ','u'],['エ','e'],['オ','o']] },
    { row: 'k', chars: [['カ','ka'],['キ','ki'],['ク','ku'],['ケ','ke'],['コ','ko']] },
    { row: 's', chars: [['サ','sa'],['シ','shi'],['ス','su'],['セ','se'],['ソ','so']] },
    { row: 't', chars: [['タ','ta'],['チ','chi'],['ツ','tsu'],['テ','te'],['ト','to']] },
    { row: 'n', chars: [['ナ','na'],['ニ','ni'],['ヌ','nu'],['ネ','ne'],['ノ','no']] },
    { row: 'h', chars: [['ハ','ha'],['ヒ','hi'],['フ','fu'],['ヘ','he'],['ホ','ho']] },
    { row: 'm', chars: [['マ','ma'],['ミ','mi'],['ム','mu'],['メ','me'],['モ','mo']] },
    { row: 'y', chars: [['ヤ','ya'],['',''],['ユ','yu'],['',''],['ヨ','yo']] },
    { row: 'r', chars: [['ラ','ra'],['リ','ri'],['ル','ru'],['レ','re'],['ロ','ro']] },
    { row: 'w', chars: [['ワ','wa'],['',''],['',''],['',''],['ヲ','wo']] },
    { row: 'n', chars: [['ン','n'],['',''],['',''],['',''],['',''],] },
  ];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>カタカナ完全表 — Complete Katakana Chart</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>基本 — Basic + voiced characters</SectionLabel>
            <div className="overflow-x-auto">
              <table className="text-center border-collapse text-sm w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="border border-border/40 px-1 py-1 text-xs text-muted-foreground w-6">Row</th>
                    {['A','I','U','E','O'].map(v => (
                      <th key={v} className={`border border-border/40 px-2 py-1 text-xs ${V}`}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {main.map((r, ri) => (
                    <tr key={ri}>
                      <td className={`border border-border/40 px-1 py-0.5 text-xs ${V} font-bold`}>{r.row.toUpperCase()}</td>
                      {r.chars.map(([ch, rom], ci) => (
                        <td key={ci} className="border border-border/40 px-1 py-0.5">
                          {ch ? <><div className={`text-base font-bold ${V}`}>{ch}</div><div className="text-[9px] text-muted-foreground">{rom}</div></> : <span className="text-muted-foreground/20">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>Special katakana combinations for foreign sounds</SectionLabel>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  ['ファ fa','フィ fi','フェ fe','フォ fo'],
                  ['ティ ti','ディ di','トゥ tu','ドゥ du'],
                  ['ウィ wi','ウェ we','ウォ wo','ヴァ va'],
                  ['ヴィ vi','ヴ vu','ヴェ ve','ヴォ vo'],
                  ['チェ che','シェ she','ジェ je','イェ ye'],
                ].flat().map((cell, i) => (
                  <div key={i} className="border border-border/40 rounded-sm p-1 text-center">
                    <span className={`font-bold ${V}`}>{cell.split(' ')[0]}</span>
                    <span className="text-muted-foreground ml-1">{cell.split(' ')[1]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>Key katakana rules</SectionLabel>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div><span className={`font-bold ${V}`}>ー</span> Long vowel mark: コーヒー (kōhī = coffee)</div>
                <div><span className={`font-bold ${V}`}>ッ</span> Double consonant: ベッド (beddo = bed)</div>
                <div><span className={`font-bold ${V}`}>・</span> Middle dot: separates words in foreign names</div>
              </div>
            </div>
            <NoteBox>
              Katakana is used for: foreign words (外来語 gairaigo), foreign names, scientific terms, onomatopoeia emphasis, and slang. Example: アメリカ (Amerika = America), スマートフォン (sumātofon = smartphone).
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 3. Japanese Vowel Sounds ─────────────────────────────────────────────────
export function JaVowelSoundsCard() {
  const vowels = [
    { kana: 'あ/ア', rom: 'a', ipa: 'a', en: 'like "a" in "father"', ex: '赤 (aka = red), 朝 (asa = morning)' },
    { kana: 'い/イ', rom: 'i', ipa: 'i', en: 'like "ee" in "see" (shorter)', ex: '犬 (inu = dog), 石 (ishi = stone)' },
    { kana: 'う/ウ', rom: 'u', ipa: 'ɯ', en: 'unrounded — NOT like "oo"; lips not rounded', ex: '魚 (uo = fish), 上 (ue = above)' },
    { kana: 'え/エ', rom: 'e', ipa: 'e', en: 'like "e" in "bed" (crisp, short)', ex: '駅 (eki = station), 絵 (e = picture)' },
    { kana: 'お/オ', rom: 'o', ipa: 'o', en: 'like "o" in "more" (pure, no diphthong)', ex: '音 (oto = sound), 男 (otoko = man)' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>母音 — Japanese Vowel Sounds</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Japanese has 5 pure vowels. They are always pronounced clearly and consistently — unlike English vowels which shift depending on stress and context. All Japanese syllables are built around these 5 vowels.</p>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {vowels.map(({ kana, rom, ipa }) => (
            <PhoneticBadge key={rom} label={kana} romaji={rom} ipa={ipa} />
          ))}
        </div>
        <div className="space-y-2">
          {vowels.map(({ kana, rom, en, ex }) => (
            <div key={rom} className="rounded-md border border-border/60 p-2.5 text-xs grid gap-1" style={{ gridTemplateColumns: '3rem 1fr 1fr' }}>
              <div className={`font-bold text-sm ${V} text-center`}>{kana}</div>
              <div>{en}</div>
              <div className="text-muted-foreground">{ex}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <SectionLabel>Devoiced vowels (無声化)</SectionLabel>
          <NoteBox>
            In fast speech, い and う are often devoiced (whispered or silent) when surrounded by voiceless consonants (k, s, t, h, p) or at the end of a phrase. Examples: 好き (su̥ki), 来ます (ki̥masu), です (des̥u). This is a natural feature of Tokyo Japanese.
          </NoteBox>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 4. Consonant Sounds ─────────────────────────────────────────────────────
export function JaConsonantSoundsCard() {
  const special = [
    { sound: 'し / shi', ipa: 'ɕi', note: 'NOT "si" — the consonant is palatal, like English "sh" before "ee"' },
    { sound: 'ち / chi', ipa: 'tɕi', note: 'NOT "ti" — an affricate, like English "ch" in "cheese"' },
    { sound: 'つ / tsu', ipa: 'tsɯ', note: 'NOT "tu" — an affricate; the cluster "ts" before unrounded "u"' },
    { sound: 'ふ / fu', ipa: 'ɸɯ', note: 'NOT "hu" — bilabial fricative; no English equivalent; lips barely touch' },
    { sound: 'ら/り/る/れ/ろ — r', ipa: 'ɾ', note: 'Japanese "r" is a flap — NOT English "r". Tap the tip of tongue once, like "d" in "ladder"' },
    { sound: 'は / ha (as topic marker)', ipa: 'wa', note: 'は as particle is pronounced "wa", not "ha": 私は = watashi WA' },
    { sound: 'を / wo', ipa: 'o', note: 'を as object particle is usually pronounced "o" in modern speech' },
    { sound: 'じ / ji', ipa: 'dʑi', note: 'From both ざ-row じ and た-row ぢ (now mostly merged in modern Japanese)' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>子音 — Special Consonant Sounds</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Most Japanese consonants are similar to English, but several require special attention. The romanization system can be misleading — the actual pronunciation differs from English letter sounds.</p>
        <div className="space-y-2">
          {special.map(({ sound, ipa, note }) => (
            <div key={sound} className="rounded-md border border-border p-2.5">
              <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                <span className={`text-base font-bold ${V}`}>{sound}</span>
                <span className="text-xs font-mono text-muted-foreground">/{ipa}/</span>
              </div>
              <p className="text-xs text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          Japanese consonants are generally less aspirated than English. The "g" sound in standard Tokyo Japanese is often nasalized (ŋ) when it appears in the middle of a word, though this distinction is fading in modern speech.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 5. Long Vowels ──────────────────────────────────────────────────────────
export function JaLongVowelsCard() {
  const examples = [
    { short: 'おじさん (ojisan)', long: 'おじいさん (ojīsan)', shortEn: 'uncle', longEn: 'grandfather', note: 'Length of い changes meaning completely' },
    { short: 'ここ (koko)', long: 'こうこう (kōkō)', shortEn: 'here', longEn: 'high school', note: 'こ + う lengthens the お sound' },
    { short: 'ゆき (yuki)', long: 'ゆうき (yūki)', shortEn: 'snow', longEn: 'courage', note: 'ゆ + う lengthens the う sound' },
    { short: 'おばさん (obasan)', long: 'おばあさん (obāsan)', shortEn: 'aunt / middle-aged woman', longEn: 'grandmother', note: 'Length of あ changes meaning' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>長音 — Long Vowels</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Japanese distinguishes between short and long vowels — doubling the vowel length changes meaning. Long vowels are held for approximately twice the duration of short vowels.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>How long vowels are written</SectionLabel>
            <div className="space-y-2 text-xs">
              {[
                { rule: 'Long あ (ā)', hw: 'ひらがな: add あ', ex: 'おかあさん (okāsan = mother)' },
                { rule: 'Long い (ī)', hw: 'ひらがな: add い', ex: 'おにいさん (onīsan = older brother)' },
                { rule: 'Long う (ū)', hw: 'ひらがな: add う', ex: 'すうじ (sūji = number)' },
                { rule: 'Long え (ē)', hw: 'ひらがな: add え or い', ex: 'えいご (Eigo = English language), おねえさん' },
                { rule: 'Long お (ō)', hw: 'ひらがな: add お or う', ex: 'とうきょう (Tōkyō), おおきい (ōkii = big)' },
                { rule: 'Katakana long vowel', hw: 'カタカナ: use ー mark', ex: 'コーヒー (kōhī = coffee), ラーメン' },
              ].map(({ rule, hw, ex }) => (
                <div key={rule} className="rounded-md border border-border/60 p-2">
                  <div className={`font-bold ${V}`}>{rule}</div>
                  <div className="text-muted-foreground">{hw}</div>
                  <div>{ex}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Minimal pairs — meaning changes with vowel length</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="px-3 py-1.5">Short vowel</div>
                <div className="px-3 py-1.5">Long vowel</div>
              </div>
              {examples.map(({ short, long, shortEn, longEn, note }, i) => (
                <div key={i} className={`grid text-xs items-start ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="px-3 py-2">
                    <div className={`font-bold ${V}`}>{short}</div>
                    <div className="text-muted-foreground">{shortEn}</div>
                  </div>
                  <div className="px-3 py-2">
                    <div className={`font-bold ${V}`}>{long}</div>
                    <div className="text-muted-foreground">{longEn}</div>
                  </div>
                </div>
              ))}
            </div>
            <NoteBox>
              In romanization systems, long vowels are shown with a macron (ā, ī, ū, ē, ō) in Hepburn romanization, or double letters (aa, ii, uu, ee, oo) in Nihon-shiki romanization.
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 6. Double Consonants (促音) ─────────────────────────────────────────────
export function JaDoubleConsonantsCard() {
  const examples = [
    { kana: 'きって', romaji: 'kitte', en: 'stamp (postage)', note: 'Without っ: きて (kite = come!)' },
    { kana: 'きっぷ', romaji: 'kippu', en: 'ticket', note: 'Double p creates a pause + burst' },
    { kana: 'ざっし', romaji: 'zasshi', en: 'magazine', note: 'Double sh sound — pause before sh' },
    { kana: 'べっど', romaji: 'beddo', en: 'bed (loanword)', note: 'Katakana: ベッド — common in gairaigo' },
    { kana: 'ちょっと', romaji: 'chotto', en: 'a little / just a moment', note: 'Very common expression' },
    { kana: 'ざっくり', romaji: 'zakkuri', en: 'roughly / briefly', note: 'Colloquial intensifier' },
    { kana: 'ゆっくり', romaji: 'yukkuri', en: 'slowly / leisurely', note: 'ゆっくりして (take it easy)' },
    { kana: 'きっと', romaji: 'kitto', en: 'surely / certainly', note: 'Used for strong assertion' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>促音 — Double Consonants (っ / ッ)</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">The small っ (sokuon) in hiragana or ッ in katakana represents a doubled consonant. It creates a brief pause (one mora of silence) followed by a slightly more emphasized consonant release. This is phonemically distinctive — it changes meaning.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>How to produce double consonants</SectionLabel>
            <div className="space-y-2 text-xs">
              <div className="rounded-md border border-border/60 p-2.5">
                <div className={`font-bold ${V} mb-1`}>The "held stop" technique:</div>
                <div className="text-muted-foreground">1. Approach the consonant position (k, t, s, p...)</div>
                <div className="text-muted-foreground">2. Hold briefly without releasing air</div>
                <div className="text-muted-foreground">3. Release with a slight burst</div>
                <div className="mt-1">Like saying "book keeper" vs "boo-keeper" — the double k is audible.</div>
              </div>
              <NoteBox>
                っ can only precede consonants — never vowels or ん. You cannot double an "n" sound with っ; instead use ん + the consonant.
              </NoteBox>
            </div>
          </div>
          <div>
            <SectionLabel>Examples with meaning contrasts</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {examples.map(({ kana, romaji, en, note }, i) => (
                <div key={kana} className={`p-2 text-xs ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-bold ${V}`}>{kana}</span>
                    <span className="italic text-muted-foreground">({romaji})</span>
                    <span>— {en}</span>
                  </div>
                  <div className="text-muted-foreground">{note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 7. Pitch Accent ─────────────────────────────────────────────────────────
export function JaPitchAccentCard() {
  const patterns = [
    { type: '平板型 (heiban)', desc: 'Flat — starts low, rises after first mora, stays high to end', ex: 'はな・が (hana ga) — nose', note: 'Particle stays high' },
    { type: '頭高型 (atamadaka)', desc: 'Head-high — first mora HIGH, then drops low to end', ex: 'はな・が (hana ga) — flower', note: 'Particle stays low' },
    { type: '中高型 (nakadaka)', desc: 'Middle-high — starts low, peaks in middle, drops', ex: 'たまご (tamago = egg)', note: '2nd mora is high peak' },
    { type: '尾高型 (odaka)', desc: 'Tail-high — starts low, rises, drops only on particle', ex: 'おとこ (otoko = man)', note: 'Particle triggers drop' },
  ];
  const minPairs = [
    { w1: 'はし (LH)', m1: 'はし — chopsticks (flat 平板)', w2: 'はし (HL)', m2: 'はし — edge (atamadaka)' },
    { w1: 'あめ (LH)', m1: 'あめ — rain (flat)', w2: 'あめ (HL)', m2: 'あめ — candy (atamadaka)' },
    { w1: 'かき (LH)', m1: 'かき — oyster (flat)', w2: 'かき (HL)', m2: 'かき — fence (atamadaka)' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>アクセント — Pitch Accent</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Unlike English stress accent, Japanese uses <strong>pitch accent</strong> (音程アクセント) — the melody of high (H) and low (L) tones on syllables. Tokyo dialect has 4 pitch accent patterns.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Four accent patterns (Tokyo dialect)</SectionLabel>
            <div className="space-y-2">
              {patterns.map(({ type, desc, ex, note }) => (
                <div key={type} className="rounded-md border border-border p-2.5 text-xs">
                  <div className={`font-bold text-sm ${V} mb-0.5`}>{type}</div>
                  <div className="text-muted-foreground">{desc}</div>
                  <div className="mt-1"><span className="font-medium">Ex: </span>{ex}</div>
                  <div className="text-muted-foreground italic">{note}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>Pitch accent minimal pairs</SectionLabel>
              <div className="space-y-2">
                {minPairs.map(({ w1, m1, w2, m2 }) => (
                  <div key={w1} className="rounded-md border border-border overflow-hidden text-xs">
                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div className={`px-2 py-1.5 border-r border-border/60 ${VBg}`}>
                        <div className={`font-bold ${V}`}>{w1}</div>
                        <div className="text-muted-foreground">{m1}</div>
                      </div>
                      <div className="px-2 py-1.5">
                        <div className={`font-bold ${V}`}>{w2}</div>
                        <div className="text-muted-foreground">{m2}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <NoteBox>
              Pitch accent varies significantly by region. Kansai dialect (Osaka/Kyoto) has a completely different pitch accent system from Tokyo. Many non-native speakers and young Japanese speakers are losing pitch accent distinctions. For learners, mutual comprehension is usually fine without perfect pitch accent.
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 8. Katakana Loanwords ────────────────────────────────────────────────────
export function JaLoanwordsCard() {
  const categories = [
    { cat: 'Food & Drink', words: [
      { en: 'coffee', jp: 'コーヒー', rom: 'kōhī' },
      { en: 'beer', jp: 'ビール', rom: 'bīru' },
      { en: 'hamburger', jp: 'ハンバーガー', rom: 'hanbāgā' },
      { en: 'ice cream', jp: 'アイスクリーム', rom: 'aisukurīmu' },
      { en: 'bread', jp: 'パン', rom: 'pan', note: 'from Portuguese' },
    ]},
    { cat: 'Technology', words: [
      { en: 'smartphone', jp: 'スマートフォン', rom: 'sumātofon' },
      { en: 'computer', jp: 'コンピューター', rom: 'konpyūtā' },
      { en: 'internet', jp: 'インターネット', rom: 'intānetto' },
      { en: 'camera', jp: 'カメラ', rom: 'kamera' },
      { en: 'television', jp: 'テレビ', rom: 'terebi' },
    ]},
    { cat: 'Lifestyle', words: [
      { en: 'apartment', jp: 'アパート', rom: 'apāto' },
      { en: 'supermarket', jp: 'スーパー', rom: 'sūpā' },
      { en: 'convenience store', jp: 'コンビニ', rom: 'konbini' },
      { en: 'part-time job', jp: 'アルバイト', rom: 'arubaito', note: 'from German Arbeit' },
      { en: 'schedule', jp: 'スケジュール', rom: 'sukejūru' },
    ]},
  ];
  const rules = [
    { rule: 'L/R → ラ行', ex: 'radio → ラジオ (rajio), love → ラブ (rabu)' },
    { rule: 'Final consonant + ウ/ク', ex: 'disk → ディスク (disuku), book → ブック (bukku)' },
    { rule: 'V → バ行', ex: 'violin → バイオリン (baiorin)' },
    { rule: 'th → ザ/ス', ex: 'theme → テーマ (tēma)' },
    { rule: 'Vowels added to break clusters', ex: 'strike → ストライク (sutoraiku)' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>外来語 — Katakana Loanwords</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Common loanword categories</SectionLabel>
            <div className="space-y-3">
              {categories.map(({ cat, words }) => (
                <div key={cat}>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">{cat}</div>
                  <div className="rounded-md border border-border overflow-hidden">
                    {words.map(({ en, jp, rom, note }, i) => (
                      <div key={en} className={`grid items-center text-xs ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '1fr 1.2fr 1fr' }}>
                        <div className="px-2 py-1.5 text-muted-foreground">{en}</div>
                        <div className={`px-2 py-1.5 font-bold ${V}`}>{jp}</div>
                        <div className="px-2 py-1.5 italic text-muted-foreground">{rom}{note ? ` (${note})` : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>Phonological adaptation rules</SectionLabel>
              <div className="space-y-1.5">
                {rules.map(({ rule, ex }) => (
                  <div key={rule} className="rounded-md border border-border/60 p-2 text-xs">
                    <div className={`font-bold ${V}`}>{rule}</div>
                    <div className="text-muted-foreground">{ex}</div>
                  </div>
                ))}
              </div>
            </div>
            <NoteBox>
              About 10% of Japanese vocabulary consists of loanwords (外来語 gairaigo), mostly from English. Some words change meaning: マンション (manshon) = apartment/condo (NOT mansion). スマート (sumāto) = slim/slender (NOT smart). これはスマートです = "This is slim/slender."
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 9. The ん Sound ─────────────────────────────────────────────────────────
export function JaNSoundCard() {
  const variants = [
    { before: 'Before m, b, p', sound: '[m]', ex: 'さんぽ (sanpo) → [sampo] — walk', rule: 'ん becomes bilabial nasal before bilabial consonants' },
    { before: 'Before n, t, d, r', sound: '[n]', ex: 'さんだる (sandaru) → [sandaru] — sandal', rule: 'ん becomes alveolar nasal before alveolar consonants' },
    { before: 'Before k, g', sound: '[ŋ]', ex: 'えんき (enki) → [eŋki] — postponement', rule: 'ん becomes velar nasal before velar consonants' },
    { before: 'Before vowels, ya/wa', sound: '[ɴ] or [ʔ]', ex: 'あんい (an\'i) → nasal + glottal', rule: 'Syllabic nasal; apostrophe used in romanization to separate ん from next vowel' },
    { before: 'At word end', sound: '[ɴ]', ex: 'にほん (Nihon) → [nihɔɴ] — Japan', rule: 'Uvular nasal; longer than a normal "n"' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>ん / ン — The Syllabic N</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">ん is unique: it is the only Japanese consonant that forms a mora (syllable) without a vowel. It always counts as one full beat. Its pronunciation varies by phonetic environment — it is a "chameleon" sound.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Phonological variants of ん</SectionLabel>
            <div className="space-y-2">
              {variants.map(({ before, sound, ex, rule }) => (
                <div key={before} className="rounded-md border border-border p-2.5 text-xs">
                  <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                    <span className={`font-bold ${V}`}>{before}</span>
                    <span className="font-mono text-muted-foreground">→ [{sound.replace('[','').replace(']','')}]</span>
                  </div>
                  <div className="text-muted-foreground">{rule}</div>
                  <div className="mt-0.5 italic">{ex}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <SectionLabel>ん in word recognition</SectionLabel>
              <div className="space-y-1.5 text-xs">
                {[
                  { jp: 'にほん', rom: 'ni-ho-n', mora: 3, en: 'Japan — 3 morae' },
                  { jp: 'さんぽ', rom: 'sa-n-po', mora: 3, en: 'walk — ん is a full beat' },
                  { jp: 'とんかつ', rom: 'to-n-ka-tsu', mora: 4, en: 'pork cutlet — 4 morae' },
                  { jp: 'せんせい', rom: 'se-n-se-i', mora: 4, en: 'teacher — 4 morae' },
                ].map(({ jp, rom, mora, en }) => (
                  <div key={jp} className="rounded-md border border-border/60 p-2">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-bold text-base ${V}`}>{jp}</span>
                      <span className="italic text-muted-foreground">({rom})</span>
                      <span className="text-muted-foreground">— {mora} morae</span>
                    </div>
                    <div className="text-muted-foreground">{en}</div>
                  </div>
                ))}
              </div>
            </div>
            <NoteBox>
              Romanization tip: When ん is followed by a vowel or y, use an apostrophe (or ñ in some systems) to show it is a separate mora: 本屋 hon'ya (bookstore), not honya. This prevents confusion: きんいろ (kin'iro = gold-colored) vs きにいろ (kiniiro).
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
