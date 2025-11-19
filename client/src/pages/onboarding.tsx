import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

type Message = {
  role: "assistant" | "user";
  content: string;
};

const INITIAL_MESSAGE = "Hi! I'm your language learning assistant. I'm excited to help you on your language learning journey! What language would you like to learn? (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, or Korean)";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE }
  ]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<"language" | "native" | "difficulty" | "complete">("language");

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (preferences: {
      targetLanguage?: string;
      nativeLanguage?: string;
      difficultyLevel?: string;
      onboardingCompleted?: boolean;
    }) => {
      console.log("Updating preferences:", preferences);
      const result = await apiRequest("PUT", "/api/user/preferences", preferences);
      console.log("Preferences updated:", result);
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      console.error("Failed to update preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.toLowerCase().trim();
    setInput("");

    const languages = ["english", "spanish", "french", "german", "italian", "portuguese", "japanese", "mandarin", "korean", "mandarin chinese"];
    const difficulties = ["beginner", "intermediate", "advanced"];

    try {
      if (step === "language") {
        const targetLang = languages.find((lang) => userInput.includes(lang));
        if (targetLang) {
          const normalizedLang = targetLang === "mandarin chinese" ? "mandarin" : targetLang;
          await updatePreferencesMutation.mutateAsync({ targetLanguage: normalizedLang });
          
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Great choice! Learning ${targetLang} will open up so many opportunities. Now, what's your native language? This helps me explain things in a way that makes sense to you.`,
            },
          ]);
          setStep("native");
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "I didn't quite catch that. Please choose one of: English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, or Korean.",
            },
          ]);
        }
      } else if (step === "native") {
        await updatePreferencesMutation.mutateAsync({ nativeLanguage: userInput });
        
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Perfect! I'll explain things in ${userInput}. Now, what's your current level? Are you a beginner (just starting out), intermediate (can have basic conversations), or advanced (fluent but want to improve)?`,
          },
        ]);
        setStep("difficulty");
      } else if (step === "difficulty") {
        const difficulty = difficulties.find((diff) => userInput.includes(diff));
        if (difficulty) {
          await updatePreferencesMutation.mutateAsync({ 
            difficultyLevel: difficulty,
            onboardingCompleted: true 
          });
          
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Excellent! You're all set up as a ${difficulty} learner. Let's start your language learning adventure! 🎉`,
            },
          ]);
          setStep("complete");
          
          // Wait for preferences to save and query to refresh, then redirect to home
          // Router will automatically direct to chat since onboarding is complete
          setTimeout(() => {
            setLocation("/");
          }, 1500);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Please tell me if you're a beginner, intermediate, or advanced learner.",
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Error in onboarding flow:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Welcome to LinguaFlow!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 max-h-96 overflow-y-auto p-4 border rounded-md">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          {step !== "complete" && (
            <div className="flex gap-2">
              <Input
                data-testid="input-onboarding-message"
                placeholder="Type your answer..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={updatePreferencesMutation.isPending}
              />
              <Button
                data-testid="button-send-message"
                onClick={handleSend}
                disabled={!input.trim() || updatePreferencesMutation.isPending}
                size="icon"
              >
                {updatePreferencesMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
