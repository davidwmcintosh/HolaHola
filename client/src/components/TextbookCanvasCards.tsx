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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

type LangCode = 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese' | 'korean' | 'mandarin' | 'hebrew';

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

const WEATHER_VOCAB_PT: WeatherEntry[] = [
  { condition: 'sunny',        label: 'Está ensolarado / Faz sol',  english: 'It\'s sunny' },
  { condition: 'hot',          label: 'Está muito quente / Faz calor', english: 'It\'s very hot' },
  { condition: 'cold',         label: 'Está frio / Faz frio',       english: 'It\'s cold' },
  { condition: 'cloudy',       label: 'Está nublado / Há nuvens',   english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: 'Parcialmente nublado',       english: 'Partly cloudy' },
  { condition: 'rainy',        label: 'Está chovendo / Chove',      english: 'It\'s raining' },
  { condition: 'stormy',       label: 'Há uma tempestade',          english: 'There\'s a storm' },
  { condition: 'snowy',        label: 'Está nevando / Neva',        english: 'It\'s snowing' },
  { condition: 'windy',        label: 'Está ventando / Há vento',   english: 'It\'s windy' },
  { condition: 'foggy',        label: 'Está com neblina / Há névoa',english: 'It\'s foggy' },
];

const WEATHER_VOCAB_DE: WeatherEntry[] = [
  { condition: 'sunny',        label: 'Es ist sonnig / Die Sonne scheint', english: 'It\'s sunny' },
  { condition: 'hot',          label: 'Es ist sehr heiß',              english: 'It\'s very hot' },
  { condition: 'cold',         label: 'Es ist kalt',                   english: 'It\'s cold' },
  { condition: 'cloudy',       label: 'Es ist bewölkt / bedeckt',      english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: 'Teilweise bewölkt',             english: 'Partly cloudy' },
  { condition: 'rainy',        label: 'Es regnet',                     english: 'It\'s raining' },
  { condition: 'stormy',       label: 'Es gibt ein Gewitter',          english: 'There\'s a storm' },
  { condition: 'snowy',        label: 'Es schneit',                    english: 'It\'s snowing' },
  { condition: 'windy',        label: 'Es ist windig',                 english: 'It\'s windy' },
  { condition: 'foggy',        label: 'Es ist neblig / Es gibt Nebel', english: 'It\'s foggy' },
];

const WEATHER_VOCAB_IT: WeatherEntry[] = [
  { condition: 'sunny',        label: 'C\'è il sole / È soleggiato',  english: 'It\'s sunny' },
  { condition: 'hot',          label: 'Fa molto caldo',               english: 'It\'s very hot' },
  { condition: 'cold',         label: 'Fa freddo',                    english: 'It\'s cold' },
  { condition: 'cloudy',       label: 'È nuvoloso / È coperto',       english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: 'Parzialmente nuvoloso',        english: 'Partly cloudy' },
  { condition: 'rainy',        label: 'Piove / Sta piovendo',         english: 'It\'s raining' },
  { condition: 'stormy',       label: 'C\'è un temporale',            english: 'There\'s a storm' },
  { condition: 'snowy',        label: 'Nevica / Sta nevicando',       english: 'It\'s snowing' },
  { condition: 'windy',        label: 'C\'è vento / Tira vento',      english: 'It\'s windy' },
  { condition: 'foggy',        label: 'C\'è nebbia / È nebbioso',     english: 'It\'s foggy' },
];

const WEATHER_VOCAB_JA: WeatherEntry[] = [
  { condition: 'sunny',        label: '晴れ (はれ) — Hare',            english: 'It\'s sunny / clear' },
  { condition: 'hot',          label: 'とても暑い (あつい) — Atsui',    english: 'It\'s very hot' },
  { condition: 'cold',         label: '寒い (さむい) — Samui',          english: 'It\'s cold' },
  { condition: 'cloudy',       label: '曇り (くもり) — Kumori',          english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: '晴れ時々曇り — Hare Tokidoki',   english: 'Partly cloudy' },
  { condition: 'rainy',        label: '雨 (あめ) — Ame',                english: 'It\'s raining' },
  { condition: 'stormy',       label: '嵐 (あらし) — Arashi',            english: 'There\'s a storm' },
  { condition: 'snowy',        label: '雪 (ゆき) — Yuki',               english: 'It\'s snowing' },
  { condition: 'windy',        label: '風が強い (かぜ) — Kaze ga Tsuyoi', english: 'It\'s windy' },
  { condition: 'foggy',        label: '霧 (きり) — Kiri',               english: 'It\'s foggy' },
];

const WEATHER_VOCAB_KO: WeatherEntry[] = [
  { condition: 'sunny',        label: '맑음 — Malg-eum',              english: 'It\'s clear/sunny' },
  { condition: 'hot',          label: '매우 더워요 — Maeu Deowoyo',    english: 'It\'s very hot' },
  { condition: 'cold',         label: '추워요 — Chuwoyo',              english: 'It\'s cold' },
  { condition: 'cloudy',       label: '흐려요 — Heuryeoyo',            english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: '구름 조금 — Gureum Jogeum',     english: 'Partly cloudy' },
  { condition: 'rainy',        label: '비가 와요 — Biga Wayo',         english: 'It\'s raining' },
  { condition: 'stormy',       label: '폭풍이에요 — Pokpung-ieyo',     english: 'There\'s a storm' },
  { condition: 'snowy',        label: '눈이 와요 — Nun-i Wayo',        english: 'It\'s snowing' },
  { condition: 'windy',        label: '바람이 불어요 — Param-i Bureoyo', english: 'It\'s windy' },
  { condition: 'foggy',        label: '안개가 껴요 — Angae-ga Kkyeoyo', english: 'It\'s foggy' },
];

const WEATHER_VOCAB_ZH: WeatherEntry[] = [
  { condition: 'sunny',        label: '晴天 (qíngtiān) — Qíngtiān',      english: 'It\'s sunny / clear' },
  { condition: 'hot',          label: '很热 (hěn rè) — Hěn Rè',          english: 'It\'s very hot' },
  { condition: 'cold',         label: '很冷 (hěn lěng) — Hěn Lěng',      english: 'It\'s cold' },
  { condition: 'cloudy',       label: '多云 (duōyún) — Duōyún',           english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: '局部多云 — Júbù Duōyún',           english: 'Partly cloudy' },
  { condition: 'rainy',        label: '下雨了 (xià yǔ le) — Xià Yǔ Le',  english: 'It\'s raining' },
  { condition: 'stormy',       label: '有暴风雨 — Yǒu Bàofēngyǔ',         english: 'There\'s a storm' },
  { condition: 'snowy',        label: '下雪了 (xià xuě le) — Xià Xuě Le', english: 'It\'s snowing' },
  { condition: 'windy',        label: '刮风了 (guā fēng le) — Guā Fēng',  english: 'It\'s windy' },
  { condition: 'foggy',        label: '有雾 (yǒu wù) — Yǒu Wù',           english: 'It\'s foggy' },
];

const WEATHER_VOCAB_HE: WeatherEntry[] = [
  { condition: 'sunny',        label: 'שמשי (shamshi)',                    english: 'It\'s sunny' },
  { condition: 'hot',          label: 'חם מאוד (kham me\'od)',             english: 'It\'s very hot' },
  { condition: 'cold',         label: 'קר (kar)',                          english: 'It\'s cold' },
  { condition: 'cloudy',       label: 'מעונן (me\'unan)',                  english: 'It\'s cloudy' },
  { condition: 'partly_cloudy',label: 'מעונן חלקית (me\'unan khalkit)',    english: 'Partly cloudy' },
  { condition: 'rainy',        label: 'גשום (gashuam) / יורד גשם',        english: 'It\'s raining' },
  { condition: 'stormy',       label: 'סוער (so\'er)',                     english: 'There\'s a storm' },
  { condition: 'snowy',        label: 'יורד שלג (yored sheleg)',           english: 'It\'s snowing' },
  { condition: 'windy',        label: 'רוח חזקה (ruakh khazaka)',          english: 'It\'s windy' },
  { condition: 'foggy',        label: 'ערפילי (arplili)',                  english: 'It\'s foggy' },
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
  portuguese: [
    ['Como está o tempo?', 'What\'s the weather like?'],
    ['O tempo está bom.', 'The weather is nice.'],
    ['O tempo está ruim.', 'The weather is bad.'],
    ['Qual é a temperatura?', 'What is the temperature?'],
    ['Há sol / nuvens / vento.', 'It\'s sunny / cloudy / windy.'],
    ['A previsão do tempo diz…', 'The forecast says…'],
  ],
  german: [
    ['Wie ist das Wetter?', 'What\'s the weather like?'],
    ['Das Wetter ist schön.', 'The weather is nice.'],
    ['Das Wetter ist schlecht.', 'The weather is bad.'],
    ['Wie viel Grad hat es?', 'What is the temperature?'],
    ['Es ist sonnig / bewölkt / windig.', 'It\'s sunny / cloudy / windy.'],
    ['Die Wettervorhersage sagt…', 'The forecast says…'],
  ],
  italian: [
    ['Com\'è il tempo?', 'What\'s the weather like?'],
    ['Il tempo è bello.', 'The weather is nice.'],
    ['Il tempo è brutto.', 'The weather is bad.'],
    ['Quanti gradi ci sono?', 'What is the temperature?'],
    ['C\'è il sole / nuvoloso / vento.', 'It\'s sunny / cloudy / windy.'],
    ['Le previsioni del tempo dicono…', 'The forecast says…'],
  ],
  japanese: [
    ['今日の天気はどうですか？', 'What\'s the weather like today?'],
    ['いい天気ですね。', 'It\'s nice weather, isn\'t it?'],
    ['天気が悪いです。', 'The weather is bad.'],
    ['何度ですか？', 'How many degrees is it?'],
    ['晴れ / 曇り / 風が強いです。', 'It\'s sunny / cloudy / windy.'],
    ['天気予報によると…', 'The forecast says…'],
  ],
  korean: [
    ['오늘 날씨가 어때요?', 'What\'s the weather like today?'],
    ['날씨가 좋아요.', 'The weather is nice.'],
    ['날씨가 나빠요.', 'The weather is bad.'],
    ['몇 도예요?', 'How many degrees is it?'],
    ['맑아요 / 흐려요 / 바람이 불어요.', 'It\'s sunny / cloudy / windy.'],
    ['일기 예보에 따르면…', 'The forecast says…'],
  ],
  mandarin: [
    ['今天天气怎么样？', 'What\'s the weather like today?'],
    ['天气很好。', 'The weather is nice.'],
    ['天气很差。', 'The weather is bad.'],
    ['现在几度？', 'How many degrees is it?'],
    ['晴天 / 多云 / 有风。', 'It\'s sunny / cloudy / windy.'],
    ['天气预报说…', 'The forecast says…'],
  ],
  hebrew: [
    ['מה מזג האוויר?', 'What\'s the weather like?'],
    ['מזג האוויר נחמד.', 'The weather is nice.'],
    ['מזג האוויר רע.', 'The weather is bad.'],
    ['כמה מעלות יש?', 'How many degrees is it?'],
    ['שמשי / מעונן / רוח חזקה.', 'It\'s sunny / cloudy / windy.'],
    ['תחזית מזג האוויר אומרת...', 'The forecast says...'],
  ],
};

export function WeatherVocabCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? WEATHER_VOCAB_FR : language === 'portuguese' ? WEATHER_VOCAB_PT : language === 'german' ? WEATHER_VOCAB_DE : language === 'italian' ? WEATHER_VOCAB_IT : language === 'japanese' ? WEATHER_VOCAB_JA : language === 'korean' ? WEATHER_VOCAB_KO : language === 'mandarin' ? WEATHER_VOCAB_ZH : language === 'hebrew' ? WEATHER_VOCAB_HE : WEATHER_VOCAB_ES;
  const exprs = WEATHER_EXPRESSIONS[language] ?? WEATHER_EXPRESSIONS.spanish;
  const sectionTitle = language === 'french' ? 'La Météo — Weather Conditions' : language === 'portuguese' ? 'O Tempo — Weather Conditions' : language === 'german' ? 'Das Wetter — Weather Conditions' : language === 'italian' ? 'Il Tempo — Condizioni Meteorologiche' : language === 'japanese' ? '天气 — Weather Conditions' : language === 'korean' ? '날씨 — Weather Conditions' : language === 'mandarin' ? 'Weather Conditions' : language === 'hebrew' ? 'Weather Conditions' : 'El Tiempo — Weather Conditions';
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

const EMOTIONS_VOCAB_PT: EmotionEntry[] = [
  { emotion: 'happy',     label: 'feliz / contente',       english: 'happy' },
  { emotion: 'excited',   label: 'animado/a / empolgado/a',english: 'excited' },
  { emotion: 'sad',       label: 'triste',                 english: 'sad' },
  { emotion: 'angry',     label: 'com raiva / irritado/a', english: 'angry' },
  { emotion: 'surprised', label: 'surpreso/a',             english: 'surprised' },
  { emotion: 'afraid',    label: 'com medo / assustado/a', english: 'afraid' },
  { emotion: 'confused',  label: 'confuso/a / perdido/a',  english: 'confused' },
  { emotion: 'tired',     label: 'cansado/a',              english: 'tired' },
  { emotion: 'nervous',   label: 'nervoso/a',              english: 'nervous' },
  { emotion: 'disgusted', label: 'enojado/a / enjoado/a',  english: 'disgusted' },
  { emotion: 'bored',     label: 'entediado/a / aborrecido/a', english: 'bored' },
];

const EMOTIONS_VOCAB_DE: EmotionEntry[] = [
  { emotion: 'happy',     label: 'glücklich / froh',         english: 'happy' },
  { emotion: 'excited',   label: 'aufgeregt / begeistert',   english: 'excited' },
  { emotion: 'sad',       label: 'traurig',                  english: 'sad' },
  { emotion: 'angry',     label: 'wütend / ärgerlich',       english: 'angry' },
  { emotion: 'surprised', label: 'überrascht',               english: 'surprised' },
  { emotion: 'afraid',    label: 'ängstlich / Angst haben',  english: 'afraid' },
  { emotion: 'confused',  label: 'verwirrt / durcheinander', english: 'confused' },
  { emotion: 'tired',     label: 'müde',                     english: 'tired' },
  { emotion: 'nervous',   label: 'nervös',                   english: 'nervous' },
  { emotion: 'disgusted', label: 'angewidert / ekelig',      english: 'disgusted' },
  { emotion: 'bored',     label: 'gelangweilt',              english: 'bored' },
];

const EMOTIONS_VOCAB_IT: EmotionEntry[] = [
  { emotion: 'happy',     label: 'felice / contento/a',         english: 'happy' },
  { emotion: 'excited',   label: 'emozionato/a / entusiasta',   english: 'excited' },
  { emotion: 'sad',       label: 'triste',                      english: 'sad' },
  { emotion: 'angry',     label: 'arrabbiato/a',                english: 'angry' },
  { emotion: 'surprised', label: 'sorpreso/a',                  english: 'surprised' },
  { emotion: 'afraid',    label: 'spaventato/a / aver paura',   english: 'afraid' },
  { emotion: 'confused',  label: 'confuso/a / disorientato/a',  english: 'confused' },
  { emotion: 'tired',     label: 'stanco/a',                    english: 'tired' },
  { emotion: 'nervous',   label: 'nervoso/a',                   english: 'nervous' },
  { emotion: 'disgusted', label: 'disgustato/a / schifato/a',   english: 'disgusted' },
  { emotion: 'bored',     label: 'annoiato/a',                  english: 'bored' },
];

const EMOTIONS_VOCAB_JA: EmotionEntry[] = [
  { emotion: 'happy',     label: '嬉しい (うれしい) — Ureshii',       english: 'happy' },
  { emotion: 'excited',   label: '興奮した (こうふん) — Kōfun shita', english: 'excited' },
  { emotion: 'sad',       label: '悲しい (かなしい) — Kanashii',       english: 'sad' },
  { emotion: 'angry',     label: '怒っている (おこって) — Okotte iru', english: 'angry' },
  { emotion: 'surprised', label: '驚いた (おどろいた) — Odoroita',    english: 'surprised' },
  { emotion: 'afraid',    label: '怖い (こわい) — Kowai',             english: 'afraid' },
  { emotion: 'confused',  label: '混乱した (こんらん) — Konran shita', english: 'confused' },
  { emotion: 'tired',     label: '疲れた (つかれた) — Tsukareta',     english: 'tired' },
  { emotion: 'nervous',   label: '緊張した (きんちょう) — Kinchō shita', english: 'nervous' },
  { emotion: 'disgusted', label: '気持ち悪い (きもち) — Kimochi warui', english: 'disgusted' },
  { emotion: 'bored',     label: '退屈 (たいくつ) — Taikutsu',        english: 'bored' },
];

const EMOTIONS_VOCAB_KO: EmotionEntry[] = [
  { emotion: 'happy',     label: '행복해요 — Haengbok-haeyo',         english: 'happy' },
  { emotion: 'excited',   label: '신나요 — Sinnayo',                  english: 'excited' },
  { emotion: 'sad',       label: '슬퍼요 — Seulpeoyo',                english: 'sad' },
  { emotion: 'angry',     label: '화가 났어요 — Hwaga Nasseoyo',      english: 'angry' },
  { emotion: 'surprised', label: '놀랐어요 — Nollasseoyo',            english: 'surprised' },
  { emotion: 'afraid',    label: '무서워요 — Museowoyo',              english: 'afraid' },
  { emotion: 'confused',  label: '혼란스러워요 — Hollanseureowoyo',   english: 'confused' },
  { emotion: 'tired',     label: '피곤해요 — Pigon-haeyo',            english: 'tired' },
  { emotion: 'nervous',   label: '긴장돼요 — Ginjang-dwaeyo',         english: 'nervous' },
  { emotion: 'disgusted', label: '역겨워요 — Yeok-gyeowoyo',          english: 'disgusted' },
  { emotion: 'bored',     label: '지루해요 — Jiru-haeyo',             english: 'bored' },
];

const EMOTIONS_VOCAB_ZH: EmotionEntry[] = [
  { emotion: 'happy',     label: '高兴 (gāoxìng) — Gāoxìng',         english: 'happy' },
  { emotion: 'excited',   label: '兴奋 (xīngfèn) — Xīngfèn',         english: 'excited' },
  { emotion: 'sad',       label: '难过 (nánguò) — Nánguò',            english: 'sad' },
  { emotion: 'angry',     label: '生气 (shēngqì) — Shēngqì',          english: 'angry' },
  { emotion: 'surprised', label: '惊讶 (jīngyà) — Jīngyà',            english: 'surprised' },
  { emotion: 'afraid',    label: '害怕 (hàipà) — Hàipà',              english: 'afraid' },
  { emotion: 'confused',  label: '困惑 (kùnhuò) — Kùnhuò',            english: 'confused' },
  { emotion: 'tired',     label: '累 (lèi) — Lèi',                    english: 'tired' },
  { emotion: 'nervous',   label: '紧张 (jǐnzhāng) — Jǐnzhāng',        english: 'nervous' },
  { emotion: 'disgusted', label: '恶心 (ěxin) — Ěxin',                english: 'disgusted' },
  { emotion: 'bored',     label: '无聊 (wúliáo) — Wúliáo',            english: 'bored' },
];


const EMOTIONS_VOCAB_HE: EmotionEntry[] = [
  { emotion: 'happy',     label: 'שמח (sameʻakh)',                  english: 'happy' },
  { emotion: 'excited',   label: 'נרגש (nirgas)',                   english: 'excited' },
  { emotion: 'sad',       label: 'עצוב (atzuv)',                    english: 'sad' },
  { emotion: 'angry',     label: 'כועס (khoʻes)',              english: 'angry' },
  { emotion: 'surprised', label: 'מופתע (mufta)',              english: 'surprised' },
  { emotion: 'afraid',    label: 'פוחד (pokhad)',                   english: 'afraid' },
  { emotion: 'confused',  label: 'מבולבל (mevulval)',    english: 'confused' },
  { emotion: 'tired',     label: 'עיף (ʻayef)',                     english: 'tired' },
  { emotion: 'nervous',   label: 'עצבני (atzabni)',           english: 'nervous' },
  { emotion: 'disgusted', label: 'ניאוץ (niʻots)',       english: 'disgusted' },
  { emotion: 'bored',     label: 'משועמם (meshoaʻam)', english: 'bored' },
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
  portuguese: [
    ['Como você se sente? / Como te sentes?', 'How do you feel?'],
    ['Me sinto feliz / triste.', 'I feel happy / sad.'],
    ['Estou cansado/a.', 'I am tired.'],
    ['Estou muito animado/a!', 'I\'m very excited!'],
    ['Por que você está com raiva?', 'Why are you angry?'],
    ['Não me sinto bem.', 'I don\'t feel well.'],
  ],
  german: [
    ['Wie fühlst du dich? / Wie geht es dir?', 'How do you feel?'],
    ['Ich fühle mich glücklich / traurig.', 'I feel happy / sad.'],
    ['Ich bin müde.', 'I am tired.'],
    ['Ich bin sehr aufgeregt!', 'I\'m very excited!'],
    ['Warum bist du wütend?', 'Why are you angry?'],
    ['Ich fühle mich nicht wohl.', 'I don\'t feel well.'],
  ],
  italian: [
    ['Come ti senti? / Come stai?', 'How do you feel?'],
    ['Mi sento felice / triste.', 'I feel happy / sad.'],
    ['Sono stanco/a.', 'I am tired.'],
    ['Sono molto emozionato/a!', 'I\'m very excited!'],
    ['Perché sei arrabbiato/a?', 'Why are you angry?'],
    ['Non mi sento bene.', 'I don\'t feel well.'],
  ],
  japanese: [
    ['気分はどうですか？', 'How do you feel?'],
    ['嬉しい / 悲しい気分です。', 'I feel happy / sad.'],
    ['疲れています。', 'I am tired.'],
    ['とても興奮しています！', 'I\'m very excited!'],
    ['なぜ怒っているのですか？', 'Why are you angry?'],
    ['気分が悪いです。', 'I don\'t feel well.'],
  ],
  korean: [
    ['기분이 어때요?', 'How do you feel?'],
    ['행복해요 / 슬퍼요.', 'I feel happy / sad.'],
    ['피곤해요.', 'I am tired.'],
    ['정말 신나요!', 'I\'m really excited!'],
    ['왜 화가 났어요?', 'Why are you angry?'],
    ['몸이 좋지 않아요.', 'I don\'t feel well.'],
  ],
  mandarin: [
    ['你感觉怎么样？', 'How do you feel?'],
    ['我感到高兴 / 难过。', 'I feel happy / sad.'],
    ['我很累。', 'I am tired.'],
    ['我很兴奋！', 'I\'m very excited!'],
    ['你为什么生气？', 'Why are you angry?'],
    ['我感觉不舒服。', 'I don\'t feel well.'],
  ],
  hebrew: [
    ['איך אתה מרגיש?', 'How do you feel?'],
    ['אני מרגיש שמח / עצוב.', 'I feel happy / sad.'],
    ['אני עיף.', 'I am tired.'],
    ['אני או נרגש!', "I'm very excited!"],
    ['למה אתה כועס?', 'Why are you angry?'],
    ['אני לא מרגיש טוב.', "I don't feel well."],
  ],
};

export function EmotionsVocabCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? EMOTIONS_VOCAB_FR : language === 'portuguese' ? EMOTIONS_VOCAB_PT : language === 'german' ? EMOTIONS_VOCAB_DE : language === 'italian' ? EMOTIONS_VOCAB_IT : language === 'japanese' ? EMOTIONS_VOCAB_JA : language === 'korean' ? EMOTIONS_VOCAB_KO : language === 'mandarin' ? EMOTIONS_VOCAB_ZH : language === 'hebrew' ? EMOTIONS_VOCAB_HE : EMOTIONS_VOCAB_ES;
  const exprs = EMOTION_EXPRESSIONS[language] ?? EMOTION_EXPRESSIONS.spanish;
  const sectionTitle = language === 'french' ? 'Les Émotions — Feelings & Emotions' : language === 'portuguese' ? 'As Emoções — Feelings & Emotions' : language === 'german' ? 'Die Gefühle — Feelings & Emotions' : language === 'italian' ? 'Le Emozioni — Feelings & Emotions' : language === 'japanese' ? '感情 — Feelings & Emotions' : language === 'korean' ? '감정 — Feelings & Emotions' : language === 'mandarin' ? 'Feelings & Emotions' : language === 'hebrew' ? 'רגשות — Feelings & Emotions' : 'Las Emociones — Feelings & Emotions';
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

const TIME_VOCAB_PT: TimeEntry[] = [
  { time: '12:00', label: 'É meio-dia',                    english: 'It\'s noon' },
  { time: '1:00',  label: 'É uma hora (em ponto)',          english: 'It\'s one o\'clock' },
  { time: '2:30',  label: 'São duas e meia',               english: 'It\'s two-thirty' },
  { time: '3:15',  label: 'São três e quinze / e um quarto', english: 'It\'s quarter past three' },
  { time: '8:45',  label: 'São oito e quarenta e cinco',   english: 'It\'s quarter to nine' },
  { time: '10:10', label: 'São dez e dez',                 english: 'It\'s ten past ten' },
  { time: '6:00',  label: 'São seis da tarde',             english: 'It\'s six in the evening' },
  { time: '0:00',  label: 'É meia-noite',                  english: 'It\'s midnight' },
];

const TIME_VOCAB_DE: TimeEntry[] = [
  { time: '12:00', label: 'Es ist Mittag / zwölf Uhr',          english: 'It\'s noon' },
  { time: '1:00',  label: 'Es ist ein Uhr',                     english: 'It\'s one o\'clock' },
  { time: '2:30',  label: 'Es ist halb drei',                   english: 'It\'s two-thirty' },
  { time: '3:15',  label: 'Es ist Viertel nach drei',           english: 'It\'s quarter past three' },
  { time: '8:45',  label: 'Es ist Viertel vor neun',            english: 'It\'s quarter to nine' },
  { time: '10:10', label: 'Es ist zehn nach zehn',              english: 'It\'s ten past ten' },
  { time: '6:00',  label: 'Es ist achtzehn Uhr / sechs Uhr',   english: 'It\'s six in the evening' },
  { time: '0:00',  label: 'Es ist Mitternacht / null Uhr',      english: 'It\'s midnight' },
];

const TIME_VOCAB_IT: TimeEntry[] = [
  { time: '12:00', label: 'È mezzogiorno',                 english: 'It\'s noon' },
  { time: '1:00',  label: 'È l\'una in punto',             english: 'It\'s one o\'clock' },
  { time: '2:30',  label: 'Sono le due e mezza',           english: 'It\'s two-thirty' },
  { time: '3:15',  label: 'Sono le tre e un quarto',       english: 'It\'s quarter past three' },
  { time: '8:45',  label: 'Sono le nove meno un quarto',   english: 'It\'s quarter to nine' },
  { time: '10:10', label: 'Sono le dieci e dieci',         english: 'It\'s ten past ten' },
  { time: '6:00',  label: 'Sono le sei di sera',           english: 'It\'s six in the evening' },
  { time: '0:00',  label: 'È mezzanotte',                  english: 'It\'s midnight' },
];

const TIME_VOCAB_JA: TimeEntry[] = [
  { time: '12:00', label: '正午 (しょうご) — Shōgo',                    english: 'It\'s noon' },
  { time: '1:00',  label: '一時 (いちじ) — Ichi-ji',                    english: 'It\'s one o\'clock' },
  { time: '2:30',  label: '二時半 (にじはん) — Ni-ji han',              english: 'It\'s two-thirty' },
  { time: '3:15',  label: '三時十五分 (さんじ) — San-ji jūgo-fun',      english: 'It\'s quarter past three' },
  { time: '8:45',  label: '八時四十五分 (はちじ) — Hachi-ji yonjūgo-fun', english: 'It\'s quarter to nine' },
  { time: '10:10', label: '十時十分 (じゅうじ) — Jū-ji jippun',         english: 'It\'s ten past ten' },
  { time: '6:00',  label: '六時 (ろくじ) — Roku-ji',                    english: 'It\'s six in the evening' },
  { time: '0:00',  label: '真夜中 (まよなか) — Mayonaka',               english: 'It\'s midnight' },
];

const TIME_VOCAB_KO: TimeEntry[] = [
  { time: '12:00', label: '정오 — Jeon-o (Noon)',                     english: 'It\'s noon' },
  { time: '1:00',  label: '한 시 — Han Si',                           english: 'It\'s one o\'clock' },
  { time: '2:30',  label: '두 시 삼십 분 — Du Si Samsip Bun',          english: 'It\'s two-thirty' },
  { time: '3:15',  label: '세 시 십오 분 — Se Si Sibo Bun',             english: 'It\'s quarter past three' },
  { time: '8:45',  label: '여덟 시 사십오 분 — Yeodeol Si Sasibo Bun', english: 'It\'s quarter to nine' },
  { time: '10:10', label: '열 시 십 분 — Yeol Si Sip Bun',             english: 'It\'s ten past ten' },
  { time: '6:00',  label: '여섯 시 — Yeoseot Si (6 PM)',               english: 'It\'s six in the evening' },
  { time: '0:00',  label: '자정 — Ja-jeong (Midnight)',               english: 'It\'s midnight' },
];

const TIME_VOCAB_ZH: TimeEntry[] = [
  { time: '1:00',  label: '一点 (yī diǎn) — Yī Diǎn',              english: 'It\'s one o\'clock' },
  { time: '2:30',  label: '两点半 (liǎng diǎn bàn) — Liǎng Diǎn Bàn', english: 'It\'s two-thirty' },
  { time: '3:15',  label: '三点一刻 (sān diǎn yí kè) — Sān Diǎn Yí Kè', english: 'It\'s quarter past three' },
  { time: '8:45',  label: '八点三刻 (bā diǎn sān kè) — Bā Diǎn Sān Kè', english: 'It\'s quarter to nine' },
  { time: '10:10', label: '十点十分 (shí diǎn shí fēn) — Shí Diǎn Shí Fēn', english: 'It\'s ten past ten' },
  { time: '6:00',  label: '六点 (liù diǎn) — Liù Diǎn (下午)',      english: 'It\'s six in the evening' },
  { time: '0:00',  label: '午夜 / 零点 (wǔyè / líng diǎn)',         english: 'It\'s midnight' },
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
  portuguese: [
    ['Que horas são?', 'What time is it?'],
    ['É uma hora.', 'It\'s one o\'clock. (singular)'],
    ['São [#] horas.', 'It\'s [#] o\'clock. (plural)'],
    ['e quinze / e um quarto', '+ 15 min — quarter past'],
    ['e meia', '+ 30 min — half past'],
    ['menos quinze', '- 15 min — quarter to'],
  ],
  german: [
    ['Wie viel Uhr ist es? / Wie spät ist es?', 'What time is it?'],
    ['Es ist ein Uhr.', 'It\'s one o\'clock.'],
    ['Es ist [#] Uhr.', 'It\'s [#] o\'clock.'],
    ['Viertel nach [#]', '+ 15 min — quarter past'],
    ['halb [#+1]', '+ 30 min — half past (to next hour!)'],
    ['Viertel vor [#]', '- 15 min — quarter to'],
  ],
  italian: [
    ['Che ora è? / Che ore sono?', 'What time is it?'],
    ['È l\'una.', 'It\'s one o\'clock. (singular)'],
    ['Sono le [#].', 'It\'s [#] o\'clock. (plural)'],
    ['e un quarto', '+ 15 min — quarter past'],
    ['e mezza', '+ 30 min — half past'],
    ['meno un quarto', '- 15 min — quarter to'],
  ],
  japanese: [
    ['今何時ですか？', 'What time is it?'],
    ['[#]時です。', 'It\'s [#] o\'clock.'],
    ['[#]時[#]分です。', 'It\'s [#]:[#]'],
    ['[#]時十五分', '+ 15 min — jūgo-fun'],
    ['[#]時半', '+ 30 min — han (half past)'],
    ['[#]時四十五分', '+ 45 min — yonjūgo-fun'],
  ],
  korean: [
    ['몇 시예요?', 'What time is it?'],
    ['[#]시예요.', 'It\'s [#] o\'clock. (Native nums for hours)'],
    ['[#]시 [#]분이에요.', 'It\'s [#]:[#]. (Sino-Korean for minutes)'],
    ['[#]시 십오 분', '+ 15 min — sibo bun'],
    ['[#]시 삼십 분 / [#]시 반', '+ 30 min — samsip bun / ban'],
    ['[#]시 사십오 분', '+ 45 min — sasibo bun'],
  ],
  mandarin: [
    ['现在几点？', 'What time is it?'],
    ['[#]点。', 'It\'s [#] o\'clock.'],
    ['[#]点[#]分。', 'It\'s [#]:[#].'],
    ['[#]点一刻', '+ 15 min — yí kè (quarter)'],
    ['[#]点半', '+ 30 min — bàn (half past)'],
    ['[#]点三刻', '+ 45 min — sān kè (three quarters)'],
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
  portuguese: [
    ['da manhã', 'in the morning (AM)'],
    ['do meio-dia', 'at noon'],
    ['da tarde', 'in the afternoon'],
    ['da noite', 'at night'],
    ['A que horas…?', 'At what time…?'],
    ['às [#] horas', 'at [#] o\'clock'],
  ],
  german: [
    ['morgens / am Morgen', 'in the morning'],
    ['mittags / am Mittag', 'at noon'],
    ['nachmittags / am Nachmittag', 'in the afternoon'],
    ['abends / am Abend', 'in the evening'],
    ['Um wie viel Uhr…?', 'At what time…?'],
    ['um [#] Uhr', 'at [#] o\'clock'],
  ],
  italian: [
    ['di mattina / la mattina', 'in the morning'],
    ['a mezzogiorno', 'at noon'],
    ['del pomeriggio / nel pomeriggio', 'in the afternoon'],
    ['di sera / la sera', 'in the evening'],
    ['A che ora…?', 'At what time…?'],
    ['alle [#]', 'at [#] o\'clock'],
  ],
  japanese: [
    ['午前 (ごぜん) — gozen', 'in the morning (AM)'],
    ['正午 (しょうご) — shōgo', 'at noon'],
    ['午後 (ごご) — gogo', 'in the afternoon/evening (PM)'],
    ['夜 (よる) / 深夜 (しんや)', 'at night / late night'],
    ['何時に…？', 'At what time…?'],
    ['[#]時に — [#]-ji ni', 'at [#] o\'clock'],
  ],
  korean: [
    ['아침 — Achim', 'in the morning'],
    ['낮 — Nat', 'at noon / daytime'],
    ['오후 — Ohu', 'in the afternoon (PM)'],
    ['저녁 / 밤 — Jeonyeok / Bam', 'in the evening / at night'],
    ['몇 시에…?', 'At what time…?'],
    ['[#]시에 — [#]si-e', 'at [#] o\'clock'],
  ],
  mandarin: [
    ['早上 (zǎoshang)', 'in the morning'],
    ['中午 (zhōngwǔ)', 'at noon'],
    ['下午 (xiàwǔ)', 'in the afternoon (PM)'],
    ['晚上 (wǎnshang)', 'in the evening / at night'],
    ['几点…？', 'At what time…?'],
    ['[#]点 — [#]diǎn', 'at [#] o\'clock'],
  ],
  hebrew: [
    ['כמה השעה?', 'What time is it?'],
    ['השעה שתיים בדיוק.', "It's exactly noon."],
    ['איכב להיפגש בשלוש.', "Let's meet at 3 o'clock."],
    ['בבוקר / בצהריים / בערב / בלילה', 'morning / noon / evening / night'],
    ['חצי שעה / רבע שעה', 'half past / quarter past'],
    ['אחרי הצהריים / לפני הצהריים', 'PM / AM'],
  ],
};

interface ClockImageFile {
  id: string;
  url: string;
  title: string;
  target_word: string;
  tags: string[];
}

const CLOCK_PATTERNS: { tag: string; label: string; description: string }[] = [
  { tag: 'en-punto',    label: 'En Punto',    description: 'On the hour — es/son las...' },
  { tag: 'y-media',     label: 'Y Media',     description: 'Half past — y media (+30)' },
  { tag: 'y-cuarto',    label: 'Y Cuarto',    description: 'Quarter past — y cuarto (+15)' },
  { tag: 'menos-cuarto',label: 'Menos Cuarto',description: 'Quarter to — menos cuarto (−15)' },
];

export function TimeVocabCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? TIME_VOCAB_FR : language === 'portuguese' ? TIME_VOCAB_PT : language === 'german' ? TIME_VOCAB_DE : language === 'italian' ? TIME_VOCAB_IT : language === 'japanese' ? TIME_VOCAB_JA : language === 'korean' ? TIME_VOCAB_KO : language === 'mandarin' ? TIME_VOCAB_ZH : language === 'hebrew' ? TIME_VOCAB_HE : TIME_VOCAB_ES;
  const patterns = TIME_KEY_PATTERNS[language] ?? TIME_KEY_PATTERNS.spanish;
  const dayParts = TIME_DAY_PARTS[language] ?? TIME_DAY_PARTS.spanish;
  const sectionTitle = language === 'french' ? "L'Heure — Telling Time" : language === 'portuguese' ? 'As Horas — Telling Time' : language === 'german' ? 'Die Uhrzeit — Telling Time' : language === 'italian' ? "L'Ora — Telling Time" : language === 'japanese' ? '時計 — Telling Time' : language === 'korean' ? '시계 — Telling Time' : language === 'mandarin' ? 'Telling Time' : language === 'hebrew' ? 'שעון — Telling Time' : 'La Hora — Telling Time';

  const [activePattern, setActivePattern] = useState<string>('en-punto');

  const { data: clockData } = useQuery<{ files: ClockImageFile[] }>({
    queryKey: [`/api/textbook/media-by-tag?tag=clock&language=${language}`],
    enabled: language === 'spanish',
  });

  const clockImages = clockData?.files ?? [];

  const visibleClocks = activePattern === 'all'
    ? clockImages
    : clockImages.filter(f => Array.isArray(f.tags) && f.tags.includes(activePattern));

  return (
    <Card>
      <CardContent className="p-4 md:p-6 space-y-4">
        <SectionLabel>{sectionTitle}</SectionLabel>

        {/* Quick-reference SVG clocks — all languages */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

        {/* Pattern + day-parts reference — all languages */}
        <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-6">
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

        {/* Clock image gallery — Spanish only (48 images by pattern) */}
        {language === 'spanish' && clockImages.length > 0 && (
          <div className="pt-2 border-t border-border/40">
            <SectionLabel>Clock Gallery — All Times</SectionLabel>
            <p className="text-[11px] text-muted-foreground mb-3">
              Practice reading each clock face and saying the time aloud in Spanish.
            </p>

            {/* Pattern tabs */}
            <div className="flex gap-2 flex-wrap mb-4">
              {CLOCK_PATTERNS.map(({ tag, label, description }) => (
                <button
                  key={tag}
                  data-testid={`clock-pattern-tab-${tag}`}
                  onClick={() => setActivePattern(tag)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activePattern === tag
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover-elevate'
                  }`}
                  title={description}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {visibleClocks.map((img) => (
                <div
                  key={img.id}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-md bg-muted/40 border border-border/40"
                  data-testid={`clock-image-${img.target_word}`}
                >
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full aspect-square object-contain rounded"
                    loading="lazy"
                  />
                  <span className="text-[10px] font-medium text-center leading-tight">
                    {img.title.split(' — ')[1] ?? img.title}
                  </span>
                </div>
              ))}
            </div>

            {visibleClocks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No images for this pattern yet.
              </p>
            )}
          </div>
        )}
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

const MONTHS_PT: CalMonth[] = [
  { label: 'janeiro', en: 'January' }, { label: 'fevereiro', en: 'February' },
  { label: 'março', en: 'March' }, { label: 'abril', en: 'April' },
  { label: 'maio', en: 'May' }, { label: 'junho', en: 'June' },
  { label: 'julho', en: 'July' }, { label: 'agosto', en: 'August' },
  { label: 'setembro', en: 'September' }, { label: 'outubro', en: 'October' },
  { label: 'novembro', en: 'November' }, { label: 'dezembro', en: 'December' },
];

const DAYS_PT: CalDay[] = [
  { abbr: 'Se', full: 'segunda-feira', en: 'Monday' },
  { abbr: 'Te', full: 'terça-feira', en: 'Tuesday' },
  { abbr: 'Qu', full: 'quarta-feira', en: 'Wednesday' },
  { abbr: 'Qu', full: 'quinta-feira', en: 'Thursday' },
  { abbr: 'Se', full: 'sexta-feira', en: 'Friday' },
  { abbr: 'Sá', full: 'sábado', en: 'Saturday' },
  { abbr: 'Do', full: 'domingo', en: 'Sunday' },
];

const MONTHS_DE: CalMonth[] = [
  { label: 'Januar', en: 'January' }, { label: 'Februar', en: 'February' },
  { label: 'März', en: 'March' }, { label: 'April', en: 'April' },
  { label: 'Mai', en: 'May' }, { label: 'Juni', en: 'June' },
  { label: 'Juli', en: 'July' }, { label: 'August', en: 'August' },
  { label: 'September', en: 'September' }, { label: 'Oktober', en: 'October' },
  { label: 'November', en: 'November' }, { label: 'Dezember', en: 'December' },
];

const DAYS_DE: CalDay[] = [
  { abbr: 'Mo', full: 'Montag', en: 'Monday' },
  { abbr: 'Di', full: 'Dienstag', en: 'Tuesday' },
  { abbr: 'Mi', full: 'Mittwoch', en: 'Wednesday' },
  { abbr: 'Do', full: 'Donnerstag', en: 'Thursday' },
  { abbr: 'Fr', full: 'Freitag', en: 'Friday' },
  { abbr: 'Sa', full: 'Samstag', en: 'Saturday' },
  { abbr: 'So', full: 'Sonntag', en: 'Sunday' },
];

const MONTHS_IT: CalMonth[] = [
  { label: 'gennaio', en: 'January' }, { label: 'febbraio', en: 'February' },
  { label: 'marzo', en: 'March' }, { label: 'aprile', en: 'April' },
  { label: 'maggio', en: 'May' }, { label: 'giugno', en: 'June' },
  { label: 'luglio', en: 'July' }, { label: 'agosto', en: 'August' },
  { label: 'settembre', en: 'September' }, { label: 'ottobre', en: 'October' },
  { label: 'novembre', en: 'November' }, { label: 'dicembre', en: 'December' },
];

const DAYS_IT: CalDay[] = [
  { abbr: 'Lu', full: 'lunedì', en: 'Monday' },
  { abbr: 'Ma', full: 'martedì', en: 'Tuesday' },
  { abbr: 'Me', full: 'mercoledì', en: 'Wednesday' },
  { abbr: 'Gi', full: 'giovedì', en: 'Thursday' },
  { abbr: 'Ve', full: 'venerdì', en: 'Friday' },
  { abbr: 'Sa', full: 'sabato', en: 'Saturday' },
  { abbr: 'Do', full: 'domenica', en: 'Sunday' },
];

const MONTHS_JA: CalMonth[] = [
  { label: '一月 (いちがつ)', en: 'January' }, { label: '二月 (にがつ)', en: 'February' },
  { label: '三月 (さんがつ)', en: 'March' }, { label: '四月 (しがつ)', en: 'April' },
  { label: '五月 (ごがつ)', en: 'May' }, { label: '六月 (ろくがつ)', en: 'June' },
  { label: '七月 (しちがつ)', en: 'July' }, { label: '八月 (はちがつ)', en: 'August' },
  { label: '九月 (くがつ)', en: 'September' }, { label: '十月 (じゅうがつ)', en: 'October' },
  { label: '十一月 (じゅういちがつ)', en: 'November' }, { label: '十二月 (じゅうにがつ)', en: 'December' },
];

const DAYS_JA: CalDay[] = [
  { abbr: '月', full: '月曜日 (げつようび)', en: 'Monday' },
  { abbr: '火', full: '火曜日 (かようび)', en: 'Tuesday' },
  { abbr: '水', full: '水曜日 (すいようび)', en: 'Wednesday' },
  { abbr: '木', full: '木曜日 (もくようび)', en: 'Thursday' },
  { abbr: '金', full: '金曜日 (きんようび)', en: 'Friday' },
  { abbr: '土', full: '土曜日 (どようび)', en: 'Saturday' },
  { abbr: '日', full: '日曜日 (にちようび)', en: 'Sunday' },
];

const MONTHS_KO: CalMonth[] = [
  { label: '1월 (일월) — Irwol', en: 'January' }, { label: '2월 (이월) — Iwol', en: 'February' },
  { label: '3월 (삼월) — Samwol', en: 'March' }, { label: '4월 (사월) — Sawol', en: 'April' },
  { label: '5월 (오월) — Owol', en: 'May' }, { label: '6월 (유월) — Yuwol', en: 'June' },
  { label: '7월 (칠월) — Chilwol', en: 'July' }, { label: '8월 (팔월) — Palwol', en: 'August' },
  { label: '9월 (구월) — Guwol', en: 'September' }, { label: '10월 (시월) — Siwol', en: 'October' },
  { label: '11월 (십일월) — Sibirwol', en: 'November' }, { label: '12월 (십이월) — Sibiwol', en: 'December' },
];

const DAYS_KO: CalDay[] = [
  { abbr: '월', full: '월요일 — Woryoil', en: 'Monday' },
  { abbr: '화', full: '화요일 — Hwayoil', en: 'Tuesday' },
  { abbr: '수', full: '수요일 — Suyoil', en: 'Wednesday' },
  { abbr: '목', full: '목요일 — Mogyoil', en: 'Thursday' },
  { abbr: '금', full: '금요일 — Geumyoil', en: 'Friday' },
  { abbr: '토', full: '토요일 — Toyoil', en: 'Saturday' },
  { abbr: '일', full: '일요일 — Iryoil', en: 'Sunday' },
];

const MONTHS_ZH: CalMonth[] = [
  { label: '一月 (Yīyuè)', en: 'January' }, { label: '二月 (Èryuè)', en: 'February' },
  { label: '三月 (Sānyuè)', en: 'March' }, { label: '四月 (Sìyuè)', en: 'April' },
  { label: '五月 (Wǔyuè)', en: 'May' }, { label: '六月 (Liùyuè)', en: 'June' },
  { label: '七月 (Qīyuè)', en: 'July' }, { label: '八月 (Bāyuè)', en: 'August' },
  { label: '九月 (Jiǔyuè)', en: 'September' }, { label: '十月 (Shíyuè)', en: 'October' },
  { label: '十一月 (Shíyīyuè)', en: 'November' }, { label: '十二月 (Shí\'èryuè)', en: 'December' },
];

const DAYS_ZH: CalDay[] = [
  { abbr: '一', full: '星期一 (Xīngqīyī)', en: 'Monday' },
  { abbr: '二', full: '星期二 (Xīngqī\'èr)', en: 'Tuesday' },
  { abbr: '三', full: '星期三 (Xīngqīsān)', en: 'Wednesday' },
  { abbr: '四', full: '星期四 (Xīngqīsì)', en: 'Thursday' },
  { abbr: '五', full: '星期五 (Xīngqīwǔ)', en: 'Friday' },
  { abbr: '六', full: '星期六 (Xīngqīliù)', en: 'Saturday' },
  { abbr: '日', full: '星期日 (Xīngqīrì)', en: 'Sunday' },
];


const MONTHS_HE: CalMonth[] = [
  { label: 'ינואר (Yanuar)', en: 'January' }, { label: 'פברואר (Februar)', en: 'February' },
  { label: 'מרץ (Merts)', en: 'March' }, { label: 'אפריל (April)', en: 'April' },
  { label: 'מאי (Mai)', en: 'May' }, { label: 'יוני (Yuni)', en: 'June' },
  { label: 'יולי (Yuli)', en: 'July' }, { label: 'אוגוסט (Ogust)', en: 'August' },
  { label: 'ספטמבר (September)', en: 'September' }, { label: 'אוקטובר (Oktober)', en: 'October' },
  { label: 'נובמבר (Novembar)', en: 'November' }, { label: 'דצמבר (Detsember)', en: 'December' },
];

const DAYS_HE: CalDay[] = [
  { abbr: 'ב׳', full: 'יום שני (Yom Sheni)', en: 'Monday' },
  { abbr: 'ג׳', full: 'יום שלישי (Yom Shlishi)', en: 'Tuesday' },
  { abbr: 'ד׳', full: "יום רביעי (Yom Revi'i)", en: 'Wednesday' },
  { abbr: 'ה׳', full: 'יום חמישי (Yom Khamishi)', en: 'Thursday' },
  { abbr: 'ו׳', full: 'יום שישי (Yom Shishi)', en: 'Friday' },
  { abbr: 'שב',      full: 'שבת (Shabbat)', en: 'Saturday' },
  { abbr: 'א׳', full: 'יום ראשון (Yom Rishon)', en: 'Sunday' },
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
  portuguese: [
    ['Que dia é hoje?', 'What day is today?'],
    ['Hoje é segunda-feira.', 'Today is Monday.'],
    ['Qual é a data?', 'What is the date?'],
    ['Hoje é dia 15 de março.', 'Today is March 15th.'],
    ['o fim de semana', 'the weekend'],
    ['durante a semana', 'on weekdays'],
  ],
  german: [
    ['Welcher Tag ist heute?', 'What day is today?'],
    ['Heute ist Montag.', 'Today is Monday.'],
    ['Welches Datum haben wir?', 'What is the date?'],
    ['Heute ist der 15. März.', 'Today is March 15th.'],
    ['das Wochenende', 'the weekend'],
    ['unter der Woche / werktags', 'on weekdays'],
  ],
  italian: [
    ['Che giorno è oggi?', 'What day is today?'],
    ['Oggi è lunedì.', 'Today is Monday.'],
    ['Qual è la data?', 'What is the date?'],
    ['Oggi è il 15 marzo.', 'Today is March 15th.'],
    ['il fine settimana', 'the weekend'],
    ['durante la settimana / nei giorni feriali', 'on weekdays'],
  ],
  japanese: [
    ['今日は何曜日ですか？', 'What day is today?'],
    ['今日は月曜日です。', 'Today is Monday.'],
    ['今日は何日ですか？', 'What is the date?'],
    ['今日は三月十五日です。', 'Today is March 15th.'],
    ['週末 (しゅうまつ)', 'the weekend'],
    ['平日 (へいじつ)', 'on weekdays'],
  ],
  korean: [
    ['오늘은 무슨 요일이에요?', 'What day is today?'],
    ['오늘은 월요일이에요.', 'Today is Monday.'],
    ['오늘 날짜가 어떻게 돼요?', 'What is the date?'],
    ['오늘은 3월 15일이에요.', 'Today is March 15th.'],
    ['주말 — Jumal', 'the weekend'],
    ['평일 — Pyeongil', 'on weekdays'],
  ],
  mandarin: [
    ['今天是星期几？', 'What day is today?'],
    ['今天是星期一。', 'Today is Monday.'],
    ['今天是几号？', 'What is the date?'],
    ['今天是三月十五号。', 'Today is March 15th.'],
    ['周末 (zhōumò)', 'the weekend'],
    ['工作日 (gōngzuòrì)', 'on weekdays'],
  ],
  hebrew: [
    ['איזה יום זה היום?', 'What day is today?'],
    ['היום יום שני.', 'Today is Monday.'],
    ['מה התאריך היום?', 'What is the date?'],
    ['היום ה-15 במרץ.', 'Today is March 15th.'],
    ['סוף שבוע (sof shavua)', 'the weekend'],
    ['ימי חול (yamei khol)', 'on weekdays'],
  ],
};

export function DaysOfWeekCard({ language = 'spanish' }: { language?: LangCode }) {
  const days = language === 'french' ? DAYS_FR : language === 'portuguese' ? DAYS_PT : language === 'german' ? DAYS_DE : language === 'italian' ? DAYS_IT : language === 'japanese' ? DAYS_JA : language === 'korean' ? DAYS_KO : language === 'mandarin' ? DAYS_ZH : language === 'hebrew' ? DAYS_HE : DAYS_ES;
  const months = language === 'french' ? MONTHS_FR : language === 'portuguese' ? MONTHS_PT : language === 'german' ? MONTHS_DE : language === 'italian' ? MONTHS_IT : language === 'japanese' ? MONTHS_JA : language === 'korean' ? MONTHS_KO : language === 'mandarin' ? MONTHS_ZH : language === 'hebrew' ? MONTHS_HE : MONTHS_ES;
  const exprs = DATE_EXPRESSIONS[language] ?? DATE_EXPRESSIONS.spanish;
  const calMonthLabel = language === 'french' ? 'mars' : language === 'portuguese' ? 'março' : language === 'german' ? 'März' : language === 'italian' ? 'marzo' : language === 'japanese' ? '三月' : language === 'korean' ? '3월' : language === 'mandarin' ? '三月' : 'marzo';
  const calNote = language === 'french'
    ? 'Note: Weeks start on Monday (lundi) in France and most Francophone countries.'
    : language === 'portuguese'
    ? 'Note: Weeks start on Monday (segunda-feira) in Portugal and Brazil.'
    : language === 'german'
    ? 'Note: Weeks start on Monday (Montag) in Germany, Austria, and Switzerland.'
    : language === 'italian'
    ? 'Note: Weeks start on Monday (lunedì) in Italy and most Italian-speaking regions.'
    : language === 'japanese'
    ? 'Note: Weeks start on Monday (月曜日) in Japan. Sunday (日曜日) ends the week.'
    : language === 'korean'
    ? 'Note: Weeks start on Monday (월요일) in Korea. Sunday (일요일) is the last day.'
    : language === 'mandarin'
    ? 'Note: Weeks start on Monday (星期一) in mainland China and Taiwan. Sunday (星期日/天) ends the week.'
    : language === 'hebrew'
    ? 'Note: Weeks start on Sunday (יום ראשון, Yom Rishon) in Israel. Saturday (שבת, Shabbat) is the day of rest.'
    : 'Note: Weeks start on Monday (lunes) in most Spanish-speaking countries.';
  const daysHeading = language === 'french' ? 'Les Jours de la Semaine — Days of the Week' : language === 'portuguese' ? 'Os Dias da Semana — Days of the Week' : language === 'german' ? 'Die Wochentage — Days of the Week' : language === 'italian' ? 'I Giorni della Settimana — Days of the Week' : language === 'japanese' ? '曜日 — Days of the Week' : language === 'korean' ? '요일 — Days of the Week' : language === 'mandarin' ? 'Days of the Week' : language === 'hebrew' ? 'ימות השבוע — Days of the Week' : 'Los Días de la Semana — Days of the Week';
  const monthsHeading = language === 'french' ? 'Les Mois de l\'Année — Months of the Year' : language === 'portuguese' ? 'Os Meses do Ano — Months of the Year' : language === 'german' ? 'Die Monate des Jahres — Months of the Year' : language === 'italian' ? 'I Mesi dell\'Anno — Months of the Year' : language === 'japanese' ? '月 — Months of the Year' : language === 'korean' ? '월 — Months of the Year' : language === 'mandarin' ? 'Months of the Year' : language === 'hebrew' ? 'חודשי השנה — Months of the Year' : 'Los Meses del Año — Months of the Year';
  const calLabel = language === 'french' ? 'Calendrier — Calendar' : language === 'portuguese' ? 'Calendário — Calendar' : language === 'german' ? 'Kalender — Calendar' : language === 'italian' ? 'Calendario — Calendar' : language === 'japanese' ? 'カレンダー — Calendar' : language === 'korean' ? '달력 — Calendar' : language === 'mandarin' ? 'Calendar' : language === 'hebrew' ? 'לוח שנה — Calendar' : 'Calendario — Calendar';

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

const BODY_VOCAB_PT: BodyEntry[] = [
  { key: 'head',      label: 'a cabeça',         english: 'head' },
  { key: 'hair',      label: 'o cabelo',          english: 'hair' },
  { key: 'face',      label: 'o rosto / a cara',  english: 'face' },
  { key: 'eyes',      label: 'os olhos',          english: 'eyes' },
  { key: 'nose',      label: 'o nariz',           english: 'nose' },
  { key: 'mouth',     label: 'a boca',            english: 'mouth' },
  { key: 'ear',       label: 'a orelha',          english: 'ear' },
  { key: 'neck',      label: 'o pescoço',         english: 'neck' },
  { key: 'shoulders', label: 'os ombros',         english: 'shoulders' },
  { key: 'chest',     label: 'o peito',           english: 'chest' },
  { key: 'back',      label: 'as costas',         english: 'back' },
  { key: 'arms',      label: 'os braços',         english: 'arms' },
  { key: 'elbow',     label: 'o cotovelo',        english: 'elbow' },
  { key: 'hands',     label: 'as mãos',           english: 'hands' },
  { key: 'abdomen',   label: 'o abdômen / barriga', english: 'stomach / abdomen' },
  { key: 'hips',      label: 'o quadril / as ancas', english: 'hips' },
  { key: 'legs',      label: 'as pernas',         english: 'legs' },
  { key: 'knee',      label: 'o joelho',          english: 'knee' },
  { key: 'feet',      label: 'os pés',            english: 'feet' },
];

const BODY_VOCAB_DE: BodyEntry[] = [
  { key: 'head',      label: 'der Kopf',                 english: 'head' },
  { key: 'hair',      label: 'die Haare',                english: 'hair' },
  { key: 'face',      label: 'das Gesicht',              english: 'face' },
  { key: 'eyes',      label: 'die Augen',                english: 'eyes' },
  { key: 'nose',      label: 'die Nase',                 english: 'nose' },
  { key: 'mouth',     label: 'der Mund',                 english: 'mouth' },
  { key: 'ear',       label: 'das Ohr',                  english: 'ear' },
  { key: 'neck',      label: 'der Hals / der Nacken',   english: 'neck' },
  { key: 'shoulders', label: 'die Schultern',            english: 'shoulders' },
  { key: 'chest',     label: 'die Brust',                english: 'chest' },
  { key: 'back',      label: 'der Rücken',               english: 'back' },
  { key: 'arms',      label: 'die Arme',                 english: 'arms' },
  { key: 'elbow',     label: 'der Ellenbogen',           english: 'elbow' },
  { key: 'hands',     label: 'die Hände',                english: 'hands' },
  { key: 'abdomen',   label: 'der Bauch / der Magen',   english: 'stomach / abdomen' },
  { key: 'hips',      label: 'die Hüften',               english: 'hips' },
  { key: 'legs',      label: 'die Beine',                english: 'legs' },
  { key: 'knee',      label: 'das Knie',                 english: 'knee' },
  { key: 'feet',      label: 'die Füße',                 english: 'feet' },
];

const BODY_VOCAB_IT: BodyEntry[] = [
  { key: 'head',      label: 'la testa',               english: 'head' },
  { key: 'hair',      label: 'i capelli',              english: 'hair' },
  { key: 'face',      label: 'il viso / la faccia',    english: 'face' },
  { key: 'eyes',      label: 'gli occhi',              english: 'eyes' },
  { key: 'nose',      label: 'il naso',                english: 'nose' },
  { key: 'mouth',     label: 'la bocca',               english: 'mouth' },
  { key: 'ear',       label: 'l\'orecchio',            english: 'ear' },
  { key: 'neck',      label: 'il collo',               english: 'neck' },
  { key: 'shoulders', label: 'le spalle',              english: 'shoulders' },
  { key: 'chest',     label: 'il petto',               english: 'chest' },
  { key: 'back',      label: 'la schiena',             english: 'back' },
  { key: 'arms',      label: 'le braccia',             english: 'arms' },
  { key: 'elbow',     label: 'il gomito',              english: 'elbow' },
  { key: 'hands',     label: 'le mani',                english: 'hands' },
  { key: 'abdomen',   label: 'l\'addome / la pancia',  english: 'stomach / abdomen' },
  { key: 'hips',      label: 'i fianchi',              english: 'hips' },
  { key: 'legs',      label: 'le gambe',               english: 'legs' },
  { key: 'knee',      label: 'il ginocchio',           english: 'knee' },
  { key: 'feet',      label: 'i piedi',                english: 'feet' },
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
  portuguese: [
    ['Minha cabeça está doendo.', 'My head hurts.'],
    ['Meus pés estão doendo.', 'My feet hurt.'],
    ['Aponte para o seu nariz.', 'Point to your nose.'],
    ['Que parte do corpo é essa?', 'What body part is it?'],
    ['Estou com dor nas costas.', 'I have back pain.'],
    ['Levante o braço direito.', 'Raise your right arm.'],
  ],
  german: [
    ['Mir tut der Kopf weh.', 'My head hurts.'],
    ['Mir tun die Füße weh.', 'My feet hurt.'],
    ['Zeig auf deine Nase.', 'Point to your nose.'],
    ['Was ist das für ein Körperteil?', 'What body part is it?'],
    ['Ich habe Rückenschmerzen.', 'I have back pain.'],
    ['Hebe deinen rechten Arm.', 'Raise your right arm.'],
  ],
  italian: [
    ['Mi fa male la testa.', 'My head hurts.'],
    ['Mi fanno male i piedi.', 'My feet hurt.'],
    ['Indica il tuo naso.', 'Point to your nose.'],
    ['Che parte del corpo è?', 'What body part is it?'],
    ['Ho mal di schiena.', 'I have back pain.'],
    ['Alza il braccio destro.', 'Raise your right arm.'],
  ],
  japanese: [
    ['頭が痛いです。', 'My head hurts.'],
    ['足が痛いです。', 'My feet hurt.'],
    ['鼻を指してください。', 'Point to your nose.'],
    ['体のどの部分ですか？', 'What body part is it?'],
    ['腰が痛いです。', 'I have back pain.'],
    ['右腕を上げてください。', 'Raise your right arm.'],
  ],
  korean: [
    ['머리가 아파요.', 'My head hurts.'],
    ['발이 아파요.', 'My feet hurt.'],
    ['코를 가리켜 보세요.', 'Point to your nose.'],
    ['신체의 어느 부분이에요?', 'What body part is it?'],
    ['허리가 아파요.', 'I have back pain.'],
    ['오른팔을 올려보세요.', 'Raise your right arm.'],
  ],
  mandarin: [
    ['我头疼。', 'My head hurts.'],
    ['我脚疼。', 'My feet hurt.'],
    ['指一下你的鼻子。', 'Point to your nose.'],
    ['这是身体的哪个部位？', 'What body part is it?'],
    ['我背疼。', 'I have back pain.'],
    ['举起你的右臂。', 'Raise your right arm.'],
  ],
};

const BODY_VOCAB_JA: BodyEntry[] = [
  { key: 'head',      label: '頭 (あたま) — Atama',                      english: 'head' },
  { key: 'hair',      label: '髪 (かみ) — Kami',                          english: 'hair' },
  { key: 'face',      label: '顔 (かお) — Kao',                           english: 'face' },
  { key: 'eyes',      label: '目 (め) — Me',                              english: 'eyes' },
  { key: 'nose',      label: '鼻 (はな) — Hana',                          english: 'nose' },
  { key: 'mouth',     label: '口 (くち) — Kuchi',                         english: 'mouth' },
  { key: 'ear',       label: '耳 (みみ) — Mimi',                           english: 'ear' },
  { key: 'neck',      label: '首 (くび) — Kubi',                           english: 'neck' },
  { key: 'shoulders', label: '肩 (かた) — Kata',                          english: 'shoulders' },
  { key: 'chest',     label: '胸 (むね) — Mune',                          english: 'chest' },
  { key: 'back',      label: '背中 (せなか) — Senaka',                    english: 'back' },
  { key: 'arms',      label: '腕 (うで) — Ude',                           english: 'arms' },
  { key: 'elbow',     label: 'ひじ (肘) — Hiji',                          english: 'elbow' },
  { key: 'hands',     label: '手 (て) — Te',                              english: 'hands' },
  { key: 'abdomen',   label: 'お腹 (おなか) — Onaka',                     english: 'stomach / abdomen' },
  { key: 'hips',      label: '腰 (こし) — Koshi',                         english: 'hips' },
  { key: 'legs',      label: '足 / 脚 (あし) — Ashi',                     english: 'legs' },
  { key: 'knee',      label: 'ひざ (膝) — Hiza',                          english: 'knee' },
  { key: 'feet',      label: '足 (あし) / 足の裏 — Ashi',                  english: 'feet' },
];

const BODY_VOCAB_KO: BodyEntry[] = [
  { key: 'head',      label: '머리 — Meori',                    english: 'head' },
  { key: 'hair',      label: '머리카락 — Meorikarak',            english: 'hair' },
  { key: 'face',      label: '얼굴 — Eolgul',                   english: 'face' },
  { key: 'eyes',      label: '눈 — Nun',                        english: 'eyes' },
  { key: 'nose',      label: '코 — Ko',                         english: 'nose' },
  { key: 'mouth',     label: '입 — Ip',                         english: 'mouth' },
  { key: 'ear',       label: '귀 — Gwi',                        english: 'ear' },
  { key: 'neck',      label: '목 — Mok',                        english: 'neck' },
  { key: 'shoulders', label: '어깨 — Eokkae',                   english: 'shoulders' },
  { key: 'chest',     label: '가슴 — Gaseum',                   english: 'chest' },
  { key: 'back',      label: '등 — Deung',                      english: 'back' },
  { key: 'arms',      label: '팔 — Pal',                        english: 'arms' },
  { key: 'elbow',     label: '팔꿈치 — Palkumchi',               english: 'elbow' },
  { key: 'hands',     label: '손 — Son',                        english: 'hands' },
  { key: 'abdomen',   label: '배 / 복부 — Bae / Bokbu',         english: 'stomach / abdomen' },
  { key: 'hips',      label: '엉덩이 — Eongdeongi',              english: 'hips' },
  { key: 'legs',      label: '다리 — Dari',                     english: 'legs' },
  { key: 'knee',      label: '무릎 — Mureup',                   english: 'knee' },
  { key: 'feet',      label: '발 — Bal',                        english: 'feet' },
];

const BODY_VOCAB_ZH: BodyEntry[] = [
  { key: 'head',      label: '头 (tóu) — Tóu',                  english: 'head' },
  { key: 'hair',      label: '头发 (tóufa) — Tóufa',             english: 'hair' },
  { key: 'face',      label: '脸 (liǎn) — Liǎn',                english: 'face' },
  { key: 'eyes',      label: '眼睛 (yǎnjing) — Yǎnjing',         english: 'eyes' },
  { key: 'nose',      label: '鼻子 (bízi) — Bízi',               english: 'nose' },
  { key: 'mouth',     label: '嘴 (zuǐ) — Zuǐ',                  english: 'mouth' },
  { key: 'ear',       label: '耳朵 (ěrduo) — Ěrduo',             english: 'ear' },
  { key: 'neck',      label: '脖子 (bózi) — Bózi',               english: 'neck' },
  { key: 'shoulders', label: '肩膀 (jiānbǎng) — Jiānbǎng',       english: 'shoulders' },
  { key: 'chest',     label: '胸 (xiōng) — Xiōng',               english: 'chest' },
  { key: 'back',      label: '背 (bèi) — Bèi',                   english: 'back' },
  { key: 'arms',      label: '手臂 (shǒubì) — Shǒubì',           english: 'arms' },
  { key: 'elbow',     label: '手肘 (shǒuzhǒu) — Shǒuzhǒu',       english: 'elbow' },
  { key: 'hands',     label: '手 (shǒu) — Shǒu',                 english: 'hands' },
  { key: 'abdomen',   label: '肚子 (dùzi) — Dùzi',               english: 'stomach / abdomen' },
  { key: 'hips',      label: '臀部 (túnbù) — Túnbù',             english: 'hips' },
  { key: 'legs',      label: '腿 (tuǐ) — Tuǐ',                   english: 'legs' },
  { key: 'knee',      label: '膝盖 (xīgài) — Xīgài',             english: 'knee' },
  { key: 'feet',      label: '脚 (jiǎo) — Jiǎo',                 english: 'feet' },
];

const BODY_VOCAB_HE: BodyEntry[] = [
  { part: 'head',         label: 'ראש (rosh)',                    english: 'head' },
  { part: 'hair',         label: "שער (se'ar)",                  english: 'hair' },
  { part: 'shoulder',     label: 'כתף (katef)',                   english: 'shoulder' },
  { part: 'arm',          label: "זרוע (zero'a)",           english: 'arm' },
  { part: 'elbow',        label: 'מרפק (marpek)',            english: 'elbow' },
  { part: 'hand',         label: 'יד (yad)',                           english: 'hand' },
  { part: 'chest',        label: 'חזה (khaze)',                   english: 'chest' },
  { part: 'stomach',      label: 'בטן (beten)',                   english: 'stomach' },
  { part: 'back',         label: 'גב (gav)',                           english: 'back' },
  { part: 'leg',          label: 'רגל (regel)',                   english: 'leg/foot' },
  { part: 'knee',         label: 'ברך (berekh)',                  english: 'knee' },
  { part: 'foot',         label: 'כף רגל (kaf regel)', english: 'foot (sole)' },
];

export function BodyPartsCard({ language = 'spanish' }: { language?: LangCode }) {
  const vocab = language === 'french' ? BODY_VOCAB_FR : language === 'portuguese' ? BODY_VOCAB_PT : language === 'german' ? BODY_VOCAB_DE : language === 'italian' ? BODY_VOCAB_IT : language === 'japanese' ? BODY_VOCAB_JA : language === 'korean' ? BODY_VOCAB_KO : language === 'mandarin' ? BODY_VOCAB_ZH : language === 'hebrew' ? BODY_VOCAB_HE : BODY_VOCAB_ES;
  const phrases = BODY_PHRASES[language] ?? BODY_PHRASES.spanish;
  const diagLabels = language === 'french'
    ? { head: 'la tête', shoulders: 'les épaules', chest: 'la poitrine', arms: 'les bras', abdomen: 'le ventre', legs: 'les jambes' }
    : language === 'portuguese'
    ? { head: 'a cabeça', shoulders: 'os ombros', chest: 'o peito', arms: 'os braços', abdomen: 'o abdômen', legs: 'as pernas' }
    : language === 'german'
    ? { head: 'der Kopf', shoulders: 'die Schultern', chest: 'die Brust', arms: 'die Arme', abdomen: 'der Bauch', legs: 'die Beine' }
    : language === 'italian'
    ? { head: 'la testa', shoulders: 'le spalle', chest: 'il petto', arms: 'le braccia', abdomen: 'la pancia', legs: 'le gambe' }
    : language === 'japanese'
    ? { head: '頭', shoulders: '肩', chest: '胸', arms: '腕', abdomen: 'お腹', legs: '足' }
    : language === 'korean'
    ? { head: '머리', shoulders: '어깨', chest: '가슴', arms: '팔', abdomen: '배', legs: '다리' }
    : language === 'mandarin'
    ? { head: '头', shoulders: '肩膀', chest: '胸', arms: '手臂', abdomen: '肚子', legs: '腿' }
    : { head: 'la cabeza', shoulders: 'los hombros', chest: 'el pecho', arms: 'los brazos', abdomen: 'el abdomen', legs: 'las piernas' };
  const sectionTitle = language === 'french' ? 'Le Corps Humain' : language === 'portuguese' ? 'O Corpo Humano' : language === 'german' ? 'Der menschliche Körper' : language === 'italian' ? 'Il Corpo Umano' : language === 'japanese' ? '体 — Human Body' : language === 'korean' ? '몸 — Human Body' : language === 'mandarin' ? 'Human Body' : language === 'hebrew' ? 'גוף האדם — Human Body' : 'El Cuerpo Humano';
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

const FACE_VOCAB_PT: BodyEntry[] = [
  { key: 'hair',      label: 'o cabelo',              english: 'hair' },
  { key: 'forehead',  label: 'a testa / a fronte',    english: 'forehead' },
  { key: 'eyebrows',  label: 'as sobrancelhas',        english: 'eyebrows' },
  { key: 'eyes',      label: 'os olhos',              english: 'eyes' },
  { key: 'eyelashes', label: 'os cílios',             english: 'eyelashes' },
  { key: 'nose',      label: 'o nariz',               english: 'nose' },
  { key: 'cheeks',    label: 'as bochechas',           english: 'cheeks' },
  { key: 'ears',      label: 'as orelhas',            english: 'ears' },
  { key: 'lips',      label: 'os lábios',             english: 'lips' },
  { key: 'teeth',     label: 'os dentes',             english: 'teeth' },
  { key: 'tongue',    label: 'a língua',              english: 'tongue' },
  { key: 'chin',      label: 'o queixo / o mento',    english: 'chin' },
  { key: 'jaw',       label: 'a mandíbula',           english: 'jaw' },
  { key: 'face',      label: 'o rosto / a face',      english: 'face' },
];

const FACE_VOCAB_DE: BodyEntry[] = [
  { key: 'hair',      label: 'die Haare',              english: 'hair' },
  { key: 'forehead',  label: 'die Stirn',              english: 'forehead' },
  { key: 'eyebrows',  label: 'die Augenbrauen',        english: 'eyebrows' },
  { key: 'eyes',      label: 'die Augen',              english: 'eyes' },
  { key: 'eyelashes', label: 'die Wimpern',            english: 'eyelashes' },
  { key: 'nose',      label: 'die Nase',               english: 'nose' },
  { key: 'cheeks',    label: 'die Wangen',             english: 'cheeks' },
  { key: 'ears',      label: 'die Ohren',              english: 'ears' },
  { key: 'lips',      label: 'die Lippen',             english: 'lips' },
  { key: 'teeth',     label: 'die Zähne',              english: 'teeth' },
  { key: 'tongue',    label: 'die Zunge',              english: 'tongue' },
  { key: 'chin',      label: 'das Kinn',               english: 'chin' },
  { key: 'jaw',       label: 'der Kiefer',             english: 'jaw' },
  { key: 'face',      label: 'das Gesicht',            english: 'face' },
];

const FACE_VOCAB_IT: BodyEntry[] = [
  { key: 'hair',      label: 'i capelli',              english: 'hair' },
  { key: 'forehead',  label: 'la fronte',              english: 'forehead' },
  { key: 'eyebrows',  label: 'le sopracciglia',        english: 'eyebrows' },
  { key: 'eyes',      label: 'gli occhi',              english: 'eyes' },
  { key: 'eyelashes', label: 'le ciglia',              english: 'eyelashes' },
  { key: 'nose',      label: 'il naso',                english: 'nose' },
  { key: 'cheeks',    label: 'le guance',              english: 'cheeks' },
  { key: 'ears',      label: 'le orecchie',            english: 'ears' },
  { key: 'lips',      label: 'le labbra',              english: 'lips' },
  { key: 'teeth',     label: 'i denti',                english: 'teeth' },
  { key: 'tongue',    label: 'la lingua',              english: 'tongue' },
  { key: 'chin',      label: 'il mento',               english: 'chin' },
  { key: 'jaw',       label: 'la mascella',            english: 'jaw' },
  { key: 'face',      label: 'il viso / la faccia',    english: 'face' },
];

const FACE_VOCAB_JA: BodyEntry[] = [
  { key: 'hair',      label: '髪 (かみ) — Kami',                    english: 'hair' },
  { key: 'forehead',  label: 'おでこ / 額 (ひたい) — Hitai',         english: 'forehead' },
  { key: 'eyebrows',  label: '眉毛 (まゆげ) — Mayuge',              english: 'eyebrows' },
  { key: 'eyes',      label: '目 (め) — Me',                        english: 'eyes' },
  { key: 'eyelashes', label: 'まつ毛 (まつげ) — Matsuge',           english: 'eyelashes' },
  { key: 'nose',      label: '鼻 (はな) — Hana',                    english: 'nose' },
  { key: 'cheeks',    label: '頬 (ほお/ほほ) — Hoo',                english: 'cheeks' },
  { key: 'ears',      label: '耳 (みみ) — Mimi',                     english: 'ears' },
  { key: 'lips',      label: '唇 (くちびる) — Kuchibiru',            english: 'lips' },
  { key: 'teeth',     label: '歯 (は) — Ha',                         english: 'teeth' },
  { key: 'tongue',    label: '舌 (した) — Shita',                    english: 'tongue' },
  { key: 'chin',      label: 'あご (顎) — Ago',                     english: 'chin' },
  { key: 'jaw',       label: '下あご (したあご) — Shita-ago',        english: 'jaw' },
  { key: 'face',      label: '顔 (かお) — Kao',                      english: 'face' },
];

const FACE_VOCAB_KO: BodyEntry[] = [
  { key: 'hair',      label: '머리카락 — Meorikarak',            english: 'hair' },
  { key: 'forehead',  label: '이마 — Ima',                       english: 'forehead' },
  { key: 'eyebrows',  label: '눈썹 — Nunssseop',                 english: 'eyebrows' },
  { key: 'eyes',      label: '눈 — Nun',                         english: 'eyes' },
  { key: 'eyelashes', label: '속눈썹 — Songnunssseop',           english: 'eyelashes' },
  { key: 'nose',      label: '코 — Ko',                          english: 'nose' },
  { key: 'cheeks',    label: '볼 / 뺨 — Bol / Ppyam',            english: 'cheeks' },
  { key: 'ears',      label: '귀 — Gwi',                         english: 'ears' },
  { key: 'lips',      label: '입술 — Ipsul',                     english: 'lips' },
  { key: 'teeth',     label: '이 / 치아 — I / Chia',             english: 'teeth' },
  { key: 'tongue',    label: '혀 — Hyeo',                        english: 'tongue' },
  { key: 'chin',      label: '턱 — Teok',                        english: 'chin' },
  { key: 'jaw',       label: '아래턱 — Araetech',                english: 'jaw' },
  { key: 'face',      label: '얼굴 — Eolgul',                    english: 'face' },
];

const FACE_VOCAB_ZH: BodyEntry[] = [
  { key: 'hair',      label: '头发 (tóufa) — Tóufa',             english: 'hair' },
  { key: 'forehead',  label: '额头 (étóu) — Étóu',               english: 'forehead' },
  { key: 'eyebrows',  label: '眉毛 (méimao) — Méimao',           english: 'eyebrows' },
  { key: 'eyes',      label: '眼睛 (yǎnjing) — Yǎnjing',         english: 'eyes' },
  { key: 'eyelashes', label: '睫毛 (jiémao) — Jiémao',           english: 'eyelashes' },
  { key: 'nose',      label: '鼻子 (bízi) — Bízi',               english: 'nose' },
  { key: 'cheeks',    label: '脸颊 (liǎnjiá) — Liǎnjiá',         english: 'cheeks' },
  { key: 'ears',      label: '耳朵 (ěrduo) — Ěrduo',             english: 'ears' },
  { key: 'lips',      label: '嘴唇 (zuǐchún) — Zuǐchún',         english: 'lips' },
  { key: 'teeth',     label: '牙齿 (yáchǐ) — Yáchǐ',             english: 'teeth' },
  { key: 'tongue',    label: '舌头 (shétou) — Shétou',           english: 'tongue' },
  { key: 'chin',      label: '下巴 (xiàba) — Xiàba',             english: 'chin' },
  { key: 'jaw',       label: '下颌 (xiàhé) — Xiàhé',             english: 'jaw' },
  { key: 'face',      label: '脸 (liǎn) — Liǎn',                 english: 'face' },
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
  portuguese: [
    ['Ela/Ele tem olhos azuis.', 'She/He has blue eyes.'],
    ['Ela/Ele tem cabelo cacheado.', 'She/He has curly hair.'],
    ['Ela/Ele tem um nariz pequeno.', 'She/He has a small nose.'],
    ['Ela/Ele tem o rosto redondo.', 'She/He has a round face.'],
    ['De que cor são os olhos dela/dele?', 'What color are her/his eyes?'],
    ['Ela/Ele tem sobrancelhas escuras.', 'She/He has dark eyebrows.'],
  ],
  german: [
    ['Er/Sie hat blaue Augen.', 'She/He has blue eyes.'],
    ['Er/Sie hat lockiges Haar.', 'She/He has curly hair.'],
    ['Er/Sie hat eine kleine Nase.', 'She/He has a small nose.'],
    ['Er/Sie hat ein rundes Gesicht.', 'She/He has a round face.'],
    ['Welche Farbe haben seine/ihre Augen?', 'What color are her/his eyes?'],
    ['Er/Sie hat dunkle Augenbrauen.', 'She/He has dark eyebrows.'],
  ],
  italian: [
    ['Ha gli occhi azzurri.', 'She/He has blue eyes.'],
    ['Ha i capelli ricci.', 'She/He has curly hair.'],
    ['Ha un naso piccolo.', 'She/He has a small nose.'],
    ['Ha il viso tondo.', 'She/He has a round face.'],
    ['Di che colore sono i suoi occhi?', 'What color are her/his eyes?'],
    ['Ha le sopracciglia scure.', 'She/He has dark eyebrows.'],
  ],
  japanese: [
    ['目が青いです。', 'She/He has blue eyes.'],
    ['髪が巻き毛です。', 'She/He has curly hair.'],
    ['鼻が小さいです。', 'She/He has a small nose.'],
    ['顔が丸いです。', 'She/He has a round face.'],
    ['目の色は何色ですか？', 'What color are her/his eyes?'],
    ['眉毛が濃いです。', 'She/He has dark eyebrows.'],
  ],
  korean: [
    ['눈이 파래요.', 'She/He has blue eyes.'],
    ['머리카락이 곱슬거려요.', 'She/He has curly hair.'],
    ['코가 작아요.', 'She/He has a small nose.'],
    ['얼굴이 둥글어요.', 'She/He has a round face.'],
    ['눈 색깔이 뭐예요?', 'What color are her/his eyes?'],
    ['눈썹이 짙어요.', 'She/He has dark eyebrows.'],
  ],
  mandarin: [
    ['他/她的眼睛是蓝色的。', 'She/He has blue eyes.'],
    ['他/她的头发是卷发。', 'She/He has curly hair.'],
    ['他/她的鼻子很小。', 'She/He has a small nose.'],
    ['他/她的脸是圆的。', 'She/He has a round face.'],
    ['他/她的眼睛是什么颜色的？', 'What color are her/his eyes?'],
    ['他/她的眉毛很深。', 'She/He has dark eyebrows.'],
  ],
};

export function FacePartsCard({ language = 'spanish' }: { language?: LangCode }) {
  
const FACE_VOCAB_HE: BodyEntry[] = [
  { part: 'forehead',  label: 'מצח (metsakh)',               english: 'forehead' },
  { part: 'eye',       label: "עין ('ayin)",                 english: 'eye' },
  { part: 'eyebrow',   label: 'גבה (gaba)',                   english: 'eyebrow' },
  { part: 'nose',      label: 'אף (af)',                           english: 'nose' },
  { part: 'cheek',     label: 'לחי (lekhi)',                  english: 'cheek' },
  { part: 'ear',       label: "אוזן ('ozen)",           english: 'ear' },
  { part: 'mouth',     label: 'פה (peh)',                          english: 'mouth' },
  { part: 'lip',       label: 'שפה (safa)',                   english: 'lip' },
  { part: 'tooth',     label: 'שן (shen)',                         english: 'tooth' },
  { part: 'chin',      label: 'סנטר (santar)',           english: 'chin' },
  { part: 'tongue',    label: 'לשון (lashon)',           english: 'tongue' },
  { part: 'neck',      label: 'צוואר (tsavar)',     english: 'neck' },
];

  const vocab = language === 'french' ? FACE_VOCAB_FR : language === 'portuguese' ? FACE_VOCAB_PT : language === 'german' ? FACE_VOCAB_DE : language === 'italian' ? FACE_VOCAB_IT : language === 'japanese' ? FACE_VOCAB_JA : language === 'korean' ? FACE_VOCAB_KO : language === 'mandarin' ? FACE_VOCAB_ZH : language === 'hebrew' ? FACE_VOCAB_HE : FACE_VOCAB_ES;
  const descriptions = FACE_DESCRIPTIONS[language] ?? FACE_DESCRIPTIONS.spanish;
  const diagLabels = language === 'french'
    ? { eyes: 'les yeux', nose: 'le nez', mouth: 'la bouche', ears: 'les oreilles', eyebrows: 'les sourcils', cheeks: 'les joues' }
    : language === 'portuguese'
    ? { eyes: 'os olhos', nose: 'o nariz', mouth: 'a boca', ears: 'as orelhas', eyebrows: 'as sobrancelhas', cheeks: 'as bochechas' }
    : language === 'german'
    ? { eyes: 'die Augen', nose: 'die Nase', mouth: 'der Mund', ears: 'die Ohren', eyebrows: 'die Augenbrauen', cheeks: 'die Wangen' }
    : language === 'italian'
    ? { eyes: 'gli occhi', nose: 'il naso', mouth: 'la bocca', ears: 'le orecchie', eyebrows: 'le sopracciglia', cheeks: 'le guance' }
    : language === 'japanese'
    ? { eyes: '目', nose: '鼻', mouth: '口', ears: '耳', eyebrows: '眉毛', cheeks: '頬' }
    : language === 'korean'
    ? { eyes: '눈', nose: '코', mouth: '입', ears: '귀', eyebrows: '눈썹', cheeks: '볼' }
    : language === 'mandarin'
    ? { eyes: '眼睛', nose: '鼻子', mouth: '嘴', ears: '耳朵', eyebrows: '眉毛', cheeks: '脸颊' }
    : { eyes: 'los ojos', nose: 'la nariz', mouth: 'la boca', ears: 'las orejas', eyebrows: 'las cejas', cheeks: 'las mejillas' };
  const sectionTitle = language === 'french' ? 'Le Visage — The Face' : language === 'portuguese' ? 'O Rosto — The Face' : language === 'german' ? 'Das Gesicht — The Face' : language === 'italian' ? 'Il Viso — The Face' : language === 'japanese' ? '顔 — The Face' : language === 'korean' ? '얼굴 — The Face' : language === 'mandarin' ? 'The Face' : language === 'hebrew' ? 'הפנים — The Face' : 'La Cara — The Face';
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

const HAND_VOCAB_PT: BodyEntry[] = [
  { key: 'thumb',         label: 'o polegar',                    english: 'thumb' },
  { key: 'index_finger',  label: 'o dedo indicador',             english: 'index finger' },
  { key: 'middle_finger', label: 'o dedo médio',                 english: 'middle finger' },
  { key: 'ring_finger',   label: 'o dedo anelar',                english: 'ring finger' },
  { key: 'pinky',         label: 'o dedo mínimo / mindinho',     english: 'pinky / little finger' },
  { key: 'fingers',       label: 'os dedos',                     english: 'fingers' },
  { key: 'knuckles',      label: 'as juntas dos dedos',          english: 'knuckles' },
  { key: 'palm',          label: 'a palma da mão',               english: 'palm' },
  { key: 'wrist',         label: 'o pulso',                      english: 'wrist' },
  { key: 'fingernails',   label: 'as unhas',                     english: 'fingernails' },
];

const HAND_VOCAB_DE: BodyEntry[] = [
  { key: 'thumb',         label: 'der Daumen',                   english: 'thumb' },
  { key: 'index_finger',  label: 'der Zeigefinger',              english: 'index finger' },
  { key: 'middle_finger', label: 'der Mittelfinger',             english: 'middle finger' },
  { key: 'ring_finger',   label: 'der Ringfinger',               english: 'ring finger' },
  { key: 'pinky',         label: 'der kleine Finger',            english: 'pinky / little finger' },
  { key: 'fingers',       label: 'die Finger',                   english: 'fingers' },
  { key: 'knuckles',      label: 'die Knöchel',                  english: 'knuckles' },
  { key: 'palm',          label: 'die Handfläche',               english: 'palm' },
  { key: 'wrist',         label: 'das Handgelenk',               english: 'wrist' },
  { key: 'fingernails',   label: 'die Fingernägel',              english: 'fingernails' },
];

const HAND_VOCAB_IT: BodyEntry[] = [
  { key: 'thumb',         label: 'il pollice',                   english: 'thumb' },
  { key: 'index_finger',  label: 'il dito indice',               english: 'index finger' },
  { key: 'middle_finger', label: 'il dito medio',                english: 'middle finger' },
  { key: 'ring_finger',   label: 'il dito anulare',              english: 'ring finger' },
  { key: 'pinky',         label: 'il mignolo',                   english: 'pinky / little finger' },
  { key: 'fingers',       label: 'le dita',                      english: 'fingers' },
  { key: 'knuckles',      label: 'le nocche',                    english: 'knuckles' },
  { key: 'palm',          label: 'il palmo',                     english: 'palm' },
  { key: 'wrist',         label: 'il polso',                     english: 'wrist' },
  { key: 'fingernails',   label: 'le unghie',                    english: 'fingernails' },
];

const HAND_VOCAB_JA: BodyEntry[] = [
  { key: 'thumb',         label: '親指 (おやゆび) — Oyayubi',          english: 'thumb' },
  { key: 'index_finger',  label: '人差し指 (ひとさしゆび) — Hitosashi', english: 'index finger' },
  { key: 'middle_finger', label: '中指 (なかゆび) — Nakayubi',          english: 'middle finger' },
  { key: 'ring_finger',   label: '薬指 (くすりゆび) — Kusuriyubi',      english: 'ring finger' },
  { key: 'pinky',         label: '小指 (こゆび) — Koyubi',              english: 'pinky / little finger' },
  { key: 'fingers',       label: '指 (ゆび) — Yubi',                    english: 'fingers' },
  { key: 'knuckles',      label: '指の関節 (かんせつ) — Kansetsu',      english: 'knuckles' },
  { key: 'palm',          label: '手のひら (てのひら) — Tenohira',       english: 'palm' },
  { key: 'wrist',         label: '手首 (てくび) — Tekubi',               english: 'wrist' },
  { key: 'fingernails',   label: '爪 (つめ) — Tsume',                   english: 'fingernails' },
];

const HAND_VOCAB_KO: BodyEntry[] = [
  { key: 'thumb',         label: '엄지손가락 — Eomji Songarak',     english: 'thumb' },
  { key: 'index_finger',  label: '검지손가락 — Geomji Songarak',     english: 'index finger' },
  { key: 'middle_finger', label: '중지손가락 — Jungji Songarak',     english: 'middle finger' },
  { key: 'ring_finger',   label: '약지손가락 — Yakji Songarak',      english: 'ring finger' },
  { key: 'pinky',         label: '새끼손가락 — Saekki Songarak',     english: 'pinky / little finger' },
  { key: 'fingers',       label: '손가락 — Songarak',               english: 'fingers' },
  { key: 'knuckles',      label: '손가락 관절 — Songarak Gwanjeol',  english: 'knuckles' },
  { key: 'palm',          label: '손바닥 — Sonbadak',               english: 'palm' },
  { key: 'wrist',         label: '손목 — Sonmok',                   english: 'wrist' },
  { key: 'fingernails',   label: '손톱 — Sontop',                   english: 'fingernails' },
];

const HAND_VOCAB_ZH: BodyEntry[] = [
  { key: 'thumb',         label: '大拇指 (dà mǔ zhǐ) — Dà Mǔ Zhǐ', english: 'thumb' },
  { key: 'index_finger',  label: '食指 (shízhǐ) — Shízhǐ',          english: 'index finger' },
  { key: 'middle_finger', label: '中指 (zhōngzhǐ) — Zhōngzhǐ',      english: 'middle finger' },
  { key: 'ring_finger',   label: '无名指 (wúmíngzhǐ) — Wúmíngzhǐ',  english: 'ring finger' },
  { key: 'pinky',         label: '小指 (xiǎozhǐ) — Xiǎozhǐ',        english: 'pinky finger' },
  { key: 'fingers',       label: '手指 (shǒuzhǐ) — Shǒuzhǐ',        english: 'fingers' },
  { key: 'knuckles',      label: '指关节 (zhǐguānjié) — Zhǐguānjié', english: 'knuckles' },
  { key: 'palm',          label: '手掌 (shǒuzhǎng) — Shǒuzhǎng',     english: 'palm' },
  { key: 'wrist',         label: '手腕 (shǒuwàn) — Shǒuwàn',         english: 'wrist' },
  { key: 'fingernails',   label: '指甲 (zhǐjia) — Zhǐjia',           english: 'fingernails' },
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
  portuguese: [
    ['um', 'thumb — o polegar'],
    ['dois', 'index — o indicador'],
    ['três', 'middle — o médio'],
    ['quatro', 'ring — o anelar'],
    ['cinco', 'pinky — o mindinho'],
  ],
  german: [
    ['eins', 'thumb — der Daumen'],
    ['zwei', 'index — der Zeigefinger'],
    ['drei', 'middle — der Mittelfinger'],
    ['vier', 'ring — der Ringfinger'],
    ['fünf', 'pinky — der kleine Finger'],
  ],
  italian: [
    ['uno', 'thumb — il pollice'],
    ['due', 'index — il dito indice'],
    ['tre', 'middle — il dito medio'],
    ['quattro', 'ring — il dito anulare'],
    ['cinque', 'pinky — il mignolo'],
  ],
  japanese: [
    ['一 (いち) — ichi', 'thumb — 親指 (おやゆび)'],
    ['二 (に) — ni', 'index — 人差し指'],
    ['三 (さん) — san', 'middle — 中指 (なかゆび)'],
    ['四 (し/よん) — yon', 'ring — 薬指 (くすりゆび)'],
    ['五 (ご) — go', 'pinky — 小指 (こゆび)'],
  ],
  korean: [
    ['하나 — Hana', 'thumb — 엄지손가락'],
    ['둘 — Dul', 'index — 검지손가락'],
    ['셋 — Set', 'middle — 중지손가락'],
    ['넷 — Net', 'ring — 약지손가락'],
    ['다섯 — Daseot', 'pinky — 새끼손가락'],
  ],
  mandarin: [
    ['一 (yī)', 'thumb — 大拇指 (dà mǔ zhǐ)'],
    ['二 (èr)', 'index — 食指 (shízhǐ)'],
    ['三 (sān)', 'middle — 中指 (zhōngzhǐ)'],
    ['四 (sì)', 'ring — 无名指 (wúmíngzhǐ)'],
    ['五 (wǔ)', 'pinky — 小指 (xiǎozhǐ)'],
  ],
};

export function HandPartsCard({ language = 'spanish' }: { language?: LangCode }) {
  
const HAND_VOCAB_HE: BodyEntry[] = [
  { part: 'thumb',       label: 'אגודל (agudal)',           english: 'thumb' },
  { part: 'index',       label: 'אצבע מורה (etsba mora)', english: 'index finger' },
  { part: 'middle',      label: "אצבע אמצעית (etsba emtsa'it)", english: 'middle finger' },
  { part: 'ring',        label: "אצבע טבעת (etsba taba'at)", english: 'ring finger' },
  { part: 'pinky',       label: 'אצבע קטנה (etsba ktana)', english: 'little finger' },
  { part: 'palm',        label: 'כף יד (kaf yad)',                english: 'palm' },
  { part: 'wrist',       label: 'פרק יד (parak yad)',        english: 'wrist' },
  { part: 'knuckle',     label: 'קשר אצבע (kesher etsba)', english: 'knuckle' },
  { part: 'fingernail',  label: 'ציפורן (tsiporen)',   english: 'fingernail' },
];

  const vocab = language === 'french' ? HAND_VOCAB_FR : language === 'portuguese' ? HAND_VOCAB_PT : language === 'german' ? HAND_VOCAB_DE : language === 'italian' ? HAND_VOCAB_IT : language === 'japanese' ? HAND_VOCAB_JA : language === 'korean' ? HAND_VOCAB_KO : language === 'mandarin' ? HAND_VOCAB_ZH : language === 'hebrew' ? HAND_VOCAB_HE : HAND_VOCAB_ES;
  const counting = HAND_COUNTING[language] ?? HAND_COUNTING.spanish;
  const diagLabels = language === 'french'
    ? { thumb: 'pouce', index_finger: 'index', middle_finger: 'majeur', ring_finger: 'annulaire', pinky: 'auriculaire', palm: 'paume' }
    : language === 'portuguese'
    ? { thumb: 'polegar', index_finger: 'indicador', middle_finger: 'médio', ring_finger: 'anelar', pinky: 'mindinho', palm: 'palma' }
    : language === 'german'
    ? { thumb: 'Daumen', index_finger: 'Zeigefinger', middle_finger: 'Mittelfinger', ring_finger: 'Ringfinger', pinky: 'kl. Finger', palm: 'Handfläche' }
    : language === 'italian'
    ? { thumb: 'pollice', index_finger: 'indice', middle_finger: 'medio', ring_finger: 'anulare', pinky: 'mignolo', palm: 'palmo' }
    : language === 'japanese'
    ? { thumb: '親指', index_finger: '人差し指', middle_finger: '中指', ring_finger: '薬指', pinky: '小指', palm: '手のひら' }
    : language === 'korean'
    ? { thumb: '엄지', index_finger: '검지', middle_finger: '중지', ring_finger: '약지', pinky: '새끼', palm: '손바닥' }
    : language === 'mandarin'
    ? { thumb: '大拇指', index_finger: '食指', middle_finger: '中指', ring_finger: '无名指', pinky: '小指', palm: '手掌' }
    : { thumb: 'pulgar', index_finger: 'índice', middle_finger: 'medio', ring_finger: 'anular', pinky: 'meñique', palm: 'palma' };
  const sectionTitle = language === 'french' ? 'La Main — The Hand' : language === 'portuguese' ? 'A Mão — The Hand' : language === 'german' ? 'Die Hand — The Hand' : language === 'italian' ? 'La Mano — The Hand' : language === 'japanese' ? '手 — The Hand' : language === 'korean' ? '손 — The Hand' : language === 'mandarin' ? 'The Hand' : language === 'hebrew' ? 'היד — The Hand' : 'La Mano — The Hand';
  const fingerCountingLabel = language === 'french' ? 'Counting on Fingers (compter sur les doigts)' : language === 'portuguese' ? 'Counting on Fingers (contar nos dedos)' : language === 'german' ? 'Counting on Fingers (an den Fingern zählen)' : language === 'italian' ? 'Counting on Fingers (contare sulle dita)' : language === 'japanese' ? '指で数える (Yubi de kazoeru)' : language === 'korean' ? '손가락으로 세기 (Songarak-euro Segi)' : language === 'mandarin' ? '用手指数数 (Yòng Shǒuzhǐ Shǔshù)' : 'Counting on Fingers (contar con los dedos)';
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

const TEMP_VOCAB_PT: TempEntry[] = [
  { celsius: -10, label: 'Está muito frio',   english: 'It\'s very cold' },
  { celsius: 5,   label: 'Está frio',          english: 'It\'s cold' },
  { celsius: 15,  label: 'Está fresco',        english: 'It\'s cool' },
  { celsius: 22,  label: 'O tempo está bom',   english: 'The weather is nice' },
  { celsius: 32,  label: 'Está quente',        english: 'It\'s hot' },
  { celsius: 40,  label: 'Está muito quente',  english: 'It\'s very hot' },
];

const TEMP_VOCAB_DE: TempEntry[] = [
  { celsius: -10, label: 'Es ist sehr kalt',      english: 'It\'s very cold' },
  { celsius: 5,   label: 'Es ist kalt',           english: 'It\'s cold' },
  { celsius: 15,  label: 'Es ist kühl',           english: 'It\'s cool' },
  { celsius: 22,  label: 'Das Wetter ist schön',  english: 'The weather is nice' },
  { celsius: 32,  label: 'Es ist heiß',           english: 'It\'s hot' },
  { celsius: 40,  label: 'Es ist sehr heiß',      english: 'It\'s very hot' },
];

const TEMP_VOCAB_IT: TempEntry[] = [
  { celsius: -10, label: 'Fa molto freddo',   english: 'It\'s very cold' },
  { celsius: 5,   label: 'Fa freddo',          english: 'It\'s cold' },
  { celsius: 15,  label: 'Fa fresco',          english: 'It\'s cool' },
  { celsius: 22,  label: 'Il tempo è bello',   english: 'The weather is nice' },
  { celsius: 32,  label: 'Fa caldo',           english: 'It\'s hot' },
  { celsius: 40,  label: 'Fa molto caldo',     english: 'It\'s very hot' },
];

const TEMP_VOCAB_JA: TempEntry[] = [
  { celsius: -10, label: 'とても寒いです',    english: 'It\'s very cold' },
  { celsius: 5,   label: '寒いです',          english: 'It\'s cold' },
  { celsius: 15,  label: '涼しいです',        english: 'It\'s cool' },
  { celsius: 22,  label: 'いい天気です',      english: 'The weather is nice' },
  { celsius: 32,  label: '暑いです',          english: 'It\'s hot' },
  { celsius: 40,  label: 'とても暑いです',    english: 'It\'s very hot' },
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
  portuguese: [
    ['Está quente / frio.', 'It\'s hot / cold.'],
    ['Está muito frio hoje.', 'It\'s very cold today.'],
    ['Quantos graus estão fazendo?', 'How many degrees is it?'],
    ['Estão fazendo 25 graus.', 'It\'s 25 degrees.'],
  ],
  german: [
    ['Es ist heiß / kalt.', 'It\'s hot / cold.'],
    ['Es ist heute sehr kalt.', 'It\'s very cold today.'],
    ['Wie viel Grad hat es?', 'How many degrees is it?'],
    ['Es sind 25 Grad.', 'It\'s 25 degrees.'],
  ],
  italian: [
    ['Fa caldo / freddo.', 'It\'s hot / cold.'],
    ['Fa molto freddo oggi.', 'It\'s very cold today.'],
    ['Quanti gradi ci sono?', 'How many degrees is it?'],
    ['Ci sono 25 gradi.', 'It\'s 25 degrees.'],
  ],
  japanese: [
    ['暑いです / 寒いです。', 'It\'s hot / cold.'],
    ['今日はとても寒いです。', 'It\'s very cold today.'],
    ['何度ですか？', 'How many degrees is it?'],
    ['25度です。', 'It\'s 25 degrees.'],
  ],
  korean: [
    ['더워요 / 추워요.', 'It\'s hot / cold.'],
    ['오늘은 너무 추워요.', 'It\'s very cold today.'],
    ['몇 도예요?', 'How many degrees is it?'],
    ['25도예요.', 'It\'s 25 degrees.'],
  ],
  mandarin: [
    ['很热 / 很冷。(hěn rè / hěn lěng)', 'It\'s hot / cold.'],
    ['今天非常冷。(jīntiān fēicháng lěng)', 'It\'s very cold today.'],
    ['几度？(jǐ dù)', 'How many degrees is it?'],
    ['25度。(èrshíwǔ dù)', 'It\'s 25 degrees.'],
  ],
};

const TEMP_VOCAB_KO: TempEntry[] = [
  { celsius: -10, label: '너무 추워요 — Neomu Chuwoyo',   english: 'It\'s very cold' },
  { celsius: 5,   label: '추워요 — Chuwoyo',               english: 'It\'s cold' },
  { celsius: 15,  label: '시원해요 — Siwonhaeyo',          english: 'It\'s cool' },
  { celsius: 22,  label: '날씨가 좋아요 — Nalssiga Joayo',  english: 'The weather is nice' },
  { celsius: 32,  label: '더워요 — Deowoyo',               english: 'It\'s hot' },
  { celsius: 40,  label: '너무 더워요 — Neomu Deowoyo',    english: 'It\'s very hot' },
];

const TEMP_VOCAB_ZH: TempEntry[] = [
  { celsius: -10, label: '非常冷 (fēicháng lěng)',    english: 'It\'s very cold' },
  { celsius: 5,   label: '很冷 (hěn lěng)',            english: 'It\'s cold' },
  { celsius: 15,  label: '凉快 (liángkuai)',            english: 'It\'s cool' },
  { celsius: 22,  label: '天气很好 (tiānqì hěn hǎo)',  english: 'The weather is nice' },
  { celsius: 32,  label: '很热 (hěn rè)',              english: 'It\'s hot' },
  { celsius: 40,  label: '非常热 (fēicháng rè)',       english: 'It\'s very hot' },
];

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
  portuguese: [
    ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
    ['100°C = 212°F', 'ponto de ebulição — boiling point'],
    ['0°C = 32°F', 'ponto de congelação — freezing'],
    ['37°C = 98,6°F', 'temperatura corporal — body temperature'],
  ],
  german: [
    ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
    ['100°C = 212°F', 'Siedepunkt — boiling point'],
    ['0°C = 32°F', 'Gefrierpunkt — freezing'],
    ['37°C = 98,6°F', 'Körpertemperatur — body temperature'],
  ],
  italian: [
    ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
    ['100°C = 212°F', 'punto di ebollizione — boiling point'],
    ['0°C = 32°F', 'punto di congelamento — freezing'],
    ['37°C = 98,6°F', 'temperatura corporea — body temperature'],
  ],
  japanese: [
    ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
    ['100°C = 212°F', '沸点 (ふってん) — boiling point'],
    ['0°C = 32°F', '氷点 (ひょうてん) — freezing point'],
    ['37°C = 98.6°F', '体温 (たいおん) — body temperature'],
  ],
  korean: [
    ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
    ['100°C = 212°F', '끓는점 — boiling point'],
    ['0°C = 32°F', '어는점 — freezing point'],
    ['37°C = 98.6°F', '체온 — body temperature'],
  ],
  mandarin: [
    ['°F = (°C × 9/5) + 32', 'Celsius → Fahrenheit'],
    ['100°C = 212°F', '沸点 (fèidiǎn) — boiling point'],
    ['0°C = 32°F', '冰点 (bīngdiǎn) — freezing point'],
    ['37°C = 98.6°F', '体温 (tǐwēn) — body temperature'],
  ],
};

export function ThermometerVocabCard({ language = 'spanish' }: { language?: LangCode }) {
  
const TEMP_VOCAB_HE: TempEntry[] = [
  { celsius: 40, label: "חם מאוד (kham me'od)", english: 'very hot' },
  { celsius: 30, label: 'חם (kham)',             english: 'hot' },
  { celsius: 20, label: "נעים (na'im)",          english: 'pleasant' },
  { celsius: 10, label: 'קר (kar)',              english: 'cold' },
  { celsius: 0,  label: 'קפא (kafa)',            english: 'freezing' },
  { celsius: -10,label: "קפא עז (kafa 'az)",    english: 'very cold / icy' },
];

  const vocab = language === 'french' ? TEMP_VOCAB_FR : language === 'portuguese' ? TEMP_VOCAB_PT : language === 'german' ? TEMP_VOCAB_DE : language === 'italian' ? TEMP_VOCAB_IT : language === 'japanese' ? TEMP_VOCAB_JA : language === 'korean' ? TEMP_VOCAB_KO : language === 'mandarin' ? TEMP_VOCAB_ZH : language === 'hebrew' ? TEMP_VOCAB_HE : TEMP_VOCAB_ES;
  const keyExprs = TEMP_KEY_EXPRS[language] ?? TEMP_KEY_EXPRS.spanish;
  const conversions = TEMP_CONVERSIONS[language] ?? TEMP_CONVERSIONS.spanish;
  const sectionTitle = language === 'french' ? 'La Température — Temperature' : language === 'portuguese' ? 'A Temperatura — Temperature' : language === 'german' ? 'Die Temperatur — Temperature' : language === 'italian' ? 'La Temperatura — Temperature' : language === 'japanese' ? '気温 — Temperature' : language === 'korean' ? '기온 — Temperature' : language === 'mandarin' ? 'Temperature' : language === 'hebrew' ? 'טמפרטורה — Temperature' : 'La Temperatura — Temperature';
  const exprHeading = language === 'french' ? 'Expressions with IL FAIT' : language === 'portuguese' ? 'Expressions with ESTÁ' : language === 'german' ? 'Expressions with ES IST' : language === 'italian' ? 'Expressions with FA' : language === 'japanese' ? 'Expressions with です (desu)' : language === 'korean' ? 'Expressions with 아요/어요 (ayo/eoyo)' : language === 'mandarin' ? 'Expressions with 很 (hěn)' : 'Expressions with HACE';

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
