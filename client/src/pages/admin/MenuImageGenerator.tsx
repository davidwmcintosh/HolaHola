import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ImageIcon,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  Utensils,
  Server,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MenuImageStats {
  total: number;
  done: number;
  remaining: number;
}

interface WorkerStatus {
  running: boolean;
  processed: number;
  errors: number;
  currentItem: string | null;
  lastError: string | null;
  startedAt: string | null;
}

type SSEEvent =
  | { type: "start"; batchSize: number; total: number; done: number }
  | { type: "generating"; name: string; displayName: string; index: number; batchSize: number }
  | { type: "done"; name: string; displayName: string; url: string; index: number; batchSize: number; total: number; done: number }
  | { type: "error"; name: string; displayName: string; error: string; index: number; batchSize: number }
  | { type: "complete"; total: number; done: number; remaining: number }
  | { type: "fatal"; error: string };

interface GeneratedItem {
  name: string;
  displayName: string;
  url: string;
  ts: number;
}

interface FailedItem {
  name: string;
  displayName: string;
  error: string;
}

export function MenuImageGeneratorContent() {
  const [batchSize, setBatchSize] = useState("30");
  const [delayMs, setDelayMs] = useState("2000");
  const [workerBatchSize, setWorkerBatchSize] = useState("200");
  const [running, setRunning] = useState(false);
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ index: number; total: number } | null>(null);
  const [generated, setGenerated] = useState<GeneratedItem[]>([]);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [sessionDone, setSessionDone] = useState(0);
  const [sessionErrors, setSessionErrors] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: stats, refetch: refetchStats } = useQuery<MenuImageStats>({
    queryKey: ["/api/admin/menu-image-stats"],
    refetchInterval: running ? 15000 : false,
  });

  const { data: workerStatus, refetch: refetchWorker } = useQuery<WorkerStatus>({
    queryKey: ["/api/admin/menu-image-worker-status"],
    refetchInterval: 5000,
  });

  const startWorkerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/start-menu-image-worker", { limit: parseInt(workerBatchSize) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menu-image-worker-status"] });
    },
  });

  const stopWorkerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/stop-menu-image-worker"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menu-image-worker-status"] });
    },
  });

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-199), msg]);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setRunning(false);
    setCurrentItem(null);
    setBatchProgress(null);
    addLog("⏹ Stopped by user.");
    refetchStats();
  }, [addLog, refetchStats]);

  const start = useCallback(() => {
    if (running) return;

    setRunning(true);
    setCurrentItem(null);
    setBatchProgress(null);
    setSessionDone(0);
    setSessionErrors(0);
    setGenerated([]);
    setFailed([]);
    setLog([]);
    addLog(`▶ Starting batch: ${batchSize} items, ${Number(delayMs) / 1000}s between each.`);

    const url = `/api/admin/batch-menu-images?limit=${batchSize}&delay=${delayMs}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      let evt: SSEEvent;
      try {
        evt = JSON.parse(e.data);
      } catch {
        return;
      }

      if (evt.type === "start") {
        addLog(`✦ Batch started. Library: ${evt.done}/${evt.total} complete. Processing ${evt.batchSize} items now.`);
        setBatchProgress({ index: 0, total: evt.batchSize });
      } else if (evt.type === "generating") {
        setCurrentItem(evt.displayName);
        setBatchProgress({ index: evt.index, total: evt.batchSize });
        addLog(`  [${evt.index}/${evt.batchSize}] Generating: ${evt.displayName}...`);
      } else if (evt.type === "done") {
        setCurrentItem(null);
        setBatchProgress({ index: evt.index, total: evt.batchSize });
        setSessionDone((n) => n + 1);
        setGenerated((prev) => [{ name: evt.name, displayName: evt.displayName, url: evt.url, ts: Date.now() }, ...prev.slice(0, 49)]);
        addLog(`  ✓ ${evt.displayName} → saved. Library: ${evt.done}/${evt.total}`);
      } else if (evt.type === "error") {
        setSessionErrors((n) => n + 1);
        setFailed((prev) => [{ name: evt.name, displayName: evt.displayName, error: evt.error }, ...prev.slice(0, 19)]);
        addLog(`  ✗ ${evt.displayName}: ${evt.error}`);
      } else if (evt.type === "complete") {
        addLog(`✦ Batch complete. Library now ${evt.done}/${evt.total}. Remaining: ${evt.remaining}.`);
        es.close();
        esRef.current = null;
        setRunning(false);
        setCurrentItem(null);
        setBatchProgress(null);
        refetchStats();
      } else if (evt.type === "fatal") {
        addLog(`✗ Fatal error: ${(evt as any).error}`);
        es.close();
        esRef.current = null;
        setRunning(false);
        setCurrentItem(null);
        setBatchProgress(null);
        refetchStats();
      }
    };

    es.onerror = () => {
      addLog("✗ SSE connection error — stopping.");
      es.close();
      esRef.current = null;
      setRunning(false);
      setCurrentItem(null);
      setBatchProgress(null);
      refetchStats();
    };
  }, [running, batchSize, delayMs, addLog, refetchStats]);

  // Cleanup on unmount
  useEffect(() => () => { esRef.current?.close(); }, []);

  const totalPct = stats ? Math.round((stats.done / stats.total) * 100) : 0;
  const batchPct = batchProgress ? Math.round((batchProgress.index / batchProgress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Utensils className="w-5 h-5" />
          Menu Image Generator
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate watercolor food illustrations for all menu vocabulary items. Images are stored permanently and served to students in menu overlays.
        </p>
      </div>

      {/* Library Progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Library Progress</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              data-testid="button-refresh-stats"
              onClick={() => refetchStats()}
              disabled={running}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats?.total ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.done ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Have images</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats?.remaining ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Remaining</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Overall completion</span>
              <span>{totalPct}%</span>
            </div>
            <Progress value={totalPct} className="h-2" data-testid="progress-library" />
          </div>
        </CardContent>
      </Card>

      {/* Background Worker */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" />
                Background Worker
              </CardTitle>
              <CardDescription className="mt-1">
                Runs server-side without a browser connection. Best for large batches — start it and come back later. Logs appear in the server console.
              </CardDescription>
            </div>
            <Button
              size="icon"
              variant="ghost"
              data-testid="button-refresh-worker"
              onClick={() => refetchWorker()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Items to process</label>
              <Select
                value={workerBatchSize}
                onValueChange={setWorkerBatchSize}
                disabled={workerStatus?.running}
              >
                <SelectTrigger className="w-32" data-testid="select-worker-batch-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 items</SelectItem>
                  <SelectItem value="200">200 items</SelectItem>
                  <SelectItem value="300">300 items</SelectItem>
                  <SelectItem value="500">500 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {!workerStatus?.running ? (
                <Button
                  onClick={() => startWorkerMutation.mutate()}
                  disabled={startWorkerMutation.isPending || !stats || stats.remaining === 0}
                  data-testid="button-start-worker"
                >
                  {startWorkerMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-1.5" />
                  )}
                  Start worker
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => stopWorkerMutation.mutate()}
                  disabled={stopWorkerMutation.isPending}
                  data-testid="button-stop-worker"
                >
                  <Square className="w-4 h-4 mr-1.5" />
                  Stop worker
                </Button>
              )}
            </div>
          </div>

          {workerStatus && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-2">
                {workerStatus.running ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full bg-muted-foreground/30" />
                )}
                <span className="text-sm font-medium">
                  {workerStatus.running ? "Running" : "Stopped"}
                </span>
                {workerStatus.currentItem && (
                  <span className="text-sm text-muted-foreground">— {workerStatus.currentItem}</span>
                )}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  {workerStatus.processed} generated this session
                </span>
                {workerStatus.errors > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    {workerStatus.errors} errors
                  </span>
                )}
              </div>
              {workerStatus.lastError && (
                <div className="text-xs text-destructive flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  Last error: {workerStatus.lastError}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive SSE Batch Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Interactive Batch</CardTitle>
          <CardDescription>Runs in the browser — generates images and shows them live as each one completes. Stops if you close the tab.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Batch size</label>
              <Select
                value={batchSize}
                onValueChange={setBatchSize}
                disabled={running}
              >
                <SelectTrigger className="w-28" data-testid="select-batch-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 items</SelectItem>
                  <SelectItem value="20">20 items</SelectItem>
                  <SelectItem value="30">30 items</SelectItem>
                  <SelectItem value="50">50 items</SelectItem>
                  <SelectItem value="100">100 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Delay between items</label>
              <Select
                value={delayMs}
                onValueChange={setDelayMs}
                disabled={running}
              >
                <SelectTrigger className="w-32" data-testid="select-delay">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1 second</SelectItem>
                  <SelectItem value="1500">1.5 seconds</SelectItem>
                  <SelectItem value="2000">2 seconds</SelectItem>
                  <SelectItem value="3000">3 seconds</SelectItem>
                  <SelectItem value="5000">5 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {!running ? (
                <Button
                  onClick={start}
                  disabled={!stats || stats.remaining === 0}
                  data-testid="button-start-batch"
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  Start batch
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={stop}
                  data-testid="button-stop-batch"
                >
                  <Square className="w-4 h-4 mr-1.5" />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Active batch progress */}
          {running && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm">
                  {currentItem ? (
                    <span>Generating <span className="font-medium">{currentItem}</span>…</span>
                  ) : (
                    "Preparing…"
                  )}
                </span>
              </div>
              {batchProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Batch progress</span>
                    <span>{batchProgress.index} / {batchProgress.total}</span>
                  </div>
                  <Progress value={batchPct} className="h-1.5" data-testid="progress-batch" />
                </div>
              )}
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  {sessionDone} done
                </span>
                {sessionErrors > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    {sessionErrors} errors
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ~{Math.ceil((Number(batchSize) - sessionDone) * (Number(delayMs) / 1000 + 3))}s remaining
                </span>
              </div>
            </div>
          )}

          {/* Session summary when done */}
          {!running && sessionDone > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Last batch: <span className="font-medium">{sessionDone} generated</span>
              {sessionErrors > 0 && <>, <span className="text-amber-600">{sessionErrors} errors</span></>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated thumbnails */}
      {generated.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Recently Generated</CardTitle>
              <Badge variant="secondary">{generated.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2" data-testid="grid-generated-images">
              {generated.map((item) => (
                <div
                  key={`${item.name}-${item.ts}`}
                  className="flex flex-col gap-1"
                  data-testid={`thumb-${item.name}`}
                  title={item.displayName}
                >
                  <div className="aspect-square rounded-md overflow-hidden bg-muted">
                    <img
                      src={item.url}
                      alt={item.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground truncate leading-tight">{item.displayName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity log */}
      {log.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Activity Log</CardTitle>
              <Button
                size="icon"
                variant="ghost"
                data-testid="button-clear-log"
                onClick={() => setLog([])}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 rounded-md border bg-muted/50 p-3">
              <div className="space-y-0.5 font-mono text-xs text-muted-foreground">
                {log.map((line, i) => (
                  <div key={i} className="leading-5">{line}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {failed.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Errors</CardTitle>
              <Badge variant="destructive">{failed.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {failed.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span><span className="font-medium">{f.displayName}</span> — {f.error}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
