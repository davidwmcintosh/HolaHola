import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface AudioPlayButtonProps {
  drillItemId: string;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline" | "default";
  className?: string;
  showLabel?: boolean;
  onPlay?: () => void;
  onError?: (error: string) => void;
}

export function AudioPlayButton({
  drillItemId,
  size = "icon",
  variant = "ghost",
  className,
  showLabel = false,
  onPlay,
  onError,
}: AudioPlayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback(async () => {
    if (isLoading || isPlaying) return;

    setIsLoading(true);
    setHasError(false);

    try {
      const response = await apiRequest("GET", `/api/drill-audio/${drillItemId}`);
      const data = await response.json();
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
        onPlay?.();
      };

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        setHasError(true);
        onError?.("Failed to play audio");
      };

      await audio.play();
    } catch (error: any) {
      console.error("Audio play error:", error);
      setIsLoading(false);
      setHasError(true);
      onError?.(error.message || "Failed to play audio");
    }
  }, [drillItemId, isLoading, isPlaying, onPlay, onError]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleClick = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      handlePlay();
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={cn(
        "transition-all",
        isPlaying && "text-primary",
        hasError && "text-destructive",
        className
      )}
      onClick={handleClick}
      disabled={isLoading}
      data-testid={`audio-play-${drillItemId}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : hasError ? (
        <VolumeX className="h-4 w-4" />
      ) : (
        <Volume2 className={cn("h-4 w-4", isPlaying && "animate-pulse")} />
      )}
      {showLabel && (
        <span className="ml-2">
          {isLoading ? "Loading..." : isPlaying ? "Playing" : "Listen"}
        </span>
      )}
    </Button>
  );
}

interface TextAudioPlayButtonProps {
  text: string;
  language: string;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline" | "default";
  className?: string;
  showLabel?: boolean;
  onPlay?: () => void;
  onError?: (error: string) => void;
}

export function TextAudioPlayButton({
  text,
  language,
  size = "icon",
  variant = "ghost",
  className,
  showLabel = false,
  onPlay,
  onError,
}: TextAudioPlayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback(async () => {
    if (isLoading || isPlaying) return;

    setIsLoading(true);
    setHasError(false);

    try {
      const response = await apiRequest("POST", "/api/tts/pronunciation", { text, language });
      const data = await response.json();
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
        onPlay?.();
      };

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        setHasError(true);
        onError?.("Failed to play audio");
      };

      await audio.play();
    } catch (error: any) {
      console.error("Audio play error:", error);
      setIsLoading(false);
      setHasError(true);
      onError?.(error.message || "Failed to play audio");
    }
  }, [text, language, isLoading, isPlaying, onPlay, onError]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleClick = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      handlePlay();
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={cn(
        "transition-all",
        isPlaying && "text-primary",
        hasError && "text-destructive",
        className
      )}
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isPlaying ? `Stop playing ${text}` : `Play pronunciation of ${text}`}
      data-testid={`audio-play-text-${text.substring(0, 20)}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : hasError ? (
        <VolumeX className="h-4 w-4" />
      ) : (
        <Volume2 className={cn("h-4 w-4", isPlaying && "animate-pulse")} />
      )}
      {showLabel && (
        <span className="ml-2">
          {isLoading ? "Loading..." : isPlaying ? "Playing" : "Listen"}
        </span>
      )}
    </Button>
  );
}
