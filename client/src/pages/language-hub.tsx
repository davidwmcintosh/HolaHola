import { useState } from "react";
import bonsaiJapanImg from "@assets/bonsai_no_background_1780632791121.png";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/lib/auth";
import { DanielaLearningInsights } from "@/components/DanielaLearningInsights";
import { InteractiveTextbookCard } from "@/components/InteractiveTextbookCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Play, ChevronRight, Eye, Sparkles, Phone, ArrowRight } from "lucide-react";
import {
  getTutorAvatar,
  getTutorName,
  getTutorTagline,
  languageAccentColors,
  normalizeLanguage,
} from "@/lib/tutor-avatars";
import type { TutorGender } from "@/lib/tutor-avatars";
import type { Scenario } from "@shared/schema";

// ─── SVG flag backgrounds (ghost opacity — recognisable shapes) ───────────────
function _flag(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function _starPts(cx: number, cy: number, r: number): string {
  const ri = r * 0.4;
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const d = i % 2 === 0 ? r : ri;
    return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}
const _s = (cx: number, cy: number, r: number, fill = "white") =>
  `<polygon points="${_starPts(cx, cy, r)}" fill="${fill}"/>`;

const FLAG_BG: Record<string, string> = (() => {
  // Spain — red / yellow / red horizontal (1:2:1)
  const spanish = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><g opacity=".09"><rect width="3" height=".5" fill="#AA151B"/><rect y=".5" width="3" height="1" fill="#F1BF00"/><rect y="1.5" width="3" height=".5" fill="#AA151B"/></g></svg>`);

  // France — blue / white / red vertical thirds
  const french = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><g opacity=".09"><rect width="1" height="2" fill="#002395"/><rect x="2" width="1" height="2" fill="#ED2939"/></g></svg>`);

  // Germany — black / red / gold horizontal thirds
  const german = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 1"><g opacity=".08"><rect width="3" height=".333" fill="#000"/><rect y=".333" width="3" height=".334" fill="#DD0000"/><rect y=".667" width="3" height=".333" fill="#FFCE00"/></g></svg>`);

  // Italy — green / white / red vertical thirds
  const italian = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><g opacity=".09"><rect width="1" height="2" fill="#009246"/><rect x="2" width="1" height="2" fill="#CE2B37"/></g></svg>`);

  // Portugal — green / red split with gold emblem outline
  const portuguese = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3"><g opacity=".09"><rect width="5" height="3" fill="#FF0000"/><rect width="2" height="3" fill="#006600"/><circle cx="2" cy="1.5" r=".65" fill="none" stroke="#FFD700" stroke-width=".12"/><circle cx="2" cy="1.5" r=".28" fill="#003893"/></g></svg>`);

  // Japan — PNG bonsai overlay (see portrait container below)
  const japanese = null;

  // China — red field + 5 gold stars
  const chinese = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><g opacity=".09"><rect width="30" height="20" fill="#DE2910"/>${_s(5,5,3.2,"#FFDE00")}${_s(11,2,1.5,"#FFDE00")}${_s(13.5,5,1.5,"#FFDE00")}${_s(11,8.5,1.5,"#FFDE00")}${_s(8,11,1.5,"#FFDE00")}</g></svg>`);

  // Korea — white + Taegeuk (red top / blue bottom) + 4 corner trigrams
  const korean = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><g opacity=".09"><rect width="30" height="20" fill="#f5f5f5"/><circle cx="15" cy="10" r="4" fill="#C60C30"/><path d="M15,6 A4,4,0,0,0,15,14 A2,2,0,0,0,15,10 A2,2,0,0,1,15,6Z" fill="#003478"/><line x1="3" y1="3" x2="8" y2="3" stroke="#000" stroke-width=".8"/><line x1="3" y1="4.5" x2="8" y2="4.5" stroke="#000" stroke-width=".8"/><line x1="3" y1="6" x2="8" y2="6" stroke="#000" stroke-width=".8"/><line x1="22" y1="14" x2="27" y2="14" stroke="#000" stroke-width=".8"/><line x1="22" y1="15.5" x2="27" y2="15.5" stroke="#000" stroke-width=".8"/><line x1="22" y1="17" x2="27" y2="17" stroke="#000" stroke-width=".8"/><line x1="22" y1="3" x2="24.5" y2="3" stroke="#000" stroke-width=".8"/><line x1="25.5" y1="3" x2="27" y2="3" stroke="#000" stroke-width=".8"/><line x1="22" y1="4.5" x2="27" y2="4.5" stroke="#000" stroke-width=".8"/><line x1="22" y1="6" x2="24.5" y2="6" stroke="#000" stroke-width=".8"/><line x1="25.5" y1="6" x2="27" y2="6" stroke="#000" stroke-width=".8"/><line x1="3" y1="14" x2="5.5" y2="14" stroke="#000" stroke-width=".8"/><line x1="6.5" y1="14" x2="8" y2="14" stroke="#000" stroke-width=".8"/><line x1="3" y1="15.5" x2="8" y2="15.5" stroke="#000" stroke-width=".8"/><line x1="3" y1="17" x2="5.5" y2="17" stroke="#000" stroke-width=".8"/><line x1="6.5" y1="17" x2="8" y2="17" stroke="#000" stroke-width=".8"/></g></svg>`);

  // Israel — white + 2 blue bands + Star of David
  const hebrew = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><g opacity=".09"><rect width="3" height="2" fill="#f5f5f5"/><rect y=".22" width="3" height=".22" fill="#003399"/><rect y="1.56" width="3" height=".22" fill="#003399"/><polygon points="1.5,.72 1.7,1.08 1.3,1.08" fill="none" stroke="#003399" stroke-width=".06"/><polygon points="1.5,1.28 1.7,.92 1.3,.92" fill="none" stroke="#003399" stroke-width=".06"/></g></svg>`);

  // USA — 13 red/white stripes + blue canton + 6 white stars
  const sh = 100 / 13;
  const cw = 76, ch = sh * 7;
  let stripes = "";
  for (let i = 0; i < 7; i++) stripes += `<rect y="${(i * 2 * sh).toFixed(1)}" width="190" height="${sh.toFixed(1)}" fill="#B22234"/>`;
  const starPositions = [
    [cw*0.2,ch*0.2],[cw*0.5,ch*0.2],[cw*0.8,ch*0.2],
    [cw*0.2,ch*0.6],[cw*0.5,ch*0.6],[cw*0.8,ch*0.6],
    [cw*0.35,ch*0.4],[cw*0.65,ch*0.4],
  ];
  const uStars = starPositions.map(([sx,sy]) => _s(sx, sy, 4.5)).join("");
  const english = _flag(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 100"><g opacity=".09">${stripes}<rect width="${cw}" height="${ch.toFixed(1)}" fill="#3C3B6E"/>${uStars}</g></svg>`);

  return { spanish, french, german, italian, portuguese, japanese, chinese, mandarin: chinese, korean, hebrew, english };
})();

// ─── Types ────────────────────────────────────────────────────────────────────

interface HubData {
  recentConversations: Array<{
    id: string;
    title: string | null;
    createdAt: string;
    topics: Array<{ topic: { name: string } }>;
  }>;
}

interface ReviewItem {
  id: string;
  prompt: string;
  targetText: string;
  context?: string | null;
  itemType: string;
  createdAt: string;
}

const ITEM_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  vocabulary: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Word" },
  phrase:     { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Phrase" },
  grammar:    { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", label: "Grammar" },
  pronunciation: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Sound" },
};

// ─── Tutor Duo Panel ──────────────────────────────────────────────────────────

interface TutorDuoPanelProps {
  language: string;
  onStart: (gender: TutorGender) => void;
}

function TutorDuoPanel({ language, onStart }: TutorDuoPanelProps) {
  const normalized = normalizeLanguage(language);
  const accentColor = languageAccentColors[normalized] ?? "#6366f1";

  const tutors: Array<{ gender: TutorGender }> = [
    { gender: "female" },
    { gender: "male" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {tutors.map(({ gender }) => {
        const name = getTutorName(normalized, gender);
        const tagline = getTutorTagline(normalized, gender);
        const portrait = getTutorAvatar(normalized, gender, "talking");

        return (
          <div
            key={gender}
            className="rounded-lg overflow-hidden border bg-card flex flex-col"
            data-testid={`card-tutor-${normalized}-${gender}`}
          >
            {/* Portrait area — ghost flag bg + accent circle + avatar */}
            <div
              className="relative flex items-end justify-center overflow-hidden bg-muted/40"
              style={{
                height: "200px",
                backgroundImage: FLAG_BG[normalized] ?? undefined,
                backgroundSize: FLAG_BG[normalized] ? "cover" : undefined,
                backgroundPosition: FLAG_BG[normalized] ? "center" : undefined,
                backgroundRepeat: FLAG_BG[normalized] ? "no-repeat" : undefined,
              }}
            >
              {/* Japanese bonsai PNG overlay — right side + mirrored left side */}
              {normalized === 'japanese' && (
                <>
                  <img
                    src={bonsaiJapanImg}
                    aria-hidden
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain object-right-bottom pointer-events-none select-none"
                    style={{ opacity: 0.13 }}
                  />
                  <img
                    src={bonsaiJapanImg}
                    aria-hidden
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain object-left-bottom pointer-events-none select-none"
                    style={{ opacity: 0.13, transform: 'scaleX(-1)' }}
                  />
                </>
              )}
              {/* Accent-coloured circle behind the tutor */}
              <div
                className="absolute rounded-full"
                style={{
                  width: "178px",
                  height: "178px",
                  backgroundColor: "#ffffff",
                  border: `3px solid ${accentColor}`,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08)",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
              <img
                src={portrait}
                alt={name}
                className="relative h-full w-auto object-contain object-bottom select-none"
                draggable={false}
              />
            </div>

            {/* Info + action */}
            <div className="p-4 flex flex-col gap-3 flex-1">
              <div>
                <p className="font-semibold text-base leading-tight">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tagline}</p>
              </div>
              <Button
                size="default"
                className="w-full gap-2"
                onClick={() => onStart(gender)}
                data-testid={`button-start-${normalized}-${gender}`}
                style={{ backgroundColor: accentColor, color: "#fff", borderColor: accentColor }}
              >
                <Phone className="h-4 w-4" />
                Call {name}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── New Student Welcome Panel ────────────────────────────────────────────────

function WelcomePanel({ onStart }: { onStart: () => void }) {
  const danielaPortrait = getTutorAvatar("spanish", "female", "talking");

  return (
    <div className="flex flex-col items-center text-center gap-6 py-4">
      {/* Portrait */}
      <div
        className="relative flex items-end justify-center rounded-xl overflow-hidden w-full"
        style={{ backgroundColor: "#F59E0B18", height: "220px" }}
      >
        <img
          src={danielaPortrait}
          alt="Daniela"
          className="h-full w-auto object-contain object-bottom select-none"
          draggable={false}
        />
      </div>

      {/* Copy */}
      <div className="space-y-1.5 px-2">
        <h2 className="text-xl font-bold tracking-tight">Meet Daniela</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          She'll guide you through a quick setup — pick your language, share your goals,
          and you'll be speaking in minutes.
        </p>
      </div>

      {/* CTA */}
      <Button
        size="lg"
        className="gap-2 px-10"
        onClick={onStart}
        data-testid="button-begin-onboarding"
      >
        Begin your first session
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LanguageHub() {
  const [, navigate] = useLocation();
  const { language, setLanguage, setTutorGender } = useLanguage();
  const { user } = useUser();
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Studied languages for the tab strip
  const { data: userLanguagesData } = useQuery<{ languages: string[] }>({
    queryKey: ["/api/user/languages"],
    queryFn: async () => {
      const res = await fetch("/api/user/languages", { credentials: "include" });
      if (!res.ok) return { languages: [] };
      return res.json();
    },
  });
  const studiedLanguages = userLanguagesData?.languages ?? [];
  const showTabs = studiedLanguages.length > 1;
  const defaultLang = language === "all" ? "spanish" : language;
  const [selectedLang, setSelectedLang] = useState<string>(defaultLang);

  const { data: hubData } = useQuery<HubData>({
    queryKey: ["/api/review-hub", { language }],
    queryFn: async () => {
      const params = new URLSearchParams({ language });
      const res = await fetch(`/api/review-hub?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Recommended scenarios (for the slug strip) — use selectedLang for tab-aware filtering
  const { data: featuredScenarios = [] } = useQuery<(Scenario & { mode?: string })[]>({
    queryKey: ["/api/scenarios/recommended", selectedLang],
    queryFn: async () => {
      const res = await fetch(`/api/scenarios/recommended?language=${selectedLang}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: reviewItems = [], isLoading: reviewItemsLoading } = useQuery<ReviewItem[]>({
    queryKey: ["/api/review-items", selectedLang],
    queryFn: async () => {
      const res = await fetch(`/api/review-items?language=${selectedLang}&limit=5`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
  });

  const showEmptyState = showTabs && !reviewItemsLoading && reviewItems.length === 0;

  const recentConv = hubData?.recentConversations?.[0] ?? null;
  const topScenarios = featuredScenarios.slice(0, 3);

  // Brand new student: languages loaded but empty → show onboarding welcome
  const isNewStudent = userLanguagesData !== undefined && studiedLanguages.length === 0;

  const handleStartWithTutor = (gender: TutorGender) => {
    setLanguage(selectedLang);
    setTutorGender(gender);
    localStorage.setItem("forceNewConversation", "true");
    navigate("/chat");
  };

  const handleBeginOnboarding = () => {
    navigate("/chat");
  };

  return (
    <div className="min-h-full flex flex-col">

      {/* ── New student welcome OR returning tutor duo ────────────────────── */}
      {isNewStudent ? (
        <section className="px-6 pt-8 pb-6">
          <WelcomePanel onStart={handleBeginOnboarding} />
        </section>
      ) : (
        <section className="px-6 pt-8 pb-6">
          <TutorDuoPanel
            language={selectedLang}
            onStart={handleStartWithTutor}
          />
        </section>
      )}

      {/* ── Language Tabs (returning students only) ───────────────────────── */}
      {!isNewStudent && showTabs && (
        <div className="px-6 pb-6 flex gap-2 justify-center flex-wrap">
          {studiedLanguages.map((lang) => (
            <Button
              key={lang}
              variant={selectedLang === lang ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedLang(lang)}
              data-testid={`tab-language-${lang}`}
              className="capitalize"
            >
              {lang}
            </Button>
          ))}
        </div>
      )}

      {/* ── Daniela's Learning Insights ───────────────────────────────────── */}
      {user && !showEmptyState && (
        <div className="px-6 pb-8">
          <DanielaLearningInsights language={selectedLang} userId={user.id} />
        </div>
      )}

      {/* ── Empty state for languages with no sessions yet ─────────────────── */}
      {showEmptyState && (
        <div className="px-6 pb-8">
          <Card className="border-dashed" data-testid="section-empty-language">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="p-3 rounded-full bg-muted">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm capitalize">No {selectedLang} sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start a conversation and your vocabulary, phrases, and insights will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
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

      {/* ── From Your Conversations ───────────────────────────────────────── */}
      {reviewItems.length > 0 && (
        <div className="px-6 pb-8">
          <Card data-testid="section-from-conversations">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
                From Your Conversations
              </CardTitle>
              <CardDescription>Vocabulary, phrases, and grammar from your recent chats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {reviewItems.map((item) => {
                const typeConf = ITEM_TYPE_CONFIG[item.itemType] ?? ITEM_TYPE_CONFIG.vocabulary;
                const isRevealed = revealedIds.has(item.id);
                return (
                  <div key={item.id} className="rounded-md border p-3 space-y-2" data-testid={`review-item-${item.id}`}>
                    <Badge variant="outline" className={`text-xs ${typeConf.color}`}>
                      {typeConf.label}
                    </Badge>
                    <p className="text-sm font-medium">{item.prompt}</p>
                    {item.context && (
                      <p className="text-xs text-muted-foreground italic">"{item.context}"</p>
                    )}
                    {!isRevealed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setRevealedIds(prev => new Set([...prev, item.id]))}
                        data-testid={`button-reveal-${item.id}`}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        Show answer
                      </Button>
                    ) : (
                      <div className="bg-primary/10 rounded-md px-3 py-2 text-center">
                        <p className="text-sm font-semibold text-primary">{item.targetText}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <Link href="/review-hub">
                <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1" data-testid="link-full-review-hub">
                  See all in Review Hub <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Interactive Textbook ──────────────────────────────────────────── */}
      <div className="px-6 pb-6">
        <InteractiveTextbookCard />
      </div>

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
