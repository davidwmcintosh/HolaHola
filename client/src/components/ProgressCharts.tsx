import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import type { ProgressHistory } from "@shared/schema";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Clock, MessageSquare } from "lucide-react";

export function ProgressCharts() {
  const { language } = useLanguage();

  const { data: history = [], isLoading } = useQuery<ProgressHistory[]>({
    queryKey: ["/api/progress-history", language],
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-[200px] bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Convert cumulative values to daily deltas for visualization
  const chartData = history.map((h, index) => {
    if (index === 0) {
      // First day - show cumulative as delta
      return {
        date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        words: h.wordsLearned,
        minutes: h.practiceMinutes,
        conversations: h.conversationsCount,
      };
    }
    
    // Calculate delta from previous day for ALL cumulative metrics
    const prev = history[index - 1];
    return {
      date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      words: Math.max(0, h.wordsLearned - prev.wordsLearned),
      minutes: Math.max(0, h.practiceMinutes - prev.practiceMinutes),
      conversations: Math.max(0, h.conversationsCount - prev.conversationsCount),
    };
  });

  // Display latest cumulative totals from most recent snapshot
  const latestSnapshot = history.length > 0 ? history[history.length - 1] : null;
  const totalWords = latestSnapshot?.wordsLearned ?? 0;
  const totalMinutes = latestSnapshot?.practiceMinutes ?? 0;
  const totalConversations = latestSnapshot?.conversationsCount ?? 0;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Vocabulary Growth Chart */}
      <Card data-testid="card-vocabulary-chart">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Vocabulary Growth</CardTitle>
              <CardDescription>Words learned over time</CardDescription>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <>
              <div className="mb-4">
                <div className="text-3xl font-bold" data-testid="text-total-words">{totalWords}</div>
                <div className="text-xs text-muted-foreground">Total words</div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="words" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No data yet. Start practicing to see your progress!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Practice Time Chart */}
      <Card data-testid="card-practice-chart">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Practice Time</CardTitle>
              <CardDescription>Daily practice minutes</CardDescription>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <>
              <div className="mb-4">
                <div className="text-3xl font-bold" data-testid="text-total-minutes">{totalMinutes}</div>
                <div className="text-xs text-muted-foreground">Total minutes</div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar 
                    dataKey="minutes" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No data yet. Start practicing to see your progress!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Activity Chart */}
      <Card data-testid="card-conversation-chart">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Conversation Activity</CardTitle>
              <CardDescription>Daily conversations</CardDescription>
            </div>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <>
              <div className="mb-4">
                <div className="text-3xl font-bold" data-testid="text-total-conversations">{totalConversations}</div>
                <div className="text-xs text-muted-foreground">Total conversations</div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conversations" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorConversations)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No data yet. Start practicing to see your progress!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
