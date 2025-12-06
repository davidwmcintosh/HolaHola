import { WelcomeHero } from "@/components/WelcomeHero";
import { StatsCards } from "@/components/StatsCards";
import { StreakIndicator } from "@/components/StreakIndicator";
import { ProgressCharts } from "@/components/ProgressCharts";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ActflFluencyDial } from "@/components/ActflFluencyDial";
import { UsageOverview, SessionHistory } from "@/components/SessionHistory";
import { LearningAlerts } from "@/components/LearningAlerts";
import { LearningPaceCard } from "@/components/LearningPaceCard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSidebar } from "@/components/ui/sidebar";
import { Target, ArrowRight, Sparkles } from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { userName, setUserName, language } = useLanguage();
  const { setOpenMobile, isMobile } = useSidebar();
  
  const handleStartPractice = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    setLocation("/chat");
  };

  return (
    <div className="space-y-8">
      <WelcomeHero onStartPractice={handleStartPractice} />
      
      {/* Learning Alerts */}
      <LearningAlerts language={language} />
      
      {/* What's Next - Link to Review Hub */}
      <Link href="/review">
        <Card className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20 hover-elevate cursor-pointer" data-testid="card-whats-next">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  What's Next?
                  <Sparkles className="h-4 w-4 text-primary" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  View your personalized learning plan - due reviews, topics to practice, and more
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1">
              Review Hub
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </Link>
      
      <div className="space-y-4">
        <h2 className="text-3xl font-semibold">Your Progress</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <StatsCards />
            <UsageOverview />
            <SessionHistory limit={5} />
          </div>
          <div className="space-y-6">
            <ActflFluencyDial />
            <LearningPaceCard />
            <StreakIndicator />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Progress Charts</h2>
        <ProgressCharts />
      </div>

      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-4">Learning Settings</h3>
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Name</label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                data-testid="input-username"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Current Language</label>
              <LanguageSelector />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
