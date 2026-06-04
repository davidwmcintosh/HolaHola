import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/lib/auth";
import { DanielaLearningInsights } from "@/components/DanielaLearningInsights";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Headphones, MessageSquare, Play, ChevronRight, Eye } from "lucide-react";
import type { Scenario } from "@shared/schema";

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function LanguageHub() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { user } = useUser();
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

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

  const { data: reviewItems = [] } = useQuery<ReviewItem[]>({
    queryKey: ["/api/review-items", lang],
    queryFn: async () => {
      const res = await fetch(`/api/review-items?language=${lang}&limit=5`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
  });

  const recentConv = hubData?.recentConversations?.[0] ?? null;
  const topScenarios = featuredScenarios.slice(0, 3);

  return (
    <div className="min-h-full flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Ready to practice?
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Headphones className="h-4 w-4 shrink-0" />
          <p className="text-base">Get your headphones on, then click Start.</p>
        </div>
        <p className="text-sm text-muted-foreground mb-10">
          Daniela will greet you and route you to the right tutor.
        </p>
        <Button
          size="lg"
          className="gap-2 px-10 text-base"
          onClick={() => navigate("/chat")}
          data-testid="button-start-session"
        >
          <Phone className="h-5 w-5" />
          Start
        </Button>
      </section>

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

