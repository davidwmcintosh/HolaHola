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

// ─── 1. Weather Vocabulary Card ───────────────────────────────────────────────

const WEATHER_VOCAB: { condition: string; spanish: string; english: string }[] = [
  { condition: 'sunny',        spanish: 'Hace sol',             english: 'It\'s sunny' },
  { condition: 'hot',          spanish: 'Hace mucho calor',     english: 'It\'s very hot' },
  { condition: 'cold',         spanish: 'Hace frío',            english: 'It\'s cold' },
  { condition: 'cloudy',       spanish: 'Está nublado',         english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',spanish: 'Parcialmente nublado', english: 'Partly cloudy' },
  { condition: 'rainy',        spanish: 'Llueve / Está lloviendo', english: 'It\'s raining' },
  { condition: 'stormy',       spanish: 'Hay tormenta',         english: 'There\'s a storm' },
  { condition: 'snowy',        spanish: 'Nieva / Está nevando', english: 'It\'s snowing' },
  { condition: 'windy',        spanish: 'Hace viento',          english: 'It\'s windy' },
  { condition: 'foggy',        spanish: 'Hay niebla',           english: 'It\'s foggy' },
];

export function WeatherVocabCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>El Tiempo — Weather Conditions</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-2">
          {WEATHER_VOCAB.map(({ condition, spanish, english }) => (
            <div
              key={condition}
              className="flex flex-col items-center gap-1.5 p-3 rounded-md bg-muted/50 border border-border/50"
            >
              <WeatherIcon condition={condition} size={52} />
              <span className="text-sm font-semibold text-center leading-tight">{spanish}</span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">{english}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Key Expressions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {[
              ['¿Qué tiempo hace?', 'What\'s the weather like?'],
              ['Hace buen tiempo.', 'The weather is nice.'],
              ['Hace mal tiempo.', 'The weather is bad.'],
              ['¿Cuál es la temperatura?', 'What is the temperature?'],
              ['Hay sol / nubes / viento.', 'It\'s sunny / cloudy / windy.'],
              ['El pronóstico dice…', 'The forecast says…'],
            ].map(([es, en]) => (
              <div key={es} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{es}</span>
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

const EMOTIONS_VOCAB: { emotion: string; spanish: string; english: string }[] = [
  { emotion: 'happy',     spanish: 'feliz / contento/a', english: 'happy' },
  { emotion: 'excited',   spanish: 'emocionado/a',       english: 'excited' },
  { emotion: 'sad',       spanish: 'triste',             english: 'sad' },
  { emotion: 'angry',     spanish: 'enojado/a',          english: 'angry' },
  { emotion: 'surprised', spanish: 'sorprendido/a',      english: 'surprised' },
  { emotion: 'afraid',    spanish: 'asustado/a',         english: 'afraid' },
  { emotion: 'confused',  spanish: 'confundido/a',       english: 'confused' },
  { emotion: 'tired',     spanish: 'cansado/a',          english: 'tired' },
  { emotion: 'nervous',   spanish: 'nervioso/a',         english: 'nervous' },
  { emotion: 'disgusted', spanish: 'disgustado/a',       english: 'disgusted' },
  { emotion: 'bored',     spanish: 'aburrido/a',         english: 'bored' },
];

export function EmotionsVocabCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>Las Emociones — Feelings & Emotions</SectionLabel>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-2">
          {EMOTIONS_VOCAB.map(({ emotion, spanish, english }) => (
            <div
              key={emotion}
              className="flex flex-col items-center gap-1.5 p-2 rounded-md bg-muted/50 border border-border/50"
            >
              <MiniEmotionFace emotion={emotion} size={54} />
              <span className="text-xs font-semibold text-center leading-tight">{spanish}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{english}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Expressing Emotions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {[
              ['¿Cómo te sientes?', 'How do you feel?'],
              ['Me siento feliz / triste.', 'I feel happy / sad.'],
              ['Estoy cansado/a.', 'I am tired.'],
              ['Estoy muy emocionado/a.', 'I\'m very excited.'],
              ['¿Por qué estás enojado/a?', 'Why are you angry?'],
              ['No me siento bien.', 'I don\'t feel well.'],
            ].map(([es, en]) => (
              <div key={es} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{es}</span>
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

const TIME_VOCAB: { time: string; spanish: string; english: string }[] = [
  { time: '12:00', spanish: 'Es mediodía',                  english: 'It\'s noon' },
  { time: '1:00',  spanish: 'Es la una en punto',           english: 'It\'s one o\'clock' },
  { time: '2:30',  spanish: 'Son las dos y media',          english: 'It\'s two-thirty' },
  { time: '3:15',  spanish: 'Son las tres y cuarto',        english: 'It\'s quarter past three' },
  { time: '8:45',  spanish: 'Son las nueve menos cuarto',   english: 'It\'s quarter to nine' },
  { time: '10:10', spanish: 'Son las diez y diez',          english: 'It\'s ten past ten' },
  { time: '6:00',  spanish: 'Son las seis de la tarde',     english: 'It\'s six in the evening' },
  { time: '0:00',  spanish: 'Es medianoche',                english: 'It\'s midnight' },
];

export function TimeVocabCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>La Hora — Telling Time</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
          {TIME_VOCAB.map(({ time, spanish, english }) => (
            <div
              key={time}
              className="flex flex-col items-center gap-2 p-3 rounded-md bg-muted/50 border border-border/50"
            >
              <div className="w-14 h-14">
                <AnalogClock time={time} />
              </div>
              <span className="text-xs font-semibold text-center leading-tight">{spanish}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">{english}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <SectionLabel>Key Patterns</SectionLabel>
            <div className="space-y-1 mt-1">
              {[
                ['¿Qué hora es?', 'What time is it?'],
                ['Es la una.', 'It\'s one o\'clock. (singular)'],
                ['Son las [#].', 'It\'s [#] o\'clock. (plural)'],
                ['y cuarto', '+ 15 min — quarter past'],
                ['y media', '+ 30 min — half past'],
                ['menos cuarto', '- 15 min — quarter to'],
              ].map(([es, en]) => (
                <div key={es} className="flex gap-2 text-sm">
                  <span className="font-mono font-medium shrink-0 min-w-32">{es}</span>
                  <span className="text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Parts of the Day</SectionLabel>
            <div className="space-y-1 mt-1">
              {[
                ['de la mañana', 'in the morning (AM)'],
                ['del mediodía', 'at noon'],
                ['de la tarde', 'in the afternoon/evening'],
                ['de la noche', 'at night'],
                ['¿A qué hora…?', 'At what time…?'],
                ['a las [#]', 'at [#] o\'clock'],
              ].map(([es, en]) => (
                <div key={es} className="flex gap-2 text-sm">
                  <span className="font-mono font-medium shrink-0 min-w-32">{es}</span>
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

const MONTHS_ES: { es: string; en: string }[] = [
  { es: 'enero',      en: 'January' },
  { es: 'febrero',    en: 'February' },
  { es: 'marzo',      en: 'March' },
  { es: 'abril',      en: 'April' },
  { es: 'mayo',       en: 'May' },
  { es: 'junio',      en: 'June' },
  { es: 'julio',      en: 'July' },
  { es: 'agosto',     en: 'August' },
  { es: 'septiembre', en: 'September' },
  { es: 'octubre',    en: 'October' },
  { es: 'noviembre',  en: 'November' },
  { es: 'diciembre',  en: 'December' },
];

const DAYS_ES: { es: string; en: string; full: string }[] = [
  { es: 'Lu', full: 'lunes',      en: 'Monday' },
  { es: 'Ma', full: 'martes',     en: 'Tuesday' },
  { es: 'Mi', full: 'miércoles',  en: 'Wednesday' },
  { es: 'Ju', full: 'jueves',     en: 'Thursday' },
  { es: 'Vi', full: 'viernes',    en: 'Friday' },
  { es: 'Sa', full: 'sábado',     en: 'Saturday' },
  { es: 'Do', full: 'domingo',    en: 'Sunday' },
];

export function DaysOfWeekCard() {
  const calData = {
    month: 'marzo',
    monthNumber: 3,
    year: 2026,
    dayNames: DAYS_ES.map(d => d.es),
    startDow: 1,
  };

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: live calendar rendered in Spanish */}
          <div>
            <SectionLabel>Calendario — Calendar</SectionLabel>
            <div className="mt-2">
              <CalendarCanvas cal={calData} />
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-1">
              Note: Weeks start on Monday (lunes) in most Spanish-speaking countries.
            </p>
          </div>

          {/* Right: days table + months table */}
          <div className="space-y-4">
            <div>
              <SectionLabel>Los Días de la Semana — Days of the Week</SectionLabel>
              <div className="mt-1 rounded-md border border-border overflow-hidden">
                {DAYS_ES.map((d, i) => (
                  <div key={d.full} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                    <span className="w-6 text-center font-mono text-xs text-muted-foreground">{d.es}</span>
                    <span className="font-semibold flex-1">{d.full}</span>
                    <span className="text-muted-foreground">{d.en}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Los Meses del Año — Months of the Year</SectionLabel>
              <div className="mt-1 grid grid-cols-2 gap-x-4">
                {MONTHS_ES.map((m, i) => (
                  <div key={m.es} className={`flex justify-between text-sm py-0.5 ${i < 10 ? 'border-b border-border/40' : ''}`}>
                    <span className="font-semibold">{m.es}</span>
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
            {[
              ['¿Qué día es hoy?', 'What day is today?'],
              ['Hoy es lunes.', 'Today is Monday.'],
              ['¿Cuál es la fecha?', 'What is the date?'],
              ['Hoy es el 15 de marzo.', 'Today is March 15th.'],
              ['el fin de semana', 'the weekend'],
              ['entre semana', 'on weekdays'],
            ].map(([es, en]) => (
              <div key={es} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{es}</span>
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

const BODY_VOCAB: { key: string; spanish: string; english: string }[] = [
  { key: 'head',      spanish: 'la cabeza',      english: 'head' },
  { key: 'hair',      spanish: 'el pelo / cabello', english: 'hair' },
  { key: 'face',      spanish: 'la cara',        english: 'face' },
  { key: 'eyes',      spanish: 'los ojos',       english: 'eyes' },
  { key: 'nose',      spanish: 'la nariz',       english: 'nose' },
  { key: 'mouth',     spanish: 'la boca',        english: 'mouth' },
  { key: 'ear',       spanish: 'la oreja',       english: 'ear' },
  { key: 'neck',      spanish: 'el cuello',      english: 'neck' },
  { key: 'shoulders', spanish: 'los hombros',    english: 'shoulders' },
  { key: 'chest',     spanish: 'el pecho',       english: 'chest' },
  { key: 'back',      spanish: 'la espalda',     english: 'back' },
  { key: 'arms',      spanish: 'los brazos',     english: 'arms' },
  { key: 'elbow',     spanish: 'el codo',        english: 'elbow' },
  { key: 'hands',     spanish: 'las manos',      english: 'hands' },
  { key: 'abdomen',   spanish: 'el abdomen / estómago', english: 'stomach / abdomen' },
  { key: 'hips',      spanish: 'la cadera',      english: 'hips' },
  { key: 'legs',      spanish: 'las piernas',    english: 'legs' },
  { key: 'knee',      spanish: 'la rodilla',     english: 'knee' },
  { key: 'feet',      spanish: 'los pies',       english: 'feet' },
];

export function BodyPartsCard() {
  const diagHighlights = ['head', 'shoulders', 'chest', 'arms', 'abdomen', 'legs'];
  const diagLabels: Record<string, string> = {
    head: 'la cabeza', shoulders: 'los hombros', chest: 'el pecho',
    arms: 'los brazos', abdomen: 'el abdomen', legs: 'las piernas',
  };

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <SectionLabel>El Cuerpo Humano</SectionLabel>
            <BodyDiagramCanvas data={{ highlightParts: diagHighlights, labels: diagLabels }} />
          </div>

          <div>
            <SectionLabel>Vocabulary Reference</SectionLabel>
            <div className="mt-1 rounded-md border border-border overflow-hidden">
              {BODY_VOCAB.map((v, i) => (
                <div key={v.key} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{v.spanish}</span>
                  <span className="text-muted-foreground">{v.english}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Useful Phrases</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {[
              ['Me duele la cabeza.', 'My head hurts.'],
              ['Me duelen los pies.', 'My feet hurt.'],
              ['Señala tu nariz.', 'Point to your nose.'],
              ['¿Qué parte del cuerpo es?', 'What body part is it?'],
              ['Tengo dolor de espalda.', 'I have back pain.'],
              ['Levanta el brazo derecho.', 'Raise your right arm.'],
            ].map(([es, en]) => (
              <div key={es} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{es}</span>
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

const FACE_VOCAB: { key: string; spanish: string; english: string }[] = [
  { key: 'hair',          spanish: 'el pelo',          english: 'hair' },
  { key: 'forehead',      spanish: 'la frente',        english: 'forehead' },
  { key: 'eyebrows',      spanish: 'las cejas',        english: 'eyebrows' },
  { key: 'eyes',          spanish: 'los ojos',         english: 'eyes' },
  { key: 'eyelashes',     spanish: 'las pestañas',     english: 'eyelashes' },
  { key: 'nose',          spanish: 'la nariz',         english: 'nose' },
  { key: 'cheeks',        spanish: 'las mejillas',     english: 'cheeks' },
  { key: 'ears',          spanish: 'las orejas',       english: 'ears' },
  { key: 'lips',          spanish: 'los labios',       english: 'lips' },
  { key: 'teeth',         spanish: 'los dientes',      english: 'teeth' },
  { key: 'tongue',        spanish: 'la lengua',        english: 'tongue' },
  { key: 'chin',          spanish: 'el mentón / la barbilla', english: 'chin' },
  { key: 'jaw',           spanish: 'la mandíbula',    english: 'jaw' },
  { key: 'face',          spanish: 'la cara / el rostro', english: 'face' },
];

export function FacePartsCard() {
  const diagHighlights = ['eyes', 'nose', 'mouth', 'ears', 'eyebrows', 'cheeks'];
  const diagLabels: Record<string, string> = {
    eyes: 'los ojos', nose: 'la nariz', mouth: 'la boca',
    ears: 'las orejas', eyebrows: 'las cejas', cheeks: 'las mejillas',
  };

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <SectionLabel>La Cara — The Face</SectionLabel>
            <FaceDiagramCanvas data={{ highlightParts: diagHighlights, labels: diagLabels }} />
          </div>

          <div>
            <SectionLabel>Vocabulary Reference</SectionLabel>
            <div className="mt-1 rounded-md border border-border overflow-hidden">
              {FACE_VOCAB.map((v, i) => (
                <div key={v.key} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{v.spanish}</span>
                  <span className="text-muted-foreground">{v.english}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <SectionLabel>Descriptions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
            {[
              ['Tiene los ojos azules.', 'She/He has blue eyes.'],
              ['Tiene el pelo rizado.', 'She/He has curly hair.'],
              ['Tiene la nariz pequeña.', 'She/He has a small nose.'],
              ['Tiene la cara redonda.', 'She/He has a round face.'],
              ['¿De qué color son sus ojos?', 'What color are her/his eyes?'],
              ['Tiene las cejas oscuras.', 'She/He has dark eyebrows.'],
            ].map(([es, en]) => (
              <div key={es} className="flex gap-2 text-sm py-0.5">
                <span className="font-medium shrink-0">{es}</span>
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

const HAND_VOCAB: { key: string; spanish: string; english: string }[] = [
  { key: 'thumb',         spanish: 'el pulgar',         english: 'thumb' },
  { key: 'index_finger',  spanish: 'el dedo índice',    english: 'index finger' },
  { key: 'middle_finger', spanish: 'el dedo medio / corazón', english: 'middle finger' },
  { key: 'ring_finger',   spanish: 'el dedo anular',    english: 'ring finger' },
  { key: 'pinky',         spanish: 'el meñique',        english: 'pinky / little finger' },
  { key: 'fingers',       spanish: 'los dedos',         english: 'fingers' },
  { key: 'knuckles',      spanish: 'los nudillos',      english: 'knuckles' },
  { key: 'palm',          spanish: 'la palma',          english: 'palm' },
  { key: 'wrist',         spanish: 'la muñeca',         english: 'wrist' },
  { key: 'fingernails',   spanish: 'las uñas',          english: 'fingernails' },
];

export function HandPartsCard() {
  const diagHighlights = ['thumb', 'index_finger', 'middle_finger', 'ring_finger', 'pinky', 'palm'];
  const diagLabels: Record<string, string> = {
    thumb: 'pulgar', index_finger: 'índice', middle_finger: 'medio',
    ring_finger: 'anular', pinky: 'meñique', palm: 'palma',
  };

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <SectionLabel>La Mano — The Hand</SectionLabel>
            <HandDiagramCanvas data={{ highlightParts: diagHighlights, labels: diagLabels }} />
          </div>

          <div>
            <SectionLabel>Vocabulary Reference</SectionLabel>
            <div className="mt-1 rounded-md border border-border overflow-hidden">
              {HAND_VOCAB.map((v, i) => (
                <div key={v.key} className={`flex items-center gap-3 px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-border/60' : ''}`}>
                  <span className="font-semibold flex-1">{v.spanish}</span>
                  <span className="text-muted-foreground">{v.english}</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <SectionLabel>Counting on Fingers (contar con los dedos)</SectionLabel>
              <div className="space-y-1 mt-1">
                {[
                  ['uno', 'thumb — pulgar'],
                  ['dos', 'index — índice'],
                  ['tres', 'middle — medio'],
                  ['cuatro', 'ring — anular'],
                  ['cinco', 'pinky — meñique'],
                ].map(([n, d]) => (
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

const TEMP_VOCAB: { celsius: number; label: string; english: string }[] = [
  { celsius: -10, label: 'Hace mucho frío',   english: 'It\'s very cold' },
  { celsius: 5,   label: 'Hace frío',          english: 'It\'s cold' },
  { celsius: 15,  label: 'Hace fresco',        english: 'It\'s cool' },
  { celsius: 22,  label: 'Hace buen tiempo',   english: 'The weather is nice' },
  { celsius: 32,  label: 'Hace calor',         english: 'It\'s hot' },
  { celsius: 40,  label: 'Hace mucho calor',   english: 'It\'s very hot' },
];

export function ThermometerVocabCard() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <SectionLabel>La Temperatura — Temperature</SectionLabel>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
          {TEMP_VOCAB.map(({ celsius, label, english }) => (
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
            <SectionLabel>Expressions with HACE</SectionLabel>
            <div className="space-y-1 mt-1">
              {[
                ['Hace calor / frío.', 'It\'s hot / cold.'],
                ['Hace mucho frío hoy.', 'It\'s very cold today.'],
                ['¿Cuántos grados hace?', 'How many degrees is it?'],
                ['Hace 25 grados.', 'It\'s 25 degrees.'],
              ].map(([es, en]) => (
                <div key={es} className="flex gap-2 text-sm">
                  <span className="font-medium shrink-0">{es}</span>
                  <span className="text-muted-foreground">— {en}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Conversion Reference</SectionLabel>
            <div className="space-y-1 mt-1">
              {[
                ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
                ['100°C = 212°F', 'boiling point — punto de ebullición'],
                ['0°C = 32°F', 'freezing — punto de congelación'],
                ['37°C = 98.6°F', 'body temperature — temperatura corporal'],
              ].map(([formula, desc]) => (
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
