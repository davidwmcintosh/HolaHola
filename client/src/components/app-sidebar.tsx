import { MessageSquare, BookOpen, Languages, History, Home, Settings, Lightbulb, Globe } from "lucide-react";
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

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Practice Chat", url: "/chat", icon: MessageSquare },
  { title: "Chat Ideas", url: "/chat-ideas", icon: Lightbulb },
  { title: "Cultural Tips", url: "/cultural-tips", icon: Globe },
  { title: "Vocabulary", url: "/vocabulary", icon: BookOpen },
  { title: "Grammar", url: "/grammar", icon: Languages },
  { title: "History", url: "/history", icon: History },
];

export function AppSidebar() {
  const [location] = useLocation();

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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
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
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
