import * as fs from "fs";
import * as path from "path";

export interface OnboardingDialogue {
  step1: {
    opener: string;
    retry: string;
  };
  step2: {
    success: string;
    retry: string;
  };
  step3: {
    success: string;
    retry: string;
  };
  step4: {
    opener: string;
  };
}

export const DEFAULT_DIALOGUE: OnboardingDialogue = {
  step1: {
    opener: "I focus on teaching practical, everyday language. Let's get started with your language learning! May I ask your name please?",
    retry: "I didn't quite catch your name. Could you tell me your name again?",
  },
  step2: {
    success: "Nice to meet you, {{name}}! Which language would you like to study?",
    retry: "I'm not sure which language you'd like to study. Please choose one from: English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, or Korean.",
  },
  step3: {
    success: "Great! And what is your native language, {{name}}? (The language you already speak)",
    retry: "I didn't quite catch that. What language do you speak? (For example: English, Spanish, French, German, etc.)",
  },
  step4: {
    opener: "Almost done, {{name}}! Last question: what's bringing you to {{language}}? (Travel, family, work, curiosity — whatever feels true.)",
  },
};

const CONFIG_PATH = path.join(process.cwd(), "server", "onboarding-dialogue.json");

let _cache: OnboardingDialogue | null = null;

export function getOnboardingDialogue(): OnboardingDialogue {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      _cache = { ...DEFAULT_DIALOGUE, ...JSON.parse(raw) };
      return _cache;
    }
  } catch (err) {
    console.warn("[OnboardingDialogue] Could not load config file — using defaults:", err);
  }
  _cache = { ...DEFAULT_DIALOGUE };
  return _cache;
}

export function updateOnboardingDialogue(updates: Partial<OnboardingDialogue>): OnboardingDialogue {
  const current = getOnboardingDialogue();
  _cache = {
    step1: { ...current.step1, ...(updates.step1 ?? {}) },
    step2: { ...current.step2, ...(updates.step2 ?? {}) },
    step3: { ...current.step3, ...(updates.step3 ?? {}) },
    step4: { ...current.step4, ...(updates.step4 ?? {}) },
  };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(_cache, null, 2), "utf-8");
  } catch (err) {
    console.warn("[OnboardingDialogue] Could not persist config file:", err);
  }
  return _cache;
}

export function resetOnboardingDialogue(): OnboardingDialogue {
  _cache = { ...DEFAULT_DIALOGUE };
  try {
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
  } catch {}
  return _cache;
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
