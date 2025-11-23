import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, BookOpen, ClipboardList } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface TeacherClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  joinCode: string;
  isActive: boolean;
  createdAt: Date;
}

export default function TeacherDashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [classLanguage, setClassLanguage] = useState("spanish");
  const { toast } = useToast();

  const { data: classes, isLoading } = useQuery<TeacherClass[]>({
    queryKey: ["/api/teacher/classes"],
  });

  const createClassMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; language: string }) => {
      return apiRequest("/api/teacher/classes", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes"] });
      setCreateDialogOpen(false);
      setClassName("");
      setClassDescription("");
      setClassLanguage("spanish");
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

  const handleCreateClass = () => {
    if (!className.trim()) {
      toast({
        title: "Error",
        description: "Class name is required",
        variant: "destructive",
      });
      return;
    }
    createClassMutation.mutate({
      name: className,
      description: classDescription,
      language: classLanguage,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your classes and track student progress</p>
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
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Class Name</Label>
                <Input
                  id="class-name"
                  placeholder="Spanish 101"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  data-testid="input-class-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-description">Description (Optional)</Label>
                <Textarea
                  id="class-description"
                  placeholder="Beginner Spanish class for high school students"
                  value={classDescription}
                  onChange={(e) => setClassDescription(e.target.value)}
                  data-testid="input-class-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-language">Language</Label>
                <Select value={classLanguage} onValueChange={setClassLanguage}>
                  <SelectTrigger id="class-language" data-testid="select-class-language">
                    <SelectValue />
                  </SelectTrigger>
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
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateClass}
                disabled={createClassMutation.isPending}
                data-testid="button-confirm-create-class"
              >
                {createClassMutation.isPending ? "Creating..." : "Create Class"}
              </Button>
            </DialogFooter>
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
