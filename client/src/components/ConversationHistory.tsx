import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Eye, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Conversation } from "@shared/schema";

const difficultyColors = {
  beginner: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

export function ConversationHistory() {
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const handleViewConversation = (id: string) => {
    console.log(`Viewing conversation: ${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No conversation history yet. Start practicing to see your sessions here!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conversation) => (
        <Card key={conversation.id} className="p-6 hover-elevate" data-testid={`card-conversation-${conversation.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold" data-testid={`text-conversation-topic-${conversation.id}`}>
                  {conversation.topic || "Conversation"}
                </h3>
                <Badge className={difficultyColors[conversation.difficulty as keyof typeof difficultyColors]} data-testid={`badge-difficulty-${conversation.id}`}>
                  {conversation.difficulty}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(conversation.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {conversation.duration} min
                </span>
                <span>{conversation.messageCount} messages</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewConversation(conversation.id)}
              data-testid={`button-view-conversation-${conversation.id}`}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
