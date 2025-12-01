import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Trash2,
  BookOpen,
  Layers,
  MessageSquare,
  Book,
  Globe,
  Target,
  Plus,
  Sparkles
} from "lucide-react";
import type { ClassCurriculumUnit, ClassCurriculumLesson } from "@shared/schema";

interface SyllabusBuilderProps {
  classId: string;
}

interface CreateLessonData {
  name: string;
  description: string;
  lessonType: string;
  actflLevel?: string;
  estimatedMinutes?: number;
}

const ACTFL_LABELS: Record<string, string> = {
  novice_low: "Novice Low",
  novice_mid: "Novice Mid",
  novice_high: "Novice High",
  intermediate_low: "Intermediate Low",
  intermediate_mid: "Intermediate Mid",
  intermediate_high: "Intermediate High",
  advanced_low: "Advanced Low",
  advanced_mid: "Advanced Mid",
  advanced_high: "Advanced High",
};

const LESSON_TYPE_ICONS: Record<string, typeof BookOpen> = {
  conversation: MessageSquare,
  vocabulary: Book,
  grammar: BookOpen,
  cultural_exploration: Globe,
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  conversation: "Conversation",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  cultural_exploration: "Cultural",
};

export function SyllabusBuilder({ classId }: SyllabusBuilderProps) {
  const { toast } = useToast();
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [draggingUnitId, setDraggingUnitId] = useState<string | null>(null);
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [dragOverUnitId, setDragOverUnitId] = useState<string | null>(null);
  const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null);

  const { data: units = [], isLoading: unitsLoading } = useQuery<ClassCurriculumUnit[]>({
    queryKey: ["/api/teacher/classes", classId, "curriculum", "units"],
    queryFn: async () => {
      const response = await fetch(`/api/teacher/classes/${classId}/curriculum/units`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch curriculum units');
      return response.json();
    },
  });

  const reorderUnitsMutation = useMutation({
    mutationFn: async (unitOrders: { id: string; orderIndex: number }[]) => {
      return apiRequest("POST", `/api/teacher/classes/${classId}/curriculum/units/reorder`, { unitOrders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/teacher/classes" && key[1] === classId && key[2] === "curriculum";
        }
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reorder units",
        variant: "destructive",
      });
    },
  });

  const reorderLessonsMutation = useMutation({
    mutationFn: async ({ unitId, lessonOrders }: { unitId: string; lessonOrders: { id: string; orderIndex: number }[] }) => {
      return apiRequest("POST", `/api/teacher/classes/${classId}/curriculum/units/${unitId}/lessons/reorder`, { lessonOrders });
    },
    onSuccess: (_, { unitId }) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/teacher/classes", classId, "curriculum", "units", unitId, "lessons"]
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reorder lessons",
        variant: "destructive",
      });
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async ({ lessonId, unitId }: { lessonId: string; unitId: string }) => {
      return apiRequest("DELETE", `/api/teacher/classes/${classId}/curriculum/lessons/${lessonId}`);
    },
    onSuccess: (_, { unitId }) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/teacher/classes", classId, "curriculum", "units", unitId, "lessons"]
      });
      toast({
        title: "Lesson Removed",
        description: "The lesson has been removed from the syllabus.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove lesson",
        variant: "destructive",
      });
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: async ({ unitId, lessonData, onDialogClose }: { unitId: string; lessonData: CreateLessonData; onDialogClose?: () => void }) => {
      const response = await apiRequest("POST", `/api/teacher/classes/${classId}/curriculum/units/${unitId}/lessons`, lessonData);
      return { response, unitId, onDialogClose };
    },
    onSuccess: ({ unitId, onDialogClose }) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/teacher/classes", classId, "curriculum", "units", unitId, "lessons"]
      });
      toast({
        title: "Lesson Created",
        description: "Your custom lesson has been added to the unit.",
      });
      onDialogClose?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create lesson",
        variant: "destructive",
      });
    },
  });

  const toggleUnit = useCallback((unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }, []);

  const handleUnitDragStart = (e: React.DragEvent, unitId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', unitId);
    e.dataTransfer.setData('type', 'unit');
    setDraggingUnitId(unitId);
  };

  const handleUnitDragOver = (e: React.DragEvent, unitId: string) => {
    e.preventDefault();
    const type = e.dataTransfer.types.includes('type') ? 'unit' : null;
    if (type === 'unit' || draggingUnitId) {
      setDragOverUnitId(unitId);
    }
  };

  const handleUnitDrop = (e: React.DragEvent, targetUnitId: string) => {
    e.preventDefault();
    if (!draggingUnitId || draggingUnitId === targetUnitId) {
      setDraggingUnitId(null);
      setDragOverUnitId(null);
      return;
    }

    const sortedUnits = [...units].sort((a, b) => a.orderIndex - b.orderIndex);
    const dragIndex = sortedUnits.findIndex(u => u.id === draggingUnitId);
    const dropIndex = sortedUnits.findIndex(u => u.id === targetUnitId);
    
    if (dragIndex === -1 || dropIndex === -1) return;

    const newUnits = [...sortedUnits];
    const [removed] = newUnits.splice(dragIndex, 1);
    newUnits.splice(dropIndex, 0, removed);

    const unitOrders = newUnits.map((unit, index) => ({
      id: unit.id,
      orderIndex: index,
    }));

    reorderUnitsMutation.mutate(unitOrders);
    setDraggingUnitId(null);
    setDragOverUnitId(null);
  };

  const handleUnitDragEnd = () => {
    setDraggingUnitId(null);
    setDragOverUnitId(null);
  };

  const sortedUnits = [...units].sort((a, b) => a.orderIndex - b.orderIndex).filter(u => !u.isRemoved);
  const totalLessons = sortedUnits.reduce((sum, unit) => sum + (unit as any).lessonCount || 0, 0);

  if (unitsLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (sortedUnits.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-muted rounded-full">
              <Layers className="w-12 h-12 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">No Syllabus</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              This class doesn't have a syllabus yet. Create the class from a template to get started with pre-built curriculum.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Syllabus</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {sortedUnits.length} units • Drag to reorder
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sortedUnits.map((unit, index) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            classId={classId}
            index={index}
            isExpanded={expandedUnits.has(unit.id)}
            isDragging={draggingUnitId === unit.id}
            isDragOver={dragOverUnitId === unit.id}
            onToggle={() => toggleUnit(unit.id)}
            onDragStart={(e) => handleUnitDragStart(e, unit.id)}
            onDragOver={(e) => handleUnitDragOver(e, unit.id)}
            onDrop={(e) => handleUnitDrop(e, unit.id)}
            onDragEnd={handleUnitDragEnd}
            onDeleteLesson={(lessonId, unitId) => deleteLessonMutation.mutate({ lessonId, unitId })}
            onAddLesson={(unitId, lessonData, onDialogClose) => createLessonMutation.mutate({ unitId, lessonData, onDialogClose })}
            isCreatingLesson={createLessonMutation.isPending}
            reorderLessonsMutation={reorderLessonsMutation}
          />
        ))}
      </div>
    </div>
  );
}

interface UnitCardProps {
  unit: ClassCurriculumUnit;
  classId: string;
  index: number;
  isExpanded: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onToggle: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDeleteLesson: (lessonId: string, unitId: string) => void;
  onAddLesson: (unitId: string, lessonData: CreateLessonData, onDialogClose: () => void) => void;
  isCreatingLesson: boolean;
  reorderLessonsMutation: any;
}

function UnitCard({
  unit,
  classId,
  index,
  isExpanded,
  isDragging,
  isDragOver,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDeleteLesson,
  onAddLesson,
  isCreatingLesson,
  reorderLessonsMutation,
}: UnitCardProps) {
  const [addLessonDialogOpen, setAddLessonDialogOpen] = useState(false);
  const [newLessonName, setNewLessonName] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");
  const [newLessonType, setNewLessonType] = useState("conversation");
  const [newLessonActflLevel, setNewLessonActflLevel] = useState("");

  const handleAddLesson = () => {
    if (!newLessonName.trim()) return;
    
    const resetForm = () => {
      setNewLessonName("");
      setNewLessonDescription("");
      setNewLessonType("conversation");
      setNewLessonActflLevel("");
      setAddLessonDialogOpen(false);
    };
    
    onAddLesson(unit.id, {
      name: newLessonName.trim(),
      description: newLessonDescription.trim(),
      lessonType: newLessonType,
      actflLevel: newLessonActflLevel || undefined,
      estimatedMinutes: 30,
    }, resetForm);
  };

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery<ClassCurriculumLesson[]>({
    queryKey: ["/api/teacher/classes", classId, "curriculum", "units", unit.id, "lessons"],
    queryFn: async () => {
      const response = await fetch(`/api/teacher/classes/${classId}/curriculum/units/${unit.id}/lessons`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch lessons');
      return response.json();
    },
    enabled: isExpanded,
  });

  const sortedLessons = [...lessons]
    .filter(l => !l.isRemoved)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null);

  const handleLessonDragStart = (e: React.DragEvent, lessonId: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lessonId);
    setDraggingLessonId(lessonId);
  };

  const handleLessonDragOver = (e: React.DragEvent, lessonId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingLessonId) {
      setDragOverLessonId(lessonId);
    }
  };

  const handleLessonDrop = (e: React.DragEvent, targetLessonId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggingLessonId || draggingLessonId === targetLessonId) {
      setDraggingLessonId(null);
      setDragOverLessonId(null);
      return;
    }

    const dragIndex = sortedLessons.findIndex(l => l.id === draggingLessonId);
    const dropIndex = sortedLessons.findIndex(l => l.id === targetLessonId);
    
    if (dragIndex === -1 || dropIndex === -1) return;

    const newLessons = [...sortedLessons];
    const [removed] = newLessons.splice(dragIndex, 1);
    newLessons.splice(dropIndex, 0, removed);

    const lessonOrders = newLessons.map((lesson, idx) => ({
      id: lesson.id,
      orderIndex: idx,
    }));

    reorderLessonsMutation.mutate({ unitId: unit.id, lessonOrders });
    setDraggingLessonId(null);
    setDragOverLessonId(null);
  };

  const handleLessonDragEnd = () => {
    setDraggingLessonId(null);
    setDragOverLessonId(null);
  };

  return (
    <Card
      className={`transition-all ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-primary' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-testid={`card-unit-${unit.id}`}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center gap-3">
              <div className="cursor-grab" onMouseDown={(e) => e.stopPropagation()}>
                <GripVertical className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Unit {index + 1}</span>
                  {unit.actflLevel && (
                    <Badge variant="outline" className="text-xs">
                      <Target className="w-3 h-3 mr-1" />
                      {ACTFL_LABELS[unit.actflLevel] || unit.actflLevel}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-1">{unit.name}</CardTitle>
                {unit.description && (
                  <CardDescription className="mt-1">{unit.description}</CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <BookOpen className="w-3 h-3" />
                  {sortedLessons.length || '...'} lessons
                </Badge>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {lessonsLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            ) : sortedLessons.length === 0 ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No lessons in this unit.
                </p>
                <Dialog open={addLessonDialogOpen} onOpenChange={setAddLessonDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid={`button-add-first-lesson-${unit.id}`}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Lesson
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Create Custom Lesson
                      </DialogTitle>
                      <DialogDescription>
                        Add a custom lesson to "{unit.name}". You can customize the content later.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor={`lesson-name-${unit.id}`}>Lesson Name</Label>
                        <Input
                          id={`lesson-name-${unit.id}`}
                          value={newLessonName}
                          onChange={(e) => setNewLessonName(e.target.value)}
                          placeholder="e.g., Ordering at a Restaurant"
                          data-testid={`input-lesson-name-${unit.id}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`lesson-desc-${unit.id}`}>Description (optional)</Label>
                        <Textarea
                          id={`lesson-desc-${unit.id}`}
                          value={newLessonDescription}
                          onChange={(e) => setNewLessonDescription(e.target.value)}
                          placeholder="What will students learn in this lesson?"
                          className="resize-none"
                          rows={2}
                          data-testid={`input-lesson-description-${unit.id}`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Lesson Type</Label>
                          <Select value={newLessonType} onValueChange={setNewLessonType}>
                            <SelectTrigger data-testid={`select-lesson-type-${unit.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="conversation">Conversation</SelectItem>
                              <SelectItem value="vocabulary">Vocabulary</SelectItem>
                              <SelectItem value="grammar">Grammar</SelectItem>
                              <SelectItem value="cultural_exploration">Cultural</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>ACTFL Level (optional)</Label>
                          <Select value={newLessonActflLevel} onValueChange={setNewLessonActflLevel}>
                            <SelectTrigger data-testid={`select-lesson-actfl-${unit.id}`}>
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Not specified</SelectItem>
                              <SelectItem value="novice_low">Novice Low</SelectItem>
                              <SelectItem value="novice_mid">Novice Mid</SelectItem>
                              <SelectItem value="novice_high">Novice High</SelectItem>
                              <SelectItem value="intermediate_low">Intermediate Low</SelectItem>
                              <SelectItem value="intermediate_mid">Intermediate Mid</SelectItem>
                              <SelectItem value="intermediate_high">Intermediate High</SelectItem>
                              <SelectItem value="advanced_low">Advanced Low</SelectItem>
                              <SelectItem value="advanced_mid">Advanced Mid</SelectItem>
                              <SelectItem value="advanced_high">Advanced High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setAddLessonDialogOpen(false)}
                        data-testid={`button-cancel-add-lesson-${unit.id}`}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddLesson}
                        disabled={!newLessonName.trim() || isCreatingLesson}
                        data-testid={`button-confirm-add-lesson-${unit.id}`}
                      >
                        {isCreatingLesson ? "Creating..." : "Create Lesson"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedLessons.map((lesson, lessonIndex) => {
                  const Icon = LESSON_TYPE_ICONS[lesson.lessonType || 'conversation'] || BookOpen;
                  return (
                    <div
                      key={lesson.id}
                      className={`flex items-center gap-3 p-3 rounded-lg bg-muted/30 ${
                        draggingLessonId === lesson.id ? 'opacity-50' : ''
                      } ${dragOverLessonId === lesson.id ? 'ring-2 ring-primary' : ''}`}
                      draggable
                      onDragStart={(e) => handleLessonDragStart(e, lesson.id)}
                      onDragOver={(e) => handleLessonDragOver(e, lesson.id)}
                      onDrop={(e) => handleLessonDrop(e, lesson.id)}
                      onDragEnd={handleLessonDragEnd}
                      data-testid={`card-lesson-${lesson.id}`}
                    >
                      <div className="cursor-grab">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium w-6">
                          {lessonIndex + 1}.
                        </span>
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{lesson.name}</span>
                        {lesson.isCustom && (
                          <Badge variant="default" className="text-xs bg-primary/10 text-primary border-primary/20">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Custom
                          </Badge>
                        )}
                        {lesson.lessonType && (
                          <Badge variant="outline" className="text-xs">
                            {LESSON_TYPE_LABELS[lesson.lessonType] || lesson.lessonType}
                          </Badge>
                        )}
                        {lesson.actflLevel && (
                          <Badge variant="secondary" className="text-xs">
                            {ACTFL_LABELS[lesson.actflLevel]}
                          </Badge>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            data-testid={`button-remove-lesson-${lesson.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Lesson</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove "{lesson.name}" from this unit? This action can be undone by restoring the syllabus from the template.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDeleteLesson(lesson.id, unit.id)}
                              data-testid={`button-confirm-remove-lesson-${lesson.id}`}
                            >
                              Remove Lesson
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
                <Dialog open={addLessonDialogOpen} onOpenChange={setAddLessonDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 border-dashed border"
                      data-testid={`button-add-lesson-${unit.id}`}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Custom Lesson
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Create Custom Lesson
                      </DialogTitle>
                      <DialogDescription>
                        Add a custom lesson to "{unit.name}". You can customize the content later.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor={`new-lesson-name-${unit.id}`}>Lesson Name</Label>
                        <Input
                          id={`new-lesson-name-${unit.id}`}
                          value={newLessonName}
                          onChange={(e) => setNewLessonName(e.target.value)}
                          placeholder="e.g., Ordering at a Restaurant"
                          data-testid={`input-new-lesson-name-${unit.id}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`new-lesson-desc-${unit.id}`}>Description (optional)</Label>
                        <Textarea
                          id={`new-lesson-desc-${unit.id}`}
                          value={newLessonDescription}
                          onChange={(e) => setNewLessonDescription(e.target.value)}
                          placeholder="What will students learn in this lesson?"
                          className="resize-none"
                          rows={2}
                          data-testid={`input-new-lesson-description-${unit.id}`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Lesson Type</Label>
                          <Select value={newLessonType} onValueChange={setNewLessonType}>
                            <SelectTrigger data-testid={`select-new-lesson-type-${unit.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="conversation">Conversation</SelectItem>
                              <SelectItem value="vocabulary">Vocabulary</SelectItem>
                              <SelectItem value="grammar">Grammar</SelectItem>
                              <SelectItem value="cultural_exploration">Cultural</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>ACTFL Level (optional)</Label>
                          <Select value={newLessonActflLevel} onValueChange={setNewLessonActflLevel}>
                            <SelectTrigger data-testid={`select-new-lesson-actfl-${unit.id}`}>
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Not specified</SelectItem>
                              <SelectItem value="novice_low">Novice Low</SelectItem>
                              <SelectItem value="novice_mid">Novice Mid</SelectItem>
                              <SelectItem value="novice_high">Novice High</SelectItem>
                              <SelectItem value="intermediate_low">Intermediate Low</SelectItem>
                              <SelectItem value="intermediate_mid">Intermediate Mid</SelectItem>
                              <SelectItem value="intermediate_high">Intermediate High</SelectItem>
                              <SelectItem value="advanced_low">Advanced Low</SelectItem>
                              <SelectItem value="advanced_mid">Advanced Mid</SelectItem>
                              <SelectItem value="advanced_high">Advanced High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setAddLessonDialogOpen(false)}
                        data-testid={`button-cancel-new-lesson-${unit.id}`}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddLesson}
                        disabled={!newLessonName.trim() || isCreatingLesson}
                        data-testid={`button-confirm-new-lesson-${unit.id}`}
                      >
                        {isCreatingLesson ? "Creating..." : "Create Lesson"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
