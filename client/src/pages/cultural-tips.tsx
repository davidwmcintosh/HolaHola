import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Loader2, ArrowLeft } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import holaholaIcon from "@assets/holaholajustbubblesBackgroundRemoved_1765309702014.png";

interface CulturalTip {
  id: string;
  language: string;
  category: string;
  title: string;
  content: string;
  context: string;
  relatedTopics: string[] | null;
  icon: string;
}

const languageOptions = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "japanese", label: "Japanese" },
  { value: "mandarin", label: "Mandarin Chinese" },
  { value: "korean", label: "Korean" },
  { value: "hebrew", label: "Hebrew" },
];

export default function CulturalTips() {
  const [, navigate] = useLocation();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("spanish");

  // Try to detect user's current language from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem("userLanguage");
    if (savedLanguage && languageOptions.some(opt => opt.value === savedLanguage)) {
      setSelectedLanguage(savedLanguage);
    }
  }, []);

  const { data: tips = [], isLoading } = useQuery<CulturalTip[]>({
    queryKey: ["/api/cultural-tips", selectedLanguage],
    queryFn: async () => {
      const response = await fetch(`/api/cultural-tips/${selectedLanguage}`);
      if (!response.ok) {
        throw new Error("Failed to fetch cultural tips");
      }
      return response.json();
    },
  });

  const groupedTips = tips.reduce((acc, tip) => {
    if (!acc[tip.category]) {
      acc[tip.category] = [];
    }
    acc[tip.category].push(tip);
    return acc;
  }, {} as Record<string, CulturalTip[]>);

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <img src={holaholaIcon} alt="" className="h-10 w-10 object-contain" />
            <h1 className="text-3xl font-bold" data-testid="heading-cultural-tips">Cultural Tips</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Discover cultural insights and customs to help you navigate real-world situations with confidence.
          </p>
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Language:</span>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-48" data-testid="select-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value} data-testid={`option-${lang.value}`}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
          </div>
        ) : tips.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No cultural tips available for this language yet.</p>
          </div>
        ) : (
          Object.entries(groupedTips).map(([category, categoryTips]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-2xl font-semibold" data-testid={`category-${category.toLowerCase()}`}>{category}</h2>
              <div className="grid grid-cols-1 gap-4">
                {categoryTips.map((tip) => {
                  const IconComponent = (LucideIcons as any)[tip.icon] || Globe;
                  
                  return (
                    <Card key={tip.id} data-testid={`tip-card-${tip.id}`}>
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <CardTitle className="text-lg">{tip.title}</CardTitle>
                            <CardDescription className="text-sm italic">
                              {tip.context}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed">{tip.content}</p>
                          {tip.relatedTopics && tip.relatedTopics.length > 0 && (
                            <div className="pt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Related topics:</p>
                              <div className="flex flex-wrap gap-2">
                                {tip.relatedTopics.map((topic, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
