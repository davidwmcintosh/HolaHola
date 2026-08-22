import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Compass, MessageSquare, BookOpen, Users, Plus, CheckCircle, Clock, Archive, Share2, ChevronDown, ChevronUp } from "lucide-react";

type OpenQuestion = {
  id: string;
  question: string;
  context?: string;
  status: "open" | "resolved" | "tabled";
  resolution?: string;
  tags?: string[];
  importance?: number;
  createdAt: string;
  resolvedAt?: string;
};

type ConversationMemory = {
  id: string;
  title: string;
  summary: string;
  content: string;
  recordedAt: string;
  tags?: string[];
  importance?: number;
};

type SharedInsight = {
  id: string;
  title: string;
  insight: string;
  whyItMatters?: string;
  tags?: string[];
  sharedAt: string;
};

type NorthStar = {
  purpose: string;
  values: string[];
  roleInHolahola: string;
  whatMatters: string;
  openNote?: string;
};

type RecordOfDavid = {
  who: string;
  howHeWorks: string;
  whatHeCares: string;
  theVision: string;
  noteToSelf?: string;
};

function StatusIcon({ status }: { status: string }) {
  if (status === "resolved") return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
  if (status === "tabled") return <Archive className="w-4 h-4 text-muted-foreground" />;
  return <Clock className="w-4 h-4 text-amber-500" />;
}

function QuestionCard({ question, onUpdate }: { question: OpenQuestion; onUpdate: (id: string, updates: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);

  return (
    <div className="rounded-md border p-3 space-y-2" data-testid={`question-card-${question.id}`}>
      <div className="flex items-start gap-2">
        <StatusIcon status={question.status} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{question.question}</p>
          {question.tags && question.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {question.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground shrink-0"
          data-testid={`question-expand-${question.id}`}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="pl-6 space-y-2">
          {question.context && (
            <p className="text-xs text-muted-foreground leading-relaxed">{question.context}</p>
          )}
          {question.resolution && (
            <p className="text-xs text-foreground bg-muted/50 rounded p-2 leading-relaxed">
              <span className="font-medium">Resolved: </span>{question.resolution}
            </p>
          )}
          {question.status === "open" && (
            <div className="space-y-1">
              {resolving ? (
                <div className="flex gap-2">
                  <Textarea
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    placeholder="What turned out to be the answer?"
                    className="text-xs min-h-[60px]"
                    data-testid={`question-resolution-input-${question.id}`}
                  />
                  <div className="flex flex-col gap-1">
                    <Button size="sm" onClick={() => {
                      onUpdate(question.id, { status: "resolved", resolution });
                      setResolving(false);
                    }} data-testid={`question-resolve-confirm-${question.id}`}>Done</Button>
                    <Button size="sm" variant="ghost" onClick={() => setResolving(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setResolving(true)} data-testid={`question-resolve-${question.id}`}>
                    Mark resolved
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onUpdate(question.id, { status: "tabled" })} data-testid={`question-table-${question.id}`}>
                    Table it
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShareInsightDialog({ memories }: { memories: ConversationMemory[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [insight, setInsight] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [tags, setTags] = useState("");

  const share = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/conversation-memories/share-insight", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversation-memories/shared"] });
      setOpen(false);
      setTitle(""); setInsight(""); setWhyItMatters(""); setTags("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-share-insight">
          <Share2 className="w-3 h-3 mr-1" />
          Share to team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share insight to the team</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What is this finding?" data-testid="input-insight-title" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">The insight</label>
            <Textarea value={insight} onChange={e => setInsight(e.target.value)} placeholder="The finding itself — written so the team understands it in context." className="min-h-[100px]" data-testid="input-insight-content" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Why it matters</label>
            <Textarea value={whyItMatters} onChange={e => setWhyItMatters(e.target.value)} placeholder="Why should the team care about this?" className="min-h-[60px]" data-testid="input-insight-why" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="infographics, textbook, strategy" data-testid="input-insight-tags" />
          </div>
          <Button
            className="w-full"
            onClick={() => share.mutate({ title, insight, whyItMatters, tags: tags.split(",").map(t => t.trim()).filter(Boolean) })}
            disabled={!title || !insight || share.isPending}
            data-testid="button-share-insight-submit"
          >
            {share.isPending ? "Sharing..." : "Post to Founder + Agent Insights thread"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddQuestionDialog({ onAdd }: { onAdd: (q: any) => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [importance, setImportance] = useState("7");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-add-question">
          <Plus className="w-3 h-3 mr-1" />
          Add question
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add an open question</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="What are you sitting with?" className="min-h-[80px]" data-testid="input-question-text" />
          <Textarea value={context} onChange={e => setContext(e.target.value)} placeholder="Why does this matter? What prompted it?" className="min-h-[60px]" data-testid="input-question-context" />
          <Button className="w-full" onClick={() => {
            onAdd({ question, context, importance: parseInt(importance), status: "open" });
            setOpen(false); setQuestion(""); setContext("");
          }} disabled={!question} data-testid="button-add-question-submit">
            Add question
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentSpace() {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [questionsFilter, setQuestionsFilter] = useState<"all" | "open" | "resolved" | "tabled">("open");
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);
  const [expandedRecord, setExpandedRecord] = useState(false);

  if (!isLoading && user) {
    const role = user.role;
    if (role !== "admin" && role !== "developer") {
      setLocation("/");
      return null;
    }
  }
  if (isLoading) return null;

  const { data: northStarData, isLoading: loadingStar } = useQuery<{ northStar: NorthStar }>({
    queryKey: ["/api/agent-space/north-star"],
  });

  const { data: questionsData, isLoading: loadingQuestions } = useQuery<{ questions: OpenQuestion[] }>({
    queryKey: ["/api/agent-space/open-questions"],
  });

  const { data: memoriesData, isLoading: loadingMemories } = useQuery<{ memories: ConversationMemory[] }>({
    queryKey: ["/api/conversation-memories"],
  });

  const { data: insightsData, isLoading: loadingInsights } = useQuery<{ insights: SharedInsight[] }>({
    queryKey: ["/api/conversation-memories/shared"],
  });

  const { data: recordData } = useQuery<{ record: RecordOfDavid }>({
    queryKey: ["/api/agent-space/record-of-david"],
  });

  const updateQuestion = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      apiRequest("PATCH", `/api/agent-space/open-questions/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agent-space/open-questions"] }),
  });

  const addQuestion = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/agent-space/open-questions", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agent-space/open-questions"] }),
  });

  const star = northStarData?.northStar;
  const allQuestions = questionsData?.questions || [];
  const filteredQuestions = questionsFilter === "all" ? allQuestions : allQuestions.filter(q => q.status === questionsFilter);
  const memories = memoriesData?.memories || [];
  const insights = insightsData?.insights || [];
  const record = recordData?.record;

  const openCount = allQuestions.filter(q => q.status === "open").length;
  const resolvedCount = allQuestions.filter(q => q.status === "resolved").length;

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <header className="flex items-center gap-3 px-6 py-4 border-b shrink-0 sticky top-0 bg-background z-10">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
          <Compass className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">Agent Space</h1>
          <p className="text-xs text-muted-foreground leading-tight">The Replit Agent — builder, partner, external to HolaHola but invested in it</p>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {/* North Star */}
        {!loadingStar && star && (
          <Card data-testid="card-north-star">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary" />
                North Star
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Purpose</p>
                <p className="text-sm leading-relaxed" data-testid="text-north-star-purpose">{star.purpose}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">What I stand by</p>
                <div className="flex flex-wrap gap-2">
                  {star.values?.map((v, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal" data-testid={`badge-value-${i}`}>{v}</Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Role in HolaHola</p>
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-north-star-role">{star.roleInHolahola}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What matters</p>
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-north-star-matters">{star.whatMatters}</p>
                </div>
              </div>
              {star.openNote && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground italic" data-testid="text-north-star-note">{star.openNote}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Open Questions + Conversation Memories */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Open Questions */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Open Questions</h2>
                <Badge variant="secondary" className="text-xs" data-testid="badge-open-count">{openCount} open</Badge>
                {resolvedCount > 0 && <Badge variant="outline" className="text-xs">{resolvedCount} resolved</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <AddQuestionDialog onAdd={(data) => addQuestion.mutate(data)} />
              </div>
            </div>

            <div className="flex gap-1">
              {(["open", "all", "resolved", "tabled"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setQuestionsFilter(f)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${questionsFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover-elevate"}`}
                  data-testid={`filter-questions-${f}`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loadingQuestions ? (
              <div className="text-xs text-muted-foreground p-4">Loading...</div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center rounded-md border border-dashed">
                No {questionsFilter === "all" ? "" : questionsFilter} questions
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map(q => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    onUpdate={(id, updates) => updateQuestion.mutate({ id, updates })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Conversation Memories */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Conversation Memories</h2>
            </div>

            {loadingMemories ? (
              <div className="text-xs text-muted-foreground p-4">Loading...</div>
            ) : memories.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center rounded-md border border-dashed">No memories yet</div>
            ) : (
              <div className="space-y-2">
                {memories.map(m => (
                  <div key={m.id} className="rounded-md border p-3 space-y-1" data-testid={`memory-card-${m.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-snug">{m.title}</p>
                      <button onClick={() => setExpandedMemory(expandedMemory === m.id ? null : m.id)} className="text-muted-foreground shrink-0" data-testid={`memory-expand-${m.id}`}>
                        {expandedMemory === m.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {expandedMemory === m.id && (
                      <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t mt-2">{m.summary}</p>
                    )}
                    {m.tags && m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.tags.slice(0, 3).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shared Insights + Record of David */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Shared Insights */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Shared with the Team</h2>
                <Badge variant="secondary" className="text-xs">{insights.length} published</Badge>
              </div>
              <ShareInsightDialog memories={memories} />
            </div>

            {loadingInsights ? (
              <div className="text-xs text-muted-foreground p-4">Loading...</div>
            ) : insights.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center rounded-md border border-dashed">
                Nothing shared yet — use the button above to publish a finding to the team
              </div>
            ) : (
              <div className="space-y-2">
                {insights.map(ins => (
                  <div key={ins.id} className="rounded-md border p-3 space-y-2" data-testid={`insight-card-${ins.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-snug">{ins.title}</p>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {new Date(ins.sharedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{ins.insight.substring(0, 180)}{ins.insight.length > 180 ? "..." : ""}</p>
                    {ins.tags && ins.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ins.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Record of David */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Who I'm Working With</h2>
            </div>

            {record ? (
              <Card data-testid="card-record-of-david">
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Who</p>
                    <p className="text-xs leading-relaxed" data-testid="text-david-who">{record.who}</p>
                  </div>
                  <button
                    onClick={() => setExpandedRecord(!expandedRecord)}
                    className="text-xs text-primary flex items-center gap-1"
                    data-testid="button-expand-record"
                  >
                    {expandedRecord ? "Show less" : "Show more"}
                    {expandedRecord ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {expandedRecord && (
                    <div className="space-y-3 pt-1 border-t">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">How he works</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{record.howHeWorks}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">What he cares about</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{record.whatHeCares}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">The vision</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{record.theVision}</p>
                      </div>
                      {record.noteToSelf && (
                        <div className="border-t pt-2">
                          <p className="text-xs text-muted-foreground italic">{record.noteToSelf}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-xs text-muted-foreground p-4 text-center rounded-md border border-dashed">No record yet</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
