import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { LearningContextFilter } from "@/components/LearningContextFilter";
import { ActflFluencyDial } from "@/components/ActflFluencyDial";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  Play,
  ChevronRight,
  Flame,
  Globe,
  GraduationCap,
  Lightbulb,
  Clock,
  Hash,
  Tag,
  ArrowRight,
  Calendar,
  Trophy,
  Target,
  Mic,
  Award,
} from "lucide-react";
import type { VocabularyWord, Conversation, CulturalTip, UserLesson, Topic } from "@shared/schema";

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
  } | null;
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

export default function ReviewHub() {
  const { language } = useLanguage();
  const { learningContext } = useLearningFilter();

  const { data, isLoading } = useQuery<ReviewHubData>({
    queryKey: ["/api/review-hub", { language, learningContext }],
    queryFn: async () => {
      const params = new URLSearchParams({ language });
      if (learningContext !== "all") {
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
  const hasCulturalTips = data?.culturalTips && data.culturalTips.length > 0;
  const hasTopics = data?.topicsWithContent && data.topicsWithContent.length > 0;
  const hasLessons = data?.activeLessons && data.activeLessons.length > 0;
  const hasNextLesson = data?.nextLesson !== null && data?.nextLesson !== undefined;

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-review-hub-title">
              <GraduationCap className="h-7 w-7 text-primary" />
              Review Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Your personalized {getLanguageDisplayName(language)} learning dashboard
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <LearningContextFilter />
            <Link href="/chat">
              <Button size="lg" className="gap-2" data-testid="button-start-practice">
                <Mic className="h-5 w-5" />
                Start Practice
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Flame className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-streak">{data?.stats.streakDays || 0}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <BookOpen className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-vocab-count">{data?.stats.totalVocabulary || 0}</p>
                <p className="text-xs text-muted-foreground">Words Learned</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <MessageSquare className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-conv-count">{data?.stats.totalConversations || 0}</p>
                <p className="text-xs text-muted-foreground">Conversations</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-due-count">{data?.stats.dueCount || 0}</p>
                <p className="text-xs text-muted-foreground">Cards Due</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ACTFL Fluency Gauge - compact version below stats */}
        <ActflFluencyDial compact language={language} />
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
                    <p className="font-medium">Begin: {data.nextLesson.lessonName}</p>
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

          {/* Start New Practice */}
          <Link href="/chat">
            <div className="flex items-center justify-between p-3 rounded-lg border border-dashed hover-elevate cursor-pointer" data-testid="link-new-practice">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Start new conversation</p>
                  <p className="text-sm text-muted-foreground">Practice with your AI tutor</p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Topic Deep Dives */}
      {hasTopics && (
        <Card data-testid="section-topic-deep-dives">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Hash className="h-5 w-5 text-primary" />
              Topic Deep Dives
            </CardTitle>
            <CardDescription>Review content by topic - grammar, subjects, and language functions</CardDescription>
          </CardHeader>
          <CardContent>
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
              <div className="mt-3 text-center">
                <Link href="/history">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View all topics
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cultural Corner */}
      {hasCulturalTips && (
        <Card data-testid="section-cultural-corner">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              Cultural Corner
            </CardTitle>
            <CardDescription>Understanding culture is key to fluency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.culturalTips.map((tip, index) => (
                <div 
                  key={tip.id} 
                  className={`p-4 rounded-lg ${index === 0 ? 'bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20' : 'bg-muted/50'}`}
                  data-testid={`card-cultural-tip-${tip.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Lightbulb className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold">{tip.title}</h4>
                        <Badge variant="secondary" className="text-xs">{tip.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{tip.content}</p>
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {tip.context}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lesson Journeys */}
      {hasLessons && (
        <Card data-testid="section-lesson-journeys">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Lesson Journeys
                </CardTitle>
                <CardDescription>Your learning bundles and weekly reviews</CardDescription>
              </div>
              <Link href="/lessons">
                <Button variant="outline" size="sm" className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.activeLessons.slice(0, 3).map((lesson) => (
                <Link key={lesson.id} href={`/lessons`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer" data-testid={`card-lesson-${lesson.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{lesson.title}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{lesson.conversationCount || 0} chats</span>
                          <span>{lesson.vocabularyCount || 0} words</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {lesson.lessonType === 'weekly_auto' ? 'Weekly' : lesson.lessonType || 'Custom'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State for New Users */}
      {!hasDueCards && !hasRecentConversations && !hasTopics && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="max-w-md mx-auto">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                <Mic className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Start Your Learning Journey</h2>
              <p className="text-muted-foreground mb-6">
                Have your first conversation with your AI tutor to start building your personalized learning dashboard.
              </p>
              <Link href="/chat">
                <Button size="lg" className="gap-2">
                  <Play className="h-5 w-5" />
                  Start First Conversation
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add bottom padding for mobile floating button */}
      <div className="h-20 md:hidden" />

      {/* Mobile Floating "Next Up" CTA */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden z-50" data-testid="mobile-next-up-cta">
        <Link href={hasDueCards ? "/vocabulary" : "/chat"}>
          <Button 
            size="lg" 
            className="w-full gap-2 shadow-lg"
            data-testid="button-mobile-next-up"
          >
            {hasDueCards ? (
              <>
                <BookOpen className="h-5 w-5" />
                Review {data?.dueFlashcards.length} Cards
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Start Practice
              </>
            )}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
