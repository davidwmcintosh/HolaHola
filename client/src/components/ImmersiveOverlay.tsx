import { useEffect, useRef } from "react";
import { X, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneCanvas } from "@/components/SceneCanvas";
import { usePlaybackState } from "@/lib/playbackStateStore";
import type { SceneCanvasItemData } from "@shared/whiteboard-types";

interface ImmersiveOverlayProps {
  isActive: boolean;
  sceneCanvas: SceneCanvasItemData | null;
  onExit: () => void;
}

export function ImmersiveOverlay({ isActive, sceneCanvas, onExit }: ImmersiveOverlayProps) {
  const playbackState = usePlaybackState();
  const isSpeaking = playbackState === 'playing' || playbackState === 'buffering';
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) {
      const el = document.documentElement;
      el.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] bg-black flex flex-col"
      data-testid="immersive-overlay"
    >
      {/* Exit button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          size="icon"
          variant="ghost"
          onClick={onExit}
          className="bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm"
          data-testid="button-exit-immersive"
          aria-label="Exit immersive mode"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Ambient state indicator */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-sm transition-all duration-500 ${
            isSpeaking
              ? "bg-blue-500/30 border border-blue-400/50"
              : "bg-green-500/20 border border-green-400/40"
          }`}
          data-testid="immersive-state-indicator"
        >
          <div
            className={`w-2 h-2 rounded-full animate-pulse ${
              isSpeaking ? "bg-blue-400" : "bg-green-400"
            }`}
          />
          {isSpeaking ? (
            <Volume2 className="w-3.5 h-3.5 text-blue-300" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-green-300" />
          )}
          <span className="text-xs font-medium text-white/90">
            {isSpeaking ? "Daniela" : "Your turn"}
          </span>
        </div>
      </div>

      {/* Scene canvas — full height */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {sceneCanvas ? (
          <div className="w-full h-full">
            <SceneCanvas
              data={sceneCanvas}
              data-testid="immersive-scene-canvas"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-white/40">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
              <Volume2 className="w-10 h-10" />
            </div>
            <p className="text-sm">Immersive mode active</p>
          </div>
        )}
      </div>
    </div>
  );
}
