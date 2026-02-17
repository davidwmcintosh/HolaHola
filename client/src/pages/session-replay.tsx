import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  History, 
  Play, 
  Clock, 
  MessageSquare, 
  ChevronLeft,
  Calendar,
  Trophy,
  Loader2,
  User,
  Bot
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";

interface VoiceSession {
  id: string;
  conversationId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  exchangeCount: number;
  language: string | null;
  status: string;
  conversationTitle: string | null;
  conversationTopic: string | null;
  actflLevel: string | null;
  messageCount: number;
}

interface SessionMessage {
  id: string;
  role: string;
  content: string;
  targetLanguageText: string | null;
  wordTimingsJson: string | null;
  performanceScore: number | null;
  actflLevel: string | null;
  createdAt: string;
}

interface SessionDetails {
  session: VoiceSession;
  messages: SessionMessage[];
}

const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'All Languages' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'mandarin', label: 'Mandarin' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'italian', label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'english', label: 'English' },
  { value: 'hebrew', label: 'Hebrew' },
];

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getActflBadgeColor(level: string | null): string {
  if (!level) return 'bg-muted text-muted-foreground';
  if (level.includes('novice')) return 'bg-green-500/20 text-green-700 dark:text-green-300';
  if (level.includes('intermediate')) return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
  if (level.includes('advanced')) return 'bg-purple-500/20 text-purple-700 dark:text-purple-300';
  return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
}

export default function SessionReplay() {
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: sessionsData, isLoading: loadingSessions } = useQuery<{ sessions: VoiceSession[] }>({
    queryKey: ['/api/session-replay/sessions', selectedLanguage],
    queryFn: () => {
      const url = selectedLanguage === 'all' 
        ? '/api/session-replay/sessions' 
        : `/api/session-replay/sessions?language=${selectedLanguage}`;
      return fetch(url).then(r => r.json());
    },
  });

  const { data: sessionDetails, isLoading: loadingDetails } = useQuery<SessionDetails>({
    queryKey: ['/api/session-replay/sessions', selectedSessionId],
    queryFn: () => fetch(`/api/session-replay/sessions/${selectedSessionId}`).then(r => r.json()),
    enabled: !!selectedSessionId,
  });

  const sessions = sessionsData?.sessions || [];

  if (selectedSessionId && sessionDetails) {
    return (
      <div className="container max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedSessionId(null)}
            data-testid="button-back-to-sessions"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Sessions
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Session Replay
            </CardTitle>
            <CardDescription>
              {sessionDetails.session.conversationTitle || 'Voice Session'} • 
              {sessionDetails.session.language && ` ${sessionDetails.session.language.charAt(0).toUpperCase() + sessionDetails.session.language.slice(1)}`} • 
              {format(new Date(sessionDetails.session.startedAt), 'PPp')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatDuration(sessionDetails.session.durationSeconds || 0)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                {sessionDetails.messages.length} messages
              </div>
              {sessionDetails.session.actflLevel && (
                <Badge className={getActflBadgeColor(sessionDetails.session.actflLevel)}>
                  {sessionDetails.session.actflLevel.replace('_', ' ').toUpperCase()}
                </Badge>
              )}
            </div>
            <Separator className="mb-4" />

            {loadingDetails ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sessionDetails.messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No messages available for this session</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4 pr-4">
                  {sessionDetails.messages.map((msg, index) => (
                    <div 
                      key={msg.id} 
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      data-testid={`message-${msg.role}-${index}`}
                    >
                      {msg.role !== 'user' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                        <div className={`p-3 rounded-lg ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.targetLanguageText && msg.targetLanguageText !== msg.content && (
                            <p className="text-xs mt-2 opacity-80 italic border-t border-current/20 pt-2">
                              {msg.targetLanguageText}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{format(new Date(msg.createdAt), 'HH:mm')}</span>
                          {msg.performanceScore !== null && msg.role === 'user' && (
                            <Badge variant="outline" className="text-xs">
                              Score: {msg.performanceScore}%
                            </Badge>
                          )}
                          {msg.actflLevel && (
                            <Badge variant="outline" className="text-xs">
                              {msg.actflLevel.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Session Replay</h1>
        <p className="text-muted-foreground">
          Review your past voice conversations with Daniela
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Past Sessions
          </CardTitle>
          <CardDescription>
            Select a session to review the conversation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Filter by Language:</label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-48" data-testid="select-language-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingSessions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No voice sessions found</p>
              <Link href="/voice-chat">
                <Button variant="outline" className="mt-4">
                  <Play className="h-4 w-4 mr-2" />
                  Start a Voice Session
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div 
                  key={session.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted hover-elevate cursor-pointer"
                  onClick={() => setSelectedSessionId(session.id)}
                  data-testid={`session-card-${session.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Play className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {session.conversationTitle || session.conversationTopic || 'Voice Session'}
                        </p>
                        {session.language && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {session.language}
                          </Badge>
                        )}
                        {session.actflLevel && (
                          <Badge className={`text-xs ${getActflBadgeColor(session.actflLevel)}`}>
                            {session.actflLevel.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(session.durationSeconds || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {session.messageCount || session.exchangeCount || 0} messages
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Play className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center">
        <Link href="/review">
          <Button variant="outline">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Review Hub
          </Button>
        </Link>
      </div>
    </div>
  );
}
