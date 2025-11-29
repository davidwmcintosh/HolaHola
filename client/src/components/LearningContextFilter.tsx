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

const languages = [
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

  const selectedLanguage = languages.find((lang) => lang.value === language);
  const classesForLanguage = getClassesForLanguage(language);
  const hasClasses = classesForLanguage.length > 0;

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const newClasses = getClassesForLanguage(newLang);
    if (learningContext !== "all" && learningContext !== "self-directed") {
      const stillValid = newClasses.some(c => c.classId === learningContext);
      if (!stillValid) {
        setLearningContext("all");
      }
    }
  };

  const getContextLabel = (ctx: LearningContext): string => {
    if (ctx === "all") return "All Learning";
    if (ctx === "self-directed") return "Self-Directed";
    const cls = enrolledClasses.find(e => e.classId === ctx);
    return cls?.class.name || "Class";
  };

  const getContextIcon = (ctx: LearningContext) => {
    if (ctx === "self-directed") return <User className="h-3 w-3" />;
    if (ctx !== "all") return <GraduationCap className="h-3 w-3" />;
    return <Filter className="h-3 w-3" />;
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
        {showContext && hasClasses && (
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
            {languages.map((lang) => (
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
        ) : hasClasses ? (
          <Select value={learningContext} onValueChange={setLearningContext}>
            <SelectTrigger className="w-[180px]" data-testid="select-learning-context">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-context-all">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span>All Learning</span>
                </div>
              </SelectItem>
              <SelectItem value="self-directed" data-testid="option-context-self">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Self-Directed</span>
                </div>
              </SelectItem>
              {classesForLanguage.map((enrollment) => (
                <SelectItem 
                  key={enrollment.classId} 
                  value={enrollment.classId}
                  data-testid={`option-context-class-${enrollment.classId}`}
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>{enrollment.class.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      )}
    </div>
  );
}
