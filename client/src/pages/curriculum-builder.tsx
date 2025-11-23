import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { BookOpen, Plus, FolderOpen, FileText } from "lucide-react";

interface CurriculumPath {
  id: string;
  name: string;
  description: string | null;
  language: string;
  targetLevel: string;
  isPublished: boolean;
  createdAt: Date;
}

interface CurriculumUnit {
  id: string;
  pathId: string;
  name: string;
  description: string | null;
  orderIndex: number;
}

interface CurriculumLesson {
  id: string;
  unitId: string;
  name: string;
  description: string | null;
  content: string | null;
  orderIndex: number;
}

export default function CurriculumBuilder() {
  const { toast } = useToast();
  const [createPathOpen, setCreatePathOpen] = useState(false);
  const [createUnitOpen, setCreateUnitOpen] = useState(false);
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // Path form state
  const [pathName, setPathName] = useState("");
  const [pathDescription, setPathDescription] = useState("");
  const [pathLanguage, setPathLanguage] = useState("spanish");
  const [pathLevel, setPathLevel] = useState("beginner");

  // Unit form state
  const [unitName, setUnitName] = useState("");
  const [unitDescription, setUnitDescription] = useState("");

  // Lesson form state
  const [lessonName, setLessonName] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonContent, setLessonContent] = useState("");

  const { data: paths, isLoading: isLoadingPaths } = useQuery<CurriculumPath[]>({
    queryKey: ["/api/curriculum/paths"],
  });

  const { data: units, isLoading: isLoadingUnits } = useQuery<CurriculumUnit[]>({
    queryKey: ["/api/curriculum/paths", selectedPath, "units"],
    enabled: !!selectedPath,
  });

  const { data: lessons, isLoading: isLoadingLessons } = useQuery<CurriculumLesson[]>({
    queryKey: ["/api/curriculum/units", selectedUnit, "lessons"],
    enabled: !!selectedUnit,
  });

  const createPathMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/curriculum/paths", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum/paths"] });
      setCreatePathOpen(false);
      resetPathForm();
      toast({
        title: "Curriculum Path Created",
        description: "Your curriculum path has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create curriculum path",
        variant: "destructive",
      });
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/curriculum/units", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      if (selectedPath) {
        queryClient.invalidateQueries({ queryKey: ["/api/curriculum/paths", selectedPath, "units"] });
      }
      setCreateUnitOpen(false);
      resetUnitForm();
      toast({
        title: "Unit Created",
        description: "The unit has been added to the curriculum path.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create unit",
        variant: "destructive",
      });
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/curriculum/lessons", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      if (selectedUnit) {
        queryClient.invalidateQueries({ queryKey: ["/api/curriculum/units", selectedUnit, "lessons"] });
      }
      setCreateLessonOpen(false);
      resetLessonForm();
      toast({
        title: "Lesson Created",
        description: "The lesson has been added to the unit.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lesson",
        variant: "destructive",
      });
    },
  });

  const resetPathForm = () => {
    setPathName("");
    setPathDescription("");
    setPathLanguage("spanish");
    setPathLevel("beginner");
  };

  const resetUnitForm = () => {
    setUnitName("");
    setUnitDescription("");
  };

  const resetLessonForm = () => {
    setLessonName("");
    setLessonDescription("");
    setLessonContent("");
  };

  const handleCreatePath = () => {
    if (!pathName.trim()) {
      toast({
        title: "Error",
        description: "Path name is required",
        variant: "destructive",
      });
      return;
    }

    createPathMutation.mutate({
      name: pathName.trim(),
      description: pathDescription.trim() || null,
      language: pathLanguage,
      targetLevel: pathLevel,
      isPublished: false,
    });
  };

  const handleCreateUnit = () => {
    if (!selectedPath) {
      toast({
        title: "Error",
        description: "Please select a curriculum path first",
        variant: "destructive",
      });
      return;
    }

    if (!unitName.trim()) {
      toast({
        title: "Error",
        description: "Unit name is required",
        variant: "destructive",
      });
      return;
    }

    const maxOrder = units?.reduce((max, u) => Math.max(max, u.orderIndex), 0) || 0;

    createUnitMutation.mutate({
      pathId: selectedPath,
      name: unitName.trim(),
      description: unitDescription.trim() || null,
      orderIndex: maxOrder + 1,
    });
  };

  const handleCreateLesson = () => {
    if (!selectedUnit) {
      toast({
        title: "Error",
        description: "Please select a unit first",
        variant: "destructive",
      });
      return;
    }

    if (!lessonName.trim()) {
      toast({
        title: "Error",
        description: "Lesson name is required",
        variant: "destructive",
      });
      return;
    }

    const maxOrder = lessons?.reduce((max, l) => Math.max(max, l.orderIndex), 0) || 0;

    createLessonMutation.mutate({
      unitId: selectedUnit,
      name: lessonName.trim(),
      description: lessonDescription.trim() || null,
      content: lessonContent.trim() || null,
      orderIndex: maxOrder + 1,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Curriculum Builder</h1>
          <p className="text-muted-foreground mt-2">Create and manage curriculum paths, units, and lessons</p>
        </div>
        <Dialog open={createPathOpen} onOpenChange={setCreatePathOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-path">
              <Plus className="w-4 h-4 mr-2" />
              Create Path
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Curriculum Path</DialogTitle>
              <DialogDescription>Create a new curriculum path for your students</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="path-name">Name</Label>
                <Input
                  id="path-name"
                  placeholder="Spanish for Beginners"
                  value={pathName}
                  onChange={(e) => setPathName(e.target.value)}
                  data-testid="input-path-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="path-description">Description</Label>
                <Textarea
                  id="path-description"
                  placeholder="A comprehensive path for learning basic Spanish"
                  value={pathDescription}
                  onChange={(e) => setPathDescription(e.target.value)}
                  data-testid="input-path-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="path-language">Language</Label>
                  <Select value={pathLanguage} onValueChange={setPathLanguage}>
                    <SelectTrigger id="path-language" data-testid="select-path-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spanish">Spanish</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="german">German</SelectItem>
                      <SelectItem value="italian">Italian</SelectItem>
                      <SelectItem value="portuguese">Portuguese</SelectItem>
                      <SelectItem value="japanese">Japanese</SelectItem>
                      <SelectItem value="korean">Korean</SelectItem>
                      <SelectItem value="chinese">Chinese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="path-level">Target Level</Label>
                  <Select value={pathLevel} onValueChange={setPathLevel}>
                    <SelectTrigger id="path-level" data-testid="select-path-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreatePath} disabled={createPathMutation.isPending} data-testid="button-confirm-create-path">
                {createPathMutation.isPending ? "Creating..." : "Create Path"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoadingPaths ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : paths && paths.length > 0 ? (
        <Accordion type="single" collapsible className="space-y-4" onValueChange={(value) => setSelectedPath(value || null)}>
          {paths.map((path) => (
            <AccordionItem key={path.id} value={path.id} className="border rounded-lg px-6" data-testid={`accordion-path-${path.id}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4 text-left">
                  <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{path.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {path.language.charAt(0).toUpperCase() + path.language.slice(1)} • {path.targetLevel}
                    </p>
                  </div>
                  <Badge variant={path.isPublished ? "default" : "secondary"}>
                    {path.isPublished ? "Published" : "Draft"}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {path.description && (
                  <p className="text-sm text-muted-foreground">{path.description}</p>
                )}
                
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Units</h4>
                  <Dialog open={createUnitOpen && selectedPath === path.id} onOpenChange={setCreateUnitOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid={`button-create-unit-${path.id}`}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add Unit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Unit</DialogTitle>
                        <DialogDescription>Add a new unit to this curriculum path</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="unit-name">Unit Name</Label>
                          <Input
                            id="unit-name"
                            placeholder="Greetings and Introductions"
                            value={unitName}
                            onChange={(e) => setUnitName(e.target.value)}
                            data-testid="input-unit-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unit-description">Description</Label>
                          <Textarea
                            id="unit-description"
                            placeholder="Learn basic greetings and how to introduce yourself"
                            value={unitDescription}
                            onChange={(e) => setUnitDescription(e.target.value)}
                            data-testid="input-unit-description"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleCreateUnit} disabled={createUnitMutation.isPending} data-testid="button-confirm-create-unit">
                          {createUnitMutation.isPending ? "Creating..." : "Create Unit"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {selectedPath === path.id && isLoadingUnits ? (
                  <div className="space-y-2">
                    <div className="h-12 bg-muted rounded animate-pulse" />
                  </div>
                ) : units && units.length > 0 ? (
                  <div className="space-y-2 pl-6 border-l-2">
                    {units.map((unit) => (
                      <Card key={unit.id} data-testid={`card-unit-${unit.id}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <FolderOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <CardTitle className="text-base">{unit.name}</CardTitle>
                                {unit.description && (
                                  <CardDescription className="mt-1">{unit.description}</CardDescription>
                                )}
                              </div>
                            </div>
                            <Dialog open={createLessonOpen && selectedUnit === unit.id} onOpenChange={setCreateLessonOpen}>
                              <DialogTrigger asChild onClick={() => setSelectedUnit(unit.id)}>
                                <Button size="sm" variant="outline" data-testid={`button-create-lesson-${unit.id}`}>
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Lesson
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Create Lesson</DialogTitle>
                                  <DialogDescription>Add a new lesson to this unit</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="lesson-name">Lesson Name</Label>
                                    <Input
                                      id="lesson-name"
                                      placeholder="Saying Hello"
                                      value={lessonName}
                                      onChange={(e) => setLessonName(e.target.value)}
                                      data-testid="input-lesson-name"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="lesson-description">Description</Label>
                                    <Textarea
                                      id="lesson-description"
                                      placeholder="Learn common greeting phrases"
                                      value={lessonDescription}
                                      onChange={(e) => setLessonDescription(e.target.value)}
                                      data-testid="input-lesson-description"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="lesson-content">Content</Label>
                                    <Textarea
                                      id="lesson-content"
                                      placeholder="Lesson materials and instructions..."
                                      value={lessonContent}
                                      onChange={(e) => setLessonContent(e.target.value)}
                                      data-testid="input-lesson-content"
                                      rows={6}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={handleCreateLesson} disabled={createLessonMutation.isPending} data-testid="button-confirm-create-lesson">
                                    {createLessonMutation.isPending ? "Creating..." : "Create Lesson"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </CardHeader>
                        {selectedUnit === unit.id && lessons && lessons.length > 0 && (
                          <CardContent className="space-y-2 pl-9">
                            {lessons.map((lesson) => (
                              <div key={lesson.id} className="flex items-start gap-2 text-sm p-2 rounded hover-elevate" data-testid={`item-lesson-${lesson.id}`}>
                                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="flex-1">
                                  <p className="font-medium">{lesson.name}</p>
                                  {lesson.description && (
                                    <p className="text-muted-foreground text-xs mt-0.5">{lesson.description}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pl-6">No units yet. Create your first unit above.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-muted rounded-full">
                <BookOpen className="w-12 h-12 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No Curriculum Paths Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Create your first curriculum path to organize lessons and learning materials.
              </p>
            </div>
            <Button onClick={() => setCreatePathOpen(true)} data-testid="button-create-first-path">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Path
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
