/**
 * TextbookPhoneticGuides.tsx
 * Section 8 — Phonetic / Pronunciation Guides
 * All pure React — no image generation required.
 * Auto-triggered by chapter title via classifyGrammarType() in ChapterIntroduction.tsx.
 *
 * Components:
 *  VowelPurityCard      — A E I O U: pure Spanish vowels vs English diphthongs
 *  RolledRCard          — single R vs double RR, where each appears
 *  BVSoundCard          — B and V: same sound in Spanish
 *  SilentHCard          — the silent H rule + exceptions
 *  JSoundCard           — the guttural J (jota)
 *  NyenCard             — the Ñ sound
 *  LLYCard              — LL vs Y regional variation (yeísmo, sheísmo)
 *  StressAccentCard     — stress rules + when accent marks are written
 *  LinkingSoundsCard    — enlace: vowel linking between words
 */

// ─── SHARED BASE ──────────────────────────────────────────────────────────────

function PhoneticCard({
  title, subtitle, color = 'from-indigo-500/10', testId, children, className,
}: {
  title: string; subtitle?: string; color?: string; testId: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden`} data-testid={testId}>
      <div className={`px-4 py-2.5 border-b bg-gradient-to-r ${color} to-transparent`}>
        <p className="text-sm font-semibold text-center">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground text-center">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ExampleWord({ sp, ipa, en }: { sp: string; ipa: string; en: string }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="font-semibold text-foreground w-24 shrink-0">{sp}</span>
      <span className="text-muted-foreground font-mono w-20 shrink-0">[{ipa}]</span>
      <span className="text-muted-foreground">{en}</span>
    </div>
  );
}

// ─── VOWEL PURITY ─────────────────────────────────────────────────────────────

export function VowelPurityCard({ className = '' }: { className?: string }) {
  const vowels = [
    { v: 'A', ipa: 'a', like: 'f-a-ther (no glide)', words: ['casa', 'alma', 'gracias'] },
    { v: 'E', ipa: 'e', like: 'b-e-d (no "uh" finish)', words: ['mesa', 'verde', 'café'] },
    { v: 'I', ipa: 'i', like: 'mach-i-ne (pure)', words: ['sí', 'libro', 'vivir'] },
    { v: 'O', ipa: 'o', like: 'n-o (no "uh" glide)', words: ['hola', 'como', 'otro'] },
    { v: 'U', ipa: 'u', like: 'fl-u-te (pure "oo")', words: ['mucho', 'gusto', 'tú'] },
  ];
  return (
    <PhoneticCard title="Spanish Vowels — Las Vocales" subtitle="Pure, short, and consistent — no diphthong glides" color="from-sky-500/10" testId="grammar-card-vowel-purity" className={className}>
      <div className="grid grid-cols-5 divide-x border-b">
        {vowels.map(({ v, ipa }) => (
          <div key={v} className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{v}</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">[{ipa}]</p>
          </div>
        ))}
      </div>
      <div className="divide-y">
        {vowels.map(({ v, like, words }) => (
          <div key={v} className="px-3 py-2 grid grid-cols-[20px_1fr_auto] gap-3 items-start text-xs">
            <span className="font-bold text-primary text-sm">{v}</span>
            <div>
              <p className="font-medium text-foreground mb-1">Like the vowel in: {like}</p>
              <p className="text-muted-foreground">{words.join(' · ')}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t bg-amber-500/5">
        <p className="text-xs text-amber-700 dark:text-amber-300">Key difference from English: Spanish vowels are short and pure — English vowels glide into another sound at the end. Say each Spanish vowel and stop abruptly.</p>
      </div>
    </PhoneticCard>
  );
}

// ─── ROLLED R ─────────────────────────────────────────────────────────────────

export function RolledRCard({ className = '' }: { className?: string }) {
  return (
    <PhoneticCard title="The Spanish R — La Erre" subtitle="Two R sounds — flap vs. trill" color="from-rose-500/10" testId="grammar-card-rolled-r" className={className}>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <p className="text-sm font-bold text-foreground mb-1">Single R &nbsp;<span className="font-mono text-muted-foreground text-xs">[ɾ]</span></p>
          <p className="text-xs text-muted-foreground mb-2">A quick flap — like the "dd" in English "ladder"</p>
          <p className="text-xs font-medium mb-1.5">Position: between vowels or before consonant</p>
          <div className="space-y-1 text-xs">
            <ExampleWord sp="pero" ipa="ˈpe.ɾo" en="but" />
            <ExampleWord sp="para" ipa="ˈpa.ɾa" en="for" />
            <ExampleWord sp="caro" ipa="ˈka.ɾo" en="expensive" />
            <ExampleWord sp="ahora" ipa="a.ˈo.ɾa" en="now" />
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-1">Double RR &nbsp;<span className="font-mono text-muted-foreground text-xs">[r]</span></p>
          <p className="text-xs text-muted-foreground mb-2">A full trill — tongue vibrates against the roof of the mouth</p>
          <p className="text-xs font-medium mb-1.5">Also: single R at start of word, or after n/l/s</p>
          <div className="space-y-1 text-xs">
            <ExampleWord sp="perro" ipa="ˈpe.ro" en="dog" />
            <ExampleWord sp="carro" ipa="ˈka.ro" en="car" />
            <ExampleWord sp="rico" ipa="ˈri.ko" en="rich/delicious" />
            <ExampleWord sp="alrededor" ipa="al.re.ðe.ˈðor" en="around" />
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">pero</span> (but) vs <span className="font-semibold text-foreground">perro</span> (dog) — the only difference is one R vs two. Getting this right avoids confusion!</p>
      </div>
    </PhoneticCard>
  );
}

// ─── B VS V ───────────────────────────────────────────────────────────────────

export function BVSoundCard({ className = '' }: { className?: string }) {
  return (
    <PhoneticCard title="B and V in Spanish — La B y la V" subtitle="Both letters make the same sound — unlike English" color="from-blue-500/10" testId="grammar-card-bv-sound" className={className}>
      <div className="grid grid-cols-2 divide-x border-b">
        <div className="p-4">
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2">B &nbsp;<span className="font-mono text-xs text-muted-foreground">[b] or [β]</span></p>
          <div className="space-y-1 text-xs">
            <ExampleWord sp="boca" ipa="ˈbo.ka" en="mouth" />
            <ExampleWord sp="banco" ipa="ˈbaŋ.ko" en="bank" />
            <ExampleWord sp="hablar" ipa="a.ˈβlar" en="to speak" />
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2">V &nbsp;<span className="font-mono text-xs text-muted-foreground">[b] or [β]</span></p>
          <div className="space-y-1 text-xs">
            <ExampleWord sp="vino" ipa="ˈbi.no" en="wine" />
            <ExampleWord sp="verde" ipa="ˈber.ðe" en="green" />
            <ExampleWord sp="vivir" ipa="bi.ˈβir" en="to live" />
          </div>
        </div>
      </div>
      <div className="p-4 space-y-2 text-xs">
        <p className="font-semibold">Two allophones — one letter pair:</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded p-2">
            <p className="font-medium mb-1">Hard [b]</p>
            <p className="text-muted-foreground">At start of word or after m/n</p>
            <p className="font-medium mt-1">voy, también, enviar</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <p className="font-medium mb-1">Soft [β] (fricative)</p>
            <p className="text-muted-foreground">Between vowels or in other positions</p>
            <p className="font-medium mt-1">hablar, saber, nuevo</p>
          </div>
        </div>
        <p className="text-muted-foreground">In Spanish spelling, B is called <span className="font-medium text-foreground">"be alta"</span> or <span className="font-medium text-foreground">"be grande"</span> and V is <span className="font-medium text-foreground">"uve"</span> or <span className="font-medium text-foreground">"ve chica"</span> — but they sound identical.</p>
      </div>
    </PhoneticCard>
  );
}

// ─── SILENT H ─────────────────────────────────────────────────────────────────

export function SilentHCard({ className = '' }: { className?: string }) {
  return (
    <PhoneticCard title="The Silent H — La H muda" subtitle="H is always silent in Spanish — never pronounced" color="from-slate-500/10" testId="grammar-card-silent-h" className={className}>
      <div className="p-4 space-y-3 text-xs">
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="font-semibold text-center text-base mb-1">H = silent</p>
          <p className="text-muted-foreground text-center">Always. No exceptions in native Spanish words.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-semibold mb-1.5">Common H-words</p>
            <div className="space-y-1">
              {[
                ['hablar', 'to speak → "a-BLAR"'],
                ['hola', 'hello → "O-la"'],
                ['hotel', 'hotel → "o-TEL"'],
                ['hora', 'hour → "O-ra"'],
                ['hacer', 'to do → "a-SER"'],
                ['hijo/a', 'son/daughter → "I-ho"'],
              ].map(([w, pron]) => (
                <div key={w}>
                  <span className="font-medium text-foreground">{w}</span>
                  <span className="text-muted-foreground ml-1">— {pron}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-1.5">Why this matters</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>· Don't aspirate H like in English</li>
              <li>· "Hotel" in Spanish = pure vowel "o" start</li>
              <li>· "Ahora" sounds like "a-O-ra" — two vowels link</li>
              <li>· CH is a different sound: "ch" in "church"</li>
            </ul>
            <div className="bg-amber-500/10 rounded p-2 mt-2 border border-amber-500/20">
              <p className="font-medium text-amber-700 dark:text-amber-300">Exception: words borrowed from other languages may be pronounced with an H sound (e.g. "hámster"). But these are rare.</p>
            </div>
          </div>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── J SOUND ──────────────────────────────────────────────────────────────────

export function JSoundCard({ className = '' }: { className?: string }) {
  return (
    <PhoneticCard title='The Spanish J — La Jota' subtitle='A guttural sound — the throat, not the lips' color="from-orange-500/10" testId="grammar-card-j-sound" className={className}>
      <div className="p-4 space-y-3 text-xs">
        <div className="grid grid-cols-3 gap-2 text-center border-b pb-3">
          <div className="rounded bg-muted/30 p-2">
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">J</p>
            <p className="font-mono text-muted-foreground">[x]</p>
            <p className="text-muted-foreground mt-1">always "jota"</p>
          </div>
          <div className="rounded bg-muted/30 p-2">
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">G + e/i</p>
            <p className="font-mono text-muted-foreground">[x]</p>
            <p className="text-muted-foreground mt-1">same sound as J</p>
          </div>
          <div className="rounded bg-muted/20 p-2">
            <p className="text-xl font-bold text-muted-foreground">G + a/o/u</p>
            <p className="font-mono text-muted-foreground">[g]</p>
            <p className="text-muted-foreground mt-1">hard G (like "go")</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-semibold mb-1.5">J and G+e/i words (jota sound)</p>
            <div className="space-y-1">
              {[
                ['jefe', 'boss → "HE-feh"'],
                ['mejor', 'better → "meh-HOR"'],
                ['trabajo', 'work → "tra-BA-ho"'],
                ['gente', 'people → "HEN-teh"'],
                ['general', 'general → "he-ne-RAL"'],
                ['joven', 'young → "HO-ben"'],
              ].map(([w, p]) => (
                <div key={w}>
                  <span className="font-medium">{w}</span>
                  <span className="text-muted-foreground ml-1">{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-1.5">How to produce the [x] sound</p>
            <div className="bg-muted/30 rounded p-2 space-y-1 text-muted-foreground">
              <p>1. Open your mouth slightly</p>
              <p>2. Raise the back of your tongue toward the soft palate</p>
              <p>3. Push air through — like clearing your throat gently</p>
              <p>4. Closer to Scottish "loch" or German "Bach" than English H</p>
            </div>
            <div className="bg-orange-500/5 rounded p-2 mt-2 border border-orange-500/20">
              <p className="font-medium text-orange-700 dark:text-orange-300">Regional variation: In parts of Latin America and Andalusia, J is softer — closer to English H. In Castilian Spain and Andean regions, it's fully guttural.</p>
            </div>
          </div>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── Ñ ────────────────────────────────────────────────────────────────────────

export function NyenCard({ className = '' }: { className?: string }) {
  return (
    <PhoneticCard title="The Ñ — La Eñe" subtitle="A palatalized N — like the 'ny' in 'canyon'" color="from-emerald-500/10" testId="grammar-card-nyen" className={className}>
      <div className="p-4 space-y-3 text-xs">
        <div className="flex gap-4 items-center border-b pb-3">
          <div className="text-center">
            <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">Ñ</p>
            <p className="font-mono text-muted-foreground">[ɲ]</p>
          </div>
          <div className="flex-1">
            <p className="font-semibold mb-1">Sounds like:</p>
            <ul className="text-muted-foreground space-y-0.5">
              <li>· "ny" in can<span className="font-bold text-foreground">y</span>on</li>
              <li>· "ni" in on<span className="font-bold text-foreground">io</span>n</li>
              <li>· "gn" in Italian sig<span className="font-bold text-foreground">n</span>ore</li>
              <li>· "gn" in French Breta<span className="font-bold text-foreground">gn</span>e</li>
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-semibold mb-1.5">Common Ñ words</p>
            <div className="space-y-1">
              {[
                ['niño/a', 'child', 'NEE-nyoh'],
                ['mañana', 'morning/tomorrow', 'ma-NYA-na'],
                ['año', 'year', 'A-nyoh'],
                ['español', 'Spanish', 'es-pa-NYOL'],
                ['señor/a', 'sir/madam/Mr./Mrs.', 'se-NYOR'],
                ['baño', 'bathroom', 'BA-nyoh'],
              ].map(([w, en, pron]) => (
                <div key={w} className="flex gap-2 items-baseline">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 w-16 shrink-0">{w}</span>
                  <span className="text-foreground w-20 shrink-0">{en}</span>
                  <span className="text-muted-foreground">{pron}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-1.5">How to type Ñ</p>
            <div className="rounded bg-muted/30 p-2 space-y-1 text-muted-foreground">
              <p><span className="font-medium text-foreground">Mac:</span> Option + N, then N</p>
              <p><span className="font-medium text-foreground">Windows:</span> Alt + 0241 (numpad)</p>
              <p><span className="font-medium text-foreground">Mobile:</span> Long-press N key</p>
              <p><span className="font-medium text-foreground">Linux:</span> Compose + ~ + N</p>
            </div>
            <div className="bg-emerald-500/5 rounded p-2 mt-2 border border-emerald-500/20">
              <p className="text-emerald-700 dark:text-emerald-300">Historical note: Ñ evolved from writing "nn" in medieval manuscripts. Spanish scribes drew a tilde (~) above the first N to show the double — this became the Ñ.</p>
            </div>
          </div>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── LL / Y ───────────────────────────────────────────────────────────────────

export function LLYCard({ className = '' }: { className?: string }) {
  return (
    <PhoneticCard title="LL and Y — Yeísmo y Sheísmo" subtitle="Regional variation in one of Spanish's most interesting sound shifts" color="from-teal-500/10" testId="grammar-card-lly" className={className}>
      <div className="overflow-x-auto border-b">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">System</th>
              <th className="px-3 py-1.5 text-left font-semibold">LL sounds like</th>
              <th className="px-3 py-1.5 text-left font-semibold">Y sounds like</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Where spoken</th>
            </tr>
          </thead>
          <tbody>
            {[
              { system: 'Distinción', ll: '[ʎ] — like "lli" in "million"', y: '[j] — like "y" in "yes"', where: 'Parts of Spain (decreasing)' },
              { system: 'Yeísmo', ll: '[j] — same as Y', y: '[j] — "yes"', where: 'Most of Latin America, much of Spain' },
              { system: 'Sheísmo', ll: '[ʃ] or [ʒ] — like "sh" or "zh"', y: '[ʃ] or [ʒ]', where: 'Argentina, Uruguay' },
            ].map(({ system, ll, y, where }, i) => (
              <tr key={system} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                <td className="px-3 py-2 font-semibold text-teal-600 dark:text-teal-400">{system}</td>
                <td className="px-3 py-2 font-mono">{ll}</td>
                <td className="px-3 py-2 font-mono">{y}</td>
                <td className="px-3 py-2 text-muted-foreground">{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="font-semibold mb-1.5">Minimal pairs (only differ in LL/Y)</p>
          <div className="space-y-1">
            {[
              ['calló', 'he/she was silent', 'cayó', 'he/she fell'],
              ['halla', 'he/she finds', 'haya', 'may there be'],
              ['pollo', 'chicken', 'poyo', 'stone bench'],
            ].map(([w1, m1, w2, m2]) => (
              <div key={w1}>
                <span className="font-medium">{w1}</span><span className="text-muted-foreground"> ({m1})</span>
                <span className="mx-1 text-muted-foreground">vs</span>
                <span className="font-medium">{w2}</span><span className="text-muted-foreground"> ({m2})</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="font-semibold mb-1.5">Practical advice</p>
          <div className="bg-teal-500/5 rounded p-2 border border-teal-500/20 text-muted-foreground space-y-1">
            <p>· For most learners, yeísmo is the "safest" standard (same as most of Latin America and modern Spain)</p>
            <p>· Both LL and Y → [j] like "yes" in English. Easy!</p>
            <p>· If you're learning Argentine Spanish, practice [ʃ] "sh"</p>
          </div>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── STRESS & ACCENT MARKS ────────────────────────────────────────────────────

export function StressAccentCard({ className = '' }: { className?: string }) {
  return (
    <PhoneticCard title="Stress & Accent Marks — El Acento" subtitle="Spanish stress is predictable — accent marks only break the rules" color="from-amber-500/10" testId="grammar-card-stress-accent" className={className}>
      <div className="divide-y text-xs">
        <div className="p-4">
          <p className="font-semibold mb-2">Default stress rules (no accent mark needed)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded p-2">
              <p className="font-medium mb-1">Rule 1 — Words ending in <span className="text-foreground font-bold">vowel, N, or S</span></p>
              <p className="text-muted-foreground">Stress falls on the <span className="text-foreground font-medium">second-to-last</span> syllable</p>
              <p className="mt-1"><span className="font-bold">HA-blo</span> · <span className="font-bold">CA-sa</span> · <span className="font-bold">e-TU-dian</span></p>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <p className="font-medium mb-1">Rule 2 — Words ending in <span className="text-foreground font-bold">consonant</span> (except N/S)</p>
              <p className="text-muted-foreground">Stress falls on the <span className="text-foreground font-medium">last</span> syllable</p>
              <p className="mt-1"><span className="font-bold">ha-BLAR</span> · <span className="font-bold">ciu-DAD</span> · <span className="font-bold">es-pa-ÑOL</span></p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="font-semibold mb-2">When an accent mark IS written</p>
          <div className="space-y-2">
            {[
              { rule: 'Breaks default stress', ex: 'café, mamá, fácil, árbol', why: 'Stress doesn\'t follow the default rule' },
              { rule: 'Question/exclamation words', ex: '¿Qué? ¿Cómo? ¿Dónde? ¿Cuándo?', why: 'Always accented in questions & exclamations' },
              { rule: 'Disambiguating homophones', ex: 'el (the) vs él (he) · tu (your) vs tú (you) · si (if) vs sí (yes)', why: 'Same spelling, different meaning' },
            ].map(({ rule, ex, why }) => (
              <div key={rule} className="grid grid-cols-[140px_1fr] gap-2">
                <p className="font-medium text-amber-700 dark:text-amber-400">{rule}</p>
                <div>
                  <p className="font-medium text-foreground">{ex}</p>
                  <p className="text-muted-foreground">{why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4">
          <p className="font-semibold mb-1.5">Stress shifting in verb forms</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['hablo', 'HA-blo', 'I speak'],
              ['habló', 'ha-BLÓ', 'he/she spoke'],
              ['háblame', 'HA-bla-me', 'talk to me (command)'],
            ].map(([w, stress, en]) => (
              <div key={w} className="bg-muted/20 rounded p-2 text-center">
                <p className="font-bold text-foreground">{w}</p>
                <p className="text-muted-foreground">{stress}</p>
                <p className="text-muted-foreground">{en}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── LINKING SOUNDS ───────────────────────────────────────────────────────────

export function LinkingSoundsCard({ className = '' }: { className?: string }) {
  return (
    <PhoneticCard title="Linking Sounds — El Enlace" subtitle="In spoken Spanish, words flow together — vowels link across word boundaries" color="from-indigo-500/10" testId="grammar-card-linking-sounds" className={className}>
      <div className="divide-y text-xs">
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="font-semibold mb-2">Type 1: Vowel + Vowel link</p>
            <p className="text-muted-foreground mb-2">When a word ends in a vowel and the next begins with a vowel, they blend into one syllable.</p>
            <div className="space-y-2">
              {[
                ['me alegra', 'me·a·le·gra → "mya·le·gra"'],
                ['la única', 'la·ú·ni·ca → "lwú·ni·ca"'],
                ['hablo así', 'ha·blo·a·sí → "ha·blo·sí"'],
              ].map(([phrase, link]) => (
                <div key={phrase}>
                  <p className="font-medium text-foreground">{phrase}</p>
                  <p className="text-muted-foreground font-mono">{link}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-2">Type 2: Same vowel across boundary</p>
            <p className="text-muted-foreground mb-2">Two identical vowels at a word boundary merge into one longer vowel.</p>
            <div className="space-y-2">
              {[
                ['me enojo', '"me·no·jo" (one e)'],
                ['de España', '"des·pa·ña" (merge)'],
                ['habla alemán', '"ha·bla·le·mán"'],
              ].map(([phrase, link]) => (
                <div key={phrase}>
                  <p className="font-medium text-foreground">{phrase}</p>
                  <p className="text-muted-foreground font-mono">{link}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="font-semibold mb-2">Why this matters for listening comprehension</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { written: '"los otros"', heard: '"lo-so-tros"', note: 'S from "los" joins the next word' },
              { written: '"en el"', heard: '"e-nel"', note: 'N from "en" links to "el"' },
              { written: '"¿Cómo estás?"', heard: '"có-moes-tás"', note: 'O and E merge — 4 syllables' },
            ].map(({ written, heard, note }) => (
              <div key={written} className="bg-indigo-500/5 rounded p-2 border border-indigo-500/15">
                <p className="font-medium text-foreground">{written}</p>
                <p className="font-mono text-indigo-600 dark:text-indigo-400">{heard}</p>
                <p className="text-muted-foreground mt-0.5">{note}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 py-2.5 bg-muted/20">
          <p className="text-muted-foreground">Native speakers don't pause between words — Spanish flows as one continuous stream. This is why "fast Spanish" sounds fast: fewer pauses, more linking.</p>
        </div>
      </div>
    </PhoneticCard>
  );
}
