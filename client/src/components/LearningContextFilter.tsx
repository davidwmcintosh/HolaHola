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
import { GraduationCap, User, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import { useMemo } from "react";

const allLanguages = [
  { value: "all", label: "All Languages", flag: "🌍" },
  { value: "spanish", label: "Spanish", flag: "🇪🇸" },
  { value: "french", label: "French", flag: "🇫🇷" },
  { value: "german", label: "German", flag: "🇩🇪" },
  { value: "italian", label: "Italian", flag: "🇮🇹" },
  { value: "portuguese", label: "Portuguese", flag: "🇵🇹" },
  { value: "japanese", label: "Japanese", flag: "🇯🇵" },
  { value: "mandarin", label: "Mandarin", flag: "🇨🇳" },
  { value: "korean", label: "Korean", flag: "🇰🇷" },
];

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

  // Get user's target language for self-directed learning
  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/auth/user"],
  });

  // Get all languages user has progress in
  const { data: userLanguagesData } = useQuery<{ languages: string[] }>({
    queryKey: ["/api/user/languages"],
  });

  // Smart-filter languages: show languages user is enrolled in, has as target, OR has progress in
  const availableLanguages = useMemo(() => {
    // Get unique languages from enrolled classes
    const enrolledLanguages = new Set(
      enrolledClasses
        .filter(e => e.isActive && e.class?.language)
        .map(e => e.class.language.toLowerCase())
    );

    // Add user's self-directed target language
    if (user?.targetLanguage) {
      enrolledLanguages.add(user.targetLanguage.toLowerCase());
    }

    // Add all languages user has progress in
    if (userLanguagesData?.languages) {
      userLanguagesData.languages.forEach(lang => enrolledLanguages.add(lang.toLowerCase()));
    }

    // If no enrollments, no target language, and no progress, show all languages (new user)
    if (enrolledLanguages.size === 0) {
      return allLanguages;
    }

    // Filter to only show relevant languages, but always include "All Languages" option
    const filteredLanguages = allLanguages.filter(lang => 
      lang.value === "all" || enrolledLanguages.has(lang.value.toLowerCase())
    );
    return filteredLanguages;
  }, [enrolledClasses, user?.targetLanguage, userLanguagesData?.languages]);

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
    if (learningContext !== "self-directed" && newLang !== "all") {
      const newClasses = getClassesForLanguage(newLang);
      const stillValid = newClasses.some(c => c.classId === learningContext);
      if (!stillValid) {
        // Reset to self-directed when class is no longer valid for new language
        setLearningContext("self-directed");
      }
    }
  };
  
  // Helper to get language flag for a class
  const getLanguageFlag = (langCode: string): string => {
    const lang = allLanguages.find(l => l.value.toLowerCase() === langCode.toLowerCase());
    return lang?.flag || "🌍";
  };

  const getContextLabel = (ctx: LearningContext): string => {
    if (ctx === "all" || ctx === "self-directed") return "Self-Directed";
    if (ctx === "all-learning") return "All Learning";
    const cls = enrolledClasses.find(e => e.classId === ctx);
    return cls?.class.name || "Self-Directed";
  };

  const getContextIcon = (ctx: LearningContext) => {
    if (ctx === "self-directed" || ctx === "all") return <User className="h-3 w-3" />;
    if (ctx === "all-learning") return <Filter className="h-3 w-3" />;
    return <GraduationCap className="h-3 w-3" />;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {showLanguage && selectedLanguage && (
          <Badge variant="secondary" className="text-sm" data-testid="badge-current-language">
            <span className="mr-1">{selectedLanguage.flag}</span>
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
            {availableLanguages.map((lang) => (
              <SelectItem key={lang.value} value={lang.value} data-testid={`option-language-${lang.value}`}>
                <span className="mr-2">{lang.flag}</span>
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
                        {getLanguageFlag(enrollment.class.language)}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      )}
    </div>
  );
}
