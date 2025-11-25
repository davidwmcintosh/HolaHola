import { useState, useEffect } from "react";
import idleImage from "@assets/generated_images/Friendly_teacher_idle_state_fd4580c6.png";
import listeningImage from "@assets/generated_images/Teacher_listening_attentively_f9f6c37e.png";
import speakingImage from "@assets/generated_images/Teacher_speaking_animatedly_62a6f01b.png";

export type AvatarState = "idle" | "listening" | "speaking";

interface InstructorAvatarProps {
  state: AvatarState;
  className?: string;
}

export function InstructorAvatar({ state, className = "" }: InstructorAvatarProps) {
  const [currentImage, setCurrentImage] = useState(idleImage);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Update image when state changes
  useEffect(() => {
    let newImage = idleImage;
    
    switch (state) {
      case "idle":
        newImage = idleImage;
        break;
      case "listening":
        newImage = listeningImage;
        break;
      case "speaking":
        newImage = speakingImage;
        break;
    }

    if (newImage !== currentImage) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentImage(newImage);
        setIsTransitioning(false);
      }, 150);
    }
  }, [state, currentImage]);

  // Get animation classes based on state
  const getAnimationClass = () => {
    switch (state) {
      case "listening":
        return "animate-pulse";
      case "speaking":
        return "animate-bounce-subtle";
      default:
        return "";
    }
  };

  return (
    <div className={`relative ${className}`} data-testid="instructor-avatar">
      <div
        className={`relative transition-all duration-300 ${
          isTransitioning ? "opacity-50 scale-95" : "opacity-100 scale-100"
        }`}
      >
        {/* Glow effect for speaking state */}
        {state === "speaking" && (
          <div className="absolute inset-0 -z-10 animate-pulse">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
          </div>
        )}

        {/* Listening indicator */}
        {state === "listening" && (
          <div className="absolute -top-2 -right-2 z-10">
            <div className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 animate-pulse">
              <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
              Listening
            </div>
          </div>
        )}

        {/* Main avatar image */}
        <div
          className={`relative overflow-hidden rounded-2xl bg-card border-2 ${
            state === "speaking"
              ? "border-primary shadow-lg shadow-primary/20"
              : state === "listening"
              ? "border-primary/50"
              : "border-border"
          } ${getAnimationClass()}`}
        >
          <img
            src={currentImage}
            alt={`Language instructor - ${state}`}
            className="w-full h-full object-cover"
            data-testid={`avatar-state-${state}`}
          />
        </div>
      </div>

      {/* State label */}
      <div className="mt-2 text-center">
        <p className="text-sm text-muted-foreground font-medium">
          {state === "idle" && "Ready to help"}
          {state === "listening" && "Listening carefully..."}
          {state === "speaking" && "Teaching"}
        </p>
      </div>
    </div>
  );
}
