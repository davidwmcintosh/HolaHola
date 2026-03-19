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

// ── French ────────────────────────────────────────────────────────────────────
import {
  ÊtreCard, AvoirCard, AllerCard, FaireCard,
  FrErVerbsCard, FrIrVerbsCard, FrReVerbsCard,
  FrModalsCard, FrReflexiveCard,
  FrPasseComposeAvoirCard, FrPasseComposeEtreCard,
  FrImparfaitCard, FrPcVsImpCard,
  FrFutureCard, FrConditionalCard, FrSubjunctiveCard,
  FrNegationCard, FrArticlesGenderCard, FrAdjAgreeCard,
  FrObjectPronounsCard, FrTuVousCard, FrQuestionsCard,
  FrSpatialPrepCard, FrTemporalPrepCard,
} from "./TextbookFrenchGrammarCards";
import {
  FrancophoneWorldMapCard, FrenchHolidayCalendarCard, FrenchFoodGuideCard,
  FrenchDialectZonesCard, LaBiseEtiquetteCard, FrenchCurrencyCard,
  FrGestureAwarenessCard,
} from "./TextbookFrenchCulturalCards";
import {
  FrNasalVowelsCard, FrFrenchRCard, FrLiaisonCard,
  FrUSoundCard, FrEUSoundCard, FrSilentConsonantsCard,
  FrWrittenAccentsCard, FrIntonationCard, FrElisionCard,
} from "./TextbookFrenchPhoneticGuides";
import {
  FrParlerFamilyCard, FrAimerFamilyCard, FrVoirFamilyCard,
  FrFaireFamilyCard, FrDireFamilyCard, FrAllerFamilyCard,
  FrVenirFamilyCard, FrPrendreFamilyCard, FrSavoirFamilyCard,
  FrCroireFamilyCard,
} from "./TextbookFrenchWordFamilies";

// ── Portuguese ────────────────────────────────────────────────────────────────
import {
  PtSerEstarCard, PtSerCard, PtEstarCard, PtTerCard, PtIrCard,
  PtArVerbsCard, PtErVerbsCard, PtIrRegVerbsCard, PtReflexiveCard,
  PtPreteritoPerfeito, PtPreteritoImperfeito, PtPretVsImpCard,
  PtFutureCard, PtConditionalCard, PtSubjunctiveCard,
  PtNegativeCard, PtGenderArticlesCard, PtAdjectiveAgreementCard,
  PtObjectPronounsCard, PtTuVoceCard, PtQuestionsCard, PtContractionsCard,
} from "./TextbookPortugueseGrammarCards";
import {
  LusophoneWorldMapCard, PortugueseHolidayCalendarCard, PortugueseFoodGuideCard,
  PortugueseDialectCard, PortugueseEtiquetteCard, PortugueseCurrencyCard,
  PortugueseGestureCard,
} from "./TextbookPortugueseCulturalCards";
import {
  PtNasalVowelsCard, PtPortugueseRCard, PtLhNhCard, PtVowelReductionCard,
  PtTiDiCard, PtStressAccentCard, PtEuVsBrCard, PtLinkingCard, PtIntonationCard,
} from "./TextbookPortuguesePhoneticGuides";
import {
  PtFalarFamilyCard, PtAmarFamilyCard, PtVerFamilyCard, PtFazerFamilyCard,
  PtDizerFamilyCard, PtIrFamilyCard, PtVirFamilyCard, PtTomarFamilyCard,
  PtSaberFamilyCard, PtQuererFamilyCard, resolvePtWordFamilyCard,
} from "./TextbookPortugueseWordFamilies";

// ── German ─────────────────────────────────────────────────────────────────────
import {
  DeSeinCard, DeHabenCard, DeWerdenCard,
  DeRegularVerbsCard, DeModalVerbsCard, DeReflexiveCard,
  DePerfektCard, DePrateritumCard, DePerfVsPratCard,
  DeFuturCard, DeKonjunktiv2Card,
  DeNegationCard, DeDefiniteArticlesCard, DeIndefiniteArticlesCard,
  DeAdjEndingsCard, DeAccusativeCard, DeDativeCard, DeCasesOverviewCard,
  DeSeparableVerbsCard, DeWordOrderCard,
  DeQuestionsCard, DePronounsCard,
} from "./TextbookGermanGrammarCards";
import {
  GermanSpeakingWorldCard, GermanHolidayCalendarCard, GermanFoodGuideCard,
  GermanDialectCard, GermanEtiquetteCard, GermanCurrencyCard, GermanGestureCard,
} from "./TextbookGermanCulturalCards";
import {
  DeUmlautsCard, DeEszettCard, DeGermanRCard, DeChSoundCard,
  DeLongShortVowelsCard, DeWVSoundCard, DeConsonantClustersCard,
  DeWordStressCard, DeDiphthongsCard,
} from "./TextbookGermanPhoneticGuides";
import {
  DeSPRECHENFamilyCard, DeLIEBENFamilyCard, DeSEHENFamilyCard, DeMACHENFamilyCard,
  DeGEHENFamilyCard, DeKOMMENFamilyCard, DeHABENFamilyCard, DeWISSENFamilyCard,
  DeFINDENFamilyCard, DeDENKENFamilyCard, resolveDeFamilyCard,
} from "./TextbookGermanWordFamilies";

// ── Italian ────────────────────────────────────────────────────────────────────
import {
  ItEssereCard, ItAvereCard, ItStareCard, ItRegularVerbsCard,
  ItModalVerbsCard, ItReflexiveCard, ItPassatoProssimoCard,
  ItImperfettoCard, ItPastComparisonCard, ItFuturoCard, ItCondizionaleCard,
  ItNegationCard, ItDefiniteArticlesCard, ItIndefiniteArticlesCard,
  ItAdjAgreementCard, ItArticulatedPrepCard, ItObjectPronounsCard,
  ItSubjectPronounsCard, ItQuestionsCard, ItPartitiveCard,
  ItImperativeCard, ItComparativesCard,
} from "./TextbookItalianGrammarCards";
import {
  ItalophoneWorldCard, ItalianHolidayCalendarCard, ItalianFoodGuideCard,
  ItalianDialectCard, ItalianEtiquetteCard, ItalianCurrencyCard, ItalianGestureCard,
} from "./TextbookItalianCulturalCards";
import {
  ItCGSoundsCard, ItSCSoundsCard, ItGLGNCard, ItDoubleConsonantCard,
  ItZSoundCard, ItRolledRCard, ItOpenClosedVowelsCard, ItStressPatternsCard, ItDiphthongsCard,
} from "./TextbookItalianPhoneticGuides";
import {
  ItPARLAREFamilyCard, ItESSEREFamilyCard, ItAVEREFamilyCard, ItFAREFamilyCard,
  ItANDAREFamilyCard, ItVENIREFamilyCard, ItVEDEREFamilyCard, ItSAPEREFamilyCard,
  ItTROVAREFamilyCard, ItPENSAREFamilyCard, resolveItFamilyCard,
} from "./TextbookItalianWordFamilies";

// ── Japanese ──────────────────────────────────────────────────────────────────
import {
  JaHiraganaCard, JaKatakanaCard, JaKanjiBasicsCard,
  JaParticlesCard, JaVerbGroupsCard, JaTEFormCard,
  JaPastTenseCard, JaNegativeFormCard, JaPoliteFormCard,
  JaAdjectivesCard, JaNounPhrasesCard, JaQuestionWordsCard,
  JaNumbersCard, JaCountersCard, JaTimeExpressionsCard,
  JaDirectionMovementCard, JaGivingReceivingCard, JaPotentialFormCard,
  JaVolitionalFormCard, JaConditionalCard, JaTeIruCard, JaHonorificsCard,
} from "./TextbookJapaneseGrammarCards";
import {
  JapanophoneWorldCard, JapaneseHolidayCalendarCard, JapaneseFoodGuideCard,
  JapaneseRegionsCard, JapaneseEtiquetteCard, JapaneseCurrencyCard,
  JapanesePopCultureCard,
} from "./TextbookJapaneseCulturalCards";
import {
  JaHiraganaChartCard, JaKatakanaChartCard, JaVowelSoundsCard,
  JaConsonantSoundsCard, JaLongVowelsCard, JaDoubleConsonantsCard,
  JaPitchAccentCard, JaLoanwordsCard, JaNSoundCard,
} from "./TextbookJapanesePhoneticGuides";
import { resolveJaFamilyCard } from "./TextbookJapaneseWordFamilies";

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
  // ── SPANISH Section 3 — Grammar diagrams ────────────────────────────────
  | 'ser_estar' | 'pret_imp' | 'por_para' | 'false_cognates'
  | 'ar_verbs' | 'er_verbs' | 'ir_verbs'
  | 'ser_only' | 'estar_only' | 'tener' | 'ir_go'
  | 'stem_change' | 'go_verbs'
  | 'saber_conocer' | 'reflexive'
  | 'pret_regular' | 'pret_irregular'
  | 'imperfect' | 'future' | 'conditional' | 'subjunctive' | 'commands'
  | 'gender_articles' | 'adjective_agreement' | 'object_pronouns'
  | 'negation_questions' | 'tu_usted'
  // ── SPANISH Section 4 — Preposition maps ────────────────────────────────
  | 'spatial_prep' | 'temporal_prep'
  // ── SPANISH Section 5 — Cultural infographics ───────────────────────────
  | 'world_map' | 'festival_calendar' | 'dialect_map'
  | 'family_tree' | 'greeting_etiquette' | 'currency_ref'
  | 'hispanic_food' | 'gesture_awareness'
  // ── SPANISH Section 6 — Word family maps ────────────────────────────────
  | 'word_family'
  // ── Section 7 — Canvas vocabulary cards (shared with /chat canvas tools) ──
  | 'weather_vocab' | 'emotions_vocab' | 'telling_time' | 'days_week'
  | 'body_parts' | 'face_parts' | 'hand_parts' | 'temperature_vocab' | 'country_dot_map'
  // ── SPANISH Section 8 — Phonetic guides ─────────────────────────────────
  | 'vowel_purity' | 'rolled_r' | 'bv_sound' | 'silent_h'
  | 'j_sound' | 'nyen_sound' | 'lly_sound' | 'stress_accent' | 'linking_sounds'
  // ── FRENCH Section 3 — Grammar diagrams ─────────────────────────────────
  | 'fr_etre' | 'fr_avoir' | 'fr_aller' | 'fr_faire'
  | 'fr_er_verbs' | 'fr_ir_verbs' | 'fr_re_verbs'
  | 'fr_modals' | 'fr_reflexive'
  | 'fr_passe_compose_avoir' | 'fr_passe_compose_etre'
  | 'fr_imparfait' | 'fr_pc_vs_imp'
  | 'fr_future' | 'fr_conditional' | 'fr_subjunctive'
  | 'fr_negation' | 'fr_articles_gender' | 'fr_adj_agree'
  | 'fr_object_pronouns' | 'fr_tu_vous' | 'fr_questions'
  // ── FRENCH Section 4 — Preposition maps ─────────────────────────────────
  | 'fr_spatial_prep' | 'fr_temporal_prep'
  // ── FRENCH Section 5 — Cultural infographics ─────────────────────────────
  | 'fr_world_map' | 'fr_holiday_calendar' | 'fr_food_guide'
  | 'fr_dialect_zones' | 'fr_la_bise' | 'fr_currency' | 'fr_gesture'
  // ── FRENCH Section 6 — Word families ────────────────────────────────────
  | 'fr_word_family'
  // ── FRENCH Section 8 — Phonetic guides ──────────────────────────────────
  | 'fr_nasal_vowels' | 'fr_french_r' | 'fr_liaison'
  | 'fr_u_sound' | 'fr_eu_sound' | 'fr_silent_consonants'
  | 'fr_written_accents' | 'fr_intonation' | 'fr_elision'
  // ── PORTUGUESE Section 3 — Grammar ──────────────────────────────────────
  | 'pt_ser_estar' | 'pt_ser_only' | 'pt_estar_only'
  | 'pt_ter' | 'pt_ir'
  | 'pt_ar_verbs' | 'pt_er_verbs' | 'pt_ir_verbs'
  | 'pt_reflexive'
  | 'pt_preterito_perfeito' | 'pt_preterito_imperfeito' | 'pt_pret_vs_imp'
  | 'pt_future' | 'pt_conditional' | 'pt_subjunctive'
  | 'pt_negation' | 'pt_gender_articles' | 'pt_adjective_agreement'
  | 'pt_object_pronouns' | 'pt_tu_voce' | 'pt_questions' | 'pt_contractions'
  // ── PORTUGUESE Section 5 — Cultural ──────────────────────────────────────
  | 'pt_world_map' | 'pt_holidays' | 'pt_food_guide'
  | 'pt_dialects' | 'pt_etiquette' | 'pt_currency' | 'pt_gestures'
  // ── PORTUGUESE Section 6 — Word families ─────────────────────────────────
  | 'pt_word_family'
  // ── PORTUGUESE Section 8 — Phonetics ─────────────────────────────────────
  | 'pt_nasal_vowels' | 'pt_portuguese_r' | 'pt_lh_nh'
  | 'pt_vowel_reduction' | 'pt_ti_di' | 'pt_stress_accent'
  | 'pt_eu_vs_br' | 'pt_linking' | 'pt_intonation'
  // ── GERMAN Section 3 — Grammar ───────────────────────────────────────────
  | 'de_sein' | 'de_haben' | 'de_werden'
  | 'de_regular_verbs' | 'de_modal_verbs' | 'de_reflexive'
  | 'de_perfekt' | 'de_prateritum' | 'de_perf_vs_prat'
  | 'de_futur' | 'de_konjunktiv2'
  | 'de_negation' | 'de_definite_articles' | 'de_indefinite_articles'
  | 'de_adj_endings' | 'de_accusative' | 'de_dative' | 'de_cases_overview'
  | 'de_separable_verbs' | 'de_word_order'
  | 'de_questions' | 'de_pronouns'
  // ── GERMAN Section 5 — Cultural ──────────────────────────────────────────
  | 'de_world_map' | 'de_holidays' | 'de_food_guide'
  | 'de_dialects' | 'de_etiquette' | 'de_currency' | 'de_gestures'
  // ── GERMAN Section 6 — Word families ─────────────────────────────────────
  | 'de_word_family'
  // ── GERMAN Section 8 — Phonetics ─────────────────────────────────────────
  | 'de_umlauts' | 'de_eszett' | 'de_german_r' | 'de_ch_sound'
  | 'de_long_short_vowels' | 'de_w_v_sound' | 'de_consonant_clusters'
  | 'de_word_stress' | 'de_diphthongs'
  // ── ITALIAN Section 3 — Grammar ──────────────────────────────────────────
  | 'it_essere' | 'it_avere' | 'it_stare' | 'it_regular_verbs'
  | 'it_modal_verbs' | 'it_reflexive'
  | 'it_passato_prossimo' | 'it_imperfetto' | 'it_past_comparison'
  | 'it_futuro' | 'it_condizionale'
  | 'it_negation' | 'it_definite_articles' | 'it_indefinite_articles'
  | 'it_adj_agreement' | 'it_articulated_prep'
  | 'it_object_pronouns' | 'it_subject_pronouns' | 'it_questions'
  | 'it_partitive' | 'it_imperative' | 'it_comparatives'
  // ── ITALIAN Section 5 — Cultural ──────────────────────────────────────────
  | 'it_world_map' | 'it_holidays' | 'it_food_guide'
  | 'it_dialects' | 'it_etiquette' | 'it_currency' | 'it_gestures'
  // ── ITALIAN Section 6 — Word families ─────────────────────────────────────
  | 'it_word_family'
  // ── ITALIAN Section 8 — Phonetics ─────────────────────────────────────────
  | 'it_cg_sounds' | 'it_sc_sounds' | 'it_gl_gn' | 'it_double_consonant'
  | 'it_z_sound' | 'it_rolled_r' | 'it_open_closed_vowels'
  | 'it_stress_patterns' | 'it_diphthongs'
  // ── JAPANESE Section 3 — Grammar ──────────────────────────────────────────
  | 'ja_hiragana' | 'ja_katakana' | 'ja_kanji_basics'
  | 'ja_particles' | 'ja_verb_groups' | 'ja_te_form'
  | 'ja_past_tense' | 'ja_negative_form' | 'ja_polite_form'
  | 'ja_adjectives' | 'ja_noun_phrases' | 'ja_question_words'
  | 'ja_numbers' | 'ja_counters' | 'ja_time_expressions'
  | 'ja_direction_movement' | 'ja_giving_receiving' | 'ja_potential_form'
  | 'ja_volitional_form' | 'ja_conditional' | 'ja_te_iru' | 'ja_honorifics'
  // ── JAPANESE Section 5 — Cultural ─────────────────────────────────────────
  | 'ja_world_map' | 'ja_holidays' | 'ja_food_guide'
  | 'ja_regions' | 'ja_etiquette' | 'ja_currency' | 'ja_pop_culture'
  // ── JAPANESE Section 6 — Word families ────────────────────────────────────
  | 'ja_word_family'
  // ── JAPANESE Section 8 — Phonetics ────────────────────────────────────────
  | 'ja_hiragana_chart' | 'ja_katakana_chart' | 'ja_vowel_sounds'
  | 'ja_consonant_sounds' | 'ja_long_vowels' | 'ja_double_consonants'
  | 'ja_pitch_accent' | 'ja_loanwords' | 'ja_n_sound';

function classifyFrenchGrammarType(title: string): GrammarChapterType | null {
  const lower = title.toLowerCase();

  // ── Section 3 — French grammar ──────────────────────────────────────────
  if (lower.includes('être') && lower.includes('avoir') && (lower.includes('vs') || lower.includes('auxiliaire') || lower.includes('versus') || lower.includes(' et '))) return 'fr_passe_compose_avoir'; // PC context
  if (lower === 'être' || lower.includes('le verbe être') || lower.includes('verb être') || (lower.startsWith('être') && !lower.includes('avoir'))) return 'fr_etre';
  if (lower === 'avoir' || lower.includes('le verbe avoir') || lower.includes('verb avoir') || (lower.startsWith('avoir') && !lower.includes('être'))) return 'fr_avoir';
  if ((lower === 'aller' || lower.includes('le verbe aller') || lower.includes('futur proche')) && !lower.includes('passe') && !lower.includes('passé')) return 'fr_aller';
  if (lower === 'faire' || lower.includes('le verbe faire') || lower.includes('expressions avec faire')) return 'fr_faire';

  if (lower.includes('-er verb') || lower.includes('er verb') || lower.includes('verbos -er') || lower.includes('verbes en -er') || lower.includes('parler') || lower.includes('aimer') || lower.includes('regular -er')) return 'fr_er_verbs';
  if ((lower.includes('-ir verb') || lower.includes('ir verb') || lower.includes('verbes en -ir') || lower.includes('finir') || lower.includes('regular -ir')) && !lower.includes('-re') && !lower.includes('re verb')) return 'fr_ir_verbs';
  if (lower.includes('-re verb') || lower.includes('re verb') || lower.includes('verbes en -re') || lower.includes('vendre') || lower.includes('attendre') || lower.includes('regular -re')) return 'fr_re_verbs';

  if (lower.includes('pouvoir') || lower.includes('vouloir') || lower.includes('devoir') || lower.includes('modal') || lower.includes('verbes modaux')) return 'fr_modals';
  if (lower.includes('reflexive') || lower.includes('réfléchi') || lower.includes('pronominal') || lower.includes('se lever') || lower.includes('verbos pronominaux') || lower.includes('verbes pronominaux')) return 'fr_reflexive';

  if ((lower.includes('passé composé') || lower.includes('passe compose') || lower.includes('past tense')) && lower.includes('être') && !lower.includes('avoir')) return 'fr_passe_compose_etre';
  if ((lower.includes('passé composé') || lower.includes('passe compose')) && lower.includes('être') && lower.includes('avoir')) return 'fr_pc_vs_imp';
  if (lower.includes('passé composé') || lower.includes('passe compose') || lower.includes('past perfect french')) return 'fr_passe_compose_avoir';

  if (lower.includes('imparfait') || (lower.includes('imperfect') && !lower.includes('vs') && !lower.includes('versus'))) return 'fr_imparfait';
  if ((lower.includes('passé') && lower.includes('imparfait')) || (lower.includes('pc') && lower.includes('imparfait')) || (lower.includes('passe compose') && lower.includes('imparfait')) || (lower.includes('past tense') && lower.includes('vs'))) return 'fr_pc_vs_imp';

  if ((lower.includes('futur') || lower.includes('future')) && !lower.includes('proche') && !lower.includes('aller')) return 'fr_future';
  if (lower.includes('conditionnel') || (lower.includes('conditional') && lower.includes('french'))) return 'fr_conditional';
  if (lower.includes('subjonctif') || (lower.includes('subjunctive') && lower.includes('french'))) return 'fr_subjunctive';

  if (lower.includes('négation') || lower.includes('negation') && (lower.includes('french') || lower.includes('français') || lower.includes('ne...pas') || lower.includes('ne pas'))) return 'fr_negation';
  if ((lower.includes('article') || lower.includes('genre') || lower.includes('gender')) && (lower.includes('french') || lower.includes('français') || lower.includes('le/la') || lower.includes('un/une') || lower.includes('du/de'))) return 'fr_articles_gender';
  if ((lower.includes('adjective') || lower.includes('adjectif') || lower.includes('accord')) && (lower.includes('french') || lower.includes('français') || lower.includes('bangs') || lower.includes('accords'))) return 'fr_adj_agree';
  if ((lower.includes('pronoun') || lower.includes('pronom') || lower.includes('object pronoun') || lower.includes('cod') || lower.includes('coi')) && (lower.includes('french') || lower.includes('français'))) return 'fr_object_pronouns';
  if ((lower.includes('tu') && lower.includes('vous')) && (lower.includes('french') || lower.includes('français') || lower.includes('tutoiement') || lower.includes('vouvoiement'))) return 'fr_tu_vous';
  if ((lower.includes('question') || lower.includes('interrogat') || lower.includes('est-ce que') || lower.includes('inversion')) && (lower.includes('french') || lower.includes('français'))) return 'fr_questions';

  // ── Section 4 — French Prepositions ─────────────────────────────────────
  if (lower.includes('temporal prep') || lower.includes('préposition de temps') || lower.includes('avant de') || lower.includes('depuis') || lower.includes('pendant')) return 'fr_temporal_prep';
  if (lower.includes('preposition') || lower.includes('préposition') || lower.includes('spatial') || lower.includes('dans') || lower.includes('à côté')) return 'fr_spatial_prep';

  // ── Section 5 — French Cultural ─────────────────────────────────────────
  if (lower.includes('francophone') || lower.includes('french-speaking world') || lower.includes('monde francophone') || lower.includes('la francophonie')) return 'fr_world_map';
  if (lower.includes('french holiday') || lower.includes('fête nationale') || lower.includes('bastille') || lower.includes('calendrier') || lower.includes('french public holiday') || lower.includes('fête française')) return 'fr_holiday_calendar';
  if (lower.includes('french food') || lower.includes('gastronomie française') || lower.includes('french cuisine') || lower.includes('french regional food') || lower.includes('cuisines françaises')) return 'fr_food_guide';
  if (lower.includes('french dialect') || lower.includes('variétés du français') || lower.includes('québécois') || lower.includes('français belge') || lower.includes('french variety') || lower.includes('français africain')) return 'fr_dialect_zones';
  if (lower.includes('la bise') || lower.includes('bisous') || lower.includes('french greeting') || lower.includes('cheek kiss') && lower.includes('french')) return 'fr_la_bise';
  if ((lower.includes('currency') || lower.includes('monnaie') || lower.includes('euro')) && (lower.includes('french') || lower.includes('français') || lower.includes('franco'))) return 'fr_currency';
  if ((lower.includes('gesture') || lower.includes('geste') || lower.includes('body language')) && (lower.includes('french') || lower.includes('français'))) return 'fr_gesture';

  // ── Section 6 — French Word Families ─────────────────────────────────────
  if (lower.includes('word family') || lower.includes('famille de mots') || lower.includes('famille lexicale') || lower.includes('word derivation') || lower.includes('famille lexicale')) return 'fr_word_family';

  // ── Section 7 — Canvas vocab (shared with /chat) — same SVG, French labels ──
  if (lower.includes('weather') || lower.includes('météo') || lower.includes('la météo') || lower.includes('le temps')) return 'weather_vocab';
  if (lower.includes('emotion') || lower.includes('émotion') || lower.includes('les émotions') || lower.includes('feeling') || lower.includes('sentiments')) return 'emotions_vocab';
  if (lower.includes('time') || lower.includes("l'heure") || lower.includes('la montre') || lower.includes('telling time') || lower.includes('quelle heure')) return 'telling_time';
  if (lower.includes('days') || lower.includes('week') || lower.includes('month') || lower.includes('jours') || lower.includes('mois') || lower.includes('calendrier') || lower.includes('la semaine')) return 'days_week';
  if (lower.includes('body part') || lower.includes('le corps') || lower.includes('corps humain') || lower.includes('body vocab')) return 'body_parts';
  if (lower.includes('face') || lower.includes('le visage') || lower.includes('facial feature')) return 'face_parts';
  if (lower.includes('hand') || lower.includes('la main') || lower.includes('les doigts') || lower.includes('finger')) return 'hand_parts';
  if (lower.includes('temperature') || lower.includes('la température') || lower.includes('thermomètre') || lower.includes('degrés')) return 'temperature_vocab';
  if (lower.includes('map') || lower.includes('carte') || lower.includes('french country') || lower.includes('pays francophone')) return 'country_dot_map';

  // ── Section 8 — French Phonetics ─────────────────────────────────────────
  if (lower.includes('nasal') || lower.includes('voyelle nasale') || lower.includes('nasale') || lower.includes('an/en') || lower.includes('in/ein') || lower.includes('on/om')) return 'fr_nasal_vowels';
  if (lower.includes('french r') || lower.includes('le r français') || lower.includes('r uvulaire') || lower.includes('uvular') || lower.includes('erre française')) return 'fr_french_r';
  if (lower.includes('liaison') || lower.includes('linking') && lower.includes('french') || lower.includes('enchaînement')) return 'fr_liaison';
  if ((lower.includes(' u ') || lower.includes('le son u') || lower.includes('french u') || lower.includes('[y]') || lower.includes('son [y]')) && !lower.includes('ou')) return 'fr_u_sound';
  if (lower.includes('eu') && (lower.includes('son') || lower.includes('oeu') || lower.includes('[ø]') || lower.includes('[œ]'))) return 'fr_eu_sound';
  if (lower.includes('silent consonant') || lower.includes('consonnes muettes') || lower.includes('finale muette') || lower.includes('h aspiré') || lower.includes('h muet')) return 'fr_silent_consonants';
  if (lower.includes('accent') && (lower.includes('écrit') || lower.includes('written') || lower.includes('accent aigu') || lower.includes('accent grave') || lower.includes('cédille') || lower.includes('cedille') || lower.includes('circumflex'))) return 'fr_written_accents';
  if (lower.includes('intonation') && (lower.includes('french') || lower.includes('français'))) return 'fr_intonation';
  if (lower.includes('élision') || lower.includes('elision') || lower.includes('contraction') && lower.includes('french') || lower.includes('au/aux') || lower.includes('du/des')) return 'fr_elision';
  if (lower.includes('pronunciation') || lower.includes('phonétique') || lower.includes('phonetic') && lower.includes('french') || lower.includes('sons du français')) return 'fr_nasal_vowels'; // default French phonetics entry

  return null;
}

function classifyPortugueseGrammarType(title: string): GrammarChapterType | null {
  const lower = title.toLowerCase();

  // ── Section 3 — Core verbs (most specific first) ─────────────────────────
  if ((lower.includes('ser') && lower.includes('estar')) || (lower.includes('ser vs') || lower.includes('ser e estar'))) return 'pt_ser_estar';
  if (lower === 'ser' || lower.includes('verbo ser') || (lower.startsWith('ser') && !lower.includes('estar'))) return 'pt_ser_only';
  if (lower === 'estar' || lower.includes('verbo estar') || (lower.startsWith('estar') && !lower.includes('ser'))) return 'pt_estar_only';
  if (lower.includes('ter') && !lower.includes('pret') && !lower.includes('perfect')) return 'pt_ter';
  if ((lower === 'ir' || lower.includes('verb ir') || lower.includes('verbo ir') || lower.includes('ir a ') || lower.includes('going to')) && !lower.includes('partir') && !lower.includes('pret')) return 'pt_ir';

  if (lower.includes('-ar verb') || lower.includes('ar verb') || lower.includes('verbos -ar') || lower.includes('falar') || lower.includes('regular -ar') || lower.includes('verbos em -ar')) return 'pt_ar_verbs';
  if ((lower.includes('-er verb') || lower.includes('er verb') || lower.includes('verbos -er') || lower.includes('comer') || lower.includes('regular -er') || lower.includes('verbos em -er')) && !lower.includes('-ir') && !lower.includes('-ar')) return 'pt_er_verbs';
  if (lower.includes('-ir verb') || lower.includes('ir verb') || lower.includes('verbos -ir') || lower.includes('partir') || lower.includes('regular -ir') || lower.includes('verbos em -ir')) return 'pt_ir_verbs';

  if (lower.includes('reflexive') || lower.includes('reflexivo') || lower.includes('reflexivo') || lower.includes('levantar-se') || lower.includes('verbos reflexivos')) return 'pt_reflexive';

  // ── Section 4 — Tenses ───────────────────────────────────────────────────
  if ((lower.includes('pretérito') || lower.includes('preterito') || lower.includes('pretérito')) && (lower.includes('vs') || lower.includes('versus') || lower.includes(' x ') || (lower.includes('perfeito') && lower.includes('imperfeito')))) return 'pt_pret_vs_imp';
  if (lower.includes('pretérito perfeito') || lower.includes('preterito perfeito') || lower.includes('simple past') && lower.includes('portuguese') || lower.includes('passé simple') || lower.includes('past tense') && !lower.includes('imperfect') && !lower.includes('imperfeito')) return 'pt_preterito_perfeito';
  if (lower.includes('pretérito imperfeito') || lower.includes('preterito imperfeito') || lower.includes('imperfeito') || lower.includes('imperfect') && !lower.includes('vs') && !lower.includes('versus')) return 'pt_preterito_imperfeito';
  if (lower.includes('futuro') || (lower.includes('future') && !lower.includes('conditional'))) return 'pt_future';
  if (lower.includes('condicional') || lower.includes('conditional')) return 'pt_conditional';
  if (lower.includes('subjuntivo') || lower.includes('subjunctive') || lower.includes('conjuntivo')) return 'pt_subjunctive';
  if (lower.includes('negação') || lower.includes('negacao') || lower.includes('negation') || lower.includes('negação') || lower.includes('não')) return 'pt_negation';
  if (lower.includes('género') || lower.includes('genero') || lower.includes('gender') || lower.includes('artigo') || lower.includes('article') || lower.includes('o/a ') || lower.includes('um/uma')) return 'pt_gender_articles';
  if (lower.includes('adjetivo') || lower.includes('adjective') || lower.includes('concordância') || lower.includes('concordancia') || lower.includes('agreement')) return 'pt_adjective_agreement';
  if (lower.includes('pronome') || lower.includes('pronoun') || lower.includes('objeto direto') || lower.includes('objeto indireto') || lower.includes('object pronoun') || lower.includes('me/te') || lower.includes('lhe')) return 'pt_object_pronouns';
  if ((lower.includes('tu') && lower.includes('você')) || lower.includes('tu vs você') || lower.includes('tu vs voce') || lower.includes('address form')) return 'pt_tu_voce';
  if (lower.includes('pergunta') || lower.includes('perguntas') || lower.includes('question') || lower.includes('interrogativa') || lower.includes('making questions')) return 'pt_questions';
  if (lower.includes('contração') || lower.includes('contracao') || lower.includes('contraction') || lower.includes('ao/à') || lower.includes('do/da') || lower.includes('no/na') || lower.includes('pelo/pela')) return 'pt_contractions';

  // ── Section 5 — Cultural ─────────────────────────────────────────────────
  if (lower.includes('lusophone') || lower.includes('lusófono') || lower.includes('lusofono') || lower.includes('mundo lusófono') || lower.includes('portuguese-speaking world') || lower.includes('mundo lusofono')) return 'pt_world_map';
  if (lower.includes('feriado') || lower.includes('holiday') && lower.includes('portugal') || lower.includes('holiday') && lower.includes('brazil') || lower.includes('holiday') && lower.includes('portuguese') || lower.includes('carnaval') || lower.includes('carnival')) return 'pt_holidays';
  if (lower.includes('gastronomia') || lower.includes('comida') && lower.includes('portu') || lower.includes('food guide') && lower.includes('portu') || lower.includes('culinária') || lower.includes('bacalhau') || lower.includes('feijoada')) return 'pt_food_guide';
  if (lower.includes('dialeto') || lower.includes('dialecto') || lower.includes('dialect') && lower.includes('portu') || lower.includes('eu-pt') || lower.includes('br-pt') || lower.includes('europeu') && lower.includes('brasileiro')) return 'pt_dialects';
  if (lower.includes('etiqueta') && lower.includes('portu') || lower.includes('greeting') && lower.includes('portu') || lower.includes('cumprimento') || lower.includes('saudação') || lower.includes('social etiquette') && lower.includes('portu')) return 'pt_etiquette';
  if (lower.includes('moeda') || lower.includes('euro') && lower.includes('real') || lower.includes('currency') && lower.includes('portu') || lower.includes('real brasileiro') || lower.includes('brl') || lower.includes('eur') && lower.includes('portu')) return 'pt_currency';
  if (lower.includes('gesto') && lower.includes('portu') || lower.includes('gesture') && lower.includes('portu') || lower.includes('linguagem corporal') && lower.includes('portu')) return 'pt_gestures';

  // ── Section 6 — Word families ─────────────────────────────────────────────
  if (lower.includes('word family') || lower.includes('família de palavras') || lower.includes('familia de palavras') || lower.includes('derivação') || lower.includes('derivacao')) return 'pt_word_family';

  // ── Section 7 — Canvas vocab (shared types, handled by language prop) ────
  // Portuguese uses the same canvas card type names as Spanish — no separate pt_weather_vocab etc.
  // The language='portuguese' prop will be passed through to the cards.

  // ── Section 8 — Phonetics ────────────────────────────────────────────────
  if (lower.includes('nasal') && lower.includes('portu') || lower.includes('vogal nasal') || lower.includes('nasal vowel') && lower.includes('portu') || lower.includes('ão') || lower.includes('ã ') || lower.includes(' ão') || lower.includes('vogais nasais')) return 'pt_nasal_vowels';
  if (lower.includes('r português') || lower.includes('portuguese r') || lower.includes('o r ') && lower.includes('portu') || lower.includes('r sound') && lower.includes('portu') || lower.includes('guttural r') || lower.includes('r uvular') && lower.includes('portu')) return 'pt_portuguese_r';
  if (lower.includes('lh') || lower.includes('nh') || lower.includes('lh e nh') || lower.includes('lh/nh') || lower.includes('digraph') && lower.includes('portu')) return 'pt_lh_nh';
  if (lower.includes('vowel reduction') && lower.includes('portu') || lower.includes('redução vocálica') || lower.includes('reducao vocalica') || lower.includes('unstressed vowel') && lower.includes('portu') || lower.includes('european portuguese vowel')) return 'pt_vowel_reduction';
  if (lower.includes('ti') && lower.includes('di') || lower.includes('palataliz') && lower.includes('portu') || lower.includes('tch') && lower.includes('portu') || lower.includes('ti/di') || lower.includes('ti e di')) return 'pt_ti_di';
  if (lower.includes('acentuação') || lower.includes('acentuacao') || lower.includes('acento') && lower.includes('portu') || lower.includes('accent mark') && lower.includes('portu') || lower.includes('stress rule') && lower.includes('portu')) return 'pt_stress_accent';
  if (lower.includes('eu-pt vs br') || lower.includes('eu vs br') || lower.includes('european vs brazilian') || lower.includes('portugal vs brazil') && lower.includes('pronunci') || lower.includes('eu-pt vs br-pt')) return 'pt_eu_vs_br';
  if (lower.includes('ligação') && lower.includes('portu') || lower.includes('linking') && lower.includes('portu') || lower.includes('sandhi') && lower.includes('portu') || lower.includes('ligação fonética')) return 'pt_linking';
  if (lower.includes('entoação') || lower.includes('entoacao') || lower.includes('intonation') && lower.includes('portu') || lower.includes('melodia') && lower.includes('portu')) return 'pt_intonation';
  if (lower.includes('pronunciation') && lower.includes('portu') || lower.includes('pronunciação') || lower.includes('phonetic') && lower.includes('portu') || lower.includes('fonética portuguesa')) return 'pt_nasal_vowels'; // default entry

  return null;
}

function classifyGermanGrammarType(title: string): GrammarChapterType | null {
  const lower = title.toLowerCase();

  // ── Core verbs ────────────────────────────────────────────────────────────
  if (lower === 'sein' || lower.includes('das verb sein') || lower.includes('verb sein') || (lower.startsWith('sein') && !lower.includes('haben') && !lower.includes('werden'))) return 'de_sein';
  if ((lower === 'haben' || lower.includes('das verb haben') || lower.includes('verb haben') || (lower.startsWith('haben') && !lower.includes('sein') && !lower.includes('werden'))) && !lower.includes('perfekt') && !lower.includes('partizip')) return 'de_haben';
  if (lower === 'werden' || lower.includes('das verb werden') || lower.includes('verb werden') || (lower.startsWith('werden') && !lower.includes('konjunktiv'))) return 'de_werden';

  // ── Regular and modal verbs ───────────────────────────────────────────────
  if (lower.includes('regular') && lower.includes('verb') && lower.includes('german') || lower.includes('-en verb') || lower.includes('regelm') || lower.includes('schwache verb') || lower.includes('spielen') && lower.includes('lernen')) return 'de_regular_verbs';
  if (lower.includes('modalverb') || lower.includes('modal verb') && lower.includes('german') || lower.includes('können') || lower.includes('müssen') && lower.includes('wollen') || lower.includes('dürfen') || (lower.includes('sollen') && lower.includes('können'))) return 'de_modal_verbs';
  if (lower.includes('reflexiv') || lower.includes('reflexive verb') && lower.includes('german') || lower.includes('sich waschen') || lower.includes('sich freuen') || lower.includes('reflexive') && lower.includes('sich')) return 'de_reflexive';

  // ── Tenses ────────────────────────────────────────────────────────────────
  if ((lower.includes('perf') || lower.includes('präteritum')) && (lower.includes('vs') || lower.includes('versus') || lower.includes('or präteritum') || lower.includes('compared') || lower.includes('when to use'))) return 'de_perf_vs_prat';
  if (lower.includes('perfekt') || lower.includes('conversational past') && lower.includes('german') || lower.includes('partizip ii') || lower.includes('past participle') && lower.includes('german') || lower.includes('haben + partizip') || lower.includes('sein + partizip')) return 'de_perfekt';
  if (lower.includes('präteritum') || lower.includes('prateritum') || lower.includes('narrative past') && lower.includes('german') || lower.includes('simple past') && lower.includes('german') || lower.includes('war') && lower.includes('hatte') && lower.includes('german')) return 'de_prateritum';
  if (lower.includes('futur') || lower.includes('future') && lower.includes('german') || lower.includes('werden +') || lower.includes('futur i')) return 'de_futur';
  if (lower.includes('konjunktiv') || lower.includes('konjunktiv ii') || lower.includes('subjunctive') && lower.includes('german') || lower.includes('würde') || lower.includes('conditional') && lower.includes('german')) return 'de_konjunktiv2';

  // ── Grammar rules ─────────────────────────────────────────────────────────
  if (lower.includes('vernein') || lower.includes('negation') && lower.includes('german') || lower.includes('nicht') && lower.includes('kein') || lower.includes('kein/keine') || lower.includes('nicht/kein')) return 'de_negation';
  if ((lower.includes('der die das') || lower.includes('bestimmte') || lower.includes('definite article') && lower.includes('german') || lower.includes('gender') && lower.includes('german') && !lower.includes('indefinite') && !lower.includes('kein')) && !lower.includes('kein')) return 'de_definite_articles';
  if (lower.includes('ein eine') || lower.includes('unbestimmte') || lower.includes('indefinite article') && lower.includes('german') || lower.includes('kein/keine') && lower.includes('ein/eine')) return 'de_indefinite_articles';
  if (lower.includes('adjektivend') || lower.includes('adjective ending') && lower.includes('german') || lower.includes('adjektiv') && lower.includes('endung') || lower.includes('weak ending') || lower.includes('strong ending') && lower.includes('german')) return 'de_adj_endings';
  if (lower.includes('akkusativ') || lower.includes('accusative') && lower.includes('german') || lower.includes('direct object') && lower.includes('german') || lower.includes('den/die/das') || (lower.includes('akk') && lower.includes('german'))) return 'de_accusative';
  if (lower.includes('dativ') || lower.includes('dative') && lower.includes('german') || lower.includes('indirect object') && lower.includes('german') || lower.includes('dem/der/dem') || (lower.includes('dat') && lower.includes('german') && !lower.includes('dat '))) return 'de_dative';
  if (lower.includes('vier fälle') || lower.includes('four cases') && lower.includes('german') || lower.includes('nominativ') || lower.includes('genitiv') || (lower.includes('case') && lower.includes('german') && !lower.includes('accusative') && !lower.includes('dative') && !lower.includes('adjective')) || lower.includes('wechselpräp')) return 'de_cases_overview';
  if (lower.includes('trennbar') || lower.includes('separable verb') && lower.includes('german') || lower.includes('trennbare') || lower.includes('aufmachen') || lower.includes('anrufen') && lower.includes('german') || lower.includes('prefix') && lower.includes('german') && lower.includes('verb')) return 'de_separable_verbs';
  if (lower.includes('wortstellung') || lower.includes('word order') && lower.includes('german') || lower.includes('verb second') || lower.includes('v2') && lower.includes('german') || lower.includes('nebensatz') || lower.includes('hauptsatz') && lower.includes('verb') || lower.includes('verb final') && lower.includes('german')) return 'de_word_order';
  if (lower.includes('fragen') || lower.includes('question') && lower.includes('german') || lower.includes('w-frage') || lower.includes('fragewort') || lower.includes('ja/nein') || lower.includes('wer/was/wo') || lower.includes('wohin') && lower.includes('woher')) return 'de_questions';
  if (lower.includes('personalpron') || lower.includes('personal pronoun') && lower.includes('german') || lower.includes('du/sie') || lower.includes('ich/du') || lower.includes('pronoun') && lower.includes('german') && !lower.includes('reflexive')) return 'de_pronouns';

  // ── Cultural ─────────────────────────────────────────────────────────────
  if (lower.includes('dach') || lower.includes('deutschsprachig') || lower.includes('german-speaking world') || lower.includes('german speaking world') || lower.includes('österreich') && lower.includes('schweiz') && lower.includes('world') || lower.includes('wo wird deutsch') || lower.includes('wo spricht man deutsch')) return 'de_world_map';
  if ((lower.includes('feiertag') || lower.includes('holiday') && lower.includes('german') || lower.includes('oktoberfest') || lower.includes('weihnacht') || lower.includes('ostern') && lower.includes('german') || lower.includes('festival') && lower.includes('german')) && !lower.includes('swiss')) return 'de_holidays';
  if (lower.includes('deutsche küche') || lower.includes('german food') || lower.includes('german cuisine') || lower.includes('bayerisch') && lower.includes('essen') || lower.includes('weißwurst') || lower.includes('brot') && lower.includes('german') || lower.includes('wiener schnitzel')) return 'de_food_guide';
  if (lower.includes('deutsch') && lower.includes('dialekt') || lower.includes('german dialect') || lower.includes('bairisch') || lower.includes('plattdeutsch') || lower.includes('kölsch') && lower.includes('dialect') || lower.includes('hochdeutsch') && lower.includes('dialekt')) return 'de_dialects';
  if (lower.includes('etikette') && lower.includes('deutsch') || lower.includes('german etiquette') || lower.includes('german greeting') || lower.includes('german culture') && (lower.includes('greet') || lower.includes('formal') || lower.includes('du/sie')) || lower.includes('pünktlichkeit') || lower.includes('german formal')) return 'de_etiquette';
  if (lower.includes('euro') && lower.includes('german') || lower.includes('währung') || lower.includes('german currency') || lower.includes('schweizer franken') || lower.includes('chf') && lower.includes('german') || lower.includes('currency') && lower.includes('german')) return 'de_currency';
  if (lower.includes('geste') && lower.includes('deutsch') || lower.includes('german gesture') || lower.includes('german body language') || lower.includes('tischklopfen') || lower.includes('german cultural gesture')) return 'de_gestures';

  // ── Word families ─────────────────────────────────────────────────────────
  if (lower.includes('wortfamilie') || lower.includes('word family') && lower.includes('german') || lower.includes('deutsch') && lower.includes('word family') || lower.includes('wortbildung') || lower.includes('wortstamm')) return 'de_word_family';

  // ── Phonetics ─────────────────────────────────────────────────────────────
  if (lower.includes('umlaut') || lower.includes('ä') && lower.includes('ö') && lower.includes('ü') || lower.includes('ö/ü/ä') || lower.includes('umlautvokal')) return 'de_umlauts';
  if (lower.includes('eszett') || lower.includes('scharfes s') || lower.includes(' ß ') || lower.startsWith('ß') || lower.includes('ß vs ss') || lower.includes('ss vs ß')) return 'de_eszett';
  if (lower.includes('german r') || lower.includes('uvular r') && lower.includes('german') || lower.includes('das r ') && lower.includes('deutsch') || lower.includes('german r sound') || lower.includes('r sound') && lower.includes('german')) return 'de_german_r';
  if (lower.includes(' ch ') || lower.includes('ich-laut') || lower.includes('ach-laut') || lower.includes('das ch') || lower.includes('ch sound') && lower.includes('german')) return 'de_ch_sound';
  if (lower.includes('langer vokal') || lower.includes('kurzer vokal') || lower.includes('long vowel') && lower.includes('german') || lower.includes('short vowel') && lower.includes('german') || lower.includes('vowel length') && lower.includes('german')) return 'de_long_short_vowels';
  if (lower.includes('german w') || lower.includes('das w ') && lower.includes('german') || lower.includes('w vs v') && lower.includes('german') || lower.includes('w und v') || lower.includes('v sound') && lower.includes('german')) return 'de_w_v_sound';
  if (lower.includes('sp/st') || lower.includes('konsonantencluster') || lower.includes('consonant cluster') && lower.includes('german') || lower.includes('sch sound') || lower.includes('german z') || (lower.includes('sp ') && lower.includes('st ') && lower.includes('german'))) return 'de_consonant_clusters';
  if (lower.includes('wortakzent') || lower.includes('word stress') && lower.includes('german') || lower.includes('german stress') || lower.includes('betonung') && lower.includes('deutsch') || lower.includes('german accent') && lower.includes('syllable')) return 'de_word_stress';
  if (lower.includes('diphthong') && lower.includes('german') || lower.includes('ei/au/eu') || lower.includes('german diphthong') || lower.includes('ei vs ie') || lower.includes('au/eu') && lower.includes('german')) return 'de_diphthongs';
  if (lower.includes('pronunciation') && lower.includes('german') || lower.includes('aussprache') || lower.includes('phonetic') && lower.includes('german') || lower.includes('german sound') || lower.includes('deutsch aussprache')) return 'de_umlauts'; // default entry

  return null;
}

function classifyItalianGrammarType(title: string): GrammarChapterType | null {
  const lower = title.toLowerCase();

  // ── Section 3 — Core verbs ────────────────────────────────────────────────
  if ((lower.includes('essere') && lower.includes('avere')) || (lower.includes('essere') && lower.includes('vs') && lower.includes('avere'))) return 'it_passato_prossimo';
  if (lower === 'essere' || lower.includes('verbo essere') || lower.includes('il verbo essere') || (lower.startsWith('essere') && !lower.includes('avere'))) return 'it_essere';
  if (lower === 'avere' || lower.includes('verbo avere') || lower.includes('il verbo avere') || (lower.startsWith('avere') && !lower.includes('essere'))) return 'it_avere';
  if (lower === 'stare' || lower.includes('verbo stare') || lower.includes('il verbo stare') || lower.includes('stare + gerundio') || lower.includes('progressive') && lower.includes('ital')) return 'it_stare';
  if (lower.includes('-are verb') || lower.includes('are verb') || lower.includes('verbos -are') || lower.includes('verbi in -are') || lower.includes('parlare') || lower.includes('regular verbs') && lower.includes('ital') || lower.includes('verbi regolari')) return 'it_regular_verbs';
  if (lower.includes('potere') || lower.includes('volere') || lower.includes('dovere') || lower.includes('modal') && lower.includes('ital') || lower.includes('verbi modali')) return 'it_modal_verbs';
  if (lower.includes('reflexive') && lower.includes('ital') || lower.includes('verbi riflessivi') || lower.includes('riflessivi') || lower.includes('lavarsi') || lower.includes('alzarsi')) return 'it_reflexive';

  // ── Tenses ────────────────────────────────────────────────────────────────
  if ((lower.includes('passato prossimo') || lower.includes('present perfect') && lower.includes('ital')) && (lower.includes('vs') || lower.includes('imperfetto') || lower.includes('versus'))) return 'it_past_comparison';
  if (lower.includes('passato prossimo') || lower.includes('present perfect') && lower.includes('ital') || lower.includes('ho/è + particip')) return 'it_passato_prossimo';
  if (lower.includes('imperfetto') || lower.includes('imperfect') && !lower.includes('vs') && !lower.includes('versus') && lower.includes('ital')) return 'it_imperfetto';
  if ((lower.includes('passato') && lower.includes('imperfetto')) || (lower.includes('past') && lower.includes('imperfect') && lower.includes('ital') && lower.includes('vs'))) return 'it_past_comparison';
  if (lower.includes('futuro') || lower.includes('future') && lower.includes('ital') || lower.includes('future simple') && lower.includes('ital')) return 'it_futuro';
  if (lower.includes('condizionale') || lower.includes('conditional') && lower.includes('ital')) return 'it_condizionale';
  if (lower.includes('negazione') || lower.includes('negation') && lower.includes('ital') || lower.includes('non +') || lower.includes('negativa') && lower.includes('ital')) return 'it_negation';
  if ((lower.includes('articolo determinativo') || lower.includes('definite article') && lower.includes('ital') || lower.includes('il/la/lo') || lower.includes('il/lo/la')) && !lower.includes('indefinite') && !lower.includes('indeterminativo')) return 'it_definite_articles';
  if (lower.includes('articolo indeterminativo') || lower.includes('indefinite article') && lower.includes('ital') || lower.includes('un/una/uno') || lower.includes('un/una')) return 'it_indefinite_articles';
  if (lower.includes('aggettivo') || lower.includes('adjective') && lower.includes('ital') || lower.includes('agreement') && lower.includes('ital') || lower.includes('concordanza')) return 'it_adj_agreement';
  if (lower.includes('preposizione articolata') || lower.includes('articulated prep') || lower.includes('del/della') || lower.includes('al/alla') || lower.includes('preposizioni articolate')) return 'it_articulated_prep';
  if ((lower.includes('pronome oggetto') || lower.includes('object pronoun') && lower.includes('ital') || lower.includes('mi/ti/lo/la') || lower.includes('direct object') && lower.includes('ital'))) return 'it_object_pronouns';
  if ((lower.includes('pronome soggetto') || lower.includes('subject pronoun') && lower.includes('ital') || lower.includes('io/tu/lui') || lower.includes('personal pronoun') && lower.includes('ital'))) return 'it_subject_pronouns';
  if ((lower.includes('domanda') || lower.includes('question') && lower.includes('ital') || lower.includes('interrogativa') || lower.includes('che cosa') || lower.includes('interrogative') && lower.includes('ital'))) return 'it_questions';
  if (lower.includes('partitivo') || lower.includes('partitive') && lower.includes('ital') || lower.includes('del/della/degli') || lower.includes('some/any') && lower.includes('ital')) return 'it_partitive';
  if (lower.includes('imperativo') || lower.includes('imperative') && lower.includes('ital') || lower.includes('command') && lower.includes('ital')) return 'it_imperative';
  if (lower.includes('comparativo') || lower.includes('superlativo') || lower.includes('comparative') && lower.includes('ital') || lower.includes('più di') || lower.includes('più...di')) return 'it_comparatives';

  // ── Section 5 — Cultural ─────────────────────────────────────────────────
  if (lower.includes('italophone') || lower.includes('italofonos') || lower.includes('italian-speaking world') || lower.includes('mondo italofono') || lower.includes('dove si parla italiano')) return 'it_world_map';
  if ((lower.includes('holiday') && lower.includes('ital')) || lower.includes('ferragosto') || lower.includes('feste italiane') || lower.includes('ferie') && lower.includes('ital') || lower.includes('festa') && lower.includes('ital') || lower.includes('capodanno') && lower.includes('ital')) return 'it_holidays';
  if ((lower.includes('food') || lower.includes('cibo') || lower.includes('cucina')) && lower.includes('ital') || lower.includes('gastronomia italiana') || lower.includes('pizza') && lower.includes('pasta') || lower.includes('italian cuisine')) return 'it_food_guide';
  if ((lower.includes('dialect') || lower.includes('dialetto')) && lower.includes('ital') || lower.includes('dialetti italiani') || lower.includes('toscano') && lower.includes('siciliano') || lower.includes('veneto') && lower.includes('dialect')) return 'it_dialects';
  if ((lower.includes('etiquette') || lower.includes('etichetta')) && lower.includes('ital') || lower.includes('greeting') && lower.includes('ital') || lower.includes('bella figura') || lower.includes('italian social') || lower.includes('italian culture') && lower.includes('greet')) return 'it_etiquette';
  if ((lower.includes('currency') || lower.includes('valuta') || lower.includes('euro')) && lower.includes('ital') || lower.includes('lira') && lower.includes('ital') || lower.includes('moneta') && lower.includes('ital')) return 'it_currency';
  if ((lower.includes('gesture') || lower.includes('gesto')) && lower.includes('ital') || lower.includes('gesti italiani') || lower.includes('italian body language') || lower.includes('italian gesture')) return 'it_gestures';

  // ── Section 6 — Word families ─────────────────────────────────────────────
  if (lower.includes('word family') && lower.includes('ital') || lower.includes('famiglia di parole') || lower.includes('famiglie di parole') || lower.includes('derivazione') && lower.includes('ital') || lower.includes('vocabolario') && lower.includes('famil')) return 'it_word_family';

  // ── Section 8 — Phonetics ─────────────────────────────────────────────────
  if (lower.includes('c/g') && lower.includes('ital') || lower.includes('ci/ce') || lower.includes('chi/che') || lower.includes('cg sound') || lower.includes('ca/co/cu') && lower.includes('ital')) return 'it_cg_sounds';
  if (lower.includes('sc sound') || lower.includes('sci/sce') || lower.includes('schi/sche') || lower.includes('sc ital')) return 'it_sc_sounds';
  if (lower.includes('gl/gn') || lower.includes('gli ') && lower.includes('gn') || lower.includes('gnocchi') && lower.includes('sound') || lower.includes('foglio') && lower.includes('sound')) return 'it_gl_gn';
  if (lower.includes('doppia') || lower.includes('double consonant') && lower.includes('ital') || lower.includes('consonante doppia') || lower.includes('geminate') && lower.includes('ital') || lower.includes('doppio') && lower.includes('consonant')) return 'it_double_consonant';
  if (lower.includes('z sound') && lower.includes('ital') || lower.includes('zeta') && lower.includes('ital') || (lower.includes('/ts/') && lower.includes('ital')) || (lower.includes('/dz/') && lower.includes('ital'))) return 'it_z_sound';
  if (lower.includes('rolled r') && lower.includes('ital') || lower.includes('italian r') || lower.includes('r italiano') || lower.includes('vibrant') && lower.includes('ital')) return 'it_rolled_r';
  if (lower.includes('open') && lower.includes('closed') && lower.includes('vowel') && lower.includes('ital') || lower.includes('vocale aperta') || lower.includes('vocale chiusa') || lower.includes('è/é') || lower.includes('ò/ó')) return 'it_open_closed_vowels';
  if (lower.includes('stress') && lower.includes('ital') || lower.includes('accento tonico') || lower.includes('italian stress') || lower.includes('word stress') && lower.includes('ital') || lower.includes('accentazione') && lower.includes('ital')) return 'it_stress_patterns';
  if (lower.includes('diphthong') && lower.includes('ital') || lower.includes('dittongo') || lower.includes('trittongo') || lower.includes('ie/uo') && lower.includes('ital') || lower.includes('italian diphthong')) return 'it_diphthongs';
  if (lower.includes('pronunciation') && lower.includes('ital') || lower.includes('fonetica italiana') || lower.includes('phonetic') && lower.includes('ital') || lower.includes('italian sound') || lower.includes('pronuncia italiana')) return 'it_cg_sounds';

  return null;
}

function classifyJapaneseGrammarType(title: string): GrammarChapterType | null {
  const lower = title.toLowerCase();

  // ── Section 3 — Writing systems ──────────────────────────────────────────
  if (lower.includes('hiragana') && !lower.includes('chart') && !lower.includes('完全') && !lower.includes('complete')) return 'ja_hiragana';
  if (lower.includes('katakana') && !lower.includes('chart') && !lower.includes('完全') && !lower.includes('complete')) return 'ja_katakana';
  if (lower.includes('kanji') && !lower.includes('family') && !lower.includes('famil')) return 'ja_kanji_basics';

  // ── Section 3 — Grammar ───────────────────────────────────────────────────
  if (lower.includes('particle') || lower.includes('助詞') || lower.includes('joshi') || lower.includes('は/が') || lower.includes('wa/ga') || lower.includes('topic marker') || lower.includes('object marker')) return 'ja_particles';
  if (lower.includes('verb group') || lower.includes('godan') || lower.includes('ichidan') || lower.includes('五段') || lower.includes('一段') || lower.includes('verb class') || lower.includes('u-verb') || lower.includes('ru-verb')) return 'ja_verb_groups';
  if (lower.includes('te-form') || lower.includes('te form') || lower.includes('て形') || lower.includes('て-form') || lower.includes('teform') || lower.includes('て + ') || (lower.includes('て') && lower.includes('form'))) return 'ja_te_form';
  if (lower.includes('past tense') || lower.includes('た形') || lower.includes('ta-form') || lower.includes('ta form') || lower.includes('過去形') || lower.includes('kakokei') || lower.includes('past form')) return 'ja_past_tense';
  if (lower.includes('negative') && (lower.includes('japan') || lower.includes('japanese') || lower.includes('ない') || lower.includes('ません') || lower.includes('nai') || lower.includes('masen')) || lower.includes('否定形')) return 'ja_negative_form';
  if (lower.includes('polite') && (lower.includes('japan') || lower.includes('japanese') || lower.includes('ます') || lower.includes('です') || lower.includes('masu') || lower.includes('desu')) || lower.includes('丁寧語') || lower.includes('masu form')) return 'ja_polite_form';
  if ((lower.includes('adjective') || lower.includes('形容詞')) && (lower.includes('japan') || lower.includes('japanese') || lower.includes('い-adj') || lower.includes('な-adj') || lower.includes('i-adj') || lower.includes('na-adj'))) return 'ja_adjectives';
  if (lower.includes('noun phrase') || lower.includes('名詞句') || lower.includes('の particle') || lower.includes('の as') || lower.includes('nominalizer') || lower.includes('nominalization') || (lower.includes('の') && lower.includes('modifier'))) return 'ja_noun_phrases';
  if (lower.includes('question word') || lower.includes('疑問詞') || lower.includes('なに') || lower.includes('どこ') || lower.includes('interrogative') && (lower.includes('japan') || lower.includes('japanese')) || lower.includes('gimonshi')) return 'ja_question_words';
  if ((lower.includes('number') || lower.includes('数字') || lower.includes('すうじ')) && (lower.includes('japan') || lower.includes('japanese') || lower.includes('kanji num') || lower.includes('counting'))) return 'ja_numbers';
  if (lower.includes('counter') || lower.includes('助数詞') || lower.includes('josūshi') || lower.includes('〜本') || lower.includes('〜枚') || lower.includes('classifier') && lower.includes('japan')) return 'ja_counters';
  if ((lower.includes('time expression') || lower.includes('時間表現') || lower.includes('jikan') && lower.includes('expression') || lower.includes('temporal') && lower.includes('japan') || (lower.includes('kinō') || lower.includes('kinou') || lower.includes('ashita') || lower.includes('kyō') || lower.includes('kyou'))) && !lower.includes('telling time') && !lower.includes('clock')) return 'ja_time_expressions';
  if (lower.includes('direction') || lower.includes('movement') || lower.includes('方向') || lower.includes('移動') || lower.includes('iku') && lower.includes('kuru') || lower.includes('go/come') || lower.includes('transportation') && lower.includes('japan')) return 'ja_direction_movement';
  if (lower.includes('giving') || lower.includes('receiving') || lower.includes('あげる') || lower.includes('もらう') || lower.includes('くれる') || lower.includes('ageru') || lower.includes('morau') || lower.includes('kureru') || lower.includes('やり・もらい')) return 'ja_giving_receiving';
  if (lower.includes('potential') || lower.includes('可能形') || lower.includes('kanō') || lower.includes('dekiru') || lower.includes('できる') || lower.includes('can do') && lower.includes('japan')) return 'ja_potential_form';
  if (lower.includes('volitional') || lower.includes('意志形') || lower.includes('ましょう') || lower.includes('masho') || lower.includes('let\'s') && lower.includes('japan') || lower.includes('たい') && lower.includes('japan') || lower.includes('want to') && lower.includes('japan')) return 'ja_volitional_form';
  if (lower.includes('conditional') || lower.includes('条件形') || lower.includes('〜たら') || lower.includes('〜ば') || lower.includes('〜なら') || lower.includes('tara') && lower.includes('japan') || lower.includes('if clause') && lower.includes('japan')) return 'ja_conditional';
  if (lower.includes('〜ている') || lower.includes('te iru') || lower.includes('te + iru') || lower.includes('ています') || lower.includes('teiru') || lower.includes('ongoing') && lower.includes('japan') || lower.includes('resultant state') && lower.includes('japan')) return 'ja_te_iru';
  if (lower.includes('honorific') || lower.includes('敬語') || lower.includes('keigo') || lower.includes('尊敬語') || lower.includes('謙譲語') || lower.includes('polite speech') && lower.includes('japan') || lower.includes('〜さん') || lower.includes('speech level')) return 'ja_honorifics';

  // ── Section 5 — Cultural ─────────────────────────────────────────────────
  if (lower.includes('japanophone') || lower.includes('japanese-speaking world') || lower.includes('japanese speaking world') || lower.includes('nihongo no sekai') || lower.includes('日本語の世界')) return 'ja_world_map';
  if ((lower.includes('holiday') && lower.includes('japan')) || lower.includes('golden week') || lower.includes('ゴールデンウィーク') || lower.includes('お盆') || lower.includes('japanese festival') || lower.includes('japanese public holiday') || lower.includes('祝日') || lower.includes('shukujitsu')) return 'ja_holidays';
  if ((lower.includes('food') || lower.includes('cuisine') || lower.includes('料理') || lower.includes('ryōri')) && lower.includes('japan') || lower.includes('washoku') || lower.includes('和食') || lower.includes('japanese food') || lower.includes('sushi') && lower.includes('ramen')) return 'ja_food_guide';
  if ((lower.includes('region') || lower.includes('prefecture') || lower.includes('都道府県') || lower.includes('地方')) && lower.includes('japan') || lower.includes('kanto') && lower.includes('kansai') || lower.includes('hokkaidō') && lower.includes('japan')) return 'ja_regions';
  if ((lower.includes('etiquette') || lower.includes('manner') || lower.includes('マナー') || lower.includes('customs')) && lower.includes('japan') || lower.includes('japanese etiquette') || lower.includes('bowing') && lower.includes('japan') || lower.includes('omotenashi') || lower.includes('おもてなし')) return 'ja_etiquette';
  if ((lower.includes('currency') || lower.includes('yen') || lower.includes('円') || lower.includes('money')) && lower.includes('japan') || lower.includes('japanese yen') || lower.includes('日本円')) return 'ja_currency';
  if (lower.includes('pop culture') || lower.includes('anime') && lower.includes('manga') || lower.includes('j-pop') || lower.includes('jpop') || lower.includes('cool japan') || lower.includes('クールジャパン') || lower.includes('アニメ') && lower.includes('マンガ')) return 'ja_pop_culture';

  // ── Section 6 — Word families ─────────────────────────────────────────────
  if (lower.includes('word family') && lower.includes('japan') || lower.includes('kanji family') || lower.includes('漢字') && lower.includes('family') || lower.includes('kanji radical') && lower.includes('family') || lower.includes('日本語') && lower.includes('word family')) return 'ja_word_family';

  // ── Section 8 — Phonetics ─────────────────────────────────────────────────
  if ((lower.includes('hiragana') && (lower.includes('chart') || lower.includes('complete') || lower.includes('完全') || lower.includes('all') || lower.includes('table'))) || lower.includes('hiragana chart')) return 'ja_hiragana_chart';
  if ((lower.includes('katakana') && (lower.includes('chart') || lower.includes('complete') || lower.includes('完全') || lower.includes('all') || lower.includes('table'))) || lower.includes('katakana chart')) return 'ja_katakana_chart';
  if (lower.includes('japanese vowel') || lower.includes('母音') || lower.includes('boin') || lower.includes('a/i/u/e/o') && lower.includes('japan') || lower.includes('vowel sound') && lower.includes('japan') || lower.includes('5 vowel')) return 'ja_vowel_sounds';
  if (lower.includes('consonant sound') && lower.includes('japan') || lower.includes('子音') || lower.includes('し/し') || lower.includes('japanese r') || lower.includes('special consonant') && lower.includes('japan') || lower.includes('shi/chi/tsu') || lower.includes('japanese pronunciation') && lower.includes('consonant')) return 'ja_consonant_sounds';
  if (lower.includes('long vowel') && lower.includes('japan') || lower.includes('長音') || lower.includes('chōon') || lower.includes('vowel length') && lower.includes('japan') || lower.includes('macron') && lower.includes('japan') || lower.includes('ā/ī/ū/ē/ō')) return 'ja_long_vowels';
  if (lower.includes('double consonant') && lower.includes('japan') || lower.includes('促音') || lower.includes('sokuon') || lower.includes('っ') && lower.includes('double') || lower.includes('geminate') && lower.includes('japan')) return 'ja_double_consonants';
  if (lower.includes('pitch accent') || lower.includes('アクセント') || lower.includes('音程アクセント') || lower.includes('heiban') || lower.includes('atamadaka') || lower.includes('pitch') && lower.includes('japan')) return 'ja_pitch_accent';
  if (lower.includes('loanword') || lower.includes('外来語') || lower.includes('gairaigo') || lower.includes('katakana word') || lower.includes('borrowed word') && lower.includes('japan') || lower.includes('katakana loanword')) return 'ja_loanwords';
  if (lower.includes('ん') && (lower.includes('sound') || lower.includes('syllabic')) || lower.includes('syllabic n') || lower.includes('撥音') || lower.includes('hatsuon') || lower.includes('n sound') && lower.includes('japan') || lower.includes('moraic n')) return 'ja_n_sound';
  if (lower.includes('pronunciation') && lower.includes('japan') || lower.includes('fonetica') && lower.includes('japan') || lower.includes('phonetic') && lower.includes('japan') || lower.includes('発音') || lower.includes('hatsuon') && lower.includes('guide')) return 'ja_hiragana_chart'; // default entry

  return null;
}

function classifyGrammarType(title: string, language = 'spanish'): GrammarChapterType | null {
  if (language === 'french') return classifyFrenchGrammarType(title);
  if (language === 'portuguese') return classifyPortugueseGrammarType(title);
  if (language === 'german') return classifyGermanGrammarType(title);
  if (language === 'italian') return classifyItalianGrammarType(title);
  if (language === 'japanese') return classifyJapaneseGrammarType(title);

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
  // ── FRENCH Section 3
  fr_etre:               { title: 'Le Verbe ÊTRE', subtitle: 'To be — the most essential French verb + auxiliary for passé composé' },
  fr_avoir:              { title: 'Le Verbe AVOIR', subtitle: 'To have — plus dozens of fixed expressions using avoir instead of être' },
  fr_aller:              { title: 'Le Verbe ALLER', subtitle: 'To go — plus aller + infinitive for the immediate future (futur proche)' },
  fr_faire:              { title: 'Le Verbe FAIRE', subtitle: 'To do / to make — key for weather, activities, and countless expressions' },
  fr_er_verbs:           { title: 'Verbes Réguliers en -ER', subtitle: 'Over 90% of French verbs — master parler and you master the pattern' },
  fr_ir_verbs:           { title: 'Verbes Réguliers en -IR', subtitle: 'Type-2 -IR verbs add -iss- in the plural — finir is the model' },
  fr_re_verbs:           { title: 'Verbes Réguliers en -RE', subtitle: 'The third French conjugation class — unique to French, not in Spanish' },
  fr_modals:             { title: 'Verbes Modaux — Pouvoir · Vouloir · Devoir', subtitle: 'Can · Want · Must — all take an infinitive, all fully irregular' },
  fr_reflexive:          { title: 'Verbes Pronominaux', subtitle: 'Reflexive verbs — subject acts on itself, reflexive pronoun always present' },
  fr_passe_compose_avoir:{ title: 'Le Passé Composé — avec AVOIR', subtitle: 'Completed past actions — avoir + past participle, most French verbs' },
  fr_passe_compose_etre: { title: 'Le Passé Composé — avec ÊTRE', subtitle: 'Motion & state-change verbs use être — past participle agrees with subject' },
  fr_imparfait:          { title: "L'Imparfait", subtitle: 'Background, habitual, and ongoing past — the counterpart to passé composé' },
  fr_pc_vs_imp:          { title: 'Passé Composé vs Imparfait', subtitle: 'One language, two pasts — context decides which tense you need' },
  fr_future:             { title: 'Le Futur Simple', subtitle: 'Will — infinitive stem + future endings, just a few irregular stems' },
  fr_conditional:        { title: 'Le Conditionnel Présent', subtitle: 'Would — same stem as future, imparfait endings; polite requests & hypotheticals' },
  fr_subjunctive:        { title: 'Le Subjonctif Présent', subtitle: 'Used after trigger phrases — wishes, doubts, necessity, conjunction clauses' },
  fr_negation:           { title: 'La Négation Française', subtitle: 'ne…pas is just the start — French has a full system of negation pairs' },
  fr_articles_gender:    { title: 'Les Articles et le Genre', subtitle: 'Every French noun has a gender — le/la/un/une/du/de la and their rules' },
  fr_adj_agree:          { title: "L'Accord des Adjectifs", subtitle: 'Adjectives agree in gender and number — plus BAGS position rules' },
  fr_object_pronouns:    { title: 'Les Pronoms Objets', subtitle: 'COD (direct) and COI (indirect) object pronouns — order and placement' },
  fr_tu_vous:            { title: 'Tu vs Vous — Le Registre', subtitle: 'One of the most important cultural choices in French — know the difference' },
  fr_questions:          { title: 'Poser une Question', subtitle: 'Three ways to ask questions in French — intonation, est-ce que, and inversion' },
  // ── FRENCH Section 4
  fr_spatial_prep:       { title: 'Les Prépositions de Lieu', subtitle: 'dans, sur, sous, devant, derrière… + prepositions with cities and countries' },
  fr_temporal_prep:      { title: 'Les Prépositions de Temps', subtitle: 'avant, après, depuis, pendant, dès, jusqu\'à… — timing in French' },
  // ── FRENCH Section 5
  fr_world_map:          { title: 'La Francophonie', subtitle: '~274 million French speakers across 5 continents — 29 countries with French as official language' },
  fr_holiday_calendar:   { title: 'Les Fêtes Françaises', subtitle: 'Major French and Francophone public holidays — jours fériés and cultural celebrations' },
  fr_food_guide:         { title: 'La Gastronomie Française', subtitle: 'Regional French cuisine — 7 zones from Normandie to Provence to Alsace' },
  fr_dialect_zones:      { title: 'Les Variétés du Français', subtitle: 'Standard, Québécois, Belge, Suisse, Africain — all are equally valid French' },
  fr_la_bise:            { title: 'La Bise — Greeting Etiquette', subtitle: 'The French cheek-kiss — how many, which cheek, and when not to' },
  fr_currency:           { title: 'Les Monnaies de la Francophonie', subtitle: 'Euro, Canadian dollar, Swiss franc, CFA franc — French is spoken with 6+ currencies' },
  fr_gesture:            { title: 'Les Gestes Français', subtitle: 'Body language awareness in French-speaking cultures — recognition, not imitation' },
  // ── FRENCH Section 6
  fr_word_family:        { title: 'Famille de Mots', subtitle: 'French words that share a root — see how the language builds itself from Latin' },
  // ── FRENCH Section 8
  fr_nasal_vowels:       { title: 'Les Voyelles Nasales', subtitle: 'The four nasal vowels [ã] [ɛ̃] [ɔ̃] — air through nose and mouth simultaneously' },
  fr_french_r:           { title: 'Le R Français [ʁ]', subtitle: 'The uvular R — produced at the back of the throat, nothing like English or Spanish R' },
  fr_liaison:            { title: 'La Liaison', subtitle: 'Silent final consonants link to the next vowel — obligatoire, facultative, or interdite' },
  fr_u_sound:            { title: 'Le Son [y] — Le "U" Français', subtitle: 'No English equivalent — lips rounded for "oo" while tongue says "ee"' },
  fr_eu_sound:           { title: 'Les Sons [ø] et [œ] — EU / OEU', subtitle: 'The "bird vowel" of French — closed EU in feu, open EU in peur' },
  fr_silent_consonants:  { title: 'Les Consonnes Muettes', subtitle: 'Most French final consonants are silent — the CaReFuL rule for exceptions' },
  fr_written_accents:    { title: 'Les Accents Écrits', subtitle: 'é è ê à â ô ç ï — 5 accent marks, each with phonetic or semantic meaning' },
  fr_intonation:         { title: "L'Intonation Française", subtitle: 'French stress falls at the end of rhythmic groups — distinct from English patterns' },
  fr_elision:            { title: "L'Élision et les Contractions", subtitle: "Vowel dropping (l', j', m'…) and mandatory contractions (au, du, aux, des)" },

  // ── PORTUGUESE Section 3 — Grammar ──────────────────────────────────────
  pt_ser_estar:          { title: 'Ser vs. Estar', subtitle: 'The two "to be" verbs in Portuguese — permanent vs. temporary, with key use cases' },
  pt_ser_only:           { title: 'O Verbo SER', subtitle: 'Identity, origin, profession, nationality, time — ser for defining characteristics' },
  pt_estar_only:         { title: 'O Verbo ESTAR', subtitle: 'Location, emotions, progressive, results — estar for changeable states' },
  pt_ter:                { title: 'O Verbo TER', subtitle: 'To have — possession, age, obligation, and physical states (tenho fome/sede)' },
  pt_ir:                 { title: 'O Verbo IR', subtitle: 'To go — plus ir + infinitive for future plans (Vou falar = I\'m going to speak)' },
  pt_ar_verbs:           { title: 'Verbos Regulares em -AR', subtitle: 'The most common verb pattern — falar (to speak) is the model' },
  pt_er_verbs:           { title: 'Verbos Regulares em -ER', subtitle: 'Second verb type — comer (to eat) is the model for all -ER verbs' },
  pt_ir_verbs:           { title: 'Verbos Regulares em -IR', subtitle: 'Third verb type — partir (to leave) is the model for all -IR verbs' },
  pt_reflexive:          { title: 'Verbos Reflexivos', subtitle: 'Reflexive verbs — subject acts on itself; pronoun placement differs in BR and EU-PT' },
  pt_preterito_perfeito: { title: 'Pretérito Perfeito', subtitle: 'Simple past — completed, specific actions with distinct endings for each verb class' },
  pt_preterito_imperfeito:{ title: 'Pretérito Imperfeito', subtitle: 'Habitual, ongoing, and background past — the imperfect tense in Portuguese' },
  pt_pret_vs_imp:        { title: 'Perfeito vs. Imperfeito', subtitle: 'When to use each past tense — completed vs. habitual, event vs. background setting' },
  pt_future:             { title: 'O Futuro', subtitle: 'Simple future (falarei) and the common ir + infinitive near future (vou falar)' },
  pt_conditional:        { title: 'O Condicional', subtitle: 'Would — polite requests, hypotheticals, and indirect speech in Portuguese' },
  pt_subjunctive:        { title: 'O Subjuntivo Presente', subtitle: 'Used after trigger expressions of wish, doubt, emotion, and necessity' },
  pt_negation:           { title: 'A Negação', subtitle: 'Não + verb is standard; Portuguese also has nunca, nada, ninguém, nem, jamais' },
  pt_gender_articles:    { title: 'Género e Artigos', subtitle: 'Every Portuguese noun has gender — o/a (the), um/uma (a/an) + their plurals' },
  pt_adjective_agreement:{ title: 'Concordância dos Adjetivos', subtitle: 'Adjectives agree in gender and number — after the noun by default' },
  pt_object_pronouns:    { title: 'Pronomes Oblíquos', subtitle: 'Direct (me/te/o/a/nos) and indirect (me/te/lhe/nos/lhes) object pronouns' },
  pt_tu_voce:            { title: 'Tu vs. Você', subtitle: 'Address forms — tu (informal EU-PT) vs. você (dominant in Brazil); verb conjugation differs' },
  pt_questions:          { title: 'Fazer Perguntas', subtitle: 'Question words, intonation questions, inversion, and tag questions (né?)' },
  pt_contractions:       { title: 'Contrações', subtitle: 'Mandatory preposition + article contractions: ao/à, do/da, no/na, pelo/pela…' },
  // ── PORTUGUESE Section 5 — Cultural ──────────────────────────────────────
  pt_world_map:          { title: 'O Mundo Lusófono', subtitle: '~260 million speakers in 10 countries across 4 continents — one language, many worlds' },
  pt_holidays:           { title: 'Feriados Lusófonos', subtitle: 'Key holidays in Portugal and Brazil — from Carnaval to Independência do Brasil' },
  pt_food_guide:         { title: 'Gastronomia Lusófona', subtitle: 'From bacalhau in Lisbon to feijoada in São Paulo — a culinary tour of the Portuguese-speaking world' },
  pt_dialects:           { title: 'Variedades do Português', subtitle: 'EU-PT vs BR-PT vs African Portuguese — same language, very different sounds' },
  pt_etiquette:          { title: 'Etiqueta — Cumprimentos', subtitle: 'Greeting customs in Portugal and Brazil — kisses, handshakes, and how formal to be' },
  pt_currency:           { title: 'As Moedas Lusófonas', subtitle: 'Euro in Portugal, Real in Brazil — plus currencies across the wider Lusophone world' },
  pt_gestures:           { title: 'Gestos e Linguagem Corporal', subtitle: 'Body language and gesture awareness in Portuguese-speaking cultures' },
  // ── PORTUGUESE Section 6 — Word families ─────────────────────────────────
  pt_word_family:        { title: 'Família de Palavras', subtitle: 'Portuguese words that share a root — see how the language builds from Latin' },
  // ── PORTUGUESE Section 8 — Phonetics ─────────────────────────────────────
  pt_nasal_vowels:       { title: 'Vogais Nasais', subtitle: 'ã, ão, em, im, om, um — air flows through nose and mouth simultaneously' },
  pt_portuguese_r:       { title: 'O R Português', subtitle: 'Tapped r vs guttural RR — and why EU-PT, Rio, and São Paulo all sound different' },
  pt_lh_nh:              { title: 'LH e NH — Dígrafos', subtitle: 'LH = /ʎ/ (like "million"), NH = /ɲ/ (like Spanish ñ) — unique to Portuguese spelling' },
  pt_vowel_reduction:    { title: 'Redução Vocálica — EU-PT', subtitle: 'European Portuguese dramatically reduces unstressed vowels — why it sounds "swallowed"' },
  pt_ti_di:              { title: 'Palatalização de TI e DI', subtitle: 'Brazilian Portuguese: ti=/tʃi/ (chi), di=/dʒi/ (ji) — not palatalized in EU-PT' },
  pt_stress_accent:      { title: 'Acentuação', subtitle: 'Agudo ´, circunflexo ˆ, til ~, grave ` — written accents mark stress and nasalization' },
  pt_eu_vs_br:           { title: 'EU-PT vs BR-PT', subtitle: 'The 10 biggest pronunciation differences between European and Brazilian Portuguese' },
  pt_linking:            { title: 'Ligação Fonética', subtitle: 'Linking sounds and mandatory contractions that make Portuguese flow as one stream' },
  pt_intonation:         { title: 'Entoação Portuguesa', subtitle: 'Rising vs falling patterns — and the distinct melody of each regional accent' },
  // ── GERMAN Section 3 — Grammar ────────────────────────────────────────────
  de_sein:               { title: 'Sein — To Be', subtitle: 'Fully irregular — all 6 present forms + uses of sein + Perfekt auxiliary rule' },
  de_haben:              { title: 'Haben — To Have', subtitle: 'Slightly irregular — possession, feelings, and Perfekt auxiliary for most verbs' },
  de_werden:             { title: 'Werden — To Become / Will / Would', subtitle: 'Triple function: to become, Futur I helper, Konjunktiv II base' },
  de_regular_verbs:      { title: 'Regular -EN Verbs', subtitle: 'Present tense endings for all regular German verbs — the core pattern' },
  de_modal_verbs:        { title: 'Modalverben — Modal Verbs', subtitle: 'können, müssen, wollen, sollen, dürfen, mögen — full conjugation chart' },
  de_reflexive:          { title: 'Reflexive Verben', subtitle: 'Accusative and dative reflexive pronouns + common reflexive verbs' },
  de_perfekt:            { title: 'Das Perfekt — Conversational Past', subtitle: 'haben/sein + Partizip II — how to form it and when to use each auxiliary' },
  de_prateritum:         { title: 'Das Präteritum — Narrative Past', subtitle: 'Simple past for writing, formal speech, and the key verbs sein/haben/modals' },
  de_perf_vs_prat:       { title: 'Perfekt vs. Präteritum', subtitle: 'When to use each — spoken vs. written, regional differences, and the always-Präteritum verbs' },
  de_futur:              { title: 'Futur I — Future Tense', subtitle: 'werden + infinitive — and when Präsens replaces it in everyday speech' },
  de_konjunktiv2:        { title: 'Konjunktiv II — The Subjunctive', subtitle: 'würde, wäre, hätte — hypotheticals, polite requests, and unreal conditions' },
  de_negation:           { title: 'Verneinung — Negation', subtitle: 'nicht (negates verbs/adjectives) vs. kein (negates nouns) — position rules' },
  de_definite_articles:  { title: 'Der, Die, Das — Definite Articles', subtitle: 'Article declension across all 4 cases + gender-predicting suffixes' },
  de_indefinite_articles:{ title: 'Ein, Eine — Indefinite Articles', subtitle: 'Indefinite article + kein/keine across all 4 cases' },
  de_adj_endings:        { title: 'Adjektivendungen — Adjective Endings', subtitle: 'Weak (after definite) vs. mixed (after indefinite) adjective ending tables' },
  de_accusative:         { title: 'Der Akkusativ — Direct Object', subtitle: 'Only masculine changes nom→akk; accusative-only prepositions (durch/für/gegen/ohne/um)' },
  de_dative:             { title: 'Der Dativ — Indirect Object', subtitle: 'All article forms change; dative-only prepositions (aus/bei/mit/nach/seit/von/zu)' },
  de_cases_overview:     { title: 'Die vier Fälle — Four Cases', subtitle: 'Nominativ / Akkusativ / Dativ / Genitiv — and two-way prepositions (Wechselpräpositionen)' },
  de_separable_verbs:    { title: 'Trennbare Verben — Separable Verbs', subtitle: 'Prefix detaches and moves to end of clause — common prefixes and patterns' },
  de_word_order:         { title: 'Wortstellung — Word Order', subtitle: 'Verb-second (V2) in main clauses; verb-final in subordinate clauses after weil/dass/wenn' },
  de_questions:          { title: 'Fragen — Questions', subtitle: 'Ja/Nein questions (verb first) and W-Fragen (Wer, Was, Wo, Wann, Wie, Warum…)' },
  de_pronouns:           { title: 'Personalpronomen — Personal Pronouns', subtitle: 'Nominativ / Akkusativ / Dativ forms for all persons + du vs. Sie formality' },
  // ── GERMAN Section 5 — Cultural ───────────────────────────────────────────
  de_world_map:          { title: 'Die deutschsprachige Welt — DACH & Beyond', subtitle: '~100 million native speakers · 6 countries · Germany, Austria, Switzerland & more' },
  de_holidays:           { title: 'Feiertage & Feste — German Holidays', subtitle: '9 nationwide holidays + regional ones — Oktoberfest, Karneval, Weihnachtsmärkte' },
  de_food_guide:         { title: 'Deutsche Küche — German Cuisine', subtitle: 'Regional specialties across Deutschland · Österreich · Schweiz — Brot, Wurst, Käse, Bier' },
  de_dialects:           { title: 'Deutsche Dialekte — Dialect Zones', subtitle: 'Hochdeutsch · Bairisch · Plattdeutsch · Kölsch · Schweizerdeutsch — same script, different voices' },
  de_etiquette:          { title: 'Etikette — German Etiquette', subtitle: 'Pünktlichkeit, du/Sie formality, direct communication — core German cultural values' },
  de_currency:           { title: 'Währungen — DACH Currencies', subtitle: 'Euro (DE/AT/LU) and Swiss Franc (CH/LI) — with denominations and practical tips' },
  de_gestures:           { title: 'Gesten — German Body Language', subtitle: 'Tischklopfen at lectures, Prost eye-contact rules, and gestures to avoid' },
  // ── GERMAN Section 6 — Word families ──────────────────────────────────────
  de_word_family:        { title: 'Wortfamilien — German Word Families', subtitle: 'Root verb + derived nouns, adjectives, and compounds — the building blocks of German vocabulary' },
  // ── GERMAN Section 8 — Phonetics ──────────────────────────────────────────
  de_umlauts:            { title: 'Umlaute — Ä, Ö, Ü', subtitle: 'How to pronounce the three modified German vowels + typing substitutions (ae/oe/ue)' },
  de_eszett:             { title: 'Das ß — Eszett / Scharfes S', subtitle: 'When to write ß vs. ss — long vowel rule + Swiss German always uses ss' },
  de_german_r:           { title: 'Das Deutsche R', subtitle: 'Uvular fricative [ʁ] vs. vocalic -er at word end — how to produce it' },
  de_ch_sound:           { title: 'Das CH — Ich-Laut vs. Ach-Laut', subtitle: '[ç] after front vowels (ich) vs. [x] after back vowels (ach) — same letters, two sounds' },
  de_long_short_vowels:  { title: 'Lange und kurze Vokale', subtitle: 'Vowel length changes meaning — markers of long (aa, ah, -h) vs. short (double consonant) vowels' },
  de_w_v_sound:          { title: 'W und V — Common Confusion', subtitle: 'German W = English V. German V = English F (usually). Loanword exceptions.' },
  de_consonant_clusters: { title: 'SP, ST, Z, SCH — Key Consonants', subtitle: 'SP/ST at word start = "shp"/"sht"; Z = "ts"; SCH = "sh"; TH = "t"' },
  de_word_stress:        { title: 'Wortakzent — Word Stress', subtitle: 'Root syllable stressed in native words; prefix stressed in separable verbs; not in inseparable prefixes' },
  de_diphthongs:         { title: 'Diphthonge — EI, AU, EU/ÄU', subtitle: 'EI=[aɪ], AU=[aʊ], EU/ÄU=[ɔɪ] — and the critical EI vs. IE distinction' },
  // ── ITALIAN Section 3 — Grammar ───────────────────────────────────────────
  it_essere:             { title: 'Essere — To Be', subtitle: 'Irregular auxiliary — identity, origin, profession, and Passato Prossimo helper for motion/change verbs' },
  it_avere:              { title: 'Avere — To Have', subtitle: 'Irregular auxiliary — possession, age, sensations, and Passato Prossimo helper for most verbs' },
  it_stare:              { title: 'Stare — To Stay / Be', subtitle: 'Irregular verb — health/feeling with adjectives + stare + gerundio for progressive actions' },
  it_regular_verbs:      { title: 'Verbi Regolari — -ARE, -ERE, -IRE', subtitle: 'Present tense endings for all three Italian verb classes — the core conjugation pattern' },
  it_modal_verbs:        { title: 'Verbi Modali — Modal Verbs', subtitle: 'potere, dovere, volere — full conjugation + infinitive complement pattern' },
  it_reflexive:          { title: 'Verbi Riflessivi — Reflexive Verbs', subtitle: 'Reflexive pronoun placement + common reflexive verbs for daily routines' },
  it_passato_prossimo:   { title: 'Il Passato Prossimo', subtitle: 'avere/essere + participio passato — how to form it and when to use each auxiliary' },
  it_imperfetto:         { title: "L'Imperfetto — Imperfect", subtitle: 'Habitual actions, ongoing states, and background descriptions in the past' },
  it_past_comparison:    { title: 'Passato Prossimo vs. Imperfetto', subtitle: 'Completed events vs. habitual/ongoing past — the key contrast in Italian storytelling' },
  it_futuro:             { title: 'Il Futuro Semplice — Future', subtitle: 'Future tense endings for all three verb classes + irregular stems' },
  it_condizionale:       { title: 'Il Condizionale — Conditional', subtitle: 'Polite requests, hypotheticals, and wishes — conditional endings + common irregulars' },
  it_negation:           { title: 'La Negazione — Negation', subtitle: 'non + verb placement + double negatives (non...niente, non...mai, non...nessuno)' },
  it_definite_articles:  { title: 'Gli Articoli Determinativi', subtitle: 'il/lo/la/l\' (sing.) · i/gli/le (pl.) — gender, number, and the context rules' },
  it_indefinite_articles:{ title: 'Gli Articoli Indeterminativi', subtitle: 'un/uno/una/un\' — gender agreement + partitive articles for plural/uncountable nouns' },
  it_adj_agreement:      { title: 'Concordanza degli Aggettivi', subtitle: 'Adjectives agree in gender and number — -o/-a/-i/-e endings + invariable adjectives' },
  it_articulated_prep:   { title: 'Preposizioni Articolate', subtitle: 'di/a/da/in/su + definite article → del/al/dal/nel/sul — contraction tables' },
  it_object_pronouns:    { title: 'Pronomi Complemento — Object Pronouns', subtitle: 'Direct (mi/ti/lo/la) and indirect (mi/ti/gli/le) pronouns + placement rules' },
  it_subject_pronouns:   { title: 'Pronomi Soggetto — Subject Pronouns', subtitle: 'io/tu/lui/lei/noi/voi/loro — when to omit them and formal Lei usage' },
  it_questions:          { title: 'Le Domande — Questions', subtitle: 'Intonation questions, question words (chi/che/cosa/dove/quando/come/perché/quanto)' },
  it_partitive:          { title: 'Il Partitivo — Some / Any', subtitle: 'del/della/dell\'/dei/degli/delle — expressing indefinite quantities in Italian' },
  it_imperative:         { title: "L'Imperativo — Imperative", subtitle: 'Commands in tu/Lei/noi/voi forms — regular patterns and key irregulars' },
  it_comparatives:       { title: 'Comparativi e Superlativi', subtitle: 'più/meno...di/che, tanto...quanto — and irregular forms (migliore, peggiore, maggiore, minore)' },
  // ── ITALIAN Section 5 — Cultural ───────────────────────────────────────────
  it_world_map:          { title: 'Il Mondo Italofono — Italian-Speaking World', subtitle: '~85 million speakers · Italy, Switzerland, San Marino, Vatican + diaspora communities' },
  it_holidays:           { title: 'Feste e Ferie — Italian Holidays', subtitle: '12 national holidays + Ferragosto · Carnevale · regional sagre — the Italian festive calendar' },
  it_food_guide:         { title: 'La Cucina Italiana — Italian Cuisine', subtitle: 'Regional specialties from Lombardy to Sicily · pasta, pizza, risotto, and more' },
  it_dialects:           { title: 'I Dialetti Italiani — Dialect Zones', subtitle: 'Standard Italian · Venetian · Neapolitan · Sicilian · Sardinian — one flag, many voices' },
  it_etiquette:          { title: 'Galateo — Italian Etiquette', subtitle: 'Bella figura, greeting customs, table manners, and social norms in Italian culture' },
  it_currency:           { title: 'La Moneta — Italian Currency', subtitle: 'Euro in Italy, San Marino & Vatican · Swiss Franc in Canton Ticino — denominations and tips' },
  it_gestures:           { title: 'I Gesti Italiani — Italian Gestures', subtitle: 'The most expressive hand-gesture vocabulary in the world — meanings and contexts' },
  // ── ITALIAN Section 6 — Word families ──────────────────────────────────────
  it_word_family:        { title: 'Famiglie di Parole — Italian Word Families', subtitle: 'Root verb + derived nouns, adjectives, and compounds — the building blocks of Italian vocabulary' },
  // ── ITALIAN Section 8 — Phonetics ──────────────────────────────────────────
  it_cg_sounds:          { title: 'C e G — Soft vs. Hard Sounds', subtitle: 'ca/co/cu=[k], ci/ce=[tʃ], chi/che=[k] · ga/go/gu=[g], gi/ge=[dʒ], ghi/ghe=[g]' },
  it_sc_sounds:          { title: 'SC — Soft vs. Hard Sounds', subtitle: 'sci/sce=[ʃ] (soft) vs. sca/sco/scu=[sk] (hard) · schi/sche=[sk] · the digraph rule' },
  it_gl_gn:              { title: 'GL e GN — Special Italian Sounds', subtitle: 'gli=[ʎ] (palatal lateral) and gn=[ɲ] (palatal nasal) — two uniquely Italian sounds' },
  it_double_consonant:   { title: 'Le Consonanti Doppie — Geminate Consonants', subtitle: 'Double consonants are longer and change meaning: fatto vs. fato, palla vs. pala' },
  it_z_sound:            { title: 'La Z — [ts] vs. [dz]', subtitle: 'Voiceless [ts] in pizza, grazie · Voiced [dz] in zona, zero — regional and positional rules' },
  it_rolled_r:           { title: 'La R Italiana — The Rolled R', subtitle: 'Alveolar trill [r] — single tap vs. full roll, position in word, and practice techniques' },
  it_open_closed_vowels: { title: 'Vocali Aperte e Chiuse — E and O', subtitle: 'Open [ɛ/ɔ] vs. closed [e/o] — accent marks, regional variation, and minimal pairs' },
  it_stress_patterns:    { title: "L'Accento Tonico — Word Stress", subtitle: 'Most Italian words stress the penultimate syllable — exceptions, accent marks, and oxytones' },
  it_diphthongs:         { title: 'I Dittonghi — Italian Diphthongs', subtitle: 'Rising (ie, uo) and falling diphthongs — when vowels combine vs. stay separate' },
  // ── JAPANESE Section 3 — Grammar ──────────────────────────────────────────
  ja_hiragana:           { title: 'ひらがな — Hiragana', subtitle: 'The 46-character phonetic syllabary for native Japanese words, grammar particles, and verb endings' },
  ja_katakana:           { title: 'カタカナ — Katakana', subtitle: 'The 46-character syllabary used for foreign loanwords, foreign names, and onomatopoeia' },
  ja_kanji_basics:       { title: '漢字 — Kanji Basics', subtitle: 'Logographic characters with on-yomi (Chinese) and kun-yomi (Japanese) readings — 2,136 jōyō kanji' },
  ja_particles:          { title: '助詞 — Particles', subtitle: 'Grammatical markers (は、が、を、に、で、の、と、も、か...) that define the role of nouns in a sentence' },
  ja_verb_groups:        { title: '動詞のグループ — Verb Groups', subtitle: 'Group 1 Godan (u-verbs), Group 2 Ichidan (ru-verbs), Group 3 Irregular (する、くる)' },
  ja_te_form:            { title: 'て形 — Te-form', subtitle: 'The essential connecting form — used for sequences, requests (〜てください), permission, and compound patterns' },
  ja_past_tense:         { title: '過去形 — Past Tense (た形)', subtitle: 'た-form / ta-form formation rules (same as て-form) + polite past 〜ました' },
  ja_negative_form:      { title: '否定形 — Negative Forms', subtitle: 'Plain negative ない/くない + polite negative ません — verb, noun, and adjective negation' },
  ja_polite_form:        { title: '丁寧語 — Polite Form (です・ます)', subtitle: 'The essential ます/です register — present, past, negative, and volitional polite forms' },
  ja_adjectives:         { title: '形容詞 — Adjectives (い vs な)', subtitle: 'い-adjectives conjugate like verbs; な-adjectives use particle な before nouns and だ/です as predicate' },
  ja_noun_phrases:       { title: '名詞句 — Noun Phrases & の', subtitle: 'の as possessive/modifier + の as nominalizer (turning verb phrases into noun phrases)' },
  ja_question_words:     { title: '疑問詞 — Question Words', subtitle: '何、どこ、だれ、いつ、どう、なぜ、どれ、いくら... — question words + か sentence-final question marker' },
  ja_numbers:            { title: '数字 — Numbers', subtitle: 'Japanese number system (1–万) with kanji numerals + the 万 (10,000) grouping system' },
  ja_counters:           { title: '助数詞 — Counters', subtitle: 'Counter words by object type: 本/枚/冊/台/匹/頭/羽/個/杯/人... + the general つ counter' },
  ja_time_expressions:   { title: '時間表現 — Time Expressions', subtitle: 'Days (今日、昨日、明日), weeks, months, years + clock time + frequency expressions' },
  ja_direction_movement: { title: '方向・移動 — Direction & Movement', subtitle: 'Movement verbs + に/へ direction patterns + transportation vocabulary' },
  ja_giving_receiving:   { title: 'やり・もらい表現 — Giving & Receiving', subtitle: 'あげる/くれる/もらう + て-form versions + honorific forms さしあげる/くださる/いただく' },
  ja_potential_form:     { title: '可能形 — Potential Form', subtitle: 'Can do ~ — formation rules for all verb groups + できる as general potential verb' },
  ja_volitional_form:    { title: '意志形 — Volitional & Desire', subtitle: '〜ましょう / 〜よう (let\'s ~) + 〜たい (want to ~) + 〜たがる for third-person desire' },
  ja_conditional:        { title: '条件形 — Conditional Forms', subtitle: '〜たら (if/when) · 〜ば (formal if) · 〜なら (given that) · 〜と (natural result)' },
  ja_te_iru:             { title: '〜ています — Ongoing & Resultant States', subtitle: 'Activity verbs → ongoing action; change-of-state verbs → resultant state — the critical distinction' },
  ja_honorifics:         { title: '敬語 — Honorific Language (Keigo)', subtitle: '丁寧語/尊敬語/謙譲語 — the three levels of keigo + お〜/ご〜 prefixes + title suffixes' },
  // ── JAPANESE Section 5 — Cultural ─────────────────────────────────────────
  ja_world_map:          { title: '日本語の世界 — Japanese-Speaking World', subtitle: '~125 million native speakers · Japan + diaspora · Japonic language family · JLPT levels' },
  ja_holidays:           { title: '日本の祝日・行事 — Japanese Holidays', subtitle: '16 national holidays · Golden Week · Obon · Year-End customs · seasonal festivals' },
  ja_food_guide:         { title: '日本の食文化 — Japanese Cuisine', subtitle: 'Washoku UNESCO heritage · ramen/soba/udon/sushi · regional specialties · dining vocabulary' },
  ja_regions:            { title: '日本の地方 — Regions of Japan', subtitle: '9 regions · 47 prefectures · Hokkaidō to Okinawa — geography, culture, and local identity' },
  ja_etiquette:          { title: '日本のマナー — Japanese Etiquette', subtitle: 'Bowing, shoes, chopstick rules, tipping customs, public transport behavior, gifting (お土産)' },
  ja_currency:           { title: '日本円 — Japanese Yen', subtitle: '6 coins · 3 banknotes (redesigned 2024) · cash culture · IC cards · useful payment phrases' },
  ja_pop_culture:        { title: 'ポップカルチャー — Japanese Pop Culture', subtitle: 'Anime, manga, J-pop, gaming, cosplay, Akihabara — Japan\'s global "Cool Japan" soft power' },
  // ── JAPANESE Section 6 — Word families ────────────────────────────────────
  ja_word_family:        { title: '漢字の家族 — Kanji Word Families', subtitle: 'Root kanji + on-yomi and kun-yomi compound words — building vocabulary through kanji patterns' },
  // ── JAPANESE Section 8 — Phonetics ────────────────────────────────────────
  ja_hiragana_chart:     { title: 'ひらがな完全表 — Complete Hiragana Chart', subtitle: '46 base + 25 voiced/semi-voiced + 拗音 combination characters — the full hiragana system' },
  ja_katakana_chart:     { title: 'カタカナ完全表 — Complete Katakana Chart', subtitle: '46 base characters + special foreign-sound combinations + the ー long vowel mark' },
  ja_vowel_sounds:       { title: '母音 — Japanese Vowel Sounds', subtitle: '5 pure, consistent vowels (a/i/u/e/o) — pronunciation guide with IPA + devoiced vowels' },
  ja_consonant_sounds:   { title: '子音 — Special Consonant Sounds', subtitle: 'shi, chi, tsu, fu, the Japanese r (flap), and common pronunciation traps for English speakers' },
  ja_long_vowels:        { title: '長音 — Long Vowels', subtitle: 'Long vs. short vowels change meaning — minimal pairs (おじさん vs おじいさん) + romanization rules' },
  ja_double_consonants:  { title: '促音 — Double Consonants (っ/ッ)', subtitle: 'Sokuon — the held-stop consonant that changes meaning (きて vs きって) + production technique' },
  ja_pitch_accent:       { title: 'アクセント — Pitch Accent', subtitle: '4 Tokyo dialect patterns (heiban, atamadaka, nakadaka, odaka) + pitch minimal pairs' },
  ja_loanwords:          { title: '外来語 — Katakana Loanwords', subtitle: 'Phonological adaptation rules + common loanword categories + false friends in katakana' },
  ja_n_sound:            { title: 'ん/ン — The Syllabic N', subtitle: 'The chameleon nasal — 5 phonological variants depending on following consonant + mora counting' },
};

function resolveFrenchWordFamilyCard(title?: string): JSX.Element {
  if (!title) return <FrParlerFamilyCard />;
  const lower = title.toLowerCase();
  if (lower.includes('parler') || lower.includes('parole') || lower.includes('speak')) return <FrParlerFamilyCard />;
  if (lower.includes('aimer') || lower.includes('amour') || lower.includes('love') || lower.includes('like')) return <FrAimerFamilyCard />;
  if (lower.includes('voir') || lower.includes('vue') || lower.includes('see') || lower.includes('vision')) return <FrVoirFamilyCard />;
  if (lower.includes('faire') || lower.includes('fait') || lower.includes('do') || lower.includes('make')) return <FrFaireFamilyCard />;
  if (lower.includes('dire') || lower.includes('dit') || lower.includes('say') || lower.includes('tell') || lower.includes('diction')) return <FrDireFamilyCard />;
  if (lower.includes('aller') || lower.includes('allée') || lower.includes('go') || lower.includes('travel')) return <FrAllerFamilyCard />;
  if (lower.includes('venir') || lower.includes('venue') || lower.includes('come') || lower.includes('avenir')) return <FrVenirFamilyCard />;
  if (lower.includes('prendre') || lower.includes('prise') || lower.includes('take') || lower.includes('apprendre') || lower.includes('comprendre')) return <FrPrendreFamilyCard />;
  if (lower.includes('savoir') || lower.includes('connaissance') || lower.includes('know') || lower.includes('savant')) return <FrSavoirFamilyCard />;
  if (lower.includes('croire') || lower.includes('croyance') || lower.includes('believe') || lower.includes('incroyable')) return <FrCroireFamilyCard />;
  return <FrParlerFamilyCard />;
}

const GRAMMAR_LABELS_PT: Partial<Record<GrammarChapterType, { title: string; subtitle: string }>> = {
  weather_vocab:    { title: 'Vocabulário de Tempo — O Tempo', subtitle: 'All 10 weather conditions with Portuguese expressions — the same icons used in lessons' },
  emotions_vocab:   { title: 'As Emoções — Os Sentimentos', subtitle: 'All 11 emotion faces with Portuguese labels — the same faces used in lessons' },
  telling_time:     { title: 'As Horas — Dizer as Horas', subtitle: 'Analog clocks + key Portuguese time patterns and parts-of-day vocabulary' },
  days_week:        { title: 'Dias, Meses e Calendário', subtitle: 'Days of the week, months of the year, and Portuguese date expressions' },
  body_parts:       { title: 'O Corpo Humano — As Partes do Corpo', subtitle: 'Body diagram + complete Portuguese vocabulary reference — same diagram used in lessons' },
  face_parts:       { title: 'O Rosto — Vocabulário do Rosto', subtitle: 'Face close-up + full Portuguese vocabulary for facial features' },
  hand_parts:       { title: 'A Mão — Os Dedos', subtitle: 'Hand diagram + Portuguese vocabulary for fingers, palm, and wrist' },
  temperature_vocab:{ title: 'A Temperatura', subtitle: 'Temperature scale in Portuguese — same thermometer used in lessons' },
  country_dot_map:  { title: 'Os Países Lusófonos', subtitle: 'Where Portuguese is spoken around the world — 10 countries across 4 continents' },
};

const GRAMMAR_LABELS_DE: Partial<Record<GrammarChapterType, { title: string; subtitle: string }>> = {
  weather_vocab:    { title: 'Das Wetter — Wettervokabular', subtitle: 'All 10 weather conditions with German expressions — the same icons used in lessons' },
  emotions_vocab:   { title: 'Gefühle — Emotionen', subtitle: 'All 11 emotion faces with German labels — the same faces used in lessons' },
  telling_time:     { title: 'Die Uhrzeit — Wie spät ist es?', subtitle: 'Analog clocks + key German time patterns and parts-of-day vocabulary' },
  days_week:        { title: 'Tage, Monate und Kalender', subtitle: 'Days of the week, months of the year, and German date expressions' },
  body_parts:       { title: 'Der Körper — Körperteile', subtitle: 'Body diagram + complete German vocabulary reference — same diagram used in lessons' },
  face_parts:       { title: 'Das Gesicht — Gesichtsteile', subtitle: 'Face close-up + full German vocabulary for facial features' },
  hand_parts:       { title: 'Die Hand — Finger und Handfläche', subtitle: 'Hand diagram + German vocabulary for fingers, palm, and wrist' },
  temperature_vocab:{ title: 'Die Temperatur', subtitle: 'Temperature scale in German — same thermometer used in lessons' },
  country_dot_map:  { title: 'Die deutschsprachige Welt', subtitle: 'Where German is spoken around the world — DACH + Liechtenstein, Luxembourg, South Tyrol & minorities' },
};

const GRAMMAR_LABELS_IT: Partial<Record<GrammarChapterType, { title: string; subtitle: string }>> = {
  weather_vocab:    { title: 'Il Tempo — Le Condizioni Meteorologiche', subtitle: 'All 10 weather conditions with Italian expressions — the same icons used in lessons' },
  emotions_vocab:   { title: 'Le Emozioni — I Sentimenti', subtitle: 'All 11 emotion faces with Italian labels — the same faces used in lessons' },
  telling_time:     { title: "L'Ora — Come si dice l'ora", subtitle: 'Analog clocks + key Italian time patterns and parts-of-day vocabulary' },
  days_week:        { title: 'Giorni, Mesi e Calendario', subtitle: 'Days of the week, months of the year, and Italian date expressions' },
  body_parts:       { title: 'Il Corpo Umano — Le Parti del Corpo', subtitle: 'Body diagram + complete Italian vocabulary reference — same diagram used in lessons' },
  face_parts:       { title: 'Il Viso — Il Vocabolario del Viso', subtitle: 'Face close-up + full Italian vocabulary for facial features' },
  hand_parts:       { title: 'La Mano — Le Dita', subtitle: 'Hand diagram + Italian vocabulary for fingers, palm, and wrist' },
  temperature_vocab:{ title: 'La Temperatura', subtitle: 'Temperature scale in Italian — same thermometer used in lessons' },
  country_dot_map:  { title: 'Il Mondo Italofono', subtitle: 'Where Italian is spoken around the world — Italy, Switzerland, San Marino, Vatican & diaspora' },
};

const GRAMMAR_LABELS_FR: Partial<Record<GrammarChapterType, { title: string; subtitle: string }>> = {
  weather_vocab:    { title: 'La Météo — Le Temps qu\'il fait', subtitle: 'All 10 weather conditions with French expressions — the same icons used in lessons' },
  emotions_vocab:   { title: 'Les Émotions — Les Sentiments', subtitle: 'All 11 emotion faces with French labels — the same faces used in lessons' },
  telling_time:     { title: "L'Heure — Dire l'heure", subtitle: 'Analog clocks + key French time patterns and parts-of-day vocabulary' },
  days_week:        { title: 'Jours, Mois et Calendrier', subtitle: 'Days of the week, months of the year, and useful French date expressions' },
  body_parts:       { title: 'Le Corps Humain — Les Parties du Corps', subtitle: 'Body diagram + complete French vocabulary reference — same diagram used in lessons' },
  face_parts:       { title: 'Le Visage — Vocabulaire du Visage', subtitle: 'Face close-up + full French vocabulary for facial features' },
  hand_parts:       { title: 'La Main — Les Doigts', subtitle: 'Hand diagram + French vocabulary for fingers, palm, and wrist' },
  temperature_vocab:{ title: 'La Température', subtitle: 'Temperature scale in French — same thermometer used in lessons' },
  country_dot_map:  { title: 'Les Pays Francophones', subtitle: 'Where French is spoken around the world — 29+ countries across 5 continents' },
};

const GRAMMAR_LABELS_JA: Partial<Record<GrammarChapterType, { title: string; subtitle: string }>> = {
  weather_vocab:    { title: '天気 — お天気のことば', subtitle: 'All 10 weather conditions with Japanese expressions — the same icons used in lessons' },
  emotions_vocab:   { title: '感情 — 気持ちのことば', subtitle: 'All 11 emotion faces with Japanese labels — the same faces used in lessons' },
  telling_time:     { title: '時計 — 時刻の言い方', subtitle: 'Analog clocks + key Japanese time patterns and parts-of-day vocabulary' },
  days_week:        { title: '曜日・月・カレンダー', subtitle: 'Days of the week, months of the year, and Japanese date expressions' },
  body_parts:       { title: '体 — からだのことば', subtitle: 'Body diagram + complete Japanese vocabulary reference — same diagram used in lessons' },
  face_parts:       { title: '顔 — かおのことば', subtitle: 'Face close-up + full Japanese vocabulary for facial features' },
  hand_parts:       { title: '手 — てのことば', subtitle: 'Hand diagram + Japanese vocabulary for fingers, palm, and wrist' },
  temperature_vocab:{ title: '気温 — おんどのことば', subtitle: 'Temperature scale in Japanese — same thermometer used in lessons' },
  country_dot_map:  { title: '日本語の世界', subtitle: 'Where Japanese is spoken around the world — Japan + diaspora communities' },
};

function GrammarChapterView({ type, chapterNumber, chapterTitle, language = 'spanish' }: { type: GrammarChapterType; chapterNumber: number; chapterTitle?: string; language?: string }) {
  const baseLabel = GRAMMAR_LABELS[type];
  const frLabel = language === 'french' ? GRAMMAR_LABELS_FR[type] : undefined;
  const ptLabel = language === 'portuguese' ? GRAMMAR_LABELS_PT[type] : undefined;
  const deLabel = language === 'german' ? GRAMMAR_LABELS_DE[type] : undefined;
  const itLabel = language === 'italian' ? GRAMMAR_LABELS_IT[type] : undefined;
  const jaLabel = language === 'japanese' ? GRAMMAR_LABELS_JA[type] : undefined;
  const { title, subtitle } = jaLabel ?? itLabel ?? deLabel ?? ptLabel ?? frLabel ?? baseLabel;
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
      {type === 'weather_vocab'    && <WeatherVocabCard     language={language as 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese'} />}
      {type === 'emotions_vocab'   && <EmotionsVocabCard    language={language as 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese'} />}
      {type === 'telling_time'     && <TimeVocabCard        language={language as 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese'} />}
      {type === 'days_week'        && <DaysOfWeekCard       language={language as 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese'} />}
      {type === 'body_parts'       && <BodyPartsCard        language={language as 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese'} />}
      {type === 'face_parts'       && <FacePartsCard        language={language as 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese'} />}
      {type === 'hand_parts'       && <HandPartsCard        language={language as 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese'} />}
      {type === 'temperature_vocab'&& <ThermometerVocabCard language={language as 'spanish' | 'french' | 'portuguese' | 'german' | 'italian' | 'japanese'} />}
      {type === 'country_dot_map'  && (language === 'french' ? <FrancophoneWorldMapCard /> : language === 'portuguese' ? <LusophoneWorldMapCard /> : language === 'german' ? <GermanSpeakingWorldCard /> : language === 'italian' ? <ItalophoneWorldCard /> : language === 'japanese' ? <JapanophoneWorldCard /> : <CountryDotMapCard />)}

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

      {/* ── FRENCH Section 3 — Grammar ───────────────────────────────────── */}
      {type === 'fr_etre' && <ÊtreCard />}
      {type === 'fr_avoir' && <AvoirCard />}
      {type === 'fr_aller' && <AllerCard />}
      {type === 'fr_faire' && <FaireCard />}
      {type === 'fr_er_verbs' && <FrErVerbsCard />}
      {type === 'fr_ir_verbs' && <FrIrVerbsCard />}
      {type === 'fr_re_verbs' && <FrReVerbsCard />}
      {type === 'fr_modals' && <FrModalsCard />}
      {type === 'fr_reflexive' && <FrReflexiveCard />}
      {type === 'fr_passe_compose_avoir' && <FrPasseComposeAvoirCard />}
      {type === 'fr_passe_compose_etre' && <FrPasseComposeEtreCard />}
      {type === 'fr_imparfait' && <FrImparfaitCard />}
      {type === 'fr_pc_vs_imp' && <FrPcVsImpCard />}
      {type === 'fr_future' && <FrFutureCard />}
      {type === 'fr_conditional' && <FrConditionalCard />}
      {type === 'fr_subjunctive' && <FrSubjunctiveCard />}
      {type === 'fr_negation' && <FrNegationCard />}
      {type === 'fr_articles_gender' && <FrArticlesGenderCard />}
      {type === 'fr_adj_agree' && <FrAdjAgreeCard />}
      {type === 'fr_object_pronouns' && <FrObjectPronounsCard />}
      {type === 'fr_tu_vous' && <FrTuVousCard />}
      {type === 'fr_questions' && <FrQuestionsCard />}

      {/* ── FRENCH Section 4 — Prepositions ──────────────────────────────── */}
      {type === 'fr_spatial_prep' && <FrSpatialPrepCard />}
      {type === 'fr_temporal_prep' && <FrTemporalPrepCard />}

      {/* ── FRENCH Section 5 — Cultural ──────────────────────────────────── */}
      {type === 'fr_world_map' && <FrancophoneWorldMapCard />}
      {type === 'fr_holiday_calendar' && <FrenchHolidayCalendarCard />}
      {type === 'fr_food_guide' && <FrenchFoodGuideCard />}
      {type === 'fr_dialect_zones' && <FrenchDialectZonesCard />}
      {type === 'fr_la_bise' && <LaBiseEtiquetteCard />}
      {type === 'fr_currency' && <FrenchCurrencyCard />}
      {type === 'fr_gesture' && <FrGestureAwarenessCard />}

      {/* ── FRENCH Section 6 — Word families ─────────────────────────────── */}
      {type === 'fr_word_family' && resolveFrenchWordFamilyCard(chapterTitle)}

      {/* ── FRENCH Section 8 — Phonetics ─────────────────────────────────── */}
      {type === 'fr_nasal_vowels' && <FrNasalVowelsCard />}
      {type === 'fr_french_r' && <FrFrenchRCard />}
      {type === 'fr_liaison' && <FrLiaisonCard />}
      {type === 'fr_u_sound' && <FrUSoundCard />}
      {type === 'fr_eu_sound' && <FrEUSoundCard />}
      {type === 'fr_silent_consonants' && <FrSilentConsonantsCard />}
      {type === 'fr_written_accents' && <FrWrittenAccentsCard />}
      {type === 'fr_intonation' && <FrIntonationCard />}
      {type === 'fr_elision' && <FrElisionCard />}

      {/* ── PORTUGUESE Section 3 — Grammar ───────────────────────────────── */}
      {type === 'pt_ser_estar' && <PtSerEstarCard />}
      {type === 'pt_ser_only' && <PtSerCard />}
      {type === 'pt_estar_only' && <PtEstarCard />}
      {type === 'pt_ter' && <PtTerCard />}
      {type === 'pt_ir' && <PtIrCard />}
      {type === 'pt_ar_verbs' && <PtArVerbsCard />}
      {type === 'pt_er_verbs' && <PtErVerbsCard />}
      {type === 'pt_ir_verbs' && <PtIrRegVerbsCard />}
      {type === 'pt_reflexive' && <PtReflexiveCard />}
      {type === 'pt_preterito_perfeito' && <PtPreteritoPerfeito />}
      {type === 'pt_preterito_imperfeito' && <PtPreteritoImperfeito />}
      {type === 'pt_pret_vs_imp' && <PtPretVsImpCard />}
      {type === 'pt_future' && <PtFutureCard />}
      {type === 'pt_conditional' && <PtConditionalCard />}
      {type === 'pt_subjunctive' && <PtSubjunctiveCard />}
      {type === 'pt_negation' && <PtNegativeCard />}
      {type === 'pt_gender_articles' && <PtGenderArticlesCard />}
      {type === 'pt_adjective_agreement' && <PtAdjectiveAgreementCard />}
      {type === 'pt_object_pronouns' && <PtObjectPronounsCard />}
      {type === 'pt_tu_voce' && <PtTuVoceCard />}
      {type === 'pt_questions' && <PtQuestionsCard />}
      {type === 'pt_contractions' && <PtContractionsCard />}

      {/* ── PORTUGUESE Section 5 — Cultural ──────────────────────────────── */}
      {type === 'pt_world_map' && <LusophoneWorldMapCard />}
      {type === 'pt_holidays' && <PortugueseHolidayCalendarCard />}
      {type === 'pt_food_guide' && <PortugueseFoodGuideCard />}
      {type === 'pt_dialects' && <PortugueseDialectCard />}
      {type === 'pt_etiquette' && <PortugueseEtiquetteCard />}
      {type === 'pt_currency' && <PortugueseCurrencyCard />}
      {type === 'pt_gestures' && <PortugueseGestureCard />}

      {/* ── PORTUGUESE Section 6 — Word families ─────────────────────────── */}
      {type === 'pt_word_family' && resolvePtWordFamilyCard(chapterTitle ?? '')}

      {/* ── PORTUGUESE Section 8 — Phonetics ─────────────────────────────── */}
      {type === 'pt_nasal_vowels' && <PtNasalVowelsCard />}
      {type === 'pt_portuguese_r' && <PtPortugueseRCard />}
      {type === 'pt_lh_nh' && <PtLhNhCard />}
      {type === 'pt_vowel_reduction' && <PtVowelReductionCard />}
      {type === 'pt_ti_di' && <PtTiDiCard />}
      {type === 'pt_stress_accent' && <PtStressAccentCard />}
      {type === 'pt_eu_vs_br' && <PtEuVsBrCard />}
      {type === 'pt_linking' && <PtLinkingCard />}
      {type === 'pt_intonation' && <PtIntonationCard />}

      {/* ── GERMAN Section 3 — Grammar ───────────────────────────────────── */}
      {type === 'de_sein' && <DeSeinCard />}
      {type === 'de_haben' && <DeHabenCard />}
      {type === 'de_werden' && <DeWerdenCard />}
      {type === 'de_regular_verbs' && <DeRegularVerbsCard />}
      {type === 'de_modal_verbs' && <DeModalVerbsCard />}
      {type === 'de_reflexive' && <DeReflexiveCard />}
      {type === 'de_perfekt' && <DePerfektCard />}
      {type === 'de_prateritum' && <DePrateritumCard />}
      {type === 'de_perf_vs_prat' && <DePerfVsPratCard />}
      {type === 'de_futur' && <DeFuturCard />}
      {type === 'de_konjunktiv2' && <DeKonjunktiv2Card />}
      {type === 'de_negation' && <DeNegationCard />}
      {type === 'de_definite_articles' && <DeDefiniteArticlesCard />}
      {type === 'de_indefinite_articles' && <DeIndefiniteArticlesCard />}
      {type === 'de_adj_endings' && <DeAdjEndingsCard />}
      {type === 'de_accusative' && <DeAccusativeCard />}
      {type === 'de_dative' && <DeDativeCard />}
      {type === 'de_cases_overview' && <DeCasesOverviewCard />}
      {type === 'de_separable_verbs' && <DeSeparableVerbsCard />}
      {type === 'de_word_order' && <DeWordOrderCard />}
      {type === 'de_questions' && <DeQuestionsCard />}
      {type === 'de_pronouns' && <DePronounsCard />}

      {/* ── GERMAN Section 5 — Cultural ───────────────────────────────────── */}
      {type === 'de_world_map' && <GermanSpeakingWorldCard />}
      {type === 'de_holidays' && <GermanHolidayCalendarCard />}
      {type === 'de_food_guide' && <GermanFoodGuideCard />}
      {type === 'de_dialects' && <GermanDialectCard />}
      {type === 'de_etiquette' && <GermanEtiquetteCard />}
      {type === 'de_currency' && <GermanCurrencyCard />}
      {type === 'de_gestures' && <GermanGestureCard />}

      {/* ── GERMAN Section 6 — Word families ─────────────────────────────── */}
      {type === 'de_word_family' && resolveDeFamilyCard(chapterTitle ?? '')}

      {/* ── GERMAN Section 8 — Phonetics ─────────────────────────────────── */}
      {type === 'de_umlauts' && <DeUmlautsCard />}
      {type === 'de_eszett' && <DeEszettCard />}
      {type === 'de_german_r' && <DeGermanRCard />}
      {type === 'de_ch_sound' && <DeChSoundCard />}
      {type === 'de_long_short_vowels' && <DeLongShortVowelsCard />}
      {type === 'de_w_v_sound' && <DeWVSoundCard />}
      {type === 'de_consonant_clusters' && <DeConsonantClustersCard />}
      {type === 'de_word_stress' && <DeWordStressCard />}
      {type === 'de_diphthongs' && <DeDiphthongsCard />}

      {/* ── ITALIAN Section 3 — Grammar ───────────────────────────────────── */}
      {type === 'it_essere' && <ItEssereCard />}
      {type === 'it_avere' && <ItAvereCard />}
      {type === 'it_stare' && <ItStareCard />}
      {type === 'it_regular_verbs' && <ItRegularVerbsCard />}
      {type === 'it_modal_verbs' && <ItModalVerbsCard />}
      {type === 'it_reflexive' && <ItReflexiveCard />}
      {type === 'it_passato_prossimo' && <ItPassatoProssimoCard />}
      {type === 'it_imperfetto' && <ItImperfettoCard />}
      {type === 'it_past_comparison' && <ItPastComparisonCard />}
      {type === 'it_futuro' && <ItFuturoCard />}
      {type === 'it_condizionale' && <ItCondizionaleCard />}
      {type === 'it_negation' && <ItNegationCard />}
      {type === 'it_definite_articles' && <ItDefiniteArticlesCard />}
      {type === 'it_indefinite_articles' && <ItIndefiniteArticlesCard />}
      {type === 'it_adj_agreement' && <ItAdjAgreementCard />}
      {type === 'it_articulated_prep' && <ItArticulatedPrepCard />}
      {type === 'it_object_pronouns' && <ItObjectPronounsCard />}
      {type === 'it_subject_pronouns' && <ItSubjectPronounsCard />}
      {type === 'it_questions' && <ItQuestionsCard />}
      {type === 'it_partitive' && <ItPartitiveCard />}
      {type === 'it_imperative' && <ItImperativeCard />}
      {type === 'it_comparatives' && <ItComparativesCard />}

      {/* ── ITALIAN Section 5 — Cultural ──────────────────────────────────── */}
      {type === 'it_world_map' && <ItalophoneWorldCard />}
      {type === 'it_holidays' && <ItalianHolidayCalendarCard />}
      {type === 'it_food_guide' && <ItalianFoodGuideCard />}
      {type === 'it_dialects' && <ItalianDialectCard />}
      {type === 'it_etiquette' && <ItalianEtiquetteCard />}
      {type === 'it_currency' && <ItalianCurrencyCard />}
      {type === 'it_gestures' && <ItalianGestureCard />}

      {/* ── ITALIAN Section 6 — Word families ─────────────────────────────── */}
      {type === 'it_word_family' && resolveItFamilyCard(chapterTitle ?? '')}

      {/* ── ITALIAN Section 8 — Phonetics ─────────────────────────────────── */}
      {type === 'it_cg_sounds' && <ItCGSoundsCard />}
      {type === 'it_sc_sounds' && <ItSCSoundsCard />}
      {type === 'it_gl_gn' && <ItGLGNCard />}
      {type === 'it_double_consonant' && <ItDoubleConsonantCard />}
      {type === 'it_z_sound' && <ItZSoundCard />}
      {type === 'it_rolled_r' && <ItRolledRCard />}
      {type === 'it_open_closed_vowels' && <ItOpenClosedVowelsCard />}
      {type === 'it_stress_patterns' && <ItStressPatternsCard />}
      {type === 'it_diphthongs' && <ItDiphthongsCard />}

      {/* ── JAPANESE Section 3 — Grammar ───────────────────────────────────── */}
      {type === 'ja_hiragana' && <JaHiraganaCard />}
      {type === 'ja_katakana' && <JaKatakanaCard />}
      {type === 'ja_kanji_basics' && <JaKanjiBasicsCard />}
      {type === 'ja_particles' && <JaParticlesCard />}
      {type === 'ja_verb_groups' && <JaVerbGroupsCard />}
      {type === 'ja_te_form' && <JaTEFormCard />}
      {type === 'ja_past_tense' && <JaPastTenseCard />}
      {type === 'ja_negative_form' && <JaNegativeFormCard />}
      {type === 'ja_polite_form' && <JaPoliteFormCard />}
      {type === 'ja_adjectives' && <JaAdjectivesCard />}
      {type === 'ja_noun_phrases' && <JaNounPhrasesCard />}
      {type === 'ja_question_words' && <JaQuestionWordsCard />}
      {type === 'ja_numbers' && <JaNumbersCard />}
      {type === 'ja_counters' && <JaCountersCard />}
      {type === 'ja_time_expressions' && <JaTimeExpressionsCard />}
      {type === 'ja_direction_movement' && <JaDirectionMovementCard />}
      {type === 'ja_giving_receiving' && <JaGivingReceivingCard />}
      {type === 'ja_potential_form' && <JaPotentialFormCard />}
      {type === 'ja_volitional_form' && <JaVolitionalFormCard />}
      {type === 'ja_conditional' && <JaConditionalCard />}
      {type === 'ja_te_iru' && <JaTeIruCard />}
      {type === 'ja_honorifics' && <JaHonorificsCard />}

      {/* ── JAPANESE Section 5 — Cultural ──────────────────────────────────── */}
      {type === 'ja_world_map' && <JapanophoneWorldCard />}
      {type === 'ja_holidays' && <JapaneseHolidayCalendarCard />}
      {type === 'ja_food_guide' && <JapaneseFoodGuideCard />}
      {type === 'ja_regions' && <JapaneseRegionsCard />}
      {type === 'ja_etiquette' && <JapaneseEtiquetteCard />}
      {type === 'ja_currency' && <JapaneseCurrencyCard />}
      {type === 'ja_pop_culture' && <JapanesePopCultureCard />}

      {/* ── JAPANESE Section 6 — Word families ─────────────────────────────── */}
      {type === 'ja_word_family' && resolveJaFamilyCard(chapterTitle ?? '')}

      {/* ── JAPANESE Section 8 — Phonetics ─────────────────────────────────── */}
      {type === 'ja_hiragana_chart' && <JaHiraganaChartCard />}
      {type === 'ja_katakana_chart' && <JaKatakanaChartCard />}
      {type === 'ja_vowel_sounds' && <JaVowelSoundsCard />}
      {type === 'ja_consonant_sounds' && <JaConsonantSoundsCard />}
      {type === 'ja_long_vowels' && <JaLongVowelsCard />}
      {type === 'ja_double_consonants' && <JaDoubleConsonantsCard />}
      {type === 'ja_pitch_accent' && <JaPitchAccentCard />}
      {type === 'ja_loanwords' && <JaLoanwordsCard />}
      {type === 'ja_n_sound' && <JaNSoundCard />}

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

  const grammarType = classifyGrammarType(chapterTitle, langKey);
  if (grammarType) {
    return (
      <div className={className}>
        <GrammarChapterView type={grammarType} chapterNumber={chapterNumber} chapterTitle={chapterTitle} language={langKey} />
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
