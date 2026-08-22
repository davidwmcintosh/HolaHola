import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, ChevronLeft, ChevronRight, Send, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";

interface LucaChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  sessionId?: string | null;
}

interface ChatMessage {
  id?: string;
  role: "david" | "luca";
  content: string;
  createdAt: string;
}

interface ChatHistoryResponse {
  messages: ChatMessage[];
}

interface ChatReplyResponse {
  reply: string;
  savedAt: string;
}

export function LucaChatPanel({ isOpen, onToggle, sessionId }: LucaChatPanelProps) {
  const [inputText, setInputText] = useState("");
  // Optimistic messages appended before server confirms
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const [relaySent, setRelaySent] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: history } = useQuery<ChatHistoryResponse>({
    queryKey: ["/api/admin/luca/chat"],
    queryFn: async () => {
      const res = await fetch("/api/admin/luca/chat");
      if (!res.ok) return { messages: [] };
      return res.json();
    },
    enabled: isOpen,
    staleTime: 30_000,
  });

  // Merge server history with optimistic additions, deduplicating by content+role
  const serverMessages = history?.messages ?? [];
  const allMessages: ChatMessage[] = (() => {
    if (optimistic.length === 0) return serverMessages;
    // Drop optimistic entries that are now in the server response
    const serverSet = new Set(serverMessages.map(m => `${m.role}::${m.content}`));
    const filtered = optimistic.filter(m => !serverSet.has(`${m.role}::${m.content}`));
    return [...serverMessages, ...filtered];
  })();

  const sendMessage = useMutation({
    mutationFn: async (message: string): Promise<ChatReplyResponse> => {
      const data = await apiRequest("POST", "/api/admin/luca/chat", {
        message,
        sessionId: sessionId ?? null,
      });
      return data as unknown as ChatReplyResponse;
    },
    onMutate: (message) => {
      setOptimistic(prev => [
        ...prev,
        { role: "david", content: message, createdAt: new Date().toISOString() },
      ]);
    },
    onSuccess: (data, message) => {
      setOptimistic(prev => [
        ...prev,
        { role: "luca", content: data.reply, createdAt: data.savedAt },
      ]);
      // Refresh server history in the background
      qc.invalidateQueries({ queryKey: ["/api/admin/luca/chat"] });
    },
    onError: () => {
      // Roll back the optimistic david message
      setOptimistic(prev => prev.slice(0, -1));
    },
  });

  const relayToDaniela = useMutation({
    mutationFn: async ({ content, key }: { content: string; key: string }) => {
      await apiRequest("POST", "/api/admin/luca/relay-to-daniela", {
        message: content,
        sessionId: sessionId ?? null,
      });
      return key;
    },
    onSuccess: (key) => {
      setRelaySent(prev => new Set([...prev, key]));
    },
  });

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [allMessages.length]);

  // Reset optimistic state when panel closes so it stays clean on reopen
  useEffect(() => {
    if (!isOpen) setOptimistic([]);
  }, [isOpen]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || sendMessage.isPending) return;
    setInputText("");
    sendMessage.mutate(text);
  };

  return (
    <div
      className={`border-l bg-muted/30 flex flex-col transition-all duration-200 min-h-0 ${
        isOpen ? "w-80" : "w-10"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="relative flex items-center justify-center h-10 border-b hover:bg-muted/50 transition-colors shrink-0"
        title={isOpen ? "Close Luca chat" : "Chat with Luca"}
      >
        {isOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        {!isOpen && (
          <Bot className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 text-violet-500" />
        )}
      </button>

      {isOpen && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b flex items-center gap-2 shrink-0">
            <Bot className="h-4 w-4 text-violet-500 shrink-0" />
            <span className="font-medium text-sm">Luca</span>
            {sendMessage.isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
            )}
          </div>

          {/* Message thread */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
          >
            {allMessages.length === 0 && !sendMessage.isPending && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Say something to Luca
              </p>
            )}

            {allMessages.map((msg, i) => {
              const key = `${msg.createdAt}-${i}`;
              const isDavid = msg.role === "david";
              return (
                <div
                  key={key}
                  className={`flex flex-col gap-0.5 ${isDavid ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                      isDavid
                        ? "bg-blue-500 text-white rounded-br-sm"
                        : "bg-card border text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Relay button — only on Luca's messages */}
                  {!isDavid && (
                    <button
                      onClick={() =>
                        relayToDaniela.mutate({ content: msg.content, key })
                      }
                      disabled={
                        relaySent.has(key) || relayToDaniela.isPending
                      }
                      className={`flex items-center gap-1 text-[10px] px-1 transition-colors ${
                        relaySent.has(key)
                          ? "text-green-600 cursor-default"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {relaySent.has(key) ? (
                        "sent to Daniela ✓"
                      ) : (
                        <>
                          <ArrowRight className="h-2.5 w-2.5" />
                          send to Daniela
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Typing indicator while waiting for Luca */}
            {sendMessage.isPending && (
              <div className="flex items-start">
                <div className="bg-card border rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-2 py-2 border-t shrink-0 flex gap-1.5">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message Luca…"
              className="text-sm h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sendMessage.isPending}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 shrink-0"
              disabled={!inputText.trim() || sendMessage.isPending}
              onClick={handleSend}
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
