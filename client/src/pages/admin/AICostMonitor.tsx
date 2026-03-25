import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, CheckCircle, Clock, DollarSign, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const MODEL_COLORS: Record<string, string> = {
  "claude-sonnet-4-5": "bg-orange-500",
  "claude-3-haiku-20240307": "bg-yellow-400",
  "claude-opus-4-6": "bg-red-500",
  "gemini-3-flash-preview": "bg-blue-500",
  "gemini-2.5-pro": "bg-blue-700",
  "gpt-4o": "bg-green-500",
  "gpt-4o-mini": "bg-green-400",
  "gpt-4": "bg-green-700",
};

const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-5": "Claude Sonnet",
  "claude-3-haiku-20240307": "Claude Haiku",
  "claude-opus-4-6": "Claude Opus",
  "gemini-3-flash-preview": "Gemini Flash",
  "gemini-2.5-pro": "Gemini Pro",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4": "GPT-4",
};

interface CostSummary {
  windowHours: number;
  totalCostUsd: number;
  callCount: number;
  byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
  mostExpensiveModel: string | null;
  avgCostPerCall: number;
  lyraLastRun: { timestamp: string; ageMs: number; costUsd: number } | null;
  retrievedAt: string;
}

const BUDGET_DAILY_USD = 5.0;

function formatAge(ms: number): string {
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 60000);
  if (h === 0) return `${m}m ago`;
  return `${h}h ${m}m ago`;
}

function formatUsd(n: number): string {
  if (n < 0.001) return "<$0.001";
  return `$${n.toFixed(4)}`;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full bg-muted rounded-sm overflow-hidden">
      <div className={`h-full ${color} rounded-sm transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AICostMonitor() {
  const [windowHours, setWindowHours] = useState(24);
  const [refreshAt, setRefreshAt] = useState(Date.now());

  const { data, isLoading, refetch } = useQuery<CostSummary>({
    queryKey: ["/api/alden/cost-summary", windowHours],
    queryFn: async () => {
      const res = await fetch(`/api/alden/cost-summary?hours=${windowHours}`);
      if (!res.ok) throw new Error("Failed to fetch cost summary");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const interval = setInterval(() => setRefreshAt(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const budgetUsedPct = data ? Math.min((data.totalCostUsd / BUDGET_DAILY_USD) * 100, 100) : 0;
  const overBudget = data && data.totalCostUsd >= BUDGET_DAILY_USD;
  const warnBudget = data && !overBudget && budgetUsedPct >= 60;

  const sortedModels = data
    ? Object.entries(data.byModel).sort((a, b) => b[1].costUsd - a[1].costUsd)
    : [];

  const maxModelCost = sortedModels[0]?.[1].costUsd ?? 0;

  const lyraAgeH = data?.lyraLastRun ? data.lyraLastRun.ageMs / 3.6e6 : Infinity;
  const lyraProtected = lyraAgeH < 6;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">AI Cost Monitor</h1>
          <p className="text-sm text-muted-foreground">In-session tracked calls only — resets on restart</p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 6, 12, 24].map(h => (
            <Button
              key={h}
              size="sm"
              variant={windowHours === h ? "default" : "outline"}
              onClick={() => { setWindowHours(h); queryClient.invalidateQueries({ queryKey: ["/api/alden/cost-summary"] }); }}
              data-testid={`button-window-${h}h`}
            >
              {h}h
            </Button>
          ))}
          <Button size="icon" variant="ghost" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Budget Gauge */}
      <Card data-testid="card-budget">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Budget ({windowHours}h window)
          </CardTitle>
          {overBudget ? (
            <Badge variant="destructive" data-testid="badge-budget-status">Over budget</Badge>
          ) : warnBudget ? (
            <Badge className="bg-yellow-500 text-white" data-testid="badge-budget-status">Approaching limit</Badge>
          ) : (
            <Badge variant="outline" data-testid="badge-budget-status">Within budget</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold tabular-nums" data-testid="text-total-cost">
              {isLoading ? "—" : formatUsd(data?.totalCostUsd ?? 0)}
            </span>
            <span className="text-sm text-muted-foreground pb-1">/ ${BUDGET_DAILY_USD.toFixed(0)} alert threshold</span>
          </div>
          <div className="space-y-1">
            <div className={`h-3 w-full rounded-sm overflow-hidden bg-muted`}>
              <div
                className={`h-full transition-all duration-700 rounded-sm ${overBudget ? "bg-destructive" : warnBudget ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${budgetUsedPct}%` }}
                data-testid="bar-budget"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span data-testid="text-call-count">{data?.callCount ?? 0} tracked call(s)</span>
              <span data-testid="text-avg-cost">avg {data?.avgCostPerCall ? formatUsd(data.avgCostPerCall) : "—"}/call</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By Model */}
      {sortedModels.length > 0 && (
        <Card data-testid="card-by-model">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              By Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sortedModels.map(([model, stats]) => (
              <div key={model} className="space-y-1.5" data-testid={`row-model-${model}`}>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${MODEL_COLORS[model] ?? "bg-muted-foreground"} flex-shrink-0`} />
                    <span className="text-sm font-medium">{MODEL_LABELS[model] ?? model}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground" data-testid={`text-calls-${model}`}>{stats.calls} call(s)</span>
                    <span className="text-muted-foreground" data-testid={`text-tokens-${model}`}>
                      {(stats.inputTokens / 1000).toFixed(1)}k in / {(stats.outputTokens / 1000).toFixed(1)}k out
                    </span>
                    <span className="font-semibold tabular-nums" data-testid={`text-cost-${model}`}>{formatUsd(stats.costUsd)}</span>
                  </div>
                </div>
                <Bar value={stats.costUsd} max={maxModelCost} color={MODEL_COLORS[model] ?? "bg-muted-foreground"} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {sortedModels.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No tracked AI calls in the last {windowHours}h — data resets on server restart.
          </CardContent>
        </Card>
      )}

      {/* Lyra Guard Status */}
      <Card data-testid="card-lyra-guard">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Lyra Boot Guard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              {data?.lyraLastRun ? (
                <>
                  <p className="text-sm" data-testid="text-lyra-last-run">
                    Last analysis: <span className="font-medium">{formatAge(data.lyraLastRun.ageMs)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cost: {formatUsd(data.lyraLastRun.costUsd)} · Resets again in {lyraProtected ? `~${(6 - lyraAgeH).toFixed(1)}h` : "now"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No run history found</p>
              )}
            </div>
            {lyraProtected ? (
              <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400" data-testid="badge-lyra-protected">
                <CheckCircle className="w-4 h-4" />
                Boot skip active
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-yellow-600 dark:text-yellow-400" data-testid="badge-lyra-unprotected">
                <AlertTriangle className="w-4 h-4" />
                Next restart will trigger run
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Auto-refreshes every 30s · Last fetched {data ? new Date(data.retrievedAt).toLocaleTimeString() : "—"}
      </p>
    </div>
  );
}
