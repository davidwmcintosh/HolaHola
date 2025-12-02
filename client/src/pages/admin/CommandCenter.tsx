import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasAdminAccess, hasTeacherAccess } from "@shared/permissions";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { useUser } from "@/lib/auth";
import { SyllabusBuilder } from "@/components/SyllabusBuilder";
import { 
  LayoutDashboard,
  Users,
  GraduationCap,
  BarChart3,
  Volume2,
  Code,
  FileText,
  ChevronDown,
  ChevronRight,
  Shield,
  Search,
  RotateCcw,
  Loader2,
  TrendingUp,
  Award,
  MessageSquare,
  Clock,
  DollarSign,
  RefreshCw,
  Plus,
  Activity,
  AlertTriangle,
  Globe,
  Star,
  Compass,
  User,
  Tags,
  Pencil,
  Trash2,
  Briefcase,
  Zap,
  Plane,
  BookOpen,
  X
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
}

function CollapsibleSection({ title, icon, defaultOpen = true, children, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 h-auto hover-elevate">
          <div className="flex items-center gap-3">
            {icon}
            <span className="font-semibold">{title}</span>
            {badge && <Badge variant="secondary">{badge}</Badge>}
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function CommandCenter() {
  const { user } = useAuth();
  const { user: fullUser } = useUser();
  const { toast } = useToast();
  
  const isAdmin = user?.role === 'admin';
  const isDeveloper = user?.role === 'developer' || isAdmin;
  const isTeacher = hasTeacherAccess(user?.role);
  const hasFullAdmin = hasAdminAccess(user?.role);

  const [activeTab, setActiveTab] = useState("overview");

  const availableTabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ['admin', 'developer', 'teacher'] },
    { id: "users", label: "Users", icon: Users, roles: ['admin'] },
    { id: "classes", label: "Classes", icon: GraduationCap, roles: ['admin', 'developer'] },
    { id: "analytics", label: "Analytics", icon: BarChart3, roles: ['admin', 'developer'] },
    { id: "voice-lab", label: "Voice Lab", icon: Volume2, roles: ['admin', 'developer'] },
    { id: "dev-tools", label: "Dev Tools", icon: Code, roles: ['developer', 'admin'] },
    { id: "audit", label: "Audit", icon: FileText, roles: ['admin'] },
  ].filter(tab => {
    if (user?.role === 'admin') return true;
    if (user?.role === 'developer') return tab.roles.includes('developer');
    if (isTeacher) return tab.roles.includes('teacher');
    return false;
  });

  if (!user || (!hasFullAdmin && user.role !== 'developer' && !isTeacher)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied. Admin, Developer, or Teacher role required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {fullUser?.impersonatedUserId && (
        <ImpersonationBanner 
          targetUserEmail={fullUser.email || "Unknown User"} 
          targetUserId={fullUser.impersonatedUserId}
        />
      )}
      
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Command Center</h1>
          </div>
          <p className="text-muted-foreground">
            Manage platform operations, monitor analytics, and configure system settings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            {availableTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-2"
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UsersTab />
          </TabsContent>

          <TabsContent value="classes" className="space-y-4">
            <ClassesTab />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="voice-lab" className="space-y-4">
            <VoiceLabTab />
          </TabsContent>

          <TabsContent value="dev-tools" className="space-y-4">
            <DevToolsTab />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OverviewTab() {
  const { user } = useAuth();
  const canViewAdminMetrics = user?.role === 'admin' || user?.role === 'developer';

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
    enabled: canViewAdminMetrics,
  });

  const { data: growthData, isLoading: growthLoading } = useQuery<{
    newUsers: Array<{ date: string; count: number }>;
    newClasses: Array<{ date: string; count: number }>;
  }>({
    queryKey: ["/api/admin/metrics/growth", { days: 30 }],
    enabled: canViewAdminMetrics,
  });

  const { data: topTeachers } = useQuery<Array<any>>({
    queryKey: ["/api/admin/top-teachers", { limit: 5 }],
    enabled: canViewAdminMetrics,
  });

  const { data: topClasses } = useQuery<Array<any>>({
    queryKey: ["/api/admin/top-classes", { limit: 5 }],
    enabled: canViewAdminMetrics,
  });

  if (!canViewAdminMetrics) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              Welcome to Command Center
            </CardTitle>
            <CardDescription>
              Your central hub for managing teaching activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              As a teacher, you can access your class management features from the Teaching section in the sidebar.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="default">
                <a href="/teacher/classes">Manage Classes</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/curriculum-library">Browse Syllabi</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CollapsibleSection 
        title="Platform Metrics" 
        icon={<TrendingUp className="h-5 w-5 text-primary" />}
        defaultOpen={true}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          {metricsLoading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.totalStudents || 0} students, {metrics?.totalTeachers || 0} teachers
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalClasses || 0}</div>
                  <p className="text-xs text-muted-foreground">Platform-wide classes</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalAssignments || 0}</div>
                  <p className="text-xs text-muted-foreground">{metrics?.totalSubmissions || 0} submissions</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Conversations</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalConversations || 0}</div>
                  <p className="text-xs text-muted-foreground">AI-powered chats</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Leaderboards" 
        icon={<Award className="h-5 w-5 text-primary" />}
        defaultOpen={true}
      >
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <Card>
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

          <Card>
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
      </CollapsibleSection>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "" });
  const [grantCreditsUser, setGrantCreditsUser] = useState<any | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(1);
  const [creditDescription, setCreditDescription] = useState<string>("");

  const queryUrl = roleFilter === "all" 
    ? "/api/admin/users" 
    : `/api/admin/users?role=${roleFilter}`;

  const { data, isLoading } = useQuery<{ users: Array<any>; total: number }>({
    queryKey: [queryUrl],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/admin/users')
      });
      toast({ title: "Role updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update role", variant: "destructive" });
    },
  });

  const updateUserDetailsMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { firstName?: string; lastName?: string; email?: string; isTestAccount?: boolean; isBetaTester?: boolean } }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/admin/users')
      });
      toast({ title: "User updated successfully" });
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update user", variant: "destructive" });
    },
  });

  const grantCreditsMutation = useMutation({
    mutationFn: async ({ userId, creditHours, description }: { userId: string; creditHours: number; description: string }) => {
      return apiRequest("POST", `/api/admin/users/${userId}/grant-credits`, { creditHours, description });
    },
    onSuccess: (data: any) => {
      toast({ title: "Credits Granted", description: data.message || "Credits have been added to user's account" });
      setGrantCreditsUser(null);
      setCreditAmount(1);
      setCreditDescription("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to grant credits", variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiRequest("POST", "/api/admin/impersonate", { targetUserId, durationMinutes: 60 });
    },
    onSuccess: () => {
      toast({ title: "Impersonation started" });
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start impersonation", variant: "destructive" });
    },
  });

  const resetLearningDataMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiRequest("POST", `/api/admin/users/${targetUserId}/reset-learning-data`, {});
    },
    onSuccess: (data: any) => {
      toast({ title: "Learning data reset", description: data.message || "User learning data has been reset" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reset learning data", variant: "destructive" });
    },
  });

  const filteredUsers = data?.users.filter((user) =>
    searchQuery
      ? (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
  );

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    updateUserDetailsMutation.mutate({
      userId: editingUser.id,
      data: {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
      },
    });
  };

  const handleToggleTestUser = (userId: string, currentValue: boolean) => {
    updateUserDetailsMutation.mutate({
      userId,
      data: { isTestAccount: !currentValue },
    });
  };

  const handleToggleBetaTester = (userId: string, currentValue: boolean) => {
    updateUserDetailsMutation.mutate({
      userId,
      data: { isBetaTester: !currentValue },
    });
  };

  const handleGrantCredits = () => {
    if (!grantCreditsUser || creditAmount <= 0) return;
    grantCreditsMutation.mutate({
      userId: grantCreditsUser.id,
      creditHours: creditAmount,
      description: creditDescription || `Beta tester allocation: ${creditAmount} hours`,
    });
  };

  return (
    <div className="space-y-4">
      <CollapsibleSection 
        title="User Management" 
        icon={<Users className="h-5 w-5 text-primary" />}
        badge={data?.total?.toString()}
        defaultOpen={true}
      >
        <div className="space-y-4 mt-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-user-search"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="developer">Developers</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers && filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-md border hover-elevate"
                    data-testid={`row-user-${user.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {user.firstName || user.lastName
                              ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                              : user.email}
                          </span>
                          {user.isTestAccount && (
                            <Badge variant="secondary" className="text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              Dev Test
                            </Badge>
                          )}
                          {user.isBetaTester && (
                            <Badge variant="outline" className="text-xs border-primary/50">
                              <Star className="h-3 w-3 mr-1" />
                              Beta
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {(user.role === 'developer' || user.role === 'admin') && (
                        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
                          <span className="text-xs text-muted-foreground">Dev Test</span>
                          <Switch
                            checked={user.isTestAccount || false}
                            onCheckedChange={() => handleToggleTestUser(user.id, user.isTestAccount || false)}
                            disabled={updateUserDetailsMutation.isPending}
                            data-testid={`switch-test-user-${user.id}`}
                          />
                        </div>
                      )}

                      {(user.role === 'student' || user.role === 'teacher') && (
                        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
                          <span className="text-xs text-muted-foreground">Beta Tester</span>
                          <Switch
                            checked={user.isBetaTester || false}
                            onCheckedChange={() => handleToggleBetaTester(user.id, user.isBetaTester || false)}
                            disabled={updateUserDetailsMutation.isPending}
                            data-testid={`switch-beta-tester-${user.id}`}
                          />
                        </div>
                      )}

                      {(user.isBetaTester || user.role === 'student' || user.role === 'teacher') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setGrantCreditsUser(user)}
                          data-testid={`button-grant-credits-${user.id}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Grant Credits
                        </Button>
                      )}
                      
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => updateRoleMutation.mutate({ userId: user.id, newRole })}
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="developer">Developer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(user)}
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>

                      {user.role !== 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => impersonateMutation.mutate(user.id)}
                          disabled={impersonateMutation.isPending}
                          data-testid={`button-impersonate-${user.id}`}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Impersonate
                        </Button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={resetLearningDataMutation.isPending}
                            data-testid={`button-reset-${user.id}`}
                          >
                            {resetLearningDataMutation.isPending ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-1" />
                            )}
                            Reset
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Learning Data</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all learning data for {user.firstName || user.email}.
                              <p className="mt-2 font-medium">This action cannot be undone.</p>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => resetLearningDataMutation.mutate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Reset All Data
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No users found</p>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      <AlertDialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit User Details</AlertDialogTitle>
            <AlertDialogDescription>
              Update user information for {editingUser?.email}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name</label>
              <Input
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                placeholder="First Name"
                data-testid="input-edit-firstName"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name</label>
              <Input
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                placeholder="Last Name"
                data-testid="input-edit-lastName"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="Email"
                type="email"
                data-testid="input-edit-email"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveEdit}
              disabled={updateUserDetailsMutation.isPending}
            >
              {updateUserDetailsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!grantCreditsUser} onOpenChange={(open) => !open && setGrantCreditsUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Grant Voice Tutoring Credits</AlertDialogTitle>
            <AlertDialogDescription>
              Add voice tutoring hours to {grantCreditsUser?.firstName || grantCreditsUser?.email}'s account.
              These credits will count down as they use the voice tutor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Hours to Grant</label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={creditAmount}
                onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 1)}
                placeholder="Number of hours"
                data-testid="input-credit-hours"
              />
              <p className="text-xs text-muted-foreground">
                Common amounts: 1 hour, 2 hours, 5 hours, 10 hours
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                value={creditDescription}
                onChange={(e) => setCreditDescription(e.target.value)}
                placeholder="e.g., Beta testing allocation, Promotional credit"
                data-testid="input-credit-description"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGrantCredits}
              disabled={grantCreditsMutation.isPending || creditAmount <= 0}
            >
              {grantCreditsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Grant {creditAmount} Hour{creditAmount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClassesTab() {
  const { toast } = useToast();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string>("");

  const { data: classesData, isLoading: classesLoading } = useQuery<{ classes: any[]; total: number }>({
    queryKey: ["/api/admin/classes"],
  });

  const { data: classTypes } = useQuery<any[]>({
    queryKey: ["/api/class-types"],
  });

  const updateClassMutation = useMutation({
    mutationFn: async ({ classId, updates }: { classId: string; updates: any }) => {
      return apiRequest("PUT", `/api/admin/classes/${classId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes/catalogue"] });
      toast({ title: "Class Updated", description: "Class settings have been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update class", variant: "destructive" });
    },
  });

  const FREEDOM_LEVELS = [
    { value: 'guided', label: 'Guided' },
    { value: 'flexible_goals', label: 'Flexible Goals' },
    { value: 'open_exploration', label: 'Open Exploration' },
    { value: 'free_conversation', label: 'Free Conversation' },
  ];

  const handleManageSyllabus = (cls: any) => {
    setSelectedClassId(cls.id);
    setSelectedClassName(cls.name);
  };

  const handleCloseSyllabus = () => {
    setSelectedClassId(null);
    setSelectedClassName("");
  };

  // Master-detail layout when a class is selected
  if (selectedClassId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleCloseSyllabus}
              data-testid="button-close-syllabus"
            >
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Syllabus Editor
              </h2>
              <p className="text-sm text-muted-foreground">{selectedClassName}</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <GraduationCap className="h-3 w-3" />
            Class Management
          </Badge>
        </div>
        
        <SyllabusBuilder classId={selectedClassId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CollapsibleSection 
        title="All Classes" 
        icon={<GraduationCap className="h-5 w-5 text-primary" />}
        badge={classesData?.total?.toString()}
        defaultOpen={true}
      >
        {classesLoading ? (
          <div className="space-y-3 mt-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {classesData?.classes && classesData.classes.length > 0 ? (
              classesData.classes.map((cls) => (
                <div key={cls.id} className="p-4 rounded-md border space-y-3" data-testid={`card-class-${cls.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lg">{cls.name}</span>
                          {cls.isFeatured && (
                            <Badge variant="secondary" className="gap-1 text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400">
                              <Star className="h-3 w-3" />
                              Featured
                            </Badge>
                          )}
                          {cls.isPublicCatalogue && (
                            <Badge variant="outline" className="gap-1">
                              <Globe className="h-3 w-3" />
                              Public
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{cls.description || "No description"}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Join Code</div>
                      <div className="font-mono font-bold text-lg">{cls.joinCode}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <Badge variant="secondary" className="capitalize">{cls.language}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {cls.enrollmentCount} students
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Teacher: {cls.teacher?.firstName || cls.teacher?.email || "Unknown"}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 pt-2 border-t flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleManageSyllabus(cls)}
                      data-testid={`button-manage-syllabus-${cls.id}`}
                    >
                      <BookOpen className="h-4 w-4" />
                      Manage Syllabus
                    </Button>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={cls.isPublicCatalogue}
                        onCheckedChange={() => updateClassMutation.mutate({ classId: cls.id, updates: { isPublicCatalogue: !cls.isPublicCatalogue } })}
                        disabled={updateClassMutation.isPending}
                      />
                      <span className="text-sm">Public</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={cls.isFeatured}
                        onCheckedChange={() => updateClassMutation.mutate({ classId: cls.id, updates: { isFeatured: !cls.isFeatured } })}
                        disabled={updateClassMutation.isPending || !cls.isPublicCatalogue}
                      />
                      <span className="text-sm">Featured</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-muted-foreground" />
                      <Select
                        value={cls.tutorFreedomLevel || "flexible_goals"}
                        onValueChange={(value) => updateClassMutation.mutate({ classId: cls.id, updates: { tutorFreedomLevel: value } })}
                        disabled={updateClassMutation.isPending}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREEDOM_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No classes found</p>
            )}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection 
        title="Class Types" 
        icon={<Tags className="h-5 w-5 text-primary" />}
        defaultOpen={false}
      >
        <ClassTypesSection classTypes={classTypes || []} />
      </CollapsibleSection>
    </div>
  );
}

function ClassTypesSection({ classTypes }: { classTypes: any[] }) {
  const { toast } = useToast();
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/class-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-types"] });
      toast({ title: "Class Type Deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const ICON_MAP: Record<string, any> = { Award, Briefcase, Zap, Plane };

  return (
    <div className="space-y-3 mt-4">
      {classTypes.length > 0 ? (
        classTypes.map((type) => {
          const IconComponent = ICON_MAP[type.icon] || Award;
          return (
            <div key={type.id} className="flex items-center justify-between p-4 rounded-md border">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <IconComponent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.name}</span>
                    {type.isPreset && <Badge variant="outline" className="text-xs">Preset</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">{type.description || "No description"}</div>
                </div>
              </div>
              {!type.isPreset && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(type.id)}
                  data-testid={`button-delete-type-${type.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          );
        })
      ) : (
        <p className="text-muted-foreground text-sm">No class types found</p>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const [period, setPeriod] = useState("30d");
  const [userType, setUserType] = useState("all");

  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/developer/analytics", { period, userType }],
  });

  const { data: platformStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/developer/platform-stats"],
  });

  return (
    <div className="space-y-4">
      <CollapsibleSection 
        title="Usage Analytics" 
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
        defaultOpen={true}
      >
        <div className="space-y-4 mt-4">
          <div className="flex gap-4 flex-wrap">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userType} onValueChange={setUserType}>
              <SelectTrigger className="w-48" data-testid="select-user-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="production">Production Only</SelectItem>
                <SelectItem value="developer">Developers/Testers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {analyticsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : analytics ? (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.summary?.totalSessions || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.summary?.totalDurationHours?.toFixed(1) || 0}h</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">TTS Characters</CardTitle>
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{((analytics.summary?.totalTtsCharacters || 0) / 1000).toFixed(1)}K</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${analytics.estimatedCosts?.total?.toFixed(2) || '0.00'}</div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {analytics?.estimatedCosts && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cost Breakdown by Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <span className="text-sm">Deepgram STT</span>
                    <span className="font-medium">${analytics.estimatedCosts.deepgramStt?.toFixed(3) || '0.000'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <span className="text-sm">Cartesia TTS</span>
                    <span className="font-medium">${analytics.estimatedCosts.cartesiaTts?.toFixed(3) || '0.000'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <span className="text-sm">Gemini LLM</span>
                    <span className="font-medium">${analytics.estimatedCosts.geminiLlm?.toFixed(4) || '0.0000'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Platform Statistics" 
        icon={<Activity className="h-5 w-5 text-primary" />}
        defaultOpen={true}
      >
        {statsLoading ? (
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : platformStats ? (
          <div className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{platformStats.activeUsers?.dau || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Weekly Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{platformStats.activeUsers?.wau || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{platformStats.activeUsers?.mau || 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Users by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {platformStats.usersByRole && Object.entries(platformStats.usersByRole).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between">
                        <span className="capitalize text-sm">{role}</span>
                        <Badge variant="secondary">{count as number}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Session Error Rate
                    {platformStats.errorRate !== undefined && (
                      <Badge variant={platformStats.errorRate > 5 ? "destructive" : platformStats.errorRate > 1 ? "secondary" : "outline"}>
                        {platformStats.errorRate > 5 ? "High" : platformStats.errorRate > 1 ? "Medium" : "Low"}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{platformStats.errorRate?.toFixed(1) || 0}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Sessions with errors</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </CollapsibleSection>
    </div>
  );
}

function VoiceLabTab() {
  return (
    <div className="space-y-4">
      <CollapsibleSection 
        title="Voice Configuration" 
        icon={<Volume2 className="h-5 w-5 text-primary" />}
        defaultOpen={true}
      >
        <div className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">
                Configure tutor voices for each language and gender. The Voice Console provides full TTS testing capabilities.
              </p>
              <Button asChild>
                <a href="/admin/voices">Open Voice Console</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function DevToolsTab() {
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState("Spanish");
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [reloadingClassId, setReloadingClassId] = useState<string | null>(null);

  const LANGUAGES = ["Spanish", "French", "German", "Italian", "Portuguese", "Mandarin", "Japanese", "Korean", "Russian"];

  const { data: myClasses, isLoading: classesLoading } = useQuery<any[]>({
    queryKey: ["/api/student/classes"],
  });

  const createTestClassMutation = useMutation({
    mutationFn: async ({ language, hours }: { language: string; hours: number }) => {
      return apiRequest("POST", "/api/developer/create-test-class", { language, hours });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      toast({ title: "Test class created", description: `Created "${data.class?.name}" with 120 hours` });
      setIsCreatingClass(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsCreatingClass(false);
    },
  });

  const reloadCreditsMutation = useMutation({
    mutationFn: async ({ classId, hours }: { classId: string; hours: number }) => {
      return apiRequest("POST", "/api/developer/reload-credits", { classId, hours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      toast({ title: "Credits reloaded", description: "Class credits reset to 120 hours" });
      setReloadingClassId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setReloadingClassId(null);
    },
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-4">
      <CollapsibleSection 
        title="Quick Test Setup" 
        icon={<Plus className="h-5 w-5 text-primary" />}
        defaultOpen={true}
      >
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create Test Class</CardTitle>
              <CardDescription>Quickly create a test class with 120 hours and auto-enroll yourself</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger data-testid="select-test-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => {
                    setIsCreatingClass(true);
                    createTestClassMutation.mutate({ language: selectedLanguage, hours: 120 });
                  }}
                  disabled={isCreatingClass || createTestClassMutation.isPending}
                  data-testid="button-create-test-class"
                >
                  {isCreatingClass ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Test Class (120h)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="My Test Classes" 
        icon={<GraduationCap className="h-5 w-5 text-primary" />}
        badge={myClasses?.length?.toString()}
        defaultOpen={true}
      >
        <div className="mt-4 space-y-3">
          {classesLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)
          ) : myClasses && myClasses.length > 0 ? (
            myClasses.map((cls) => {
              const usedPercent = cls.allocatedSeconds > 0 ? (cls.usedSeconds / cls.allocatedSeconds) * 100 : 0;
              return (
                <Card key={cls.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">{cls.name}</div>
                        <div className="text-sm text-muted-foreground capitalize">{cls.language}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReloadingClassId(cls.id);
                          reloadCreditsMutation.mutate({ classId: cls.id, hours: 120 });
                        }}
                        disabled={reloadingClassId === cls.id}
                      >
                        {reloadingClassId === cls.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Reload Credits
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Used: {formatDuration(cls.usedSeconds)}</span>
                        <span>Remaining: {formatDuration(cls.remainingSeconds)}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(usedPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">No test classes yet. Create one above!</p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function AuditTab() {
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<{ assignments: any[]; total: number }>({
    queryKey: ["/api/admin/assignments", { limit: 10 }],
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<{ submissions: any[]; total: number }>({
    queryKey: ["/api/admin/submissions", { limit: 10 }],
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery<{ logs: any[]; total: number }>({
    queryKey: ["/api/admin/audit-logs", { limit: 20 }],
  });

  return (
    <div className="space-y-4">
      <CollapsibleSection 
        title="Recent Assignments" 
        icon={<FileText className="h-5 w-5 text-primary" />}
        badge={assignments?.total?.toString()}
        defaultOpen={true}
      >
        {assignmentsLoading ? (
          <div className="space-y-2 mt-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {assignments?.assignments && assignments.assignments.length > 0 ? (
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
      </CollapsibleSection>

      <CollapsibleSection 
        title="Recent Submissions" 
        icon={<FileText className="h-5 w-5 text-primary" />}
        badge={submissions?.total?.toString()}
        defaultOpen={false}
      >
        {submissionsLoading ? (
          <div className="space-y-2 mt-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {submissions?.submissions && submissions.submissions.length > 0 ? (
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
      </CollapsibleSection>

      <CollapsibleSection 
        title="Audit Logs" 
        icon={<Shield className="h-5 w-5 text-primary" />}
        badge={auditLogs?.total?.toString()}
        defaultOpen={true}
      >
        {logsLoading ? (
          <div className="space-y-2 mt-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <div className="space-y-1 mt-4">
            {auditLogs?.logs && auditLogs.logs.length > 0 ? (
              auditLogs.logs.map((log) => (
                <div key={log.id} className="px-3 py-2 rounded-md hover-elevate text-sm font-mono">
                  <span className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>{" "}
                  <span className="font-semibold">{log.action}</span>{" "}
                  {log.targetType && (
                    <>on <span className="text-primary">{log.targetType}</span></>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No audit logs</p>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
