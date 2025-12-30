import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, MessageCircle, BookOpen, TrendingUp, Volume2, Target, ArrowRight } from "lucide-react";
import holaholaLogo from '@assets/holaholamainlogoBackgroundRemoved_1765308837223.png';

// Floating language greetings for visual interest
const floatingGreetings = [
  { text: 'Hola', color: 'text-orange-500', position: 'top-[12%] left-[8%]', size: 'text-3xl md:text-4xl', delay: '0s' },
  { text: 'Bonjour', color: 'text-blue-500', position: 'top-[18%] right-[10%]', size: 'text-2xl md:text-3xl', delay: '0.5s' },
  { text: '你好', color: 'text-red-500', position: 'top-[28%] left-[5%]', size: 'text-4xl md:text-5xl', delay: '1s' },
  { text: 'Ciao', color: 'text-green-600', position: 'top-[22%] right-[25%]', size: 'text-xl md:text-2xl', delay: '1.5s' },
  { text: 'こんにちは', color: 'text-pink-500', position: 'top-[35%] right-[5%]', size: 'text-lg md:text-xl', delay: '2s' },
  { text: 'Olá', color: 'text-emerald-500', position: 'top-[8%] right-[35%]', size: 'text-2xl md:text-3xl', delay: '2.5s' },
  { text: 'Guten Tag', color: 'text-amber-600', position: 'top-[32%] left-[15%]', size: 'text-lg md:text-xl', delay: '3s' },
  { text: '안녕', color: 'text-purple-500', position: 'top-[15%] left-[25%]', size: 'text-xl md:text-2xl', delay: '3.5s' },
  { text: 'नमस्ते', color: 'text-orange-600', position: 'top-[38%] left-[3%]', size: 'text-2xl md:text-3xl', delay: '4s' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-background to-orange-50 dark:from-sky-950/20 dark:via-background dark:to-orange-950/20 overflow-hidden">
      {/* Hero Section with floating greetings */}
      <div className="relative">
        {/* Floating greetings background - hidden on mobile */}
        <div className="hidden md:block absolute inset-0 pointer-events-none overflow-hidden">
          {floatingGreetings.map((greeting, index) => (
            <span
              key={index}
              className={`absolute ${greeting.position} ${greeting.color} ${greeting.size} font-bold opacity-15 dark:opacity-10 select-none`}
              style={{
                animation: `float 6s ease-in-out infinite`,
                animationDelay: greeting.delay,
              }}
            >
              {greeting.text}
            </span>
          ))}
        </div>

        <div className="container mx-auto px-4 pt-12 pb-8 md:pt-20 md:pb-16 relative z-10">
          <div className="text-center space-y-6 max-w-3xl mx-auto">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <img 
                src={holaholaLogo} 
                alt="HolaHola" 
                className="h-20 md:h-28 w-auto"
                data-testid="img-landing-logo"
              />
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
              Master Any Language with AI
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Practice conversations, build vocabulary, and perfect your grammar with personalized AI tutors who adapt to your learning style
            </p>
            <div className="pt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => window.location.href = '/get-started'}
                data-testid="button-get-started"
                className="text-base px-8"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => window.location.href = '/login'}
                data-testid="button-login"
                className="text-base"
              >
                I Have an Account
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
          Why Learners Love HolaHola
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm hover-elevate">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                  <MessageCircle className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-lg">Interactive Conversations</h3>
                <p className="text-sm text-muted-foreground">
                  Practice real conversations with AI tutors who adapt to your level and provide instant feedback
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm hover-elevate">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                  <Volume2 className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-lg">Voice Chat</h3>
                <p className="text-sm text-muted-foreground">
                  Speak naturally with pronunciation feedback and real-time conversation practice
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm hover-elevate">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center">
                  <BookOpen className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-lg">Smart Flashcards</h3>
                <p className="text-sm text-muted-foreground">
                  Learn vocabulary with spaced repetition that adapts to your memory patterns
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm hover-elevate">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center">
                  <Target className="h-7 w-7 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="font-semibold text-lg">Adaptive Learning</h3>
                <p className="text-sm text-muted-foreground">
                  AI automatically adjusts difficulty based on your progress and learning pace
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm hover-elevate">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-pink-500/20 to-pink-600/10 flex items-center justify-center">
                  <TrendingUp className="h-7 w-7 text-pink-600 dark:text-pink-400" />
                </div>
                <h3 className="font-semibold text-lg">Progress Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Track your streaks, vocabulary growth, and skill improvements over time
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm hover-elevate">
            <CardContent className="pt-6 pb-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center">
                  <Globe className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h3 className="font-semibold text-lg">9 Languages</h3>
                <p className="text-sm text-muted-foreground">
                  Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, Korean & Hindi
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to start your language journey?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Join learners around the world improving their language skills with personalized AI tutoring
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={() => window.location.href = '/get-started'}
              data-testid="button-get-started-cta"
              className="text-base px-8"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.location.href = '/login'}
              data-testid="button-login-cta"
              className="text-base"
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground border-t">
        <p>HolaHola - AI-Powered Language Learning</p>
      </footer>

      {/* CSS animation for floating effect */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
