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

// ── Consonants Chart ───────────────────────────────────────────────────────────

export function KoConsonantsChartCard() {
  const basicConsonants: [string, string, string, string][] = [
    ['ㄱ', 'g/k', 'giyeok', 'Initial: g (가 ga), Final: k (국 guk)'],
    ['ㄴ', 'n', 'nieun', 'Always n — 나 (na), 눈 (nun)'],
    ['ㄷ', 'd/t', 'digeut', 'Initial: d (다 da), Final: t (맡 mat)'],
    ['ㄹ', 'r/l', 'rieul', 'Initial: r (라 ra), Final: l (말 mal). Between vowels: r-flap.'],
    ['ㅁ', 'm', 'mieum', 'Always m — 마 (ma), 밤 (bam)'],
    ['ㅂ', 'b/p', 'bieup', 'Initial: b (바 ba), Final: p (입 ip)'],
    ['ㅅ', 's/t', 'siot', 'Initial: s (사 sa), Final: t (맛 mat). Before ㅣ: sh.'],
    ['ㅇ', 'Ø/ng', 'ieung', 'Initial: silent (아 a). Final: ng (강 gang)'],
    ['ㅈ', 'j', 'jieut', '자 (ja), 주 (ju)'],
    ['ㅊ', 'ch', 'chieut', '차 (cha), 춤 (chum)'],
    ['ㅋ', 'k (aspirated)', 'kieuk', '카 (ka), 코 (ko)'],
    ['ㅌ', 't (aspirated)', 'tieut', '타 (ta), 토 (to)'],
    ['ㅍ', 'p (aspirated)', 'pieup', '파 (pa), 포 (po)'],
    ['ㅎ', 'h', 'hieut', '하 (ha), 호 (ho). Weakens between vowels.'],
  ];
  const tensed: [string, string, string][] = [
    ['ㄲ', 'kk (tense)', 'kkiyeok — 까 (kka), 꽃 (kkot)'],
    ['ㄸ', 'tt (tense)', 'ssangdigeut — 따 (tta), 떡 (tteok)'],
    ['ㅃ', 'pp (tense)', 'ssangbieup — 빠 (ppa), 빵 (ppang)'],
    ['ㅆ', 'ss (tense)', 'ssangsiot — 싸다 (ssada: cheap)'],
    ['ㅉ', 'jj (tense)', 'ssangjieut — 짜다 (jjada: salty)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>자음 — Korean Consonants</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean has 14 basic consonants + 5 tensed (doubled) consonants. Many have different pronunciations depending on their position: word-initial, medial, or as a final consonant (받침 batchim).</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>14 Basic Consonants</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-4 bg-muted/60 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Letter</span><span>Sound</span><span>Name</span><span>Notes</span>
              </div>
              {basicConsonants.map(([ltr, snd, nm, note], i) => (
                <div key={ltr} className={`grid grid-cols-4 px-2 py-1.5 gap-1 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-bold text-base ${KO}`}>{ltr}</span>
                  <span className="font-semibold text-xs">{snd}</span>
                  <span className="text-muted-foreground italic text-xs">{nm}</span>
                  <span className="text-muted-foreground text-xs">{note}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>5 Tensed Consonants (쌍자음)</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Tensed consonants are produced with a glottal constriction — no air burst, sharp and clipped. They occur only in word-initial or medial position (never as final consonants).</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {tensed.map(([ltr, snd, desc], i) => (
                <div key={ltr} className={`px-3 py-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <div className="flex gap-3 items-center">
                    <span className={`font-bold text-xl ${KO}`}>{ltr}</span>
                    <span className="font-semibold text-sm">{snd}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
            <NoteBox>
              <strong>Three series:</strong> Plain (ㄱ, ㄷ, ㅂ, ㅅ, ㅈ) · Aspirated (ㅋ, ㅌ, ㅍ, ㅊ) · Tensed/Fortis (ㄲ, ㄸ, ㅃ, ㅆ, ㅉ). The tensed series is unique to Korean and is the key to native-sounding pronunciation.
            </NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Vowels Chart ───────────────────────────────────────────────────────────────

export function KoVowelsChartCard() {
  const monophthongs: [string, string, string][] = [
    ['ㅏ', 'a', 'like "ah" — 아 (a), 바 (ba)'],
    ['ㅓ', 'eo', 'like "uh" — 어 (eo), 버 (beo)'],
    ['ㅗ', 'o', 'like "oh" rounded — 오 (o), 보 (bo)'],
    ['ㅜ', 'u', 'like "oo" — 우 (u), 부 (bu)'],
    ['ㅡ', 'eu', 'no English equivalent — back unrounded vowel — 으 (eu)'],
    ['ㅣ', 'i', 'like "ee" — 이 (i), 비 (bi)'],
    ['ㅐ', 'ae', 'like "eh" — 애 (ae). Modern Korean: sounds like ㅔ'],
    ['ㅔ', 'e', 'like "eh" — 에 (e), 세 (se)'],
  ];
  const diphthongs: [string, string, string][] = [
    ['ㅑ', 'ya', '야 (ya), 여야 (yeoya)'],
    ['ㅕ', 'yeo', '여 (yeo), 겨 (gyeo)'],
    ['ㅛ', 'yo', '요 (yo), 교 (gyo)'],
    ['ㅠ', 'yu', '유 (yu), 뉴 (nyu)'],
    ['ㅘ', 'wa', '와 (wa), 봐 (bwa)'],
    ['ㅝ', 'wo/weo', '워 (wo), 뭐 (mwo)'],
    ['ㅚ', 'oe', '외 (oe). Modern: sounds like 에 (e)'],
    ['ㅢ', 'ui', '의 (ui). As possessive 의: pronounced 에'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>모음 — Korean Vowels</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean has 10 simple vowels (단모음) and 11 complex vowels/diphthongs (이중모음). Vowels are written vertically (ㅏ, ㅓ, ㅗ, ㅜ) or horizontally (ㅡ) relative to their consonant.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Simple Vowels (단모음)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {monophthongs.map(([ltr, rom, desc], i) => (
                <div key={ltr} className={`grid grid-cols-3 px-3 py-1.5 gap-1 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-bold text-lg ${KO}`}>{ltr}</span>
                  <span className="font-semibold">{rom}</span>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Diphthongs (이중모음)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {diphthongs.map(([ltr, rom, desc], i) => (
                <div key={ltr} className={`grid grid-cols-3 px-3 py-1.5 gap-1 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-bold text-lg ${KO}`}>{ltr}</span>
                  <span className="font-semibold">{rom}</span>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </div>
            <NoteBox>The ㅡ (eu) sound is the hardest for English speakers — it's a back vowel with unrounded lips, like saying "uh" but pushing the tongue further back. Practice: 그, 크, 으.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Batchim ────────────────────────────────────────────────────────────────────

export function KoBatchimCard() {
  const batchimGroups: [string, string, string][] = [
    ['ㄱ, ㄲ, ㅋ', 'k sound', '국 (guk), 닭 (dak), 부엌 (bueok)'],
    ['ㄴ', 'n sound', '인 (in), 눈 (nun), 문 (mun)'],
    ['ㄷ, ㅅ, ㅆ, ㅈ, ㅊ, ㅌ, ㅎ', 't sound', '맛 (mat), 옷 (ot), 낮 (nat), 빛 (bit)'],
    ['ㄹ', 'l sound', '말 (mal), 일 (il), 별 (byeol)'],
    ['ㅁ', 'm sound', '밤 (bam), 숨 (sum), 봄 (bom)'],
    ['ㅂ, ㅍ', 'p sound', '입 (ip), 앞 (ap), 숲 (sup)'],
    ['ㅇ', 'ng sound', '강 (gang), 공 (gong), 방 (bang)'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>받침 — Batchim: Final Consonants</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">받침 (batchim) is the final consonant in a syllable block. Although 19 consonants can appear as batchim, they all reduce to just 7 actual pronunciations. This is called the "7 terminal sounds rule" (7종성 법칙).</p>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Batchim consonant(s)</span><span>Pronounced as</span><span>Examples</span>
          </div>
          {batchimGroups.map(([letters, sound, examples], i) => (
            <div key={letters} className={`grid grid-cols-3 px-3 py-2 gap-2 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <span className={`font-bold ${KO}`}>{letters}</span>
              <span className="font-semibold">{sound}</span>
              <span className="text-muted-foreground text-xs">{examples}</span>
            </div>
          ))}
        </div>
        <NoteBox>
          <strong>Linking rule (연음):</strong> When a batchim is followed by a vowel-initial syllable, it links to the next syllable. 국어 (gug-eo) → pronounced 구거 (gu-geo). 입어요 → 이버요. This is why Korean sounds fluid and connected.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Aspiration ─────────────────────────────────────────────────────────────────

export function KoAspirationCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>격음화 / 경음화 — Aspiration & Fortis Consonants</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean has three levels of consonant tension: plain (평음), aspirated (격음), and tensed/fortis (경음). Distinguishing these is essential for clear Korean pronunciation.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <SectionLabel>Plain (평음) — lax, some aspiration</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[['ㄱ', '가 (ga)'], ['ㄷ', '다 (da)'], ['ㅂ', '바 (ba)'], ['ㅈ', '자 (ja)'], ['ㅅ', '사 (sa)']].map(([c, ex], i) => (
                <div key={c} className={`flex gap-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-bold text-base ${KO}`}>{c}</span>
                  <span className="text-sm">{ex}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Aspirated (격음) — strong air burst</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[['ㅋ', '카 (ka)'], ['ㅌ', '타 (ta)'], ['ㅍ', '파 (pa)'], ['ㅊ', '차 (cha)'], ['ㅎ', '하 (ha)']].map(([c, ex], i) => (
                <div key={c} className={`flex gap-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-bold text-base ${KO}`}>{c}</span>
                  <span className="text-sm">{ex}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Tensed/Fortis (경음) — no air, glottal</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[['ㄲ', '까 (kka)'], ['ㄸ', '따 (tta)'], ['ㅃ', '빠 (ppa)'], ['ㅉ', '짜 (jja)'], ['ㅆ', '싸 (ssa)']].map(([c, ex], i) => (
                <div key={c} className={`flex gap-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-bold text-base ${KO}`}>{c}</span>
                  <span className="text-sm">{ex}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>Minimal pair test: 불 (fire) vs. 뿔 (horn) vs. 풀 (grass). These three sounds are distinct in Korean and confusing them changes the meaning. Hold a tissue in front of your mouth — aspirated consonants move it; tensed ones don't.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Vowel Harmony ─────────────────────────────────────────────────────────────

export function KoVowelHarmonyCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>모음조화 — Vowel Harmony</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Vowel harmony is a key feature of Korean that determines which verb endings and suffixes to use. Vowels divide into "bright" (양성) and "dark" (음성) categories.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Bright vowels (양성): ㅏ, ㅗ → use -아</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Verb stem</span><span>Polite ending</span><span>Meaning</span>
              </div>
              {[['가 (ga)', '가요 → 갔아요', 'go → went'],['보 (bo)', '봐요 → 봤아요', 'see → saw'],['자 (ja)', '자요 → 잤아요', 'sleep → slept']].map(([s, e, m], i) => (
                <div key={s} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{s}</span>
                  <span>{e}</span>
                  <span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Dark vowels (음성): all others → use -어</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Verb stem</span><span>Polite ending</span><span>Meaning</span>
              </div>
              {[['먹 (meok)', '먹어요 → 먹었어요', 'eat → ate'],['쓰 (sseu)', '써요 → 썼어요', 'write → wrote'],['읽 (ilk)', '읽어요 → 읽었어요', 'read → read']].map(([s, e, m], i) => (
                <div key={s} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{s}</span>
                  <span>{e}</span>
                  <span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <NoteBox>하다 verbs are an exception — they always use 해요 regardless of vowel harmony. Vowel harmony in modern Korean is most relevant for -아/어 endings; it's less strict in other contexts.</NoteBox>
      </CardContent>
    </Card>
  );
}

// ── Linking Sounds (Liaison) ───────────────────────────────────────────────────

export function KoLinkingSoundsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>연음 — Linking Sounds (Resyllabification)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">In Korean, when a syllable ends in a consonant (받침) and the next syllable begins with ㅇ (which is silent), the final consonant moves to become the initial consonant of the next syllable.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Written vs. Spoken</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <div className="grid grid-cols-3 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Written</span><span>Spoken</span><span>Meaning</span>
              </div>
              {[
                ['국어', '구거 (gu-geo)', 'national language'],
                ['입어요', '이버요 (i-beo-yo)', 'I wear'],
                ['꽃이', '꼬치 (kko-chi)', 'flower (subject)'],
                ['밥을', '바블 (ba-beul)', 'rice (object)'],
                ['책이', '채기 (chae-gi)', 'book (subject)'],
              ].map(([w, s, m], i) => (
                <div key={w} className={`grid grid-cols-3 px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold ${KO}`}>{w}</span>
                  <span className="font-semibold">{s}</span>
                  <span className="text-muted-foreground text-xs">{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Double Batchim Linking</SectionLabel>
            <p className="text-xs text-muted-foreground mb-2">Some syllables have two final consonants. One stays, one links forward.</p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['닭이 → 달기', 'dak-i → dal-gi (chicken)'],
                ['읽어요 → 일거요', 'ilk-eo-yo → il-geo-yo (read)'],
                ['삶을 → 살믈', 'salm-eul → sal-meul (life)'],
              ].map(([w, e], i) => (
                <div key={w} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{w}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
            <NoteBox>Linking is automatic and unconscious for native speakers. Learners should practice it actively — it dramatically improves natural-sounding Korean.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tensification ─────────────────────────────────────────────────────────────

export function KoTensificationCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>경음화 — Tensification (Automatic Fortis Consonants)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Certain environments automatically trigger tensification — plain consonants become tensed (fortis). This happens even though it's not written in the spelling.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>After Unreleased Stops (ㄱ, ㄷ, ㅂ)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['식당 → 식땅', 'sik-dang → sik-ttang (restaurant)'],
                ['학교 → 학꾜', 'hak-gyo → hak-kkyo (school)'],
                ['입장 → 입짱', 'ip-jang → ip-jjang (entrance)'],
                ['국밥 → 국빱', 'guk-bap → guk-ppap (rice soup)'],
              ].map(([w, e], i) => (
                <div key={w} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{w}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Common Noun Compounds</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['봄비 → 봄삐', 'spring rain (bom + bi → bom-ppi)'],
                ['눈길 → 눈낄', 'snowy road (nun + gil → nun-kkil)'],
                ['밤길 → 밤낄', 'night road (bam + gil → bam-kkil)'],
              ].map(([w, e], i) => (
                <div key={w} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{w}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
            <NoteBox>Tensification is one of the trickiest aspects for Korean learners — the written form doesn't change, but the pronunciation does. Korean speakers learn this intuitively.</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── ㅎ Sound Changes ──────────────────────────────────────────────────────────

export function KoHieuthCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>ㅎ 탈락 / 격음화 — ㅎ (Hieuth) Sound Changes</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">ㅎ is a chameleon consonant. It weakens, disappears, or triggers aspiration in adjacent consonants depending on position.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>ㅎ + Plain → Aspirated (격음화)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['좋다 → 조타', 'johda → jota (to be good)'],
                ['많다 → 만타', 'manhda → manta (to be many)'],
                ['않다 → 안타', 'anhda → anta (to not do)'],
                ['넣고 → 너코', 'neohgo → neoko (to put in and)'],
              ].map(([w, e], i) => (
                <div key={w} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{w}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>ㅎ Weakening / Deletion (ㅎ 탈락)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              {[
                ['좋아요 → 조아요', 'johayo → joayo (I like it)'],
                ['많아요 → 마나요', 'manhayo → manayo (There\'s a lot)'],
                ['넣어요 → 너어요', 'put inside (h disappears)'],
              ].map(([w, e], i) => (
                <div key={w} className={`px-3 py-1.5 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                  <span className={`font-semibold block text-sm ${KO}`}>{w}</span>
                  <span className="text-muted-foreground text-xs">{e}</span>
                </div>
              ))}
            </div>
            <NoteBox>Rule summary: ㅎ before ㄱ/ㄷ/ㅂ/ㅈ → aspirated (ㅋ/ㅌ/ㅍ/ㅊ). ㅎ before or after a vowel → silent/weakens. ㅎ alone at the end → t sound (as batchim).</NoteBox>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pronunciation Overview ────────────────────────────────────────────────────

export function KoPronunciationOverviewCard() {
  const tips = [
    { title: 'ㅡ (eu) — the unique vowel', desc: 'No English equivalent. Back unrounded vowel. Heard in 그것 (geugeos), 으 (eu), 음식 (eumsik). Practice by saying "uh" while flattening the lips.' },
    { title: 'ㄹ — the liquid consonant', desc: 'Between vowels: a flapped "r" similar to Spanish "r." At the end of syllables or before consonants: an "l." 라 (ra) vs. 말 (mal).' },
    { title: 'Syllable timing', desc: 'Korean is roughly syllable-timed — each syllable gets equal weight, unlike English stress-timed rhythm. Count syllables evenly: 한-국-어-를-배-워-요.' },
    { title: 'Intonation — rising vs. falling', desc: 'Questions without question words use rising intonation: 밥 먹었어요↑? Statements use falling: 밥 먹었어요↓. Yes/No questions sound like statements but rise at the end.' },
    { title: 'Word-final devoicing', desc: 'Consonants at the very end of an utterance are unreleased and voiceless. 국 ends with a silent "k" that you can hear as a brief stop.' },
    { title: 'ㄴ before ㄹ / ㄹ before ㄴ', desc: 'Both consonants assimilate: 신라 (Silla dynasty) → 실라. 음력 → 음녁. This "ㄴ-ㄹ rule" creates fluid flow.' },
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>발음 개요 — Korean Pronunciation Overview</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Korean pronunciation follows regular rules, but several patterns catch learners off guard. Mastering these will make your speech dramatically clearer.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tips.map(({ title, desc }) => (
            <div key={title} className="rounded-md border border-border/60 px-3 py-2">
              <p className={`font-semibold text-sm ${KO}`}>{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
        <NoteBox>
          Korean Romanization uses the Revised Romanization of Korean (국어의 로마자 표기법). It's not phonetic — it represents underlying forms, not actual pronunciation. Always learn from audio alongside Hangul.
        </NoteBox>
      </CardContent>
    </Card>
  );
}
