import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Globe, GraduationCap, Briefcase, Plane, Search, Sparkles, ArrowLeft, Filter } from 'lucide-react';
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
  };
  return labels[language.toLowerCase()] || language;
}

function getClassPrice(classPriceCents: number): { price: number; period: string } {
  return { price: classPriceCents / 100, period: '/class' };
}

function getLevelBadge(classLevel: number): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  switch (classLevel) {
    case 1: return { label: 'Beginner', variant: 'secondary' };
    case 2: return { label: 'Intermediate', variant: 'outline' };
    case 3: return { label: 'Advanced', variant: 'default' };
    case 4: return { label: 'Superior', variant: 'default' };
    default: return { label: 'All Levels', variant: 'secondary' };
  }
}

const LANGUAGES = [
  { value: 'all', label: 'All Languages' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'italian', label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'mandarin chinese', label: 'Mandarin' },
  { value: 'english', label: 'English' },
  { value: 'hebrew', label: 'Hebrew' },
];

const LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: '1', label: 'Beginner' },
  { value: '2', label: 'Intermediate' },
  { value: '3', label: 'Advanced' },
  { value: '4', label: 'Superior' },
];

export default function Classes() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  const { data: pricingConfig } = useQuery<PricingConfig>({
    queryKey: ['/api/pricing-config'],
  });

  const { data: publicClasses, isLoading } = useQuery<PublicClass[]>({
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

  const classPriceCents = parseInt(pricingConfig?.class_price_cents || '25000');
  const classPrice = getClassPrice(classPriceCents);

  const featuredClasses = publicClasses?.filter(c => c.isFeatured)
    .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0)) || [];

  const filteredClasses = publicClasses?.filter(cls => {
    const matchesSearch = !searchQuery || 
      cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLanguage = languageFilter === 'all' || cls.language.toLowerCase() === languageFilter;
    const matchesLevel = levelFilter === 'all' || cls.classLevel === parseInt(levelFilter);
    return matchesSearch && matchesLanguage && matchesLevel;
  }) || [];

  const handleViewClass = (classId: string) => {
    setLocation(`/classes/${classId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-page-title">
              Find Your Perfect Class
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Browse our expert-designed language courses. Each class follows ACTFL standards 
              and includes AI-powered conversation practice with native-speaking tutors.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 max-w-3xl mx-auto mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-classes"
              />
            </div>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-language-filter">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-level-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map(lvl => (
                  <SelectItem key={lvl.value} value={lvl.value}>{lvl.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Loading classes...</p>
            </div>
          </div>
        ) : (
          <>
            {featuredClasses.length > 0 && !searchQuery && languageFilter === 'all' && levelFilter === 'all' && (
              <div className="mb-12">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Featured Classes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredClasses.map((cls) => {
                    const level = getLevelBadge(cls.classLevel);
                    return (
                      <Card key={cls.id} className="relative border-primary/20 flex flex-col hover-elevate" data-testid={`card-featured-class-${cls.id}`}>
                        <Badge className="absolute -top-2 -right-2" variant="default">Featured</Badge>
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
                            className="w-full"
                            onClick={() => handleViewClass(cls.id)}
                            data-testid={`button-view-featured-${cls.id}`}
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

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {searchQuery || languageFilter !== 'all' || levelFilter !== 'all' 
                    ? `${filteredClasses.length} Classes Found`
                    : 'All Classes'
                  }
                </h2>
              </div>

              {filteredClasses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClasses.map((cls) => {
                    const level = getLevelBadge(cls.classLevel);
                    const Icon = cls.classType?.icon ? getIcon(cls.classType.icon) : BookOpen;
                    return (
                      <Card key={cls.id} className="flex flex-col hover-elevate" data-testid={`card-class-${cls.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Icon className="h-5 w-5 text-primary" />
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
                            onClick={() => handleViewClass(cls.id)}
                            data-testid={`button-view-class-${cls.id}`}
                          >
                            View Details
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Classes Found</h3>
                    <p className="text-muted-foreground mb-4">
                      Try adjusting your filters or search query.
                    </p>
                    <Button variant="outline" onClick={() => {
                      setSearchQuery('');
                      setLanguageFilter('all');
                      setLevelFilter('all');
                    }} data-testid="button-clear-filters">
                      Clear Filters
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        <div className="mt-16 text-center">
          <Card className="bg-muted/50 p-8">
            <CardContent className="space-y-4">
              <h3 className="text-xl font-semibold">Prefer Self-Directed Learning?</h3>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Practice at your own pace with our AI tutors. Purchase hours and use them anytime, 
                across all 9 languages.
              </p>
              <Link href="/pricing">
                <Button variant="outline" data-testid="button-view-hours">
                  View Hour Packages
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
