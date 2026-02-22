import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LearningContextFilter } from "@/components/LearningContextFilter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  GraduationCap, 
  Zap, 
  Target,
  ChevronRight,
  RotateCcw,
  Award,
  ArrowLeft
} from "lucide-react";
import holaholaIcon from "@assets/holaholajustbubblesBackgroundRemoved_1765309702014.png";
import type { GrammarCompetency, GrammarExercise as GrammarExerciseType } from "@shared/schema";

const ACTFL_LEVELS = [
  { id: 'novice_low', label: 'Novice Low', numeric: 1, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { id: 'novice_mid', label: 'Novice Mid', numeric: 2, color: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-300' },
  { id: 'novice_high', label: 'Novice High', numeric: 3, color: 'bg-emerald-300 text-emerald-900 dark:bg-emerald-700/50 dark:text-emerald-200' },
  { id: 'intermediate_low', label: 'Intermediate Low', numeric: 4, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { id: 'intermediate_mid', label: 'Intermediate Mid', numeric: 5, color: 'bg-blue-200 text-blue-800 dark:bg-blue-800/40 dark:text-blue-300' },
  { id: 'intermediate_high', label: 'Intermediate High', numeric: 6, color: 'bg-blue-300 text-blue-900 dark:bg-blue-700/50 dark:text-blue-200' },
  { id: 'advanced_low', label: 'Advanced Low', numeric: 7, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  { id: 'advanced_mid', label: 'Advanced Mid', numeric: 8, color: 'bg-purple-200 text-purple-800 dark:bg-purple-800/40 dark:text-purple-300' },
  { id: 'advanced_high', label: 'Advanced High', numeric: 9, color: 'bg-purple-300 text-purple-900 dark:bg-purple-700/50 dark:text-purple-200' },
];

const CATEGORY_LABELS: Record<string, string> = {
  'verb_tense': 'Verb Tenses',
  'verb_mood': 'Verb Moods',
  'verb_aspect': 'Verb Aspects',
  'verb_type': 'Verb Types',
  'noun_agreement': 'Noun Agreement',
  'pronoun': 'Pronouns',
  'adjective': 'Adjectives',
  'adverb': 'Adverbs',
  'preposition': 'Prepositions',
  'article': 'Articles',
  'sentence_structure': 'Sentence Structure',
  'clause': 'Clauses',
};

function CompetencyCard({ competency, onPractice }: { competency: GrammarCompetency; onPractice: (id: string) => void }) {
  const level = ACTFL_LEVELS.find(l => l.id === competency.actflLevel);
  
  return (
    <Card className="hover-elevate cursor-pointer" onClick={() => onPractice(competency.id)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{competency.name}</CardTitle>
          {level && (
            <Badge variant="outline" className={level.color}>
              {level.label}
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm line-clamp-2">
          {competency.shortExplanation}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {CATEGORY_LABELS[competency.category] || competency.category}
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            ~{competency.estimatedMinutes} min
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CompetencyDetail({ competency, onBack, onPractice }: { competency: GrammarCompetency; onBack: () => void; onPractice: () => void }) {
  const level = ACTFL_LEVELS.find(l => l.id === competency.actflLevel);
  
  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-2" data-testid="button-back-to-list">
        <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
        Back to Grammar Hub
      </Button>
      
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{competency.name}</CardTitle>
              <CardDescription className="mt-2">{competency.shortExplanation}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {level && (
                <Badge variant="outline" className={level.color}>
                  {level.label}
                </Badge>
              )}
              <Badge variant="secondary">
                {CATEGORY_LABELS[competency.category] || competency.category}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Full Explanation
            </h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{competency.description}</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Examples
            </h4>
            <ul className="space-y-2">
              {competency.examples?.map((example, index) => (
                <li key={index} className="pl-4 border-l-2 border-primary/30 text-muted-foreground">
                  {example}
                </li>
              ))}
            </ul>
          </div>
          
          {competency.commonMistakes && competency.commonMistakes.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <XCircle className="h-4 w-4" />
                Common Mistakes to Avoid
              </h4>
              <ul className="space-y-1">
                {competency.commonMistakes.map((mistake, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Estimated time: {competency.estimatedMinutes} minutes
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Award className="h-4 w-4" />
              Difficulty: {competency.difficultyScore}/10
            </div>
          </div>
          
          <Button onClick={onPractice} className="w-full" size="lg" data-testid="button-start-practice">
            <GraduationCap className="h-5 w-5 mr-2" />
            Practice This Topic
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PracticeMode({ 
  competencyId, 
  language, 
  onComplete 
}: { 
  competencyId: string | null; 
  language: string; 
  onComplete: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  
  const queryKey = competencyId 
    ? `/api/grammar/exercises?language=${language}&competencyId=${competencyId}`
    : `/api/grammar?language=${language}`;
  
  const { data: exercises = [], isLoading } = useQuery<GrammarExerciseType[]>({
    queryKey: [queryKey],
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (exercises.length === 0) {
    return (
      <Card className="p-8 text-center">
        <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No exercises available for this topic yet.</p>
        <Button variant="outline" onClick={onComplete} className="mt-4" data-testid="button-back-no-exercises">
          Back to Grammar Hub
        </Button>
      </Card>
    );
  }
  
  const currentExercise = exercises[currentIndex];
  const progress = ((currentIndex + 1) / exercises.length) * 100;
  const isComplete = currentIndex >= exercises.length;
  const isCorrect = selectedAnswer === currentExercise?.correctAnswer;
  
  const handleSubmit = () => {
    if (selectedAnswer !== null) {
      setShowResult(true);
      setScore(prev => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1
      }));
    }
  };
  
  const handleNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };
  
  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore({ correct: 0, total: 0 });
  };
  
  // Session complete
  if (currentIndex === exercises.length - 1 && showResult) {
    const percentage = Math.round((score.correct / score.total) * 100);
    return (
      <Card className="p-8 text-center">
        <div className="mb-6">
          {percentage >= 80 ? (
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
          ) : percentage >= 60 ? (
            <Award className="h-16 w-16 mx-auto text-amber-500" />
          ) : (
            <Target className="h-16 w-16 mx-auto text-blue-500" />
          )}
        </div>
        <h3 className="text-2xl font-bold mb-2">Practice Complete!</h3>
        <p className="text-4xl font-bold text-primary mb-2">{percentage}%</p>
        <p className="text-muted-foreground mb-6">
          You got {score.correct} out of {score.total} correct
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={handleRestart} data-testid="button-restart-practice">
            <RotateCcw className="h-4 w-4 mr-2" />
            Practice Again
          </Button>
          <Button onClick={onComplete} data-testid="button-finish-practice">
            Back to Grammar Hub
          </Button>
        </div>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onComplete} data-testid="button-exit-practice">
          <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
          Exit Practice
        </Button>
        <div className="text-sm text-muted-foreground">
          Score: {score.correct}/{score.total}
        </div>
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-muted-foreground">Progress</p>
          <p className="text-sm font-medium" data-testid="text-exercise-progress">
            {currentIndex + 1} / {exercises.length}
          </p>
        </div>
        <Progress value={progress} />
      </div>
      
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {currentExercise.exerciseType && (
            <Badge variant="outline" className="capitalize">
              {currentExercise.exerciseType.replace('_', ' ')}
            </Badge>
          )}
          {currentExercise.actflLevel && (
            <Badge variant="secondary" className="capitalize">
              {currentExercise.actflLevel.replace('_', ' ')}
            </Badge>
          )}
        </div>
        
        <h3 className="text-xl font-semibold mb-6" data-testid="text-question">
          {currentExercise.question}
        </h3>
        
        {currentExercise.hint && !showResult && (
          <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg">
            <span className="font-medium">Hint:</span> {currentExercise.hint}
          </p>
        )}
        
        <RadioGroup
          value={selectedAnswer?.toString()}
          onValueChange={(value) => setSelectedAnswer(Number(value))}
          disabled={showResult}
        >
          <div className="space-y-3">
            {currentExercise.options.map((option, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 rounded-lg border p-4 ${
                  showResult && index === currentExercise.correctAnswer
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                    : showResult && index === selectedAnswer
                    ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                    : ""
                }`}
              >
                <RadioGroupItem value={index.toString()} id={`option-${index}`} data-testid={`radio-option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  {option}
                </Label>
                {showResult && index === currentExercise.correctAnswer && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {showResult && index === selectedAnswer && index !== currentExercise.correctAnswer && (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
            ))}
          </div>
        </RadioGroup>
        
        {showResult && (
          <div className={`mt-6 p-4 rounded-lg ${isCorrect ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
            <p className={`font-semibold mb-2 ${isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {isCorrect ? "Correct!" : "Incorrect"}
            </p>
            <p className="text-sm">{currentExercise.explanation}</p>
          </div>
        )}
        
        <div className="mt-6 flex justify-end gap-3">
          {!showResult ? (
            <Button
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
              data-testid="button-check-answer"
            >
              Check Answer
            </Button>
          ) : currentIndex < exercises.length - 1 ? (
            <Button onClick={handleNext} data-testid="button-next-question">
              Next Question
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export default function Grammar() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { learningContext } = useLearningFilter();
  const [selectedCompetency, setSelectedCompetency] = useState<GrammarCompetency | null>(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceCompetencyId, setPracticeCompetencyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("browse");
  
  // Build query with optional classId filter
  const classId = learningContext !== 'self-directed' && learningContext !== 'founder-mode' && learningContext !== 'honesty-mode' && learningContext !== 'all-learning'
    ? learningContext
    : undefined;
  const queryUrl = classId 
    ? `/api/grammar/competencies?language=${language}&classId=${classId}`
    : `/api/grammar/competencies?language=${language}`;
  
  const { data: competencies = [], isLoading: competenciesLoading } = useQuery<GrammarCompetency[]>({
    queryKey: ['/api/grammar/competencies', language, classId],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error('Failed to fetch grammar competencies');
      return res.json();
    },
  });
  
  const groupedByLevel = ACTFL_LEVELS.map(level => ({
    ...level,
    competencies: competencies.filter(c => c.actflLevel === level.id)
  })).filter(group => group.competencies.length > 0);
  
  const handlePractice = (competencyId: string) => {
    setPracticeCompetencyId(competencyId);
    setPracticeMode(true);
    setActiveTab("practice");
  };
  
  const handleQuickPractice = () => {
    setPracticeCompetencyId(null);
    setPracticeMode(true);
    setActiveTab("practice");
  };
  
  const handleExitPractice = () => {
    setPracticeMode(false);
    setPracticeCompetencyId(null);
    setActiveTab("browse");
  };
  
  const handleViewCompetency = (competencyId: string) => {
    const comp = competencies.find(c => c.id === competencyId);
    if (comp) {
      setSelectedCompetency(comp);
    }
  };
  
  // Show competency detail view
  if (selectedCompetency && !practiceMode) {
    return (
      <div className="space-y-6">
        <CompetencyDetail 
          competency={selectedCompetency} 
          onBack={() => setSelectedCompetency(null)}
          onPractice={() => handlePractice(selectedCompetency.id)}
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <img src={holaholaIcon} alt="" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-3xl font-semibold mb-2">Grammar Hub</h1>
            <p className="text-muted-foreground">Master grammar with ACTFL-aligned topics and interactive practice</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LearningContextFilter />
          <Button onClick={handleQuickPractice} data-testid="button-quick-practice">
            <Zap className="h-4 w-4 mr-2" />
            Quick Practice
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse" data-testid="tab-browse">
            <BookOpen className="h-4 w-4 mr-2" />
            Browse Topics
          </TabsTrigger>
          <TabsTrigger value="practice" data-testid="tab-practice">
            <GraduationCap className="h-4 w-4 mr-2" />
            Practice
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="browse" className="mt-6">
          {competenciesLoading ? (
            <div className="flex justify-center items-center min-h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : competencies.length === 0 ? (
            <Card className="p-8 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No grammar topics available for this language yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Try Quick Practice to use general exercises.</p>
            </Card>
          ) : (
            <div className="space-y-8">
              {groupedByLevel.map(group => (
                <div key={group.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className={group.color}>{group.label}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {group.competencies.length} topic{group.competencies.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.competencies.map(competency => (
                      <CompetencyCard 
                        key={competency.id} 
                        competency={competency}
                        onPractice={handleViewCompetency}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="practice" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <PracticeMode 
              competencyId={practiceCompetencyId}
              language={language}
              onComplete={handleExitPractice}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
