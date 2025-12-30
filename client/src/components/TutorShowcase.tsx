import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  getAllTutorsForShowcase, 
  type TutorShowcaseData,
  type SupportedLanguage,
  type TutorGender 
} from "@/lib/tutor-avatars";

interface TutorCardProps {
  tutor: TutorShowcaseData;
  onSelect: () => void;
}

function TutorCard({ tutor, onSelect }: TutorCardProps) {
  return (
    <Card
      className="relative flex flex-col items-center p-3 pt-2 cursor-pointer transition-all duration-200 ease-out hover-elevate hover:scale-[1.03] shrink-0"
      style={{ 
        width: 110,
        height: 130,
      }}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      tabIndex={0}
      role="button"
      aria-label={`Practice ${tutor.language} with ${tutor.name}`}
      data-testid={`card-tutor-${tutor.language}-${tutor.gender}`}
    >
      <span 
        className="text-[10px] font-medium uppercase tracking-wide mb-1"
        style={{ color: tutor.accentColor }}
      >
        Click to Call
      </span>
      
      <div 
        className="rounded-full p-0.5 mb-2"
        style={{ 
          background: `linear-gradient(135deg, ${tutor.accentColor}, ${tutor.accentColor}80)` 
        }}
      >
        <Avatar 
          className="border-2 border-background"
          style={{ width: 64, height: 64 }}
        >
          <AvatarImage 
            src={tutor.avatar} 
            alt={tutor.name}
            className="object-cover"
            loading="lazy"
          />
          <AvatarFallback 
            className="text-lg font-semibold"
            style={{ backgroundColor: tutor.accentColor + '20', color: tutor.accentColor }}
          >
            {tutor.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      </div>
      
      <span className="text-sm font-semibold text-center leading-tight">
        {tutor.name}
      </span>
    </Card>
  );
}

export interface TutorSelection {
  language: SupportedLanguage;
  gender: TutorGender;
  name: string;
}

interface TutorShowcaseProps {
  onTutorSelect?: (selection: TutorSelection | null) => void;
  selectedLanguage?: string;
  selectedGender?: TutorGender;
  filterSlot?: React.ReactNode;
  className?: string;
}

export function TutorShowcase({ 
  onTutorSelect, 
  selectedLanguage = 'spanish',
  selectedGender = 'female',
  filterSlot,
  className = '' 
}: TutorShowcaseProps) {
  const allTutors = useMemo(() => getAllTutorsForShowcase(), []);
  
  const languageTutors = useMemo(() => {
    const lang = selectedLanguage === 'all' ? 'spanish' : selectedLanguage;
    return allTutors.filter(t => t.language === lang);
  }, [selectedLanguage, allTutors]);
  
  const handleSelect = (tutor: TutorShowcaseData) => {
    onTutorSelect?.({
      language: tutor.language,
      gender: tutor.gender,
      name: tutor.name,
    });
  };

  return (
    <div className={`w-full ${className}`} data-testid="tutor-showcase">
      <div className="flex items-start justify-start gap-6 flex-wrap">
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-lg md:text-xl font-semibold">
            Meet Your Tutors
          </h2>
          {filterSlot}
        </div>
        
        <div className="flex items-center gap-3">
          {languageTutors.map((tutor) => (
            <TutorCard
              key={`${tutor.language}-${tutor.gender}`}
              tutor={tutor}
              onSelect={() => handleSelect(tutor)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
