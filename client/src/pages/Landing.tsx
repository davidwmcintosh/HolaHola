import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, MessageCircle, BookOpen, TrendingUp, Volume2, Target } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight">
            Learn Languages with AI
          </h1>
          <p className="text-xl text-muted-foreground">
            Practice conversations, build vocabulary, and track your progress with your personal AI language tutor
          </p>
          <div className="pt-4">
            <Button
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-login"
            >
              Get Started
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Interactive Conversations</h3>
                <p className="text-sm text-muted-foreground">
                  Practice real conversations with AI that adapts to your level and provides instant feedback
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Volume2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Voice Chat</h3>
                <p className="text-sm text-muted-foreground">
                  Speak naturally with pronunciation scoring and real-time feedback
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Smart Flashcards</h3>
                <p className="text-sm text-muted-foreground">
                  Learn vocabulary with spaced repetition that adapts to your retention
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Adaptive Difficulty</h3>
                <p className="text-sm text-muted-foreground">
                  AI automatically adjusts to your skill level as you improve
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Progress Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Track your streaks, vocabulary growth, and conversation activity
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">8 Languages</h3>
                <p className="text-sm text-muted-foreground">
                  Learn Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, or Korean
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16 space-y-4">
          <h2 className="text-3xl font-bold">Ready to start your language journey?</h2>
          <p className="text-muted-foreground">Join thousands of learners improving their language skills with AI</p>
          <Button
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login-cta"
          >
            Sign In to Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
