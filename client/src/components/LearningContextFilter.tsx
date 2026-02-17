import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter, LearningContext } from "@/contexts/LearningFilterContext";
import { GraduationCap, User, Filter, Sparkles, Heart, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

const publicLanguages = [
  { value: "all", label: "All Languages" },
  { value: "spanish", label: "Spanish" },
  { value: "english", label: "English" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "japanese", label: "Japanese" },
  { value: "mandarin", label: "Mandarin" },
  { value: "korean", label: "Korean" },
  { value: "hebrew", label: "Hebrew" },
];

const hiddenLanguages: { value: string; label: string }[] = [];

interface LanguageOption {
  value: string;
  label: string;
}

interface LearningContextFilterProps {
  compact?: boolean;
  showLanguage?: boolean;
  showContext?: boolean;
}

export function LearningContextFilter({ 
  compact = false, 
  showLanguage = true,
  showContext = true 
}: LearningContextFilterProps) {
  const { language, setLanguage } = useLanguage();
  const { 
    learningContext, 
    setLearningContext, 
    enrolledClasses,
    isLoadingClasses,
    getClassesForLanguage 
  } = useLearningFilter();
  const { user: authUser } = useAuth();
  const isDeveloper = authUser?.role === 'developer' || authUser?.role === 'admin';
  
  // Include hidden languages for privileged users
  const allLanguages: LanguageOption[] = isDeveloper 
    ? [...publicLanguages, ...hiddenLanguages]
    : publicLanguages;

  // Get user's target language for self-directed learning
  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  // Get all languages user has progress in
  const { data: userLanguagesData } = useQuery<{ languages: string[] }>({
    queryKey: ["/api/user/languages"],
  });

  const availableLanguages = allLanguages;

  const selectedLanguage = availableLanguages.find((lang) => lang.value === language) 
    || allLanguages.find((lang) => lang.value === language);
  
  // When "All Languages" is selected, show all enrolled classes; otherwise filter by language
  const classesToShow = language === "all" 
    ? enrolledClasses.filter(e => e.isActive)
    : getClassesForLanguage(language);
  const hasClasses = classesToShow.length > 0;
  const hasAnyClasses = enrolledClasses.some(e => e.isActive);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    // When changing language, check if current class context is still valid
    // For "all" languages, all classes remain valid
    // Founder mode and honesty mode are language-agnostic - keep them
    if (learningContext !== "self-directed" && 
        learningContext !== "founder-mode" && 
        learningContext !== "honesty-mode" && 
        newLang !== "all") {
      const newClasses = getClassesForLanguage(newLang);
      const stillValid = newClasses.some(c => c.classId === learningContext);
      if (!stillValid) {
        // Reset to self-directed when class is no longer valid for new language
        setLearningContext("self-directed");
      }
    }
  };
  
  // Helper to get language label for a class
  const getLanguageLabel = (langCode: string): string => {
    const lang = allLanguages.find((l: LanguageOption) => l.value.toLowerCase() === langCode.toLowerCase());
    return lang?.label || langCode;
  };

  const getContextLabel = (ctx: LearningContext): string => {
    if (ctx === "all" || ctx === "self-directed") return "Self-Directed";
    if (ctx === "founder-mode") return "Founder Mode";
    if (ctx === "honesty-mode") return "Honesty Mode";
    if (ctx === "all-learning") return "All Learning";
    const cls = enrolledClasses.find(e => e.classId === ctx);
    return cls?.class.name || "Self-Directed";
  };

  const getContextIcon = (ctx: LearningContext) => {
    if (ctx === "self-directed" || ctx === "all") return <User className="h-3 w-3" />;
    if (ctx === "founder-mode") return <Sparkles className="h-3 w-3 text-amber-500" />;
    if (ctx === "honesty-mode") return <Heart className="h-3 w-3 text-rose-500" />;
    if (ctx === "all-learning") return <Filter className="h-3 w-3" />;
    return <GraduationCap className="h-3 w-3" />;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {showLanguage && selectedLanguage && (
          <Badge variant="secondary" className="text-sm" data-testid="badge-current-language">
            <Globe className="w-3 h-3 mr-1.5" />
            {selectedLanguage.label}
          </Badge>
        )}
        {showContext && hasAnyClasses && (
          <Badge variant="outline" className="text-sm" data-testid="badge-current-context">
            {getContextIcon(learningContext)}
            <span className="ml-1">{getContextLabel(learningContext)}</span>
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showLanguage && (
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[160px]" data-testid="select-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableLanguages.map((lang: LanguageOption) => (
              <SelectItem key={lang.value} value={lang.value} data-testid={`option-language-${lang.value}`}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showContext && (
        isLoadingClasses ? (
          <Skeleton className="h-9 w-[180px]" />
        ) : (
          <Select value={learningContext === "all" ? "self-directed" : learningContext} onValueChange={setLearningContext}>
            <SelectTrigger className="w-[180px]" data-testid="select-learning-context">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hasClasses && (
                <SelectItem value="all-learning" data-testid="option-context-all">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span>All Learning</span>
                  </div>
                </SelectItem>
              )}
              <SelectItem value="self-directed" data-testid="option-context-self">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Self-Directed</span>
                </div>
              </SelectItem>
              {classesToShow.map((enrollment) => (
                <SelectItem 
                  key={enrollment.classId} 
                  value={enrollment.classId}
                  data-testid={`option-context-class-${enrollment.classId}`}
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>{enrollment.class.name}</span>
                    {language === "all" && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({getLanguageLabel(enrollment.class.language)})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
              {isDeveloper && (
                <>
                  <SelectItem value="founder-mode" data-testid="option-context-founder-mode">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Founder Mode</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="honesty-mode" data-testid="option-context-honesty-mode">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-rose-500" />
                      <span className="text-rose-600 dark:text-rose-400 font-medium">Honesty Mode</span>
                    </div>
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )
      )}
    </div>
  );
}
