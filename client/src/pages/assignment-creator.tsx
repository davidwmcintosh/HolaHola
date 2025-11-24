import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssignmentSchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

interface TeacherClass {
  id: string;
  name: string;
  language: string;
}

// Form schema matching database structure - keeps datetime-local format for UX
const assignmentFormSchema = insertAssignmentSchema.pick({
  classId: true,
  title: true,
  description: true,
  assignmentType: true,
  isPublished: true,
}).extend({
  // Keep dueDate as string for datetime-local input compatibility
  dueDate: z.string().optional(),
});

type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

export default function AssignmentCreator() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedClassId = urlParams.get('classId');

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      classId: preselectedClassId || "",
      title: "",
      description: "",
      assignmentType: "practice",
      isPublished: false,
      dueDate: "",
    },
  });

  const { data: classes, isLoading: isLoadingClasses } = useQuery<TeacherClass[]>({
    queryKey: ["/api/teacher/classes"],
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: AssignmentFormValues) => {
      // Transform datetime-local string to ISO only at submission time
      const payload = {
        ...data,
        dueDate: data.dueDate && data.dueDate.trim() !== "" 
          ? new Date(data.dueDate).toISOString() 
          : undefined,
      };
      return apiRequest("POST", "/api/assignments", payload);
    },
    onSuccess: (data: any) => {
      const classId = form.getValues("classId");
      queryClient.invalidateQueries({ queryKey: ["/api/classes", classId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/assignments"] });
      form.reset();
      toast({
        title: "Assignment Created",
        description: "Your assignment has been created successfully.",
      });
      setLocation(`/teacher/classes/${classId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: AssignmentFormValues) => {
    createAssignmentMutation.mutate(values);
  };

  // Protect teacher-only route
  useEffect(() => {
    if (!isLoadingAuth && (!user || (user.role !== 'teacher' && user.role !== 'admin'))) {
      setLocation("/");
    }
  }, [user, isLoadingAuth, setLocation]);

  if (isLoadingAuth || !user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/teacher/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Create Assignment</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Create a new assignment for your students</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Details</CardTitle>
              <CardDescription>Basic information about the assignment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class</FormLabel>
                    {isLoadingClasses ? (
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    ) : (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-class">
                            <SelectValue placeholder="Select a class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classes?.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name} ({cls.language})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Practice: Verb Conjugations"
                        data-testid="input-title"
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
                        placeholder="Practice conjugating regular -ar, -er, and -ir verbs in present tense"
                        data-testid="input-description"
                        rows={3}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment Settings</CardTitle>
              <CardDescription>Configure grading and availability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="assignmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="practice">Practice</SelectItem>
                        <SelectItem value="homework">Homework</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        data-testid="input-due-date"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isPublished"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Publish Assignment</FormLabel>
                      <FormDescription>
                        Make this assignment visible to students immediately
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                        data-testid="switch-published"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Link href="/teacher/dashboard">
              <Button type="button" variant="outline" data-testid="button-cancel">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={createAssignmentMutation.isPending}
              data-testid="button-create-assignment"
            >
              <Save className="w-4 h-4 mr-2" />
              {createAssignmentMutation.isPending ? "Creating..." : "Create Assignment"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
