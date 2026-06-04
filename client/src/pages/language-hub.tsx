import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/lib/auth";
import {
  getTutorAvatar,
  getTutorName,
  getTutorTagline,
  languageAccentColors,
  type SupportedLanguage,
} from "@/lib/tutor-avatars";
import { DanielaLearningInsights } from "@/components/DanielaLearningInsights";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, Headphones, MessageSquare, Play, ChevronRight } from "lucide-react";
import holaholaLogo from "@assets/holaholamainlogoBackgroundRemoved_1765308837223.png";
import type { Scenario } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type TutorGender = "male" | "female";

interface HubData {
  recentConversations: Array<{
    id: string;
    title: string | null;
    createdAt: string;
    topics: Array<{ topic: { name: string } }>;
  }>;
}

// ─── Tutor roster — both genders per language ─────────────────────────────────

interface TutorEntry {
  language: SupportedLanguage;
  label: string;
  gender: TutorGender;
}

const TUTOR_ROSTER: TutorEntry[] = [
  { language: "spanish",    label: "Spanish",    gender: "female" },
  { language: "spanish",    label: "Spanish",    gender: "male"   },
  { language: "french",     label: "French",     gender: "female" },
  { language: "french",     label: "French",     gender: "male"   },
  { language: "german",     label: "German",     gender: "female" },
  { language: "german",     label: "German",     gender: "male"   },
  { language: "italian",    label: "Italian",    gender: "female" },
  { language: "italian",    label: "Italian",    gender: "male"   },
  { language: "portuguese", label: "Portuguese", gender: "female" },
  { language: "portuguese", label: "Portuguese", gender: "male"   },
  { language: "japanese",   label: "Japanese",   gender: "female" },
  { language: "japanese",   label: "Japanese",   gender: "male"   },
  { language: "chinese",    label: "Mandarin",   gender: "female" },
  { language: "chinese",    label: "Mandarin",   gender: "male"   },
  { language: "korean",     label: "Korean",     gender: "female" },
  { language: "korean",     label: "Korean",     gender: "male"   },
  { language: "english",    label: "English",    gender: "female" },
  { language: "english",    label: "English",    gender: "male"   },
  { language: "hebrew",     label: "Hebrew",     gender: "female" },
  { language: "hebrew",     label: "Hebrew",     gender: "male"   },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LanguageHub() {
  const [, navigate] = useLocation();
  const { language, setLanguage, setTutorGender } = useLanguage();
  const { user } = useUser();

  // Recent conversation (for the "continue" slug)
  const { data: hubData } = useQuery<HubData>({
    queryKey: ["/api/review-hub", { language }],
    queryFn: async () => {
      const params = new URLSearchParams({ language });
      const res = await fetch(`/api/review-hub?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Recommended scenarios (for the slug strip)
  const lang = language === "all" ? "spanish" : language;
  const { data: featuredScenarios = [] } = useQuery<(Scenario & { mode?: string })[]>({
    queryKey: ["/api/scenarios/recommended", lang],
    queryFn: async () => {
      const res = await fetch(`/api/scenarios/recommended?language=${lang}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleStart = () => navigate("/chat");

  const handlePickTutor = (lang: SupportedLanguage, gender: TutorGender) => {
    setLanguage(lang);
    setTutorGender(gender);
    navigate("/chat");
  };

  const recentConv = hubData?.recentConversations?.[0] ?? null;
  const topScenarios = featuredScenarios.slice(0, 3);

  return (
    <div className="min-h-full flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
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
          <p className="text-base">Get your headphones on, then click Start.</p>
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

      {/* ── Tutor grid divider ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-8 mb-8">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Or jump straight to a tutor
        </span>
        <div className="flex-1 border-t" />
      </div>

      {/* ── Tutor grid — both genders ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 px-6 pb-12">
        {TUTOR_ROSTER.map(({ language: lang, label, gender }) => {
          const name    = getTutorName(lang, gender);
          const tagline = getTutorTagline(lang, gender);
          const avatar  = getTutorAvatar(lang, gender, "listening");
          const accent  = languageAccentColors[lang];

          return (
            <TutorCard
              key={`${lang}-${gender}`}
              name={name}
              label={label}
              tagline={tagline}
              avatar={avatar}
              accent={accent}
              gender={gender}
              onClick={() => handlePickTutor(lang, gender)}
              testId={`card-tutor-${lang}-${gender}`}
            />
          );
        })}
      </div>

      {/* ── Daniela's Learning Insights ───────────────────────────────────── */}
      {user && (
        <div className="px-6 pb-8">
          <DanielaLearningInsights language={language} userId={user.id} />
        </div>
      )}

      {/* ── Continue conversation slug ─────────────────────────────────────── */}
      {recentConv && (
        <div className="px-6 pb-6">
          <Link href={`/chat?resume=${recentConv.id}`}>
            <div
              className="flex items-center justify-between p-3 rounded-md bg-green-50 dark:bg-green-900/20 hover-elevate cursor-pointer"
              data-testid="link-continue-conversation"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-800">
                  <MessageSquare className="h-5 w-5 text-green-700 dark:text-green-300" />
                </div>
                <div>
                  {(() => {
                    const topicNames = (recentConv.topics ?? [])
                      .map(t => t.topic?.name)
                      .filter(Boolean)
                      .slice(0, 2);
                    const title = recentConv.title || (topicNames.length > 0 ? `About ${topicNames.join(" & ")}` : null);
                    return (
                      <>
                        <p className="font-medium text-sm">
                          {title ? `Continue: ${title}` : "Continue recent conversation"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {topicNames.length > 0 ? `Keep practicing ${topicNames.join(", ")}` : "Pick up where you left off"}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </Link>
        </div>
      )}

      {/* ── Scenario strip ────────────────────────────────────────────────── */}
      {topScenarios.length > 0 && (
        <div className="px-6 pb-12">
          <div className="flex items-center justify-between gap-1 flex-wrap mb-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Play className="h-4 w-4 text-primary" />
                Practice Scenarios
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Based on your curriculum progression
              </p>
            </div>
            <Link href="/scenarios">
              <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="button-view-all-scenarios">
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {topScenarios.map((scenario) => (
              <Link href={`/chat?scenario=${scenario.slug}`} key={scenario.id}>
                <div
                  className="rounded-md border bg-card hover-elevate cursor-pointer overflow-hidden"
                  data-testid={`card-featured-scenario-${scenario.slug}`}
                >
                  {scenario.imageUrl ? (
                    <div className="h-24 overflow-hidden rounded-t-md">
                      <img
                        src={scenario.imageUrl}
                        alt={scenario.title}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ) : (
                    <div className="h-24 bg-muted/60 flex items-center justify-center rounded-t-md">
                      <Play className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="text-xs font-medium leading-snug line-clamp-2">
                      {scenario.title}
                    </p>
                    {scenario.location && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {scenario.location}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
  gender:  TutorGender;
  onClick: () => void;
  testId:  string;
}

function TutorCard({ name, label, tagline, avatar, accent, gender, onClick, testId }: TutorCardProps) {
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
