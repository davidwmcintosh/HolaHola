import { ConversationHistory } from "@/components/ConversationHistory";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function History() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Conversation History</h1>
          <p className="text-muted-foreground">Review your past practice sessions</p>
        </div>
        <LanguageSelector compact />
      </div>

      <ConversationHistory />
    </div>
  );
}
