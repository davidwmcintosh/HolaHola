import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowRight, Sparkles, Lock, GraduationCap, Layers, Mic } from "lucide-react";
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

  const isEnrolled = enrolledClasses.length > 0;

  const selectedClass = (learningContext !== 'self-directed' && learningContext !== 'all' && learningContext !== 'founder-mode' && learningContext !== 'honesty-mode' && learningContext !== 'all-classes' && learningContext !== 'all-learning')
    ? enrolledClasses.find(e => e.classId === learningContext)
    : undefined;

  const pathId = selectedClass?.class?.curriculumPathId;
  const textbookHref = pathId
    ? `/interactive-textbook?pathId=${pathId}`
    : '/interactive-textbook';

  if (!isEnrolled) {
    return (
      <Card
        className={`p-4 md:p-6 bg-gradient-to-r from-accent/20 via-accent/10 to-background border-accent/30 ${className}`}
        data-testid="card-interactive-textbook-teaser"
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className="p-2 md:p-3 rounded-full bg-accent/20">
                <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-accent-foreground/60" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-border">
                <Lock className="h-2.5 w-2.5 text-muted-foreground" />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-base md:text-lg font-semibold flex items-center gap-2 flex-wrap">
                Interactive Textbook
                <Badge variant="secondary" className="text-xs font-normal gap-1 px-1.5 py-0">
                  <Lock className="h-2.5 w-2.5" />
                  Class benefit
                </Badge>
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Structured {languageDisplayName} learning that follows your teacher&apos;s syllabus — unlocked when you join a class.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Layers className="h-3 w-3 shrink-0" />
                  Chapters &amp; units
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mic className="h-3 w-3 shrink-0" />
                  Embedded drills
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GraduationCap className="h-3 w-3 shrink-0" />
                  Syllabus-aligned
                </span>
              </div>
            </div>
          </div>
          <Link href="/classes">
            <Button variant="outline" size="sm" className="gap-1 text-xs md:text-sm shrink-0" data-testid="button-enroll-class">
              Enroll in a class
              <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

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
                Learn {languageDisplayName} with engaging chapters, embedded drills &amp; visual content
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
