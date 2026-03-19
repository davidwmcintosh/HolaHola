/**
 * TextbookCanvasCards — Textbook reference cards built from the same SVG components
 * that Daniela uses live in /chat. This guarantees visual consistency: "rainy" in the
 * textbook and "rainy" in a lesson are literally the same renderer.
 *
 * Exported cards (all Section 7 — Vocabulary Reference):
 *   WeatherVocabCard      — 10 weather conditions in a grid
 *   EmotionsVocabCard     — 11 emotion faces in a grid
 *   TimeVocabCard         — 8 clocks with Spanish time phrases
 *   DaysOfWeekCard        — Spanish calendar + months table
 *   BodyPartsCard         — Body diagram + vocabulary table
 *   FacePartsCard         — Face close-up diagram + vocabulary table
 *   HandPartsCard         — Hand diagram + vocabulary table
 *   ThermometerVocabCard  — Temperature scale with Spanish descriptions
 *   CountryDotMapCard     — World map with all Spanish-speaking countries
 */

import { Card, CardContent } from "@/components/ui/card";
import {
  WeatherIcon,
  EMOTION_CONFIG,
  AnalogClock,
  CalendarCanvas,
  ThermometerCanvas,
  BodyDiagramCanvas,
  FaceDiagramCanvas,
  HandDiagramCanvas,
  WorldMapCanvas,
} from "./SceneCanvas";

// ─── Shared section header ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
      {children}
    </p>
  );
}

// ─── Mini emotion face (inline SVG at custom size) ────────────────────────────

function MiniEmotionFace({ emotion, size = 60 }: { emotion: string; size?: number }) {
  const cfg = EMOTION_CONFIG[emotion] ?? EMOTION_CONFIG['happy'];
  const eyeRy = cfg.eyeWide ? 10 : cfg.eyeClose ? 3 : 7;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label={`Emotion: ${emotion}`}>
      <circle cx="60" cy="60" r="52" fill={cfg.faceColor} />
      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      <path d={cfg.browLeft} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="3.5" strokeLinecap="round" />
      <path d={cfg.browRight} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="44" cy="58" rx="7" ry={eyeRy} fill="rgba(0,0,0,0.75)" />
      <ellipse cx="76" cy="58" rx="7" ry={eyeRy} fill="rgba(0,0,0,0.75)" />
      {!cfg.eyeClose && !cfg.eyeWide && (
        <>
          <circle cx="46" cy="55" r="2" fill="white" />
          <circle cx="78" cy="55" r="2" fill="white" />
        </>
      )}
      <path d={cfg.mouth} fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Language label helpers ───────────────────────────────────────────────────

type LangCode = 'spanish' | 'french';

// ─── 1. Weather Vocabulary Card ───────────────────────────────────────────────

interface WeatherEntry { condition: string; label: string; english: string }

const WEATHER_VOCAB_ES: WeatherEntry[] = [
  { condition: 'sunny',        label: 'Hace sol',                   english: 'It\'s sunny' },
  { condition: 'hot',          label: 'Hace mucho calor',           english: 'It\'s very hot' },
  { condition: 'cold',         label: 'Hace frío',                  english: 'It\'s cold' },
  { condition: 'cloudy',       label: 'Está nublado',               english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: 'Parcialmente nublado',       english: 'Partly cloudy' },
  { condition: 'rainy',        label: 'Llueve / Está lloviendo',    english: 'It\'s raining' },
  { condition: 'stormy',       label: 'Hay tormenta',               english: 'There\'s a storm' },
  { condition: 'snowy',        label: 'Nieva / Está nevando',       english: 'It\'s snowing' },
  { condition: 'windy',        label: 'Hace viento',                english: 'It\'s windy' },
  { condition: 'foggy',        label: 'Hay niebla',                 english: 'It\'s foggy' },
];

const WEATHER_VOCAB_FR: WeatherEntry[] = [
  { condition: 'sunny',        label: 'Il fait soleil / Il y a du soleil', english: 'It\'s sunny' },
  { condition: 'hot',          label: 'Il fait très chaud',         english: 'It\'s very hot' },
  { condition: 'cold',         label: 'Il fait froid',              english: 'It\'s cold' },
  { condition: 'cloudy',       label: 'Il fait nuageux / couvert',  english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: 'Partiellement nuageux',      english: 'Partly cloudy' },
  { condition: 'rainy',        label: 'Il pleut',                   english: 'It\'s raining' },
  { condition: 'stormy',       label: 'Il y a de l\'orage',         english: 'There\'s a storm' },
  { condition: 'snowy',        label: 'Il neige',                   english: 'It\'s snowing' },
  { condition: 'windy',        label: 'Il y a du vent / Il vente',  english: 'It\'s windy' },
  { condition: 'foggy',        label: 'Il y a du brouillard',       english: 'It\'s foggy' },
];

const WEATHER_EXPRESSIONS: Record<LangCode, [string, string][]> = {
  spanish: [
    ['¿Qué tiempo hace?', 'What\'s the weather like?'],
    ['Hace buen tiempo.', 'The weather is nice.'],
    ['Hace mal tiempo.', 'The weather is bad.'],
    ['¿Cuál es la temperatura?', 'What is the temperature?'],
    ['Hay sol / nubes / viento.', 'It\'s sunny / cloudy / windy.'],
    ['El pronóstico dice…', 'The forecast says…'],
  ],
  french: [
    ['Quel temps fait-il?', 'What\'s the weather like?'],
    ['Il fait beau.', 'The weather is nice.'],
    ['Il fait mauvais.', 'The weather is bad.'],
    ['Quelle est la température?', 'What is the temperature?'],
    ['Il y a du soleil / des nuages / du vent.', 'It\'s sunny / cloudy / windy.'],
    ['La météo annonce…', 'The forecast says…'],
  ],
};

export function WeatherVocabCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? WEATHER_VOCAB_FR : WEATHER_VOCAB_ES;
  const exprs = WEATHER_EXPRESSIONS[language] ?? WEATHER_EXPRESSIONS.spanish;
  const sectionTitle = language === 'french' ? 'La Météo — Weather Conditions' : 'El Tiempo — Weather Conditions';
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>{sectionTitle}</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-2">
          {vocab.map(({ condition, label, english }) => (
            <div
              key={condition}
              className="flex flex-col items-center gap-1.5 p-3 rounded-md bg-muted/50 border border-border/50"
            >
              <WeatherIcon condition={condition} size={52} />
              <span className="text-sm font-semibold text-center leading-tight">{label}</span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">{english}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Key Expressions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {exprs.map(([phrase, en]) => (
              <div key={phrase} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{phrase}</span>
                <span className="text-muted-foreground">— {en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 2. Emotions Vocabulary Card ──────────────────────────────────────────────

interface EmotionEntry { emotion: string; label: string; english: string }

const EMOTIONS_VOCAB_ES: EmotionEntry[] = [
  { emotion: 'happy',     label: 'feliz / contento/a', english: 'happy' },
  { emotion: 'excited',   label: 'emocionado/a',       english: 'excited' },
  { emotion: 'sad',       label: 'triste',             english: 'sad' },
  { emotion: 'angry',     label: 'enojado/a',          english: 'angry' },
  { emotion: 'surprised', label: 'sorprendido/a',      english: 'surprised' },
  { emotion: 'afraid',    label: 'asustado/a',         english: 'afraid' },
  { emotion: 'confused',  label: 'confundido/a',       english: 'confused' },
  { emotion: 'tired',     label: 'cansado/a',          english: 'tired' },
  { emotion: 'nervous',   label: 'nervioso/a',         english: 'nervous' },
  { emotion: 'disgusted', label: 'disgustado/a',       english: 'disgusted' },
  { emotion: 'bored',     label: 'aburrido/a',         english: 'bored' },
];

const EMOTIONS_VOCAB_FR: EmotionEntry[] = [
  { emotion: 'happy',     label: 'heureux/heureuse',   english: 'happy' },
  { emotion: 'excited',   label: 'enthousiaste',       english: 'excited' },
  { emotion: 'sad',       label: 'triste',             english: 'sad' },
  { emotion: 'angry',     label: 'en colère / fâché/e',english: 'angry' },
  { emotion: 'surprised', label: 'surpris/e',          english: 'surprised' },
  { emotion: 'afraid',    label: 'effrayé/e / avoir peur', english: 'afraid' },
  { emotion: 'confused',  label: 'confus/e / perdu/e', english: 'confused' },
  { emotion: 'tired',     label: 'fatigué/e',          english: 'tired' },
  { emotion: 'nervous',   label: 'nerveux/nerveuse',   english: 'nervous' },
  { emotion: 'disgusted', label: 'dégoûté/e',          english: 'disgusted' },
  { emotion: 'bored',     label: 'ennuyé/e',           english: 'bored' },
];

const EMOTION_EXPRESSIONS: Record<LangCode, [string, string][]> = {
  spanish: [
    ['¿Cómo te sientes?', 'How do you feel?'],
    ['Me siento feliz / triste.', 'I feel happy / sad.'],
    ['Estoy cansado/a.', 'I am tired.'],
    ['Estoy muy emocionado/a.', 'I\'m very excited.'],
    ['¿Por qué estás enojado/a?', 'Why are you angry?'],
    ['No me siento bien.', 'I don\'t feel well.'],
  ],
  french: [
    ['Comment tu te sens? / Comment vous sentez-vous?', 'How do you feel?'],
    ['Je me sens heureux/heureuse / triste.', 'I feel happy / sad.'],
    ['Je suis fatigué/e.', 'I am tired.'],
    ['Je suis très enthousiaste!', 'I\'m very excited!'],
    ['Pourquoi es-tu en colère?', 'Why are you angry?'],
    ['Je ne me sens pas bien.', 'I don\'t feel well.'],
  ],
};

export function EmotionsVocabCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? EMOTIONS_VOCAB_FR : EMOTIONS_VOCAB_ES;
  const exprs = EMOTION_EXPRESSIONS[language] ?? EMOTION_EXPRESSIONS.spanish;
  const sectionTitle = language === 'french' ? 'Les Émotions — Feelings & Emotions' : 'Las Emociones — Feelings & Emotions';
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>{sectionTitle}</SectionLabel>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-2">
          {vocab.map(({ emotion, label, english }) => (
            <div
              key={emotion}
              className="flex flex-col items-center gap-1.5 p-2 rounded-md bg-muted/50 border border-border/50"
            >
              <MiniEmotionFace emotion={emotion} size={54} />
              <span className="text-xs font-semibold text-center leading-tight">{label}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{english}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Expressing Emotions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {exprs.map(([phrase, en]) => (
              <div key={phrase} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{phrase}</span>
                <span className="text-muted-foreground">— {en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 3. Telling Time Card ─────────────────────────────────────────────────────

interface TimeEntry { time: string; label: string; english: string }

const TIME_VOCAB_ES: TimeEntry[] = [
  { time: '12:00', label: 'Es mediodía',                  english: 'It\'s noon' },
  { time: '1:00',  label: 'Es la una en punto',           english: 'It\'s one o\'clock' },
  { time: '2:30',  label: 'Son las dos y media',          english: 'It\'s two-thirty' },
  { time: '3:15',  label: 'Son las tres y cuarto',        english: 'It\'s quarter past three' },
  { time: '8:45',  label: 'Son las nueve menos cuarto',   english: 'It\'s quarter to nine' },
  { time: '10:10', label: 'Son las diez y diez',          english: 'It\'s ten past ten' },
  { time: '6:00',  label: 'Son las seis de la tarde',     english: 'It\'s six in the evening' },
  { time: '0:00',  label: 'Es medianoche',                english: 'It\'s midnight' },
];

const TIME_VOCAB_FR: TimeEntry[] = [
  { time: '12:00', label: 'Il est midi',                  english: 'It\'s noon' },
  { time: '1:00',  label: 'Il est une heure',             english: 'It\'s one o\'clock' },
  { time: '2:30',  label: 'Il est deux heures et demie',  english: 'It\'s two-thirty' },
  { time: '3:15',  label: 'Il est trois heures et quart', english: 'It\'s quarter past three' },
  { time: '8:45',  label: 'Il est neuf heures moins le quart', english: 'It\'s quarter to nine' },
  { time: '10:10', label: 'Il est dix heures dix',        english: 'It\'s ten past ten' },
  { time: '6:00',  label: 'Il est dix-huit heures',       english: 'It\'s six in the evening (18h00)' },
  { time: '0:00',  label: 'Il est minuit',                english: 'It\'s midnight' },
];

const TIME_KEY_PATTERNS: Record<LangCode, [string, string][]> = {
  spanish: [
    ['¿Qué hora es?', 'What time is it?'],
    ['Es la una.', 'It\'s one o\'clock. (singular)'],
    ['Son las [#].', 'It\'s [#] o\'clock. (plural)'],
    ['y cuarto', '+ 15 min — quarter past'],
    ['y media', '+ 30 min — half past'],
    ['menos cuarto', '- 15 min — quarter to'],
  ],
  french: [
    ['Quelle heure est-il?', 'What time is it?'],
    ['Il est une heure.', 'It\'s one o\'clock. (singular)'],
    ['Il est [#] heures.', 'It\'s [#] o\'clock. (plural)'],
    ['et quart', '+ 15 min — quarter past'],
    ['et demie', '+ 30 min — half past'],
    ['moins le quart', '- 15 min — quarter to'],
  ],
};

const TIME_DAY_PARTS: Record<LangCode, [string, string][]> = {
  spanish: [
    ['de la mañana', 'in the morning (AM)'],
    ['del mediodía', 'at noon'],
    ['de la tarde', 'in the afternoon/evening'],
    ['de la noche', 'at night'],
    ['¿A qué hora…?', 'At what time…?'],
    ['a las [#]', 'at [#] o\'clock'],
  ],
  french: [
    ['du matin', 'in the morning (AM)'],
    ['de midi', 'at noon'],
    ['de l\'après-midi', 'in the afternoon'],
    ['du soir', 'in the evening/night'],
    ['À quelle heure…?', 'At what time…?'],
    ['à [#] heures', 'at [#] o\'clock'],
  ],
};

export function TimeVocabCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? TIME_VOCAB_FR : TIME_VOCAB_ES;
  const patterns = TIME_KEY_PATTERNS[language] ?? TIME_KEY_PATTERNS.spanish;
  const dayParts = TIME_DAY_PARTS[language] ?? TIME_DAY_PARTS.spanish;
  const sectionTitle = language === 'french' ? "L'Heure — Telling Time" : 'La Hora — Telling Time';
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>{sectionTitle}</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
          {vocab.map(({ time, label, english }) => (
            <div
              key={time}
              className="flex flex-col items-center gap-2 p-3 rounded-md bg-muted/50 border border-border/50"
            >
              <div className="w-14 h-14">
                <AnalogClock time={time} />
              </div>
              <span className="text-xs font-semibold text-center leading-tight">{label}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{english}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Key Patterns</SectionLabel>
            <div className="space-y-1 mt-1">
              {patterns.map(([phrase, en]) => (
                <div key={phrase} className="flex gap-2 text-sm">
                  <span className="font-mono font-medium shrink-0 min-w-32">{phrase}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Parts of the Day</SectionLabel>
            <div className="space-y-1 mt-1">
              {dayParts.map(([phrase, en]) => (
                <div key={phrase} className="flex gap-2 text-sm">
                  <span className="font-mono font-medium shrink-0 min-w-32">{phrase}</span>
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

// ─── 4. Days of the Week / Calendar Card ──────────────────────────────────────

interface CalDay { abbr: string; full: string; en: string }
interface CalMonth { label: string; en: string }

const MONTHS_ES: CalMonth[] = [
  { label: 'enero', en: 'January' }, { label: 'febrero', en: 'February' },
  { label: 'marzo', en: 'March' }, { label: 'abril', en: 'April' },
  { label: 'mayo', en: 'May' }, { label: 'junio', en: 'June' },
  { label: 'julio', en: 'July' }, { label: 'agosto', en: 'August' },
  { label: 'septiembre', en: 'September' }, { label: 'octubre', en: 'October' },
  { label: 'noviembre', en: 'November' }, { label: 'diciembre', en: 'December' },
];

const MONTHS_FR: CalMonth[] = [
  { label: 'janvier', en: 'January' }, { label: 'février', en: 'February' },
  { label: 'mars', en: 'March' }, { label: 'avril', en: 'April' },
  { label: 'mai', en: 'May' }, { label: 'juin', en: 'June' },
  { label: 'juillet', en: 'July' }, { label: 'août', en: 'August' },
  { label: 'septembre', en: 'September' }, { label: 'octobre', en: 'October' },
  { label: 'novembre', en: 'November' }, { label: 'décembre', en: 'December' },
];

const DAYS_ES: CalDay[] = [
  { abbr: 'Lu', full: 'lunes', en: 'Monday' },
  { abbr: 'Ma', full: 'martes', en: 'Tuesday' },
  { abbr: 'Mi', full: 'miércoles', en: 'Wednesday' },
  { abbr: 'Ju', full: 'jueves', en: 'Thursday' },
  { abbr: 'Vi', full: 'viernes', en: 'Friday' },
  { abbr: 'Sa', full: 'sábado', en: 'Saturday' },
  { abbr: 'Do', full: 'domingo', en: 'Sunday' },
];

const DAYS_FR: CalDay[] = [
  { abbr: 'Lu', full: 'lundi', en: 'Monday' },
  { abbr: 'Ma', full: 'mardi', en: 'Tuesday' },
  { abbr: 'Me', full: 'mercredi', en: 'Wednesday' },
  { abbr: 'Je', full: 'jeudi', en: 'Thursday' },
  { abbr: 'Ve', full: 'vendredi', en: 'Friday' },
  { abbr: 'Sa', full: 'samedi', en: 'Saturday' },
  { abbr: 'Di', full: 'dimanche', en: 'Sunday' },
];

const DATE_EXPRESSIONS: Record<LangCode, [string, string][]> = {
  spanish: [
    ['¿Qué día es hoy?', 'What day is today?'],
    ['Hoy es lunes.', 'Today is Monday.'],
    ['¿Cuál es la fecha?', 'What is the date?'],
    ['Hoy es el 15 de marzo.', 'Today is March 15th.'],
    ['el fin de semana', 'the weekend'],
    ['entre semana', 'on weekdays'],
  ],
  french: [
    ['Quel jour sommes-nous?', 'What day is today?'],
    ["Aujourd'hui, c'est lundi.", 'Today is Monday.'],
    ['Quelle est la date?', 'What is the date?'],
    ["C'est le 15 mars.", 'It\'s March 15th.'],
    ['le week-end / la fin de semaine (Qc)', 'the weekend'],
    ['en semaine', 'on weekdays'],
  ],
};

export function DaysOfWeekCard({ language = 'spanish' }: { language?: LangCode }) {
  const days = language === 'french' ? DAYS_FR : DAYS_ES;
  const months = language === 'french' ? MONTHS_FR : MONTHS_ES;
  const exprs = DATE_EXPRESSIONS[language] ?? DATE_EXPRESSIONS.spanish;
  const calMonthLabel = language === 'french' ? 'mars' : 'marzo';
  const calNote = language === 'french'
    ? 'Note: Weeks start on Monday (lundi) in France and most Francophone countries.'
    : 'Note: Weeks start on Monday (lunes) in most Spanish-speaking countries.';
  const daysHeading = language === 'french' ? 'Les Jours de la Semaine — Days of the Week' : 'Los Días de la Semana — Days of the Week';
  const monthsHeading = language === 'french' ? 'Les Mois de l\'Année — Months of the Year' : 'Los Meses del Año — Months of the Year';
  const calLabel = language === 'french' ? 'Calendrier — Calendar' : 'Calendario — Calendar';

  const calData = {
    month: calMonthLabel,
    monthNumber: 3,
    year: 2026,
    dayNames: days.map(d => d.abbr),
    startDow: 1,
  };

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionLabel>{calLabel}</SectionLabel>
            <div className="mt-2">
              <CalendarCanvas cal={calData} />
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-1">{calNote}</p>
          </div>

          <div className="space-y-4">
            <div>
              <SectionLabel>{daysHeading}</SectionLabel>
              <div className="mt-1 rounded-md border border-border overflow-hidden">
                {days.map((d, i) => (
                  <div key={d.full} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                    <span className="w-6 text-center font-mono text-xs text-muted-foreground">{d.abbr}</span>
                    <span className="font-semibold flex-1">{d.full}</span>
                    <span className="text-muted-foreground">{d.en}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{monthsHeading}</SectionLabel>
              <div className="mt-1 grid grid-cols-2 gap-x-4">
                {months.map((m, i) => (
                  <div key={m.label} className={`flex justify-between text-sm py-0.5 ${i < 10 ? 'border-b border-border/40' : ''}`}>
                    <span className="font-semibold">{m.label}</span>
                    <span className="text-muted-foreground">{m.en}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Useful Date Expressions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {exprs.map(([phrase, en]) => (
              <div key={phrase} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{phrase}</span>
                <span className="text-muted-foreground">— {en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 5. Body Parts Card ───────────────────────────────────────────────────────

interface BodyEntry { key: string; label: string; english: string }

const BODY_VOCAB_ES: BodyEntry[] = [
  { key: 'head',      label: 'la cabeza',      english: 'head' },
  { key: 'hair',      label: 'el pelo / cabello', english: 'hair' },
  { key: 'face',      label: 'la cara',        english: 'face' },
  { key: 'eyes',      label: 'los ojos',       english: 'eyes' },
  { key: 'nose',      label: 'la nariz',       english: 'nose' },
  { key: 'mouth',     label: 'la boca',        english: 'mouth' },
  { key: 'ear',       label: 'la oreja',       english: 'ear' },
  { key: 'neck',      label: 'el cuello',      english: 'neck' },
  { key: 'shoulders', label: 'los hombros',    english: 'shoulders' },
  { key: 'chest',     label: 'el pecho',       english: 'chest' },
  { key: 'back',      label: 'la espalda',     english: 'back' },
  { key: 'arms',      label: 'los brazos',     english: 'arms' },
  { key: 'elbow',     label: 'el codo',        english: 'elbow' },
  { key: 'hands',     label: 'las manos',      english: 'hands' },
  { key: 'abdomen',   label: 'el abdomen / estómago', english: 'stomach / abdomen' },
  { key: 'hips',      label: 'la cadera',      english: 'hips' },
  { key: 'legs',      label: 'las piernas',    english: 'legs' },
  { key: 'knee',      label: 'la rodilla',     english: 'knee' },
  { key: 'feet',      label: 'los pies',       english: 'feet' },
];

const BODY_VOCAB_FR: BodyEntry[] = [
  { key: 'head',      label: 'la tête',        english: 'head' },
  { key: 'hair',      label: 'les cheveux',    english: 'hair' },
  { key: 'face',      label: 'le visage / la figure', english: 'face' },
  { key: 'eyes',      label: 'les yeux',       english: 'eyes' },
  { key: 'nose',      label: 'le nez',         english: 'nose' },
  { key: 'mouth',     label: 'la bouche',      english: 'mouth' },
  { key: 'ear',       label: "l'oreille",      english: 'ear' },
  { key: 'neck',      label: 'le cou',         english: 'neck' },
  { key: 'shoulders', label: 'les épaules',    english: 'shoulders' },
  { key: 'chest',     label: 'la poitrine',    english: 'chest' },
  { key: 'back',      label: 'le dos',         english: 'back' },
  { key: 'arms',      label: 'les bras',       english: 'arms' },
  { key: 'elbow',     label: 'le coude',       english: 'elbow' },
  { key: 'hands',     label: 'les mains',      english: 'hands' },
  { key: 'abdomen',   label: "l'abdomen / le ventre", english: 'stomach / abdomen' },
  { key: 'hips',      label: 'les hanches',    english: 'hips' },
  { key: 'legs',      label: 'les jambes',     english: 'legs' },
  { key: 'knee',      label: 'le genou',       english: 'knee' },
  { key: 'feet',      label: 'les pieds',      english: 'feet' },
];

const BODY_PHRASES: Record<LangCode, [string, string][]> = {
  spanish: [
    ['Me duele la cabeza.', 'My head hurts.'],
    ['Me duelen los pies.', 'My feet hurt.'],
    ['Señala tu nariz.', 'Point to your nose.'],
    ['¿Qué parte del cuerpo es?', 'What body part is it?'],
    ['Tengo dolor de espalda.', 'I have back pain.'],
    ['Levanta el brazo derecho.', 'Raise your right arm.'],
  ],
  french: [
    ["J'ai mal à la tête.", 'My head hurts.'],
    ["J'ai mal aux pieds.", 'My feet hurt.'],
    ['Montre ton nez.', 'Point to your nose.'],
    ['Quelle partie du corps est-ce?', 'What body part is it?'],
    ["J'ai mal au dos.", 'I have back pain.'],
    ['Lève le bras droit.', 'Raise your right arm.'],
  ],
};

export function BodyPartsCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? BODY_VOCAB_FR : BODY_VOCAB_ES;
  const phrases = BODY_PHRASES[language] ?? BODY_PHRASES.spanish;
  const diagLabels = language === 'french'
    ? { head: 'la tête', shoulders: 'les épaules', chest: 'la poitrine', arms: 'les bras', abdomen: 'le ventre', legs: 'les jambes' }
    : { head: 'la cabeza', shoulders: 'los hombros', chest: 'el pecho', arms: 'los brazos', abdomen: 'el abdomen', legs: 'las piernas' };
  const sectionTitle = language === 'french' ? 'Le Corps Humain' : 'El Cuerpo Humano';
  const diagHighlights = ['head', 'shoulders', 'chest', 'arms', 'abdomen', 'legs'];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <SectionLabel>{sectionTitle}</SectionLabel>
            <BodyDiagramCanvas data={{ highlightParts: diagHighlights, labels: diagLabels }} />
          </div>

          <div>
            <SectionLabel>Vocabulary Reference</SectionLabel>
            <div className="mt-1 rounded-md border border-border overflow-hidden">
              {vocab.map((v, i) => (
                <div key={v.key} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{v.label}</span>
                  <span className="text-muted-foreground">{v.english}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Useful Phrases</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {phrases.map(([phrase, en]) => (
              <div key={phrase} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{phrase}</span>
                <span className="text-muted-foreground">— {en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 6. Face Parts Card ───────────────────────────────────────────────────────

const FACE_VOCAB_ES: BodyEntry[] = [
  { key: 'hair',      label: 'el pelo',               english: 'hair' },
  { key: 'forehead',  label: 'la frente',              english: 'forehead' },
  { key: 'eyebrows',  label: 'las cejas',              english: 'eyebrows' },
  { key: 'eyes',      label: 'los ojos',               english: 'eyes' },
  { key: 'eyelashes', label: 'las pestañas',           english: 'eyelashes' },
  { key: 'nose',      label: 'la nariz',               english: 'nose' },
  { key: 'cheeks',    label: 'las mejillas',           english: 'cheeks' },
  { key: 'ears',      label: 'las orejas',             english: 'ears' },
  { key: 'lips',      label: 'los labios',             english: 'lips' },
  { key: 'teeth',     label: 'los dientes',            english: 'teeth' },
  { key: 'tongue',    label: 'la lengua',              english: 'tongue' },
  { key: 'chin',      label: 'el mentón / la barbilla',english: 'chin' },
  { key: 'jaw',       label: 'la mandíbula',           english: 'jaw' },
  { key: 'face',      label: 'la cara / el rostro',    english: 'face' },
];

const FACE_VOCAB_FR: BodyEntry[] = [
  { key: 'hair',      label: 'les cheveux',            english: 'hair' },
  { key: 'forehead',  label: 'le front',               english: 'forehead' },
  { key: 'eyebrows',  label: 'les sourcils',           english: 'eyebrows' },
  { key: 'eyes',      label: 'les yeux',               english: 'eyes' },
  { key: 'eyelashes', label: 'les cils',               english: 'eyelashes' },
  { key: 'nose',      label: 'le nez',                 english: 'nose' },
  { key: 'cheeks',    label: 'les joues',              english: 'cheeks' },
  { key: 'ears',      label: 'les oreilles',           english: 'ears' },
  { key: 'lips',      label: 'les lèvres',             english: 'lips' },
  { key: 'teeth',     label: 'les dents',              english: 'teeth' },
  { key: 'tongue',    label: 'la langue',              english: 'tongue' },
  { key: 'chin',      label: 'le menton',              english: 'chin' },
  { key: 'jaw',       label: 'la mâchoire',            english: 'jaw' },
  { key: 'face',      label: 'le visage / la figure',  english: 'face' },
];

const FACE_DESCRIPTIONS: Record<LangCode, [string, string][]> = {
  spanish: [
    ['Tiene los ojos azules.', 'She/He has blue eyes.'],
    ['Tiene el pelo rizado.', 'She/He has curly hair.'],
    ['Tiene la nariz pequeña.', 'She/He has a small nose.'],
    ['Tiene la cara redonda.', 'She/He has a round face.'],
    ['¿De qué color son sus ojos?', 'What color are her/his eyes?'],
    ['Tiene las cejas oscuras.', 'She/He has dark eyebrows.'],
  ],
  french: [
    ['Il/Elle a les yeux bleus.', 'She/He has blue eyes.'],
    ['Il/Elle a les cheveux bouclés.', 'She/He has curly hair.'],
    ['Il/Elle a un petit nez.', 'She/He has a small nose.'],
    ['Il/Elle a le visage rond.', 'She/He has a round face.'],
    ['De quelle couleur sont ses yeux?', 'What color are her/his eyes?'],
    ['Il/Elle a les sourcils sombres.', 'She/He has dark eyebrows.'],
  ],
};

export function FacePartsCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? FACE_VOCAB_FR : FACE_VOCAB_ES;
  const descriptions = FACE_DESCRIPTIONS[language] ?? FACE_DESCRIPTIONS.spanish;
  const diagLabels = language === 'french'
    ? { eyes: 'les yeux', nose: 'le nez', mouth: 'la bouche', ears: 'les oreilles', eyebrows: 'les sourcils', cheeks: 'les joues' }
    : { eyes: 'los ojos', nose: 'la nariz', mouth: 'la boca', ears: 'las orejas', eyebrows: 'las cejas', cheeks: 'las mejillas' };
  const sectionTitle = language === 'french' ? 'Le Visage — The Face' : 'La Cara — The Face';
  const diagHighlights = ['eyes', 'nose', 'mouth', 'ears', 'eyebrows', 'cheeks'];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <SectionLabel>{sectionTitle}</SectionLabel>
            <FaceDiagramCanvas data={{ highlightParts: diagHighlights, labels: diagLabels }} />
          </div>

          <div>
            <SectionLabel>Vocabulary Reference</SectionLabel>
            <div className="mt-1 rounded-md border border-border overflow-hidden">
              {vocab.map((v, i) => (
                <div key={v.key} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{v.label}</span>
                  <span className="text-muted-foreground">{v.english}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Descriptions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {descriptions.map(([phrase, en]) => (
              <div key={phrase} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{phrase}</span>
                <span className="text-muted-foreground">— {en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 7. Hand Parts Card ───────────────────────────────────────────────────────

const HAND_VOCAB_ES: BodyEntry[] = [
  { key: 'thumb',         label: 'el pulgar',                    english: 'thumb' },
  { key: 'index_finger',  label: 'el dedo índice',               english: 'index finger' },
  { key: 'middle_finger', label: 'el dedo medio / corazón',      english: 'middle finger' },
  { key: 'ring_finger',   label: 'el dedo anular',               english: 'ring finger' },
  { key: 'pinky',         label: 'el meñique',                   english: 'pinky / little finger' },
  { key: 'fingers',       label: 'los dedos',                    english: 'fingers' },
  { key: 'knuckles',      label: 'los nudillos',                 english: 'knuckles' },
  { key: 'palm',          label: 'la palma',                     english: 'palm' },
  { key: 'wrist',         label: 'la muñeca',                    english: 'wrist' },
  { key: 'fingernails',   label: 'las uñas',                     english: 'fingernails' },
];

const HAND_VOCAB_FR: BodyEntry[] = [
  { key: 'thumb',         label: 'le pouce',                     english: 'thumb' },
  { key: 'index_finger',  label: "l'index",                      english: 'index finger' },
  { key: 'middle_finger', label: 'le majeur',                    english: 'middle finger' },
  { key: 'ring_finger',   label: "l'annulaire",                  english: 'ring finger' },
  { key: 'pinky',         label: 'l\'auriculaire / le petit doigt', english: 'pinky / little finger' },
  { key: 'fingers',       label: 'les doigts',                   english: 'fingers' },
  { key: 'knuckles',      label: 'les jointures',                english: 'knuckles' },
  { key: 'palm',          label: 'la paume',                     english: 'palm' },
  { key: 'wrist',         label: 'le poignet',                   english: 'wrist' },
  { key: 'fingernails',   label: 'les ongles',                   english: 'fingernails' },
];

const HAND_COUNTING: Record<LangCode, [string, string][]> = {
  spanish: [
    ['uno', 'thumb — pulgar'],
    ['dos', 'index — índice'],
    ['tres', 'middle — medio'],
    ['cuatro', 'ring — anular'],
    ['cinco', 'pinky — meñique'],
  ],
  french: [
    ['un', 'thumb — le pouce'],
    ['deux', 'index — l\'index'],
    ['trois', 'middle — le majeur'],
    ['quatre', 'ring — l\'annulaire'],
    ['cinq', 'pinky — le petit doigt'],
  ],
};

export function HandPartsCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? HAND_VOCAB_FR : HAND_VOCAB_ES;
  const counting = HAND_COUNTING[language] ?? HAND_COUNTING.spanish;
  const diagLabels = language === 'french'
    ? { thumb: 'pouce', index_finger: 'index', middle_finger: 'majeur', ring_finger: 'annulaire', pinky: 'auriculaire', palm: 'paume' }
    : { thumb: 'pulgar', index_finger: 'índice', middle_finger: 'medio', ring_finger: 'anular', pinky: 'meñique', palm: 'palma' };
  const sectionTitle = language === 'french' ? 'La Main — The Hand' : 'La Mano — The Hand';
  const fingerCountingLabel = language === 'french' ? 'Counting on Fingers (compter sur les doigts)' : 'Counting on Fingers (contar con los dedos)';
  const diagHighlights = ['thumb', 'index_finger', 'middle_finger', 'ring_finger', 'pinky', 'palm'];

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <SectionLabel>{sectionTitle}</SectionLabel>
            <HandDiagramCanvas data={{ highlightParts: diagHighlights, labels: diagLabels }} />
          </div>

          <div>
            <SectionLabel>Vocabulary Reference</SectionLabel>
            <div className="mt-1 rounded-md border border-border overflow-hidden">
              {vocab.map((v, i) => (
                <div key={v.key} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{v.label}</span>
                  <span className="text-muted-foreground">{v.english}</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <SectionLabel>{fingerCountingLabel}</SectionLabel>
              <div className="space-y-1 mt-1">
                {counting.map(([n, d]) => (
                  <div key={n} className="flex gap-3 text-sm">
                    <span className="font-semibold w-12">{n}</span>
                    <span className="text-muted-foreground">{d}</span>
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

// ─── 8. Temperature Vocabulary Card ──────────────────────────────────────────

interface TempEntry { celsius: number; label: string; english: string }

const TEMP_VOCAB_ES: TempEntry[] = [
  { celsius: -10, label: 'Hace mucho frío',   english: 'It\'s very cold' },
  { celsius: 5,   label: 'Hace frío',          english: 'It\'s cold' },
  { celsius: 15,  label: 'Hace fresco',        english: 'It\'s cool' },
  { celsius: 22,  label: 'Hace buen tiempo',   english: 'The weather is nice' },
  { celsius: 32,  label: 'Hace calor',         english: 'It\'s hot' },
  { celsius: 40,  label: 'Hace mucho calor',   english: 'It\'s very hot' },
];

const TEMP_VOCAB_FR: TempEntry[] = [
  { celsius: -10, label: 'Il fait très froid',  english: 'It\'s very cold' },
  { celsius: 5,   label: 'Il fait froid',        english: 'It\'s cold' },
  { celsius: 15,  label: 'Il fait frais',        english: 'It\'s cool' },
  { celsius: 22,  label: 'Il fait beau',         english: 'The weather is nice' },
  { celsius: 32,  label: 'Il fait chaud',        english: 'It\'s hot' },
  { celsius: 40,  label: 'Il fait très chaud',   english: 'It\'s very hot' },
];

const TEMP_KEY_EXPRS: Record<LangCode, [string, string][]> = {
  spanish: [
    ['Hace calor / frío.', 'It\'s hot / cold.'],
    ['Hace mucho frío hoy.', 'It\'s very cold today.'],
    ['¿Cuántos grados hace?', 'How many degrees is it?'],
    ['Hace 25 grados.', 'It\'s 25 degrees.'],
  ],
  french: [
    ['Il fait chaud / froid.', 'It\'s hot / cold.'],
    ["Il fait très froid aujourd'hui.", 'It\'s very cold today.'],
    ['Combien de degrés fait-il?', 'How many degrees is it?'],
    ['Il fait 25 degrés.', 'It\'s 25 degrees.'],
  ],
};

const TEMP_CONVERSIONS: Record<LangCode, [string, string][]> = {
  spanish: [
    ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
    ['100°C = 212°F', 'boiling point — punto de ebullición'],
    ['0°C = 32°F', 'freezing — punto de congelación'],
    ['37°C = 98.6°F', 'body temperature — temperatura corporal'],
  ],
  french: [
    ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
    ['100°C = 212°F', "point d'ébullition — boiling point"],
    ['0°C = 32°F', 'point de congélation — freezing'],
    ['37°C = 98,6°F', 'température corporelle — body temperature'],
  ],
};

export function ThermometerVocabCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? TEMP_VOCAB_FR : TEMP_VOCAB_ES;
  const keyExprs = TEMP_KEY_EXPRS[language] ?? TEMP_KEY_EXPRS.spanish;
  const conversions = TEMP_CONVERSIONS[language] ?? TEMP_CONVERSIONS.spanish;
  const sectionTitle = language === 'french' ? 'La Température — Temperature' : 'La Temperatura — Temperature';
  const exprHeading = language === 'french' ? 'Expressions with IL FAIT' : 'Expressions with HACE';

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>{sectionTitle}</SectionLabel>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
          {vocab.map(({ celsius, label, english }) => (
            <div
              key={celsius}
              className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50 border border-border/50"
            >
              <ThermometerCanvas data={{ celsius, showFahrenheit: false }} />
              <span className="text-xs font-semibold text-center leading-tight mt-1">{label}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{english}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{celsius}°C</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <SectionLabel>{exprHeading}</SectionLabel>
            <div className="space-y-1 mt-1">
              {keyExprs.map(([phrase, en]) => (
                <div key={phrase} className="flex gap-2 text-sm">
                  <span className="font-medium shrink-0">{phrase}</span>
                  <span className="text-muted-foreground">— {en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Conversion Reference</SectionLabel>
            <div className="space-y-1 mt-1">
              {conversions.map(([formula, desc]) => (
                <div key={formula} className="flex gap-2 text-sm">
                  <span className="font-mono font-medium shrink-0 text-xs">{formula}</span>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 9. Country Dot Map Card ──────────────────────────────────────────────────

const ALL_SPANISH_COUNTRIES = [
  'spain', 'mexico', 'guatemala', 'honduras', 'el_salvador', 'nicaragua',
  'costa_rica', 'panama', 'cuba', 'dominican_republic', 'puerto_rico',
  'colombia', 'venezuela', 'ecuador', 'peru', 'bolivia', 'chile',
  'argentina', 'uruguay', 'paraguay', 'equatorial_guinea',
];

const COUNTRY_NAMES: Record<string, { es: string; en: string }> = {
  spain:               { es: 'España',             en: 'Spain' },
  mexico:              { es: 'México',              en: 'Mexico' },
  guatemala:           { es: 'Guatemala',           en: 'Guatemala' },
  honduras:            { es: 'Honduras',            en: 'Honduras' },
  el_salvador:         { es: 'El Salvador',         en: 'El Salvador' },
  nicaragua:           { es: 'Nicaragua',           en: 'Nicaragua' },
  costa_rica:          { es: 'Costa Rica',          en: 'Costa Rica' },
  panama:              { es: 'Panamá',              en: 'Panama' },
  cuba:                { es: 'Cuba',                en: 'Cuba' },
  dominican_republic:  { es: 'Rep. Dominicana',     en: 'Dominican Republic' },
  puerto_rico:         { es: 'Puerto Rico',         en: 'Puerto Rico' },
  colombia:            { es: 'Colombia',            en: 'Colombia' },
  venezuela:           { es: 'Venezuela',           en: 'Venezuela' },
  ecuador:             { es: 'Ecuador',             en: 'Ecuador' },
  peru:                { es: 'Perú',                en: 'Peru' },
  bolivia:             { es: 'Bolivia',             en: 'Bolivia' },
  chile:               { es: 'Chile',               en: 'Chile' },
  argentina:           { es: 'Argentina',           en: 'Argentina' },
  uruguay:             { es: 'Uruguay',             en: 'Uruguay' },
  paraguay:            { es: 'Paraguay',            en: 'Paraguay' },
  equatorial_guinea:   { es: 'Guinea Ecuatorial',   en: 'Equatorial Guinea' },
};

export function CountryDotMapCard() {
  const highlightFive = ['spain', 'mexico', 'argentina', 'colombia', 'peru'];
  const labels = Object.fromEntries(
    highlightFive.map(slug => [slug, COUNTRY_NAMES[slug]?.es ?? slug])
  );

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>El Mundo Hispanohablante — Spanish-Speaking World</SectionLabel>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {/* Left: dot map (5 highlighted for clarity) */}
          <div>
            <WorldMapCanvas data={{ highlightCountries: highlightFive, labels }} />
            <p className="text-[11px] text-muted-foreground text-center mt-1">
              5 major countries highlighted — all 21 listed below.
            </p>
          </div>

          {/* Right: complete country list */}
          <div>
            <SectionLabel>All 21 Spanish-Speaking Countries</SectionLabel>
            <div className="mt-1 grid grid-cols-1 gap-0.5">
              {ALL_SPANISH_COUNTRIES.map((slug, i) => {
                const names = COUNTRY_NAMES[slug];
                return (
                  <div key={slug} className={`flex justify-between text-sm py-1 px-2 rounded-sm ${i % 2 === 0 ? 'bg-muted/30' : ''}`}>
                    <span className="font-semibold">{names?.es}</span>
                    <span className="text-muted-foreground">{names?.en}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Quick Facts</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {[
              { num: '~500M', label: 'native speakers worldwide', es: 'hablantes nativos en el mundo' },
              { num: '21', label: 'countries with Spanish as official language', es: 'países con español como idioma oficial' },
              { num: '2nd', label: 'most spoken language by native speakers', es: 'segundo idioma más hablado por hablantes nativos' },
            ].map(({ num, label, es }) => (
              <div key={num} className="rounded-md bg-muted/50 border border-border/50 p-3 text-center">
                <div className="text-2xl font-bold text-primary">{num}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
                <div className="text-[10px] text-muted-foreground/70 italic mt-0.5">{es}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
