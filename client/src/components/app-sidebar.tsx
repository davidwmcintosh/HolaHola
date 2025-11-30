import { MessageSquare, BookOpen, Languages, History, Settings, Lightbulb, LogOut, Globe, Award, GraduationCap, Users, ClipboardList, BookOpenCheck, Library, Shield, X, Volume2, Target, ChevronDown, User, Search } from "lucide-react";
import linguaflowLogo from "@assets/LF_no_words_no_background_1764099068542.png";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StreakIndicator } from "@/components/StreakIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { useAuth } from "@/hooks/useAuth";
import { forceNewConversation } from "@/lib/queryClient";
import { hasTeacherAccess, hasAdminAccess } from "@shared/permissions";

const dashboardItem = { title: "Dashboard", url: "/", icon: Target };

const learnMenuItems = [
  { title: "Call Tutor", url: "/chat", icon: MessageSquare },
];

const libraryMenuItems = [
  { title: "Vocabulary", url: "/vocabulary", icon: BookOpen },
  { title: "Grammar", url: "/grammar", icon: Languages },
  { title: "Past Chats", url: "/history", icon: History },
  { title: "Can-Do Progress", url: "/can-do-progress", icon: Award },
];

const resourceMenuItems = [
  { title: "Cultural Tips", url: "/cultural-tips", icon: Globe },
  { title: "Chat Ideas", url: "/chat-ideas", icon: Lightbulb },
];

const teacherMenuItems = [
  { title: "Teacher Dashboard", url: "/teacher/dashboard", icon: GraduationCap },
  { title: "Curriculum Library", url: "/teacher/curriculum", icon: Library },
  { title: "Curriculum Builder", url: "/teacher/curriculum/builder", icon: BookOpenCheck },
];

const studentMenuItems = [
  { title: "Find a Class", url: "/student/join-class", icon: Search },
];

const adminMenuItems = [
  { title: "Admin Dashboard", url: "/admin", icon: Shield },
  { title: "User Management", url: "/admin/users", icon: Users },
  { title: "Class Management", url: "/admin/classes", icon: GraduationCap },
  { title: "Reports & Audit", url: "/admin/reports", icon: ClipboardList },
  { title: "Voice Console", url: "/admin/voices", icon: Volume2 },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { userName, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const { setOpenMobile, setOpen, isMobile } = useSidebar();
  const { getTutorContexts, setLearningContext } = useLearningFilter();
  
  // Get available tutor contexts
  const tutorContexts = getTutorContexts();
  const hasMultipleTutorContexts = tutorContexts.length > 1;
  
  // Auto-close sidebar when a menu item is clicked (both mobile and desktop)
  const closeSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };
  
  // Handle tutor selection from dropdown
  const handleTutorSelect = (context: { id: string; language: string; type: "self-directed" | "class" }) => {
    // Set the language context
    setLanguage(context.language);
    // Set the learning context (self-directed or class ID)
    setLearningContext(context.type === "self-directed" ? "self-directed" : context.id);
    // Force new conversation
    forceNewConversation();
    // Navigate to chat
    closeSidebar();
    setLocation("/chat");
  };
  
  // Hide Chat Ideas until onboarding is complete
  const isOnboardingComplete = userName && userName.trim() !== "";
  const visibleResourceItems = resourceMenuItems.filter(item => {
    if (item.title === "Chat Ideas" && !isOnboardingComplete) {
      return false;
    }
    return true;
  });

  // Check if user has teacher access (admin, developer, or teacher)
  const isTeacher = hasTeacherAccess(user?.role);
  // Check if user has admin access (admin only - for admin menu)
  const isAdmin = hasAdminAccess(user?.role);
  // Show student features for all users (teachers can also be students)
  const showStudentFeatures = true;

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <img 
              src={linguaflowLogo} 
              alt="LinguaFlow" 
              className="h-20 w-20 object-contain -ml-3 -my-2"
              data-testid="img-logo"
            />
            <div>
              <h1 className="text-xl font-semibold">LinguaFlow</h1>
              <p className="text-sm text-muted-foreground">Learn & Practice</p>
            </div>
          </div>
          {/* Close button - only visible on mobile */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpenMobile(false)}
              className="h-8 w-8"
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild
                  isActive={location === dashboardItem.url}
                  data-testid="link-dashboard"
                >
                  <Link href={dashboardItem.url} onClick={closeSidebar}>
                    <dashboardItem.icon className="h-4 w-4" />
                    <span>{dashboardItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Learn</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {hasMultipleTutorContexts ? (
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={`flex items-center justify-between w-full gap-2 h-auto px-2 py-2 text-sm font-medium ${
                          location === "/chat" ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                        }`}
                        data-testid="dropdown-call-tutor"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          <span>Call Tutor</span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {tutorContexts.map((ctx) => (
                        <DropdownMenuItem
                          key={ctx.id}
                          onClick={() => handleTutorSelect(ctx)}
                          className="cursor-pointer"
                          data-testid={`option-tutor-${ctx.id}`}
                        >
                          <div className="flex items-center gap-2">
                            {ctx.type === "self-directed" ? (
                              <User className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <GraduationCap className="h-4 w-4 text-primary" />
                            )}
                            <span className="truncate">{ctx.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ) : (
                learnMenuItems.map((item) => {
                  const isActive = location === item.url;
                  const handleClick = () => {
                    if (item.title === "Call Tutor") {
                      forceNewConversation();
                    }
                    closeSidebar();
                  };
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        isActive={isActive}
                        data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}
                      >
                        <Link href={item.url} onClick={handleClick}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {libraryMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}
                    >
                      <Link href={item.url} onClick={closeSidebar}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleResourceItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}
                    >
                      <Link href={item.url} onClick={closeSidebar}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showStudentFeatures && (
          <SidebarGroup>
            <SidebarGroupLabel>Classes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {studentMenuItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        isActive={isActive}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Link href={item.url} onClick={closeSidebar}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isTeacher && (
          <SidebarGroup>
            <SidebarGroupLabel>Teaching</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {teacherMenuItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        isActive={isActive}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Link href={item.url} onClick={closeSidebar}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => {
                  const isActive = location === item.url || location.startsWith(item.url + '/');
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        isActive={isActive}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Link href={item.url} onClick={closeSidebar}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-6 space-y-4">
        <div className="px-2">
          <StreakIndicator compact />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="link-settings">
              <Link href="/settings" onClick={closeSidebar}>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                closeSidebar();
                window.location.href = '/api/logout';
              }}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
