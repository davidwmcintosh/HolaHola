import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Play,
  Undo2,
  CheckCircle2,
  AlertTriangle,
  User,
  Globe,
  MessageSquare,
  Target,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const SNAPSHOT_KEY = "onboarding_tester_snapshot";

interface Snapshot {
  firstName: string;
  targetLanguage: string;
  nativeLanguage: string;
  difficultyLevel: string;
  onboardingCompleted: boolean;
}

const ONBOARDING_STEPS = [
  {
    step: 1,
    icon: User,
    label: "Name Collection",
    trigger: "First message in new session (no prior name)",
    danielaSays: "I focus on teaching practical, everyday language. Let's get started with your language learning! May I ask your name please?",
    saves: "firstName → user_preferences",
    advance: "Moves to step 2 once a name is confidently extracted",
  },
  {
    step: 2,
    icon: Globe,
    label: "Target Language",
    trigger: "After name is captured",
    danielaSays: "Nice to meet you, {name}! Which language would you like to study?",
    saves: "targetLanguage → user_preferences + conversation.language",
    advance: "Moves to step 3 once a supported language is identified",
  },
  {
    step: 3,
    icon: MessageSquare,
    label: "Native Language",
    trigger: "After target language is captured",
    danielaSays: "Great! And what is your native language, {name}? (The language you already speak)",
    saves: "nativeLanguage → user_preferences",
    advance: "Moves to step 4 once native language is extracted",
  },
  {
    step: 4,
    icon: Target,
    label: "Learning Goal",
    trigger: "After native language is captured",
    danielaSays: "(Asks student what motivates them to learn this language)",
    saves: "learner_personal_fact (factType='goal')",
    advance: "Generates a warm closing via Gemini, then marks onboardingCompleted=true",
  },
];

export function OnboardingTesterContent() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [testActive, setTestActive] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SNAPSHOT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSnapshot(parsed);
        setTestActive(true);
      } catch {
        localStorage.removeItem(SNAPSHOT_KEY);
      }
    }
  }, []);

  const { data: currentStatus, refetch: refetchStatus } = useQuery<Snapshot>({
    queryKey: ["/api/admin/onboarding/snapshot"],
    refetchOnWindowFocus: true,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/onboarding/start-test", {});
      return res.json();
    },
    onSuccess: (data) => {
      const snap: Snapshot = data.snapshot;
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
      localStorage.setItem("userName", "");
      setSnapshot(snap);
      setTestActive(true);
      refetchStatus();
      toast({ title: "Onboarding reset", description: "Navigating to chat — go through the full flow, then come back here to restore." });
      setTimeout(() => navigate("/chat"), 600);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Reset failed", description: "Could not reset onboarding state." });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (snap: Snapshot) => {
      const res = await apiRequest("POST", "/api/admin/onboarding/restore-test", snap);
      return res.json();
    },
    onSuccess: (_, snap) => {
      localStorage.removeItem(SNAPSHOT_KEY);
      localStorage.setItem("userName", snap.firstName);
      setSnapshot(null);
      setTestActive(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding/snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      refetchStatus();
      toast({ title: "Preferences restored", description: `Welcome back, ${snap.firstName}.` });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Restore failed", description: "Could not restore preferences." });
    },
  });

  const isOnboardingCompleted = currentStatus?.onboardingCompleted !== false;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Onboarding Tester</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Preview and test-drive the new student onboarding flow without losing your account preferences. Your settings are fully restored after the test.
        </p>
      </div>

      {testActive && snapshot && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-amber-900 dark:text-amber-200">Test in progress</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  Your real preferences are saved. Complete onboarding in the chat, then click Restore below.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/chat")}
                    data-testid="button-go-to-chat"
                  >
                    <Play className="w-3 h-3 mr-1.5" />
                    Go to Chat
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        data-testid="button-restore-preferences"
                        disabled={restoreMutation.isPending}
                      >
                        <Undo2 className="w-3 h-3 mr-1.5" />
                        {restoreMutation.isPending ? "Restoring…" : "Restore My Preferences"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore your account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will restore your original preferences:{" "}
                          <strong>{snapshot.firstName}</strong>,{" "}
                          <strong>{snapshot.targetLanguage || "no language set"}</strong>,{" "}
                          <strong>{snapshot.nativeLanguage || "no native language"}</strong>.
                          Any changes from the test run will be overwritten.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => restoreMutation.mutate(snapshot)}>
                          Restore
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base">Current Status</CardTitle>
              <CardDescription className="mt-0.5">Your account's onboarding state right now</CardDescription>
            </div>
            {currentStatus ? (
              isOnboardingCompleted ? (
                <Badge variant="secondary" className="gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Onboarding complete
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 text-amber-700 border-amber-300">
                  <AlertTriangle className="w-3 h-3" />
                  Onboarding pending
                </Badge>
              )
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {currentStatus ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{currentStatus.firstName || <span className="text-muted-foreground italic">not set</span>}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Target language</dt>
                <dd className="font-medium capitalize">{currentStatus.targetLanguage || <span className="text-muted-foreground italic">not set</span>}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Native language</dt>
                <dd className="font-medium capitalize">{currentStatus.nativeLanguage || <span className="text-muted-foreground italic">not set</span>}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Difficulty</dt>
                <dd className="font-medium capitalize">{currentStatus.difficultyLevel || <span className="text-muted-foreground italic">not set</span>}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}

          {!testActive && (
            <div className="mt-5 pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button data-testid="button-launch-onboarding-test" disabled={startMutation.isPending}>
                    <Play className="w-4 h-4 mr-2" />
                    {startMutation.isPending ? "Preparing test…" : "Launch Onboarding Test"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Launch onboarding test?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <span className="block">
                        This will temporarily clear your name and language preferences so the full onboarding flow fires when you open the chat.
                      </span>
                      <span className="block">
                        Your real preferences are snapshotted and can be fully restored afterward with the <strong>Restore</strong> button.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => startMutation.mutate()}>
                      Start test
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-muted-foreground mt-2">
                After clicking, you'll be taken to /chat. Go through all 4 onboarding steps, then return here to restore your real preferences.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Onboarding Script</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          These are the exact messages Daniela uses today. The server handlers live in{" "}
          <code className="bg-muted px-1 rounded text-xs">server/routes.ts</code> (search <code className="bg-muted px-1 rounded text-xs">/api/conversations/:id/onboarding</code>).
        </p>
        <div className="space-y-3">
          {ONBOARDING_STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <Card key={s.step}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">Step {s.step} — {s.label}</span>
                        <Badge variant="outline" className="text-xs">
                          onboardingStep: "{s.step === 1 ? "name" : s.step === 2 ? "targetLanguage" : s.step === 3 ? "nativeLanguage" : "goals"}"
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.trigger}</p>
                      <blockquote className="border-l-2 border-muted pl-3 text-sm italic text-foreground/80">
                        "{s.danielaSays}"
                      </blockquote>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium">Saves:</span>
                        <code className="bg-muted px-1 rounded">{s.saves}</code>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{s.advance}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
