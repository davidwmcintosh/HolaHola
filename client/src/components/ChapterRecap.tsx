import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  MessageSquare,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Star,
  Target,
  Zap,
  GraduationCap
} from "lucide-react";

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

interface ChapterRecapProps {
  chapter: Chapter;
  language: string;
  onPracticeWithDaniela: () => void;
  onReviewFlashcards: () => void;
}

function getAchievementBadge(progress: number, sectionsCount: number, completedSections: number) {
  if (progress === 100) {
    return {
      icon: Trophy,
      label: "Chapter Master",
      color: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
      description: "You've completed this entire chapter!"
    };
  }
  if (progress >= 75) {
    return {
      icon: Star,
      label: "Almost There",
      color: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
      description: `Just ${sectionsCount - completedSections} more lessons to complete!`
    };
  }
  if (progress >= 50) {
    return {
      icon: Zap,
      label: "Halfway Hero",
      color: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
      description: "You're making great progress!"
    };
  }
  if (progress >= 25) {
    return {
      icon: Target,
      label: "Getting Started",
      color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
      description: "Keep up the momentum!"
    };
  }
  return null;
}

function extractKeyVocabulary(sections: Section[]): { word: string; translation: string }[] {
  const vocab: { word: string; translation: string }[] = [];
  const seen = new Set<string>();
  
  for (const section of sections) {
    if (!section.drills) continue;
    
    for (const drill of section.drills) {
      if ((drill.itemType === 'translate_speak' || drill.itemType === 'matching' || drill.itemType === 'listen_repeat') 
          && drill.targetText 
          && drill.targetText.length < 40
          && !seen.has(drill.targetText.toLowerCase())) {
        seen.add(drill.targetText.toLowerCase());
        vocab.push({
          word: drill.targetText,
          translation: drill.prompt || ''
        });
      }
      if (vocab.length >= 8) break;
    }
    if (vocab.length >= 8) break;
  }
  
  return vocab;
}

function extractKeyPhrases(sections: Section[]): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();
  
  for (const section of sections) {
    if (!section.drills) continue;
    
    for (const drill of section.drills) {
      if (drill.targetText 
          && drill.targetText.length >= 15 
          && drill.targetText.length < 80
          && !seen.has(drill.targetText.toLowerCase())) {
        seen.add(drill.targetText.toLowerCase());
        phrases.push(drill.targetText);
      }
      if (phrases.length >= 4) break;
    }
    if (phrases.length >= 4) break;
  }
  
  return phrases;
}

function extractConversationTopics(sections: Section[]): string[] {
  return sections
    .filter(s => s.conversationTopic)
    .map(s => s.conversationTopic!)
    .slice(0, 3);
}

export function ChapterRecap({
  chapter,
  language,
  onPracticeWithDaniela,
  onReviewFlashcards
}: ChapterRecapProps) {
  const achievement = getAchievementBadge(chapter.progress, chapter.sectionsCount, chapter.completedSections);
  const keyVocab = extractKeyVocabulary(chapter.sections);
  const keyPhrases = extractKeyPhrases(chapter.sections);
  const conversationTopics = extractConversationTopics(chapter.sections);
  const isComplete = chapter.progress === 100;
  
  const totalDrills = chapter.sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const completedLessons = chapter.sections.filter(s => s.isComplete).length;
  
  return (
    <Card 
      className={`overflow-hidden border-2 ${isComplete ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-background' : 'border-primary/20 bg-gradient-to-br from-primary/5 to-background'}`}
      data-testid="chapter-recap"
    >
      <CardContent className="p-0">
        <div className={`p-4 border-b ${isComplete ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isComplete ? 'bg-amber-500/20' : 'bg-primary/20'}`}>
              {isComplete ? (
                <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <GraduationCap className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">Chapter {chapter.number} Recap</h3>
              <p className="text-sm text-muted-foreground">{chapter.title}</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-5">
          {achievement && (
            <div 
              className={`flex items-center gap-3 p-3 rounded-lg border ${achievement.color}`}
              data-testid="achievement-badge"
            >
              <achievement.icon className="h-6 w-6" />
              <div>
                <p className="font-semibold text-sm">{achievement.label}</p>
                <p className="text-xs opacity-80">{achievement.description}</p>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Chapter Progress</span>
              <span className="font-semibold">{chapter.progress}%</span>
            </div>
            <Progress value={chapter.progress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedLessons}/{chapter.sectionsCount} lessons complete</span>
              <span>{totalDrills} practice activities</span>
            </div>
          </div>
          
          {keyVocab.length > 0 && (
            <div data-testid="key-vocabulary-summary">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Key Vocabulary
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {keyVocab.slice(0, 6).map((item, i) => (
                  <div 
                    key={i} 
                    className="bg-muted/50 rounded-md px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium">{item.word}</span>
                    {item.translation && (
                      <span className="text-muted-foreground ml-1">- {item.translation.slice(0, 20)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {keyPhrases.length > 0 && (
            <div data-testid="key-phrases-summary">
              <p className="text-xs font-medium text-muted-foreground mb-2">Key Phrases</p>
              <div className="space-y-1">
                {keyPhrases.slice(0, 3).map((phrase, i) => (
                  <div 
                    key={i} 
                    className="bg-muted/50 rounded-md px-3 py-2 text-sm italic"
                  >
                    "{phrase}"
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {conversationTopics.length > 0 && (
            <div data-testid="conversation-topics-summary">
              <p className="text-xs font-medium text-muted-foreground mb-2">Conversation Topics Covered</p>
              <div className="flex flex-wrap gap-1.5">
                {conversationTopics.map((topic, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-3">Continue Learning</p>
            
            <Button 
              className="w-full justify-center gap-2"
              onClick={onPracticeWithDaniela}
              data-testid="button-practice-daniela-recap"
            >
              <MessageSquare className="h-4 w-4" />
              Practice with Daniela
            </Button>
            
            <Button 
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={onReviewFlashcards}
              data-testid="button-review-flashcards-recap"
            >
              <BookOpen className="h-4 w-4" />
              Review Flashcards
            </Button>
          </div>
          
          {isComplete && (
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
                <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Chapter Complete!
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ChapterRecap;
