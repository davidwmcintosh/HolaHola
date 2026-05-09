import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, RotateCcw, Clock, AlertCircle, ImageOff, ChevronDown, ChevronUp, RefreshCw, X, ZoomIn } from "lucide-react";

// ─── Engine definitions ───────────────────────────────────────────────────────

const ENGINES = [
  {
    id: "dall-e-3",
    label: "DALL-E 3",
    sublabel: "Current scene pipeline",
    color: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800",
    badgeClass: "bg-green-600 text-white",
    promptType: "scene" as const,
  },
  {
    id: "gpt-image-1",
    label: "gpt-image-1",
    sublabel: "OpenAI — scene style",
    color: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
    badgeClass: "bg-blue-600 text-white",
    promptType: "scene" as const,
  },
  {
    id: "gpt-image-1-prop",
    label: "gpt-image-1 prop",
    sublabel: "OpenAI — white bg prop style",
    color: "bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800",
    badgeClass: "bg-sky-600 text-white",
    promptType: "prop" as const,
  },
  {
    id: "gemini-imagen",
    label: "Gemini image gen",
    sublabel: "gemini-2.5-flash-image — fast creative tier",
    color: "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800",
    badgeClass: "bg-purple-600 text-white",
    promptType: "scene" as const,
  },
  {
    id: "imagen-3",
    label: "Imagen 4",
    sublabel: "imagen-4.0-generate-001",
    color: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
    badgeClass: "bg-orange-600 text-white",
    promptType: "scene" as const,
  },
  {
    id: "imagen-4-ultra",
    label: "Imagen 4 Ultra",
    sublabel: "imagen-4.0-ultra-generate-001 — ImageFX quality",
    color: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
    badgeClass: "bg-red-700 text-white",
    promptType: "scene" as const,
  },
];

// ─── Preset prompts ───────────────────────────────────────────────────────────

const DANIELA = 'Daniela, a 28-year-old Latina woman with long wavy dark-brown hair, warm medium-brown skin, and bright brown eyes, wearing a sky-blue short-sleeve collared button-up shirt and dark jeans';
const MARCO = 'Marco, a 30-year-old Latino man with short curly black hair, light-olive skin, and friendly dark eyes, wearing a white button-up shirt and chinos';
const ROSA = 'Rosa, a warm 68-year-old Mexican grandmother with short curly silver-white hair, warm brown skin, kind dark eyes behind gold-rimmed glasses, and a white blouse with colorful floral embroidery';

const PRESETS = [
  {
    key: "hola",
    label: '"hola" — character scene',
    tag: "SCENE_OVERRIDES",
    type: "scene" as const,
    concept: `${DANIELA} waving hello with a big cheerful smile to ${MARCO} at a sunny school entrance, both standing a few feet apart, friendly classmate greeting, wholesome platonic interaction`,
  },
  {
    key: "adios",
    label: '"adiós" — character scene',
    tag: "SCENE_OVERRIDES",
    type: "scene" as const,
    concept: `${DANIELA} leaning out of a car window waving adiós, ${ROSA} standing on the front porch of a cozy house waving back with a warm smile`,
  },
  {
    key: "beach",
    label: '"beach" — environment',
    tag: "isSceneConcept()",
    type: "scene" as const,
    concept: "A wide sandy beach with gentle waves rolling in under warm afternoon sun, soft foam at the waterline, distant horizon",
  },
  {
    key: "grass",
    label: '"grass / waves" — environment',
    tag: "isSceneConcept()",
    type: "scene" as const,
    concept: "Rolling green grass hills under a bright open sky with soft clouds, gentle wind visible in the grass blades",
  },
  {
    key: "freeform",
    label: "Daniela freeform — live chat",
    tag: "show_image()",
    type: "scene" as const,
    concept: "a young woman walking through a colorful outdoor market, warm afternoon light filtering through canvas stalls, baskets of vegetables, warm and lively",
  },
  {
    key: "prop_apple",
    label: "Prop: apple",
    tag: "PROP_STYLE",
    type: "prop" as const,
    concept: "apple",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageResult {
  runIndex: number;
  engineId: string;
  status: "pending" | "loading" | "done" | "error";
  dataUrl?: string;
  elapsed?: number;
  error?: string;
}

type ResultMap = Record<string, ImageResult[]>; // engineId → results[]

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageEngineTest() {
  const [selectedEngines, setSelectedEngines] = useState<string[]>(["dall-e-3", "gpt-image-1"]);
  const [runCount, setRunCount] = useState(2);
  const [promptType, setPromptType] = useState<"scene" | "prop">("scene");
  const [concept, setConcept] = useState(PRESETS[0].concept);
  const [activePreset, setActivePreset] = useState<string>("hola");
  const [results, setResults] = useState<ResultMap>({});
  const [running, setRunning] = useState(false);
  const [retryingEngines, setRetryingEngines] = useState<Set<string>>(new Set());
  const [showPrompt, setShowPrompt] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);

  const toggleEngine = (id: string) => {
    setSelectedEngines(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const selectPreset = (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.key);
    setConcept(preset.concept);
    setPromptType(preset.type);
  };

  const updateResult = useCallback((engineId: string, runIndex: number, patch: Partial<ImageResult>) => {
    setResults(prev => {
      const existing = prev[engineId] ?? [];
      const updated = [...existing];
      updated[runIndex] = { ...updated[runIndex], ...patch } as ImageResult;
      return { ...prev, [engineId]: updated };
    });
  }, []);

  const runTests = async () => {
    if (selectedEngines.length === 0 || !concept.trim()) return;
    setRunning(true);

    // Initialise result slots
    const initial: ResultMap = {};
    for (const engineId of selectedEngines) {
      initial[engineId] = Array.from({ length: runCount }, (_, i) => ({
        runIndex: i,
        engineId,
        status: "loading",
      }));
    }
    setResults(initial);

    // Fire all requests in parallel (engine × run)
    const promises: Promise<void>[] = [];
    for (const engineId of selectedEngines) {
      const engine = ENGINES.find(e => e.id === engineId)!;
      const type = engine.promptType === "prop" ? "prop" : promptType;
      for (let i = 0; i < runCount; i++) {
        const runIndex = i;
        promises.push(
          fetch("/api/admin/image-engine-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ engine: engineId, concept: concept.trim(), type }),
          })
            .then(r => r.json())
            .then((data: any) => {
              if (data.error || !data.dataUrl) {
                updateResult(engineId, runIndex, {
                  status: "error",
                  error: data.error || "No image returned",
                  elapsed: data.elapsed,
                });
              } else {
                updateResult(engineId, runIndex, {
                  status: "done",
                  dataUrl: data.dataUrl,
                  elapsed: data.elapsed,
                });
              }
            })
            .catch(err => {
              updateResult(engineId, runIndex, {
                status: "error",
                error: err.message || "Request failed",
              });
            })
        );
      }
    }

    await Promise.allSettled(promises);
    setRunning(false);
  };

  const clearResults = () => {
    setResults({});
  };

  const retryEngine = useCallback(async (engineId: string) => {
    const engine = ENGINES.find(e => e.id === engineId);
    if (!engine) return;
    const type = engine.promptType === "prop" ? "prop" : promptType;

    setRetryingEngines(prev => new Set(prev).add(engineId));
    // Reset this engine's slots to loading
    setResults(prev => ({
      ...prev,
      [engineId]: Array.from({ length: runCount }, (_, i) => ({
        runIndex: i,
        engineId,
        status: "loading" as const,
      })),
    }));

    const promises = Array.from({ length: runCount }, (_, i) =>
      fetch("/api/admin/image-engine-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: engineId, concept: concept.trim(), type }),
      })
        .then(r => r.json())
        .then((data: any) => {
          updateResult(engineId, i, data.error || !data.dataUrl
            ? { status: "error", error: data.error || "No image returned", elapsed: data.elapsed }
            : { status: "done", dataUrl: data.dataUrl, elapsed: data.elapsed }
          );
        })
        .catch(err => updateResult(engineId, i, { status: "error", error: err.message || "Request failed" }))
    );

    await Promise.allSettled(promises);
    setRetryingEngines(prev => { const s = new Set(prev); s.delete(engineId); return s; });
  }, [concept, promptType, runCount, updateResult]);

  const activeEngines = ENGINES.filter(e => selectedEngines.includes(e.id));

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Image Engine Comparison</h1>
          <p className="text-sm text-muted-foreground">Run the same prompt across engines to compare quality and variety</p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(results).length > 0 && (
            <Button
              variant="outline"
              size="default"
              onClick={clearResults}
              disabled={running}
              data-testid="button-clear-results"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
          <Button
            onClick={runTests}
            disabled={running || selectedEngines.length === 0 || !concept.trim()}
            data-testid="button-run-tests"
          >
            <Play className="w-4 h-4 mr-2" />
            {running ? "Generating…" : "Run"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar controls */}
        <aside className="w-72 border-r flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 flex flex-col gap-5">
            {/* Preset prompts */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Preset prompts
              </Label>
              <div className="flex flex-col gap-1">
                {PRESETS.map(p => (
                  <button
                    key={p.key}
                    data-testid={`preset-${p.key}`}
                    onClick={() => selectPreset(p)}
                    className={`text-left px-3 py-2 rounded-md text-sm transition-colors hover-elevate ${
                      activePreset === p.key
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="font-medium leading-tight">{p.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.tag}</div>
                  </button>
                ))}
                <button
                  data-testid="preset-custom"
                  onClick={() => { setActivePreset("custom"); setShowPrompt(true); }}
                  className={`text-left px-3 py-2 rounded-md text-sm transition-colors hover-elevate ${
                    activePreset === "custom"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <div className="font-medium">Custom prompt</div>
                  <div className="text-xs text-muted-foreground">Type your own</div>
                </button>
              </div>
            </div>

            {/* Prompt preview / editor */}
            <div>
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 hover:text-foreground transition-colors"
                onClick={() => setShowPrompt(v => !v)}
                data-testid="button-toggle-prompt"
              >
                {showPrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Concept text
              </button>
              {showPrompt && (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={concept}
                    onChange={e => { setConcept(e.target.value); setActivePreset("custom"); }}
                    rows={5}
                    className="text-xs resize-y"
                    placeholder="Describe the scene or object to generate…"
                    data-testid="input-concept"
                  />
                  <p className="text-xs text-muted-foreground">
                    Style suffixes (SCENE_STYLE / PROP_STYLE) are appended automatically by each engine.
                  </p>
                </div>
              )}
              {!showPrompt && (
                <p className="text-xs text-muted-foreground line-clamp-3 italic">
                  "{concept.slice(0, 120)}{concept.length > 120 ? "…" : ""}"
                </p>
              )}
            </div>

            <Separator />

            {/* Engine selection */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Engines
              </Label>
              <div className="flex flex-col gap-2">
                {ENGINES.map(engine => (
                  <div key={engine.id} className="flex items-start gap-2.5">
                    <Checkbox
                      id={`engine-${engine.id}`}
                      checked={selectedEngines.includes(engine.id)}
                      onCheckedChange={() => toggleEngine(engine.id)}
                      data-testid={`checkbox-engine-${engine.id}`}
                    />
                    <label htmlFor={`engine-${engine.id}`} className="text-sm cursor-pointer leading-tight">
                      <div className="font-medium">{engine.label}</div>
                      <div className="text-xs text-muted-foreground">{engine.sublabel}</div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Run count */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Runs per engine — <span className="text-foreground font-semibold">{runCount}</span>
              </Label>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[runCount]}
                onValueChange={([v]) => setRunCount(v)}
                data-testid="slider-run-count"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>5</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {selectedEngines.length * runCount} image{selectedEngines.length * runCount !== 1 ? "s" : ""} fired in parallel
              </p>
            </div>
          </div>
        </aside>

        {/* Results grid */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {Object.keys(results).length === 0 && !running ? (
              <div className="flex flex-col items-center justify-center h-80 text-muted-foreground gap-3">
                <ImageOff className="w-10 h-10 opacity-40" />
                <p className="text-sm">Select engines and a prompt, then click Run</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {activeEngines.map(engine => {
                  const engineResults = results[engine.id] ?? [];
                  return (
                    <div key={engine.id} data-testid={`engine-section-${engine.id}`}>
                      {/* Engine header */}
                      <div className={`flex items-center gap-3 px-4 py-2 rounded-md border mb-3 ${engine.color}`}>
                        <Badge className={`text-xs font-mono ${engine.badgeClass}`}>{engine.id}</Badge>
                        <span className="font-semibold text-sm">{engine.label}</span>
                        <span className="text-xs text-muted-foreground">{engine.sublabel}</span>
                        <div className="ml-auto flex gap-2 items-center">
                          {engineResults.filter(r => r.status === "done").map(r => (
                            <span key={r.runIndex} className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {((r.elapsed ?? 0) / 1000).toFixed(1)}s
                            </span>
                          ))}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => retryEngine(engine.id)}
                            disabled={retryingEngines.has(engine.id) || running}
                            title="Retry this engine"
                            data-testid={`button-retry-${engine.id}`}
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retryingEngines.has(engine.id) ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </div>

                      {/* Image row */}
                      <div className="flex flex-wrap gap-4">
                        {engineResults.map((result, i) => (
                          <div
                            key={i}
                            data-testid={`image-slot-${engine.id}-${i}`}
                            className="flex flex-col gap-1"
                          >
                            <div className="w-48 h-48 rounded-md border overflow-hidden bg-muted flex items-center justify-center relative group">
                              {result.status === "loading" && (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
                                  <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                                  <span className="text-xs">Generating…</span>
                                </div>
                              )}
                              {result.status === "done" && result.dataUrl && (
                                <>
                                  <img
                                    src={result.dataUrl}
                                    alt={`${engine.label} run ${i + 1}`}
                                    className="w-full h-full object-cover cursor-zoom-in"
                                    onClick={() => setLightbox({ url: result.dataUrl!, alt: `${engine.label} — run ${i + 1}` })}
                                  />
                                  <div
                                    className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none"
                                  >
                                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                  </div>
                                </>
                              )}
                              {result.status === "error" && (
                                <div className="flex flex-col items-center gap-2 text-destructive px-2 text-center">
                                  <AlertCircle className="w-6 h-6" />
                                  <span className="text-xs leading-snug">{result.error}</span>
                                </div>
                              )}
                              {/* Run number badge */}
                              <div className="absolute top-1.5 left-1.5 pointer-events-none">
                                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                  #{i + 1}
                                </Badge>
                              </div>
                            </div>
                            {result.status === "done" && result.elapsed && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground justify-center">
                                <Clock className="w-3 h-3" />
                                {(result.elapsed / 1000).toFixed(1)}s
                              </div>
                            )}
                            {result.status === "done" && result.dataUrl && (
                              <a
                                href={result.dataUrl}
                                download={`${engine.id}-run${i + 1}.png`}
                                className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors"
                                data-testid={`link-download-${engine.id}-${i}`}
                              >
                                Download
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Lightbox overlay */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          data-testid="lightbox-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            onClick={() => setLightbox(null)}
            data-testid="button-lightbox-close"
          >
            <X className="w-7 h-7" />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.alt}
            className="max-w-full max-h-full rounded-md shadow-2xl object-contain"
            style={{ maxWidth: "min(90vw, 900px)", maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/60">
            {lightbox.alt} — click outside to close
          </p>
        </div>
      )}
    </div>
  );
}
