import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [showBackOnlineAlert, setShowBackOnlineAlert] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineAlert(false); // Reset offline alert when back online
      setShowBackOnlineAlert(true);
      setTimeout(() => setShowBackOnlineAlert(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showOfflineAlert && !showBackOnlineAlert) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 max-w-md">
      {!isOnline && showOfflineAlert && (
        <Alert variant="destructive" data-testid="alert-offline">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="ml-2">
            You're offline. Some features may be limited, but you can still view cached content.
          </AlertDescription>
        </Alert>
      )}
      
      {isOnline && showBackOnlineAlert && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20" data-testid="alert-online">
          <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="ml-2 text-green-800 dark:text-green-200">
            You're back online! All features are now available.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
