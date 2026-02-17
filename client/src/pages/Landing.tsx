import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, MessageCircle, BookOpen, TrendingUp, Volume2, Target, ArrowRight } from "lucide-react";
import holaholaLogo from '@assets/holaholamainlogoBackgroundRemoved_1765308837223.png';
import brainImage from "@assets/transparent_colorful_cartoon_brain_Background_Removed_1765564186963.png";

// Tutor avatars for featured tutors row
import spanishFemale from "@assets/tutor-listening-no-background_1764099971094.png";
import frenchMale from "@assets/Tutor_Images/Male/French_Male_Talking.jpg";
import germanMale from "@assets/Tutor_Images/Male/German_Male_Talking.jpg";
import italianFemale from "@assets/Tutor_Images/Female/Italian_Female_Talking_No_Background.jpg";
import japaneseFemale from "@assets/Tutor_Images/Female/Japanese_Female_Talking_No_Background.jpg";
import chineseMale from "@assets/Tutor_Images/Male/Chinese_Male_Talking.jpg";
import koreanFemale from "@assets/Tutor_Images/Female/Korean_Female_Talking_No_Background.jpg";
import englishFemale from "@assets/Cindy-No-Background_1771031411355.jpeg";
import portugueseFemale from "@assets/Tutor_Images/Female/Portuguese_Female_Talking_No_Background.jpg";

// Featured tutors with fallback names - actual names fetched from database
const featuredTutorsConfig = [
  { avatar: spanishFemale, fallbackName: 'Daniela', language: 'spanish', gender: 'female' as const, borderColor: 'border-orange-400' },
  { avatar: frenchMale, fallbackName: 'Vincent', language: 'french', gender: 'male' as const, borderColor: 'border-blue-400' },
  { avatar: germanMale, fallbackName: 'Lukas', language: 'german', gender: 'male' as const, borderColor: 'border-amber-400' },
  { avatar: italianFemale, fallbackName: 'Liv', language: 'italian', gender: 'female' as const, borderColor: 'border-green-400' },
  { avatar: portugueseFemale, fallbackName: 'Isabel', language: 'portuguese', gender: 'female' as const, borderColor: 'border-emerald-400' },
  { avatar: japaneseFemale, fallbackName: 'Sayuri', language: 'japanese', gender: 'female' as const, borderColor: 'border-pink-400' },
  { avatar: chineseMale, fallbackName: 'Tao', language: 'chinese', gender: 'male' as const, borderColor: 'border-red-400' },
  { avatar: koreanFemale, fallbackName: 'Jihyun', language: 'korean', gender: 'female' as const, borderColor: 'border-sky-400' },
  { avatar: englishFemale, fallbackName: 'Cindy', language: 'english', gender: 'female' as const, borderColor: 'border-indigo-400' },
];

// Mind map lobe configuration for watermark
const mindMapLobes = [
  { name: 'Chat!', color: '#60A5FA', angle: -55, cloudPath: 'M25,35 C10,35 5,25 15,15 C20,5 35,5 45,10 C55,5 70,8 75,18 C85,20 90,32 80,42 C85,52 75,60 60,58 C50,65 30,62 25,52 C12,55 8,45 25,35 Z' },
  { name: 'Practice!', color: '#4ADE80', angle: -15, cloudPath: 'M20,38 C8,35 5,22 18,12 C28,2 48,5 55,12 C65,5 82,10 85,25 C95,30 92,48 78,52 C80,62 65,68 50,60 C35,68 15,60 18,48 C5,48 8,40 20,38 Z' },
  { name: 'Words!', color: '#FBBF24', angle: 200, cloudPath: 'M22,32 C10,28 8,15 22,10 C32,2 52,5 58,15 C68,8 85,15 82,30 C92,38 85,55 70,55 C72,65 55,70 42,62 C28,70 10,60 15,48 C2,45 5,35 22,32 Z' },
  { name: 'Culture!', color: '#F87171', angle: 25, cloudPath: 'M28,35 C15,32 10,20 25,12 C35,3 55,8 60,18 C72,10 88,18 85,32 C95,40 88,58 72,55 C75,65 58,72 45,62 C30,70 12,58 18,45 C5,42 10,35 28,35 Z' },
  { name: 'Grammar!', color: '#C084FC', angle: 160, cloudPath: 'M25,30 C12,25 8,12 25,8 C38,0 58,5 62,18 C75,10 92,22 85,38 C95,48 82,62 65,58 C68,70 48,75 35,65 C20,72 5,58 15,45 C2,40 8,32 25,30 Z' },
];

export default function Landing() {
  // Fetch all tutor voices from database (Voice Lab is source of truth)
  const { data: allTutorVoices } = useQuery<{
    id: string;
    language: string;
    gender: string;
    voiceName: string;
    isActive: boolean;
  }[]>({
    queryKey: ['/api/tutor-voices'],
  });

  // Build featured tutors list with database names (fallback to static)
  const extractFirstName = (voiceName: string) => voiceName.split(/\s*-\s*/)[0].trim();
  const featuredTutors = featuredTutorsConfig.map(tutor => {
    const voiceData = allTutorVoices?.find(
      v => v.language.toLowerCase() === tutor.language.toLowerCase() && v.gender === tutor.gender
    );
    const dbName = voiceData ? extractFirstName(voiceData.voiceName) : null;
    return {
      avatar: tutor.avatar,
      name: dbName || tutor.fallbackName,
      language: tutor.language.charAt(0).toUpperCase() + tutor.language.slice(1),
      borderColor: tutor.borderColor,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-background to-orange-50 dark:from-sky-950/20 dark:via-background dark:to-orange-950/20 overflow-hidden">
      {/* Hero Section with mind map watermark */}
      <div className="relative">
        {/* Full Mind Map Watermark - brain with lobe bubbles, full width */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="relative w-full max-w-[900px] md:max-w-[1100px] lg:max-w-[1400px] h-[500px] md:h-[600px] lg:h-[700px]">
            {/* Brain in center */}
            <img 
              src={brainImage} 
              alt="" 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] md:w-[380px] lg:w-[480px] opacity-[0.12] dark:opacity-[0.08]"
            />
            
            {/* Lobe cloud bubbles orbiting the brain */}
            {mindMapLobes.map((lobe, index) => {
              const distance = 200;
              const angleRad = (lobe.angle * Math.PI) / 180;
              const x = Math.cos(angleRad) * distance;
              const y = Math.sin(angleRad) * distance;
              
              return (
                <div
                  key={index}
                  className="absolute top-1/2 left-1/2 opacity-[0.18] dark:opacity-[0.12]"
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                >
                  <svg 
                    viewBox="0 0 100 70" 
                    className="w-[100px] md:w-[130px] lg:w-[160px] h-[70px] md:h-[91px] lg:h-[112px]"
                  >
                    <path
                      d={lobe.cloudPath}
                      fill={lobe.color}
                      stroke={lobe.color}
                      strokeWidth="1"
                    />
                    <text
                      x="50"
                      y="40"
                      textAnchor="middle"
                      className="fill-white font-bold text-[10px] md:text-[12px]"
                      style={{ fontSize: '10px' }}
                    >
                      {lobe.name}
                    </text>
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
        

        <div className="container mx-auto px-6 md:px-8 pt-10 pb-10 md:pt-16 md:pb-16 relative z-10">
          <div className="text-center space-y-5 max-w-4xl mx-auto">
            {/* Logo + Title on same line, logo larger */}
            <div className="flex flex-row items-center justify-center gap-3 md:gap-5">
              <img 
                src={holaholaLogo} 
                alt="HolaHola" 
                className="h-24 md:h-32 lg:h-40 w-auto flex-shrink-0"
                data-testid="img-landing-logo"
              />
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground text-left">
                Master Any Language with AI
              </h1>
            </div>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Practice conversations, build vocabulary, and perfect your grammar with personalized AI tutors who adapt to your learning style
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => window.location.href = '/get-started'}
                data-testid="button-get-started"
                className="text-base px-8"
              >
                Create Account
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => window.location.href = '/login'}
                data-testid="button-login"
                className="text-base bg-background/90 border-foreground/30"
              >
                I Have an Account
              </Button>
            </div>
            
            {/* Featured Tutors Row */}
            <div className="pt-6">
              <p className="text-sm text-muted-foreground mb-3">Here are a few of our AI Tutors</p>
              <div className="flex justify-center gap-2 md:gap-3 lg:gap-4 overflow-x-auto pb-2">
                {featuredTutors.map((tutor, index) => (
                  <div key={index} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full border-2 ${tutor.borderColor} bg-white dark:bg-gray-800 shadow-md overflow-hidden`}>
                      <img 
                        src={tutor.avatar} 
                        alt={tutor.name}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground">{tutor.name}</span>
                    <span className="text-[10px] text-muted-foreground">{tutor.language}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-6 md:py-8">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
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
                <h3 className="font-semibold text-lg">10 Languages</h3>
                <p className="text-sm text-muted-foreground">
                  Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, Korean, English & Hebrew
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
              Create Account
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-2">
          <Link href="/classes" className="text-primary hover:underline" data-testid="link-browse-classes">
            Browse Classes
          </Link>
          <span className="hidden sm:inline text-muted-foreground/50">|</span>
          <Link href="/pricing" className="text-primary hover:underline" data-testid="link-pricing">
            View Plans & Pricing
          </Link>
        </div>
        <p>HolaHola - AI-Powered Language Learning</p>
      </footer>
    </div>
  );
}
