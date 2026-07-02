import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResolvedWord {
  text?: string;
  word?: string;
  translation?: string;
  imageUrl: string | null;
}

interface VisualEvent {
  type: string;
  data: Record<string, unknown>;
  imageUrl?: string | null;
  resolvedWords?: ResolvedWord[];
}

interface DemoResult {
  runId?: string | null;
  transcript: string;
  toolCallsSummary: Array<{ name: string; args: Record<string, unknown> }>;
  visualEvents: VisualEvent[];
  audioDurationS: number;
  audioUrl?: string | null;
  audioWav: string | null;
}

interface CoverageScore {
  sceneOk: boolean;
  vocabOk: boolean;
  imageHits: number;
  imageTotal: number;
  audioOk: boolean;
  transcriptChars: number;
}

interface FullRun {
  id: string;
  runAt: string;
  scenarioLabel: string;
  language: string;
  transcript: string;
  toolCallsJson: Array<{ name: string; args: Record<string, unknown> }>;
  visualEventsJson: VisualEvent[];
  coverageJson: CoverageScore;
  audioDurationS: number;
  audioUrl: string | null;
  grade: string;
}

interface HistoryRow {
  id: string;
  runAt: string;
  scenarioLabel: string;
  language: string;
  grade: string;
  audioDurationS: number;
  audioUrl: string | null;
  coverageJson: CoverageScore;
  transcriptSnippet: string;
}

// ─── ACTFL levels ─────────────────────────────────────────────────────────────

const ACTFL_LEVELS = [
  { value: 'novice_low',        label: 'Novice Low' },
  { value: 'novice_mid',        label: 'Novice Mid' },
  { value: 'novice_high',       label: 'Novice High' },
  { value: 'intermediate_low',  label: 'Intermediate Low' },
  { value: 'intermediate_mid',  label: 'Intermediate Mid' },
  { value: 'intermediate_high', label: 'Intermediate High' },
  { value: 'advanced_low',      label: 'Advanced Low' },
];

// ─── Scenario presets ─────────────────────────────────────────────────────────

const SCENARIOS = [
  { label: 'ES · Restaurant', lang: 'es-ES', text: 'Hola Daniela. Quiero practicar español. Me gustan los restaurantes y la comida. ¿Puedes mostrarme vocabulario de restaurante con imágenes?' },
  { label: 'ES · Travel',     lang: 'es-ES', text: 'Hola Daniela. Quiero practicar español de viajes. ¿Puedes mostrarme vocabulario del aeropuerto y el hotel con imágenes?' },
  { label: 'ES · Weather',    lang: 'es-ES', text: 'Hola Daniela. Quiero aprender vocabulario del tiempo en español. ¿Puedes mostrarme las palabras del clima con imágenes?' },
  { label: 'ES · Shopping',   lang: 'es-ES', text: 'Hola Daniela. Quiero aprender vocabulario de las compras en español. ¿Puedes mostrarme palabras de tiendas y mercados?' },
  { label: 'FR · Restaurant', lang: 'fr-FR', text: "Bonjour Daniela. Je veux pratiquer le français. J'adore les restaurants. Peux-tu me montrer du vocabulaire de restaurant avec des images?" },
  { label: 'PT · Food',       lang: 'pt-BR', text: 'Olá Daniela. Quero praticar português. Adoro comida brasileira. Pode me mostrar vocabulário de comida com imagens?' },
  { label: 'DE · Shopping',   lang: 'de-DE', text: 'Hallo Daniela. Ich möchte Deutsch üben. Kannst du mir Einkaufsvokabular mit Bildern zeigen?' },
  { label: 'IT · Hotel',      lang: 'it-IT', text: "Ciao Daniela. Voglio praticare l'italiano. Puoi mostrarmi vocabolario dell'hotel con immagini?" },
];

// ─── Coverage helpers ─────────────────────────────────────────────────────────

function computeCoverage(data: Pick<DemoResult, 'visualEvents' | 'audioDurationS' | 'transcript'>): CoverageScore {
  const sceneOk = data.visualEvents.some(e => e.type === 'open_scene' || e.type === 'show_cultural_scene');
  const vocabOk = data.visualEvents.some(e => e.type === 'show_vocab_grid' || e.type === 'create_vocabulary_drill');
  const allWords = data.visualEvents.flatMap(e => e.resolvedWords ?? []);
  const imageHits = allWords.filter(w => w.imageUrl).length;
  const imageTotal = allWords.length;
  const audioOk = data.audioDurationS > 0.5;
  return { sceneOk, vocabOk, imageHits, imageTotal, audioOk, transcriptChars: data.transcript.length };
}

function coverageGrade(c: CoverageScore): 'PASS' | 'PARTIAL' | 'FAIL' {
  const imgOk = c.imageTotal === 0 || c.imageHits / c.imageTotal >= 0.8;
  if (c.sceneOk && c.vocabOk && c.audioOk && c.transcriptChars > 100 && imgOk) return 'PASS';
  if (c.sceneOk || c.vocabOk || c.audioOk) return 'PARTIAL';
  return 'FAIL';
}

function gradeColor(g: string) {
  if (g === 'PASS') return 'text-green-600 dark:text-green-400';
  if (g === 'PARTIAL') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-500';
}

// ─── History table ────────────────────────────────────────────────────────────

function HistoryTable({ rows, loading, selectedId, onSelect, onRefresh }: {
  rows: HistoryRow[]; loading: boolean; selectedId: string | null;
  onSelect: (id: string) => void; onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0 border-t bg-muted/30">
      <button
        className="w-full flex items-center gap-2 px-5 py-2 text-xs font-medium text-muted-foreground hover-elevate"
        onClick={() => { setOpen(o => !o); if (!open) onRefresh(); }}
        data-testid="button-toggle-history"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        Run history ({rows.length})
        <span className="ml-auto text-xs opacity-60">Click a row to replay</span>
      </button>
      {open && (
        <div className="overflow-x-auto max-h-52 overflow-y-auto">
          {loading ? (
            <p className="px-5 py-3 text-xs text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-3 text-xs text-muted-foreground">No runs yet.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="px-4 py-1.5 font-medium w-32">Time</th>
                  <th className="px-2 py-1.5 font-medium">Scenario</th>
                  <th className="px-2 py-1.5 font-medium">Grade</th>
                  <th className="px-2 py-1.5 font-medium">Scene</th>
                  <th className="px-2 py-1.5 font-medium">Vocab</th>
                  <th className="px-2 py-1.5 font-medium">Images</th>
                  <th className="px-2 py-1.5 font-medium">Audio</th>
                  <th className="px-2 py-1.5 font-medium min-w-48">Transcript</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(h => {
                  const c = h.coverageJson;
                  const imgPct = c.imageTotal > 0 ? Math.round((c.imageHits / c.imageTotal) * 100) : 0;
                  const d = new Date(h.runAt);
                  const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                  return (
                    <tr
                      key={h.id}
                      className={`border-b border-border/40 hover-elevate cursor-pointer ${h.id === selectedId ? 'bg-primary/10' : ''}`}
                      onClick={() => onSelect(h.id)}
                      data-testid={`history-row-${h.id}`}
                    >
                      <td className="px-4 py-1.5 text-muted-foreground font-mono">{timeStr}</td>
                      <td className="px-2 py-1.5 font-medium">{h.scenarioLabel}</td>
                      <td className={`px-2 py-1.5 font-bold uppercase ${gradeColor(h.grade)}`}>{h.grade}</td>
                      <td className="px-2 py-1.5">{c.sceneOk ? '✓' : '✗'}</td>
                      <td className="px-2 py-1.5">{c.vocabOk ? `✓ ${c.imageTotal}w` : '✗'}</td>
                      <td className={`px-2 py-1.5 ${imgPct >= 80 ? 'text-green-600' : imgPct > 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {c.imageHits}/{c.imageTotal} ({imgPct}%)
                      </td>
                      <td className="px-2 py-1.5">{c.audioOk ? '✓' : '✗'}</td>
                      <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">{h.transcriptSnippet}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Visual panel helpers ─────────────────────────────────────────────────────

function deriveVisuals(events: VisualEvent[]) {
  const sceneEvent = events.find(e => e.type === 'open_scene' && e.imageUrl);
  const vocabEvent = events.find(e =>
    (e.type === 'show_vocab_grid' || e.type === 'create_vocabulary_drill') && e.resolvedWords?.length
  );
  const singleImage = events.find(e =>
    (e.type === 'show_image' || e.type === 'show_cultural_scene') && e.imageUrl
  );
  return {
    vocabEvent,
    studioImage: sceneEvent?.imageUrl || singleImage?.imageUrl || null,
    studioLabel: (sceneEvent?.data?.environment as string) || (singleImage?.data?.word as string) || null,
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentVisualTest() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<DemoResult | null>(null);
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [selectedActfl, setSelectedActfl] = useState('novice_mid');
  const [elapsedS, setElapsedS] = useState(0);

  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<FullRun | null>(null);
  const [selectedRunLoading, setSelectedRunLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'running') {
      setElapsedS(0);
      timerRef.current = setInterval(() => setElapsedS(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const resp = await fetch('/api/admin/observer-seat/runs?limit=50', { credentials: 'include' });
      if (resp.ok) { const d = await resp.json(); setHistoryRows(d.runs ?? []); }
    } catch { /* silent */ } finally { setHistoryLoading(false); }
  }, []);

  const loadRun = useCallback(async (id: string) => {
    setSelectedRunId(id);
    setSelectedRun(null);
    setSelectedRunLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`/api/admin/observer-seat/runs/${id}`, { credentials: 'include' });
      if (resp.ok) {
        const d = await resp.json();
        setSelectedRun(d.run);
        if (d.run.audioUrl && audioRef.current) audioRef.current.src = d.run.audioUrl;
      } else {
        toast({ title: "Couldn't load run", variant: 'destructive' });
      }
    } catch (err: unknown) {
      toast({ title: 'Load failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally { setSelectedRunLoading(false); }
  }, [toast]);

  const runDemo = useCallback(async () => {
    setStatus('running');
    setResult(null);
    setSelectedRun(null);
    setSelectedRunId(null);
    const scenario = SCENARIOS[selectedScenario];
    const levelLabel = ACTFL_LEVELS.find(l => l.value === selectedActfl)?.label ?? selectedActfl;
    try {
      const resp = await fetch('/api/admin/agent-visual-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: scenario.text,
          languageCode: scenario.lang,
          scenarioLabel: `${scenario.label} [${levelLabel}]`,
          actflLevel: selectedActfl,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error((err as { error?: string }).error || resp.statusText);
      }
      const data: DemoResult = await resp.json();
      setResult(data);
      setStatus('done');
      if (audioRef.current) {
        if (data.audioUrl) audioRef.current.src = data.audioUrl;
        else if (data.audioWav) audioRef.current.src = `data:audio/wav;base64,${data.audioWav}`;
        audioRef.current.play().catch(() => {});
      }
      loadHistory();
    } catch (err: unknown) {
      toast({ title: 'Demo failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      setStatus('error');
    }
  }, [selectedScenario, selectedActfl, toast, loadHistory]);

  const displayEvents: VisualEvent[] = result?.visualEvents ?? selectedRun?.visualEventsJson ?? [];
  const displayTranscript = result?.transcript ?? selectedRun?.transcript ?? '';
  const displayTools = result?.toolCallsSummary ?? selectedRun?.toolCallsJson ?? [];
  const displayDuration = result?.audioDurationS ?? selectedRun?.audioDurationS ?? 0;
  const displayCoverage: CoverageScore | null = result
    ? computeCoverage(result)
    : selectedRun?.coverageJson ?? null;

  const { studioImage, studioLabel, vocabEvent } = deriveVisuals(displayEvents);
  const isHistorical = !result && !!selectedRun;

  return (
    <div className="h-full flex flex-col bg-background" data-testid="agent-visual-test-page">

      {/* ── Header ── */}
      <div className="shrink-0 border-b px-5 py-2.5 flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-sm font-semibold leading-tight">Observer Seat</h1>
          <p className="text-xs text-muted-foreground">
            {isHistorical
              ? `Replaying: ${selectedRun.scenarioLabel}`
              : "Luca's visual layer diagnostic"}
          </p>
        </div>
        {isHistorical && <Badge variant="secondary" className="text-xs">Replay</Badge>}
        <Badge variant={status === 'done' ? 'default' : status === 'error' ? 'destructive' : 'secondary'} data-testid="status-badge">
          {status === 'idle' ? 'Ready' : status === 'running' ? `Running… ${elapsedS}s` : status === 'done' ? 'Done' : 'Error'}
        </Badge>
        <div className="flex-1" />
        <Button onClick={runDemo} disabled={status === 'running'} data-testid="button-run-demo">
          {status === 'running' ? 'Watching…' : 'Run'}
        </Button>
      </div>

      {/* ── Scenario + level picker ── */}
      <div className="shrink-0 border-b px-5 py-2 flex items-center gap-2 flex-wrap">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.label}
            className={`px-2.5 py-1 rounded text-xs font-medium ${
              selectedScenario === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover-elevate'
            }`}
            onClick={() => setSelectedScenario(i)}
            data-testid={`scenario-${i}`}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">ACTFL:</span>
          <select
            className="text-xs border rounded px-2 py-1 bg-background"
            value={selectedActfl}
            onChange={e => setSelectedActfl(e.target.value)}
            data-testid="select-actfl-level"
          >
            {ACTFL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Three-panel layout ── */}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_1.6fr_1fr] divide-x">

        {/* Studio */}
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Studio</span>
            {studioLabel && <Badge variant="outline" className="text-xs font-mono">{studioLabel}</Badge>}
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-y-auto">
            {studioImage ? (
              <img src={studioImage} alt={studioLabel ?? 'scene'} className="w-full rounded-md object-cover" data-testid="studio-scene-image" />
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground text-center" data-testid="studio-empty">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="13" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="m21 15-5-5L5 21"/>
                  </svg>
                </div>
                <p className="text-xs">open_scene fires here</p>
              </div>
            )}
            <audio ref={audioRef} controls className="w-full" data-testid="audio-player" />
            {displayDuration > 0 && (
              <p className="text-xs text-muted-foreground text-center">{displayDuration.toFixed(1)}s</p>
            )}
          </div>
        </div>

        {/* Session */}
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2 border-b">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Session</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-3" data-testid="transcript-panel">
              {displayTranscript ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="transcript-text">{displayTranscript}</p>
              ) : selectedRunLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {status === 'running' ? 'Waiting for Daniela…' : 'Transcript appears here'}
                </p>
              )}
            </div>

            {displayTools.length > 0 && (
              <div className="border-t px-4 py-2 max-h-40 overflow-y-auto" data-testid="tool-log">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Tools ({displayTools.length})</p>
                {displayTools.map((t, i) => (
                  <div key={i} className="text-xs font-mono mb-1" data-testid={`tool-call-${i}`}>
                    <span className="text-foreground font-semibold">{t.name}</span>
                    {' '}
                    <span className="text-muted-foreground opacity-70">{JSON.stringify(t.args).slice(0, 80)}</span>
                  </div>
                ))}
              </div>
            )}

            {displayCoverage && (
              <div className="border-t px-4 py-2 flex items-center gap-3 flex-wrap" data-testid="coverage-footer">
                {(() => {
                  const grade = coverageGrade(displayCoverage);
                  const imgPct = displayCoverage.imageTotal > 0
                    ? Math.round((displayCoverage.imageHits / displayCoverage.imageTotal) * 100) : 0;
                  return (
                    <>
                      <span className={`text-sm font-bold ${gradeColor(grade)}`}>{grade}</span>
                      <span className="text-xs text-muted-foreground">Scene:{displayCoverage.sceneOk ? '✓' : '✗'}</span>
                      <span className="text-xs text-muted-foreground">Vocab:{displayCoverage.vocabOk ? `✓${displayCoverage.imageTotal > 0 ? ` ${displayCoverage.imageTotal}w` : ''}` : '✗'}</span>
                      <span className="text-xs text-muted-foreground">Img:{imgPct}%</span>
                      <span className="text-xs text-muted-foreground">Audio:{displayCoverage.audioOk ? '✓' : '✗'}</span>
                      <span className="text-xs text-muted-foreground">{displayCoverage.transcriptChars}ch</span>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Whiteboard */}
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2 border-b">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Whiteboard</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {vocabEvent?.resolvedWords?.length ? (
              <div data-testid="vocab-grid">
                {!!vocabEvent.data.title && (
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{String(vocabEvent.data.title)}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {vocabEvent.resolvedWords.map((w, i) => {
                    const word = w.text || w.word || '';
                    const trans = w.translation || '';
                    return (
                      <div key={i} className="border rounded-md overflow-hidden bg-card" data-testid={`vocab-card-${i}`}>
                        {w.imageUrl ? (
                          <img src={w.imageUrl} alt={word} className="w-full h-[90px] object-cover" />
                        ) : (
                          <div className="w-full h-[90px] bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">No image</span>
                          </div>
                        )}
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-semibold">{word}</p>
                          {trans && <p className="text-xs text-muted-foreground mt-0.5">{trans}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-center" data-testid="whiteboard-empty">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="13" rx="2"/>
                    <path d="M8 21h8M12 16v5"/>
                    <path d="M7 8h10M7 11h6"/>
                  </svg>
                </div>
                <p className="text-xs">show_vocab_grid fires here</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Run history ── */}
      <HistoryTable
        rows={historyRows} loading={historyLoading}
        selectedId={selectedRunId} onSelect={loadRun} onRefresh={loadHistory}
      />

    </div>
  );
}
