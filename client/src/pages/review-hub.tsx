import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { forceNewConversation } from "@/lib/queryClient";
import { useUser } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { LearningContextFilter } from "@/components/LearningContextFilter";
import { ActflFluencyDial } from "@/components/ActflFluencyDial";
import { useSidebar } from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
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
  History,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SyllabusTimeProgress } from "@/components/SyllabusTimeProgress";
import { SyllabusMindMap } from "@/components/SyllabusMindMap";
import { DanielaLearningInsights } from "@/components/DanielaLearningInsights";
import { getTutorName } from "@/lib/tutor-avatars";
import { TutorShowcase, type TutorSelection } from "@/components/TutorShowcase";

import { InteractiveTextbookCard } from "@/components/InteractiveTextbookCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VocabularyWord, Conversation, CulturalTip, UserLesson, Topic } from "@shared/schema";
import { Mic } from "lucide-react";

// Types for drill recommendations
interface DrillRecommendation {
  phoneme: string;
  language: string;
  priorityScore: number;
  reason: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  crossStudentCommonality?: number;
  isProactive?: boolean;
}

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
  description: string | null;
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
  drill: {
    icon: Target,
    label: "Practice",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    borderColor: "border-orange-200 dark:border-orange-800",
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

// Template-based lesson name prefix configuration
// Matches prefixes like "New Words:", "Let's Chat:", "Practice Time:", etc.
const templatePrefixConfig: Record<string, { label: string; color: string; borderColor: string; icon: typeof Languages }> = {
  "New Words": {
    label: "New Words",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: Languages,
  },
  "Let's Chat": {
    label: "Let's Chat",
    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    borderColor: "border-green-200 dark:border-green-800",
    icon: MessageSquare,
  },
  "Grammar Spotlight": {
    label: "Grammar",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    borderColor: "border-purple-200 dark:border-purple-800",
    icon: PencilLine,
  },
  "Culture Corner": {
    label: "Culture",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: Globe,
  },
  "Practice Time": {
    label: "Practice",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    borderColor: "border-orange-200 dark:border-orange-800",
    icon: Target,
  },
};

// Helper to parse lesson name and extract template prefix
function parseTemplatePrefix(lessonName: string): { prefix: string | null; content: string } {
  for (const prefix of Object.keys(templatePrefixConfig)) {
    if (lessonName.startsWith(`${prefix}:`)) {
      return { 
        prefix, 
        content: lessonName.slice(prefix.length + 1).trim() 
      };
    }
  }
  return { prefix: null, content: lessonName };
}

// Template prefix badge component
function TemplatePrefixBadge({ prefix, size = "xs" }: { prefix: string; size?: "sm" | "xs" }) {
  const config = templatePrefixConfig[prefix];
  if (!config) return null;
  
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
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  
  const toggleLesson = (lessonId: string) => {
    setExpandedLessonId(prev => prev === lessonId ? null : lessonId);
  };
  
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
          
          // Parse template prefix from lesson name
          const { prefix, content } = parseTemplatePrefix(nextLesson.name);
          
          return (
            <Link href={`/chat?lesson=${nextLesson.id}&class=${syllabus.classId}`}>
              <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">Continue: {content}</p>
                      {prefix ? (
                        <TemplatePrefixBadge prefix={prefix} size="xs" />
                      ) : (
                        <LessonTypeBadge lessonType={nextLesson.lessonType} size="xs" />
                      )}
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
                <div className="pl-12 pr-3 py-2 space-y-2">
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
                    
                    // Parse template prefix from lesson name
                    const { prefix, content } = parseTemplatePrefix(lesson.name);
                    const isExpanded = expandedLessonId === lesson.id;
                    
                    return (
                      <div key={lesson.id} className="rounded border overflow-hidden">
                        <button 
                          type="button"
                          onClick={() => toggleLesson(lesson.id)}
                          className="flex items-center gap-3 p-2 w-full hover-elevate cursor-pointer text-left" 
                          data-testid={`lesson-${lesson.id}`}
                        >
                          <LessonStatusIcon className={`h-4 w-4 flex-shrink-0 ${statusColor}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${lesson.status === 'completed' ? 'text-muted-foreground' : ''}`}>
                              {content}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {prefix ? (
                              <TemplatePrefixBadge prefix={prefix} size="xs" />
                            ) : (
                              <LessonTypeBadge lessonType={lesson.lessonType} size="xs" />
                            )}
                            {lesson.estimatedMinutes && (
                              <span className="text-xs text-muted-foreground">
                                ~{lesson.estimatedMinutes}m
                              </span>
                            )}
                            <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="pl-9 pr-2 py-2 space-y-2 bg-muted/30 border-t">
                            {lesson.description && (
                              <p className="text-sm text-muted-foreground">
                                {lesson.description}
                              </p>
                            )}
                            <Link href={`/chat?lesson=${lesson.id}&class=${syllabus.classId}`}>
                              <Button size="sm" className="gap-1" data-testid={`start-lesson-${lesson.id}`}>
                                <Play className="h-3 w-3" />
                                {lesson.status === 'completed' ? 'Review Lesson' : lesson.status === 'in_progress' ? 'Continue' : 'Start Lesson'}
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
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
  const { user } = useUser();
  const { language, tutorGender, setLanguage, setTutorGender } = useLanguage();
  const { learningContext } = useLearningFilter();
  const { setOpen, isMobile, setOpenMobile } = useSidebar();
  const [, setLocation] = useLocation();
  
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

  // Query tutor voices from database (Voice Lab is source of truth)
  const { data: tutorVoices } = useQuery<{ 
    language: string; 
    female: { name: string; voiceId: string; speakingRate: number } | null; 
    male: { name: string; voiceId: string; speakingRate: number } | null 
  }>({
    queryKey: ['/api/tutor-voices', language?.toLowerCase()],
    enabled: !!language && language !== 'all',
  });
  
  // Get tutor name from database, fallback to directory
  const currentTutorName = tutorGender === 'male' 
    ? (tutorVoices?.male?.name || getTutorName(language, tutorGender))
    : (tutorVoices?.female?.name || getTutorName(language, tutorGender));

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

  // Query drill recommendations
  const { data: drillRecommendations } = useQuery<DrillRecommendation[]>({
    queryKey: ["/api/pronunciation-drills/recommendations", language],
    queryFn: async () => {
      if (language === 'all') return [];
      const response = await fetch(`/api/pronunciation-drills/recommendations?language=${language}&limit=3`, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: language !== 'all',
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
      <div className="flex flex-col gap-3">
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
      </div>

      {/* Tutor Showcase - Click the tutor to start a conversation */}
      <TutorShowcase 
        onTutorSelect={(selection) => {
          if (selection) {
            // Update language context to reflect selected tutor
            setLanguage(selection.language);
            setTutorGender(selection.gender);
            // Also update localStorage immediately for tutorGender
            localStorage.setItem('tutorGender', selection.gender);
            // Navigate to chat with selected tutor using SPA navigation
            forceNewConversation();
            setLocation("/chat");
          }
        }}
        selectedLanguage={language}
        selectedGender={tutorGender}
        filterSlot={<LearningContextFilter />}
        className="py-2"
      />

      {/* Interactive Textbook */}
      <InteractiveTextbookCard className="mt-2" />

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

        </CardContent>
      </Card>

      {/* Learning Journey - Mind Map or Linear View for all learners */}
      {(() => {
        // Check if we're viewing a specific class (not self-directed, all-learning, or special modes)
        const specialModes = ['self-directed', 'all', 'all-learning', 'founder-mode', 'honesty-mode'];
        const isClassContext = learningContext && !specialModes.includes(learningContext);
        const isSelfDirected = !learningContext || learningContext === "self-directed";
        const syllabus = data?.syllabusOverview;
        
        // Don't show if language is "all" 
        if (!language || language === 'all') return null;
        
        const progressPercent = syllabus && syllabus.totalLessons > 0 
          ? Math.round((syllabus.completedLessons / syllabus.totalLessons) * 100) 
          : 0;

        return (
          <Card data-testid="section-learning-journey" className="overflow-visible">
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
            <CardContent className="overflow-visible">
              {syllabusView === 'mindmap' ? (
                <SyllabusMindMap 
                  language={language} 
                  classId={isClassContext && syllabus ? syllabus.classId : undefined}
                  syllabusOverview={isClassContext && syllabus ? syllabus : undefined}
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

      {/* Daniela's Learning Insights - Only show standalone card in linear view (mindmap has it built-in) */}
      {syllabusView !== 'mindmap' && (
        <DanielaLearningInsights language={language} userId={user?.id} />
      )}

      {/* Recommended Pronunciation Drills */}
      {drillRecommendations && drillRecommendations.length > 0 && (
        <Card data-testid="section-recommended-drills">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mic className="h-5 w-5 text-primary" />
              Recommended for You
            </CardTitle>
            <CardDescription>Personalized pronunciation practice based on your learning patterns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {drillRecommendations.map((rec, index) => (
              <Link key={`${rec.phoneme}-${index}`} href={`/pronunciation?phoneme=${rec.phoneme}&language=${rec.language}`}>
                <div 
                  className="flex items-center justify-between p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 hover-elevate cursor-pointer"
                  data-testid={`link-drill-${rec.phoneme}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-violet-100 dark:bg-violet-800">
                      <Mic className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium capitalize">Practice: "{rec.phoneme}" sound</p>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            rec.difficulty === 'advanced' 
                              ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300' 
                              : rec.difficulty === 'intermediate'
                                ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                                : 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                          }`}
                        >
                          {rec.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rec.reason} • ~{rec.estimatedMinutes} min
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </Link>
            ))}
            <div className="flex gap-2 mt-2">
              <Link href="/pronunciation" className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-view-all-drills">
                  View All Pronunciation Drills
                </Button>
              </Link>
              <Link href="/session-replay">
                <Button variant="ghost" size="icon" data-testid="button-session-replay">
                  <History className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}


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
