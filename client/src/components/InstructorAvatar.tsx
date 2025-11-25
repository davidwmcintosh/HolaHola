import Lottie from "lottie-react";
import idleBreathingAnimation from "@assets/lottie/tutor_idle_breathing.json";
import speakingBreathingAnimation from "@assets/lottie/tutor_speaking_breathing.json";

export type AvatarState = "idle" | "listening" | "speaking";

interface InstructorAvatarProps {
  state: AvatarState;
  className?: string;
}

export function InstructorAvatar({ state, className = "" }: InstructorAvatarProps) {
  // Get animation and label based on state
  const currentAnimation = state === "speaking" ? speakingBreathingAnimation : idleBreathingAnimation;
  
  const getStateLabel = () => {
    switch (state) {
      case "listening":
        return "Listening";
      case "speaking":
        return "Teaching";
      default:
        return "Ready";
    }
  };

  return (
    <div className={`relative ${className}`} data-testid="instructor-avatar">
      <div className="flex flex-col items-center gap-2">
        {/* Subtle breathing Lottie animation */}
        <div 
          className="relative"
          aria-label={`Tutor status: ${getStateLabel()}`}
          data-testid={`avatar-state-${state}`}
        >
          <Lottie
            animationData={currentAnimation}
            loop={true}
            autoplay={true}
            style={{ opacity: 0.7 }}
            rendererSettings={{
              preserveAspectRatio: "xMidYMid meet"
            }}
          />
        </div>
        
        {/* State label - always visible for clarity */}
        <p className="text-xs text-muted-foreground font-medium" aria-live="polite">
          {getStateLabel()}
        </p>
      </div>
    </div>
  );
}
