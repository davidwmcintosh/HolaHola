import { Mic, Volume2 } from "lucide-react";

export type AvatarState = "idle" | "listening" | "speaking";

interface InstructorAvatarProps {
  state: AvatarState;
  className?: string;
}

export function InstructorAvatar({ state, className = "" }: InstructorAvatarProps) {
  // Get colors and animation based on state - different animations for clarity
  const getStateStyles = () => {
    switch (state) {
      case "listening":
        return {
          bg: "bg-primary/15",
          border: "border-primary",
          glow: "shadow-lg shadow-primary/30",
          pulse: "animate-pulse", // Slow pulse for listening
          icon: <Mic className="w-6 h-6 text-primary" />,
          label: "Listening",
        };
      case "speaking":
        return {
          bg: "bg-primary/25",
          border: "border-primary",
          glow: "shadow-xl shadow-primary/50",
          pulse: "", // No pulse - use ping animation instead
          icon: <Volume2 className="w-6 h-6 text-primary" />,
          label: "Teaching",
        };
      default:
        return {
          bg: "bg-muted/50",
          border: "border-muted-foreground/20",
          glow: "",
          pulse: "",
          icon: null,
          label: "Ready",
        };
    }
  };

  const styles = getStateStyles();

  return (
    <div className={`relative ${className}`} data-testid="instructor-avatar">
      <div className="flex flex-col items-center gap-2">
        {/* Minimal circular avatar with icon */}
        <div className="relative">
          <div
            className={`
              aspect-square rounded-full
              ${styles.bg} ${styles.border} ${styles.glow} ${styles.pulse}
              border-4
              transition-all duration-500
              flex items-center justify-center
            `}
            aria-label={`Tutor status: ${styles.label}`}
            data-testid={`avatar-state-${state}`}
          >
            {/* Ping animation ring for speaking state only */}
            {state === "speaking" && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
            )}
            
            {/* Icon indicator */}
            {styles.icon && (
              <span className="relative z-10">{styles.icon}</span>
            )}
          </div>
        </div>
        
        {/* State label - always visible for clarity */}
        <p className="text-xs text-muted-foreground font-medium" aria-live="polite">
          {styles.label}
        </p>
      </div>
    </div>
  );
}
