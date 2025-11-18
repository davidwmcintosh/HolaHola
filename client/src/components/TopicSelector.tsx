import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import type { Topic } from "@shared/schema";

interface TopicSelectorProps {
  onSelectTopic: (topicName: string) => void;
  onSkip: () => void;
}

export function TopicSelector({ onSelectTopic, onSkip }: TopicSelectorProps) {
  const { data: topics, isLoading } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading topics...</div>
        </div>
      </div>
    );
  }

  // Group topics by category
  const topicsByCategory = (topics || []).reduce((acc, topic) => {
    if (!acc[topic.category]) {
      acc[topic.category] = [];
    }
    acc[topic.category].push(topic);
    return acc;
  }, {} as Record<string, Topic[]>);

  return (
    <div className="container max-w-6xl mx-auto p-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-topic-selector">Choose a Topic</h1>
        <p className="text-muted-foreground mb-4">
          Select a conversation topic to practice specific vocabulary and scenarios
        </p>
        <Button 
          variant="outline" 
          onClick={onSkip}
          data-testid="button-skip-topic"
        >
          Skip - General Practice
        </Button>
      </div>

      <div className="space-y-8">
        {Object.entries(topicsByCategory).map(([category, categoryTopics]) => (
          <div key={category}>
            <h2 className="text-xl font-semibold mb-4" data-testid={`heading-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryTopics.map((topic) => {
                const IconComponent = (LucideIcons as any)[topic.icon] || LucideIcons.MessageCircle;
                
                return (
                  <Card
                    key={topic.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => onSelectTopic(topic.name)}
                    data-testid={`card-topic-${topic.id}`}
                  >
                    <CardHeader className="gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <IconComponent className="w-5 h-5 text-primary shrink-0" />
                          <CardTitle className="text-base truncate">{topic.name}</CardTitle>
                        </div>
                        {topic.difficulty && (
                          <Badge variant="secondary" className="shrink-0">
                            {topic.difficulty}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        {topic.description}
                      </CardDescription>
                      {topic.samplePhrases && topic.samplePhrases.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">Sample phrases:</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {topic.samplePhrases.slice(0, 2).map((phrase, idx) => (
                              <li key={idx}>• {phrase}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
