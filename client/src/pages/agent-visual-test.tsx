import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ResolvedWord {
  text: string;
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
}

export default function AgentVisualTest() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [customText, setCustomText] = useState(
    "Hola Daniela. Quiero practicar español. Me gustan los restaurantes y la comida española. ¿Puedes mostrarme vocabulario con imágenes?"
  );
  const { toast } = useToast();

  const runDemo = useCallback(async () => {
    setStatus("running");
    setResult(null);
    try {
      const data = await apiRequest("POST", "/api/admin/agent-visual-demo", {
        text: customText,
        languageCode: "es-ES",
      });
      const json: DemoResult = await data.json();
      setResult(json);
      setStatus("done");
    } catch (err: any) {
      toast({ title: "Demo failed", description: err.message, variant: "destructive" });
      setStatus("error");
    }
  }, [customText, toast]);

  const sceneEvent = result?.visualEvents.find(e => e.type === "open_scene" && e.imageUrl);
  const vocabEvent = result?.visualEvents.find(e => e.type === "show_vocab_grid" && e.resolvedWords?.length);
  const showImageEvent = result?.visualEvents.find(e => (e.type === "show_image" || e.type === "show_cultural_scene") && e.imageUrl);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="agent-visual-test-page">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold">Agent Visual Test</h1>
        <Badge variant="outline" data-testid="status-badge">
          {status === "idle" ? "Ready" : status === "running" ? "Running GL session…" : status === "done" ? "Done" : "Error"}
        </Badge>
        <div className="flex-1" />
        <Button
          onClick={runDemo}
          disabled={status === "running"}
          data-testid="button-run-demo"
        >
          {status === "running" ? "Running…" : "Run Visual Demo"}
        </Button>
      </div>

      {/* Prompt input */}
      <div className="px-6 py-3 border-b bg-muted/30">
        <textarea
          className="w-full h-16 text-sm bg-background border rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          data-testid="input-demo-text"
          placeholder="Enter a message to send to Daniela…"
        />
      </div>

      {/* Main content: Studio | Whiteboard */}
      <div className="flex flex-1 overflow-hidden">
        {/* Studio — left panel */}
        <div className="w-72 border-r flex flex-col" data-testid="studio-panel">
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <span className="text-sm font-medium">Studio</span>
          </div>
          <div className="flex-1 relative overflow-hidden bg-muted/20">
            {sceneEvent?.imageUrl ? (
              <div className="relative w-full h-full" data-testid="scene-image-container">
                <img
                  src={sceneEvent.imageUrl}
                  alt={sceneEvent.data.environment || "scene"}
                  className="w-full h-full object-cover"
                  data-testid="scene-image"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
                  <p className="text-white text-xs font-medium" data-testid="scene-label">
                    {sceneEvent.data.environment || "Scene"}
                  </p>
                </div>
              </div>
            ) : showImageEvent?.imageUrl ? (
              <div className="relative w-full h-full" data-testid="show-image-container">
                <img
                  src={showImageEvent.imageUrl}
                  alt={showImageEvent.data.word || "image"}
                  className="w-full h-full object-cover"
                  data-testid="show-image"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
                  <p className="text-white text-xs font-medium">{showImageEvent.data.word || "Image"}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4 text-center" data-testid="studio-empty">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">📚</div>
                <p className="text-sm font-medium">Ready for action</p>
                <p className="text-xs">Scenes and images will appear here during the lesson</p>
              </div>
            )}
          </div>
        </div>

        {/* Center: transcript + tool calls */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Transcript */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="transcript-area">
            {status === "running" && (
              <div className="flex items-center gap-3 text-muted-foreground" data-testid="loading-indicator">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Daniela is responding… this takes ~20 seconds</span>
              </div>
            )}
            {result?.transcript && (
              <div className="bg-muted/40 rounded-lg p-4" data-testid="transcript-text">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Daniela</p>
                <p className="text-sm leading-relaxed">{result.transcript}</p>
              </div>
            )}
            {result && result.toolCallsSummary.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="no-tools-message">
                No visual tools fired in this session.
              </p>
            )}
          </div>

          {/* Tool calls summary */}
          {result && result.toolCallsSummary.length > 0 && (
            <div className="border-t p-4 bg-muted/20" data-testid="tool-calls-summary">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Tools fired ({result.toolCallsSummary.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {result.toolCallsSummary.map((tc, i) => (
                  <Badge key={i} variant="secondary" className="text-xs" data-testid={`tool-badge-${tc.name}`}>
                    {tc.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Whiteboard — right panel */}
        <div className="w-80 border-l flex flex-col" data-testid="whiteboard-panel">
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <span className="text-sm font-medium">Whiteboard</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3" data-testid="whiteboard-content">
            {vocabEvent?.resolvedWords && vocabEvent.resolvedWords.length > 0 ? (
              <div data-testid="vocab-grid">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {vocabEvent.data.title || "Vocabulary"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {vocabEvent.resolvedWords.map((w, i) => (
                    <div
                      key={i}
                      className="border rounded-md overflow-hidden bg-card"
                      data-testid={`vocab-card-${i}`}
                    >
                      {w.imageUrl ? (
                        <img
                          src={w.imageUrl}
                          alt={w.text || w.word || ""}
                          className="w-full h-20 object-cover"
                          data-testid={`vocab-image-${i}`}
                        />
                      ) : (
                        <div className="w-full h-20 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                          No image
                        </div>
                      )}
                      <div className="p-1.5">
                        <p className="text-xs font-semibold leading-tight" data-testid={`vocab-word-${i}`}>
                          {w.text || w.word}
                        </p>
                        {w.translation && (
                          <p className="text-xs text-muted-foreground" data-testid={`vocab-translation-${i}`}>
                            {w.translation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4 text-center" data-testid="whiteboard-empty">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">✏️</div>
                <p className="text-sm font-medium">Whiteboard is clear</p>
                <p className="text-xs">Vocabulary and grammar notes will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
