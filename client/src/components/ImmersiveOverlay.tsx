import { useEffect } from "react";
import { X, Mic, Volume2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { usePlaybackState } from "@/lib/playbackStateStore";
import type { SceneCanvasItemData, WhiteboardItem } from "@shared/whiteboard-types";

interface ImmersiveOverlayProps {
  isActive: boolean;
  sceneCanvas: SceneCanvasItemData | null;
  displayWhiteboardItems?: WhiteboardItem[];
  onExit: () => void;
}

export function ImmersiveOverlay({ isActive, sceneCanvas, displayWhiteboardItems, onExit }: ImmersiveOverlayProps) {
  const playbackState = usePlaybackState();
  const isSpeaking = playbackState === 'playing' || playbackState === 'buffering';
  const isThinking = playbackState === 'thinking';

  useEffect(() => {
    if (isActive) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
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
          {/* Background — fills the entire viewport with object-cover */}
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
           *
           * object-cover scales the image so it covers the container fully.
           * This div uses the same math:
           *   width  = max(100vw, 100vh * 16/9)
           *   height = max(100vh, 100vw * 9/16)
           * …then is centered. Props positioned at cx/cy% within this div
           * will land at the same visual location as in the source image.
           */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 'max(100%, calc(100vh * 16 / 9))',
              height: 'max(100%, calc(100vw * 9 / 16))',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <AnimatePresence>
              {sceneCanvas?.props.map((prop) => (
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
                    pointerEvents: "none",
                  }}
                >
                  <img
                    src={prop.imageUrl}
                    alt={prop.label}
                    className="w-full h-auto"
                    style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.45))" }}
                    draggable={false}
                  />
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ top: "calc(100% + 4px)" }}
                  >
                    <span className="text-white text-[11px] leading-none font-semibold px-2 py-1 rounded bg-black/70 whitespace-nowrap">
                      {prop.label}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Floating whiteboard image items (e.g. ordering menu from compose_visual_scene) */}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
