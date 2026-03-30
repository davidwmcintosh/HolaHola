/**
 * TextbookNumbersCards.tsx
 * Language-specific numbers reference cards for Spanish, French, German,
 * Italian, Portuguese, and English.
 * Auto-triggered via classify*GrammarType() in ChapterIntroduction.tsx.
 */

import { Card, CardContent } from '@/components/ui/card';

const V = 'text-violet-700 dark:text-violet-400';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </h3>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md bg-primary/5 border border-primary/15 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
      {children}
    </div>
  );
}

interface TableRow { a: string; b: string; c?: string; }

function SimpleTable({ headers, rows }: { headers: [string, string, string?]; rows: TableRow[] }) {
  const threeCol = headers[2] !== undefined;
  return (
    <div className="rounded-md border border-border overflow-hidden mb-3">
      <div className={`grid text-[10px] font-semibold uppercase tracking-wider bg-muted/50 text-muted-foreground ${threeCol ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="px-2 py-1">{headers[0]}</div>
        <div className="px-2 py-1">{headers[1]}</div>
        {threeCol && <div className="px-2 py-1">{headers[2]}</div>}
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`grid text-xs border-t border-border/60 ${threeCol ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="px-2 py-1.5 font-mono text-muted-foreground">{r.a}</div>
          <div className={`px-2 py-1.5 font-semibold ${V}`}>{r.b}</div>
          {threeCol && <div className="px-2 py-1.5 text-muted-foreground">{r.c}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Spanish ─────────────────────────────────────────────────────────────────
export function EsNumbersCard() {
  const grid: [string, string][] = [
    ['0','cero'], ['1','uno'], ['2','dos'], ['3','tres'], ['4','cuatro'],
    ['5','cinco'], ['6','seis'], ['7','siete'], ['8','ocho'], ['9','nueve'],
    ['10','diez'], ['11','once'], ['12','doce'], ['13','trece'], ['14','catorce'],
    ['15','quince'], ['16','dieciséis'], ['17','diecisiete'], ['18','dieciocho'],
    ['19','diecinueve'], ['20','veinte'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Los números — 0 to 20</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {grid.map(([n, w]) => (
            <div key={n} className="rounded-md border border-border/60 p-2 text-center">
              <div className="text-sm font-mono text-muted-foreground">{n}</div>
              <div className={`text-sm font-bold ${V}`}>{w}</div>
            </div>
          ))}
        </div>
        <SectionLabel>Tens (20–90)</SectionLabel>
        <SimpleTable
          headers={['#', 'Spanish', undefined]}
          rows={[
            { a: '20', b: 'veinte' }, { a: '30', b: 'treinta' }, { a: '40', b: 'cuarenta' },
            { a: '50', b: 'cincuenta' }, { a: '60', b: 'sesenta' }, { a: '70', b: 'setenta' },
            { a: '80', b: 'ochenta' }, { a: '90', b: 'noventa' },
          ]}
        />
        <SectionLabel>Hundreds & beyond</SectionLabel>
        <SimpleTable
          headers={['#', 'Spanish', 'Note']}
          rows={[
            { a: '100', b: 'cien', c: 'exactly 100' },
            { a: '101+', b: 'ciento…', c: 'ciento uno, ciento dos…' },
            { a: '200', b: 'doscientos', c: 'fem: doscientas' },
            { a: '500', b: 'quinientos', c: 'irregular form' },
            { a: '1,000', b: 'mil', c: 'no "un" before mil' },
            { a: '1,000,000', b: 'un millón', c: 'millones (plural)' },
          ]}
        />
        <NoteBox>
          <strong>Compound rules:</strong> 16–19 and 21–29 fuse into one word (dieciséis, veintiuno). From 31 onward, use "y": treinta y uno, cuarenta y dos. "cien" = exactly 100; add anything and it becomes "ciento".
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── French ──────────────────────────────────────────────────────────────────
export function FrNumbersCard() {
  const grid: [string, string][] = [
    ['0','zéro'], ['1','un'], ['2','deux'], ['3','trois'], ['4','quatre'],
    ['5','cinq'], ['6','six'], ['7','sept'], ['8','huit'], ['9','neuf'],
    ['10','dix'], ['11','onze'], ['12','douze'], ['13','treize'], ['14','quatorze'],
    ['15','quinze'], ['16','seize'], ['17','dix-sept'], ['18','dix-huit'],
    ['19','dix-neuf'], ['20','vingt'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Les nombres — 0 à 20</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {grid.map(([n, w]) => (
            <div key={n} className="rounded-md border border-border/60 p-2 text-center">
              <div className="text-sm font-mono text-muted-foreground">{n}</div>
              <div className={`text-sm font-bold ${V}`}>{w}</div>
            </div>
          ))}
        </div>
        <SectionLabel>Tens (20–90)</SectionLabel>
        <SimpleTable
          headers={['#', 'French', 'Logic']}
          rows={[
            { a: '20', b: 'vingt', c: 'base' },
            { a: '30', b: 'trente', c: 'base' },
            { a: '40', b: 'quarante', c: 'base' },
            { a: '50', b: 'cinquante', c: 'base' },
            { a: '60', b: 'soixante', c: 'base' },
            { a: '70', b: 'soixante-dix', c: '60 + 10' },
            { a: '80', b: 'quatre-vingts', c: '4 × 20' },
            { a: '90', b: 'quatre-vingt-dix', c: '4×20 + 10' },
          ]}
        />
        <SectionLabel>Hundreds & beyond</SectionLabel>
        <SimpleTable
          headers={['#', 'French', 'Note']}
          rows={[
            { a: '100', b: 'cent', c: 'no article' },
            { a: '200', b: 'deux cents', c: 'cent drops -s if followed by another number' },
            { a: '1,000', b: 'mille', c: 'never "un mille"' },
            { a: '1,000,000', b: 'un million', c: 'millions (plural)' },
          ]}
        />
        <NoteBox>
          <strong>The unusual 70–99:</strong> French counts in 60s and 20s. 70 = soixante-dix (sixty-ten), 71 = soixante et onze, 75 = soixante-quinze. 80 = quatre-vingts (4×20), 81 = quatre-vingt-un. 90 = quatre-vingt-dix. Belgium and Switzerland use <em>septante</em> (70) and <em>nonante</em> (90).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── German ───────────────────────────────────────────────────────────────────
export function DeNumbersCard() {
  const grid: [string, string][] = [
    ['0','null'], ['1','eins'], ['2','zwei'], ['3','drei'], ['4','vier'],
    ['5','fünf'], ['6','sechs'], ['7','sieben'], ['8','acht'], ['9','neun'],
    ['10','zehn'], ['11','elf'], ['12','zwölf'], ['13','dreizehn'], ['14','vierzehn'],
    ['15','fünfzehn'], ['16','sechzehn'], ['17','siebzehn'], ['18','achtzehn'],
    ['19','neunzehn'], ['20','zwanzig'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Zahlen — 0 bis 20</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {grid.map(([n, w]) => (
            <div key={n} className="rounded-md border border-border/60 p-2 text-center">
              <div className="text-sm font-mono text-muted-foreground">{n}</div>
              <div className={`text-sm font-bold ${V}`}>{w}</div>
            </div>
          ))}
        </div>
        <SectionLabel>Tens (20–90)</SectionLabel>
        <SimpleTable
          headers={['#', 'German', undefined]}
          rows={[
            { a: '20', b: 'zwanzig' }, { a: '30', b: 'dreißig' }, { a: '40', b: 'vierzig' },
            { a: '50', b: 'fünfzig' }, { a: '60', b: 'sechzig' }, { a: '70', b: 'siebzig' },
            { a: '80', b: 'achtzig' }, { a: '90', b: 'neunzig' },
          ]}
        />
        <SectionLabel>Building compound numbers</SectionLabel>
        <SimpleTable
          headers={['#', 'German', 'Literal']}
          rows={[
            { a: '21', b: 'einundzwanzig', c: 'one-and-twenty' },
            { a: '35', b: 'fünfunddreißig', c: 'five-and-thirty' },
            { a: '47', b: 'siebenundvierzig', c: 'seven-and-forty' },
            { a: '100', b: '(ein)hundert', c: '"ein" optional for 100' },
            { a: '200', b: 'zweihundert', c: 'joined, no space' },
            { a: '1,000', b: '(ein)tausend', c: '"ein" optional for 1,000' },
            { a: '1,000,000', b: 'eine Million', c: 'Millionen (plural)' },
          ]}
        />
        <NoteBox>
          <strong>Ones before tens:</strong> German puts ones BEFORE tens, joined by "und": 21 = einundzwanzig (one-and-twenty). The whole number is written as one word. 1 changes to "ein" in compounds (not "eins"). Note 30 = dreißig (irregular -ßig, not -zigzig).
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── Italian ─────────────────────────────────────────────────────────────────
export function ItNumbersCard() {
  const grid: [string, string][] = [
    ['0','zero'], ['1','uno'], ['2','due'], ['3','tre'], ['4','quattro'],
    ['5','cinque'], ['6','sei'], ['7','sette'], ['8','otto'], ['9','nove'],
    ['10','dieci'], ['11','undici'], ['12','dodici'], ['13','tredici'], ['14','quattordici'],
    ['15','quindici'], ['16','sedici'], ['17','diciassette'], ['18','diciotto'],
    ['19','diciannove'], ['20','venti'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>I numeri — da 0 a 20</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {grid.map(([n, w]) => (
            <div key={n} className="rounded-md border border-border/60 p-2 text-center">
              <div className="text-sm font-mono text-muted-foreground">{n}</div>
              <div className={`text-sm font-bold ${V}`}>{w}</div>
            </div>
          ))}
        </div>
        <SectionLabel>Tens (20–90)</SectionLabel>
        <SimpleTable
          headers={['#', 'Italian', undefined]}
          rows={[
            { a: '20', b: 'venti' }, { a: '30', b: 'trenta' }, { a: '40', b: 'quaranta' },
            { a: '50', b: 'cinquanta' }, { a: '60', b: 'sessanta' }, { a: '70', b: 'settanta' },
            { a: '80', b: 'ottanta' }, { a: '90', b: 'novanta' },
          ]}
        />
        <SectionLabel>Building compound numbers</SectionLabel>
        <SimpleTable
          headers={['#', 'Italian', 'Note']}
          rows={[
            { a: '21', b: 'ventuno', c: 'venti drops -i before uno/otto' },
            { a: '23', b: 'ventitré', c: 'tre gets an accent' },
            { a: '28', b: 'ventotto', c: 'venti drops -i before otto' },
            { a: '100', b: 'cento', c: 'no article needed' },
            { a: '200', b: 'duecento', c: 'joined compound' },
            { a: '1,000', b: 'mille', c: 'plural: mila (duemila)' },
            { a: '1,000,000', b: 'un milione', c: 'milioni (plural)' },
          ]}
        />
        <NoteBox>
          <strong>Elision rule:</strong> Tens ending in a vowel (venti, trenta…) drop their final vowel before uno and otto: venti + uno = ventuno, trenta + otto = trentotto. Only "tre" is special — it always adds an accent: ventitré, trentatré.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── Portuguese ───────────────────────────────────────────────────────────────
export function PtNumbersCard() {
  const grid: [string, string][] = [
    ['0','zero'], ['1','um/uma'], ['2','dois/duas'], ['3','três'], ['4','quatro'],
    ['5','cinco'], ['6','seis'], ['7','sete'], ['8','oito'], ['9','nove'],
    ['10','dez'], ['11','onze'], ['12','doze'], ['13','treze'], ['14','catorze'],
    ['15','quinze'], ['16','dezesseis*'], ['17','dezessete*'], ['18','dezoito'],
    ['19','dezenove*'], ['20','vinte'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Os números — 0 a 20</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {grid.map(([n, w]) => (
            <div key={n} className="rounded-md border border-border/60 p-2 text-center">
              <div className="text-sm font-mono text-muted-foreground">{n}</div>
              <div className={`text-sm font-bold ${V}`}>{w}</div>
            </div>
          ))}
        </div>
        <SectionLabel>Tens (20–90)</SectionLabel>
        <SimpleTable
          headers={['#', 'Portuguese', undefined]}
          rows={[
            { a: '20', b: 'vinte' }, { a: '30', b: 'trinta' }, { a: '40', b: 'quarenta' },
            { a: '50', b: 'cinquenta' }, { a: '60', b: 'sessenta' }, { a: '70', b: 'setenta' },
            { a: '80', b: 'oitenta' }, { a: '90', b: 'noventa' },
          ]}
        />
        <SectionLabel>Hundreds & beyond</SectionLabel>
        <SimpleTable
          headers={['#', 'Portuguese', 'Note']}
          rows={[
            { a: '100', b: 'cem', c: 'exactly 100' },
            { a: '101+', b: 'cento…', c: 'cento e um, cento e dois…' },
            { a: '200', b: 'duzentos/as', c: 'agrees in gender' },
            { a: '300', b: 'trezentos/as', c: 'irregular form' },
            { a: '500', b: 'quinhentos/as', c: 'irregular form' },
            { a: '1,000', b: 'mil', c: 'no "um" before mil' },
            { a: '1,000,000', b: 'um milhão', c: 'milhões (plural)' },
          ]}
        />
        <NoteBox>
          <strong>Gender agreement:</strong> 1 and 2 agree with the noun (um/uma, dois/duas). Hundreds also agree: duzentos cadernos (m) / duzentas páginas (f). "cem" = exactly 100; add anything and it becomes "cento e…". * 16–19 are dezesseis/dezessete/dezenove in Brazilian Portuguese; dezasseis/dezassete/dezanove in European Portuguese.
        </NoteBox>
      </CardContent>
    </Card>
  );
}

// ─── English ─────────────────────────────────────────────────────────────────
export function EnNumbersCard() {
  const grid: [string, string][] = [
    ['0','zero'], ['1','one'], ['2','two'], ['3','three'], ['4','four'],
    ['5','five'], ['6','six'], ['7','seven'], ['8','eight'], ['9','nine'],
    ['10','ten'], ['11','eleven'], ['12','twelve'], ['13','thirteen'], ['14','fourteen'],
    ['15','fifteen'], ['16','sixteen'], ['17','seventeen'], ['18','eighteen'],
    ['19','nineteen'], ['20','twenty'],
  ];
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Numbers — 0 to 20</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {grid.map(([n, w]) => (
            <div key={n} className="rounded-md border border-border/60 p-2 text-center">
              <div className="text-sm font-mono text-muted-foreground">{n}</div>
              <div className={`text-sm font-bold ${V}`}>{w}</div>
            </div>
          ))}
        </div>
        <SectionLabel>Tens (20–90)</SectionLabel>
        <SimpleTable
          headers={['#', 'English', 'Watch out']}
          rows={[
            { a: '20', b: 'twenty', c: '' },
            { a: '30', b: 'thirty', c: 'not "threety"' },
            { a: '40', b: 'forty', c: 'no "u" — not "fourty"!' },
            { a: '50', b: 'fifty', c: 'five → fifty' },
            { a: '60', b: 'sixty', c: '' },
            { a: '70', b: 'seventy', c: '' },
            { a: '80', b: 'eighty', c: 'eight → eighty' },
            { a: '90', b: 'ninety', c: 'nine → ninety' },
          ]}
        />
        <SectionLabel>Building compound numbers</SectionLabel>
        <SimpleTable
          headers={['#', 'English', 'Note']}
          rows={[
            { a: '21', b: 'twenty-one', c: 'hyphen between tens and ones' },
            { a: '35', b: 'thirty-five', c: 'hyphen between tens and ones' },
            { a: '100', b: 'one hundred', c: 'or "a hundred"' },
            { a: '1,000', b: 'one thousand', c: 'or "a thousand"' },
            { a: '1,000,000', b: 'one million', c: 'or "a million"' },
          ]}
        />
        <NoteBox>
          <strong>Key irregulars:</strong> 11 (eleven) and 12 (twelve) don't follow the -teen pattern. 13–19 use -teen suffix. 40 is "forty" (no u). Compound numbers 21–99 use a hyphen: twenty-one, forty-three, ninety-nine. British English often adds "and" after hundreds: one hundred and twenty-three.
        </NoteBox>
      </CardContent>
    </Card>
  );
}
