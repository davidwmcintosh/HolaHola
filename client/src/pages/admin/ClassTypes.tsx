import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Award, Briefcase, Zap, Plane, Shield } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface ClassType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isPreset: boolean;
  createdAt: Date;
}

const ICON_OPTIONS = [
  { value: "Award", label: "Award", icon: Award },
  { value: "Briefcase", label: "Briefcase", icon: Briefcase },
  { value: "Zap", label: "Zap/Quick", icon: Zap },
  { value: "Plane", label: "Travel", icon: Plane },
];

const classTypeFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  slug: z.string().min(1, "Slug is required").max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().max(200).optional(),
  icon: z.string().optional(),
});

type ClassTypeFormValues = z.infer<typeof classTypeFormSchema>;

function getIconComponent(iconName: string | null | undefined) {
  if (!iconName) return Award;
  const found = ICON_OPTIONS.find(opt => opt.value === iconName);
  return found?.icon || Award;
}

export default function AdminClassTypes() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ClassType | null>(null);

  const form = useForm<ClassTypeFormValues>({
    resolver: zodResolver(classTypeFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      icon: "Award",
    },
  });

  const { data: classTypes, isLoading } = useQuery<ClassType[]>({
    queryKey: ["/api/class-types"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClassTypeFormValues) => {
      return apiRequest("POST", "/api/admin/class-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-types"] });
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Class Type Created",
        description: "The new class type has been added.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create class type",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: ClassTypeFormValues & { id: string }) => {
      return apiRequest("PUT", `/api/admin/class-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-types"] });
      setEditingType(null);
      form.reset();
      toast({
        title: "Class Type Updated",
        description: "The class type has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update class type",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/class-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-types"] });
      toast({
        title: "Class Type Deleted",
        description: "The class type has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete class type",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (values: ClassTypeFormValues) => {
    createMutation.mutate(values);
  };

  const handleUpdate = (values: ClassTypeFormValues) => {
    if (editingType) {
      updateMutation.mutate({ ...values, id: editingType.id });
    }
  };

  const handleEdit = (type: ClassType) => {
    setEditingType(type);
    form.reset({
      name: type.name,
      slug: type.slug,
      description: type.description || "",
      icon: type.icon || "Award",
    });
  };

  const handleDelete = (type: ClassType) => {
    if (type.isPreset) {
      toast({
        title: "Cannot Delete",
        description: "Preset class types cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    if (confirm(`Delete class type "${type.name}"?`)) {
      deleteMutation.mutate(type.id);
    }
  };

  const openCreateDialog = () => {
    form.reset({
      name: "",
      slug: "",
      description: "",
      icon: "Award",
    });
    setCreateDialogOpen(true);
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Class Types</h1>
              <p className="text-muted-foreground mt-2">
                Manage class categories for the public catalogue
              </p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} data-testid="button-add-class-type">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Class Type
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Class Type</DialogTitle>
                  <DialogDescription>
                    Add a new category for organizing classes in the catalogue.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 py-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Academic" {...field} data-testid="input-class-type-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., academic" {...field} data-testid="input-class-type-slug" />
                          </FormControl>
                          <FormDescription>
                            URL-safe identifier (lowercase, hyphens only)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief description..." {...field} data-testid="input-class-type-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="icon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Icon</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-class-type-icon">
                                <SelectValue placeholder="Select an icon" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ICON_OPTIONS.map((option) => {
                                const IconComp = option.icon;
                                return (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <IconComp className="h-4 w-4" />
                                      {option.label}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-class-type">
                        {createMutation.isPending ? "Creating..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Dialog */}
          <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Class Type</DialogTitle>
                <DialogDescription>
                  Update the class type details.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-class-type-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={editingType?.isPreset} data-testid="input-edit-class-type-slug" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-class-type-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="icon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Icon</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-class-type-icon">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ICON_OPTIONS.map((option) => {
                              const IconComp = option.icon;
                              return (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center gap-2">
                                    <IconComp className="h-4 w-4" />
                                    {option.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-class-type">
                      {updateMutation.isPending ? "Updating..." : "Update"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle>All Class Types</CardTitle>
              <CardDescription>
                Class types help students discover classes by learning goal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : classTypes && classTypes.length > 0 ? (
                <div className="space-y-3">
                  {classTypes.map((type) => {
                    const IconComponent = getIconComponent(type.icon);
                    return (
                      <div
                        key={type.id}
                        className="flex items-center justify-between p-4 rounded-md border"
                        data-testid={`card-class-type-${type.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{type.name}</span>
                              {type.isPreset && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Shield className="h-3 w-3" />
                                  Preset
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {type.description || <span className="italic">No description</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Slug: <code className="bg-muted px-1 rounded">{type.slug}</code>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(type)}
                            data-testid={`button-edit-type-${type.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!type.isPreset && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(type)}
                              data-testid={`button-delete-type-${type.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No class types found</p>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </RoleGuard>
  );
}
