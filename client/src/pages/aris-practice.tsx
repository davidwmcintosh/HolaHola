import { useState, useCallback, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  FlaskConical,
  Compass,
  BookOpen,
  GraduationCap,
  CheckCheck,
  Play,
  ChevronLeft,
  Mic,
  MicOff
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { synthesizeSpeech, transcribeAudio } from "@/lib/restVoiceApi";
import type { ArisDrillAssignment } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteboard } from "@/hooks/useWhiteboard";
import { Whiteboard } from "@/components/Whiteboard";
import { useUser } from "@/lib/auth";
import { getTutorName } from "@/lib/tutor-avatars";
import { VoiceLabPanel, VoiceOverride } from "@/components/VoiceLabPanel";

interface DrillContentItem {
  prompt: string;
  expectedAnswer?: string;
  options?: string[];
  pronunciation?: string;
  itemType?: string;           // listen_repeat, translate_speak, etc.
  audioReference?: string;      // Pre-recorded audio URL
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
  sessionStartTime: number | null;  // Total session start (never reset)
  startTime: number | null;         // Per-item start for response timing
  responseTimes: number[];
  struggledItems: string[];
  attempts: Record<string, { correct: number; incorrect: number }>;
  recentHistory: Array<{ prompt: string; wasCorrect: boolean; studentAnswer: string }>;
}

// Extended drill item for self-practice with full metadata
interface SelfPracticeDrillItem {
  id: string;
  prompt: string;
  expectedResponse: string | null;
  pronunciationGuide: string | null;
  itemType: string;
  audioReference: string | null;
  options: string[] | null;
  difficulty: number | null;
  tags: string[] | null;
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

interface CatalogItem {
  lessonId: string;
  lessonTitle: string;
  targetLanguage: string;
  itemCount: number;
  estimatedMinutes: number;
  tags: string[];
  itemTypes: string[];
  difficulty: number;
  completed: boolean;
  lastCompletedAt: string | null;
}

interface CatalogResponse {
  catalog: CatalogItem[];
  byLanguage: Record<string, CatalogItem[]>;
  totalLessons: number;
  languages: string[];
}

interface SelfPracticeSession {
  id: string;
  lessonId: string;
  status: string;
  totalItems: number;
  completedItems: number;
  correctItems: number;
}

export default function ArisPractice() {
  const { language, tutorGender, difficulty } = useLanguage();
  const { toast } = useToast();
  const { user } = useUser();
  const autoStartHandledRef = useRef(false);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const mainTutorName = getTutorName(language, tutorGender);
  
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
  const [activeTab, setActiveTab] = useState("assigned");
  const [catalogLanguageFilter, setCatalogLanguageFilter] = useState<string>("current");
  const difficultyToNumeric = (d: string) => {
    if (d === 'beginner') return '1';
    if (d === 'intermediate') return '3';
    if (d === 'advanced') return '4';
    return 'all';
  };
  const [catalogDifficultyFilter, setCatalogDifficultyFilter] = useState<string>(() => difficultyToNumeric(difficulty));
  const [selfPracticeSession, setSelfPracticeSession] = useState<SelfPracticeSession | null>(null);
  const [selfPracticeDrillItems, setSelfPracticeDrillItems] = useState<SelfPracticeDrillItem[]>([]);
  const [loadingLessonId, setLoadingLessonId] = useState<string | null>(null);
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  const whiteboard = useWhiteboard();
  
  // localStorage keys for session persistence
  const STORAGE_KEY_SESSION = 'aris-practice-session';
  const STORAGE_KEY_STATE = 'aris-practice-state';
  const STORAGE_KEY_ITEMS = 'aris-practice-items';
  
  useEffect(() => {
    setCatalogDifficultyFilter(difficultyToNumeric(difficulty));
  }, [difficulty]);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY_SESSION);
      const savedState = localStorage.getItem(STORAGE_KEY_STATE);
      const savedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
      
      if (savedSession && savedState && savedItems) {
        const session = JSON.parse(savedSession) as SelfPracticeSession;
        const state = JSON.parse(savedState) as DrillState;
        const items = JSON.parse(savedItems) as SelfPracticeDrillItem[];
        
        // Only restore if session is still in progress
        if (session.status === 'in_progress' && items.length > 0) {
          setSelfPracticeSession(session);
          setDrillState(state);
          setSelfPracticeDrillItems(items);
          setActiveTab('explore');
        }
      }
    } catch (error) {
      console.error('[ArisPractice] Failed to restore session from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem(STORAGE_KEY_STATE);
      localStorage.removeItem(STORAGE_KEY_ITEMS);
    }
  }, []);
  
  // Save session progress to localStorage whenever state changes
  useEffect(() => {
    if (selfPracticeSession && drillState && selfPracticeDrillItems.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(selfPracticeSession));
        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(drillState));
        localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(selfPracticeDrillItems));
      } catch (error) {
        console.error('[ArisPractice] Failed to save session to localStorage:', error);
      }
    }
  }, [selfPracticeSession, drillState, selfPracticeDrillItems]);
  
  // Clear localStorage when session ends
  const clearSessionStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem(STORAGE_KEY_STATE);
    localStorage.removeItem(STORAGE_KEY_ITEMS);
  }, []);
  
  // Admin/Developer check including founder access for Voice Lab
  const FOUNDER_USER_ID = '49847136';
  const isAdminOrDeveloper = user?.role === 'admin' || user?.role === 'developer' || user?.id === FOUNDER_USER_ID;
  
  const { data: pendingDrills, isLoading: loadingDrills } = useQuery<ArisDrillAssignment[]>({
    queryKey: ['/api/aris/drills/pending'],
  });
  
  const { data: arisPersona } = useQuery<ArisPersona>({
    queryKey: ['/api/aris/persona'],
  });
  
  // Practice catalog for Explore tab - include both filters in query key and URL
  const { data: catalogData, isLoading: loadingCatalog } = useQuery<CatalogResponse>({
    queryKey: ['/api/practice/catalog', catalogLanguageFilter, catalogDifficultyFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (catalogLanguageFilter !== 'all') {
        params.set('language', catalogLanguageFilter === 'current' ? language : catalogLanguageFilter);
      }
      if (catalogDifficultyFilter !== 'all') {
        params.set('difficulty', catalogDifficultyFilter);
      }
      const queryString = params.toString();
      const url = `/api/practice/catalog${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch catalog');
      return response.json();
    },
    enabled: activeTab === 'explore',
  });
  
  // Start self-practice session mutation
  const startSelfPracticeMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      setLoadingLessonId(lessonId);
      const response = await apiRequest("POST", "/api/practice/sessions", { lessonId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setLoadingLessonId(null);
      // Invalidate catalog to reflect session in-progress
      queryClient.invalidateQueries({ queryKey: ['/api/practice/catalog'], exact: false });
      
      const drillItems = data.drillItems || [];
      if (drillItems.length === 0) {
        toast({
          title: "No Practice Items",
          description: "This drill doesn't have any items yet. Try another one!",
          variant: "destructive",
        });
        return;
      }
      
      setSelfPracticeSession(data.session);
      setSelfPracticeDrillItems(drillItems);
      const now = Date.now();
      setDrillState({
        currentItemIndex: 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveCorrect: 0,
        consecutiveIncorrect: 0,
        sessionStartTime: now,  // Track total session time
        startTime: now,
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
      toast({
        title: "Practice Started",
        description: "Your self-practice session is ready. Good luck!",
      });
    },
    onError: (error: any) => {
      setLoadingLessonId(null);
      toast({
        title: "Error",
        description: error?.message || "Failed to start practice session",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (autoStartHandledRef.current) return;
    const params = new URLSearchParams(search);
    const autoLessonId = params.get('lessonId');
    if (autoLessonId) {
      autoStartHandledRef.current = true;
      setActiveTab('explore');
      startSelfPracticeMutation.mutate(autoLessonId);
      setLocation('/practice', { replace: true });
    }
  }, [search]);
  
  // Complete self-practice session mutation
  const completeSelfPracticeMutation = useMutation({
    mutationFn: async ({ sessionId, results }: { 
      sessionId: string; 
      results: { completedItems: number; correctItems: number; averageScore: number; totalTimeSpentMs: number; }
    }) => {
      return await apiRequest("PATCH", `/api/practice/sessions/${sessionId}/complete`, results);
    },
    onSuccess: () => {
      // Invalidate all catalog queries regardless of filter params
      queryClient.invalidateQueries({ queryKey: ['/api/practice/catalog'], exact: false });
      setSelfPracticeSession(null);
      setSelfPracticeDrillItems([]);
      setDrillState(null);
      clearSessionStorage();
      toast({
        title: "Practice Complete!",
        description: "Great job on your self-directed practice!",
      });
    },
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
        description: `Great work! Your results have been sent to ${mainTutorName}.`,
      });
    },
  });
  
  const startDrill = useCallback(async (assignment: ArisDrillAssignment) => {
    try {
      await startDrillMutation.mutateAsync(assignment.id);
      setSelectedAssignment(assignment);
      
      const content = assignment.drillContent as DrillContent | null;
      const itemCount = content?.items?.length || 0;
      
      const now = Date.now();
      setDrillState({
        currentItemIndex: 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveCorrect: 0,
        consecutiveIncorrect: 0,
        sessionStartTime: now,  // Track total session time
        startTime: now,
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
  
  // Voice recording functions for listen/repeat drills
  const startVoiceRecording = useCallback(async () => {
    if (isRecordingAnswer) return;
    
    try {
      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        toast({
          variant: "destructive",
          title: "Not Supported",
          description: "Voice recording is not supported in this browser.",
        });
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
      streamRef.current = stream;
      
      // Choose supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported?.('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = () => {
        toast({
          variant: "destructive",
          title: "Recording Error",
          description: "An error occurred while recording. Please try again.",
        });
        setIsRecordingAnswer(false);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size === 0) {
          toast({
            variant: "destructive",
            title: "Recording Empty",
            description: "No audio was captured. Please try again.",
          });
          return;
        }
        
        // Transcribe the audio
        setIsTranscribing(true);
        try {
          const transcribedText = await transcribeAudio(audioBlob, language);
          setUserAnswer(transcribedText);
          setIsTranscribing(false);
          
          // Auto-check answer after transcription
          // We'll trigger checkAnswer after setting the answer
        } catch (error: any) {
          setIsTranscribing(false);
          toast({
            variant: "destructive",
            title: "Transcription Failed",
            description: error.message || "Could not transcribe your speech. Please try again.",
          });
        }
      };
      
      mediaRecorder.start();
      setIsRecordingAnswer(true);
      
    } catch (error: any) {
      console.error('[ArisPractice] Voice recording failed:', error);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use voice input.",
      });
    }
  }, [isRecordingAnswer, language, toast]);
  
  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecordingAnswer(false);
  }, []);
  
  // Number word mappings for multiple languages
  const numberMappings: Record<string, Record<string, string>> = {
    english: {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
      'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
      'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
      'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
      'eighteen': '18', 'nineteen': '19', 'twenty': '20',
    },
    french: {
      'zéro': '0', 'zero': '0', 'un': '1', 'deux': '2', 'trois': '3', 'quatre': '4',
      'cinq': '5', 'six': '6', 'sept': '7', 'huit': '8', 'neuf': '9',
      'dix': '10', 'onze': '11', 'douze': '12', 'treize': '13',
      'quatorze': '14', 'quinze': '15', 'seize': '16', 'dix-sept': '17',
      'dix-huit': '18', 'dix-neuf': '19', 'vingt': '20',
    },
    spanish: {
      'cero': '0', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
      'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9',
      'diez': '10', 'once': '11', 'doce': '12', 'trece': '13',
      'catorce': '14', 'quince': '15', 'dieciséis': '16', 'diecisiete': '17',
      'dieciocho': '18', 'diecinueve': '19', 'veinte': '20',
    },
    italian: {
      'zero': '0', 'uno': '1', 'due': '2', 'tre': '3', 'quattro': '4',
      'cinque': '5', 'sei': '6', 'sette': '7', 'otto': '8', 'nove': '9',
      'dieci': '10', 'undici': '11', 'dodici': '12', 'tredici': '13',
      'quattordici': '14', 'quindici': '15', 'sedici': '16', 'diciassette': '17',
      'diciotto': '18', 'diciannove': '19', 'venti': '20',
    },
    portuguese: {
      'zero': '0', 'um': '1', 'dois': '2', 'três': '3', 'tres': '3', 'quatro': '4',
      'cinco': '5', 'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9',
      'dez': '10', 'onze': '11', 'doze': '12', 'treze': '13',
      'catorze': '14', 'quinze': '15', 'dezesseis': '16', 'dezessete': '17',
      'dezoito': '18', 'dezenove': '19', 'vinte': '20',
    },
    german: {
      'null': '0', 'eins': '1', 'zwei': '2', 'drei': '3', 'vier': '4',
      'fünf': '5', 'funf': '5', 'sechs': '6', 'sieben': '7', 'acht': '8', 'neun': '9',
      'zehn': '10', 'elf': '11', 'zwölf': '12', 'zwolf': '12', 'dreizehn': '13',
      'vierzehn': '14', 'fünfzehn': '15', 'sechzehn': '16', 'siebzehn': '17',
      'achtzehn': '18', 'neunzehn': '19', 'zwanzig': '20',
    },
  };
  
  // Normalize answer for comparison - handles number words and numeric representations
  const normalizeForComparison = useCallback((answer: string, target: string, lang: string): boolean => {
    // Strip punctuation and normalize
    const stripPunctuation = (s: string) => s.replace(/[.,!?;:'"()[\]{}]/g, '').trim().toLowerCase();
    const normalizedAnswer = stripPunctuation(answer);
    const normalizedTarget = stripPunctuation(target);
    
    // Direct match
    if (normalizedAnswer === normalizedTarget) return true;
    
    // Get number mappings for the current language + English fallback
    const langMappings = numberMappings[lang] || {};
    const englishMappings = numberMappings['english'] || {};
    const allMappings = { ...englishMappings, ...langMappings };
    
    // Create reverse mappings (number -> words)
    const reverseMappings: Record<string, string[]> = {};
    Object.entries(allMappings).forEach(([word, num]) => {
      if (!reverseMappings[num]) reverseMappings[num] = [];
      reverseMappings[num].push(word);
    });
    
    // Check if answer is a number word that matches the target number
    if (allMappings[normalizedAnswer] === normalizedTarget) return true;
    
    // Check if target is a number and answer is any valid word for that number
    if (reverseMappings[normalizedTarget]?.includes(normalizedAnswer)) return true;
    
    // Check if answer is a number and target is a word for that number
    if (allMappings[normalizedTarget] === normalizedAnswer) return true;
    
    // Check if both map to the same number
    const answerAsNumber = allMappings[normalizedAnswer];
    const targetAsNumber = allMappings[normalizedTarget];
    if (answerAsNumber && answerAsNumber === targetAsNumber) return true;
    if (answerAsNumber && answerAsNumber === normalizedTarget) return true;
    if (targetAsNumber && targetAsNumber === normalizedAnswer) return true;
    
    return false;
  }, []);
  
  const checkAnswer = useCallback(async () => {
    if (!drillState) return;
    
    // Support both Aris assignments and self-practice sessions
    const isSelfPractice = !!selfPracticeSession;
    let drillItems: DrillContentItem[] = [];
    let targetLanguage = language;
    let drillType = 'practice';
    let focusArea = '';
    
    if (isSelfPractice) {
      // Self-practice mode - preserve full drill item metadata
      drillItems = selfPracticeDrillItems.map(item => ({
        prompt: item.prompt,
        expectedAnswer: item.expectedResponse || item.prompt,
        pronunciation: item.pronunciationGuide || undefined,
        options: item.options || undefined,
        itemType: item.itemType || undefined,
        audioReference: item.audioReference || undefined,
      }));
      targetLanguage = selfPracticeSession.lessonId ? language : language;
    } else if (selectedAssignment) {
      // Aris assignment mode
      const content = selectedAssignment.drillContent as DrillContent | null;
      drillItems = content?.items || [];
      targetLanguage = selectedAssignment.targetLanguage;
      drillType = selectedAssignment.drillType;
      focusArea = content?.focusArea || '';
    } else {
      return;
    }
    
    const currentItem = drillItems[drillState.currentItemIndex];
    if (!currentItem) return;
    
    const itemStartTime = drillState.startTime || Date.now();
    const responseTime = Date.now() - itemStartTime;
    
    const targetText = currentItem.expectedAnswer || currentItem.prompt;
    // Use smart comparison that handles number words and other equivalents
    const correct = normalizeForComparison(userAnswer, targetText, targetLanguage);
    
    setIsCorrect(correct);
    setShowResult(true);
    setIsLoadingFeedback(true);
    
    // Fetch AI-powered feedback (only for Aris assignments - self-practice uses simpler feedback)
    try {
      if (!isSelfPractice && selectedAssignment) {
        const aiFeedback = await apiRequest("POST", "/api/aris/feedback", {
          targetLanguage: targetLanguage,
          drillType: drillType,
          focusArea: focusArea,
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
          whiteboard.processMessage(aiFeedback.feedback, targetLanguage);
        }
      } else {
        // Self-practice uses simpler static feedback
        setCurrentFeedback({
          feedback: correct ? getRandomFeedback('correct') : getRandomFeedback('incorrect'),
          suggestSimplify: false,
          flagForDaniela: false,
        });
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
  }, [selectedAssignment, selfPracticeSession, selfPracticeDrillItems, drillState, userAnswer, getRandomFeedback, whiteboard, language, normalizeForComparison]);
  
  const nextItem = useCallback(() => {
    if (!drillState) return;
    
    // Support both Aris assignments and self-practice sessions
    const isSelfPractice = !!selfPracticeSession;
    let drillItems: DrillContentItem[] = [];
    
    if (isSelfPractice) {
      // Preserve full metadata for session completion
      drillItems = selfPracticeDrillItems.map(item => ({
        prompt: item.prompt,
        expectedAnswer: item.expectedResponse || item.prompt,
        pronunciation: item.pronunciationGuide || undefined,
        options: item.options || undefined,
        itemType: item.itemType || undefined,
        audioReference: item.audioReference || undefined,
      }));
    } else if (selectedAssignment) {
      const content = selectedAssignment.drillContent as DrillContent | null;
      drillItems = content?.items || [];
    } else {
      return;
    }
    
    const nextIndex = drillState.currentItemIndex + 1;
    
    if (nextIndex >= drillItems.length) {
      const totalItems = drillState.correctCount + drillState.incorrectCount;
      const accuracy = totalItems > 0 ? Math.round((drillState.correctCount / totalItems) * 100) : 0;
      const avgResponseTime = drillState.responseTimes.length > 0
        ? drillState.responseTimes.reduce((a, b) => a + b, 0) / drillState.responseTimes.length
        : 0;
      
      if (isSelfPractice && selfPracticeSession) {
        // Complete self-practice session - use sessionStartTime for accurate total duration
        completeSelfPracticeMutation.mutate({
          sessionId: selfPracticeSession.id,
          results: {
            completedItems: drillState.correctCount + drillState.incorrectCount,
            correctItems: drillState.correctCount,
            averageScore: accuracy,
            totalTimeSpentMs: Date.now() - (drillState.sessionStartTime || Date.now()),
          },
        });
      } else if (selectedAssignment) {
        // Complete Aris assignment
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
      }
    } else {
      setDrillState(prev => prev ? { ...prev, currentItemIndex: nextIndex, startTime: Date.now() } : prev);
      setUserAnswer("");
      setShowResult(false);
      setIsCorrect(null);
      setCurrentFeedback(null);
      setIsRecordingAnswer(false);
      setIsTranscribing(false);
      whiteboard.clear();
    }
  }, [selectedAssignment, selfPracticeSession, selfPracticeDrillItems, drillState, completeDrillMutation, completeSelfPracticeMutation, whiteboard]);
  
  if (loadingDrills) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-aris-practice">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Handle both assigned drills and self-practice sessions
  const isInDrillSession = (selectedAssignment && drillState) || (selfPracticeSession && drillState);
  
  if (isInDrillSession && drillState) {
    const isSelfPractice = !!selfPracticeSession;
    let drillItems: DrillContentItem[] = [];
    let sessionTitle = '';
    let drillType = 'practice';
    
    if (isSelfPractice) {
      // Preserve full metadata from self-practice items
      drillItems = selfPracticeDrillItems.map(item => ({
        prompt: item.prompt,
        expectedAnswer: item.expectedResponse || item.prompt,
        pronunciation: item.pronunciationGuide || undefined,
        options: item.options || undefined,
        itemType: item.itemType || undefined,
        audioReference: item.audioReference || undefined,
      }));
      sessionTitle = 'Self-Practice Session';
      drillType = selfPracticeDrillItems[0]?.itemType || 'practice';
    } else if (selectedAssignment) {
      const content = selectedAssignment.drillContent as DrillContent | null;
      drillItems = content?.items || [];
      sessionTitle = content?.focusArea || 'Practice Session';
      drillType = selectedAssignment.drillType;
    }
    
    const currentItem = drillItems[drillState.currentItemIndex];
    const progress = drillItems.length > 0 
      ? ((drillState.currentItemIndex + 1) / drillItems.length) * 100 
      : 0;
    
    // Get user-friendly instruction based on drill type
    const getDrillInstruction = (type: string) => {
      switch (type) {
        case 'listen_repeat':
          return 'Listen to the audio and type what you hear';
        case 'translate_speak':
          return 'Translate the phrase and type your answer';
        case 'vocabulary':
        case 'vocab':
          return 'Type the correct translation';
        case 'numbers':
          return 'Type the number shown';
        case 'pronunciation':
          return 'Listen and type what you hear';
        default:
          return 'Type your answer below';
      }
    };
    
    // Handle exiting the drill session
    const handleExitDrill = () => {
      if (isSelfPractice) {
        setSelfPracticeSession(null);
        setSelfPracticeDrillItems([]);
        clearSessionStorage();
      } else {
        setSelectedAssignment(null);
      }
      setDrillState(null);
      setUserAnswer("");
      setShowResult(false);
      setIsCorrect(null);
      setCurrentFeedback(null);
      setIsRecordingAnswer(false);
      setIsTranscribing(false);
      whiteboard.clear();
    };
    
    return (
      <div className="space-y-6" data-testid="aris-drill-session">
        {/* Back navigation */}
        <Button 
          variant="ghost" 
          onClick={handleExitDrill}
          className="mb-2"
          data-testid="button-back-to-practice"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Practice
        </Button>
        
        <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <Avatar className="h-12 w-12 border-2 border-violet-500">
              <AvatarFallback className="bg-violet-500 text-white font-bold">
                {(arisPersona?.name || "A").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-lg" data-testid="text-aris-name">
                Practice with {arisPersona?.name || "Aris"}
              </CardTitle>
              <CardDescription data-testid="text-aris-role">
                {getDrillInstruction(drillType)}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Target className="h-3 w-3" />
              {drillType}
            </Badge>
            {isSelfPractice && (
              <Badge variant="outline" className="gap-1 border-blue-300 text-blue-600">
                <Compass className="h-3 w-3" />
                Self-Practice
              </Badge>
            )}
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
                  
                  {/* Only show focus area for assigned drills (not self-practice) */}
                  {sessionTitle && !isSelfPractice && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Focus: {sessionTitle}
                    </p>
                  )}
                  
                  {!showResult ? (
                    <div className="space-y-4">
                      {/* Voice input mode for listen/repeat and pronunciation drills */}
                      {(drillType === 'listen_repeat' || drillType === 'pronunciation') ? (
                        <div className="space-y-4">
                          {/* Voice recording button */}
                          <div className="flex flex-col items-center gap-3">
                            <Button
                              variant={isRecordingAnswer ? "destructive" : "default"}
                              size="lg"
                              className={`h-16 w-16 rounded-full ${isRecordingAnswer ? 'animate-pulse' : ''}`}
                              onClick={isRecordingAnswer ? stopVoiceRecording : startVoiceRecording}
                              disabled={isTranscribing}
                              data-testid="button-voice-record"
                            >
                              {isRecordingAnswer ? (
                                <MicOff className="h-6 w-6" />
                              ) : (
                                <Mic className="h-6 w-6" />
                              )}
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              {isTranscribing ? "Transcribing..." : isRecordingAnswer ? "Tap to stop" : "Tap to speak"}
                            </span>
                          </div>
                          
                          {/* Show transcribed text */}
                          {userAnswer && !isRecordingAnswer && !isTranscribing && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground mb-1">You said:</p>
                              <p className="text-lg font-medium">{userAnswer}</p>
                            </div>
                          )}
                          
                          {/* Check answer button appears after transcription */}
                          {userAnswer && !isRecordingAnswer && !isTranscribing && (
                            <Button 
                              onClick={checkAnswer} 
                              className="w-full"
                              data-testid="button-check-answer"
                            >
                              Check Answer
                            </Button>
                          )}
                        </div>
                      ) : (
                        /* Standard text input for other drill types */
                        <>
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
                        </>
                      )}
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
  
  // Helper to format language names
  const formatLanguage = (lang: string) => {
    return lang.charAt(0).toUpperCase() + lang.slice(1);
  };
  
  // Get difficulty label
  const getDifficultyLabel = (level: number) => {
    if (level <= 1) return "Beginner";
    if (level <= 3) return "Intermediate";
    return "Advanced";
  };
  
  const filteredCatalog = catalogData?.catalog?.filter(item => {
    if (catalogLanguageFilter === 'current' && item.targetLanguage !== language) {
      return false;
    }
    if (catalogDifficultyFilter !== 'all') {
      const filterLevel = parseInt(catalogDifficultyFilter, 10);
      if (!isNaN(filterLevel) && item.difficulty !== filterLevel) {
        return false;
      }
    }
    return true;
  }) || [];
  
  return (
    <div className="space-y-6" data-testid="aris-practice-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
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
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assigned" className="gap-2" data-testid="tab-assigned">
            <GraduationCap className="h-4 w-4" />
            Assigned
            {pendingDrills && pendingDrills.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingDrills.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="explore" className="gap-2" data-testid="tab-explore">
            <Compass className="h-4 w-4" />
            Explore
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="assigned" className="mt-6">
          {loadingDrills ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (!pendingDrills || pendingDrills.length === 0) ? (
            <Card className="border-dashed" data-testid="card-no-drills">
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Practice Assigned</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {mainTutorName} hasn't assigned any practice drills yet. Keep chatting with {tutorGender === 'male' ? 'him' : 'her'}, 
                  and {tutorGender === 'male' ? "he'll" : "she'll"} send you focused practice when you need it!
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
                  <Button variant="outline" className="gap-2" asChild>
                    <a href="/chat" data-testid="link-chat-daniela">
                      <MessageCircle className="h-4 w-4" />
                      Chat with {mainTutorName}
                    </a>
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="gap-2"
                    onClick={() => setActiveTab('explore')}
                    data-testid="button-explore-drills"
                  >
                    <Compass className="h-4 w-4" />
                    Explore Practice
                  </Button>
                </div>
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
                          <div className="flex items-center gap-2 flex-wrap mb-1">
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
                              From {mainTutorName}: {drillContent.instructions}
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
        </TabsContent>
        
        <TabsContent value="explore" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-medium">Practice Catalog</h2>
                <p className="text-sm text-muted-foreground">
                  Browse and practice drills at your own pace
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select 
                  value={catalogLanguageFilter} 
                  onValueChange={setCatalogLanguageFilter}
                >
                  <SelectTrigger className="w-[160px]" data-testid="select-language-filter">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    <SelectItem value="current">Current ({formatLanguage(language)})</SelectItem>
                    {catalogData?.languages?.map(lang => (
                      <SelectItem key={lang} value={lang}>{formatLanguage(lang)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={catalogDifficultyFilter} 
                  onValueChange={setCatalogDifficultyFilter}
                >
                  <SelectTrigger className="w-[140px]" data-testid="select-difficulty-filter">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="1">Beginner</SelectItem>
                    <SelectItem value="3">Intermediate</SelectItem>
                    <SelectItem value="4">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/practice/catalog'], exact: false })}
                  data-testid="button-refresh-catalog"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {loadingCatalog ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCatalog.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Drills Available</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    No practice drills found for the selected language. Try selecting a different language or check back later.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCatalog.map((item) => (
                  <Card 
                    key={item.lessonId} 
                    className={`hover-elevate ${item.completed ? 'border-green-500/30' : ''}`}
                    data-testid={`card-catalog-${item.lessonId}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">
                            {item.lessonTitle}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {formatLanguage(item.targetLanguage)}
                          </CardDescription>
                        </div>
                        {item.completed && (
                          <CheckCheck className="h-5 w-5 text-green-500 shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          ~{item.estimatedMinutes} min
                        </Badge>
                        <Badge variant="secondary">
                          {getDifficultyLabel(item.difficulty)}
                        </Badge>
                      </div>
                      
                      {item.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {item.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{item.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                      
                      <Button 
                        onClick={() => startSelfPracticeMutation.mutate(item.lessonId)}
                        disabled={loadingLessonId !== null}
                        className="w-full gap-2"
                        variant={item.completed ? "secondary" : "default"}
                        data-testid={`button-start-self-practice-${item.lessonId}`}
                      >
                        {loadingLessonId === item.lessonId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        {item.completed ? "Practice Again" : "Start Practice"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {isAdminOrDeveloper && (
        <VoiceLabPanel
          isOpen={isVoiceLabOpen}
          onClose={() => setIsVoiceLabOpen(false)}
          language={language}
          tutorGender="female"
          onOverrideChange={setVoiceOverride}
          currentOverride={voiceOverride}
          role="assistant"
        />
      )}
    </div>
  );
}
