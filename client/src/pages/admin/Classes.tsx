import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Users, Star, Award, Briefcase, Zap, Plane, Globe, Compass } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface ClassType {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface AdminClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  joinCode: string;
  isActive: boolean;
  isPublicCatalogue: boolean;
  isFeatured: boolean;
  classTypeId: string | null;
  tutorFreedomLevel: 'guided' | 'flexible_goals' | 'open_exploration' | 'free_conversation' | null;
  enrollmentCount: number;
  teacher?: {
    firstName: string | null;
    email: string;
  };
}

const FREEDOM_LEVELS = [
  { value: 'guided', label: 'Guided', description: 'Strictly follows syllabus' },
  { value: 'flexible_goals', label: 'Flexible Goals', description: 'Choose topics within objectives' },
  { value: 'open_exploration', label: 'Open Exploration', description: 'Student-led conversation' },
  { value: 'free_conversation', label: 'Free Conversation', description: 'Maximum practice freedom' },
];

const CLASS_TYPE_ICONS: Record<string, typeof Award> = {
  "Award": Award,
  "Briefcase": Briefcase,
  "Zap": Zap,
  "Plane": Plane,
};

function getClassTypeIcon(iconName: string | null | undefined) {
  if (!iconName) return Award;
  return CLASS_TYPE_ICONS[iconName] || Award;
}

export default function AdminClasses() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    classes: AdminClass[];
    total: number;
  }>({
    queryKey: ["/api/admin/classes"],
  });

  const { data: classTypes } = useQuery<ClassType[]>({
    queryKey: ["/api/class-types"],
  });

  const updateClassMutation = useMutation({
    mutationFn: async ({ classId, updates }: { classId: string; updates: Partial<AdminClass> }) => {
      return apiRequest("PUT", `/api/admin/classes/${classId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes/catalogue"] });
      toast({
        title: "Class Updated",
        description: "Class settings have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update class",
        variant: "destructive",
      });
    },
  });

  const handleToggleFeatured = (cls: AdminClass) => {
    updateClassMutation.mutate({
      classId: cls.id,
      updates: { isFeatured: !cls.isFeatured },
    });
  };

  const handleToggleCatalogue = (cls: AdminClass) => {
    updateClassMutation.mutate({
      classId: cls.id,
      updates: { isPublicCatalogue: !cls.isPublicCatalogue },
    });
  };

  const handleClassTypeChange = (cls: AdminClass, classTypeId: string) => {
    updateClassMutation.mutate({
      classId: cls.id,
      updates: { classTypeId: classTypeId === "none" ? null : classTypeId },
    });
  };

  const handleFreedomLevelChange = (cls: AdminClass, level: string) => {
    updateClassMutation.mutate({
      classId: cls.id,
      updates: { tutorFreedomLevel: level as AdminClass['tutorFreedomLevel'] },
    });
  };

  const getClassTypeName = (classTypeId: string | null) => {
    if (!classTypeId || !classTypes) return null;
    return classTypes.find(ct => ct.id === classTypeId);
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Class Management</h1>
            <p className="text-muted-foreground mt-2">
              View and manage all classes across the platform
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Classes ({data?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {data && data.classes.length > 0 ? (
                    data.classes.map((cls) => {
                      const classType = getClassTypeName(cls.classTypeId);
                      const IconComponent = classType ? getClassTypeIcon(classType.icon) : Award;
                      
                      return (
                        <div
                          key={cls.id}
                          className="p-4 rounded-md border space-y-3"
                          data-testid={`card-class-${cls.id}`}
                        >
                          {/* Header Row */}
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
                                <div className="text-sm text-muted-foreground mt-1">
                                  {cls.description || "No description"}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Join Code</div>
                              <div className="font-mono font-bold text-lg">{cls.joinCode}</div>
                            </div>
                          </div>

                          {/* Info Row */}
                          <div className="flex items-center gap-4 flex-wrap">
                            <Badge variant="secondary" className="capitalize">
                              {cls.language}
                            </Badge>
                            {classType && (
                              <Badge variant="outline" className="gap-1">
                                <IconComponent className="h-3 w-3" />
                                {classType.name}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {cls.enrollmentCount} students
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Teacher: {cls.teacher?.firstName || cls.teacher?.email || "Unknown"}
                            </span>
                          </div>

                          {/* Controls Row */}
                          <div className="flex items-center gap-6 pt-2 border-t flex-wrap">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={cls.isPublicCatalogue}
                                onCheckedChange={() => handleToggleCatalogue(cls)}
                                disabled={updateClassMutation.isPending}
                                data-testid={`switch-catalogue-${cls.id}`}
                              />
                              <span className="text-sm">Public Catalogue</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={cls.isFeatured}
                                onCheckedChange={() => handleToggleFeatured(cls)}
                                disabled={updateClassMutation.isPending || !cls.isPublicCatalogue}
                                data-testid={`switch-featured-${cls.id}`}
                              />
                              <span className="text-sm">Featured</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-sm">Type:</span>
                              <Select
                                value={cls.classTypeId || "none"}
                                onValueChange={(value) => handleClassTypeChange(cls, value)}
                                disabled={updateClassMutation.isPending}
                              >
                                <SelectTrigger className="w-40" data-testid={`select-type-${cls.id}`}>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {classTypes?.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>
                                      {type.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Compass className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Freedom:</span>
                              <Select
                                value={cls.tutorFreedomLevel || "flexible_goals"}
                                onValueChange={(value) => handleFreedomLevelChange(cls, value)}
                                disabled={updateClassMutation.isPending}
                              >
                                <SelectTrigger className="w-44" data-testid={`select-freedom-${cls.id}`}>
                                  <SelectValue placeholder="Select level" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FREEDOM_LEVELS.map((level) => (
                                    <SelectItem key={level.value} value={level.value}>
                                      {level.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No classes found</p>
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
