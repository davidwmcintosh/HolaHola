/**
 * TextbookPortuguesePhoneticGuides.tsx
 * Portuguese phonetic guide cards for Textbook Section 8.
 *
 * Exports (9 cards):
 *  PtNasalVowelsCard     — ã, ão, em/ens, im, om, um nasal sounds
 *  PtPortugueseRCard     — The Portuguese R (tapped vs guttural)
 *  PtLhNhCard            — LH (/ʎ/) and NH (/ɲ/) digraphs
 *  PtVowelReductionCard  — European PT unstressed vowel reduction
 *  PtTiDiCard            — Brazilian palatalization: ti=/tʃi/ di=/dʒi/
 *  PtStressAccentCard    — Written accent marks
 *  PtEuVsBrCard          — EU-PT vs BR-PT pronunciation key differences
 *  PtLinkingCard         — Linking sounds / sandhi in Portuguese
 *  PtIntonationCard      — Intonation patterns (statements vs questions)
 */

import { Card, CardContent } from "@/components/ui/card";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{children}</p>;
}

function PhoneticBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-sm border border-border bg-muted font-mono text-sm">
      {children}
    </span>
  );
}

// ─── 1. Nasal Vowels ──────────────────────────────────────────────────────────

export function PtNasalVowelsCard() {
  const nasals = [
    { spelling: 'ã', ipa: '/ɐ̃/', example: 'maçã', translation: 'apple', tip: 'Like "uh" — hum through your nose' },
    { spelling: 'ão', ipa: '/ɐ̃w̃/', example: 'pão', translation: 'bread', tip: 'Like "own" nasalized — ends with nasal glide' },
    { spelling: 'em / en', ipa: '/ẽĩ/', example: 'bem, tempo', translation: 'well, time', tip: 'Sing-song nasal diphthong — very Portuguese!' },
    { spelling: 'im / in', ipa: '/ĩ/', example: 'fim, princípio', translation: 'end, principle', tip: 'Nasalized "ee" — hum through nose while saying ee' },
    { spelling: 'om / on', ipa: '/õ/', example: 'bom, fundo', translation: 'good, deep', tip: 'Nasalized "oh" — round lips and hum' },
    { spelling: 'um / un', ipa: '/ũ/', example: 'um, mundo', translation: 'one, world', tip: 'Nasalized "oo" — like French "un"' },
    { spelling: 'ã + m/n', ipa: '/ɐ̃/', example: 'amanhã, também', translation: 'tomorrow, also', tip: 'Nasal stays through entire vowel' },
    { spelling: '-ões', ipa: '/õĩʃ/', example: 'corações', translation: 'hearts (plural)', tip: 'Plural of -ão — nasal diphthong + s' },
    { spelling: '-ãe', ipa: '/ɐ̃j/', example: 'pães', translation: 'breads (plural)', tip: 'Plural of pão — another nasal diphthong' },
  ];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Vogais Nasais — Nasal Vowels</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">Portuguese nasal vowels are one of the most distinctive features of the language. Air flows through both the mouth and nose simultaneously.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {nasals.map(({ spelling, ipa, example, translation, tip }) => (
            <div key={spelling} className="p-3 rounded-md bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <PhoneticBadge>{spelling}</PhoneticBadge>
                <span className="text-xs text-muted-foreground font-mono">{ipa}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">{example}</span>
                <span className="text-muted-foreground"> — {translation}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{tip}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-md bg-primary/5 border border-primary/20">
          <p className="text-sm"><strong>Practice sequence:</strong> Start with <em>bom</em> → <em>bem</em> → <em>pão</em> → <em>maçã</em> → <em>também</em>. Feel your soft palate lower to allow nasal airflow for each.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 2. Portuguese R ──────────────────────────────────────────────────────────

export function PtPortugueseRCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>O R Português — The Portuguese R</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Portuguese has multiple R sounds that vary significantly between European and Brazilian Portuguese, and even within Brazil.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>RR / Word-initial R — Guttural (Back-of-throat)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['RR', 'carro', 'car', 'Strong guttural — like German "ch" or French "r"'],
                ['R (initial)', 'rato', 'rat', 'Word-initial R = guttural in most dialects'],
                ['R (initial)', 'rua', 'street', 'Rio: aspirated /h/; PT: uvular trill'],
                ['R after l/n/s', 'melro', 'blackbird', 'R after consonant = guttural'],
              ].map(([spell, word, trans, note], i) => (
                <div key={word} className={`px-3 py-2 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <PhoneticBadge>{spell}</PhoneticBadge>
                    <span className="font-semibold">{word}</span>
                    <span className="text-muted-foreground">({trans})</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 pl-2">{note}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Single R (intervocalic) — Tapped /r/ or Flap</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['r', 'para', 'for/to', 'Tapped — tongue briefly touches ridge (like Spanish r)'],
                ['r', 'caro', 'expensive', 'Single tap — not a trill'],
                ['r', 'moro', 'I live', 'Clear distinction from carro (guttural rr)'],
                ['r (end)', 'falar', 'to speak', 'Final -r: often silent in BR, pronounced in PT-EU'],
              ].map(([spell, word, trans, note], i) => (
                <div key={word + i} className={`px-3 py-2 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <PhoneticBadge>{spell}</PhoneticBadge>
                    <span className="font-semibold">{word}</span>
                    <span className="text-muted-foreground">({trans})</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 pl-2">{note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50">
          <SectionLabel>Regional R Variation</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ['Portugal', 'Uvular trill or fricative — very back of throat, like French'],
              ['São Paulo (BR)', 'Retroflex /ɻ/ — tongue curled back (American-like R)'],
              ['Rio de Janeiro (BR)', 'Aspirated /h/ — word-initial and RR become /h/'],
            ].map(([region, desc]) => (
              <div key={region} className="p-2 rounded-sm bg-background border border-border/50">
                <div className="text-xs font-semibold mb-0.5">{region}</div>
                <div className="text-[11px] text-muted-foreground">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 3. LH and NH ────────────────────────────────────────────────────────────

export function PtLhNhCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>LH e NH — Portuguese Digraphs</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-center p-4 rounded-md bg-primary/5 border border-primary/20 mb-3">
              <div className="text-4xl font-bold text-primary mb-1">LH</div>
              <div className="text-sm font-mono text-muted-foreground">/ʎ/ — palatal lateral</div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Like the <strong>"lli"</strong> in English "million" or the <strong>"gl"</strong> in Italian "figlio". The tongue presses the entire front against the palate.</p>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['filho', 'son/child', '"FEEL-yoo"'],
                ['mulher', 'woman', '"moo-LYAIR"'],
                ['olho', 'eye', '"OL-yoo"'],
                ['trabalho', 'work', '"tra-BAL-yoo"'],
                ['elho / ilho', 'common suffix', '-el-yo / -il-yo'],
              ].map(([word, trans, pron], i) => (
                <div key={word} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold w-24">{word}</span>
                  <span className="text-muted-foreground flex-1">{trans}</span>
                  <span className="text-[11px] font-mono text-primary">{pron}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-center p-4 rounded-md bg-primary/5 border border-primary/20 mb-3">
              <div className="text-4xl font-bold text-primary mb-1">NH</div>
              <div className="text-sm font-mono text-muted-foreground">/ɲ/ — palatal nasal</div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Like the Spanish <strong>ñ</strong>, French <strong>gn</strong>, or English <strong>"ny"</strong> in "canyon". The tongue presses against the palate while air flows through the nose.</p>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['vinho', 'wine', '"VEEN-yoo"'],
                ['sonho', 'dream', '"SON-yoo"'],
                ['amanhã', 'tomorrow', '"ah-mah-NYAH"'],
                ['pinho', 'pine', '"PEEN-yoo"'],
                ['banho', 'bath', '"BAN-yoo"'],
              ].map(([word, trans, pron], i) => (
                <div key={word} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold w-24">{word}</span>
                  <span className="text-muted-foreground flex-1">{trans}</span>
                  <span className="text-[11px] font-mono text-primary">{pron}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 4. Vowel Reduction (EU-PT) ───────────────────────────────────────────────

export function PtVowelReductionCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Redução Vocálica — Vowel Reduction (EU-PT)</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">European Portuguese dramatically reduces unstressed vowels — this is the single biggest challenge for learners approaching EU-PT after learning BR-PT.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>The Reduction Pattern</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                <span>Vowel</span><span>Unstressed → sounds like</span><span>Example</span>
              </div>
              {[
                ['/e/', '→ /ɨ/ (schwa-like)', 'de → "d(uh)"'],
                ['/e/', '→ silent (often!)', 'tarde → "TAR-d"'],
                ['/o/', '→ /u/', 'coração → "ku-ra-SAWN"'],
                ['/a/', '→ /ɐ/ (shorter)', 'para → "p(uh)-ra"'],
              ].map(([vowel, result, ex], i) => (
                <div key={vowel + i} className={`grid grid-cols-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-mono font-semibold">{vowel}</span>
                  <span className="text-muted-foreground text-xs">{result}</span>
                  <span className="text-xs">{ex}</span>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
              <strong>Result:</strong> EU-PT sounds much faster and more "swallowed" than BR-PT. Portuguese speakers often joke that Brazilian Portuguese is like "singing" while EU-PT is more clipped.
            </div>
          </div>
          <div>
            <SectionLabel>Word Comparisons — EU-PT vs BR-PT</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                <span>Word</span><span>EU-PT sounds</span><span>BR-PT sounds</span>
              </div>
              {[
                ['obrigado', '"ob-ri-GAH-d(u)"', '"oh-bri-GAH-do"'],
                ['governo', '"guh-VER-n(u)"', '"goh-VER-noo"'],
                ['Portugal', '"Por-tu-GAL"', '"Por-tu-GAL"'],
                ['falar', '"fLAR"', '"fa-LAR"'],
                ['para', '"p(uh)ra"', '"PA-ra"'],
                ['semana', '"smah-na"', '"se-MA-na"'],
              ].map(([word, eu, br], i) => (
                <div key={word} className={`grid grid-cols-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold">{word}</span>
                  <span className="text-[11px] font-mono">{eu}</span>
                  <span className="text-[11px] font-mono">{br}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 5. TI/DI Palatalization (BR-PT) ─────────────────────────────────────────

export function PtTiDiCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Palatalização de TI e DI — Brazilian Palatalization</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">In most of Brazil (especially the South and Southeast), the sounds <strong>ti</strong> and <strong>di</strong> are palatalized — they become <strong>/tʃi/</strong> (like "ch") and <strong>/dʒi/</strong> (like "j" in "jungle").</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>TI → /tʃi/ (like "ch" in "cheese")</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['tio', '"CHI-oo"', 'uncle'],
                ['título', '"CHI-tu-lo"', 'title'],
                ['participar', '"par-CHI-si-par"', 'to participate'],
                ['importante', '"im-por-TAN-CHI"', 'important'],
                ['gente', '"JEN-CHI"', 'people (also -te→tchi)'],
              ].map(([word, pron, trans], i) => (
                <div key={word} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold w-28 shrink-0">{word}</span>
                  <span className="font-mono text-primary text-xs flex-1">{pron}</span>
                  <span className="text-muted-foreground text-xs">{trans}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>DI → /dʒi/ (like "j" in "just")</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['dia', '"JI-a"', 'day'],
                ['dinheiro', '"ji-NYEI-ro"', 'money'],
                ['dividir', '"ji-vi-JIR"', 'to divide'],
                ['condição', '"kon-ji-SAWN"', 'condition'],
                ['pode', '"PO-ji"', 'he/she can (also -de→dji)'],
              ].map(([word, pron, trans], i) => (
                <div key={word} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold w-28 shrink-0">{word}</span>
                  <span className="font-mono text-primary text-xs flex-1">{pron}</span>
                  <span className="text-muted-foreground text-xs">{trans}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
          <strong>Note:</strong> EU-PT does NOT palatalize TI and DI — <em>tio</em> is pronounced "TI-oo", not "CHI-oo". This is one of the most noticeable differences between the two major varieties.
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 6. Stress & Accent Marks ─────────────────────────────────────────────────

export function PtStressAccentCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Acentuação — Stress & Written Accent Marks</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Accent Marks</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['´ Acento agudo', 'High open vowel stress', 'fácil, céu, só'],
                ['ˆ Acento circunflexo', 'High closed vowel stress', 'avô, você, pêssego'],
                ['~ Til', 'Nasalization', 'pão, irmã, coração'],
                ['` Acento grave', 'Contraction marker (à)', 'à escola, às aulas'],
                ['¨ Trema', 'Diaeresis (archaic, mostly removed by AO90)', 'tranqüilo → tranquilo'],
              ].map(([mark, use, ex], i) => (
                <div key={mark} className={`px-3 py-2 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex gap-2">
                    <span className="font-mono font-bold text-primary w-36 shrink-0">{mark}</span>
                    <span className="text-muted-foreground text-xs">{use}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground pl-36 mt-0.5">e.g.: {ex}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Default Stress Rules (no accent needed)</SectionLabel>
            <div className="space-y-2">
              {[
                {
                  rule: 'Words ending in -a, -e, -o, -as, -es, -os, -am, -em',
                  stress: 'Second-to-last syllable (penultimate)',
                  ex: 'ca-SA, fa-LO, o-MEM',
                },
                {
                  rule: 'Words ending in consonants: -l, -r, -z, -u, -i, -us, -is, -um, -uns',
                  stress: 'Last syllable (ultimate)',
                  ex: 'ca-FÉ, fa-LAR, bra-SIL',
                },
                {
                  rule: 'Written accent = deviation from the above rules',
                  stress: 'Accent shows where stress actually falls',
                  ex: 'fá-cil (easy), ó-timo (great), á-gua (water)',
                },
              ].map(({ rule, stress, ex }) => (
                <div key={rule} className="p-2 rounded-md bg-muted/50 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-0.5">{rule}</div>
                  <div className="text-sm font-medium">{stress}</div>
                  <div className="text-[11px] font-mono text-primary mt-0.5">{ex}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 7. EU-PT vs BR-PT Key Differences ───────────────────────────────────────

export function PtEuVsBrCard() {
  const differences = [
    { feature: 'Progressive tense', eu: 'estar a + infinitive', br: 'estar + gerúndio (-ndo)' },
    { feature: 'Address (informal)', eu: 'tu (with conjugation)', br: 'você (3rd-person verb)' },
    { feature: 'Unstressed vowels', eu: 'Strongly reduced/silent', br: 'Clearly pronounced' },
    { feature: 'TI / DI sounds', eu: '/ti/ /di/ (not palatalized)', br: '/tʃi/ /dʒi/ (palatalized)' },
    { feature: 'Initial R / RR', eu: 'Uvular trill /ʀ/', br: '/h/ (Rio) or /x/' },
    { feature: 'Final -r in verbs', eu: 'Pronounced', br: 'Often silent (falar → falá)' },
    { feature: 'Object pronouns', eu: 'Cliticized after verb (dá-me)', br: 'Before verb (me dá)' },
    { feature: 'Diminutive -inho/a', eu: 'Common but formal', br: 'Extremely common — affection' },
    { feature: 'Vocabulary', eu: 'autocarro (bus), ecrã (screen)', br: 'ônibus (bus), tela (screen)' },
    { feature: 'Speed/Rhythm', eu: 'Faster, more clipped', br: 'Slower, more melodic' },
  ];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>EU-PT vs BR-PT — Key Pronunciation Differences</SectionLabel>
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
            <span>Feature</span>
            <span>Portugal (EU-PT)</span>
            <span>Brazil (BR-PT)</span>
          </div>
          {differences.map(({ feature, eu, br }, i) => (
            <div key={feature} className={`grid grid-cols-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
              <span className="text-muted-foreground text-xs">{feature}</span>
              <span className="font-medium text-xs">{eu}</span>
              <span className="font-medium text-xs">{br}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Both varieties are mutually intelligible, but adjustment time is needed. Portuguese speakers sometimes joke they need "subtitles" for some Brazilian accents, and vice versa.</p>
      </CardContent>
    </Card>
  );
}

// ─── 8. Linking Sounds ────────────────────────────────────────────────────────

export function PtLinkingCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Ligação Fonética — Linking Sounds in Portuguese</SectionLabel>
        <p className="text-sm text-muted-foreground mb-4">Like French liaison, Portuguese links words together in speech — final consonants and vowels merge with the start of the next word.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Vowel Linking</SectionLabel>
            <div className="space-y-3">
              {[
                {
                  rule: 'Final vowel + initial vowel',
                  example: 'fala um pouco',
                  spoken: '"fa-LA-um-POW-ku"',
                  note: 'Words flow together, no break between vowels',
                },
                {
                  rule: 'Article + vowel-initial noun',
                  example: 'o amigo / a escola',
                  spoken: '"wah-MEE-goo / ah-SHKOH-la"',
                  note: 'Merges naturally in fast speech',
                },
                {
                  rule: 'Elision of unstressed e',
                  example: 'de + ele → dele',
                  spoken: '"DEH-leh"',
                  note: 'Mandatory contraction in writing',
                },
              ].map(({ rule, example, spoken, note }) => (
                <div key={rule} className="p-2 rounded-md bg-muted/50 border border-border/50">
                  <div className="text-xs text-muted-foreground font-medium mb-1">{rule}</div>
                  <div className="text-sm font-semibold">{example}</div>
                  <div className="text-[11px] font-mono text-primary">{spoken}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{note}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Common Contractions (Mandatory in Writing)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['de + o/a/os/as', 'do/da/dos/das', '"The coffee of the morning" = "o café da manhã"'],
                ['em + o/a/os/as', 'no/na/nos/nas', '"I am in the store" = "Estou na loja."'],
                ['a + o/os', 'ao/aos', '"I go to the market" = "Vou ao mercado."'],
                ['por + o/a', 'pelo/pela', '"Through the park" = "pelo parque"'],
                ['de + este/essa', 'deste/dessa', '"Of this" = "deste modo" (of this way)'],
                ['de + aquele', 'daquele', '"Of that (far)" = "daquele livro"'],
                ['em + este', 'neste', '"In this" = "neste momento" (at this moment)'],
                ['de + um/uma', 'dum/duma', '"Of a/an" (optional contraction)'],
              ].map(([from, to, ex], i) => (
                <div key={to + i} className={`px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex gap-2 items-center">
                    <span className="text-muted-foreground text-xs w-28 shrink-0">{from}</span>
                    <span className="font-mono font-bold text-primary">{to}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground pl-28 mt-0.5">{ex}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 9. Intonation ────────────────────────────────────────────────────────────

export function PtIntonationCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Entoação — Intonation Patterns in Portuguese</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Statement vs. Question Intonation</SectionLabel>
            <div className="space-y-4">
              {[
                {
                  type: 'Statement (declarative)',
                  pattern: 'Falls at the end ↘',
                  example: 'Ela fala português.',
                  desc: 'Voice drops at the end. Clear and definitive.',
                },
                {
                  type: 'Yes/No Question (BR)',
                  pattern: 'Rises at the end ↗',
                  example: 'Ela fala português?',
                  desc: 'Same words as statement — just rising intonation makes it a question in Brazil.',
                },
                {
                  type: 'Yes/No Question (EU-PT)',
                  pattern: 'Falls then rises ↘↗',
                  example: 'Fala ela português?',
                  desc: 'Inversion is more common in formal EU-PT. Intonation pattern is different.',
                },
                {
                  type: 'WH-Question',
                  pattern: 'Falls at the end ↘',
                  example: 'Onde ela mora?',
                  desc: 'Question word at start, voice falls at end (same as English WH-questions).',
                },
              ].map(({ type, pattern, example, desc }) => (
                <div key={type} className="p-2 rounded-md bg-muted/50 border border-border/50">
                  <div className="flex gap-2 items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold">{type}</span>
                    <span className="text-sm font-mono text-primary">{pattern}</span>
                  </div>
                  <div className="text-sm font-semibold">{example}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Regional Intonation Personality</SectionLabel>
            <div className="space-y-3">
              {[
                {
                  region: 'São Paulo (BR)',
                  character: 'Neutral, flat, fast',
                  note: 'Considered the "standard" Brazilian accent for media. Not too sing-song.',
                },
                {
                  region: 'Rio de Janeiro (BR)',
                  character: 'Melodic, musical',
                  note: 'Famous "carioca" accent — very musical with open vowels. Much R-aspiration.',
                },
                {
                  region: 'Nordeste Brazil',
                  character: 'Sing-song, open vowels',
                  note: 'Strong melodic quality. Often considered warmest and most musical accent.',
                },
                {
                  region: 'Portugal (Lisbon)',
                  character: 'Fast, clipped, flat',
                  note: 'Very different from BR — rapid, swallowed vowels, more monotone range.',
                },
                {
                  region: 'Portugal (Porto)',
                  character: 'Slower, more open',
                  note: 'Considered easier to understand than Lisbon Portuguese for Brazilian learners.',
                },
              ].map(({ region, character, note }) => (
                <div key={region} className="flex flex-col gap-0.5 py-2 border-b border-border/30 last:border-0">
                  <div className="flex gap-2 items-center">
                    <span className="text-sm font-semibold">{region}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground border border-border/60">{character}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
