import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, 
  ChevronRight, 
  ChevronLeft,
  Play,
  CheckCircle2,
  Lock,
  Sparkles,
  GraduationCap
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation } from "wouter";
import { TextbookChapterView } from "@/components/TextbookChapterView";
import { apiRequest } from "@/lib/queryClient";

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
  chapterType?: string | null;
}

interface Recommendation {
  chapterId: string;
  chapterTitle: string;
  chapterType: string | null;
  reason: string;
  lessonsCompleted: number;
  lessonsTotal: number;
}

interface CurriculumPathInfo {
  id: string;
  name: string;
  description?: string;
  startLevel: string;
  endLevel: string;
}

interface TextbookData {
  language: string;
  curriculumPath?: CurriculumPathInfo;
  allPaths?: CurriculumPathInfo[];
  studentActflLevel?: string;
  chapters: Chapter[];
  totalChapters: number;
  completedChapters: number;
  message?: string;
}

function ChapterListCard({ 
  chapter, 
  onOpen,
  isRecommended,
}: { 
  chapter: Chapter; 
  onOpen: () => void;
  isRecommended?: boolean;
}) {
  const progressColor = chapter.progress >= 75 
    ? "text-green-500" 
    : chapter.progress >= 25 
      ? "text-amber-500" 
      : "text-muted-foreground";

  return (
    <Card 
      className={`transition-all ${chapter.isLocked ? 'opacity-60' : 'hover-elevate cursor-pointer'}`}
      data-testid={`card-chapter-${chapter.number}`}
      onClick={() => !chapter.isLocked && onOpen()}
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
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-base md:text-lg truncate">
                {chapter.title}
              </h3>
              {chapter.progress === 100 && (
                <Badge variant="secondary" className="shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
              {isRecommended && chapter.progress < 100 && (
                <Badge variant="outline" className="shrink-0 border-primary/30 text-primary" data-testid={`badge-recommended-${chapter.number}`}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Daniela suggests
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
            
            <div className="flex items-center justify-between gap-2 mt-2">
              <p className="text-xs text-muted-foreground">
                {chapter.sectionsCount} lessons
              </p>
              {!chapter.isLocked && (
                <span className="text-xs text-primary flex items-center gap-1">
                  View chapter <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        </div>
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

type ChapterFilter = 'all' | 'in-progress' | 'completed' | 'not-started';

function formatActflLevel(level: string): string {
  return level
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function ChapterListView({
  chapters,
  textbookData,
  languageDisplayName,
  totalProgress,
  isLoading,
  error,
  onOpenChapter,
  onPathChange,
  savedPositionChapterId,
  recommendation,
}: {
  chapters: Chapter[];
  textbookData?: TextbookData;
  languageDisplayName: string;
  totalProgress: number;
  isLoading: boolean;
  error: Error | null;
  onOpenChapter: (chapter: Chapter) => void;
  onPathChange?: (pathId: string) => void;
  savedPositionChapterId?: string | null;
  recommendation?: Recommendation | null;
}) {
  const [filter, setFilter] = useState<ChapterFilter>('all');
  const savedChapter = savedPositionChapterId
    ? chapters.find(ch => ch.id === savedPositionChapterId)
    : null;

  const recommendedChapter = recommendation
    ? chapters.find(ch => ch.id === recommendation.chapterId && !ch.isLocked)
    : null;

  const continueChapter = savedChapter
    || recommendedChapter
    || chapters.find(ch => !ch.isLocked && ch.progress < 100 && ch.progress > 0)
    || chapters.find(ch => !ch.isLocked && ch.progress === 0);

  const continueLabel = savedChapter
    ? "Continue Where You Left Off"
    : recommendation
      ? "Daniela Suggests"
      : "Continue Learning";

  const continueSubtext = savedChapter && continueChapter
    ? `Chapter ${continueChapter.number}: ${continueChapter.title}`
    : recommendation
      ? recommendation.reason
      : continueChapter
        ? `Chapter ${continueChapter.number}: ${continueChapter.title}`
        : '';

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
            Your {languageDisplayName} visual learning guide
          </p>
          {textbookData?.curriculumPath && textbookData.allPaths && textbookData.allPaths.length > 1 ? (
            <div className="flex items-center gap-2 mt-1">
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={textbookData.curriculumPath.id}
                onValueChange={(pathId) => {
                  if (onPathChange) onPathChange(pathId);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-auto min-w-[160px]" data-testid="select-curriculum-path">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {textbookData.allPaths.map(p => (
                    <SelectItem key={p.id} value={p.id} data-testid={`option-path-${p.id}`}>
                      {p.name.replace(/ - High School| - Advanced/g, '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {textbookData.studentActflLevel && (
                <Badge variant="outline" className="text-xs" data-testid="badge-actfl-level">
                  {formatActflLevel(textbookData.studentActflLevel)}
                </Badge>
              )}
            </div>
          ) : textbookData?.curriculumPath ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {textbookData.curriculumPath.name}
            </p>
          ) : null}
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
        <Card className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20" data-testid="card-continue-learning">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/20">
              {recommendation && !savedChapter ? (
                <Sparkles className="h-5 w-5 text-primary" />
              ) : (
                <Play className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold" data-testid="text-continue-label">{continueLabel}</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-continue-subtext">
                {continueSubtext}
              </p>
              {recommendation && !savedChapter && recommendedChapter && (
                <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-recommended-chapter">
                  Chapter {recommendedChapter.number}: {recommendedChapter.title}
                </p>
              )}
            </div>
            <Button 
              data-testid="button-continue-learning"
              onClick={() => onOpenChapter(continueChapter)}
            >
              {savedChapter ? 'Resume' : recommendation && !savedChapter ? 'Open' : 'Continue'}
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Chapters</h2>
            <div className="flex items-center gap-1">
              {([
                { key: 'all', label: 'All' },
                { key: 'in-progress', label: 'In Progress' },
                { key: 'completed', label: 'Completed' },
                { key: 'not-started', label: 'Not Started' },
              ] as { key: ChapterFilter; label: string }[]).map(f => (
                <Button
                  key={f.key}
                  variant={filter === f.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(f.key)}
                  data-testid={`button-filter-${f.key}`}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
          {(() => {
            const filtered = chapters.filter(ch => {
              if (filter === 'completed') return ch.progress === 100;
              if (filter === 'in-progress') return ch.progress > 0 && ch.progress < 100;
              if (filter === 'not-started') return ch.progress === 0 && !ch.isLocked;
              return true;
            });
            return (
              <div className="space-y-3">
                {filtered.map((chapter) => (
                  <ChapterListCard 
                    key={chapter.id} 
                    chapter={chapter}
                    onOpen={() => onOpenChapter(chapter)}
                    isRecommended={recommendation?.chapterId === chapter.id}
                  />
                ))}
                {filter !== 'all' && filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-filter-empty">
                    No chapters match this filter.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}
      
      <Card className="p-6 text-center bg-muted/30">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold mb-2">Visual Learning Experience</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Each chapter opens as a visual quick-reference guide with infographics, at-a-glance content, and practice prompts for Daniela.
        </p>
      </Card>
    </div>
  );
}

export default function InteractiveTextbook() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pathId');
  });
  
  const languageDisplayName = language.charAt(0).toUpperCase() + language.slice(1);
  
  const pathQuery = selectedPathId ? `?pathId=${selectedPathId}` : '';
  const { data: textbookData, isLoading, error } = useQuery<TextbookData>({
    queryKey: ['/api/textbook', language, selectedPathId || 'auto'],
    queryFn: async () => {
      const res = await fetch(`/api/textbook/${language}${pathQuery}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load textbook');
      return res.json();
    },
  });
  
  const { data: positionData } = useQuery<{ position: { lastChapterId?: string } | null }>({
    queryKey: ['/api/textbook', language, 'position'],
    enabled: !!language,
  });

  const { data: recommendationData } = useQuery<{ recommendation: Recommendation | null }>({
    queryKey: ['/api/textbook', language, 'recommendation'],
    enabled: !!language,
  });
  
  const savePositionMutation = useMutation({
    mutationFn: async (data: { chapterId: string; lessonId?: string }) => {
      return apiRequest('POST', `/api/textbook/${language}/position`, data);
    },
  });
  
  const chapters = textbookData?.chapters || [];
  
  const totalProgress = chapters.length > 0
    ? Math.round(chapters.reduce((acc, ch) => acc + ch.progress, 0) / chapters.length)
    : 0;

  const handleOpenChapter = useCallback((chapter: Chapter) => {
    setSelectedChapter(chapter);
    savePositionMutation.mutate({ chapterId: chapter.id });
  }, [savePositionMutation]);

  const handleStartConversation = useCallback(() => {
    const lessonContext = selectedChapter ? `textbook_chapter=${encodeURIComponent(selectedChapter.title)}` : '';
    setLocation(lessonContext ? `/chat?${lessonContext}` : '/chat');
  }, [setLocation, selectedChapter]);

  const handleStartDrill = useCallback((sectionId: string) => {
    if (selectedChapter) {
      savePositionMutation.mutate({ chapterId: selectedChapter.id, lessonId: sectionId });
    }
    setLocation(`/practice?lessonId=${encodeURIComponent(sectionId)}`);
  }, [selectedChapter, savePositionMutation, setLocation]);

  const handleReviewFlashcards = useCallback(() => {
    setLocation('/review');
  }, [setLocation]);

  const handlePathChange = useCallback((pathId: string) => {
    setSelectedPathId(pathId);
    setSelectedChapter(null);
  }, []);

  if (selectedChapter) {
    return (
      <TextbookChapterView
        chapter={selectedChapter}
        language={language}
        onBack={() => setSelectedChapter(null)}
        onStartConversation={handleStartConversation}
        onStartDrill={handleStartDrill}
        onReviewFlashcards={handleReviewFlashcards}
      />
    );
  }

  return (
    <ChapterListView
      chapters={chapters}
      textbookData={textbookData}
      languageDisplayName={languageDisplayName}
      totalProgress={totalProgress}
      isLoading={isLoading}
      error={error as Error | null}
      onOpenChapter={handleOpenChapter}
      onPathChange={handlePathChange}
      savedPositionChapterId={positionData?.position?.lastChapterId}
      recommendation={recommendationData?.recommendation}
    />
  );
}
