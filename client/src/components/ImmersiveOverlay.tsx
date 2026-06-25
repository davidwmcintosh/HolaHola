import { useState, useEffect, useRef } from "react";
import { X, Mic, MicOff, Radio, Volume2, Loader2, ChevronDown, ArrowLeftRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { usePlaybackState } from "@/lib/playbackStateStore";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGlobalVoiceInput } from "@/lib/voiceInputStore";
import { useGlobalMission } from "@/lib/missionStore";
import type { SceneCanvasItemData, SceneCanvasRichContent, WhiteboardItem, OverlayPanel } from "@shared/whiteboard-types";
import { OverlayPanelContent } from "@/components/OverlayPanelContent";

interface ContextImageChip {
  word: string;
  description: string;
  imageUrl: string;
  category?: string;
}

interface ImmersiveOverlayProps {
  isActive: boolean;
  sceneCanvas: SceneCanvasItemData | null;
  displayWhiteboardItems?: WhiteboardItem[];
  contextImages?: ContextImageChip[];
  tutorImageUrl?: string;
  onExit: () => void;
  activePanel?: OverlayPanel | null;
  onDismissPanel?: () => void;
}

// ─── Inline menu renderers (immersive-themed) ────────────────────────────────

function ImmersiveMenuItemImage({ query }: { query: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/menu-image?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled && data.url) setUrl(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [query]);

  if (!url) return <div className="w-10 h-10 rounded-lg bg-white/10 flex-shrink-0" />;
  return (
    <img
      src={url}
      alt={query}
      className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10"
      loading="lazy"
    />
  );
}

function ImmersiveBeginnerMenu({ content }: { content: any }) {
  const sections = content?.sections;
  if (!sections || !Array.isArray(sections)) return null;
  return (
    <div className="space-y-5">
      {sections.map((section: any, si: number) => (
        <div key={si} className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/50 pb-1 border-b border-white/10">
            {section.name_target || section.name}
            {section.name_target && section.name_target !== section.name && (
              <span className="ml-2 font-normal normal-case text-white/35">({section.name})</span>
            )}
          </div>
          <div className="space-y-2">
            {section.items?.map((item: any, ii: number) => (
              <div key={ii} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5" data-testid={`immersive-menu-item-${si}-${ii}`}>
                <ImmersiveMenuItemImage query={item.name} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{item.name_target || item.name}</div>
                  {item.name_target && item.name_target !== item.name && (
                    <div className="text-[11px] text-white/50">{item.name}</div>
                  )}
                  {item.description_target && (
                    <div className="text-[11px] text-white/40 mt-0.5">{item.description_target}</div>
                  )}
                </div>
                {item.price && (
                  <span className="text-sm font-bold text-white/80 flex-shrink-0">
                    {item.price.includes('€') || item.price.includes('$') || item.price.includes('£') || item.price.includes('¥') ? item.price : `€${item.price}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImmersiveAdvancedMenu({ content }: { content: any }) {
  const sections = content?.sections;
  if (!sections || !Array.isArray(sections)) return null;
  return (
    <div className="space-y-4">
      {sections.map((section: any, si: number) => (
        <div key={si} className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/50 pb-1 border-b border-white/10">
            {section.name_target || section.name}
          </div>
          <div className="space-y-2">
            {section.items?.map((item: any, ii: number) => (
              <div key={ii} className="flex items-baseline justify-between gap-3" data-testid={`immersive-menu-item-${si}-${ii}`}>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white">{item.name_target || item.name}</span>
                  {item.description_target && (
                    <span className="text-[11px] text-white/50 ml-2">— {item.description_target}</span>
                  )}
                </div>
                {item.price && (
                  <span className="text-sm font-medium text-white/80 flex-shrink-0">
                    {item.price.includes('€') || item.price.includes('$') || item.price.includes('£') || item.price.includes('¥') ? item.price : `€${item.price}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImmersiveMenuRenderer({ content, difficulty }: { content: any; difficulty: string }) {
  const { language } = useLanguage();
  const resolved = content?.byLanguage?.[language]?.[difficulty]
    || content?.byLanguage?.[language]?.beginner
    || content;
  if (difficulty === 'beginner') return <ImmersiveBeginnerMenu content={resolved} />;
  return <ImmersiveAdvancedMenu content={resolved} />;
}

function ImmersiveBillRenderer({ content }: { content: any }) {
  const fields = content?.fields;
  if (!fields || !Array.isArray(fields)) return null;
  const isTotal = (label: string) => /total/i.test(label);
  return (
    <div className="space-y-2">
      {content.title && (
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/50 pb-1 border-b border-white/10 mb-3">
          {content.title}
        </div>
      )}
      {fields.map((field: any, i: number) => {
        const total = isTotal(field.label);
        const isMultiLine = typeof field.value === 'string' && field.value.includes('\n');
        if (isMultiLine) {
          return (
            <div key={i} className="space-y-1" data-testid={`immersive-bill-field-${i}`}>
              <span className="text-[11px] text-white/50">{field.label}</span>
              <div className="text-sm font-medium whitespace-pre-wrap leading-snug pl-3 border-l border-white/15 text-white/80">
                {field.value}
              </div>
            </div>
          );
        }
        return (
          <div
            key={i}
            className={`flex items-baseline justify-between gap-3 ${total ? 'mt-3 pt-3 border-t border-white/20' : ''}`}
            data-testid={`immersive-bill-field-${i}`}
          >
            <span className={`text-sm flex-shrink-0 ${total ? 'font-bold text-white' : 'text-white/60'}`}>
              {field.label}
            </span>
            <span className={`text-sm font-semibold text-right ${total ? 'text-white text-base' : 'text-white/80'}`}>
              {field.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Rich content bottom sheet ────────────────────────────────────────────────

function RichContentSheet({
  content,
  difficulty,
  onClose,
}: {
  content: SceneCanvasRichContent;
  difficulty: string;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-20 bg-black/40"
        onClick={onClose}
        data-testid="immersive-sheet-backdrop"
      />
      {/* Sheet */}
      <motion.div
        key="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 z-30 rounded-t-2xl overflow-hidden"
        style={{ maxHeight: '72vh', background: 'rgba(12,12,16,0.96)', backdropFilter: 'blur(24px)' }}
        data-testid="immersive-rich-sheet"
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 rounded-full bg-white/20 absolute top-2.5 left-1/2 -translate-x-1/2" />
            <span className="text-sm font-semibold text-white mt-0.5">{content.title}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="text-white/60 hover:text-white"
            onClick={onClose}
            data-testid="button-close-immersive-sheet"
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
        </div>
        {/* Content */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(72vh - 56px)' }}>
          {content.type === 'menu' && (
            <ImmersiveMenuRenderer content={content.content} difficulty={difficulty} />
          )}
          {content.type === 'bill' && (
            <ImmersiveBillRenderer content={content.content} />
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Immersive whiteboard strip ───────────────────────────────────────────────

function ImmersiveWhiteboardStrip({ items }: { items: WhiteboardItem[] }) {
  const textItems = items.filter(
    (item: any) => item.type === 'write' || item.type === 'phonetic' || item.type === 'compare'
  );
  const latest = textItems[textItems.length - 1] as any;

  if (!latest) return null;

  const lines: string[] = [];
  if (latest.type === 'write' || latest.type === 'phonetic') {
    const raw: string = latest.content ?? latest.data?.text ?? '';
    raw.split('\n').filter(Boolean).forEach((l: string) => lines.push(l));
  } else if (latest.type === 'compare' && Array.isArray(latest.data?.pairs)) {
    latest.data.pairs.forEach((p: any) => {
      if (p.target) lines.push(p.target);
      if (p.native) lines.push(p.native);
    });
  }

  if (!lines.length) return null;

  return (
    <motion.div
      key={latest.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 max-w-[min(90vw,640px)] w-max"
      data-testid="immersive-whiteboard-strip"
    >
      <div
        className="rounded-xl px-5 py-3 flex flex-col items-center gap-1 text-center"
        style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className={i === 0 ? 'text-white font-semibold text-xl leading-snug tracking-wide' : 'text-white/60 text-sm leading-snug'}
          >
            {line}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function ImmersiveOverlay({ isActive, sceneCanvas, displayWhiteboardItems, contextImages, tutorImageUrl, onExit, activePanel, onDismissPanel }: ImmersiveOverlayProps) {
  const playbackState = usePlaybackState();
  const { difficulty } = useLanguage();
  const isSpeaking = playbackState === 'playing' || playbackState === 'buffering';
  const isThinking = playbackState === 'thinking';
  const voice = useGlobalVoiceInput();

  const activeMission = useGlobalMission();
  const [openSheet, setOpenSheet] = useState<SceneCanvasRichContent | null>(null);

  // PTT pointer tracking for immersive mode (mirrors ImmersiveTutor pattern)
  const isPointerRecordingRef = useRef<boolean>(false);
  const pttPointerTypeRef = useRef<'touch' | 'mouse' | null>(null);

  useEffect(() => {
    if (!isActive || !voice || voice.inputMode !== 'push-to-talk') return;

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (isPointerRecordingRef.current) {
        const pointerType = pttPointerTypeRef.current || 'mouse';
        isPointerRecordingRef.current = false;
        pttPointerTypeRef.current = null;
        voice.onRecordingStop(pointerType as 'mouse' | 'touch');
      }
    };
    const handleGlobalPointerCancel = (e: PointerEvent) => {
      if (isPointerRecordingRef.current) {
        isPointerRecordingRef.current = false;
        pttPointerTypeRef.current = null;
        voice.onRecordingStop('force');
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
    };
  }, [isActive, voice?.inputMode]);

  useEffect(() => {
    if (isActive) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [isActive]);

  // Close sheet when leaving immersive
  useEffect(() => {
    if (!isActive) setOpenSheet(null);
  }, [isActive]);

  const imageItems = (displayWhiteboardItems ?? []).filter(
    (item: any) => item.type === 'image' && item.data?.imageUrl
  );

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="immersive-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] overflow-hidden bg-black"
          data-testid="immersive-overlay"
        >
          {/* Background */}
          {sceneCanvas?.environmentImageUrl ? (
            <img
              src={sceneCanvas.environmentImageUrl}
              alt={sceneCanvas.environmentLabel || sceneCanvas.environment}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
          )}

          {/* Subtle dim layer */}
          <div className="absolute inset-0 bg-black/15" />

          {/*
           * Virtual 16:9 canvas — mirrors the object-cover image coordinate space.
           * Props positioned at cx/cy% within this div land at the same visual
           * location as in the source image.
           */}
          <div
            className="absolute"
            style={{
              width: 'max(100%, calc(100vh * 16 / 9))',
              height: 'max(100%, calc(100vw * 9 / 16))',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <AnimatePresence>
              {sceneCanvas?.props.map((prop) => {
                const tappable = Boolean(prop.richContent);
                return (
                  <motion.div
                    key={prop.name}
                    initial={{ opacity: 0, scale: 0.65 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.65 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="absolute"
                    style={{
                      left: `${prop.cx * 100}%`,
                      top: `${prop.cy * 100}%`,
                      width: `${prop.scale * 100}%`,
                      transform: "translate(-50%, -50%)",
                      pointerEvents: tappable ? 'auto' : 'none',
                      cursor: tappable ? 'pointer' : 'default',
                    }}
                    onClick={tappable ? () => setOpenSheet(prop.richContent!) : undefined}
                    data-testid={tappable ? `button-tap-prop-${prop.name}` : undefined}
                  >
                    <img
                      src={prop.imageUrl}
                      alt={prop.label}
                      className="w-full h-auto"
                      style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.45))" }}
                      draggable={false}
                    />
                    {/* Tap-to-open glow ring for tappable props */}
                    {tappable && (
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        animate={{ boxShadow: ['0 0 0 0px rgba(255,255,255,0.25)', '0 0 0 6px rgba(255,255,255,0)'] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    {/* Tap hint badge on tappable props — visible enough to discover */}
                    {tappable && (
                      <motion.div
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{ top: "calc(100% + 6px)", pointerEvents: 'none' }}
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <span className="flex flex-col items-center text-white rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 whitespace-nowrap border border-white/40 shadow-lg">
                          <span className="text-[11px] leading-tight font-bold tracking-wide">{prop.label}</span>
                          <span className="text-[9px] leading-tight text-white/80 font-medium">tap to open</span>
                          {prop.nativeLabel && <span className="text-[8px] leading-tight text-white/60">{prop.nativeLabel}</span>}
                        </span>
                      </motion.div>
                    )}
                    {/* Regular label for non-tappable props */}
                    {!tappable && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{ top: "calc(100% + 4px)" }}
                      >
                        <span className="flex flex-col items-center text-white rounded bg-black/70 px-2 py-1 whitespace-nowrap">
                          <span className="text-[11px] leading-tight font-semibold">{prop.label}</span>
                          {prop.nativeLabel && <span className="text-[9px] leading-tight text-white/70">{prop.nativeLabel}</span>}
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Whiteboard text strip — written words/phrases from Daniela */}
          <AnimatePresence>
            <ImmersiveWhiteboardStrip items={displayWhiteboardItems ?? []} />
          </AnimatePresence>

          {/* Floating whiteboard image items */}
          {imageItems.length > 0 && (
            <div className="absolute right-4 bottom-20 flex flex-col gap-2 items-end">
              {imageItems.slice(-3).map((item: any) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-lg overflow-hidden shadow-2xl"
                  style={{ width: "min(30vw, 200px)" }}
                >
                  <img
                    src={item.data.imageUrl}
                    alt={item.content || ""}
                    className="w-full h-auto"
                    draggable={false}
                  />
                  {item.content && (
                    <div className="bg-black/75 px-2 py-1">
                      <span className="text-white text-[10px] font-medium">{item.content}</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Objective HUD — top center, visible when Daniela sets a mission */}
          <AnimatePresence>
            {activeMission && (
              <motion.div
                key="mission-badge"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-10 max-w-[60%]"
                data-testid="immersive-objective-hud"
              >
                <div className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-black/50 border border-white/20 backdrop-blur-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                  <span className="text-xs font-medium text-white/90 truncate">{activeMission}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ambient turn indicator — top left */}
          <div className="absolute top-4 left-4 z-10">
            <AnimatePresence mode="wait">
              {isThinking ? (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-amber-500/25 border border-amber-400/50 backdrop-blur-sm"
                  data-testid="immersive-state-indicator"
                >
                  <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                  <span className="text-xs font-medium text-white/90">Thinking…</span>
                </motion.div>
              ) : isSpeaking ? (
                <motion.div
                  key="speaking"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-blue-500/30 border border-blue-400/50 backdrop-blur-sm"
                  data-testid="immersive-state-indicator"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <Volume2 className="w-3.5 h-3.5 text-blue-300" />
                  <span className="text-xs font-medium text-white/90">Daniela</span>
                </motion.div>
              ) : (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-green-500/20 border border-green-400/40 backdrop-blur-sm"
                  data-testid="immersive-state-indicator"
                >
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <Mic className="w-3.5 h-3.5 text-green-300" />
                  <span className="text-xs font-medium text-white/90">Your turn</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tutor avatar — bottom left corner, always visible so Daniela has presence in the scene */}
          {tutorImageUrl && (
            <motion.div
              className="absolute bottom-20 left-4 z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div
                className="rounded-full overflow-hidden border-2 border-white/30 shadow-xl backdrop-blur-sm bg-black/20"
                style={{ width: 72, height: 72 }}
                data-testid="immersive-tutor-avatar"
              >
                <img
                  src={tutorImageUrl}
                  alt="Daniela"
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
            </motion.div>
          )}

          {/* Context image chips — bottom right corner */}
          {contextImages && contextImages.length > 0 && (
            <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 items-end">
              {contextImages.map((img) => (
                <motion.div
                  key={img.category || img.word}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="relative rounded-md overflow-hidden shadow-lg border border-white/20"
                  style={{ width: 80, height: 60 }}
                  title={img.description || img.word}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.description || img.word}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/55 px-1 py-0.5">
                    <span className="text-white text-[9px] font-medium leading-none truncate block">{img.word}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Voice controls — bottom center */}
          {voice && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
              {/* Pulse ring behind button when recording */}
              <div className="relative flex items-center justify-center">
                {voice.isRecording && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-green-400/30 pointer-events-none" />
                )}

                {/* Main mic button */}
                {voice.inputMode === 'open-mic' ? (
                  <Button
                    variant="default"
                    size="icon"
                    onClick={() => {
                      if (voice.isRecording) {
                        voice.onRecordingStop();
                      } else {
                        voice.onRecordingStart();
                      }
                    }}
                    className={`h-12 w-12 rounded-full shadow-md select-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-200 ${
                      voice.isRecording
                        ? 'bg-green-500 scale-110 border border-green-300/40'
                        : 'bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50'
                    }`}
                    data-testid={voice.isRecording ? "button-immersive-open-mic-active" : "button-immersive-open-mic-idle"}
                    aria-pressed={voice.isRecording}
                    aria-label={voice.isRecording ? "Mic hot — tap to stop" : "Tap to start open mic"}
                  >
                    {voice.isRecording ? (
                      <Radio className="h-5 w-5 text-white" />
                    ) : (
                      <Mic className="h-5 w-5 text-white/80" />
                    )}
                  </Button>
                ) : (
                  <Button
                    variant={voice.isRecording ? "destructive" : "default"}
                    size="icon"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const pointerType = e.pointerType === 'touch' ? 'touch' : 'mouse';
                      let justInterrupted = false;
                      if ((voice.playbackState === 'playing' || voice.playbackState === 'buffering') && voice.onInterrupt) {
                        voice.onInterrupt();
                        justInterrupted = true;
                      }
                      if ((voice.isUsersTurn || justInterrupted) && !voice.isRecording && !voice.isMicPreparing && !isPointerRecordingRef.current) {
                        isPointerRecordingRef.current = true;
                        pttPointerTypeRef.current = pointerType;
                        voice.onRecordingStart(pointerType);
                      }
                    }}
                    onPointerUp={(e) => { e.preventDefault(); }}
                    onPointerCancel={(e) => { e.preventDefault(); }}
                    disabled={!voice.isUsersTurn && !voice.isRecording && voice.playbackState === 'idle'}
                    className={`h-12 w-12 rounded-full shadow-md select-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-200 ${
                      voice.isRecording
                        ? 'scale-110'
                        : voice.isMicPreparing
                          ? 'bg-black/30 backdrop-blur-sm border border-white/10 animate-pulse'
                          : 'bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50'
                    } ${!voice.isUsersTurn && !voice.isRecording && voice.playbackState === 'idle' ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                    data-testid={voice.isRecording ? "button-immersive-stop-recording" : "button-immersive-start-recording"}
                    aria-pressed={voice.isRecording || voice.isMicPreparing}
                    aria-label={voice.isMicPreparing ? "Preparing microphone…" : "Hold to speak"}
                  >
                    {voice.isRecording ? (
                      <MicOff className="h-5 w-5" />
                    ) : voice.isMicPreparing ? (
                      <Mic className="h-5 w-5 animate-pulse" />
                    ) : (
                      <Mic className="h-5 w-5 text-white/80" />
                    )}
                  </Button>
                )}
              </div>

              {/* Instruction hint + mode toggle */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/55 tracking-wide select-none">
                  {voice.inputMode === 'push-to-talk' ? 'Hold · ↵ Enter' : 'Tap to toggle'}
                </span>
                <button
                  onClick={() => voice.setInputMode(voice.inputMode === 'push-to-talk' ? 'open-mic' : 'push-to-talk')}
                  className="text-white/35 hover:text-white/70 transition-colors"
                  data-testid="button-immersive-mode-toggle"
                  aria-label={`Switch to ${voice.inputMode === 'push-to-talk' ? 'open mic' : 'push to talk'}`}
                  title={`Switch to ${voice.inputMode === 'push-to-talk' ? 'open mic' : 'push to talk'}`}
                >
                  <ArrowLeftRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Exit button — top right */}
          <div className="absolute top-4 right-4 z-10">
            <Button
              size="icon"
              variant="ghost"
              onClick={onExit}
              className="bg-black/40 text-white backdrop-blur-sm"
              data-testid="button-exit-immersive"
              aria-label="Exit immersive mode"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Overlay panel — slides in from right */}
          <AnimatePresence>
            {activePanel && onDismissPanel && (
              <OverlayPanelContent
                key={activePanel.type}
                panel={activePanel}
                onDismiss={onDismissPanel}
              />
            )}
          </AnimatePresence>

          {/* Rich content sheet (menu / bill) */}
          <AnimatePresence>
            {openSheet && (
              <RichContentSheet
                key="rich-sheet"
                content={openSheet}
                difficulty={difficulty}
                onClose={() => setOpenSheet(null)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
