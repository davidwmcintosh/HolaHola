import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getTutorAvatar,
  getTutorName,
  getTutorTagline,
  languageAccentColors,
  type SupportedLanguage,
} from "@/lib/tutor-avatars";
import { Button } from "@/components/ui/button";
import { Phone, Headphones } from "lucide-react";
import holaholaLogo from "@assets/holaholamainlogoBackgroundRemoved_1765308837223.png";

// ─── Language roster — only conversational languages ─────────────────────────

const LANGUAGE_TUTORS: { language: SupportedLanguage; label: string }[] = [
  { language: "spanish",    label: "Spanish"  },
  { language: "french",     label: "French"   },
  { language: "german",     label: "German"   },
  { language: "italian",    label: "Italian"  },
  { language: "portuguese", label: "Portuguese" },
  { language: "japanese",   label: "Japanese" },
  { language: "chinese",    label: "Mandarin" },
  { language: "korean",     label: "Korean"   },
  { language: "english",    label: "English"  },
  { language: "hebrew",     label: "Hebrew"   },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LanguageHub() {
  const [, navigate] = useLocation();
  const { setLanguage, tutorGender } = useLanguage();

  const handleStart = () => {
    navigate("/chat");
  };

  const handlePickTutor = (lang: SupportedLanguage) => {
    setLanguage(lang);
    navigate("/chat");
  };

  return (
    <div className="min-h-full flex flex-col">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
        <img
          src={holaholaLogo}
          alt="HolaHola"
          className="h-14 mb-8 select-none"
          draggable={false}
        />

        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Ready to practice?
        </h1>

        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Headphones className="h-4 w-4 shrink-0" />
          <p className="text-base">
            Get your headphones on, then click Start.
          </p>
        </div>
        <p className="text-sm text-muted-foreground mb-10">
          Your tutor will ask what language you'd like to study.
        </p>

        <Button
          size="lg"
          className="gap-2 px-10 text-base"
          onClick={handleStart}
          data-testid="button-start-session"
        >
          <Phone className="h-5 w-5" />
          Start
        </Button>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-8 mb-8">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Or jump straight to a tutor
        </span>
        <div className="flex-1 border-t" />
      </div>

      {/* ── Tutor grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-6 pb-12">
        {LANGUAGE_TUTORS.map(({ language, label }) => {
          const name     = getTutorName(language, tutorGender);
          const tagline  = getTutorTagline(language, tutorGender);
          const avatar   = getTutorAvatar(language, tutorGender, "listening");
          const accent   = languageAccentColors[language];

          return (
            <TutorCard
              key={language}
              name={name}
              label={label}
              tagline={tagline}
              avatar={avatar}
              accent={accent}
              onClick={() => handlePickTutor(language)}
              testId={`card-tutor-${language}`}
            />
          );
        })}
      </div>

    </div>
  );
}

// ─── Tutor card ───────────────────────────────────────────────────────────────

interface TutorCardProps {
  name:    string;
  label:   string;
  tagline: string;
  avatar:  string;
  accent:  string;
  onClick: () => void;
  testId:  string;
}

function TutorCard({ name, label, tagline, avatar, accent, onClick, testId }: TutorCardProps) {
  return (
    <button
      className="text-left rounded-md border bg-card hover-elevate active-elevate-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
      onClick={onClick}
      data-testid={testId}
      type="button"
    >
      {/* Avatar */}
      <div className="rounded-t-md overflow-hidden h-36 bg-muted/30 relative">
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />
        {/* Accent stripe */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[3px]"
          style={{ backgroundColor: accent }}
        />
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className="font-semibold text-sm">{name}</span>
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${accent}22`, color: accent }}
          >
            {label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{tagline}</p>
      </div>
    </button>
  );
}
