import { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, Info, AlertCircle, Wrench } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SystemAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical' | 'maintenance';
  title: string;
  message: string;
  affectedFeatures?: string[];
  isDismissible: boolean;
  showAsBanner: boolean;
  expiresAt?: string | null;
}

const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    variant: 'default' as const,
    className: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
    iconClassName: 'text-blue-600 dark:text-blue-400',
    textClassName: 'text-blue-800 dark:text-blue-200',
  },
  warning: {
    icon: AlertTriangle,
    variant: 'default' as const,
    className: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    iconClassName: 'text-yellow-600 dark:text-yellow-400',
    textClassName: 'text-yellow-800 dark:text-yellow-200',
  },
  critical: {
    icon: AlertCircle,
    variant: 'destructive' as const,
    className: '',
    iconClassName: '',
    textClassName: '',
  },
  maintenance: {
    icon: Wrench,
    variant: 'default' as const,
    className: 'border-purple-500 bg-purple-50 dark:bg-purple-950/20',
    iconClassName: 'text-purple-600 dark:text-purple-400',
    textClassName: 'text-purple-800 dark:text-purple-200',
  },
};

export function SystemAlertBanner() {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('dismissed-system-alerts');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const { data: alerts = [] } = useQuery<SystemAlert[]>({
    queryKey: ['/api/system-alerts'],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const visibleAlerts = alerts.filter(
    (alert) => alert.showAsBanner && !dismissedAlerts.has(alert.id)
  );

  const handleDismiss = useCallback(async (alertId: string) => {
    try {
      await apiRequest('POST', `/api/system-alerts/${alertId}/dismiss`);
    } catch (e) {
    }
    
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      localStorage.setItem('dismissed-system-alerts', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('dismissed-system-alerts');
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const activeAlertIds = new Set(alerts.map((a) => a.id));
      const filtered = parsed.filter((id) => activeAlertIds.has(id));
      if (filtered.length !== parsed.length) {
        localStorage.setItem('dismissed-system-alerts', JSON.stringify(filtered));
        setDismissedAlerts(new Set(filtered));
      }
    }
  }, [alerts]);

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md animate-in slide-in-from-top-5" data-testid="system-alert-container">
      {visibleAlerts.map((alert) => {
        const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
        const IconComponent = config.icon;

        return (
          <Alert
            key={alert.id}
            variant={config.variant}
            className={config.className}
            data-testid={`alert-system-${alert.id}`}
          >
            <IconComponent className={`h-4 w-4 ${config.iconClassName}`} />
            <div className="flex-1">
              <AlertTitle className={config.textClassName}>{alert.title}</AlertTitle>
              <AlertDescription className={`${config.textClassName} opacity-90`}>
                {alert.message}
                {alert.affectedFeatures && alert.affectedFeatures.length > 0 && (
                  <span className="block text-xs mt-1 opacity-75">
                    Affected: {alert.affectedFeatures.join(', ')}
                  </span>
                )}
              </AlertDescription>
            </div>
            {alert.isDismissible && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 absolute top-2 right-2"
                onClick={() => handleDismiss(alert.id)}
                data-testid={`button-dismiss-alert-${alert.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Alert>
        );
      })}
    </div>
  );
}
