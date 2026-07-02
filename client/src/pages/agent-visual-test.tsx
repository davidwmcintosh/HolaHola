import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ResolvedWord {
  text?: string;
  word?: string;
  translation?: string;
  imageQuery?: string;
  imageUrl: string | null;
}

interface VisualEvent {
  type: string;
  data: Record<string, any>;
  imageUrl?: string | null;
  resolvedWords?: ResolvedWord[];
}

interface DemoResult {
  transcript: string;
  toolCallsSummary: Array<{ name: string; args: Record<string, any> }>;
  visualEvents: VisualEvent[];
  audioDurationS: number;
  audioWav: string | null;
}

const DEFAULT_PROMPT = "Hola Daniela. Quiero practicar español. Me gustan los restaurantes y la comida española. ¿Puedes mostrarme vocabulario con imágenes?";

export default function AgentVisualTest() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [customText, setCustomText] = useState(DEFAULT_PROMPT);
  const [elapsedS, setElapsedS] = useState(0);
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

  const runDemo = useCallback(async () => {
    setStatus("running");
    setResult(null);
    const t0 = Date.now();
    try {
      const resp = await fetch("/api/admin/agent-visual-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: customText, languageCode: "es-ES" }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || resp.statusText);
      }
      const data: DemoResult = await resp.json();
      setResult(data);
      setStatus("done");

      // Auto-play audio if returned
      if (data.audioWav && audioRef.current) {
        const src = `data:audio/wav;base64,${data.audioWav}`;
        audioRef.current.src = src;
        audioRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      toast({ title: "Demo failed", description: err.message, variant: "destructive" });
      setStatus("error");
    }
  }, [customText, toast]);

  // Derive key visual events from result
  const sceneEvent = result?.visualEvents.find(e => e.type === "open_scene" && e.imageUrl);
  const vocabEvent = result?.visualEvents.find(e =>
    (e.type === "show_vocab_grid" || e.type === "create_vocabulary_drill") && e.resolvedWords?.length
  );
  const singleImageEvent = result?.visualEvents.find(e =>
    (e.type === "show_image" || e.type === "show_cultural_scene") && e.imageUrl
  );

  const studioImage = sceneEvent?.imageUrl || singleImageEvent?.imageUrl || null;
  const studioLabel = sceneEvent?.data?.environment || singleImageEvent?.data?.word || null;

  return (
    <div className="h-full flex flex-col bg-background" data-testid="agent-visual-test-page">
      {/* ── Header ── */}
      <div className="shrink-0 border-b px-5 py-2.5 flex items-center gap-3">
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

      {/* ── Prompt bar ── */}
      <div className="shrink-0 border-b bg-muted/20 px-5 py-2">
        <textarea
          className="w-full h-12 text-xs bg-background border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          data-testid="input-demo-text"
        />
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
                <p className="text-xs">Scene will appear when Daniela calls open_scene</p>
              </div>
            )}
          </div>

          {/* Audio player */}
          <div className="shrink-0 border-t px-3 py-2" data-testid="audio-section">
            {result?.audioWav ? (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Daniela's voice — {result.audioDurationS.toFixed(1)}s
                </p>
                <audio
                  ref={audioRef}
                  controls
                  className="w-full h-8"
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

        {/* CENTER: Transcript + activity */}
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
                  <p className="text-xs">GL session active — tools fire in ~10s, audio resolves images after</p>
                </div>
              </div>
            )}

            {/* Transcript */}
            {result?.transcript && (
              <div className="bg-muted/30 rounded-lg px-4 py-3" data-testid="transcript-text">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Daniela said</p>
                <p className="text-sm leading-relaxed">{result.transcript}</p>
              </div>
            )}

            {/* No-tools notice */}
            {result && result.toolCallsSummary.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="no-tools-message">
                No visual tools fired. Try a more specific prompt asking for vocabulary with images.
              </p>
            )}

            {/* Tool call log */}
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

          {/* Stats footer */}
          {result && (
            <div className="shrink-0 border-t px-5 py-2 flex items-center gap-4 text-xs text-muted-foreground" data-testid="stats-footer">
              <span>{result.audioDurationS.toFixed(1)}s audio</span>
              <span>{result.toolCallsSummary.length} tools</span>
              <span>{result.visualEvents.length} visual events</span>
              <span>{result.transcript.length} chars transcript</span>
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
                {vocabEvent.data.title && (
                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">
                    {vocabEvent.data.title}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {vocabEvent.resolvedWords.map((w, i) => {
                    const word = w.text || w.word || '';
                    const trans = w.translation || '';
                    return (
                      <div
                        key={i}
                        className="border rounded-md overflow-hidden bg-card"
                        data-testid={`vocab-card-${i}`}
                      >
                        {w.imageUrl ? (
                          <img
                            src={w.imageUrl}
                            alt={word}
                            className="w-full h-[90px] object-cover"
                            data-testid={`vocab-image-${i}`}
                          />
                        ) : (
                          <div className="w-full h-[90px] bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">No image</span>
                          </div>
                        )}
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-semibold leading-tight" data-testid={`vocab-word-${i}`}>{word}</p>
                          {trans && (
                            <p className="text-xs text-muted-foreground mt-0.5" data-testid={`vocab-translation-${i}`}>{trans}</p>
                          )}
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
    </div>
  );
}
