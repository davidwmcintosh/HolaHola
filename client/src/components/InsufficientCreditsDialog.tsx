import { Link } from "wouter";
import { Clock, ShoppingCart, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCredits } from "@/contexts/UsageContext";

interface InsufficientCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchase?: () => void;
}

export function InsufficientCreditsDialog({
  open,
  onOpenChange,
  onPurchase,
}: InsufficientCreditsDialogProps) {
  const { isExhausted, formatRemainingTime } = useCredits();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-insufficient-credits">
        <DialogHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
            <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <DialogTitle className="text-center" data-testid="text-insufficient-title">
            {isExhausted ? "Out of Tutoring Hours" : "Low on Tutoring Hours"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isExhausted ? (
              "You've used all your tutoring hours for now. Purchase more to continue practicing with your AI tutor."
            ) : (
              `You only have ${formatRemainingTime()} remaining, which isn't enough to start a new session. Consider purchasing more hours.`
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 py-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-start gap-3">
              <GraduationCap className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Class Student?</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  If you're enrolled in a class, your teacher may have additional hours for you. Contact your teacher for more practice time.
                </p>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-start gap-3">
              <ShoppingCart className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Independent Learner?</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Purchase a tutoring package to get more practice hours. Our AI tutors are available 24/7 and cost 70-80% less than human tutors.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            data-testid="button-dismiss-credits"
          >
            Maybe Later
          </Button>
          <Button
            asChild
            className="w-full sm:w-auto"
            data-testid="button-purchase-hours"
            onClick={() => {
              onPurchase?.();
              onOpenChange(false);
            }}
          >
            <Link href="/settings?tab=billing">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Get More Hours
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
