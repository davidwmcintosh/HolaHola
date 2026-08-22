import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, PhoneMissed, Clock, ChevronDown, ChevronUp, FileText, Mic } from "lucide-react";

type OutboundCall = {
  id: string;
  userId: string;
  content: string;
  callSid: string | null;
  callAt: string | null;
  callAnsweredAt: string | null;
  callDurationSeconds: number | null;
  callNoAnswer: boolean | null;
  callTranscript: string | null;
  createdAt: string;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CallRow({ call }: { call: OutboundCall }) {
  const [expanded, setExpanded] = useState(false);
  const answered = !!call.callAnsweredAt;
  const noAnswer = call.callNoAnswer;

  return (
    <div className="rounded-md border" data-testid={`call-row-${call.id}`}>
      <div className="flex items-center gap-3 p-3 flex-wrap">
        <div className="shrink-0">
          {answered ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-green-500/10">
              <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
              <PhoneMissed className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">
              User {call.userId.slice(-8)}
            </span>
            {answered ? (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-answered-${call.id}`}>Answered</Badge>
            ) : noAnswer ? (
              <Badge variant="outline" className="text-xs" data-testid={`badge-no-answer-${call.id}`}>No answer</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Pending</Badge>
            )}
            {call.callTranscript && (
              <Badge variant="secondary" className="text-xs gap-1" data-testid={`badge-transcript-${call.id}`}>
                <FileText className="w-3 h-3" />
                Transcript
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Called {formatDateTime(call.callAt)}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {call.callDurationSeconds != null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-duration-${call.id}`}>
              <Clock className="w-3 h-3" />
              {formatDuration(call.callDurationSeconds)}
            </div>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-call-${call.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-medium text-muted-foreground mb-0.5">Call SID</p>
              <p className="font-mono text-muted-foreground break-all" data-testid={`text-callsid-${call.id}`}>
                {call.callSid || "—"}
              </p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-0.5">Answered at</p>
              <p data-testid={`text-answered-at-${call.id}`}>{formatDateTime(call.callAnsweredAt)}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-0.5">Duration</p>
              <p data-testid={`text-duration-detail-${call.id}`}>
                {call.callDurationSeconds != null ? formatDuration(call.callDurationSeconds) : "—"}
              </p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-0.5">Queue ID</p>
              <p className="font-mono text-muted-foreground">{call.id.slice(-8)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Daniela&apos;s message</p>
            <p className="text-xs leading-relaxed text-muted-foreground bg-muted/40 rounded-md p-2" data-testid={`text-content-${call.id}`}>
              {call.content}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Mic className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Call transcript</p>
            </div>
            {call.callTranscript ? (
              <p
                className="text-xs leading-relaxed whitespace-pre-wrap bg-muted/40 rounded-md p-2"
                data-testid={`text-transcript-${call.id}`}
              >
                {call.callTranscript}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic" data-testid={`text-no-transcript-${call.id}`}>
                {answered
                  ? "Transcript pending — recording is being processed."
                  : "No transcript (call was not answered)."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallQuality() {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  // All hooks must be called unconditionally before any conditional returns
  const { data, isLoading: loadingCalls } = useQuery<{ calls: OutboundCall[]; total: number }>({
    queryKey: ["/api/admin/outbound-calls"],
    enabled: !isLoading && (user?.role === "admin" || user?.role === "developer"),
  });

  useEffect(() => {
    if (!isLoading && user) {
      const role = user.role;
      if (role !== "admin" && role !== "developer") {
        setLocation("/");
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return null;
  if (!user || (user.role !== "admin" && user.role !== "developer")) return null;

  const calls = data?.calls || [];
  const answeredCount = calls.filter((c) => c.callAnsweredAt).length;
  const transcriptCount = calls.filter((c) => c.callTranscript).length;

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <header className="flex items-center gap-3 px-6 py-4 border-b shrink-0 sticky top-0 bg-background z-10">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
          <Phone className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight">Call Quality Review</h1>
          <p className="text-xs text-muted-foreground leading-tight">
            Daniela&apos;s outbound call recordings and transcripts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loadingCalls && (
            <>
              <Badge variant="secondary" className="text-xs" data-testid="badge-total-calls">
                {calls.length} calls
              </Badge>
              <Badge variant="secondary" className="text-xs" data-testid="badge-answered-calls">
                {answeredCount} answered
              </Badge>
              <Badge variant="secondary" className="text-xs" data-testid="badge-transcript-count">
                {transcriptCount} transcribed
              </Badge>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-3">
        {loadingCalls ? (
          <div className="text-xs text-muted-foreground p-6 text-center">Loading calls...</div>
        ) : calls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <Phone className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No outbound calls recorded yet.</p>
              <p className="text-xs text-muted-foreground">
                Calls will appear here once Daniela starts making VoIP check-ins.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <CallRow key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
