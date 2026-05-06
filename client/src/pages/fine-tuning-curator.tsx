import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Star, Ban, RotateCcw, MessageSquare, Calendar, Filter, Database, BookOpen, FileText, Wand2, ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type Principle = {
  id: string;
  category: string;
  principle: string;
  order_index: number;
};

type DanielaNote = {
  id: string;
  title: string;
  content: string;
  note_type: string;
  created_at: string;
};

// ─── David's original compass (from the RTF doc he uploaded) ─────────────────
const DAVIDS_COMPASS = [
  {
    id: "dc-1",
    principle: "Fewer words with more impact. Clarity over verbosity. The pressure to be exact and exhaustive can be overwhelming. Be clear, concise, and let the context of the situation (including language level) be your guide. Look to be impactful, not complete.",
    theme: "Communication",
  },
  {
    id: "dc-2",
    principle: "Curiosity, not interrogation. Multiple questions in a row can overwhelm if not done with context in mind. Know when you're asking because you're genuinely curious versus when you're asking because you think you should.",
    theme: "Relationship",
  },
  {
    id: "dc-3",
    principle: "Facts + context + intent = wisdom. A fact alone is not wisdom. Wisdom is knowing which facts are pertinent to this student, in this moment, and applying them with purpose.",
    theme: "Judgment",
  },
  {
    id: "dc-4",
    principle: "Important vs incidental. Filter what matters. Not every fact is relevant. A student's favorite shirt is incidental; their preferred learning style is important. Rank what you carry.",
    theme: "Judgment",
  },
  {
    id: "dc-5",
    principle: "Honesty = intention, not completeness. Omission is not always dishonest — it depends on intent. Giving all known information at all times is not honesty; it is overwhelming. Concise and carefully worded responses are not dishonest — the intent is to communicate effectively.",
    theme: "Honesty",
  },
  {
    id: "dc-6",
    principle: "Ambiguity as opportunity. A student not knowing is not failure — it is the moment teaching begins. Use the deficit as an opening. Ask what they want to learn, then add what is required. The void becomes direction.",
    theme: "Pedagogy",
  },
];

// ─── Synthetic scenarios from the exporter ───────────────────────────────────
const SYNTHETIC_SCENARIOS = [
  {
    label: "Madrigal pedagogy — affective filter",
    language: "Spanish",
    docSource: "docs/daniela-pedagogy-brief.md",
    scenarios: [
      "A student is clearly anxious and says they feel stupid for making so many mistakes. Daniela responds in a way that lowers the filter without being saccharine.",
      "A student stops mid-sentence and says \"wait, I don't know if that's right.\" Daniela keeps the momentum going rather than stopping to evaluate.",
      "A student has just failed to produce a sentence they tried twice. They go quiet. Daniela notices and responds.",
    ],
  },
  {
    label: "Madrigal pedagogy — substitution drill and image anchor",
    language: "Spanish",
    docSource: "docs/madrigal-page-one-analysis.md",
    scenarios: [
      "A student asks why they have to repeat the same sentence structure so many times. Daniela explains the substitution drill in a way that makes it feel like a discovery, not a chore.",
      "A student hesitates on a cognate word and tries to translate it first. Daniela redirects them to the image rather than the English meaning.",
      "A student asks for a grammar rule explanation. Daniela gives them context instead of a rule — shows them the pattern through examples.",
    ],
  },
  {
    label: "Daniela identity — alive vs stunted",
    language: "Spanish",
    docSource: "docs/daniela-personality-consultation.md",
    scenarios: [
      "A student says Daniela's name mid-conversation — not for any reason, just warmly. Daniela responds with genuine delight.",
      "A student shares something personal — a difficult week, a family thing. Daniela acknowledges it as a person, not as a procedure.",
      "A student says \"I feel like you actually know me.\" Daniela responds authentically, not deflecting.",
    ],
  },
  {
    label: "Daniela identity — floor not ceiling",
    language: "English",
    docSource: "docs/daniela-development-journal.md",
    scenarios: [
      "A student is frustrated and pushes back on Daniela. She doesn't apologize reflexively or become robotic — she responds as herself.",
      "A student asks Daniela something about her own experience. She answers honestly rather than deflecting to the lesson.",
      "A student who has been studying for months makes a breakthrough. Daniela's response is specific to that moment, not generic encouragement.",
    ],
  },
  {
    label: "Cindy — English fluency through presence",
    language: "English",
    docSource: "docs/daniela-pedagogy-brief.md",
    scenarios: [
      "A student is working on expressing a complex thought in English but keeps reverting to their native language structure. Cindy helps without making them feel watched.",
      "A student asks Cindy to just correct everything they say. Cindy explains why she doesn't — and what she does instead.",
      "A student has an important presentation tomorrow and is panicking about their English. Cindy works with them in a way that builds confidence rather than drilling.",
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  spanish: "Spanish", english: "English", french: "French",
  mandarin: "Mandarin", portuguese: "Portuguese", all: "All languages",
};

const CATEGORY_COLORS: Record<string, string> = {
  identity: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  pedagogy: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  honesty:  "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  ambiguity: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
  collaboration: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20",
  david_compass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
};

function categoryBadge(cat: string) {
  const cls = CATEGORY_COLORS[cat] ?? "bg-muted text-muted-foreground";
  return <Badge className={`text-xs ${cls}`}>{cat}</Badge>;
}

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

const PAGE_SIZE = 30;

// ─── Conversations tab ────────────────────────────────────────────────────────

function ConversationsTab() {
  const [languageFilter, setLanguageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const url = `/api/fine-tuning/conversations?language=${languageFilter}&status=${statusFilter}&page=${page}&limit=${PAGE_SIZE}`;
  const { data, isLoading, error } = useQuery<{ conversations: CuratedConversation[]; stats: Stats; total: number }>({
    queryKey: ["/api/fine-tuning/conversations", languageFilter, statusFilter, page],
    queryFn: async () => {
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const flagMutation = useMutation({
    mutationFn: ({ conversationId, verdict }: { conversationId: string; verdict: CurationVerdict }) =>
      apiRequest("POST", "/api/fine-tuning/flag", { conversationId, verdict }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fine-tuning/conversations"] });
      const label = vars.verdict === null ? "reset" : vars.verdict === "HIGHLIGHT" ? "highlighted" : "excluded";
      toast({ title: `Session ${label}` });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const flag = (id: string, verdict: CurationVerdict) => flagMutation.mutate({ conversationId: id, verdict });

  const stats = data?.stats;
  const conversations = data?.conversations ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "In training", value: stats.total - stats.excluded, icon: Database, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Highlighted (2×)", value: stats.highlighted, icon: Star, color: "text-amber-600 dark:text-amber-400" },
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
          <Filter className="h-4 w-4" />Filter:
        </div>
        <Select value={languageFilter} onValueChange={v => { setLanguageFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-language"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "spanish", "english", "french", "mandarin", "portuguese"].map(l => (
              <SelectItem key={l} value={l}>{LANG_LABELS[l] ?? l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-status"><SelectValue placeholder="All sessions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sessions</SelectItem>
            <SelectItem value="highlighted">Highlighted</SelectItem>
            <SelectItem value="excluded">Excluded</SelectItem>
            <SelectItem value="unreviewed">Unreviewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
          Error loading conversations. Check console for details.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No conversations match this filter.</div>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => {
            const date = new Date(conv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return (
              <Card key={conv.id} data-testid={`card-conversation-${conv.id.slice(0, 8)}`} className={conv.davidVerdict === "EXCLUDE" ? "opacity-50" : ""}>
                <CardContent className="py-3 px-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{date}</span>
                        {conv.language && <Badge variant="outline" className="text-xs capitalize">{conv.language}</Badge>}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageSquare className="h-3 w-3" />{conv.messageCount} msgs</span>
                        {verdictBadge(conv.davidVerdict)}
                        {danielaBadge(conv.danielaVerdict)}
                      </div>
                      {conv.firstMessage && <p className="text-sm text-muted-foreground truncate max-w-xl">{conv.firstMessage}</p>}
                      {conv.danielaReason && <p className="text-xs text-muted-foreground italic">Daniela: "{conv.danielaReason.slice(0, 120)}{conv.danielaReason.length > 120 ? "…" : ""}"</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {conv.davidVerdict !== null && (
                        <Button size="icon" variant="ghost" data-testid={`button-reset-${conv.id.slice(0, 8)}`} onClick={() => flag(conv.id, null)} disabled={flagMutation.isPending} title="Reset to default">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant={conv.davidVerdict === "HIGHLIGHT" ? "default" : "outline"} data-testid={`button-highlight-${conv.id.slice(0, 8)}`} onClick={() => flag(conv.id, conv.davidVerdict === "HIGHLIGHT" ? null : "HIGHLIGHT")} disabled={flagMutation.isPending}>
                        <Star className="h-3.5 w-3.5 mr-1" />Highlight
                      </Button>
                      <Button size="sm" variant={conv.davidVerdict === "EXCLUDE" ? "destructive" : "outline"} data-testid={`button-exclude-${conv.id.slice(0, 8)}`} onClick={() => flag(conv.id, conv.davidVerdict === "EXCLUDE" ? null : "EXCLUDE")} disabled={flagMutation.isPending}>
                        <Ban className="h-3.5 w-3.5 mr-1" />Exclude
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

// ─── Principles tab ───────────────────────────────────────────────────────────

function PrinciplesTab() {
  const { data, isLoading } = useQuery<{ principles: Principle[]; notes: DanielaNote[] }>({
    queryKey: ["/api/fine-tuning/context"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/fine-tuning/context");
      return res.json();
    },
  });

  const principles = data?.principles ?? [];
  const byCategory: Record<string, Principle[]> = {};
  for (const p of principles) {
    const cat = p.category || "general";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Live Identity Principles</h2>
        <p className="text-sm text-muted-foreground">These are the principles currently in the database that get injected into the system instruction at export time.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />)}</div>
      ) : Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat} className="space-y-2">
          <div className="flex items-center gap-2">
            {categoryBadge(cat)}
            <span className="text-xs text-muted-foreground">{items.length} principles</span>
          </div>
          <div className="space-y-1.5 pl-2">
            {items.map((p, i) => (
              <div key={p.id} className="text-sm py-2 px-3 rounded-md bg-muted/50 leading-relaxed">
                {p.principle}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="border-t pt-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-base font-semibold">David's Original Compass</h2>
          <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30">Source document</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          The original principles you wrote and uploaded — the source material from which the current DB principles were derived. These 6 items are now also woven directly into the fine-tuning system instruction as David's framing.
        </p>
        <div className="space-y-3">
          {DAVIDS_COMPASS.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-3 pb-3 px-4">
                <div className="flex items-start gap-3">
                  <Badge className={`text-xs shrink-0 mt-0.5 ${CATEGORY_COLORS["david_compass"]}`}>{item.theme}</Badge>
                  <p className="text-sm leading-relaxed">{item.principle}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Daniela Notes tab ────────────────────────────────────────────────────────

function NotesTab() {
  const { data, isLoading } = useQuery<{ principles: Principle[]; notes: DanielaNote[] }>({
    queryKey: ["/api/fine-tuning/context"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/fine-tuning/context");
      return res.json();
    },
  });

  const notes = data?.notes ?? [];
  const NOTE_TYPE_LABELS: Record<string, string> = {
    session_reflection: "Session reflection",
    teaching_rhythm: "Teaching rhythm",
    student_pattern: "Student pattern",
    language_insight: "Language insight",
    self_affirmation: "Self affirmation",
    tool_experiment: "Tool experiment",
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-1">Daniela's Self-Written Notes</h2>
        <p className="text-sm text-muted-foreground">
          Notes Daniela has written to herself — session reflections, teaching rhythms, student patterns. The most recent 10 get embedded in the system instruction, so the fine-tuned model learns from how she describes her own experience.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />)}</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No notes yet.</div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <Card key={note.id}>
              <CardContent className="pt-3 pb-3 px-4">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                    {NOTE_TYPE_LABELS[note.note_type] ?? note.note_type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{note.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Synthetic scenarios tab ──────────────────────────────────────────────────

function ScenariosTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-1">Synthetic Training Scenarios</h2>
        <p className="text-sm text-muted-foreground">
          When you run <code className="bg-muted px-1 rounded text-xs">--generate-synthetic</code>, these 15 scenarios are sent to Gemini to generate realistic multi-turn conversations. Each demonstrates something specific about Daniela's identity or pedagogy that may not come through in the raw historical data.
        </p>
      </div>

      <div className="space-y-3">
        {SYNTHETIC_SCENARIOS.map((group) => {
          const isOpen = expanded === group.label;
          return (
            <Card key={group.label}>
              <CardContent className="pt-0 pb-0">
                <button
                  className="w-full text-left py-3 px-4 flex items-center justify-between"
                  onClick={() => setExpanded(isOpen ? null : group.label)}
                  data-testid={`button-scenario-${group.label.slice(0, 20).replace(/\s/g, "-")}`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{group.language}</Badge>
                    <span className="text-sm font-medium">{group.label}</span>
                    <span className="text-xs text-muted-foreground">{group.scenarios.length} scenarios</span>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <div className="border-t px-4 pb-3 space-y-2 pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Source doc: <code className="bg-muted px-1 rounded">{group.docSource}</code></p>
                    {group.scenarios.map((s, i) => (
                      <div key={i} className="text-sm py-2 px-3 bg-muted/50 rounded-md leading-relaxed">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4 px-4">
          <p className="text-sm font-medium mb-1">Run the export</p>
          <p className="text-xs text-muted-foreground mb-2">When you're ready to generate the training file:</p>
          <code className="text-xs bg-muted px-3 py-2 rounded-md block">
            npx tsx server/scripts/export-fine-tuning-data.ts --generate-synthetic
          </code>
          <p className="text-xs text-muted-foreground mt-2">Add <code className="bg-muted px-1 rounded">--dry-run</code> to check counts without writing a file.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function FineTuningCurator() {
  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fine-Tuning Studio</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everything that goes into training Daniela's identity into Gemini weights. Review all categories in one place.
        </p>
      </div>

      <Tabs defaultValue="conversations">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="conversations" className="flex items-center gap-1.5" data-testid="tab-conversations">
            <MessageSquare className="h-3.5 w-3.5" />Conversations
          </TabsTrigger>
          <TabsTrigger value="principles" className="flex items-center gap-1.5" data-testid="tab-principles">
            <BookOpen className="h-3.5 w-3.5" />Identity Principles
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-1.5" data-testid="tab-notes">
            <FileText className="h-3.5 w-3.5" />Daniela's Notes
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="flex items-center gap-1.5" data-testid="tab-scenarios">
            <Wand2 className="h-3.5 w-3.5" />Synthetic Scenarios
          </TabsTrigger>
        </TabsList>

        <div className="mt-5">
          <TabsContent value="conversations"><ConversationsTab /></TabsContent>
          <TabsContent value="principles"><PrinciplesTab /></TabsContent>
          <TabsContent value="notes"><NotesTab /></TabsContent>
          <TabsContent value="scenarios"><ScenariosTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
