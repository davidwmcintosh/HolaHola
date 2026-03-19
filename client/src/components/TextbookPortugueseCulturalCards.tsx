/**
 * TextbookPortugueseCulturalCards.tsx
 * Portuguese cultural reference cards for Textbook Section 5.
 *
 * Exports (7 cards):
 *  LusophoneWorldMapCard          — Where Portuguese is spoken
 *  PortugueseHolidayCalendarCard  — PT + BR holiday calendar
 *  PortugueseFoodGuideCard        — PT + BR regional food guide
 *  PortugueseDialectCard          — EU vs BR vs African Portuguese
 *  PortugueseEtiquetteCard        — Greeting etiquette
 *  PortugueseCurrencyCard         — Euro (PT) + Real (BR)
 *  PortugueseGestureCard          — Gesture awareness
 */

import { Card, CardContent } from "@/components/ui/card";
import { Globe, Calendar, UtensilsCrossed, MessageCircle, Handshake, Coins, Hand } from "lucide-react";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{children}</p>;
}

function CultureCardHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── 1. Lusophone World Map ───────────────────────────────────────────────────

const LUSOPHONE_COUNTRIES = [
  { country: 'Portugal', capital: 'Lisboa', population: '10.2M', note: 'Origin of the language' },
  { country: 'Brasil', capital: 'Brasília', population: '215M', note: 'Largest Lusophone nation' },
  { country: 'Angola', capital: 'Luanda', population: '34M', note: 'Fastest growing Lusophone economy' },
  { country: 'Moçambique', capital: 'Maputo', population: '33M', note: 'East African coast' },
  { country: 'Guiné-Bissau', capital: 'Bissau', population: '2M', note: 'West Africa' },
  { country: 'Cabo Verde', capital: 'Praia', population: '0.5M', note: 'Atlantic islands' },
  { country: 'São Tomé e Príncipe', capital: 'São Tomé', population: '0.2M', note: 'Gulf of Guinea islands' },
  { country: 'Guiné Equatorial', capital: 'Malabo', population: '1.5M', note: 'Also Spanish/French co-official' },
  { country: 'Timor-Leste', capital: 'Díli', population: '1.3M', note: 'Southeast Asia, co-official with Tetum' },
  { country: 'Macau (China)', capital: 'Macau SAR', population: '0.7M', note: 'Co-official with Chinese' },
];

export function LusophoneWorldMapCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <CultureCardHeader icon={Globe} title="O Mundo Lusófono — The Lusophone World" subtitle="Portuguese is spoken by ~260 million people across 4 continents in 10 countries" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Portuguese-Speaking Countries</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {LUSOPHONE_COUNTRIES.map((c, i) => (
                <div key={c.country} className={`px-3 py-2 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c.country}</span>
                    <span className="text-xs text-muted-foreground">{c.population}</span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">Cap: {c.capital}</span>
                    <span className="text-[11px] text-muted-foreground">— {c.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Continental Distribution</SectionLabel>
            <div className="space-y-3">
              {[
                { continent: 'Europe', countries: ['Portugal'], color: 'bg-blue-500/20 border-blue-500/40' },
                { continent: 'South America', countries: ['Brasil'], color: 'bg-green-500/20 border-green-500/40' },
                { continent: 'Africa', countries: ['Angola', 'Moçambique', 'Guiné-Bissau', 'Cabo Verde', 'São Tomé e Príncipe', 'Guiné Equatorial'], color: 'bg-orange-500/20 border-orange-500/40' },
                { continent: 'Asia/Oceania', countries: ['Timor-Leste', 'Macau (China)'], color: 'bg-purple-500/20 border-purple-500/40' },
              ].map(({ continent, countries, color }) => (
                <div key={continent} className={`p-3 rounded-md border ${color}`}>
                  <div className="text-sm font-semibold mb-1">{continent}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {countries.map(c => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-sm bg-background/60 border border-border/60">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
              <strong>CPLP:</strong> The Community of Portuguese Language Countries (Comunidade dos Países de Língua Portuguesa) was founded in 1996, uniting all 9 sovereign nations.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 2. Holiday Calendar ──────────────────────────────────────────────────────

const PT_HOLIDAYS = [
  { month: 'Jan', day: '1', name: 'Ano Novo', en: 'New Year\'s Day', flag: 'PT+BR' },
  { month: 'Feb', day: 'varies', name: 'Carnaval', en: 'Carnival (biggest in Brazil)', flag: 'PT+BR' },
  { month: 'Apr', day: '25', name: 'Dia da Liberdade', en: 'Freedom Day (Carnation Revolution)', flag: 'PT' },
  { month: 'Apr/May', day: 'varies', name: 'Páscoa', en: 'Easter Sunday', flag: 'PT+BR' },
  { month: 'May', day: '1', name: 'Dia do Trabalhador', en: 'Workers\' Day', flag: 'PT+BR' },
  { month: 'Jun', day: '10', name: 'Dia de Portugal', en: 'Portugal Day (Camões Day)', flag: 'PT' },
  { month: 'Jun', day: 'varies', name: 'Festa Junina / Santos Populares', en: 'June Festivals', flag: 'PT+BR' },
  { month: 'Sep', day: '7', name: 'Independência do Brasil', en: 'Brazilian Independence Day', flag: 'BR' },
  { month: 'Oct', day: '5', name: 'Implantação da República', en: 'Republic Day', flag: 'PT' },
  { month: 'Nov', day: '1', name: 'Todos os Santos / Finados', en: 'All Saints\' Day / Deceased', flag: 'PT+BR' },
  { month: 'Nov', day: '2', name: 'Dia de Finados', en: 'Day of the Deceased', flag: 'BR' },
  { month: 'Nov', day: '15', name: 'Proclamação da República', en: 'Proclamation of the Republic', flag: 'BR' },
  { month: 'Dec', day: '8', name: 'Imaculada Conceição', en: 'Immaculate Conception', flag: 'PT' },
  { month: 'Dec', day: '25', name: 'Natal', en: 'Christmas', flag: 'PT+BR' },
];

export function PortugueseHolidayCalendarCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <CultureCardHeader icon={Calendar} title="Feriados — Holiday Calendar" subtitle="Key holidays in Portugal (PT) and Brazil (BR) throughout the year" />
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-5 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
            <span>Month</span><span>Date</span><span className="col-span-2">Holiday</span><span>Country</span>
          </div>
          {PT_HOLIDAYS.map((h, i) => (
            <div key={h.name} className={`grid grid-cols-5 px-3 py-1.5 text-sm items-center ${i > 0 ? 'border-t border-border/60' : ''}`}>
              <span className="text-muted-foreground">{h.month}</span>
              <span className="text-muted-foreground text-xs">{h.day}</span>
              <div className="col-span-2">
                <div className="font-semibold">{h.name}</div>
                <div className="text-[11px] text-muted-foreground">{h.en}</div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${h.flag === 'PT' ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400' : h.flag === 'BR' ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground border-border'}`}>
                {h.flag}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
          <strong>Carnaval highlight:</strong> Brazil's Carnaval (especially in Rio de Janeiro and Salvador) is one of the world's largest festivals — held 40 days before Easter with samba parades, blocos (street parties), and costumes.
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 3. Food Guide ────────────────────────────────────────────────────────────

const FOOD_REGIONS = [
  {
    region: 'Portugal — Norte', dishes: [
      { name: 'Caldo verde', desc: 'kale soup with chouriço' },
      { name: 'Francesinha', desc: 'Porto\'s iconic layered sandwich with beer sauce' },
      { name: 'Tripas à moda do Porto', desc: 'Porto-style tripe stew' },
    ],
  },
  {
    region: 'Portugal — Centro/Sul', dishes: [
      { name: 'Bacalhau à Brás', desc: 'salted cod with eggs and potato sticks' },
      { name: 'Pastéis de Belém', desc: 'Lisbon\'s famous custard tarts' },
      { name: 'Cataplana', desc: 'Algarve seafood stew in a copper pan' },
    ],
  },
  {
    region: 'Brasil — Sudeste', dishes: [
      { name: 'Feijoada', desc: 'black bean stew with pork — Brazil\'s national dish' },
      { name: 'Pão de queijo', desc: 'cheese bread balls (Minas Gerais)' },
      { name: 'Churrasco', desc: 'Brazilian barbecue — grilled meats on skewers' },
    ],
  },
  {
    region: 'Brasil — Nordeste', dishes: [
      { name: 'Acarajé', desc: 'Bahian fried bean cake with spicy shrimp (Afro-Brazilian)' },
      { name: 'Moqueca', desc: 'coconut milk and palm oil seafood stew' },
      { name: 'Tapioca', desc: 'cassava starch pancake — breakfast staple' },
    ],
  },
  {
    region: 'Brasil — Norte/Amazônia', dishes: [
      { name: 'Tacacá', desc: 'shrimp broth with jambu herb and tucupi' },
      { name: 'Pato no tucupi', desc: 'duck in fermented manioc broth' },
      { name: 'Açaí', desc: 'Amazonian palm berry — energy bowl' },
    ],
  },
  {
    region: 'Pan-Lusophone', dishes: [
      { name: 'Arroz', desc: 'rice — staple in all Lusophone cuisines' },
      { name: 'Feijão', desc: 'beans — black (BR), white/red (PT)' },
      { name: 'Café expresso', desc: 'espresso — bica (PT) or cafezinho (BR)' },
    ],
  },
];

export function PortugueseFoodGuideCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <CultureCardHeader icon={UtensilsCrossed} title="Gastronomia Lusófona — Lusophone Food Guide" subtitle="From bacalhau in Lisbon to feijoada in São Paulo — a culinary tour" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {FOOD_REGIONS.map(({ region, dishes }) => (
            <div key={region} className="rounded-md border border-border overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wide">{region}</span>
              </div>
              {dishes.map((d, i) => (
                <div key={d.name} className={`px-3 py-2 ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <div className="text-sm font-semibold">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground">{d.desc}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
          <strong>Bacalhau:</strong> Portugal has over 365 recipes for salted cod (bacalhau) — one for every day of the year. It is called <em>o fiel amigo</em> (the faithful friend).
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 4. Dialect Zones ─────────────────────────────────────────────────────────

const DIALECT_ZONES = [
  {
    name: 'Português Europeu (EU-PT)',
    spoken: 'Portugal, Açores, Madeira',
    key: [
      'Vowel reduction — unstressed /e/ and /o/ nearly disappear',
      'Progressive: estar a + infinitive (estou a falar)',
      'Tu used informally with full conjugation (tu falas)',
      'Strong consonants — P/T/K unaspirated',
      'Gerund less used — prefers infinitive constructions',
    ],
    sample: 'Estou a trabalhar agora.',
    translation: 'I am working now.',
  },
  {
    name: 'Português Brasileiro (BR-PT)',
    spoken: 'Brasil (215 million speakers)',
    key: [
      'Vowel preservation — all vowels clearly pronounced',
      'Progressive: estar + gerúndio (estou falando)',
      'Você used for both formal and informal address',
      'Ti/Di palatalization: ti=/tʃi/, di=/dʒi/ (especially SE Brazil)',
      'Open vowels — more melodic, sing-song intonation',
    ],
    sample: 'Estou trabalhando agora.',
    translation: 'I am working now.',
  },
  {
    name: 'Português Africano',
    spoken: 'Angola, Moçambique, Cabo Verde, Guiné-Bissau…',
    key: [
      'Influenced by Bantu, Creole, and local languages',
      'Vowel quality closer to EU-PT but with regional rhythms',
      'Cabo Verde has strong Creole influence (Kriolu)',
      'Multiple official and regional variants exist',
      'Growing in international importance (Angola = 2nd largest PT economy)',
    ],
    sample: 'Estou a trabalhar/trabalhando.',
    translation: 'I am working. (mix of EU/BR forms)',
  },
];

export function PortugueseDialectCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <CultureCardHeader icon={MessageCircle} title="Variedades do Português — Portuguese Dialects" subtitle="One language, many flavors across 4 continents" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DIALECT_ZONES.map((zone) => (
            <div key={zone.name} className="rounded-md border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b border-border">
                <div className="text-sm font-semibold">{zone.name}</div>
                <div className="text-[11px] text-muted-foreground">{zone.spoken}</div>
              </div>
              <div className="px-3 py-2">
                <ul className="space-y-1">
                  {zone.key.map(k => (
                    <li key={k} className="flex gap-1.5 text-xs">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 p-2 rounded-sm bg-primary/5 border border-primary/20">
                  <div className="text-xs font-semibold">{zone.sample}</div>
                  <div className="text-[11px] text-muted-foreground">{zone.translation}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground">
          <strong>Mutual intelligibility:</strong> EU-PT and BR-PT speakers understand each other, though accents require adjustment. An agreement (Acordo Ortográfico 1990, 2009) unified spelling across Lusophone countries.
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 5. Etiquette ─────────────────────────────────────────────────────────────

export function PortugueseEtiquetteCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <CultureCardHeader icon={Handshake} title="Etiqueta — Social Etiquette" subtitle="Greetings and social norms in Portugal and Brazil" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Greetings — Portugal</SectionLabel>
            <div className="space-y-2">
              {[
                ['Beijo', 'One kiss on the right cheek — standard greeting between women and between men/women. Common in social settings.'],
                ['Aperto de mão', 'Handshake — standard between men. Firm grip appreciated.'],
                ['Olá! / Bom dia!', 'Verbal greeting always accompanies physical greeting.'],
                ['Formal Address', '"O senhor / A senhora" for strangers, elders, or formal context.'],
              ].map(([label, desc]) => (
                <div key={label} className="flex flex-col gap-0.5 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Greetings — Brazil</SectionLabel>
            <div className="space-y-2">
              {[
                ['Beijo(s)', 'One or two kisses on the cheek — common between women and mixed gender. Varies by region (one in São Paulo, two elsewhere).'],
                ['Abraço', 'Hugs are very common in Brazil — warm, open culture.'],
                ['Aperto de mão', 'Handshakes between men in formal/professional contexts.'],
                ['Oi! / Tudo bem?', '"Tudo bem?" (Everything OK?) is the standard casual greeting — answer: "Tudo!" or "Tudo bem!"'],
              ].map(([label, desc]) => (
                <div key={label} className="flex flex-col gap-0.5 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <SectionLabel>Essential Social Phrases</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {[
              ['Bom dia / Boa tarde / Boa noite', 'Good morning / afternoon / evening'],
              ['Olá! / Oi!', 'Hi! (EU-PT: Olá; BR: Oi more common)'],
              ['Como está? / Como vai?', 'How are you? (formal / informal)'],
              ['Tudo bem? / Tudo bom?', 'Everything OK? (very BR)'],
              ['Com licença / Desculpe', 'Excuse me / Sorry'],
              ['Por favor / Obrigado/a', 'Please / Thank you'],
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

// ─── 6. Currency ──────────────────────────────────────────────────────────────

export function PortugueseCurrencyCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <CultureCardHeader icon={Coins} title="Moeda — Currency in Lusophone Countries" subtitle="Euro in Portugal, Real in Brazil, and more across the Lusophone world" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Euro — Portugal (€)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['Symbol', '€ (euro sign)'],
                ['Code', 'EUR'],
                ['Subdivisions', '1 euro = 100 cêntimos'],
                ['Coins', '1c, 2c, 5c, 10c, 20c, 50c, €1, €2'],
                ['Notes', '€5, €10, €20, €50, €100, €200, €500'],
                ['In use since', '2002 (replaced the escudo)'],
              ].map(([key, val], i) => (
                <div key={key} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="text-muted-foreground w-28 shrink-0">{key}</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>
            <SectionLabel>Saying Prices in Portuguese</SectionLabel>
            <div className="space-y-1">
              {[
                ['Quanto custa?', 'How much does it cost?'],
                ['Custa dois euros e cinquenta.', 'It costs €2.50.'],
                ['Está em promoção.', 'It\'s on sale.'],
                ['Aceita cartão?', 'Do you accept card?'],
              ].map(([pt, en]) => (
                <div key={pt} className="flex gap-2 text-sm py-0.5">
                  <span className="font-medium shrink-0">{pt}</span>
                  <span className="text-muted-foreground">— {en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Real Brasileiro — Brazil (R$)</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden mb-3">
              {[
                ['Symbol', 'R$ (real sign)'],
                ['Code', 'BRL'],
                ['Subdivisions', '1 real = 100 centavos'],
                ['Coins', '5c, 10c, 25c, 50c, R$1'],
                ['Notes', 'R$2, R$5, R$10, R$20, R$50, R$100, R$200'],
                ['In use since', '1994 (replaced the cruzeiro real)'],
              ].map(([key, val], i) => (
                <div key={key} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="text-muted-foreground w-28 shrink-0">{key}</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>
            <SectionLabel>Other Lusophone Currencies</SectionLabel>
            <div className="rounded-md border border-border overflow-hidden">
              {[
                ['Angola', 'Kwanza (AOA)'],
                ['Moçambique', 'Metical (MZN)'],
                ['Cabo Verde', 'Escudo Cabo-verdiano (CVE)'],
                ['Timor-Leste', 'Dólar americano (USD)'],
              ].map(([country, currency], i) => (
                <div key={country} className={`flex gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="text-muted-foreground w-32 shrink-0">{country}</span>
                  <span className="font-medium">{currency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 7. Gestures ─────────────────────────────────────────────────────────────

export function PortugueseGestureCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <CultureCardHeader icon={Hand} title="Gestos — Gesture Awareness" subtitle="Reading body language in Portuguese-speaking cultures" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Common Portuguese/Brazilian Gestures</SectionLabel>
            <div className="space-y-3">
              {[
                {
                  gesture: 'Thumbs Up',
                  meaning: 'OK / Great! — universally positive across PT and BR.',
                  use: 'Agreement, approval, "all good"',
                },
                {
                  gesture: 'Joining fingertips + flick',
                  meaning: '"Muito cheio" or can mean "packed/full" (PT). Context-dependent.',
                  use: 'Indicating a place is packed, or sometimes dismissive',
                },
                {
                  gesture: 'Hand waving side to side (flat)',
                  meaning: '"Não" (no) — waving the whole hand to indicate refusal.',
                  use: 'Polite refusal, negative response',
                },
                {
                  gesture: 'Index finger wagging',
                  meaning: '"Não, não!" (no, no!) — stronger refusal or correction.',
                  use: 'Warning, correcting, strong negation',
                },
                {
                  gesture: 'Blowing a kiss (mwah)',
                  meaning: 'Approval — "excelente!" especially about food.',
                  use: 'Complimenting food, approval of something great',
                },
              ].map(({ gesture, meaning, use }) => (
                <div key={gesture} className="flex flex-col gap-0.5 py-2 border-b border-border/30 last:border-0">
                  <span className="text-sm font-semibold">{gesture}</span>
                  <span className="text-xs text-muted-foreground">{meaning}</span>
                  <span className="text-[11px] text-primary/80">Use: {use}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Cultural Body Language Notes</SectionLabel>
            <div className="space-y-3">
              {[
                {
                  title: 'Personal Space',
                  note: 'Both Portugal and Brazil have closer personal space norms than Northern Europe or North America. Standing close is not considered rude.',
                },
                {
                  title: 'Eye Contact',
                  note: 'Direct eye contact is respectful and shows engagement. Avoiding it can seem untrustworthy or disrespectful.',
                },
                {
                  title: 'Physical Touch',
                  note: 'Brazilians especially are tactile — light touches on arm/shoulder during conversation are very normal and friendly.',
                },
                {
                  title: 'Saudade',
                  note: 'A uniquely Portuguese concept — a bittersweet longing for something absent. Often expressed with a melancholic sigh or far-off gaze.',
                },
                {
                  title: 'Fado Silence (PT)',
                  note: 'During a Fado performance, complete silence and reverence is expected. Applause only after the song fully ends.',
                },
              ].map(({ title, note }) => (
                <div key={title} className="flex flex-col gap-0.5 py-2 border-b border-border/30 last:border-0">
                  <span className="text-sm font-semibold">{title}</span>
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
