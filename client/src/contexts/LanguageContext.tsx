import { createContext, useContext, useState, ReactNode } from "react";

type DifficultyLevel = "beginner" | "intermediate" | "advanced";

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState("spanish");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("beginner");

  return (
    <LanguageContext.Provider value={{ language, setLanguage, difficulty, setDifficulty }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
