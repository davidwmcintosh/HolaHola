import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "@assets/generated_images/Language_learning_hero_illustration_991e6d31.png";
import holaholaLogo from "@assets/holaholamainlogoBackgroundRemoved_1765308837223.png";

interface WelcomeHeroProps {
  onStartPractice?: () => void;
  ctaText?: string;
}

export function WelcomeHero({ onStartPractice, ctaText = "Start Practicing" }: WelcomeHeroProps) {
  const handleStartPractice = () => {
    localStorage.setItem('forceNewConversation', 'true');
    onStartPractice?.();
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="relative min-h-[200px] md:min-h-[280px] flex items-center justify-center py-8 md:py-12">
        <img 
          src={heroImage} 
          alt="Language learning illustration" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60" />
        
        <img 
          src={holaholaLogo}
          alt="HolaHola"
          className="absolute top-3 right-3 md:top-4 md:right-4 h-10 md:h-14 w-auto opacity-90"
          data-testid="img-holahola-logo"
        />
        
        <div className="relative z-10 max-w-2xl px-4 md:px-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4">
            Master Any Language with AI
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-4 md:mb-6 leading-relaxed">
            Practice conversations, build vocabulary, and perfect your grammar with personalized AI-powered lessons
          </p>
          <Button 
            size="default" 
            className="text-sm md:text-base px-4 md:px-6"
            onClick={handleStartPractice}
            data-testid="button-start-practice"
          >
            {ctaText}
            <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
