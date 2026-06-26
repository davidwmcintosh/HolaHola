import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { VocabularyFlashcard } from "@/components/VocabularyFlashcard";
import { LearningContextFilter } from "@/components/LearningContextFilter";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, Download, FileSpreadsheet, FileText, Loader2, ArrowLeft, Star, Clock, ChevronDown, ChevronRight } from "lucide-react";
import holaholaIcon from "@assets/holaholajustbubblesBackgroundRemoved_1765309702014.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'older';

const timeFilterLabels: Record<TimeFilter, string> = {
  all: 'All Time',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  older: 'Older',
};

interface MasteryWord {
  word: string;
  propName: string;
  attemptsCount: number;
  lastPragmaticScore: number;
  masteredAt: string;
  dueForReview: boolean;
  srs: { nextReviewDate: string; interval: number; correctCount: number } | null;
}

interface MasterySummary {
  totalWords: number;
  dueForReview: number;
  byScene: Record<string, MasteryWord[]>;
  words: MasteryWord[];
}

function SceneMasterySection({ language }: { language: string }) {
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<MasterySummary>({
    queryKey: ['/api/mastery/summary', language],
    queryFn: () =>
      fetch(`/api/mastery/summary?language=${encodeURIComponent(language)}`, {
        credentials: 'include',
      }).then(r => r.json()),
    enabled: !!language,
  });

  const toggleScene = (scene: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(scene)) next.delete(scene);
      else next.add(scene);
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading scene mastery...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalWords === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Scene Mastery
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Words you master during scene practice will appear here, linked to the scenes where you proved them.
          </p>
        </CardContent>
      </Card>
    );
  }

  const scenes = Object.entries(data.byScene);

  return (
    <Card className="max-w-2xl mx-auto" data-testid="card-scene-mastery">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Scene Mastery
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" data-testid="badge-mastery-total">
              {data.totalWords} word{data.totalWords !== 1 ? 's' : ''}
            </Badge>
            {data.dueForReview > 0 && (
              <Badge variant="outline" className="gap-1" data-testid="badge-mastery-due">
                <Clock className="h-3 w-3" />
                {data.dueForReview} due
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Words proven in scene practice — they've been added to your review queue automatically.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {scenes.map(([sceneName, words]) => {
          const isExpanded = expandedScenes.has(sceneName);
          const dueInScene = words.filter(w => w.dueForReview).length;
          return (
            <div key={sceneName} className="rounded-md border" data-testid={`section-scene-${sceneName}`}>
              <button
                onClick={() => toggleScene(sceneName)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover-elevate rounded-md"
                data-testid={`button-toggle-scene-${sceneName}`}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="font-medium">{sceneName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {dueInScene > 0 && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {dueInScene}
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs">{words.length} word{words.length !== 1 ? 's' : ''}</span>
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5">
                  {words.map(w => (
                    <Badge
                      key={w.word}
                      variant={w.dueForReview ? "outline" : "secondary"}
                      className="text-xs"
                      data-testid={`badge-word-${w.word}`}
                    >
                      {w.word}
                      {w.dueForReview && <Clock className="h-2.5 w-2.5 ml-1" />}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function Vocabulary() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [, navigate] = useLocation();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();

  const handleExport = async (format: 'csv' | 'anki') => {
    if (!language) {
      toast({ title: "Select a language first", description: "Please select a language to export vocabulary.", variant: "destructive" });
      return;
    }
    
    setIsExporting(true);
    try {
      const response = await fetch(`/api/vocabulary/export?language=${encodeURIComponent(language)}&format=${format}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const filename = format === 'anki' 
        ? `vocabulary_${language}_anki.txt` 
        : `vocabulary_${language}.csv`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ 
        title: "Export complete", 
        description: `Downloaded ${filename}` 
      });
    } catch (error) {
      toast({ title: "Export failed", description: "Could not export vocabulary.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

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
            <h1 className="text-3xl font-semibold mb-2">Vocabulary Practice</h1>
            <p className="text-muted-foreground">Build your vocabulary with interactive flashcards</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LearningContextFilter />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="dropdown-vocabulary-time-filter">
                <Filter className="h-4 w-4 mr-2" />
                {timeFilterLabels[timeFilter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(timeFilterLabels) as TimeFilter[]).map((filter) => (
                <DropdownMenuItem 
                  key={filter} 
                  onClick={() => setTimeFilter(filter)}
                  data-testid={`menu-item-vocabulary-filter-${filter}`}
                >
                  {timeFilterLabels[filter]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting} data-testid="dropdown-vocabulary-export">
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => handleExport('csv')}
                data-testid="menu-item-export-csv"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleExport('anki')}
                data-testid="menu-item-export-anki"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export for Anki
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <VocabularyFlashcard timeFilter={timeFilter} />
      </div>

      {language && <SceneMasterySection language={language} />}

      <Card className="p-6 max-w-2xl mx-auto">
        <h3 className="font-semibold mb-3">Spaced Repetition System</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Click on the card to flip and see the translation</li>
          <li>Mark each card as "Correct" or "Incorrect" after reviewing</li>
          <li>Cards you get right will appear less frequently</li>
          <li>Cards you struggle with will be reviewed more often</li>
          <li>Use "Show Due Only" to focus on cards that need review</li>
          <li>Words mastered in scenes are automatically added to your queue</li>
        </ul>
      </Card>
    </div>
  );
}
