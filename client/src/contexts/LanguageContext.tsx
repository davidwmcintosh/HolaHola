import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type SubtitleMode = "off" | "target" | "all";
export type TutorGender = "male" | "female";
export type VoiceSpeed = "slower" | "slow" | "normal" | "fast" | "faster";

function normalizeLanguageCode(lang: string): string {
  const lower = lang.toLowerCase().trim();
  if (lower === 'mandarin chinese' || lower === 'chinese') return 'mandarin';
  return lower;
}

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
  userName: string;
  setUserName: (name: string) => void;
  subtitleMode: SubtitleMode;
  setSubtitleMode: (mode: SubtitleMode) => void;
  tutorGender: TutorGender;
  setTutorGender: (gender: TutorGender) => void;
  voiceSpeed: VoiceSpeed;
  setVoiceSpeed: (speed: VoiceSpeed) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(() => {
    const savedLanguage = normalizeLanguageCode(localStorage.getItem("language") || "spanish");
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
  const [subtitleMode, setSubtitleModeState] = useState<SubtitleMode>(() => {
    const saved = localStorage.getItem("subtitleMode") as SubtitleMode;
    const mode = saved && ["off", "target", "all"].includes(saved) ? saved : "target";
    console.log('[LanguageContext] Initializing with subtitleMode:', mode, '(from localStorage)');
    return mode;
  });
  const [tutorGender, setTutorGenderState] = useState<TutorGender>(() => {
    const saved = localStorage.getItem("tutorGender") as TutorGender;
    const gender = saved && ["male", "female"].includes(saved) ? saved : "female";
    console.log('[LanguageContext] Initializing with tutorGender:', gender, '(from localStorage)');
    return gender;
  });
  const [voiceSpeed, setVoiceSpeedState] = useState<VoiceSpeed>(() => {
    const saved = localStorage.getItem("voiceSpeed") as VoiceSpeed;
    const validSpeeds = ["slower", "slow", "normal", "fast", "faster"];
    const speed = saved && validSpeeds.includes(saved) ? saved : "normal";
    console.log('[LanguageContext] Initializing with voiceSpeed:', speed, '(from localStorage)');
    return speed;
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

      // Sync target language — but guard against subject identifiers (biology, history)
      // that may have leaked in from subject tutor pages before the targetLanguageOverride fix.
      const SUBJECT_IDENTIFIERS = new Set(['biology', 'history']);
      const normalizedTargetLang = user.targetLanguage ? normalizeLanguageCode(user.targetLanguage) : null;
      if (normalizedTargetLang && SUBJECT_IDENTIFIERS.has(normalizedTargetLang)) {
        // Clear the bad value from the database silently — next language hub visit will restore
        // the user's actual learning language from whatever they select.
        console.log('[LanguageContext] Ignoring subject identifier stored as targetLanguage:', normalizedTargetLang, '— clearing from DB');
        apiRequest("PUT", "/api/user/preferences", { targetLanguage: null }).catch(() => {});
        localStorage.removeItem("language");
      } else if (normalizedTargetLang && normalizedTargetLang !== language) {
        console.log('[LanguageContext] Updating language from user preferences:', normalizedTargetLang);
        setLanguageState(normalizedTargetLang);
        localStorage.setItem("language", normalizedTargetLang);
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
    const normalized = normalizeLanguageCode(lang);
    console.log('[LanguageContext] Setting language:', normalized);
    localStorage.setItem("language", normalized);
    setLanguageState(normalized);
    
    // Also save to database so it persists across sessions and syncs with server
    apiRequest("PUT", "/api/user/preferences", { targetLanguage: lang })
      .then(() => {
        console.log('[LanguageContext] Saved targetLanguage to database:', lang);
      })
      .catch((err) => {
        console.error('[LanguageContext] Failed to save targetLanguage to database:', err);
      });
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

  const setSubtitleMode = (mode: SubtitleMode) => {
    console.log('[LanguageContext] Setting subtitleMode:', mode);
    localStorage.setItem("subtitleMode", mode);
    setSubtitleModeState(mode);
  };

  const setTutorGender = (gender: TutorGender) => {
    console.log('[LanguageContext] Setting tutorGender:', gender);
    localStorage.setItem("tutorGender", gender);
    setTutorGenderState(gender);
    
    // Also save to database so server picks up the change
    apiRequest("PUT", "/api/user/preferences", { tutorGender: gender })
      .then(() => {
        console.log('[LanguageContext] Saved tutorGender to database:', gender);
      })
      .catch((err) => {
        console.error('[LanguageContext] Failed to save tutorGender to database:', err);
      });
  };

  const setVoiceSpeed = (speed: VoiceSpeed) => {
    console.log('[LanguageContext] Setting voiceSpeed:', speed);
    localStorage.setItem("voiceSpeed", speed);
    setVoiceSpeedState(speed);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, difficulty, setDifficulty, userName, setUserName, subtitleMode, setSubtitleMode, tutorGender, setTutorGender, voiceSpeed, setVoiceSpeed }}>
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
