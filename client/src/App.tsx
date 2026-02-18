import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LearningFilterProvider } from "@/contexts/LearningFilterContext";
import { UsageProvider } from "@/contexts/UsageContext";
import { useAuth } from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useLogout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserCircle, Settings as SettingsIcon, LogOut, Loader2, Menu } from "lucide-react";
import { Link } from "wouter";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { SystemAlertBanner } from "@/components/SystemAlertBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PendingJoinCodeHandler } from "@/components/PendingJoinCodeHandler";
import { BUILD_TIME } from "./buildtime";

// Lazy load all page components for code splitting
const Landing = lazy(() => import("@/pages/Landing"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Chat = lazy(() => import("@/pages/chat"));
const ChatIdeas = lazy(() => import("@/pages/chat-ideas"));
const CulturalTips = lazy(() => import("@/pages/cultural-tips"));
const Vocabulary = lazy(() => import("@/pages/vocabulary"));
const Grammar = lazy(() => import("@/pages/grammar"));
const History = lazy(() => import("@/pages/history"));
const CanDoProgress = lazy(() => import("@/pages/can-do-progress"));
const Settings = lazy(() => import("@/pages/settings"));
const TeacherDashboard = lazy(() => import("@/pages/teacher-dashboard"));
const ClassManagement = lazy(() => import("@/pages/class-management"));
const AssignmentCreator = lazy(() => import("@/pages/assignment-creator"));
const AssignmentGrading = lazy(() => import("@/pages/assignment-grading"));
const StudentJoinClass = lazy(() => import("@/pages/student-join-class"));
const StudentAssignments = lazy(() => import("@/pages/student-assignments"));
const CurriculumBuilder = lazy(() => import("@/pages/curriculum-builder"));
const CurriculumLibrary = lazy(() => import("@/pages/curriculum-library"));
const ClassCreationHub = lazy(() => import("@/pages/class-creation-hub"));
const CommandCenter = lazy(() => import("@/pages/admin/CommandCenter"));
const MissionControl = lazy(() => import("@/pages/admin/MissionControl"));
const AdminVoiceConsole = lazy(() => import("@/pages/admin/VoiceConsole"));
const AdminNorthStar = lazy(() => import("@/pages/admin/NorthStar"));
const AdminDeveloperDashboard = lazy(() => import("@/pages/admin/DeveloperDashboard"));
const AdminBrainHealth = lazy(() => import("@/pages/admin/BrainHealth"));
const AdminSessionEconomics = lazy(() => import("@/pages/admin/SessionEconomics"));
const Lessons = lazy(() => import("@/pages/lessons"));
const ReviewHub = lazy(() => import("@/pages/review-hub"));
const ArisPractice = lazy(() => import("@/pages/aris-practice"));
const ScenarioBrowser = lazy(() => import("@/pages/scenario-browser"));
const PronunciationDrill = lazy(() => import("@/pages/pronunciation-drill"));
const SessionReplay = lazy(() => import("@/pages/session-replay"));
const InteractiveTextbook = lazy(() => import("@/pages/interactive-textbook"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Auth pages
const Login = lazy(() => import("@/pages/auth/Login"));
const Signup = lazy(() => import("@/pages/auth/Signup"));
const GetStarted = lazy(() => import("@/pages/auth/GetStarted"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Classes = lazy(() => import("@/pages/Classes"));
const ClassDetail = lazy(() => import("@/pages/ClassDetail"));
const CompleteRegistration = lazy(() => import("@/pages/auth/CompleteRegistration"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// ScrollToTop component to reset scroll position on route changes
function ScrollToTop() {
  const [pathname] = useLocation();

  useEffect(() => {
    // Standard window scroll for most cases
    window.scrollTo(0, 0);
    
    // Also target the scrollable container in PageWrapper if it exists
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}

// Wrapper component that adds container padding for non-chat pages
function PageWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  
  // Only chat page is full-height for authenticated users
  // Landing page (/) is full-height for unauthenticated users
  const isFullHeightPage = location === "/chat" || location === "/admin/mission" || (!isAuthenticated && !isLoading && location === "/");

  const content = (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );

  if (isFullHeightPage) {
    return <div className="flex flex-col h-full">{content}</div>;
  }

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full px-4 py-6 md:px-8 mx-auto md:max-w-7xl overflow-hidden">
        {content}
      </div>
    </div>
  );
}

// Replit Auth Integration - Router with authentication check
function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentPath] = useLocation();

  useEffect(() => {
    console.log(`[Router] Render: path=${currentPath}, auth=${isAuthenticated}, loading=${isLoading}`);
  }, [currentPath, isAuthenticated, isLoading]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return <PageLoader />;
  }

  // For unauthenticated users, show landing page and auth routes
  if (!isAuthenticated) {
    return (
      <PageWrapper>
        <ScrollToTop />
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/get-started" component={GetStarted} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/classes" component={Classes} />
          <Route path="/classes/:id" component={ClassDetail} />
          <Route path="/complete-registration" component={CompleteRegistration} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route component={NotFound} />
        </Switch>
      </PageWrapper>
    );
  }

  // For authenticated users, always define all routes
  // ReviewHub is the main landing page (Language Hub)
  return (
    <PageWrapper>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={ReviewHub} />
        <Route path="/dashboard" component={ReviewHub} />
        <Route path="/legacy-dashboard" component={Dashboard} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/chat" component={Chat} />
        {/* Voice tutor route aliases - all redirect to /chat */}
        <Route path="/voice-tutor"><Redirect to="/chat" /></Route>
        <Route path="/voice"><Redirect to="/chat" /></Route>
        <Route path="/tutor"><Redirect to="/chat" /></Route>
        <Route path="/chat-ideas" component={ChatIdeas} />
        <Route path="/cultural-tips" component={CulturalTips} />
        <Route path="/vocabulary" component={Vocabulary} />
        <Route path="/grammar" component={Grammar} />
        <Route path="/history" component={History} />
        <Route path="/can-do-progress" component={CanDoProgress} />
        <Route path="/lessons" component={Lessons} />
        <Route path="/practice" component={ArisPractice} />
        <Route path="/scenarios" component={ScenarioBrowser} />
        <Route path="/aris" component={ArisPractice} />
        <Route path="/pronunciation" component={PronunciationDrill} />
        <Route path="/pronunciation-drill" component={PronunciationDrill} />
        <Route path="/session-replay" component={SessionReplay} />
        <Route path="/interactive-textbook" component={InteractiveTextbook} />
        
        {/* Teacher Routes - Protected */}
        <Route path="/teacher/dashboard" component={TeacherDashboard} />
        <Route path="/teacher" component={TeacherDashboard} />
        <Route path="/teacher/classes/:classId" component={ClassManagement} />
        <Route path="/teacher/assignments/new" component={AssignmentCreator} />
        <Route path="/teacher/assignments/create" component={AssignmentCreator} />
        <Route path="/teacher/assignments/:assignmentId/grade" component={AssignmentGrading} />
        <Route path="/teacher/create-class" component={ClassCreationHub} />
        <Route path="/teacher/curriculum" component={CurriculumLibrary} />
        <Route path="/teacher/curriculum/builder" component={CurriculumBuilder} />
        
        {/* Student Routes */}
        <Route path="/student/join-class" component={StudentJoinClass} />
        <Route path="/student/assignments" component={StudentAssignments} />
        
        {/* Admin Routes - specific paths before /admin catch-all */}
        <Route path="/admin/mission" component={MissionControl} />
        <Route path="/admin/voices" component={AdminVoiceConsole} />
        <Route path="/admin/north-star" component={AdminNorthStar} />
        <Route path="/admin/developer" component={AdminDeveloperDashboard} />
        <Route path="/admin/brain-health" component={AdminBrainHealth} />
        <Route path="/admin/session-economics" component={AdminSessionEconomics} />
        <Route path="/admin" component={CommandCenter} />
        
        <Route path="/settings" component={Settings} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/classes" component={Classes} />
        <Route path="/classes/:id" component={ClassDetail} />
        
        {/* Auth routes - accessible even when logged in for account management */}
        <Route path="/complete-registration" component={CompleteRegistration} />
        <Route path="/login"><Redirect to="/" /></Route>
        <Route path="/signup"><Redirect to="/" /></Route>
        
        <Route component={NotFound} />
      </Switch>
    </PageWrapper>
  );
}

function App() {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  // Force cache bust
  console.log('[BUILD] App version:', BUILD_TIME);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthenticatedApp style={style} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Separate authenticated app component to use auth hooks
function AuthenticatedApp({ style }: { style: { [key: string]: string } }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show landing page for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return <Router />;
  }

  // Show full app with sidebar for authenticated users
  return (
    <LanguageProvider>
      <UsageProvider>
        <LearningFilterProvider>
          <PendingJoinCodeHandler />
          <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
            <div className="flex h-screen w-full max-w-full overflow-hidden">
              {/* Sidebar renders as Sheet overlay on mobile, regular sidebar on desktop */}
              <AppSidebar />
              <div className="flex flex-col flex-1 relative min-w-0 overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                  <Router />
                </main>
                {/* Floating menu button - works on all screen sizes */}
                <FloatingMenuButton />
              </div>
            </div>
            <OfflineIndicator />
            <SystemAlertBanner />
            <PWAInstallPrompt />
          </SidebarProvider>
        </LearningFilterProvider>
      </UsageProvider>
    </LanguageProvider>
  );
}

// Floating menu button - works on all screen sizes
// Uses fixed positioning with safe area insets for mobile devices
function FloatingMenuButton() {
  const { toggleSidebar } = useSidebar();
  
  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed z-50 h-12 w-12 rounded-full shadow-lg bg-background border-2 bottom-20 sm:bottom-4 left-[max(1rem,env(safe-area-inset-left))]"
      onClick={toggleSidebar}
      data-testid="button-toggle-sidebar"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

function UserMenu() {
  const { user } = useAuth();
  const logoutMutation = useLogout();

  if (!user) return null;

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user.firstName
    ? user.firstName[0].toUpperCase()
    : user.email?.[0]?.toUpperCase() || "U";

  const displayName = user.firstName
    ? user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName
    : user.email || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 md:h-10 w-8 md:w-10 rounded-full" data-testid="button-user-menu">
          <Avatar className="h-8 md:h-10 w-8 md:w-10">
            {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} alt={displayName} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium" data-testid="text-user-name">{displayName}</p>
            {user.email && (
              <p className="text-xs text-muted-foreground" data-testid="text-user-email">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild data-testid="menu-item-settings">
          <Link href="/settings">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => logoutMutation.mutate()} 
          disabled={logoutMutation.isPending}
          data-testid="menu-item-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default App;
