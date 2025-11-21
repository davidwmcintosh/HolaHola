import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "@assets/generated_images/Language_learning_hero_illustration_991e6d31.png";

interface WelcomeHeroProps {
  onStartPractice?: () => void;
}

export function WelcomeHero({ onStartPractice }: WelcomeHeroProps) {
  const handleStartPractice = () => {
    // Force new conversation when starting practice from dashboard
    localStorage.setItem('forceNewConversation', 'true');
    onStartPractice?.();
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="relative h-96 flex items-center justify-center">
        <img 
          src={heroImage} 
          alt="Language learning illustration" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60" />
        <div className="relative z-10 max-w-2xl px-8 text-center">
          <h1 className="text-5xl font-bold mb-4">
            Master Any Language with AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Practice conversations, build vocabulary, and perfect your grammar with personalized AI-powered lessons
          </p>
          <Button 
            size="lg" 
            className="text-base px-6 py-3"
            onClick={handleStartPractice}
            data-testid="button-start-practice"
          >
            Start Practicing
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
