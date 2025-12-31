import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Mic, AlertCircle, Users, Server, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface SystemHealthData {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  voice: {
    provider: 'cartesia' | 'google';
    state: 'healthy' | 'degraded' | 'fallback' | 'restoring';
    inFallback: boolean;
    avgLatencyMs: number | null;
    failureRate: number;
    totalEvents: number;
    recentFailures: number;
  };
  sessions: {
    active: number;
  };
  sofiaIssues: {
    pending: number;
    actionable: number;
    recentHour: number;
    needsAttention: boolean;
  };
  environment: string;
}

function StatusIndicator({ status }: { status: 'healthy' | 'degraded' | 'critical' }) {
  if (status === 'healthy') {
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  } else if (status === 'degraded') {
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  } else {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function HealthCard({ 
  title, 
  icon: Icon, 
  children, 
  status 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  status?: 'healthy' | 'degraded' | 'critical';
}) {
  const borderClass = status === 'critical' ? 'border-red-500/50' : 
                      status === 'degraded' ? 'border-yellow-500/50' : 
                      'border-border';
  
  return (
    <Card className={`${borderClass}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          {status && <StatusIndicator status={status} />}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function LatencyGauge({ value, label }: { value: number | null; label: string }) {
  const getColor = (ms: number | null) => {
    if (ms === null) return 'text-muted-foreground';
    if (ms < 300) return 'text-green-500';
    if (ms < 600) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  return (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-bold ${getColor(value)}`}>
        {value !== null ? `${value}ms` : '--'}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function SystemHealthDashboard() {
  const { data: health, isLoading, error } = useQuery<SystemHealthData>({
    queryKey: ['/api/admin/system-health'],
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !health) {
    return (
      <Card className="mb-6 border-red-500/50">
        <CardContent className="p-4 flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Unable to load system health</span>
        </CardContent>
      </Card>
    );
  }

  const voiceStatus: 'healthy' | 'degraded' | 'critical' = 
    health.voice.state === 'healthy' ? 'healthy' :
    health.voice.state === 'fallback' || health.voice.failureRate > 20 ? 'critical' : 'degraded';

  const issueStatus: 'healthy' | 'degraded' | 'critical' =
    health.sofiaIssues.pending > 5 ? 'critical' :
    health.sofiaIssues.needsAttention ? 'degraded' : 'healthy';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">System Health</span>
          <Badge 
            variant={health.overallStatus === 'healthy' ? 'default' : 
                    health.overallStatus === 'degraded' ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {health.overallStatus.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {health.environment}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          Updated: {new Date(health.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <HealthCard title="Voice Pipeline" icon={Mic} status={voiceStatus}>
          <div className="flex items-center justify-between">
            <LatencyGauge value={health.voice.avgLatencyMs} label="Avg Latency" />
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <Badge variant={health.voice.provider === 'cartesia' ? 'default' : 'secondary'} className="text-xs">
                  {health.voice.provider}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">
                {health.voice.failureRate}% failure
              </span>
            </div>
          </div>
        </HealthCard>

        <HealthCard title="Active Sessions" icon={Users}>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{health.sessions.active}</span>
            <span className="text-xs text-muted-foreground">voice chats</span>
          </div>
        </HealthCard>

        <HealthCard title="Sofia Issues" icon={AlertCircle} status={issueStatus}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold">{health.sofiaIssues.pending}</span>
              <span className="text-xs text-muted-foreground ml-1">pending</span>
            </div>
            <div className="text-right">
              {health.sofiaIssues.actionable > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {health.sofiaIssues.actionable} actionable
                </Badge>
              )}
              {health.sofiaIssues.recentHour > 0 && (
                <span className="text-xs text-muted-foreground block mt-1">
                  {health.sofiaIssues.recentHour} in last hour
                </span>
              )}
            </div>
          </div>
        </HealthCard>

        <HealthCard title="System Status" icon={Activity}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIndicator status={health.overallStatus} />
              <span className="text-sm font-medium capitalize">{health.overallStatus}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">
                {health.voice.totalEvents} events
              </span>
            </div>
          </div>
        </HealthCard>
      </div>
    </div>
  );
}
