import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { forceNewConversation } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { LearningContextFilter } from "@/components/LearningContextFilter";
import { ActflFluencyDial } from "@/components/ActflFluencyDial";
import { useSidebar } from "@/components/ui/sidebar";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import holaholaLogo from "@assets/holaholamainlogoBackgroundRemoved_1765308837223.png";
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  Play,
  ChevronRight,
  ChevronDown,
  Flame,
  GraduationCap,
  Hash,
  Tag,
  ArrowRight,
  Trophy,
  Target,
  Phone,
  Calendar,
  ClipboardList,
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  Globe,
  ListTree,
  PencilLine,
  Languages,
  Brain,
  List,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SyllabusTimeProgress } from "@/components/SyllabusTimeProgress";
import { SyllabusMindMap } from "@/components/SyllabusMindMap";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VocabularyWord, Conversation, CulturalTip, UserLesson, Topic } from "@shared/schema";

type SyllabusViewMode = 'mindmap' | 'linear';

interface UpcomingAssignment {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  classId: string;
  className: string;
  lessonId: string | null;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'overdue';
}

interface SyllabusLesson {
  id: string;
  name: string;
  orderIndex: number;
  lessonType: string;
  status: 'not_started' | 'in_progress' | 'completed';
  estimatedMinutes: number | null;
}

interface SyllabusUnit {
  id: string;
  name: string;
  orderIndex: number;
  lessons: SyllabusLesson[];
}

interface SyllabusOverview {
  classId: string;
  className: string;
  curriculumName: string;
  totalLessons: number;
  completedLessons: number;
  units: SyllabusUnit[];
}

interface ReviewHubData {
  dueFlashcards: VocabularyWord[];
  recentConversations: Array<Conversation & { topics: Array<{ topic: Topic }> }>;
  culturalTips: CulturalTip[];
  activeLessons: UserLesson[];
  recentVocabulary: VocabularyWord[];
  topicsWithContent: Array<Topic & { conversationCount: number; vocabularyCount: number }>;
  nextLesson: {
    classId: string;
    className: string;
    lessonId: string;
    lessonName: string;
    lessonDescription: string | null;
    unitName: string;
    lessonType: string;
  } | null;
  upcomingAssignments: UpcomingAssignment[];
  syllabusOverview: SyllabusOverview | null;
  stats: {
    totalConversations: number;
    totalVocabulary: number;
    dueCount: number;
    streakDays: number;
  };
}

const topicTypeColors = {
  subject: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  grammar: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  function: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const topicTypeIcons = {
  subject: Tag,
  grammar: Hash,
  function: MessageSquare,
};

const lessonTypeConfig = {
  conversation: {
    icon: MessageSquare,
    label: "Conversation",
    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    borderColor: "border-green-200 dark:border-green-800",
  },
  vocabulary: {
    icon: Languages,
    label: "Vocabulary",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  grammar: {
    icon: PencilLine,
    label: "Grammar",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  cultural_exploration: {
    icon: Globe,
    label: "Culture",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
};

function LessonTypeBadge({ lessonType, size = "sm" }: { lessonType: string; size?: "sm" | "xs" }) {
  const config = lessonTypeConfig[lessonType as keyof typeof lessonTypeConfig] || lessonTypeConfig.conversation;
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${config.borderColor} gap-1 ${size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs"}`}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {config.label}
    </Badge>
  );
}

function getLanguageDisplayName(code: string): string {
  const names: Record<string, string> = {
    spanish: "Spanish",
    french: "French",
    german: "German",
    italian: "Italian",
    portuguese: "Portuguese",
    japanese: "Japanese",
    chinese: "Chinese",
    korean: "Korean",
    russian: "Russian",
  };
  return names[code] || code;
}

function LinearSyllabusView({ syllabus }: { syllabus: SyllabusOverview }) {
  return (
    <>
      <div className="md:hidden">
        <div className="flex flex-wrap gap-2 mb-3">
          {syllabus.units.map((unit) => {
            const completedInUnit = unit.lessons.filter(l => l.status === 'completed').length;
            const isComplete = completedInUnit === unit.lessons.length;
            const hasStarted = completedInUnit > 0;
            
            return (
              <Badge 
                key={unit.id}
                className={`text-xs ${
                  isComplete 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : hasStarted 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                      : 'bg-muted text-muted-foreground'
                }`}
                data-testid={`unit-pill-${unit.id}`}
              >
                {isComplete && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {unit.name} ({completedInUnit}/{unit.lessons.length})
              </Badge>
            );
          })}
        </div>
        {(() => {
          const nextLesson = syllabus.units
            .flatMap(u => u.lessons.map(l => ({ ...l, unitName: u.name })))
            .find(l => l.status !== 'completed');
          
          if (!nextLesson) return null;
          
          return (
            <Link href={`/chat?lesson=${nextLesson.id}&class=${syllabus.classId}`}>
              <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">Continue: {nextLesson.name}</p>
                      <LessonTypeBadge lessonType={nextLesson.lessonType} size="xs" />
                    </div>
                    <p className="text-xs text-muted-foreground">{nextLesson.unitName}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          );
        })()}
      </div>
      
      <div className="hidden md:block space-y-2">
        {syllabus.units.map((unit, unitIndex) => {
          const completedInUnit = unit.lessons.filter(l => l.status === 'completed').length;
          const unitProgress = unit.lessons.length > 0 
            ? Math.round((completedInUnit / unit.lessons.length) * 100) 
            : 0;
          const isComplete = unitProgress === 100;
          const hasStarted = completedInUnit > 0;
          
          return (
            <Collapsible key={unit.id} defaultOpen={unitIndex === 0 || (!isComplete && hasStarted)} className="group">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover-elevate" data-testid={`unit-${unit.id}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${isComplete ? 'bg-green-100 dark:bg-green-900' : hasStarted ? 'bg-blue-100 dark:bg-blue-900' : 'bg-muted'}`}>
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <BookOpen className={`h-4 w-4 ${hasStarted ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{unit.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {completedInUnit} of {unit.lessons.length} lessons completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isComplete && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Complete
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-12 pr-3 py-2 space-y-1">
                  {unit.lessons.map((lesson) => {
                    const LessonStatusIcon = lesson.status === 'completed' 
                      ? CheckCircle2 
                      : lesson.status === 'in_progress' 
                        ? Clock 
                        : Circle;
                    const statusColor = lesson.status === 'completed' 
                      ? 'text-green-600 dark:text-green-400' 
                      : lesson.status === 'in_progress' 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-muted-foreground';
                    
                    return (
                      <Link 
                        key={lesson.id} 
                        href={`/chat?lesson=${lesson.id}&class=${syllabus.classId}`}
                      >
                        <div 
                          className="flex items-center gap-3 p-2 rounded hover-elevate cursor-pointer" 
                          data-testid={`lesson-${lesson.id}`}
                        >
                          <LessonStatusIcon className={`h-4 w-4 flex-shrink-0 ${statusColor}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${lesson.status === 'completed' ? 'text-muted-foreground' : ''}`}>
                              {lesson.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <LessonTypeBadge lessonType={lesson.lessonType} size="xs" />
                            {lesson.estimatedMinutes && (
                              <span className="text-xs text-muted-foreground">
                                ~{lesson.estimatedMinutes}m
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </>
  );
}

export default function ReviewHub() {
  const { language, tutorGender } = useLanguage();
  const { learningContext } = useLearningFilter();
  const { setOpen, isMobile, setOpenMobile } = useSidebar();
  
  // Syllabus view preference - Mind Map is the HolaHola default
  const [syllabusView, setSyllabusView] = useState<SyllabusViewMode>(() => {
    const saved = localStorage.getItem('syllabusViewMode');
    return (saved === 'linear' ? 'linear' : 'mindmap') as SyllabusViewMode;
  });
  
  // Persist view preference
  useEffect(() => {
    localStorage.setItem('syllabusViewMode', syllabusView);
  }, [syllabusView]);

  // Close sidebar when arriving at the Review Hub (dashboard)
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  }, []); // Only run on mount

  // Query voice names for the current language (to show tutor name on button)
  const { data: tutorVoices } = useQuery<{ 
    language: string; 
    female: { name: string; voiceId: string; speakingRate: number } | null; 
    male: { name: string; voiceId: string; speakingRate: number } | null 
  }>({
    queryKey: ['/api/tutor-voices', language?.toLowerCase()],
    enabled: !!language,
  });
  
  // Helper to extract just the first name from voice name (e.g., "Daniela - Relaxed Woman" -> "Daniela")
  const getVoiceFirstName = (fullName: string | undefined, fallback: string): string => {
    if (!fullName) return fallback;
    const dashIndex = fullName.indexOf(' - ');
    return dashIndex > 0 ? fullName.substring(0, dashIndex) : fullName;
  };
  
  // Get the current tutor's name based on gender preference
  const currentTutorName = tutorGender === 'male' 
    ? getVoiceFirstName(tutorVoices?.male?.name, "Your Tutor")
    : getVoiceFirstName(tutorVoices?.female?.name, "Your Tutor");

  const { data, isLoading } = useQuery<ReviewHubData>({
    queryKey: ["/api/review-hub", { language, learningContext }],
    queryFn: async () => {
      const params = new URLSearchParams({ language });
      // "all-learning" means everything combined - pass it to backend
      // "all" is legacy value, treat same as "all-learning"
      if (learningContext && learningContext !== "all") {
        params.append("context", learningContext);
      }
      const response = await fetch(`/api/review-hub?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch review data');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const hasDueCards = data?.dueFlashcards && data.dueFlashcards.length > 0;
  const hasRecentConversations = data?.recentConversations && data.recentConversations.length > 0;
  const hasTopics = data?.topicsWithContent && data.topicsWithContent.length > 0;
  const hasNextLesson = data?.nextLesson !== null && data?.nextLesson !== undefined;

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2 md:gap-3">
        <div className="flex items-center gap-1">
          <img src={holaholaLogo} alt="HolaHola" className="h-[7.5rem] w-[7.5rem] -mr-2" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-review-hub-title">
              Language Hub
            </h1>
            <p className="text-sm text-muted-foreground">
              Your personalized {getLanguageDisplayName(language)} learning dashboard
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap -mt-2">
          <LearningContextFilter />
          <Link href="/chat" onClick={() => forceNewConversation()}>
            <Button size="lg" className="gap-2" data-testid="button-call-tutor">
              <Phone className="h-5 w-5" />
              Call {currentTutorName}
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats Row - Horizontal scroll on mobile, grid on desktop */}
      <div className="flex md:grid md:grid-cols-5 gap-3 overflow-x-auto pb-2 md:pb-0 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
        <Card className="p-3 flex-shrink-0 w-[140px] md:w-auto snap-start">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <Flame className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-streak">{data?.stats.streakDays || 0}</p>
              <p className="text-xs text-muted-foreground">Streak</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 flex-shrink-0 w-[140px] md:w-auto snap-start">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-vocab-count">{data?.stats.totalVocabulary || 0}</p>
              <p className="text-xs text-muted-foreground">Words</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 flex-shrink-0 w-[140px] md:w-auto snap-start">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <MessageSquare className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-conv-count">{data?.stats.totalConversations || 0}</p>
              <p className="text-xs text-muted-foreground">Chats</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 flex-shrink-0 w-[140px] md:w-auto snap-start">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Target className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-due-count">{data?.stats.dueCount || 0}</p>
              <p className="text-xs text-muted-foreground">Due</p>
            </div>
          </div>
        </Card>
        {/* ACTFL Fluency - only show when single language selected */}
        {language !== "all" && (
          <div className="flex-shrink-0 w-[140px] md:w-auto snap-start">
            <ActflFluencyDial stat language={language} />
          </div>
        )}
      </div>

      {/* Daily Plan Section */}
      <Card data-testid="section-daily-plan">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Today's Plan
          </CardTitle>
          <CardDescription>Your prioritized learning tasks for today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Due Flashcards */}
          {hasDueCards ? (
            <Link href="/vocabulary">
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover-elevate cursor-pointer" data-testid="link-due-flashcards">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-800">
                    <BookOpen className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div>
                    <p className="font-medium">Review {data.dueFlashcards.length} due flashcards</p>
                    <p className="text-sm text-muted-foreground">Scheduled by spaced repetition - review now for best retention</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-muted">
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-muted-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground">No flashcards due for review</p>
              </div>
            </div>
          )}

          {/* Next Lesson from Syllabus - For enrolled students */}
          {hasNextLesson && data.nextLesson && (
            <Link href={`/chat?lesson=${data.nextLesson.lessonId}&class=${data.nextLesson.classId}`}>
              <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 hover-elevate cursor-pointer" data-testid="link-next-lesson">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-800">
                    <GraduationCap className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">Begin: {data.nextLesson.lessonName}</p>
                      <LessonTypeBadge lessonType={data.nextLesson.lessonType} size="xs" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {data.nextLesson.className} - {data.nextLesson.unitName}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <Play className="h-5 w-5" />
                </Button>
              </div>
            </Link>
          )}

          {/* Due/Upcoming Assignments - For enrolled students */}
          {data?.upcomingAssignments && data.upcomingAssignments.length > 0 && (() => {
            const urgentAssignment = data.upcomingAssignments[0];
            const isOverdue = urgentAssignment.status === 'overdue';
            const dueDate = urgentAssignment.dueDate ? new Date(urgentAssignment.dueDate) : null;
            const daysUntilDue = dueDate 
              ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) 
              : null;
            const isDueSoon = daysUntilDue !== null && daysUntilDue <= 2 && daysUntilDue >= 0;
            
            const bgColor = isOverdue 
              ? "bg-red-50 dark:bg-red-900/20" 
              : isDueSoon 
                ? "bg-orange-50 dark:bg-orange-900/20" 
                : "bg-cyan-50 dark:bg-cyan-900/20";
            const iconBgColor = isOverdue
              ? "bg-red-100 dark:bg-red-800"
              : isDueSoon
                ? "bg-orange-100 dark:bg-orange-800"
                : "bg-cyan-100 dark:bg-cyan-800";
            const iconColor = isOverdue
              ? "text-red-700 dark:text-red-300"
              : isDueSoon
                ? "text-orange-700 dark:text-orange-300"
                : "text-cyan-700 dark:text-cyan-300";
            
            return (
              <Link href={`/student/assignments?assignment=${urgentAssignment.id}`}>
                <div className={`flex items-center justify-between p-3 rounded-lg ${bgColor} hover-elevate cursor-pointer`} data-testid="link-due-assignment">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${iconBgColor}`}>
                      {isOverdue ? (
                        <AlertCircle className={`h-5 w-5 ${iconColor}`} />
                      ) : (
                        <ClipboardList className={`h-5 w-5 ${iconColor}`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {isOverdue ? "Overdue: " : isDueSoon ? "Due soon: " : "Assignment: "}
                        {urgentAssignment.title}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs">Overdue</Badge>
                        )}
                        {isDueSoon && !isOverdue && (
                          <Badge variant="secondary" className="text-xs bg-orange-200 dark:bg-orange-800">
                            {daysUntilDue === 0 ? "Due today" : `${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`}
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {urgentAssignment.className}
                        {dueDate && !isOverdue && !isDueSoon && ` • Due ${dueDate.toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </Link>
            );
          })()}

          {/* Recent Vocabulary - Only show if there are new words NOT already in due cards */}
          {data?.recentVocabulary && data.recentVocabulary.length > 0 && (
            <Link href="/vocabulary">
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover-elevate cursor-pointer" data-testid="link-recent-vocab">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-800">
                    <Sparkles className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="font-medium">Reinforce {data.recentVocabulary.length} new words</p>
                    <p className="text-sm text-muted-foreground">
                      Recently learned: {data.recentVocabulary.slice(0, 3).map(w => w.word).join(", ")}
                      {data.recentVocabulary.length > 3 && "..."}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </Link>
          )}

          {/* Continue Conversation - Show topic context */}
          {hasRecentConversations && (() => {
            const conv = data.recentConversations[0];
            const topicNames = (conv.topics ?? []).map(t => t.topic?.name).filter(Boolean).slice(0, 2);
            const hasTopicContext = topicNames.length > 0;
            const title = conv.title || (hasTopicContext ? `About ${topicNames.join(" & ")}` : null);
            
            return (
              <Link href={`/chat?resume=${conv.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 hover-elevate cursor-pointer" data-testid="link-continue-conversation">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-800">
                      <MessageSquare className="h-5 w-5 text-green-700 dark:text-green-300" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {title ? `Continue: ${title}` : "Continue recent conversation"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {hasTopicContext 
                          ? `Keep practicing ${topicNames.join(", ")}`
                          : "Pick up where you left off"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Play className="h-5 w-5" />
                  </Button>
                </div>
              </Link>
            );
          })()}

          {/* Call Tutor */}
          <Link href="/chat">
            <div className="flex items-center justify-between p-3 rounded-lg border border-dashed hover-elevate cursor-pointer" data-testid="link-call-tutor">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Call {currentTutorName}</p>
                  <p className="text-sm text-muted-foreground">Start a new conversation</p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Learning Journey - Mind Map or Linear View for all learners */}
      {(() => {
        const isClassContext = learningContext && !learningContext.includes('self-directed') && learningContext !== 'all';
        const isSelfDirected = !learningContext || learningContext === "self-directed";
        const syllabus = data?.syllabusOverview;
        
        // Don't show if language is "all" 
        if (!language || language === 'all') return null;
        
        const progressPercent = syllabus && syllabus.totalLessons > 0 
          ? Math.round((syllabus.completedLessons / syllabus.totalLessons) * 100) 
          : 0;

        return (
          <Card data-testid="section-learning-journey">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-5 w-5 text-primary" />
                    {isClassContext ? 'Course Overview' : 'Learning Journey'}
                  </CardTitle>
                  <CardDescription>
                    {isClassContext && syllabus ? syllabus.curriculumName : 'Your personalized path through the language'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {isClassContext && syllabus && (
                    <div className="text-right hidden md:block">
                      <p className="text-xl font-bold text-primary">{progressPercent}%</p>
                      <p className="text-xs text-muted-foreground">
                        {syllabus.completedLessons}/{syllabus.totalLessons} lessons
                      </p>
                    </div>
                  )}
                  <ToggleGroup 
                    type="single" 
                    value={syllabusView} 
                    onValueChange={(v) => v && setSyllabusView(v as SyllabusViewMode)} 
                    size="sm"
                    data-testid="toggle-syllabus-view"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem value="mindmap" data-testid="toggle-mindmap">
                          <Brain className="h-4 w-4" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>Mind Map View</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem value="linear" data-testid="toggle-linear">
                          <List className="h-4 w-4" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>Linear View</TooltipContent>
                    </Tooltip>
                  </ToggleGroup>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {syllabusView === 'mindmap' ? (
                <SyllabusMindMap 
                  language={language} 
                  classId={isClassContext && syllabus ? syllabus.classId : undefined}
                  mode={isSelfDirected ? 'emergent' : 'roadmap'}
                />
              ) : (
                // Linear view - show self-directed lessons or class syllabus
                <div className="space-y-2">
                  {isSelfDirected ? (
                    // Self-directed: Show personal lessons or empty state
                    <>
                      {(data?.activeLessons?.length ?? 0) > 0 && data?.activeLessons ? (
                        data.activeLessons.slice(0, 5).map((lesson) => (
                          <Link key={lesson.id} href={`/lessons?expand=${lesson.id}`}>
                            <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`card-lesson-${lesson.id}`}>
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-800">
                                  <BookOpen className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                                </div>
                                <div>
                                  <p className="font-medium">{lesson.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {getLanguageDisplayName(lesson.language)}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">No lessons yet</p>
                          <p className="text-sm">Start a conversation to discover topics</p>
                        </div>
                      )}
                    </>
                  ) : syllabus ? (
                    // Class context: Show syllabus units and lessons
                    <LinearSyllabusView syllabus={syllabus} />
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Syllabus Time Progress - Shows expected vs actual time per unit */}
      {(() => {
        const isClassContext = learningContext && !learningContext.includes('self-directed') && learningContext !== 'all';
        const syllabus = data?.syllabusOverview;
        
        if (!isClassContext || !syllabus) return null;
        
        return (
          <SyllabusTimeProgress 
            classId={syllabus.classId} 
            compact={false}
          />
        );
      })()}

      {/* Topic Deep Dives with Culture Insight */}
      {(hasTopics || (data?.culturalTips?.length ?? 0) > 0) && (
        <Card data-testid="section-topic-deep-dives">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Hash className="h-5 w-5 text-primary" />
              Explore & Learn
            </CardTitle>
            <CardDescription>Deep dive into topics, grammar, and cultural insights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Featured Cultural Tip */}
            {data?.culturalTips && data.culturalTips.length > 0 && (() => {
              const tip = data.culturalTips[0];
              return (
                <Link href="/cultural-tips">
                  <div 
                    className="p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 hover-elevate cursor-pointer"
                    data-testid="card-cultural-tip"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-800 flex-shrink-0">
                        <Globe className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">Cultural Insight</p>
                          <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">
                            {getLanguageDisplayName(tip.language)}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
                          {tip.title}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {tip.content}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              );
            })()}

            {/* Topic Grid */}
            {hasTopics && data && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.topicsWithContent.slice(0, 6).map((topic) => {
                    const TopicIcon = topicTypeIcons[topic.topicType as keyof typeof topicTypeIcons] || Tag;
                    return (
                      <Link key={topic.id} href={`/history?topic=${topic.id}`}>
                        <Card className="p-3 hover-elevate cursor-pointer" data-testid={`card-topic-${topic.id}`}>
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${topicTypeColors[topic.topicType as keyof typeof topicTypeColors]}`}>
                              <TopicIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{topic.name}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {topic.conversationCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  {topic.vocabularyCount}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className="capitalize text-xs">
                              {topic.topicType}
                            </Badge>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
                {data.topicsWithContent.length > 6 && (
                  <div className="text-center">
                    <Link href="/history">
                      <Button variant="ghost" size="sm" className="gap-1">
                        View all topics
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State for New Users */}
      {!hasDueCards && !hasRecentConversations && !hasTopics && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="max-w-md mx-auto">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                <Phone className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Start Your Learning Journey</h2>
              <p className="text-muted-foreground mb-6">
                Call {currentTutorName} to start building your personalized learning dashboard.
              </p>
              <Link href="/chat">
                <Button size="lg" className="gap-2">
                  <Phone className="h-5 w-5" />
                  Call {currentTutorName}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
