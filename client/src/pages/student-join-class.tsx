import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  BookOpen, Users, ArrowRight, Search, Sparkles, GraduationCap, 
  ChevronRight, Languages, CheckCircle2, Award, Briefcase, Zap, 
  Plane, Star, Mic, Target, TrendingUp
} from "lucide-react";
import holaholaIcon from "@assets/holaholajustbubblesBackgroundRemoved_1765309702014.png";
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

interface ClassType {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface CatalogueClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  isActive: boolean;
  isEnrolled: boolean;
  classType: ClassType | null;
}

interface FeaturedClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  classType: ClassType | null;
  featuredOrder: number | null;
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

export default function StudentJoinClass() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [classTypeFilter, setClassTypeFilter] = useState<string | null>(null);
  const [showCatalogue, setShowCatalogue] = useState(false);
  
  const form = useForm<JoinClassFormValues>({
    resolver: zodResolver(joinClassFormSchema),
    defaultValues: {
      joinCode: "",
    },
  });

  const { data: enrolledClasses, isLoading: isLoadingEnrolled } = useQuery<EnrolledClass[]>({
    queryKey: ["/api/student/classes"],
  });

  const { data: classTypes } = useQuery<ClassType[]>({
    queryKey: ["/api/class-types"],
  });

  const { data: featuredClasses, isLoading: isLoadingFeatured } = useQuery<FeaturedClass[]>({
    queryKey: ["/api/classes/featured"],
  });

  const { data: catalogueClasses, isLoading: isLoadingCatalogue } = useQuery<CatalogueClass[]>({
    queryKey: ["/api/classes/catalogue", searchQuery, languageFilter, classTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (languageFilter) params.set("language", languageFilter);
      if (classTypeFilter) params.set("classType", classTypeFilter);
      const response = await fetch(`/api/classes/catalogue?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch catalogue");
      return response.json();
    },
    enabled: showCatalogue || !!searchQuery || !!languageFilter || !!classTypeFilter,
  });

  const joinClassMutation = useMutation({
    mutationFn: async (values: JoinClassFormValues) => {
      return apiRequest("POST", "/api/student/enroll", values);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes/catalogue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes/featured"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/classes/featured"] });
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

  const handleFilterSelect = (type: "language" | "classType", value: string) => {
    if (type === "language") {
      setLanguageFilter(value);
    } else {
      setClassTypeFilter(value);
    }
    setShowCatalogue(true);
  };

  const clearFilters = () => {
    setLanguageFilter(null);
    setClassTypeFilter(null);
    setSearchQuery("");
    setShowCatalogue(false);
  };

  const activeEnrollments = enrolledClasses?.filter(e => e.class?.isActive) || [];
  const hasActiveFilters = !!languageFilter || !!classTypeFilter || !!searchQuery;

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-background p-8 md:p-12">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <Badge variant="secondary" className="text-xs font-medium">
              AI-Powered Learning
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
            Find Your Perfect Language Class
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Join thousands of learners mastering new languages with AI-powered conversation practice, 
            ACTFL-aligned curriculum, and personalized tutoring.
          </p>
          
          {/* Key Features */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mic className="h-4 w-4 text-primary" />
              <span>Voice Practice</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4 text-primary" />
              <span>ACTFL Standards</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Progress Tracking</span>
            </div>
          </div>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-48 md:w-64 lg:w-80 opacity-15">
          <img 
            src={holaholaIcon} 
            alt="HolaHola" 
            className="w-full h-auto object-contain"
          />
        </div>
      </div>

      {/* Featured Classes */}
      {featuredClasses && featuredClasses.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-yellow-500" />
            <h2 className="text-2xl font-bold">Featured Programs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredClasses.slice(0, 3).map((cls) => {
              const IconComponent = getClassTypeIcon(cls.classType?.icon);
              return (
                <Card 
                  key={cls.id}
                  className="relative overflow-hidden border-2 border-primary/20 hover-elevate"
                  data-testid={`card-featured-${cls.id}`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent" />
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Featured
                      </Badge>
                    </div>
                    <CardTitle className="mt-3">{cls.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Languages className="h-4 w-4" />
                      <span className="capitalize">{cls.language}</span>
                      {cls.classType && (
                        <>
                          <span className="text-muted-foreground/50">|</span>
                          <span>{cls.classType.name}</span>
                        </>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {cls.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {cls.description}
                      </p>
                    )}
                    <Button
                      className="w-full"
                      onClick={() => enrollFromCatalogue.mutate(cls.id)}
                      disabled={enrollFromCatalogue.isPending}
                      data-testid={`button-enroll-featured-${cls.id}`}
                    >
                      <ChevronRight className="w-4 h-4 mr-2" />
                      Enroll Now
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Discovery Section */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold">Discover Your Path</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Choose your language and learning style to find the perfect class for your goals.
          </p>
        </div>

        {/* Class Type Selection */}
        {classTypes && classTypes.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">What's your goal?</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {classTypes.map((type) => {
                const IconComponent = getClassTypeIcon(type.icon);
                const isSelected = classTypeFilter === type.slug;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleFilterSelect("classType", type.slug)}
                    className={`p-4 rounded-xl border-2 transition-all text-left space-y-2 ${
                      isSelected 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                    data-testid={`button-filter-type-${type.slug}`}
                  >
                    <div className={`p-2 rounded-lg w-fit ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                      <IconComponent className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="font-medium text-sm">{type.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Language Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Which language?</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {LANGUAGE_OPTIONS.filter(l => l.value !== "all").map((lang) => {
              const isSelected = languageFilter === lang.value;
              return (
                <Button
                  key={lang.value}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterSelect("language", lang.value)}
                  data-testid={`button-filter-language-${lang.value}`}
                >
                  {lang.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) setShowCatalogue(true);
              }}
              className="pl-10"
              data-testid="input-search-classes"
            />
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filters:</span>
            {languageFilter && (
              <Badge variant="secondary" className="gap-1">
                {LANGUAGE_OPTIONS.find(l => l.value === languageFilter)?.label}
              </Badge>
            )}
            {classTypeFilter && (
              <Badge variant="secondary" className="gap-1">
                {classTypes?.find(t => t.slug === classTypeFilter)?.name}
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                "{searchQuery}"
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              Clear all
            </Button>
          </div>
        )}
      </section>

      {/* Search Results */}
      {showCatalogue && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {hasActiveFilters ? "Search Results" : "All Classes"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {catalogueClasses?.length || 0} classes found
            </span>
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
              {catalogueClasses.map((cls) => {
                const IconComponent = cls.classType ? getClassTypeIcon(cls.classType.icon) : Award;
                return (
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
                        ) : cls.classType ? (
                          <Badge variant="outline" className="shrink-0 gap-1">
                            <IconComponent className="w-3 h-3" />
                            {cls.classType.name.split(' ')[0]}
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
                );
              })}
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
                    Try adjusting your filters or search to find more classes.
                  </p>
                </div>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            </Card>
          )}
        </section>
      )}

      {/* Browse All Button */}
      {!showCatalogue && (
        <div className="text-center">
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setShowCatalogue(true)}
            data-testid="button-browse-all"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Browse All Classes
          </Button>
        </div>
      )}

      {/* Join with Code Section */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Have a Join Code?
          </CardTitle>
          <CardDescription>
            If your teacher gave you a class code, enter it below to join their class directly.
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

      {/* Your Enrolled Classes */}
      {activeEnrollments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Your Enrolled Classes
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeEnrollments.map((enrollment) => {
              const classData = enrollment.class;
              if (!classData) return null;

              return (
                <Card key={enrollment.id} data-testid={`card-enrolled-class-${enrollment.classId}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Languages className="h-5 w-5 text-muted-foreground" />
                        {classData.name}
                      </CardTitle>
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
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
        </section>
      )}
    </div>
  );
}
