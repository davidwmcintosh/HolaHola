import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Star, Ban, RotateCcw, MessageSquare, Calendar, Filter, Database } from "lucide-react";

type CurationVerdict = "INCLUDE" | "EXCLUDE" | "HIGHLIGHT" | null;

type CuratedConversation = {
  id: string;
  language: string | null;
  createdAt: string;
  messageCount: number;
  firstMessage: string | null;
  danielaVerdict: "INCLUDE" | "EXCLUDE" | null;
  danielaReason: string | null;
  davidVerdict: CurationVerdict;
  davidNote: string | null;
};

type Stats = {
  total: number;
  highlighted: number;
  excluded: number;
  danielaFlagged: number;
};

const LANG_LABELS: Record<string, string> = {
  spanish: "Spanish",
  english: "English",
  french: "French",
  mandarin: "Mandarin",
  portuguese: "Portuguese",
  all: "All languages",
};

function verdictBadge(verdict: CurationVerdict) {
  if (verdict === "HIGHLIGHT") return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">Highlighted</Badge>;
  if (verdict === "EXCLUDE") return <Badge variant="destructive" className="opacity-80">Excluded</Badge>;
  return null;
}

function danielaBadge(verdict: "INCLUDE" | "EXCLUDE" | null) {
  if (verdict === "INCLUDE") return <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs">Daniela: In</Badge>;
  if (verdict === "EXCLUDE") return <Badge variant="outline" className="text-xs opacity-60">Daniela: Out</Badge>;
  return null;
}

export default function FineTuningCurator() {
  const [languageFilter, setLanguageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 30;

  const { data, isLoading } = useQuery<{ conversations: CuratedConversation[]; stats: Stats; total: number }>({
    queryKey: ["/api/fine-tuning/conversations", languageFilter, statusFilter, page],
    queryFn: () => apiRequest("GET", `/api/fine-tuning/conversations?language=${languageFilter}&status=${statusFilter}&page=${page}&limit=${PAGE_SIZE}`).then(r => r.json()),
  });

  const flagMutation = useMutation({
    mutationFn: ({ conversationId, verdict, note }: { conversationId: string; verdict: CurationVerdict; note?: string }) =>
      apiRequest("POST", "/api/fine-tuning/flag", { conversationId, verdict, note }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fine-tuning/conversations"] });
      const label = vars.verdict === null ? "reset to default" : vars.verdict === "HIGHLIGHT" ? "highlighted" : "excluded";
      toast({ title: `Session ${label}` });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const flag = (conversationId: string, verdict: CurationVerdict) =>
    flagMutation.mutate({ conversationId, verdict });

  const stats = data?.stats;
  const conversations = data?.conversations ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const inCount = total - (stats?.excluded ?? 0);

  return (
    <div className="space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Training Data Curator</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All your conversations are included by default. Highlight the ones that matter most — exclude the rare session that shouldn't be there.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "In training", value: inCount, icon: Database, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Highlighted", value: stats.highlighted, icon: Star, color: "text-amber-600 dark:text-amber-400" },
            { label: "Excluded", value: stats.excluded, icon: Ban, color: "text-destructive" },
            { label: "Daniela flagged", value: stats.danielaFlagged, icon: MessageSquare, color: "text-muted-foreground" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <div className="text-2xl font-semibold mt-1">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filter:
        </div>
        <Select value={languageFilter} onValueChange={v => { setLanguageFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["all", "spanish", "english", "french", "mandarin", "portuguese"].map(l => (
              <SelectItem key={l} value={l}>{LANG_LABELS[l] ?? l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sessions</SelectItem>
            <SelectItem value="highlighted">Highlighted</SelectItem>
            <SelectItem value="excluded">Excluded</SelectItem>
            <SelectItem value="unreviewed">Unreviewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No conversations match this filter.</div>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => {
            const date = new Date(conv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const isExcluded = conv.davidVerdict === "EXCLUDE";
            return (
              <Card
                key={conv.id}
                data-testid={`card-conversation-${conv.id.slice(0, 8)}`}
                className={isExcluded ? "opacity-50" : ""}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {date}
                        </span>
                        {conv.language && (
                          <Badge variant="outline" className="text-xs capitalize">{conv.language}</Badge>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {conv.messageCount} messages
                        </span>
                        {verdictBadge(conv.davidVerdict)}
                        {danielaBadge(conv.danielaVerdict)}
                      </div>
                      {conv.firstMessage && (
                        <p className="text-sm text-muted-foreground truncate max-w-xl">{conv.firstMessage}</p>
                      )}
                      {conv.danielaReason && (
                        <p className="text-xs text-muted-foreground italic">Daniela: "{conv.danielaReason.slice(0, 120)}{conv.danielaReason.length > 120 ? "…" : ""}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {conv.davidVerdict !== null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-reset-${conv.id.slice(0, 8)}`}
                          onClick={() => flag(conv.id, null)}
                          disabled={flagMutation.isPending}
                          title="Reset to default (included)"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={conv.davidVerdict === "HIGHLIGHT" ? "default" : "outline"}
                        data-testid={`button-highlight-${conv.id.slice(0, 8)}`}
                        onClick={() => flag(conv.id, conv.davidVerdict === "HIGHLIGHT" ? null : "HIGHLIGHT")}
                        disabled={flagMutation.isPending}
                      >
                        <Star className="h-3.5 w-3.5 mr-1" />
                        Highlight
                      </Button>
                      <Button
                        size="sm"
                        variant={conv.davidVerdict === "EXCLUDE" ? "destructive" : "outline"}
                        data-testid={`button-exclude-${conv.id.slice(0, 8)}`}
                        onClick={() => flag(conv.id, conv.davidVerdict === "EXCLUDE" ? null : "EXCLUDE")}
                        disabled={flagMutation.isPending}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Exclude
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page">Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} data-testid="button-next-page">Next</Button>
        </div>
      )}
    </div>
  );
}
