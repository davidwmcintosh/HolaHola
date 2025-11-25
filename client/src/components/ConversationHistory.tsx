import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Eye, Loader2, Star, Filter } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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

export function ConversationHistory() {
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
    console.log(`Viewing conversation: ${id}`);
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
