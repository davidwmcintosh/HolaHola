import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Zap, Star, Gift, Check, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface HourPackage {
  tier: string;
  hours: number;
  priceUsd: number;
  name: string;
  productId: string;
  pricePerHour: number;
}

interface HourPackagesResponse {
  packages: HourPackage[];
}

const TIER_ICONS: Record<string, typeof Clock> = {
  try_it: Gift,
  starter: Zap,
  regular: Star,
  committed: Sparkles,
};

const TIER_COLORS: Record<string, string> = {
  try_it: 'border-muted-foreground/20',
  starter: 'border-blue-500/20',
  regular: 'border-green-500/20',
  committed: 'border-purple-500/30',
};

const TIER_HIGHLIGHTS: Record<string, string> = {
  try_it: '',
  starter: '',
  regular: 'ring-2 ring-green-500/30',
  committed: 'ring-2 ring-purple-500/30',
};

const TIER_BADGES: Record<string, { text: string; variant: 'default' | 'secondary' | 'outline' } | null> = {
  try_it: null,
  starter: null,
  regular: { text: 'Most Popular', variant: 'default' },
  committed: { text: 'Best Value', variant: 'secondary' },
};

export function HourPackageShop() {
  const { toast } = useToast();
  
  const { data, isLoading, error } = useQuery<HourPackagesResponse>({
    queryKey: ['/api/billing/hour-packages'],
  });
  
  const purchaseMutation = useMutation({
    mutationFn: async (packageTier: string) => {
      const response = await apiRequest('POST', '/api/billing/hour-packages/checkout', { packageTier });
      return response as { url: string };
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Error",
        description: error.message || "Unable to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-20 mb-4" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }
  
  if (error || !data?.packages) {
    return (
      <Card className="text-center py-8">
        <CardContent>
          <p className="text-muted-foreground">Unable to load hour packages. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Purchase Tutoring Hours</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Add hours to your account for personalized AI tutoring sessions. 
          Hours never expire and work across all supported languages.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.packages.map((pkg) => {
          const Icon = TIER_ICONS[pkg.tier] || Clock;
          const badge = TIER_BADGES[pkg.tier];
          
          return (
            <Card 
              key={pkg.tier}
              className={`relative overflow-hidden transition-all hover-elevate ${TIER_COLORS[pkg.tier]} ${TIER_HIGHLIGHTS[pkg.tier]}`}
              data-testid={`card-package-${pkg.tier}`}
            >
              {badge && (
                <Badge 
                  variant={badge.variant}
                  className="absolute top-2 right-2 text-xs"
                  data-testid={`badge-package-${pkg.tier}`}
                >
                  {badge.text}
                </Badge>
              )}
              
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-muted">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                </div>
                <CardDescription>
                  {pkg.hours} hour{pkg.hours > 1 ? 's' : ''} of tutoring
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">${pkg.priceUsd}</div>
                  <div className="text-sm text-muted-foreground">
                    ${pkg.pricePerHour.toFixed(2)}/hour
                  </div>
                </div>
                
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>All 9 languages</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Voice conversations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Never expires</span>
                  </li>
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full gap-2"
                  onClick={() => purchaseMutation.mutate(pkg.tier)}
                  disabled={purchaseMutation.isPending}
                  data-testid={`button-purchase-${pkg.tier}`}
                >
                  {purchaseMutation.isPending ? (
                    "Processing..."
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      
      <div className="text-center text-sm text-muted-foreground">
        <p>Secure payment powered by Stripe. 70-80% cheaper than human tutors.</p>
      </div>
    </div>
  );
}

export function CompactHourPackages() {
  const { toast } = useToast();
  
  const { data, isLoading } = useQuery<HourPackagesResponse>({
    queryKey: ['/api/billing/hour-packages'],
  });
  
  const purchaseMutation = useMutation({
    mutationFn: async (packageTier: string) => {
      const response = await apiRequest('POST', '/api/billing/hour-packages/checkout', { packageTier });
      return response as { url: string };
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Unable to start checkout",
        variant: "destructive",
      });
    },
  });
  
  if (isLoading || !data?.packages) {
    return null;
  }
  
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10" data-testid="card-compact-packages">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Add More Hours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {data.packages.slice(0, 2).map((pkg) => (
            <Button
              key={pkg.tier}
              variant="outline"
              size="sm"
              className="justify-between"
              onClick={() => purchaseMutation.mutate(pkg.tier)}
              disabled={purchaseMutation.isPending}
              data-testid={`button-quick-${pkg.tier}`}
            >
              <span>{pkg.hours}h</span>
              <span className="text-muted-foreground">${pkg.priceUsd}</span>
            </Button>
          ))}
        </div>
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={() => window.location.href = '/settings?tab=billing'}
          data-testid="button-view-all-packages"
        >
          View All Packages
        </Button>
      </CardContent>
    </Card>
  );
}
