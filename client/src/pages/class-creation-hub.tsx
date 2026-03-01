import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  BookOpen, 
  Clock, 
  Target, 
  GraduationCap, 
  Search,
  Layers,
  Sparkles,
  FolderOpen,
  Library,
  PenTool,
  ArrowRight,
  Microscope,
} from "lucide-react";
import type { CurriculumPath, CurriculumUnit, CurriculumLesson, SubjectSyllabus, TeacherClass } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { hasTeacherAccess } from "@shared/permissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { ActflIndicators } from "@/components/ActflIndicators";

const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  description: z.string().optional(),
  language: z.string().min(1, "Language is required"),
  curriculumPathId: z.string().optional(),
});

const createAcademicClassSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  description: z.string().optional(),
  subjectSyllabusId: z.string().min(1, "Please select a textbook"),
});

type CreateClassFormValues = z.infer<typeof createClassSchema>;
type CreateAcademicClassFormValues = z.infer<typeof createAcademicClassSchema>;

export default function ClassCreationHub() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createAcademicDialogOpen, setCreateAcademicDialogOpen] = useState(false);
  const [selectedCurriculum, setSelectedCurriculum] = useState<CurriculumPath | null>(null);

  const form = useForm<CreateClassFormValues>({
    resolver: zodResolver(createClassSchema),
    defaultValues: { name: "", description: "", language: "", curriculumPathId: undefined },
  });

  const academicForm = useForm<CreateAcademicClassFormValues>({
    resolver: zodResolver(createAcademicClassSchema),
    defaultValues: { name: "", description: "", subjectSyllabusId: "" },
  });

  useEffect(() => {
    if (!isLoadingAuth && (!user || !hasTeacherAccess(user.role))) {
      setLocation("/");
    }
  }, [user, isLoadingAuth, setLocation]);

  const { data: paths = [], isLoading: pathsLoading } = useQuery<CurriculumPath[]>({
    queryKey: ["/api/curriculum/paths"],
    enabled: !!user && hasTeacherAccess(user.role),
  });

  const { data: stats } = useQuery<{ pathCount: number; unitCount: number; lessonCount: number; languageCount: number }>({
    queryKey: ["/api/curriculum/stats"],
    enabled: !!user && hasTeacherAccess(user.role),
  });

  const { data: syllabi = [] } = useQuery<SubjectSyllabus[]>({
    queryKey: ["/api/syllabi"],
    enabled: !!user && hasTeacherAccess(user.role),
  });

  const { data: teacherClasses = [] } = useQuery<TeacherClass[]>({
    queryKey: ["/api/teacher/classes"],
    enabled: !!user && hasTeacherAccess(user.role),
  });

  const existingAcademicSubjects = new Set(
    teacherClasses
      .filter(c => c.isAcademicClass && c.subjectSyllabusId)
      .map(c => c.subjectSyllabusId!)
  );

  const createClassMutation = useMutation({
    mutationFn: async (data: CreateClassFormValues) => {
      return apiRequest("POST", "/api/teacher/classes", data);
    },
    onSuccess: (newClass: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes"] });
      setCreateDialogOpen(false);
      form.reset();
      setSelectedCurriculum(null);
      toast({ title: "Class Created", description: "Your new class is ready for students to join." });
      if (newClass?.id) setLocation(`/teacher/classes/${newClass.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create class", variant: "destructive" });
    },
  });

  const createAcademicClassMutation = useMutation({
    mutationFn: async (data: CreateAcademicClassFormValues) => {
      return apiRequest("POST", "/api/teacher/classes", {
        ...data,
        isAcademicClass: true,
      });
    },
    onSuccess: (newClass: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/syllabi"] });
      setCreateAcademicDialogOpen(false);
      academicForm.reset();
      toast({ title: "Academic Class Created", description: "Your class is ready for students to join." });
      if (newClass?.id) setLocation(`/teacher/classes/${newClass.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create class", variant: "destructive" });
    },
  });

  if (isLoadingAuth || !user || !hasTeacherAccess(user.role)) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const languages = [
    { value: "all", label: "All Languages" },
    { value: "spanish", label: "Spanish" },
    { value: "french", label: "French" },
    { value: "german", label: "German" },
    { value: "italian", label: "Italian" },
    { value: "portuguese", label: "Portuguese" },
    { value: "japanese", label: "Japanese" },
    { value: "mandarin", label: "Mandarin Chinese" },
    { value: "korean", label: "Korean" },
    { value: "english", label: "English" },
    { value: "hebrew", label: "Hebrew" },
  ];

  const getActflLabel = (level: string) => {
    const labels: Record<string, string> = {
      novice_low: "Novice Low", novice_mid: "Novice Mid", novice_high: "Novice High",
      intermediate_low: "Intermediate Low", intermediate_mid: "Intermediate Mid", intermediate_high: "Intermediate High",
      advanced_low: "Advanced Low", advanced_mid: "Advanced Mid", advanced_high: "Advanced High",
    };
    return labels[level] || level;
  };

  const filteredPaths = paths.filter(p => {
    const matchesLanguage = selectedLanguage === "all" || p.language === selectedLanguage;
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLanguage && matchesSearch;
  });

  const groupedByLanguage = filteredPaths.reduce((acc, path) => {
    const lang = path.language;
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(path);
    return acc;
  }, {} as Record<string, CurriculumPath[]>);

  const openCreateDialog = (syllabus?: CurriculumPath) => {
    if (syllabus) {
      setSelectedCurriculum(syllabus);
      form.reset({ name: `${syllabus.name} Class`, description: syllabus.description || "", language: syllabus.language, curriculumPathId: syllabus.id });
    } else {
      setSelectedCurriculum(null);
      form.reset({ name: "", description: "", language: "", curriculumPathId: undefined });
    }
    setCreateDialogOpen(true);
  };

  const handleCreateClass = (values: CreateClassFormValues) => {
    createClassMutation.mutate(values);
  };

  const handleCreateAcademicClass = (values: CreateAcademicClassFormValues) => {
    createAcademicClassMutation.mutate(values);
  };

  const getSubjectLabel = (subject: string) => {
    const labels: Record<string, string> = {
      biology: "Biology",
      history: "US History",
      chemistry: "Chemistry",
      physics: "Physics",
      math: "Mathematics",
    };
    return labels[subject] || subject.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const SUBJECT_CATEGORY_ORDER: { key: string; label: string }[] = [
    { key: "Natural Sciences", label: "Natural Sciences" },
    { key: "Mathematics", label: "Mathematics" },
    { key: "Social Sciences & Humanities", label: "Social Sciences & Humanities" },
    { key: "Business", label: "Business" },
  ];

  const SUBJECT_TO_CATEGORY: Record<string, string> = {
    biology: "Natural Sciences",
    microbiology: "Natural Sciences",
    "anatomy-physiology": "Natural Sciences",
    chemistry: "Natural Sciences",
    "university-physics-vol1": "Natural Sciences",
    "university-physics-vol2": "Natural Sciences",
    "university-physics-vol3": "Natural Sciences",
    "college-physics": "Natural Sciences",
    astronomy: "Natural Sciences",
    nutrition: "Natural Sciences",
    prealgebra: "Mathematics",
    "elementary-algebra": "Mathematics",
    "college-algebra": "Mathematics",
    precalculus: "Mathematics",
    "calculus-vol1": "Mathematics",
    "calculus-vol2": "Mathematics",
    "calculus-vol3": "Mathematics",
    statistics: "Mathematics",
    "contemporary-math": "Mathematics",
    history: "Social Sciences & Humanities",
    "world-history-vol1": "Social Sciences & Humanities",
    "world-history-vol2": "Social Sciences & Humanities",
    "american-government": "Social Sciences & Humanities",
    "introduction-sociology": "Social Sciences & Humanities",
    psychology: "Social Sciences & Humanities",
    macroeconomics: "Social Sciences & Humanities",
    microeconomics: "Social Sciences & Humanities",
    philosophy: "Social Sciences & Humanities",
    "principles-management": "Business",
    "principles-accounting-vol1": "Business",
    "principles-finance": "Business",
    entrepreneurship: "Business",
    "business-ethics": "Business",
  };

  const syllabByCategory = SUBJECT_CATEGORY_ORDER.map(cat => ({
    ...cat,
    items: syllabi.filter(s => (SUBJECT_TO_CATEGORY[s.subject] ?? "Other") === cat.key),
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Class Creation Hub</h1>
          <p className="text-muted-foreground mt-1">
            Create a new class for your students
          </p>
        </div>

        {/* Three Creation Paths */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            className="hover-elevate cursor-pointer border-2 border-transparent hover:border-primary/20 transition-colors"
            onClick={() => document.getElementById('syllabus-section')?.scrollIntoView({ behavior: 'smooth' })}
            data-testid="card-start-from-syllabus"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Library className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Language Class</CardTitle>
                  <CardDescription>ACTFL-aligned language syllabi</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate cursor-default">{stats?.pathCount ?? "—"} Syllabi</Badge>
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate cursor-default">{stats?.languageCount ?? "—"} Languages</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Browse ready-to-use syllabus templates with units, lessons, and activities aligned to ACTFL proficiency standards.
              </p>
              <div className="flex items-center text-sm text-primary font-medium">
                Browse templates below
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="hover-elevate cursor-pointer border-2 border-transparent hover:border-emerald-500/20 transition-colors"
            onClick={() => setCreateAcademicDialogOpen(true)}
            data-testid="card-start-from-openstax"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <Microscope className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Academic Subject</CardTitle>
                  <CardDescription>OpenStax textbook curricula</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate cursor-default">{syllabi.length} Textbooks</Badge>
                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate cursor-default">Open Access</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Create a Biology, History, or other academic subject class using OpenStax open-access textbooks with dual-perspective content.
              </p>
              <div className="flex items-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                Select a textbook
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="hover-elevate cursor-pointer border-2 border-transparent hover:border-orange-500/20 transition-colors"
            onClick={() => openCreateDialog()}
            data-testid="card-start-from-scratch"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <PenTool className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Start from Scratch</CardTitle>
                  <CardDescription>Build your own custom syllabus</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate cursor-default">Custom</Badge>
                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate cursor-default">Flexible</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Create a blank class and design your own syllabus. Add custom units and lessons, or mix in content from our library later.
              </p>
              <div className="flex items-center text-sm text-orange-600 dark:text-orange-400 font-medium">
                Create blank class
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Divider */}
        <div className="relative" id="syllabus-section">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-4 text-muted-foreground font-medium">
              Browse Language Syllabus Templates
            </span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search syllabus templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-syllabus"
            />
          </div>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-language-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map(lang => (
                <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Syllabus Browser */}
        <Tabs defaultValue="browse" className="w-full">
          <TabsList>
            <TabsTrigger value="browse" data-testid="tab-browse-syllabus">
              <FolderOpen className="w-4 h-4 mr-2" />
              Browse All
            </TabsTrigger>
            <TabsTrigger value="by-language" data-testid="tab-by-language">
              <Layers className="w-4 h-4 mr-2" />
              By Language
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="mt-6">
            {pathsLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-4 bg-muted rounded w-full" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : filteredPaths.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No syllabus templates found</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion
                type="single"
                collapsible
                value={expandedPath || undefined}
                onValueChange={(value) => setExpandedPath(value || null)}
                className="space-y-3"
              >
                {filteredPaths.map(path => (
                  <AccordionItem
                    key={path.id}
                    value={path.id}
                    className="border rounded-lg px-4 bg-card"
                    data-testid={`accordion-path-${path.id}`}
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-start justify-between w-full pr-4">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-left">{path.name}</span>
                            <Badge variant="outline" className="capitalize text-xs">{path.language}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground text-left line-clamp-1">{path.description}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{path.estimatedHours}h</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            <span>{getActflLabel(path.startLevel)} → {getActflLabel(path.endLevel)}</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <SyllabusTemplateDetails path={path} onCreateClass={() => openCreateDialog(path)} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          <TabsContent value="by-language" className="mt-6">
            <div className="space-y-8">
              {Object.entries(groupedByLanguage).sort().map(([language, langPaths]) => (
                <div key={language}>
                  <h3 className="text-lg font-semibold capitalize mb-4 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    {language}
                    <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate cursor-default">
                      {langPaths.length} {langPaths.length === 1 ? 'syllabus' : 'syllabi'}
                    </Badge>
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {langPaths.map(path => (
                      <Card
                        key={path.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => setExpandedPath(path.id)}
                        data-testid={`card-path-${path.id}`}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{path.name}</CardTitle>
                          <CardDescription className="line-clamp-2 text-xs">{path.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{path.estimatedHours} hours</span>
                            <span>{getActflLabel(path.startLevel)}</span>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-3"
                            onClick={(e) => { e.stopPropagation(); openCreateDialog(path); }}
                            data-testid={`button-create-from-${path.id}`}
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Create Class
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Language Class Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedCurriculum ? "Create Class from Template" : "Create New Language Class"}
              </DialogTitle>
              <DialogDescription>
                {selectedCurriculum
                  ? `Using the "${selectedCurriculum.name}" syllabus`
                  : "Create a blank class and build your own syllabus"
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateClass)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Spanish 101 - Period 3" data-testid="input-class-name" {...field} />
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
                        <Textarea placeholder="Brief description of your class" data-testid="input-class-description" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!selectedCurriculum}>
                        <FormControl>
                          <SelectTrigger data-testid="select-class-language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {languages.filter(l => l.value !== "all").map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedCurriculum && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="font-medium mb-1">Syllabus Template:</p>
                    <p className="text-muted-foreground">{selectedCurriculum.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedCurriculum.estimatedHours} hours • {getActflLabel(selectedCurriculum.startLevel)} to {getActflLabel(selectedCurriculum.endLevel)}
                    </p>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createClassMutation.isPending} data-testid="button-confirm-create-class">
                    {createClassMutation.isPending ? "Creating..." : "Create Class"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Academic Class Create Dialog */}
        <Dialog open={createAcademicDialogOpen} onOpenChange={setCreateAcademicDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Academic Subject Class</DialogTitle>
              <DialogDescription>
                Select an OpenStax textbook to base your class on. Students will have access to the full reading library with dual-perspective content.
              </DialogDescription>
            </DialogHeader>
            <Form {...academicForm}>
              <form onSubmit={academicForm.handleSubmit(handleCreateAcademicClass)} className="space-y-4">
                <FormField
                  control={academicForm.control}
                  name="subjectSyllabusId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OpenStax Textbook</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val);
                        const syllabus = syllabi.find(s => s.subject === val);
                        if (syllabus) {
                          const autoName = [syllabus.bookTitle, syllabus.bookSubtitle].filter(Boolean).join(" ");
                          academicForm.setValue("name", autoName || getSubjectLabel(syllabus.subject));
                          if (syllabus.description) {
                            academicForm.setValue("description", syllabus.description);
                          }
                        }
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-academic-subject">
                            <SelectValue placeholder="Choose a textbook..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-72">
                          {syllabByCategory.map(cat => (
                            <SelectGroup key={cat.key}>
                              <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
                                {cat.label}
                              </SelectLabel>
                              {cat.items.map(s => {
                                const alreadyCreated = existingAcademicSubjects.has(s.subject);
                                return (
                                  <SelectItem key={s.subject} value={s.subject} data-testid={`option-academic-${s.subject}`}>
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <div className="flex flex-col">
                                        <span>{s.bookTitle || getSubjectLabel(s.subject)}</span>
                                        {s.bookSubtitle && (
                                          <span className="text-xs text-muted-foreground">{s.bookSubtitle}</span>
                                        )}
                                      </div>
                                      {alreadyCreated && (
                                        <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate cursor-default text-xs shrink-0">
                                          Created
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {academicForm.watch("subjectSyllabusId") && (() => {
                  const selected = syllabi.find(s => s.subject === academicForm.watch("subjectSyllabusId"));
                  if (!selected) return null;
                  const unitCount = (selected as any).unitCount ?? 0;
                  const chapterCount = 0;
                  return (
                    <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                      {selected.description && <p className="text-muted-foreground">{selected.description}</p>}
                      <div className="flex gap-3 mt-2">
                        {unitCount > 0 && <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate cursor-default">{unitCount} Units</Badge>}
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate cursor-default">{selected.source}</Badge>
                      </div>
                    </div>
                  );
                })()}
                <FormField
                  control={academicForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Biology 101 - Period 2" data-testid="input-academic-class-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={academicForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief description of your class" data-testid="input-academic-class-description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateAcademicDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createAcademicClassMutation.isPending} data-testid="button-confirm-create-academic-class">
                    {createAcademicClassMutation.isPending ? "Creating..." : "Create Class"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function SyllabusTemplateDetails({ path, onCreateClass }: { path: CurriculumPath; onCreateClass: () => void }) {
  const { data: units = [], isLoading: unitsLoading } = useQuery<CurriculumUnit[]>({
    queryKey: ["/api/curriculum/paths", path.id, "units"],
  });

  const getActflLabel = (level: string) => {
    const labels: Record<string, string> = {
      novice_low: "Novice Low", novice_mid: "Novice Mid", novice_high: "Novice High",
      intermediate_low: "Intermediate Low", intermediate_mid: "Intermediate Mid", intermediate_high: "Intermediate High",
      advanced_low: "Advanced Low", advanced_mid: "Advanced Mid", advanced_high: "Advanced High",
    };
    return labels[level] || level;
  };

  return (
    <div className="pb-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Duration</p>
          <p className="text-sm font-medium">{path.estimatedHours} hours</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Start Level</p>
          <p className="text-sm font-medium">{getActflLabel(path.startLevel)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">End Level</p>
          <p className="text-sm font-medium">{getActflLabel(path.endLevel)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Audience</p>
          <p className="text-sm font-medium">{path.targetAudience || "All Levels"}</p>
        </div>
      </div>

      <ActflIndicators curriculumPathId={path.id} language={path.language} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Units & Lessons
          </h4>
          <Button onClick={onCreateClass} data-testid={`button-create-class-from-${path.id}`}>
            <Sparkles className="w-4 h-4 mr-2" />
            Create Class from This
          </Button>
        </div>

        {unitsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
          </div>
        ) : units.length === 0 ? (
          <p className="text-sm text-muted-foreground">No units defined yet</p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <Accordion type="multiple" className="space-y-2">
              {units.map((unit, index) => (
                <AccordionItem key={unit.id} value={unit.id} className="border rounded-lg px-3 bg-background">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 text-left">
                      <Badge variant="secondary" className="shrink-0">{index + 1}</Badge>
                      <div>
                        <p className="font-medium text-sm">{unit.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {unit.estimatedHours}h • {unit.actflLevel && getActflLabel(unit.actflLevel)}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-10 pb-2">
                      {unit.description && <p className="text-sm text-muted-foreground mb-3">{unit.description}</p>}
                      {unit.culturalTheme && (
                        <p className="text-sm mb-3"><span className="font-medium">Cultural Theme:</span> {unit.culturalTheme}</p>
                      )}
                      <UnitLessons unitId={unit.id} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function UnitLessons({ unitId }: { unitId: string }) {
  const { data: lessons = [], isLoading } = useQuery<CurriculumLesson[]>({
    queryKey: ["/api/curriculum/units", unitId, "lessons"],
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading lessons...</div>;
  if (lessons.length === 0) return <div className="text-sm text-muted-foreground">No lessons defined</div>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lessons</p>
      {lessons.map((lesson, index) => (
        <div key={lesson.id} className="flex items-start gap-3 p-2 rounded-md bg-muted/50" data-testid={`lesson-${lesson.id}`}>
          <span className="text-xs font-medium text-muted-foreground mt-0.5 w-5">{index + 1}.</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{lesson.name}</p>
            {lesson.description && <p className="text-xs text-muted-foreground line-clamp-2">{lesson.description}</p>}
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs capitalize">{lesson.lessonType.replace(/_/g, " ")}</Badge>
              {lesson.estimatedMinutes && (
                <Badge variant="secondary" className="text-xs">{lesson.estimatedMinutes} min</Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
