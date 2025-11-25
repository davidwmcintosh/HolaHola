import Lottie from "lottie-react";
import { Mic, Volume2 } from "lucide-react";
import idleBreathingAnimation from "@assets/lottie/tutor_idle_breathing.json";
import listeningPulseAnimation from "@assets/lottie/tutor_listening_pulse.json";
import speakingBreathingAnimation from "@assets/lottie/tutor_speaking_breathing.json";

export type AvatarState = "idle" | "listening" | "speaking";

interface InstructorAvatarProps {
  state: AvatarState;
  className?: string;
}

export function InstructorAvatar({ state, className = "" }: InstructorAvatarProps) {
  // Select unique animation for each state
  const getCurrentAnimation = () => {
    switch (state) {
      case "listening":
        return listeningPulseAnimation;
      case "speaking":
        return speakingBreathingAnimation;
      default:
        return idleBreathingAnimation;
    }
  };
  
  const currentAnimation = getCurrentAnimation();
  
  // Get state configuration with icon and visual treatment
  const getStateConfig = () => {
    switch (state) {
      case "listening":
        return {
          label: "Listening",
          icon: <Mic className="w-6 h-6 text-primary" />,
          opacity: 0.8,
        };
      case "speaking":
        return {
          label: "Teaching",
          icon: <Volume2 className="w-6 h-6 text-primary" />,
          opacity: 0.9,
        };
      default:
        return {
          label: "Ready",
          icon: null,
          opacity: 0.6,
        };
    }
  };

  const stateConfig = getStateConfig();

  return (
    <div className={`relative ${className}`} data-testid="instructor-avatar">
      <div className="flex flex-col items-center gap-2">
        {/* Animation with icon overlay - unique animation per state */}
        <div 
          className="relative"
          aria-label={`Tutor status: ${stateConfig.label}`}
          data-testid={`avatar-state-${state}`}
        >
          {/* Lottie animation (idle/listening/speaking) */}
          <Lottie
            animationData={currentAnimation}
            loop={true}
            autoplay={true}
            style={{ opacity: stateConfig.opacity }}
            rendererSettings={{
              preserveAspectRatio: "xMidYMid meet"
            }}
          />
          
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
