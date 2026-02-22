import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useLogout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserCircle, Trash2, Globe, CreditCard, Crown, Sparkles, LogOut, Palette, Moon, Sun, Monitor, GraduationCap, AlertTriangle, CheckCircle2, Loader2, BookOpen, Users, Clock, ArrowDownCircle, ArrowUpCircle, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface LanguagePreferencesData {
  language: string;
  preferences: {
    selfDirectedFlexibility: string;
    selfDirectedPlacementDone: boolean;
  } | null;
  hasClassEnrollment: boolean;
  hasActflLevel: boolean;
  actflLevel: string | null;
  eligibleForPlacement: boolean;
  smartDefault: string;
  effectiveFlexibility: string;
  placementDone: boolean;
}

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

interface HourPackage {
  tier: string;
  hours: number;
  priceUsd: number;
  name: string;
  productId: string;
  pricePerHour: number;
}

interface InstitutionalPackage {
  tier: string;
  hoursPerStudent: number;
  pricePerStudentUsd: number;
  name: string;
  productId: string;
  pricePerHour: number;
}

interface TeacherClass {
  id: string;
  name: string;
  language: string;
  enrolledCount?: number;
}

export default function Settings() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { userName, language } = useLanguage();
  const [isResetting, setIsResetting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [selectedPrefLanguage, setSelectedPrefLanguage] = useState<string>(language || "spanish");
  const [selfDirectedFlexibility, setSelfDirectedFlexibility] = useState<string>("flexible_goals");
  const [isRunningPlacement, setIsRunningPlacement] = useState(false);
  const [selectedClassForPackage, setSelectedClassForPackage] = useState<string>("");
  const [selectedPackageTier, setSelectedPackageTier] = useState<string>("");
  const [studentCount, setStudentCount] = useState<number>(1);
  const { toast } = useToast();
  const logoutMutation = useLogout();

  // Initialize selected language from current language context
  useEffect(() => {
    if (language) {
      setSelectedPrefLanguage(language);
    }
  }, [language]);

  // Fetch user's languages (ones they have progress in)
  const { data: userLanguagesData } = useQuery<{ languages: string[] }>({
    queryKey: ["/api/user/languages"],
    enabled: !!user,
  });

  // Fetch language-specific preferences for selected language
  const { data: langPrefsData, isLoading: langPrefsLoading } = useQuery<LanguagePreferencesData>({
    queryKey: ["/api/user/language-preferences", selectedPrefLanguage],
    enabled: !!user && !!selectedPrefLanguage,
  });

  // Sync local flexibility state with fetched data
  useEffect(() => {
    if (langPrefsData?.effectiveFlexibility) {
      setSelfDirectedFlexibility(langPrefsData.effectiveFlexibility);
    }
  }, [langPrefsData?.effectiveFlexibility]);

  // Self-directed flexibility update mutation (per-language)
  const flexibilityMutation = useMutation({
    mutationFn: async (flexibility: string) => {
      return apiRequest("PUT", `/api/user/language-preferences/${selectedPrefLanguage}`, { 
        selfDirectedFlexibility: flexibility 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/language-preferences", selectedPrefLanguage] });
      toast({
        title: "Learning style updated",
        description: `Your self-directed tutor style for ${languageNames[selectedPrefLanguage] || selectedPrefLanguage} has been saved`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update learning style",
        variant: "destructive",
      });
    },
  });

  const handleFlexibilityChange = (flexibility: string) => {
    setSelfDirectedFlexibility(flexibility);
    flexibilityMutation.mutate(flexibility);
  };

  // Native language state and mutation
  const [nativeLanguage, setNativeLanguage] = useState<string>(user?.nativeLanguage || "english");
  
  useEffect(() => {
    if (user?.nativeLanguage) {
      setNativeLanguage(user.nativeLanguage);
    }
  }, [user?.nativeLanguage]);

  const nativeLanguageMutation = useMutation({
    mutationFn: async (newNativeLanguage: string) => {
      return apiRequest("PUT", "/api/user/preferences", { nativeLanguage: newNativeLanguage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Native language updated",
        description: "Your explanations will now be in your preferred language",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update native language",
        variant: "destructive",
      });
    },
  });

  const handleNativeLanguageChange = (newLang: string) => {
    setNativeLanguage(newLang);
    nativeLanguageMutation.mutate(newLang);
  };

  // Language-specific eligibility comes from the API now
  const isEligibleForPlacement = langPrefsData?.eligibleForPlacement ?? false;
  const recommendedFlexibility = langPrefsData?.smartDefault || 'flexible_goals';
  const isUsingRecommended = selfDirectedFlexibility === recommendedFlexibility;

  // Build list of languages for the selector
  // Combine user's practiced languages with all available languages
  const allLanguages = ['spanish', 'french', 'german', 'italian', 'portuguese', 'japanese', 'mandarin', 'korean', 'english', 'hebrew'];
  const userLanguages = userLanguagesData?.languages || [];
  const availableLanguages = Array.from(new Set([...userLanguages, ...allLanguages]));
  
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

  // Fetch hour packages for purchase
  const { data: hourPackagesData, isLoading: hourPackagesLoading } = useQuery<{ packages: HourPackage[] }>({
    queryKey: ["/api/billing/hour-packages"],
  });
  const hourPackages = hourPackagesData?.packages;

  // Usage report filter state
  const [usageStartDate, setUsageStartDate] = useState<string>('');
  const [usageEndDate, setUsageEndDate] = useState<string>('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'credits' | 'debits'>('all');

  // Fetch credit balance and usage history
  const { data: balanceData, isLoading: balanceLoading } = useQuery<{
    remainingSeconds: number;
    remainingHours: number;
    purchasedSeconds: number;
    classAllocationSeconds: number;
    bonusSeconds: number;
    warningLevel: string;
  }>({
    queryKey: ["/api/usage/balance"],
    enabled: !!user,
  });

  const usageQueryParams = new URLSearchParams();
  if (usageStartDate) usageQueryParams.set('startDate', usageStartDate);
  if (usageEndDate) usageQueryParams.set('endDate', new Date(usageEndDate + 'T23:59:59').toISOString());
  const usageQueryString = usageQueryParams.toString();

  const { data: usageHistoryData, isLoading: usageHistoryLoading } = useQuery<{
    history: Array<{
      id: string;
      creditSeconds: number;
      entitlementType: string;
      description: string | null;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/usage/history", usageStartDate, usageEndDate],
    queryFn: () => fetch(`/api/usage/history${usageQueryString ? `?${usageQueryString}` : ''}`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!user,
  });

  // Fetch institutional packages for teachers
  const { data: institutionalPackagesData, isLoading: institutionalPackagesLoading } = useQuery<{ packages: InstitutionalPackage[] }>({
    queryKey: ["/api/billing/institutional-packages"],
  });
  const institutionalPackages = institutionalPackagesData?.packages;

  // Fetch teacher's classes (for class package purchase)
  const { data: teacherClasses } = useQuery<TeacherClass[]>({
    queryKey: ["/api/teacher/classes"],
    enabled: !!user,
  });

  // Checkout mutation for subscriptions
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

  // Hour package checkout mutation
  const hourPackageCheckoutMutation = useMutation({
    mutationFn: async (tier: string) => {
      const result = await apiRequest("POST", "/api/billing/hour-packages/checkout", { tier }) as { url: string };
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

  // Institutional package checkout mutation (for teachers buying class packages)
  const institutionalCheckoutMutation = useMutation({
    mutationFn: async ({ packageTier, studentCount, classId }: { packageTier: string; studentCount: number; classId: string }) => {
      const result = await apiRequest("POST", "/api/billing/institutional-packages/checkout", { 
        packageTier, 
        studentCount, 
        classId 
      }) as { url: string };
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
    korean: "Korean",
    english: "English",
    hebrew: "Hebrew"
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-settings-title">Account</h1>
            <p className="text-muted-foreground mt-1">Manage your account, usage, and preferences</p>
          </div>
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
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Native Language</p>
                    <p className="text-xs text-muted-foreground">
                      Used for explanations and translations
                    </p>
                  </div>
                  <Select
                    value={nativeLanguage}
                    onValueChange={handleNativeLanguageChange}
                    disabled={nativeLanguageMutation.isPending}
                  >
                    <SelectTrigger className="w-40" data-testid="select-native-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'japanese', 'mandarin', 'korean', 'hebrew'].map((lang) => (
                        <SelectItem key={lang} value={lang} data-testid={`select-native-${lang}`}>
                          <span className="capitalize">{languageNames[lang] || lang}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

        {/* Self-Directed Tutor Style - Hidden per design update (moved to join-class page) */}
        {false && <Card data-testid="card-self-directed-style">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Self-Directed Tutor Style
            </CardTitle>
            <CardDescription>
              How your AI tutor behaves during personal practice sessions (not class assignments)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language selector - preferences are per language */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="pref-language-select" className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Configure for Language
                </Label>
                <p className="text-sm text-muted-foreground">
                  Settings are saved separately for each language you practice
                </p>
              </div>
              <Select
                value={selectedPrefLanguage}
                onValueChange={setSelectedPrefLanguage}
              >
                <SelectTrigger className="w-48" id="pref-language-select" data-testid="select-pref-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang} data-testid={`select-lang-${lang}`}>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>{languageNames[lang] || lang}</span>
                        {userLanguages.includes(lang) && (
                          <Badge variant="outline" className="ml-1 text-xs py-0 px-1">practiced</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Loading state for language preferences */}
            {langPrefsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <>
                {/* Current proficiency display for selected language */}
                {langPrefsData?.actflLevel && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Your {languageNames[selectedPrefLanguage] || selectedPrefLanguage} Proficiency
                      </p>
                      <p className="text-lg font-medium capitalize" data-testid="text-actfl-level">
                        {langPrefsData.actflLevel.replace(/_/g, ' ').replace(/-/g, ' ')}
                      </p>
                    </div>
                    <Badge variant="secondary">ACTFL</Badge>
                  </div>
                )}

                {/* Show if user has class enrollment for this language */}
                {langPrefsData?.hasClassEnrollment && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md p-2">
                    <BookOpen className="h-4 w-4" />
                    <span>You're enrolled in a {languageNames[selectedPrefLanguage] || selectedPrefLanguage} class. Class chats use your teacher's settings.</span>
                  </div>
                )}

                {/* Flexibility selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="flexibility-select" className="text-base">Teaching Style</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose how much freedom you want during self-directed {languageNames[selectedPrefLanguage] || selectedPrefLanguage} practice
                      </p>
                    </div>
                    <Select
                      value={selfDirectedFlexibility}
                      onValueChange={handleFlexibilityChange}
                      disabled={flexibilityMutation.isPending}
                    >
                      <SelectTrigger className="w-48" id="flexibility-select" data-testid="select-flexibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guided" data-testid="select-flexibility-guided">
                          Guided (Structured)
                        </SelectItem>
                        <SelectItem value="flexible_goals" data-testid="select-flexibility-flexible">
                          Flexible Goals
                        </SelectItem>
                        <SelectItem value="open_exploration" data-testid="select-flexibility-open">
                          Open Exploration
                        </SelectItem>
                        <SelectItem value="free_conversation" data-testid="select-flexibility-free">
                          Free Conversation
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description of selected style */}
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    {selfDirectedFlexibility === 'guided' && (
                      <p>The tutor follows a structured approach, keeps you on topic, and provides clear corrections. Best for building a strong foundation.</p>
                    )}
                    {selfDirectedFlexibility === 'flexible_goals' && (
                      <p>You can choose topics within learning goals. The tutor guides you but allows exploration within your level.</p>
                    )}
                    {selfDirectedFlexibility === 'open_exploration' && (
                      <p>You lead the conversation direction. The tutor suggests learning connections but follows your interests.</p>
                    )}
                    {selfDirectedFlexibility === 'free_conversation' && (
                      <p>Maximum practice freedom. Natural conversation with minimal structure, great for building fluency.</p>
                    )}
                  </div>

                  {/* Recommendation indicator */}
                  {langPrefsData?.actflLevel && (
                    <div className={`flex items-center gap-2 text-sm ${isUsingRecommended ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {isUsingRecommended ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>This is the recommended style for your {languageNames[selectedPrefLanguage] || selectedPrefLanguage} level</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4" />
                          <span>
                            Recommended for {langPrefsData.actflLevel.replace(/_/g, ' ').replace(/-/g, ' ')}: {' '}
                            <button 
                              className="underline hover:no-underline"
                              onClick={() => handleFlexibilityChange(recommendedFlexibility)}
                              data-testid="button-use-recommended"
                            >
                              {recommendedFlexibility === 'guided' ? 'Guided' : 
                               recommendedFlexibility === 'flexible_goals' ? 'Flexible Goals' :
                               recommendedFlexibility === 'open_exploration' ? 'Open Exploration' : 'Free Conversation'}
                            </button>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Placement assessment option - only for eligible users for this specific language */}
                {isEligibleForPlacement && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 flex-1">
                        <Label className="text-base">Quick {languageNames[selectedPrefLanguage] || selectedPrefLanguage} Placement</Label>
                        <p className="text-sm text-muted-foreground">
                          Take a brief 3-5 minute assessment to determine your {languageNames[selectedPrefLanguage] || selectedPrefLanguage} proficiency
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsRunningPlacement(true);
                          toast({
                            title: "Coming soon",
                            description: "The quick placement assessment will be available in a future update",
                          });
                          setIsRunningPlacement(false);
                        }}
                        disabled={isRunningPlacement}
                        data-testid="button-start-placement"
                      >
                        {isRunningPlacement ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Assessing...
                          </>
                        ) : (
                          'Start Assessment'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Note about class chats */}
            <p className="text-xs text-muted-foreground italic">
              Note: Class assignments use the teaching style set by your teacher, not this preference.
            </p>
          </CardContent>
        </Card>}

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

        {/* Subscription Status - Hidden per design update (users purchase via join-class/pricing pages) */}
        {false && <Card data-testid="card-subscription">
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
        </Card>}

        {/* Hour Packages - Hidden per design update (users purchase via join-class/pricing pages) */}
        {false && <Card data-testid="card-hour-packages">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Buy Tutoring Hours
            </CardTitle>
            <CardDescription>
              Purchase practice hours to use with your AI tutor
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hourPackagesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : hourPackages && hourPackages.length > 0 ? (
              <div className="grid gap-3">
                {hourPackages.map((pkg) => (
                  <div
                    key={pkg.tier}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{pkg.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {pkg.hours} hour{pkg.hours > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        ${pkg.pricePerHour.toFixed(2)}/hour
                      </p>
                    </div>
                    <Button
                      onClick={() => hourPackageCheckoutMutation.mutate(pkg.tier)}
                      disabled={hourPackageCheckoutMutation.isPending}
                      data-testid={`button-buy-${pkg.tier}`}
                    >
                      ${pkg.priceUsd}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hour packages available at this time.
              </p>
            )}
            {hourPackageCheckoutMutation.isError && (
              <p className="text-sm text-destructive mt-2">
                Failed to start checkout. Please try again or contact support.
              </p>
            )}
          </CardContent>
        </Card>}

        {/* Institutional Class Packages - Hidden per design update (users purchase via join-class/pricing pages) */}
        {false && teacherClasses && teacherClasses.length > 0 && (
          <Card data-testid="card-class-packages">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Buy Class Packages
              </CardTitle>
              <CardDescription>
                Purchase tutoring hours for your entire class (one-time purchase per student)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {institutionalPackagesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="class-select">Select Class</Label>
                      <Select
                        value={selectedClassForPackage}
                        onValueChange={setSelectedClassForPackage}
                      >
                        <SelectTrigger id="class-select" data-testid="select-class">
                          <SelectValue placeholder="Choose a class" />
                        </SelectTrigger>
                        <SelectContent>
                          {teacherClasses.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name} ({cls.language})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-count">Number of Students</Label>
                      <Input
                        id="student-count"
                        type="number"
                        min={1}
                        max={500}
                        value={studentCount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentCount(Math.max(1, parseInt(e.target.value) || 1))}
                        data-testid="input-student-count"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Select Package</Label>
                    <div className="grid gap-3">
                      {institutionalPackages?.map((pkg) => {
                        const totalPrice = pkg.pricePerStudentUsd * studentCount;
                        const totalHours = pkg.hoursPerStudent * studentCount;
                        const isSelected = selectedPackageTier === pkg.tier;
                        return (
                          <div
                            key={pkg.tier}
                            onClick={() => setSelectedPackageTier(pkg.tier)}
                            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                              isSelected ? 'border-primary bg-primary/5' : 'bg-muted/30 hover-elevate'
                            }`}
                            data-testid={`package-option-${pkg.tier}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{pkg.name}</h4>
                                <Badge variant="secondary" className="text-xs">
                                  {pkg.hoursPerStudent}h/student
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                ${pkg.pricePerStudentUsd}/student ({totalHours} total hours)
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">${totalPrice}</div>
                              <div className="text-xs text-muted-foreground">total</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    disabled={!selectedClassForPackage || !selectedPackageTier || institutionalCheckoutMutation.isPending}
                    onClick={() => institutionalCheckoutMutation.mutate({
                      packageTier: selectedPackageTier,
                      studentCount,
                      classId: selectedClassForPackage
                    })}
                    data-testid="button-purchase-class-package"
                  >
                    {institutionalCheckoutMutation.isPending ? 'Processing...' : 'Purchase Class Package'}
                  </Button>

                  {institutionalCheckoutMutation.isError && (
                    <p className="text-sm text-destructive">
                      Failed to start checkout. Please try again or contact support.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Usage Report */}
        <Card data-testid="card-usage-report">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Usage Report
            </CardTitle>
            <CardDescription>Your credit balance and session history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {balanceLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-8" />
              </div>
            ) : balanceData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-md border">
                    <p className="text-sm text-muted-foreground">Remaining Balance</p>
                    <p className={`text-2xl font-bold ${balanceData.remainingSeconds < 0 ? 'text-destructive' : balanceData.warningLevel === 'low' || balanceData.warningLevel === 'critical' ? 'text-yellow-600 dark:text-yellow-400' : ''}`} data-testid="text-remaining-balance">
                      {balanceData.remainingHours}h
                    </p>
                  </div>
                  <div className="p-4 rounded-md border">
                    <p className="text-sm text-muted-foreground">Purchased</p>
                    <p className="text-2xl font-bold" data-testid="text-purchased-hours">
                      {Math.round(balanceData.purchasedSeconds / 360) / 10}h
                    </p>
                  </div>
                  <div className="p-4 rounded-md border">
                    <p className="text-sm text-muted-foreground">Bonus / Allocated</p>
                    <p className="text-2xl font-bold" data-testid="text-bonus-hours">
                      {Math.round((balanceData.bonusSeconds + balanceData.classAllocationSeconds) / 360) / 10}h
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                      <Input
                        type="date"
                        value={usageStartDate}
                        onChange={(e) => setUsageStartDate(e.target.value)}
                        data-testid="input-usage-start-date"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                      <Input
                        type="date"
                        value={usageEndDate}
                        onChange={(e) => setUsageEndDate(e.target.value)}
                        data-testid="input-usage-end-date"
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={usageFilter === 'all' ? 'default' : 'outline'}
                        onClick={() => setUsageFilter('all')}
                        data-testid="button-filter-all"
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={usageFilter === 'credits' ? 'default' : 'outline'}
                        onClick={() => setUsageFilter('credits')}
                        data-testid="button-filter-credits"
                      >
                        Credits
                      </Button>
                      <Button
                        size="sm"
                        variant={usageFilter === 'debits' ? 'default' : 'outline'}
                        onClick={() => setUsageFilter('debits')}
                        data-testid="button-filter-debits"
                      >
                        Debits
                      </Button>
                    </div>
                    {(usageStartDate || usageEndDate) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setUsageStartDate(''); setUsageEndDate(''); }}
                        data-testid="button-clear-dates"
                      >
                        Clear dates
                      </Button>
                    )}
                  </div>

                  {usageHistoryLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-10" />
                      ))}
                    </div>
                  ) : usageHistoryData?.history && usageHistoryData.history.length > 0 ? (
                    (() => {
                      const filtered = usageHistoryData.history.filter(entry => {
                        if (usageFilter === 'credits') return entry.creditSeconds > 0;
                        if (usageFilter === 'debits') return entry.creditSeconds < 0;
                        return true;
                      });
                      const totalCredits = filtered.filter(e => e.creditSeconds > 0).reduce((s, e) => s + e.creditSeconds, 0);
                      const totalDebits = filtered.filter(e => e.creditSeconds < 0).reduce((s, e) => s + Math.abs(e.creditSeconds), 0);
                      
                      return (
                        <>
                          <div className="flex items-center gap-4 mb-3 text-sm">
                            <span className="text-green-600 dark:text-green-400 font-medium" data-testid="text-total-credits">
                              <ArrowUpCircle className="h-3.5 w-3.5 inline mr-1" />
                              +{totalCredits >= 3600 ? `${Math.round(totalCredits / 360) / 10}h` : `${Math.round(totalCredits / 60)}m`}
                            </span>
                            <span className="text-muted-foreground font-medium" data-testid="text-total-debits">
                              <ArrowDownCircle className="h-3.5 w-3.5 inline mr-1" />
                              -{totalDebits >= 3600 ? `${Math.round(totalDebits / 360) / 10}h` : `${Math.round(totalDebits / 60)}m`}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} transactions</span>
                          </div>
                          <div className="space-y-1">
                            {filtered.map((entry) => {
                              const isCredit = entry.creditSeconds > 0;
                              const absSeconds = Math.abs(entry.creditSeconds);
                              const minutes = Math.round(absSeconds / 60);
                              const hours = Math.round(absSeconds / 360) / 10;
                              const displayTime = absSeconds >= 3600 ? `${hours}h` : `${minutes}m`;
                              const date = new Date(entry.createdAt);
                              
                              return (
                                <div key={entry.id} className="flex items-center justify-between py-2 px-3 rounded-md border text-sm" data-testid={`row-usage-${entry.id}`}>
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {isCredit ? (
                                      <ArrowUpCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                                    ) : (
                                      <ArrowDownCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="truncate">{entry.description || entry.entitlementType}</span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <span className={`font-medium ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                      {isCredit ? '+' : '-'}{displayTime}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No transactions found for this period</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load usage data</p>
            )}
          </CardContent>
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
