/**
 * TextbookItalianPhoneticGuides.tsx
 * Section 8 — Italian phonetic reference cards.
 *
 * Cards (9 total):
 *  ItCGSoundsCard          — C and G before different vowels (ca/co/cu vs ce/ci)
 *  ItSCSoundsCard          — SC combinations (sca vs sce/sci)
 *  ItGLGNCard              — GLI and GN sounds (palatal consonants)
 *  ItDoubleConsonantCard   — Geminate / double consonants
 *  ItZSoundCard            — Z as /ts/ or /dz/
 *  ItRolledRCard           — Italian rolled R (trilled)
 *  ItOpenClosedVowelsCard  — Open vs closed E and O (è vs é, ò vs ó)
 *  ItStressPatternsCard    — Word stress and accent marks
 *  ItDiphthongsCard        — Italian diphthongs (ia, ie, io, iu, ua, ue…)
 */

function PhoneticCard({ title, subtitle, color = 'from-green-500/10', children }: {
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
      <span className="font-mono font-bold text-green-700 dark:text-green-400 min-w-12 shrink-0">{symbol}</span>
      <span className="text-muted-foreground min-w-36 shrink-0">{desc}</span>
      <span className="font-medium">{examples}</span>
    </div>
  );
}

// ─── C AND G SOUNDS ───────────────────────────────────────────────────────────

export function ItCGSoundsCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="C e G — Hard vs Soft Sounds"
        subtitle="C and G change pronunciation based on the vowel that follows">
        <div className="px-4 py-2 text-xs font-semibold border-b text-green-700 dark:text-green-400">The Letter C</div>
        <SoundRow symbol="ca / co / cu" desc="Hard /k/ sound" examples="casa, cane, corpo, cura, caffè, amico" />
        <SoundRow symbol="ce / ci" desc="Soft /ch/ sound (like 'cheese')" examples="cena, cinema, ciao, città, dolce, grazie" />
        <SoundRow symbol="che / chi" desc="Hard /k/ before e/i (add H)" examples="che, chiesa, perché, amiche, chi, chiave" />
        <SoundRow symbol="cia / cio / ciu" desc="Soft /ch/ + vowel (I silent)" examples="ciao, cioccolato, cielo, arancia" />
      </PhoneticCard>
      <PhoneticCard title="The Letter G"
        subtitle="Same pattern as C — hard before a/o/u, soft before e/i">
        <SoundRow symbol="ga / go / gu" desc="Hard /g/ sound (like 'go')" examples="gatto, golf, gusto, lago, agosto" />
        <SoundRow symbol="ge / gi" desc="Soft /j/ sound (like 'genre')" examples="gelato, giro, giorno, giugno, magia" />
        <SoundRow symbol="ghe / ghi" desc="Hard /g/ before e/i (add H)" examples="ghiaccio, spaghetti, funghi, laghi" />
        <SoundRow symbol="gia / gio / giu" desc="Soft /j/ + vowel (I silent)" examples="già, giorno, giugno, giacca, giovane" />
      </PhoneticCard>
    </div>
  );
}

// ─── SC SOUNDS ────────────────────────────────────────────────────────────────

export function ItSCSoundsCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="SC — The Shifting Sound"
        subtitle="SC follows the same hard/soft rule as C">
        <SoundRow symbol="sca / sco / scu" desc="Hard /sk/ sound" examples="scala, scuola, disco, scopo, scorpione" />
        <SoundRow symbol="sce / sci" desc="Soft /sh/ sound (like 'shoe')" examples="scena, sciare, sciopero, lascia, uscire" />
        <SoundRow symbol="sche / schi" desc="Hard /sk/ before e/i (add H)" examples="scheda, schiavo, pesche, maschio" />
        <SoundRow symbol="scia / scio / sciu" desc="Soft /sh/ + vowel (I silent)" examples="sciare, sciopero, lasciare, prosciutto" />
      </PhoneticCard>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-semibold mb-2 text-green-700 dark:text-green-400">Quick Reference: Hard vs Soft Rule</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="font-bold">+ A, O, U</p>
            <p className="text-muted-foreground">Hard sound</p>
            <p className="font-mono">C=/k/ G=/g/ SC=/sk/</p>
          </div>
          <div className="rounded-md bg-green-500/10 p-2">
            <p className="font-bold">+ E, I</p>
            <p className="text-muted-foreground">Soft sound</p>
            <p className="font-mono">C=/ch/ G=/j/ SC=/sh/</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="font-bold">+ HE, HI</p>
            <p className="text-muted-foreground">Hard (override)</p>
            <p className="font-mono">CHE CHI GHE GHI</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GL AND GN ────────────────────────────────────────────────────────────────

export function ItGLGNCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="GLI e GN — Palatal Consonants"
        subtitle="Two sounds unique to Italian — no exact English equivalent">
        <SoundRow symbol="GLI" desc='Like "lli" in "million" — palatal /ʎ/' examples='figlio (son), moglie (wife), gli (the/to him), luglio, aglio (garlic)' />
        <SoundRow symbol="GN" desc='Like "ny" in "canyon" — palatal /ɲ/' examples="gnocchi, bagno (bath), sogno (dream), campagna, montagna, signore" />
      </PhoneticCard>
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400">Practice pairs</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div>
            <p className="font-medium">GLI words to know:</p>
            <div className="space-y-0.5 text-muted-foreground mt-0.5">
              <p>figlio — son</p>
              <p>foglio — sheet of paper</p>
              <p>migliore — better</p>
              <p>sbaglio — mistake</p>
              <p>consiglio — advice</p>
            </div>
          </div>
          <div>
            <p className="font-medium">GN words to know:</p>
            <div className="space-y-0.5 text-muted-foreground mt-0.5">
              <p>gnocchi — potato dumplings</p>
              <p>lavagna — blackboard</p>
              <p>ingegnere — engineer</p>
              <p>bisogno — need</p>
              <p>ognuno — everyone</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic">Tip: "Gnocchi" is pronounced "nyoki" — the G and N together make one palatal sound.</p>
      </div>
    </div>
  );
}

// ─── DOUBLE CONSONANTS ────────────────────────────────────────────────────────

export function ItDoubleConsonantCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Consonanti Doppie — Geminate Consonants"
        subtitle="Double consonants are held longer — they change meaning!">
        <SoundRow symbol="papa/papà" desc="father (accent = stress)" examples="papa = Pope / papà = dad" />
        <SoundRow symbol="pala/palla" desc="changes meaning" examples="pala = shovel / palla = ball" />
        <SoundRow symbol="sono/sonno" desc="changes meaning" examples="sono = I am / sonno = sleep" />
        <SoundRow symbol="caro/carro" desc="changes meaning" examples="caro = dear/expensive / carro = cart" />
        <SoundRow symbol="sano/sanno" desc="changes meaning" examples="sano = healthy / sanno = they know" />
        <SoundRow symbol="nono/nonno" desc="changes meaning" examples="nono = ninth / nonno = grandfather" />
      </PhoneticCard>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-semibold mb-1 text-green-700 dark:text-green-400">How to pronounce double consonants</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>• Hold the consonant sound for approximately twice as long as a single consonant.</p>
          <p>• Think of it as "double effort" — for "tt" in "letto" (bed), you briefly stop airflow before releasing: let-to.</p>
          <p>• For stop consonants (p, b, t, d, k, g): build up pressure, then release.</p>
          <p>• For fricatives (s, f, v, z): extend the friction sound: rrr, sss, fff.</p>
          <p className="font-medium text-foreground">• All Italian consonants can be doubled — this is one of the most distinctive features of Italian pronunciation.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Z SOUND ──────────────────────────────────────────────────────────────────

export function ItZSoundCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="La Lettera Z — Two Pronunciations"
        subtitle="Z can sound like /ts/ (voiceless) or /dz/ (voiced) — varies by word and region">
        <SoundRow symbol="Z = /ts/" desc='Like "ts" in "pizza" — voiceless' examples="pizza, pizza, grazie, stazione, nazione, prezioso, zucchero, terzo" />
        <SoundRow symbol="Z = /dz/" desc='Like "ds" in "odds" — voiced' examples="zero, zona, zio (uncle), zaino, zoo, azzurro (azure), mezzo" />
        <SoundRow symbol="ZZ = /tts/" desc='Double Z = stronger /ts/ sound' examples="pizza (pit-tsa!), mozzarella, razza, piazza, palazzo, pozzo" />
      </PhoneticCard>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-semibold mb-2 text-green-700 dark:text-green-400">Regional variation</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>• In Northern Italy, Z tends toward /dz/ more often.</p>
          <p>• In Central and Southern Italy, Z tends toward /ts/ more often.</p>
          <p>• The distinction is not always consistent — learners should learn word by word for common vocabulary.</p>
          <p className="font-medium text-foreground">• Key rule: At the beginning of a word before a vowel, Z is usually /dz/ (zero, zaino, zoo). Inside words, /ts/ is more common (nazione, stazione).</p>
        </div>
      </div>
    </div>
  );
}

// ─── ROLLED R ─────────────────────────────────────────────────────────────────

export function ItRolledRCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="La R Italiana — The Rolled R"
        subtitle="Italian R is an alveolar trill /r/ — the tongue tip vibrates against the upper gum ridge">
        <SoundRow symbol="R" desc="Single R — light trill or tap" examples="Roma, rosso, pera (pear), mare (sea), caro (dear)" />
        <SoundRow symbol="RR" desc="Double R — stronger trill (longer)" examples="terra, ferro, birra, carro, sorriso (smile)" />
        <SoundRow symbol="TR / PR / CR" desc="R after consonant — clear trill" examples="tre (three), prego, crema, strada, attraverso" />
      </PhoneticCard>
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400">How to practice the Italian R</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>1. <span className="font-medium text-foreground">Say "butter" or "ladder" quickly</span> — the sound in the middle (American English) is a tap /ɾ/, the closest single-tap version.</p>
          <p>2. <span className="font-medium text-foreground">Place the tongue tip</span> just behind the upper front teeth at the gum ridge (not curled back like American R).</p>
          <p>3. <span className="font-medium text-foreground">Practice "drrr"</span> — say it like an engine revving. Gradually relax the tongue to get a trill.</p>
          <p>4. <span className="font-medium text-foreground">Unlike German</span>, the Italian R is an alveolar (front of mouth) trill, not uvular (back of throat).</p>
          <p>5. Italian R is essentially the same as Spanish R — if you can roll your R in Spanish, you've got Italian!</p>
        </div>
      </div>
    </div>
  );
}

// ─── OPEN AND CLOSED VOWELS ───────────────────────────────────────────────────

export function ItOpenClosedVowelsCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="Vocali Aperte e Chiuse — Open and Closed Vowels"
        subtitle="Italian E and O each have two pronunciations — open and closed">
        <div className="px-4 py-2 text-xs font-semibold border-b text-green-700 dark:text-green-400">The Vowel E</div>
        <SoundRow symbol="È (open e)" desc='Like "e" in "bed" — /ɛ/' examples="è (is), bello, sette, prendere, terra, festa" />
        <SoundRow symbol="É (closed e)" desc='Like "ay" in "hey" (no glide) — /e/' examples="me, te, verde, leggere, perché, ché" />
        <div className="px-4 py-2 text-xs font-semibold border-b text-green-700 dark:text-green-400">The Vowel O</div>
        <SoundRow symbol="Ò (open o)" desc='Like "o" in British "not" — /ɔ/' examples="cosa, sotto, uomo, porta, forte, corpo" />
        <SoundRow symbol="Ó (closed o)" desc='Like "o" in "no" (shorter) — /o/' examples="come, nome, sole, posto, modo, solo" />
        <div className="px-4 py-2 text-xs font-semibold border-b text-green-700 dark:text-green-400">A, I, U — Always clear</div>
        <SoundRow symbol="A" desc='Always open: "ah"' examples="padre, casa, amare, grande, cane" />
        <SoundRow symbol="I" desc='Always clear: "ee"' examples="vino, isola, libro, qui, vicino" />
        <SoundRow symbol="U" desc='Always rounded: "oo"' examples="uno, uva, buono, luna, cuore" />
      </PhoneticCard>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground italic">Note: The open/closed E and O distinction is more pronounced in Tuscan standard Italian. Regional accents vary — Southerners often use more open vowels, Northerners more closed. Written Italian only marks the accent on final stressed syllables (caffè, però, virtù).</p>
      </div>
    </div>
  );
}

// ─── STRESS PATTERNS ──────────────────────────────────────────────────────────

export function ItStressPatternsCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="L'Accento Tonico — Word Stress in Italian"
        subtitle="Most Italian words are stressed on the second-to-last syllable (penultimate stress)">
        <SoundRow symbol="Penultimate" desc="Stress on 2nd-to-last (most common)" examples="pa-RO-la, ca-SA, gio-VA-ne, man-GIA-re" />
        <SoundRow symbol="Antepenultimate" desc="Stress on 3rd-to-last (common)" examples="MA-chi-na, TAV-o-la, NÚ-me-ro, COL-le-ga" />
        <SoundRow symbol="Final stress" desc="Written accent — word ends stressed" examples="caffè, città, virtù, però, così, già" />
        <SoundRow symbol="Monosyllables" desc="Usually no written accent" examples="il, la, di, da, a, e, ma, se, che" />
        <SoundRow symbol="Disambiguating accent" desc="Same spelling, different meaning" examples="è (is) vs e (and) / sì (yes) vs si (reflexive pronoun)" />
      </PhoneticCard>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-semibold mb-2 text-green-700 dark:text-green-400">Accent Marks in Italian</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>• Italian only writes accent marks on the <span className="font-medium text-foreground">final syllable</span> of a word when it is stressed: caffè, università, però.</p>
          <p>• Grave accent (`) on most letters: àèìòù — for open vowels.</p>
          <p>• Acute accent (´) on final -é: perché, né, sé — for closed vowels.</p>
          <p>• Stress on other syllables must be <span className="font-medium text-foreground">memorized</span> — dictionaries mark them with a dot under the stressed vowel.</p>
          <p>• Verb forms often shift stress: PARlano vs parLAno (note: PARlano is correct — 3rd person plural keeps penultimate stress on the stem).</p>
        </div>
      </div>
    </div>
  );
}

// ─── DIPHTHONGS ───────────────────────────────────────────────────────────────

export function ItDiphthongsCard() {
  return (
    <div className="space-y-3">
      <PhoneticCard title="I Dittonghi Italiani — Italian Diphthongs"
        subtitle="Two vowels pronounced in one syllable — very common in Italian">
        <div className="px-4 py-2 text-xs font-semibold border-b text-green-700 dark:text-green-400">Diphthongs with I</div>
        <SoundRow symbol="IE" desc='"yeh" — unstressed I + E' examples="piede (foot), miele (honey), cielo (sky), pieno (full)" />
        <SoundRow symbol="IO" desc='"yo" — unstressed I + O' examples="giorno (day), fiore (flower), piombo (lead), bacio (kiss)" />
        <SoundRow symbol="IA" desc='"ya" — unstressed I + A' examples="giacca (jacket), piazza, famiglia, già (already)" />
        <SoundRow symbol="IU" desc='"yu" — unstressed I + U' examples="fiume (river), chiudere, fiuto (instinct)" />
        <div className="px-4 py-2 text-xs font-semibold border-b text-green-700 dark:text-green-400">Diphthongs with U</div>
        <SoundRow symbol="UO" desc='"wo" — unstressed U + O' examples="uomo (man), buono (good), fuoco (fire), nuovo (new)" />
        <SoundRow symbol="UA" desc='"wa" — unstressed U + A' examples="quando (when), quale (which), guanto (glove)" />
        <SoundRow symbol="UE" desc='"weh" — unstressed U + E' examples="questo (this), quello (that), guerra (war)" />
        <SoundRow symbol="UI" desc='"wi" — unstressed U + I' examples="lui (he), cui (whom/which), suite" />
      </PhoneticCard>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground italic">Italian diphthongs occur when an unstressed I or U combines with another vowel in the same syllable. The glide is smooth and flowing — no break between the two sounds. This is what gives Italian its musical, flowing quality!</p>
      </div>
    </div>
  );
}
