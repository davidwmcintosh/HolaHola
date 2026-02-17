import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { BookOpen, Plus, FolderOpen, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCurriculumPathSchema, insertCurriculumUnitSchema, insertCurriculumLessonSchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { hasTeacherAccess } from "@shared/permissions";

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

// Use schemas directly from shared/schema.ts - they already have proper validation
const pathFormSchema = insertCurriculumPathSchema;
type PathFormValues = z.infer<typeof pathFormSchema>;

const unitFormSchema = insertCurriculumUnitSchema;
type UnitFormValues = z.infer<typeof unitFormSchema>;

const lessonFormSchema = insertCurriculumLessonSchema;
type LessonFormValues = z.infer<typeof lessonFormSchema>;

export default function CurriculumBuilder() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [createPathOpen, setCreatePathOpen] = useState(false);
  const [createUnitOpen, setCreateUnitOpen] = useState(false);
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  const pathForm = useForm<PathFormValues>({
    resolver: zodResolver(pathFormSchema),
    defaultValues: {
      name: "",
      description: "",
      language: "spanish",
      startLevel: "novice_low",
      endLevel: "novice_mid",
      isPublished: false,
    },
  });

  const unitForm = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      name: "",
      description: "",
      curriculumPathId: "",
      orderIndex: 0,
    },
  });

  const lessonForm = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      name: "",
      description: "",
      curriculumUnitId: "",
      orderIndex: 0,
      lessonType: "conversation",
    },
  });

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

  // Protect teacher-only route
  useEffect(() => {
    if (!isLoadingAuth && (!user || !hasTeacherAccess(user.role))) {
      setLocation("/");
    }
  }, [user, isLoadingAuth, setLocation]);

  if (isLoadingAuth || !user || !hasTeacherAccess(user.role)) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const createPathMutation = useMutation({
    mutationFn: async (data: PathFormValues) => {
      return apiRequest("POST", "/api/curriculum/paths", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum/paths"] });
      setCreatePathOpen(false);
      pathForm.reset();
      toast({
        title: "Syllabus Created",
        description: "Your syllabus has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create syllabus",
        variant: "destructive",
      });
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: async (data: UnitFormValues) => {
      return apiRequest("POST", "/api/curriculum/units", data);
    },
    onSuccess: () => {
      if (selectedPath) {
        queryClient.invalidateQueries({ queryKey: ["/api/curriculum/paths", selectedPath, "units"] });
      }
      setCreateUnitOpen(false);
      unitForm.reset();
      toast({
        title: "Unit Created",
        description: "The unit has been added to the syllabus.",
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
    mutationFn: async (data: LessonFormValues) => {
      return apiRequest("POST", "/api/curriculum/lessons", data);
    },
    onSuccess: () => {
      if (selectedUnit) {
        queryClient.invalidateQueries({ queryKey: ["/api/curriculum/units", selectedUnit, "lessons"] });
      }
      setCreateLessonOpen(false);
      lessonForm.reset();
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

  const handleCreatePath = (values: PathFormValues) => {
    createPathMutation.mutate(values);
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

    const maxOrder = units?.reduce((max, u) => Math.max(max, u.orderIndex), 0) || 0;
    const values = unitForm.getValues();
    
    createUnitMutation.mutate({
      ...values,
      curriculumPathId: selectedPath,
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

    const maxOrder = lessons?.reduce((max, l) => Math.max(max, l.orderIndex), 0) || 0;
    const values = lessonForm.getValues();
    
    createLessonMutation.mutate({
      ...values,
      curriculumUnitId: selectedUnit,
      orderIndex: maxOrder + 1,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Syllabus Builder</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Create and manage syllabi, units, and lessons</p>
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
              <DialogTitle>Create Syllabus</DialogTitle>
              <DialogDescription>Create a new syllabus for your students</DialogDescription>
            </DialogHeader>
            <Form {...pathForm}>
              <form onSubmit={pathForm.handleSubmit(handleCreatePath)} className="space-y-4 py-4">
                <FormField
                  control={pathForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Spanish for Beginners"
                          data-testid="input-path-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pathForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="A comprehensive path for learning basic Spanish"
                          data-testid="input-path-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={pathForm.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-path-language">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="spanish">Spanish</SelectItem>
                            <SelectItem value="french">French</SelectItem>
                            <SelectItem value="german">German</SelectItem>
                            <SelectItem value="italian">Italian</SelectItem>
                            <SelectItem value="portuguese">Portuguese</SelectItem>
                            <SelectItem value="japanese">Japanese</SelectItem>
                            <SelectItem value="korean">Korean</SelectItem>
                            <SelectItem value="chinese">Chinese</SelectItem>
                            <SelectItem value="hebrew">Hebrew</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={pathForm.control}
                    name="startLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-path-level">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createPathMutation.isPending} data-testid="button-confirm-create-path">
                    {createPathMutation.isPending ? "Creating..." : "Create Path"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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
                      <Form {...unitForm}>
                        <form onSubmit={(e) => { e.preventDefault(); handleCreateUnit(); }} className="space-y-4 py-4">
                          <FormField
                            control={unitForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Greetings and Introductions"
                                    data-testid="input-unit-name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={unitForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Learn basic greetings and how to introduce yourself"
                                    data-testid="input-unit-description"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" disabled={createUnitMutation.isPending} data-testid="button-confirm-create-unit">
                              {createUnitMutation.isPending ? "Creating..." : "Create Unit"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
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
                                <Form {...lessonForm}>
                                  <form onSubmit={(e) => { e.preventDefault(); handleCreateLesson(); }} className="space-y-4 py-4">
                                    <FormField
                                      control={lessonForm.control}
                                      name="name"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Lesson Name</FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder="Saying Hello"
                                              data-testid="input-lesson-name"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={lessonForm.control}
                                      name="description"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Description</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              placeholder="Learn common greeting phrases"
                                              data-testid="input-lesson-description"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={lessonForm.control}
                                      name="content"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Content</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              placeholder="Lesson materials and instructions..."
                                              data-testid="input-lesson-content"
                                              rows={6}
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <DialogFooter>
                                      <Button type="submit" disabled={createLessonMutation.isPending} data-testid="button-confirm-create-lesson">
                                        {createLessonMutation.isPending ? "Creating..." : "Create Lesson"}
                                      </Button>
                                    </DialogFooter>
                                  </form>
                                </Form>
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
              <h3 className="text-xl font-semibold">No Syllabi Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Create your first syllabus to organize lessons and learning materials.
              </p>
            </div>
            <Button onClick={() => setCreatePathOpen(true)} data-testid="button-create-first-syllabus">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Syllabus
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
