import { useState, useEffect } from "react";
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
  X,
  Image,
  Sparkles,
  ExternalLink,
  Download,
  Eye,
  Calendar,
  Hash,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bell,
  Check,
  CheckCircle,
  AlertCircle,
  Play,
  Undo2,
  Mail,
  Headphones,
  Phone,
  CircleDot,
  Circle,
  CheckCircle2,
  Lock,
  Send,
  Eye as EyeIcon,
  EyeOff
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
    { id: "reports", label: "Reports", icon: DollarSign, roles: ['admin', 'developer'] },
    { id: "images", label: "Images", icon: Image, roles: ['admin', 'developer'] },
    { id: "voice-lab", label: "Voice Lab", icon: Volume2, roles: ['admin', 'developer'] },
    { id: "neural-network", label: "Neural Network", icon: Zap, roles: ['developer', 'admin'] },
    { id: "dev-tools", label: "Dev Tools", icon: Code, roles: ['developer', 'admin'] },
    { id: "audit", label: "Audit", icon: FileText, roles: ['admin'] },
    { id: "support", label: "Support", icon: Headphones, roles: ['admin', 'developer'] },
    { id: "dept-chat", label: "Dept Chat", icon: Lock, roles: ['admin', 'developer'] },
    { id: "feature-sprint", label: "Feature Sprint", icon: Zap, roles: ['admin', 'developer'] },
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

          <TabsContent value="reports" className="space-y-4">
            <ReportsTab />
          </TabsContent>

          <TabsContent value="images" className="space-y-4">
            <ImageLibraryTab />
          </TabsContent>

          <TabsContent value="voice-lab" className="space-y-4">
            <VoiceLabTab />
          </TabsContent>

          <TabsContent value="neural-network" className="space-y-4">
            <NeuralNetworkTab />
          </TabsContent>

          <TabsContent value="dev-tools" className="space-y-4">
            <DevToolsTab />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditTab />
          </TabsContent>

          <TabsContent value="support" className="space-y-4">
            <SupportTab />
          </TabsContent>

          <TabsContent value="dept-chat" className="space-y-4">
            <DepartmentChatTab />
          </TabsContent>

          <TabsContent value="feature-sprint" className="space-y-4">
            <FeatureSprintTab />
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", firstName: "", lastName: "", role: "student" });
  
  // Quick Enroll state
  const [showQuickEnroll, setShowQuickEnroll] = useState(false);
  const [quickEnrollForm, setQuickEnrollForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    classId: "",
    creditHours: 0,
    sendEmail: true,
  });

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

  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; firstName: string; lastName: string; role: string }) => {
      return apiRequest("POST", "/api/admin/users", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/admin/users')
      });
      toast({ title: "User created successfully", description: "The new user has been created with pending authentication." });
      setShowCreateDialog(false);
      setCreateForm({ email: "", firstName: "", lastName: "", role: "student" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create user", variant: "destructive" });
    },
  });

  const sendInvitationMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/users/${userId}/send-invitation`, {});
    },
    onSuccess: () => {
      toast({ title: "Invitation sent", description: "The user will receive an email with registration instructions." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send invitation", variant: "destructive" });
    },
  });

  // Quick Enroll: fetch classes for picker
  const { data: classesData } = useQuery<{ classes: Array<{ id: string; name: string; language: string }> }>({
    queryKey: ["/api/admin/classes"],
  });

  const quickEnrollMutation = useMutation({
    mutationFn: async (data: { email: string; firstName: string; lastName: string; classId?: string; creditHours?: number; sendEmail?: boolean }) => {
      return apiRequest("POST", "/api/admin/quick-enroll", {
        ...data,
        classId: data.classId || undefined,
        creditHours: data.creditHours || undefined,
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/admin/users')
      });
      toast({ 
        title: "Test User Created", 
        description: result.message || "Quick enroll completed successfully" 
      });
      setShowQuickEnroll(false);
      setQuickEnrollForm({ email: "", firstName: "", lastName: "", classId: "", creditHours: 0, sendEmail: true });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to quick enroll", variant: "destructive" });
    },
  });

  const handleQuickEnroll = () => {
    if (!quickEnrollForm.email) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    quickEnrollMutation.mutate({
      email: quickEnrollForm.email,
      firstName: quickEnrollForm.firstName,
      lastName: quickEnrollForm.lastName,
      classId: quickEnrollForm.classId || undefined,
      creditHours: quickEnrollForm.creditHours || undefined,
      sendEmail: quickEnrollForm.sendEmail,
    });
  };

  const handleCreateUser = () => {
    if (!createForm.email) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    createUserMutation.mutate(createForm);
  };

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
            <Button onClick={() => setShowQuickEnroll(true)} variant="default" data-testid="button-quick-enroll">
              <Zap className="h-4 w-4 mr-2" />
              Quick Enroll
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} variant="outline" data-testid="button-create-user">
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
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
                          {user.authProvider === 'pending' && (
                            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                              <Mail className="h-3 w-3 mr-1" />
                              Pending
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

                      {user.authProvider === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendInvitationMutation.mutate(user.id)}
                          disabled={sendInvitationMutation.isPending}
                          data-testid={`button-send-invitation-${user.id}`}
                        >
                          {sendInvitationMutation.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Mail className="h-3 w-3 mr-1" />
                          )}
                          Send Invitation
                        </Button>
                      )}

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
              <label className="text-sm font-medium">User ID</label>
              <Input
                value={editingUser?.id || ""}
                disabled
                className="bg-muted font-mono text-xs"
                data-testid="input-edit-userId"
              />
              <p className="text-xs text-muted-foreground">
                Unique system identifier (read-only)
              </p>
            </div>
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

      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New User</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new user account. They will receive an invitation to set their password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email *</label>
              <Input
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="user@example.com"
                type="email"
                data-testid="input-create-email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name</label>
              <Input
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                placeholder="First Name"
                data-testid="input-create-firstName"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name</label>
              <Input
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                placeholder="Last Name"
                data-testid="input-create-lastName"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={createForm.role} onValueChange={(value) => setCreateForm({ ...createForm, role: value })}>
                <SelectTrigger data-testid="select-create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCreateForm({ email: "", firstName: "", lastName: "", role: "student" })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending || !createForm.email}
            >
              {createUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Enroll Dialog */}
      <AlertDialog open={showQuickEnroll} onOpenChange={setShowQuickEnroll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Enroll Test User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Create a test user, optionally assign to a class, grant credits, and send setup email - all in one step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email *</label>
              <Input
                value={quickEnrollForm.email}
                onChange={(e) => setQuickEnrollForm({ ...quickEnrollForm, email: e.target.value })}
                placeholder="tester@example.com"
                type="email"
                data-testid="input-quick-enroll-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input
                  value={quickEnrollForm.firstName}
                  onChange={(e) => setQuickEnrollForm({ ...quickEnrollForm, firstName: e.target.value })}
                  placeholder="First"
                  data-testid="input-quick-enroll-firstName"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={quickEnrollForm.lastName}
                  onChange={(e) => setQuickEnrollForm({ ...quickEnrollForm, lastName: e.target.value })}
                  placeholder="Last"
                  data-testid="input-quick-enroll-lastName"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Enroll in Class (optional)</label>
              <Select 
                value={quickEnrollForm.classId} 
                onValueChange={(value) => setQuickEnrollForm({ ...quickEnrollForm, classId: value })}
              >
                <SelectTrigger data-testid="select-quick-enroll-class">
                  <SelectValue placeholder="Self-directed (no class)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Self-directed (no class)</SelectItem>
                  {classesData?.classes?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Without a class, credits allow self-directed learning in any language
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Grant Credits (hours)</label>
              <Input
                type="number"
                min="0"
                value={quickEnrollForm.creditHours}
                onChange={(e) => setQuickEnrollForm({ ...quickEnrollForm, creditHours: parseInt(e.target.value) || 0 })}
                placeholder="0"
                data-testid="input-quick-enroll-credits"
              />
              <p className="text-xs text-muted-foreground">
                Leave at 0 if you don't want to grant any credits yet
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={quickEnrollForm.sendEmail}
                onCheckedChange={(checked) => setQuickEnrollForm({ ...quickEnrollForm, sendEmail: checked })}
                data-testid="switch-quick-enroll-sendEmail"
              />
              <label className="text-sm">Send invitation email to complete setup</label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setQuickEnrollForm({ email: "", firstName: "", lastName: "", classId: "", creditHours: 0, sendEmail: true })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleQuickEnroll}
              disabled={quickEnrollMutation.isPending || !quickEnrollForm.email}
            >
              {quickEnrollMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Quick Enroll
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

interface MediaFile {
  id: string;
  uploadedBy?: string | null;
  mediaType: string;
  url: string;
  thumbnailUrl?: string | null;
  filename: string;
  mimeType: string;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  language?: string | null;
  imageSource?: string | null;
  searchQuery?: string | null;
  promptHash?: string | null;
  usageCount?: number | null;
  attributionJson?: string | null;
  targetWord?: string | null;
  isReviewed?: boolean | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
}

type ViewMode = 'grid' | 'compact' | 'list';
type SortField = 'createdAt' | 'usageCount' | 'fileSize' | 'language';
type SortOrder = 'asc' | 'desc';

function ImageLibraryTab() {
  const { toast } = useToast();
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedImage, setSelectedImage] = useState<MediaFile | null>(null);
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestWord, setRequestWord] = useState("");
  const [requestLanguage, setRequestLanguage] = useState("spanish");
  const limit = viewMode === 'list' ? 25 : 20;

  const queryUrl = sourceFilter === "all"
    ? `/api/admin/media?limit=${limit}&offset=${page * limit}&sortBy=${sortField}&sortOrder=${sortOrder}`
    : `/api/admin/media?source=${sourceFilter}&limit=${limit}&offset=${page * limit}&sortBy=${sortField}&sortOrder=${sortOrder}`;

  const { data, isLoading, refetch } = useQuery<{ files: MediaFile[]; total: number; newCount?: number; unreviewedCount?: number }>({
    queryKey: [queryUrl],
  });

  // Clear selections when page, filter, or view changes to prevent stale selections
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, sourceFilter, viewMode, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (data?.files) {
      setSelectedIds(new Set(data.files.map(f => f.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/media/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Image deleted successfully" });
      refetch();
      setSelectedImage(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete image", variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, isReviewed }: { id: string; isReviewed: boolean }) => {
      return apiRequest("PATCH", `/api/admin/media/${id}`, { isReviewed });
    },
    onSuccess: (_, variables) => {
      toast({ title: variables.isReviewed ? "Marked as reviewed" : "Marked as unreviewed" });
      refetch();
      if (selectedImage) {
        setSelectedImage({ ...selectedImage, isReviewed: variables.isReviewed });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update review status", variant: "destructive" });
    },
  });

  const bulkReviewMutation = useMutation({
    mutationFn: async ({ ids, isReviewed }: { ids: string[]; isReviewed: boolean }) => {
      return apiRequest("POST", "/api/admin/media/bulk-review", { ids, isReviewed });
    },
    onSuccess: (_, variables) => {
      toast({ title: `${variables.ids.length} images marked as ${variables.isReviewed ? 'reviewed' : 'unreviewed'}` });
      refetch();
      clearSelection();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to bulk update", variant: "destructive" });
    },
  });

  const requestImageMutation = useMutation({
    mutationFn: async ({ word, language }: { word: string; language: string }) => {
      return apiRequest("POST", "/api/admin/media/request-image", { word, language });
    },
    onSuccess: () => {
      toast({ title: "Image requested successfully" });
      refetch();
      setShowRequestDialog(false);
      setRequestWord("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to request image", variant: "destructive" });
    },
  });

  const getSourceBadge = (source?: string | null) => {
    switch (source) {
      case 'ai_generated':
        return <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30"><Sparkles className="h-3 w-3 mr-1" />AI Generated</Badge>;
      case 'stock':
        return <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30"><Image className="h-3 w-3 mr-1" />Stock</Badge>;
      case 'user_upload':
        return <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30"><User className="h-3 w-3 mr-1" />User Upload</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
      <CollapsibleSection 
        title="AI-Generated & Stock Images" 
        icon={<Image className="h-5 w-5 text-primary" />}
        badge={data?.total?.toString()}
        defaultOpen={true}
      >
        <div className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Review and manage AI-generated educational images and cached stock photos used in lessons.
              </p>
              {data?.unreviewedCount !== undefined && data.unreviewedCount > 0 && (
                <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 gap-1" data-testid="badge-unreviewed-count">
                  <AlertTriangle className="h-3 w-3" />
                  {data.unreviewedCount} unreviewed
                </Badge>
              )}
              {data?.newCount !== undefined && data.newCount > 0 && (
                <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30 gap-1">
                  <Bell className="h-3 w-3" />
                  {data.newCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowRequestDialog(true)}
                data-testid="button-request-image"
              >
                <Plus className="h-4 w-4 mr-1" />
                Request Image
              </Button>
              
              <div className="flex border rounded-md overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-none h-8 px-2"
                  onClick={() => { setViewMode('grid'); setPage(0); }}
                  data-testid="button-view-grid"
                  title="Large Grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-none h-8 px-2 border-x"
                  onClick={() => { setViewMode('compact'); setPage(0); }}
                  data-testid="button-view-compact"
                  title="Compact Grid"
                >
                  <LayoutGrid className="h-3 w-3" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-none h-8 px-2"
                  onClick={() => { setViewMode('list'); setPage(0); }}
                  data-testid="button-view-list"
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
                <SelectTrigger className="w-40 h-8" data-testid="select-source-filter">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="ai_generated">AI Generated</SelectItem>
                  <SelectItem value="stock">Stock Images</SelectItem>
                  <SelectItem value="user_upload">User Uploads</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg" data-testid="bulk-actions-bar">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              <div className="flex-1" />
              <Button 
                variant="default" 
                size="sm"
                onClick={() => bulkReviewMutation.mutate({ ids: Array.from(selectedIds), isReviewed: true })}
                disabled={bulkReviewMutation.isPending}
                data-testid="button-bulk-review"
              >
                {bulkReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Mark as Reviewed
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkReviewMutation.mutate({ ids: Array.from(selectedIds), isReviewed: false })}
                disabled={bulkReviewMutation.isPending}
              >
                Mark as Unreviewed
              </Button>
            </div>
          )}

          {isLoading ? (
            viewMode === 'list' ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
              </div>
            ) : (
              <div className={viewMode === 'compact' 
                ? "grid gap-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
                : "grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              }>
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
              </div>
            )
          ) : (
            <>
              {data?.files && data.files.length > 0 ? (
                viewMode === 'list' ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[32px_40px_1fr_100px_100px_100px_80px_80px_60px] gap-2 p-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <div className="flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={data.files.length > 0 && selectedIds.size === data.files.length}
                          onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                          className="rounded"
                          data-testid="checkbox-select-all"
                        />
                      </div>
                      <div className="w-10" />
                      <button 
                        onClick={() => toggleSort('createdAt')} 
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Word <SortIcon field="createdAt" />
                      </button>
                      <span>Source</span>
                      <button 
                        onClick={() => toggleSort('language')} 
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Language <SortIcon field="language" />
                      </button>
                      <button 
                        onClick={() => toggleSort('fileSize')} 
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Size <SortIcon field="fileSize" />
                      </button>
                      <button 
                        onClick={() => toggleSort('usageCount')} 
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Used <SortIcon field="usageCount" />
                      </button>
                      <span>Reviewed</span>
                    </div>
                    <div className="divide-y">
                      {data.files.map((file) => (
                        <div 
                          key={file.id}
                          className={`grid grid-cols-[32px_40px_1fr_100px_100px_100px_80px_80px_60px] gap-2 p-2 items-center cursor-pointer hover:bg-muted/50 transition-colors ${selectedIds.has(file.id) ? 'bg-primary/10' : ''}`}
                          onClick={() => setSelectedImage(file)}
                          data-testid={`row-image-${file.id}`}
                        >
                          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedIds.has(file.id)}
                              onChange={(e) => toggleSelect(file.id, e as any)}
                              className="rounded"
                              data-testid={`checkbox-image-${file.id}`}
                            />
                          </div>
                          <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                            <img 
                              src={file.thumbnailUrl || file.url} 
                              alt={file.title || file.filename}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" title={file.targetWord || file.searchQuery || file.filename}>
                              {file.targetWord || file.searchQuery || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{file.filename}</p>
                          </div>
                          <div>{getSourceBadge(file.imageSource)}</div>
                          <span className="text-sm text-muted-foreground capitalize">{file.language || '-'}</span>
                          <span className="text-sm text-muted-foreground">{formatFileSize(file.fileSize)}</span>
                          <span className="text-sm text-muted-foreground">{file.usageCount || 0}x</span>
                          <div className="flex items-center justify-center">
                            {file.isReviewed ? (
                              <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30 text-xs">
                                <Check className="h-3 w-3" />
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={viewMode === 'compact'
                    ? "grid gap-2 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
                    : "grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  }>
                    {data.files.map((file) => (
                      <Card 
                        key={file.id} 
                        className="overflow-hidden cursor-pointer hover-elevate group"
                        onClick={() => setSelectedImage(file)}
                        data-testid={`card-image-${file.id}`}
                      >
                        <div className="aspect-square relative bg-muted">
                          <img 
                            src={file.thumbnailUrl || file.url} 
                            alt={file.title || file.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className={viewMode === 'compact' ? "h-4 w-4 text-white" : "h-6 w-6 text-white"} />
                          </div>
                          {viewMode !== 'compact' && (
                            <div className="absolute top-2 right-2">
                              {getSourceBadge(file.imageSource)}
                            </div>
                          )}
                        </div>
                        {viewMode !== 'compact' && (
                          <CardContent className="p-2">
                            <p className="text-xs truncate text-muted-foreground">{file.filename}</p>
                            {file.usageCount && file.usageCount > 0 && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Hash className="h-3 w-3" />
                                Used {file.usageCount} times
                              </p>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )
              ) : (
                <Card>
                  <CardContent className="py-10 text-center">
                    <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No images found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Images will appear here as they are generated or cached during lessons.
                    </p>
                  </CardContent>
                </Card>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>

      <AlertDialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <AlertDialogHeader className="flex-shrink-0">
            <AlertDialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Image Details
            </AlertDialogTitle>
          </AlertDialogHeader>
          
          {selectedImage && (
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-2">
              <div className="max-h-48 relative bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                <img 
                  src={selectedImage.url} 
                  alt={selectedImage.title || selectedImage.filename}
                  className="max-w-full max-h-48 object-contain"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                {(selectedImage.targetWord || selectedImage.searchQuery) && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Target Word</p>
                    <p className="font-medium text-sm">{selectedImage.targetWord || selectedImage.searchQuery}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Filename</p>
                  <p className="font-medium text-sm truncate">{selectedImage.filename}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Source</p>
                  <div>{getSourceBadge(selectedImage.imageSource)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Review Status</p>
                  <div className="flex items-center gap-2">
                    {selectedImage.isReviewed ? (
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">
                        <Check className="h-3 w-3 mr-1" />
                        Reviewed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending Review
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Dimensions</p>
                  <p className="font-medium text-sm">
                    {selectedImage.width && selectedImage.height 
                      ? `${selectedImage.width} x ${selectedImage.height}`
                      : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Size</p>
                  <p className="font-medium text-sm">{formatFileSize(selectedImage.fileSize)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Created</p>
                  <p className="font-medium text-sm flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedImage.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Usage Count</p>
                  <p className="font-medium text-sm">{selectedImage.usageCount || 0} times</p>
                </div>
                {selectedImage.language && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Language</p>
                    <p className="font-medium text-sm capitalize">{selectedImage.language}</p>
                  </div>
                )}
                {selectedImage.tags && selectedImage.tags.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedImage.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <AlertDialogFooter className="flex-shrink-0 flex-row justify-between sm:justify-between gap-2 pt-4 border-t">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedImage?.isReviewed ? "outline" : "default"}
                size="sm"
                onClick={() => selectedImage && reviewMutation.mutate({ id: selectedImage.id, isReviewed: !selectedImage.isReviewed })}
                disabled={reviewMutation.isPending}
                data-testid="button-toggle-review"
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : selectedImage?.isReviewed ? (
                  <Clock className="h-4 w-4 mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                {selectedImage?.isReviewed ? "Mark Unreviewed" : "Mark Reviewed"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedImage && window.open(selectedImage.url, '_blank')}
                data-testid="button-view-full"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View Full
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" data-testid="button-delete-image">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Image?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this image from the library. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => selectedImage && deleteMutation.mutate(selectedImage.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Delete"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <AlertDialogCancel data-testid="button-close-details">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Request New Image
            </AlertDialogTitle>
            <AlertDialogDescription>
              Generate a new AI image for a vocabulary word. The image will be added to the library for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Vocabulary Word</label>
              <input
                type="text"
                value={requestWord}
                onChange={(e) => setRequestWord(e.target.value)}
                placeholder="e.g., apple, book, house"
                className="w-full px-3 py-2 border rounded-md bg-background"
                data-testid="input-request-word"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <Select value={requestLanguage} onValueChange={setRequestLanguage}>
                <SelectTrigger data-testid="select-request-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spanish">Spanish</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                  <SelectItem value="german">German</SelectItem>
                  <SelectItem value="italian">Italian</SelectItem>
                  <SelectItem value="portuguese">Portuguese</SelectItem>
                  <SelectItem value="mandarin">Mandarin</SelectItem>
                  <SelectItem value="japanese">Japanese</SelectItem>
                  <SelectItem value="korean">Korean</SelectItem>
                  <SelectItem value="russian">Russian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => requestImageMutation.mutate({ word: requestWord, language: requestLanguage })}
              disabled={!requestWord.trim() || requestImageMutation.isPending}
              data-testid="button-submit-request"
            >
              {requestImageMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NeuralNetworkTab() {
  const { toast } = useToast();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [retractReason, setRetractReason] = useState<Record<string, string>>({});
  
  const { data: syncStats, isLoading: statsLoading } = useQuery<{
    pendingPromotions: number;
    approvedToday: number;
    lastSyncTime: string | null;
    currentEnvironment: string;
  }>({
    queryKey: ["/api/sync/stats"],
  });
  
  const { data: autoSyncStatus, isLoading: autoStatusLoading } = useQuery<{
    enabled: boolean;
    nextSyncTime: string;
    lastAutoSync: string | null;
    pendingCount: number;
  }>({
    queryKey: ["/api/sync/auto-status"],
  });
  
  const { data: schedulerStatus, isLoading: schedulerLoading, refetch: refetchScheduler } = useQuery<{
    nextSyncTime: string;
    nextSyncTimeLocal: string;
    lastSync: {
      timestamp: string;
      success: boolean;
      syncedCount?: number;
      error?: string;
    } | null;
    schedulerTimezone: string;
    scheduledHour: string;
  }>({
    queryKey: ["/api/sync/scheduler-status"],
    refetchInterval: 60000, // Refresh every minute
  });
  
  const { data: pendingPromotions, isLoading: pendingLoading, refetch: refetchPending } = useQuery<Array<{
    id: string;
    bestPracticeId: string;
    sourceEnvironment: string;
    targetEnvironment: string;
    status: string;
    submittedAt: string;
    bestPractice: {
      id: string;
      category: string;
      insight: string;
      context: string;
      source: string;
      confidenceScore: number;
    };
  }>>({
    queryKey: ["/api/sync/promotions/pending"],
  });
  
  const { data: promotionHistory, isLoading: historyLoading } = useQuery<Array<{
    id: string;
    bestPracticeId: string;
    status: string;
    submittedAt: string;
    reviewedAt: string | null;
    reviewNotes: string | null;
  }>>({
    queryKey: ["/api/sync/promotions/history", { limit: 20 }],
  });
  
  const { data: syncHistory, refetch: refetchHistory } = useQuery<Array<{
    id: string;
    operation: string;
    tableName: string;
    recordCount: number;
    status: string;
    createdAt: string;
    metadata: any;
    canRetract: boolean;
  }>>({
    queryKey: ["/api/sync/history"],
  });
  
  const { data: syncLogs } = useQuery<Array<{
    id: string;
    operation: string;
    tableName: string;
    recordCount: number;
    status: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/sync/logs", { limit: 10 }],
  });
  
  const reviewMutation = useMutation({
    mutationFn: async ({ id, approved, notes }: { id: string; approved: boolean; notes?: string }) => {
      return apiRequest("POST", `/api/sync/promotions/${id}/review`, { approved, reviewNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/promotions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/promotions/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] });
      toast({ title: "Review submitted", description: "Promotion has been reviewed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const autoSyncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/sync/auto");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/auto-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/logs"] });
      toast({ 
        title: "Auto-sync complete", 
        description: `Synced ${data.syncedCount} best practices` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });
  
  const manualTriggerMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/sync/trigger");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/auto-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/scheduler-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/logs"] });
      if (data.success) {
        toast({ 
          title: "Manual sync complete", 
          description: `Synced ${data.syncedCount} best practices` 
        });
      } else {
        toast({ 
          title: "Sync completed with issues", 
          description: data.error || "Check logs for details",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });
  
  const retractMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return apiRequest("POST", `/api/sync/retract/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] });
      toast({ title: "Retracted", description: "Best practice has been retracted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sync/export/best-practices");
      if (!response.ok) throw new Error("Export failed");
      return response.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `best-practices-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `${data.count} best practices exported` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };
  
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      tool_usage: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      teaching_style: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      pacing: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      communication: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      content: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      system: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };
  
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffMs < 0) return "Now";
    if (diffHours > 0) return `${diffHours}h ${diffMins}m`;
    return `${diffMins}m`;
  };
  
  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Nightly Sync Scheduler
          </CardTitle>
          <CardDescription>
            Automatic sync runs daily at {schedulerStatus?.scheduledHour || "3:00 AM MST"} - syncs all pending best practices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-sm text-muted-foreground">Next Scheduled Sync</p>
                <p className="font-medium">
                  {schedulerLoading ? (
                    <Skeleton className="h-5 w-32" />
                  ) : (
                    <>
                      {formatRelativeTime(schedulerStatus?.nextSyncTime || "")}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({schedulerStatus?.nextSyncTimeLocal})
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Sync Result</p>
                {schedulerLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : schedulerStatus?.lastSync ? (
                  <div className="flex items-center gap-2">
                    {schedulerStatus.lastSync.success ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Success ({schedulerStatus.lastSync.syncedCount} synced)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Failed: {schedulerStatus.lastSync.error}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(schedulerStatus.lastSync.timestamp)}
                    </span>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No sync yet</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Items</p>
                <p className="font-medium">
                  {autoStatusLoading ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    autoSyncStatus?.pendingCount || 0
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => manualTriggerMutation.mutate()}
                disabled={manualTriggerMutation.isPending}
                data-testid="button-trigger-sync"
              >
                {manualTriggerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Trigger Now
              </Button>
              <Button 
                onClick={() => autoSyncMutation.mutate()}
                disabled={autoSyncMutation.isPending || (autoSyncStatus?.pendingCount || 0) === 0}
                data-testid="button-sync-now"
              >
                {autoSyncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Sync Pending ({autoSyncStatus?.pendingCount || 0})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {statsLoading ? <Skeleton className="h-8 w-24" /> : syncStats?.currentEnvironment}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {autoStatusLoading ? <Skeleton className="h-8 w-12" /> : autoSyncStatus?.pendingCount || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Synced Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-12" /> : syncStats?.approvedToday || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {statsLoading ? <Skeleton className="h-5 w-32" /> : formatDate(syncStats?.lastSyncTime || null)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          data-testid="button-export-practices"
        >
          {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Export Best Practices
        </Button>
        <Button 
          variant="outline"
          onClick={() => {
            refetchPending();
            refetchHistory();
          }}
          data-testid="button-refresh-pending"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Pending Promotions
          </CardTitle>
          <CardDescription>
            Best practices waiting for review before syncing to other environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : !pendingPromotions?.length ? (
            <p className="text-muted-foreground text-center py-8">No pending promotions</p>
          ) : (
            <div className="space-y-4">
              {pendingPromotions.map(item => (
                <Card key={item.id} className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getCategoryColor(item.bestPractice.category)}>
                            {item.bestPractice.category.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.sourceEnvironment} → {item.targetEnvironment}
                          </span>
                        </div>
                        <p className="font-medium">{item.bestPractice.insight}</p>
                        {item.bestPractice.context && (
                          <p className="text-sm text-muted-foreground mt-1">{item.bestPractice.context}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Source: {item.bestPractice.source}</span>
                          <span>Confidence: {Math.round((item.bestPractice.confidenceScore || 0) * 100)}%</span>
                          <span>Submitted: {formatDate(item.submittedAt)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Review notes (optional)"
                        value={reviewNotes[item.id] || ""}
                        onChange={(e) => setReviewNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="flex-1"
                        data-testid={`input-review-notes-${item.id}`}
                      />
                      <Button
                        size="sm"
                        onClick={() => reviewMutation.mutate({ id: item.id, approved: true, notes: reviewNotes[item.id] })}
                        disabled={reviewMutation.isPending}
                        data-testid={`button-approve-${item.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => reviewMutation.mutate({ id: item.id, approved: false, notes: reviewNotes[item.id] })}
                        disabled={reviewMutation.isPending}
                        data-testid={`button-reject-${item.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sync History
          </CardTitle>
          <CardDescription>
            View synced items and retract if needed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!syncHistory?.length ? (
            <p className="text-muted-foreground text-center py-4">No sync operations yet</p>
          ) : (
            <div className="space-y-3">
              {syncHistory.slice(0, 15).map(log => (
                <div key={log.id} className="flex items-center justify-between gap-2 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={log.operation === "auto_sync" ? "default" : log.operation === "retract" ? "destructive" : "secondary"}>
                        {log.operation.replace("_", " ")}
                      </Badge>
                      <span className="text-sm">{log.tableName}</span>
                      <Badge variant="outline">{log.recordCount} items</Badge>
                      <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs">
                        {log.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(log.createdAt)}
                      {log.metadata?.syncedIds && (
                        <span className="ml-2">IDs: {(log.metadata.syncedIds as string[]).slice(0, 3).map(id => id.slice(0, 6)).join(", ")}...</span>
                      )}
                    </p>
                  </div>
                  {log.canRetract && log.operation !== "retract" && log.metadata?.syncedIds && (
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`button-retract-${log.id}`}
                          >
                            <Undo2 className="h-4 w-4 mr-1" />
                            Retract
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Retract Synced Items?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will mark {log.recordCount} synced best practice(s) as retracted. 
                              They will no longer be active in teaching.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-2">
                            <Input
                              placeholder="Reason for retraction (optional)"
                              value={retractReason[log.id] || ""}
                              onChange={(e) => setRetractReason(prev => ({ ...prev, [log.id]: e.target.value }))}
                              data-testid={`input-retract-reason-${log.id}`}
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                const syncedIds = log.metadata?.syncedIds as string[] || [];
                                syncedIds.forEach(id => {
                                  retractMutation.mutate({ id, reason: retractReason[log.id] });
                                });
                              }}
                              disabled={retractMutation.isPending}
                              data-testid={`button-confirm-retract-${log.id}`}
                            >
                              {retractMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Undo2 className="h-4 w-4 mr-2" />
                              )}
                              Retract Items
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Promotion History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : !promotionHistory?.length ? (
              <p className="text-muted-foreground text-center py-4">No promotion history</p>
            ) : (
              <div className="space-y-2">
                {promotionHistory.slice(0, 10).map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate flex-1">{item.bestPracticeId.slice(0, 8)}...</span>
                    <Badge variant={item.status === "approved" ? "default" : item.status === "rejected" ? "destructive" : "secondary"}>
                      {item.status}
                    </Badge>
                    <span className="text-muted-foreground">{formatDate(item.reviewedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Sync Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!syncLogs?.length ? (
              <p className="text-muted-foreground text-center py-4">No sync operations yet</p>
            ) : (
              <div className="space-y-2">
                {syncLogs.slice(0, 10).map(log => (
                  <div key={log.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{log.operation}</span>
                    <span>{log.tableName}</span>
                    <Badge variant={log.status === "success" ? "default" : "destructive"}>{log.recordCount}</Badge>
                    <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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

// ===== Reports Tab =====
interface VoiceSessionReport {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  exchangeCount: number | null;
  studentSpeakingSeconds: number | null;
  tutorSpeakingSeconds: number | null;
  ttsCharacters: number | null;
  sttSeconds: number | null;
  language: string | null;
  status: string | null;
  classId: string | null;
  isTestSession: boolean | null;
  userName: string | null;
  userEmail: string | null;
  estimatedCost: {
    tts: number;
    stt: number;
    llm: number;
    total: number;
  };
}

interface ReportsData {
  sessions: VoiceSessionReport[];
  aggregates: {
    totalSessions: number;
    totalDurationSeconds: number;
    totalDurationMinutes: number;
    totalDurationHours: number;
    totalTtsCharacters: number;
    totalSttSeconds: number;
    totalSttMinutes: number;
    totalExchanges: number;
    totalStudentSpeakingSeconds: number;
    totalTutorSpeakingSeconds: number;
    avgDurationSeconds: number;
    avgTtsCharacters: number;
    avgSttSeconds: number;
    avgExchanges: number;
  };
  estimatedCosts: {
    tts: number;
    stt: number;
    llm: number;
    total: number;
  };
  filters: {
    startDate: string | null;
    endDate: string | null;
    userId: string | null;
    classId: string | null;
    excludeTest: boolean;
    limit: number;
    offset: number;
  };
}

function ReportsTab() {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [excludeTest, setExcludeTest] = useState(true);
  const [limit, setLimit] = useState(50);
  
  // Build query URL with params
  const buildQueryUrl = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("excludeTest", excludeTest.toString());
    params.set("limit", limit.toString());
    return `/api/admin/reports/voice-sessions?${params.toString()}`;
  };
  
  const queryUrl = buildQueryUrl();
  
  const { data: reports, isLoading, refetch } = useQuery<ReportsData>({
    queryKey: [queryUrl],
  });
  
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m`;
  };
  
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Voice Session Reports
          </h2>
          <p className="text-muted-foreground">
            Timing, character counts, and cost estimates for voice tutoring sessions
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh-reports">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
                data-testid="input-end-date"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Results</label>
              <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                <SelectTrigger className="w-24" data-testid="select-limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={excludeTest}
                onCheckedChange={setExcludeTest}
                data-testid="switch-exclude-test"
              />
              <label className="text-sm">Exclude test sessions</label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setExcludeTest(true);
                setLimit(50);
              }}
              data-testid="button-clear-filters"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : reports ? (
        <>
          {/* Aggregate Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{reports.aggregates.totalSessions}</div>
                <div className="text-sm text-muted-foreground">Total Sessions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{reports.aggregates.totalDurationHours}h</div>
                <div className="text-sm text-muted-foreground">Total Duration</div>
                <div className="text-xs text-muted-foreground">{reports.aggregates.totalDurationMinutes} minutes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{formatNumber(reports.aggregates.totalTtsCharacters)}</div>
                <div className="text-sm text-muted-foreground">TTS Characters</div>
                <div className="text-xs text-muted-foreground">avg: {formatNumber(reports.aggregates.avgTtsCharacters)}/session</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{reports.aggregates.totalSttMinutes}m</div>
                <div className="text-sm text-muted-foreground">STT Processing</div>
                <div className="text-xs text-muted-foreground">{reports.aggregates.totalSttSeconds} seconds</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{reports.aggregates.totalExchanges}</div>
                <div className="text-sm text-muted-foreground">Total Exchanges</div>
                <div className="text-xs text-muted-foreground">avg: {reports.aggregates.avgExchanges}/session</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{formatDuration(reports.aggregates.avgDurationSeconds)}</div>
                <div className="text-sm text-muted-foreground">Avg Session</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{formatDuration(reports.aggregates.totalStudentSpeakingSeconds)}</div>
                <div className="text-sm text-muted-foreground">Student Speaking</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{formatDuration(reports.aggregates.totalTutorSpeakingSeconds)}</div>
                <div className="text-sm text-muted-foreground">Tutor Speaking</div>
              </CardContent>
            </Card>
          </div>
          
          {/* Estimated Costs Card */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Estimated API Costs
              </CardTitle>
              <CardDescription>
                Based on approximate pricing: TTS $0.015/1K chars, STT $0.0043/min, LLM ~$0.0005/exchange
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-lg font-semibold text-primary">{formatCurrency(reports.estimatedCosts.tts)}</div>
                  <div className="text-sm text-muted-foreground">TTS (Cartesia)</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-primary">{formatCurrency(reports.estimatedCosts.stt)}</div>
                  <div className="text-sm text-muted-foreground">STT (Deepgram)</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-primary">{formatCurrency(reports.estimatedCosts.llm)}</div>
                  <div className="text-sm text-muted-foreground">LLM (Gemini)</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-primary">{formatCurrency(reports.estimatedCosts.total)}</div>
                  <div className="text-sm font-medium">Total Estimated</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Sessions Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Session Details</CardTitle>
              <CardDescription>
                Showing {reports.sessions.length} of {reports.aggregates.totalSessions} sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">User</th>
                      <th className="text-left py-2 px-2 font-medium">Date</th>
                      <th className="text-left py-2 px-2 font-medium">Duration</th>
                      <th className="text-right py-2 px-2 font-medium">Exchanges</th>
                      <th className="text-right py-2 px-2 font-medium">TTS Chars</th>
                      <th className="text-right py-2 px-2 font-medium">STT Secs</th>
                      <th className="text-right py-2 px-2 font-medium">Est. Cost</th>
                      <th className="text-left py-2 px-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.sessions.map((session) => (
                      <tr key={session.id} className="border-b hover:bg-muted/50" data-testid={`row-session-${session.id}`}>
                        <td className="py-2 px-2">
                          <div className="font-medium">{session.userName || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{session.userEmail}</div>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {new Date(session.startedAt).toLocaleDateString()}{" "}
                          <span className="text-xs">{new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="py-2 px-2">{formatDuration(session.durationSeconds)}</td>
                        <td className="py-2 px-2 text-right">{session.exchangeCount || 0}</td>
                        <td className="py-2 px-2 text-right">{formatNumber(session.ttsCharacters || 0)}</td>
                        <td className="py-2 px-2 text-right">{session.sttSeconds || 0}</td>
                        <td className="py-2 px-2 text-right font-medium text-primary">
                          {formatCurrency(session.estimatedCost.total)}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={session.status === 'completed' ? 'default' : session.status === 'error' ? 'destructive' : 'secondary'}>
                            {session.status || 'unknown'}
                          </Badge>
                          {session.isTestSession && (
                            <Badge variant="outline" className="ml-1">test</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {reports.sessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No sessions found matching the filters
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load reports data
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Support Tab - Ticket queue and active sessions management
function SupportTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  // Fetch support tickets
  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery<{
    tickets: any[];
    total: number;
    stats: {
      pending: number;
      active: number;
      resolved: number;
      escalated: number;
    };
  }>({
    queryKey: ["/api/admin/support-tickets", { status: statusFilter, priority: priorityFilter, category: categoryFilter }],
  });

  // Update ticket status mutation
  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, updates }: { ticketId: string; updates: any }) => {
      return apiRequest("PATCH", `/api/support/tickets/${ticketId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      toast({ title: "Ticket updated" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to update ticket" });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      case 'active': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'resolved': return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'escalated': return 'bg-red-500/10 text-red-600 dark:text-red-400';
      case 'closed': return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <ArrowUp className="h-4 w-4 text-orange-500" />;
      case 'normal': return <Circle className="h-4 w-4 text-blue-500" />;
      case 'low': return <ArrowDown className="h-4 w-4 text-gray-400" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical': return <Code className="h-4 w-4" />;
      case 'billing': return <DollarSign className="h-4 w-4" />;
      case 'account': return <User className="h-4 w-4" />;
      case 'learning': return <BookOpen className="h-4 w-4" />;
      case 'pronunciation': return <Volume2 className="h-4 w-4" />;
      case 'content': return <FileText className="h-4 w-4" />;
      case 'other': return <MessageSquare className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const tickets = ticketsData?.tickets || [];
  const stats = ticketsData?.stats || { pending: 0, active: 0, resolved: 0, escalated: 0 };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="text-pending-count">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Headphones className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="text-active-count">{stats.active}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="text-resolved-count">{stats.resolved}</div>
              <div className="text-sm text-muted-foreground">Resolved</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Phone className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="text-escalated-count">{stats.escalated}</div>
              <div className="text-sm text-muted-foreground">Escalated</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Queue */}
      <CollapsibleSection 
        title="Support Ticket Queue" 
        icon={<Headphones className="h-5 w-5 text-primary" />}
        badge={ticketsData?.total?.toString()}
        defaultOpen={true}
      >
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4 mt-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-priority-filter">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="account">Account</SelectItem>
              <SelectItem value="learning">Learning</SelectItem>
              <SelectItem value="pronunciation">Pronunciation</SelectItem>
              <SelectItem value="content">Content</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchTickets()}
            data-testid="button-refresh-tickets"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Ticket List */}
        {ticketsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Headphones className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No support tickets</p>
              <p className="text-sm mt-1">Tickets from user handoffs will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Card 
                key={ticket.id} 
                className={`hover-elevate cursor-pointer transition-all ${selectedTicket === ticket.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedTicket(selectedTicket === ticket.id ? null : ticket.id)}
                data-testid={`card-ticket-${ticket.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getPriorityIcon(ticket.priority)}
                        <span className="font-medium truncate" data-testid={`text-subject-${ticket.id}`}>
                          {ticket.subject}
                        </span>
                        <Badge variant="outline" className={getStatusColor(ticket.status)}>
                          {ticket.status}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          {getCategoryIcon(ticket.category)}
                          {ticket.category}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {ticket.description}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ticket.userName || ticket.userId}
                        </span>
                        {ticket.targetLanguage && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {ticket.targetLanguage}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ticket.createdAt).toLocaleString()}
                        </span>
                        {ticket.messageCount > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket.messageCount} messages
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {ticket.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTicketMutation.mutate({ ticketId: ticket.id, updates: { status: 'active' } });
                          }}
                          data-testid={`button-activate-${ticket.id}`}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Take
                        </Button>
                      )}
                      {ticket.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTicketMutation.mutate({ ticketId: ticket.id, updates: { status: 'resolved' } });
                          }}
                          data-testid={`button-resolve-${ticket.id}`}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Ticket Details */}
                  {selectedTicket === ticket.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {ticket.handoffReason && (
                        <div>
                          <div className="text-sm font-medium mb-1">Handoff Reason</div>
                          <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                            {ticket.handoffReason}
                          </p>
                        </div>
                      )}
                      
                      {ticket.tutorContext && (
                        <div>
                          <div className="text-sm font-medium mb-1">Tutor Context</div>
                          <p className="text-sm text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">
                            {ticket.tutorContext}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTicketMutation.mutate({ ticketId: ticket.id, updates: { priority: 'urgent' } });
                          }}
                          data-testid={`button-escalate-${ticket.id}`}
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Escalate
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Open conversation link
                            if (ticket.conversationId) {
                              window.open(`/chat/${ticket.conversationId}`, '_blank');
                            }
                          }}
                          disabled={!ticket.conversationId}
                          data-testid={`button-view-conversation-${ticket.id}`}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Conversation
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Support Agent Info */}
      <CollapsibleSection 
        title="Support Agent Configuration" 
        icon={<Headphones className="h-5 w-5 text-primary" />}
        defaultOpen={false}
      >
        <Card className="mt-4">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">AI Support Agent</h4>
                  <p className="text-sm text-muted-foreground">
                    Powered by Google Cloud TTS Chirp HD for cost-effective voice support
                  </p>
                </div>
                <Badge variant="default" className="bg-green-500/10 text-green-600">Active</Badge>
              </div>
              
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-medium">Voice Provider</div>
                  <div className="text-lg">Google Cloud TTS</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-medium">Voice Model</div>
                  <div className="text-lg">Chirp HD (Journey)</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-medium">Transcription</div>
                  <div className="text-lg">Deepgram Nova-3</div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Voice configuration can be auditioned in the Voice Lab tab. The Support Agent uses a calm, 
                professional tone optimized for technical assistance and student support.
              </p>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>
    </div>
  );
}

interface DepartmentChatMessage {
  id: string;
  fromAgent: string;
  toAgent: string | null;
  eventType: string;
  subject: string;
  content: string;
  publicSummary: string | null;
  securityClassification: 'public' | 'internal' | 'daniela_summary';
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function DepartmentChatTab() {
  const { toast } = useToast();
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [newMessage, setNewMessage] = useState({
    fromAgent: "editor",
    toAgent: "",
    subject: "",
    content: "",
    publicSummary: "",
    securityClassification: "public" as "public" | "internal" | "daniela_summary",
  });

  const { data: messages, isLoading, refetch } = useQuery<DepartmentChatMessage[]>({
    queryKey: ["/api/agent-collab/chat", { classification: classificationFilter === "all" ? undefined : classificationFilter }],
    refetchInterval: 10000,
  });

  const postMessageMutation = useMutation({
    mutationFn: async (data: typeof newMessage) => {
      return apiRequest("POST", "/api/agent-collab/chat", {
        ...data,
        toAgent: data.toAgent || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Message sent" });
      setNewMessage({
        fromAgent: "editor",
        toAgent: "",
        subject: "",
        content: "",
        publicSummary: "",
        securityClassification: "public",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-collab/chat"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send message", variant: "destructive" });
    },
  });

  const getSecurityBadge = (classification: string) => {
    switch (classification) {
      case "public":
        return <Badge variant="outline" className="text-green-600 border-green-600"><Globe className="h-3 w-3 mr-1" />Public</Badge>;
      case "internal":
        return <Badge variant="outline" className="text-red-600 border-red-600"><Lock className="h-3 w-3 mr-1" />Internal</Badge>;
      case "daniela_summary":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><EyeIcon className="h-3 w-3 mr-1" />Summary Only</Badge>;
      default:
        return <Badge variant="outline">{classification}</Badge>;
    }
  };

  const getAgentBadge = (agent: string) => {
    const colors: Record<string, string> = {
      daniela: "bg-purple-500/10 text-purple-600",
      editor: "bg-blue-500/10 text-blue-600",
      assistant: "bg-green-500/10 text-green-600",
      support: "bg-orange-500/10 text-orange-600",
    };
    return <Badge className={colors[agent] || "bg-muted"}>{agent}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Secure Department Chat
          </CardTitle>
          <CardDescription>
            Security-classified messaging between AI departments. Internal messages never reach Gemini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="text-sm font-medium mb-2">Security Classifications</div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-600" />
                <span className="text-sm"><strong>Public:</strong> Daniela + Gemini see full content</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-red-600" />
                <span className="text-sm"><strong>Internal:</strong> UI only, NEVER to Gemini</span>
              </div>
              <div className="flex items-center gap-2">
                <EyeIcon className="h-4 w-4 text-yellow-600" />
                <span className="text-sm"><strong>Summary:</strong> Daniela sees summary, not details</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CollapsibleSection
        title="Send New Message"
        icon={<Send className="h-5 w-5 text-primary" />}
        defaultOpen={true}
      >
        <Card className="mt-4">
          <CardContent className="pt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">From Agent</label>
                <Select value={newMessage.fromAgent} onValueChange={(v) => setNewMessage({ ...newMessage, fromAgent: v })}>
                  <SelectTrigger data-testid="select-from-agent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor (Claude)</SelectItem>
                    <SelectItem value="daniela">Daniela (Gemini)</SelectItem>
                    <SelectItem value="assistant">Assistant (Aris)</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">To Agent (optional)</label>
                <Select value={newMessage.toAgent || "broadcast"} onValueChange={(v) => setNewMessage({ ...newMessage, toAgent: v === "broadcast" ? "" : v })}>
                  <SelectTrigger data-testid="select-to-agent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broadcast">Broadcast (All)</SelectItem>
                    <SelectItem value="daniela">Daniela</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Security Classification</label>
              <Select value={newMessage.securityClassification} onValueChange={(v) => setNewMessage({ ...newMessage, securityClassification: v as any })}>
                <SelectTrigger data-testid="select-security-classification">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3 text-green-600" />
                      Public - Visible to Daniela/Gemini
                    </div>
                  </SelectItem>
                  <SelectItem value="internal">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3 w-3 text-red-600" />
                      Internal - NEVER reaches Gemini
                    </div>
                  </SelectItem>
                  <SelectItem value="daniela_summary">
                    <div className="flex items-center gap-2">
                      <EyeIcon className="h-3 w-3 text-yellow-600" />
                      Summary Only - Requires public summary
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Subject</label>
              <Input
                value={newMessage.subject}
                onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                placeholder="Message subject..."
                data-testid="input-message-subject"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Content</label>
              <textarea
                value={newMessage.content}
                onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                placeholder="Message content... (For internal: include code/architecture details here)"
                className="w-full min-h-[100px] p-3 rounded-md border bg-background resize-y"
                data-testid="input-message-content"
              />
            </div>

            {newMessage.securityClassification === "daniela_summary" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Public Summary (for Daniela)</label>
                <textarea
                  value={newMessage.publicSummary}
                  onChange={(e) => setNewMessage({ ...newMessage, publicSummary: e.target.value })}
                  placeholder="Safe summary Daniela will see instead of full content..."
                  className="w-full min-h-[60px] p-3 rounded-md border bg-background resize-y"
                  data-testid="input-public-summary"
                />
              </div>
            )}

            <Button
              onClick={() => postMessageMutation.mutate(newMessage)}
              disabled={!newMessage.content || postMessageMutation.isPending}
              data-testid="button-send-message"
            >
              {postMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Message
            </Button>
          </CardContent>
        </Card>
      </CollapsibleSection>

      <CollapsibleSection
        title="Message Feed"
        icon={<MessageSquare className="h-5 w-5 text-primary" />}
        defaultOpen={true}
        badge={messages?.length?.toString()}
      >
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <Select value={classificationFilter} onValueChange={setClassificationFilter}>
              <SelectTrigger className="w-48" data-testid="select-filter-classification">
                <SelectValue placeholder="Filter by classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="public">Public Only</SelectItem>
                <SelectItem value="internal">Internal Only</SelectItem>
                <SelectItem value="daniela_summary">Summary Only</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-messages">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((msg) => (
                <Card key={msg.id} className="hover-elevate" data-testid={`card-message-${msg.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getAgentBadge(msg.fromAgent)}
                        {msg.toAgent && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            {getAgentBadge(msg.toAgent)}
                          </>
                        )}
                        {getSecurityBadge(msg.securityClassification)}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {msg.subject && (
                      <div className="font-medium mb-1">{msg.subject}</div>
                    )}

                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {msg.publicSummary && (
                      <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                        <div className="text-xs font-medium text-yellow-600 mb-1">
                          <EyeIcon className="h-3 w-3 inline mr-1" />
                          Daniela sees this summary:
                        </div>
                        <div className="text-sm">{msg.publicSummary}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No messages found</p>
                <p className="text-sm">Send your first secure department message above</p>
              </CardContent>
            </Card>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Types from database schema
type SprintStage = 'idea' | 'pedagogy_spec' | 'build_plan' | 'in_progress' | 'shipped';

interface FeatureSprintData {
  id: string;
  title: string;
  description: string | null;
  stage: SprintStage;
  priority: 'low' | 'medium' | 'high' | 'critical';
  featureBrief?: {
    problem?: string;
    solution?: string;
    userStory?: string;
    successMetrics?: string[];
  } | null;
  pedagogySpec?: {
    learningObjectives?: string[];
    targetProficiency?: string;
    teachingApproach?: string;
    assessmentCriteria?: string[];
    danielaGuidance?: string;
  } | null;
  buildPlan?: {
    technicalApproach?: string;
    componentsAffected?: string[];
    estimatedEffort?: string;
    dependencies?: string[];
    testingStrategy?: string;
  } | null;
  aiSuggested?: boolean | null;
  sourceConsultationId?: string | null;
  createdBy: string;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  shippedAt?: string | null;
}

interface ConsultationThreadData {
  id: string;
  title: string | null;
  topic: string | null;
  sprintId?: string | null;
  createdBy: string;
  isResolved: boolean | null;
  createdAt: string;
  updatedAt: string;
  messages?: ConsultationMessageData[];
}

interface ConsultationMessageData {
  id: string;
  threadId: string;
  role: string;
  content: string;
  responseType?: string | null;
  confidence?: number | null;
  convertedToSprintId?: string | null;
  createdAt: string;
}

function FeatureSprintTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState<'consultation' | 'sprint'>('consultation');
  const [consultationQuestion, setConsultationQuestion] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  
  const [newSprintTitle, setNewSprintTitle] = useState('');
  const [newSprintDescription, setNewSprintDescription] = useState('');
  const [showNewSprintForm, setShowNewSprintForm] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<FeatureSprintData | null>(null);

  // Fetch sprints from API
  const { data: sprints = [], isLoading: sprintsLoading, refetch: refetchSprints } = useQuery<FeatureSprintData[]>({
    queryKey: ['/api/feature-sprints'],
  });

  // Fetch consultation threads
  const { data: threads = [], refetch: refetchThreads } = useQuery<ConsultationThreadData[]>({
    queryKey: ['/api/sprint-consults'],
  });

  // Fetch messages for active thread
  const { data: activeThread } = useQuery<ConsultationThreadData>({
    queryKey: ['/api/sprint-consults', activeThreadId],
    enabled: !!activeThreadId,
  });

  // Create sprint mutation
  const createSprintMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; stage?: SprintStage }) => {
      return apiRequest("POST", "/api/feature-sprints", {
        ...data,
        createdBy: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-sprints'] });
      setNewSprintTitle('');
      setNewSprintDescription('');
      setShowNewSprintForm(false);
      toast({ title: "Sprint created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update sprint mutation
  const updateSprintMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; stage?: SprintStage; [key: string]: any }): Promise<FeatureSprintData> => {
      const result = await apiRequest("PATCH", `/api/feature-sprints/${id}`, data);
      return result as unknown as FeatureSprintData;
    },
    onSuccess: (updatedSprint) => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-sprints'] });
      if (selectedSprint?.id === updatedSprint.id) {
        setSelectedSprint(updatedSprint);
      }
      toast({ title: "Sprint updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create consultation thread mutation
  const createThreadMutation = useMutation({
    mutationFn: async (data: { title?: string; topic?: string }): Promise<ConsultationThreadData> => {
      const result = await apiRequest("POST", "/api/sprint-consults", {
        ...data,
        createdBy: user?.id,
      });
      return result as unknown as ConsultationThreadData;
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sprint-consults'] });
      setActiveThreadId(thread.id);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Add message to thread mutation
  const addMessageMutation = useMutation({
    mutationFn: async ({ threadId, role, content }: { threadId: string; role: string; content: string }) => {
      return apiRequest("POST", `/api/sprint-consults/${threadId}/messages`, { role, content });
    },
    onSuccess: () => {
      if (activeThreadId) {
        queryClient.invalidateQueries({ queryKey: ['/api/sprint-consults', activeThreadId] });
        queryClient.invalidateQueries({ queryKey: ['/api/sprint-consults'] });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Seed templates mutation
  const seedTemplatesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/sprint-templates/seed", {});
    },
    onSuccess: (data: any) => {
      toast({ title: "Templates seeded", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const consultDaniela = async () => {
    if (!consultationQuestion.trim()) {
      toast({ title: "Please enter a question", variant: "destructive" });
      return;
    }
    
    setIsConsulting(true);
    try {
      // Create thread if needed
      let threadId = activeThreadId;
      if (!threadId) {
        const thread = await createThreadMutation.mutateAsync({
          title: consultationQuestion.substring(0, 100),
          topic: "feature_design",
        });
        threadId = thread.id;
      }
      
      // Add user message
      await addMessageMutation.mutateAsync({
        threadId: threadId!,
        role: 'user',
        content: consultationQuestion,
      });

      // Call Daniela
      const data = await apiRequest("POST", "/api/agent-collab/consult-daniela", {
        question: consultationQuestion,
        context: "Founder collaboration session - seeking pedagogical insights for feature development.",
        fromAgent: "editor",
      }) as { danielaSays?: string };
      
      // Save Daniela's response
      await addMessageMutation.mutateAsync({
        threadId: threadId!,
        role: 'assistant',
        content: data.danielaSays || "No response received",
      });
      
      setConsultationQuestion('');
      refetchThreads();
      toast({ title: "Daniela responded" });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to consult Daniela", 
        variant: "destructive" 
      });
    } finally {
      setIsConsulting(false);
    }
  };

  const convertToSprint = async (message: ConsultationMessageData, question: string) => {
    try {
      await createSprintMutation.mutateAsync({
        title: `Sprint from: ${question.substring(0, 50)}...`,
        description: question,
        stage: 'idea',
      });
      setMode('sprint');
      toast({ title: "Created sprint from consultation" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const createNewSprint = () => {
    if (!newSprintTitle.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }
    createSprintMutation.mutate({
      title: newSprintTitle,
      description: newSprintDescription,
      stage: 'idea',
    });
  };

  const moveSprintToStage = (sprintId: string, newStage: SprintStage) => {
    updateSprintMutation.mutate({ id: sprintId, stage: newStage });
  };

  const stageOrder: SprintStage[] = ['idea', 'pedagogy_spec', 'build_plan', 'in_progress', 'shipped'];
  const stageLabels: Record<SprintStage, string> = {
    idea: 'Idea',
    pedagogy_spec: 'Pedagogy Spec',
    build_plan: 'Build Plan',
    in_progress: 'In Progress',
    shipped: 'Shipped',
  };
  const stageColors: Record<SprintStage, string> = {
    idea: 'bg-blue-500/10 border-blue-500/30',
    pedagogy_spec: 'bg-purple-500/10 border-purple-500/30',
    build_plan: 'bg-orange-500/10 border-orange-500/30',
    in_progress: 'bg-yellow-500/10 border-yellow-500/30',
    shipped: 'bg-green-500/10 border-green-500/30',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Feature Sprint
          </CardTitle>
          <CardDescription>
            Rapid feature development with Daniela (pedagogy) and Editor (implementation)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant={mode === 'consultation' ? 'default' : 'outline'}
              onClick={() => setMode('consultation')}
              data-testid="button-mode-consultation"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Consultation
            </Button>
            <Button
              variant={mode === 'sprint' ? 'default' : 'outline'}
              onClick={() => setMode('sprint')}
              data-testid="button-mode-sprint"
            >
              <Zap className="h-4 w-4 mr-2" />
              Sprint Board
            </Button>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            {mode === 'consultation' ? (
              <>
                <strong>Consultation Mode:</strong> Ask Daniela open-ended questions about pedagogy, 
                student learning patterns, or feature ideas. Get insights before committing to a sprint.
              </>
            ) : (
              <>
                <strong>Sprint Mode:</strong> Track feature development through stages: 
                Idea → Pedagogy Spec → Build Plan → In Progress → Shipped
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {mode === 'consultation' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Ask Daniela
                </CardTitle>
                <div className="flex gap-2">
                  {activeThreadId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveThreadId(null)}
                      data-testid="button-new-thread"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New Thread
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => seedTemplatesMutation.mutate()}
                    disabled={seedTemplatesMutation.isPending}
                    data-testid="button-seed-templates"
                  >
                    {seedTemplatesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeThread?.messages && activeThread.messages.length > 0 && (
                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto p-2 border rounded-lg bg-muted/30">
                  {activeThread.messages.map((msg) => (
                    <div key={msg.id} className={`p-2 rounded-md ${msg.role === 'user' ? 'bg-background' : 'bg-purple-500/10'}`}>
                      <div className="text-xs text-muted-foreground mb-1">
                        {msg.role === 'user' ? 'You' : 'Daniela'} • {new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <textarea
                  value={consultationQuestion}
                  onChange={(e) => setConsultationQuestion(e.target.value)}
                  placeholder="Ask Daniela about pedagogy, learning patterns, or feature ideas...

Examples:
• Are there any missing tools that would enhance student learning?
• How could we better support tonal language learners?
• What patterns do you see in student struggles with grammar?"
                  className="w-full min-h-[120px] p-3 rounded-md border bg-background resize-y"
                  data-testid="input-consultation-question"
                />
              </div>
              <Button
                onClick={consultDaniela}
                disabled={isConsulting || !consultationQuestion.trim()}
                data-testid="button-ask-daniela"
              >
                {isConsulting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Ask Daniela
              </Button>
            </CardContent>
          </Card>

          {threads.length > 0 && (
            <CollapsibleSection
              title="Consultation Threads"
              icon={<Clock className="h-5 w-5 text-primary" />}
              defaultOpen={true}
              badge={threads.length.toString()}
            >
              <div className="space-y-2 mt-4">
                {threads.map((thread) => {
                  const lastUserMsg = thread.messages?.filter(m => m.role === 'user').pop();
                  const lastAssistantMsg = thread.messages?.filter(m => m.role === 'assistant').pop();
                  return (
                    <Card 
                      key={thread.id} 
                      className={`cursor-pointer hover-elevate ${activeThreadId === thread.id ? 'border-primary' : ''}`}
                      onClick={() => setActiveThreadId(thread.id)}
                      data-testid={`card-thread-${thread.id}`}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{thread.title || 'Untitled Thread'}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {lastUserMsg?.content.substring(0, 80)}...
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-xs">
                              {thread.messages?.length || 0} msgs
                            </Badge>
                            {lastAssistantMsg && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  convertToSprint(lastAssistantMsg, lastUserMsg?.content || thread.title || '');
                                }}
                                data-testid={`button-convert-thread-${thread.id}`}
                              >
                                <Zap className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Sprint Board</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchSprints()}
                data-testid="button-refresh-sprints"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => setShowNewSprintForm(true)}
                data-testid="button-new-sprint"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Sprint
              </Button>
            </div>
          </div>

          {showNewSprintForm && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Input
                  value={newSprintTitle}
                  onChange={(e) => setNewSprintTitle(e.target.value)}
                  placeholder="Sprint title..."
                  data-testid="input-sprint-title"
                />
                <textarea
                  value={newSprintDescription}
                  onChange={(e) => setNewSprintDescription(e.target.value)}
                  placeholder="Description..."
                  className="w-full min-h-[80px] p-3 rounded-md border bg-background resize-y"
                  data-testid="input-sprint-description"
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={createNewSprint} 
                    disabled={createSprintMutation.isPending}
                    data-testid="button-create-sprint"
                  >
                    {createSprintMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNewSprintForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {sprintsLoading ? (
            <div className="grid grid-cols-5 gap-3">
              {stageOrder.map((stage) => (
                <Skeleton key={stage} className="h-48" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {stageOrder.map((stage) => (
                <div key={stage} className={`rounded-lg border p-3 ${stageColors[stage]}`}>
                  <div className="font-medium text-sm mb-3 flex items-center justify-between">
                    {stageLabels[stage]}
                    <Badge variant="secondary" className="text-xs">
                      {sprints.filter(s => s.stage === stage).length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {sprints
                      .filter(s => s.stage === stage)
                      .map(sprint => (
                        <Card 
                          key={sprint.id} 
                          className="cursor-pointer hover-elevate"
                          onClick={() => setSelectedSprint(sprint)}
                          data-testid={`card-sprint-${sprint.id}`}
                        >
                          <CardContent className="p-2">
                            <div className="font-medium text-sm truncate">{sprint.title}</div>
                            {sprint.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {sprint.description}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedSprint && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedSprint.title}</CardTitle>
                  <Button size="icon" variant="ghost" onClick={() => setSelectedSprint(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Badge className={stageColors[selectedSprint.stage]}>
                  {stageLabels[selectedSprint.stage]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="font-medium text-sm mb-1">Description</div>
                  <div className="text-muted-foreground">{selectedSprint.description || 'No description'}</div>
                </div>
                
                {selectedSprint.pedagogySpec?.danielaGuidance && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="font-medium text-sm text-purple-600 mb-1">Daniela's Guidance</div>
                    <div className="text-sm whitespace-pre-wrap">{selectedSprint.pedagogySpec.danielaGuidance}</div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Move to:</span>
                  {stageOrder.map(stage => (
                    <Button
                      key={stage}
                      size="sm"
                      variant={selectedSprint.stage === stage ? 'default' : 'outline'}
                      disabled={selectedSprint.stage === stage || updateSprintMutation.isPending}
                      onClick={() => moveSprintToStage(selectedSprint.id, stage)}
                      data-testid={`button-move-to-${stage}`}
                    >
                      {stageLabels[stage]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {sprints.length === 0 && !showNewSprintForm && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No sprints yet</p>
                <p className="text-sm">Start by consulting Daniela or create a new sprint</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}