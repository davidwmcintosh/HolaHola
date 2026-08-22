import { useEffect, useRef, useState } from "react";
import {
  Activity, CheckCircle2, XCircle, Loader2, Zap,
  Database, BarChart3, Mic, AlertTriangle, Brain,
  FileCode, Search, Bell, Globe, FolderOpen, Terminal,
  Wrench, Clock, Camera, FileText, ScanEye, Wifi, WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivityEvent {
  id: string;
  type: 'tool_start' | 'tool_result' | 'response_complete' | 'heartbeat';
  name?: string;
  success?: boolean;
  reasoning?: string;
  error?: string;
  timestamp: string;
}

const TOOL_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  get_system_health:       { label: 'System Health',       Icon: Activity,    color: 'text-emerald-500' },
  get_database_stats:      { label: 'Database Stats',      Icon: Database,    color: 'text-blue-500' },
  get_user_analytics:      { label: 'User Analytics',      Icon: BarChart3,   color: 'text-purple-500' },
  get_voice_session_metrics:{ label: 'Voice Metrics',      Icon: Mic,         color: 'text-pink-500' },
  get_recent_errors:       { label: 'Recent Errors',       Icon: AlertTriangle,color:'text-red-500' },
  get_sofia_report:        { label: 'Sofia Report',        Icon: ScanEye,     color: 'text-cyan-500' },
  search_editor_memories:  { label: 'Memory Search',       Icon: Brain,       color: 'text-violet-500' },
  save_to_memory:          { label: 'Save to Memory',      Icon: Brain,       color: 'text-violet-500' },
  read_file:               { label: 'Read File',           Icon: FileCode,    color: 'text-amber-500' },
  apply_code_change:       { label: 'Apply Code Change',   Icon: FileCode,    color: 'text-orange-500' },
  search_code:             { label: 'Search Code',         Icon: Search,      color: 'text-sky-500' },
  list_directory:          { label: 'List Directory',      Icon: FolderOpen,  color: 'text-teal-500' },
  run_shell:               { label: 'Run Shell',           Icon: Terminal,    color: 'text-lime-500' },
  notify_david:            { label: 'Queue Notification',  Icon: Bell,        color: 'text-amber-500' },
  post_to_express_lane:    { label: 'Express Lane',        Icon: Zap,         color: 'text-yellow-500' },
  browser_screenshot:      { label: 'Browser Screenshot',  Icon: Camera,      color: 'text-indigo-500' },
  write_briefing:          { label: 'Write Briefing',      Icon: FileText,    color: 'text-slate-400' },
  run_full_systems_check:  { label: 'Systems Check',       Icon: Activity,    color: 'text-emerald-500' },
  get_pending_issues:      { label: 'Pending Issues',      Icon: AlertTriangle,color:'text-orange-500' },
  check_learning_metrics:  { label: 'Learning Metrics',    Icon: BarChart3,   color: 'text-blue-500' },
};

function getToolMeta(name: string) {
  return TOOL_META[name] ?? { label: name, Icon: Wrench, color: 'text-muted-foreground' };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface EventRow {
  startEvent: ActivityEvent;
  resultEvent?: ActivityEvent;
}

export function AldenWorkspacePane() {
  const [connected, setConnected] = useState(false);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [responseCount, setResponseCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource('/api/alden/activity-stream', { withCredentials: true });
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (e) => {
        try {
          const event: ActivityEvent = JSON.parse(e.data);
          event.id = `${event.type}-${event.timestamp}-${Math.random()}`;

          if (event.type === 'heartbeat') return;

          if (event.type === 'tool_start') {
            setRows(prev => [...prev.slice(-49), { startEvent: event }]);
          } else if (event.type === 'tool_result') {
            setRows(prev => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].startEvent.name === event.name && !updated[i].resultEvent) {
                  updated[i] = { ...updated[i], resultEvent: event };
                  break;
                }
              }
              return updated;
            });
          } else if (event.type === 'response_complete') {
            setResponseCount(c => c + 1);
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      esRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rows]);

  const pendingCount = rows.filter(r => !r.resultEvent).length;

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-md border bg-card overflow-hidden" data-testid="alden-workspace-pane">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground flex-1">Alden's Workspace</span>
        <div className="flex items-center gap-1.5">
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 dark:text-amber-400 border-amber-500/30">
              {pendingCount} running
            </Badge>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {connected
              ? <><Wifi className="h-3 w-3 text-emerald-500" /><span>live</span></>
              : <><WifiOff className="h-3 w-3 text-muted-foreground/50" /><span>connecting…</span></>
            }
          </div>
        </div>
      </div>

      {/* Event stream */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="p-2 space-y-1">
          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <Brain className="h-6 w-6 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground/50 leading-snug max-w-[180px]">
                Alden's tool calls will appear here as he works.
              </p>
            </div>
          )}

          {rows.map((row, idx) => {
            const { label, Icon, color } = getToolMeta(row.startEvent.name ?? '');
            const isDone = !!row.resultEvent;
            const isError = isDone && row.resultEvent!.success === false;
            const isPending = !isDone;

            return (
              <div
                key={`${row.startEvent.id}-${idx}`}
                className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-muted/30"
                data-testid={`workspace-event-${idx}`}
              >
                <div className="shrink-0 mt-0.5">
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />}
                  {isDone && !isError && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  {isError && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Icon className={`h-3 w-3 ${color} shrink-0`} />
                    <span className={`text-xs font-medium leading-tight ${isPending ? 'text-foreground' : isError ? 'text-muted-foreground' : 'text-foreground/80'}`}>
                      {label}
                    </span>
                    {isError && (
                      <span className="text-[10px] text-red-500 truncate">{row.resultEvent?.error}</span>
                    )}
                  </div>
                  {row.startEvent.reasoning && (
                    <p className="text-[10px] text-muted-foreground italic leading-snug line-clamp-3">
                      {row.startEvent.reasoning}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    <span>{formatTime(row.startEvent.timestamp)}</span>
                    {isDone && (
                      <span className="ml-0.5">
                        ({Math.round((new Date(row.resultEvent!.timestamp).getTime() - new Date(row.startEvent.timestamp).getTime()) / 1000)}s)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {responseCount > 0 && rows.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>Response ready</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer stats */}
      {rows.length > 0 && (
        <div className="border-t px-3 py-1.5 flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
          <span>{rows.length} tool call{rows.length !== 1 ? 's' : ''}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{responseCount} response{responseCount !== 1 ? 's' : ''}</span>
          <button
            className="ml-auto hover:text-foreground transition-colors"
            onClick={() => { setRows([]); setResponseCount(0); }}
            data-testid="button-clear-workspace"
          >
            clear
          </button>
        </div>
      )}
    </div>
  );
}
