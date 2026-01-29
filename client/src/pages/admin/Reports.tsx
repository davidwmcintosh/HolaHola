import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function AdminReports() {
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<{
    assignments: Array<any>;
    total: number;
  }>({
    queryKey: ["/api/admin/assignments", { limit: 10 }],
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<{
    submissions: Array<any>;
    total: number;
  }>({
    queryKey: ["/api/admin/submissions", { limit: 10 }],
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery<{
    logs: Array<any>;
    total: number;
  }>({
    queryKey: ["/api/admin/audit-logs", { limit: 20 }],
  });

  return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Admin Reports</h1>
            <p className="text-muted-foreground mt-2">
              View platform activity, audit logs, and generate reports
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Assignments ({assignments?.total || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignments && assignments.assignments.length > 0 ? (
                      assignments.assignments.slice(0, 5).map((assignment) => (
                        <div key={assignment.id} className="p-3 rounded-md border hover-elevate">
                          <div className="font-medium">{assignment.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {assignment.class?.name} • {assignment.teacher?.firstName || "Unknown Teacher"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No assignments</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Submissions ({submissions?.total || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {submissionsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissions && submissions.submissions.length > 0 ? (
                      submissions.submissions.slice(0, 5).map((submission) => (
                        <div key={submission.id} className="p-3 rounded-md border hover-elevate">
                          <div className="font-medium">{submission.assignment?.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                              {submission.student?.firstName || submission.student?.email || "Unknown"}
                            </span>
                            <Badge variant={submission.status === 'graded' ? 'default' : 'secondary'}>
                              {submission.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No submissions</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Audit Logs ({auditLogs?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {auditLogs && auditLogs.logs.length > 0 ? (
                    auditLogs.logs.map((log) => (
                      <div key={log.id} className="px-3 py-2 rounded-md hover-elevate text-sm font-mono">
                        <span className="text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>{" "}
                        <span className="font-semibold">{log.action}</span>{" "}
                        {log.targetType && (
                          <>
                            on <span className="text-primary">{log.targetType}</span>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No audit logs</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
  );
}
