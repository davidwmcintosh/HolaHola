import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Globe, Users, BookOpen, Lightbulb } from "lucide-react";
import { SunArcGreetings, FormalInformalComparison, QuickPhraseGrid } from "./TextbookInfographics";
import { languageChapterData } from "@/data/chapter-intro-content";

import familyGatheringImg from "@assets/stock_images/family_gathering_aro_0f321ed1.jpg";
import coffeeShopImg from "@assets/stock_images/coffee_shop_friends__69e794a8.jpg";
import danielaTutorImg from "@assets/generated_images/daniela_tutor_welcome_illustration.png";

interface ChapterIntroductionProps {
  chapterNumber: number;
  chapterTitle?: string;
  language: string;
  className?: string;
}

const chapterImages: Record<string, string[]> = {
  greetings: [coffeeShopImg],
  numbers: [],
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

function normalizeLanguageKey(language: string): string {
  const lower = language.toLowerCase();
  if (lower === 'mandarin chinese' || lower === 'mandarin') return 'mandarin';
  return lower;
}

export function ChapterIntroduction({ chapterNumber, chapterTitle, language, className = "" }: ChapterIntroductionProps) {
  const langKey = normalizeLanguageKey(language);
  const langData = languageChapterData[langKey];
  
  if (!langData || !chapterTitle) return null;
  
  const chapterType = classifyChapterType(chapterTitle);
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
