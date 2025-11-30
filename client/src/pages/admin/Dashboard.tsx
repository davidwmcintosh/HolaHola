import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { MetricsCard } from "@/components/admin/MetricsCard";
import { TrendChart } from "@/components/admin/TrendChart";
import { Users, GraduationCap, FileText, MessageSquare, TrendingUp, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    totalUsers: number;
    totalStudents: number;
    totalTeachers: number;
    totalDevelopers: number;
    totalAdmins: number;
    totalClasses: number;
    totalAssignments: number;
    totalSubmissions: number;
    totalConversations: number;
  }>({
    queryKey: ["/api/admin/metrics"],
  });

  const { data: growthData, isLoading: growthLoading } = useQuery<{
    newUsers: Array<{ date: string; count: number }>;
    newClasses: Array<{ date: string; count: number }>;
    newAssignments: Array<{ date: string; count: number }>;
  }>({
    queryKey: ["/api/admin/metrics/growth", { days: 30 }],
  });

  const { data: topTeachers } = useQuery<Array<any>>({
    queryKey: ["/api/admin/top-teachers", { limit: 5 }],
  });

  const { data: topClasses } = useQuery<Array<any>>({
    queryKey: ["/api/admin/top-classes", { limit: 5 }],
  });

  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Platform Overview</h1>
            <p className="text-muted-foreground mt-2">
              Monitor platform metrics, user activity, and system performance
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metricsLoading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </>
            ) : (
              <>
                <MetricsCard
                  title="Total Users"
                  value={metrics?.totalUsers || 0}
                  description={`${metrics?.totalStudents || 0} students, ${metrics?.totalTeachers || 0} teachers`}
                  icon={Users}
                />
                <MetricsCard
                  title="Active Classes"
                  value={metrics?.totalClasses || 0}
                  description="Platform-wide classes"
                  icon={GraduationCap}
                />
                <MetricsCard
                  title="Total Assignments"
                  value={metrics?.totalAssignments || 0}
                  description={`${metrics?.totalSubmissions || 0} submissions`}
                  icon={FileText}
                />
                <MetricsCard
                  title="Conversations"
                  value={metrics?.totalConversations || 0}
                  description="AI-powered chats"
                  icon={MessageSquare}
                />
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {growthLoading ? (
              <>
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
              </>
            ) : (
              <>
                <TrendChart
                  title="User Growth (30 Days)"
                  description="New user registrations over time"
                  data={growthData?.newUsers || []}
                  color="hsl(var(--primary))"
                />
                <TrendChart
                  title="Class Growth (30 Days)"
                  description="New classes created over time"
                  data={growthData?.newClasses || []}
                  color="hsl(var(--chart-2))"
                />
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-top-teachers">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Top Teachers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topTeachers && topTeachers.length > 0 ? (
                  <div className="space-y-3">
                    {topTeachers.map((teacher, index) => (
                      <div key={teacher.id} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                        <div>
                          <div className="font-medium">{teacher.firstName || teacher.email}</div>
                          <div className="text-sm text-muted-foreground">
                            {teacher.classCount} classes, {teacher.studentCount} students
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-muted-foreground">#{index + 1}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No teacher data available</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-top-classes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Most Popular Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topClasses && topClasses.length > 0 ? (
                  <div className="space-y-3">
                    {topClasses.map((cls, index) => (
                      <div key={cls.id} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                        <div>
                          <div className="font-medium">{cls.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {cls.enrollmentCount} students • {cls.teacher?.firstName || "Unknown Teacher"}
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-muted-foreground">#{index + 1}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No class data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </RoleGuard>
  );
}
