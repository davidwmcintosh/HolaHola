import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Clock, Target, GraduationCap, Plus, ArrowRight } from "lucide-react";
import type { CurriculumPath, CurriculumUnit, CurriculumLesson } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { hasTeacherAccess } from "@shared/permissions";

export default function CurriculumLibrary() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedPath, setSelectedPath] = useState<CurriculumPath | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Protect teacher-only route
  useEffect(() => {
    if (!isLoadingAuth && (!user || !hasTeacherAccess(user.role))) {
      setLocation("/");
    }
  }, [user, isLoadingAuth, setLocation]);

  if (isLoadingAuth || !user || !hasTeacherAccess(user.role)) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  // Fetch curriculum paths
  const { data: paths = [], isLoading: pathsLoading } = useQuery<CurriculumPath[]>({
    queryKey: ["/api/curriculum/paths", selectedLanguage === "all" ? undefined : selectedLanguage],
    enabled: true,
  });

  // Fetch teacher classes for assignment
  const { data: teacherClasses = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher/classes"],
  });

  // Fetch units for selected path
  const { data: units = [] } = useQuery<CurriculumUnit[]>({
    queryKey: ["/api/curriculum/paths", selectedPath?.id, "units"],
    enabled: !!selectedPath,
  });

  const languages = [
    { value: "all", label: "All Languages" },
    { value: "spanish", label: "Spanish" },
    { value: "french", label: "French" },
    { value: "german", label: "German" },
    { value: "italian", label: "Italian" },
    { value: "portuguese", label: "Portuguese" },
    { value: "japanese", label: "Japanese" },
    { value: "mandarin chinese", label: "Mandarin Chinese" },
    { value: "korean", label: "Korean" },
    { value: "hebrew", label: "Hebrew" },
  ];

  const getActflLabel = (level: string) => {
    const labels: Record<string, string> = {
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
    return labels[level] || level;
  };

  const filteredPaths = selectedLanguage === "all"
    ? paths
    : paths.filter(p => p.language === selectedLanguage);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Syllabus Library</h1>
            <p className="text-muted-foreground mt-1">
              Browse and assign pre-built, standards-aligned syllabi
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation("/teacher/curriculum/builder")}
            data-testid="button-create-custom"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Custom
          </Button>
        </div>

        {/* Language Filter */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Filter by Language:</label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-60" data-testid="select-language-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map(lang => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" data-testid="badge-path-count">
            {filteredPaths.length} {filteredPaths.length === 1 ? "Path" : "Paths"}
          </Badge>
        </div>

        {/* Curriculum Paths Grid */}
        {pathsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-full" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPaths.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No curriculum paths found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try selecting a different language
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPaths.map(path => (
              <Card
                key={path.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedPath(path)}
                data-testid={`card-curriculum-path-${path.id}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2">
                    <span className="flex-1">{path.name}</span>
                    <Badge variant="outline" className="capitalize">
                      {path.language}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {path.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="w-4 h-4" />
                    <span>
                      {getActflLabel(path.startLevel)} → {getActflLabel(path.endLevel)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{path.estimatedHours} hours</span>
                  </div>
                  {path.targetAudience && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="w-4 h-4" />
                      <span>{path.targetAudience}</span>
                    </div>
                  )}
                  <Button
                    className="w-full mt-4"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPath(path);
                    }}
                    data-testid={`button-view-details-${path.id}`}
                  >
                    View Details
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Path Details Dialog */}
        <Dialog open={!!selectedPath} onOpenChange={(open) => !open && setSelectedPath(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span data-testid="text-dialog-path-title">{selectedPath?.name}</span>
                <Badge variant="outline" className="capitalize">
                  {selectedPath?.language}
                </Badge>
              </DialogTitle>
              <DialogDescription>{selectedPath?.description}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Path Metadata */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Proficiency Range</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPath && getActflLabel(selectedPath.startLevel)} → {selectedPath && getActflLabel(selectedPath.endLevel)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Duration</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPath?.estimatedHours} hours
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Target Audience</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPath?.targetAudience || "All Levels"}
                  </p>
                </div>
              </div>

              {/* Units & Lessons */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Units & Lessons</h3>
                <ScrollArea className="h-[300px] pr-4">
                  <Accordion type="single" collapsible className="space-y-2">
                    {units.map((unit, index) => (
                      <AccordionItem
                        key={unit.id}
                        value={unit.id}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger data-testid={`button-toggle-unit-${unit.id}`}>
                          <div className="flex items-center gap-3 text-left">
                            <Badge variant="secondary">{index + 1}</Badge>
                            <div>
                              <p className="font-medium">{unit.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {unit.estimatedHours} hours · {unit.actflLevel && getActflLabel(unit.actflLevel)}
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-12 space-y-2">
                            <p className="text-sm text-muted-foreground mb-3">
                              {unit.description}
                            </p>
                            {unit.culturalTheme && (
                              <p className="text-sm">
                                <span className="font-medium">Cultural Theme:</span> {unit.culturalTheme}
                              </p>
                            )}
                            <UnitLessons unitId={unit.id} />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </div>

              {/* Assign to Class */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Assign to Class</h3>
                <div className="flex gap-3">
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="flex-1" data-testid="select-assign-class">
                      <SelectValue placeholder="Select a class..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teacherClasses.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} ({cls.language})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={!selectedClassId || !selectedPath}
                    onClick={() => {
                      if (selectedPath && selectedClassId) {
                        setLocation(`/teacher/assignments/create?classId=${selectedClassId}&curriculumPathId=${selectedPath.id}`);
                      }
                    }}
                    data-testid="button-assign-curriculum"
                  >
                    Create Assignment
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Create an assignment based on this curriculum path for your class
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Lessons component for a unit
function UnitLessons({ unitId }: { unitId: string }) {
  const { data: lessons = [], isLoading } = useQuery<CurriculumLesson[]>({
    queryKey: ["/api/curriculum/units", unitId, "lessons"],
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading lessons...</div>;
  }

  if (lessons.length === 0) {
    return <div className="text-sm text-muted-foreground">No lessons yet</div>;
  }

  return (
    <div className="space-y-2 mt-3">
      <p className="text-sm font-medium">Lessons:</p>
      {lessons.map((lesson, index) => (
        <div
          key={lesson.id}
          className="flex items-start gap-3 p-2 rounded-md bg-muted/50"
          data-testid={`lesson-item-${lesson.id}`}
        >
          <span className="text-xs font-medium text-muted-foreground mt-0.5">
            {index + 1}.
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">{lesson.name}</p>
            <p className="text-xs text-muted-foreground">{lesson.description}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs capitalize">
                {lesson.lessonType.replace(/_/g, " ")}
              </Badge>
              {lesson.estimatedMinutes && (
                <Badge variant="secondary" className="text-xs">
                  {lesson.estimatedMinutes} min
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
