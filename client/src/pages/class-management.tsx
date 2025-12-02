import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Plus, Trash2, Users, ClipboardList, BookOpen, UserMinus, Sparkles, AlertCircle, CheckCircle, TrendingDown, TrendingUp, Layers, Pencil, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useParams, Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { TeacherEarlyCompletions } from "@/components/teacher-early-completions";
import { hasTeacherAccess } from "@shared/permissions";
import { SyllabusBuilder } from "@/components/SyllabusBuilder";

const cloneClassFormSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  description: z.string().optional(),
});

type CloneClassFormValues = z.infer<typeof cloneClassFormSchema>;

const editStudentFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

type EditStudentFormValues = z.infer<typeof editStudentFormSchema>;

interface TeacherClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  joinCode: string;
  isActive: boolean;
  curriculumPathId: string | null;
  createdAt: Date;
}

interface ClassEnrollment {
  id: string;
  classId: string;
  userId: string;
  enrolledAt: Date;
  isActive: boolean;
  placementChecked: boolean | null;
  placementActflResult: string | null;
  placementDelta: number | null;
  placementDate: Date | null;
  user?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    actflLevel: string | null;
    actflAssessed: boolean | null;
  };
}

interface Assignment {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  isPublished: boolean;
  createdAt: Date;
}

export default function ClassManagement() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { classId } = useParams();
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<ClassEnrollment | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const cloneForm = useForm<CloneClassFormValues>({
    resolver: zodResolver(cloneClassFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const editStudentForm = useForm<EditStudentFormValues>({
    resolver: zodResolver(editStudentFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
    },
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

  const { data: classData, isLoading: isLoadingClass } = useQuery<TeacherClass>({
    queryKey: ["/api/teacher/classes", classId],
    enabled: !!classId,
  });

  const { data: enrollments, isLoading: isLoadingEnrollments } = useQuery<ClassEnrollment[]>({
    queryKey: ["/api/teacher/classes", classId, "students"],
    enabled: !!classId,
  });

  const { data: assignments, isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
    queryKey: ["/api/classes", classId, "assignments"],
    enabled: !!classId,
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return apiRequest("DELETE", `/api/teacher/classes/${classId}/students/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes", classId, "students"] });
      toast({
        title: "Student Removed",
        description: "The student has been removed from this class.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove student",
        variant: "destructive",
      });
    },
  });

  const handleCopyJoinCode = () => {
    if (classData?.joinCode) {
      navigator.clipboard.writeText(classData.joinCode);
      setCopiedCode(true);
      toast({
        title: "Join Code Copied",
        description: "Students can use this code to join your class.",
      });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const cloneClassMutation = useMutation({
    mutationFn: async (data: CloneClassFormValues) => {
      return apiRequest("POST", `/api/teacher/classes/${classId}/clone`, data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes"] });
      setCloneDialogOpen(false);
      cloneForm.reset();
      toast({
        title: "Class Cloned",
        description: "A new class has been created based on this one.",
      });
      if (response?.id) {
        setLocation(`/teacher/classes/${response.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clone class",
        variant: "destructive",
      });
    },
  });

  const openCloneDialog = () => {
    if (classData) {
      cloneForm.reset({
        name: `${classData.name} (Copy)`,
        description: classData.description || "",
      });
      setCloneDialogOpen(true);
    }
  };

  const handleCloneClass = (values: CloneClassFormValues) => {
    cloneClassMutation.mutate(values);
  };

  const editStudentMutation = useMutation({
    mutationFn: async ({ studentId, data }: { studentId: string; data: EditStudentFormValues }) => {
      return apiRequest("PATCH", `/api/teacher/classes/${classId}/students/${studentId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes", classId, "students"] });
      setEditDialogOpen(false);
      setEditingStudent(null);
      editStudentForm.reset();
      toast({
        title: "Student Updated",
        description: "Student details have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update student",
        variant: "destructive",
      });
    },
  });

  const resetStudentProgressMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return apiRequest("POST", `/api/teacher/classes/${classId}/students/${studentId}/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes", classId, "students"] });
      toast({
        title: "Progress Reset",
        description: "Student's progress for this class has been reset.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset student progress",
        variant: "destructive",
      });
    },
  });

  const openEditStudentDialog = (enrollment: ClassEnrollment) => {
    setEditingStudent(enrollment);
    editStudentForm.reset({
      firstName: enrollment.user?.firstName || "",
      lastName: enrollment.user?.lastName || "",
      email: enrollment.user?.email || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditStudent = (values: EditStudentFormValues) => {
    if (editingStudent) {
      editStudentMutation.mutate({
        studentId: editingStudent.userId,
        data: values,
      });
    }
  };

  if (isLoadingClass) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <Card className="p-12">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Class Not Found</h3>
          <p className="text-muted-foreground">The class you're looking for doesn't exist.</p>
          <Link href="/teacher/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const activeEnrollments = enrollments?.filter(e => e.isActive) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-class-name">{classData.name}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            {classData.language.charAt(0).toUpperCase() + classData.language.slice(1)} • {activeEnrollments.length} students
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={openCloneDialog}
            data-testid="button-clone-class"
          >
            <Copy className="w-4 h-4 mr-2" />
            Clone Class
          </Button>
          <Badge variant={classData.isActive ? "default" : "secondary"}>
            {classData.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      {/* Clone Class Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Class</DialogTitle>
            <DialogDescription>
              Create a new class based on "{classData.name}". The new class will have the same settings but no students.
            </DialogDescription>
          </DialogHeader>
          <Form {...cloneForm}>
            <form onSubmit={cloneForm.handleSubmit(handleCloneClass)} className="space-y-4">
              <FormField
                control={cloneForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Class Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Spanish 101 - Period 4"
                        data-testid="input-clone-class-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cloneForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A copy of the class for a different period"
                        data-testid="input-clone-class-description"
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
                  onClick={() => setCloneDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={cloneClassMutation.isPending}
                  data-testid="button-confirm-clone-class"
                >
                  {cloneClassMutation.isPending ? "Cloning..." : "Clone Class"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {classData.description && (
        <p className="text-muted-foreground">{classData.description}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-student-count">{activeEnrollments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-assignment-count">{assignments?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Join Code</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="text-2xl font-bold font-mono" data-testid="text-join-code">{classData.joinCode}</code>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCopyJoinCode}
                data-testid="button-copy-join-code"
              >
                <Copy className={`h-4 w-4 ${copiedCode ? 'text-green-500' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="students" className="space-y-6">
        <TabsList>
          <TabsTrigger value="students" data-testid="tab-students">Students</TabsTrigger>
          <TabsTrigger value="syllabus" data-testid="tab-syllabus" className="gap-1">
            <Layers className="h-4 w-4" />
            Syllabus
          </TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress" className="gap-1">
            <Sparkles className="h-4 w-4" />
            Organic Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Class Roster</h2>
          </div>

          {isLoadingEnrollments ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="h-10 w-10 bg-muted rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeEnrollments.length > 0 ? (
            <TooltipProvider>
              <div className="space-y-4">
                {activeEnrollments.map((enrollment) => {
                  const student = enrollment.user;
                  const displayName = student?.firstName && student?.lastName
                    ? `${student.firstName} ${student.lastName}`
                    : student?.firstName || student?.email || "Unknown Student";
                  const initials = student?.firstName && student?.lastName
                    ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
                    : student?.firstName?.[0]?.toUpperCase() || student?.email?.[0]?.toUpperCase() || "?";
                  
                  const formatActflLevel = (level: string | null | undefined) => {
                    if (!level) return 'Not assessed';
                    return level.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  };
                  
                  const getPlacementBadge = () => {
                    if (!enrollment.placementChecked) {
                      return { variant: 'outline' as const, label: 'Awaiting Placement', Icon: AlertCircle };
                    }
                    if (enrollment.placementDelta === null || enrollment.placementDelta === 0) {
                      return { variant: 'secondary' as const, label: 'Level Verified', Icon: CheckCircle };
                    }
                    if (enrollment.placementDelta > 0) {
                      return { variant: 'destructive' as const, label: `Overestimated by ${enrollment.placementDelta}`, Icon: TrendingDown };
                    }
                    return { variant: 'default' as const, label: `Underestimated by ${Math.abs(enrollment.placementDelta)}`, Icon: TrendingUp };
                  };
                  
                  const placementBadge = getPlacementBadge();

                  return (
                    <Card key={enrollment.id} data-testid={`card-student-${enrollment.userId}`}>
                      <CardContent className="flex items-center justify-between p-6">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-2">
                            <p className="font-medium" data-testid={`text-student-name-${enrollment.userId}`}>{displayName}</p>
                            {student?.email && (
                              <p className="text-sm text-muted-foreground">{student.email}</p>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant={placementBadge.variant} 
                                  className="cursor-help"
                                  data-testid={`badge-placement-${enrollment.userId}`}
                                >
                                  <placementBadge.Icon className="h-3 w-3 mr-1" />
                                  {placementBadge.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p>ACTFL Level: {formatActflLevel(student?.actflLevel)}</p>
                                  {enrollment.placementActflResult && (
                                    <p>Placement Result: {formatActflLevel(enrollment.placementActflResult)}</p>
                                  )}
                                  {student?.actflAssessed && (
                                    <p className="text-primary">AI Verified</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditStudentDialog(enrollment)}
                                data-testid={`button-edit-student-${enrollment.userId}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit student details</TooltipContent>
                          </Tooltip>
                          
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    data-testid={`button-reset-student-${enrollment.userId}`}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Reset progress</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reset Student Progress</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to reset {displayName}'s progress for this class? This will delete their conversations, vocabulary, assignment submissions, and placement data for this class only.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => resetStudentProgressMutation.mutate(enrollment.userId)}
                                  data-testid={`button-confirm-reset-${enrollment.userId}`}
                                >
                                  Reset Progress
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    data-testid={`button-remove-student-${enrollment.userId}`}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Remove from class</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {displayName} from this class? They will lose access to all assignments and course materials.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeStudentMutation.mutate(enrollment.userId)}
                                  data-testid={`button-confirm-remove-${enrollment.userId}`}
                                >
                                  Remove Student
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            </TooltipProvider>
          ) : (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-muted rounded-full">
                    <Users className="w-12 h-12 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No Students Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Share the join code <code className="px-2 py-1 bg-muted rounded text-sm font-mono">{classData.joinCode}</code> with your students so they can join this class.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Assignments</h2>
            <Link href={`/teacher/assignments/new?classId=${classId}`}>
              <Button data-testid="button-create-assignment">
                <Plus className="w-4 h-4 mr-2" />
                Create Assignment
              </Button>
            </Link>
          </div>

          {isLoadingAssignments ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : assignments && assignments.length > 0 ? (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <Link key={assignment.id} href={`/teacher/assignments/${assignment.id}/grade`}>
                  <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-assignment-${assignment.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{assignment.title}</CardTitle>
                        <Badge variant={assignment.isPublished ? "default" : "secondary"}>
                          {assignment.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <CardDescription>
                        {assignment.dueDate
                          ? `Due: ${new Date(assignment.dueDate).toLocaleDateString()}`
                          : "No due date"}
                      </CardDescription>
                    </CardHeader>
                    {assignment.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {assignment.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-muted rounded-full">
                    <ClipboardList className="w-12 h-12 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No Assignments Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Create your first assignment to give students practice activities.
                  </p>
                </div>
                <Link href={`/teacher/assignments/new?classId=${classId}`}>
                  <Button data-testid="button-create-first-assignment">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Assignment
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="syllabus">
          <SyllabusBuilder classId={classId || ''} />
        </TabsContent>

        <TabsContent value="progress">
          <TeacherEarlyCompletions classId={classId || ''} />
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update the student's name and email address.
            </DialogDescription>
          </DialogHeader>
          <Form {...editStudentForm}>
            <form onSubmit={editStudentForm.handleSubmit(handleEditStudent)} className="space-y-4">
              <FormField
                control={editStudentForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="First name"
                        data-testid="input-edit-student-firstname"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStudentForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Last name"
                        data-testid="input-edit-student-lastname"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStudentForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="student@example.com"
                        data-testid="input-edit-student-email"
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
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editStudentMutation.isPending}
                  data-testid="button-save-student"
                >
                  {editStudentMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
