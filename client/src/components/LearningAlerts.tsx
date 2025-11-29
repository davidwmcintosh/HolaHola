import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useUsage } from "@/contexts/UsageContext";
import { 
  AlertTriangle, 
  Clock, 
  Flame, 
  MessageSquare, 
  CreditCard, 
  Calendar,
  BookOpen,
  X
} from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface UserProgress {
  id: string;
  userId: string;
  language: string;
  wordsLearned: number;
  practiceMinutes: number;
  currentStreak: number;
  longestStreak: number;
  totalPracticeDays: number;
  lastPracticeDate: string | null;
}

interface StudentClass {
  id: string;
  name: string;
  teacherName: string;
  enrolledAt: string;
}

interface LearningAlertsProps {
  language: string;
}

export function LearningAlerts({ language }: LearningAlertsProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const { balance, warningLevel } = useUsage();
  
  const { data: progress } = useQuery<UserProgress>({
    queryKey: ['/api/progress', language],
  });
  
  const { data: classes } = useQuery<StudentClass[]>({
    queryKey: ['/api/student/classes'],
  });
  
  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => [...prev, alertId]);
  };
  
  const alerts: Array<{
    id: string;
    type: 'warning' | 'critical' | 'info';
    icon: typeof AlertTriangle;
    title: string;
    description: string;
    action?: {
      label: string;
      href: string;
    };
    dismissible: boolean;
  }> = [];
  
  if (warningLevel === 'exhausted' && !dismissedAlerts.includes('credits-exhausted')) {
    alerts.push({
      id: 'credits-exhausted',
      type: 'critical',
      icon: CreditCard,
      title: 'Tutoring Hours Exhausted',
      description: 'You have no tutoring hours remaining. Purchase more to continue practicing with your AI tutor.',
      action: {
        label: 'Get More Hours',
        href: '/pricing'
      },
      dismissible: false
    });
  } else if (warningLevel === 'critical' && !dismissedAlerts.includes('credits-critical')) {
    alerts.push({
      id: 'credits-critical',
      type: 'warning',
      icon: Clock,
      title: 'Less Than 5 Minutes Remaining',
      description: 'Your tutoring hours are almost exhausted. Consider purchasing more to avoid interruptions.',
      action: {
        label: 'Get More Hours',
        href: '/pricing'
      },
      dismissible: true
    });
  } else if (warningLevel === 'low' && !dismissedAlerts.includes('credits-low')) {
    alerts.push({
      id: 'credits-low',
      type: 'info',
      icon: Clock,
      title: 'Tutoring Hours Running Low',
      description: `You have ${balance ? Math.floor(balance.remainingSeconds / 3600) : 0} hours remaining. Plan your practice sessions accordingly.`,
      action: {
        label: 'View Options',
        href: '/pricing'
      },
      dismissible: true
    });
  }
  
  if (progress) {
    const lastPractice = progress.lastPracticeDate ? new Date(progress.lastPracticeDate) : null;
    const daysSinceLastPractice = lastPractice 
      ? Math.floor((Date.now() - lastPractice.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    if (progress.currentStreak === 0 && progress.longestStreak > 3 && !dismissedAlerts.includes('streak-lost')) {
      alerts.push({
        id: 'streak-lost',
        type: 'warning',
        icon: Flame,
        title: 'Your Streak Was Lost',
        description: `You had a ${progress.longestStreak}-day streak! Start practicing again to build a new one.`,
        action: {
          label: 'Practice Now',
          href: '/chat'
        },
        dismissible: true
      });
    }
    
    if (daysSinceLastPractice !== null && daysSinceLastPractice >= 3 && daysSinceLastPractice < 7 && !dismissedAlerts.includes('inactive-warning')) {
      alerts.push({
        id: 'inactive-warning',
        type: 'info',
        icon: Calendar,
        title: 'Time to Practice!',
        description: `You haven't practiced in ${daysSinceLastPractice} days. Regular practice helps with retention.`,
        action: {
          label: 'Start Practicing',
          href: '/chat'
        },
        dismissible: true
      });
    } else if (daysSinceLastPractice !== null && daysSinceLastPractice >= 7 && !dismissedAlerts.includes('inactive-critical')) {
      alerts.push({
        id: 'inactive-critical',
        type: 'warning',
        icon: Calendar,
        title: 'Come Back and Practice!',
        description: `It's been ${daysSinceLastPractice} days since your last practice. Your skills may be getting rusty!`,
        action: {
          label: 'Resume Learning',
          href: '/chat'
        },
        dismissible: true
      });
    }
    
    if (progress.totalPracticeDays === 0 && progress.wordsLearned === 0 && !dismissedAlerts.includes('new-user')) {
      alerts.push({
        id: 'new-user',
        type: 'info',
        icon: MessageSquare,
        title: 'Welcome! Ready to Start?',
        description: 'Begin your language learning journey with a conversation. Your AI tutor is waiting!',
        action: {
          label: 'Start Conversation',
          href: '/chat'
        },
        dismissible: true
      });
    }
  }
  
  if (classes && classes.length > 0 && !dismissedAlerts.includes('enrolled-class')) {
    const recentClass = classes[0];
    const enrolledRecently = new Date(recentClass.enrolledAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    if (enrolledRecently) {
      alerts.push({
        id: 'enrolled-class',
        type: 'info',
        icon: BookOpen,
        title: `You're enrolled in ${recentClass.name}`,
        description: `Check your class curriculum and assignments from ${recentClass.teacherName}.`,
        action: {
          label: 'View Class',
          href: `/student/classes/${recentClass.id}`
        },
        dismissible: true
      });
    }
  }
  
  if (alerts.length === 0) return null;
  
  const getAlertStyles = (type: 'warning' | 'critical' | 'info') => {
    switch (type) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'info':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };
  
  const getIconStyles = (type: 'warning' | 'critical' | 'info') => {
    switch (type) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
    }
  };
  
  return (
    <div className="space-y-3" data-testid="learning-alerts">
      {alerts.slice(0, 3).map((alert) => {
        const Icon = alert.icon;
        return (
          <Alert 
            key={alert.id} 
            className={`relative ${getAlertStyles(alert.type)}`}
            data-testid={`alert-${alert.id}`}
          >
            <Icon className={`h-4 w-4 ${getIconStyles(alert.type)}`} />
            <AlertTitle className="flex items-center justify-between pr-6">
              {alert.title}
            </AlertTitle>
            <AlertDescription className="mt-1">
              <p className="text-sm mb-2">{alert.description}</p>
              {alert.action && (
                <Link href={alert.action.href}>
                  <Button size="sm" variant="outline" className="mt-1">
                    {alert.action.label}
                  </Button>
                </Link>
              )}
            </AlertDescription>
            {alert.dismissible && (
              <button
                onClick={() => dismissAlert(alert.id)}
                className="absolute top-3 right-3 p-1 rounded-md hover-elevate text-muted-foreground"
                data-testid={`dismiss-${alert.id}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </Alert>
        );
      })}
    </div>
  );
}
