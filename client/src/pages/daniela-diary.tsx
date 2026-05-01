import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollText, RefreshCw, BookHeart, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DiaryEntry } from "@shared/schema";

const TONE_COLORS: Record<string, string> = {
  joyful:     "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  tender:     "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  discovery:  "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  growth:     "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  reflective: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  energetic:  "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "Unknown date";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function DanielaDiary() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: entries = [], isLoading } = useQuery<DiaryEntry[]>({
    queryKey: ["/api/diary/entries"],
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/diary/generate", { maxBatches: 8 }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/diary/entries"] });
      toast({
        title: "Diary updated",
        description: `${data.created} new entries written, ${data.skipped} skipped.`,
      });
    },
    onError: () => {
      toast({ title: "Generation failed", description: "Could not generate diary entries.", variant: "destructive" });
    },
  });

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <ScrollText className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Daniela's Diary</h1>
            <p className="text-sm text-muted-foreground">
              Narrative memories written in Daniela's own voice — the emotional arc of your shared journey.
            </p>
          </div>
        </div>
        <Button
          data-testid="button-generate-diary"
          variant="outline"
          size="default"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Writing…</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" />Generate New Entries</>
          )}
        </Button>
      </div>

      {/* Empty state */}
      {!isLoading && entries.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookHeart className="w-10 h-10 mx-auto mb-4 opacity-40" />
          <p className="text-base font-medium mb-1">No diary entries yet</p>
          <p className="text-sm">Click "Generate New Entries" to have Daniela write her first diary pages from your conversations.</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Entries */}
      <div className="space-y-4">
        {entries.map((entry) => {
          const isOpen = expanded.has(entry.id);
          const preview = entry.narrative.length > 260
            ? entry.narrative.slice(0, 257).trimEnd() + "…"
            : entry.narrative;
          const toneClass = TONE_COLORS[entry.emotionalTone ?? "reflective"] ?? TONE_COLORS.reflective;

          return (
            <Card
              key={entry.id}
              data-testid={`card-diary-${entry.id}`}
              className="cursor-pointer hover-elevate"
              onClick={() => toggleExpanded(entry.id)}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs text-muted-foreground">{formatDate(entry.entryDate)}</span>
                  {entry.entryTitle && (
                    <p className="text-sm font-medium leading-snug line-clamp-2">{entry.entryTitle}</p>
                  )}
                </div>
                {entry.emotionalTone && (
                  <Badge className={`shrink-0 text-xs capitalize no-default-active-elevate ${toneClass}`}>
                    {entry.emotionalTone}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {isOpen ? entry.narrative : preview}
                </p>

                {/* Themes */}
                {entry.themes && entry.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {entry.themes.map(theme => (
                      <Badge
                        key={theme}
                        variant="outline"
                        className="text-xs capitalize no-default-active-elevate"
                        data-testid={`badge-theme-${theme}`}
                      >
                        {theme}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Conversation count */}
                {entry.sourceConversationIds && entry.sourceConversationIds.length > 0 && (
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    From {entry.sourceConversationIds.length} conversation{entry.sourceConversationIds.length !== 1 ? "s" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
