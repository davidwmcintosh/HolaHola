import { useState, useEffect } from "react";
import idleImage from "@assets/generated_images/Friendly_teacher_idle_state_fd4580c6.png";
import listeningImage from "@assets/generated_images/Teacher_listening_attentively_f9f6c37e.png";
import speakingImage from "@assets/generated_images/Teacher_speaking_animatedly_62a6f01b.png";
import type { OpenMicState } from "@shared/streaming-voice-types";

export type AvatarState = "idle" | "listening" | "speaking";

interface InstructorAvatarProps {
  state: AvatarState;
  openMicState?: OpenMicState;  // For more granular visual feedback
  className?: string;
}

export function InstructorAvatar({ state, openMicState, className = "" }: InstructorAvatarProps) {
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
  
  // Determine if we should show the green "ready to listen" indicator
  // Green light shows when: (1) not speaking AND (2) openMicState is 'ready' or 'listening'
  // Blue/processing shows when: openMicState is 'processing'
  // No indicator shows when: speaking OR idle/no session
  const showGreenLight = state !== 'speaking' && (openMicState === 'ready' || openMicState === 'listening');
  const showBlueProcessing = state !== 'speaking' && openMicState === 'processing';
  const isActivelyListening = openMicState === 'listening';  // User is speaking

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

        {/* Green light indicator - shows when ready to listen OR actively listening */}
        {/* Green = "Your turn to speak" invitation (ready) OR "I hear you" (listening) */}
        {showGreenLight && (
          <div className="absolute -top-2 -right-2 z-10">
            <div className={`rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 ${
              isActivelyListening 
                ? "bg-green-500 text-white animate-pulse"  // Active: pulsing when user speaks
                : "bg-green-500 text-white"  // Ready: solid green invitation
            }`}>
              <div className={`w-2 h-2 bg-white rounded-full ${isActivelyListening ? 'animate-pulse' : ''}`} />
              {isActivelyListening ? "Listening" : "Your turn"}
            </div>
          </div>
        )}
        
        {/* Blue processing indicator - shows when waiting for AI response */}
        {showBlueProcessing && (
          <div className="absolute -top-2 -right-2 z-10">
            <div className="bg-blue-500 text-white rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Thinking...
            </div>
          </div>
        )}
        
        {/* Legacy listening indicator - only shown if openMicState is not provided */}
        {state === "listening" && !openMicState && (
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

      {/* State label - shows different text based on open mic state if provided */}
      <div className="mt-2 text-center">
        <p className="text-sm text-muted-foreground font-medium">
          {/* When openMicState is provided, use more specific labels */}
          {openMicState && state !== 'speaking' && openMicState === 'ready' && "Go ahead, I'm listening"}
          {openMicState && state !== 'speaking' && openMicState === 'listening' && "I hear you..."}
          {openMicState && state !== 'speaking' && openMicState === 'processing' && "Let me think..."}
          {openMicState && state === 'speaking' && "Teaching"}
          {/* Legacy behavior when openMicState is not provided */}
          {!openMicState && state === "idle" && "Ready to help"}
          {!openMicState && state === "listening" && "Listening carefully..."}
          {!openMicState && state === "speaking" && "Teaching"}
          {/* Idle state with no openMicState */}
          {openMicState === 'idle' && state !== 'speaking' && "Ready to help"}
        </p>
      </div>
    </div>
  );
}
