import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  MessageCircle,
  Clock,
  Lightbulb,
  FlaskConical
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { synthesizeSpeech } from "@/lib/restVoiceApi";
import type { ArisDrillAssignment } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteboard } from "@/hooks/useWhiteboard";
import { Whiteboard } from "@/components/Whiteboard";
import { useUser } from "@/lib/auth";
import { VoiceLabPanel, VoiceOverride } from "@/components/VoiceLabPanel";

interface DrillContentItem {
  prompt: string;
  expectedAnswer?: string;
  options?: string[];
  pronunciation?: string;
}

interface DrillContent {
  items: DrillContentItem[];
  instructions?: string;
  focusArea?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface ArisPersona {
  name: string;
  role: string;
  personality: string[];
  voiceTone: string;
  feedbackPhrases: {
    correct: string[];
    almostCorrect: string[];
    incorrect: string[];
    encouragement: string[];
  };
}

interface DrillState {
  currentItemIndex: number;
  correctCount: number;
  incorrectCount: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  startTime: number | null;
  responseTimes: number[];
  struggledItems: string[];
  attempts: Record<string, { correct: number; incorrect: number }>;
  recentHistory: Array<{ prompt: string; wasCorrect: boolean; studentAnswer: string }>;
}

interface ArisFeedbackResult {
  feedback: string;
  hint?: string;
  encouragement?: string;
  patternInsight?: string;
  suggestSimplify: boolean;
  flagForDaniela: boolean;
  flagReason?: string;
}

export default function ArisPractice() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useUser();
  
  const [selectedAssignment, setSelectedAssignment] = useState<ArisDrillAssignment | null>(null);
  const [drillState, setDrillState] = useState<DrillState | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState<ArisFeedbackResult | null>(null);
  const [sessionGreeting, setSessionGreeting] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isVoiceLabOpen, setIsVoiceLabOpen] = useState(false);
  const [voiceOverride, setVoiceOverride] = useState<VoiceOverride | null>(null);
  
  const whiteboard = useWhiteboard();
  
  // Admin/Developer check including founder access for Voice Lab
  const FOUNDER_USER_ID = '49847136';
  const isAdminOrDeveloper = user?.role === 'admin' || user?.role === 'developer' || user?.id === FOUNDER_USER_ID;
  
  const { data: pendingDrills, isLoading: loadingDrills } = useQuery<ArisDrillAssignment[]>({
    queryKey: ['/api/aris/drills/pending'],
  });
  
  const { data: arisPersona } = useQuery<ArisPersona>({
    queryKey: ['/api/aris/persona'],
  });
  
  const startDrillMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return await apiRequest("POST", `/api/aris/drills/${assignmentId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aris/drills/pending'] });
    },
  });
  
  const completeDrillMutation = useMutation({
    mutationFn: async ({ assignmentId, results }: { 
      assignmentId: string; 
      results: {
        correctCount: number;
        incorrectCount: number;
        accuracyPercent: number;
        averageResponseTimeMs: number;
        struggledItems: string[];
        itemAttempts: Record<string, { correct: number; incorrect: number }>;
        behavioralFlags: string[];
        arisNotes: string;
      }
    }) => {
      return await apiRequest("POST", `/api/aris/drills/${assignmentId}/complete`, results);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aris/drills/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/aris/history'] });
      setSelectedAssignment(null);
      setDrillState(null);
      toast({
        title: "Practice Complete!",
        description: "Great work! Your results have been sent to Daniela.",
      });
    },
  });
  
  const startDrill = useCallback(async (assignment: ArisDrillAssignment) => {
    try {
      await startDrillMutation.mutateAsync(assignment.id);
      setSelectedAssignment(assignment);
      
      const content = assignment.drillContent as DrillContent | null;
      const itemCount = content?.items?.length || 0;
      
      setDrillState({
        currentItemIndex: 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveCorrect: 0,
        consecutiveIncorrect: 0,
        startTime: Date.now(),
        responseTimes: [],
        struggledItems: [],
        attempts: {},
        recentHistory: [],
      });
      setUserAnswer("");
      setShowResult(false);
      setIsCorrect(null);
      setCurrentFeedback(null);
      whiteboard.clear();
      
      // Fetch AI greeting
      try {
        const greetingData = await apiRequest("POST", "/api/aris/greeting", {
          targetLanguage: assignment.targetLanguage,
          drillType: assignment.drillType,
          focusArea: content?.focusArea,
          itemCount,
        }) as { greeting?: string };
        const greeting = greetingData?.greeting || "";
        setSessionGreeting(greeting);
        if (greeting) {
          whiteboard.processMessage(greeting, assignment.targetLanguage);
        }
      } catch {
        setSessionGreeting("");
      }
    } catch (error: any) {
      console.error('[ArisPractice] Failed to start drill:', error);
      const errorMessage = error?.message || error?.error || "Could not start the drill. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [startDrillMutation, toast, whiteboard]);
  
  const getRandomFeedback = useCallback((type: 'correct' | 'almostCorrect' | 'incorrect' | 'encouragement') => {
    const phrases = arisPersona?.feedbackPhrases[type] || [];
    if (phrases.length === 0) {
      const defaults = {
        correct: ["Excellent!", "Perfect!", "Great job!"],
        almostCorrect: ["Almost there!", "So close!", "Nearly perfect!"],
        incorrect: ["Not quite.", "Let's try again.", "Keep practicing!"],
        encouragement: ["You've got this!", "Keep going!", "Making progress!"],
      };
      return defaults[type][Math.floor(Math.random() * defaults[type].length)];
    }
    return phrases[Math.floor(Math.random() * phrases.length)];
  }, [arisPersona]);
  
  const playAudio = useCallback(async (text: string) => {
    if (isPlaying) return;
    try {
      setIsPlaying(true);
      const result = await synthesizeSpeech(text, selectedAssignment?.targetLanguage || language);
      const audioUrl = URL.createObjectURL(result.audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => setIsPlaying(false);
      await audio.play();
    } catch (error) {
      setIsPlaying(false);
      console.error('[ArisPractice] Audio playback failed:', error);
    }
  }, [isPlaying, selectedAssignment, language]);
  
  const checkAnswer = useCallback(async () => {
    if (!selectedAssignment || !drillState) return;
    
    const content = selectedAssignment.drillContent as DrillContent | null;
    const drillItems = content?.items || [];
    const currentItem = drillItems[drillState.currentItemIndex];
    if (!currentItem) return;
    
    const itemStartTime = drillState.startTime || Date.now();
    const responseTime = Date.now() - itemStartTime;
    
    const normalizedAnswer = userAnswer.trim().toLowerCase();
    const targetText = currentItem.expectedAnswer || currentItem.prompt;
    const normalizedTarget = targetText.toLowerCase();
    const correct = normalizedAnswer === normalizedTarget;
    
    setIsCorrect(correct);
    setShowResult(true);
    setIsLoadingFeedback(true);
    
    // Fetch AI-powered feedback
    try {
      const aiFeedback = await apiRequest("POST", "/api/aris/feedback", {
        targetLanguage: selectedAssignment.targetLanguage,
        drillType: selectedAssignment.drillType,
        focusArea: content?.focusArea,
        currentItem: {
          prompt: currentItem.prompt,
          expectedAnswer: targetText,
          studentAnswer: userAnswer.trim(),
        },
        sessionProgress: {
          correctCount: drillState.correctCount,
          incorrectCount: drillState.incorrectCount,
          currentIndex: drillState.currentItemIndex,
          totalItems: drillItems.length,
          struggledItems: drillState.struggledItems,
          consecutiveCorrect: correct ? drillState.consecutiveCorrect + 1 : 0,
          consecutiveIncorrect: correct ? 0 : drillState.consecutiveIncorrect + 1,
        },
        recentHistory: drillState.recentHistory.slice(-3),
        isCorrect: correct,
      }) as unknown as ArisFeedbackResult;
      setCurrentFeedback(aiFeedback);
      
      // Process feedback for whiteboard markup (WRITE, PHONETIC, etc.)
      if (aiFeedback?.feedback) {
        whiteboard.processMessage(aiFeedback.feedback, selectedAssignment.targetLanguage);
      }
    } catch {
      // Fallback to static feedback if AI fails
      setCurrentFeedback({
        feedback: correct ? getRandomFeedback('correct') : getRandomFeedback('incorrect'),
        suggestSimplify: false,
        flagForDaniela: false,
      });
    } finally {
      setIsLoadingFeedback(false);
    }
    
    setDrillState(prev => {
      if (!prev) return prev;
      const itemKey = currentItem.prompt;
      const newAttempts = { ...prev.attempts };
      if (!newAttempts[itemKey]) {
        newAttempts[itemKey] = { correct: 0, incorrect: 0 };
      }
      if (correct) {
        newAttempts[itemKey].correct++;
      } else {
        newAttempts[itemKey].incorrect++;
      }
      
      const newStruggledItems = [...prev.struggledItems];
      if (!correct && !newStruggledItems.includes(itemKey)) {
        newStruggledItems.push(itemKey);
      }
      
      return {
        ...prev,
        correctCount: correct ? prev.correctCount + 1 : prev.correctCount,
        incorrectCount: correct ? prev.incorrectCount : prev.incorrectCount + 1,
        consecutiveCorrect: correct ? prev.consecutiveCorrect + 1 : 0,
        consecutiveIncorrect: correct ? 0 : prev.consecutiveIncorrect + 1,
        responseTimes: [...prev.responseTimes, responseTime],
        attempts: newAttempts,
        struggledItems: newStruggledItems,
        recentHistory: [
          ...prev.recentHistory,
          { prompt: currentItem.prompt, wasCorrect: correct, studentAnswer: userAnswer.trim() }
        ].slice(-5),
      };
    });
  }, [selectedAssignment, drillState, userAnswer, getRandomFeedback, whiteboard]);
  
  const nextItem = useCallback(() => {
    if (!selectedAssignment || !drillState) return;
    
    const content = selectedAssignment.drillContent as DrillContent | null;
    const drillItems = content?.items || [];
    const nextIndex = drillState.currentItemIndex + 1;
    
    if (nextIndex >= drillItems.length) {
      const totalItems = drillState.correctCount + drillState.incorrectCount;
      const accuracy = totalItems > 0 ? Math.round((drillState.correctCount / totalItems) * 100) : 0;
      const avgResponseTime = drillState.responseTimes.length > 0
        ? drillState.responseTimes.reduce((a, b) => a + b, 0) / drillState.responseTimes.length
        : 0;
      
      const behavioralFlags: string[] = [];
      if (accuracy < 50) behavioralFlags.push('low_accuracy');
      if (avgResponseTime > 10000) behavioralFlags.push('slow_responses');
      if (drillState.struggledItems.length > drillItems.length / 2) behavioralFlags.push('many_struggles');
      
      completeDrillMutation.mutate({
        assignmentId: selectedAssignment.id,
        results: {
          correctCount: drillState.correctCount,
          incorrectCount: drillState.incorrectCount,
          accuracyPercent: accuracy,
          averageResponseTimeMs: avgResponseTime,
          struggledItems: drillState.struggledItems,
          itemAttempts: drillState.attempts,
          behavioralFlags,
          arisNotes: `Completed ${drillItems.length} items with ${accuracy}% accuracy.`,
        },
      });
    } else {
      setDrillState(prev => prev ? { ...prev, currentItemIndex: nextIndex, startTime: Date.now() } : prev);
      setUserAnswer("");
      setShowResult(false);
      setIsCorrect(null);
      setCurrentFeedback(null);
      whiteboard.clear();
    }
  }, [selectedAssignment, drillState, completeDrillMutation, whiteboard]);
  
  if (loadingDrills) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-aris-practice">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (selectedAssignment && drillState) {
    const content = selectedAssignment.drillContent as DrillContent | null;
    const drillItems = content?.items || [];
    const currentItem = drillItems[drillState.currentItemIndex];
    const progress = drillItems.length > 0 
      ? ((drillState.currentItemIndex + 1) / drillItems.length) * 100 
      : 0;
    
    return (
      <div className="space-y-6" data-testid="aris-drill-session">
        <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <Avatar className="h-12 w-12 border-2 border-violet-500">
              <AvatarFallback className="bg-violet-500 text-white font-bold">A</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-lg" data-testid="text-aris-name">
                {arisPersona?.name || "Aris"}
              </CardTitle>
              <CardDescription data-testid="text-aris-role">
                {arisPersona?.role || "Precision Practice Partner"}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Target className="h-3 w-3" />
              {selectedAssignment.drillType}
            </Badge>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* AI Session Greeting */}
            {sessionGreeting && drillState.currentItemIndex === 0 && !showResult && (
              <p className="text-center text-sm text-muted-foreground italic bg-violet-500/5 p-3 rounded-lg" data-testid="text-session-greeting">
                "{sessionGreeting}"
              </p>
            )}
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{drillState.currentItemIndex + 1} / {drillItems.length}</span>
              </div>
              <Progress value={progress} className="h-2" data-testid="progress-drill" />
            </div>
            
            <div className="flex justify-center gap-4">
              <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                <CheckCircle2 className="h-3 w-3" />
                {drillState.correctCount}
              </Badge>
              <Badge variant="outline" className="gap-1 text-red-600 border-red-300">
                <XCircle className="h-3 w-3" />
                {drillState.incorrectCount}
              </Badge>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={drillState.currentItemIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="p-6 rounded-lg bg-card border text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => currentItem && playAudio(currentItem.prompt)}
                      disabled={isPlaying || !currentItem}
                      data-testid="button-play-audio"
                    >
                      <Volume2 className={`h-5 w-5 ${isPlaying ? 'animate-pulse text-primary' : ''}`} />
                    </Button>
                    <span className="text-2xl font-semibold" data-testid="text-drill-prompt">
                      {currentItem?.prompt}
                    </span>
                  </div>
                  
                  {content?.focusArea && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Focus: {content.focusArea}
                    </p>
                  )}
                  
                  {!showResult ? (
                    <div className="space-y-4">
                      <Input
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                        placeholder="Type your answer..."
                        className="text-center text-lg"
                        autoFocus
                        data-testid="input-drill-answer"
                      />
                      <Button 
                        onClick={checkAnswer} 
                        disabled={!userAnswer.trim()}
                        className="w-full"
                        data-testid="button-check-answer"
                      >
                        Check Answer
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {isLoadingFeedback ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                          <span className="ml-2 text-sm text-muted-foreground">Aris is thinking...</span>
                        </div>
                      ) : (
                        <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border`}>
                          <div className="flex items-center justify-center gap-2 mb-2">
                            {isCorrect ? (
                              <CheckCircle2 className="h-6 w-6 text-green-500" />
                            ) : (
                              <XCircle className="h-6 w-6 text-red-500" />
                            )}
                            <span className="font-medium" data-testid="text-drill-feedback">
                              {currentFeedback?.feedback || (isCorrect ? "Great job!" : "Not quite.")}
                            </span>
                          </div>
                          
                          {/* AI Hint */}
                          {currentFeedback?.hint && (
                            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                              <Lightbulb className="inline h-3 w-3 mr-1" />
                              {currentFeedback.hint}
                            </p>
                          )}
                          
                          {/* Pattern Insight */}
                          {currentFeedback?.patternInsight && (
                            <p className="text-sm text-violet-600 dark:text-violet-400 mt-2 italic">
                              {currentFeedback.patternInsight}
                            </p>
                          )}
                          
                          {/* Correct answer display */}
                          {!isCorrect && currentItem && (
                            <p className="text-sm text-muted-foreground mt-2">
                              Correct answer: <strong>{currentItem.expectedAnswer || currentItem.prompt}</strong>
                            </p>
                          )}
                          
                          {/* Encouragement */}
                          {currentFeedback?.encouragement && (
                            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                              {currentFeedback.encouragement}
                            </p>
                          )}
                          
                          {/* Suggest simplify notice */}
                          {currentFeedback?.suggestSimplify && (
                            <p className="text-xs text-muted-foreground mt-3 italic">
                              Would you like me to simplify this exercise?
                            </p>
                          )}
                        </div>
                      )}
                      <Button 
                        onClick={nextItem} 
                        className="w-full gap-2"
                        disabled={isLoadingFeedback}
                        data-testid="button-next-item"
                      >
                        {drillState.currentItemIndex + 1 >= drillItems.length ? (
                          <>
                            <Trophy className="h-4 w-4" />
                            Complete Drill
                          </>
                        ) : (
                          <>
                            Next Item
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
        
        {/* Whiteboard - Visual teaching aids from Aris (same tools as Daniela) */}
        {whiteboard.items.length > 0 && (
          <div data-testid="aris-whiteboard-container">
            <Whiteboard 
              items={whiteboard.items} 
              onClear={whiteboard.clear}
              onDrillComplete={(drillId, drillType, isCorrect, responseTimeMs) => {
                console.log('[ArisPractice] Drill complete:', { drillId, drillType, isCorrect, responseTimeMs });
              }}
            />
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="aris-practice-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-violet-500">
            <AvatarFallback className="bg-violet-500 text-white text-xl font-bold">A</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Practice with {arisPersona?.name || "Aris"}
            </h1>
            <p className="text-muted-foreground" data-testid="text-page-subtitle">
              {arisPersona?.role || "Your Precision Practice Partner"}
            </p>
          </div>
        </div>
        
        {isAdminOrDeveloper && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVoiceLabOpen(true)}
            className="gap-2"
            data-testid="button-voice-lab"
          >
            <FlaskConical className="h-4 w-4" />
            Voice Lab
          </Button>
        )}
      </div>
      
      {(!pendingDrills || pendingDrills.length === 0) ? (
        <Card className="border-dashed" data-testid="card-no-drills">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Practice Assigned</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Daniela hasn't assigned any practice drills yet. Keep chatting with her, 
              and she'll send you focused practice when you need it!
            </p>
            <Button variant="outline" className="mt-6 gap-2" asChild>
              <a href="/chat" data-testid="link-chat-daniela">
                <MessageCircle className="h-4 w-4" />
                Chat with Daniela
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Your Practice Queue</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/aris/drills/pending'] })}
              data-testid="button-refresh-drills"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid gap-4">
            {pendingDrills.map((drill) => {
              const drillContent = drill.drillContent as DrillContent | null;
              return (
              <Card key={drill.id} className="hover-elevate" data-testid={`card-drill-${drill.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="capitalize">
                          {drill.drillType}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {drillContent?.items?.length || 0} items
                        </Badge>
                      </div>
                      <h3 className="font-medium truncate" data-testid={`text-drill-focus-${drill.id}`}>
                        {drillContent?.focusArea || "General Practice"}
                      </h3>
                      {drillContent?.instructions && (
                        <p className="text-sm text-muted-foreground truncate">
                          From Daniela: {drillContent.instructions}
                        </p>
                      )}
                    </div>
                    <Button 
                      onClick={() => startDrill(drill)}
                      disabled={startDrillMutation.isPending}
                      className="shrink-0 gap-2"
                      data-testid={`button-start-drill-${drill.id}`}
                    >
                      {startDrillMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Target className="h-4 w-4" />
                      )}
                      Start Practice
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
      )}
      
      {isAdminOrDeveloper && (
        <VoiceLabPanel
          isOpen={isVoiceLabOpen}
          onClose={() => setIsVoiceLabOpen(false)}
          language={language}
          tutorGender="female"
          onOverrideChange={setVoiceOverride}
          currentOverride={voiceOverride}
        />
      )}
    </div>
  );
}
