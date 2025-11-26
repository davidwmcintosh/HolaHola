import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useLogout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserCircle, Trash2, Globe, CreditCard, Crown, Sparkles, LogOut, Subtitles, CaptionsOff, Languages, Captions, Palette, Moon, Sun, Monitor, User as UserIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface Price {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string };
}

interface Product {
  id: string;
  name: string;
  description: string;
  active: boolean;
  prices: Price[];
}

interface BillingData {
  products: Product[];
}

interface Subscription {
  status: string;
  current_period_end: number;
  plan: { id: string; nickname: string; amount: number };
}

interface SubscriptionResponse {
  subscription: Subscription | null;
  tier: string;
  status: string;
}

export default function Settings() {
  const { user, isLoading: authLoading } = useAuth();
  const { userName, language, subtitleMode, setSubtitleMode } = useLanguage();
  const [isResetting, setIsResetting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [tutorGender, setTutorGender] = useState<"male" | "female">((user?.tutorGender as "male" | "female") || "female");
  const { toast } = useToast();
  const logoutMutation = useLogout();

  // Initialize tutor gender from user when loaded
  useEffect(() => {
    if (user?.tutorGender) {
      setTutorGender(user.tutorGender as "male" | "female");
    }
  }, [user?.tutorGender]);

  // Tutor gender update mutation
  const tutorGenderMutation = useMutation({
    mutationFn: async (gender: "male" | "female") => {
      return apiRequest("PUT", "/api/user/preferences", { tutorGender: gender });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Tutor preference updated",
        description: `Your tutor will now use a ${tutorGender} voice`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tutor preference",
        variant: "destructive",
      });
    },
  });

  const handleTutorGenderChange = (gender: "male" | "female") => {
    setTutorGender(gender);
    tutorGenderMutation.mutate(gender);
  };
  
  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme("system");
    }
  }, []);
  
  // Handle theme change
  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "system") {
      localStorage.removeItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      localStorage.setItem("theme", newTheme);
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    }
  };

  // Fetch billing products and prices
  const { data: billingData, isLoading: billingLoading } = useQuery<BillingData>({
    queryKey: ["/api/billing/products"],
  });

  // Fetch user's subscription
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/billing/subscription"],
    enabled: !!user,
  });

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const result = await apiRequest("POST", "/api/billing/checkout", { priceId }) as { url: string };
      return result;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  // Customer portal mutation
  const portalMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/billing/portal", {}) as { url: string };
      return result;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      const message = error.message || "Failed to open billing portal";
      const isStripeConfigError = message.includes("not configured") || message.includes("503");
      toast({
        title: "Error",
        description: isStripeConfigError 
          ? "Billing service is not configured. Please contact support."
          : message,
        variant: "destructive",
      });
    },
  });


  const handleResetProfile = () => {
    setIsResetting(true);
    // Clear all localStorage data
    localStorage.clear();
    // Reload the page to reset the app state
    window.location.href = "/";
  };

  const languageNames: Record<string, string> = {
    spanish: "Spanish",
    french: "French",
    german: "German",
    italian: "Italian",
    portuguese: "Portuguese",
    japanese: "Japanese",
    mandarin: "Mandarin Chinese",
    korean: "Korean"
  };

  const subscription = subscriptionData?.subscription;
  const currentTier = subscriptionData?.tier === 'free' ? 'Free' : 
                      subscriptionData?.tier === 'basic' ? 'Basic' :
                      subscriptionData?.tier === 'pro' ? 'Pro' :
                      subscriptionData?.tier === 'institutional' ? 'Institutional' : 'Free';

  // Helper to get first price for a product
  const getPriceForProduct = (product: Product) => {
    return product.prices && product.prices.length > 0 ? product.prices[0] : null;
  };

  // Helper to format price
  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account, subscription, and preferences</p>
        </div>

        {/* Account Information */}
        <Card data-testid="card-account-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p className="text-lg" data-testid="text-account-name">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : userName || "Not set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-lg" data-testid="text-account-email">{user?.email || "Not set"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Learning Language</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary" data-testid="badge-learning-language">
                        {languageNames[language] || language}
                      </Badge>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
            </Button>
          </CardFooter>
        </Card>

        {/* Voice Settings */}
        <Card data-testid="card-voice-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Subtitles className="h-5 w-5" />
              Voice Settings
            </CardTitle>
            <CardDescription>Customize your voice learning experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="subtitles-select" className="text-base">Subtitles</Label>
                <p className="text-sm text-muted-foreground">
                  Show text as the tutor speaks to help you follow along
                </p>
              </div>
              <Select
                value={subtitleMode}
                onValueChange={(value) => setSubtitleMode(value as "off" | "target" | "all")}
              >
                <SelectTrigger className="w-40" id="subtitles-select" data-testid="select-subtitles">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off" data-testid="select-subtitles-off">
                    <div className="flex items-center gap-2">
                      <CaptionsOff className="h-4 w-4" />
                      <span>Off</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="target" data-testid="select-subtitles-target">
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4" />
                      <span>Target Only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="all" data-testid="select-subtitles-all">
                    <div className="flex items-center gap-2">
                      <Captions className="h-4 w-4" />
                      <span>All Words</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="tutor-gender-select" className="text-base">Tutor Voice</Label>
                <p className="text-sm text-muted-foreground">
                  Choose a male or female tutor voice for your conversations
                </p>
              </div>
              <Select
                value={tutorGender}
                onValueChange={(value) => handleTutorGenderChange(value as "male" | "female")}
                disabled={tutorGenderMutation.isPending}
              >
                <SelectTrigger className="w-40" id="tutor-gender-select" data-testid="select-tutor-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female" data-testid="select-tutor-female">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      <span>Female</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="male" data-testid="select-tutor-male">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      <span>Male</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card data-testid="card-appearance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel of the app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="theme-select" className="text-base">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose between light, dark, or system theme
                </p>
              </div>
              <Select
                value={theme}
                onValueChange={(value) => handleThemeChange(value as "light" | "dark" | "system")}
              >
                <SelectTrigger className="w-40" id="theme-select" data-testid="select-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light" data-testid="select-theme-light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      <span>Light</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark" data-testid="select-theme-dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      <span>Dark</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="system" data-testid="select-theme-system">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      <span>System</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <Card data-testid="card-subscription">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>Manage your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptionLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
                    <div className="flex items-center gap-2 mt-1">
                      {currentTier === 'Pro' && <Crown className="h-4 w-4 text-amber-500" />}
                      {currentTier === 'Institutional' && <Sparkles className="h-4 w-4 text-purple-500" />}
                      <p className="text-2xl font-bold" data-testid="text-subscription-tier">{currentTier}</p>
                    </div>
                  </div>
                  {subscription && subscription.status === 'active' && (
                    <Badge variant="default" data-testid="badge-subscription-status">Active</Badge>
                  )}
                </div>

                {subscription && subscription.status === 'active' && subscription.current_period_end && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Renews {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {currentTier === 'Free' && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      You're on the Free plan with 10 AI conversations per month. Upgrade to get unlimited access and more features.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            {subscription && subscription.status === 'active' ? (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-subscription"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {portalMutation.isPending ? "Loading..." : "Manage Subscription"}
              </Button>
            ) : currentTier === 'Free' ? (
              <div className="w-full">
                <p className="text-sm font-medium mb-3">Upgrade to unlock more features:</p>
                {billingLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : billingData?.products && billingData.products.length > 0 ? (
                  <>
                    <div className="grid gap-2">
                      {billingData.products
                        .filter(p => p.active)
                        .map(product => {
                          const price = getPriceForProduct(product);
                          const hasValidPrice = price && price.unit_amount > 0;
                          if (!hasValidPrice) {
                            console.warn(`No valid price found for product ${product.name}`);
                          }
                          const isProTier = product.name.toLowerCase().includes('pro');
                          return (
                            <Button
                              key={product.id}
                              variant="default"
                              onClick={() => hasValidPrice && checkoutMutation.mutate(price.id)}
                              disabled={!hasValidPrice || checkoutMutation.isPending}
                              data-testid={`button-upgrade-${product.name.toLowerCase().replace(/\s+/g, '-')}`}
                              className="w-full justify-between"
                            >
                              <span className="flex items-center gap-2">
                                {isProTier && <Crown className="h-4 w-4" />}
                                {product.name}
                              </span>
                              {hasValidPrice ? (
                                <span className="font-semibold">
                                  {formatPrice(price.unit_amount, price.currency)}/month
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Unavailable</span>
                              )}
                            </Button>
                          );
                        })}
                    </div>
                    {checkoutMutation.isError && (
                      <p className="text-sm text-destructive mt-2">
                        Failed to start checkout. Please try again or contact support.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No subscription plans available at this time.</p>
                )}
              </div>
            ) : null}
          </CardFooter>
        </Card>

        {/* Reset Profile */}
        <Card data-testid="card-reset-profile">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Reset Profile
            </CardTitle>
            <CardDescription>
              Clear all your profile data and start fresh
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This will clear your name, language preference, and all saved conversations. 
              Your vocabulary and progress data will remain unchanged.
            </p>
          </CardContent>
          <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={isResetting}
                  data-testid="button-reset-profile"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isResetting ? "Resetting..." : "Reset Profile"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear your profile information (name and language preference) 
                    and you'll go through the onboarding process again. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetProfile}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-reset"
                  >
                    Reset Profile
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
