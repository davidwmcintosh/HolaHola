/**
 * TextbookFrenchPhoneticGuides.tsx
 * Section 8 — French phonetic guide cards.
 * Mirrors TextbookPhoneticGuides.tsx for Spanish.
 *
 * Cards (9 total):
 *  FrNasalVowelsCard    — the four nasal vowel sounds
 *  FrFrenchRCard        — the uvular R
 *  FrLiaisonCard        — linking between words (obligatoire/facultative/interdite)
 *  FrUSoundCard         — the unique French [y] vowel
 *  FrEUSoundCard        — the [ø] and [œ] sounds
 *  FrSilentConsonantsCard — final consonants & aspirated vs silent H
 *  FrWrittenAccentsCard — é è ê à â ô ç and their phonetic effects
 *  FrIntonationCard     — French sentence melody patterns
 *  FrElisionCard        — élision and obligatory contractions (du/au/des/aux)
 */

function PhoneCard({ ipa, example, translation }: { ipa: string; example: string; translation: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded bg-muted/30 text-xs">
      <span className="font-mono text-base font-bold text-indigo-700 dark:text-indigo-300 w-10 text-center">{ipa}</span>
      <div>
        <span className="font-semibold text-foreground">{example}</span>
        <span className="text-muted-foreground ml-2">— {translation}</span>
      </div>
    </div>
  );
}

function PhoneticCard({ title, subtitle, color = 'from-indigo-500/10', children }: {
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

// ─── NASAL VOWELS ─────────────────────────────────────────────────────────────

export function FrNasalVowelsCard() {
  return (
    <PhoneticCard
      title="Les Voyelles Nasales — Nasal Vowels"
      subtitle="Air flows through nose AND mouth — a uniquely French sound"
      color="from-violet-500/10"
    >
      <div className="px-4 py-3 space-y-2">
        {[
          {
            ipa: '[ã]', label: 'an / am / en / em',
            words: [['dans', 'in'], ['temps', 'time'], ['enfant', 'child'], ['chambre', 'room']],
            tip: 'Like English "on" but through your nose — mouth wide open.',
          },
          {
            ipa: '[ɛ̃]', label: 'in / im / ain / ein / un / um',
            words: [['vin', 'wine'], ['pain', 'bread'], ['plein', 'full'], ['un', 'one']],
            tip: 'Like English "can\'t" nasalised. In many dialects un/in have merged.',
          },
          {
            ipa: '[ɔ̃]', label: 'on / om',
            words: [['bon', 'good'], ['nom', 'name'], ['son', 'sound'], ['pont', 'bridge']],
            tip: 'Like English "bone" but through your nose — lips rounded.',
          },
        ].map(({ ipa, label, words, tip }) => (
          <div key={ipa} className="rounded-lg border bg-muted/20 overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-3 border-b bg-muted/30">
              <span className="font-mono font-bold text-lg text-violet-700 dark:text-violet-300 w-10">{ipa}</span>
              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            </div>
            <div className="px-3 py-2 grid grid-cols-2 gap-1.5">
              {words.map(([fr, en]) => (
                <div key={fr} className="text-xs flex gap-2">
                  <span className="font-bold text-violet-700 dark:text-violet-300">{fr}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t bg-muted/20">
              <p className="text-[10px] text-muted-foreground italic">{tip}</p>
            </div>
          </div>
        ))}
        <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-amber-700 dark:text-amber-300">Key rule:</span> The nasal quality disappears when followed by another vowel (liaison) or a doubled nasal consonant. 
          Compare: <span className="font-semibold">bon</span> [bɔ̃] vs <span className="font-semibold">bonne</span> [bɔn] · <span className="font-semibold">an</span> [ã] vs <span className="font-semibold">Anne</span> [an]
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── FRENCH R ─────────────────────────────────────────────────────────────────

export function FrFrenchRCard() {
  return (
    <PhoneticCard
      title="Le R Français — The French R Sound"
      subtitle="IPA: [ʁ] — produced at the very back of the throat"
      color="from-red-500/10"
    >
      <div className="divide-y text-xs">
        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Where is it made?</p>
          <p className="text-muted-foreground mb-2">
            The French R is a <span className="font-semibold text-foreground">uvular fricative</span> — the back of your tongue rises toward the uvula (the small piece hanging at the back of your throat) and creates friction, like a soft gargling sound.
          </p>
          <p className="text-muted-foreground">
            It is <span className="font-semibold text-red-700 dark:text-red-300">completely different</span> from the English R (retroflex, tip of tongue curls back) and the Spanish R (tip of tongue taps/trills at the front of the mouth).
          </p>
        </div>

        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Practice steps:</p>
          <ol className="space-y-1.5 text-muted-foreground">
            {[
              'Gargle with water. Feel the vibration in your throat. Now do that without water.',
              'Say "ah" then bring the back of your tongue up toward your uvula while saying "ah."',
              'Add voicing (vibration) — this gives you the voiced [ʁ].',
              'Practice with: rue · rouge · vert · trois · croissant · merci',
              'It will feel unnatural at first. That\'s normal — persist!',
            ].map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-red-600 dark:text-red-400 font-bold shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Words to practice:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['rue', 'street'], ['rouge', 'red'], ['vert', 'green'], ['merci', 'thank you'],
              ['regarder', 'to look at'], ['trouver', 'to find'], ['grand', 'big'], ['croire', 'to believe'],
            ].map(([fr, en]) => (
              <div key={fr} className="flex gap-2 bg-muted/30 rounded px-2 py-1">
                <span className="font-bold text-red-700 dark:text-red-300 w-20">{fr}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 bg-muted/20">
          <p className="text-muted-foreground">A tip from learners: if you can do a Scottish/German "ch" sound (as in "loch" or "Bach"), you're already very close — just add your voice and soften it.</p>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── LIAISON ─────────────────────────────────────────────────────────────────

export function FrLiaisonCard() {
  return (
    <PhoneticCard
      title="La Liaison — Linking Sounds Between Words"
      subtitle="Final silent consonants can 'wake up' and link to the next word's vowel"
      color="from-cyan-500/10"
    >
      <div className="divide-y text-xs">
        {[
          {
            type: 'OBLIGATOIRE — Required',
            color: 'text-green-700 dark:text-green-300',
            bg: 'bg-green-50 dark:bg-green-950/20',
            cases: [
              { context: 'Article + noun', ex: 'les_enfants [lezɑ̃fɑ̃]', note: 'les (z sound)' },
              { context: 'Pronoun + verb', ex: 'nous_avons [nuzavɔ̃]', note: 'nous (z sound)' },
              { context: 'Adj + noun (before noun)', ex: 'un grand_arbre [grɑ̃tɑʁbʁ]', note: 'd→t sound' },
              { context: 'Preposition + noun', ex: 'en_été [ɑ̃nete]', note: 'en (n sound)' },
            ],
          },
          {
            type: 'FACULTATIVE — Optional',
            color: 'text-amber-700 dark:text-amber-300',
            bg: 'bg-amber-50 dark:bg-amber-950/20',
            cases: [
              { context: 'Noun + adj', ex: 'un enfant_intelligent', note: 'May or may not link' },
              { context: 'Verb + complement', ex: 'parler_avec', note: 'Context-dependent' },
            ],
          },
          {
            type: 'INTERDITE — Forbidden',
            color: 'text-red-700 dark:text-red-300',
            bg: 'bg-red-50 dark:bg-red-950/20',
            cases: [
              { context: 'After "et" (and)', ex: 'et / il [e il] — NOT [etil]', note: 'Never link after et' },
              { context: 'Before "h aspiré"', ex: 'les / haricots [le aʁiko]', note: 'h aspiré blocks liaison' },
              { context: 'After a noun subject', ex: 'Les chiens / aboient', note: 'Noun then verb: no liaison' },
            ],
          },
        ].map(({ type, color, bg, cases }) => (
          <div key={type} className={`px-4 py-3 ${bg}`}>
            <p className={`font-bold text-xs mb-2 ${color}`}>{type}</p>
            <div className="space-y-1.5">
              {cases.map(({ context, ex, note }) => (
                <div key={ex} className="flex flex-col">
                  <span className="text-muted-foreground text-[10px]">{context}</span>
                  <div className="flex gap-2 items-baseline">
                    <span className="font-semibold italic">{ex}</span>
                    <span className="text-muted-foreground text-[10px]">({note})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="px-4 py-2 bg-muted/20">
          <p className="text-muted-foreground">Consonant sounds in liaison: final -s/-x → [z] · final -d → [t] · final -n → [n] · final -f → [v] (before en, heures)</p>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── THE FRENCH U SOUND ───────────────────────────────────────────────────────

export function FrUSoundCard() {
  return (
    <PhoneticCard
      title="Le Son [y] — The French U"
      subtitle="There is no equivalent in English — this sound requires training"
      color="from-purple-500/10"
    >
      <div className="divide-y text-xs">
        <div className="px-4 py-3">
          <p className="font-semibold mb-2">How to produce [y]:</p>
          <ol className="space-y-1.5 text-muted-foreground">
            {[
              'Say "ee" (as in "see") — feel your tongue push forward toward your front teeth.',
              'Keep your tongue in EXACTLY that position.',
              'Now round your lips as if you\'re about to say "oo" (as in "moon").',
              'The result should be a sound between "ee" and "oo" — that\'s [y].',
              'Practice: tu, rue, une, vu, su, bu, jus, lune',
            ].map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-purple-600 dark:text-purple-400 font-bold shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Critical minimal pairs — these change meaning completely:</p>
          <div className="space-y-1.5">
            {[
              { u: 'tu', ou: 'tout', u_en: 'you (informal)', ou_en: 'all / everything' },
              { u: 'rue', ou: 'roue', u_en: 'street', ou_en: 'wheel' },
              { u: 'bu', ou: 'bout', u_en: 'drunk (past part.)', ou_en: 'end / tip' },
              { u: 'vu', ou: 'vous', u_en: 'seen (past part.)', ou_en: 'you (formal/pl.)' },
              { u: 'nu', ou: 'nous', u_en: 'naked', ou_en: 'we / us' },
            ].map(({ u, ou, u_en, ou_en }) => (
              <div key={u} className="grid grid-cols-2 divide-x rounded border overflow-hidden bg-muted/20">
                <div className="px-3 py-1.5">
                  <span className="font-bold text-purple-700 dark:text-purple-300">{u}</span>
                  <span className="text-muted-foreground ml-2">[y] — {u_en}</span>
                </div>
                <div className="px-3 py-1.5">
                  <span className="font-bold text-blue-700 dark:text-blue-300">{ou}</span>
                  <span className="text-muted-foreground ml-2">[u] — {ou_en}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 bg-muted/20">
          <p className="text-muted-foreground">In French spelling: "u" = [y] · "ou" = [u] · "eu" = [ø/œ]. Never confuse "u" with "ou" — they are different vowels.</p>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── EU / OEU SOUNDS ─────────────────────────────────────────────────────────

export function FrEUSoundCard() {
  return (
    <PhoneticCard
      title="Les Sons [ø] et [œ] — The EU Vowels"
      subtitle="Two related sounds — the 'bird' vowel of French"
      color="from-teal-500/10"
    >
      <div className="divide-y text-xs">
        <div className="px-4 py-3">
          <p className="font-semibold mb-2">The two EU sounds:</p>
          <div className="space-y-3">
            <div className="rounded border bg-muted/20 overflow-hidden">
              <div className="px-3 py-1.5 border-b bg-teal-500/10 font-bold text-teal-700 dark:text-teal-300">[ø] — Closed EU (feu)</div>
              <div className="px-3 py-2 space-y-1 text-muted-foreground">
                <p>Appears in <span className="font-semibold">open syllables</span> (ending in a vowel sound)</p>
                <p>Like English "bird" but lips rounded and tighter</p>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {[['feu', 'fire'], ['deux', 'two'], ['bleu', 'blue'], ['jeu', 'game'], ['vœu', 'wish'], ['eux', 'them']].map(([fr, en]) => (
                    <div key={fr} className="flex gap-1.5">
                      <span className="font-bold text-teal-700 dark:text-teal-300">{fr}</span>
                      <span className="text-[10px]">{en}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded border bg-muted/20 overflow-hidden">
              <div className="px-3 py-1.5 border-b bg-cyan-500/10 font-bold text-cyan-700 dark:text-cyan-300">[œ] — Open EU (peur)</div>
              <div className="px-3 py-2 space-y-1 text-muted-foreground">
                <p>Appears in <span className="font-semibold">closed syllables</span> (ending in a consonant sound)</p>
                <p>Like English "hurt" but lips rounded and relaxed</p>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {[['peur', 'fear'], ['cœur', 'heart'], ['sœur', 'sister'], ['beurre', 'butter'], ['fleur', 'flower'], ['meurtri', 'bruised']].map(([fr, en]) => (
                    <div key={fr} className="flex gap-1.5">
                      <span className="font-bold text-cyan-700 dark:text-cyan-300">{fr}</span>
                      <span className="text-[10px]">{en}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-muted/20">
          <p className="font-semibold mb-1">Production tip:</p>
          <p className="text-muted-foreground">Say "ay" (as in "say") then round your lips into an "o" shape while holding your tongue still. The resulting sound should be [ø]. To get [œ], relax your lips slightly.</p>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── SILENT CONSONANTS ────────────────────────────────────────────────────────

export function FrSilentConsonantsCard() {
  return (
    <PhoneticCard
      title="Les Consonnes Finales Muettes — Silent Final Consonants"
      subtitle="Most French final consonants are silent — with important exceptions"
      color="from-slate-500/10"
    >
      <div className="divide-y text-xs">
        <div className="px-4 py-3">
          <p className="font-semibold mb-2">The CaReFuL rule — usually pronounced when final:</p>
          <div className="flex items-center gap-3 mb-3">
            {[
              { letter: 'C', ex: 'avec, sac, parc' },
              { letter: 'a', note: '(separator)' },
              { letter: 'R', ex: 'mer, finir, couleur' },
              { letter: 'e', note: '(separator)' },
              { letter: 'F', ex: 'chef, neuf, soif' },
              { letter: 'u', note: '(separator)' },
              { letter: 'L', ex: 'il, quel, avril' },
            ].map((item, i) => (
              'note' in item ? (
                <span key={i} className="text-muted-foreground">·</span>
              ) : (
                <div key={i} className="text-center">
                  <div className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-base text-slate-700 dark:text-slate-200">{item.letter}</div>
                  <p className="text-[9px] text-muted-foreground mt-0.5 max-w-16">{item.ex}</p>
                </div>
              )
            ))}
          </div>
          <p className="text-muted-foreground">All other final consonants (d, t, s, x, p, g, z...) are usually silent.</p>
        </div>

        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Silent consonant examples:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['Paris', '[paʁi]', 's silent'], ['très', '[tʁɛ]', 's silent'],
              ['vous', '[vu]', 's silent'], ['grand', '[gʁɑ̃]', 'd silent'],
              ['est', '[ɛ]', 'st silent'], ['fait', '[fɛ]', 't silent'],
              ['chaud', '[ʃo]', 'd silent'], ['temps', '[tɑ̃]', 'mps silent'],
            ].map(([word, ipa, note]) => (
              <div key={word} className="flex gap-2 bg-muted/20 rounded px-2 py-1 items-baseline">
                <span className="font-bold w-16">{word}</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{ipa}</span>
                <span className="text-[10px] text-muted-foreground">{note}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="font-semibold mb-2">The two types of H:</p>
          <div className="grid grid-cols-2 divide-x rounded border overflow-hidden">
            <div className="p-3 space-y-1.5 text-muted-foreground">
              <p className="font-bold text-green-700 dark:text-green-300">H muet (silent H)</p>
              <p>Allows liaison and élision</p>
              <p>l'heure, les_hommes, l'hôtel</p>
              <p className="text-[10px]">Most H words: heure, homme, hôpital, histoire</p>
            </div>
            <div className="p-3 space-y-1.5 text-muted-foreground">
              <p className="font-bold text-red-700 dark:text-red-300">H aspiré (blocking H)</p>
              <p>Blocks liaison and élision</p>
              <p>le / hibou, les / haricots</p>
              <p className="text-[10px]">Examples: haricot, hibou, honte, haut, hockey</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">Note: H aspiré is not actually aspirated — the name just means it blocks liaison. Both types of H are physically silent.</p>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── WRITTEN ACCENTS ─────────────────────────────────────────────────────────

export function FrWrittenAccentsCard() {
  return (
    <PhoneticCard
      title="Les Accents Écrits — Written Accents"
      subtitle="French has 5 accent marks — each with phonetic and/or orthographic meaning"
      color="from-amber-500/10"
    >
      <div className="divide-y text-xs">
        {[
          {
            accent: 'Accent aigu ( ´ )',
            letters: 'é',
            sound: 'Closed E — [e] as in "café"',
            examples: ['été (summer)', 'école (school)', 'étudier (to study)', 'beauté (beauty)'],
            rule: 'Only appears on E. Always pronounced — this is the most common French accent.',
            color: 'text-amber-700 dark:text-amber-300',
          },
          {
            accent: 'Accent grave ( ` )',
            letters: 'è, à, ù',
            sound: 'On E: open E — [ɛ]. On A and U: distinguishes meaning only',
            examples: ['père (father)', 'mère (mother)', 'à (at) vs a (has)', 'où (where) vs ou (or)'],
            rule: 'è sounds like the "e" in "bed". à and ù have the same sound as a and u — they just distinguish words.',
            color: 'text-blue-700 dark:text-blue-300',
          },
          {
            accent: 'Accent circonflexe ( ^ )',
            letters: 'â, ê, î, ô, û',
            sound: 'Historically marks a lost S (hôpital = hospital). Mainly phonetic on ê/â.',
            examples: ['hôtel (hotel)', 'forêt (forest)', 'île (island)', 'tête (head)', 'sûr (sure)'],
            rule: 'ê sounds like è. â is slightly longer/darker. î, ô, û change rarely affect pronunciation.',
            color: 'text-teal-700 dark:text-teal-300',
          },
          {
            accent: 'Cédille ( ¸ )',
            letters: 'ç',
            sound: 'Makes C sound like [s] before a, o, u',
            examples: ['garçon (boy)', 'français (French)', 'leçon (lesson)', 'ça (that)'],
            rule: 'Without cédille: ca/co/cu = [k]. With cédille: ça/ço/çu = [s]. Never appears before e or i.',
            color: 'text-rose-700 dark:text-rose-300',
          },
          {
            accent: 'Tréma ( ¨ )',
            letters: 'ë, ï, ü, ÿ',
            sound: 'Forces the vowel to be pronounced separately from the preceding vowel',
            examples: ['Noël (Christmas)', 'naïf (naive)', 'Citroën (brand)', 'Haïti'],
            rule: 'Shows two adjacent vowels are pronounced separately, not as a diphthong.',
            color: 'text-purple-700 dark:text-purple-300',
          },
        ].map(({ accent, letters, sound, examples, rule, color }) => (
          <div key={accent} className="px-4 py-2.5">
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`font-bold ${color}`}>{accent}</span>
              <span className="font-mono text-base font-bold text-foreground">{letters}</span>
            </div>
            <p className="text-muted-foreground mb-1">{sound}</p>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {examples.map(ex => (
                <span key={ex} className="text-[10px] bg-muted/40 px-2 py-0.5 rounded italic">{ex}</span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">{rule}</p>
          </div>
        ))}
      </div>
    </PhoneticCard>
  );
}

// ─── INTONATION ───────────────────────────────────────────────────────────────

export function FrIntonationCard() {
  return (
    <PhoneticCard
      title="L'Intonation Française — French Sentence Melody"
      subtitle="French organises speech into rhythmic groups with consistent pitch patterns"
      color="from-green-500/10"
    >
      <div className="divide-y text-xs">
        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Key principle: Stress falls on the LAST syllable of each rhythmic group</p>
          <p className="text-muted-foreground">Unlike English, which can stress any syllable, French stress is predictable and always falls at the end of a rhythmic group (groupe rythmique). This gives French its characteristic flowing, forward-moving quality.</p>
        </div>

        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Intonation patterns:</p>
          <div className="space-y-3">
            {[
              {
                type: 'Statement (affirmation)',
                pattern: 'Rises within each group → Falls at the end',
                ex: 'Je parle français. / Je mange une pomme chaque matin.',
                note: 'Final pitch falls — "finished" signal.',
                arrow: '↗ ↘',
              },
              {
                type: 'Yes/No Question',
                pattern: 'Rises at the end of the sentence',
                ex: 'Tu parles français? / Il vient ce soir?',
                note: 'Final pitch rises — "answer me" signal.',
                arrow: '↗↑',
              },
              {
                type: 'WH-Question (question mot)',
                pattern: 'Falls at the end (like a statement)',
                ex: 'Où est la gare? / Comment tu t\'appelles?',
                note: 'Question word signals it\'s a question, not intonation.',
                arrow: '↗ ↘',
              },
              {
                type: 'List / enumeration',
                pattern: 'Rise on each item → Fall on the last',
                ex: 'J\'ai acheté du pain↗, du lait↗, du fromage↘.',
                note: 'Each item rises; final item falls.',
                arrow: '↗ ↗ ↘',
              },
            ].map(({ type, pattern, ex, note, arrow }) => (
              <div key={type} className="rounded border bg-muted/20 overflow-hidden">
                <div className="px-3 py-1.5 border-b bg-green-500/10 flex items-baseline gap-2">
                  <span className="font-bold text-green-700 dark:text-green-300">{type}</span>
                  <span className="font-mono text-green-600 dark:text-green-400 text-base">{arrow}</span>
                </div>
                <div className="px-3 py-2 space-y-1 text-muted-foreground">
                  <p>{pattern}</p>
                  <p className="italic font-medium text-foreground">{ex}</p>
                  <p className="text-[10px]">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 bg-muted/20">
          <p className="text-muted-foreground">The rhythmic group (groupe rythmique) is the basic unit of French speech. All syllables within the group are equal length, with stress only on the last. Groups are separated by brief pauses.</p>
        </div>
      </div>
    </PhoneticCard>
  );
}

// ─── ÉLISION & CONTRACTIONS ───────────────────────────────────────────────────

export function FrElisionCard() {
  return (
    <PhoneticCard
      title="L'Élision et les Contractions"
      subtitle="Vowel dropping and mandatory article contractions — the glue of French"
      color="from-indigo-500/10"
    >
      <div className="divide-y text-xs">
        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Élision — dropping the vowel before another vowel or silent H:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { word: 'le / la → l\'', ex: "l'ami, l'école, l'hôtel", note: 'before vowel/h muet' },
              { word: 'je → j\'', ex: "j'ai, j'habite, j'arrive", note: 'before vowel/h muet' },
              { word: 'me → m\'', ex: "il m'appelle, tu m'aides", note: 'before vowel/h muet' },
              { word: 'te → t\'', ex: "je t'attends, il t'aime", note: 'before vowel/h muet' },
              { word: 'se → s\'', ex: "elle s'appelle, il s'en va", note: 'before vowel/h muet' },
              { word: 'de → d\'', ex: "d'accord, d'abord", note: 'before vowel/h muet' },
              { word: 'ce → c\'', ex: "c'est, c'était", note: 'before est mostly' },
              { word: 'que → qu\'', ex: "qu'il, qu'elle, qu'on", note: 'before vowel/h muet' },
            ].map(({ word, ex, note }) => (
              <div key={word} className="bg-muted/30 rounded p-2 space-y-0.5">
                <p className="font-bold text-indigo-700 dark:text-indigo-300">{word}</p>
                <p className="italic text-foreground">{ex}</p>
                <p className="text-[10px] text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="font-semibold mb-2">Mandatory contractions — à / de + le/les:</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="px-2 py-1.5 text-left text-muted-foreground">Form</th>
                  <th className="px-2 py-1.5 text-left">+ le</th>
                  <th className="px-2 py-1.5 text-left">+ la</th>
                  <th className="px-2 py-1.5 text-left">+ l'</th>
                  <th className="px-2 py-1.5 text-left">+ les</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-muted/20">
                  <td className="px-2 py-1.5 font-semibold">à (at/to)</td>
                  <td className="px-2 py-1.5 font-bold text-indigo-700 dark:text-indigo-300">au</td>
                  <td className="px-2 py-1.5 text-muted-foreground">à la</td>
                  <td className="px-2 py-1.5 text-muted-foreground">à l'</td>
                  <td className="px-2 py-1.5 font-bold text-indigo-700 dark:text-indigo-300">aux</td>
                </tr>
                <tr>
                  <td className="px-2 py-1.5 font-semibold">de (of/from)</td>
                  <td className="px-2 py-1.5 font-bold text-indigo-700 dark:text-indigo-300">du</td>
                  <td className="px-2 py-1.5 text-muted-foreground">de la</td>
                  <td className="px-2 py-1.5 text-muted-foreground">de l'</td>
                  <td className="px-2 py-1.5 font-bold text-indigo-700 dark:text-indigo-300">des</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-2 space-y-0.5 text-muted-foreground">
            <p>Je vais <span className="font-semibold text-foreground">au</span> marché. (à + le marché)</p>
            <p>Elle parle <span className="font-semibold text-foreground">aux</span> enfants. (à + les enfants)</p>
            <p>Je reviens <span className="font-semibold text-foreground">du</span> Canada. (de + le Canada)</p>
            <p>Il vient <span className="font-semibold text-foreground">des</span> États-Unis. (de + les États-Unis)</p>
          </div>
        </div>

        <div className="px-4 py-2 bg-muted/20">
          <p className="text-muted-foreground">These contractions are mandatory — you CANNOT say "à le" or "de le" in French. Élision is also mandatory before vowels and h muet — "le ami" is incorrect; it must be "l'ami."</p>
        </div>
      </div>
    </PhoneticCard>
  );
}
