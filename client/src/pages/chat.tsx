import { ChatInterface } from "@/components/ChatInterface";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DifficultySelector } from "@/components/DifficultySelector";

export default function Chat() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Practice Chat</h1>
          <p className="text-muted-foreground">Have a conversation with your AI language tutor</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageSelector compact />
        </div>
      </div>

      <div className="mb-4">
        <label className="text-sm font-medium mb-2 block">Conversation Difficulty</label>
        <DifficultySelector />
      </div>

      <ChatInterface />
    </div>
  );
}
