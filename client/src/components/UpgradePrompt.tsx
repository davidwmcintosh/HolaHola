import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Crown, Zap, MessageCircle, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

interface UsageStats {
  monthlyMessageCount: number;
  monthlyMessageLimit: number;
  remaining: number;
}

export function UsageIndicator() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const { data: usage } = useQuery<UsageStats>({
    queryKey: ['/api/user/usage'],
    enabled: !!user && user.subscriptionTier === 'free',
    refetchInterval: 60000,
  });

  if (!user || user.subscriptionTier !== 'free' || !usage) {
    return null;
  }

  const limit = usage.monthlyMessageLimit || 20;
  const percentUsed = limit > 0 ? (usage.monthlyMessageCount / limit) * 100 : 0;
  const isLow = percentUsed >= 80;
  const isExhausted = usage.remaining <= 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer hover-elevate ${
        isExhausted
          ? 'bg-destructive/10 text-destructive'
          : isLow
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-muted text-muted-foreground'
      }`}
      onClick={() => navigate('/pricing')}
      data-testid="usage-indicator"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      <span>
        {isExhausted ? (
          'No messages left'
        ) : (
          `${usage.remaining}/${usage.monthlyMessageLimit} left`
        )}
      </span>
      {isLow && !isExhausted && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Low
        </Badge>
      )}
    </div>
  );
}

interface UpgradePromptProps {
  variant?: 'inline' | 'modal' | 'banner';
  onDismiss?: () => void;
  trigger?: 'limit_reached' | 'low_usage' | 'feature_locked';
}

export function UpgradePrompt({ variant = 'inline', onDismiss, trigger = 'low_usage' }: UpgradePromptProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: usage } = useQuery<UsageStats>({
    queryKey: ['/api/user/usage'],
    enabled: !!user,
  });

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  const messages = {
    limit_reached: {
      title: "You've reached your monthly limit",
      description: "Upgrade to continue your language learning journey with unlimited conversations.",
    },
    low_usage: {
      title: "Running low on messages",
      description: `You have ${usage?.remaining || 0} messages left this month. Upgrade for unlimited access.`,
    },
    feature_locked: {
      title: "Unlock this feature",
      description: "Upgrade to access premium features like pronunciation feedback and personalized learning paths.",
    },
  };

  const content = messages[trigger];

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{content.title}</p>
              <p className="text-xs text-muted-foreground">{content.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleUpgrade} data-testid="button-upgrade-banner">
              <Crown className="h-4 w-4 mr-1" />
              Upgrade
            </Button>
            {onDismiss && (
              <Button size="icon" variant="ghost" onClick={onDismiss} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-upgrade-trigger">
            <Crown className="h-4 w-4 mr-1" />
            Upgrade
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              {content.title}
            </DialogTitle>
            <DialogDescription>{content.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {usage && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Messages used this month</span>
                  <span className="font-medium">
                    {usage.monthlyMessageCount} / {usage.monthlyMessageLimit}
                  </span>
                </div>
                <Progress
                  value={usage.monthlyMessageLimit > 0 ? (usage.monthlyMessageCount / usage.monthlyMessageLimit) * 100 : 0}
                  className="h-2"
                />
              </div>
            )}
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span>Unlimited voice conversations</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span>Pronunciation feedback</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span>Priority AI response</span>
              </div>
            </div>
            <Button className="w-full" onClick={handleUpgrade} data-testid="button-upgrade-modal">
              View Plans
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-upgrade-inline">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{content.title}</CardTitle>
        </div>
        <CardDescription>{content.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {usage && (
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Messages used</span>
              <span className="font-medium">
                {usage.monthlyMessageCount} / {usage.monthlyMessageLimit}
              </span>
            </div>
            <Progress
              value={usage.monthlyMessageLimit > 0 ? (usage.monthlyMessageCount / usage.monthlyMessageLimit) * 100 : 0}
              className="h-2"
            />
          </div>
        )}
        <Button onClick={handleUpgrade} className="w-full" data-testid="button-upgrade-inline">
          <Crown className="h-4 w-4 mr-2" />
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );
}

export function UpgradeBanner() {
  const { user } = useAuth();
  
  const { data: usage } = useQuery<UsageStats>({
    queryKey: ['/api/user/usage'],
    enabled: !!user && user.subscriptionTier === 'free',
  });

  if (!user || user.subscriptionTier !== 'free' || !usage) {
    return null;
  }

  const limit = usage.monthlyMessageLimit || 20;
  const percentUsed = limit > 0 ? (usage.monthlyMessageCount / limit) * 100 : 0;
  
  if (percentUsed < 80) {
    return null;
  }

  const trigger = usage.remaining <= 0 ? 'limit_reached' : 'low_usage';

  return <UpgradePrompt variant="banner" trigger={trigger} />;
}
