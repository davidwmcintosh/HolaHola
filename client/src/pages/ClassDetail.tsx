import { Link, useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, BookOpen, Globe, GraduationCap, Briefcase, Plane, 
  Check, Clock, Users, Target, MessageCircle, Mic, Award, Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface ClassType {
  id: string;
  name: string;
  description: string;
  slug: string;
  icon: string;
}

interface PublicClass {
  id: string;
  name: string;
  description: string;
  language: string;
  classTypeId: string;
  classType: ClassType | null;
  isFeatured: boolean;
  featuredOrder: number;
  targetActflLevel: string;
  classLevel: number;
}

const iconMap: Record<string, typeof BookOpen> = {
  'graduation-cap': GraduationCap,
  'briefcase': Briefcase,
  'plane': Plane,
  'globe': Globe,
  'book-open': BookOpen,
};

function getIcon(iconName: string | null) {
  if (!iconName) return BookOpen;
  return iconMap[iconName] || BookOpen;
}

function getLanguageLabel(language: string): string {
  const labels: Record<string, string> = {
    spanish: 'Spanish',
    french: 'French',
    german: 'German',
    italian: 'Italian',
    portuguese: 'Portuguese',
    japanese: 'Japanese',
    korean: 'Korean',
    'mandarin chinese': 'Mandarin',
    english: 'English',
  };
  return labels[language.toLowerCase()] || language;
}

function getClassPrice(classLevel: number): { price: number; period: string } {
  switch (classLevel) {
    case 1: return { price: 49, period: '/class' };
    case 2: return { price: 59, period: '/class' };
    case 3: return { price: 69, period: '/class' };
    case 4: return { price: 79, period: '/class' };
    default: return { price: 49, period: '/class' };
  }
}

function getLevelBadge(classLevel: number): { label: string; description: string } {
  switch (classLevel) {
    case 1: return { label: 'Beginner', description: 'Perfect for those new to the language' };
    case 2: return { label: 'Intermediate', description: 'For learners with basic foundations' };
    case 3: return { label: 'Advanced', description: 'For confident speakers seeking fluency' };
    case 4: return { label: 'Superior', description: 'Near-native level refinement' };
    default: return { label: 'All Levels', description: 'Suitable for various skill levels' };
  }
}

const CLASS_FEATURES = [
  { icon: MessageCircle, text: 'AI-powered conversation practice' },
  { icon: Mic, text: 'Real-time pronunciation feedback' },
  { icon: Target, text: 'ACTFL-aligned curriculum' },
  { icon: Award, text: 'Progress tracking & assessments' },
  { icon: Users, text: 'Native-speaking AI tutors' },
  { icon: Clock, text: 'Flexible scheduling' },
];

export default function ClassDetail() {
  const [, params] = useRoute('/classes/:id');
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const classId = params?.id;

  const { data: publicClasses, isLoading } = useQuery<PublicClass[]>({
    queryKey: ['/api/classes/public'],
  });

  const classData = publicClasses?.find(c => c.id === classId);
  
  const handleEnroll = () => {
    if (isAuthenticated) {
      setLocation(`/student/join-class?classId=${classId}`);
    } else {
      setLocation(`/signup?redirect=/student/join-class&classId=${classId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading class details...</p>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 md:px-8">
          <Link href="/classes">
            <Button variant="ghost" size="sm" className="mb-8" data-testid="button-back-classes">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Classes
            </Button>
          </Link>
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Class Not Found</h2>
              <p className="text-muted-foreground mb-6">
                This class may no longer be available or the link is incorrect.
              </p>
              <Link href="/classes">
                <Button data-testid="button-browse-classes">Browse All Classes</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const level = getLevelBadge(classData.classLevel);
  const pricing = getClassPrice(classData.classLevel);
  const Icon = classData.classType?.icon ? getIcon(classData.classType.icon) : BookOpen;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 md:px-8">
        <Link href="/classes">
          <Button variant="ghost" size="sm" className="mb-8" data-testid="button-back-classes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Classes
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Icon className="h-6 w-6 text-primary" />
                <Badge variant="outline" className="text-sm">{getLanguageLabel(classData.language)}</Badge>
                <Badge variant="secondary">{level.label}</Badge>
                {classData.isFeatured && <Badge variant="default">Featured</Badge>}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-class-title">
                {classData.name}
              </h1>
              <p className="text-lg text-muted-foreground" data-testid="text-class-description">
                {classData.description}
              </p>
            </div>

            <Separator />

            <div>
              <h2 className="text-xl font-semibold mb-4">About This Class</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Target Level
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{classData.targetActflLevel?.replace('_', ' ').toUpperCase() || 'Varies'}</p>
                    <p className="text-sm text-muted-foreground">{level.description}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Language
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{getLanguageLabel(classData.language)}</p>
                    <p className="text-sm text-muted-foreground">Native AI tutor included</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-xl font-semibold mb-4">What You'll Get</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CLASS_FEATURES.map((feature, index) => {
                  const FeatureIcon = feature.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <FeatureIcon className="h-4 w-4 text-primary" />
                      </div>
                      <span>{feature.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {classData.classType && (
              <>
                <Separator />
                <div>
                  <h2 className="text-xl font-semibold mb-4">Class Category</h2>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        {classData.classType.name}
                      </CardTitle>
                      {classData.classType.description && (
                        <CardDescription>{classData.classType.description}</CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-2xl">
                  <span className="text-4xl font-bold">${pricing.price}</span>
                  <span className="text-lg text-muted-foreground ml-1">{pricing.period}</span>
                </CardTitle>
                <CardDescription>One-time enrollment fee</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Full access to all class materials</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>AI tutor conversation practice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Pronunciation feedback</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>Progress tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>ACTFL-aligned assessments</span>
                  </li>
                </ul>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleEnroll}
                  data-testid="button-enroll-class"
                >
                  {isAuthenticated ? 'Enroll Now' : 'Sign Up to Enroll'}
                </Button>
                
                {!isAuthenticated && (
                  <p className="text-sm text-center text-muted-foreground">
                    Already have an account?{' '}
                    <Link href={`/login?redirect=/classes/${classId}`}>
                      <span className="text-primary hover:underline cursor-pointer" data-testid="link-login">Log in</span>
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
