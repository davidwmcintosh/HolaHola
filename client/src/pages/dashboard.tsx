import { useState } from "react";
import { WelcomeHero } from "@/components/WelcomeHero";
import { LearningAlerts } from "@/components/LearningAlerts";
import { SyllabusMindMap } from "@/components/SyllabusMindMap";
import { TutorShowcase, type TutorSelection } from "@/components/TutorShowcase";

import { InteractiveTextbookCard } from "@/components/InteractiveTextbookCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSidebar } from "@/components/ui/sidebar";
import { Target, ArrowRight, Sparkles } from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { language, setLanguage } = useLanguage();
  const { setOpenMobile, isMobile } = useSidebar();
  const [selectedTutor, setSelectedTutor] = useState<TutorSelection | null>(null);
  
  const handleStartPractice = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    if (selectedTutor) {
      setLanguage(selectedTutor.language);
      localStorage.setItem('tutorGender', selectedTutor.gender);
    }
    setLocation("/chat");
  };
  
  const handleTutorSelect = (selection: TutorSelection | null) => {
    setSelectedTutor(selection);
  };

  const displayLanguage = selectedTutor?.language || language;
  const ctaText = selectedTutor 
    ? `Practice with ${selectedTutor.name}` 
    : 'Start Practicing';

  return (
    <div className="space-y-6 md:space-y-8 w-full max-w-full overflow-hidden">
      <WelcomeHero 
        onStartPractice={handleStartPractice} 
        ctaText={ctaText}
      />
      
      {/* Meet Your Tutors Section */}
      <div className="space-y-4">
        {/* Main Tutors */}
        <TutorShowcase 
          onTutorSelect={handleTutorSelect}
          selectedLanguage={selectedTutor?.language}
          selectedGender={selectedTutor?.gender}
          className="py-2"
        />
        

      </div>
      
      {/* Interactive Textbook Entry */}
      <InteractiveTextbookCard />
      
      {/* Learning Alerts */}
      <LearningAlerts language={displayLanguage} />
      
      {/* Brain Mind Map - Central Feature */}
      <div className="w-full">
        <SyllabusMindMap 
          language={displayLanguage} 
          mode="emergent" 
        />
      </div>
      
      {/* What's Next - Link to Review Hub */}
      <Link href="/review">
        <Card className="p-4 md:p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20 hover-elevate cursor-pointer" data-testid="card-whats-next">
          <div className="flex items-center justify-between flex-wrap gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-primary/20">
                <Target className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  What's Next?
                  <Sparkles className="h-4 w-4 text-primary" />
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  View your personalized learning plan and due reviews
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1 text-xs md:text-sm">
              Review Hub
              <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </Card>
      </Link>
    </div>
  );
}
