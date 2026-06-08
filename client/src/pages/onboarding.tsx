import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, Sparkles, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { User } from "@shared/schema";

type Message = {
  role: "assistant" | "user";
  content: string;
};

type Step = "language" | "experience" | "placement" | "native" | "complete";

const INITIAL_MESSAGE =
  "Hi! I'm your language learning assistant. I'm excited to help you on your language learning journey! What language would you like to learn? (English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Korean, or Hebrew)";

const SUPPORTED_LANGUAGES = [
  "english", "spanish", "french", "german", "italian",
  "portuguese", "japanese", "mandarin", "korean", "mandarin chinese", "hebrew",
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setLanguage } = useLanguage();

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("language");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [placementSessionId, setPlacementSessionId] = useState<string | null>(null);
  const [placementLoading, setPlacementLoading] = useState(false);
  const [placementDone, setPlacementDone] = useState(false);
  const [assessedLevel, setAssessedLevel] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (preferences: {
      targetLanguage?: string;
      nativeLanguage?: string;
      onboardingCompleted?: boolean;
      selfDirectedPlacementDone?: boolean;
    }) => {
      const result = await apiRequest("PUT", "/api/user/preferences", preferences);
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ── Language step ───────────────────────────────────────────────────────────
  const handleLanguageInput = async (userInput: string) => {
    const lower = userInput.toLowerCase().trim();
    const targetLang = SUPPORTED_LANGUAGES.find((lang) => lower.includes(lang));

    if (targetLang) {
      const normalized = targetLang === "mandarin chinese" ? "mandarin" : targetLang;
      await updatePreferencesMutation.mutateAsync({ targetLanguage: normalized });
      setLanguage(normalized);
      setTargetLanguage(normalized);

      const langDisplay = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Great choice! ${langDisplay} opens up so many doors. One quick question — have you studied ${langDisplay} before, or is this your first time?`,
        },
      ]);
      setStep("experience");
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I didn't quite catch that. Please choose one of: English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Korean, or Hebrew.",
        },
      ]);
    }
  };

  // ── Experience step: "yes" branch → start placement ────────────────────────
  const handleExperienceYes = async () => {
    const langDisplay = targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Yes, I have some experience" },
      {
        role: "assistant",
        content: `Wonderful! Let's have a short conversation so I can understand exactly where you are — that way I can meet you right at your level. I'll ask about your experience with ${langDisplay} and we'll just chat naturally. Ready?`,
      },
    ]);
    setStep("placement");
    await startPlacement();
  };

  // ── Experience step: "no" branch → novice_low, go to native ────────────────
  const handleExperienceNo = async () => {
    const langDisplay = targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "No, this is my first time" },
      {
        role: "assistant",
        content: `Perfect — we'll build a solid foundation from the very beginning. ${langDisplay} is such a rewarding language to learn! Now, what's your native language? This helps me explain things in a way that makes sense to you.`,
      },
    ]);
    // Mark placement done with novice_low, no conversation needed
    try {
      await apiRequest("POST", "/api/placement/novice", { language: targetLanguage });
    } catch {
      // Non-fatal: preferences will still be set as completed
    }
    setStep("native");
  };

  // ── Placement: start session ────────────────────────────────────────────────
  const startPlacement = async () => {
    setPlacementLoading(true);
    try {
      const res = await apiRequest("POST", "/api/placement/start", {
        language: targetLanguage,
        testMode: false,
      });
      const data = await res.json();
      setPlacementSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (err: any) {
      toast({
        title: "Couldn't start placement",
        description: "Let's skip the assessment and start fresh.",
        variant: "destructive",
      });
      // Graceful fallback: go straight to native
      setStep("native");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Let's move on — what's your native language?",
        },
      ]);
    } finally {
      setPlacementLoading(false);
    }
  };

  // ── Placement: send message to Daniela ─────────────────────────────────────
  const handlePlacementMessage = async (userInput: string) => {
    if (!placementSessionId) return;
    setPlacementLoading(true);
    try {
      const res = await apiRequest("POST", "/api/placement/message", {
        sessionId: placementSessionId,
        message: userInput,
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      if (data.complete) {
        setPlacementDone(true);
        setAssessedLevel(data.actflLevel ?? null);
        // Brief pause so the student reads Daniela's closing, then ask native language
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Now — what's your native language? That's the last thing I need.",
            },
          ]);
          setStep("native");
        }, 1800);
      }
    } catch {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPlacementLoading(false);
    }
  };

  // ── Native language step → complete ────────────────────────────────────────
  const handleNativeInput = async (userInput: string) => {
    await updatePreferencesMutation.mutateAsync({
      nativeLanguage: userInput.toLowerCase().trim(),
      onboardingCompleted: true,
    });

    const levelNote = assessedLevel
      ? ` I've set your starting level based on our conversation.`
      : "";

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Perfect! I'll explain things in ${userInput}.${levelNote} Let's begin your language learning journey!`,
      },
    ]);
    setStep("complete");

    setTimeout(() => {
      setLocation("/");
    }, 1500);
  };

  // ── Main send handler ───────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim()) return;

    const userInput = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userInput }]);
    setInput("");

    try {
      if (step === "language") {
        await handleLanguageInput(userInput);
      } else if (step === "placement") {
        await handlePlacementMessage(userInput);
      } else if (step === "native") {
        await handleNativeInput(userInput);
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

  const isLoading = updatePreferencesMutation.isPending || placementLoading;
  const showInput = step !== "complete" && step !== "experience";

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
            Welcome to HolaHola!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Message thread */}
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
            {(isLoading && step === "placement") && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Experience step: yes/no buttons */}
          {step === "experience" && (
            <div className="flex gap-3 justify-center pt-1">
              <Button
                data-testid="button-experience-yes"
                onClick={handleExperienceYes}
                disabled={isLoading}
                variant="default"
              >
                Yes, I have some experience
              </Button>
              <Button
                data-testid="button-experience-no"
                onClick={handleExperienceNo}
                disabled={isLoading}
                variant="outline"
              >
                No, this is my first time
              </Button>
            </div>
          )}

          {/* Text input (all steps except experience + complete) */}
          {showInput && (
            <div className="flex gap-2">
              <Input
                data-testid="input-onboarding-message"
                placeholder={
                  step === "placement"
                    ? "Reply to Daniela..."
                    : "Type your answer..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading || placementDone}
              />
              <Button
                data-testid="button-send-message"
                onClick={handleSend}
                disabled={!input.trim() || isLoading || placementDone}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          {/* Complete state */}
          {step === "complete" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              All set! Taking you to your dashboard…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
