import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { VoiceChat } from "@/components/VoiceChat";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mic } from "lucide-react";

export default function Chat() {
  const [mode, setMode] = useState<"text" | "voice">("voice");

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-center gap-2 p-4 border-b">
        <Button
          variant={mode === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("text")}
          data-testid="button-text-mode"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Text
        </Button>
        <Button
          variant={mode === "voice" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("voice")}
          data-testid="button-voice-mode"
        >
          <Mic className="h-4 w-4 mr-2" />
          Voice
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {mode === "voice" ? <VoiceChat /> : <ChatInterface />}
      </div>
    </div>
  );
}
