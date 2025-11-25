import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Loader2, AlertCircle } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Redirect } from "wouter";

interface Topic {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  samplePhrases: string[];
}

export default function ChatIdeas() {
  const { userName } = useLanguage();
  
  // Redirect to chat if onboarding is not complete
  const isOnboardingComplete = userName && userName.trim() !== "";
  if (!isOnboardingComplete) {
    return <Redirect to="/chat" />;
  }

  const { data: topics = [], isLoading } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
      </div>
    );
  }

  const groupedTopics = topics.reduce((acc, topic) => {
    if (!acc[topic.category]) {
      acc[topic.category] = [];
    }
    acc[topic.category].push(topic);
    return acc;
  }, {} as Record<string, Topic[]>);

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="heading-chat-ideas">Chat Ideas</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Looking for conversation inspiration? Browse these topic ideas to help you practice specific scenarios and vocabulary.
          </p>
        </div>

        {Object.entries(groupedTopics).map(([category, categoryTopics]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-2xl font-semibold" data-testid={`category-${category.toLowerCase()}`}>{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryTopics.map((topic) => {
                const IconComponent = (LucideIcons as any)[topic.icon] || Lightbulb;
                
                return (
                  <Card key={topic.id} className="overflow-hidden" data-testid={`topic-card-${topic.id}`}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <CardTitle className="text-lg truncate">{topic.name}</CardTitle>
                          <CardDescription className="line-clamp-2">{topic.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium mb-2">Sample phrases to practice:</p>
                          <div className="flex flex-wrap gap-2">
                            {topic.samplePhrases.map((phrase, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs max-w-full">
                                <span className="truncate">{phrase}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
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
