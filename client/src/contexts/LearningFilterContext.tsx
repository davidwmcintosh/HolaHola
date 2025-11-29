import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "./LanguageContext";

export interface EnrolledClass {
  id: string;
  classId: string;
  studentId: string;
  enrolledAt: string;
  isActive: boolean;
  class: {
    id: string;
    teacherId: string;
    name: string;
    language: string;
    description: string | null;
    joinCode: string;
    curriculumPathId?: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

export type LearningContext = "all" | "self-directed" | "all-classes" | string;

interface LearningFilterContextType {
  learningContext: LearningContext;
  setLearningContext: (context: LearningContext) => void;
  enrolledClasses: EnrolledClass[];
  isLoadingClasses: boolean;
  getSelectedClassName: () => string;
  getClassesForLanguage: (lang?: string) => EnrolledClass[];
  getTutorContexts: () => Array<{ id: string; name: string; language: string; type: "self-directed" | "class" }>;
}

const LearningFilterContext = createContext<LearningFilterContextType | undefined>(undefined);

export function LearningFilterProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [learningContext, setLearningContextState] = useState<LearningContext>(() => {
    const stored = localStorage.getItem("learningContext");
    // Never default to empty or "all" - use "self-directed" as default
    if (!stored || stored === "all") return "self-directed";
    return stored;
  });

  const { data: enrolledClasses = [], isLoading: isLoadingClasses } = useQuery<EnrolledClass[]>({
    queryKey: ["/api/student/classes"],
    staleTime: 5 * 60 * 1000,
  });

  // Validate that the current context is valid, otherwise reset to self-directed or first class
  useEffect(() => {
    if (isLoadingClasses) return;
    
    // If context is "all", switch to self-directed
    if (learningContext === "all") {
      setLearningContext("self-directed");
      return;
    }
    
    // If context is a class ID, validate it exists
    if (learningContext !== "self-directed") {
      const classExists = enrolledClasses.some(e => e.classId === learningContext && e.isActive);
      if (!classExists) {
        // Class no longer exists, reset to self-directed
        setLearningContext("self-directed");
      }
    }
  }, [enrolledClasses, learningContext, isLoadingClasses]);

  const setLearningContext = (context: LearningContext) => {
    // Never allow setting to "all" - use self-directed instead
    const safeContext = context === "all" ? "self-directed" : context;
    localStorage.setItem("learningContext", safeContext);
    setLearningContextState(safeContext);
  };

  const getSelectedClassName = (): string => {
    if (learningContext === "all") return "Self-Directed"; // Fallback
    if (learningContext === "self-directed") return "Self-Directed";
    if (learningContext === "all-classes") return "All Classes";
    const cls = enrolledClasses.find(e => e.classId === learningContext);
    return cls?.class.name || "Self-Directed";
  };

  const getClassesForLanguage = (lang?: string): EnrolledClass[] => {
    const targetLang = lang || language;
    if (!targetLang) return [];
    return enrolledClasses.filter(e => 
      e.class?.language?.toLowerCase() === targetLang.toLowerCase() && 
      e.isActive
    );
  };

  // Get all available tutor contexts (for the tutor selection menu)
  const getTutorContexts = (): Array<{ id: string; name: string; language: string; type: "self-directed" | "class" }> => {
    const contexts: Array<{ id: string; name: string; language: string; type: "self-directed" | "class" }> = [];
    
    // Always include self-directed option with current language
    if (language) {
      contexts.push({
        id: "self-directed",
        name: `${getLanguageDisplayName(language)} (Self-Directed)`,
        language: language,
        type: "self-directed"
      });
    }
    
    // Add all enrolled classes
    enrolledClasses.forEach(enrollment => {
      if (enrollment.isActive && enrollment.class) {
        contexts.push({
          id: enrollment.classId,
          name: enrollment.class.name,
          language: enrollment.class.language,
          type: "class"
        });
      }
    });
    
    return contexts;
  };

  return (
    <LearningFilterContext.Provider value={{
      learningContext,
      setLearningContext,
      enrolledClasses,
      isLoadingClasses,
      getSelectedClassName,
      getClassesForLanguage,
      getTutorContexts,
    }}>
      {children}
    </LearningFilterContext.Provider>
  );
}

function getLanguageDisplayName(code: string): string {
  const names: Record<string, string> = {
    spanish: "Spanish",
    french: "French",
    german: "German",
    italian: "Italian",
    portuguese: "Portuguese",
    japanese: "Japanese",
    chinese: "Chinese",
    korean: "Korean",
    russian: "Russian",
  };
  return names[code] || code;
}

export function useLearningFilter() {
  const context = useContext(LearningFilterContext);
  if (!context) {
    throw new Error("useLearningFilter must be used within LearningFilterProvider");
  }
  return context;
}
