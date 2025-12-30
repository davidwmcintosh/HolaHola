import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useLocation, Link } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, UserPlus, Sparkles, Check, Crown } from 'lucide-react';
import { SiGoogle, SiGithub, SiApple } from 'react-icons/si';
import holaholaLogo from '@assets/holaholamainlogoBackgroundRemoved_1765308837223.png';

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

const floatingGreetings = [
  { text: 'Hola', color: 'text-orange-500', position: 'top-[8%] left-[5%]', size: 'text-2xl md:text-3xl', delay: '0s' },
  { text: 'Bonjour', color: 'text-blue-500', position: 'top-[15%] right-[8%]', size: 'text-xl md:text-2xl', delay: '0.5s' },
  { text: '你好', color: 'text-red-500', position: 'top-[25%] left-[8%]', size: 'text-3xl md:text-4xl', delay: '1s' },
  { text: 'Ciao', color: 'text-green-600', position: 'bottom-[25%] right-[5%]', size: 'text-xl md:text-2xl', delay: '1.5s' },
  { text: 'こんにちは', color: 'text-pink-500', position: 'bottom-[15%] left-[3%]', size: 'text-lg md:text-xl', delay: '2s' },
  { text: 'Olá', color: 'text-emerald-500', position: 'bottom-[8%] right-[10%]', size: 'text-2xl md:text-3xl', delay: '2.5s' },
  { text: 'Guten Tag', color: 'text-amber-600', position: 'top-[40%] right-[3%]', size: 'text-lg md:text-xl', delay: '3s' },
  { text: '안녕', color: 'text-purple-500', position: 'bottom-[35%] left-[5%]', size: 'text-xl md:text-2xl', delay: '3.5s' },
];

export default function Signup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      const response = await apiRequest('POST', '/api/auth/password/register', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Account created!',
        description: 'Welcome to HolaHola! Your language learning journey begins now.',
      });
      navigate('/');
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration failed',
        description: error.message || 'Could not create your account. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    signupMutation.mutate(data);
  };

  const handleSocialSignIn = (provider: string) => {
    window.location.href = '/api/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-background to-orange-50 dark:from-sky-950/20 dark:via-background dark:to-orange-950/20 p-4 relative overflow-hidden">
      {/* Floating greetings */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none overflow-hidden">
        {floatingGreetings.map((greeting, index) => (
          <span
            key={index}
            className={`absolute ${greeting.position} ${greeting.color} ${greeting.size} font-bold opacity-20 dark:opacity-15 select-none`}
            style={{
              animation: `float 6s ease-in-out infinite`,
              animationDelay: greeting.delay,
            }}
          >
            {greeting.text}
          </span>
        ))}
      </div>

      {/* Main signup card */}
      <Card className="w-full max-w-md relative z-10 shadow-xl border-0 bg-card/95 backdrop-blur-sm">
        <CardContent className="pt-8 pb-6 px-6 md:px-8">
          {/* Logo and branding */}
          <div className="flex flex-col items-center mb-6">
            <div className="flex flex-row items-center justify-center gap-3">
              <img 
                src={holaholaLogo} 
                alt="HolaHola" 
                className="h-16 md:h-20 w-auto"
                data-testid="img-logo"
              />
              <h1 
                className="text-2xl md:text-3xl font-bold text-foreground"
                data-testid="text-signup-title"
              >
                Create Account
              </h1>
            </div>
            <p 
              className="text-sm text-muted-foreground mt-2"
              data-testid="text-signup-description"
            >
              Start your language learning journey today
            </p>
          </div>

          {/* Free trial info */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-lg p-4 mb-6" data-testid="div-free-trial-info">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Free Plan Includes:</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-green-500" />
                20 voice conversations per month
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-green-500" />
                Access to all 9 languages
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-green-500" />
                Vocabulary, grammar & cultural tips
              </li>
            </ul>
            <Link 
              href="/pricing" 
              className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
              data-testid="link-view-plans"
            >
              <Crown className="h-3 w-3" />
              View all plans
            </Link>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder="First"
                            className="pl-10"
                            data-testid="input-first-name"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Last"
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="At least 8 characters"
                          className="pl-10"
                          data-testid="input-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="Confirm your password"
                          className="pl-10"
                          data-testid="input-confirm-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={signupMutation.isPending}
                data-testid="button-signup"
              >
                {signupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Create Account
              </Button>
            </form>
          </Form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Social login buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSocialSignIn('google')}
              data-testid="button-google-signup"
              className="w-full"
            >
              <SiGoogle className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSocialSignIn('github')}
              data-testid="button-github-signup"
              className="w-full"
            >
              <SiGithub className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSocialSignIn('apple')}
              data-testid="button-apple-signup"
              className="w-full"
            >
              <SiApple className="h-5 w-5" />
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link 
              href="/login" 
              className="text-primary hover:underline font-medium"
              data-testid="link-login"
            >
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
