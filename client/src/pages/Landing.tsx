import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, MessageCircle, BookOpen, TrendingUp, Volume2, Target, ArrowRight } from "lucide-react";
import holaholaLogo from '@assets/holaholamainlogoBackgroundRemoved_1765308837223.png';
import brainImage from "@assets/transparent_colorful_cartoon_brain_Background_Removed_1765564186963.png";

// Tutor avatars for watermark display
import spanishFemale from "@assets/tutor-listening-no-background_1764099971094.png";
import spanishMale from "@assets/Boy-tutor-waiting-No-Background_1764186322051.png";
import frenchFemale from "@assets/Tutor_Images/Female/French_Female_Speaking_No_Background.jpg";
import germanMale from "@assets/Tutor_Images/Male/German_Male_Talking.jpg";
import italianFemale from "@assets/Tutor_Images/Female/Italian_Female_Talking_No_Background.jpg";
import japaneseMale from "@assets/Tutor_Images/Male/Japanese_Male_Talking.jpg";

// Tutor bubbles positioned around the hero
const tutorBubbles = [
  { avatar: spanishFemale, position: 'top-[5%] left-[3%]', size: 'w-16 h-16 md:w-24 md:h-24', bubbleColor: 'border-orange-400' },
  { avatar: spanishMale, position: 'top-[8%] right-[5%]', size: 'w-14 h-14 md:w-20 md:h-20', bubbleColor: 'border-orange-300' },
  { avatar: frenchFemale, position: 'top-[25%] left-[2%]', size: 'w-12 h-12 md:w-18 md:h-18', bubbleColor: 'border-blue-400' },
  { avatar: germanMale, position: 'top-[30%] right-[3%]', size: 'w-14 h-14 md:w-20 md:h-20', bubbleColor: 'border-amber-400' },
  { avatar: italianFemale, position: 'top-[15%] left-[8%]', size: 'w-10 h-10 md:w-16 md:h-16', bubbleColor: 'border-green-400' },
  { avatar: japaneseMale, position: 'top-[20%] right-[8%]', size: 'w-12 h-12 md:w-18 md:h-18', bubbleColor: 'border-pink-400' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-background to-orange-50 dark:from-sky-950/20 dark:via-background dark:to-orange-950/20 overflow-hidden">
      {/* Hero Section with tutor avatars watermark */}
      <div className="relative">
        {/* Brain watermark - centered behind content */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img 
            src={brainImage} 
            alt="" 
            className="w-[400px] md:w-[500px] lg:w-[600px] opacity-[0.08] dark:opacity-[0.05]"
          />
        </div>
        
        {/* Tutor avatar bubbles - hidden on mobile */}
        <div className="hidden md:block absolute inset-0 pointer-events-none overflow-hidden">
          {tutorBubbles.map((tutor, index) => (
            <div
              key={index}
              className={`absolute ${tutor.position} ${tutor.size} rounded-full border-2 ${tutor.bubbleColor} bg-white/80 dark:bg-gray-800/80 shadow-lg opacity-40 dark:opacity-30 overflow-hidden`}
            >
              <img 
                src={tutor.avatar} 
                alt="" 
                className="w-full h-full object-cover object-top"
              />
            </div>
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
    </div>
  );
}
