import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, BookOpen, ClipboardList, GraduationCap, Clock, ArrowRight, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTeacherClassSchema, CurriculumPath } from "@shared/schema";
import { hasTeacherAccess } from "@shared/permissions";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TeacherClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  joinCode: string;
  isActive: boolean;
  curriculumPathId: string | null;
  createdAt: Date;
  studentCount?: number;
  assignmentCount?: number;
}

// Use schema directly from shared/schema.ts - it already has proper validation
const createClassFormSchema = insertTeacherClassSchema.pick({
  name: true,
  description: true,
  language: true,
}).extend({
  curriculumPathId: z.string().optional(),
});

type CreateClassFormValues = z.infer<typeof createClassFormSchema>;

const languageLabels: Record<string, string> = {
  spanish: "Spanish",
  french: "French",
  german: "German",
  italian: "Italian",
  portuguese: "Portuguese",
  japanese: "Japanese",
  korean: "Korean",
  chinese: "Chinese",
  english: "English",
  hebrew: "Hebrew",
};

const actflLabels: Record<string, string> = {
  novice_low: "Novice Low",
  novice_mid: "Novice Mid",
  novice_high: "Novice High",
  intermediate_low: "Intermediate Low",
  intermediate_mid: "Intermediate Mid",
  intermediate_high: "Intermediate High",
  advanced_low: "Advanced Low",
  advanced_mid: "Advanced Mid",
  advanced_high: "Advanced High",
  superior: "Superior",
  distinguished: "Distinguished",
};

export default function TeacherDashboard() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFromCurriculumOpen, setCreateFromCurriculumOpen] = useState(false);
  const [selectedCurriculum, setSelectedCurriculum] = useState<CurriculumPath | null>(null);
  const [activeTab, setActiveTab] = useState("classes");
  const { toast } = useToast();

  const form = useForm<CreateClassFormValues>({
    resolver: zodResolver(createClassFormSchema),
    defaultValues: {
      name: "",
      description: "",
      language: "spanish",
    },
  });

  const curriculumForm = useForm<CreateClassFormValues>({
    resolver: zodResolver(createClassFormSchema),
    defaultValues: {
      name: "",
      description: "",
      language: "spanish",
    },
  });

  const { data: classes, isLoading } = useQuery<TeacherClass[]>({
    queryKey: ["/api/teacher/classes"],
  });

  const { data: curriculumPaths, isLoading: isLoadingCurricula } = useQuery<CurriculumPath[]>({
    queryKey: ["/api/curriculum/paths"],
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

  const createClassMutation = useMutation({
    mutationFn: async (data: CreateClassFormValues) => {
      return apiRequest("POST", "/api/teacher/classes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes"] });
      setCreateDialogOpen(false);
      setCreateFromCurriculumOpen(false);
      form.reset();
      curriculumForm.reset();
      setSelectedCurriculum(null);
      toast({
        title: "Class Created",
        description: "Your class has been created successfully.",
      });
      setActiveTab("classes");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create class",
        variant: "destructive",
      });
    },
  });

  const handleCreateClass = (values: CreateClassFormValues) => {
    createClassMutation.mutate(values);
  };

  const handleCreateFromCurriculum = (values: CreateClassFormValues) => {
    if (!selectedCurriculum) return;
    createClassMutation.mutate({
      ...values,
      curriculumPathId: selectedCurriculum.id,
    });
  };

  const openCurriculumDialog = (curriculum: CurriculumPath) => {
    setSelectedCurriculum(curriculum);
    curriculumForm.reset({
      name: `${curriculum.name} - ${new Date().toLocaleDateString()}`,
      description: curriculum.description,
      language: curriculum.language,
    });
    setCreateFromCurriculumOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your classes and browse syllabi</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-class">
              <Plus className="w-4 h-4 mr-2" />
              Create Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>
                Create a new class for your students. They'll join using the generated code.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateClass)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Spanish 101"
                          data-testid="input-class-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Beginner Spanish class for high school students"
                          data-testid="input-class-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-class-language">
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
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="hebrew">Hebrew</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createClassMutation.isPending}
                    data-testid="button-confirm-create-class"
                  >
                    {createClassMutation.isPending ? "Creating..." : "Create Class"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="classes" data-testid="tab-classes">
            <BookOpen className="w-4 h-4 mr-2" />
            My Classes
          </TabsTrigger>
          <TabsTrigger value="syllabi" data-testid="tab-syllabi">
            <Layers className="w-4 h-4 mr-2" />
            Browse Syllabi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : classes && classes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...classes].sort((a, b) => a.name.localeCompare(b.name)).map((classItem) => (
                <Link key={classItem.id} href={`/teacher/classes/${classItem.id}`}>
                  <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-class-${classItem.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg">{classItem.name}</CardTitle>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {classItem.curriculumPathId && (
                            <Badge variant="outline" className="text-xs">
                              <GraduationCap className="w-3 h-3 mr-1" />
                              Syllabus
                            </Badge>
                          )}
                          <Badge variant={classItem.isActive ? "default" : "secondary"}>
                            {classItem.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>
                        {languageLabels[classItem.language] || classItem.language}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {classItem.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {classItem.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span data-testid={`text-student-count-${classItem.id}`}>
                            {classItem.studentCount ?? 0} Students
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ClipboardList className="w-4 h-4" />
                          <span data-testid={`text-assignment-count-${classItem.id}`}>
                            {classItem.assignmentCount ?? 0} Assignments
                          </span>
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Join Code:</span>
                          <code className="px-3 py-1 bg-muted rounded text-sm font-mono" data-testid={`text-join-code-${classItem.id}`}>
                            {classItem.joinCode}
                          </code>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-muted rounded-full">
                    <BookOpen className="w-12 h-12 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No Classes Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Create your first class to start teaching, or browse syllabi to get started with a pre-built course.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-class">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Class
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("syllabi")} data-testid="button-browse-syllabi">
                    <Layers className="w-4 h-4 mr-2" />
                    Browse Syllabi
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="syllabi" className="mt-6">
          {isLoadingCurricula ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : curriculumPaths && curriculumPaths.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {curriculumPaths.filter(p => p.isPublished).map((curriculum) => (
                <Card key={curriculum.id} className="flex flex-col" data-testid={`card-curriculum-${curriculum.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{curriculum.name}</CardTitle>
                        <CardDescription>
                          {languageLabels[curriculum.language] || curriculum.language}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        {actflLabels[curriculum.startLevel] || curriculum.startLevel} - {actflLabels[curriculum.endLevel] || curriculum.endLevel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {curriculum.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {curriculum.estimatedHours && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{curriculum.estimatedHours}h</span>
                        </div>
                      )}
                      {curriculum.targetAudience && (
                        <div className="flex items-center gap-1">
                          <GraduationCap className="w-4 h-4" />
                          <span>{curriculum.targetAudience}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => openCurriculumDialog(curriculum)}
                      data-testid={`button-use-curriculum-${curriculum.id}`}
                    >
                      Use This Curriculum
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-muted rounded-full">
                    <Layers className="w-12 h-12 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No Syllabi Available</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    No published syllabi are available yet. You can create a class from scratch.
                  </p>
                </div>
                <Button onClick={() => { setActiveTab("classes"); setCreateDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Class From Scratch
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog for creating class from curriculum */}
      <Dialog open={createFromCurriculumOpen} onOpenChange={setCreateFromCurriculumOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Class from Curriculum</DialogTitle>
            <DialogDescription>
              {selectedCurriculum && (
                <>
                  Create a class based on <strong>{selectedCurriculum.name}</strong>. 
                  Customize the class name and description for your students.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedCurriculum && (
            <div className="rounded-lg border p-3 bg-muted/50 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">
                  {languageLabels[selectedCurriculum.language] || selectedCurriculum.language}
                </Badge>
                <Badge variant="secondary">
                  {actflLabels[selectedCurriculum.startLevel] || selectedCurriculum.startLevel} - {actflLabels[selectedCurriculum.endLevel] || selectedCurriculum.endLevel}
                </Badge>
                {selectedCurriculum.estimatedHours && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedCurriculum.estimatedHours}h
                  </span>
                )}
              </div>
            </div>
          )}
          <Form {...curriculumForm}>
            <form onSubmit={curriculumForm.handleSubmit(handleCreateFromCurriculum)} className="space-y-4">
              <FormField
                control={curriculumForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Spanish 101 - Period 3"
                        data-testid="input-curriculum-class-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={curriculumForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Customize the description for your students"
                        data-testid="input-curriculum-class-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateFromCurriculumOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createClassMutation.isPending}
                  data-testid="button-confirm-create-from-curriculum"
                >
                  {createClassMutation.isPending ? "Creating..." : "Create Class"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
