import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, ChevronRight, ChevronLeft, Loader2, CheckCircle2, Circle, Send, Sparkles, ImageIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudyUnit {
  id: string;
  name: string;
  description: string;
  actfl_level: string;
  cultural_theme: string;
  lesson_count: number;
}

interface UnitGroup {
  pathName: string;
  pathId: string;
  level: string;
  units: StudyUnit[];
}

interface StudyScenario {
  scenarioId: string;
  title: string;
  context: string;
  objectives: { targetSkill: string; description: string; successCriteria: string[] }[];
  scaffold: { level: string; hints: string[]; grammarNotes: string[]; fallbackPrompts: string[] };
  visualPrompt: string;
  dynamicContent: boolean;
  lessonId: string;
  lessonName: string;
  lessonType: string;
  visual?: { imageUrl: string; altText: string; semanticTags: string[] };
}

interface StudySession {
  unitId: string;
  unitName: string;
  unitLevel: string;
  culturalTheme: string;
  scenarios: StudyScenario[];
  generatedAt: string;
}

interface ChatMessage {
  role: "user" | "daniela";
  content: string;
}

// ── Skill badge color ─────────────────────────────────────────────────────────
const skillColor: Record<string, string> = {
  speaking: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  listening: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  vocabulary: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  grammar: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  culture: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function UnitSelector({ onSelect }: { onSelect: (unit: StudyUnit) => void }) {
  const { data: groups, isLoading } = useQuery<UnitGroup[]>({
    queryKey: ["/api/study-mode/units"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading Spanish curriculum…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-unit-selector-title">Choose a Spanish Unit</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Daniela will build an immersive practice session from the lessons in that unit.
        </p>
      </div>
      {(groups || []).map(group => (
        <div key={group.pathId}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {group.pathName}
          </p>
          <div className="grid gap-2">
            {group.units.map(unit => (
              <button
                key={unit.id}
                data-testid={`button-unit-${unit.id}`}
                onClick={() => onSelect(unit)}
                className="text-left w-full rounded-md border bg-card p-4 hover-elevate active-elevate-2 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-snug">{unit.name}</p>
                    {unit.cultural_theme && (
                      <p className="text-xs text-muted-foreground mt-0.5">{unit.cultural_theme}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {unit.lesson_count} {unit.lesson_count === 1 ? "lesson" : "lessons"}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaceholderBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs" data-testid="status-placeholder-mode">
      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
      <span>
        Scene visuals are using placeholder images. Add a <strong>USER_OPENAI_API_KEY</strong> secret to enable DALL-E generation.
      </span>
    </div>
  );
}

function SessionLoading({ unitName }: { unitName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <div className="relative">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1" />
      </div>
      <div>
        <p className="font-medium">Daniela is preparing your session</p>
        <p className="text-sm text-muted-foreground mt-1">
          Building immersion scenarios for <span className="font-medium">{unitName}</span>
          <br />and generating visuals for each lesson…
        </p>
      </div>
    </div>
  );
}

function ScenarioView({
  scenario,
  scenarioIndex,
  total,
  onNext,
  onBack,
}: {
  scenario: StudyScenario;
  scenarioIndex: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [completedObjectives, setCompletedObjectives] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/study-mode/chat", {
        scenario,
        history: messages,
        message,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "daniela", content: data.reply }]);
    },
  });

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;
    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    chatMutation.mutate(trimmed);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-start: Daniela opens the scenario
  useEffect(() => {
    if (messages.length === 0) {
      chatMutation.mutate("(session start — open the scenario in character, set the scene in 1-2 sentences, then invite me to begin)");
    }
  }, [scenario.scenarioId]);

  const toggleObjective = (i: number) => {
    setCompletedObjectives(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={onBack} data-testid="button-scenario-back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-xs text-muted-foreground">Lesson {scenarioIndex + 1} of {total}</p>
            <h3 className="font-semibold leading-tight" data-testid="text-scenario-title">{scenario.title}</h3>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onNext}
          data-testid="button-scenario-next"
        >
          {scenarioIndex + 1 < total ? "Next Lesson" : "Finish Unit"}
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left panel: visual + objectives */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          {/* Visual */}
          <div className="rounded-md border overflow-hidden w-full relative bg-muted" style={{height: '288px'}}>
            {scenario.visual?.imageUrl ? (
              <img
                src={scenario.visual.imageUrl}
                alt={scenario.visual.altText}
                className="absolute inset-0 w-full h-full object-cover"
                data-testid="img-scenario-visual"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground p-4 text-center">
                <ImageIcon className="w-6 h-6" />
                <p className="text-xs">{scenario.lessonName}</p>
              </div>
            )}
          </div>

          {/* Scenario context */}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-scenario-context">
                {scenario.context}
              </p>
            </CardContent>
          </Card>

          {/* Objectives */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Objectives</p>
            <div className="space-y-1.5">
              {scenario.objectives.map((obj, i) => (
                <button
                  key={i}
                  onClick={() => toggleObjective(i)}
                  data-testid={`button-objective-${i}`}
                  className="flex items-start gap-2 w-full text-left group"
                >
                  {completedObjectives.has(i) ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">{obj.description}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${skillColor[obj.targetSkill] || "bg-muted text-muted-foreground"}`}>
                      {obj.targetSkill}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Hints */}
          {scenario.scaffold.hints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Hints</p>
              <div className="space-y-1">
                {scenario.scaffold.hints.slice(0, 3).map((hint, i) => (
                  <p key={i} className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{hint}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: chat */}
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          <ScrollArea className="flex-1" ref={scrollRef as any}>
            <div className="space-y-3 pr-2">
              {messages.filter(m => !m.content.startsWith("(session start")).map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`msg-${msg.role}-${i}`}
                >
                  <div
                    className={`max-w-[80%] rounded-md px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.role === "daniela" && (
                      <p className="text-[10px] font-medium opacity-60 mb-0.5">Daniela</p>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-md px-3 py-2">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 items-end shrink-0">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Respond in Spanish (or English if you're stuck)…"
              className="resize-none text-sm min-h-[40px] max-h-32"
              rows={1}
              data-testid="input-study-message"
            />
            <Button
              size="icon"
              onClick={send}
              disabled={chatMutation.isPending || !input.trim()}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitComplete({ unitName, onRestart }: { unitName: string; onRestart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <CheckCircle2 className="w-12 h-12 text-green-500" />
      <div>
        <h3 className="text-lg font-semibold">Unit Complete!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          You've worked through all the lessons in<br />
          <span className="font-medium">{unitName}</span>
        </p>
      </div>
      <Button onClick={onRestart} data-testid="button-restart-study">
        Choose Another Unit
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudyMode() {
  const [selectedUnit, setSelectedUnit] = useState<StudyUnit | null>(null);
  const [session, setSession] = useState<StudySession | null>(null);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [done, setDone] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async (unit: StudyUnit) => {
      const res = await apiRequest("POST", "/api/study-mode/generate", { unitId: unit.id });
      return res.json() as Promise<StudySession>;
    },
    onSuccess: (data) => {
      setSession(data);
      setScenarioIndex(0);
      setDone(false);
    },
  });

  const handleSelectUnit = (unit: StudyUnit) => {
    setSelectedUnit(unit);
    setSession(null);
    setDone(false);
    generateMutation.mutate(unit);
  };

  const handleNext = () => {
    if (!session) return;
    if (scenarioIndex + 1 >= session.scenarios.length) {
      setDone(true);
    } else {
      setScenarioIndex(i => i + 1);
    }
  };

  const handleBack = () => {
    if (scenarioIndex > 0) {
      setScenarioIndex(i => i - 1);
    } else {
      setSelectedUnit(null);
      setSession(null);
    }
  };

  const handleRestart = () => {
    setSelectedUnit(null);
    setSession(null);
    setDone(false);
    setScenarioIndex(0);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
        <BookOpen className="w-5 h-5 text-muted-foreground" />
        <div>
          <h1 className="font-semibold text-base" data-testid="text-study-mode-title">Study Mode</h1>
          <p className="text-xs text-muted-foreground">Immersive practice with Daniela</p>
        </div>
        {session && !done && (
          <Badge variant="secondary" className="ml-auto">
            {session.unitName}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedUnit && (
          <UnitSelector onSelect={handleSelectUnit} />
        )}
        {selectedUnit && generateMutation.isPending && (
          <SessionLoading unitName={selectedUnit.name} />
        )}
        {generateMutation.isError && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">Something went wrong generating the session.</p>
            <Button variant="outline" className="mt-4" onClick={() => selectedUnit && handleSelectUnit(selectedUnit)}>
              Try Again
            </Button>
          </div>
        )}
        {session && !done && session.scenarios[scenarioIndex] && (
          <div className="flex flex-col gap-3 h-full">
            {session.scenarios.some(s => s.visual?.imageUrl?.includes('picsum')) && (
              <PlaceholderBanner />
            )}
            <div className="flex-1 min-h-0">
              <ScenarioView
                scenario={session.scenarios[scenarioIndex]}
                scenarioIndex={scenarioIndex}
                total={session.scenarios.length}
                onNext={handleNext}
                onBack={handleBack}
              />
            </div>
          </div>
        )}
        {done && session && (
          <UnitComplete unitName={session.unitName} onRestart={handleRestart} />
        )}
      </div>
    </div>
  );
}
