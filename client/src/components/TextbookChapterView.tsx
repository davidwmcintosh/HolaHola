import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  MessageSquare,
  Dumbbell,
  Book,
  GraduationCap,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Play
} from "lucide-react";
import { 
  SunArcGreetings, 
  FormalInformalComparison, 
  ConversationFlow,
  QuickPhraseGrid,
  SAMPLE_GREETINGS_DATA
} from "./TextbookInfographics";

interface DrillItem {
  id: string;
  itemType: string;
  prompt: string;
  targetText: string;
  difficulty: number;
  mastered: boolean;
  attempts: number;
}

interface Section {
  id: string;
  name: string;
  description: string;
  lessonType: string;
  estimatedMinutes: number;
  progress: number;
  isComplete: boolean;
  hasDrills: boolean;
  drillCount: number;
  objectives?: string[];
  conversationTopic?: string;
  drills?: DrillItem[];
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  progress: number;
  isLocked: boolean;
  sectionsCount: number;
  completedSections: number;
  sections: Section[];
  culturalTheme?: string;
  actflLevel?: string;
}

interface TextbookChapterViewProps {
  chapter: Chapter;
  language: string;
  onBack: () => void;
  onStartConversation: () => void;
  onStartDrill: (sectionId: string) => void;
}

function getLessonTypeIcon(type: string) {
  switch (type) {
    case 'conversation':
      return <MessageSquare className="h-4 w-4" />;
    case 'drill':
      return <Dumbbell className="h-4 w-4" />;
    case 'vocabulary':
      return <Book className="h-4 w-4" />;
    case 'grammar':
      return <GraduationCap className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
}

function getInfographicForSection(sectionName: string, lessonType: string, sectionIndex: number) {
  const lowerName = sectionName.toLowerCase();
  
  // Keyword-based matching for specific content
  if (lowerName.includes('time') || lowerName.includes('greeting') || lowerName.includes('hello') || lowerName.includes('day') || lowerName.includes('buenos') || lowerName.includes('hola')) {
    return <SunArcGreetings className="mb-4" />;
  }
  
  if (lowerName.includes('formal') || lowerName.includes('polite') || lowerName.includes('respect') || lowerName.includes('usted')) {
    return (
      <FormalInformalComparison 
        items={SAMPLE_GREETINGS_DATA.formalInformal}
        className="mb-4"
      />
    );
  }
  
  if (lowerName.includes('name') || lowerName.includes('introduce') || lowerName.includes('meet')) {
    return (
      <ConversationFlow
        exchanges={SAMPLE_GREETINGS_DATA.nameExchange}
        speakerALabel="You"
        speakerBLabel="New friend"
        className="mb-4"
      />
    );
  }
  
  if (lowerName.includes('chat') || lowerName.includes('basic') || lowerName.includes('essential') || lowerName.includes('phrase') || lowerName.includes('vocabulary')) {
    return (
      <QuickPhraseGrid
        phrases={SAMPLE_GREETINGS_DATA.quickPhrases}
        columns={3}
        className="mb-4"
      />
    );
  }
  
  // Fallback: cycle through infographics based on section index for visual variety
  const infographicCycle = sectionIndex % 4;
  switch (infographicCycle) {
    case 0:
      return <SunArcGreetings className="mb-4" />;
    case 1:
      return (
        <FormalInformalComparison 
          items={SAMPLE_GREETINGS_DATA.formalInformal}
          className="mb-4"
        />
      );
    case 2:
      return (
        <ConversationFlow
          exchanges={SAMPLE_GREETINGS_DATA.nameExchange}
          speakerALabel="You"
          speakerBLabel="Partner"
          className="mb-4"
        />
      );
    case 3:
      return (
        <QuickPhraseGrid
          phrases={SAMPLE_GREETINGS_DATA.quickPhrases}
          columns={3}
          className="mb-4"
        />
      );
    default:
      return <SunArcGreetings className="mb-4" />;
  }
}

function VisualLessonCard({
  section,
  index,
  onStartConversation,
  onStartDrill
}: {
  section: Section;
  index: number;
  onStartConversation: () => void;
  onStartDrill: () => void;
}) {
  const infographic = getInfographicForSection(section.name, section.lessonType, index);
  
  return (
    <Card 
      className="overflow-hidden"
      data-testid={`visual-lesson-card-${section.id}`}
    >
      <CardContent className="p-0">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                section.isComplete 
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                  : 'bg-primary/10 text-primary'
              }`}>
                {section.isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <div>
                <h3 className="font-semibold text-sm">{section.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {section.lessonType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {section.estimatedMinutes} min
                  </span>
                </div>
              </div>
            </div>
            {section.progress > 0 && section.progress < 100 && (
              <div className="flex items-center gap-2">
                <Progress value={section.progress} className="w-12 h-1.5" />
                <span className="text-xs text-muted-foreground">{section.progress}%</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4">
          {section.description && (
            <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
          )}
          
          {infographic}
          
          {!infographic && section.objectives && section.objectives.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">What you'll learn:</p>
              <ul className="space-y-1">
                {section.objectives.slice(0, 3).map((obj, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <Sparkles className="h-3 w-3 mt-1 text-primary shrink-0" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex gap-2">
            {section.conversationTopic && (
              <Button 
                className="flex-1" 
                onClick={onStartConversation}
                data-testid={`button-practice-daniela-${section.id}`}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Practice with Daniela
              </Button>
            )}
            {section.hasDrills && section.drillCount > 0 && (
              <Button 
                variant={section.conversationTopic ? "outline" : "default"}
                className={section.conversationTopic ? "" : "flex-1"}
                onClick={onStartDrill}
                data-testid={`button-start-drill-${section.id}`}
              >
                <Dumbbell className="h-4 w-4 mr-2" />
                {section.drillCount} Drills
              </Button>
            )}
            {!section.conversationTopic && !section.hasDrills && (
              <Button 
                className="flex-1" 
                variant="secondary"
                data-testid={`button-start-lesson-${section.id}`}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Lesson
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TextbookChapterView({
  chapter,
  language,
  onBack,
  onStartConversation,
  onStartDrill
}: TextbookChapterViewProps) {
  const completedCount = chapter.sections.filter(s => s.isComplete).length;
  
  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto pb-12">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b">
        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            data-testid="button-back-to-chapters"
            className="gap-1 -ml-2"
          >
            <ChevronLeft className="h-4 w-4" />
            All Chapters
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {completedCount}/{chapter.sectionsCount} complete
            </span>
            <Progress value={chapter.progress} className="w-20 h-2" />
          </div>
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <Badge variant="outline" className="mb-2">
          Chapter {chapter.number}
        </Badge>
        <h1 className="text-2xl md:text-3xl font-bold">{chapter.title}</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">{chapter.description}</p>
        {chapter.culturalTheme && (
          <p className="text-sm text-primary">
            <Sparkles className="h-3 w-3 inline mr-1" />
            Cultural focus: {chapter.culturalTheme}
          </p>
        )}
      </div>
      
      <div className="grid gap-4">
        {chapter.sections.map((section, index) => (
          <VisualLessonCard
            key={section.id}
            section={section}
            index={index}
            onStartConversation={onStartConversation}
            onStartDrill={() => onStartDrill(section.id)}
          />
        ))}
      </div>
      
      {chapter.sections.length === 0 && (
        <Card className="p-8 text-center bg-muted/30">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Lessons Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            This chapter's visual lessons are being prepared. Check back soon!
          </p>
        </Card>
      )}
    </div>
  );
}

export default TextbookChapterView;
