import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

type DifficultyLevel = "beginner" | "intermediate" | "advanced";

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
  userName: string;
  setUserName: (name: string) => void;
  subtitlesEnabled: boolean;
  setSubtitlesEnabled: (enabled: boolean) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(() => {
    const savedLanguage = localStorage.getItem("language") || "spanish";
    console.log('[LanguageContext] Initializing with language:', savedLanguage, '(from localStorage)');
    return savedLanguage;
  });
  const [difficulty, setDifficultyState] = useState<DifficultyLevel>(() => {
    const savedDifficulty = localStorage.getItem("difficulty") as DifficultyLevel || "beginner";
    console.log('[LanguageContext] Initializing with difficulty:', savedDifficulty, '(from localStorage)');
    return savedDifficulty;
  });
  const [userName, setUserNameState] = useState(() => {
    const savedName = localStorage.getItem("userName") || "";
    console.log('[LanguageContext] Initializing with userName:', savedName || '(empty)', '(from localStorage)');
    return savedName;
  });
  const [subtitlesEnabled, setSubtitlesEnabledState] = useState(() => {
    const saved = localStorage.getItem("subtitlesEnabled");
    const enabled = saved === null ? true : saved === "true";
    console.log('[LanguageContext] Initializing with subtitlesEnabled:', enabled, '(from localStorage)');
    return enabled;
  });

  // Fetch user preferences from database and sync with context
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Hydrate context from user's saved preferences when they become available
  useEffect(() => {
    if (user) {
      console.log('[LanguageContext] Hydrating from user preferences:', {
        targetLanguage: user.targetLanguage,
        difficultyLevel: user.difficultyLevel,
        firstName: user.firstName
      });

      // Sync target language
      if (user.targetLanguage && user.targetLanguage !== language) {
        console.log('[LanguageContext] Updating language from user preferences:', user.targetLanguage);
        setLanguageState(user.targetLanguage);
        localStorage.setItem("language", user.targetLanguage);
      }

      // Sync difficulty level
      if (user.difficultyLevel && user.difficultyLevel !== difficulty) {
        console.log('[LanguageContext] Updating difficulty from user preferences:', user.difficultyLevel);
        setDifficultyState(user.difficultyLevel as DifficultyLevel);
        localStorage.setItem("difficulty", user.difficultyLevel);
      }

      // Sync user name (first name only)
      const firstName = user.firstName || "";
      if (firstName && firstName !== userName) {
        console.log('[LanguageContext] Updating userName from user preferences:', firstName);
        setUserNameState(firstName);
        localStorage.setItem("userName", firstName);
      }
    }
  }, [user?.targetLanguage, user?.difficultyLevel, user?.firstName, user?.lastName]);

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem("difficulty", difficulty);
  }, [difficulty]);

  useEffect(() => {
    if (userName) {
      localStorage.setItem("userName", userName);
    }
  }, [userName]);

  const setLanguage = (lang: string) => {
    console.log('[LanguageContext] Setting language:', lang);
    localStorage.setItem("language", lang);
    setLanguageState(lang);
  };

  const setDifficulty = (diff: DifficultyLevel) => {
    console.log('[LanguageContext] Setting difficulty:', diff);
    localStorage.setItem("difficulty", diff);
    setDifficultyState(diff);
  };

  const setUserName = (name: string) => {
    console.log('[LanguageContext] Setting userName:', name);
    if (name) {
      localStorage.setItem("userName", name);
    }
    setUserNameState(name);
  };

  const setSubtitlesEnabled = (enabled: boolean) => {
    console.log('[LanguageContext] Setting subtitlesEnabled:', enabled);
    localStorage.setItem("subtitlesEnabled", String(enabled));
    setSubtitlesEnabledState(enabled);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, difficulty, setDifficulty, userName, setUserName, subtitlesEnabled, setSubtitlesEnabled }}>
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
