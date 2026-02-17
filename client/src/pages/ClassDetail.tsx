import { Link, useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  ArrowLeft, BookOpen, Globe, GraduationCap, Briefcase, Plane, 
  Check, Clock, Users, Target, MessageCircle, Mic, Award, Loader2, Volume2,
  ChevronRight
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
  expectedActflMin: string;
  classLevel: number;
  syllabus?: {
    pathId: string;
    units: Array<{
      id: string;
      name: string;
      description: string;
      orderIndex: number;
      actflLevel?: string;
      estimatedHours?: number;
      lessons: Array<{
        id: string;
        name: string;
        description: string;
        lessonType: string;
        estimatedMinutes?: number;
        drillCount?: number;
        drillType?: string;
        linkedDrillLessonId?: string;
        bundleId?: string;
      }>;
    }>;
  };
}

interface PricingConfig {
  class_price_cents: string;
  hour_rate_cents: string;
  free_trial_hours: string;
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
    hebrew: 'Hebrew',
  };
  return labels[language.toLowerCase()] || language;
}

function getClassPrice(classPriceCents: number): { price: number; period: string } {
  return { price: classPriceCents / 100, period: '/class' };
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

function getClassFeatures(className: string, language: string) {
  const features = [
    { icon: MessageCircle, text: 'AI-powered conversation practice' },
    { icon: Mic, text: 'Real-time pronunciation feedback' },
    { icon: Target, text: 'ACTFL-aligned curriculum' },
    { icon: Award, text: 'Progress tracking & assessments' },
  ];

  if (className.toLowerCase().includes('pronunciation')) {
    features.push({ icon: Volume2, text: 'Deep voice analysis' });
    features.push({ icon: Award, text: 'Accent reduction' });
  } else if (className.toLowerCase().includes('business')) {
    features.push({ icon: Users, text: 'Professional etiquette' });
    features.push({ icon: Globe, text: 'Workplace vocabulary' });
  } else {
    features.push({ icon: Users, text: `Native ${language} AI tutors` });
    features.push({ icon: Clock, text: 'Flexible scheduling' });
  }
  return features;
}

export default function ClassDetail() {
  const [, params] = useRoute('/classes/:id');
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const classId = params?.id;

  const { data: pricingConfig } = useQuery<PricingConfig>({
    queryKey: ['/api/pricing-config'],
  });

  const { data: classData, isLoading } = useQuery<PublicClass>({
    queryKey: ['/api/classes/public', classId],
    enabled: !!classId,
  });
  
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

  const getActflLabel = (level: string) => {
    const labels: Record<string, string> = {
      novice_low: "Novice Low",
      novice_mid: "Novice Mid",
      novice_high: "Novice High",
      intermediate_low: "Intermediate Low",
      intermediate_mid: "Intermediate Mid",
      intermediate_high: "Intermediate High",
      advanced_low: "Advanced Low",
      advanced_mid: "Advanced Mid",
      advanced_high: "Advanced High",
      superior: "Superior",
      distinguished: "Distinguished",
    };
    return labels[level] || level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const level = getLevelBadge(classData.classLevel);
  const pricing = getClassPrice(parseInt(pricingConfig?.class_price_cents || '4900'));
  const Icon = classData.classType?.icon ? getIcon(classData.classType.icon) : BookOpen;

  const classSpecificFeatures = getClassFeatures(classData.name, getLanguageLabel(classData.language));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 md:px-8">
        <Link href="/classes">
          <Button variant="ghost" size="sm" className="mb-8" data-testid="button-back-classes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Classes
          </Button>
        </Link>

        <div className="space-y-8">
          <div className="space-y-6">
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
                    <p className="font-medium">
                      {classData.expectedActflMin && classData.targetActflLevel 
                        ? `${getActflLabel(classData.expectedActflMin)} → ${getActflLabel(classData.targetActflLevel)}`
                        : getActflLabel(classData.targetActflLevel || 'novice_low')}
                    </p>
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
                {classSpecificFeatures.map((feature, index) => {
                  const FeatureIcon = feature.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <FeatureIcon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm">{feature.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {classData.syllabus && classData.syllabus.units.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-xl font-semibold mb-4">Syllabus Curriculum</h2>
                  <p className="text-muted-foreground mb-6">
                    This class follows a structured curriculum designed to take you from {level.label.toLowerCase()} to fluent communication.
                  </p>
                  
                  <Accordion type="single" collapsible className="w-full space-y-4">
                    {classData.syllabus.units.map((unit, index) => (
                      <AccordionItem key={unit.id} value={unit.id} className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-4 text-left">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="font-bold text-primary">{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-base">{unit.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {unit.estimatedHours && (
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {unit.estimatedHours} hours
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {unit.lessons.length} lessons
                                </span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-2 border-t bg-muted/20">
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {unit.description}
                            </p>
                            
                            <div className="space-y-2">
                              {unit.lessons.map((lesson, lIndex) => (
                                <div key={lesson.id} className="flex items-start gap-3 p-3 rounded-md bg-background border">
                                  <div className="mt-1">
                                    <div className="h-5 w-5 rounded-full border-2 border-primary/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-muted-foreground">{lIndex + 1}</span>
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <p className="text-sm font-medium truncate">{lesson.name}</p>
                                      <div className="flex gap-1">
                                        {lesson.drillType ? (
                                          <Badge variant="outline" className="text-[10px] h-4 shrink-0 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 capitalize">
                                            {lesson.drillType.replace(/_/g, ' ')}
                                          </Badge>
                                        ) : (
                                          lesson.lessonType === 'drill' ? (
                                            <Badge variant="outline" className="text-[10px] h-4 shrink-0 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                                              Drill
                                            </Badge>
                                          ) : null
                                        )}
                                        <Badge variant="secondary" className="text-[10px] h-4 shrink-0 capitalize">
                                          {lesson.lessonType.replace('_', ' ')}
                                        </Badge>
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {lesson.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </>
            )}

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

          <div className="pt-8">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-2xl">
                  <span className="text-4xl font-bold">${pricing.price}</span>
                  <span className="text-lg text-muted-foreground ml-1">{pricing.period}</span>
                </CardTitle>
                <CardDescription>One-time enrollment fee</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">Full access to all class materials</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">AI tutor conversation practice</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">Pronunciation feedback</span>
                    </li>
                  </ul>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">Progress tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">ACTFL-aligned assessments</span>
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-4">
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
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
