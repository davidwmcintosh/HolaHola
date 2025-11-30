import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { BookOpen, Users, ArrowRight, Search, Sparkles, GraduationCap, Globe, ChevronRight, Languages, CheckCircle2 } from "lucide-react";
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

interface CatalogueClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  isActive: boolean;
  isEnrolled: boolean;
}

const joinClassFormSchema = z.object({
  joinCode: z.string().min(1, "Join code is required").toUpperCase(),
});

type JoinClassFormValues = z.infer<typeof joinClassFormSchema>;

const LANGUAGE_OPTIONS = [
  { value: "all", label: "All Languages" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "mandarin", label: "Mandarin Chinese" },
  { value: "english", label: "English (ESL)" },
];

export default function StudentJoinClass() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  
  const form = useForm<JoinClassFormValues>({
    resolver: zodResolver(joinClassFormSchema),
    defaultValues: {
      joinCode: "",
    },
  });

  const { data: enrolledClasses, isLoading: isLoadingEnrolled } = useQuery<EnrolledClass[]>({
    queryKey: ["/api/student/classes"],
  });

  const { data: catalogueClasses, isLoading: isLoadingCatalogue } = useQuery<CatalogueClass[]>({
    queryKey: ["/api/classes/catalogue", searchQuery, languageFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (languageFilter && languageFilter !== "all") params.set("language", languageFilter);
      const response = await fetch(`/api/classes/catalogue?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch catalogue");
      return response.json();
    },
  });

  const joinClassMutation = useMutation({
    mutationFn: async (values: JoinClassFormValues) => {
      return apiRequest("POST", "/api/student/enroll", values);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes/catalogue"] });
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

  const enrollFromCatalogue = useMutation({
    mutationFn: async (classId: string) => {
      return apiRequest("POST", `/api/classes/catalogue/${classId}/enroll`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes/catalogue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student/all-assignments"] });
      toast({
        title: "Enrolled Successfully!",
        description: `Welcome to ${data.class?.name || "the class"}! Start your language journey today.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to enroll in class.",
        variant: "destructive",
      });
    },
  });

  const handleJoinClass = (values: JoinClassFormValues) => {
    joinClassMutation.mutate(values);
  };

  const activeEnrollments = enrolledClasses?.filter(e => e.class?.isActive) || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 md:p-12">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <Badge variant="secondary" className="text-xs">
              Discover Your Path
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Explore LinguaFlow Classes
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Browse our curated collection of AI-powered language courses. Each class features 
            personalized conversation practice, structured curriculum, and expert-designed 
            lessons to accelerate your fluency.
          </p>
        </div>
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-10">
          <Globe className="w-full h-full" />
        </div>
      </div>

      {/* Join Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Have a Join Code?
          </CardTitle>
          <CardDescription>
            Enter the code provided by your teacher to join their class directly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleJoinClass)} className="flex flex-col sm:flex-row gap-4">
              <FormField
                control={form.control}
                name="joinCode"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="Enter join code (e.g., ABC123)"
                        data-testid="input-join-code"
                        className="text-lg font-mono"
                        maxLength={8}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={joinClassMutation.isPending}
                data-testid="button-join-class"
                className="sm:w-auto"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {joinClassMutation.isPending ? "Joining..." : "Join Class"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Class Catalogue */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Class Catalogue
            </h2>
            <p className="text-muted-foreground">
              Browse and enroll in LinguaFlow's official language courses
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64"
                data-testid="input-search-classes"
              />
            </div>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-language-filter">
                <SelectValue placeholder="Filter by language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoadingCatalogue ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : catalogueClasses && catalogueClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalogueClasses.map((cls) => (
              <Card 
                key={cls.id} 
                className={`transition-all duration-200 ${cls.isEnrolled ? 'opacity-75 border-primary/30 bg-primary/5' : 'hover-elevate'}`}
                data-testid={`card-catalogue-class-${cls.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{cls.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Languages className="h-4 w-4" />
                        <span className="capitalize">{cls.language}</span>
                      </CardDescription>
                    </div>
                    {cls.isEnrolled ? (
                      <Badge variant="default" className="shrink-0 bg-primary/80">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Enrolled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">
                        ACTFL
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cls.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {cls.description}
                    </p>
                  )}
                  {cls.isEnrolled ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled
                      data-testid={`button-enrolled-${cls.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Already Enrolled
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => enrollFromCatalogue.mutate(cls.id)}
                      disabled={enrollFromCatalogue.isPending}
                      data-testid={`button-enroll-${cls.id}`}
                    >
                      <ChevronRight className="w-4 h-4 mr-2" />
                      Enroll Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-muted rounded-full">
                  <Search className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No Classes Found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery || languageFilter !== "all" 
                    ? "Try adjusting your search or filter to find more classes."
                    : "All available classes are already in your enrolled list!"}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Your Enrolled Classes */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Your Enrolled Classes
        </h2>
        
        {isLoadingEnrolled ? (
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
                <Card key={enrollment.id} data-testid={`card-enrolled-class-${enrollment.classId}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="flex items-center gap-2">
                        <Languages className="h-5 w-5 text-muted-foreground" />
                        {classData.name}
                      </CardTitle>
                      <Badge variant={classData.isActive ? "default" : "secondary"}>
                        {classData.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription className="capitalize">
                      {classData.language}
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
                  Browse the catalogue above or use a join code from your teacher to get started!
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
