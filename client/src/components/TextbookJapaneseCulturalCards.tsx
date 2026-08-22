/**
 * TextbookJapaneseCulturalCards.tsx
 * Section 5 — Japanese cultural reference cards (7 cards).
 * Auto-triggered via ChapterIntroduction.tsx → country_dot_map / ja_* cultural types.
 *
 * Cards:
 *   JapanophoneWorldCard, JapaneseHolidayCalendarCard, JapaneseFoodGuideCard,
 *   JapaneseRegionsCard, JapaneseEtiquetteCard, JapaneseCurrencyCard,
 *   JapanesePopCultureCard
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

// ─── 1. Japanophone World Map ─────────────────────────────────────────────────
export function JapanophoneWorldCard() {
  const regions = [
    { name: '日本 (Nihon/Nippon)', pop: '125M', note: 'Official language; capital: 東京 (Tōkyō)' },
    { name: 'Japanese diaspora', pop: '3.5M+', note: 'Brazil, USA, Australia, Canada, Philippines' },
    { name: 'Palau', pop: 'historic', note: 'Palauan has Japanese loanwords from WWII-era occupation' },
    { name: 'Northern Mariana Islands', pop: 'historic', note: 'Significant Japanese tourism and historic presence' },
  ];
  const dialects = [
    { name: '標準語 (Hyōjungo)', region: 'Tokyo / national', note: 'Standard Japanese; used in media, education, business' },
    { name: '関西弁 (Kansai-ben)', region: 'Osaka / Kyoto / Kobe', note: 'Second most influential; distinct vocabulary and intonation' },
    { name: '東北弁 (Tōhoku-ben)', region: 'Northern Honshu', note: 'Considered "thick accent"; some mutual intelligibility issues' },
    { name: '九州弁 (Kyūshū-ben)', region: 'Kyushu island', note: 'Various subdialects; Hakata-ben (Fukuoka) well-known' },
    { name: '沖縄語 (Okinawa-go)', region: 'Ryukyu Islands', note: 'Ryukyuan languages — distinct language family; endangered' },
    { name: '北海道弁 (Hokkaidō-ben)', region: 'Hokkaido', note: 'Closest to standard; historically settled by mainland migrants' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>日本語の世界 — Japanese Language in the World</SectionLabel>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Japanese-speaking regions</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {regions.map(({ name, pop, note }, i) => (
                <div key={name} className={`p-2.5 text-xs ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className={`font-bold ${V}`}>{name}</div>
                  <div className="text-muted-foreground">~{pop} speakers · {note}</div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <SectionLabel>Language family</SectionLabel>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div><strong>Japonic language family</strong> — no confirmed external relatives</div>
                <div>Writing: 3 scripts — ひらがな + カタカナ + 漢字 (+ Romaji)</div>
                <div>Native speakers: ~125 million (almost entirely in Japan)</div>
                <div>2nd language learners worldwide: ~4 million</div>
                <div>JLPT levels: N5 (beginner) → N1 (near-native)</div>
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>Regional dialects (方言 hōgen)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {dialects.map(({ name, region, note }, i) => (
                <div key={name} className={`p-2.5 text-xs ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className={`font-bold ${V}`}>{name}</div>
                  <div className="font-medium text-foreground text-[11px]">{region}</div>
                  <div className="text-muted-foreground">{note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>
          Japanese is classified as a "language isolate" within the Japonic family. The Ryukyuan languages (spoken in Okinawa) are related but distinct enough to be considered separate languages by many linguists.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 2. Japanese Holiday Calendar ─────────────────────────────────────────────
export function JapaneseHolidayCalendarCard() {
  const holidays = [
    { date: 'Jan 1', jp: '元日 (Ganjitsu)', en: 'New Year\'s Day', note: 'Most important Japanese holiday; family reunions, shrine visits (初詣)' },
    { date: 'Jan (2nd Mon)', jp: '成人の日 (Seijin no Hi)', en: 'Coming-of-Age Day', note: 'Ceremony for people turning 20 (now 18); women wear furisode kimono' },
    { date: 'Feb 11', jp: '建国記念の日', en: 'National Foundation Day', note: 'Commemorates the legendary founding of Japan by Emperor Jimmu' },
    { date: 'Mar 20/21', jp: '春分の日 (Shunbun no Hi)', en: 'Spring Equinox', note: 'Ancestor veneration; visit family graves (お墓参り ohakamari)' },
    { date: 'Apr 29', jp: '昭和の日 (Shōwa no Hi)', en: 'Showa Day', note: 'Begins Golden Week (ゴールデンウィーク) — Japan\'s busiest holiday period' },
    { date: 'May 3–5', jp: 'ゴールデンウィーク', en: 'Golden Week', note: 'Constitution Day (5/3), Greenery Day (5/4), Children\'s Day (5/5)' },
    { date: 'Jul (3rd Mon)', jp: '海の日 (Umi no Hi)', en: 'Marine Day', note: 'Celebrates the ocean and Japan\'s island geography' },
    { date: 'Aug 11', jp: '山の日 (Yama no Hi)', en: 'Mountain Day', note: 'Newest holiday (since 2016); celebrates mountains' },
    { date: 'Mid-Aug', jp: 'お盆 (O-Bon)', en: 'Bon Festival', note: 'Not a national holiday but widely observed; honors ancestors\' spirits; lanterns, dances' },
    { date: 'Sep (3rd Mon)', jp: '敬老の日 (Keirō no Hi)', en: 'Respect for the Aged Day', note: 'Honors elderly citizens; Japan has world\'s oldest population' },
    { date: 'Nov 3', jp: '文化の日 (Bunka no Hi)', en: 'Culture Day', note: 'Celebrates arts and culture; many museums free' },
    { date: 'Dec 31', jp: '大晦日 (Ōmisoka)', en: 'New Year\'s Eve', note: 'Temple bells ring 108 times (除夜の鐘); soba noodles eaten for longevity' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>日本の祝日・行事 — Japanese Holidays & Festivals</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden">
          {holidays.map(({ date, jp, en, note }, i) => (
            <div key={jp} className={`grid items-start text-xs ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '5rem 1fr' }}>
              <div className={`px-3 py-2 font-mono text-[10px] ${V} font-bold shrink-0`}>{date}</div>
              <div className="px-3 py-2">
                <div className="font-bold text-foreground">{jp} — {en}</div>
                <div className="text-muted-foreground">{note}</div>
              </div>
            </div>
          ))}
        </div>
        <NoteBox>
          Japan has 16 national holidays. The four major holiday clusters are: 正月 (New Year, Jan), ゴールデンウィーク (Golden Week, late Apr–early May), お盆 (Bon, mid-Aug), and 年末 (Year End, Dec). These cause heavy travel and tourism.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 3. Japanese Food Guide ───────────────────────────────────────────────────
export function JapaneseFoodGuideCard() {
  const categories = [
    {
      cat: '麺類 (Menrui) — Noodles',
      items: [
        { jp: 'ラーメン (rāmen)', en: 'wheat noodles in broth (shoyu/miso/tonkotsu/shio)', origin: 'nationwide' },
        { jp: 'うどん (udon)', en: 'thick wheat noodles; hot or cold', origin: 'Sanuki (Kagawa) famous' },
        { jp: 'そば (soba)', en: 'buckwheat noodles; eaten hot or cold', origin: 'Nagano, Tokyo' },
        { jp: 'そうめん (sōmen)', en: 'thin white wheat noodles; eaten cold in summer', origin: 'nationwide' },
      ],
    },
    {
      cat: '米料理 (Kome ryōri) — Rice Dishes',
      items: [
        { jp: '寿司 (sushi)', en: 'vinegared rice with toppings/fillings', origin: 'Tokyo (Edo-mae)' },
        { jp: 'おにぎり (onigiri)', en: 'rice ball with filling, often wrapped in nori', origin: 'nationwide' },
        { jp: '丼 (donburi)', en: 'rice bowl with toppings (牛丼 gyūdon, 天丼 tendon...)', origin: 'nationwide' },
        { jp: 'お粥 (okāyu)', en: 'rice porridge; eaten when sick or for breakfast', origin: 'nationwide' },
      ],
    },
    {
      cat: '主食・その他 (Main Dishes)',
      items: [
        { jp: 'てんぷら (tenpura)', en: 'battered and fried seafood/vegetables', origin: 'introduced by Portuguese' },
        { jp: 'とんかつ (tonkatsu)', en: 'breaded pork cutlet; served with cabbage', origin: 'Meiji era Western influence' },
        { jp: 'やきとり (yakitori)', en: 'grilled chicken skewers', origin: 'izakaya staple' },
        { jp: 'すき焼き (sukiyaki)', en: 'thin beef simmered in sweet soy sauce; dipped in raw egg', origin: 'Kansai / Kanto' },
        { jp: 'お好み焼き (okonomiyaki)', en: 'savory cabbage pancake with various fillings', origin: 'Osaka / Hiroshima' },
      ],
    },
    {
      cat: '菓子・デザート (Sweets)',
      items: [
        { jp: '和菓子 (wagashi)', en: 'traditional sweets: mochi, dorayaki, anmitsu', origin: 'various' },
        { jp: 'たこ焼き (takoyaki)', en: 'octopus balls (savory street food)', origin: 'Osaka' },
        { jp: 'メロンパン (meronpan)', en: 'melon-shaped sweet bread', origin: 'bakery staple' },
      ],
    },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>日本の食文化 — Japanese Food Culture</SectionLabel>
        <div className="space-y-4">
          {categories.map(({ cat, items }) => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              <div className="rounded-md border border-border overflow-hidden">
                {items.map(({ jp, en, origin }, i) => (
                  <div key={jp} className={`grid text-xs items-start ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '1.5fr 2.5fr 1.5fr' }}>
                    <div className={`px-3 py-2 font-bold ${V}`}>{jp}</div>
                    <div className="px-3 py-2 text-muted-foreground">{en}</div>
                    <div className="px-3 py-2 text-muted-foreground italic">{origin}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <NoteBox>
          Japanese cuisine (和食 washoku) was designated a UNESCO Intangible Cultural Heritage in 2013. Core principles: seasonal ingredients (旬 shun), umami (うまみ), presentation (盛り付け moritsuke), and balance of 5 colors/flavors.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 4. Japanese Regions ─────────────────────────────────────────────────────
export function JapaneseRegionsCard() {
  const regions = [
    { name: '北海道 (Hokkaidō)', capital: '札幌 (Sapporo)', pref: '1 prefecture', note: 'Northernmost main island; dairy, seafood, ski resorts, Ainu heritage' },
    { name: '東北 (Tōhoku)', capital: '仙台 (Sendai)', pref: '6 prefs', note: 'Mountainous northern Honshu; rice, sake, onsen; impacted by 2011 earthquake' },
    { name: '関東 (Kantō)', capital: '東京 (Tōkyō)', pref: '7 prefs', note: 'Most populous; Tokyo metropolitan area; economic and cultural center of Japan' },
    { name: '中部 (Chūbu)', capital: '名古屋 (Nagoya)', pref: '9 prefs', note: 'Central Honshu; includes Japanese Alps, Mt. Fuji, manufacturing (Toyota)' },
    { name: '関西 (Kansai)', capital: '大阪 (Osaka)', pref: '7 prefs', note: 'Historic heartland; Kyoto (old capital), Osaka (food/commerce), Nara (deer/temples)' },
    { name: '中国 (Chūgoku)', capital: '広島 (Hiroshima)', pref: '5 prefs', note: 'Western Honshu; Hiroshima Peace Memorial, Miyajima island torii gate' },
    { name: '四国 (Shikoku)', capital: '高松 (Takamatsu)', pref: '4 prefs', note: 'Smallest main island; 88-temple pilgrimage, udon (Kagawa), yuzu (Kochi)' },
    { name: '九州 (Kyūshū)', capital: '福岡 (Fukuoka)', pref: '8 prefs', note: 'Southernmost main island; ramen (tonkotsu), onsen (Beppu), subtropical south' },
    { name: '沖縄 (Okinawa)', capital: '那覇 (Naha)', pref: '1 prefecture', note: 'Ryukyu Islands; subtropical; unique culture, cuisine, and Ryukyuan language' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>日本の地方 — Regions of Japan</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3">Japan consists of 47 prefectures (都道府県, todōfuken) grouped into 8–9 regions. Japan has 4 main islands: 本州 Honshū, 北海道 Hokkaidō, 九州 Kyūshū, and 四国 Shikoku.</p>
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground" style={{ gridTemplateColumns: '1.5fr 1fr 0.7fr 2.5fr' }}>
            <div className="px-3 py-1.5">Region</div>
            <div className="px-3 py-1.5">Major City</div>
            <div className="px-3 py-1.5">Prefs</div>
            <div className="px-3 py-1.5">Key Features</div>
          </div>
          {regions.map(({ name, capital, pref, note }, i) => (
            <div key={name} className={`grid items-start text-xs ${i > 0 ? 'border-t border-border/60' : ''}`} style={{ gridTemplateColumns: '1.5fr 1fr 0.7fr 2.5fr' }}>
              <div className={`px-3 py-2 font-bold ${V}`}>{name}</div>
              <div className="px-3 py-2 font-medium">{capital}</div>
              <div className="px-3 py-2 text-muted-foreground">{pref}</div>
              <div className="px-3 py-2 text-muted-foreground">{note}</div>
            </div>
          ))}
        </div>
        <NoteBox>
          Tokyo (東京都) is the world's most populous metropolitan area with ~37 million people. Japan has 23 UNESCO World Heritage sites. The Shinkansen (新幹線) bullet train network connects major cities at up to 320 km/h.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── 5. Japanese Etiquette ────────────────────────────────────────────────────
export function JapaneseEtiquetteCard() {
  const etiquette = [
    { cat: 'Greetings & Bowing', items: [
      { tip: 'Bow instead of handshake', detail: '会釈 eshaku (15°) for casual; 敬礼 keirei (30°) for formal; 最敬礼 saikeirei (45°) for deep respect. Deeper bow = more respect.' },
      { tip: 'Common greetings', detail: 'おはようございます (ohayō gozaimasu) morning, こんにちは (konnichiwa) daytime, こんばんは (konbanwa) evening, おやすみなさい (oyasumi nasai) goodnight' },
      { tip: 'いただきます / ごちそうさま', detail: 'Say before/after eating. いただきます (itadakimasu) = "I humbly receive"; ごちそうさまでした (gochisōsama deshita) = thanks for the meal' },
    ]},
    { cat: 'Homes & Shoes', items: [
      { tip: 'Remove shoes indoors', detail: 'Always remove shoes at the genkan (玄関, entrance hall). Wear the slippers provided. Separate toilet slippers are often provided for the bathroom.' },
      { tip: 'Gifts (お土産 omiyage)', detail: 'Bring regional food gifts when visiting or returning from travel. Gifts are often not opened immediately in front of the giver. Refuse gifts once or twice before accepting.' },
    ]},
    { cat: 'Dining', items: [
      { tip: 'Chopstick rules', detail: 'Never stick chopsticks upright in rice (funeral ritual). Never pass food chopstick-to-chopstick. Don\'t point with chopsticks. Use the opposite end to take shared food.' },
      { tip: 'Slurping noodles is OK', detail: 'Slurping ramen and soba is acceptable and even complimentary — it enhances flavor and shows enjoyment.' },
      { tip: 'Tipping is not done', detail: 'Tipping is not customary and can be considered rude. Good service is expected as standard professionalism (おもてなし omotenashi).' },
    ]},
    { cat: 'Public Behavior', items: [
      { tip: 'Quiet on public transit', detail: 'Talking loudly on trains/buses is frowned upon. Set phone to manner mode (マナーモード). Priority seats (優先席 yūsen-seki) for elderly/pregnant.' },
      { tip: 'Queuing culture', detail: 'Japan has strict queuing etiquette. Lines form at marked spots on train platforms. Cutting in line is very rude.' },
      { tip: 'Garbage & recycling', detail: 'Public trash cans are rare. Most people carry trash home. Japan has detailed recycling rules (燃えるゴミ, プラ, ビン/缶...).' },
    ]},
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>日本のマナー — Japanese Etiquette & Social Customs</SectionLabel>
        <div className="space-y-4">
          {etiquette.map(({ cat, items }) => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              <div className="rounded-md border border-border overflow-hidden">
                {items.map(({ tip, detail }, i) => (
                  <div key={tip} className={`p-2.5 text-xs ${i > 0 ? 'border-t border-border/60' : ''}`}>
                    <div className={`font-bold ${V} mb-0.5`}>{tip}</div>
                    <div className="text-muted-foreground">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 6. Japanese Currency ─────────────────────────────────────────────────────
export function JapaneseCurrencyCard() {
  const coins = [
    { val: '¥1', mat: 'Aluminum', face: 'Plant (木), "1円"', note: 'Lightest coin; 1g' },
    { val: '¥5', mat: 'Brass (hole)', face: 'Rice plant, gear, water', note: 'Hole = good luck; go-en (縁) sounds like "connection/fate"' },
    { val: '¥10', mat: 'Bronze', face: '平等院 Byōdōin temple, Uji', note: 'Most used coin; 4.5g' },
    { val: '¥50', mat: 'Nickel (hole)', face: 'Chrysanthemum', note: 'Hole distinguishes from ¥100' },
    { val: '¥100', mat: 'Nickel', face: 'Cherry blossom', note: 'Most common for vending machines' },
    { val: '¥500', mat: 'Bimetal', face: 'Paulownia', note: 'Highest-value coin; bi-color clad (new 2021 design)' },
  ];
  const bills = [
    { val: '¥1,000', face: '北里柴三郎 Kitasato Shibasaburō', back: 'Mt. Fuji & cherry blossoms (new 2024)', note: 'Bacteriologist; discovered tetanus cure' },
    { val: '¥5,000', face: '津田梅子 Umeko Tsuda', back: 'Wisteria flowers (new 2024)', note: 'Pioneer of women\'s education in Japan' },
    { val: '¥10,000', face: '渋沢栄一 Shibusawa Eiichi', back: 'Tokyo Station (new 2024)', note: 'Father of Japanese capitalism' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>日本円 — Japanese Yen (¥ / 円)</SectionLabel>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>硬貨 — Coins</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {coins.map(({ val, mat, face, note }, i) => (
                <div key={val} className={`p-2.5 text-xs ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-bold text-sm ${V}`}>{val}</span>
                    <span className="text-muted-foreground">{mat}</span>
                  </div>
                  <div className="text-muted-foreground">{face}</div>
                  <div className="text-muted-foreground italic">{note}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <SectionLabel>紙幣 — Banknotes (redesigned 2024)</SectionLabel>
              <div className="rounded-md border border-border overflow-hidden">
                {bills.map(({ val, face, back, note }, i) => (
                  <div key={val} className={`p-2.5 text-xs ${i > 0 ? 'border-t border-border/60' : ''}`}>
                    <div className="flex items-baseline gap-2">
                      <span className={`font-bold text-sm ${V}`}>{val}</span>
                    </div>
                    <div className="font-medium">{face}</div>
                    <div className="text-muted-foreground">Back: {back}</div>
                    <div className="text-muted-foreground italic">{note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>Useful payment phrases</SectionLabel>
              <div className="space-y-0.5 text-xs">
                {[
                  { jp: 'いくらですか？', rom: 'Ikura desu ka?', en: 'How much is it?' },
                  { jp: 'お会計をお願いします', rom: 'O-kaikei wo onegaishimasu', en: 'Check, please' },
                  { jp: 'カードで払えますか？', rom: 'Kādo de haraemasu ka?', en: 'Can I pay by card?' },
                  { jp: '現金のみです', rom: 'Genkin nomi desu', en: 'Cash only' },
                  { jp: 'おつりをください', rom: 'Otsuri wo kudasai', en: 'Change, please' },
                ].map(({ jp, rom, en }) => (
                  <div key={jp} className="flex gap-1 flex-wrap">
                    <span className={`font-bold ${V}`}>{jp}</span>
                    <span className="italic text-muted-foreground">({rom})</span>
                    <span className="text-muted-foreground">— {en}</span>
                  </div>
                ))}
              </div>
            </div>
            <NoteBox>
              Japan is still largely cash-based (現金社会 genkin-shakai), though IC card payments (Suica, Pasmo) and QR code payments (PayPay, LINE Pay) are increasingly common. Many smaller restaurants are 現金のみ (cash only).
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 7. Japanese Pop Culture ──────────────────────────────────────────────────
export function JapanesePopCultureCard() {
  const domains = [
    {
      cat: 'アニメ (Anime)',
      items: [
        { name: '進撃の巨人 / Shingeki no Kyojin', en: 'Attack on Titan — globally influential dark fantasy' },
        { name: '鬼滅の刃 / Kimetsu no Yaiba', en: 'Demon Slayer — highest-grossing anime film of all time' },
        { name: 'ドラゴンボール / Dragon Ball', en: 'Pioneering shōnen series; massive global impact since 1980s' },
        { name: 'スタジオジブリ / Studio Ghibli', en: 'Miyazaki\'s acclaimed films: Spirited Away, My Neighbor Totoro' },
      ],
    },
    {
      cat: 'マンガ (Manga)',
      items: [
        { name: '少年マンガ (Shōnen manga)', en: 'For boys: action, adventure — One Piece, Naruto, Bleach' },
        { name: '少女マンガ (Shōjo manga)', en: 'For girls: romance, emotion — Fruits Basket, Sailor Moon' },
        { name: '青年マンガ (Seinen manga)', en: 'For young adult men — more complex themes' },
        { name: 'Weekly Shōnen Jump', en: 'Most popular manga magazine; launched Naruto, One Piece, Dragon Ball' },
      ],
    },
    {
      cat: '音楽 (Music)',
      items: [
        { name: 'J-POP', en: 'Japanese pop: YOASOBi, Aimyon, Official髭男dism, back number' },
        { name: 'アイドル (Idol groups)', en: 'AKB48, Nogizaka46, Johnny\'s groups; synchronized performances' },
        { name: 'Visual Kei', en: 'Rock genre with dramatic costumes; X Japan, L\'Arc-en-Ciel' },
        { name: 'カラオケ (Karaoke)', en: 'Originated in Japan; カラオケボックス (private rooms) nationwide' },
      ],
    },
    {
      cat: 'ゲーム (Games) & サブカル',
      items: [
        { name: '任天堂 / Nintendo', en: 'Mario, Zelda, Pokémon — most recognized game brand globally' },
        { name: 'コスプレ (Cosplay)', en: 'Costume play; originated in Japan; global fan convention culture' },
        { name: '秋葉原 (Akihabara)', en: 'Tokyo district; electronics, anime, manga, idol culture hub' },
        { name: 'ゆるキャラ (Yuru-chara)', en: 'Regional mascot characters; every prefecture/city has one' },
      ],
    },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>日本のポップカルチャー — Japanese Pop Culture</SectionLabel>
        <div className="grid md:grid-cols-2 gap-4">
          {domains.map(({ cat, items }) => (
            <div key={cat}>
              <SectionLabel>{cat}</SectionLabel>
              <div className="rounded-md border border-border overflow-hidden">
                {items.map(({ name, en }, i) => (
                  <div key={name} className={`p-2.5 text-xs ${i > 0 ? 'border-t border-border/60' : ''}`}>
                    <div className={`font-bold ${V}`}>{name}</div>
                    <div className="text-muted-foreground">{en}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <NoteBox>
          Japan's "Cool Japan" (クールジャパン) soft power strategy exports anime, manga, gaming, and fashion globally. Japanese media coined many loanwords now used internationally: manga, anime, karaoke, emoji (絵文字), kawaii (かわいい), otaku (オタク), and sushi.
        </NoteBox>
      </CardContent>
    </Card>
  );
}
