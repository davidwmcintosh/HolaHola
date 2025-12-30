import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Sparkles, Zap, Crown, Building2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface PlanFeature {
  name: string;
  free: boolean | string;
  basic: boolean | string;
  pro: boolean | string;
  institutional: boolean | string;
}

const features: PlanFeature[] = [
  { name: 'Voice conversations per month', free: '20', basic: '100', pro: 'Unlimited', institutional: 'Unlimited' },
  { name: 'AI Tutor access', free: true, basic: true, pro: true, institutional: true },
  { name: 'All 9 languages', free: true, basic: true, pro: true, institutional: true },
  { name: 'Vocabulary builder', free: true, basic: true, pro: true, institutional: true },
  { name: 'Grammar exercises', free: true, basic: true, pro: true, institutional: true },
  { name: 'Cultural tips', free: true, basic: true, pro: true, institutional: true },
  { name: 'Progress tracking', free: true, basic: true, pro: true, institutional: true },
  { name: 'ACTFL assessments', free: 'Basic', basic: 'Full', pro: 'Full + Reports', institutional: 'Full + Analytics' },
  { name: 'Pronunciation feedback', free: false, basic: true, pro: true, institutional: true },
  { name: 'Personalized learning path', free: false, basic: true, pro: true, institutional: true },
  { name: 'Priority AI response', free: false, basic: false, pro: true, institutional: true },
  { name: 'Advanced voice models', free: false, basic: false, pro: true, institutional: true },
  { name: 'Class management', free: false, basic: false, pro: false, institutional: true },
  { name: 'Student analytics', free: false, basic: false, pro: false, institutional: true },
  { name: 'Bulk hour packages', free: false, basic: false, pro: false, institutional: true },
  { name: 'Custom syllabus builder', free: false, basic: false, pro: false, institutional: true },
];

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: '$0',
    period: 'forever',
    icon: Sparkles,
    highlight: false,
    cta: 'Get Started',
    ctaVariant: 'outline' as const,
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'For regular learners',
    price: '$9',
    period: '/month',
    icon: Zap,
    highlight: false,
    cta: 'Start Basic',
    ctaVariant: 'outline' as const,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious language learners',
    price: '$19',
    period: '/month',
    icon: Crown,
    highlight: true,
    cta: 'Go Pro',
    ctaVariant: 'default' as const,
    badge: 'Most Popular',
  },
  {
    id: 'institutional',
    name: 'Institutional',
    description: 'For schools & organizations',
    price: 'Custom',
    period: 'pricing',
    icon: Building2,
    highlight: false,
    cta: 'Contact Sales',
    ctaVariant: 'outline' as const,
  },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-5 w-5 text-green-500" />
    ) : (
      <X className="h-5 w-5 text-muted-foreground/40" />
    );
  }
  return <span className="text-sm font-medium">{value}</span>;
}

export default function Pricing() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const currentTier = user?.subscriptionTier || 'free';

  const handleSelectPlan = (planId: string) => {
    if (planId === 'institutional') {
      window.location.href = 'mailto:sales@holahola.app?subject=Institutional%20Plan%20Inquiry';
      return;
    }

    if (!isAuthenticated) {
      sessionStorage.setItem('selectedPlan', planId);
      navigate('/signup');
      return;
    }

    if (planId === 'free') {
      navigate('/');
      return;
    }

    navigate(`/checkout?plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Back button for authenticated users */}
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

        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-pricing-title">
            Choose Your Learning Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade anytime. All plans include access to our AI tutors across 9 languages.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = isAuthenticated && currentTier === plan.id;
            
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.highlight
                    ? 'border-primary shadow-lg scale-[1.02]'
                    : ''
                } ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.badge && (
                  <Badge
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                    variant="default"
                  >
                    {plan.badge}
                  </Badge>
                )}
                {isCurrentPlan && (
                  <Badge
                    className="absolute -top-3 right-4"
                    variant="secondary"
                  >
                    Current Plan
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center flex-grow">
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.ctaVariant}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan}
                    data-testid={`button-select-${plan.id}`}
                  >
                    {isCurrentPlan ? 'Current Plan' : plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold" data-testid="text-compare-features">
              Compare Features
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-features">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Feature</th>
                  <th className="text-center p-4 font-medium min-w-[100px]">Free</th>
                  <th className="text-center p-4 font-medium min-w-[100px]">Basic</th>
                  <th className="text-center p-4 font-medium min-w-[100px] bg-primary/5">Pro</th>
                  <th className="text-center p-4 font-medium min-w-[100px]">Institutional</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <tr
                    key={feature.name}
                    className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                    data-testid={`row-feature-${index}`}
                  >
                    <td className="p-4 text-sm">{feature.name}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <FeatureValue value={feature.free} />
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <FeatureValue value={feature.basic} />
                      </div>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <FeatureValue value={feature.pro} />
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <FeatureValue value={feature.institutional} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Questions about our plans?{' '}
            <a href="mailto:support@holahola.app" className="text-primary hover:underline">
              Contact our team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
