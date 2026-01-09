import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  ChevronRight, 
  Play,
  CheckCircle2,
  Lock,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  progress: number;
  isLocked: boolean;
  sectionsCount: number;
  completedSections: number;
}

const SAMPLE_CHAPTERS: Chapter[] = [
  {
    id: "ch1",
    number: 1,
    title: "Greetings & Introductions",
    description: "Learn to say hello, introduce yourself, and make a great first impression",
    progress: 75,
    isLocked: false,
    sectionsCount: 5,
    completedSections: 4,
  },
  {
    id: "ch2",
    number: 2,
    title: "Numbers & Counting",
    description: "Master numbers 1-100 with rhythm drills and real-world practice",
    progress: 30,
    isLocked: false,
    sectionsCount: 6,
    completedSections: 2,
  },
  {
    id: "ch3",
    number: 3,
    title: "Days, Months & Time",
    description: "Tell time, schedule appointments, and talk about your week",
    progress: 0,
    isLocked: false,
    sectionsCount: 4,
    completedSections: 0,
  },
  {
    id: "ch4",
    number: 4,
    title: "Family & Relationships",
    description: "Describe your family and talk about the people in your life",
    progress: 0,
    isLocked: true,
    sectionsCount: 5,
    completedSections: 0,
  },
  {
    id: "ch5",
    number: 5,
    title: "At the Restaurant",
    description: "Order food, ask for the check, and navigate dining experiences",
    progress: 0,
    isLocked: true,
    sectionsCount: 6,
    completedSections: 0,
  },
];

function ChapterCard({ chapter }: { chapter: Chapter }) {
  const progressColor = chapter.progress >= 75 
    ? "text-green-500" 
    : chapter.progress >= 25 
      ? "text-amber-500" 
      : "text-muted-foreground";

  return (
    <Card 
      className={`hover-elevate cursor-pointer transition-all ${chapter.isLocked ? 'opacity-60' : ''}`}
      data-testid={`card-chapter-${chapter.number}`}
    >
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            {chapter.isLocked ? (
              <Lock className="h-5 w-5 text-muted-foreground" />
            ) : chapter.progress === 100 ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <span className="text-lg font-bold text-primary">{chapter.number}</span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base md:text-lg truncate">
                {chapter.title}
              </h3>
              {chapter.progress === 100 && (
                <Badge variant="secondary" className="shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {chapter.description}
            </p>
            
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Progress value={chapter.progress} className="h-2" />
              </div>
              <span className={`text-sm font-medium ${progressColor}`}>
                {chapter.progress}%
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              {chapter.completedSections} of {chapter.sectionsCount} sections
            </p>
          </div>
          
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function InteractiveTextbook() {
  const { language } = useLanguage();
  
  const languageDisplayName = language.charAt(0).toUpperCase() + language.slice(1);
  
  const totalProgress = Math.round(
    SAMPLE_CHAPTERS.reduce((acc, ch) => acc + ch.progress, 0) / SAMPLE_CHAPTERS.length
  );

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Interactive Textbook
          </h1>
          <p className="text-muted-foreground mt-1">
            Your {languageDisplayName} learning journey, chapter by chapter
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Overall Progress</p>
            <p className="text-xl font-bold text-primary">{totalProgress}%</p>
          </div>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
      
      <Card className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/20">
            <Play className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Continue Learning</h3>
            <p className="text-sm text-muted-foreground">
              Pick up where you left off in Chapter 2: Numbers & Counting
            </p>
          </div>
          <Button data-testid="button-continue-learning">
            Continue
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Card>
      
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Chapters</h2>
        <div className="space-y-3">
          {SAMPLE_CHAPTERS.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} />
          ))}
        </div>
      </div>
      
      <Card className="p-6 text-center bg-muted/30">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold mb-2">More Chapters Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          We're actively building new chapters with engaging content, embedded drills, and visual learning experiences.
        </p>
      </Card>
    </div>
  );
}
