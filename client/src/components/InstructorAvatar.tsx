import Lottie from "lottie-react";
import { Mic, Volume2 } from "lucide-react";
import idleAnimation from "@assets/lottie/teacher_idle.json";
import speakingAnimation from "@assets/lottie/teacher_speaking.json";

export type AvatarState = "idle" | "listening" | "speaking";

interface InstructorAvatarProps {
  state: AvatarState;
  className?: string;
}

export function InstructorAvatar({ state, className = "" }: InstructorAvatarProps) {
  // Select animation: speaking animation for speaking, idle for both idle and listening
  const currentAnimation = state === "speaking" ? speakingAnimation : idleAnimation;
  
  // Get state configuration with icon and visual treatment
  const getStateConfig = () => {
    switch (state) {
      case "listening":
        return {
          label: "Listening",
          icon: <Mic className="w-6 h-6 text-primary" />,
          opacity: 0.8,
          pulse: true,
        };
      case "speaking":
        return {
          label: "Teaching",
          icon: <Volume2 className="w-6 h-6 text-primary" />,
          opacity: 0.9,
          pulse: false,
        };
      default:
        return {
          label: "Ready",
          icon: null,
          opacity: 0.6,
          pulse: false,
        };
    }
  };

  const stateConfig = getStateConfig();

  return (
    <div className={`relative ${className}`} data-testid="instructor-avatar">
      <div className="flex flex-col items-center gap-2">
        {/* Animation with icon overlay */}
        <div 
          className="relative"
          aria-label={`Tutor status: ${stateConfig.label}`}
          data-testid={`avatar-state-${state}`}
        >
          {/* Lottie animation with pulse effect for listening */}
          <div className={stateConfig.pulse ? "animate-pulse" : ""}>
            <Lottie
              animationData={currentAnimation}
              loop={true}
              autoplay={true}
              style={{ opacity: stateConfig.opacity }}
              rendererSettings={{
                preserveAspectRatio: "xMidYMid meet"
              }}
            />
          </div>
          
          {/* State icon overlay */}
          {stateConfig.icon && (
            <div className="absolute inset-0 flex items-center justify-center">
              {stateConfig.icon}
            </div>
          )}
        </div>
        
        {/* State label - always visible for clarity */}
        <p className="text-xs text-muted-foreground font-medium" aria-live="polite">
          {stateConfig.label}
        </p>
      </div>
    </div>
  );
}
