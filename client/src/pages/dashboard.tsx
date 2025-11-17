import { WelcomeHero } from "@/components/WelcomeHero";
import { StatsCards } from "@/components/StatsCards";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DifficultySelector } from "@/components/DifficultySelector";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { userName, setUserName } = useLanguage();

  return (
    <div className="space-y-8">
      <WelcomeHero onStartPractice={() => setLocation("/chat")} />
      
      <div className="space-y-4">
        <h2 className="text-3xl font-semibold">Your Progress</h2>
        <StatsCards />
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
            <div>
              <label className="text-sm font-medium mb-2 block">Difficulty Level</label>
              <DifficultySelector />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
