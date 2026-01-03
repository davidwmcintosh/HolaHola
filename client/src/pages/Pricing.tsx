import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Clock, BookOpen, Building2, ArrowLeft, Users, GraduationCap, Briefcase, Plane, Globe, Sparkles } from 'lucide-react';
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
  isFeatured: boolean;
  featuredOrder: number;
  targetActflLevel: string;
  expectedActflMin: string;
  classLevel: number;
}

interface PricingConfig {
  class_price_cents: string;
  hour_rate_cents: string;
  free_trial_hours: string;
  pack_5hr_discount_percent?: string;
  pack_10hr_discount_percent?: string;
}

function getHourPackages(hourRateCents: number, pack5hrDiscount: number = 0, pack10hrDiscount: number = 10) {
  const baseRate = hourRateCents / 100;
  const discount5hr = 1 - (pack5hrDiscount / 100);
  const discount10hr = 1 - (pack10hrDiscount / 100);
  
  return [
    {
      id: 'starter',
      name: 'Starter',
      hours: 5,
      price: Math.round(baseRate * 5 * discount5hr * 100) / 100,
      pricePerHour: Math.round(baseRate * discount5hr * 100) / 100,
      discount: pack5hrDiscount,
      description: 'Perfect for trying out self-directed learning',
      features: ['5 hours of AI tutor time', 'All 9 languages', 'Progress tracking', 'Never expires'],
    },
    {
      id: 'explorer',
      name: 'Explorer',
      hours: 10,
      price: Math.round(baseRate * 10 * discount10hr * 100) / 100,
      pricePerHour: Math.round(baseRate * discount10hr * 100) / 100,
      discount: pack10hrDiscount,
      description: 'Great for consistent weekly practice',
      features: ['10 hours of AI tutor time', 'All 9 languages', 'Pronunciation feedback', 'Progress tracking', 'Never expires'],
      popular: true,
    },
  ];
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

function getClassPrice(classPriceCents: number): { price: number; period: string } {
  return { price: classPriceCents / 100, period: '/class' };
}

function getLevelBadge(classLevel: number): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  switch (classLevel) {
    case 1: return { label: 'Beginner', variant: 'secondary' };
    case 2: return { label: 'Intermediate', variant: 'default' };
    case 3: return { label: 'Advanced', variant: 'outline' };
    case 4: return { label: 'Superior', variant: 'outline' };
    default: return { label: 'All Levels', variant: 'secondary' };
  }
}

export default function Pricing() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: pricingConfig } = useQuery<PricingConfig>({
    queryKey: ['/api/pricing-config'],
  });

  const { data: classTypes } = useQuery<ClassType[]>({
    queryKey: ['/api/class-types'],
  });

  const { data: publicClasses } = useQuery<PublicClass[]>({
    queryKey: ['/api/classes/public'],
  });

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

  const classPriceCents = parseInt(pricingConfig?.class_price_cents || '4900');
  const hourRateCents = parseInt(pricingConfig?.hour_rate_cents || '580');
  const pack5hrDiscount = parseInt(pricingConfig?.pack_5hr_discount_percent || '0');
  const pack10hrDiscount = parseInt(pricingConfig?.pack_10hr_discount_percent || '10');
  const hourPackages = getHourPackages(hourRateCents, pack5hrDiscount, pack10hrDiscount);
  const classPrice = getClassPrice(classPriceCents);

  const handleSelectClass = (classId: string) => {
    navigate(`/classes/${classId}`);
  };

  const handleSelectHours = (packageId: string) => {
    if (!isAuthenticated) {
      sessionStorage.setItem('selectedHourPackage', packageId);
      navigate('/signup');
      return;
    }
    navigate(`/checkout?package=${packageId}`);
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:sales@holahola.app?subject=Institutional%20Plan%20Inquiry';
  };

  const featuredClasses = publicClasses?.filter(c => c.isFeatured).sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0)) || [];
  const classesByType = classTypes?.reduce((acc, type) => {
    acc[type.id] = publicClasses?.filter(c => c.classTypeId === type.id) || [];
    return acc;
  }, {} as Record<string, PublicClass[]>) || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {isAuthenticated && (
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-6"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        )}

        <div className="text-center mb-10 md:mb-14">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-pricing-title">
            Learn Your Way
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose structured classes with expert-designed curricula, or practice independently with flexible hour packs.
          </p>
        </div>

        <Tabs defaultValue="classes" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="classes" className="gap-2" data-testid="tab-classes">
              <BookOpen className="h-4 w-4" />
              Classes
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-2" data-testid="tab-hours">
              <Clock className="h-4 w-4" />
              Self-Directed Hours
            </TabsTrigger>
          </TabsList>

          <TabsContent value="classes" className="space-y-10">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Structured courses designed by language education experts following ACTFL standards.
              </p>
              <Button variant="outline" onClick={() => navigate('/classes')} data-testid="button-browse-all-classes">
                <BookOpen className="h-4 w-4 mr-2" />
                Browse All Classes
              </Button>
            </div>

            {featuredClasses.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Featured Classes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredClasses.map((cls) => {
                    const level = getLevelBadge(cls.classLevel);
                    return (
                      <Card key={cls.id} className="relative border-primary/20 flex flex-col" data-testid={`card-class-${cls.id}`}>
                        <Badge className="absolute -top-2 -right-2" variant="default">Featured</Badge>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="h-5 w-5 text-primary" />
                            <Badge variant="outline">{getLanguageLabel(cls.language)}</Badge>
                            <Badge variant={level.variant}>{level.label}</Badge>
                          </div>
                          <CardTitle className="text-lg">{cls.name}</CardTitle>
                          <CardDescription className="line-clamp-2">{cls.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                          <div className="mb-3">
                            <span className="text-3xl font-bold">${classPrice.price}</span>
                            <span className="text-muted-foreground ml-1">{classPrice.period}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Target: {cls.expectedActflMin && cls.targetActflLevel 
                              ? `${getActflLabel(cls.expectedActflMin)} → ${getActflLabel(cls.targetActflLevel)}`
                              : getActflLabel(cls.targetActflLevel || 'novice_low')}
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            className="w-full"
                            onClick={() => handleSelectClass(cls.id)}
                            data-testid={`button-view-${cls.id}`}
                          >
                            View Details
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {publicClasses && publicClasses.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  All Classes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {publicClasses.map((cls) => {
                    const level = getLevelBadge(cls.classLevel);
                    return (
                      <Card key={cls.id} className="flex flex-col" data-testid={`card-class-${cls.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Globe className="h-5 w-5 text-primary" />
                            <Badge variant="outline">{getLanguageLabel(cls.language)}</Badge>
                            <Badge variant={level.variant}>{level.label}</Badge>
                          </div>
                          <CardTitle className="text-lg">{cls.name}</CardTitle>
                          <CardDescription className="line-clamp-2">{cls.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                          <div className="mb-3">
                            <span className="text-3xl font-bold">${classPrice.price}</span>
                            <span className="text-muted-foreground ml-1">{classPrice.period}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Target: {cls.expectedActflMin && cls.targetActflLevel 
                              ? `${getActflLabel(cls.expectedActflMin)} → ${getActflLabel(cls.targetActflLevel)}`
                              : getActflLabel(cls.targetActflLevel || 'novice_low')}
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => handleSelectClass(cls.id)}
                            data-testid={`button-view-${cls.id}`}
                          >
                            View Details
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {(!publicClasses || publicClasses.length === 0) && (
              <Card className="text-center py-12">
                <CardContent>
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Classes Coming Soon</h3>
                  <p className="text-muted-foreground mb-4">
                    We're preparing expert-designed courses. In the meantime, try our self-directed hours!
                  </p>
                  <Button onClick={() => (document.querySelector('[data-testid="tab-hours"]') as HTMLElement)?.click()}>
                    Explore Hour Packages
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="hours" className="space-y-8">
            <div className="text-center">
              <p className="text-muted-foreground">
                Practice on your own schedule. Choose topics freely and learn at your own pace.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {hourPackages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`relative flex flex-col ${pkg.popular ? 'border-primary shadow-lg scale-[1.02]' : ''}`}
                  data-testid={`card-hours-${pkg.id}`}
                >
                  {pkg.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
                      Best Value
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{pkg.name}</CardTitle>
                    <CardDescription>{pkg.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center flex-grow">
                    <div className="mb-2">
                      <span className="text-4xl font-bold">${pkg.price.toFixed(2)}</span>
                      {pkg.discount > 0 && (
                        <Badge variant="secondary" className="ml-2 text-green-600 dark:text-green-400">
                          {pkg.discount}% off
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-4">
                      {pkg.hours} hours (${pkg.pricePerHour.toFixed(2)}/hr)
                    </div>
                    <ul className="text-sm space-y-2 text-left">
                      {pkg.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={pkg.popular ? 'default' : 'outline'}
                      onClick={() => handleSelectHours(pkg.id)}
                      data-testid={`button-buy-${pkg.id}`}
                    >
                      Buy {pkg.hours} Hours
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <h3 className="font-semibold mb-2">How Self-Directed Hours Work</h3>
              <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
                Purchase hours and use them anytime for voice conversations with AI tutors across all 9 languages.
                Practice specific topics, prepare for trips, or maintain your skills. Hours never expire.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-16 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex p-3 rounded-full bg-primary/10 mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">For Schools & Institutions</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Bring HolaHola to your classroom with bulk pricing, teacher dashboards, student progress tracking,
              and custom syllabi aligned to your curriculum.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
              <div className="flex items-center gap-2 justify-center text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>Bulk student licenses</span>
              </div>
              <div className="flex items-center gap-2 justify-center text-sm">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span>Teacher dashboards</span>
              </div>
              <div className="flex items-center gap-2 justify-center text-sm">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Custom syllabi</span>
              </div>
            </div>
            <Button size="lg" onClick={handleContactSales} data-testid="button-contact-sales">
              Contact Sales
            </Button>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Questions about pricing?{' '}
            <a href="mailto:support@holahola.app" className="text-primary hover:underline">
              Contact our team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
