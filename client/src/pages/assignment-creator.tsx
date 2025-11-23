import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

interface TeacherClass {
  id: string;
  name: string;
  language: string;
}

export default function AssignmentCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Get classId from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedClassId = urlParams.get('classId');

  const [selectedClassId, setSelectedClassId] = useState(preselectedClassId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [isPublished, setIsPublished] = useState(false);
  const [assignmentType, setAssignmentType] = useState("practice");

  const { data: classes, isLoading: isLoadingClasses } = useQuery<TeacherClass[]>({
    queryKey: ["/api/teacher/classes"],
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/assignments", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes", selectedClassId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/assignments"] });
      toast({
        title: "Assignment Created",
        description: "Your assignment has been created successfully.",
      });
      setLocation(`/teacher/classes/${selectedClassId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClassId) {
      toast({
        title: "Error",
        description: "Please select a class",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Assignment title is required",
        variant: "destructive",
      });
      return;
    }

    const assignmentData: any = {
      classId: selectedClassId,
      title: title.trim(),
      description: description.trim() || null,
      instructions: instructions.trim() || null,
      assignmentType,
      maxScore: parseInt(maxScore) || 100,
      isPublished,
    };

    if (dueDate) {
      assignmentData.dueDate = new Date(dueDate).toISOString();
    }

    createAssignmentMutation.mutate(assignmentData);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/teacher/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-4xl font-bold">Create Assignment</h1>
          <p className="text-muted-foreground mt-2">Create a new assignment for your students</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assignment Details</CardTitle>
            <CardDescription>Basic information about the assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              {isLoadingClasses ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : (
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger id="class" data-testid="select-class">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} ({cls.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Practice: Verb Conjugations"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Practice conjugating regular -ar, -er, and -ir verbs in present tense"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                placeholder="Complete the exercises below. Write the correct conjugation for each verb in parentheses."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                data-testid="input-instructions"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment Settings</CardTitle>
            <CardDescription>Configure grading and availability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={assignmentType} onValueChange={setAssignmentType}>
                <SelectTrigger id="type" data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="homework">Homework</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input
                  id="dueDate"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  data-testid="input-due-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxScore">Maximum Score</Label>
                <Input
                  id="maxScore"
                  type="number"
                  min="1"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  data-testid="input-max-score"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="published" className="text-base">Publish Assignment</Label>
                <p className="text-sm text-muted-foreground">
                  Make this assignment visible to students immediately
                </p>
              </div>
              <Switch
                id="published"
                checked={isPublished}
                onCheckedChange={setIsPublished}
                data-testid="switch-published"
              />
            </div>
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
    </div>
  );
}
