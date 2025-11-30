import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Clock, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { hasTeacherAccess } from "@shared/permissions";

interface Assignment {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  dueDate: Date | null;
  maxScore: number;
  isPublished: boolean;
}

interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string | null;
  attachments: string[] | null;
  status: string;
  teacherScore: number | null;
  teacherFeedback: string | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
  student?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

const gradeFormSchema = z.object({
  score: z.coerce.number().nonnegative("Score must be positive"),
  feedback: z.string().max(5000, "Feedback must be less than 5000 characters").optional(),
});

type GradeFormValues = z.infer<typeof gradeFormSchema>;

export default function AssignmentGrading() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { assignmentId } = useParams();
  const { toast } = useToast();
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmission | null>(null);
  
  const gradeForm = useForm<GradeFormValues>({
    resolver: zodResolver(gradeFormSchema),
    defaultValues: {
      score: 0,
      feedback: "",
    },
  });

  const { data: assignment, isLoading: isLoadingAssignment } = useQuery<Assignment>({
    queryKey: ["/api/assignments", assignmentId],
    enabled: !!assignmentId,
  });

  const { data: submissions, isLoading: isLoadingSubmissions } = useQuery<AssignmentSubmission[]>({
    queryKey: ["/api/assignments", assignmentId, "submissions"],
    enabled: !!assignmentId,
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

  const gradeSubmissionMutation = useMutation({
    mutationFn: async (data: { submissionId: string; score: number; feedback: string }) => {
      return apiRequest("PATCH", `/api/submissions/${data.submissionId}/grade`, {
        teacherScore: data.score,
        teacherFeedback: data.feedback,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", assignmentId, "submissions"] });
      setGradingSubmission(null);
      gradeForm.reset();
      toast({
        title: "Submission Graded",
        description: "The grade has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to grade submission",
        variant: "destructive",
      });
    },
  });

  const handleGradeSubmission = (values: GradeFormValues) => {
    if (!gradingSubmission || !assignment) return;

    if (values.score > assignment.maxScore) {
      toast({
        title: "Invalid Score",
        description: `Score must be between 0 and ${assignment.maxScore}`,
        variant: "destructive",
      });
      return;
    }

    gradeSubmissionMutation.mutate({
      submissionId: gradingSubmission.id,
      score: values.score,
      feedback: values.feedback || "",
    });
  };

  const openGradingDialog = (submission: AssignmentSubmission) => {
    setGradingSubmission(submission);
    gradeForm.reset({
      score: submission.teacherScore || 0,
      feedback: submission.teacherFeedback || "",
    });
  };

  if (isLoadingAssignment) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <Card className="p-12">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Assignment Not Found</h3>
          <p className="text-muted-foreground">The assignment you're looking for doesn't exist.</p>
          <Link href="/teacher/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const submittedCount = submissions?.filter(s => s.status === 'submitted' || s.status === 'graded').length || 0;
  const gradedCount = submissions?.filter(s => s.status === 'graded').length || 0;
  const avgScore = submissions && gradedCount > 0
    ? submissions.filter(s => s.teacherScore !== null).reduce((sum, s) => sum + (s.teacherScore || 0), 0) / gradedCount
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/teacher/classes/${assignment.classId}`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-assignment-title">{assignment.title}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            {assignment.dueDate
              ? `Due: ${new Date(assignment.dueDate).toLocaleDateString()}`
              : "No due date"} • Max Score: {assignment.maxScore}
          </p>
        </div>
        <Badge variant={assignment.isPublished ? "default" : "secondary"}>
          {assignment.isPublished ? "Published" : "Draft"}
        </Badge>
      </div>

      {assignment.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{assignment.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-submission-count">{submittedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Graded</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-graded-count">{gradedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-average-score">
              {avgScore !== null ? `${avgScore.toFixed(1)}%` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Student Submissions</h2>

        {isLoadingSubmissions ? (
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
        ) : submissions && submissions.length > 0 ? (
          <div className="space-y-4">
            {submissions.map((submission) => {
              const student = submission.student;
              const displayName = student?.firstName && student?.lastName
                ? `${student.firstName} ${student.lastName}`
                : student?.firstName || student?.email || "Unknown Student";
              const initials = student?.firstName && student?.lastName
                ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
                : student?.firstName?.[0]?.toUpperCase() || student?.email?.[0]?.toUpperCase() || "?";

              return (
                <Card key={submission.id} data-testid={`card-submission-${submission.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <Avatar>
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{displayName}</p>
                            <Badge variant={submission.status === 'graded' ? 'default' : submission.status === 'submitted' ? 'secondary' : 'outline'}>
                              {submission.status}
                            </Badge>
                          </div>
                          {submission.submittedAt && (
                            <p className="text-sm text-muted-foreground">
                              Submitted: {new Date(submission.submittedAt).toLocaleString()}
                            </p>
                          )}
                          {submission.content && (
                            <div className="mt-4 p-4 bg-muted rounded-lg">
                              <p className="text-sm font-medium mb-2">Student Work:</p>
                              <p className="text-sm whitespace-pre-wrap">{submission.content}</p>
                            </div>
                          )}
                          {submission.teacherScore !== null && (
                            <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                              <p className="text-sm font-medium mb-2">
                                Score: {submission.teacherScore}/{assignment.maxScore} ({((submission.teacherScore / assignment.maxScore) * 100).toFixed(1)}%)
                              </p>
                              {submission.teacherFeedback && (
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {submission.teacherFeedback}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {submission.status === 'submitted' || submission.status === 'graded' ? (
                        <Button
                          onClick={() => openGradingDialog(submission)}
                          variant={submission.status === 'graded' ? 'outline' : 'default'}
                          data-testid={`button-grade-${submission.id}`}
                        >
                          {submission.status === 'graded' ? 'Edit Grade' : 'Grade'}
                        </Button>
                      ) : null}
                    </div>
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
                  <FileText className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No Submissions Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Students haven't submitted any work for this assignment yet.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={!!gradingSubmission} onOpenChange={() => setGradingSubmission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              Provide a score and feedback for this student's work.
            </DialogDescription>
          </DialogHeader>
          <Form {...gradeForm}>
            <form onSubmit={gradeForm.handleSubmit(handleGradeSubmission)} className="space-y-4 py-4">
              <FormField
                control={gradeForm.control}
                name="score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Score (out of {assignment?.maxScore || 100})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max={assignment?.maxScore || 100}
                        step="0.5"
                        data-testid="input-score"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={gradeForm.control}
                name="feedback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feedback (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-feedback"
                        placeholder="Great work! Consider..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={gradeSubmissionMutation.isPending}
                  data-testid="button-save-grade"
                >
                  {gradeSubmissionMutation.isPending ? "Saving..." : "Save Grade"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
