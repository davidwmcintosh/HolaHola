import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation } from "wouter";
import { 
  BookOpen, Users, ArrowRight, Search, Sparkles, GraduationCap, 
  ChevronRight, Languages, CheckCircle2, Award, Briefcase, Zap, 
  Plane, Star, Mic, Target, TrendingUp, Globe, BookMarked,
  Microscope, Landmark
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
  classLevel: number;
  targetActflLevel: string | null;
  expectedActflMin: string | null;
}

interface FeaturedClass {
  id: string;
  name: string;
  description: string | null;
  language: string;
  classType: ClassType | null;
  featuredOrder: number | null;
  classLevel: number;
  targetActflLevel: string | null;
  expectedActflMin: string | null;
}

interface PricingConfig {
  class_price_cents: string;
  hour_rate_cents: string;
  free_trial_hours: string;
}

interface HourPackage {
  id: string;
  name: string;
  hours: number;
  totalPriceCents: number;
  stripePriceId: string;
}

interface AcademicSubject {
  id: string;
  subject: string;
  bookTitle: string | null;
  bookSubtitle: string | null;
  description: string | null;
  targetAudience: string | null;
  scope: string | null;
  source: string;
}

const SUBJECT_META: Record<string, { icon: typeof Microscope; color: string; tutorPath: string; libraryPath: string; label: string }> = {
  biology: {
    icon: Microscope,
    color: 'text-emerald-600',
    tutorPath: '/biology',
    libraryPath: '/reading-library?subject=biology',
    label: 'Biology',
  },
  history: {
    icon: Landmark,
    color: 'text-amber-600',
    tutorPath: '/history-tutor',
    libraryPath: '/reading-library?subject=history',
    label: 'U.S. History',
  },
};

type SubjectCategory = 'languages' | 'academic';

const CATEGORY_OPTIONS: { value: SubjectCategory; label: string; icon: typeof Globe }[] = [
  { value: 'languages', label: 'Languages', icon: Globe },
  { value: 'academic', label: 'Academic Subjects', icon: BookMarked },
];

const joinClassFormSchema = z.object({
  joinCode: z.string().min(1, "Join code is required").toUpperCase(),
});

type JoinClassFormValues = z.infer<typeof joinClassFormSchema>;

const LANGUAGE_OPTIONS = [
  { value: "all", label: "All Languages", flag: "" },
  { value: "spanish", label: "Spanish", flag: "🇪🇸" },
  { value: "french", label: "French", flag: "🇫🇷" },
  { value: "german", label: "German", flag: "🇩🇪" },
  { value: "italian", label: "Italian", flag: "🇮🇹" },
  { value: "portuguese", label: "Portuguese", flag: "🇧🇷" },
  { value: "japanese", label: "Japanese", flag: "🇯🇵" },
  { value: "korean", label: "Korean", flag: "🇰🇷" },
  { value: "mandarin", label: "Mandarin Chinese", flag: "🇨🇳" },
  { value: "english", label: "English (ESL)", flag: "🇺🇸" },
  { value: "hebrew", label: "Hebrew", flag: "🇮🇱" },
];

function getLanguageFlag(language: string): string {
  const langLower = language.toLowerCase();
  const lang = LANGUAGE_OPTIONS.find(l => l.value === langLower);
  return lang?.flag || "🌍";
}

function getLanguageLabel(language: string): string {
  const langLower = language.toLowerCase();
  const lang = LANGUAGE_OPTIONS.find(l => l.value === langLower);
  return lang?.label || language;
}

function getLevelBadge(classLevel: number): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  switch (classLevel) {
    case 1: return { label: 'Beginner', variant: 'secondary' };
    case 2: return { label: 'Intermediate', variant: 'default' };
    case 3: return { label: 'Advanced', variant: 'outline' };
    case 4: return { label: 'Superior', variant: 'outline' };
    default: return { label: 'All Levels', variant: 'secondary' };
  }
}

function getActflLabel(level: string): string {
  const labels: Record<string, string> = {
    novice_low: "Novice Low",
    novice_mid: "Novice Mid",
    novice_high: "Novice High",
    intermediate_low: "Intermediate Low",
    intermediate_mid: "Intermediate Mid",
    intermediate_high: "Intermediate High",
    advanced_low: "Advanced Low",
    advanced_mid: "Advanced Mid",
    advanced_high: "Advanced High",
    superior: "Superior",
    distinguished: "Distinguished",
  };
  return labels[level] || level?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || '';
}

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
  const [, setLocation] = useLocation();
  const [subjectCategory, setSubjectCategory] = useState<SubjectCategory>('languages');
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

  const { data: pricingConfig } = useQuery<PricingConfig>({
    queryKey: ['/api/pricing-config'],
  });

  const { data: hourPackagesData } = useQuery<{ packages: HourPackage[] }>({
    queryKey: ['/api/billing/hour-packages'],
  });

  const { data: academicSubjects, isLoading: isLoadingAcademic } = useQuery<AcademicSubject[]>({
    queryKey: ['/api/syllabi'],
  });

  const classPriceCents = parseInt(pricingConfig?.class_price_cents || '25000');
  const classPrice = classPriceCents / 100;
  const hourPackages = hourPackagesData?.packages || [];

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

      {/* Category toggle */}
      <div className="flex justify-center gap-2" data-testid="category-toggle">
        {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={subjectCategory === value ? 'default' : 'outline'}
            onClick={() => setSubjectCategory(value)}
            data-testid={`button-category-${value}`}
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </Button>
        ))}
      </div>

      {/* Academic Subjects panel */}
      {subjectCategory === 'academic' && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <BookMarked className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Academic Subjects</h2>
          </div>
          <p className="text-muted-foreground max-w-xl">
            OpenStax-aligned courses with AI tutors, reading libraries, and progress tracking.
            Available to all students — no enrollment code needed.
          </p>
          {isLoadingAcademic ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader><div className="h-6 bg-muted rounded w-3/4" /><div className="h-4 bg-muted rounded w-1/2 mt-2" /></CardHeader>
                  <CardContent><div className="h-24 bg-muted rounded" /></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(academicSubjects || []).map((subject) => {
                const meta = SUBJECT_META[subject.subject];
                if (!meta) return null;
                const SubjectIcon = meta.icon;
                return (
                  <Card key={subject.id} className="flex flex-col hover-elevate" data-testid={`card-academic-${subject.subject}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <SubjectIcon className={`h-5 w-5 ${meta.color}`} />
                        <Badge variant="outline">{meta.label}</Badge>
                        {subject.scope && (
                          <Badge variant="secondary" className="text-xs">{subject.scope}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{subject.bookTitle}</CardTitle>
                      {subject.bookSubtitle && (
                        <CardDescription className="font-medium text-foreground/70">{subject.bookSubtitle}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex-grow space-y-3">
                      {subject.description && (
                        <p className="text-sm text-muted-foreground line-clamp-4">{subject.description}</p>
                      )}
                      {subject.targetAudience && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          <span>{subject.targetAudience}</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex gap-2 flex-wrap">
                      <Button
                        className="flex-1"
                        onClick={() => setLocation(meta.tutorPath)}
                        data-testid={`button-start-tutor-${subject.subject}`}
                      >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Open Tutor
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setLocation(meta.libraryPath)}
                        data-testid={`button-view-library-${subject.subject}`}
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        Reading Library
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Featured Classes */}
      {subjectCategory === 'languages' && featuredClasses && featuredClasses.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-yellow-500" />
            <h2 className="text-2xl font-bold">Featured Programs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredClasses.slice(0, 3).map((cls) => {
              const levelBadge = getLevelBadge(cls.classLevel);
              return (
                <Card 
                  key={cls.id}
                  className="relative overflow-hidden border-2 border-primary/20 hover-elevate"
                  data-testid={`card-featured-${cls.id}`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent" />
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-3xl" role="img" aria-label={getLanguageLabel(cls.language)}>
                        {getLanguageFlag(cls.language)}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Featured
                      </Badge>
                    </div>
                    <CardTitle className="mt-3">{cls.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{getLanguageLabel(cls.language)}</Badge>
                      <Badge variant={levelBadge.variant}>{levelBadge.label}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {cls.expectedActflMin && cls.targetActflLevel 
                        ? `${getActflLabel(cls.expectedActflMin)} → ${getActflLabel(cls.targetActflLevel)}`
                        : cls.targetActflLevel 
                          ? `Target: ${getActflLabel(cls.targetActflLevel)}`
                          : cls.classType?.name || 'ACTFL-aligned curriculum'}
                    </p>
                    <div className="mb-2">
                      <span className="text-2xl font-bold">${classPrice}</span>
                      <span className="text-muted-foreground ml-1">/class</span>
                    </div>
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
      {subjectCategory === 'languages' && <section className="space-y-8">
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
                  <span className="mr-1.5">{lang.flag}</span>
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
      </section>}

      {/* Search Results */}
      {subjectCategory === 'languages' && showCatalogue && (
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
                const levelBadge = getLevelBadge(cls.classLevel);
                return (
                  <Card 
                    key={cls.id} 
                    className={`transition-all duration-200 ${cls.isEnrolled ? 'opacity-75 border-primary/30 bg-primary/5' : 'hover-elevate'}`}
                    data-testid={`card-catalogue-class-${cls.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-2xl" role="img" aria-label={getLanguageLabel(cls.language)}>
                          {getLanguageFlag(cls.language)}
                        </div>
                        {cls.isEnrolled ? (
                          <Badge variant="default" className="shrink-0 bg-primary/80">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Enrolled
                          </Badge>
                        ) : (
                          <Badge variant={levelBadge.variant} className="shrink-0">
                            {levelBadge.label}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg truncate mt-2">{cls.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 flex-wrap mt-1">
                        <Badge variant="outline" className="text-xs">{getLanguageLabel(cls.language)}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {cls.expectedActflMin && cls.targetActflLevel 
                          ? `${getActflLabel(cls.expectedActflMin)} → ${getActflLabel(cls.targetActflLevel)}`
                          : cls.targetActflLevel 
                            ? `Target: ${getActflLabel(cls.targetActflLevel)}`
                            : cls.classType?.name || 'ACTFL-aligned curriculum'}
                      </p>
                      {!cls.isEnrolled && (
                        <div className="mb-2">
                          <span className="text-2xl font-bold">${classPrice}</span>
                          <span className="text-muted-foreground ml-1">/class</span>
                        </div>
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
      {subjectCategory === 'languages' && !showCatalogue && (
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

      {/* Self-Directed Learning Section */}
      <section className="mt-12">
        <Card className="bg-muted/50 border-dashed">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Mic className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Prefer Self-Directed Learning?</CardTitle>
            <CardDescription className="max-w-lg mx-auto">
              Practice at your own pace with our AI tutors. Purchase hours and use them anytime, 
              across all 9 languages.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            {hourPackages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-6">
                {hourPackages.slice(0, 4).map((pkg) => (
                  <div 
                    key={pkg.id}
                    className="text-center p-4 rounded-lg bg-background border"
                  >
                    <div className="text-2xl font-bold">{pkg.hours}h</div>
                    <div className="text-sm text-muted-foreground">{pkg.name}</div>
                    <div className="text-lg font-semibold text-primary mt-1">
                      ${(pkg.totalPriceCents / 100).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex justify-center">
              <Button variant="outline" asChild data-testid="button-view-hour-packages">
                <a href="/pricing">View Hour Packages</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
