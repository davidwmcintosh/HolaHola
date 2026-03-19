/**
 * TextbookGermanPhoneticGuides.tsx
 * Section 8 — German phonetic reference cards.
 *
 * Cards (9 total):
 *  DeUmlautsCard         — ä, ö, ü pronunciation
 *  DeEszettCard          — ß (Eszett / scharfes S)
 *  DeGermanRCard         — uvular R vs. other R variants
 *  DeChSoundCard         — ch after front vs. back vowels
 *  DeLongShortVowelsCard — long vs. short vowel pairs
 *  DeWVSoundCard         — German W (=V) and V (=F) confusion
 *  DeConsonantClustersCard — sp/st, z, s, sch sounds
 *  DeWordStressCard      — stress patterns in German
 *  DeDiphthongsCard      — ei/ai, au, eu/äu diphthongs
 */

function PhoneticCard({ title, subtitle, color = 'from-red-500/10', children }: {
  title: string; subtitle?: string; color?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className={`px-4 py-2.5 border-b bg-gradient-to-r ${color} to-transparent`}>
        <p className="text-sm font-semibold text-center">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground text-center">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function SoundRow({ symbol, desc, examples }: { symbol: string; desc: string; examples: string }) {
  return (
    <div className="flex gap-3 px-4 py-2 border-b last:border-0 text-xs">
      <span className="font-mono font-bold text-red-600 dark:text-red-400 min-w-12 shrink-0">{symbol}</span>
      <span className="text-muted-foreground min-w-32 shrink-0">{desc}</span>
      <span className="font-medium">{examples}</span>
    </div>
  );
}

// ─── UMLAUTS ──────────────────────────────────────────────────────────────────

export function DeUmlautsCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Deutsche Umlaute — Ä, Ö, Ü"
        subtitle="Three modified vowels unique to German — formed by rounding or fronting the tongue">
        <div className="divide-y">
          <SoundRow symbol="Ä / ä" desc='Like English "air" or "bed"' examples='Ä = ähm, Mädchen, spät, Käse' />
          <SoundRow symbol="Ö / ö" desc='Like French "eu" — lips rounded for "o", tongue for "e"' examples='schön, Öl, hören, mögen, zwölf' />
          <SoundRow symbol="Ü / ü" desc='Like French "u" — lips rounded for "u", tongue for "i"' examples='über, Tür, fühlen, Brücke, Stück' />
        </div>
        <div className="px-4 py-3 border-t bg-muted/20 text-xs space-y-1">
          <p className="font-semibold">Typing tip:</p>
          <p>If no umlaut keys: <span className="font-mono">ä → ae, ö → oe, ü → ue, ß → ss</span></p>
          <p className="text-muted-foreground">This substitution is used in email addresses, older documents, and informal texting.</p>
        </div>
      </PhoneticCard>
      <PhoneticCard title="Minimal pairs — Umlaut changes meaning" color="from-amber-500/10">
        <div className="grid grid-cols-2 gap-0 divide-x text-xs">
          <div className="divide-y">
            {[['schon','already'],['müde','tired'],['Höhle','cave'],['Zug','train']].map(([w,e])=>(
              <div key={w} className="px-4 py-1.5 flex justify-between">
                <span className="font-semibold">{w}</span><span className="text-muted-foreground">{e}</span>
              </div>
            ))}
          </div>
          <div className="divide-y">
            {[['schön','beautiful'],['Müde (same)','tired'],['Hölle','hell'],['Züge','trains (pl.)']].map(([w,e])=>(
              <div key={w} className="px-4 py-1.5 flex justify-between">
                <span className="font-semibold text-red-600 dark:text-red-400">{w}</span><span className="text-muted-foreground">{e}</span>
              </div>
            ))}
          </div>
        </div>
      </PhoneticCard>
    </div>
  );
}

// ─── ESZETT ───────────────────────────────────────────────────────────────────

export function DeEszettCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Das ß — Eszett / Scharfes S"
        subtitle="Represents a long 'ss' sound — only used after long vowels and diphthongs">
        <div className="divide-y text-xs">
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Rule: ß after LONG vowel or diphthong</p>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <p className="text-muted-foreground mb-1">ß (long vowel before):</p>
                <p>Straße (long a) — street</p>
                <p>Fuß (long u) — foot</p>
                <p>heiß (diphthong ei) — hot</p>
                <p>Maß (long a) — measure</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">ss (short vowel before):</p>
                <p>Fluss (short u) — river</p>
                <p>essen (short e) — to eat</p>
                <p>Wasser (short a) — water</p>
                <p>lassen (short a) — to let</p>
              </div>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Swiss German never uses ß</p>
            <p className="text-muted-foreground">Switzerland always writes <span className="font-mono">ss</span> — Strasse, Fuss, heiss (same words, different spelling)</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Uppercase ß</p>
            <p className="text-muted-foreground">The uppercase ẞ was officially introduced in 2017. Before that, ß capitalized as SS (STRASSE). Both forms now acceptable.</p>
          </div>
        </div>
      </PhoneticCard>
    </div>
  );
}

// ─── GERMAN R ─────────────────────────────────────────────────────────────────

export function DeGermanRCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Das Deutsche R — The German R Sound"
        subtitle="Most German Rs are produced in the back of the throat (uvular), not with the tongue tip">
        <div className="divide-y text-xs">
          <SoundRow symbol="[ʁ]" desc="Uvular fricative — most common standard German R" examples="Rad, rot, Regen, groß, Bruder" />
          <SoundRow symbol="[r]" desc="Trilled R — some regional and theatrical speech" examples="Less common in everyday speech" />
          <SoundRow symbol="[ɐ]" desc='Vowel-like "er" — unstressed final -er' examples='Vater, Mutter, Bruder, leider, aber' />
          <SoundRow symbol="[a]" desc='R absorbed — before consonant or end of word (informal)' examples='erst [eːɐst], Wort [vɔɐt]' />
        </div>
        <div className="px-4 py-3 border-t bg-muted/20 text-xs space-y-1.5">
          <p className="font-semibold">How to produce the uvular R:</p>
          <p className="text-muted-foreground">Gargle water sound at the back of your throat — where French R is produced. German R is slightly less voiced than French R.</p>
          <p className="font-semibold mt-2">-er at end of word = vocalic R (like "uh"):</p>
          <p className="text-muted-foreground">Vater sounds like "FAH-tuh" — the -er is not a full R sound but a neutral vowel.</p>
        </div>
      </PhoneticCard>
    </div>
  );
}

// ─── CH SOUND ─────────────────────────────────────────────────────────────────

export function DeChSoundCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Das CH — Two Different Sounds"
        subtitle="The ch sound changes depending on the vowel before it — front vs. back">
        <div className="divide-y text-xs">
          <SoundRow symbol="[ç] Ich-Laut" desc='After front vowels i, e, ä, ö, ü and after n, r, l' examples='ich, mich, nicht, Bücher, welche, Milch' />
          <SoundRow symbol="[x] Ach-Laut" desc='After back vowels a, o, u, au' examples='ach, auch, Buch, kochen, suchen, Bauch' />
          <SoundRow symbol="[k]" desc='ch in Greek/Latin words — chaos, Charakter' examples='Chaos, Charakter, Christoph, Chlor' />
          <SoundRow symbol="[ʃ]" desc='ch at start of French loanwords' examples='Chef, Chance, Champagner' />
        </div>
        <div className="px-4 py-3 border-t bg-muted/20 text-xs space-y-1">
          <p className="font-semibold">Memory trick:</p>
          <p className="text-muted-foreground"><span className="font-mono">ich</span> [ç] — like whispering "hue" or "huge" without the vowel: a soft hissing friction at the front palate.</p>
          <p className="text-muted-foreground mt-1"><span className="font-mono">ach</span> [x] — like the Scottish "loch" or clearing your throat. Further back in throat.</p>
        </div>
      </PhoneticCard>
    </div>
  );
}

// ─── LONG VS SHORT VOWELS ─────────────────────────────────────────────────────

export function DeLongShortVowelsCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Lange und kurze Vokale — Long vs. Short Vowels"
        subtitle="Vowel length changes meaning — long vowels are held roughly twice as long as short ones">
        <div className="divide-y text-xs">
          <div className="grid grid-cols-3 gap-0 divide-x bg-muted/20">
            <div className="px-3 py-1.5 font-semibold text-muted-foreground">Vowel</div>
            <div className="px-3 py-1.5 font-semibold text-red-600 dark:text-red-400">Long [:]</div>
            <div className="px-3 py-1.5 font-semibold text-blue-600 dark:text-blue-400">Short</div>
          </div>
          {[
            ['A / a', 'Staat [aː] (state)', 'Stadt [a] (city)'],
            ['E / e', 'Beet [eː] (flowerbed)', 'Bett [ɛ] (bed)'],
            ['I / i', 'ihm [iː] (him,dat.)', 'im [ɪ] (in the)'],
            ['O / o', 'Boot [oː] (boat)', 'Bott- [ɔ] (as in Bote)'],
            ['U / u', 'Mus [uː] (puree)', 'Muss [ʊ] (must)'],
            ['Ä / ä', 'Bären [ɛː] (bears)', 'Männer [ɛ] (men)'],
          ].map(([v, long, short]) => (
            <div key={v} className="grid grid-cols-3 gap-0 divide-x border-t">
              <div className="px-3 py-1.5 font-semibold">{v}</div>
              <div className="px-3 py-1.5 text-red-600 dark:text-red-400">{long}</div>
              <div className="px-3 py-1.5 text-blue-600 dark:text-blue-400">{short}</div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t bg-muted/20 text-xs space-y-1">
          <p className="font-semibold">Markers of long vowels:</p>
          <p className="text-muted-foreground">• Double vowel: aa (Staat), ee (See), oo (Boot)</p>
          <p className="text-muted-foreground">• Vowel + h: ah (Bahn), eh (mehr), oh (Ohr), uh (Uhr)</p>
          <p className="text-muted-foreground">• Vowel + single consonant: rot, gut, bis</p>
          <p className="font-semibold mt-1">Markers of short vowels:</p>
          <p className="text-muted-foreground">• Vowel + double consonant: Wasser, rennen, still</p>
          <p className="text-muted-foreground">• Vowel + multiple consonants: Herbst, Wurst, acht</p>
        </div>
      </PhoneticCard>
    </div>
  );
}

// ─── W AND V SOUNDS ───────────────────────────────────────────────────────────

export function DeWVSoundCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="W und V — Confusing for English Speakers"
        subtitle="German W sounds like English V. German V sounds like English F (usually).">
        <div className="divide-y text-xs">
          <SoundRow symbol="W = [v]" desc='Like English "V" — voiced labiodental fricative' examples='Wasser, wissen, Wort, Wetter, Woche' />
          <SoundRow symbol="V = [f]" desc='Like English "F" — in most German words' examples='Vogel, vier, Vater, von, viel' />
          <SoundRow symbol="V = [v]" desc='Like English "V" — in foreign/Latin loanwords' examples='Vase, Violine, Universität, Vitamin' />
        </div>
        <div className="px-4 py-3 border-t bg-muted/20 text-xs">
          <p className="font-semibold">Quick test:</p>
          <div className="space-y-1 mt-1">
            {[
              ['Wasser', '[ˈvasɐ]', 'water — W = English V'],
              ['vier', '[fiːɐ]', 'four — V = English F'],
              ['Vase', '[ˈvaːzə]', 'vase — V = English V (French loanword)'],
              ['von', '[fɔn]', 'from — V = English F'],
            ].map(([w, pron, note]) => (
              <div key={w} className="flex gap-3">
                <span className="font-semibold min-w-16">{w}</span>
                <span className="font-mono text-muted-foreground min-w-20">{pron}</span>
                <span className="text-muted-foreground">{note}</span>
              </div>
            ))}
          </div>
        </div>
      </PhoneticCard>
    </div>
  );
}

// ─── CONSONANT CLUSTERS ───────────────────────────────────────────────────────

export function DeConsonantClustersCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="SP, ST, Z, S, SCH — Key German Consonants"
        subtitle="Several German consonant combinations differ from English expectations">
        <div className="divide-y text-xs">
          <SoundRow symbol="SP- (start)" desc='"shp" — not "sp"' examples='spielen [ʃpiːlən], Sport [ʃpɔrt], spät [ʃpɛːt]' />
          <SoundRow symbol="ST- (start)" desc='"sht" — not "st"' examples='Straße [ʃtraːsə], Stadt [ʃtat], stehen [ʃteːən]' />
          <SoundRow symbol="Z" desc='"ts" — like pizza or cats' examples='Zeit [tsaɪt], zu [tsuː], Zug [tsuːk], zehn [tseːn]' />
          <SoundRow symbol="S + vowel" desc='"z" sound — voiced at start of syllable' examples='sagen [zaːgən], so [zoː], See [zeː]' />
          <SoundRow symbol="SCH" desc='"sh" — like English "sh"' examples='Schule, schön, Schiff, waschen, Flasche' />
          <SoundRow symbol="TH" desc='"t" — no English "th" in German' examples='Theater [teaːtɐ], Thema [teːma]' />
          <SoundRow symbol="PF" desc='Both sounds pronounced: "pf"' examples='Pferd, Pflanze, Topf, Kopf, empfehlen' />
        </div>
      </PhoneticCard>
    </div>
  );
}

// ─── WORD STRESS ──────────────────────────────────────────────────────────────

export function DeWordStressCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Wortakzent — Word Stress in German"
        subtitle="German stress is more predictable than English — usually on the root syllable">
        <div className="divide-y text-xs">
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Native German words</p>
            <p className="text-muted-foreground">Stress falls on the ROOT syllable (usually the first for simple words)</p>
            <div className="mt-1 space-y-0.5">
              {[['KINder','children'],['ARbeiten','to work'],['HANdy','mobile phone (German word!)'],['WINter','winter']].map(([w,e])=>(
                <div key={w} className="flex gap-3">
                  <span className="font-semibold min-w-28">{w}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Separable verbs — stress on PREFIX</p>
            <div className="space-y-0.5">
              {[['AUFmachen','to open'],['ANrufen','to call'],['EINkaufen','to shop']].map(([w,e])=>(
                <div key={w} className="flex gap-3">
                  <span className="font-semibold min-w-28">{w}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Inseparable prefixes — stress on ROOT (not prefix)</p>
            <p className="text-muted-foreground mb-1">be-, er-, ge-, miss-, ver-, zer- — NEVER stressed</p>
            <div className="space-y-0.5">
              {[['beSUchen','to visit'],['erKLÄren','to explain'],['verSTEhen','to understand']].map(([w,e])=>(
                <div key={w} className="flex gap-3">
                  <span className="font-semibold min-w-28">{w}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <p className="font-semibold mb-1">Loanwords — stress varies</p>
            <div className="space-y-0.5">
              {[['reSTAUrant','restaurant (French)'],['uniVERsität','university'],['teleFON','telephone']].map(([w,e])=>(
                <div key={w} className="flex gap-3">
                  <span className="font-semibold min-w-36">{w}</span>
                  <span className="text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PhoneticCard>
    </div>
  );
}

// ─── DIPHTHONGS ───────────────────────────────────────────────────────────────

export function DeDiphthongsCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Deutsche Diphthonge — German Diphthongs"
        subtitle="Gliding vowel sounds — two vowels blended in one syllable">
        <div className="divide-y text-xs">
          <SoundRow symbol="EI / AI" desc='[aɪ] — like English "eye" or "mine"' examples='ein, mein, weiß, Mai, Kaiser, frei, heizen' />
          <SoundRow symbol="AU" desc='[aʊ] — like English "cow" or "house"' examples='auch, Haus, kaufen, laufen, Baum, Frau' />
          <SoundRow symbol="EU / ÄU" desc='[ɔɪ] — like English "boy" or "oil"' examples='neu, heute, Leute, häufig, Bäume, treu' />
        </div>
        <div className="px-4 py-3 border-t bg-muted/20 text-xs space-y-1.5">
          <p className="font-semibold">⚠ EI vs IE — common confusion:</p>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div>
              <p className="font-semibold text-red-600 dark:text-red-400">EI = [aɪ] (like "eye")</p>
              <p>mein, dein, sein, weiß</p>
              <p className="text-muted-foreground">My, your, his, white</p>
            </div>
            <div>
              <p className="font-semibold text-blue-600 dark:text-blue-400">IE = [iː] (like "see")</p>
              <p>viel, Liebe, sie, wie</p>
              <p className="text-muted-foreground">Much, love, she, how</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-1">Tip: The second letter tells you: E at the end → [aɪ], E at the beginning → [iː]</p>
        </div>
      </PhoneticCard>
    </div>
  );
}
