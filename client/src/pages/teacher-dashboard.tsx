import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, BookOpen, ClipboardList } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTeacherClassSchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

interface TeacherClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  joinCode: string;
  isActive: boolean;
  createdAt: Date;
}

// Use schema directly from shared/schema.ts - it already has proper validation
const createClassFormSchema = insertTeacherClassSchema.pick({
  name: true,
  description: true,
  language: true,
});

type CreateClassFormValues = z.infer<typeof createClassFormSchema>;

export default function TeacherDashboard() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateClassFormValues>({
    resolver: zodResolver(createClassFormSchema),
    defaultValues: {
      name: "",
      description: "",
      language: "spanish",
    },
  });

  const { data: classes, isLoading } = useQuery<TeacherClass[]>({
    queryKey: ["/api/teacher/classes"],
  });

  // Protect teacher-only route
  useEffect(() => {
    if (!isLoadingAuth && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
      setLocation("/");
    }
  }, [user, isLoadingAuth, setLocation]);

  if (isLoadingAuth || !user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const createClassMutation = useMutation({
    mutationFn: async (data: CreateClassFormValues) => {
      return apiRequest("POST", "/api/teacher/classes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes"] });
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Class Created",
        description: "Your class has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create class",
        variant: "destructive",
      });
    },
  });

  const handleCreateClass = (values: CreateClassFormValues) => {
    createClassMutation.mutate(values);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Teacher Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Manage your classes and track student progress</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" data-testid="button-create-class">
              <Plus className="w-4 h-4 mr-2" />
              Create Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>
                Create a new class for your students. They'll join using the generated code.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateClass)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Spanish 101"
                          data-testid="input-class-name"
                          {...field}
                        />
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Beginner Spanish class for high school students"
                          data-testid="input-class-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-class-language">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="spanish">Spanish</SelectItem>
                          <SelectItem value="french">French</SelectItem>
                          <SelectItem value="german">German</SelectItem>
                          <SelectItem value="italian">Italian</SelectItem>
                          <SelectItem value="portuguese">Portuguese</SelectItem>
                          <SelectItem value="japanese">Japanese</SelectItem>
                          <SelectItem value="korean">Korean</SelectItem>
                          <SelectItem value="chinese">Chinese</SelectItem>
                          <SelectItem value="english">English</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createClassMutation.isPending}
                    data-testid="button-confirm-create-class"
                  >
                    {createClassMutation.isPending ? "Creating..." : "Create Class"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : classes && classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <Link key={classItem.id} href={`/teacher/classes/${classItem.id}`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-class-${classItem.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{classItem.name}</CardTitle>
                    <Badge variant={classItem.isActive ? "default" : "secondary"}>
                      {classItem.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {classItem.language.charAt(0).toUpperCase() + classItem.language.slice(1)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {classItem.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {classItem.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>Students</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ClipboardList className="w-4 h-4" />
                      <span>Assignments</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Join Code:</span>
                      <code className="px-3 py-1 bg-muted rounded text-sm font-mono" data-testid={`text-join-code-${classItem.id}`}>
                        {classItem.joinCode}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-muted rounded-full">
                <BookOpen className="w-12 h-12 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No Classes Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Create your first class to start teaching. Students will join using a unique code.
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-class">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Class
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
