import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
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
  RotateCcw,
  Activity
} from "lucide-react";
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
  _fromEnvironment?: string;
  // v33: Session grouping for paginated runs
  syncSessionId?: string;
  pageNumber?: number;
}

interface PeerSyncRunsResponse {
  environment: string;
  syncRuns: SyncRun[];
  queriedAt: string;
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

interface SyncHealthBatch {
  batchId: string;
  label: string;
  lastSuccessfulPush: string | null;
  lastSuccessfulPull: string | null;
  lastReceivedImport: string | null; // v32: When peer pushed to us
  daysSinceLastPush: number | null;
  daysSinceLastPull: number | null;
  daysSinceLastData: number | null; // v32: Combined (most recent of pull or import)
  pushStatus: 'healthy' | 'stale' | 'critical' | 'never';
  pullStatus: 'healthy' | 'stale' | 'critical' | 'never';
  dataStatus: 'healthy' | 'stale' | 'critical' | 'never'; // v32: Overall data freshness
}

interface SyncHealth {
  environment: string;
  batches: SyncHealthBatch[];
  queriedAt: string;
}

interface PendingSyncTable {
  tableName: string;
  displayName: string;
  localCount: number;
  approvedCount: number;
}

interface PendingSyncData {
  tables: PendingSyncTable[];
  totalPending: number;
}

interface SyncVerification {
  batchType: string;
  success: boolean;
  expectedCounts: Record<string, number>;
  peerCounts: Record<string, number>;
  discrepancies: string[];
  verifiedAt: string;
}

interface SyncVerificationsData {
  verifications: SyncVerification[];
  queriedAt: string;
}

// v32: Enhanced health with received imports
interface EnhancedSyncHealthBatch {
  batchId: string;
  label: string;
  lastLocalPush: string | null;
  lastLocalPull: string | null;
  lastReceivedImport: string | null;
  lastActivity: string | null;
  daysSinceLastActivity: number | null;
  status: 'healthy' | 'stale' | 'critical' | 'never';
  recordsInLastSync: number;
}

interface EnhancedSyncHealth {
  environment: string;
  batches: EnhancedSyncHealthBatch[];
  anomalyCount: number;
  queriedAt: string;
}

// v32: Sync anomalies
interface SyncAnomaly {
  id: string;
  type: 'zero-count-success' | 'stale-batch' | 'failed-sync' | 'missing-receipt' | 'checksum-mismatch';
  severity: 'warning' | 'critical';
  batchId?: string;
  syncRunId?: string;
  message: string;
  metadata?: Record<string, any>;
  acknowledged: boolean;
  createdAt: string;
}

interface SyncAnomaliesData {
  anomalies: SyncAnomaly[];
  queriedAt: string;
}

// v33: Environment comparison for comprehensive table counts
interface EnvironmentComparisonRow {
  table: string;
  localCount: number;
  peerCount: number;
  difference: number;
  status: 'match' | 'local-ahead' | 'peer-ahead' | 'error';
}

interface EnvironmentComparison {
  localEnvironment: string;
  peerEnvironment: string;
  comparison: EnvironmentComparisonRow[];
  errors: string[];
  comparedAt: string;
}

// v37: Resumable sync status
interface ResumableStatus {
  hasResumable: boolean;
  resumableRun: SyncRun | null;
  resumeInfo: {
    completedBatches: string[];
    lastCompletedPage: number;
    totalPagesExpected: number | null;
    startedAt: string;
    status: string;
    errorMessage: string | null;
  } | null;
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
    running: { color: 'bg-yellow-500', icon: RefreshCw },
    success: { color: 'bg-green-600', icon: CheckCircle2 },
    completed: { color: 'bg-green-600', icon: CheckCircle2 },
    failed: { color: 'bg-red-600', icon: XCircle },
    partial: { color: 'bg-orange-600', icon: AlertTriangle },
  };
  
  const { color, icon: Icon } = variants[status] || variants.failed;
  
  return (
    <Badge className={`${color} text-white gap-1 font-semibold`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status.toUpperCase()}
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

function EnvironmentSourceBadge({ environment }: { environment?: string }) {
  if (!environment) return null;
  
  const isProd = environment === 'production';
  
  return (
    <Badge 
      variant="outline" 
      className={`gap-1 text-xs ${isProd ? 'border-orange-500 text-orange-600 dark:text-orange-400' : 'border-blue-500 text-blue-600 dark:text-blue-400'}`}
    >
      <Server className="h-2.5 w-2.5" />
      {isProd ? 'prod' : 'dev'}
    </Badge>
  );
}

// Available sync batch types for selective sync (dev → prod push)
const PUSH_BATCHES = [
  { id: 'neural-core', label: 'Neural Core', description: 'Best practices, idioms, nuances' },
  { id: 'advanced-intel-a', label: 'Advanced Intel A', description: 'Learning insights, Daniela suggestions' },
  { id: 'advanced-intel-b', label: 'Advanced Intel B', description: 'TriLane, North Star' },
  { id: 'express-lane', label: 'Express Lane', description: 'Founder collaboration' },
  { id: 'hive-snapshots', label: 'Hive Snapshots', description: 'Context snapshots' },
  { id: 'daniela-memories', label: 'Daniela Memories', description: 'Daniela growth memories' },
  { id: 'product-config', label: 'Product Config', description: 'Tutor voices' },
  { id: 'beta-testers', label: 'Beta Testers', description: 'Beta users + credits' },
  { id: 'beta-usage', label: 'Beta Usage', description: 'Voice sessions, usage data' },
  { id: 'founder-context', label: 'Founder Context', description: 'Your personal facts (same Daniela)' },
];

// Available sync batch types for pulling from prod (prod → dev)
const PULL_BATCHES = [
  { id: 'hive-snapshots', label: 'Hive Snapshots', description: 'Voice diagnostics, context snapshots' },
  { id: 'beta-testers', label: 'Beta Testers', description: 'Beta users + credits from prod' },
  { id: 'beta-usage', label: 'Beta Usage', description: 'Voice sessions, credits consumed' },
  { id: 'aggregate-analytics', label: 'Analytics', description: 'Anonymized usage stats' },
  { id: 'prod-content-growth', label: 'Daniela Content', description: 'Idioms, nuances, error patterns' },
  { id: 'prod-conversations', label: 'Prod Conversations', description: 'Recent conversations for troubleshooting' },
  { id: 'sofia-telemetry', label: 'Sofia Telemetry', description: 'Runtime faults and issue reports' },
  { id: 'founder-context', label: 'Founder Context', description: 'Your personal facts (same Daniela)' },
];

export function SyncControlCenterContent() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedPullBatches, setSelectedPullBatches] = useState<string[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const toggleBatch = (batchId: string) => {
    setSelectedBatches(prev => 
      prev.includes(batchId) 
        ? prev.filter(b => b !== batchId)
        : [...prev, batchId]
    );
  };

  const togglePullBatch = (batchId: string) => {
    setSelectedPullBatches(prev => 
      prev.includes(batchId) 
        ? prev.filter(b => b !== batchId)
        : [...prev, batchId]
    );
  };

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

  const { data: syncHealth, isLoading: syncHealthLoading, refetch: refetchSyncHealth } = useQuery<SyncHealth>({
    queryKey: ["/api/admin/sync/health"],
    retry: false,
  });

  const { data: pendingSync, isLoading: pendingSyncLoading, refetch: refetchPendingSync } = useQuery<PendingSyncData>({
    queryKey: ["/api/admin/sync/pending"],
    retry: false,
  });

  const { data: verifications, isLoading: verificationsLoading, refetch: refetchVerifications } = useQuery<SyncVerificationsData>({
    queryKey: ["/api/admin/sync/verifications"],
    retry: false,
  });

  const { data: peerSyncRuns, isLoading: peerSyncRunsLoading, refetch: refetchPeerSyncRuns } = useQuery<PeerSyncRunsResponse>({
    queryKey: ["/api/sync/peer-sync-runs"],
    retry: false,
  });

  // v32: Enhanced sync health with received imports
  const { data: enhancedHealth, refetch: refetchEnhancedHealth } = useQuery<EnhancedSyncHealth>({
    queryKey: ["/api/admin/sync/enhanced-health"],
    retry: false,
  });

  // v32: Sync anomalies
  const { data: anomaliesData, refetch: refetchAnomalies } = useQuery<SyncAnomaliesData>({
    queryKey: ["/api/admin/sync/anomalies"],
    retry: false,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  // v33: Environment comparison
  const { data: envComparison, isLoading: envComparisonLoading, refetch: refetchEnvComparison } = useQuery<EnvironmentComparison>({
    queryKey: ["/api/sync/compare-environments"],
    retry: false,
    enabled: false, // Manual trigger only (expensive)
  });

  // v37: Resumable sync status
  const { data: resumableStatus, refetch: refetchResumable } = useQuery<ResumableStatus>({
    queryKey: ["/api/admin/sync/resumable"],
    refetchInterval: 10000, // Check every 10s
  });

  const combinedHistory = (() => {
    const localRuns = (history?.syncRuns || []).map(run => ({
      ...run,
      _fromEnvironment: status?.currentEnvironment || 'local'
    }));
    
    const peerRuns = (peerSyncRuns?.syncRuns || []).map(run => ({
      ...run,
      _fromEnvironment: peerSyncRuns?.environment || 'peer'
    }));
    
    const allRuns = [...localRuns, ...peerRuns];
    
    const uniqueRuns = allRuns.reduce((acc, run) => {
      if (!acc.find(r => r.id === run.id)) {
        acc.push(run);
      }
      return acc;
    }, [] as typeof allRuns);
    
    return uniqueRuns.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  })();

  // v42: Find recent failed/partial syncs for prominent banner
  // Show failures regardless of errorMessage presence - status alone indicates failure
  const recentFailures = combinedHistory.slice(0, 10).filter(
    run => run.status === 'failed' || run.status === 'partial'
  );

  const toggleErrorExpanded = (runId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(runId)) {
        newSet.delete(runId);
      } else {
        newSet.add(runId);
      }
      return newSet;
    });
  };

  const pushMutation = useMutation({
    mutationFn: (batches?: string[]) => 
      apiRequest("POST", "/api/admin/sync/push", { 
        selectedBatches: batches && batches.length > 0 ? batches : undefined 
      }),
    onSuccess: () => {
      toast({ title: "Push Started", description: "Pushing data to peer environment..." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/peer-sync-runs"] });
      setSelectedBatches([]); // Clear selection after push
    },
    onError: (err: any) => {
      toast({ title: "Push Failed", description: err.message, variant: "destructive" });
    }
  });

  const pullMutation = useMutation({
    mutationFn: ({ forceResume = false, batches }: { forceResume?: boolean; batches?: string[] }) => 
      apiRequest("POST", "/api/admin/sync/pull", { 
        forceResume,
        selectedBatches: batches && batches.length > 0 ? batches : undefined 
      }),
    onSuccess: () => {
      toast({ title: "Pull Started", description: "Pulling data from peer environment..." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/peer-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/resumable"] }); // v37
      setSelectedPullBatches([]); // Clear selection after pull
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
      queryClient.invalidateQueries({ queryKey: ["/api/sync/peer-sync-runs"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sync/peer-sync-runs"] });
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

  const approveMutation = useMutation({
    mutationFn: (tableName: string) => apiRequest("POST", "/api/admin/sync/approve", { tableName }),
    onSuccess: (data: any) => {
      const count = data.count || data.total || 0;
      toast({ title: "Items Approved", description: `${count} items approved for sync` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/pending"] });
    },
    onError: (err: any) => {
      toast({ title: "Approval Failed", description: err.message, variant: "destructive" });
    }
  });

  // v32: Acknowledge sync anomaly
  const acknowledgeAnomalyMutation = useMutation({
    mutationFn: (anomalyId: string) => apiRequest("POST", `/api/admin/sync/anomalies/${anomalyId}/acknowledge`),
    onSuccess: () => {
      toast({ title: "Anomaly Acknowledged", description: "The issue has been marked as reviewed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sync/enhanced-health"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to Acknowledge", description: err.message, variant: "destructive" });
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchStatus(), refetchHistory(), refetchPeerStats(), refetchLocalStats(), 
      refetchCapabilities(), refetchPeerSyncRuns(), refetchSyncHealth(), 
      refetchPendingSync(), refetchVerifications(), refetchEnhancedHealth(), refetchAnomalies()
    ]);
    setIsRefreshing(false);
  };

  // Find active sync run from recent runs (check both local and peer environments)
  const localActiveSyncRun = status?.recentRuns?.find(r => r.status === 'running');
  const peerActiveSyncRun = peerSyncRuns?.syncRuns?.find(r => r.status === 'running');
  const activeSyncRun = localActiveSyncRun || peerActiveSyncRun;
  const activeSyncRunEnvironment = localActiveSyncRun ? (status?.currentEnvironment || 'local') : (peerSyncRuns?.environment || 'peer');
  
  const isAnySyncRunning = !!activeSyncRun || 
    pushMutation.isPending || pullMutation.isPending || fullSyncMutation.isPending;

  const currentEnv = status?.currentEnvironment || 'unknown';
  const peerEnv = currentEnv === 'production' ? 'development' : 'production';

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sync Control Center</h1>
            <p className="text-muted-foreground">
              Manage dev-prod synchronization
            </p>
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

          {/* v32: Sync Anomaly Alert Banner */}
          {anomaliesData && anomaliesData.anomalies.length > 0 && (
            <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-orange-700 dark:text-orange-400 mb-2">
                      Sync Issues Detected ({anomaliesData.anomalies.length})
                    </h4>
                    <div className="space-y-2">
                      {anomaliesData.anomalies.slice(0, 3).map((anomaly) => (
                        <div key={anomaly.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={anomaly.severity === 'critical' ? 'border-red-500 text-red-600' : 'border-orange-500 text-orange-600'}
                            >
                              {anomaly.type.replace(/-/g, ' ')}
                            </Badge>
                            <span className="text-muted-foreground">{anomaly.message}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => acknowledgeAnomalyMutation.mutate(anomaly.id)}
                            disabled={acknowledgeAnomalyMutation.isPending}
                            data-testid={`button-acknowledge-${anomaly.id}`}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Acknowledge
                          </Button>
                        </div>
                      ))}
                      {anomaliesData.anomalies.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          + {anomaliesData.anomalies.length - 3} more issues
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* v42: PROMINENT FAILURE BANNER - Make sync failures LOUD */}
          {recentFailures.length > 0 && (
            <Card className="border-red-500 border-2 bg-red-50 dark:bg-red-950/30" data-testid="card-sync-failure-banner">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-6 w-6 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-bold text-red-700 dark:text-red-400 mb-3 text-lg" data-testid="text-failure-count">
                      SYNC FAILURE - {recentFailures.length} Recent {recentFailures.length === 1 ? 'Sync' : 'Syncs'} Failed
                    </h4>
                    <div className="space-y-3">
                      {recentFailures.map((failure) => (
                        <div key={failure.id} className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-red-300 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge status={failure.status} />
                            <DirectionBadge direction={failure.direction} />
                            <span className="text-sm text-muted-foreground">
                              {formatDate(failure.startedAt)}
                            </span>
                          </div>
                          {failure.errorMessage ? (
                            <div 
                              className="text-sm text-red-800 dark:text-red-300 font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded cursor-pointer"
                              onClick={() => toggleErrorExpanded(failure.id)}
                              data-testid={`button-error-expand-${failure.id}`}
                            >
                              {expandedErrors.has(failure.id) ? (
                                <div className="whitespace-pre-wrap break-words" data-testid={`text-error-full-${failure.id}`}>{failure.errorMessage}</div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <span className="truncate" data-testid={`text-error-truncated-${failure.id}`}>{failure.errorMessage.substring(0, 100)}...</span>
                                  <span className="text-xs text-red-600 ml-2 flex-shrink-0">Click to expand</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-red-600 dark:text-red-400 italic" data-testid={`text-error-empty-${failure.id}`}>
                              No error details recorded - check server logs
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* v32: Quick Stats from Enhanced Health */}
          {enhancedHealth && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Batch Health:</span>
              <div className="flex gap-2">
                {['healthy', 'stale', 'critical', 'never'].map(status => {
                  const count = enhancedHealth.batches.filter(b => b.status === status).length;
                  if (count === 0) return null;
                  const colors = {
                    healthy: 'bg-green-500',
                    stale: 'bg-yellow-500',
                    critical: 'bg-red-500',
                    never: 'bg-gray-400'
                  };
                  return (
                    <Badge key={status} className={`${colors[status as keyof typeof colors]} text-white`}>
                      {count} {status}
                    </Badge>
                  );
                })}
              </div>
              {enhancedHealth.anomalyCount > 0 && (
                <Badge variant="outline" className="border-orange-500 text-orange-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {enhancedHealth.anomalyCount} anomalies
                </Badge>
              )}
            </div>
          )}

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
                        <p>Active: {activeSyncRun.direction} sync {activeSyncRunEnvironment !== currentEnv && `(on ${activeSyncRunEnvironment})`}</p>
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
                        <span>Local: <code className="bg-muted px-1 rounded">{capabilities.local.version?.match(/v\d+/)?.[0] || capabilities.local.version?.split('-').slice(-2).join('-') || 'unknown'}</code></span>
                        {capabilities.peer && (
                          <span>Peer: <code className="bg-muted px-1 rounded">{capabilities.peer.version?.match(/v\d+/)?.[0] || capabilities.peer.version?.split('-').slice(-2).join('-') || 'unknown'}</code></span>
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

              {/* Sync Health - Per-batch status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Sync Health
                  </CardTitle>
                  <CardDescription>
                    Per-batch sync status - shows when each batch last synced successfully
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {syncHealthLoading ? (
                    <Skeleton className="h-40" />
                  ) : syncHealth ? (
                    <div className="space-y-2">
                      {/* Summary badges - v33: Environment-aware status counts */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(() => {
                          // v33: In dev, focus on dataStatus since dev primarily pulls from prod
                          // In prod, check both push and data status
                          const isDev = currentEnv === 'development';
                          const critical = syncHealth.batches.filter(b => 
                            isDev ? b.dataStatus === 'critical' : (b.pushStatus === 'critical' || b.dataStatus === 'critical')
                          );
                          const stale = syncHealth.batches.filter(b => {
                            const isCritical = isDev ? b.dataStatus === 'critical' : (b.pushStatus === 'critical' || b.dataStatus === 'critical');
                            const isStale = isDev ? b.dataStatus === 'stale' : (b.pushStatus === 'stale' || b.dataStatus === 'stale');
                            return isStale && !isCritical;
                          });
                          // v33: "Never Synced" means no data at all - in dev, only count dataStatus='never' 
                          // since dev doesn't push (pushStatus='never' is expected for most batches)
                          const never = syncHealth.batches.filter(b => 
                            isDev ? b.dataStatus === 'never' : (b.pushStatus === 'never' && b.dataStatus === 'never')
                          );
                          
                          return (
                            <>
                              {critical.length > 0 && (
                                <Badge className="bg-red-500 text-white">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {critical.length} Critical
                                </Badge>
                              )}
                              {stale.length > 0 && (
                                <Badge className="bg-yellow-500 text-white">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {stale.length} Stale
                                </Badge>
                              )}
                              {never.length > 0 && (
                                <Badge variant="secondary">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {never.length} Never Synced
                                </Badge>
                              )}
                              {critical.length === 0 && stale.length === 0 && never.length === 0 && (
                                <Badge className="bg-green-500 text-white">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  All Healthy
                                </Badge>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      
                      {/* Batch table - v32: Added Data column (combines pull + import receipts) */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 pr-4">Batch</th>
                              <th className="text-left py-2 px-2">
                                <span className="flex items-center gap-1">
                                  <ArrowUpRight className="h-3 w-3" />
                                  Push
                                </span>
                              </th>
                              <th className="text-left py-2 px-2">
                                <span className="flex items-center gap-1">
                                  <ArrowDownLeft className="h-3 w-3" />
                                  Data
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {syncHealth.batches.map(batch => {
                              const getStatusColor = (status: string) => {
                                switch (status) {
                                  case 'healthy': return 'text-green-600 dark:text-green-400';
                                  case 'stale': return 'text-yellow-600 dark:text-yellow-400';
                                  case 'critical': return 'text-red-600 dark:text-red-400';
                                  default: return 'text-muted-foreground';
                                }
                              };
                              
                              const formatLastSync = (days: number | null) => {
                                if (days === null) return 'Never';
                                if (days === 0) return 'Today';
                                if (days === 1) return '1 day ago';
                                return `${days} days ago`;
                              };
                              
                              return (
                                <tr key={batch.batchId} className="border-b border-border/50">
                                  <td className="py-2 pr-4 font-medium">{batch.label}</td>
                                  <td className={`py-2 px-2 ${getStatusColor(batch.pushStatus)}`}>
                                    {formatLastSync(batch.daysSinceLastPush)}
                                  </td>
                                  <td className={`py-2 px-2 ${getStatusColor(batch.dataStatus)}`}>
                                    {formatLastSync(batch.daysSinceLastData)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Data = most recent of pull or received import | Healthy: &lt;3 days | Stale: 3-7 days | Critical: &gt;7 days
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unable to load sync health data</p>
                  )}
                </CardContent>
              </Card>

              {/* Sync Verification Results */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Sync Verification
                  </CardTitle>
                  <CardDescription>
                    Post-sync verification - confirms data arrived at peer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {verificationsLoading ? (
                    <Skeleton className="h-32" />
                  ) : verifications && verifications.verifications.length > 0 ? (
                    <div className="space-y-3">
                      {verifications.verifications.slice(0, 5).map((v, i) => (
                        <div 
                          key={`${v.batchType}-${i}`} 
                          className={`p-3 rounded-lg border ${v.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {v.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-medium text-sm">{v.batchType}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(v.verifiedAt)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Sent:</span>
                              <span className="ml-1 font-mono">
                                {Object.entries(v.expectedCounts).map(([k, c]) => `${k}:${c}`).join(', ')}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Peer has:</span>
                              <span className="ml-1 font-mono">
                                {Object.entries(v.peerCounts).map(([k, c]) => `${k}:${c}`).join(', ')}
                              </span>
                            </div>
                          </div>
                          {v.discrepancies.length > 0 && (
                            <div className="mt-2 text-xs">
                              {v.discrepancies.map((d, j) => (
                                <p key={j} className={v.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                  {d}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No verification results yet. Run a sync with beta-testers batch to see verification.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* v33: Environment Comparison - Side-by-side table counts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Environment Comparison
                  </CardTitle>
                  <CardDescription>
                    Compare record counts across all sync tables between DEV and PROD
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refetchEnvComparison()}
                      disabled={envComparisonLoading}
                      data-testid="button-compare-environments"
                    >
                      {envComparisonLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Database className="h-4 w-4 mr-2" />
                      )}
                      {envComparisonLoading ? 'Comparing...' : 'Compare Environments'}
                    </Button>
                    
                    {envComparison ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Compared at {formatDate(envComparison.comparedAt)}</span>
                          <span className="font-medium">{envComparison.localEnvironment} ↔ {envComparison.peerEnvironment}</span>
                        </div>
                        
                        {envComparison.errors.length > 0 && (
                          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                            {envComparison.errors.map((e, i) => (
                              <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
                            ))}
                          </div>
                        )}
                        
                        <div className="overflow-x-auto max-h-80 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-card">
                              <tr className="border-b">
                                <th className="text-left py-2 pr-2">Table</th>
                                <th className="text-right py-2 px-2">{envComparison.localEnvironment === 'development' ? 'DEV' : 'PROD'}</th>
                                <th className="text-right py-2 px-2">{envComparison.peerEnvironment === 'production' ? 'PROD' : 'DEV'}</th>
                                <th className="text-right py-2 px-2">Diff</th>
                                <th className="text-center py-2 pl-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {envComparison.comparison.map(row => (
                                <tr key={row.table} className="border-b border-border/50 hover:bg-muted/30">
                                  <td className="py-1 pr-2 font-mono">{row.table}</td>
                                  <td className="py-1 px-2 text-right font-mono">{row.localCount >= 0 ? row.localCount.toLocaleString() : '-'}</td>
                                  <td className="py-1 px-2 text-right font-mono">{row.peerCount >= 0 ? row.peerCount.toLocaleString() : '-'}</td>
                                  <td className={`py-1 px-2 text-right font-mono ${row.difference > 0 ? 'text-green-600 dark:text-green-400' : row.difference < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                                    {row.difference > 0 ? '+' : ''}{row.difference}
                                  </td>
                                  <td className="py-1 pl-2 text-center">
                                    {row.status === 'match' && <CheckCircle2 className="h-3 w-3 text-green-500 inline" />}
                                    {row.status === 'local-ahead' && <ArrowUpRight className="h-3 w-3 text-blue-500 inline" />}
                                    {row.status === 'peer-ahead' && <ArrowDownLeft className="h-3 w-3 text-orange-500 inline" />}
                                    {row.status === 'error' && <XCircle className="h-3 w-3 text-red-500 inline" />}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        <div className="text-xs text-muted-foreground flex gap-4">
                          <span><CheckCircle2 className="h-3 w-3 inline mr-1 text-green-500" />Match</span>
                          <span><ArrowUpRight className="h-3 w-3 inline mr-1 text-blue-500" />Local ahead</span>
                          <span><ArrowDownLeft className="h-3 w-3 inline mr-1 text-orange-500" />Peer ahead</span>
                          <span><XCircle className="h-3 w-3 inline mr-1 text-red-500" />Error</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Click "Compare Environments" to see side-by-side table counts
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sync Approval Queue - Items waiting to be approved for sync */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Sync Approval Queue
                  </CardTitle>
                  <CardDescription>
                    Neural network items pending approval before they can sync
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingSyncLoading ? (
                    <Skeleton className="h-32" />
                  ) : pendingSync ? (
                    <div className="space-y-3">
                      {pendingSync.totalPending === 0 ? (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">All items approved - nothing pending</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <Badge className="bg-yellow-500 text-white">
                              {pendingSync.totalPending} items pending
                            </Badge>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approveMutation.mutate('all')}
                              disabled={approveMutation.isPending}
                              data-testid="button-approve-all"
                            >
                              {approveMutation.isPending ? 'Approving...' : 'Approve All'}
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            {pendingSync.tables.filter(t => t.localCount > 0).map(table => (
                              <div key={table.tableName} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                <div>
                                  <span className="font-medium text-sm">{table.displayName}</span>
                                  <div className="text-xs text-muted-foreground">
                                    {table.localCount} pending | {table.approvedCount} approved
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveMutation.mutate(table.tableName)}
                                  disabled={approveMutation.isPending}
                                  data-testid={`button-approve-${table.tableName}`}
                                >
                                  Approve
                                </Button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Items with syncStatus="local" are created here but not yet synced. Approve to mark them for next sync.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unable to load pending sync data</p>
                  )}
                </CardContent>
              </Card>

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
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">Selective Batch Push (optional)</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Select specific batches to push, or leave all unchecked to push everything
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {PUSH_BATCHES.map(batch => (
                        <label
                          key={batch.id}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            selectedBatches.includes(batch.id)
                              ? 'bg-primary/10 border-primary'
                              : 'hover:bg-muted'
                          }`}
                          data-testid={`checkbox-batch-${batch.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedBatches.includes(batch.id)}
                            onChange={() => toggleBatch(batch.id)}
                            className="rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{batch.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{batch.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedBatches.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary">{selectedBatches.length} selected</Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedBatches([])}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4" />
                      Pull from Production (Beta Analytics)
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Pull usage data and analytics from production back to dev for analysis
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PULL_BATCHES.map(batch => (
                        <label
                          key={batch.id}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            selectedPullBatches.includes(batch.id)
                              ? 'bg-blue-500/20 border-blue-500'
                              : 'hover:bg-muted'
                          }`}
                          data-testid={`checkbox-pull-${batch.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPullBatches.includes(batch.id)}
                            onChange={() => togglePullBatch(batch.id)}
                            className="rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{batch.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{batch.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedPullBatches.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="bg-blue-500">{selectedPullBatches.length} selected</Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedPullBatches([])}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Button
                      onClick={() => pushMutation.mutate(selectedBatches)}
                      disabled={isAnySyncRunning}
                      className="h-auto py-4 flex-col gap-2"
                      data-testid="button-push"
                    >
                      <ArrowUpRight className="h-6 w-6" />
                      <span>Push to {peerEnv}</span>
                      <span className="text-xs opacity-70">
                        {selectedBatches.length > 0 
                          ? `${selectedBatches.length} batch${selectedBatches.length > 1 ? 'es' : ''}`
                          : 'All batches'}
                      </span>
                    </Button>

                    <Button
                      onClick={() => pullMutation.mutate({ batches: selectedPullBatches })}
                      disabled={isAnySyncRunning}
                      variant="secondary"
                      className="h-auto py-4 flex-col gap-2"
                      data-testid="button-pull"
                    >
                      <ArrowDownLeft className="h-6 w-6" />
                      <span>Pull from {peerEnv}</span>
                      <span className="text-xs opacity-70">
                        {selectedPullBatches.length > 0 
                          ? `${selectedPullBatches.length} batch${selectedPullBatches.length > 1 ? 'es' : ''}`
                          : 'All data'}
                      </span>
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
                    {/* v37: Show resume button for running OR resumable failed/partial syncs */}
                    {(activeSyncRun?.status === 'running' || resumableStatus?.hasResumable) && (
                      <Button
                        onClick={() => pullMutation.mutate({ forceResume: true })}
                        disabled={pullMutation.isPending}
                        variant={resumableStatus?.hasResumable ? "destructive" : "outline"}
                        size="sm"
                        data-testid="button-force-resume"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {resumableStatus?.hasResumable && resumableStatus.resumeInfo 
                          ? `Resume (${resumableStatus.resumeInfo.completedBatches.length} batches done)`
                          : 'Force Resume'}
                      </Button>
                    )}
                    {resumableStatus?.hasResumable && resumableStatus.resumeInfo && (
                      <span className="text-xs text-muted-foreground">
                        Last attempt: {resumableStatus.resumeInfo.status}
                        {resumableStatus.resumeInfo.lastCompletedPage >= 0 && (
                          <> • Page {resumableStatus.resumeInfo.lastCompletedPage + 1}
                          {resumableStatus.resumeInfo.totalPagesExpected && ` of ~${resumableStatus.resumeInfo.totalPagesExpected}`}</>
                        )}
                      </span>
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
                  <CardDescription>
                    Recent synchronization runs from both environments
                    {peerSyncRunsLoading && <span className="ml-2 text-muted-foreground">(loading peer history...)</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading && peerSyncRunsLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12" />
                      ))}
                    </div>
                  ) : !combinedHistory.length ? (
                    <p className="text-center text-muted-foreground py-4">No sync history yet</p>
                  ) : (
                    <div className="space-y-2">
                      {combinedHistory.slice(0, 15).map((run) => (
                        <div 
                          key={`${run._fromEnvironment}-${run.id}`} 
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <EnvironmentSourceBadge environment={run._fromEnvironment} />
                          <StatusBadge status={run.status} />
                          <DirectionBadge direction={run.direction} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {run.sourceEnvironment} → {run.targetEnvironment}
                              {run.pageNumber !== undefined && (
                                <span className="ml-1 text-xs text-muted-foreground">(page {run.pageNumber})</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(run.startedAt)}
                              {run.triggeredBy && ` • by ${run.triggeredBy}`}
                              {run.syncSessionId && (
                                <span className="ml-1 font-mono text-[10px] opacity-60" title={`Session: ${run.syncSessionId}`}>
                                  [{run.syncSessionId.slice(0, 6)}]
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">{formatDuration(run.durationMs)}</p>
                            {run.recordsSynced !== undefined && (
                              <p className="text-xs text-muted-foreground">{run.recordsSynced} records</p>
                            )}
                          </div>
                          {run.errorMessage && (
                            <div 
                              className={`flex items-start gap-1 cursor-pointer hover:bg-muted/50 rounded p-1 ${expandedErrors.has(run.id) ? 'max-w-full' : 'shrink-0 max-w-[200px]'}`}
                              onClick={() => toggleErrorExpanded(run.id)}
                              title={expandedErrors.has(run.id) ? "Click to collapse" : "Click to expand error details"}
                              data-testid={`error-toggle-${run.id}`}
                            >
                              <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${run.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`} />
                              {expandedErrors.has(run.id) ? (
                                <span className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-all">
                                  {run.errorMessage}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground truncate">
                                  {run.errorMessage.length > 50 ? run.errorMessage.substring(0, 50) + '...' : run.errorMessage}
                                </span>
                              )}
                            </div>
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
    </div>
  );
}

export default SyncControlCenterContent;
