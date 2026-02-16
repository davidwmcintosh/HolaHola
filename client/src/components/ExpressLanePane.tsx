import { useState, useRef, useEffect } from "react";
import {
  Send,
  Mic,
  Loader2,
  Sparkles,
  Radio,
  Code,
  Wifi,
  WifiOff,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFounderCollab } from "@/hooks/useFounderCollab";

export function ExpressLanePane() {
  const {
    state: syncState,
    voiceState: syncVoiceState,
    connect: syncConnect,
    disconnect: syncDisconnect,
    sendMessage: syncSendMessage,
    startVoiceRecording: syncStartVoice,
    stopVoiceRecording: syncStopVoice,
    replayMessage: syncReplayMessage,
    isConnected: syncIsConnected,
  } = useFounderCollab();

  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    syncConnect();
    return () => {
      syncDisconnect();
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [syncState.messages]);

  const handleSend = () => {
    if (message.trim() && syncIsConnected) {
      syncSendMessage("founder", message.trim());
      setMessage("");
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="express-lane-pane">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
        {syncIsConnected ? (
          <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
            <Wifi className="h-3 w-3" />
            <span>Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            <span>{syncState.connectionState === "reconnecting" ? "Reconnecting..." : "Offline"}</span>
          </div>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          Founder + Daniela + Wren
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {syncState.messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Radio className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">EXPRESS Lane ready</p>
          </div>
        ) : (
          syncState.messages.map((msg) => (
            <div
              key={msg.cursor}
              className={`p-2 rounded-md text-sm ${
                msg.role === "founder"
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : msg.role === "daniela"
                  ? "bg-primary/10 border border-primary/20"
                  : msg.role === "wren"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-muted border border-border"
              }`}
              data-testid={`express-msg-${msg.id}`}
            >
              <div className="flex items-center gap-1 mb-1">
                {msg.role === "founder" && <Code className="h-3 w-3 text-amber-500" />}
                {msg.role === "daniela" && <Sparkles className="h-3 w-3 text-primary" />}
                {msg.role === "wren" && <Radio className="h-3 w-3 text-emerald-500" />}
                <span className="font-medium text-[11px] capitalize">{msg.role}</span>
                {msg.messageType === "voice" && <Mic className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {msg.messageType === "voice" && msg.role === "daniela" && (
                  <button
                    onClick={() => syncReplayMessage(msg.id)}
                    className="p-1 rounded hover-elevate"
                    disabled={syncVoiceState.playingMessageId === msg.id}
                    data-testid={`button-replay-express-${msg.id}`}
                  >
                    {syncVoiceState.playingMessageId === msg.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Volume2 className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t space-y-1.5">
        {syncVoiceState.currentTranscript && (
          <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5 animate-pulse">
            {syncVoiceState.currentTranscript}
          </div>
        )}

        {syncVoiceState.processingStatus === "thinking" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Daniela is thinking...</span>
          </div>
        )}
        {syncVoiceState.processingStatus === "speaking" && (
          <div className="flex items-center gap-1.5 text-[10px] text-primary">
            <Sparkles className="h-3 w-3 animate-pulse" />
            <span>Daniela is speaking...</span>
          </div>
        )}

        <div className="flex gap-1.5 items-center">
          <Button
            className="flex-1 text-xs"
            variant={syncVoiceState.isRecording ? "destructive" : "outline"}
            size="sm"
            onPointerDown={() => syncStartVoice()}
            onPointerUp={() => syncStopVoice()}
            onPointerLeave={() => syncVoiceState.isRecording && syncStopVoice()}
            onPointerCancel={() => syncVoiceState.isRecording && syncStopVoice()}
            disabled={!syncIsConnected || syncVoiceState.processingStatus === "thinking" || syncVoiceState.processingStatus === "speaking"}
            data-testid="button-express-voice"
          >
            {syncVoiceState.isRecording ? (
              <>
                <Mic className="h-3 w-3 mr-1.5 animate-pulse" />
                <span>Release to send</span>
              </>
            ) : (
              <>
                <Mic className="h-3 w-3 mr-1.5" />
                <span>Hold to talk</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex gap-1.5">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Or type..."
            className="flex-1 text-xs h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!syncIsConnected}
            data-testid="input-express-message"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSend}
            disabled={!syncIsConnected || !message.trim()}
            data-testid="button-send-express"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
