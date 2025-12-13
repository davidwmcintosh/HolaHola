import { User, Bot, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Participant {
  id: string;
  name: string;
  role: 'student' | 'tutor' | 'architect';
  status: 'active' | 'speaking' | 'thinking' | 'listening' | 'idle';
  isOnline: boolean;
}

interface CollaborationIndicatorProps {
  isFounderMode: boolean;
  tutorName?: string;
  tutorStatus: 'speaking' | 'thinking' | 'listening' | 'idle';
  isSessionActive: boolean;
}

export function CollaborationIndicator({
  isFounderMode,
  tutorName = "Daniela",
  tutorStatus,
  isSessionActive,
}: CollaborationIndicatorProps) {
  if (!isFounderMode || !isSessionActive) return null;

  const participants: Participant[] = [
    {
      id: 'student',
      name: 'You',
      role: 'student',
      status: tutorStatus === 'listening' ? 'speaking' : 'active',
      isOnline: true,
    },
    {
      id: 'tutor',
      name: tutorName,
      role: 'tutor',
      status: tutorStatus,
      isOnline: true,
    },
    {
      id: 'architect',
      name: 'Claude',
      role: 'architect',
      status: 'active',
      isOnline: true,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'speaking': return 'bg-green-500';
      case 'thinking': return 'bg-blue-500 animate-pulse';
      case 'listening': return 'bg-yellow-500';
      case 'active': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const getIcon = (role: string) => {
    switch (role) {
      case 'student': return <User className="h-3 w-3" />;
      case 'tutor': return <Bot className="h-3 w-3" />;
      case 'architect': return <Sparkles className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'speaking': return 'Speaking';
      case 'thinking': return 'Thinking...';
      case 'listening': return 'Listening';
      case 'active': return 'Active';
      default: return 'Idle';
    }
  };

  return (
    <div 
      className="absolute top-4 left-4 z-20 flex items-center gap-1 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-full shadow-lg border"
      data-testid="collaboration-indicator"
    >
      {participants.map((participant, index) => (
        <Tooltip key={participant.id}>
          <TooltipTrigger asChild>
            <div 
              className="relative flex items-center justify-center h-6 w-6 rounded-full bg-muted hover-elevate cursor-default"
              data-testid={`participant-${participant.role}`}
            >
              {getIcon(participant.role)}
              <span 
                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${getStatusColor(participant.status)}`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-medium">{participant.name}</p>
            <p className="text-muted-foreground">{getStatusLabel(participant.status)}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">3-Way</span>
    </div>
  );
}
