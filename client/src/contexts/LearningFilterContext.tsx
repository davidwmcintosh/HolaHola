import { createContext, useContext, useState, ReactNode } from "react";
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
    subject: string;
    targetLanguage: string;
    description: string | null;
    classCode: string;
    createdAt: string;
  };
}

export type LearningContext = "all" | "self-directed" | string;

interface LearningFilterContextType {
  learningContext: LearningContext;
  setLearningContext: (context: LearningContext) => void;
  enrolledClasses: EnrolledClass[];
  isLoadingClasses: boolean;
  getSelectedClassName: () => string;
  getClassesForLanguage: (lang?: string) => EnrolledClass[];
}

const LearningFilterContext = createContext<LearningFilterContextType | undefined>(undefined);

export function LearningFilterProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [learningContext, setLearningContextState] = useState<LearningContext>(() => {
    return localStorage.getItem("learningContext") || "all";
  });

  const { data: enrolledClasses = [], isLoading: isLoadingClasses } = useQuery<EnrolledClass[]>({
    queryKey: ["/api/student/classes"],
    staleTime: 5 * 60 * 1000,
  });

  const setLearningContext = (context: LearningContext) => {
    localStorage.setItem("learningContext", context);
    setLearningContextState(context);
  };

  const getSelectedClassName = (): string => {
    if (learningContext === "all") return "All Learning";
    if (learningContext === "self-directed") return "Self-Directed";
    const cls = enrolledClasses.find(e => e.classId === learningContext);
    return cls?.class.name || "Unknown Class";
  };

  const getClassesForLanguage = (lang?: string): EnrolledClass[] => {
    const targetLang = lang || language;
    return enrolledClasses.filter(e => 
      e.class.targetLanguage.toLowerCase() === targetLang.toLowerCase() && 
      e.isActive
    );
  };

  return (
    <LearningFilterContext.Provider value={{
      learningContext,
      setLearningContext,
      enrolledClasses,
      isLoadingClasses,
      getSelectedClassName,
      getClassesForLanguage,
    }}>
      {children}
    </LearningFilterContext.Provider>
  );
}

export function useLearningFilter() {
  const context = useContext(LearningFilterContext);
  if (!context) {
    throw new Error("useLearningFilter must be used within LearningFilterProvider");
  }
  return context;
}
