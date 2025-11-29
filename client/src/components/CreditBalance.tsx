import { Clock, AlertTriangle, XCircle } from "lucide-react";
import { useCredits } from "@/contexts/UsageContext";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CreditBalanceProps {
  variant?: 'default' | 'compact' | 'minimal';
  showWarning?: boolean;
  className?: string;
}

export function CreditBalance({ 
  variant = 'default', 
  showWarning = true,
  className 
}: CreditBalanceProps) {
  const { 
    formatRemainingTime, 
    warningLevel, 
    isLow, 
    isCritical, 
    isExhausted,
    remainingHours
  } = useCredits();
  
  const getStatusColor = () => {
    if (isExhausted) return 'bg-destructive text-destructive-foreground';
    if (isCritical) return 'bg-orange-500 text-white';
    if (isLow) return 'bg-yellow-500 text-white';
    return 'bg-secondary text-secondary-foreground';
  };
  
  const getStatusIcon = () => {
    if (isExhausted) return <XCircle className="h-3.5 w-3.5" />;
    if (isCritical || isLow) return <AlertTriangle className="h-3.5 w-3.5" />;
    return <Clock className="h-3.5 w-3.5" />;
  };
  
  const getTooltipContent = () => {
    if (isExhausted) {
      return "You've used all your tutoring hours. Purchase more to continue learning.";
    }
    if (isCritical) {
      return "You're almost out of tutoring hours. Consider purchasing more soon.";
    }
    if (isLow) {
      return "Your tutoring hours are running low. Consider purchasing more.";
    }
    return `You have ${formatRemainingTime()} of tutoring time remaining.`;
  };
  
  if (variant === 'minimal') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("flex items-center gap-1 text-sm", className)}>
            {getStatusIcon()}
            <span>{formatRemainingTime()}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  if (variant === 'compact') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className={cn(getStatusColor(), "flex items-center gap-1", className)}
          >
            {getStatusIcon()}
            <span>{formatRemainingTime()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className={cn(getStatusColor(), "flex items-center gap-1.5 px-3 py-1.5")}
          >
            {getStatusIcon()}
            <span className="font-medium">{formatRemainingTime()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
      
      {showWarning && (isLow || isCritical || isExhausted) && (
        <p className="text-xs text-muted-foreground">
          {isExhausted ? (
            <span className="text-destructive">Purchase hours to continue</span>
          ) : isCritical ? (
            <span className="text-orange-600 dark:text-orange-400">Running very low</span>
          ) : (
            <span className="text-yellow-600 dark:text-yellow-400">Running low</span>
          )}
        </p>
      )}
    </div>
  );
}

export function CreditWarningBanner() {
  const { isLow, isCritical, isExhausted, formatRemainingTime } = useCredits();
  
  if (!isLow && !isCritical && !isExhausted) {
    return null;
  }
  
  return (
    <div className={cn(
      "px-4 py-2 text-sm flex items-center justify-center gap-2",
      isExhausted ? "bg-destructive text-destructive-foreground" :
      isCritical ? "bg-orange-500 text-white" :
      "bg-yellow-500 text-white"
    )}>
      <AlertTriangle className="h-4 w-4" />
      {isExhausted ? (
        <span>Your tutoring hours have been used up. Purchase more to continue.</span>
      ) : (
        <span>Only {formatRemainingTime()} remaining. Consider purchasing more hours.</span>
      )}
    </div>
  );
}
