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
  const [language, setLanguageState] = useState(() => {
    const savedLanguage = localStorage.getItem("language") || "spanish";
    console.log('[LanguageContext] Initializing with language:', savedLanguage, '(from localStorage)');
    return savedLanguage;
  });
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("beginner");
  const [userName, setUserNameState] = useState(() => {
    const savedName = localStorage.getItem("userName") || "";
    console.log('[LanguageContext] Initializing with userName:', savedName || '(empty)', '(from localStorage)');
    return savedName;
  });

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  useEffect(() => {
    if (userName) {
      localStorage.setItem("userName", userName);
    }
  }, [userName]);

  const setLanguage = (lang: string) => {
    console.log('[LanguageContext] Setting language:', lang);
    // Save to localStorage immediately (synchronously) to ensure persistence
    localStorage.setItem("language", lang);
    setLanguageState(lang);
  };

  const setUserName = (name: string) => {
    console.log('[LanguageContext] Setting userName:', name);
    if (name) {
      localStorage.setItem("userName", name);
    }
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
