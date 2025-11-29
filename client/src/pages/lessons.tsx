import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSearch } from "wouter";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  MessageSquare, 
  BookOpen, 
  Clock, 
  Calendar,
  Sparkles,
  FolderOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { UserLesson, Conversation, VocabularyWord } from "@shared/schema";

type LessonItem = {
  id: string;
  lessonId: string;
  itemType: 'conversation' | 'vocabulary' | 'grammar';
  conversationId: string | null;
  vocabularyWordId: string | null;
  grammarExerciseId: string | null;
  displayOrder: number;
  conversation?: Conversation;
  vocabularyWord?: VocabularyWord;
};

export default function Lessons() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const searchString = useSearch();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  // Auto-expand lesson from URL query param
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const expandId = params.get('expand');
    if (expandId) {
      setExpandedLessons(prev => {
        const newSet = new Set(prev);
        newSet.add(expandId);
        return newSet;
      });
    }
  }, [searchString]);

  const { data: lessons = [], isLoading } = useQuery<UserLesson[]>({
    queryKey: ["/api/lessons", { language }],
    queryFn: async () => {
      const response = await fetch(`/api/lessons?language=${language}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch lessons');
      return response.json();
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; language: string }) => {
      return apiRequest("POST", "/api/lessons", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      setCreateDialogOpen(false);
      setNewLessonTitle("");
      setNewLessonDescription("");
      toast({ title: "Lesson created", description: "Your new lesson has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create lesson.", variant: "destructive" });
    },
  });

  const generateWeeklyLessonMutation = useMutation({
    mutationFn: async () => {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return apiRequest("POST", "/api/lessons/generate-weekly", { language, weekStart: weekStart.toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({ title: "Lesson generated", description: "Your weekly lesson has been generated from this week's activity." });
    },
    onError: (error: any) => {
      const message = error?.message?.includes("No content") 
        ? "No conversations or vocabulary found for this week."
        : "Failed to generate weekly lesson.";
      toast({ title: "No content found", description: message, variant: "destructive" });
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/lessons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({ title: "Lesson deleted", description: "The lesson has been archived." });
    },
  });

  const toggleLesson = (id: string) => {
    setExpandedLessons(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateLesson = () => {
    if (!newLessonTitle.trim()) {
      toast({ title: "Error", description: "Please enter a lesson title.", variant: "destructive" });
      return;
    }
    createLessonMutation.mutate({ title: newLessonTitle, description: newLessonDescription, language });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold mb-2">My Lessons</h1>
            <p className="text-muted-foreground">Organize and review your learning content</p>
          </div>
          <LanguageSelector compact />
        </div>
        <div className="flex justify-center items-center min-h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">My Lessons</h1>
          <p className="text-muted-foreground">Organize and review your learning content</p>
        </div>
        <LanguageSelector compact />
      </div>

      <div className="flex flex-wrap gap-2">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-create-lesson">
              <Plus className="h-4 w-4 mr-2" />
              Create Lesson
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Lesson</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="e.g., Restaurant Vocabulary Week"
                  data-testid="input-lesson-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newLessonDescription}
                  onChange={(e) => setNewLessonDescription(e.target.value)}
                  placeholder="What this lesson covers..."
                  data-testid="input-lesson-description"
                />
              </div>
              <Button 
                onClick={handleCreateLesson} 
                disabled={createLessonMutation.isPending}
                data-testid="button-submit-create-lesson"
              >
                {createLessonMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Lesson
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => generateWeeklyLessonMutation.mutate()}
          disabled={generateWeeklyLessonMutation.isPending}
          data-testid="button-generate-weekly"
        >
          {generateWeeklyLessonMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Generate This Week's Lesson
        </Button>
      </div>

      {lessons.length === 0 ? (
        <Card className="p-8 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No lessons yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a lesson to organize your conversations and vocabulary, or generate one automatically from your weekly activity.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <LessonCard 
              key={lesson.id} 
              lesson={lesson}
              isExpanded={expandedLessons.has(lesson.id)}
              onToggle={() => toggleLesson(lesson.id)}
              onDelete={() => deleteLessonMutation.mutate(lesson.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({ 
  lesson, 
  isExpanded, 
  onToggle, 
  onDelete 
}: { 
  lesson: UserLesson; 
  isExpanded: boolean; 
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { data: items = [], isLoading } = useQuery<LessonItem[]>({
    queryKey: ["/api/lessons", lesson.id, "items"],
    queryFn: async () => {
      const response = await fetch(`/api/lessons/${lesson.id}/items`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch lesson items');
      return response.json();
    },
    enabled: isExpanded,
  });

  const lessonTypeLabels: Record<string, string> = {
    weekly_auto: 'Weekly Auto',
    custom: 'Custom',
    topic_based: 'Topic',
  };

  return (
    <Card className="hover-elevate" data-testid={`card-lesson-${lesson.id}`}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className="p-6 cursor-pointer">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-semibold" data-testid={`text-lesson-title-${lesson.id}`}>
                    {lesson.title}
                  </h3>
                  <Badge variant="outline" className="capitalize">
                    {lesson.lessonType ? (lessonTypeLabels[lesson.lessonType] || lesson.lessonType) : 'Custom'}
                  </Badge>
                </div>
                {lesson.description && (
                  <p className="text-sm text-muted-foreground ml-6">{lesson.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap ml-6">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(lesson.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {lesson.conversationCount ?? 0} chats
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {lesson.vocabularyCount ?? 0} words
                  </span>
                  {(lesson.totalMinutes ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {lesson.totalMinutes} min
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                data-testid={`button-delete-lesson-${lesson.id}`}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-6 border-t pt-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items in this lesson yet.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <LessonItemRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function LessonItemRow({ item }: { item: LessonItem }) {
  if (item.itemType === 'conversation' && item.conversation) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50" data-testid={`item-conversation-${item.id}`}>
        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.conversation.title || "Untitled Conversation"}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(item.conversation.createdAt).toLocaleDateString()} - {item.conversation.messageCount} messages
          </p>
        </div>
      </div>
    );
  }

  if (item.itemType === 'vocabulary' && item.vocabularyWord) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50" data-testid={`item-vocabulary-${item.id}`}>
        <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{item.vocabularyWord.word}</p>
          <p className="text-xs text-muted-foreground">{item.vocabularyWord.translation}</p>
        </div>
      </div>
    );
  }

  return null;
}
