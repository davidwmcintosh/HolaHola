import { Card, CardContent } from "@/components/ui/card";

const KO = "text-sky-700 dark:text-sky-400";
const KO_BG = "bg-sky-500/10";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-wider ${KO} mb-2`}>{children}</p>;
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-md ${KO_BG} border border-sky-300/30 dark:border-sky-700/40 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

// ── World Map ──────────────────────────────────────────────────────────────────

export function KoreanophoneWorldCard() {
  const regions = [
    { region: 'Republic of Korea (한국)', speakers: '~52 million', note: 'Official: 한국어 (Hangugeo). Capital: Seoul (서울).' },
    { region: 'North Korea (조선)', speakers: '~26 million', note: 'Official: 조선어 (Joseoneo). Capital: Pyongyang (평양).' },
    { region: 'Korean diaspora in China', speakers: '~2 million', note: 'Mainly in Yanbian Korean Autonomous Prefecture (연변).' },
    { region: 'Korean-Americans (USA)', speakers: '~1.8 million', note: 'Largest diaspora outside Asia — concentrated in LA, NYC.' },
    { region: 'Korean-Japanese (在日)', speakers: '~500,000', note: 'Called Zainichi Koreans. Long-established community in Japan.' },
    { region: 'Goryeo-saram (Central Asia)', speakers: '~500,000', note: 'Descendants of Koreans deported to Kazakhstan/Uzbekistan by Stalin.' },
    { region: 'Australia, Canada, EU', speakers: '~300,000+', note: 'Growing communities driven by K-Wave cultural migration.' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>한국어의 세계 — The Korean-Speaking World</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean (한국어/조선어) is spoken by approximately <strong>80 million people</strong> worldwide — concentrated on the Korean Peninsula but with significant diaspora communities across Asia, the Americas, and beyond.</p>
        <div className="space-y-2">
          {regions.map(({ region, speakers, note }) => (
            <div key={region} className="rounded-md border border-border/60 px-3 py-2">
              <div className="flex justify-between items-start gap-2">
                <span className={`font-semibold text-sm ${KO}`}>{region}</span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">{speakers}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>One language, two names:</strong> South Korea calls the language 한국어 (Hangugeo) and the script 한글 (Hangeul). North Korea calls it 조선어 (Joseoneo) and the script 조선글 (Joseongeul). The languages are mutually intelligible with some vocabulary and pronunciation differences.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Holiday Calendar ───────────────────────────────────────────────────────────

export function KoreanHolidayCalendarCard() {
  const holidays = [
    { date: 'Jan 1', name: '신정 — New Year\'s Day', note: 'Solar calendar New Year.' },
    { date: 'Lunar Jan 1', name: '설날 — Lunar New Year', note: 'Most important holiday. 3-day break. Sebae (세배) bowing to elders + tteokguk soup.' },
    { date: 'Mar 1', name: '삼일절 — Independence Movement Day', note: 'Commemorates 1919 independence declaration against Japanese colonial rule.' },
    { date: 'Lunar Apr 8', name: '부처님 오신 날 — Buddha\'s Birthday', note: 'Lantern festivals across the country. Lotus lanterns hung in temples.' },
    { date: 'May 5', name: '어린이날 — Children\'s Day', note: 'Family holiday. Children receive gifts and parents take kids to amusement parks.' },
    { date: 'Jun 6', name: '현충일 — Memorial Day', note: 'Honors war veterans and fallen soldiers. Sirens at 10am.' },
    { date: 'Aug 15', name: '광복절 — Liberation Day', note: 'Celebrates liberation from Japanese colonial rule (1945).' },
    { date: 'Lunar Aug 15', name: '추석 — Chuseok (Korean Thanksgiving)', note: 'Harvest festival. 3-day break. Families visit ancestral graves, eat songpyeon rice cakes.' },
    { date: 'Oct 3', name: '개천절 — National Foundation Day', note: 'Celebrates the founding of the first Korean kingdom (Gojoseon, 2333 BC).' },
    { date: 'Oct 9', name: '한글날 — Hangul Day', note: 'Celebrates creation of the Korean alphabet by King Sejong (1446).' },
    { date: 'Dec 25', name: '성탄절 — Christmas Day', note: 'Public holiday. Both Christian and secular celebrations.' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>한국의 공휴일 — Korean Public Holidays</SectionLabel>
        <div className="space-y-1.5">
          {holidays.map(({ date, name, note }) => (
            <div key={name} className="rounded-md border border-border/60 px-3 py-2">
              <div className="flex justify-between items-start gap-2">
                <span className={`font-semibold text-sm ${KO}`}>{name}</span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">{date}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
            </div>
          ))}
        </div>
        <NoteBox>설날 (Lunar New Year) and 추석 (Chuseok) are the two biggest family holidays — Korea's equivalent of Thanksgiving + Christmas combined. Expect massive travel and most businesses closed for 3+ days.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Food Guide ────────────────────────────────────────────────────────────────

export function KoreanFoodGuideCard() {
  const dishes = [
    { name: '김치 (Kimchi)', desc: 'Fermented spicy cabbage — Korea\'s most iconic dish. Eaten with every meal.' },
    { name: '비빔밥 (Bibimbap)', desc: 'Mixed rice bowl with vegetables, meat, egg, and gochujang sauce.' },
    { name: '삼겹살 (Samgyeopsal)', desc: 'Grilled pork belly, eaten with lettuce wraps, garlic, and ssamjang paste.' },
    { name: '불고기 (Bulgogi)', desc: 'Marinated, thinly sliced grilled beef — sweet and savory.' },
    { name: '냉면 (Naengmyeon)', desc: 'Cold buckwheat noodles — 물냉면 (in broth) or 비빔냉면 (spicy mixed).' },
    { name: '삼계탕 (Samgyetang)', desc: 'Ginseng chicken soup — eaten on the hottest summer days for energy.' },
    { name: '떡볶이 (Tteokbokki)', desc: 'Spicy stir-fried rice cakes — the most popular Korean street food.' },
    { name: '순두부찌개 (Sundubu Jjigae)', desc: 'Soft tofu stew, often with seafood or pork and egg.' },
    { name: '파전 (Pajeon)', desc: 'Savory scallion pancake, often with seafood. Eaten on rainy days.' },
    { name: '치맥 (Chimaek)', desc: 'Fried chicken + maekju (beer) — Korea\'s beloved after-work combo.' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>한식 — Korean Cuisine</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean cuisine emphasizes balance of flavors, fermented foods, and communal dining. A typical meal features rice, soup, and multiple side dishes (반찬 banchan) shared at the table.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {dishes.map(({ name, desc }) => (
            <div key={name} className="rounded-md border border-border/60 px-3 py-2">
              <p className={`font-semibold text-sm ${KO}`}>{name}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Dining culture:</strong> The eldest person sits first and eats first. Use both hands when receiving food or drink. It's polite to refill others' glasses before your own. Never stick chopsticks upright in rice (funeral connotation).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Regional Dialects ──────────────────────────────────────────────────────────

export function KoreanDialectCard() {
  const dialects = [
    { name: '서울말 / 표준어', region: 'Seoul & Gyeonggi', note: 'The standard language (표준어). Used in education, media, and formal settings.' },
    { name: '경상도 사투리', region: 'Gyeongsang (Busan, Daegu)', note: 'Distinctive rising-falling pitch accent. Direct and fast-paced. 뭐하노? (What are you doing?)' },
    { name: '전라도 사투리', region: 'Jeolla (Gwangju, Jeonju)', note: 'Known for emotional expressiveness and unique endings. 거시기 (thingamajig) is a famous filler word.' },
    { name: '제주도 방언', region: 'Jeju Island', note: 'So distinct from standard Korean it\'s sometimes classified as a separate language. UNESCO lists it as critically endangered.' },
    { name: '충청도 사투리', region: 'Chungcheong (Daejeon)', note: 'Known for being slow and gentle. Often perceived as unhurried and polite.' },
    { name: '조선어', region: 'North Korea', note: 'Official language of North Korea. Fewer English loanwords; uses native Korean or Russian-influenced vocabulary instead.' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>사투리 — Korean Regional Dialects</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">While standard Korean (표준어) is widely understood, regional dialects (사투리) are alive and distinctive. Koreans often identify someone's hometown by their speech.</p>
        <div className="space-y-2">
          {dialects.map(({ name, region, note }) => (
            <div key={name} className="rounded-md border border-border/60 px-3 py-2">
              <div className="flex justify-between items-start gap-2">
                <span className={`font-semibold text-sm ${KO}`}>{name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{region}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
            </div>
          ))}
        </div>
        <NoteBox>Korean dramas and K-pop have spread Seoul-standard Korean globally, but regional dialects are celebrated as markers of cultural identity. Many Koreans switch between standard and dialect depending on context.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Etiquette ─────────────────────────────────────────────────────────────────

export function KoreanEtiquetteCard() {
  const rules = [
    { title: '절 — Bowing', desc: 'Bowing (절) is the primary greeting. A 15° nod for casual greetings, 30° bow for respect, 45° for deep apology or reverence.' },
    { title: '나이 — Age-Based Hierarchy', desc: 'Age determines speech level. You must establish relative ages before settling into casual speech. 형/오빠 (older brother), 언니/누나 (older sister) are used even with non-family.' },
    { title: '밥 먹었어요? — "Have you eaten?"', desc: 'A common greeting that expresses care — not a literal question about food status.' },
    { title: '두 손 — Two Hands', desc: 'Give and receive objects, business cards, and drinks with two hands (or right hand supported by left) as a sign of respect.' },
    { title: '신발 — Remove Shoes', desc: 'Always remove shoes when entering a Korean home. Slippers may be provided.' },
    { title: '빨리빨리 — Ppalli Ppalli Culture', desc: '"Hurry hurry" — Korea\'s famous culture of speed and efficiency. Service is fast, patience is low, and things happen quickly.' },
    { title: '눈치 — Reading the Room', desc: 'Nunchi: the subtle Korean social art of reading situations and people without being told. High nunchi = socially intelligent.' },
    { title: '체면 — Face / Dignity', desc: 'Chemyeon (체면): maintaining face/dignity in public. Avoiding embarrassment (both your own and others\') is a key social value.' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>예절 — Korean Etiquette & Social Customs</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {rules.map(({ title, desc }) => (
            <div key={title} className="rounded-md border border-border/60 px-3 py-2">
              <p className={`font-semibold text-sm ${KO}`}>{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <NoteBox>When dining, the eldest or most senior person starts eating first. It's polite to pour drinks for others before yourself. Refusals are often made once before accepting — insisting is expected and polite.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Currency ───────────────────────────────────────────────────────────────────

export function KoreanCurrencyCard() {
  const bills = [
    ['₩1,000', '천 원 (cheon won)', 'Yi I (이이) — Joseon Confucian scholar'],
    ['₩5,000', '오천 원 (ocheon won)', 'Yi Hwang (이황) — Scholar, Confucian philosopher'],
    ['₩10,000', '만 원 (man won)', 'King Sejong (세종대왕) — Creator of Hangul'],
    ['₩50,000', '오만 원 (oman won)', 'Shin Saimdang (신사임당) — Artist, Yi I\'s mother; first woman on Korean bill'],
  ];
  const coins = [
    ['₩10', '십 원 (sip won)', 'Dabotap Pagoda — Gyeongju'],
    ['₩50', '오십 원 (osip won)', 'Rice stalks'],
    ['₩100', '백 원 (baek won)', 'Yi Sunsin (이순신) — Admiral, national hero'],
    ['₩500', '오백 원 (obaek won)', 'Manchurian crane (두루미)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>한국 원 — Korean Won (₩ / KRW)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">The South Korean won (원) is the official currency. Note: prices in Korea often look large — ₩10,000 ≈ US$7–8. North Korea uses the North Korean won (조선 원), not interchangeable.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>지폐 — Banknotes</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Amount</span><span>Portrait / Image</span>
              </div>
              {bills.map(([amt, kor, img], i) => (
                <div key={amt} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <div className="flex justify-between">
                    <span className={`font-bold ${KO}`}>{amt}</span>
                    <span className="text-muted-foreground text-xs">{kor}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{img}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>동전 — Coins</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Amount</span><span>Design</span>
              </div>
              {coins.map(([amt, kor, img], i) => (
                <div key={amt} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <div className="flex justify-between">
                    <span className={`font-bold ${KO}`}>{amt}</span>
                    <span className="text-muted-foreground text-xs">{kor}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{img}</p>
                </div>
              ))}
            </div>
            <NoteBox>Useful phrases: 얼마예요? (How much?) · 너무 비싸요 (Too expensive) · 깎아 주세요 (Please give a discount) · 카드 돼요? (Can I pay by card?)</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── K-Wave / Pop Culture ───────────────────────────────────────────────────────

export function KoreanPopCultureCard() {
  const waves = [
    { name: 'K-Pop (케이팝)', desc: 'Global music phenomenon with idol groups (아이돌), synchronized choreography, and fan culture (팬덤). BTS, BLACKPINK, EXO, aespa.' },
    { name: 'K-Drama (한국 드라마)', desc: 'Korean TV dramas export globally via Netflix. Romantic, thriller, and historical (사극) genres dominate. Crash Landing on You, Squid Game, Goblin.' },
    { name: 'K-Movie (한국 영화)', desc: 'World-class cinema. Parasite (기생충) won Oscar Best Picture 2020 — first non-English film. Director Bong Joon-ho.' },
    { name: 'K-Beauty (케이뷰티)', desc: 'Korean skincare and cosmetics — 10-step routines, BB cream, sheet masks, glass skin. Influences global beauty trends.' },
    { name: 'K-Food (한식)', desc: 'Kimchi, Korean fried chicken, and tteokbokki have gone global. Korean BBQ restaurants are popular worldwide.' },
    { name: 'Korean Webtoons (웹툰)', desc: 'Vertical-scroll digital comics pioneered in Korea. Many adapted into dramas and films. Platform: Naver Webtoon.' },
    { name: 'E-Sports (이스포츠)', desc: 'Korea is the birthplace of professional gaming culture. StarCraft, League of Legends. PC bangs (PC방) are ubiquitous.' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>한류 — Hallyu: The Korean Wave</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">한류 (Hallyu, "Korean Wave") refers to the global spread of Korean culture since the late 1990s. It's a major driver of Korean language learning worldwide.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {waves.map(({ name, desc }) => (
            <div key={name} className="rounded-md border border-border/60 px-3 py-2">
              <p className={`font-semibold text-sm ${KO}`}>{name}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Korean pop culture vocabulary:</strong> 덕후 (Deokhu) = fan/otaku · 최애 (Choiae) = favorite (idol) · 사인회 (Sainhoe) = fan signing event · 굿즈 (Gudeu) = merchandise (from English "goods") · 도전 (Dojeon) = challenge (viral trend).
        </NoteBox>
      </CardContent>
    </Card>
  );
}
