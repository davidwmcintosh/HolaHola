import { useState, useRef, useEffect, useMemo } from "react";
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
  isSelected: boolean;
  onSelect: () => void;
  isMobile: boolean;
  isFiltered?: boolean;
}

function TutorCard({ tutor, isSelected, onSelect, isMobile, isFiltered = false }: TutorCardProps) {
  const cardWidth = isMobile ? 120 : 140;
  const cardHeight = isMobile ? 170 : 190;
  const avatarSize = isMobile ? 64 : 80;
  
  return (
    <Card
      className={`
        relative flex flex-col items-center p-3 pt-2 cursor-pointer
        transition-all duration-200 ease-out shrink-0 hover-elevate
        ${isSelected 
          ? 'ring-2 shadow-lg scale-105' 
          : 'hover:scale-[1.03]'
        }
        ${isFiltered ? 'opacity-40 grayscale' : ''}
      `}
      style={{ 
        width: cardWidth, 
        height: cardHeight,
        borderColor: isSelected ? tutor.accentColor : undefined,
        boxShadow: isSelected ? `0 4px 20px ${tutor.accentColor}40` : undefined,
      }}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      tabIndex={0}
      role="button"
      aria-label={`Practice ${tutor.language} with ${tutor.name}`}
      aria-pressed={isSelected}
      data-testid={`card-tutor-${tutor.language}-${tutor.gender}`}
    >
      <span 
        className="text-[10px] font-medium uppercase tracking-wide mb-1"
        style={{ color: isFiltered ? undefined : tutor.accentColor }}
      >
        Click to Call
      </span>
      
      <div 
        className="rounded-full p-0.5 mb-2"
        style={{ 
          background: isSelected 
            ? `linear-gradient(135deg, ${tutor.accentColor}, ${tutor.accentColor}80)` 
            : 'transparent' 
        }}
      >
        <Avatar 
          className="border-2 border-background"
          style={{ width: avatarSize, height: avatarSize }}
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
      
      <span 
        className="text-xs text-muted-foreground text-center leading-tight mt-0.5"
        style={{ fontSize: '12px' }}
      >
        {tutor.tagline}
      </span>
      
      <div 
        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full opacity-80"
        style={{ backgroundColor: tutor.accentColor }}
        aria-hidden="true"
      />
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
  filterLanguage?: string;
  filterSlot?: React.ReactNode;
  className?: string;
}

export function TutorShowcase({ 
  onTutorSelect, 
  selectedLanguage,
  selectedGender,
  filterLanguage,
  filterSlot,
  className = '' 
}: TutorShowcaseProps) {
  const tutors = useMemo(() => getAllTutorsForShowcase(), []);
  
  const isFilteredOut = (tutor: TutorShowcaseData) => {
    if (!filterLanguage || filterLanguage === 'all') return false;
    return tutor.language !== filterLanguage;
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedTutor, setSelectedTutor] = useState<TutorShowcaseData | null>(null);
  
  useEffect(() => {
    if (selectedLanguage && selectedGender) {
      const tutor = tutors.find(
        t => t.language === selectedLanguage && t.gender === selectedGender
      );
      if (tutor) {
        setSelectedTutor(tutor);
      }
    }
  }, [selectedLanguage, selectedGender]);
  
  const handleSelect = (tutor: TutorShowcaseData) => {
    const isDeselecting = selectedTutor?.language === tutor.language && 
                          selectedTutor?.gender === tutor.gender;
    
    if (isDeselecting) {
      setSelectedTutor(null);
      onTutorSelect?.(null);
    } else {
      setSelectedTutor(tutor);
      onTutorSelect?.({
        language: tutor.language,
        gender: tutor.gender,
        name: tutor.name,
      });
    }
  };
  
  const isSelected = (tutor: TutorShowcaseData) => 
    selectedTutor?.language === tutor.language && 
    selectedTutor?.gender === tutor.gender;

  return (
    <div className={`w-full max-w-full overflow-hidden ${className}`} data-testid="tutor-showcase">
      <h2 className="text-lg md:text-xl font-semibold text-center mb-3 md:mb-4">
        Meet Your Tutors
      </h2>
      
      {/* Filter slot - dropdowns go between title and tutor cards */}
      {filterSlot && (
        <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
          {filterSlot}
        </div>
      )}
      
      {/* Mobile carousel - visible on small screens, hidden on md+ */}
      <div className="block md:hidden w-full overflow-visible">
        <div 
          ref={scrollRef}
          className="flex w-full gap-3 overflow-x-auto snap-x snap-mandatory pb-3 pl-4 pr-4"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
          data-testid="tutor-carousel-mobile"
        >
          {tutors.map((tutor) => (
            <div key={`${tutor.language}-${tutor.gender}`} className="snap-start shrink-0">
              <TutorCard
                tutor={tutor}
                isSelected={isSelected(tutor)}
                onSelect={() => handleSelect(tutor)}
                isMobile={true}
                isFiltered={isFilteredOut(tutor)}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Desktop grid - hidden on small screens, visible on md+ */}
      <div 
        className="hidden md:grid grid-cols-6 lg:grid-cols-9 gap-3 md:gap-4 justify-items-center overflow-hidden"
        data-testid="tutor-grid-desktop"
      >
        {tutors.map((tutor) => (
          <TutorCard
            key={`${tutor.language}-${tutor.gender}`}
            tutor={tutor}
            isSelected={isSelected(tutor)}
            onSelect={() => handleSelect(tutor)}
            isMobile={false}
            isFiltered={isFilteredOut(tutor)}
          />
        ))}
      </div>
    </div>
  );
}
