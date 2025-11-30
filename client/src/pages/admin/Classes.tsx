import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminClasses() {
  const { data, isLoading } = useQuery<{
    classes: Array<any>;
    total: number;
  }>({
    queryKey: ["/api/admin/classes"],
  });

  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Class Management</h1>
            <p className="text-muted-foreground mt-2">
              View and manage all classes across the platform
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Classes ({data?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {data && data.classes.length > 0 ? (
                    data.classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex items-center justify-between p-4 rounded-md border hover-elevate"
                        data-testid={`card-class-${cls.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-lg">{cls.name}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {cls.description || "No description"}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="secondary">
                                {cls.language}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {cls.enrollmentCount} students
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Teacher: {cls.teacher?.firstName || cls.teacher?.email || "Unknown"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">
                            Join Code
                          </div>
                          <div className="font-mono font-bold text-lg">
                            {cls.joinCode}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No classes found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </RoleGuard>
  );
}
