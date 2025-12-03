import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, ArrowRight, BookOpen } from "lucide-react";

interface PrerequisiteInfo {
  id: string;
  name: string;
  lessonType: string;
  completionPercent?: number;
  masteredCount?: number;
  totalCount?: number;
}

interface LockedLessonProps {
  lessonName: string;
  prerequisite: PrerequisiteInfo;
  message: string;
  onGoToPrerequisite: (lessonId: string) => void;
}

export function LockedLesson({ 
  lessonName, 
  prerequisite, 
  message, 
  onGoToPrerequisite 
}: LockedLessonProps) {
  const completionPercent = prerequisite.completionPercent ?? 0;
  const hasProgress = completionPercent > 0;

  return (
    <Card className="p-8 text-center border-dashed border-2" data-testid="locked-lesson">
      <CardHeader className="pb-4">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <CardTitle className="text-xl" data-testid="text-locked-lesson-name">
          {lessonName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-muted-foreground" data-testid="text-locked-message">
          {message}
        </p>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4" />
            <span>Prerequisite: {prerequisite.name}</span>
          </div>
          
          {prerequisite.lessonType === 'drill' && (
            <div className="space-y-2">
              <Progress value={completionPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {hasProgress ? (
                  <>
                    {prerequisite.masteredCount} of {prerequisite.totalCount} items mastered ({completionPercent}%)
                  </>
                ) : (
                  'Not started yet'
                )}
              </p>
            </div>
          )}
        </div>

        <Button 
          onClick={() => onGoToPrerequisite(prerequisite.id)}
          className="w-full sm:w-auto"
          data-testid="button-go-to-prerequisite"
        >
          {hasProgress ? 'Continue' : 'Start'} {prerequisite.name}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
