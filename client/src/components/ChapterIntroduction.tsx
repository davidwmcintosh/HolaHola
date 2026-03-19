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
  | 'ser_estar' | 'pret_imp' | 'por_para' | 'false_cognates'
  | 'ar_verbs' | 'er_verbs' | 'ir_verbs'
  | 'ser_only' | 'estar_only' | 'tener' | 'ir_go'
  | 'stem_change' | 'go_verbs'
  | 'saber_conocer' | 'reflexive'
  | 'pret_regular' | 'pret_irregular'
  | 'imperfect' | 'future' | 'conditional' | 'subjunctive' | 'commands'
  | 'gender_articles' | 'adjective_agreement' | 'object_pronouns'
  | 'negation_questions' | 'tu_usted'
  | 'spatial_prep' | 'temporal_prep';

function classifyGrammarType(title: string): GrammarChapterType | null {
  const lower = title.toLowerCase();

  // ── Existing 4 types (check first — more specific) ──────────────────────
  if (lower.includes('ser') && (lower.includes('estar') || lower.includes('vs') || lower.includes(' y '))) return 'ser_estar';
  if (lower.includes('estar') && lower.includes('ser')) return 'ser_estar';
  if ((lower.includes('pret') && lower.includes('imperfec')) || (lower.includes('preterite') && lower.includes('imperfect'))) return 'pret_imp';
  if (lower.includes('por') && lower.includes('para')) return 'por_para';
  if (lower.includes('false cognate') || lower.includes('falso cognado') || lower.includes('false friend') || lower.includes('amigos falsos')) return 'false_cognates';

  // ── Verb conjugation tables ───────────────────────────────────────────────
  if (lower.includes('-ar verb') || lower.includes('ar verb') || (lower.includes('hablar') && !lower.includes('pret')) || lower.includes('regular ar') || lower.includes('verbos -ar')) return 'ar_verbs';
  if (lower.includes('-er verb') || lower.includes('er verb') || (lower.includes('comer') && !lower.includes('pret')) || lower.includes('regular er') || lower.includes('verbos -er')) return 'er_verbs';
  if (lower.includes('-ir verb') || lower.includes('ir verb') || (lower.includes('vivir') && !lower.includes('pret')) || lower.includes('regular ir') || lower.includes('verbos -ir')) return 'ir_verbs';
  if (lower === 'ser' || lower.includes('verb ser') || lower.includes('el verbo ser') || (lower.startsWith('ser') && !lower.includes('estar'))) return 'ser_only';
  if (lower === 'estar' || lower.includes('verb estar') || lower.includes('el verbo estar') || (lower.startsWith('estar') && !lower.includes('ser'))) return 'estar_only';
  if (lower.includes('tener') && !lower.includes('pret')) return 'tener';
  if ((lower.includes(' ir ') || lower.startsWith('ir') || lower.includes('verb ir') || lower.includes('going to') || lower.includes('ir a ')) && !lower.includes('vivir') && !lower.includes('subjun') && !lower.includes('pret')) return 'ir_go';

  // ── Tense-specific ────────────────────────────────────────────────────────
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

  // ── Structural / comparison cards ─────────────────────────────────────────
  if (lower.includes('gender') || lower.includes('article') || lower.includes('género') || lower.includes('artículo') || lower.includes('el/la') || lower.includes('un/una')) return 'gender_articles';
  if (lower.includes('adjective') || lower.includes('adjetivo') || lower.includes('adjective agreement') || lower.includes('concordancia')) return 'adjective_agreement';
  if (lower.includes('object pronoun') || lower.includes('pronoun') || lower.includes('pronombre de objeto') || lower.includes('direct object') || lower.includes('indirect object') || lower.includes('lo/la/le')) return 'object_pronouns';
  if (lower.includes('negation') || lower.includes('negativo') || lower.includes('question') || lower.includes('pregunta') || lower.includes('interrogative') || lower.includes('sentence structure') || lower.includes('word order')) return 'negation_questions';
  if ((lower.includes('tú') && lower.includes('usted')) || (lower.includes('tu vs') && !lower.includes('tutor')) || lower.includes('formal vs informal') || lower.includes('register')) return 'tu_usted';

  // ── Section 4 — Prepositions ──────────────────────────────────────────────
  if (lower.includes('temporal prep') || lower.includes('preposicion de tiempo') || lower.includes('antes de') || lower.includes('después de') || lower.includes('duration') || lower.includes('hace + tiempo')) return 'temporal_prep';
  if (lower.includes('preposition') || lower.includes('preposición') || lower.includes('spatial') || lower.includes('donde está') || lower.includes('location prep') || lower.includes('prep of place')) return 'spatial_prep';

  return null;
}

const GRAMMAR_LABELS: Record<GrammarChapterType, { title: string; subtitle: string }> = {
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
  spatial_prep: { title: 'Spatial Prepositions', subtitle: 'Where things are — en, sobre, debajo de, delante de…' },
  temporal_prep: { title: 'Temporal Prepositions', subtitle: 'When things happen — antes de, después de, desde, hasta, hace…' },
};

function GrammarChapterView({ type, chapterNumber }: { type: GrammarChapterType; chapterNumber: number }) {
  const { title, subtitle } = GRAMMAR_LABELS[type];
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-primary mb-1">Chapter {chapterNumber} — Grammar Focus</p>
              <h3 className="text-base font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
      {type === 'spatial_prep' && <SpatialPrepositionMap />}
      {type === 'temporal_prep' && <TemporalPrepositionTimeline />}

      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
        <Users className="h-4 w-4" />
        <span>Explore the lessons below to practice these patterns with Daniela!</span>
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
        <GrammarChapterView type={grammarType} chapterNumber={chapterNumber} />
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
