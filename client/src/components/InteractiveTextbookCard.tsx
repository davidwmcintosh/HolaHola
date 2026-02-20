import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";

interface InteractiveTextbookCardProps {
  className?: string;
}

export function InteractiveTextbookCard({ className = '' }: InteractiveTextbookCardProps) {
  const { language } = useLanguage();
  const { learningContext, enrolledClasses } = useLearningFilter();
  
  const languageDisplayName = language.charAt(0).toUpperCase() + language.slice(1);

  const selectedClass = (learningContext !== 'self-directed' && learningContext !== 'all' && learningContext !== 'founder-mode' && learningContext !== 'honesty-mode' && learningContext !== 'all-classes' && learningContext !== 'all-learning')
    ? enrolledClasses.find(e => e.classId === learningContext)
    : undefined;

  const pathId = selectedClass?.class?.curriculumPathId;
  const textbookHref = pathId
    ? `/interactive-textbook?pathId=${pathId}`
    : '/interactive-textbook';

  return (
    <Link href={textbookHref}>
      <Card 
        className={`p-4 md:p-6 bg-gradient-to-r from-accent/20 via-accent/10 to-background border-accent/30 hover-elevate cursor-pointer ${className}`}
        data-testid="card-interactive-textbook"
      >
        <div className="flex items-center justify-between flex-wrap gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-full bg-accent/30">
              <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-accent-foreground" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                Interactive Textbook
                <Sparkles className="h-4 w-4 text-accent-foreground" />
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                Learn {languageDisplayName} with engaging chapters, embedded drills & visual content
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1 text-xs md:text-sm" data-testid="button-open-textbook">
            Open Textbook
            <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </div>
      </Card>
    </Link>
  );
}
