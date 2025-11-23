import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Award, Brain, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CanDoStatement {
  language: string;
  actflLevel: string;
  category: 'interpersonal' | 'interpretive' | 'presentational';
  statement: string;
  examples?: string[];
}

// Convert internal format to display format
function formatActflLevel(level: string): string {
  return level
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Generate stable statement ID (not dependent on array index)
function generateStatementId(stmt: CanDoStatement): string {
  // Use a hash of the statement text for consistency across views
  // Simple hash function for stable IDs
  const hash = stmt.statement.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `${stmt.language}-${stmt.actflLevel}-${stmt.category}-${Math.abs(hash)}`;
}

export default function CanDoProgress() {
  const { user } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // TODO: Fetch user progress from API (studentCanDoProgress)
  // For now, using local state for self-assessment tracking
  const [userProgress, setUserProgress] = useState<Set<string>>(new Set());

  const targetLanguage = user?.targetLanguage || 'spanish';
  const userActflLevel = user?.actflLevel || 'novice_low';

  // Fetch available ACTFL levels for the target language
  const { data: levelsData } = useQuery<{ language: string; levels: string[] }>({
    queryKey: [`/api/actfl/levels/${targetLanguage}`],
  });

  // Fetch Can-Do statements based on filters
  const queryParams = new URLSearchParams({
    language: targetLanguage,
    ...(selectedLevel !== 'all' && { level: selectedLevel }),
    ...(selectedCategory !== 'all' && { category: selectedCategory }),
  });

  const { data: statementsData, isLoading } = useQuery<{
    language: string;
    level: string;
    category: string;
    statements: CanDoStatement[];
    count: number;
  }>({
    queryKey: [`/api/actfl/can-do-statements?${queryParams.toString()}`],
  });

  const statements = statementsData?.statements || [];
  
  // Handle checkbox toggle
  const handleToggleProgress = (statementKey: string) => {
    setUserProgress(prev => {
      const newProgress = new Set(prev);
      if (newProgress.has(statementKey)) {
        newProgress.delete(statementKey);
        console.log('[CAN-DO] Unchecked:', statementKey);
      } else {
        newProgress.add(statementKey);
        console.log('[CAN-DO] Checked:', statementKey);
      }
      // TODO: Persist to backend API
      return newProgress;
    });
  };

  // Group statements by proficiency level
  const statementsByLevel = statements.reduce((acc, stmt) => {
    const level = stmt.actflLevel;
    if (!acc[level]) {
      acc[level] = [];
    }
    acc[level].push(stmt);
    return acc;
  }, {} as Record<string, CanDoStatement[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-can-do-progress">ACTFL Can-Do Statements</h1>
        <p className="text-muted-foreground mt-2">
          Track your language proficiency progress across all ACTFL levels
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Statements</CardTitle>
          <CardDescription>
            View Can-Do statements for specific proficiency levels and communication modes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Proficiency Level</label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger data-testid="select-proficiency-level">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {levelsData?.levels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Communication Mode</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-communication-mode">
                  <SelectValue placeholder="All modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="interpersonal">Interpersonal</SelectItem>
                  <SelectItem value="interpretive">Interpretive</SelectItem>
                  <SelectItem value="presentational">Presentational</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedLevel !== 'all' || selectedCategory !== 'all' ? (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedLevel('all');
                    setSelectedCategory('all');
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Current Level Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="default" className="text-sm py-1 px-3">
          Your Current Level: {formatActflLevel(userActflLevel)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          ({statements.length} statement{statements.length !== 1 ? 's' : ''} showing)
        </span>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-start gap-3">
                      <Skeleton className="h-5 w-5 rounded" />
                      <Skeleton className="h-5 flex-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Statements grouped by level */}
      {!isLoading && Object.keys(statementsByLevel).length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No Can-Do statements found for the selected filters.
          </CardContent>
        </Card>
      )}

      {!isLoading && Object.keys(statementsByLevel).map((level) => (
        <Card key={level}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {formatActflLevel(level)}
              {level === userActflLevel && (
                <Badge variant="secondary" className="text-xs">Current Level</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" data-testid={`tab-all-${level}`}>
                  All ({statementsByLevel[level].length})
                </TabsTrigger>
                <TabsTrigger value="interpersonal" data-testid={`tab-interpersonal-${level}`}>
                  Interpersonal ({statementsByLevel[level].filter(s => s.category === 'interpersonal').length})
                </TabsTrigger>
                <TabsTrigger value="interpretive" data-testid={`tab-interpretive-${level}`}>
                  Interpretive ({statementsByLevel[level].filter(s => s.category === 'interpretive').length})
                </TabsTrigger>
                <TabsTrigger value="presentational" data-testid={`tab-presentational-${level}`}>
                  Presentational ({statementsByLevel[level].filter(s => s.category === 'presentational').length})
                </TabsTrigger>
              </TabsList>

              {['all', 'interpersonal', 'interpretive', 'presentational'].map((category) => {
                const categoryStatements = category === 'all'
                  ? statementsByLevel[level]
                  : statementsByLevel[level].filter(s => s.category === category);

                return (
                  <TabsContent key={category} value={category} className="space-y-3 mt-4">
                    {categoryStatements.map((stmt) => {
                      const statementKey = generateStatementId(stmt);
                      const isAchieved = userProgress.has(statementKey);

                      return (
                        <div
                          key={statementKey}
                          className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate"
                          data-testid={`statement-${statementKey}`}
                        >
                          <Checkbox
                            id={statementKey}
                            checked={isAchieved}
                            onCheckedChange={() => handleToggleProgress(statementKey)}
                            className="mt-0.5"
                            data-testid={`checkbox-${statementKey}`}
                          />
                          <div className="flex-1 space-y-1">
                            <label
                              htmlFor={statementKey}
                              className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {stmt.statement}
                            </label>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {stmt.category}
                              </Badge>
                              {/* Progress indicators (TODO: Connect to real data) */}
                              {isAchieved && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <User className="w-3 h-3" />
                                    Self-assessed
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                          {isAchieved ? (
                            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      ))}

      {/* Progress Summary */}
      {!isLoading && statements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{userProgress.size}</div>
                <div className="text-sm text-muted-foreground">Total Achieved</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {statements.length > 0 
                    ? Math.round((userProgress.size / statements.length) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-muted-foreground">Completion Rate</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{statements.length - userProgress.size}</div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
