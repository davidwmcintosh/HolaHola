import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ConversationHistory } from "@/components/ConversationHistory";
import { LearningContextFilter } from "@/components/LearningContextFilter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import holaholaIcon from "@assets/holaholajustbubblesBackgroundRemoved_1765309702014.png";

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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <img src={holaholaIcon} alt="" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-3xl font-semibold mb-2">Conversation History</h1>
            <p className="text-muted-foreground">Review your past practice sessions</p>
          </div>
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
