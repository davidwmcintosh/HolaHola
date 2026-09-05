import { User, Bot, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import type { ObservationBenchPillStatus } from "@shared/observation-bench-types";

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
  voiceSessionId?: string | null;
  /** Optional injection seam for focused rendering tests. */
  observationBenchStatus?: ObservationBenchPillStatus;
}

export type ObservationBenchColor = 'green' | 'yellow' | 'red' | 'gray';

export function deriveObservationBenchColor(
  status: ObservationBenchPillStatus | null | undefined,
): ObservationBenchColor {
  if (!status || status.windowState !== 'active') return 'gray';
  const hats = status.expectedActors.map(actor => status.hats[actor]);
  if (hats.every(hat => hat.connection === 'connected' && hat.caughtUp && !hat.replayPending)) return 'green';
  if (hats.every(hat => !['connected', 'degraded'].includes(hat.connection))) return 'red';
  return 'yellow';
}

const benchColorClass: Record<ObservationBenchColor, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
};

export function CollaborationIndicator({
  isFounderMode,
  tutorName = "Daniela",
  tutorStatus,
  isSessionActive,
  voiceSessionId,
  observationBenchStatus,
}: CollaborationIndicatorProps) {
  const { data: fetchedStatus, refetch } = useQuery<ObservationBenchPillStatus | null>({
    queryKey: ['/api/admin/luca/observation-bench-sessions', voiceSessionId, 'status'],
    enabled: isFounderMode && isSessionActive && !!voiceSessionId && !observationBenchStatus,
    staleTime: 30_000,
    refetchInterval: false,
    queryFn: async () => {
      const response = await fetch(`/api/admin/luca/observation-bench-sessions/${voiceSessionId}/status`, {
        credentials: 'include',
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Observation Bench status failed (${response.status})`);
      return response.json();
    },
  });
  const benchStatus = observationBenchStatus ?? fetchedStatus;
  const replitLuca = benchStatus?.hats['luca-replit'];
  const claudeCodeLuca = benchStatus?.hats['luca-claude-code'];
  const benchColor = deriveObservationBenchColor(benchStatus);
  const lucaOnline = benchColor === 'green';
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
      name: 'Daniela',
      role: 'tutor',
      status: tutorStatus,
      isOnline: true,
    },
    {
      id: 'architect',
      name: 'Luca',
      role: 'architect',
      status: lucaOnline ? 'active' : 'idle',
      isOnline: lucaOnline,
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
        <Tooltip
          key={participant.id}
          onOpenChange={(open) => {
            if (open && participant.role === 'architect' && voiceSessionId && !observationBenchStatus) {
              void refetch();
            }
          }}
        >
          <TooltipTrigger asChild>
            <div 
              className="relative flex items-center justify-center h-6 w-6 rounded-full bg-muted hover-elevate cursor-default"
              data-testid={`participant-${participant.role}`}
            >
              {getIcon(participant.role)}
              <span 
                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${
                  participant.role === 'architect' ? benchColorClass[benchColor] : getStatusColor(participant.status)
                }`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-medium">{participant.name}</p>
            <p className="text-muted-foreground">
              {participant.role === 'architect'
                ? <>
                    Luca [Replit]: {replitLuca ? `${replitLuca.connection}; ${replitLuca.caughtUp ? 'caught up' : 'behind'}${replitLuca.replayPending ? '; replay pending' : ''}; last event ${replitLuca.lastEventAt ? new Date(replitLuca.lastEventAt).toLocaleString() : 'none'}` : 'inactive'}
                    <br />
                    Luca [Claude Code]: {claudeCodeLuca ? `${claudeCodeLuca.connection}; ${claudeCodeLuca.caughtUp ? 'caught up' : 'behind'}${claudeCodeLuca.replayPending ? '; replay pending' : ''}; last event ${claudeCodeLuca.lastEventAt ? new Date(claudeCodeLuca.lastEventAt).toLocaleString() : 'none'}` : 'inactive'}
                    <br />
                    Window: {benchStatus?.windowState ?? 'not armed'}
                    <br />
                    Last evidence: {benchStatus?.lastEvidenceAt ? new Date(benchStatus.lastEvidenceAt).toLocaleString() : 'none'}
                  </>
                : getStatusLabel(participant.status)}
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
      <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">3-Way</span>
    </div>
  );
}
