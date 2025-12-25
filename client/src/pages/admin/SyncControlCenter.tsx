import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  GitBranch, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Server,
  Database,
  Zap,
  RotateCcw
} from "lucide-react";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface SyncRun {
  id: string;
  direction: 'push' | 'pull' | 'full';
  status: 'running' | 'completed' | 'failed' | 'partial';
  peerUrl: string;
  sourceEnvironment: string;
  targetEnvironment: string;
  triggeredBy?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  recordsSynced?: number;
  errorMessage?: string;
  lastCompletedPage?: number;
  totalPages?: number;
}

interface SyncStatus {
  currentEnvironment: string;
  configured: boolean;
  peerUrl?: string;
  lastPush?: SyncRun;
  lastPull?: SyncRun;
  recentRuns: SyncRun[];
  peerNightlyStatus?: {
    lastNightlySync: SyncRun | null;
    nextSyncTime: string | null;
    environment: string;
  };
}

interface PeerStats {
  environment: string;
  counts: {
    danielaGrowthMemories: number;
    hiveSnapshots: number;
    collaborationMessages: number;
    users: number;
    tutorVoices: number;
  };
  queriedAt: string;
}

interface LocalStats {
  users: number;
  hiveSnapshots: number;
  tutorVoices: number;
}

interface CapabilityComparison {
  local: {
    version: string;
    supportedBatches: string[];
    features: Record<string, boolean>;
    environment: string;
    queriedAt: string;
  };
  peer: {
    version: string;
    supportedBatches: string[];
    features: Record<string, boolean>;
    environment: string;
    queriedAt: string;
  } | null;
  mismatches: {
    localOnly: string[];
    peerOnly: string[];
    versionMatch: boolean;
  };
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: any }> = {
    running: { color: 'bg-blue-500', icon: RefreshCw },
    completed: { color: 'bg-green-500', icon: CheckCircle2 },
    failed: { color: 'bg-red-500', icon: XCircle },
    partial: { color: 'bg-yellow-500', icon: AlertTriangle },
  };
  
  const { color, icon: Icon } = variants[status] || variants.failed;
  
  return (
    <Badge className={`${color} text-white gap-1`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status}
    </Badge>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const icons: Record<string, any> = {
    push: ArrowUpRight,
    pull: ArrowDownLeft,
    full: GitBranch,
  };
  const Icon = icons[direction] || GitBranch;
  
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="h-3 w-3" />
      {direction}
    </Badge>
  );
}

export default function SyncControlCenter() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ["/api/admin/sync/status"],
    refetchInterval: 5000,
  });

  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useQuery<{ syncRuns: SyncRun[] }>({
    queryKey: ["/api/admin/sync/history"],
  });

  const { data: peerStats, isLoading: peerStatsLoading, refetch: refetchPeerStats } = useQuery<PeerStats>({
    queryKey: ["/api/admin/sync/peer-stats"],
    retry: false,
  });

  const { data: localStats, isLoading: localStatsLoading, refetch: refetchLocalStats } = useQuery<LocalStats>({
    queryKey: ["/api/admin/sync/local-stats"],
  });

  const { data: capabilities, isLoading: capabilitiesLoading, refetch: refetchCapabilities } = useQuery<CapabilityComparison>({
    queryKey: ["/api/admin/sync/capabilities"],
    retry: false,
  });

  const pushMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync/push"),
    onSuccess: () => {
      toast({ title: "Push Started", description: "Pushing data to peer environment..." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/history"] });
    },
    onError: (err: any) => {
      toast({ title: "Push Failed", description: err.message, variant: "destructive" });
    }
  });

  const pullMutation = useMutation({
    mutationFn: (forceResume: boolean = false) => 
      apiRequest("POST", "/api/admin/sync/pull", { forceResume }),
    onSuccess: () => {
      toast({ title: "Pull Started", description: "Pulling data from peer environment..." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/history"] });
    },
    onError: (err: any) => {
      toast({ title: "Pull Failed", description: err.message, variant: "destructive" });
    }
  });

  const fullSyncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync/full"),
    onSuccess: () => {
      toast({ title: "Full Sync Started", description: "Running bidirectional sync..." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/history"] });
    },
    onError: (err: any) => {
      toast({ title: "Full Sync Failed", description: err.message, variant: "destructive" });
    }
  });

  const forceResetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync/force-reset"),
    onSuccess: (data: any) => {
      toast({ title: "Reset Complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/history"] });
    },
    onError: (err: any) => {
      toast({ title: "Reset Failed", description: err.message, variant: "destructive" });
    }
  });

  const triggerPeerPullMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync/trigger-peer-pull"),
    onSuccess: (data: any) => {
      toast({ title: "Peer Pull Triggered", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Trigger Failed", description: err.message, variant: "destructive" });
    }
  });

  const triggerPeerResetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync/trigger-peer-reset"),
    onSuccess: (data: any) => {
      toast({ title: "Peer Reset Complete", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Peer Reset Failed", description: err.message, variant: "destructive" });
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStatus(), refetchHistory(), refetchPeerStats(), refetchLocalStats(), refetchCapabilities()]);
    setIsRefreshing(false);
  };

  // Find active sync run from recent runs
  const activeSyncRun = status?.recentRuns?.find(r => r.status === 'running');
  
  const isAnySyncRunning = activeSyncRun?.status === 'running' || 
    pushMutation.isPending || pullMutation.isPending || fullSyncMutation.isPending;

  const currentEnv = status?.currentEnvironment || 'unknown';
  const peerEnv = currentEnv === 'production' ? 'development' : 'production';

  return (
    <RoleGuard allowedRoles={['founder']}>
      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Sync Control Center</h1>
                <p className="text-muted-foreground">
                  Manage dev-prod synchronization
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {statusLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : !status?.configured ? (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Sync Not Configured</h3>
                <p className="text-muted-foreground">
                  Set SYNC_PEER_URL and SYNC_SHARED_SECRET to enable synchronization.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      Current Environment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {currentEnv.toUpperCase()}
                      </Badge>
                      {activeSyncRun && (
                        <StatusBadge status={activeSyncRun.status} />
                      )}
                    </div>
                    {localStatsLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : localStats ? (
                      <div className="text-sm text-muted-foreground">
                        <p>{localStats.users} users, {localStats.hiveSnapshots} snapshots</p>
                        <p>{localStats.tutorVoices} voices</p>
                      </div>
                    ) : null}
                    {activeSyncRun?.status === 'running' && (
                      <div className="mt-3 text-sm text-muted-foreground">
                        <p>Active: {activeSyncRun.direction} sync</p>
                        {activeSyncRun.lastCompletedPage !== undefined && (
                          <p>Progress: Page {activeSyncRun.lastCompletedPage + 1} / {activeSyncRun.totalPages || '?'}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Peer Environment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline" className="text-lg px-3 py-1 mb-3">
                      {peerEnv.toUpperCase()}
                    </Badge>
                    {peerStatsLoading ? (
                      <Skeleton className="h-4 w-32" />
                    ) : peerStats ? (
                      <div className="text-sm text-muted-foreground">
                        <p>{peerStats.counts.users} users, {peerStats.counts.hiveSnapshots} snapshots</p>
                        <p>{peerStats.counts.tutorVoices || 0} voices</p>
                        <p className="text-xs">Last checked: {formatDate(peerStats.queriedAt)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Unable to reach peer</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Version Compatibility Status */}
              {capabilities && (
                <Card className={capabilities.mismatches.versionMatch ? "border-green-500/50" : "border-yellow-500/50"}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {capabilities.mismatches.versionMatch ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className="text-sm font-medium">
                          {capabilities.mismatches.versionMatch ? "Versions Match" : "Version Mismatch"}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Local: <code className="bg-muted px-1 rounded">{capabilities.local.version.split('-').slice(-2).join('-')}</code></span>
                        {capabilities.peer && (
                          <span>Peer: <code className="bg-muted px-1 rounded">{capabilities.peer.version.split('-').slice(-2).join('-')}</code></span>
                        )}
                      </div>
                    </div>
                    {(capabilities.mismatches.localOnly.length > 0 || capabilities.mismatches.peerOnly.length > 0) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {capabilities.mismatches.localOnly.length > 0 && (
                          <p className="text-yellow-600">Local-only batches: {capabilities.mismatches.localOnly.join(', ')}</p>
                        )}
                        {capabilities.mismatches.peerOnly.length > 0 && (
                          <p className="text-blue-600">Peer-only batches: {capabilities.mismatches.peerOnly.join(', ')}</p>
                        )}
                      </div>
                    )}
                    {!capabilities.mismatches.versionMatch && (
                      <div className="mt-3 p-2 bg-yellow-500/10 rounded text-xs">
                        <p className="font-medium text-yellow-700 dark:text-yellow-400">Deploy + Sync Workflow:</p>
                        <ol className="list-decimal list-inside mt-1 text-muted-foreground space-y-1">
                          <li>Deploy code changes to peer environment first</li>
                          <li>Refresh this page to verify versions match</li>
                          <li>Run sync - both environments will handle all data types</li>
                        </ol>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Sync Actions
                  </CardTitle>
                  <CardDescription>
                    Trigger synchronization between {currentEnv} and {peerEnv}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Button
                      onClick={() => pushMutation.mutate()}
                      disabled={isAnySyncRunning}
                      className="h-auto py-4 flex-col gap-2"
                      data-testid="button-push"
                    >
                      <ArrowUpRight className="h-6 w-6" />
                      <span>Push to {peerEnv}</span>
                      <span className="text-xs opacity-70">Send local data</span>
                    </Button>

                    <Button
                      onClick={() => pullMutation.mutate(false)}
                      disabled={isAnySyncRunning}
                      variant="secondary"
                      className="h-auto py-4 flex-col gap-2"
                      data-testid="button-pull"
                    >
                      <ArrowDownLeft className="h-6 w-6" />
                      <span>Pull from {peerEnv}</span>
                      <span className="text-xs opacity-70">Get remote data</span>
                    </Button>

                    <Button
                      onClick={() => fullSyncMutation.mutate()}
                      disabled={isAnySyncRunning}
                      variant="outline"
                      className="h-auto py-4 flex-col gap-2"
                      data-testid="button-full-sync"
                    >
                      <GitBranch className="h-6 w-6" />
                      <span>Full Sync</span>
                      <span className="text-xs opacity-70">Bidirectional</span>
                    </Button>

                    <Button
                      onClick={() => triggerPeerPullMutation.mutate()}
                      disabled={isAnySyncRunning || triggerPeerPullMutation.isPending}
                      variant="outline"
                      className="h-auto py-4 flex-col gap-2"
                      data-testid="button-trigger-peer-pull"
                    >
                      <Server className="h-6 w-6" />
                      <span>Trigger Peer Pull</span>
                      <span className="text-xs opacity-70">Make {peerEnv} pull from here</span>
                    </Button>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button
                      onClick={() => forceResetMutation.mutate()}
                      disabled={forceResetMutation.isPending}
                      variant="destructive"
                      size="sm"
                      data-testid="button-force-reset"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Stuck Syncs (Local)
                    </Button>
                    <Button
                      onClick={() => triggerPeerResetMutation.mutate()}
                      disabled={triggerPeerResetMutation.isPending}
                      variant="outline"
                      size="sm"
                      data-testid="button-peer-reset"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Stuck Syncs (Peer)
                    </Button>
                    {activeSyncRun?.status === 'running' && (
                      <Button
                        onClick={() => pullMutation.mutate(true)}
                        disabled={pullMutation.isPending}
                        variant="outline"
                        size="sm"
                        data-testid="button-force-resume"
                      >
                        Force Resume
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Sync History
                  </CardTitle>
                  <CardDescription>Recent synchronization runs</CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12" />
                      ))}
                    </div>
                  ) : !history?.syncRuns?.length ? (
                    <p className="text-center text-muted-foreground py-4">No sync history yet</p>
                  ) : (
                    <div className="space-y-2">
                      {history.syncRuns.slice(0, 10).map((run) => (
                        <div 
                          key={run.id} 
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <StatusBadge status={run.status} />
                          <DirectionBadge direction={run.direction} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {run.sourceEnvironment} → {run.targetEnvironment}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(run.startedAt)}
                              {run.triggeredBy && ` • by ${run.triggeredBy}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">{formatDuration(run.durationMs)}</p>
                            {run.recordsSynced !== undefined && (
                              <p className="text-xs text-muted-foreground">{run.recordsSynced} records</p>
                            )}
                          </div>
                          {run.status === 'failed' && run.errorMessage && (
                            <span title={run.errorMessage}>
                              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
