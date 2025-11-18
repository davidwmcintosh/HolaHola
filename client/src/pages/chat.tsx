import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { VoiceChat } from "@/components/VoiceChat";

export default function Chat() {
  const [mode, setMode] = useState<"text" | "voice">("voice");

  return (
    <div className="h-full flex flex-col">
      {mode === "voice" ? <VoiceChat /> : <ChatInterface />}
    </div>
  );
}
