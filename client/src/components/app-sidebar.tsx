import { MessageSquare, BookOpen, Languages, History, Home, Settings, Lightbulb, LogOut, Globe, Award, GraduationCap, Users, ClipboardList, BookOpenCheck, Library, Shield, X, FolderOpen, Volume2, Target } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StreakIndicator } from "@/components/StreakIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Review Hub", url: "/review", icon: Target },
  { title: "Call Tutor", url: "/chat", icon: MessageSquare },
  { title: "Chat Ideas", url: "/chat-ideas", icon: Lightbulb },
  { title: "Vocabulary", url: "/vocabulary", icon: BookOpen },
  { title: "Grammar", url: "/grammar", icon: Languages },
  { title: "Can-Do Progress", url: "/can-do-progress", icon: Award },
  { title: "Past Chats", url: "/history", icon: History },
  { title: "My Lessons", url: "/lessons", icon: FolderOpen },
  { title: "Cultural Tips", url: "/cultural-tips", icon: Globe },
];

const teacherMenuItems = [
  { title: "Teacher Dashboard", url: "/teacher/dashboard", icon: GraduationCap },
  { title: "Curriculum Library", url: "/teacher/curriculum", icon: Library },
  { title: "Curriculum Builder", url: "/teacher/curriculum/builder", icon: BookOpenCheck },
];

const studentMenuItems = [
  { title: "Join Class", url: "/student/join-class", icon: Users },
  { title: "My Assignments", url: "/student/assignments", icon: ClipboardList },
];

const adminMenuItems = [
  { title: "Admin Dashboard", url: "/admin", icon: Shield },
  { title: "User Management", url: "/admin/users", icon: Users },
  { title: "Class Management", url: "/admin/classes", icon: GraduationCap },
  { title: "Reports & Audit", url: "/admin/reports", icon: ClipboardList },
  { title: "Voice Console", url: "/admin/voices", icon: Volume2 },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { userName } = useLanguage();
  const { user } = useAuth();
  const { setOpenMobile, setOpen, isMobile } = useSidebar();
  
  // Auto-close sidebar when a menu item is clicked (both mobile and desktop)
  const closeSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };
  
  // Hide Chat Ideas until onboarding is complete
  const isOnboardingComplete = userName && userName.trim() !== "";
  const visibleMenuItems = menuItems.filter(item => {
    if (item.title === "Chat Ideas" && !isOnboardingComplete) {
      return false;
    }
    return true;
  });

  // Check if user is a teacher (role is 'teacher', 'developer', or 'admin')
  const isTeacher = user?.role === 'teacher' || user?.role === 'developer' || user?.role === 'admin';
  // Check if user is admin or developer (for admin menu)
  const isAdminOrDeveloper = user?.role === 'admin' || user?.role === 'developer';
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
          <SidebarGroupLabel>Learning</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => {
                const isActive = location === item.url;
                const handleClick = (e: React.MouseEvent) => {
                  if (item.title === "Call Tutor") {
                    localStorage.setItem('forceNewConversation', 'true');
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
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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

        {isAdminOrDeveloper && (
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
