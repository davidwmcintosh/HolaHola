import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { VoiceChat } from "@/components/VoiceChat";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DifficultySelector } from "@/components/DifficultySelector";
import { Button } from "@/components/ui/button";
import { Mic, MessageSquare } from "lucide-react";

export default function Chat() {
  const [mode, setMode] = useState<"text" | "voice">("voice");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Practice Chat</h1>
          <p className="text-muted-foreground">
            {mode === "voice" 
              ? "Speak with your AI language tutor" 
              : "Have a conversation with your AI language tutor"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageSelector compact />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Conversation Difficulty</label>
          <DifficultySelector />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Conversation Mode</label>
          <div className="flex gap-2">
            <Button
              variant={mode === "voice" ? "default" : "outline"}
              onClick={() => setMode("voice")}
              className="flex-1"
              data-testid="button-voice-mode"
            >
              <Mic className="h-4 w-4 mr-2" />
              Voice
            </Button>
            <Button
              variant={mode === "text" ? "default" : "outline"}
              onClick={() => setMode("text")}
              className="flex-1"
              data-testid="button-text-mode"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Text
            </Button>
          </div>
        </div>
      </div>

      {mode === "voice" ? <VoiceChat /> : <ChatInterface />}
    </div>
  );
}
