import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, RotateCcw, Clock, AlertCircle, ImageOff, ChevronDown, ChevronUp, RefreshCw, X, ZoomIn, Upload, UserCheck, Loader2, Pin, Trash2, Copy, Check, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";

// Engines that support reference image input (must match REFERENCE_CAPABLE_ENGINES on server)
const REFERENCE_CAPABLE_ENGINES = ["gemini-imagen-ref"];

// ─── Engine definitions ───────────────────────────────────────────────────────

const ENGINES = [
  {
    id: "gemini-image",
    label: "Gemini Image Gen",
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
    sublabel: "gemini-2.5-flash-image — muted palette, no reference",
    color: "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800",
    badgeClass: "bg-purple-600 text-white",
    promptType: "scene" as const,
  },
  {
    id: "gemini-imagen-ref",
    label: "Gemini image gen + ref",
    sublabel: "gemini-2.5-flash-image — muted palette + reference style",
    color: "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800",
    badgeClass: "bg-indigo-600 text-white",
    promptType: "scene" as const,
  },
  {
    id: "gemini-imagen-env",
    label: "Gemini image gen — env",
    sublabel: "gemini-2.5-flash-image — ENV_STYLE: vivid natural colors, wide landscape",
    color: "bg-violet-100 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800",
    badgeClass: "bg-violet-600 text-white",
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
  // ── Existing SCENE_OVERRIDES (greetings/farewells already have images) ─────
  {
    key: "hola",
    label: '"hola"',
    tag: "existing",
    group: "Existing",
    type: "scene" as const,
    concept: `${DANIELA} waving hello with a big cheerful smile to ${MARCO} at a sunny school entrance, both standing a few feet apart, friendly classmate greeting, wholesome platonic interaction`,
  },
  {
    key: "adios",
    label: '"adiós"',
    tag: "existing",
    group: "Existing",
    type: "scene" as const,
    concept: `${DANIELA} leaning out of a car window waving adiós, ${ROSA} standing on the front porch of a cozy house waving back with a warm smile`,
  },
  // ── Missing social phrases — Unit 1 Spanish 1 ────────────────────────────
  {
    key: "que_tal",
    label: '"¿Qué tal?"',
    tag: "missing",
    group: "Missing Sp1",
    type: "scene" as const,
    concept: `${DANIELA} giving a relaxed friendly shrug with both palms open and raised eyebrows, asking "how's it going?" in a casual warm way, cheerful everyday outdoor setting`,
  },
  {
    key: "que_pasa",
    label: '"¿Qué pasa?"',
    tag: "missing",
    group: "Missing Sp1",
    type: "scene" as const,
    concept: `${DANIELA} leaning against a wall with a relaxed easy smile, one hand gesturing open-palmed in a casual "what's going on?" expression, sunny school hallway or courtyard`,
  },
  {
    key: "todo_bien",
    label: '"todo bien"',
    tag: "missing",
    group: "Missing Sp1",
    type: "scene" as const,
    concept: `${DANIELA} with both thumbs up and a wide relaxed grin, leaning back slightly in an easygoing "all good" posture, warm bright background`,
  },
  {
    key: "nada",
    label: '"nada"',
    tag: "missing",
    group: "Missing Sp1",
    type: "scene" as const,
    concept: `${DANIELA} giving a casual open-hands shrug with both palms facing upward and a small unbothered smile, expressing "nothing's going on", light airy background`,
  },
  {
    key: "y_tu",
    label: '"¿y tú?"',
    tag: "missing",
    group: "Missing Sp1",
    type: "scene" as const,
    concept: `${DANIELA} pointing warmly toward ${MARCO} with one open hand and a friendly inquisitive smile, eyebrows raised in a "and what about you?" gesture, casual sunny outdoor setting`,
  },
  {
    key: "igualmente",
    label: '"igualmente"',
    tag: "missing",
    group: "Missing Sp1",
    type: "scene" as const,
    concept: `${DANIELA} and ${MARCO} both nodding and smiling warmly at each other, ${DANIELA} pressing a hand to her chest and gesturing back toward ${MARCO} in a warm mirroring "likewise" gesture, bright cheerful setting`,
  },
  {
    key: "con_permiso",
    label: '"con permiso"',
    tag: "missing",
    group: "Missing Sp1",
    type: "scene" as const,
    concept: `${DANIELA} squeezing politely past ${ROSA} in a narrow doorway or corridor, one hand slightly raised in a gentle "excuse me" gesture with a kind apologetic smile, warm indoor setting`,
  },
  // ── Other categories ──────────────────────────────────────────────────────
  {
    key: "beach",
    label: '"beach" — environment',
    tag: "env",
    group: "Other",
    type: "scene" as const,
    concept: "A wide sandy beach with gentle waves rolling in under warm afternoon sun, soft foam at the waterline, distant horizon, no people, no figures, landscape only, wide establishing shot",
  },
  {
    key: "grass",
    label: '"grass" — environment',
    tag: "env",
    group: "Other",
    type: "scene" as const,
    concept: "Rolling green grass hills under a bright open sky with soft clouds, gentle wind visible in the grass blades, no people, landscape only",
  },
  {
    key: "freeform",
    label: "Daniela freeform — live chat",
    tag: "show_image()",
    group: "Other",
    type: "scene" as const,
    concept: "a young woman walking through a colorful outdoor market, warm afternoon light filtering through canvas stalls, baskets of vegetables, warm and lively",
  },
  {
    key: "prop_apple",
    label: "Prop: apple",
    tag: "prop",
    group: "Other",
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
  styleDescription?: string;
}

type ResultMap = Record<string, ImageResult[]>; // engineId → results[]

interface StyleProfile {
  language: string;
  styleDescription: string;
  imageHash: string;
  lockedAt: string;
}

const LANGUAGES = [
  "spanish", "french", "portuguese", "italian", "german",
  "japanese", "mandarin", "korean", "arabic", "russian",
];

// Profile keys that aren't language names — appear at top of pin dropdown
const SPECIAL_PROFILE_KEYS = [
  { value: "environment", label: "Environment style" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ReferenceImage {
  b64: string;
  mimeType: string;
  thumbnailDataUrl: string; // data-URL for preview only
  label: string;
}

export default function ImageEngineTest() {
  const [selectedEngines, setSelectedEngines] = useState<string[]>(["gemini-imagen", "gemini-imagen-ref", "gemini-imagen-env"]);
  const [runCount, setRunCount] = useState(2);
  const [promptType, setPromptType] = useState<"scene" | "prop">("scene");
  const [concept, setConcept] = useState(PRESETS[0].concept);
  const [activePreset, setActivePreset] = useState<string>("hola");
  const [results, setResults] = useState<ResultMap>({});
  const [running, setRunning] = useState(false);
  const [retryingEngines, setRetryingEngines] = useState<Set<string>>(new Set());
  const [showPrompt, setShowPrompt] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);

  // Reference image state — passed to Gemini Flash for character consistency
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [fetchingReference, setFetchingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pinned style profiles — persist across server restarts via DB
  const [lockedProfiles, setLockedProfiles] = useState<StyleProfile[]>([]);
  const [lockingStyle, setLockingStyle] = useState(false);
  const [pinLanguage, setPinLanguage] = useState("spanish");
  const [copiedLanguage, setCopiedLanguage] = useState<string | null>(null);

  // Extraction mode — controls what Gemini looks for in the reference image
  const [extractionMode, setExtractionMode] = useState<"character" | "environment">("character");

  // Editable copy of the extracted style description — user can modify/paste freely
  const [editedStyleDesc, setEditedStyleDesc] = useState<string>("");

  // ── Production Preview Builder ─────────────────────────────────────────────
  // Lets you pick a language, edit its character description, and type a word
  // to preview the exact concept string production would generate.
  const [showCharBuilder, setShowCharBuilder] = useState(false);
  const [charIntros, setCharIntros] = useState<Record<string, string>>({});
  const [builderLanguage, setBuilderLanguage] = useState("spanish");
  const [builderCharDesc, setBuilderCharDesc] = useState("");
  const [builderWord, setBuilderWord] = useState("");
  const [builtConcept, setBuiltConcept] = useState<string | null>(null);
  const [buildingConcept, setBuildingConcept] = useState(false);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/image-style-profiles");
      if (res.ok) setLockedProfiles(await res.json());
    } catch {}
  }, []);

  // Load production character intros once on mount
  useEffect(() => {
    fetch("/api/admin/image-engine-test/character-intros")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setCharIntros(data);
          setBuilderCharDesc(data["spanish"] ?? "");
        }
      })
      .catch(() => {});
  }, []);

  // When language changes, reset char desc to production default
  useEffect(() => {
    if (charIntros[builderLanguage]) setBuilderCharDesc(charIntros[builderLanguage]);
    setBuiltConcept(null);
  }, [builderLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildProductionConcept = async () => {
    if (!builderWord.trim()) return;
    setBuildingConcept(true);
    setBuiltConcept(null);
    try {
      const res = await fetch("/api/admin/image-engine-test/build-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: builderWord.trim(), language: builderLanguage, characterIntro: builderCharDesc }),
      });
      const data = await res.json();
      if (data.concept) setBuiltConcept(data.concept);
    } catch {}
    setBuildingConcept(false);
  };

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // When a new extraction comes back from the engine, auto-populate the editable field.
  // User can freely edit/paste over it; running a new reference image will refresh it.
  const latestExtractedDesc = useMemo(() => {
    for (const engineId of Object.keys(results)) {
      for (const r of (results[engineId] || [])) {
        if (r.styleDescription) return r.styleDescription;
      }
    }
    return null;
  }, [results]);

  useEffect(() => {
    if (latestExtractedDesc) setEditedStyleDesc(latestExtractedDesc);
  }, [latestExtractedDesc]);

  // When the language selector changes (or profiles first load), pre-populate
  // the editable textarea from the pinned profile — unless a fresh extraction
  // is already in state (latestExtractedDesc takes priority).
  useEffect(() => {
    if (latestExtractedDesc) return; // fresh extraction wins
    const pinned = lockedProfiles.find(p => p.language === pinLanguage);
    if (pinned) setEditedStyleDesc(pinned.styleDescription);
    else setEditedStyleDesc(""); // no profile for this language — clear the field
  }, [pinLanguage, lockedProfiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const lockStyle = async (styleDescription: string, imageHash: string) => {
    setLockingStyle(true);
    try {
      const res = await fetch("/api/admin/image-style-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: pinLanguage, styleDescription, imageHash }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      await loadProfiles();
    } catch (err: any) {
      alert(`Failed to pin style: ${err.message}`);
    } finally {
      setLockingStyle(false);
    }
  };

  const deleteProfile = async (language: string) => {
    try {
      await fetch(`/api/admin/image-style-profiles/${language}`, { method: "DELETE" });
      await loadProfiles();
    } catch {}
  };

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

  // Load an existing Daniela image from the DB cache as a reference
  const loadDanielaReference = async () => {
    setFetchingReference(true);
    setReferenceError(null);
    try {
      const res = await fetch("/api/admin/image-engine-test/daniela-reference");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setReferenceImage({
        b64: data.b64,
        mimeType: data.mimeType,
        thumbnailDataUrl: `data:${data.mimeType};base64,${data.b64}`,
        label: `Cached: ${data.sourceKey}`,
      });
    } catch (err: any) {
      setReferenceError(err.message || "Failed to load reference");
    } finally {
      setFetchingReference(false);
    }
  };

  // Handle file upload — convert to base64 for sending to the backend
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // data URL format: "data:<mimeType>;base64,<b64data>"
      const [header, b64] = dataUrl.split(",");
      const mimeType = header.replace("data:", "").replace(";base64", "");
      setReferenceImage({ b64, mimeType, thumbnailDataUrl: dataUrl, label: file.name });
    };
    reader.readAsDataURL(file);
    // Reset file input so the same file can be re-uploaded if cleared
    e.target.value = "";
  };

  // Build request body — only include reference for engines that support it.
  // variationIndex ensures parallel runs get different composition nudges.
  // extractionMode tells the backend which style analysis prompt to use.
  // If no image is uploaded but editedStyleDesc has content, send it as a
  // styleDescriptionOverride so the engine uses the pinned style directly.
  const buildRequestBody = (engineId: string, type: "scene" | "prop", variationIndex: number = 0) => {
    const supportsReference = REFERENCE_CAPABLE_ENGINES.includes(engineId);
    return JSON.stringify({
      engine: engineId,
      concept: concept.trim(),
      type,
      variationIndex,
      extractionMode,
      // Priority: edited/pinned style text > reference image > nothing.
      // If the user has typed or pasted a style description, that overrides the reference
      // extraction so re-runs respect their edits without re-extracting from the image.
      ...(supportsReference && editedStyleDesc
        ? { styleDescriptionOverride: editedStyleDesc }
        : supportsReference && referenceImage
        ? { referenceImageB64: referenceImage.b64, referenceImageMimeType: referenceImage.mimeType }
        : {}),
    });
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
            body: buildRequestBody(engineId, type, runIndex),
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
                  ...(data.styleDescription ? { styleDescription: data.styleDescription } : {}),
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

    // Retry uses whatever is currently in the textarea (override) so the user
    // can iterate on extracted/pasted style text without triggering a new
    // extraction. Falls back to reference extraction only if the textarea is empty.
    const supportsReference = REFERENCE_CAPABLE_ENGINES.includes(engineId);
    const buildRetryBody = (variationIndex: number) => JSON.stringify({
      engine: engineId,
      concept: concept.trim(),
      type,
      variationIndex,
      extractionMode,
      ...(supportsReference && editedStyleDesc
        ? { styleDescriptionOverride: editedStyleDesc }
        : supportsReference && referenceImage
        ? { referenceImageB64: referenceImage.b64, referenceImageMimeType: referenceImage.mimeType }
        : {}),
    });

    const promises = Array.from({ length: runCount }, (_, i) =>
      fetch("/api/admin/image-engine-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildRetryBody(i),
      })
        .then(r => r.json())
        .then((data: any) => {
          updateResult(engineId, i, data.error || !data.dataUrl
            ? { status: "error", error: data.error || "No image returned", elapsed: data.elapsed }
            : { status: "done", dataUrl: data.dataUrl, elapsed: data.elapsed, ...(data.styleDescription ? { styleDescription: data.styleDescription } : {}) }
          );
        })
        .catch(err => updateResult(engineId, i, { status: "error", error: err.message || "Request failed" }))
    );

    await Promise.allSettled(promises);
    setRetryingEngines(prev => { const s = new Set(prev); s.delete(engineId); return s; });
  }, [concept, promptType, runCount, updateResult, referenceImage]);

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
                {(["Existing", "Missing Sp1", "Other"] as const).map(group => {
                  const groupPresets = PRESETS.filter(p => p.group === group);
                  return (
                    <div key={group}>
                      <div className="text-xs font-semibold text-muted-foreground px-3 pt-2 pb-1 flex items-center gap-1.5">
                        {group === "Missing Sp1" && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                        {group === "Existing" ? "Existing overrides" : group === "Missing Sp1" ? "Missing — Sp1 Unit 1" : "Other categories"}
                      </div>
                      {groupPresets.map(p => (
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
                    </div>
                  );
                })}
                <div className="text-xs font-semibold text-muted-foreground px-3 pt-2 pb-1">Custom</div>
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

            {/* Production Preview Builder */}
            <div>
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 hover:text-foreground transition-colors"
                onClick={() => setShowCharBuilder(v => !v)}
                data-testid="button-toggle-char-builder"
              >
                {showCharBuilder ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Production preview builder
              </button>
              {showCharBuilder && (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Build the exact concept string production uses — pick a language, edit the character if needed, type a word or scene, then use the result.
                  </p>

                  {/* Language selector */}
                  <div>
                    <Label className="text-[11px] text-muted-foreground mb-1 block">Language</Label>
                    <select
                      value={builderLanguage}
                      onChange={e => setBuilderLanguage(e.target.value)}
                      className="w-full text-xs rounded-md border border-input bg-background px-2 py-1.5"
                      data-testid="select-builder-language"
                    >
                      {Object.keys(charIntros).map(lang => (
                        <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Editable character description */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[11px] text-muted-foreground">Character description</Label>
                      <button
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setBuilderCharDesc(charIntros[builderLanguage] ?? "")}
                        data-testid="button-reset-char-desc"
                      >
                        Reset to production
                      </button>
                    </div>
                    <Textarea
                      value={builderCharDesc}
                      onChange={e => { setBuilderCharDesc(e.target.value); setBuiltConcept(null); }}
                      rows={4}
                      className="text-xs resize-y"
                      placeholder="Character description from LANGUAGE_CHARACTER_INTROS…"
                      data-testid="input-builder-char-desc"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      Edit hair, clothing, or any detail — changes are local to this test only.
                    </p>
                  </div>

                  {/* Word / scene input */}
                  <div>
                    <Label className="text-[11px] text-muted-foreground mb-1 block">Vocabulary word or scene</Label>
                    <div className="flex gap-1.5">
                      <Input
                        value={builderWord}
                        onChange={e => { setBuilderWord(e.target.value); setBuiltConcept(null); }}
                        onKeyDown={e => e.key === "Enter" && buildProductionConcept()}
                        placeholder='e.g. "hablar" or "greeting a student"'
                        className="text-xs"
                        data-testid="input-builder-word"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={buildProductionConcept}
                        disabled={buildingConcept || !builderWord.trim()}
                        data-testid="button-build-concept"
                      >
                        {buildingConcept ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Assembled concept preview */}
                  {builtConcept && (
                    <div className="flex flex-col gap-2">
                      <Label className="text-[11px] text-muted-foreground">Assembled concept</Label>
                      <div className="rounded-md border border-border bg-muted/40 p-2 text-xs leading-relaxed text-foreground">
                        {builtConcept}
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => { setConcept(builtConcept); setActivePreset("custom"); setShowPrompt(true); setBuiltConcept(null); }}
                        data-testid="button-use-built-concept"
                      >
                        <Check className="w-3 h-3 mr-1.5" />
                        Use this concept
                      </Button>
                    </div>
                  )}
                </div>
              )}
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

            {/* Reference image — for Gemini Flash character consistency */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Reference Image
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                Anchor Gemini Flash to a character or style. Only{" "}
                <span className="font-medium text-foreground">Gemini Flash</span> supports reference input — other engines ignore it.
              </p>

              {/* Extraction mode toggle */}
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1.5">Reads the reference as…</div>
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  <button
                    onClick={() => { setExtractionMode("character"); if (pinLanguage === "environment") setPinLanguage("spanish"); }}
                    className={`flex-1 px-2 py-1.5 text-center transition-colors ${
                      extractionMode === "character"
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    data-testid="button-extraction-character"
                  >
                    Character
                  </button>
                  <button
                    onClick={() => { setExtractionMode("environment"); setPinLanguage("environment"); }}
                    className={`flex-1 px-2 py-1.5 text-center transition-colors border-l border-border ${
                      extractionMode === "environment"
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    data-testid="button-extraction-environment"
                  >
                    Environment
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  {extractionMode === "character"
                    ? "Extracts illustration style + character design (face, hair, skin, clothing)"
                    : "Extracts illustration style + environment rendering (depth, sky, atmosphere, light)"}
                </p>
              </div>

              {/* Thumbnail preview */}
              {referenceImage && (
                <div className="mb-3 relative rounded-md overflow-hidden border border-border">
                  <img
                    src={referenceImage.thumbnailDataUrl}
                    alt="Reference"
                    className="w-full aspect-square object-cover"
                    data-testid="img-reference-thumbnail"
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-1 right-1 opacity-90"
                    onClick={() => { setReferenceImage(null); setReferenceError(null); }}
                    data-testid="button-clear-reference"
                    title="Remove reference image"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <div className="px-2 py-1 bg-muted/80 text-xs text-muted-foreground truncate">
                    {referenceImage.label}
                  </div>
                </div>
              )}

              {referenceError && (
                <p className="text-xs text-destructive mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {referenceError}
                </p>
              )}

              <div className="flex flex-col gap-2">
                {/* Load Daniela from cache */}
                <Button
                  variant="outline"
                  size="default"
                  onClick={loadDanielaReference}
                  disabled={fetchingReference}
                  data-testid="button-load-daniela-reference"
                  className="w-full justify-start"
                >
                  {fetchingReference
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <UserCheck className="w-4 h-4 mr-2" />}
                  Load Daniela from cache
                </Button>

                {/* Upload custom reference */}
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-reference"
                  className="w-full justify-start"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-reference-file"
                />
              </div>
            </div>

            <Separator />

            {/* Pinned Style Profiles */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Pinned Styles
              </Label>
              {lockedProfiles.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No styles pinned yet. Run <span className="font-medium text-foreground">gemini-imagen-ref</span> with a reference image, then pin the extracted style.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {lockedProfiles.map(p => (
                    <div key={p.language} className="flex flex-col gap-1 rounded-md border border-border px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium capitalize">{p.language}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Pinned {new Date(p.lockedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(p.styleDescription);
                              setCopiedLanguage(p.language);
                              setTimeout(() => setCopiedLanguage(null), 2000);
                            }}
                            title={`Copy pinned style prompt for ${p.language}`}
                            data-testid={`button-copy-profile-${p.language}`}
                          >
                            {copiedLanguage === p.language
                              ? <Check className="w-3.5 h-3.5 text-green-500" />
                              : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteProfile(p.language)}
                            title={`Remove pinned style for ${p.language}`}
                            data-testid={`button-delete-profile-${p.language}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 select-text">
                        {p.styleDescription}
                      </p>
                    </div>
                  ))}
                </div>
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
                      <div className="flex items-center gap-1.5 font-medium">
                        {engine.label}
                        {REFERENCE_CAPABLE_ENGINES.includes(engine.id) && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-auto leading-tight">
                            ref
                          </Badge>
                        )}
                      </div>
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

                      {/* Extracted style description (gemini-imagen-ref only) */}
                      {engine.id === "gemini-imagen-ref" && (() => {
                        const refResult = engineResults.find(r => r.styleDescription);
                        const desc = refResult?.styleDescription;
                        const imageHash = refResult?.dataUrl?.slice(0, 64) ?? "";
                        const hasContent = !!(desc || editedStyleDesc);
                        return (
                          <details className="mb-3 text-xs text-muted-foreground border border-border rounded-md" open>
                            <summary className="px-3 py-2 cursor-pointer select-none font-medium text-foreground/70 hover:text-foreground transition-colors">
                              Style extracted from reference
                            </summary>
                            {hasContent ? (
                              <>
                                <div className="px-3 pt-2 pb-2">
                                  <Textarea
                                    value={editedStyleDesc}
                                    onChange={e => setEditedStyleDesc(e.target.value)}
                                    className="text-xs font-mono leading-relaxed resize-y min-h-[100px]"
                                    data-testid="textarea-style-description"
                                  />
                                  {desc && editedStyleDesc !== desc && (
                                    <button
                                      onClick={() => setEditedStyleDesc(desc)}
                                      className="mt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                                      data-testid="button-reset-style-desc"
                                    >
                                      Reset to last extracted
                                    </button>
                                  )}
                                </div>
                                <div className="px-3 pb-3 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                                  <select
                                    value={pinLanguage}
                                    onChange={e => setPinLanguage(e.target.value)}
                                    className="text-xs rounded-md border border-border bg-background px-2 py-1 text-foreground"
                                    data-testid="select-pin-language"
                                  >
                                    <optgroup label="Scene types">
                                      {SPECIAL_PROFILE_KEYS.map(k => (
                                        <option key={k.value} value={k.value}>{k.label}</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Languages">
                                      {LANGUAGES.map(l => (
                                        <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                                      ))}
                                    </optgroup>
                                  </select>
                                  <Button
                                    size="sm"
                                    variant={lockedProfiles.some(p => p.language === pinLanguage) ? "default" : "outline"}
                                    onClick={() => lockStyle(editedStyleDesc || desc || "", imageHash)}
                                    disabled={lockingStyle || !editedStyleDesc}
                                    data-testid="button-pin-style"
                                  >
                                    {lockingStyle
                                      ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                      : <Pin className="w-3 h-3 mr-1.5" />}
                                    {lockedProfiles.some(p => p.language === pinLanguage) ? "Update pin" : "Pin this style"}
                                  </Button>
                                  {lockedProfiles.some(p => p.language === pinLanguage) && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {pinLanguage} pinned
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-snug">
                                  Only the <strong>ART STYLE</strong> section is saved to the pin — CHARACTER DESIGN is excluded. Each language's character description comes from the production pipeline, so there's no conflict across languages.
                                </p>
                              </>
                            ) : (
                              <p className="px-3 py-3 text-muted-foreground italic">
                                Load a reference image in the sidebar, then run this engine — Gemini will extract the style into an editable description you can pin.
                              </p>
                            )}
                          </details>
                        );
                      })()}

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
