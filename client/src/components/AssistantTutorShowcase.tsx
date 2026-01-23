import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dumbbell } from "lucide-react";
import { useLocation } from "wouter";
import { 
  languageAccentColors,
  normalizeLanguage,
  type SupportedLanguage,
  type TutorGender 
} from "@/lib/tutor-avatars";
import { useLanguage } from "@/contexts/LanguageContext";

const ASSISTANT_TUTORS: Record<string, { female: string; male: string }> = {
  spanish: { female: 'Aris', male: 'Marco' },
  french: { female: 'Colette', male: 'Henri' },
  german: { female: 'Liesel', male: 'Klaus' },
  italian: { female: 'Valentina', male: 'Enzo' },
  japanese: { female: 'Yuki', male: 'Takeshi' },
  chinese: { female: 'Lian', male: 'Chen' },
  portuguese: { female: 'Beatriz', male: 'Tiago' },
  english: { female: 'Grace', male: 'Oliver' },
  korean: { female: 'Eun-ji', male: 'Min-ho' },
};

const ASSISTANT_TAGLINES: Record<string, { female: string; male: string }> = {
  spanish: { female: 'Practice Partner', male: 'Drill Coach' },
  french: { female: 'Practice Partner', male: 'Drill Coach' },
  german: { female: 'Practice Partner', male: 'Drill Coach' },
  italian: { female: 'Practice Partner', male: 'Drill Coach' },
  japanese: { female: 'Practice Partner', male: 'Drill Coach' },
  chinese: { female: 'Practice Partner', male: 'Drill Coach' },
  portuguese: { female: 'Practice Partner', male: 'Drill Coach' },
  english: { female: 'Practice Partner', male: 'Drill Coach' },
  korean: { female: 'Practice Partner', male: 'Drill Coach' },
};

interface AssistantShowcaseData {
  language: SupportedLanguage;
  gender: TutorGender;
  name: string;
  tagline: string;
  accentColor: string;
}


function getAllAssistantsForShowcase(): AssistantShowcaseData[] {
  const languages: SupportedLanguage[] = [
    'spanish', 'french', 'german', 'italian', 'portuguese',
    'chinese', 'japanese', 'korean', 'english'
  ];
  const genders: TutorGender[] = ['female', 'male'];
  
  const assistants: AssistantShowcaseData[] = [];
  
  for (const language of languages) {
    for (const gender of genders) {
      const config = ASSISTANT_TUTORS[language] || { female: 'Aris', male: 'Marco' };
      const taglines = ASSISTANT_TAGLINES[language] || { female: 'Practice Partner', male: 'Drill Coach' };
      assistants.push({
        language,
        gender,
        name: config[gender],
        tagline: taglines[gender],
        accentColor: languageAccentColors[language],
      });
    }
  }
  
  return assistants;
}

interface AssistantCardProps {
  assistant: AssistantShowcaseData;
  onSelect: () => void;
}

function AssistantCard({ assistant, onSelect }: AssistantCardProps) {
  return (
    <Card
      className="relative flex flex-col items-center p-2 pt-1.5 cursor-pointer transition-all duration-200 ease-out hover-elevate hover:scale-[1.03] shrink-0"
      style={{ 
        width: 72,
        height: 80,
      }}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      tabIndex={0}
      role="button"
      aria-label={`Practice drills with ${assistant.name}`}
      data-testid={`card-assistant-${assistant.language}-${assistant.gender}`}
    >
      <div 
        className="rounded-full p-0.5 mb-1.5"
        style={{ 
          background: `linear-gradient(135deg, ${assistant.accentColor}80, ${assistant.accentColor}40)` 
        }}
      >
        <Avatar 
          className="border border-background"
          style={{ width: 36, height: 36 }}
        >
          <AvatarFallback 
            className="text-xs font-semibold"
            style={{ backgroundColor: assistant.accentColor + '20', color: assistant.accentColor }}
          >
            <Dumbbell className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </div>
      
      <span className="text-[10px] font-semibold text-center leading-tight">
        {assistant.name}
      </span>
    </Card>
  );
}

interface AssistantTutorShowcaseProps {
  className?: string;
}

export function AssistantTutorShowcase({ className = '' }: AssistantTutorShowcaseProps) {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const allAssistants = useMemo(() => getAllAssistantsForShowcase(), []);
  
  const languageAssistants = useMemo(() => {
    const lang = normalizeLanguage(language);
    return allAssistants.filter(a => a.language === lang);
  }, [language, allAssistants]);
  
  const handleSelect = (assistant: AssistantShowcaseData) => {
    localStorage.setItem('tutorGender', assistant.gender);
    setLocation('/practice');
  };

  return (
    <div className={`w-full pl-20 md:pl-32 ${className}`} data-testid="assistant-tutor-showcase">
      <div className="flex items-start justify-start gap-4 flex-wrap">
        <div className="flex flex-col items-start gap-1 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Practice Partners
          </h3>
          <p className="text-xs text-muted-foreground">Drill & Review</p>
        </div>
        
        <div className="flex items-center gap-2">
          {languageAssistants.map((assistant) => (
            <AssistantCard
              key={`${assistant.language}-${assistant.gender}`}
              assistant={assistant}
              onSelect={() => handleSelect(assistant)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
