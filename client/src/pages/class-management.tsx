import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Copy, Plus, Trash2, Users, ClipboardList, BookOpen, UserMinus } from "lucide-react";
import { useParams, Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

interface TeacherClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  joinCode: string;
  isActive: boolean;
  createdAt: Date;
}

interface ClassEnrollment {
  id: string;
  classId: string;
  userId: string;
  enrolledAt: Date;
  isActive: boolean;
  user?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
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

  // Protect teacher-only route
  useEffect(() => {
    if (!isLoadingAuth && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
      setLocation("/");
    }
  }, [user, isLoadingAuth, setLocation]);

  if (isLoadingAuth || !user || (user.role !== 'teacher' && user.role !== 'admin')) {
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
          <h1 className="text-4xl font-bold" data-testid="text-class-name">{classData.name}</h1>
          <p className="text-muted-foreground mt-2">
            {classData.language.charAt(0).toUpperCase() + classData.language.slice(1)} • {activeEnrollments.length} students
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={classData.isActive ? "default" : "secondary"}>
            {classData.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

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
          <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
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
            <div className="space-y-4">
              {activeEnrollments.map((enrollment) => {
                const student = enrollment.user;
                const displayName = student?.firstName && student?.lastName
                  ? `${student.firstName} ${student.lastName}`
                  : student?.firstName || student?.email || "Unknown Student";
                const initials = student?.firstName && student?.lastName
                  ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
                  : student?.firstName?.[0]?.toUpperCase() || student?.email?.[0]?.toUpperCase() || "?";

                return (
                  <Card key={enrollment.id} data-testid={`card-student-${enrollment.userId}`}>
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium" data-testid={`text-student-name-${enrollment.userId}`}>{displayName}</p>
                          {student?.email && (
                            <p className="text-sm text-muted-foreground">{student.email}</p>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-remove-student-${enrollment.userId}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
      </Tabs>
    </div>
  );
}
