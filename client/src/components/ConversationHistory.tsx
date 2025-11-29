import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock, Eye, Loader2, Star, Filter, ArrowLeft, Bot, User } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation, Message } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const difficultyColors = {
  beginner: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'older';

const timeFilterLabels: Record<TimeFilter, string> = {
  all: 'All Time',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  older: 'Older',
};

interface ConversationHistoryProps {
  selectedConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onBack?: () => void;
}

export function ConversationHistory({ 
  selectedConversationId, 
  onSelectConversation,
  onBack 
}: ConversationHistoryProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [starredOnly, setStarredOnly] = useState(false);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations/filtered", { timeFilter, starredOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (timeFilter !== 'all') params.append('timeFilter', timeFilter);
      if (starredOnly) params.append('starredOnly', 'true');
      const url = `/api/conversations/filtered?${params.toString()}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const { data: selectedConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", selectedConversationId],
    enabled: !!selectedConversationId,
  });

  const toggleStarMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('PATCH', `/api/conversations/${id}/star`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/filtered"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const handleViewConversation = (id: string) => {
    if (onSelectConversation) {
      onSelectConversation(id);
    }
  };

  const handleToggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleStarMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedConversationId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Button>
          {selectedConversation && (
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold" data-testid="text-conversation-detail-title">
                {selectedConversation.title || "Untitled Conversation"}
              </h2>
              <Badge className={difficultyColors[selectedConversation.difficulty as keyof typeof difficultyColors]}>
                {selectedConversation.difficulty}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {selectedConversation.language}
              </Badge>
            </div>
          )}
        </div>

        <Card className="p-4 md:p-6">
          {isLoadingMessages ? (
            <div className="flex justify-center items-center min-h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col justify-center items-center min-h-64 text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">No messages in this conversation</p>
              <p className="text-sm">This conversation doesn't have any messages yet.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.role}-${message.id}`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 md:p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <p className="text-xs mt-2 opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="dropdown-time-filter">
              <Filter className="h-4 w-4 mr-2" />
              {timeFilterLabels[timeFilter]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(timeFilterLabels) as TimeFilter[]).map((filter) => (
              <DropdownMenuItem 
                key={filter} 
                onClick={() => setTimeFilter(filter)}
                data-testid={`menu-item-filter-${filter}`}
              >
                {timeFilterLabels[filter]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={starredOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setStarredOnly(!starredOnly)}
          data-testid="button-starred-filter"
        >
          <Star className={`h-4 w-4 mr-2 ${starredOnly ? "fill-current" : ""}`} />
          Starred
        </Button>
      </div>

      {conversations.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {starredOnly 
              ? "No starred conversations yet. Star your favorites to find them quickly!" 
              : timeFilter !== 'all' 
                ? `No conversations found for ${timeFilterLabels[timeFilter].toLowerCase()}.`
                : "No conversation history yet. Start practicing to see your sessions here!"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <Card key={conversation.id} className="p-6 hover-elevate" data-testid={`card-conversation-${conversation.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleToggleStar(e, conversation.id)}
                      data-testid={`button-star-${conversation.id}`}
                    >
                      <Star 
                        className={`h-4 w-4 ${conversation.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} 
                      />
                    </Button>
                    <h3 className="font-semibold" data-testid={`text-conversation-title-${conversation.id}`}>
                      {conversation.title || "Untitled Conversation"}
                    </h3>
                    <Badge className={difficultyColors[conversation.difficulty as keyof typeof difficultyColors]} data-testid={`badge-difficulty-${conversation.id}`}>
                      {conversation.difficulty}
                    </Badge>
                    <Badge variant="outline" className="capitalize" data-testid={`badge-language-${conversation.id}`}>
                      {conversation.language}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap ml-10">
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
      )}
    </div>
  );
}
