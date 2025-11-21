import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useLogout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserCircle, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Link } from "wouter";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Chat from "@/pages/chat";
import ChatIdeas from "@/pages/chat-ideas";
import CulturalTips from "@/pages/cultural-tips";
import Vocabulary from "@/pages/vocabulary";
import Grammar from "@/pages/grammar";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

// Wrapper component that adds container padding for non-chat pages
function PageWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const fullHeightPages = ["/", "/chat"];
  const isFullHeightPage = fullHeightPages.includes(location);

  if (isFullHeightPage) {
    return <div className="flex flex-col h-full">{children}</div>;
  }

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      {children}
    </div>
  );
}

// Replit Auth Integration - Router with authentication check
function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // For unauthenticated users, show landing page
  if (isLoading || !isAuthenticated) {
    return (
      <PageWrapper>
        <Switch>
          <Route path="/" component={Landing} />
          <Route component={NotFound} />
        </Switch>
      </PageWrapper>
    );
  }

  // For authenticated users, always define all routes
  // Onboarding redirection is handled inside the Dashboard component
  return (
    <PageWrapper>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/chat" component={Chat} />
        <Route path="/chat-ideas" component={ChatIdeas} />
        <Route path="/cultural-tips" component={CulturalTips} />
        <Route path="/vocabulary" component={Vocabulary} />
        <Route path="/grammar" component={Grammar} />
        <Route path="/history" component={History} />
        <Route path="/settings" component={Settings} />
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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthenticatedApp style={style} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
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
      <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          {/* Hide sidebar on mobile (< md breakpoint), show on desktop */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-3 md:p-4 border-b sticky top-0 z-50 bg-background">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="md:flex" />
              <div className="flex items-center gap-2 md:gap-3">
                <ThemeToggle />
                <UserMenu />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>
        <PWAInstallPrompt />
      </SidebarProvider>
    </LanguageProvider>
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
