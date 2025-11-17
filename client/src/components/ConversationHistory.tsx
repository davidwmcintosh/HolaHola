import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Eye } from "lucide-react";

interface Conversation {
  id: string;
  date: Date;
  duration: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  topic: string;
  messageCount: number;
}

const sampleConversations: Conversation[] = [
  {
    id: "1",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2),
    duration: 15,
    difficulty: "intermediate",
    topic: "Discussing favorite foods and restaurants",
    messageCount: 12,
  },
  {
    id: "2",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
    duration: 20,
    difficulty: "beginner",
    topic: "Basic introductions and greetings",
    messageCount: 18,
  },
  {
    id: "3",
    date: new Date(Date.now() - 1000 * 60 * 60 * 48),
    duration: 25,
    difficulty: "intermediate",
    topic: "Planning a trip to Spain",
    messageCount: 24,
  },
];

const difficultyColors = {
  beginner: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

export function ConversationHistory() {
  const handleViewConversation = (id: string) => {
    console.log(`Viewing conversation: ${id}`);
  };

  return (
    <div className="space-y-3">
      {sampleConversations.map((conversation) => (
        <Card key={conversation.id} className="p-6 hover-elevate" data-testid={`card-conversation-${conversation.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold" data-testid={`text-conversation-topic-${conversation.id}`}>
                  {conversation.topic}
                </h3>
                <Badge className={difficultyColors[conversation.difficulty]} data-testid={`badge-difficulty-${conversation.id}`}>
                  {conversation.difficulty}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {conversation.date.toLocaleDateString()}
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
