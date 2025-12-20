import { useUser } from "@/lib/auth";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, GraduationCap, FileText, Shield, Mic, Tags, Code, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/classes", label: "Classes", icon: GraduationCap },
  { href: "/admin/class-types", label: "Class Types", icon: Tags },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/voices", label: "Voice Console", icon: Mic },
  { href: "/admin/north-star", label: "North Star", icon: Compass },
  { href: "/admin/developer", label: "Developer", icon: Code },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user } = useUser();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {user?.impersonatedUserId && (
        <ImpersonationBanner 
          targetUserEmail={user.email || "Unknown User"} 
          targetUserId={user.impersonatedUserId}
        />
      )}
      
      <div className="flex">
        <aside className="w-64 min-h-screen border-r bg-card p-4">
          <div className="flex items-center gap-2 mb-6 px-2">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Admin Panel</h2>
          </div>
          
          <nav className="space-y-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "hover-elevate active-elevate-2"
                  )}
                  data-testid={`link-admin-${item.label.toLowerCase()}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
