import { MessageSquare, BookOpen, Languages, History, Home, Settings, Lightbulb, LogOut, Globe, Award, GraduationCap, Users, ClipboardList, BookOpenCheck, Library } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { StreakIndicator } from "@/components/StreakIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Call Tutor", url: "/chat", icon: MessageSquare },
  { title: "Chat Ideas", url: "/chat-ideas", icon: Lightbulb },
  { title: "Vocabulary", url: "/vocabulary", icon: BookOpen },
  { title: "Grammar", url: "/grammar", icon: Languages },
  { title: "Can-Do Progress", url: "/can-do-progress", icon: Award },
  { title: "Past Chats", url: "/history", icon: History },
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

export function AppSidebar() {
  const [location] = useLocation();
  const { userName } = useLanguage();
  const { user } = useAuth();
  
  // Hide Chat Ideas until onboarding is complete
  const isOnboardingComplete = userName && userName.trim() !== "";
  const visibleMenuItems = menuItems.filter(item => {
    if (item.title === "Chat Ideas" && !isOnboardingComplete) {
      return false;
    }
    return true;
  });

  // Check if user is a teacher (role is 'teacher' or 'admin')
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  // Show student features for all users (teachers can also be students)
  const showStudentFeatures = true;

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Languages className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">LinguaFlow</h1>
            <p className="text-sm text-muted-foreground">Learn & Practice</p>
          </div>
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
                        <Link href={item.url}>
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
                        <Link href={item.url}>
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
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => window.location.href = '/api/logout'}
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
