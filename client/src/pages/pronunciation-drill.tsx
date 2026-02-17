import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Loader2,
  Trophy,
  Target,
  Sparkles,
  RefreshCw,
  Mic,
  Play,
  RotateCcw,
  Lightbulb,
  ChevronLeft
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";

interface PhonemeChallenge {
  phoneme: string;
  description: string;
  examples: string[];
  difficultyScore: number;
  occurrenceCount: number;
}

interface DrillItem {
  id: string;
  phrase: string;
  targetPhoneme: string;
  phoneticGuide: string;
  slowSpeed: string;
  normalSpeed: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tips: string[];
}

interface DrillSession {
  sessionId: string;
  language: string;
  targetPhonemes: string[];
  drillItems: DrillItem[];
  totalItems: number;
  currentIndex: number;
  correctCount: number;
  incorrectCount: number;
  focusAreas: PhonemeChallenge[];
}

interface SessionSummary {
  sessionId: string;
  totalItems: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  durationSeconds: number;
  targetPhonemes: string[];
  recommendation: string;
}

interface SubmitResult {
  isCorrect: boolean;
  score: number;
  feedback: string;
  issues: string[];
  strengths: string[];
  nextItem: DrillItem | null;
  sessionComplete: boolean;
  sessionSummary?: SessionSummary;
}

interface DrillProgressEntry {
  phoneme: string;
  status: 'mastered' | 'in_progress' | 'not_started';
  date: string;
  daysToMastery?: number;
  daysInProgress?: number;
  occurrenceCount: number;
  milestone?: string;
  progressEstimate?: number;
}

const LANGUAGE_OPTIONS = [
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'mandarin', label: 'Mandarin Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'italian', label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'english', label: 'English' },
  { value: 'hebrew', label: 'Hebrew' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function PronunciationDrill() {
  const { language: contextLanguage, difficulty: contextDifficulty } = useLanguage();
  const { toast } = useToast();
  
  const [selectedLanguage, setSelectedLanguage] = useState(contextLanguage || 'spanish');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>(
    (contextDifficulty as 'beginner' | 'intermediate' | 'advanced') || 'intermediate'
  );
  const [session, setSession] = useState<DrillSession | null>(null);
  const [currentItem, setCurrentItem] = useState<DrillItem | null>(null);
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [simulatedScore, setSimulatedScore] = useState(75);

  const { data: phonemes, isLoading: loadingPhonemes } = useQuery<{ language: string; phonemes: PhonemeChallenge[] }>({
    queryKey: ['/api/pronunciation-drills/phonemes', selectedLanguage],
    queryFn: () => fetch(`/api/pronunciation-drills/phonemes/${selectedLanguage}`).then(r => r.json()),
    enabled: !!selectedLanguage,
  });

  const { data: struggles } = useQuery<{ struggles: PhonemeChallenge[] }>({
    queryKey: ['/api/pronunciation-drills/struggles', selectedLanguage],
    queryFn: () => fetch(`/api/pronunciation-drills/struggles?language=${selectedLanguage}`).then(r => r.json()),
    enabled: !!selectedLanguage,
  });

  // Query for pronunciation progress timeline
  const { data: progressTimeline } = useQuery<DrillProgressEntry[]>({
    queryKey: ['/api/pronunciation-drills/progress-timeline', selectedLanguage],
    queryFn: () => fetch(`/api/pronunciation-drills/progress-timeline?language=${selectedLanguage}`).then(r => r.json()),
    enabled: !!selectedLanguage,
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pronunciation-drills/start", {
        language: selectedLanguage,
        difficulty: selectedDifficulty,
      });
      return res as unknown as DrillSession;
    },
    onSuccess: (data) => {
      setSession(data);
      setCurrentItem(data.drillItems[0] || null);
      setLastResult(null);
      setShowResult(false);
      setSessionSummary(null);
      toast({
        title: "Session Started",
        description: `Practicing ${data.targetPhonemes.join(', ')} sounds`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start session",
        variant: "destructive",
      });
    },
  });

  const submitResponseMutation = useMutation({
    mutationFn: async (score: number) => {
      if (!session) throw new Error("No active session");
      const res = await apiRequest("POST", `/api/pronunciation-drills/session/${session.sessionId}/submit`, {
        transcribedSpeech: currentItem?.phrase || '',
        pronunciationScore: score,
      });
      return res as unknown as SubmitResult;
    },
    onSuccess: (data) => {
      setLastResult(data);
      setShowResult(true);
      
      if (data.sessionComplete && data.sessionSummary) {
        setSessionSummary(data.sessionSummary);
        setSession(null);
        setCurrentItem(null);
      } else if (data.nextItem) {
        setCurrentItem(data.nextItem);
        if (session) {
          setSession({
            ...session,
            currentIndex: session.currentIndex + 1,
            correctCount: data.isCorrect ? session.correctCount + 1 : session.correctCount,
            incorrectCount: data.isCorrect ? session.incorrectCount : session.incorrectCount + 1,
          });
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit response",
        variant: "destructive",
      });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("No active session");
      const res = await apiRequest("POST", `/api/pronunciation-drills/session/${session.sessionId}/end`);
      return res as unknown as { summary: SessionSummary };
    },
    onSuccess: (data) => {
      setSessionSummary(data.summary);
      setSession(null);
      setCurrentItem(null);
      setShowResult(false);
    },
  });

  const handleSubmit = useCallback((score: number) => {
    submitResponseMutation.mutate(score);
  }, [submitResponseMutation]);

  const handleNextItem = useCallback(() => {
    setShowResult(false);
    setLastResult(null);
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-700 dark:text-green-300';
      case 'medium': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300';
      case 'hard': return 'bg-red-500/20 text-red-700 dark:text-red-300';
      default: return '';
    }
  };

  if (sessionSummary) {
    return (
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Card className="p-8">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="h-10 w-10 text-primary" />
              </div>
            </div>
            
            <CardTitle className="text-2xl mb-2">Session Complete!</CardTitle>
            <CardDescription className="mb-6">
              Great work practicing {sessionSummary.targetPhonemes.join(', ')}
            </CardDescription>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold text-green-600" data-testid="text-correct-count">
                  {sessionSummary.correctCount}
                </div>
                <div className="text-sm text-muted-foreground">Correct</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold text-primary" data-testid="text-accuracy">
                  {sessionSummary.accuracy}%
                </div>
                <div className="text-sm text-muted-foreground">Accuracy</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold" data-testid="text-duration">
                  {Math.floor(sessionSummary.durationSeconds / 60)}:{(sessionSummary.durationSeconds % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-sm text-muted-foreground">Duration</div>
              </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-lg mb-6 text-left">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Recommendation</div>
                  <div className="text-sm text-muted-foreground">{sessionSummary.recommendation}</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={() => setSessionSummary(null)}
                data-testid="button-back-to-setup"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button 
                onClick={() => {
                  setSessionSummary(null);
                  startSessionMutation.mutate();
                }}
                data-testid="button-practice-again"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Practice Again
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (session && currentItem) {
    const progress = ((session.currentIndex) / session.totalItems) * 100;
    
    return (
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => endSessionMutation.mutate()}
            data-testid="button-end-session"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            End Session
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{session.currentIndex + 1} / {session.totalItems}</Badge>
            <Badge className={getDifficultyColor(currentItem.difficulty)}>
              {currentItem.difficulty}
            </Badge>
          </div>
        </div>

        <Progress value={progress} className="h-2" />

        <div className="flex justify-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {session.correctCount} correct
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <XCircle className="h-4 w-4" />
            {session.incorrectCount} incorrect
          </span>
        </div>

        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="drill-item"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="p-6">
                <div className="text-center space-y-6">
                  <Badge variant="secondary" className="text-sm">
                    Target: {currentItem.targetPhoneme}
                  </Badge>
                  
                  <div className="text-3xl font-bold" data-testid="text-drill-phrase">
                    {currentItem.phrase}
                  </div>
                  
                  <div className="text-lg text-muted-foreground">
                    {currentItem.phoneticGuide}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Slow:</div>
                    <div className="text-xl">{currentItem.slowSpeed}</div>
                  </div>

                  {currentItem.tips.length > 0 && (
                    <div className="p-3 bg-primary/5 rounded-lg text-left">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Tips
                      </div>
                      <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                        {currentItem.tips.map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-4 space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Simulate your pronunciation score:
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={simulatedScore}
                        onChange={(e) => setSimulatedScore(parseInt(e.target.value))}
                        className="w-48"
                        data-testid="input-score-slider"
                      />
                      <span className="w-12 text-center font-bold">{simulatedScore}%</span>
                    </div>
                    
                    <Button 
                      size="lg"
                      onClick={() => handleSubmit(simulatedScore)}
                      disabled={submitResponseMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-pronunciation"
                    >
                      {submitResponseMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Mic className="h-5 w-5 mr-2" />
                      )}
                      Submit Pronunciation
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : lastResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className={`p-6 ${lastResult.isCorrect ? 'border-green-500' : 'border-orange-500'}`}>
                <div className="text-center space-y-4">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                    lastResult.isCorrect ? 'bg-green-500/20' : 'bg-orange-500/20'
                  }`}>
                    {lastResult.isCorrect ? (
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    ) : (
                      <Target className="h-8 w-8 text-orange-600" />
                    )}
                  </div>
                  
                  <div>
                    <div className="text-2xl font-bold mb-1" data-testid="text-result-score">
                      {lastResult.score}%
                    </div>
                    <div className="text-muted-foreground">{lastResult.feedback}</div>
                  </div>

                  {lastResult.strengths.length > 0 && (
                    <div className="text-left p-3 bg-green-500/10 rounded-lg">
                      <div className="text-sm font-medium text-green-700 dark:text-green-300">Strengths</div>
                      <ul className="mt-1 text-sm text-muted-foreground">
                        {lastResult.strengths.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {lastResult.issues.length > 0 && (
                    <div className="text-left p-3 bg-orange-500/10 rounded-lg">
                      <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Areas to Improve</div>
                      <ul className="mt-1 text-sm text-muted-foreground">
                        {lastResult.issues.map((issue, i) => (
                          <li key={i}>• {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button 
                    onClick={handleNextItem}
                    className="w-full"
                    data-testid="button-next-item"
                  >
                    {lastResult.sessionComplete ? 'View Results' : 'Next Phrase'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Pronunciation Drill</h1>
        <p className="text-muted-foreground">
          Practice challenging sounds with focused repetition
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session Settings</CardTitle>
          <CardDescription>
            Choose your language and difficulty level
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty</label>
              <Select value={selectedDifficulty} onValueChange={(v) => setSelectedDifficulty(v as any)}>
                <SelectTrigger data-testid="select-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={() => startSessionMutation.mutate()}
            disabled={startSessionMutation.isPending}
            data-testid="button-start-session"
          >
            {startSessionMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Play className="h-5 w-5 mr-2" />
            )}
            Start Practice Session
          </Button>
        </CardContent>
      </Card>

      {loadingPhonemes ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : phonemes?.phonemes && phonemes.phonemes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              {LANGUAGE_OPTIONS.find(l => l.value === selectedLanguage)?.label} Phoneme Challenges
            </CardTitle>
            <CardDescription>
              Common sounds that learners find challenging
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {phonemes.phonemes.slice(0, 6).map((phoneme, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-lg">
                      {phoneme.phoneme}
                    </Badge>
                    <div>
                      <div className="font-medium">{phoneme.description}</div>
                      <div className="text-sm text-muted-foreground">
                        Examples: {phoneme.examples.slice(0, 3).join(', ')}
                      </div>
                    </div>
                  </div>
                  <Badge className={phoneme.difficultyScore > 7 ? 'bg-red-500/20 text-red-700' : phoneme.difficultyScore > 4 ? 'bg-yellow-500/20 text-yellow-700' : 'bg-green-500/20 text-green-700'}>
                    {phoneme.difficultyScore}/10
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {struggles?.struggles && struggles.struggles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Your Focus Areas
            </CardTitle>
            <CardDescription>
              Sounds you've struggled with in past sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {struggles.struggles.map((struggle, i) => (
                <Badge key={i} variant="secondary" className="py-1.5 px-3">
                  {struggle.phoneme}
                  {struggle.occurrenceCount > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({struggle.occurrenceCount}x)
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pronunciation Progress Timeline */}
      {progressTimeline && progressTimeline.length > 0 && (
        <Card data-testid="section-progress-timeline">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Your Progress Journey
            </CardTitle>
            <CardDescription>
              Track your pronunciation improvement over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
              
              <div className="space-y-4">
                {progressTimeline.map((entry, index) => (
                  <div 
                    key={`${entry.phoneme}-${index}`} 
                    className="relative flex items-start gap-4 pl-10"
                    data-testid={`timeline-entry-${entry.phoneme}`}
                  >
                    {/* Timeline dot */}
                    <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                      entry.status === 'mastered' 
                        ? 'bg-green-500 border-green-600' 
                        : entry.status === 'in_progress'
                          ? 'bg-amber-500 border-amber-600'
                          : 'bg-muted border-muted-foreground'
                    }`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono">
                          {entry.phoneme}
                        </Badge>
                        <Badge className={
                          entry.status === 'mastered' 
                            ? 'bg-green-500/20 text-green-700 dark:text-green-300' 
                            : entry.status === 'in_progress'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-muted text-muted-foreground'
                        }>
                          {entry.status === 'mastered' ? 'Mastered' : entry.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                        </Badge>
                        {entry.milestone && (
                          <Badge variant="secondary" className="text-xs">
                            {entry.milestone}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                        {entry.status === 'mastered' && entry.daysToMastery !== undefined && (
                          <span>Mastered in {entry.daysToMastery} day{entry.daysToMastery !== 1 ? 's' : ''}</span>
                        )}
                        {entry.status === 'in_progress' && (
                          <>
                            {entry.daysInProgress !== undefined && (
                              <span>Practicing for {entry.daysInProgress} day{entry.daysInProgress !== 1 ? 's' : ''}</span>
                            )}
                            {entry.progressEstimate !== undefined && (
                              <span className="text-xs">({entry.progressEstimate}% progress)</span>
                            )}
                          </>
                        )}
                        <span className="text-xs opacity-75">
                          {new Date(entry.date).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Progress bar for in-progress items */}
                      {entry.status === 'in_progress' && entry.progressEstimate !== undefined && (
                        <div className="mt-2 w-full max-w-xs">
                          <Progress value={entry.progressEstimate} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
