import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, Send, Plus, BrainCircuit, Radio, Code, X, ChevronDown } from "lucide-react";
import type { TeamRoom as TeamRoomType, RoomVoiceMessage } from "@shared/schema";

const PARTICIPANTS = [
  { id: "david", name: "David", role: "Founder", icon: Code, color: "text-amber-500" },
  { id: "alden", name: "Alden", role: "Dev Steward", icon: BrainCircuit, color: "text-blue-500" },
];

function ParticipantCard({ participant, isActive }: { participant: typeof PARTICIPANTS[0]; isActive: boolean }) {
  const Icon = participant.icon;
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md transition-colors ${isActive ? "bg-muted" : ""}`}
      data-testid={`participant-${participant.id}`}
    >
      <div className="relative">
        <Icon className={`h-5 w-5 ${participant.color}`} />
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-background" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none">{participant.name}</p>
        <p className="text-xs text-muted-foreground">{participant.role}</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: RoomVoiceMessage }) {
  const isAlden = message.speaker === "Alden";
  const isDavid = message.speaker === "David";
  const time = new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex flex-col gap-1 ${isDavid ? "items-end" : "items-start"}`} data-testid={`message-${message.id}`}>
      <div className="flex items-center gap-1.5">
        {!isDavid && <span className={`text-xs font-medium ${isAlden ? "text-blue-500" : "text-muted-foreground"}`}>{message.speaker}</span>}
        <span className="text-xs text-muted-foreground">{time}</span>
        {isDavid && <span className="text-xs font-medium text-amber-500">David</span>}
      </div>
      <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
        isDavid
          ? "bg-primary text-primary-foreground"
          : isAlden
          ? "bg-blue-500/10 border border-blue-500/20 text-foreground"
          : "bg-muted text-foreground"
      }`}>
        {message.content}
      </div>
    </div>
  );
}

function ExpressLaneMessage({ content, speaker, time }: { content: string; speaker: string; time: string }) {
  return (
    <div className="space-y-1" data-testid="express-lane-message">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-blue-500">{speaker}</span>
        <span className="text-xs text-muted-foreground">{time}</span>
      </div>
      <div className="text-xs text-foreground bg-blue-500/5 border border-blue-500/10 rounded-md p-2 whitespace-pre-wrap font-mono">
        {content}
      </div>
    </div>
  );
}

interface SessionData {
  room: TeamRoomType;
  messages: RoomVoiceMessage[];
  handRaises: any[];
  artifacts: any[];
}

export default function TeamRoom() {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [expressLaneItems, setExpressLaneItems] = useState<Array<{ content: string; speaker: string; time: string }>>([]);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const expressEndRef = useRef<HTMLDivElement>(null);

  const { data: sessions } = useQuery<TeamRoomType[]>({
    queryKey: ["/api/team-room/sessions"],
  });

  const { data: sessionData, isLoading: sessionLoading } = useQuery<SessionData>({
    queryKey: ["/api/team-room/sessions", activeSessionId],
    enabled: !!activeSessionId,
    refetchInterval: 5000,
  });

  const createSession = useMutation({
    mutationFn: (topic: string) => apiRequest("POST", "/api/team-room/sessions", { topic }),
    onSuccess: async (res) => {
      const room = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions"] });
      setActiveSessionId(room.id);
      setNewTopic("");
    },
  });

  const postMessage = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/team-room/sessions/${activeSessionId}/messages`, { content, speaker: "David" }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions", activeSessionId] });
      if (data.aldenExpressLane) {
        const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        setExpressLaneItems(prev => [...prev, { content: data.aldenExpressLane, speaker: "Alden", time }]);
      }
      setMessageInput("");
    },
  });

  const closeSession = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/team-room/sessions/${activeSessionId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-room/sessions"] });
      setActiveSessionId(null);
      setExpressLaneItems([]);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionData?.messages]);

  useEffect(() => {
    expressEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [expressLaneItems]);

  const handleSend = () => {
    if (!messageInput.trim() || postMessage.isPending) return;
    postMessage.mutate(messageInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeSessions = sessions?.filter(s => s.status === "active") ?? [];
  const pastSessions = sessions?.filter(s => s.status === "closed") ?? [];

  return (
    <div className="flex h-full bg-background">
      {/* Left Panel: Participants */}
      <div className="w-52 flex-none border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Participants</span>
          </div>
        </div>
        <div className="p-2 flex-1">
          <div className="space-y-1">
            {PARTICIPANTS.map(p => (
              <ParticipantCard
                key={p.id}
                participant={p}
                isActive={!!activeSessionId}
              />
            ))}
          </div>
          {activeSessions.length > 0 && !activeSessionId && (
            <>
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground px-2 mb-2">Active sessions</p>
              <div className="space-y-1">
                {activeSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className="w-full text-left px-2 py-1.5 text-xs rounded-md hover-elevate"
                    data-testid={`session-${s.id}`}
                  >
                    {s.topic}
                  </button>
                ))}
              </div>
            </>
          )}
          {pastSessions.length > 0 && (
            <>
              <Separator className="my-3" />
              <button
                onClick={() => setShowPastSessions(!showPastSessions)}
                className="flex items-center gap-1 text-xs text-muted-foreground px-2 w-full"
                data-testid="button-toggle-past-sessions"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showPastSessions ? "" : "-rotate-90"}`} />
                Past sessions ({pastSessions.length})
              </button>
              {showPastSessions && (
                <div className="mt-1 space-y-1">
                  {pastSessions.slice(0, 10).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className="w-full text-left px-2 py-1.5 text-xs rounded-md text-muted-foreground hover-elevate"
                      data-testid={`past-session-${s.id}`}
                    >
                      {s.topic}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Center Panel: Discussion */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeSessionId ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Room
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Start a session to collaborate with Alden and the team.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="What's the topic? (e.g. Gene's Progress Review)"
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newTopic.trim() && createSession.mutate(newTopic.trim())}
                  data-testid="input-session-topic"
                />
                <Button
                  onClick={() => createSession.mutate(newTopic.trim())}
                  disabled={!newTopic.trim() || createSession.isPending}
                  className="w-full"
                  data-testid="button-start-session"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createSession.isPending ? "Starting..." : "Start Session"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-sm truncate">{sessionData?.room?.topic ?? "Loading..."}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {sessionData?.room?.status === "active" ? "Live" : "Closed"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {sessionData?.room?.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => closeSession.mutate()}
                    disabled={closeSession.isPending}
                    data-testid="button-close-session"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    {closeSession.isPending ? "Closing..." : "End Session"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setActiveSessionId(null); setExpressLaneItems([]); }}
                  data-testid="button-leave-room"
                >
                  Leave
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              {sessionLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading session...</div>
              ) : (
                <div className="space-y-4">
                  {sessionData?.messages?.length === 0 && (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      Say something to get started. Alden will respond when he has something to contribute.
                    </div>
                  )}
                  {sessionData?.messages?.map(msg => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  {postMessage.isPending && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex gap-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span>Alden is thinking...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {sessionData?.room?.status === "active" && (
              <div className="p-3 border-t flex gap-2">
                <Input
                  placeholder="Say something to the team..."
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={postMessage.isPending}
                  data-testid="input-message"
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || postMessage.isPending}
                  size="default"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right Panel: Express Lane */}
      <div className="w-80 flex-none border-l flex flex-col">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold">Express Lane</span>
            <Badge variant="outline" className="ml-auto text-xs">Fast Text</Badge>
          </div>
        </div>
        <ScrollArea className="flex-1 p-3">
          {expressLaneItems.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              Alden's detailed analysis and data will appear here during the session.
            </div>
          ) : (
            <div className="space-y-4">
              {expressLaneItems.map((item, i) => (
                <ExpressLaneMessage key={i} {...item} />
              ))}
              <div ref={expressEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
