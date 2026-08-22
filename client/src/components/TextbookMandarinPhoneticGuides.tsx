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

// ── Tone Overview ─────────────────────────────────────────────────────────────

export function ZhTonesOverviewCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>声调系统 — Mandarin Tone System</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Mandarin has 4 tones + a neutral tone. The same syllable with different tones = completely different words. Tones are not optional decoration — they ARE the pronunciation.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>The Minimal Pair: mā / má / mǎ / mà</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Pinyin</span><span>Character</span><span>Meaning</span><span>Tone shape</span>
              </div>
              {[
                ['mā', '妈', 'mother', '¯ high flat'],
                ['má', '麻', 'hemp, numb', '/ rising'],
                ['mǎ', '马', 'horse', 'v dip-rise'],
                ['mà', '骂', 'to scold', '\\ falling'],
                ['ma', '吗', 'question?', '· light'],
              ].map(([py, ch, m, t], i) => (
                <div key={py} className={`grid grid-cols-4 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-semibold text-base">{py}</span>
                  <span className="font-bold text-lg">{ch}</span>
                  <span className="text-muted-foreground">{m}</span>
                  <span className="text-muted-foreground">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Tone Sandhi Rules</SectionLabel>
            <div className="space-y-2 text-sm">
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">3rd + 3rd tone → 2nd + 3rd</p>
                <p className="text-muted-foreground">你好 nǐhǎo → actually pronounced níhǎo</p>
                <p className="text-muted-foreground">可以 kěyǐ → pronounced kéyǐ in speech</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">不 (bù) before 4th → 2nd tone</p>
                <p className="text-muted-foreground">不是 bùshì → pronounced búshì</p>
                <p className="text-muted-foreground">不对 bùduì → pronounced búduì</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">一 yī changes in context</p>
                <p className="text-muted-foreground">Before 4th tone: yí — 一个 yígè</p>
                <p className="text-muted-foreground">Before 1st/2nd/3rd: yì — 一天 yìtiān</p>
                <p className="text-muted-foreground">In isolation or at end: yī</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pinyin Initials ────────────────────────────────────────────────────────────

export function ZhPinyinInitialsCard() {
  const initials: [string, string, string][] = [
    ['b p m f', 'Labials', 'Similar to English — b/p/m/f. No voiced consonants.'],
    ['d t n l', 'Alveolars', 'd=unaspirated, t=aspirated, n/l similar to English'],
    ['g k h', 'Velars', 'g=unaspirated, k=aspirated, h=like Scottish "loch"'],
    ['j q x', 'Palatals', 'Tongue tip down — j/q/x only before i/ü. No English equivalent!'],
    ['zh ch sh r', 'Retroflexes', 'Tongue tip curled back — zh/ch/sh/r. North China pronunciation.'],
    ['z c s', 'Dental sibilants', 'Tongue tip up, NOT curled — buzzy z, hissy s, ts-c'],
    ['y w', 'Glides/semivowels', 'y before i-vowels, w before u-vowels — actually vowels'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>声母 (Shēngmǔ) — Pinyin Initial Consonants</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Mandarin has 21 initial consonants. The critical distinction: <strong>aspirated</strong> (strong puff of air: p/t/k/q/ch/c) vs. <strong>unaspirated</strong> (no puff: b/d/g/j/zh/z). NOT voiced vs. voiceless like English.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Initials</span><span>Category</span><span>Notes</span>
          </div>
          {initials.map(([i, cat, notes], idx) => (
            <div key={i} className={`grid grid-cols-3 px-3 py-2 ${idx > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-mono font-bold text-base">{i}</span>
              <span className="font-semibold text-xs">{cat}</span>
              <span className="text-muted-foreground text-xs">{notes}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Key insight — Aspirated vs. Unaspirated:</strong> Hold paper in front of mouth. b/d/g/j/zh/z = paper barely moves. p/t/k/q/ch/c = paper blows forward. This distinction (NOT voicing) is what separates bā (eight) from pā (lie flat).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Pinyin Finals ─────────────────────────────────────────────────────────────

export function ZhPinyinFinalsCard() {
  const finals: [string, string, string][] = [
    ['a o e', 'Simple vowels', 'a=open "ah", o=rounded "oh", e=unrounded mid-central schwa "uh"'],
    ['i u ü', 'High vowels', 'i="ee", u="oo" rounded, ü="ee" with rounded lips (French u)'],
    ['ai ei ao ou', 'Diphthongs', 'Two-vowel glides — ai="eye", ei="hey", ao="ow", ou="oh"'],
    ['an en in un ün', 'Nasal finals -n', 'Tongue tip touches upper teeth for -n ending'],
    ['ang eng ing ong', 'Nasal finals -ng', 'Back of tongue raises for -ng — like "sing"'],
    ['ia ie ua uo üe', 'Vowel + vowel', 'Glide + vowel combinations — ie="yeah", uo="waw"'],
    ['iao iou (iu) uai uei (ui)', 'Triphthongs', 'Three-element finals — iu=yoh, ui=way'],
    ['ian uan üan', 'Vowel + -an', 'ian sounds like "yen", not "ee-an"'],
    ['er', 'Rhotacized vowel', 'ér = "uh" with tongue curled — Beijing 儿化音 marker'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>韵母 (Yùnmǔ) — Pinyin Final Vowels</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Finals are the vowel + ending part of each syllable. Mandarin syllables = Initial (optional) + Final + Tone.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Finals</span><span>Type</span><span>Pronunciation Guide</span>
          </div>
          {finals.map(([f, t, p], i) => (
            <div key={f} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-mono font-bold">{f}</span>
              <span className="font-semibold text-xs">{t}</span>
              <span className="text-muted-foreground text-xs">{p}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>ü (u-umlaut):</strong> After j/q/x/y, the ü is written as "u" but pronounced as ü (lips rounded for "oo" while tongue says "ee"): 鱼 yú (fish), 女 nǚ (woman), 句 jù (sentence). After l/n, the distinction matters: 路 lù (road) vs 旅 lǚ (travel).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── zh/ch/sh vs z/c/s ─────────────────────────────────────────────────────────

export function ZhRetroflexCard() {
  const pairs: [string, string, string, string][] = [
    ['zh (知)', 'Retroflex stop', 'Tongue curled back, touching palate', '知 zhī (know), 中 zhōng (middle/China), 这 zhè (this)'],
    ['z (资)', 'Dental stop', 'Tongue tip up, teeth area', '字 zì (character), 在 zài (at/in), 走 zǒu (walk)'],
    ['ch (吃)', 'Retroflex aspirated', 'Curled tongue + strong puff of air', '吃 chī (eat), 长 cháng (long), 出 chū (exit)'],
    ['c (次)', 'Dental aspirated', 'Tip up + puff, like English "ts"', '次 cì (time/occurrence), 从 cóng (from), 菜 cài (food/dish)'],
    ['sh (是)', 'Retroflex fricative', 'Tongue curled back, air flows', '是 shì (to be), 说 shuō (speak), 上 shàng (up/on)'],
    ['s (四)', 'Dental fricative', 'Tongue tip up, like English "s"', '四 sì (four), 所以 suǒyǐ (so), 送 sòng (give/send)'],
    ['r (日)', 'Retroflex approximant', 'Curled tongue + voiced buzzing — unique!', '日 rì (sun/day), 人 rén (person), 如果 rúguǒ (if)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>翘舌音 vs 平舌音 — Retroflex vs Dental Consonants</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">The most common beginner mistake: confusing retroflex (zh/ch/sh/r — tongue curled back) with dental (z/c/s — tongue tip up at teeth). These are distinct sounds that change meaning.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Sound</span><span>Type</span><span>Articulation</span><span>Common Words</span>
          </div>
          {pairs.map(([s, t, a, ex], i) => (
            <div key={s} className={`grid grid-cols-4 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-mono font-bold text-base">{s}</span>
              <span className="text-xs text-muted-foreground">{t}</span>
              <span className="text-xs text-muted-foreground">{a}</span>
              <span className="text-xs">{ex}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Northern vs Southern China:</strong> Retroflex zh/ch/sh/r are strong in Beijing and northern Mandarin. Many southern regions (Sichuan, Hunan, Taiwan) merge these with z/c/s — 是 shì sounds like sì in some accents. Standard Pǔtōnghuà maintains the distinction.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── j/q/x Palatals ────────────────────────────────────────────────────────────

export function ZhPalatalCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>j / q / x — Palatal Consonants</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">These three initials only appear before i or ü (written u after j/q/x). The tongue tip points DOWN — opposite of English "j".</p>
            <div className="space-y-3 text-sm">
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">j — unaspirated palatal</p>
                <p className="text-muted-foreground">Like "jee" with tongue tip DOWN. NOT English "j" (which has lip rounding and voicing).</p>
                <p className="mt-1">家 jiā (home), 今 jīn (today/gold), 就 jiù (then/already)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">q — aspirated palatal</p>
                <p className="text-muted-foreground">Like j but with a strong puff of air. Closest to English "ch" in "cheap" — but tongue tip DOWN.</p>
                <p className="mt-1">钱 qián (money), 请 qǐng (please), 去 qù (to go)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">x — palatal fricative</p>
                <p className="text-muted-foreground">Between English "sh" and "s" — hissing sound with tongue tip DOWN. No direct English equivalent.</p>
                <p className="mt-1">学 xué (study), 喜欢 xǐhuān (to like), 小 xiǎo (small)</p>
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>Minimal Pairs — j vs zh vs z</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Pinyin</span><span>Character</span><span>Meaning</span>
              </div>
              {[
                ['jī', '机', 'machine'],
                ['zhī', '知', 'to know'],
                ['zī', '资', 'resources'],
                ['qī', '七', 'seven'],
                ['chī', '吃', 'to eat'],
                ['cī', '刺', 'thorn'],
                ['xī', '西', 'west'],
                ['shī', '师', 'teacher'],
                ['sī', '思', 'to think'],
              ].map(([py, ch, m], i) => (
                <div key={py+ch} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className="font-mono font-semibold">{py}</span>
                  <span className="font-bold text-lg">{ch}</span>
                  <span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Neutral Tone & 儿化 ────────────────────────────────────────────────────────

export function ZhNeutralToneCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>轻声 Qīngshēng — Neutral Tone</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">The neutral tone is short, light, and unstressed. It has no tone mark in Pinyin. Its pitch adjusts based on the preceding tone.</p>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Common neutral tone words:</p>
              {[
                ['吗 ma', 'question particle (你去吗？)'],
                ['呢 ne', 'follow-up particle (你呢？)'],
                ['吧 ba', 'suggestion particle (走吧。)'],
                ['了 le', 'completion/change marker'],
                ['着 zhe', 'durative aspect particle'],
                ['的 de', 'structural particle'],
                ['地 de', 'adverbial particle'],
                ['得 de', 'complement particle'],
                ['们 men', 'plural suffix (我们、你们)'],
                ['子 zi', 'noun suffix (桌子, 椅子, 孩子)'],
              ].map(([w, d]) => (
                <div key={w} className="flex gap-2">
                  <span className="font-semibold w-24 shrink-0">{w}</span>
                  <span className="text-muted-foreground text-xs">{d}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>儿化 Érhuà — Rhotacization (Beijing)</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">Beijing and northern Mandarin add an "r" coloring (儿化) to certain syllables — a hallmark of the Beijing accent. The -r ending slightly raises the tongue.</p>
            <div className="space-y-1 text-sm">
              {[
                ['这儿 zhèr', '= 这里 here'],
                ['那儿 nàr', '= 那里 there'],
                ['哪儿 nǎr', '= 哪里 where'],
                ['一点儿 yīdiǎnr', 'a little bit'],
                ['玩儿 wánr', 'to play'],
                ['事儿 shìr', 'matter/thing'],
                ['花儿 huār', 'flower'],
                ['门儿 ménr', 'door (colloq.)'],
              ].map(([w, e]) => (
                <div key={w} className="flex gap-2">
                  <span className="font-semibold w-28 shrink-0">{w}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
            <NoteBox>儿化 is strong in Beijing speech and considered characteristic of standard Pǔtōnghuà — but it's minimal or absent in Taiwan Mandarin and southern accents.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Vowel Sounds ──────────────────────────────────────────────────────────────

export function ZhVowelSoundsCard() {
  const tricky: [string, string, string][] = [
    ['e', '[ɤ] / [e]', 'Not English "e" — a mid-back unrounded vowel: "uh" without lip rounding. 河 hé, 这 zhè'],
    ['ü (u after j/q/x)', '[y]', 'Lips rounded for "oo", tongue position for "ee" — French "u". 女 nǚ, 鱼 yú, 去 qù'],
    ['-i after zh/ch/sh/r', '[ɹ̩]', 'Not a real "ee" — just a buzzy syllabic consonant. 是 shì, 日 rì, 知 zhī'],
    ['-i after z/c/s', '[z̩]', 'A dental buzz, not "ee". 四 sì, 字 zì, 词 cí'],
    ['ian', '[iɛn]', 'Sounds like "yen" not "ee-an". 年 nián, 电 diàn, 先 xiān'],
    ['ui (= uei)', '[weɪ]', 'Shortened form — sounds like English "way". 对 duì, 水 shuǐ, 贵 guì'],
    ['un (= uen)', '[wən]', 'Shortened "oo" + schwa + n. 春 chūn, 门 mén, 论 lùn'],
    ['ong', '[ʊŋ]', 'Rounded, like "oong" with -ng ending. 中 zhōng, 龙 lóng, 东 dōng'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>容易出错的韵母 — Tricky Vowel Pronunciations</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Several Pinyin vowels are spelled in ways that mislead English speakers. These are the most important ones to learn correctly from the start.</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Pinyin</span><span>IPA</span><span>Guide</span>
          </div>
          {tricky.map(([py, ipa, guide], i) => (
            <div key={py} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-mono font-bold">{py}</span>
              <span className="text-muted-foreground font-mono text-xs">{ipa}</span>
              <span className="text-muted-foreground text-xs">{guide}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Syllable Structure ─────────────────────────────────────────────────────────

export function ZhSyllableStructureCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>汉语音节结构 — Syllable Structure</SectionLabel>
            <p className="text-sm text-muted-foreground mb-3">Mandarin syllables follow a strict (C)(G)V(X)(N) pattern — simpler than English, but with tone required.</p>
            <div className="space-y-2 text-sm">
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">C = Initial consonant (optional)</p>
                <p className="text-muted-foreground">Any of the 21 initials, or no initial (zero-initial)</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">G = Glide (optional: i/u/ü)</p>
                <p className="text-muted-foreground">Medial glide before main vowel</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">V = Main vowel (required)</p>
                <p className="text-muted-foreground">One of the basic vowels a/o/e/i/u/ü</p>
              </div>
              <div className="p-2 rounded-md bg-muted/40">
                <p className="font-semibold">N = Nasal coda (optional: -n or -ng)</p>
                <p className="text-muted-foreground">Only nasal endings — no final consonant clusters!</p>
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>Mandarin Phonology Features</SectionLabel>
            <div className="space-y-2 text-sm">
              {[
                ['Syllable-timed', 'Each syllable takes roughly equal time — unlike English stress-timing'],
                ['No consonant clusters', 'No "str-", "spl-" etc — each syllable is (C)(G)V(N)T only'],
                ['~400 unique syllables', '~1,300 with all 4 tones — English has ~15,000+ distinct syllables'],
                ['No final consonants', 'Only -n and -ng are allowed as codas — no final stops'],
                ['Morpheme = syllable', 'Almost every character/morpheme = one syllable'],
                ['No inflection', 'No verb endings, plural markers, or case changes from sounds'],
              ].map(([feature, desc]) => (
                <div key={feature} className="flex gap-2 py-0.5 border-b border-border/30 last:border-0">
                  <span className="font-semibold w-40 shrink-0 text-xs">{feature}</span>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </div>
            <NoteBox>Because Mandarin has so few unique syllables (~400), homophones are extremely common. Tones + context clarify meaning: shī can be 诗 poem, 师 teacher, 狮 lion, or 湿 wet — all different tones.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pronunciation Overview ─────────────────────────────────────────────────────

export function ZhPronunciationOverviewCard() {
  const tips: [string, string][] = [
    ['Tones first', 'Learn tones with every word from day one — retrofitting tones later is very difficult'],
    ['Aspiration, not voicing', 'b/d/g are NOT "voiced" — they are unaspirated. Train with tissue paper test.'],
    ['j/q/x — tongue tip DOWN', 'Opposite of English instinct — your jaw may help by dropping slightly'],
    ['zh/ch/sh — tongue BACK', 'Curl tongue back toward hard palate — not English "sh"'],
    ['ü rounds lips for "ee"', 'Think: blow a kiss while saying "ee" — that\'s ü / u after j/q/x/y'],
    ['Neutral tone: relax', 'Particles like 的/了/吗 are light and short — over-pronouncing sounds unnatural'],
    ['Tone sandhi is mandatory', 'You MUST change tones in sandhi contexts (3+3, 不+4, 一) — it\'s not optional'],
    ['Syllable timing', 'Each syllable equal length — slow down and give every syllable its full value'],
    ['Record yourself', 'Tone errors are invisible to you — listening back reveals pitch mistakes quickly'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>发音指南 — Pronunciation Overview & Tips</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-2 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Focus Area</span><span>Tip</span>
          </div>
          {tips.map(([focus, tip], i) => (
            <div key={focus} className={`grid grid-cols-2 px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className="font-semibold text-xs">{focus}</span>
              <span className="text-muted-foreground text-xs">{tip}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Pǔtōnghuà vs Regional Mandarin:</strong> Standard Pǔtōnghuà (普通话) is based on Beijing phonology. Taiwan Mandarin (國語) has softer tones and less 儿化. Southern China Mandarin often merges zh/ch/sh with z/c/s and n with l. All are mutually intelligible — understanding accent variation builds listening comprehension.
        </NoteBox>
      </CardContent>
    </Card>
  );
}
