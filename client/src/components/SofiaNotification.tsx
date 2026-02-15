import { useState, useEffect, useCallback } from "react";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SofiaUserNotification } from "@/lib/lockoutDiagnostics";

interface SofiaNotificationProps {
  notification: SofiaUserNotification | null;
  onDismiss: () => void;
}

export function SofiaNotification({ notification, onDismiss }: SofiaNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (notification) {
      setExiting(false);
      const showTimer = setTimeout(() => setVisible(true), 100);
      const autoTimer = setTimeout(() => handleDismiss(), 15000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(autoTimer);
      };
    } else {
      setVisible(false);
      setExiting(false);
    }
  }, [notification]);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      onDismiss();
    }, 300);
  }, [onDismiss]);

  if (!notification || (!visible && !exiting)) return null;

  return (
    <div
      data-testid="sofia-notification"
      className={`
        absolute bottom-20 left-2 right-2 z-40
        bg-card border rounded-md shadow-lg
        transition-all duration-300 ease-out
        ${visible && !exiting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="flex-shrink-0 mt-0.5">
              <Lightbulb className="h-4 w-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground" data-testid="text-sofia-label">Sofia</span>
                <span className="text-sm font-medium" data-testid="text-sofia-title">{notification.title}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-sofia-message">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5" data-testid="text-sofia-suggestion">
                {notification.suggestion}
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDismiss}
            data-testid="button-dismiss-sofia"
            className="flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
