import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Search, RotateCcw, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    users: Array<any>;
    total: number;
  }>({
    queryKey: ["/api/admin/users", { role: roleFilter || undefined }],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to start impersonation",
        variant: "destructive",
      });
    },
  });

  const resetLearningDataMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiRequest("POST", `/api/admin/users/${targetUserId}/reset-learning-data`, {});
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Learning data reset", 
        description: data.message || "User learning data has been reset"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset learning data",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = data?.users.filter((user) =>
    searchQuery
      ? (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
  );

  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage user accounts, roles, and permissions
            </p>
          </div>

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
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="developer">Developers</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users ({data?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
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
                            <div className="font-medium">
                              {user.firstName || user.lastName
                                ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                                : user.email}
                            </div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Select
                            value={user.role}
                            onValueChange={(newRole) =>
                              updateRoleMutation.mutate({ userId: user.id, newRole })
                            }
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
                                  This will permanently delete all learning data for {user.firstName || user.email}, including:
                                  <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>All vocabulary words</li>
                                    <li>All conversations and messages</li>
                                    <li>All progress and ACTFL levels</li>
                                    <li>All lessons and bundles</li>
                                  </ul>
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
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </RoleGuard>
  );
}
