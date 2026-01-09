import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  BookOpen, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Play,
  CheckCircle2,
  Lock,
  Sparkles,
  MessageSquare,
  Dumbbell,
  Book,
  GraduationCap,
  X,
  RotateCcw
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation } from "wouter";
import { TextbookSectionRenderer } from "@/components/TextbookSectionRenderer";
import { RhythmDrill } from "@/components/RhythmDrill";

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

interface TextbookData {
  language: string;
  curriculumPath?: {
    id: string;
    name: string;
    description: string;
    startLevel: string;
    endLevel: string;
  };
  chapters: Chapter[];
  totalChapters: number;
  completedChapters: number;
  message?: string;
}

interface ChapterDetail {
  chapter: Chapter;
  sections: Section[];
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

function SectionCard({ 
  section, 
  chapterLocked,
  onOpen 
}: { 
  section: Section; 
  chapterLocked: boolean;
  onOpen: () => void;
}) {
  const isDisabled = chapterLocked;
  
  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-md border bg-background/50 ${isDisabled ? 'opacity-50' : 'hover-elevate cursor-pointer'}`}
      data-testid={`section-${section.id}`}
      onClick={() => !isDisabled && onOpen()}
    >
      <div className={`p-2 rounded-full ${section.isComplete ? 'bg-green-500/20' : 'bg-muted'}`}>
        {section.isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          getLessonTypeIcon(section.lessonType)
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{section.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-xs">
            {section.lessonType}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {section.estimatedMinutes} min
          </span>
          {section.hasDrills && (
            <span className="text-xs text-muted-foreground">
              {section.drillCount} drills
            </span>
          )}
        </div>
      </div>
      
      {section.progress > 0 && section.progress < 100 && (
        <div className="w-12">
          <Progress value={section.progress} className="h-1.5" />
        </div>
      )}
      
      {!isDisabled && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

function ChapterCard({ 
  chapter, 
  isExpanded, 
  onToggle,
  onOpenSection
}: { 
  chapter: Chapter; 
  isExpanded: boolean;
  onToggle: () => void;
  onOpenSection: (section: Section) => void;
}) {
  const progressColor = chapter.progress >= 75 
    ? "text-green-500" 
    : chapter.progress >= 25 
      ? "text-amber-500" 
      : "text-muted-foreground";

  return (
    <Card 
      className={`transition-all ${chapter.isLocked ? 'opacity-60' : ''}`}
      data-testid={`card-chapter-${chapter.number}`}
    >
      <CardContent className="p-4 md:p-6">
        <div 
          className={`flex items-start gap-4 ${!chapter.isLocked ? 'cursor-pointer' : ''}`}
          onClick={() => !chapter.isLocked && onToggle()}
        >
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
          
          {chapter.isLocked ? (
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          )}
        </div>
        
        {isExpanded && !chapter.isLocked && chapter.sections.length > 0 && (
          <div className="mt-4 pt-4 border-t space-y-2">
            {chapter.sections.map((section) => (
              <SectionCard 
                key={section.id} 
                section={section} 
                chapterLocked={chapter.isLocked}
                onOpen={() => onOpenSection(section)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChapterSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full mt-2" />
            <Skeleton className="h-3 w-24 mt-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionDetailView({
  section,
  chapterId,
  language,
  onClose,
  onStartConversation
}: {
  section: Section;
  chapterId: string;
  language: string;
  onClose: () => void;
  onStartConversation: () => void;
}) {
  const [showDrillMode, setShowDrillMode] = useState(false);
  
  const { data: detailData, isLoading } = useQuery<ChapterDetail>({
    queryKey: ['/api/textbook', language, 'chapter', chapterId],
    enabled: !!chapterId,
  });
  
  const sectionWithDrills = detailData?.sections?.find(s => s.id === section.id) || section;
  
  const drillItems = sectionWithDrills.drills?.map(d => ({
    id: d.id,
    prompt: d.prompt,
    targetText: d.targetText,
    difficulty: d.difficulty
  })) || [];

  if (showDrillMode && drillItems.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDrillMode(false)}
            data-testid="button-back-to-section"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Section
          </Button>
        </div>
        
        <RhythmDrill
          title={`${section.name} Drills`}
          description={`Practice the key phrases and vocabulary from this section`}
          items={drillItems}
          onComplete={(results) => {
            console.log('Drill results:', results);
            setShowDrillMode(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <TextbookSectionRenderer
          section={{
            ...sectionWithDrills,
            objectives: sectionWithDrills.objectives || null,
            conversationTopic: sectionWithDrills.conversationTopic || null,
            conversationPrompt: null,
            drills: sectionWithDrills.drills || []
          }}
          onStartDrill={() => setShowDrillMode(true)}
          onStartConversation={onStartConversation}
        />
      )}
      
      {!showDrillMode && drillItems.length > 0 && (
        <div className="pt-4 border-t">
          <Button 
            className="w-full" 
            onClick={() => setShowDrillMode(true)}
            data-testid="button-start-section-drill"
          >
            <Dumbbell className="h-4 w-4 mr-2" />
            Start Practice Drills ({drillItems.length} items)
          </Button>
        </div>
      )}
    </div>
  );
}

export default function InteractiveTextbook() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<{
    section: Section;
    chapterId: string;
  } | null>(null);
  
  const languageDisplayName = language.charAt(0).toUpperCase() + language.slice(1);
  
  const { data: textbookData, isLoading, error } = useQuery<TextbookData>({
    queryKey: ['/api/textbook', language],
  });
  
  const chapters = textbookData?.chapters || [];
  
  const totalProgress = chapters.length > 0
    ? Math.round(chapters.reduce((acc, ch) => acc + ch.progress, 0) / chapters.length)
    : 0;
  
  const continueChapter = chapters.find(ch => !ch.isLocked && ch.progress < 100 && ch.progress > 0)
    || chapters.find(ch => !ch.isLocked && ch.progress === 0);

  const handleOpenSection = useCallback((section: Section, chapterId: string) => {
    setSelectedSection({ section, chapterId });
  }, []);
  
  const handleStartConversation = useCallback(() => {
    setLocation('/chat');
  }, [setLocation]);

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <Link href="/">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2" data-testid="button-back-to-hub">
          <ChevronLeft className="h-4 w-4" />
          Language Hub
        </Button>
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Interactive Textbook
          </h1>
          <p className="text-muted-foreground mt-1">
            Your {languageDisplayName} learning journey, chapter by chapter
          </p>
          {textbookData?.curriculumPath && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {textbookData.curriculumPath.name}
            </p>
          )}
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
      
      {continueChapter && (
        <Card className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/20">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Continue Learning</h3>
              <p className="text-sm text-muted-foreground">
                Pick up where you left off in Chapter {continueChapter.number}: {continueChapter.title}
              </p>
            </div>
            <Button 
              data-testid="button-continue-learning"
              onClick={() => setExpandedChapter(continueChapter.id)}
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}
      
      {error ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">
            Unable to load textbook content. Please try again.
          </p>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Chapters</h2>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <ChapterSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : chapters.length === 0 ? (
        <Card className="p-6 text-center bg-muted/30">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-2">No Chapters Available Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {textbookData?.message || `The Interactive Textbook for ${languageDisplayName} is coming soon!`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Chapters</h2>
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <ChapterCard 
                key={chapter.id} 
                chapter={chapter}
                isExpanded={expandedChapter === chapter.id}
                onToggle={() => setExpandedChapter(
                  expandedChapter === chapter.id ? null : chapter.id
                )}
                onOpenSection={(section) => handleOpenSection(section, chapter.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      <Card className="p-6 text-center bg-muted/30">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold mb-2">More Content Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          We're actively building new chapters with engaging content, embedded drills, and visual learning experiences.
        </p>
      </Card>
      
      <Dialog 
        open={selectedSection !== null} 
        onOpenChange={(open) => !open && setSelectedSection(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSection && getLessonTypeIcon(selectedSection.section.lessonType)}
              {selectedSection?.section.name || 'Section Details'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSection && (
            <SectionDetailView
              section={selectedSection.section}
              chapterId={selectedSection.chapterId}
              language={language}
              onClose={() => setSelectedSection(null)}
              onStartConversation={handleStartConversation}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
