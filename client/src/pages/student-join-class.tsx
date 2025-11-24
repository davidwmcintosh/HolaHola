import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { BookOpen, Users, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface EnrolledClass {
  id: string;
  classId: string;
  enrolledAt: Date;
  class?: {
    id: string;
    name: string;
    description: string | null;
    language: string;
    isActive: boolean;
  };
}

const joinClassFormSchema = z.object({
  joinCode: z.string().min(1, "Join code is required").toUpperCase(),
});

type JoinClassFormValues = z.infer<typeof joinClassFormSchema>;

export default function StudentJoinClass() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<JoinClassFormValues>({
    resolver: zodResolver(joinClassFormSchema),
    defaultValues: {
      joinCode: "",
    },
  });

  const { data: enrolledClasses, isLoading } = useQuery<EnrolledClass[]>({
    queryKey: ["/api/student/classes"],
  });

  const joinClassMutation = useMutation({
    mutationFn: async (values: JoinClassFormValues) => {
      return apiRequest("POST", "/api/student/enroll", values);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student/all-assignments"] });
      form.reset();
      toast({
        title: "Joined Class!",
        description: `You've successfully joined ${data.class?.name || "the class"}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join class. Please check the code and try again.",
        variant: "destructive",
      });
    },
  });

  const handleJoinClass = (values: JoinClassFormValues) => {
    joinClassMutation.mutate(values);
  };

  const activeEnrollments = enrolledClasses?.filter(e => e.class?.isActive) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold">Join a Class</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Enter the code provided by your teacher to join their class
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enter Join Code</CardTitle>
          <CardDescription>
            Your teacher will provide you with a unique code to join their class
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleJoinClass)} className="space-y-4">
              <FormField
                control={form.control}
                name="joinCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Join Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ABC123"
                        data-testid="input-join-code"
                        className="text-lg font-mono"
                        maxLength={8}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription>
                      Join codes are usually 6-8 characters long
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={joinClassMutation.isPending}
                data-testid="button-join-class"
                className="w-full"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {joinClassMutation.isPending ? "Joining..." : "Join Class"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Your Classes</h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : activeEnrollments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeEnrollments.map((enrollment) => {
              const classData = enrollment.class;
              if (!classData) return null;

              return (
                <Card key={enrollment.id} data-testid={`card-class-${enrollment.classId}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{classData.name}</CardTitle>
                      <Badge variant={classData.isActive ? "default" : "secondary"}>
                        {classData.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription>
                      {classData.language.charAt(0).toUpperCase() + classData.language.slice(1)}
                    </CardDescription>
                  </CardHeader>
                  {classData.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {classData.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-muted rounded-full">
                  <Users className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No Classes Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Use the form above to join your first class. Ask your teacher for the join code.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
