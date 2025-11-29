import { useState } from "react";
import { VocabularyFlashcard } from "@/components/VocabularyFlashcard";
import { LearningContextFilter } from "@/components/LearningContextFilter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Vocabulary Practice</h1>
          <p className="text-muted-foreground">Build your vocabulary with interactive flashcards</p>
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
