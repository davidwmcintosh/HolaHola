import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, MessageSquare, Globe, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useUsage } from "@/contexts/UsageContext";
import { Progress } from "@/components/ui/progress";

interface VoiceSession {
  id: string;
  userId: string;
  conversationId: string | null;
  classId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  exchangeCount: number | null;
  status: string;
  language?: string;
}

interface SessionsResponse {
  sessions: VoiceSession[];
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0m";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'active':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'failed':
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'active':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatLanguage(lang: string | undefined): string {
  if (!lang) return '';
  return lang.charAt(0).toUpperCase() + lang.slice(1);
}

interface UsageOverviewProps {
  compact?: boolean;
}

export function UsageOverview({ compact = false }: UsageOverviewProps) {
  const { balance, formatRemainingTime, warningLevel, isLoading } = useUsage();
  
  if (isLoading) {
    return (
      <Card data-testid="card-usage-overview">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!balance) return null;
  
  const usedHours = Math.floor(balance.usedSeconds / 3600);
  const usedMinutes = Math.floor((balance.usedSeconds % 3600) / 60);
  const totalHours = Math.floor(balance.totalSeconds / 3600);
  
  const warningColors = {
    none: 'bg-primary',
    low: 'bg-yellow-500',
    critical: 'bg-orange-500',
    exhausted: 'bg-red-500'
  };
  
  if (compact) {
    return (
      <div className="space-y-2" data-testid="usage-overview-compact">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Time Remaining</span>
          <span className="font-medium">{formatRemainingTime()}</span>
        </div>
        <Progress 
          value={balance.percentRemaining} 
          className="h-2"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{usedHours}h {usedMinutes}m used</span>
          <span>{totalHours}h total</span>
        </div>
      </div>
    );
  }
  
  return (
    <Card data-testid="card-usage-overview">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Tutoring Hours Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-primary" data-testid="text-remaining-time">
            {formatRemainingTime()}
          </div>
          <p className="text-sm text-muted-foreground mt-1">remaining</p>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Used: {usedHours}h {usedMinutes}m</span>
            <span>Total: {totalHours}h</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${warningColors[warningLevel]}`}
              style={{ width: `${balance.percentRemaining}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {balance.percentUsed.toFixed(1)}% of your hours used
          </p>
        </div>
        
        {(balance.classAllocationSeconds > 0 || balance.purchasedSeconds > 0) && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Hour Sources</p>
            {balance.classAllocationSeconds > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Class allocation</span>
                <span>{Math.floor(balance.classAllocationSeconds / 3600)}h</span>
              </div>
            )}
            {balance.purchasedSeconds > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Purchased</span>
                <span>{Math.floor(balance.purchasedSeconds / 3600)}h</span>
              </div>
            )}
            {balance.bonusSeconds > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bonus</span>
                <span>{Math.floor(balance.bonusSeconds / 3600)}h</span>
              </div>
            )}
          </div>
        )}
        
        {warningLevel !== 'none' && (
          <div className={`p-3 rounded-lg text-sm ${
            warningLevel === 'exhausted' 
              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              : warningLevel === 'critical'
              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>
            {warningLevel === 'exhausted' && 'Your tutoring hours are exhausted. Purchase more to continue.'}
            {warningLevel === 'critical' && 'Less than 5 minutes remaining. Consider purchasing more hours.'}
            {warningLevel === 'low' && 'Your tutoring hours are running low. Plan accordingly.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SessionHistoryProps {
  limit?: number;
  showHeader?: boolean;
}

export function SessionHistory({ limit = 10, showHeader = true }: SessionHistoryProps) {
  const { data, isLoading } = useQuery<SessionsResponse>({
    queryKey: [`/api/usage/sessions?limit=${limit}`],
  });
  
  if (isLoading) {
    return (
      <Card data-testid="card-session-history">
        {showHeader && (
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const sessions = data?.sessions || [];
  
  if (sessions.length === 0) {
    return (
      <Card data-testid="card-session-history">
        {showHeader && (
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No voice sessions yet</p>
            <p className="text-sm mt-1">Start a conversation to begin practicing!</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card data-testid="card-session-history">
      {showHeader && (
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="divide-y">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="p-4 hover-elevate transition-colors"
                data-testid={`session-item-${session.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(session.status)}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {session.startedAt 
                            ? format(new Date(session.startedAt), 'MMM d, h:mm a')
                            : 'Unknown time'
                          }
                        </span>
                        {session.language && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Globe className="h-3 w-3" />
                            {formatLanguage(session.language)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(session.durationSeconds)}
                        </span>
                        {session.exchangeCount !== null && session.exchangeCount > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {session.exchangeCount} exchanges
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge className={`text-xs ${getStatusColor(session.status)}`} variant="secondary">
                    {session.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function UsageStats() {
  const { status, isLoading } = useUsage();
  
  if (isLoading || !status) return null;
  
  const totalSessions = status.recentSessions?.length || 0;
  const completedSessions = status.recentSessions?.filter(s => s.status === 'completed').length || 0;
  const totalMinutes = Math.floor((status.balance?.usedSeconds || 0) / 60);
  
  return (
    <div className="grid grid-cols-3 gap-4" data-testid="usage-stats">
      <div className="text-center p-3 rounded-lg bg-muted/50">
        <div className="text-2xl font-bold text-primary">{totalSessions}</div>
        <div className="text-xs text-muted-foreground">Total Sessions</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50">
        <div className="text-2xl font-bold text-green-600">{completedSessions}</div>
        <div className="text-xs text-muted-foreground">Completed</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50">
        <div className="text-2xl font-bold text-blue-600">{totalMinutes}m</div>
        <div className="text-xs text-muted-foreground">Time Used</div>
      </div>
    </div>
  );
}
