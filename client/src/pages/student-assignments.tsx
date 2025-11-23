import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Clock, CheckCircle2, AlertCircle, FileText, Send } from "lucide-react";

interface EnrolledClass {
  id: string;
  classId: string;
  class?: {
    id: string;
    name: string;
    language: string;
  };
}

interface Assignment {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  dueDate: Date | null;
  maxScore: number;
  assignmentType: string;
  isPublished: boolean;
  class?: {
    name: string;
  };
}

interface StudentSubmission {
  id: string;
  assignmentId: string;
  content: string | null;
  status: string;
  teacherScore: number | null;
  teacherFeedback: string | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
  assignment?: Assignment;
}

export default function StudentAssignments() {
  const { toast } = useToast();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionContent, setSubmissionContent] = useState("");
  const [viewingSubmission, setViewingSubmission] = useState<StudentSubmission | null>(null);

  const { data: enrolledClasses } = useQuery<EnrolledClass[]>({
    queryKey: ["/api/student/classes"],
  });

  const classIds = enrolledClasses?.map(e => e.classId) || [];

  const { data: allAssignments, isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
    queryKey: ["/api/student/all-assignments", classIds],
    queryFn: async () => {
      const assignments: Assignment[] = [];
      for (const classId of classIds) {
        const data = await fetch(`/api/classes/${classId}/assignments`, {
          credentials: "include",
        }).then(r => r.json());
        assignments.push(...(data || []));
      }
      return assignments.filter(a => a.isPublished);
    },
    enabled: classIds.length > 0,
  });

  const { data: submissions, isLoading: isLoadingSubmissions } = useQuery<StudentSubmission[]>({
    queryKey: ["/api/student/submissions"],
  });

  const submitAssignmentMutation = useMutation({
    mutationFn: async (data: { assignmentId: string; content: string }) => {
      return apiRequest(`/api/assignments/${data.assignmentId}/submit`, {
        method: "POST",
        body: JSON.stringify({ content: data.content }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/submissions"] });
      setSelectedAssignment(null);
      setSubmissionContent("");
      toast({
        title: "Assignment Submitted",
        description: "Your work has been submitted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit assignment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedAssignment) return;

    if (!submissionContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter your work before submitting",
        variant: "destructive",
      });
      return;
    }

    submitAssignmentMutation.mutate({
      assignmentId: selectedAssignment.id,
      content: submissionContent.trim(),
    });
  };

  const openSubmissionDialog = (assignment: Assignment) => {
    const existingSubmission = submissions?.find(s => s.assignmentId === assignment.id);
    setSelectedAssignment(assignment);
    setSubmissionContent(existingSubmission?.content || "");
  };

  const getAssignmentStatus = (assignment: Assignment) => {
    const submission = submissions?.find(s => s.assignmentId === assignment.id);
    if (!submission) return { status: "not_started", label: "Not Started", variant: "outline" as const };
    if (submission.status === "graded") return { status: "graded", label: "Graded", variant: "default" as const };
    if (submission.status === "submitted") return { status: "submitted", label: "Submitted", variant: "secondary" as const };
    return { status: "in_progress", label: "In Progress", variant: "outline" as const };
  };

  const pendingAssignments = allAssignments?.filter(a => {
    const status = getAssignmentStatus(a);
    return status.status === "not_started" || status.status === "in_progress";
  }) || [];

  const completedAssignments = allAssignments?.filter(a => {
    const status = getAssignmentStatus(a);
    return status.status === "submitted" || status.status === "graded";
  }) || [];

  const isOverdue = (dueDate: Date | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">My Assignments</h1>
        <p className="text-muted-foreground mt-2">View and submit your class assignments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-count">{pendingAssignments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completed-count">{completedAssignments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Graded</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-graded-count">
              {submissions?.filter(s => s.status === "graded").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
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
          ) : pendingAssignments.length > 0 ? (
            <div className="space-y-4">
              {pendingAssignments.map((assignment) => {
                const status = getAssignmentStatus(assignment);
                const overdue = isOverdue(assignment.dueDate);

                return (
                  <Card
                    key={assignment.id}
                    className="hover-elevate active-elevate-2 cursor-pointer"
                    onClick={() => openSubmissionDialog(assignment)}
                    data-testid={`card-assignment-${assignment.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle>{assignment.title}</CardTitle>
                            <Badge variant={status.variant}>{status.label}</Badge>
                            {overdue && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <CardDescription>
                            {assignment.class?.name || "Unknown Class"} •{" "}
                            {assignment.dueDate
                              ? `Due: ${new Date(assignment.dueDate).toLocaleDateString()}`
                              : "No due date"}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    {assignment.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {assignment.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-muted rounded-full">
                    <CheckCircle2 className="w-12 h-12 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">All Caught Up!</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    You don't have any pending assignments. Great work!
                  </p>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {isLoadingSubmissions ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : completedAssignments.length > 0 ? (
            <div className="space-y-4">
              {completedAssignments.map((assignment) => {
                const submission = submissions?.find(s => s.assignmentId === assignment.id);
                const status = getAssignmentStatus(assignment);

                return (
                  <Card
                    key={assignment.id}
                    className="hover-elevate active-elevate-2 cursor-pointer"
                    onClick={() => setViewingSubmission(submission || null)}
                    data-testid={`card-completed-${assignment.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle>{assignment.title}</CardTitle>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <CardDescription>
                            {assignment.class?.name || "Unknown Class"}
                            {submission && submission.teacherScore !== null && (
                              <> • Score: {submission.teacherScore}/{assignment.maxScore}</>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    {submission?.gradedAt && submission.teacherFeedback && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          Teacher feedback: {submission.teacherFeedback}
                        </p>
                      </CardContent>
                    )}
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
                  <h3 className="text-xl font-semibold">No Completed Assignments</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Completed assignments will appear here.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAssignment?.title}</DialogTitle>
            <DialogDescription>
              {selectedAssignment?.class?.name || "Unknown Class"} •{" "}
              Max Score: {selectedAssignment?.maxScore || 100}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedAssignment?.description && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Description:</p>
                <p className="text-sm">{selectedAssignment.description}</p>
              </div>
            )}
            {selectedAssignment?.instructions && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Instructions:</p>
                <p className="text-sm whitespace-pre-wrap">{selectedAssignment.instructions}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="submission">Your Work</Label>
              <Textarea
                id="submission"
                value={submissionContent}
                onChange={(e) => setSubmissionContent(e.target.value)}
                data-testid="input-submission"
                placeholder="Enter your work here..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={submitAssignmentMutation.isPending}
              data-testid="button-submit-assignment"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitAssignmentMutation.isPending ? "Submitting..." : "Submit Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingSubmission} onOpenChange={() => setViewingSubmission(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingSubmission?.assignment?.title}</DialogTitle>
            <DialogDescription>
              Submitted on {viewingSubmission?.submittedAt ? new Date(viewingSubmission.submittedAt).toLocaleDateString() : "Unknown"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Your Work:</p>
              <p className="text-sm whitespace-pre-wrap">{viewingSubmission?.content}</p>
            </div>
            {viewingSubmission?.teacherScore !== null && (
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium mb-2">
                  Score: {viewingSubmission.teacherScore}/{viewingSubmission.assignment?.maxScore || 100}
                  {" "}({((viewingSubmission.teacherScore / (viewingSubmission.assignment?.maxScore || 100)) * 100).toFixed(1)}%)
                </p>
                {viewingSubmission.teacherFeedback && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-1">Teacher Feedback:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {viewingSubmission.teacherFeedback}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
