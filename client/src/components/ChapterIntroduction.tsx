import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Globe, Users, BookOpen, Lightbulb } from "lucide-react";
import { SunArcGreetings, FormalInformalComparison, QuickPhraseGrid, SerEstarCard, PretImperfectCard, PorParaCard, FalseCognatesGrid } from "./TextbookInfographics";
import {
  ArVerbsCard, ErVerbsCard, IrVerbsCard,
  SerCard, EstarCard, TenerCard, IrCard,
  StemChangeCard, GoVerbsCard,
  SaberConocerCard, ReflexiveVerbCard,
  PretRegularCard, PretIrregularCard,
  ImperfectCard, FutureCard, ConditionalCard, SubjunctiveCard, CommandsCard,
  GenderArticleCard, AdjAgreeCard, ObjectPronounChart,
  NegationQuestionsCard, TuUstedCard,
  SpatialPrepositionMap, TemporalPrepositionTimeline,
} from "./TextbookGrammarDiagrams";
import {
  SpanishWorldMapCard, FestivalCalendarCard, DialectMapCard,
  FamilyTreeCard, GreetingEtiquetteCard, CurrencyReferenceCard,
  HispanicFoodGuideCard, GestureAwarenessCard,
} from "./TextbookCulturalCards";
import { WordFamilyCard, resolveWordFamilyRoot } from "./TextbookWordFamilies";
import {
  WeatherVocabCard, EmotionsVocabCard, TimeVocabCard, DaysOfWeekCard,
  BodyPartsCard, FacePartsCard, HandPartsCard, ThermometerVocabCard, CountryDotMapCard,
} from "./TextbookCanvasCards";
import {
  VowelPurityCard, RolledRCard, BVSoundCard, SilentHCard,
  JSoundCard, NyenCard, LLYCard, StressAccentCard, LinkingSoundsCard,
} from "./TextbookPhoneticGuides";
import { languageChapterData } from "@/data/chapter-intro-content";

import familyGatheringImg from "@assets/stock_images/family_gathering_aro_0f321ed1.jpg";
import coffeeShopImg from "@assets/stock_images/coffee_shop_friends__69e794a8.jpg";
import numbersBlocksImg from "@assets/stock_images/numbers_counting_blocks_education.jpg";
import danielaTutorImg from "@assets/generated_images/daniela_tutor_welcome_illustration.png";

interface ChapterIntroductionProps {
  chapterNumber: number;
  chapterTitle?: string;
  language: string;
  chapterType?: string;
  className?: string;
}

const chapterImages: Record<string, string[]> = {
  greetings: [coffeeShopImg],
  numbers: [numbersBlocksImg],
  family: [familyGatheringImg],
  daily: [coffeeShopImg],
};

function classifyChapterType(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes('greet') || lower.includes('hello') || lower.includes('introduction') || lower.includes('bonjour') || lower.includes('hallo') || lower.includes('ciao') || lower.includes('saluti') || lower.includes('はじめまして') || lower.includes('hajimemashite') || lower.includes('안녕하세요') || lower.includes('annyeong') || lower.includes('olá') || lower.includes('saudaç') || lower.includes('你好') || lower.includes('nǐ hǎo') || lower.includes('שלום') || lower.includes('¡hola')) {
    return 'greetings';
  }
  if (lower.includes('family') || lower.includes('familia') || lower.includes('famille') || lower.includes('meine familie') || lower.includes('famiglia') || lower.includes('família') || lower.includes('家族') || lower.includes('가족') || lower.includes('משפחה')) {
    return 'family';
  }
  if (lower.includes('number') || lower.includes('número') || lower.includes('nombres') || lower.includes('zahlen') || lower.includes('numeri') || lower.includes('数字') || lower.includes('숫자') || lower.includes('sūji') || lower.includes('shùzì') || lower.includes('sutja') || lower.includes('números')) {
    return 'numbers';
  }
  if (lower.includes('review') || lower.includes('routine') || lower.includes('daily') || lower.includes('quotidien') || lower.includes('alltag') || lower.includes('quotidiana') || lower.includes('rotina') || lower.includes('毎日') || lower.includes('일상') || lower.includes('日常')) {
    return 'daily';
  }
  return null;
}

type GrammarChapterType =
  // ── Section 3 — Grammar diagrams ────────────────────────────────────────
  | 'ser_estar' | 'pret_imp' | 'por_para' | 'false_cognates'
  | 'ar_verbs' | 'er_verbs' | 'ir_verbs'
  | 'ser_only' | 'estar_only' | 'tener' | 'ir_go'
  | 'stem_change' | 'go_verbs'
  | 'saber_conocer' | 'reflexive'
  | 'pret_regular' | 'pret_irregular'
  | 'imperfect' | 'future' | 'conditional' | 'subjunctive' | 'commands'
  | 'gender_articles' | 'adjective_agreement' | 'object_pronouns'
  | 'negation_questions' | 'tu_usted'
  // ── Section 4 — Preposition maps ────────────────────────────────────────
  | 'spatial_prep' | 'temporal_prep'
  // ── Section 5 — Cultural infographics ───────────────────────────────────
  | 'world_map' | 'festival_calendar' | 'dialect_map'
  | 'family_tree' | 'greeting_etiquette' | 'currency_ref'
  | 'hispanic_food' | 'gesture_awareness'
  // ── Section 6 — Word family maps ────────────────────────────────────────
  | 'word_family'
  // ── Section 7 — Canvas vocabulary cards (shared with /chat canvas tools) ──
  | 'weather_vocab' | 'emotions_vocab' | 'telling_time' | 'days_week'
  | 'body_parts' | 'face_parts' | 'hand_parts' | 'temperature_vocab' | 'country_dot_map'
  // ── Section 8 — Phonetic guides ─────────────────────────────────────────
  | 'vowel_purity' | 'rolled_r' | 'bv_sound' | 'silent_h'
  | 'j_sound' | 'nyen_sound' | 'lly_sound' | 'stress_accent' | 'linking_sounds';

function classifyGrammarType(title: string): GrammarChapterType | null {
  const lower = title.toLowerCase();

  // ── Section 3 — existing 4 types (most specific first) ──────────────────
  if (lower.includes('ser') && (lower.includes('estar') || lower.includes('vs') || lower.includes(' y '))) return 'ser_estar';
  if (lower.includes('estar') && lower.includes('ser')) return 'ser_estar';
  if ((lower.includes('pret') && lower.includes('imperfec')) || (lower.includes('preterite') && lower.includes('imperfect'))) return 'pret_imp';
  if (lower.includes('por') && lower.includes('para')) return 'por_para';
  if (lower.includes('false cognate') || lower.includes('falso cognado') || lower.includes('false friend') || lower.includes('amigos falsos')) return 'false_cognates';

  // ── Section 3 — verb conjugation tables ─────────────────────────────────
  if (lower.includes('-ar verb') || lower.includes('ar verb') || (lower.includes('hablar') && !lower.includes('pret')) || lower.includes('regular ar') || lower.includes('verbos -ar')) return 'ar_verbs';
  if (lower.includes('-er verb') || lower.includes('er verb') || (lower.includes('comer') && !lower.includes('pret')) || lower.includes('regular er') || lower.includes('verbos -er')) return 'er_verbs';
  if (lower.includes('-ir verb') || lower.includes('ir verb') || (lower.includes('vivir') && !lower.includes('pret')) || lower.includes('regular ir') || lower.includes('verbos -ir')) return 'ir_verbs';
  if (lower === 'ser' || lower.includes('verb ser') || lower.includes('el verbo ser') || (lower.startsWith('ser') && !lower.includes('estar'))) return 'ser_only';
  if (lower === 'estar' || lower.includes('verb estar') || lower.includes('el verbo estar') || (lower.startsWith('estar') && !lower.includes('ser'))) return 'estar_only';
  if (lower.includes('tener') && !lower.includes('pret')) return 'tener';
  if ((lower.includes(' ir ') || lower.startsWith('ir') || lower.includes('verb ir') || lower.includes('going to') || lower.includes('ir a ')) && !lower.includes('vivir') && !lower.includes('subjun') && !lower.includes('pret')) return 'ir_go';
  if (lower.includes('stem change') || lower.includes('boot verb') || lower.includes('cambio de raíz') || lower.includes('e→ie') || lower.includes('o→ue') || lower.includes('stem-change') || (lower.includes('querer') && lower.includes('poder'))) return 'stem_change';
  if (lower.includes('-go verb') || lower.includes('go verb') || lower.includes('verbos irregulares con go') || (lower.includes('hacer') && lower.includes('poner'))) return 'go_verbs';
  if (lower.includes('saber') || lower.includes('conocer')) return 'saber_conocer';
  if (lower.includes('reflexive') || lower.includes('reflexivo') || lower.includes('reflexive verb') || lower.includes('verbos reflexivos') || lower.includes('ducharse') || lower.includes('levantarse')) return 'reflexive';
  if ((lower.includes('pret') || lower.includes('pretérito')) && lower.includes('irregular')) return 'pret_irregular';
  if (lower.includes('pret') || lower.includes('pretérito') || lower.includes('simple past')) return 'pret_regular';
  if (lower.includes('imperfect') || lower.includes('imperfecto')) return 'imperfect';
  if (lower.includes('future') || lower.includes('futuro')) return 'future';
  if (lower.includes('conditional') || lower.includes('condicional')) return 'conditional';
  if (lower.includes('subjunctive') || lower.includes('subjuntivo') || lower.includes('present subjunctive')) return 'subjunctive';
  if (lower.includes('command') || lower.includes('imperativo') || lower.includes('imperative') || lower.includes('mandato')) return 'commands';
  if (lower.includes('gender') || lower.includes('article') || lower.includes('género') || lower.includes('artículo') || lower.includes('el/la') || lower.includes('un/una')) return 'gender_articles';
  if (lower.includes('adjective') || lower.includes('adjetivo') || lower.includes('adjective agreement') || lower.includes('concordancia')) return 'adjective_agreement';
  if (lower.includes('object pronoun') || lower.includes('direct object') || lower.includes('indirect object') || lower.includes('pronombre de objeto') || lower.includes('lo/la/le')) return 'object_pronouns';
  if (lower.includes('negation') || lower.includes('negativo') || lower.includes('sentence structure') || lower.includes('word order') || lower.includes('question word')) return 'negation_questions';
  if ((lower.includes('tú') && lower.includes('usted')) || lower.includes('formal vs informal') || lower.includes('register')) return 'tu_usted';

  // ── Section 4 — Prepositions ─────────────────────────────────────────────
  if (lower.includes('temporal prep') || lower.includes('preposicion de tiempo') || lower.includes('antes de') || lower.includes('después de') || lower.includes('hace + tiempo')) return 'temporal_prep';
  if (lower.includes('preposition') || lower.includes('preposición') || lower.includes('spatial') || lower.includes('prep of place')) return 'spatial_prep';

  // ── Section 5 — Cultural infographics ────────────────────────────────────
  // More specific first to avoid false positives
  if (lower.includes('family tree') || lower.includes('árbol genealóg') || lower.includes('árbol familiar') || lower.includes('family member') || lower.includes('miembro') || lower.includes('relaciones familiares') || lower.includes('family relationship')) return 'family_tree';
  if (lower.includes('world map') || lower.includes('hispanohablante') || lower.includes('21 countries') || lower.includes('mundo hispano') || lower.includes('spanish-speaking world') || lower.includes('español en el mundo')) return 'world_map';
  if (lower.includes('festival') || lower.includes('festividad') || lower.includes('holiday') || lower.includes('celebration') || lower.includes('fiesta') || lower.includes('day of the dead') || lower.includes('día de los muertos')) return 'festival_calendar';
  if (lower.includes('dialect') || lower.includes('dialecto') || lower.includes('regional spanish') || lower.includes('variedades del español') || lower.includes('ceceo') || lower.includes('seseo') || lower.includes('voseo')) return 'dialect_map';
  if (lower.includes('greeting custom') || lower.includes('cheek kiss') || lower.includes('saludar en') || lower.includes('greeting by country') || lower.includes('etiqueta de saludo')) return 'greeting_etiquette';
  if (lower.includes('currency') || lower.includes('moneda') || lower.includes('dinero del mundo') || lower.includes('currencies')) return 'currency_ref';
  if (lower.includes('food guide') || lower.includes('gastronomía') || lower.includes('gastronomia') || lower.includes('regional food') || lower.includes('comida hispana') || lower.includes('hispanic food') || lower.includes('comida típica') || lower.includes('platos típicos') || lower.includes('dishes by region')) return 'hispanic_food';
  if (lower.includes('gesture') || lower.includes('body language') || lower.includes('gesto') || lower.includes('comunicación no verbal') || lower.includes('non-verbal') || lower.includes('lenguaje corporal') || lower.includes('hand gesture')) return 'gesture_awareness';

  // ── Section 6 — Word family maps ─────────────────────────────────────────
  if (lower.includes('word family') || lower.includes('familia de palabras') || lower.includes('word derivation') || lower.includes('derivation') || lower.includes('familia léxica')) return 'word_family';

  // ── Section 7 — Canvas vocabulary cards ─────────────────────────────────
  if (lower.includes('weather vocab') || lower.includes('el tiempo') || lower.includes('tiempo atmosférico') || lower.includes('weather condition') || lower.includes('el clima')) return 'weather_vocab';
  if (lower.includes('emotion') || lower.includes('emoción') || lower.includes('emociones') || lower.includes('feeling') || lower.includes('sentimiento') || lower.includes('estado de ánimo') || lower.includes('cómo te sientes') || lower.includes('how do you feel')) return 'emotions_vocab';
  if (lower.includes('la hora') || lower.includes('telling time') || lower.includes('telling the time') || lower.includes('time expression') || lower.includes('what time') || lower.includes('qué hora')) return 'telling_time';
  if (lower.includes('días de la semana') || lower.includes('days of the week') || lower.includes('meses del año') || lower.includes('months of the year') || lower.includes('calendar vocab') || lower.includes('la semana') || lower.includes('el mes')) return 'days_week';
  if (lower.includes('body part') || lower.includes('el cuerpo') || lower.includes('partes del cuerpo') || lower.includes('cuerpo humano') || lower.includes('body vocab')) return 'body_parts';
  if (lower.includes('face part') || lower.includes('la cara') || lower.includes('parts of the face') || lower.includes('face vocab') || lower.includes('cara y cabeza') || lower.includes('facial feature')) return 'face_parts';
  if (lower.includes('la mano') || lower.includes('hand vocab') || lower.includes('hand part') || lower.includes('los dedos') || lower.includes('finger vocab')) return 'hand_parts';
  if (lower.includes('temperatura') || lower.includes('temperature vocab') || lower.includes('thermometer') || lower.includes('degrees') || lower.includes('grados')) return 'temperature_vocab';
  if (lower.includes('spanish country') || lower.includes('país hispanohablante') || lower.includes('hispanic country') || lower.includes('spanish speaking countr') || lower.includes('dot map')) return 'country_dot_map';

  // ── Section 8 — Phonetics ────────────────────────────────────────────────
  // Most specific first
  if (lower.includes('rolled r') || lower.includes('erre') || lower.includes('rr sound') || lower.includes('rolling r') || lower.includes('trilled r')) return 'rolled_r';
  if (lower.includes('b vs v') || lower.includes('b and v') || lower.includes('b/v') || lower.includes('b y v')) return 'bv_sound';
  if (lower.includes('silent h') || lower.includes('h muda') || lower.includes('la h') || lower.includes('mute h')) return 'silent_h';
  if (lower.includes('j sound') || lower.includes('jota') || lower.includes('the j') || lower.includes('la jota')) return 'j_sound';
  if (lower.includes('eñe') || lower.includes(' ñ ') || lower.startsWith('ñ') || lower.includes('ny sound') || lower.includes('la ñ')) return 'nyen_sound';
  if (lower.includes('ll') && lower.includes('y') || lower.includes('yeísmo') || lower.includes('sheísmo') || lower.includes('ll/y') || lower.includes('ll vs y')) return 'lly_sound';
  if (lower.includes('accent mark') || lower.includes('stress rule') || lower.includes('tilde') || lower.includes('acento ortográfico') || lower.includes('written accent')) return 'stress_accent';
  if (lower.includes('enlace') || lower.includes('linking sound') || lower.includes('connected speech') || lower.includes('vowel linking') || lower.includes('sinalefa')) return 'linking_sounds';
  if (lower.includes('vowel') || lower.includes('vocal') || lower.includes('vowel purity')) return 'vowel_purity';
  if (lower.includes('pronunciation') || lower.includes('pronunciación') || lower.includes('phonetic') || lower.includes('fonética') || lower.includes('sounds of spanish')) return 'vowel_purity';

  return null;
}

const GRAMMAR_LABELS: Record<GrammarChapterType, { title: string; subtitle: string }> = {
  // Section 3
  ser_estar: { title: 'SER vs ESTAR', subtitle: 'The two "to be" verbs — both essential, each with its own job' },
  pret_imp: { title: 'Pretérito vs Imperfecto', subtitle: 'Two ways to talk about the past — context decides which you need' },
  por_para: { title: 'POR vs PARA', subtitle: 'Both translate as "for" in English — but they express very different relationships' },
  false_cognates: { title: 'False Cognates', subtitle: 'Spanish words that look like English — but mean something else entirely' },
  ar_verbs: { title: 'Regular –AR Verbs', subtitle: 'The most common verb type in Spanish — master hablar, you master them all' },
  er_verbs: { title: 'Regular –ER Verbs', subtitle: 'Second verb type — comer, beber, leer follow the same pattern' },
  ir_verbs: { title: 'Regular –IR Verbs', subtitle: 'Third verb type — vivir, escribir, abrir follow the same pattern' },
  ser_only: { title: 'The Verb SER', subtitle: 'Identity, origin, profession, time — the permanent "to be"' },
  estar_only: { title: 'The Verb ESTAR', subtitle: 'Location, health, emotion, in-progress — the state "to be"' },
  tener: { title: 'The Verb TENER', subtitle: 'To have — plus tener expressions for feelings and obligations' },
  ir_go: { title: 'The Verb IR', subtitle: 'To go — plus IR + a + infinitive for future plans' },
  stem_change: { title: 'Stem-changing Verbs', subtitle: 'Boot verbs — e→ie, o→ue, e→i in all forms except nosotros & vosotros' },
  go_verbs: { title: '–GO Verbs', subtitle: 'Irregular yo only — hacer, poner, traer, salir, venir…' },
  saber_conocer: { title: 'SABER vs CONOCER', subtitle: 'Both mean "to know" — factual knowledge vs. familiarity' },
  reflexive: { title: 'Reflexive Verbs', subtitle: 'The subject does the action to themselves — ducharse, levantarse, llamarse…' },
  pret_regular: { title: 'Preterite — Regular Verbs', subtitle: 'Completed past actions with specific timing' },
  pret_irregular: { title: 'Preterite — Irregular Verbs', subtitle: 'ser/ir/tener/hacer/estar — no accent marks, unique stems' },
  imperfect: { title: 'Imperfect Tense', subtitle: 'Ongoing, habitual, or background past actions' },
  future: { title: 'Future Tense', subtitle: 'Keep the infinitive, add the endings — just a few irregular stems' },
  conditional: { title: 'Conditional Tense', subtitle: 'Would — same irregulars as future, but with -ía endings' },
  subjunctive: { title: 'Present Subjunctive', subtitle: 'Used after trigger phrases expressing wishes, doubts, and emotions' },
  commands: { title: 'Commands — Imperativos', subtitle: 'Tú, usted, and ustedes commands — affirmative and negative' },
  gender_articles: { title: 'Gender & Articles', subtitle: 'Every noun has a gender — and articles must match it' },
  adjective_agreement: { title: 'Adjective Agreement', subtitle: 'Adjectives match their noun in gender and number' },
  object_pronouns: { title: 'Object Pronouns', subtitle: 'Direct and indirect object pronouns — placement and order' },
  negation_questions: { title: 'Sentence Structure Essentials', subtitle: 'Word order, negation, and question formation' },
  tu_usted: { title: 'Tú vs Usted', subtitle: 'Register guide — when to be informal vs. formal' },
  // Section 4
  spatial_prep: { title: 'Spatial Prepositions', subtitle: 'Where things are — en, sobre, debajo de, delante de…' },
  temporal_prep: { title: 'Temporal Prepositions', subtitle: 'When things happen — antes de, después de, desde, hasta, hace…' },
  // Section 5
  world_map: { title: 'El Mundo Hispanohablante', subtitle: '21 Spanish-speaking countries across 5 regions — ~500 million native speakers' },
  festival_calendar: { title: 'Festividades Hispanas', subtitle: 'Major celebrations across the Spanish-speaking world, month by month' },
  dialect_map: { title: 'Dialectos del Español', subtitle: '6 major dialect zones — same language, fascinating regional variation' },
  family_tree: { title: 'La Familia', subtitle: 'Family vocabulary — all the relationship terms you need' },
  greeting_etiquette: { title: 'Saludos por Región', subtitle: 'Physical greeting customs — knowing the norms shows cultural respect' },
  currency_ref: { title: 'Monedas Hispanas', subtitle: 'Currency vocabulary across the Spanish-speaking world' },
  hispanic_food: { title: 'La Gastronomía Hispana', subtitle: 'Regional dishes across 5 zones — food is one of the easiest ways to start a real conversation' },
  gesture_awareness: { title: 'La Comunicación No Verbal', subtitle: 'Body language in Spanish-speaking cultures — what to recognise and why it matters' },
  // Section 6
  word_family: { title: 'Familia de Palabras', subtitle: 'Words that share a root — see how the language builds itself' },
  // Section 7 — Canvas vocabulary cards
  weather_vocab:    { title: 'El Tiempo — Weather', subtitle: 'All 10 weather conditions with Spanish expressions — the same icons Daniela uses in lessons' },
  emotions_vocab:   { title: 'Las Emociones — Feelings', subtitle: 'All 11 emotion faces with Spanish labels — the same faces Daniela uses in lessons' },
  telling_time:     { title: 'La Hora — Telling Time', subtitle: 'Analog clocks + key Spanish time patterns and day-part vocabulary' },
  days_week:        { title: 'Días, Meses y Calendario', subtitle: 'Days of the week, months of the year, and useful date expressions' },
  body_parts:       { title: 'El Cuerpo Humano — Body Parts', subtitle: 'Body diagram + complete vocabulary reference — same diagram Daniela uses in lessons' },
  face_parts:       { title: 'La Cara — Face Vocabulary', subtitle: 'Face close-up + full vocabulary for facial features' },
  hand_parts:       { title: 'La Mano — Hand & Fingers', subtitle: 'Hand diagram + vocabulary for fingers, palm, and wrist' },
  temperature_vocab:{ title: 'La Temperatura — Temperature', subtitle: 'Temperature scale in Spanish — same thermometer Daniela uses in lessons' },
  country_dot_map:  { title: 'Países Hispanohablantes', subtitle: 'Interactive dot map of all 21 Spanish-speaking countries — same map Daniela uses in lessons' },
  // Section 8
  vowel_purity: { title: 'Las Vocales Españolas', subtitle: 'Pure, short, consistent — no diphthong glides like English' },
  rolled_r: { title: 'La Erre — The Spanish R', subtitle: 'Flap vs. trill — two different sounds, both spelled "r"' },
  bv_sound: { title: 'B y V en Español', subtitle: 'Both letters share the same sound — unlike English' },
  silent_h: { title: 'La H Muda', subtitle: 'H is always silent in Spanish — adjust your expectations from English' },
  j_sound: { title: 'La Jota — The J Sound', subtitle: 'A guttural sound produced at the back of the throat' },
  nyen_sound: { title: 'La Eñe — Ñ', subtitle: 'A palatalized N — like "ny" in canyon — unique to Spanish' },
  lly_sound: { title: 'LL y Y — Yeísmo & Sheísmo', subtitle: 'Regional variation in how LL and Y are pronounced' },
  stress_accent: { title: 'El Acento — Stress Rules', subtitle: 'Spanish stress is predictable — accent marks only break the default rules' },
  linking_sounds: { title: 'El Enlace — Linking Sounds', subtitle: 'Vowels link across word boundaries in natural spoken Spanish' },
};

function GrammarChapterView({ type, chapterNumber, chapterTitle }: { type: GrammarChapterType; chapterNumber: number; chapterTitle?: string }) {
  const { title, subtitle } = GRAMMAR_LABELS[type];
  const wordFamilyRoot = type === 'word_family' && chapterTitle ? resolveWordFamilyRoot(chapterTitle) : null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-primary mb-1">Chapter {chapterNumber} — Reference</p>
              <h3 className="text-base font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 — Grammar */}
      {type === 'ser_estar' && <SerEstarCard />}
      {type === 'pret_imp' && <PretImperfectCard />}
      {type === 'por_para' && <PorParaCard />}
      {type === 'false_cognates' && <FalseCognatesGrid />}
      {type === 'ar_verbs' && <ArVerbsCard />}
      {type === 'er_verbs' && <ErVerbsCard />}
      {type === 'ir_verbs' && <IrVerbsCard />}
      {type === 'ser_only' && <SerCard />}
      {type === 'estar_only' && <EstarCard />}
      {type === 'tener' && <TenerCard />}
      {type === 'ir_go' && <IrCard />}
      {type === 'stem_change' && <StemChangeCard />}
      {type === 'go_verbs' && <GoVerbsCard />}
      {type === 'saber_conocer' && <SaberConocerCard />}
      {type === 'reflexive' && <ReflexiveVerbCard />}
      {type === 'pret_regular' && <PretRegularCard />}
      {type === 'pret_irregular' && <PretIrregularCard />}
      {type === 'imperfect' && <ImperfectCard />}
      {type === 'future' && <FutureCard />}
      {type === 'conditional' && <ConditionalCard />}
      {type === 'subjunctive' && <SubjunctiveCard />}
      {type === 'commands' && <CommandsCard />}
      {type === 'gender_articles' && <GenderArticleCard />}
      {type === 'adjective_agreement' && <AdjAgreeCard />}
      {type === 'object_pronouns' && <ObjectPronounChart />}
      {type === 'negation_questions' && <NegationQuestionsCard />}
      {type === 'tu_usted' && <TuUstedCard />}

      {/* Section 4 — Prepositions */}
      {type === 'spatial_prep' && <SpatialPrepositionMap />}
      {type === 'temporal_prep' && <TemporalPrepositionTimeline />}

      {/* Section 5 — Cultural */}
      {type === 'world_map' && <SpanishWorldMapCard />}
      {type === 'festival_calendar' && <FestivalCalendarCard />}
      {type === 'dialect_map' && <DialectMapCard />}
      {type === 'family_tree' && <FamilyTreeCard />}
      {type === 'greeting_etiquette' && <GreetingEtiquetteCard />}
      {type === 'currency_ref' && <CurrencyReferenceCard />}
      {type === 'hispanic_food' && <HispanicFoodGuideCard />}
      {type === 'gesture_awareness' && <GestureAwarenessCard />}

      {/* Section 6 — Word families */}
      {type === 'word_family' && <WordFamilyCard root={wordFamilyRoot ?? 'hablar'} />}

      {/* Section 7 — Canvas vocabulary cards (same SVG renderers as /chat) */}
      {type === 'weather_vocab'    && <WeatherVocabCard />}
      {type === 'emotions_vocab'   && <EmotionsVocabCard />}
      {type === 'telling_time'     && <TimeVocabCard />}
      {type === 'days_week'        && <DaysOfWeekCard />}
      {type === 'body_parts'       && <BodyPartsCard />}
      {type === 'face_parts'       && <FacePartsCard />}
      {type === 'hand_parts'       && <HandPartsCard />}
      {type === 'temperature_vocab'&& <ThermometerVocabCard />}
      {type === 'country_dot_map'  && <CountryDotMapCard />}

      {/* Section 8 — Phonetics */}
      {type === 'vowel_purity' && <VowelPurityCard />}
      {type === 'rolled_r' && <RolledRCard />}
      {type === 'bv_sound' && <BVSoundCard />}
      {type === 'silent_h' && <SilentHCard />}
      {type === 'j_sound' && <JSoundCard />}
      {type === 'nyen_sound' && <NyenCard />}
      {type === 'lly_sound' && <LLYCard />}
      {type === 'stress_accent' && <StressAccentCard />}
      {type === 'linking_sounds' && <LinkingSoundsCard />}

      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
        <Users className="h-4 w-4" />
        <span>Explore the lessons below to practice with Daniela!</span>
      </div>
    </div>
  );
}

function normalizeLanguageKey(language: string): string {
  const lower = language.toLowerCase();
  if (lower === 'mandarin chinese' || lower === 'mandarin') return 'mandarin';
  return lower;
}

export function ChapterIntroduction({ chapterNumber, chapterTitle, language, chapterType: chapterTypeProp, className = "" }: ChapterIntroductionProps) {
  const langKey = normalizeLanguageKey(language);
  const langData = languageChapterData[langKey];

  if (!chapterTitle) return null;

  const grammarType = classifyGrammarType(chapterTitle);
  if (grammarType) {
    return (
      <div className={className}>
        <GrammarChapterView type={grammarType} chapterNumber={chapterNumber} chapterTitle={chapterTitle} />
      </div>
    );
  }

  if (!langData) return null;
  
  const chapterType = chapterTypeProp || classifyChapterType(chapterTitle);
  if (!chapterType) return null;
  
  const content = langData.chapters[chapterType];
  if (!content) return null;
  
  const images = chapterImages[chapterType] || [];

  const renderInfographic = (type: string) => {
    switch (type) {
      case 'sunArcGreetings':
        return (
          <SunArcGreetings
            className="w-full"
            morning={langData.greetings.morning}
            afternoon={langData.greetings.afternoon}
            evening={langData.greetings.evening}
          />
        );
      case 'formalInformal':
        return (
          <FormalInformalComparison
            className="w-full"
            items={langData.formalInformal}
          />
        );
      case 'quickPhrases':
        return (
          <QuickPhraseGrid
            className="w-full"
            phrases={langData.quickPhrases}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-daniela-introduction">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-4">
            <div className="hidden md:block flex-shrink-0">
              <img 
                src={danielaTutorImg} 
                alt="Your language tutor" 
                className="w-24 h-24 rounded-full object-cover border-2 border-primary/20"
                data-testid="img-daniela-avatar"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400" data-testid="text-daniela-intro-label">Your Tutor's Introduction</span>
              </div>
              <p className="text-muted-foreground leading-relaxed" data-testid="text-welcome-message">
                {content.welcomeText}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {content.narrativeSections.map((section, index) => {
        const hasVisual = images[index] || section.infographic;
        
        return (
          <Card key={index} className="overflow-hidden" data-testid={`card-narrative-section-${index}`}>
            <CardContent className="p-0">
              <div className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                {images[index] && !section.infographic && (
                  <div className="md:w-2/5 flex-shrink-0">
                    <img 
                      src={images[index]} 
                      alt={section.title}
                      className="w-full h-48 md:h-full object-cover"
                      data-testid={`img-narrative-${index}`}
                    />
                  </div>
                )}
                {section.infographic && (
                  <div className="md:w-2/5 flex-shrink-0 p-4 bg-muted/20 flex items-center justify-center" data-testid={`infographic-${index}`}>
                    {renderInfographic(section.infographic)}
                  </div>
                )}
                <div className={`flex-1 p-4 md:p-6 ${!hasVisual ? 'md:max-w-none' : ''}`}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" data-testid={`text-narrative-title-${index}`}>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {section.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    {section.content}
                  </p>
                  {section.tip && (
                    <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20" data-testid={`tip-section-${index}`}>
                      <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{section.tip}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {content.culturalSpotlight && (
        <Card className="overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent" data-testid="card-cultural-spotlight">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="border-purple-500/30 text-purple-600 dark:text-purple-400" data-testid="badge-cultural-spotlight">
                <Globe className="h-3 w-3 mr-1" />
                Cultural Spotlight
              </Badge>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2" data-testid="text-cultural-title">
                {content.culturalSpotlight.title}
              </h4>
              <p className="text-muted-foreground leading-relaxed" data-testid="text-cultural-content">
                {content.culturalSpotlight.content}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
        <Users className="h-4 w-4" />
        <span>Now let's explore the lessons below and start practicing!</span>
      </div>
    </div>
  );
}

export default ChapterIntroduction;
