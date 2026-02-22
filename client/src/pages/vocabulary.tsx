import { useState } from "react";
import { useLocation } from "wouter";
import { VocabularyFlashcard } from "@/components/VocabularyFlashcard";
import { LearningContextFilter } from "@/components/LearningContextFilter";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter, Download, FileSpreadsheet, FileText, Loader2, ArrowLeft } from "lucide-react";
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

      <Card className="p-6 max-w-2xl mx-auto">
        <h3 className="font-semibold mb-3">Spaced Repetition System</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Click on the card to flip and see the translation</li>
          <li>Mark each card as "Correct" or "Incorrect" after reviewing</li>
          <li>Cards you get right will appear less frequently</li>
          <li>Cards you struggle with will be reviewed more often</li>
          <li>Use "Show Due Only" to focus on cards that need review</li>
          <li>The system optimizes your learning schedule automatically</li>
        </ul>
      </Card>
    </div>
  );
}
