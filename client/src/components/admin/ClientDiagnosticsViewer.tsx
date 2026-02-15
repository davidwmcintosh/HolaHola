import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Clock, Wifi, Monitor, Volume2 } from 'lucide-react';

interface DiagnosticEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: string;
  eventData: any;
  createdAt: string;
}

function triggerLabel(eventType: string): string {
  const trigger = eventType.replace('client_diag_', '');
  const labels: Record<string, string> = {
    lockout_watchdog_8s: 'Mic Locked (8s)',
    failsafe_tier1_20s: 'Failsafe Tier-1 (20s)',
    failsafe_tier2_45s: 'Failsafe Tier-2 (45s)',
    greeting_silence_15s: 'No Greeting (15s)',
    error: 'WebSocket Error',
  };
  return labels[trigger] || trigger;
}

function triggerSeverity(eventType: string): 'destructive' | 'secondary' | 'outline' {
  const trigger = eventType.replace('client_diag_', '');
  if (trigger.includes('tier2') || trigger.includes('error')) return 'destructive';
  if (trigger.includes('tier1') || trigger.includes('lockout')) return 'secondary';
  return 'outline';
}

function DiagnosticCard({ event }: { event: DiagnosticEvent }) {
  const [expanded, setExpanded] = useState(false);
  const data = event.eventData || {};
  const session = data.session || {};
  const device = data.device || {};
  const audio = data.audio || {};
  const sentences = data.sentenceTracking || {};
  const hookState = data.hookState || {};
  const timing = data.timing || {};
  const timeline = data.timeline || [];
  const ws = data.ws || {};

  const isMobile = (device.screenWidth || 0) < 768;
  const timeAgo = getTimeAgo(event.createdAt);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={triggerSeverity(event.eventType)} data-testid={`badge-trigger-${event.id}`}>
              {triggerLabel(event.eventType)}
            </Badge>
            <span className="text-sm text-muted-foreground">{timeAgo}</span>
            {isMobile && <Badge variant="outline"><Monitor className="h-3 w-3 mr-1" /> Mobile</Badge>}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-${event.id}`}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
          <div>
            <div className="text-muted-foreground">User</div>
            <div className="font-mono text-xs">{event.userId?.substring(0, 10) || '?'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Language</div>
            <div>{session.language || '?'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Playback State</div>
            <div className="font-mono">{audio.globalPlaybackState || '?'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">AudioContext</div>
            <div className="font-mono">{audio.audioContextState || '?'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
          <div>
            <div className="text-muted-foreground">Expected Sentences</div>
            <div className="font-mono">{sentences.expectedSentenceCount ?? 'null'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Schedule Size</div>
            <div className="font-mono">{sentences.sentenceScheduleSize ?? '?'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">CheckAll Result</div>
            <div className="font-mono">{sentences.lastCheckAllResult === null ? 'null' : String(sentences.lastCheckAllResult)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">CheckAll Reason</div>
            <div className="font-mono text-xs truncate" title={sentences.lastCheckAllReason}>{sentences.lastCheckAllReason || '?'}</div>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-medium">Hook State</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">isProcessing</div>
                <div className="font-mono">{String(hookState.isProcessing ?? '?')}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">pendingAudio</div>
                <div className="font-mono">{hookState.pendingAudioCount ?? '?'}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">audioReceived</div>
                <div className="font-mono">{String(hookState.audioReceivedInTurn ?? '?')}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">responseComplete</div>
                <div className="font-mono">{String(hookState.responseCompleteReceived ?? '?')}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">switchingTutor</div>
                <div className="font-mono">{String(hookState.isSwitchingTutor ?? '?')}</div>
              </div>
            </div>

            <div className="text-sm font-medium">Audio Details</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">Total Chunks</div>
                <div className="font-mono">{audio.totalAudioChunksReceived ?? 0}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">Loop Running</div>
                <div className="font-mono">{String(audio.isLoopRunning ?? '?')}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">Loop Ticks</div>
                <div className="font-mono">{audio.loopTickCount ?? 0}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">Ctx Time</div>
                <div className="font-mono">{(audio.currentCtxTime || 0).toFixed(2)}s</div>
              </div>
            </div>

            <div className="text-sm font-medium">Timing</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">Since response_complete</div>
                <div className="font-mono">{timing.timeSinceResponseComplete ? `${(timing.timeSinceResponseComplete / 1000).toFixed(1)}s` : 'N/A'}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">Since first audio</div>
                <div className="font-mono">{timing.timeSinceFirstAudio ? `${(timing.timeSinceFirstAudio / 1000).toFixed(1)}s` : 'N/A'}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">Session duration</div>
                <div className="font-mono">{data.sessionDurationMs ? `${(data.sessionDurationMs / 1000).toFixed(0)}s` : 'N/A'}</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="text-muted-foreground">Failsafe</div>
                <div className="font-mono">{timing.failsafeTier || 'none'}</div>
              </div>
            </div>

            {sentences.sentenceScheduleEntries?.length > 0 && (
              <>
                <div className="text-sm font-medium">Sentence Schedule</div>
                <div className="text-xs font-mono bg-muted rounded p-2 overflow-auto">
                  {sentences.sentenceScheduleEntries.map((s: any, i: number) => (
                    <div key={i}>
                      S{s.sentenceIndex}: started={String(s.started)} ended={String(s.ended)} endCtxTime={String(s.hasEndCtxTime)} dur={s.totalDuration?.toFixed(2)}s
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="text-sm font-medium">Device</div>
            <div className="text-xs font-mono bg-muted rounded p-2 overflow-auto">
              <div>{device.userAgent || 'unknown'}</div>
              <div>Screen: {device.screenWidth || 0}x{device.screenHeight || 0} @{device.devicePixelRatio || 1}x | Online: {String(device.online ?? '?')} | Net: {device.connectionType || '?'}</div>
            </div>

            <div className="text-sm font-medium">WS Messages</div>
            <div className="text-xs font-mono bg-muted rounded p-2">
              Count: {ws.wsMessageCount || 0} | Last: {ws.wsLastMessageType || '?'} | response_complete: {String(ws.wsResponseCompleteReceived)}
              {ws.recentMessageTypes?.length > 0 && (
                <div className="mt-1">Recent: [{ws.recentMessageTypes.join(', ')}]</div>
              )}
            </div>

            {timeline.length > 0 && (
              <>
                <div className="text-sm font-medium">Event Timeline</div>
                <div className="text-xs font-mono bg-muted rounded p-2 max-h-48 overflow-auto">
                  {timeline.map((ev: any, i: number) => (
                    <div key={i}>
                      {new Date(ev.t).toISOString().substring(11, 23)} {ev.event}
                      {ev.data ? ` ${JSON.stringify(ev.data)}` : ''}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="text-xs text-muted-foreground">
              Conversation: {session.conversationId || '?'} | Input: {session.inputMode || '?'} | TTS: {session.ttsProvider || '?'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function ClientDiagnosticsViewer() {
  const { data, isLoading, refetch } = useQuery<{ diagnostics: DiagnosticEvent[]; count: number }>({
    queryKey: ['/api/voice/client-diagnostics'],
    refetchInterval: 30000,
  });

  const diagnostics = data?.diagnostics || [];

  const lockoutCount = diagnostics.filter(d => d.eventType.includes('lockout') || d.eventType.includes('failsafe')).length;
  const errorCount = diagnostics.filter(d => d.eventType.includes('error')).length;
  const silenceCount = diagnostics.filter(d => d.eventType.includes('silence')).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Client Voice Diagnostics
          </h3>
          <p className="text-sm text-muted-foreground">
            Auto-captured snapshots from user devices when voice issues are detected
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-diagnostics">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-2 pt-4">
            <Volume2 className="h-4 w-4 text-destructive" />
            <div>
              <div className="text-xl font-bold" data-testid="text-lockout-count">{lockoutCount}</div>
              <div className="text-xs text-muted-foreground">Lockouts</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 pt-4">
            <Wifi className="h-4 w-4 text-orange-500" />
            <div>
              <div className="text-xl font-bold" data-testid="text-error-count">{errorCount}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 pt-4">
            <Clock className="h-4 w-4 text-yellow-500" />
            <div>
              <div className="text-xl font-bold" data-testid="text-silence-count">{silenceCount}</div>
              <div className="text-xs text-muted-foreground">Silence</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading diagnostics...</div>
      ) : diagnostics.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No client diagnostic reports yet. They appear automatically when users experience voice issues.
        </div>
      ) : (
        <div className="space-y-3">
          {diagnostics.map(event => (
            <DiagnosticCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
