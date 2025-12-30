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
import { Loader2, Mail, Lock, LogIn, GraduationCap } from 'lucide-react';
import { SiGoogle, SiGithub, SiApple } from 'react-icons/si';
import holaholaLogo from '@assets/holaholamainlogoBackgroundRemoved_1765308837223.png';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Floating language greetings for visual interest
const floatingGreetings = [
  { text: 'Hola', color: 'text-orange-500', position: 'top-[8%] left-[5%]', size: 'text-2xl md:text-3xl', delay: '0s' },
  { text: 'Bonjour', color: 'text-blue-500', position: 'top-[15%] right-[8%]', size: 'text-xl md:text-2xl', delay: '0.5s' },
  { text: '你好', color: 'text-red-500', position: 'top-[25%] left-[8%]', size: 'text-3xl md:text-4xl', delay: '1s' },
  { text: 'Ciao', color: 'text-green-600', position: 'bottom-[25%] right-[5%]', size: 'text-xl md:text-2xl', delay: '1.5s' },
  { text: 'こんにちは', color: 'text-pink-500', position: 'bottom-[15%] left-[3%]', size: 'text-lg md:text-xl', delay: '2s' },
  { text: 'Olá', color: 'text-emerald-500', position: 'bottom-[8%] right-[10%]', size: 'text-2xl md:text-3xl', delay: '2.5s' },
  { text: 'Guten Tag', color: 'text-amber-600', position: 'top-[40%] right-[3%]', size: 'text-lg md:text-xl', delay: '3s' },
  { text: '안녕', color: 'text-purple-500', position: 'bottom-[35%] left-[5%]', size: 'text-xl md:text-2xl', delay: '3.5s' },
  { text: 'नमस्ते', color: 'text-orange-600', position: 'top-[50%] left-[2%]', size: 'text-2xl md:text-3xl', delay: '4s' },
];

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest('POST', '/api/auth/password/login', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid email or password');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Welcome back!',
        description: 'You have been logged in successfully.',
      });
      navigate('/');
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-background to-orange-50 dark:from-sky-950/20 dark:via-background dark:to-orange-950/20 p-4 relative overflow-hidden">
      {/* Floating greetings - hidden on very small screens */}
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

      {/* Main login card */}
      <Card className="w-full max-w-md relative z-10 shadow-xl border-0 bg-card/95 backdrop-blur-sm">
        <CardContent className="pt-8 pb-6 px-6 md:px-8">
          {/* Logo and branding */}
          <div className="flex flex-col items-center mb-6">
            <img 
              src={holaholaLogo} 
              alt="HolaHola" 
              className="h-36 md:h-44 w-auto mb-4"
              data-testid="img-logo"
            />
            <h1 
              className="text-2xl font-bold text-foreground"
              data-testid="text-login-title"
            >
              Welcome Back
            </h1>
            <p 
              className="text-sm text-muted-foreground mt-1"
              data-testid="text-login-description"
            >
              Sign in to continue your language journey
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          placeholder="Enter your password"
                          className="pl-10"
                          data-testid="input-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="text-right">
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                Sign In
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            {/* Social login options */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-google-login"
            >
              <SiGoogle className="h-4 w-4 mr-2" />
              Continue with Google
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-github-login"
            >
              <SiGithub className="h-4 w-4 mr-2" />
              Continue with GitHub
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-apple-login"
            >
              <SiApple className="h-4 w-4 mr-2" />
              Continue with Apple
            </Button>
            
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            
            {/* Class code option */}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => window.location.href = '/get-started?option=class-code'}
              data-testid="button-class-code"
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              I Have a Class Code
            </Button>
            
            <p className="text-center text-sm text-muted-foreground" data-testid="text-new-user-hint">
              New to HolaHola?{' '}
              <a href="/get-started" className="text-primary hover:underline font-medium" data-testid="link-get-started">
                Get Started
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CSS animation for floating effect */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
