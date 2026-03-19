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

// ── Mandarin-Speaking World Map ────────────────────────────────────────────────

export function MandarinophoneWorldCard() {
  const regions: [string, string, string][] = [
    ['中国大陆 Zhōngguó Dàlù', 'Mainland China', '~1.4 billion — official language: Pǔtōnghuà (普通话)'],
    ['台湾 Táiwān', 'Taiwan', '~23 million — Mandarin + Taiwanese (Minnan)'],
    ['新加坡 Xīnjiāpō', 'Singapore', '~3.5 million Chinese speakers — one of 4 official languages'],
    ['马来西亚 Mǎláixīyà', 'Malaysia', '~6 million Chinese speakers — Chinese school system intact'],
    ['香港 Xiānggǎng', 'Hong Kong', '~7.5 million — Cantonese dominant, Mandarin increasing'],
    ['澳门 Àomén', 'Macau', '~680,000 — Cantonese + Mandarin + Portuguese'],
    ['印度尼西亚 Yìndùníxīyà', 'Indonesia', '~8 million ethnic Chinese — Mandarin revival underway'],
    ['泰国 Tàiguó', 'Thailand', '~7 million Chinese-heritage speakers'],
    ['美国 Měiguó', 'USA', '~5 million Mandarin/Chinese speakers (diaspora)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>普通话的世界 — The Mandarin-Speaking World</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Mandarin (普通话 Pǔtōnghuà) is the world's most spoken language by native speakers — ~920 million L1 speakers, ~1.5 billion total. It is the official language of mainland China, Taiwan (where it is called 國語 Guóyǔ), and a co-official language of Singapore.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Region</span><span>Country</span><span>Notes</span>
          </div>
          {regions.map(([zh, en, notes], i) => (
            <div key={zh} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold text-xs">{zh}</span>
              <span className="text-muted-foreground">{en}</span>
              <span className="text-muted-foreground text-xs">{notes}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Dialect vs. Mandarin:</strong> 普通话 is the standard — based on Beijing pronunciation. But China has 7+ major dialect groups (Cantonese 粤语, Shanghainese 吴语, Hokkien 闽南语…) that are mutually unintelligible with Mandarin. Mandarin is the lingua franca uniting all of them.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Chinese Holiday Calendar ───────────────────────────────────────────────────

export function ChineseHolidayCalendarCard() {
  const holidays: [string, string, string, string][] = [
    ['春节 Chūnjié', 'Chinese New Year (Spring Festival)', 'Jan/Feb (Lunar New Year\'s Day)', 'Most important holiday — family reunion, 红包 red envelopes, fireworks, 7-day national holiday'],
    ['元宵节 Yuánxiāojié', 'Lantern Festival', '15th day of 1st lunar month', 'Marks end of Spring Festival — lanterns, 汤圆 (glutinous rice balls), lion dance'],
    ['清明节 Qīngmíngjié', 'Tomb-Sweeping Day', 'April 4–6', 'Ancestor veneration — clean graves, burn paper offerings, eat 青团 (green rice cakes)'],
    ['劳动节 Láodòngjié', 'Labor Day', 'May 1', '3-day holiday — golden week travel, major retail sales'],
    ['端午节 Duānwǔjié', 'Dragon Boat Festival', '5th day of 5th lunar month', '粽子 (rice dumplings), dragon boat racing — honors poet 屈原 (Qū Yuán)'],
    ['七夕 Qīxī', 'Chinese Valentine\'s Day', '7th day of 7th lunar month', 'Cowherd and Weaver Girl legend — romantic gift-giving'],
    ['中秋节 Zhōngqiūjié', 'Mid-Autumn / Moon Festival', '15th day of 8th lunar month', '月饼 (mooncakes), family reunion, lanterns — one of the biggest festivals'],
    ['国庆节 Guóqìngjié', 'National Day', 'October 1', 'PRC founding 1949 — 7-day Golden Week, patriotic celebrations, major travel period'],
    ['冬至 Dōngzhì', 'Winter Solstice', 'December 21–23', 'Family gathering — 饺子 dumplings in north, 汤圆 in south'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>中国节假日 — Chinese Holidays & Festivals</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Name</span><span>English</span><span>Date</span><span>Traditions</span>
          </div>
          {holidays.map(([name, en, date, notes], i) => (
            <div key={name} className={`grid grid-cols-4 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold text-xs">{name}</span>
              <span className="text-muted-foreground text-xs">{en}</span>
              <span className="text-muted-foreground text-xs">{date}</span>
              <span className="text-muted-foreground text-xs">{notes}</span>
            </div>
          ))}
        </div>
        <NoteBox>China uses both the <strong>lunar calendar (农历)</strong> and the Gregorian calendar. Many major holidays follow the lunar calendar, so their Gregorian dates shift each year. The "Golden Weeks" (黄金周) in May and October are the biggest travel periods.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Chinese Food Guide ─────────────────────────────────────────────────────────

export function ChineseFoodGuideCard() {
  const dishes: [string, string, string, string][] = [
    ['北京烤鸭 Běijīng Kǎoyā', 'Peking Duck', 'Beijing', 'Crispy skin roasted duck — served with pancakes, hoisin sauce, scallions'],
    ['火锅 Huǒguō', 'Hot Pot', 'Sichuan / Chongqing', 'Communal simmering broth — 麻辣 (spicy/numbing) or 清汤 (clear soup)'],
    ['饺子 Jiǎozi', 'Dumplings', 'Northern China', 'Boiled/fried/steamed dumplings — especially at New Year; 猪肉白菜 (pork & cabbage) classic'],
    ['小笼包 Xiǎolóngbāo', 'Soup Dumplings', 'Shanghai', 'Steamed pork buns with soup inside — eat carefully with spoon!'],
    ['兰州拉面 Lánzhōu Lāmiàn', 'Lanzhou Beef Noodles', 'Gansu Province', '一清二白三红四绿五黄 — one of China\'s most ubiquitous dishes'],
    ['麻婆豆腐 Mápó Dòufu', 'Mapo Tofu', 'Sichuan', 'Silken tofu in spicy fermented black bean & chili oil sauce with minced pork'],
    ['宫保鸡丁 Gōngbǎo Jīdīng', 'Kung Pao Chicken', 'Sichuan', 'Diced chicken, dried chilies, peanuts — a global Chinese classic'],
    ['dim sum 点心 Diǎnxīn', 'Dim Sum', 'Guangdong (Cantonese)', 'Brunch-style small plates — 虾饺, 叉烧包, 肠粉 — served with tea'],
    ['炒饭 Chǎofàn', 'Fried Rice', 'Nationwide', 'Leftover rice stir-fried with egg, vegetables, soy sauce — countless regional versions'],
    ['臭豆腐 Chòu Dòufu', 'Stinky Tofu', 'Taiwan / Changsha', 'Fermented tofu with powerful smell — street food staple, surprisingly delicious'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>中国美食 — Chinese Cuisine Guide</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Dish</span><span>English</span><span>Region</span><span>Notes</span>
          </div>
          {dishes.map(([zh, en, region, notes], i) => (
            <div key={zh} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold text-xs">{zh}</span>
              <span className="text-muted-foreground text-xs">{en}</span>
              <span className="text-muted-foreground text-xs">{region}</span>
              <span className="text-muted-foreground text-xs">{notes}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          China's 8 Great Cuisines (八大菜系): 川菜 Sichuan (spicy), 粤菜 Cantonese (fresh), 苏菜 Jiangsu (sweet), 浙菜 Zhejiang (delicate), 闽菜 Fujian (seafood), 湘菜 Hunan (spicy-sour), 徽菜 Anhui (preserved), 鲁菜 Shandong (salty-savory).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Chinese Dialects ───────────────────────────────────────────────────────────

export function ChineseDialectCard() {
  const dialects: [string, string, string, string][] = [
    ['普通话 Pǔtōnghuà', 'Mandarin (Standard)', '~920M L1', 'Beijing-based standard — official in PRC, Taiwan (國語), Singapore'],
    ['粤语 Yuèyǔ', 'Cantonese', '~80M', '9 tones — Hong Kong, Guangdong, diaspora — written 書面語 differs from spoken'],
    ['闽南语 Mǐnnányǔ', 'Hokkien/Minnan/Taiwanese', '~50M', 'Taiwan, Fujian, Southeast Asia — 8 tones, very different vocabulary'],
    ['吴语 Wúyǔ', 'Wu (Shanghainese)', '~80M', 'Shanghai & surroundings — "softer" sound, entering tones retained'],
    ['客家话 Kèjiāhuà', 'Hakka', '~40M', 'Mountain communities across south China, Taiwan, SE Asia'],
    ['闽东语 Mǐndōngyǔ', 'Min Dong (Fuzhounese)', '~10M', 'Fuzhou, Fujian coast — distinct from Hokkien'],
    ['赣语 Gànyǔ', 'Gan', '~50M', 'Jiangxi province — transitional between Mandarin and southern dialects'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>汉语方言 — Chinese Dialect Groups</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">China's regional "dialects" (方言 fāngyán) are linguistically distinct enough to be separate languages — mutually unintelligible, sharing only written characters.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Name</span><span>English</span><span>Speakers</span><span>Region & Notes</span>
          </div>
          {dialects.map(([zh, en, sp, notes], i) => (
            <div key={zh} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold text-xs">{zh}</span>
              <span className="text-muted-foreground text-xs">{en}</span>
              <span className="text-muted-foreground text-xs">{sp}</span>
              <span className="text-muted-foreground text-xs">{notes}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Simplified vs. Traditional:</strong> Mainland China uses 简体字 (Jiǎntǐzì — simplified), while Taiwan and Hong Kong use 繁體字 (Fántǐzì — traditional). Core vocabulary is shared; character forms differ. A reader of one can usually decipher the other with practice.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Chinese Etiquette ─────────────────────────────────────────────────────────

export function ChineseEtiquetteCard() {
  const etiquette: [string, string][] = [
    ['面子 Miànzi — Face', 'Preserving social dignity — never embarrass someone publicly, phrase criticism carefully'],
    ['关系 Guānxi — Relationships', 'Social network of mutual obligations — key to business and social success'],
    ['请客 Qǐng kè — Treating guests', 'Hosts pay for meals — fighting over the bill (抢单) is common and expected'],
    ['筷子 Kuàizi — Chopstick etiquette', 'Never stand chopsticks upright in rice (funeral imagery), never pass food chopstick-to-chopstick'],
    ['红包 Hóngbāo — Red envelopes', 'Cash gifts in red envelopes for holidays/weddings — amounts matter (avoid 4, favor 8)'],
    ['数字迷信 Lucky numbers', '8 (八 bā) = lucky (sounds like "prosper"), 6 = smooth, 9 = long-lasting; 4 = unlucky (sounds like "death")'],
    ['敬酒 Jìngjiǔ — Toasting', '干杯 (gānbēi — "dry cup") = bottoms up; lower your glass when toasting to someone senior'],
    ['称谓 Chēngwèi — Forms of address', 'Use title + surname: 王老师 (Teacher Wang), 李经理 (Manager Li) — first names only with close friends'],
    ['送礼 Sòng lǐ — Gift-giving', 'Wrap gifts; don\'t open in front of giver — bring fruit/dessert when visiting homes; avoid clocks (death symbolism)'],
    ['排队 Páiduì — Queuing', 'Urban China queuing culture is improving but varies; patience and directness both have their place'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>中国礼仪 — Chinese Etiquette & Social Norms</SectionLabel>
        <div className="space-y-2">
          {etiquette.map(([rule, desc]) => (
            <div key={rule} className="flex gap-3 text-sm py-1 border-b border-border/40 last:border-0">
              <span className="font-semibold shrink-0 w-52">{rule}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>食不言，寝不语 (Shí bù yán, qǐn bù yǔ)</strong> — "Don't speak while eating, don't speak while sleeping" is a traditional saying, though modern Chinese dining culture is lively and conversational. Slurping noodles is acceptable and signals enjoyment.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Chinese Currency ───────────────────────────────────────────────────────────

export function ChineseCurrencyCard() {
  const currencies: [string, string, string, string][] = [
    ['人民币 Rénmínbì (RMB)', 'Yuan 元 / 圆 ¥', 'Mainland China', 'Official name: Renminbi (People\'s Currency). Unit: 元 yuán, 角 jiǎo (0.1), 分 fēn (0.01)'],
    ['新台币 Xīn Táibì (NTD)', 'New Taiwan Dollar', 'Taiwan', 'NT$ — colloquially "台币", used alongside USD in some contexts'],
    ['港币 Gǎng Bì (HKD)', 'Hong Kong Dollar', 'Hong Kong', 'Pegged to USD — widely accepted alongside Renminbi in border areas'],
    ['澳门元 Àomén Yuán (MOP)', 'Macau Pataca', 'Macau', 'Pegged to HKD — used alongside HKD in Macau casinos and shops'],
    ['新加坡元 Xīnjiāpō Yuán (SGD)', 'Singapore Dollar', 'Singapore', 'S$ — strong currency, one of Asia\'s key financial hubs'],
  ];
  const denominations: [string, string][] = [
    ['1分 yī fēn', '0.01 yuan — rare in modern use'],
    ['1角 yī jiǎo', '0.1 yuan — colloquially "毛 máo"'],
    ['1元 yī yuán', '1 yuan — colloquially "块 kuài"'],
    ['5元/10元/20元', 'Common notes'],
    ['50元/100元', 'Most common large notes'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>华人世界的货币 — Currencies of the Chinese-Speaking World</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Name</span><span>Unit</span><span>Region</span><span>Notes</span>
              </div>
              {currencies.map(([name, unit, region, notes], i) => (
                <div key={name} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-semibold text-xs">{name}</span>
                  <span className="text-muted-foreground text-xs">{unit}</span>
                  <span className="text-muted-foreground text-xs">{region}</span>
                  <span className="text-muted-foreground text-xs">{notes}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>人民币单位 — RMB Denominations</SectionLabel>
            <div className="space-y-1 mt-1">
              {denominations.map(([d, n]) => (
                <div key={d} className="flex gap-2 text-sm">
                  <span className="font-semibold w-28 shrink-0">{d}</span>
                  <span className="text-muted-foreground">{n}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <SectionLabel>Money Expressions</SectionLabel>
              <div className="space-y-1 mt-1 text-sm">
                {[
                  ['多少钱？', 'How much is it?'],
                  ['太贵了！', 'Too expensive!'],
                  ['便宜点儿。', 'A bit cheaper please.'],
                  ['能刷卡吗？', 'Can I pay by card?'],
                  ['我用手机支付。', 'I\'ll pay by phone (WeChat/Alipay).'],
                ].map(([zh, en]) => (
                  <div key={zh} className="flex gap-2">
                    <span className="font-semibold">{zh}</span>
                    <span className="text-muted-foreground">— {en}</span>
                  </div>
                ))}
              </div>
            </div>
            <NoteBox>Mobile payment (微信支付 WeChat Pay, 支付宝 Alipay) dominates in mainland China — cash is rarely used. QR code scanning is the standard checkout method.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Chinese Pop Culture ───────────────────────────────────────────────────────

export function ChinesePopCultureCard() {
  const culture: [string, string, string][] = [
    ['网络流行语 Wǎngluò liúxíngyǔ', 'Internet slang', '666 (great!), 886 (bye bye bye), 奥利给 (go for it!), yyds (永远的神 — GOAT), 躺平 (lying flat — giving up)'],
    ['抖音 Dǒuyīn / TikTok', 'Short video platform', 'Chinese version of TikTok — massive influence on trends, music, food, slang'],
    ['微信 Wēixìn (WeChat)', 'Super-app', 'Messaging + payments + social media + mini-programs — essential for life in China'],
    ['C-pop / 华语流行乐', 'Chinese pop music', '周杰伦 Jay Chou, 邓紫棋 G.E.M., 王菲 Faye Wong — blends Western and Chinese elements'],
    ['国产剧 Guóchǎn jù', 'Chinese TV dramas', '仙侠剧 xianxia (fantasy), 古装剧 historical, 都市剧 modern romance — massive streaming audiences'],
    ['功夫 Gōngfu / 武术', 'Martial arts / Wushu', 'Cultural heritage + cinematic tradition — 李小龙 Bruce Lee, 成龙 Jackie Chan, 李连杰 Jet Li'],
    ['汉服 Hànfú', 'Traditional Han clothing', 'Trendy revival movement — young Chinese wearing traditional dress in daily life and photos'],
    ['茶文化 Chá wénhuà', 'Tea culture', '功夫茶 gongfu tea ceremony, 奶茶 bubble tea — China is the origin of all tea culture'],
    ['麻将 Májiàng', 'Mahjong', 'Tile game played across generations — sound of tiles is the soundtrack of Chinese family gatherings'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>中国流行文化 — Chinese Pop Culture</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Topic</span><span>Category</span><span>Details</span>
          </div>
          {culture.map(([topic, cat, details], i) => (
            <div key={topic} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold text-xs">{topic}</span>
              <span className="text-muted-foreground text-xs">{cat}</span>
              <span className="text-muted-foreground text-xs">{details}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>网络用语 internet language tip:</strong> Chinese internet slang evolves extremely fast. Numbers often substitute for sounds: 520 = 我爱你 (I love you), 88 = 拜拜 (bye-bye), 233 = laughter (from meme code). Understanding these is key to reading modern Chinese social media.
        </NoteBox>
      </CardContent>
    </Card>
  );
}
