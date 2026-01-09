import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  Volume2,
  CheckCircle2,
  MessageSquare,
  Dumbbell,
  Book,
  GraduationCap,
  ChevronRight,
  Sparkles,
  RotateCcw
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

interface TextbookSection {
  id: string;
  name: string;
  description: string;
  lessonType: string;
  objectives: string[] | null;
  estimatedMinutes: number | null;
  progress: number;
  isComplete: boolean;
  drills: DrillItem[];
  conversationTopic: string | null;
  conversationPrompt: string | null;
}

interface ContentBlock {
  type: 'text' | 'image' | 'vocabulary' | 'grammar' | 'drill-preview' | 'conversation-prompt';
  content: string;
  metadata?: Record<string, any>;
}

function getLessonTypeIcon(type: string) {
  switch (type) {
    case 'conversation':
      return <MessageSquare className="h-5 w-5" />;
    case 'drill':
      return <Dumbbell className="h-5 w-5" />;
    case 'vocabulary':
      return <Book className="h-5 w-5" />;
    case 'grammar':
      return <GraduationCap className="h-5 w-5" />;
    default:
      return <Sparkles className="h-5 w-5" />;
  }
}

function getLessonTypeLabel(type: string) {
  switch (type) {
    case 'conversation':
      return 'Conversation Practice';
    case 'drill':
      return 'Pronunciation Drill';
    case 'vocabulary':
      return 'Vocabulary Builder';
    case 'grammar':
      return 'Grammar Focus';
    case 'cultural_exploration':
      return 'Cultural Discovery';
    default:
      return 'Interactive Lesson';
  }
}

function DrillPreviewCard({ drills, onStartDrill }: { 
  drills: DrillItem[]; 
  onStartDrill?: () => void;
}) {
  const masteredCount = drills.filter(d => d.mastered).length;
  const progressPercent = drills.length > 0 
    ? Math.round((masteredCount / drills.length) * 100) 
    : 0;

  const previewItems = drills.slice(0, 4);

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Practice Drills</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {masteredCount}/{drills.length} mastered
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {previewItems.map((drill, index) => (
            <div 
              key={drill.id}
              className={`p-2 rounded-md text-xs ${
                drill.mastered 
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                  : 'bg-background'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {drill.mastered && <CheckCircle2 className="h-3 w-3" />}
                <span className="truncate">{drill.prompt}</span>
              </div>
            </div>
          ))}
        </div>

        {drills.length > 4 && (
          <p className="text-xs text-muted-foreground text-center mb-3">
            +{drills.length - 4} more drills
          </p>
        )}

        <div className="flex items-center gap-3">
          <Progress value={progressPercent} className="flex-1 h-2" />
          <Button 
            size="sm" 
            onClick={onStartDrill}
            data-testid="button-start-drill"
          >
            <Play className="h-3 w-3 mr-1" />
            {progressPercent > 0 ? 'Continue' : 'Start'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConversationPromptCard({ topic, onStart }: {
  topic: string;
  onStart?: () => void;
}) {
  return (
    <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Conversation Topic</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          {topic}
        </p>

        <Button 
          className="w-full" 
          onClick={onStart}
          data-testid="button-start-conversation"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Practice with Daniela
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ObjectivesList({ objectives }: { objectives: string[] }) {
  return (
    <Card className="bg-background">
      <CardContent className="p-4">
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          What You'll Learn
        </h4>
        <ul className="space-y-1.5">
          {objectives.map((objective, index) => (
            <li 
              key={index} 
              className="text-sm text-muted-foreground flex items-start gap-2"
            >
              <CheckCircle2 className="h-3 w-3 mt-1 text-primary shrink-0" />
              <span>{objective}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function VocabularyBlock({ words }: { words: { word: string; translation: string; }[] }) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const handlePlay = (index: number) => {
    setPlayingIndex(index);
    setTimeout(() => setPlayingIndex(null), 1500);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
          <Book className="h-4 w-4 text-primary" />
          Key Vocabulary
        </h4>
        <div className="grid gap-2">
          {words.map((item, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover-elevate cursor-pointer"
              onClick={() => handlePlay(index)}
              data-testid={`vocab-word-${index}`}
            >
              <div>
                <span className="font-medium text-sm">{item.word}</span>
                <span className="text-muted-foreground text-sm ml-2">
                  - {item.translation}
                </span>
              </div>
              <Button 
                size="icon" 
                variant="ghost"
                className="h-7 w-7"
              >
                {playingIndex === index ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface TextbookSectionRendererProps {
  section: TextbookSection;
  onStartDrill?: () => void;
  onStartConversation?: () => void;
  className?: string;
}

export function TextbookSectionRenderer({
  section,
  onStartDrill,
  onStartConversation,
  className = ''
}: TextbookSectionRendererProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            section.isComplete ? 'bg-green-500/20' : 'bg-primary/10'
          }`}>
            {section.isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              getLessonTypeIcon(section.lessonType)
            )}
          </div>
          <div>
            <h3 className="font-semibold">{section.name}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {getLessonTypeLabel(section.lessonType)}
              </Badge>
              {section.estimatedMinutes && (
                <span className="text-xs text-muted-foreground">
                  ~{section.estimatedMinutes} min
                </span>
              )}
            </div>
          </div>
        </div>
        
        {section.progress > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{section.progress}%</span>
            <div className="w-16">
              <Progress value={section.progress} className="h-2" />
            </div>
          </div>
        )}
      </div>

      {section.description && (
        <p className="text-sm text-muted-foreground">
          {section.description}
        </p>
      )}

      {section.objectives && section.objectives.length > 0 && (
        <ObjectivesList objectives={section.objectives} />
      )}

      {section.conversationTopic && (
        <ConversationPromptCard 
          topic={section.conversationTopic}
          onStart={onStartConversation}
        />
      )}

      {section.drills && section.drills.length > 0 && (
        <DrillPreviewCard 
          drills={section.drills}
          onStartDrill={onStartDrill}
        />
      )}

      {section.isComplete && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Section Complete!</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-2 h-7"
            data-testid="button-replay-section"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Replay
          </Button>
        </div>
      )}
    </div>
  );
}

export default TextbookSectionRenderer;
