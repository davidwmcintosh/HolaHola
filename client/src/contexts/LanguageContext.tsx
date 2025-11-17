import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type DifficultyLevel = "beginner" | "intermediate" | "advanced";

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
  userName: string;
  setUserName: (name: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState("spanish");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("beginner");
  const [userName, setUserNameState] = useState(() => {
    return localStorage.getItem("userName") || "";
  });

  useEffect(() => {
    if (userName) {
      localStorage.setItem("userName", userName);
    }
  }, [userName]);

  const setUserName = (name: string) => {
    setUserNameState(name);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, difficulty, setDifficulty, userName, setUserName }}>
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
