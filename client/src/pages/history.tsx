import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ConversationHistory } from "@/components/ConversationHistory";
import { LearningContextFilter } from "@/components/LearningContextFilter";

export default function History() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const conversationId = params.get('conversation');
    if (conversationId) {
      setSelectedConversationId(conversationId);
    }
  }, [search]);

  const handleBack = () => {
    setSelectedConversationId(null);
    setLocation('/history');
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setLocation(`/history?conversation=${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Conversation History</h1>
          <p className="text-muted-foreground">Review your past practice sessions</p>
        </div>
        <LearningContextFilter />
      </div>

      <ConversationHistory 
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        onBack={handleBack}
      />
    </div>
  );
}
