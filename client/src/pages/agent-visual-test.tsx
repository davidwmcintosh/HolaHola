import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResolvedWord {
  text?: string;
  word?: string;
  translation?: string;
  imageQuery?: string;
  imageUrl: string | null;
}

interface VisualEvent {
  type: string;
  data: Record<string, unknown>;
  imageUrl?: string | null;
  resolvedWords?: ResolvedWord[];
}

interface DemoResult {
  transcript: string;
  toolCallsSummary: Array<{ name: string; args: Record<string, unknown> }>;
  visualEvents: VisualEvent[];
  audioDurationS: number;
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

interface HistoryEntry {
  id: string;
  ts: number;
  label: string;
  lang: string;
  coverage: CoverageScore;
  transcriptSnippet: string;
  toolNames: string[];
}

// ─── Scenario presets ─────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    label: "ES · Restaurant",
    lang: "es-ES",
    text: "Hola Daniela. Quiero practicar español. Me gustan los restaurantes y la comida. ¿Puedes mostrarme vocabulario de restaurante con imágenes?",
  },
  {
    label: "ES · Travel",
    lang: "es-ES",
    text: "Hola Daniela. Voy a viajar por España. ¿Puedes mostrarme vocabulario de viajes y transporte con imágenes?",
  },
  {
    label: "ES · Shopping",
    lang: "es-ES",
    text: "Hola Daniela. Quiero practicar español. Me gusta ir de compras. ¿Puedes mostrarme vocabulario de tiendas y ropa con imágenes?",
  },
  {
    label: "FR · Restaurant",
    lang: "fr-FR",
    text: "Bonjour Daniela. Je veux pratiquer le français. J'aime les restaurants. Peux-tu me montrer du vocabulaire de restaurant avec des images?",
  },
  {
    label: "PT · Food",
    lang: "pt-BR",
    text: "Olá Daniela. Quero praticar português. Gosto de comida brasileira. Pode me mostrar vocabulário de comida com imagens?",
  },
  {
    label: "DE · Shopping",
    lang: "de-DE",
    text: "Hallo Daniela. Ich möchte Deutsch üben. Ich mag Einkaufen. Kannst du mir Einkaufsvokabular mit Bildern zeigen?",
  },
  {
    label: "IT · Hotel",
    lang: "it-IT",
    text: "Ciao Daniela. Voglio praticare italiano. Mi piacciono gli hotel. Puoi mostrarmi il vocabolario dell'hotel con immagini?",
  },
  {
    label: "JA · Greetings",
    lang: "ja-JP",
    text: "こんにちは、ダニエラ。日本語を練習したいです。挨拶と基本表現を画像付きで教えていただけますか？",
  },
];

// ─── Coverage helpers ─────────────────────────────────────────────────────────

function computeCoverage(result: DemoResult): CoverageScore {
  const sceneOk = result.visualEvents.some(e => e.type === "open_scene" && e.imageUrl);
  const vocabEv = result.visualEvents.find(e =>
    (e.type === "show_vocab_grid" || e.type === "create_vocabulary_drill") && e.resolvedWords?.length
  );
  const vocabOk = !!vocabEv;
  const imageTotal = vocabEv?.resolvedWords?.length ?? 0;
  const imageHits = vocabEv?.resolvedWords?.filter(w => w.imageUrl).length ?? 0;
  const audioOk = result.audioDurationS > 0;
  const transcriptChars = result.transcript.length;
  return { sceneOk, vocabOk, imageHits, imageTotal, audioOk, transcriptChars };
}

function coverageGrade(c: CoverageScore): "pass" | "partial" | "fail" {
  const pct = c.imageTotal > 0 ? c.imageHits / c.imageTotal : 0;
  if (c.sceneOk && c.vocabOk && c.audioOk && pct >= 0.8) return "pass";
  if (c.sceneOk || c.vocabOk) return "partial";
  return "fail";
}

function gradeColor(g: "pass" | "partial" | "fail") {
  return g === "pass" ? "text-green-600" : g === "partial" ? "text-yellow-600" : "text-red-500";
}

const HISTORY_KEY = "hh_agent_visual_history";

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CoveragePanel({ c }: { c: CoverageScore }) {
  const grade = coverageGrade(c);
  const imgPct = c.imageTotal > 0 ? Math.round((c.imageHits / c.imageTotal) * 100) : 0;
  return (
    <div className="border rounded-md px-4 py-3 space-y-2" data-testid="coverage-panel">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coverage</p>
        <span className={`text-xs font-bold uppercase ${gradeColor(grade)}`} data-testid="coverage-grade">
          {grade}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={c.sceneOk ? "text-green-500" : "text-red-400"}>●</span>
          <span className="text-muted-foreground">Scene</span>
          <span className="ml-auto font-medium">{c.sceneOk ? "✓" : "✗"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={c.vocabOk ? "text-green-500" : "text-red-400"}>●</span>
          <span className="text-muted-foreground">Vocab grid</span>
          <span className="ml-auto font-medium">{c.vocabOk ? `✓ (${c.imageTotal}w)` : "✗"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={imgPct >= 80 ? "text-green-500" : imgPct > 0 ? "text-yellow-500" : "text-red-400"}>●</span>
          <span className="text-muted-foreground">Images</span>
          <span className="ml-auto font-medium">{c.imageHits}/{c.imageTotal} ({imgPct}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={c.audioOk ? "text-green-500" : "text-red-400"}>●</span>
          <span className="text-muted-foreground">Audio</span>
          <span className="ml-auto font-medium">{c.audioOk ? "✓" : "✗"}</span>
        </div>
        <div className="flex items-center gap-1.5 col-span-2">
          <span className={c.transcriptChars > 0 ? "text-green-500" : "text-red-400"}>●</span>
          <span className="text-muted-foreground">Transcript</span>
          <span className="ml-auto font-medium">{c.transcriptChars} chars</span>
        </div>
      </div>
    </div>
  );
}

function HistoryTable({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) {
  const [open, setOpen] = useState(true);
  if (history.length === 0) return null;
  return (
    <div className="shrink-0 border-t" data-testid="history-section">
      <button
        className="w-full flex items-center gap-2 px-5 py-2 text-xs font-semibold text-muted-foreground hover-elevate"
        onClick={() => setOpen(o => !o)}
        data-testid="history-toggle"
      >
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        Run History ({history.length})
        <button
          className="ml-auto text-muted-foreground/60 hover:text-muted-foreground"
          onClick={e => { e.stopPropagation(); onClear(); }}
          data-testid="button-clear-history"
        >
          <RotateCcw size={11} />
        </button>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="px-4 py-1.5 font-medium w-36">Time</th>
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
              {history.map(h => {
                const grade = coverageGrade(h.coverage);
                const imgPct = h.coverage.imageTotal > 0
                  ? Math.round((h.coverage.imageHits / h.coverage.imageTotal) * 100) : 0;
                const d = new Date(h.ts);
                const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                return (
                  <tr key={h.id} className="border-b border-border/40 hover-elevate" data-testid={`history-row-${h.id}`}>
                    <td className="px-4 py-1.5 text-muted-foreground font-mono">{timeStr}</td>
                    <td className="px-2 py-1.5">
                      <span className="font-medium">{h.label}</span>
                    </td>
                    <td className={`px-2 py-1.5 font-bold uppercase ${gradeColor(grade)}`}>{grade}</td>
                    <td className="px-2 py-1.5">{h.coverage.sceneOk ? "✓" : "✗"}</td>
                    <td className="px-2 py-1.5">{h.coverage.vocabOk ? `✓ ${h.coverage.imageTotal}w` : "✗"}</td>
                    <td className={`px-2 py-1.5 ${imgPct >= 80 ? "text-green-600" : imgPct > 0 ? "text-yellow-600" : "text-red-500"}`}>
                      {h.coverage.imageHits}/{h.coverage.imageTotal} ({imgPct}%)
                    </td>
                    <td className="px-2 py-1.5">{h.coverage.audioOk ? "✓" : "✗"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">{h.transcriptSnippet}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentVisualTest() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [customText, setCustomText] = useState(SCENARIOS[0].text);
  const [customLang, setCustomLang] = useState(SCENARIOS[0].lang);
  const [elapsedS, setElapsedS] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  // Elapsed timer while running
  useEffect(() => {
    if (status === "running") {
      setElapsedS(0);
      timerRef.current = setInterval(() => setElapsedS(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const pickScenario = (idx: number) => {
    setSelectedScenario(idx);
    setCustomText(SCENARIOS[idx].text);
    setCustomLang(SCENARIOS[idx].lang);
  };

  const runDemo = useCallback(async () => {
    setStatus("running");
    setResult(null);
    try {
      const resp = await fetch("/api/admin/agent-visual-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: customText, languageCode: customLang }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error((err as { error?: string }).error || resp.statusText);
      }
      const data: DemoResult = await resp.json();
      setResult(data);
      setStatus("done");

      if (data.audioWav && audioRef.current) {
        audioRef.current.src = `data:audio/wav;base64,${data.audioWav}`;
        audioRef.current.play().catch(() => {});
      }

      // Save to history
      const cov = computeCoverage(data);
      const entry: HistoryEntry = {
        id: Date.now().toString(36),
        ts: Date.now(),
        label: SCENARIOS[selectedScenario]?.label ?? customLang,
        lang: customLang,
        coverage: cov,
        transcriptSnippet: data.transcript.slice(0, 80),
        toolNames: data.toolCallsSummary.map(t => t.name),
      };
      setHistory(prev => {
        const next = [entry, ...prev];
        saveHistory(next);
        return next;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Demo failed", description: msg, variant: "destructive" });
      setStatus("error");
    }
  }, [customText, customLang, selectedScenario, toast]);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  // Derive visual events
  const sceneEvent = result?.visualEvents.find(e => e.type === "open_scene" && e.imageUrl);
  const vocabEvent = result?.visualEvents.find(e =>
    (e.type === "show_vocab_grid" || e.type === "create_vocabulary_drill") && e.resolvedWords?.length
  );
  const singleImageEvent = result?.visualEvents.find(e =>
    (e.type === "show_image" || e.type === "show_cultural_scene") && e.imageUrl
  );

  const studioImage = sceneEvent?.imageUrl || singleImageEvent?.imageUrl || null;
  const studioLabel = (sceneEvent?.data?.environment as string) || (singleImageEvent?.data?.word as string) || null;
  const coverage = result ? computeCoverage(result) : null;

  return (
    <div className="h-full flex flex-col bg-background" data-testid="agent-visual-test-page">

      {/* ── Header ── */}
      <div className="shrink-0 border-b px-5 py-2.5 flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-sm font-semibold leading-tight">Observer Seat — Daniela's Session</h1>
          <p className="text-xs text-muted-foreground">Watch the visual layer fire in real time</p>
        </div>
        <Badge
          variant={status === "done" ? "default" : status === "error" ? "destructive" : "secondary"}
          className="ml-1"
          data-testid="status-badge"
        >
          {status === "idle" ? "Ready" :
           status === "running" ? `Running… ${elapsedS}s` :
           status === "done" ? "Done" : "Error"}
        </Badge>
        <div className="flex-1" />
        <Button
          onClick={runDemo}
          disabled={status === "running"}
          data-testid="button-run-demo"
        >
          {status === "running" ? "Watching…" : "Run Session"}
        </Button>
      </div>

      {/* ── Scenario presets ── */}
      <div className="shrink-0 border-b bg-muted/20 px-5 py-2 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-muted-foreground shrink-0 mr-1">Scenario:</span>
        {SCENARIOS.map((s, i) => (
          <button
            key={i}
            onClick={() => pickScenario(i)}
            className={`shrink-0 text-xs px-2.5 py-1 rounded-md border transition-colors ${
              selectedScenario === i
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover-elevate"
            }`}
            data-testid={`scenario-btn-${i}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Prompt bar ── */}
      <div className="shrink-0 border-b bg-muted/10 px-5 py-2 flex items-start gap-2">
        <textarea
          className="flex-1 h-10 text-xs bg-background border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          data-testid="input-demo-text"
        />
        <select
          className="h-10 text-xs bg-background border rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-ring"
          value={customLang}
          onChange={e => setCustomLang(e.target.value)}
          data-testid="select-language"
        >
          <option value="es-ES">es-ES</option>
          <option value="fr-FR">fr-FR</option>
          <option value="pt-BR">pt-BR</option>
          <option value="de-DE">de-DE</option>
          <option value="it-IT">it-IT</option>
          <option value="ja-JP">ja-JP</option>
          <option value="zh-CN">zh-CN</option>
          <option value="ko-KR">ko-KR</option>
          <option value="ru-RU">ru-RU</option>
          <option value="ar-SA">ar-SA</option>
        </select>
      </div>

      {/* ── Three-panel layout ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT: Studio */}
        <div className="w-64 shrink-0 border-r flex flex-col" data-testid="studio-panel">
          <div className="shrink-0 px-4 py-2 border-b flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Studio</span>
            {studioImage && <div className="ml-auto w-2 h-2 rounded-full bg-green-500" />}
          </div>
          <div className="flex-1 relative overflow-hidden bg-black/5 dark:bg-white/5">
            {studioImage ? (
              <div className="relative w-full h-full" data-testid="scene-image-container">
                <img
                  src={studioImage}
                  alt={studioLabel || "scene"}
                  className="w-full h-full object-cover"
                  data-testid="scene-image"
                />
                {studioLabel && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-3">
                    <p className="text-white text-xs font-medium capitalize" data-testid="scene-label">
                      {studioLabel.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-6 text-center" data-testid="studio-empty">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <p className="text-xs">Scene appears when Daniela calls open_scene</p>
              </div>
            )}
          </div>

          {/* Audio */}
          <div className="shrink-0 border-t px-3 py-2" data-testid="audio-section">
            {result?.audioWav ? (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Daniela's voice — {result.audioDurationS.toFixed(1)}s
                </p>
                <audio
                  ref={audioRef}
                  controls
                  className="w-full"
                  data-testid="audio-player"
                  style={{ height: '32px' }}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground" data-testid="audio-empty">
                {status === "running" ? "Recording audio…" : "Audio plays after session"}
              </p>
            )}
          </div>
        </div>

        {/* CENTER: Session */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="shrink-0 px-4 py-2 border-b flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" data-testid="transcript-area">
            {status === "running" && (
              <div className="flex items-center gap-3 text-muted-foreground" data-testid="loading-indicator">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-medium">Daniela is responding</p>
                  <p className="text-xs">GL session active — tools fire in ~10s</p>
                </div>
              </div>
            )}

            {result?.transcript && (
              <div className="bg-muted/30 rounded-lg px-4 py-3" data-testid="transcript-text">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Daniela said</p>
                <p className="text-sm leading-relaxed">{result.transcript}</p>
              </div>
            )}

            {/* Coverage score */}
            {coverage && <CoveragePanel c={coverage} />}

            {result && result.toolCallsSummary.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="no-tools-message">
                No visual tools fired. Try a more specific prompt asking for vocabulary with images.
              </p>
            )}

            {result && result.toolCallsSummary.length > 0 && (
              <div data-testid="tool-log">
                <p className="text-xs font-medium text-muted-foreground mb-2">Tools fired</p>
                <div className="space-y-1.5">
                  {result.toolCallsSummary.map((tc, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs" data-testid={`tool-row-${i}`}>
                      <Badge variant="outline" className="shrink-0 text-xs font-mono" data-testid={`tool-badge-${tc.name}`}>
                        {tc.name}
                      </Badge>
                      <span className="text-muted-foreground truncate">
                        {Object.entries(tc.args)
                          .filter(([k]) => k !== 'params_json')
                          .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 40)}`)
                          .join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="shrink-0 border-t px-5 py-2 flex items-center gap-4 text-xs text-muted-foreground" data-testid="stats-footer">
              <span>{result.audioDurationS.toFixed(1)}s audio</span>
              <span>{result.toolCallsSummary.length} tools</span>
              <span>{result.visualEvents.length} visual events</span>
              <span>{result.transcript.length} chars</span>
            </div>
          )}
        </div>

        {/* RIGHT: Whiteboard */}
        <div className="w-80 shrink-0 border-l flex flex-col" data-testid="whiteboard-panel">
          <div className="shrink-0 px-4 py-2 border-b flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Whiteboard</span>
            {vocabEvent && <div className="ml-auto w-2 h-2 rounded-full bg-green-500" />}
          </div>
          <div className="flex-1 overflow-y-auto p-3" data-testid="whiteboard-content">
            {vocabEvent?.resolvedWords && vocabEvent.resolvedWords.length > 0 ? (
              <div data-testid="vocab-grid">
                {!!vocabEvent.data.title && (
                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">
                    {String(vocabEvent.data.title)}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {vocabEvent.resolvedWords.map((w, i) => {
                    const word = w.text || w.word || '';
                    const trans = w.translation || '';
                    return (
                      <div key={i} className="border rounded-md overflow-hidden bg-card" data-testid={`vocab-card-${i}`}>
                        {w.imageUrl ? (
                          <img src={w.imageUrl} alt={word} className="w-full h-[90px] object-cover" data-testid={`vocab-image-${i}`} />
                        ) : (
                          <div className="w-full h-[90px] bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">No image</span>
                          </div>
                        )}
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-semibold leading-tight" data-testid={`vocab-word-${i}`}>{word}</p>
                          {trans && <p className="text-xs text-muted-foreground mt-0.5" data-testid={`vocab-translation-${i}`}>{trans}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-6 text-center" data-testid="whiteboard-empty">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="13" rx="2"/>
                    <path d="M8 21h8M12 16v5"/>
                    <path d="M7 8h10M7 11h6"/>
                  </svg>
                </div>
                <p className="text-xs">Vocabulary grid appears when Daniela calls show_vocab_grid</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Run history ── */}
      <HistoryTable history={history} onClear={clearHistory} />

    </div>
  );
}
