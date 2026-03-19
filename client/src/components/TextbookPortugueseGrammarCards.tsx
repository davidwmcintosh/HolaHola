/**
 * TextbookPortugueseGrammarCards.tsx
 * Portuguese grammar reference cards for Textbook Sections 3 & 4.
 *
 * Exports (22 cards):
 *  PtSerEstarCard          — Ser vs Estar with use-case table
 *  PtSerCard               — Full ser conjugation
 *  PtEstarCard             — Full estar conjugation
 *  PtTerCard               — Ter conjugation (to have)
 *  PtIrCard                — Ir conjugation (to go)
 *  PtArVerbsCard           — -ar regular verbs (falar model)
 *  PtErVerbsCard           — -er regular verbs (comer model)
 *  PtIrRegVerbsCard        — -ir regular verbs (partir model)
 *  PtReflexiveCard         — Reflexive verbs
 *  PtPreteritoPerfeito     — Pretérito perfeito (simple past)
 *  PtPreteritoImperfeito   — Pretérito imperfeito (imperfect)
 *  PtPretVsImpCard         — Perfeito vs. Imperfeito comparison
 *  PtFutureCard            — Simple future + ir + infinitive
 *  PtConditionalCard       — Conditional tense
 *  PtSubjunctiveCard       — Present subjunctive
 *  PtNegativeCard          — Negation
 *  PtGenderArticlesCard    — Gender & definite/indefinite articles
 *  PtAdjectiveAgreementCard— Adjective gender/number agreement
 *  PtObjectPronounsCard    — Direct & indirect object pronouns
 *  PtTuVoceCard            — Tu vs. Você distinction
 *  PtQuestionsCard         — Forming questions
 *  PtContractionsCard      — Preposition contractions (ao/à/do/da/no/na/pelo/pela…)
 */

import { Card, CardContent } from "@/components/ui/card";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{children}</p>;
}

function ConjugationTable({ title, rows }: {
  title: string;
  rows: { pronoun: string; form: string; note?: string }[];
}) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="rounded-md border border-border overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.pronoun} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
            <span className="w-28 text-muted-foreground shrink-0">{r.pronoun}</span>
            <span className="font-semibold flex-1">{r.form}</span>
            {r.note && <span className="text-[11px] text-muted-foreground">{r.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 1. Ser vs Estar ──────────────────────────────────────────────────────────

export function PtSerEstarCard() {
  const serUses = [
    ['Identity', 'Eu sou Ana.', 'I am Ana. (name)'],
    ['Origin', 'Ele é de Lisboa.', 'He is from Lisbon.'],
    ['Nationality', 'Somos brasileiros.', 'We are Brazilian.'],
    ['Profession', 'Ela é médica.', 'She is a doctor.'],
    ['Characteristics', 'O céu é azul.', 'The sky is blue.'],
    ['Time / Dates', 'São três horas.', 'It is three o\'clock.'],
    ['Passive voice', 'O bolo é feito aqui.', 'The cake is made here.'],
  ];
  const estarUses = [
    ['Location (temp.)', 'Estou em casa.', 'I am at home.'],
    ['Emotions/States', 'Ela está cansada.', 'She is tired.'],
    ['Progressive', 'Estamos comendo.', 'We are eating.'],
    ['Results', 'A porta está aberta.', 'The door is open.'],
    ['Health', 'Ele está doente.', 'He is sick.'],
    ['Weather (states)', 'Está nublado.', 'It is cloudy.'],
  ];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Ser vs. Estar — The Two "To Be" Verbs</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold mb-2">SER — permanent or defining</p>
            <div className="rounded-md border border-border overflow-hidden">
              {serUses.map(([use, pt, en], i) => (
                <div key={use} className={`px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex gap-2">
                    <span className="w-28 text-muted-foreground shrink-0 text-[11px] uppercase tracking-wide">{use}</span>
                    <span className="font-semibold flex-1">{pt}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground pl-28 mt-0.5">{en}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">ESTAR — temporary or changeable</p>
            <div className="rounded-md border border-border overflow-hidden">
              {estarUses.map(([use, pt, en], i) => (
                <div key={use} className={`px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex gap-2">
                    <span className="w-28 text-muted-foreground shrink-0 text-[11px] uppercase tracking-wide">{use}</span>
                    <span className="font-semibold flex-1">{pt}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground pl-28 mt-0.5">{en}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
          <strong>Key tip:</strong> Like Spanish ser/estar, but remember: in Portuguese, location of things/places often uses <strong>ser</strong> (A padaria é na esquina — The bakery is on the corner), while <strong>estar</strong> is for persons/temporary location.
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 2. Ser ───────────────────────────────────────────────────────────────────

export function PtSerCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConjugationTable title="SER — Present (Presente)" rows={[
            { pronoun: 'eu',                  form: 'sou' },
            { pronoun: 'tu',                  form: 'és' },
            { pronoun: 'ele/ela/você',         form: 'é' },
            { pronoun: 'nós',                 form: 'somos' },
            { pronoun: 'vós',                 form: 'sois', note: 'archaic/PT' },
            { pronoun: 'eles/elas/vocês',      form: 'são' },
          ]} />
          <ConjugationTable title="SER — Pretérito Imperfeito" rows={[
            { pronoun: 'eu',                  form: 'era' },
            { pronoun: 'tu',                  form: 'eras' },
            { pronoun: 'ele/ela/você',         form: 'era' },
            { pronoun: 'nós',                 form: 'éramos' },
            { pronoun: 'vós',                 form: 'éreis' },
            { pronoun: 'eles/elas/vocês',      form: 'eram' },
          ]} />
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ConjugationTable title="SER — Pretérito Perfeito" rows={[
            { pronoun: 'eu',                  form: 'fui' },
            { pronoun: 'tu',                  form: 'foste' },
            { pronoun: 'ele/ela/você',         form: 'foi' },
            { pronoun: 'nós',                 form: 'fomos' },
            { pronoun: 'vós',                 form: 'fostes' },
            { pronoun: 'eles/elas/vocês',      form: 'foram' },
          ]} />
          <div>
            <SectionLabel>Key Uses of SER</SectionLabel>
            <ul className="space-y-1 text-sm">
              {[
                'Identity & names — Sou o Pedro.',
                'Origin — Sou de Portugal.',
                'Profession — Ela é professora.',
                'Nationality — Somos brasileiros.',
                'Time — São cinco horas.',
                'Material — A mesa é de madeira.',
                'Passive voice — O livro foi escrito…',
              ].map(u => <li key={u} className="flex gap-2"><span className="text-primary">•</span><span>{u}</span></li>)}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 3. Estar ─────────────────────────────────────────────────────────────────

export function PtEstarCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConjugationTable title="ESTAR — Present (Presente)" rows={[
            { pronoun: 'eu',                  form: 'estou' },
            { pronoun: 'tu',                  form: 'estás' },
            { pronoun: 'ele/ela/você',         form: 'está' },
            { pronoun: 'nós',                 form: 'estamos' },
            { pronoun: 'vós',                 form: 'estais' },
            { pronoun: 'eles/elas/vocês',      form: 'estão' },
          ]} />
          <ConjugationTable title="ESTAR — Pretérito Imperfeito" rows={[
            { pronoun: 'eu',                  form: 'estava' },
            { pronoun: 'tu',                  form: 'estavas' },
            { pronoun: 'ele/ela/você',         form: 'estava' },
            { pronoun: 'nós',                 form: 'estávamos' },
            { pronoun: 'vós',                 form: 'estáveis' },
            { pronoun: 'eles/elas/vocês',      form: 'estavam' },
          ]} />
        </div>
        <div className="mt-4">
          <SectionLabel>ESTAR + Gerúndio — Progressive (Brazilian)</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['Estou falando.', 'I am speaking. (BR)'],
                ['Estamos comendo.', 'We are eating. (BR)'],
                ['Ela está dormindo.', 'She is sleeping. (BR)'],
              ].map(([pt, en], i) => (
                <div key={pt} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{pt}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['Estou a falar.', 'I am speaking. (PT-EU)'],
                ['Estamos a comer.', 'We are eating. (PT-EU)'],
                ['Ela está a dormir.', 'She is sleeping. (PT-EU)'],
              ].map(([pt, en], i) => (
                <div key={pt} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{pt}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Brazil uses <strong>estar + gerúndio (-ndo)</strong>; Portugal uses <strong>estar a + infinitive</strong> for ongoing actions.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 4. Ter ───────────────────────────────────────────────────────────────────

export function PtTerCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConjugationTable title="TER — Present (Presente)" rows={[
            { pronoun: 'eu',                  form: 'tenho' },
            { pronoun: 'tu',                  form: 'tens' },
            { pronoun: 'ele/ela/você',         form: 'tem' },
            { pronoun: 'nós',                 form: 'temos' },
            { pronoun: 'vós',                 form: 'tendes' },
            { pronoun: 'eles/elas/vocês',      form: 'têm' },
          ]} />
          <ConjugationTable title="TER — Pretérito Perfeito" rows={[
            { pronoun: 'eu',                  form: 'tive' },
            { pronoun: 'tu',                  form: 'tiveste' },
            { pronoun: 'ele/ela/você',         form: 'teve' },
            { pronoun: 'nós',                 form: 'tivemos' },
            { pronoun: 'vós',                 form: 'tivestes' },
            { pronoun: 'eles/elas/vocês',      form: 'tiveram' },
          ]} />
        </div>
        <div className="mt-4">
          <SectionLabel>TER — Key Uses</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {[
              ['Possession', 'Tenho um carro.', 'I have a car.'],
              ['Age', 'Tenho vinte anos.', 'I am twenty years old.'],
              ['Obligation', 'Tenho que estudar.', 'I have to study.'],
              ['Physical states', 'Tenho fome / sede.', 'I am hungry / thirsty.'],
              ['Perfect (auxiliary)', 'Tenho falado muito.', 'I have been speaking a lot.'],
              ['Emotional states', 'Tenho medo.', 'I am afraid.'],
            ].map(([cat, pt, en]) => (
              <div key={pt} className="flex flex-col py-1 border-b border-border/30 last:border-0">
                <div className="flex gap-2">
                  <span className="text-[11px] text-muted-foreground w-24 shrink-0 uppercase tracking-wide">{cat}</span>
                  <span className="text-sm font-semibold">{pt}</span>
                </div>
                <span className="text-xs text-muted-foreground pl-24">{en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 5. Ir ────────────────────────────────────────────────────────────────────

export function PtIrCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConjugationTable title="IR — Present (Presente)" rows={[
            { pronoun: 'eu',                  form: 'vou' },
            { pronoun: 'tu',                  form: 'vais' },
            { pronoun: 'ele/ela/você',         form: 'vai' },
            { pronoun: 'nós',                 form: 'vamos' },
            { pronoun: 'vós',                 form: 'ides' },
            { pronoun: 'eles/elas/vocês',      form: 'vão' },
          ]} />
          <ConjugationTable title="IR — Pretérito Perfeito" rows={[
            { pronoun: 'eu',                  form: 'fui' },
            { pronoun: 'tu',                  form: 'foste' },
            { pronoun: 'ele/ela/você',         form: 'foi' },
            { pronoun: 'nós',                 form: 'fomos' },
            { pronoun: 'vós',                 form: 'fostes' },
            { pronoun: 'eles/elas/vocês',      form: 'foram' },
          ]} />
        </div>
        <div className="mt-4">
          <SectionLabel>IR + Infinitive — Near Future</SectionLabel>
          <div className="rounded-md border border-border overflow-hidden">
            {[
              ['Vou estudar.', 'I am going to study.'],
              ['Ela vai viajar.', 'She is going to travel.'],
              ['Vamos comer?', 'Shall we eat? / We\'re going to eat?'],
              ['Eles vão falar.', 'They are going to speak.'],
            ].map(([pt, en], i) => (
              <div key={pt} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                <span className="font-semibold flex-1">{pt}</span>
                <span className="text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Note: <strong>Ir</strong> and <strong>Ser</strong> share the same preterite forms (fui, foste, foi…). Context makes them clear.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 6. -AR Verbs ─────────────────────────────────────────────────────────────

export function PtArVerbsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>-AR Verbs — Model: FALAR (to speak)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <ConjugationTable title="Present" rows={[
            { pronoun: 'eu',           form: 'falo' },
            { pronoun: 'tu',           form: 'falas' },
            { pronoun: 'ele/você',     form: 'fala' },
            { pronoun: 'nós',          form: 'falamos' },
            { pronoun: 'vós',          form: 'falais' },
            { pronoun: 'eles/vocês',   form: 'falam' },
          ]} />
          <ConjugationTable title="Pretérito Perfeito" rows={[
            { pronoun: 'eu',           form: 'falei' },
            { pronoun: 'tu',           form: 'falaste' },
            { pronoun: 'ele/você',     form: 'falou' },
            { pronoun: 'nós',          form: 'falámos / falamos' },
            { pronoun: 'vós',          form: 'falastes' },
            { pronoun: 'eles/vocês',   form: 'falaram' },
          ]} />
          <ConjugationTable title="Pretérito Imperfeito" rows={[
            { pronoun: 'eu',           form: 'falava' },
            { pronoun: 'tu',           form: 'falavas' },
            { pronoun: 'ele/você',     form: 'falava' },
            { pronoun: 'nós',          form: 'falávamos' },
            { pronoun: 'vós',          form: 'faláveis' },
            { pronoun: 'eles/vocês',   form: 'falavam' },
          ]} />
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Common -AR Verbs</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['falar', 'to speak'], ['trabalhar', 'to work'], ['estudar', 'to study'],
              ['comprar', 'to buy'], ['amar', 'to love'], ['cantar', 'to sing'],
              ['dançar', 'to dance'], ['chegar', 'to arrive'], ['olhar', 'to look'],
              ['escutar', 'to listen'], ['ajudar', 'to help'], ['morar', 'to live/reside'],
            ].map(([v, en]) => (
              <div key={v} className="flex flex-col p-2 rounded-md bg-muted/50 border border-border/50">
                <span className="text-sm font-semibold">{v}</span>
                <span className="text-[11px] text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 7. -ER Verbs ─────────────────────────────────────────────────────────────

export function PtErVerbsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>-ER Verbs — Model: COMER (to eat)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <ConjugationTable title="Present" rows={[
            { pronoun: 'eu',           form: 'como' },
            { pronoun: 'tu',           form: 'comes' },
            { pronoun: 'ele/você',     form: 'come' },
            { pronoun: 'nós',          form: 'comemos' },
            { pronoun: 'vós',          form: 'comeis' },
            { pronoun: 'eles/vocês',   form: 'comem' },
          ]} />
          <ConjugationTable title="Pretérito Perfeito" rows={[
            { pronoun: 'eu',           form: 'comi' },
            { pronoun: 'tu',           form: 'comeste' },
            { pronoun: 'ele/você',     form: 'comeu' },
            { pronoun: 'nós',          form: 'comemos' },
            { pronoun: 'vós',          form: 'comestes' },
            { pronoun: 'eles/vocês',   form: 'comeram' },
          ]} />
          <ConjugationTable title="Pretérito Imperfeito" rows={[
            { pronoun: 'eu',           form: 'comia' },
            { pronoun: 'tu',           form: 'comias' },
            { pronoun: 'ele/você',     form: 'comia' },
            { pronoun: 'nós',          form: 'comíamos' },
            { pronoun: 'vós',          form: 'comíeis' },
            { pronoun: 'eles/vocês',   form: 'comiam' },
          ]} />
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Common -ER Verbs</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['comer', 'to eat'], ['beber', 'to drink'], ['ler', 'to read'],
              ['ver', 'to see'], ['escrever', 'to write'], ['viver', 'to live'],
              ['aprender', 'to learn'], ['responder', 'to answer'], ['correr', 'to run'],
              ['entender', 'to understand'], ['vender', 'to sell'], ['conhecer', 'to know'],
            ].map(([v, en]) => (
              <div key={v} className="flex flex-col p-2 rounded-md bg-muted/50 border border-border/50">
                <span className="text-sm font-semibold">{v}</span>
                <span className="text-[11px] text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 8. -IR Verbs ─────────────────────────────────────────────────────────────

export function PtIrRegVerbsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>-IR Verbs — Model: PARTIR (to leave)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <ConjugationTable title="Present" rows={[
            { pronoun: 'eu',           form: 'parto' },
            { pronoun: 'tu',           form: 'partes' },
            { pronoun: 'ele/você',     form: 'parte' },
            { pronoun: 'nós',          form: 'partimos' },
            { pronoun: 'vós',          form: 'partis' },
            { pronoun: 'eles/vocês',   form: 'partem' },
          ]} />
          <ConjugationTable title="Pretérito Perfeito" rows={[
            { pronoun: 'eu',           form: 'parti' },
            { pronoun: 'tu',           form: 'partiste' },
            { pronoun: 'ele/você',     form: 'partiu' },
            { pronoun: 'nós',          form: 'partimos' },
            { pronoun: 'vós',          form: 'partistes' },
            { pronoun: 'eles/vocês',   form: 'partiram' },
          ]} />
          <ConjugationTable title="Pretérito Imperfeito" rows={[
            { pronoun: 'eu',           form: 'partia' },
            { pronoun: 'tu',           form: 'partias' },
            { pronoun: 'ele/você',     form: 'partia' },
            { pronoun: 'nós',          form: 'partíamos' },
            { pronoun: 'vós',          form: 'partíeis' },
            { pronoun: 'eles/vocês',   form: 'partiam' },
          ]} />
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Common -IR Verbs</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['partir', 'to leave'], ['abrir', 'to open'], ['dividir', 'to divide'],
              ['existir', 'to exist'], ['subir', 'to go up'], ['conseguir', 'to manage/get'],
              ['descobrir', 'to discover'], ['decidir', 'to decide'], ['proibir', 'to prohibit'],
              ['dormir', 'to sleep'], ['repetir', 'to repeat'], ['sentir', 'to feel'],
            ].map(([v, en]) => (
              <div key={v} className="flex flex-col p-2 rounded-md bg-muted/50 border border-border/50">
                <span className="text-sm font-semibold">{v}</span>
                <span className="text-[11px] text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 9. Reflexive Verbs ───────────────────────────────────────────────────────

export function PtReflexiveCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Verbos Reflexivos — Reflexive Verbs (levantar-se)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <ConjugationTable title="LEVANTAR-SE — to get up (Present)" rows={[
              { pronoun: 'eu',              form: 'me levanto', note: 'BR: eu me levanto' },
              { pronoun: 'tu',              form: 'te levantas' },
              { pronoun: 'ele/ela/você',    form: 'se levanta' },
              { pronoun: 'nós',             form: 'nos levantamos' },
              { pronoun: 'vós',             form: 'vos levantais' },
              { pronoun: 'eles/elas/vocês', form: 'se levantam' },
            ]} />
          </div>
          <div>
            <SectionLabel>Reflexive Pronouns</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['me', 'eu', 'myself'],
                ['te', 'tu', 'yourself (informal)'],
                ['se', 'ele/ela/você', 'himself/herself/yourself'],
                ['nos', 'nós', 'ourselves'],
                ['vos', 'vós', 'yourselves (PT-EU)'],
                ['se', 'eles/vocês', 'themselves/yourselves'],
              ].map(([pron, subj, en], i) => (
                <div key={subj} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="w-8 font-mono font-semibold text-primary">{pron}</span>
                  <span className="w-24 text-muted-foreground">{subj}</span>
                  <span>{en}</span>
                </div>
              ))}
            </div>
            <SectionLabel>Common Reflexive Verbs</SectionLabel>
            <div className="space-y-1">
              {[
                ['levantar-se', 'to get up'],
                ['deitar-se', 'to lie down / go to bed'],
                ['vestir-se', 'to get dressed'],
                ['chamar-se', 'to be called (name)'],
                ['sentir-se', 'to feel'],
                ['lembrar-se', 'to remember'],
                ['esquecer-se', 'to forget'],
              ].map(([v, en]) => (
                <div key={v} className="flex gap-2 text-sm">
                  <span className="font-semibold w-28 shrink-0">{v}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">In Brazil, reflexive pronouns often move before the verb (me levanto); in Portugal they typically follow (levanto-me) or follow complex cliticization rules.</p>
      </CardContent>
    </Card>
  );
}

// ─── 10. Pretérito Perfeito ───────────────────────────────────────────────────

export function PtPreteritoPerfeito() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Pretérito Perfeito — Simple Past (Completed Actions)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <ConjugationTable title="-AR: falar" rows={[
            { pronoun: 'eu',         form: 'falei' },
            { pronoun: 'tu',         form: 'falaste' },
            { pronoun: 'ele/você',   form: 'falou' },
            { pronoun: 'nós',        form: 'falámos/falamos' },
            { pronoun: 'vós',        form: 'falastes' },
            { pronoun: 'eles/vocês', form: 'falaram' },
          ]} />
          <ConjugationTable title="-ER: comer" rows={[
            { pronoun: 'eu',         form: 'comi' },
            { pronoun: 'tu',         form: 'comeste' },
            { pronoun: 'ele/você',   form: 'comeu' },
            { pronoun: 'nós',        form: 'comemos' },
            { pronoun: 'vós',        form: 'comestes' },
            { pronoun: 'eles/vocês', form: 'comeram' },
          ]} />
          <ConjugationTable title="-IR: partir" rows={[
            { pronoun: 'eu',         form: 'parti' },
            { pronoun: 'tu',         form: 'partiste' },
            { pronoun: 'ele/você',   form: 'partiu' },
            { pronoun: 'nós',        form: 'partimos' },
            { pronoun: 'vós',        form: 'partistes' },
            { pronoun: 'eles/vocês', form: 'partiram' },
          ]} />
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Irregular Preterites</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { inf: 'ser/ir', eu: 'fui', ele: 'foi', eles: 'foram' },
              { inf: 'ter', eu: 'tive', ele: 'teve', eles: 'tiveram' },
              { inf: 'fazer', eu: 'fiz', ele: 'fez', eles: 'fizeram' },
              { inf: 'estar', eu: 'estive', ele: 'esteve', eles: 'estiveram' },
              { inf: 'poder', eu: 'pude', ele: 'pôde', eles: 'puderam' },
              { inf: 'querer', eu: 'quis', ele: 'quis', eles: 'quiseram' },
              { inf: 'saber', eu: 'soube', ele: 'soube', eles: 'souberam' },
              { inf: 'trazer', eu: 'trouxe', ele: 'trouxe', eles: 'trouxeram' },
            ].map(({ inf, eu, ele, eles }) => (
              <div key={inf} className="p-2 rounded-md bg-muted/50 border border-border/50">
                <div className="text-sm font-bold mb-1">{inf}</div>
                <div className="text-xs space-y-0.5">
                  <div><span className="text-muted-foreground">eu:</span> {eu}</div>
                  <div><span className="text-muted-foreground">ele:</span> {ele}</div>
                  <div><span className="text-muted-foreground">eles:</span> {eles}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 11. Pretérito Imperfeito ─────────────────────────────────────────────────

export function PtPreteritoImperfeito() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Pretérito Imperfeito — Imperfect (Habitual / Ongoing Past)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <ConjugationTable title="-AR: falar" rows={[
            { pronoun: 'eu',         form: 'falava' },
            { pronoun: 'tu',         form: 'falavas' },
            { pronoun: 'ele/você',   form: 'falava' },
            { pronoun: 'nós',        form: 'falávamos' },
            { pronoun: 'vós',        form: 'faláveis' },
            { pronoun: 'eles/vocês', form: 'falavam' },
          ]} />
          <ConjugationTable title="-ER: comer" rows={[
            { pronoun: 'eu',         form: 'comia' },
            { pronoun: 'tu',         form: 'comias' },
            { pronoun: 'ele/você',   form: 'comia' },
            { pronoun: 'nós',        form: 'comíamos' },
            { pronoun: 'vós',        form: 'comíeis' },
            { pronoun: 'eles/vocês', form: 'comiam' },
          ]} />
          <ConjugationTable title="-IR: partir" rows={[
            { pronoun: 'eu',         form: 'partia' },
            { pronoun: 'tu',         form: 'partias' },
            { pronoun: 'ele/você',   form: 'partia' },
            { pronoun: 'nós',        form: 'partíamos' },
            { pronoun: 'vós',        form: 'partíeis' },
            { pronoun: 'eles/vocês', form: 'partiam' },
          ]} />
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>When to Use the Imperfeito</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-1">
            {[
              ['Habitual actions', 'Quando era criança, brincava muito.', 'When I was a child, I used to play a lot.'],
              ['Ongoing background', 'Chovia quando cheguei.', 'It was raining when I arrived.'],
              ['Descriptions', 'O quarto era pequeno.', 'The room was small.'],
              ['Polite requests', 'Queria um café, por favor.', 'I would like a coffee, please.'],
            ].map(([label, pt, en]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
                <span className="text-sm font-semibold">{pt}</span>
                <span className="text-xs text-muted-foreground">{en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 12. Perfeito vs Imperfeito ───────────────────────────────────────────────

export function PtPretVsImpCard() {
  const pairs = [
    {
      situation: 'Completed vs. Ongoing',
      perfeito: ['Ontem, comi pizza.', 'Yesterday, I ate pizza.'],
      imperfeito: ['Quando era jovem, comia pizza.', 'When I was young, I used to eat pizza.'],
    },
    {
      situation: 'Single vs. Habitual',
      perfeito: ['Fui ao mercado.', 'I went to the market. (once)'],
      imperfeito: ['Ia ao mercado todos os dias.', 'I used to go to the market every day.'],
    },
    {
      situation: 'Event vs. Setting',
      perfeito: ['Tocou o telefone.', 'The phone rang.'],
      imperfeito: ['Eu dormia.', 'I was sleeping. (background)'],
    },
    {
      situation: 'Beginning vs. Middle',
      perfeito: ['Comecei a estudar.', 'I started studying.'],
      imperfeito: ['Estudava quando chegou.', 'I was studying when she arrived.'],
    },
  ];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Perfeito vs. Imperfeito — Side by Side</SectionLabel>
        <div className="grid grid-cols-3 gap-2 mb-2 mt-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Situation</div>
          <div className="text-xs font-medium text-primary uppercase tracking-wide">Pretérito Perfeito</div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pretérito Imperfeito</div>
        </div>
        <div className="space-y-2">
          {pairs.map(({ situation, perfeito, imperfeito }) => (
            <div key={situation} className="grid grid-cols-3 gap-2 p-2 rounded-md bg-muted/30 border border-border/40">
              <div className="text-xs text-muted-foreground">{situation}</div>
              <div>
                <div className="text-sm font-semibold">{perfeito[0]}</div>
                <div className="text-[11px] text-muted-foreground">{perfeito[1]}</div>
              </div>
              <div>
                <div className="text-sm font-semibold">{imperfeito[0]}</div>
                <div className="text-[11px] text-muted-foreground">{imperfeito[1]}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
          <strong>Trigger words:</strong> Perfeito: <em>ontem, de repente, naquele momento, quando (event)</em>. Imperfeito: <em>sempre, todos os dias, antes, enquanto, quando era…</em>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 13. Future ───────────────────────────────────────────────────────────────

export function PtFutureCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <ConjugationTable title="Futuro do Indicativo — Simple Future (falar)" rows={[
              { pronoun: 'eu',              form: 'falarei' },
              { pronoun: 'tu',              form: 'falarás' },
              { pronoun: 'ele/ela/você',    form: 'falará' },
              { pronoun: 'nós',             form: 'falaremos' },
              { pronoun: 'vós',             form: 'falareis' },
              { pronoun: 'eles/elas/vocês', form: 'falarão' },
            ]} />
            <p className="text-[11px] text-muted-foreground mt-2">Simple future = infinitive + endings. Same endings for -ar/-er/-ir verbs.</p>
          </div>
          <div>
            <SectionLabel>IR + Infinitive — Informal Future (most common in speech)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['Vou falar.', 'I am going to speak.'],
                ['Vais estudar?', 'Are you going to study?'],
                ['Ela vai viajar.', 'She is going to travel.'],
                ['Vamos aprender!', 'We are going to learn!'],
              ].map(([pt, en], i) => (
                <div key={pt} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{pt}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
            <SectionLabel>Irregular Future Stems</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {[['fazer', 'far-', 'farei'], ['dizer', 'dir-', 'direi'], ['trazer', 'trar-', 'trarei']].map(([inf, stem, ex]) => (
                <div key={inf} className="p-2 rounded-md bg-muted/50 border border-border/50 text-xs">
                  <div className="font-bold">{inf}</div>
                  <div className="text-muted-foreground">stem: {stem}</div>
                  <div className="font-medium">{ex}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 14. Conditional ─────────────────────────────────────────────────────────

export function PtConditionalCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConjugationTable title="Condicional — falar (Conditional)" rows={[
            { pronoun: 'eu',              form: 'falaria' },
            { pronoun: 'tu',              form: 'falarias' },
            { pronoun: 'ele/ela/você',    form: 'falaria' },
            { pronoun: 'nós',             form: 'falaríamos' },
            { pronoun: 'vós',             form: 'falaríeis' },
            { pronoun: 'eles/elas/vocês', form: 'falariam' },
          ]} />
          <div>
            <SectionLabel>Uses of the Conditional</SectionLabel>
            <div className="space-y-3">
              {[
                ['Politeness', 'Poderia me ajudar?', 'Could you help me?'],
                ['Hypothetical', 'Eu iria, mas estou cansado.', 'I would go, but I am tired.'],
                ['If-clauses', 'Se tivesse dinheiro, compraria.', 'If I had money, I would buy it.'],
                ['Indirect speech', 'Disse que falaria.', 'He said he would speak.'],
              ].map(([label, pt, en]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
                  <span className="text-sm font-semibold">{pt}</span>
                  <span className="text-xs text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">In informal Brazilian speech, the imperfect often replaces the conditional: <em>Eu ia, mas…</em> instead of <em>Eu iria, mas…</em></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 15. Subjunctive ──────────────────────────────────────────────────────────

export function PtSubjunctiveCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ConjugationTable title="Subj. Presente — falar" rows={[
            { pronoun: 'eu',         form: 'fale' },
            { pronoun: 'tu',         form: 'fales' },
            { pronoun: 'ele/você',   form: 'fale' },
            { pronoun: 'nós',        form: 'falemos' },
            { pronoun: 'vós',        form: 'faleis' },
            { pronoun: 'eles/vocês', form: 'falem' },
          ]} />
          <ConjugationTable title="Subj. Presente — comer" rows={[
            { pronoun: 'eu',         form: 'coma' },
            { pronoun: 'tu',         form: 'comas' },
            { pronoun: 'ele/você',   form: 'coma' },
            { pronoun: 'nós',        form: 'comamos' },
            { pronoun: 'vós',        form: 'comais' },
            { pronoun: 'eles/vocês', form: 'comam' },
          ]} />
          <ConjugationTable title="Subj. Presente — partir" rows={[
            { pronoun: 'eu',         form: 'parta' },
            { pronoun: 'tu',         form: 'partas' },
            { pronoun: 'ele/você',   form: 'parta' },
            { pronoun: 'nós',        form: 'partamos' },
            { pronoun: 'vós',        form: 'partais' },
            { pronoun: 'eles/vocês', form: 'partam' },
          ]} />
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Trigger Phrases — Subjunctive Triggers</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {[
              ['Espero que você fale.', 'I hope you will speak.'],
              ['Quero que eles venham.', 'I want them to come.'],
              ['É importante que estudemos.', 'It\'s important that we study.'],
              ['Embora seja difícil…', 'Although it is difficult…'],
              ['Para que você entenda…', 'So that you understand…'],
              ['Talvez ele chegue tarde.', 'Maybe he will arrive late.'],
            ].map(([pt, en]) => (
              <div key={pt} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{pt}</span>
                <span className="text-muted-foreground">— {en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 16. Negation ─────────────────────────────────────────────────────────────

export function PtNegativeCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Negação — Negation in Portuguese</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Basic Negation: NÃO</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-4">
              {[
                ['Eu falo português.', 'Eu não falo português.'],
                ['Ela está aqui.', 'Ela não está aqui.'],
                ['Gosto de café.', 'Não gosto de café.'],
              ].map(([pos, neg], i) => (
                <div key={pos} className={`flex gap-3 px-3 py-2 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="flex-1 text-muted-foreground">{pos}</span>
                  <span className="flex-1 font-semibold">{neg}</span>
                </div>
              ))}
            </div>
            <SectionLabel>Double Negation (Brazilian Portuguese)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['Não vejo nada.', 'I don\'t see anything.'],
                ['Não fui a lugar nenhum.', 'I didn\'t go anywhere.'],
                ['Não ouço ninguém.', 'I don\'t hear anyone.'],
                ['Não quero nem isto.', 'I don\'t want even this.'],
              ].map(([pt, en], i) => (
                <div key={pt} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{pt}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Negative Words</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['não', 'no / not'],
                ['nunca / jamais', 'never'],
                ['nada', 'nothing'],
                ['ninguém', 'nobody'],
                ['nenhum/nenhuma', 'no / none (adj)'],
                ['nem', 'not even / nor'],
                ['sem', 'without'],
                ['ainda não', 'not yet'],
                ['já não', 'no longer'],
              ].map(([word, en], i) => (
                <div key={word} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold w-32 shrink-0">{word}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 17. Gender & Articles ────────────────────────────────────────────────────

export function PtGenderArticlesCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Gênero e Artigos — Gender & Articles</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Definite Articles (the)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                <span></span><span className="text-center">Masculine</span><span className="text-center">Feminine</span>
              </div>
              {[['Singular', 'o', 'a'], ['Plural', 'os', 'as']].map(([row, m, f]) => (
                <div key={row} className="grid grid-cols-3 px-3 py-1.5 text-sm border-t border-border/60">
                  <span className="text-muted-foreground">{row}</span>
                  <span className="font-semibold text-center">{m}</span>
                  <span className="font-semibold text-center">{f}</span>
                </div>
              ))}
            </div>
            <SectionLabel>Indefinite Articles (a/an/some)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                <span></span><span className="text-center">Masculine</span><span className="text-center">Feminine</span>
              </div>
              {[['Singular', 'um', 'uma'], ['Plural', 'uns', 'umas']].map(([row, m, f]) => (
                <div key={row} className="grid grid-cols-3 px-3 py-1.5 text-sm border-t border-border/60">
                  <span className="text-muted-foreground">{row}</span>
                  <span className="font-semibold text-center">{m}</span>
                  <span className="font-semibold text-center">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Gender Patterns</SectionLabel>
            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Usually Masculine:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['-o endings', '-ão endings', '-or endings', '-ema', '-ema words (problema, sistema)'].map(p => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded-sm bg-primary/10 text-primary">{p}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Usually Feminine:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['-a endings', '-ade endings', '-ão (some)', '-gem endings', '-dade endings'].map(p => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded-sm bg-muted text-muted-foreground">{p}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <SectionLabel>Examples</SectionLabel>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {[
                  ['o livro', 'the book (m)'], ['a casa', 'the house (f)'],
                  ['o homem', 'the man (m)'], ['a mulher', 'the woman (f)'],
                  ['o problema', 'the problem (m!)'], ['a cidade', 'the city (f)'],
                  ['um carro', 'a car (m)'], ['uma flor', 'a flower (f)'],
                ].map(([pt, en]) => (
                  <div key={pt} className="flex gap-1 text-sm py-0.5">
                    <span className="font-semibold shrink-0">{pt}</span>
                    <span className="text-muted-foreground text-[11px]">{en}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 18. Adjective Agreement ──────────────────────────────────────────────────

export function PtAdjectiveAgreementCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Concordância dos Adjetivos — Adjective Agreement</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Agreement Patterns</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                <span>Type</span><span className="text-center">Masc.</span><span className="text-center">Fem.</span>
              </div>
              {[
                ['Singular', 'alto', 'alta'],
                ['Plural', 'altos', 'altas'],
                ['-e (invariant)', 'grande', 'grande'],
                ['Plural -e', 'grandes', 'grandes'],
                ['-or', 'trabalhador', 'trabalhadora'],
                ['-ão → ã', 'alemão', 'alemã'],
              ].map(([type, m, f], i) => (
                <div key={type} className={`grid grid-cols-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="text-muted-foreground">{type}</span>
                  <span className="font-semibold text-center">{m}</span>
                  <span className="font-semibold text-center">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Examples in Context</SectionLabel>
            <div className="space-y-2">
              {[
                ['um homem alto', 'uma mulher alta', 'tall man / tall woman'],
                ['um livro interessante', 'uma ideia interessante', 'interesting book/idea'],
                ['os meninos bonitos', 'as meninas bonitas', 'pretty boys / pretty girls'],
                ['um professor trabalhador', 'uma professora trabalhadora', 'hardworking teacher'],
              ].map(([m, f, en]) => (
                <div key={m} className="p-2 rounded-md bg-muted/50 border border-border/50 text-sm">
                  <div className="flex gap-2 flex-wrap">
                    <span className="font-semibold">{m}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-semibold">{f}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{en}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Adjectives typically follow the noun: <em>um carro vermelho</em> (a red car). Exceptions for emphasis or meaning change: <em>um grande homem</em> vs. <em>um homem grande</em>.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 19. Object Pronouns ──────────────────────────────────────────────────────

export function PtObjectPronounsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Pronomes Oblíquos — Object Pronouns</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Pronoun Chart</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-4 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                <span>Subject</span><span>Direct</span><span>Indirect</span><span>Meaning</span>
              </div>
              {[
                ['eu', 'me', 'me', 'me/to me'],
                ['tu', 'te', 'te', 'you/to you'],
                ['ele', 'o', 'lhe', 'him/to him'],
                ['ela', 'a', 'lhe', 'her/to her'],
                ['você', 'o/a', 'lhe', 'you/to you'],
                ['nós', 'nos', 'nos', 'us/to us'],
                ['eles', 'os', 'lhes', 'them/to them'],
                ['elas', 'as', 'lhes', 'them(f)/to them'],
              ].map(([subj, dir, ind, en], i) => (
                <div key={subj + dir} className={`grid grid-cols-4 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="text-muted-foreground">{subj}</span>
                  <span className="font-semibold">{dir}</span>
                  <span className="font-semibold">{ind}</span>
                  <span className="text-[11px] text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Examples</SectionLabel>
            <div className="space-y-2">
              {[
                ['Direct', 'Ele me vê. / Você o conhece?', 'He sees me. / Do you know him?'],
                ['Indirect', 'Ela lhe deu um presente.', 'She gave him/her a gift.'],
                ['BR pronoun', 'Você pode me ajudar?', 'Can you help me? (common in BR)'],
                ['EU placement', 'Dá-me isso! / Deu-lhe.', 'Give me that! / He/She gave him.'],
              ].map(([type, pt, en]) => (
                <div key={type} className="flex flex-col gap-0.5 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{type}</span>
                  <span className="text-sm font-semibold">{pt}</span>
                  <span className="text-xs text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Brazilian Portuguese strongly prefers <strong>me/te/nos</strong> as both direct and indirect pronouns. <em>Lhe</em> is common in formal BR and everywhere in EU-PT.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 20. Tu vs Você ───────────────────────────────────────────────────────────

export function PtTuVoceCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Tu vs. Você — Address Forms in Portuguese</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold mb-2">TU — Informal (varies by region)</p>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['EU-PT', 'Tu falas muito! (with verb conjugation)'],
                ['BR varies', 'Tu fala muito! (BR informal — often uninflected)'],
                ['When used', 'Portugal, Rio Grande do Sul (BR), Nordeste (BR)'],
                ['Pronoun', 'tu → te (Dou-te o livro. / Te dou o livro.)'],
              ].map(([key, val], i) => (
                <div key={key} className={`px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="text-muted-foreground text-[11px]">{key}: </span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">VOCÊ — Formal/General (dominant in Brazil)</p>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['BR default', 'Você fala muito! (uses 3rd-person verb)'],
                ['EU-PT formal', 'O senhor / A senhora (most formal)'],
                ['Pronoun', 'você → lhe / o / a / se'],
                ['When used', 'All Brazil (informal + formal); EU-PT (formal context)'],
              ].map(([key, val], i) => (
                <div key={key} className={`px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="text-muted-foreground text-[11px]">{key}: </span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
          <strong>Summary:</strong> In Brazil, <em>você</em> is the default for both formal and informal. In Portugal, <em>tu</em> is used informally with full verb conjugation; <em>você</em> can sound distant/cold, and <em>o senhor/a senhora</em> is the formal option.
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 21. Questions ────────────────────────────────────────────────────────────

export function PtQuestionsCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Fazer Perguntas — Forming Questions</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Question Words (Palavras Interrogativas)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['O quê? / Que?', 'What?'],
                ['Quem?', 'Who?'],
                ['Onde?', 'Where?'],
                ['Quando?', 'When?'],
                ['Por que? / Porquê?', 'Why?'],
                ['Como?', 'How?'],
                ['Quanto/a?', 'How much?'],
                ['Quantos/as?', 'How many?'],
                ['Qual? / Quais?', 'Which? / Which ones?'],
                ['De onde?', 'From where?'],
              ].map(([q, en], i) => (
                <div key={q} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold w-36 shrink-0">{q}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Question Formation Methods</SectionLabel>
            <div className="space-y-3">
              {[
                ['Intonation (most common in BR)', 'Você fala inglês? — You speak English? (rising tone)'],
                ['Inversion (formal / PT)', 'Fala você inglês? — Do you speak English?'],
                ['Question word first', 'Onde você mora? — Where do you live?'],
                ['Tag questions (né? / não é?)', 'Você estuda, né? — You study, right?'],
                ['Está bem? / Tudo bem?', 'OK? / Is everything alright?'],
              ].map(([method, example]) => (
                <div key={method} className="flex flex-col gap-0.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{method}</span>
                  <span className="text-sm font-semibold">{example}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 22. Contractions ─────────────────────────────────────────────────────────

export function PtContractionsCard() {
  const contractions: { prep: string; article: string; result: string; example: string }[] = [
    { prep: 'a', article: 'o', result: 'ao', example: 'Vou ao mercado. (I\'m going to the market.)' },
    { prep: 'a', article: 'a', result: 'à', example: 'Chego à escola. (I arrive at the school.)' },
    { prep: 'a', article: 'os', result: 'aos', example: 'Falo aos alunos. (I speak to the students.)' },
    { prep: 'a', article: 'as', result: 'às', example: 'Vou às aulas. (I go to the classes.)' },
    { prep: 'de', article: 'o', result: 'do', example: 'o dono do carro (the owner of the car)' },
    { prep: 'de', article: 'a', result: 'da', example: 'a capital da França (the capital of France)' },
    { prep: 'de', article: 'os', result: 'dos', example: 'o preço dos bilhetes (the price of the tickets)' },
    { prep: 'de', article: 'as', result: 'das', example: 'o fim das aulas (the end of classes)' },
    { prep: 'em', article: 'o', result: 'no', example: 'Estou no trabalho. (I\'m at work.)' },
    { prep: 'em', article: 'a', result: 'na', example: 'Moro na cidade. (I live in the city.)' },
    { prep: 'em', article: 'os', result: 'nos', example: 'Nos países lusófonos… (In Lusophone countries…)' },
    { prep: 'em', article: 'as', result: 'nas', example: 'nas ruas (in the streets)' },
    { prep: 'por', article: 'o', result: 'pelo', example: 'Andei pelo parque. (I walked through the park.)' },
    { prep: 'por', article: 'a', result: 'pela', example: 'pela manhã (in the morning)' },
    { prep: 'por', article: 'os', result: 'pelos', example: 'pelos campos (through the fields)' },
    { prep: 'por', article: 'as', result: 'pelas', example: 'pelas ruas (through the streets)' },
  ];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Contrações — Preposition + Article Contractions</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-4 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                <span>Prep.</span><span>+ Art.</span><span>= Result</span><span>Example</span>
              </div>
              {contractions.slice(0, 8).map(({ prep, article, result, example }, i) => (
                <div key={result + i} className={`grid grid-cols-4 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-mono text-muted-foreground">{prep}</span>
                  <span className="font-mono text-muted-foreground">+{article}</span>
                  <span className="font-mono font-bold text-primary">{result}</span>
                  <span className="text-[11px] text-muted-foreground">{example.split('(')[0].trim()}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-4 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
                <span>Prep.</span><span>+ Art.</span><span>= Result</span><span>Example</span>
              </div>
              {contractions.slice(8).map(({ prep, article, result, example }, i) => (
                <div key={result + i} className={`grid grid-cols-4 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-mono text-muted-foreground">{prep}</span>
                  <span className="font-mono text-muted-foreground">+{article}</span>
                  <span className="font-mono font-bold text-primary">{result}</span>
                  <span className="text-[11px] text-muted-foreground">{example.split('(')[0].trim()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Contractions are mandatory in Portuguese — you cannot say <em>*a o</em> or <em>*de o</em>. Unlike French, Portuguese also contracts <strong>em+article</strong> (no/na) and <strong>por+article</strong> (pelo/pela).</p>
      </CardContent>
    </Card>
  );
}
