import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useLocation, Link } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, GraduationCap, Mail, ArrowRight, Users, Sparkles } from 'lucide-react';
import { SiGoogle, SiGithub, SiApple } from 'react-icons/si';
import holaholaIcon from "@assets/holaholajustbubblesBackgroundRemoved_1765309702014.png";

const classCodeSchema = z.object({
  joinCode: z.string().min(1, 'Class code is required').toUpperCase(),
});

type ClassCodeFormData = z.infer<typeof classCodeSchema>;

type StartOption = 'choose' | 'class-code' | 'self-study';

export default function GetStarted() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentOption, setCurrentOption] = useState<StartOption>('choose');
  
  const form = useForm<ClassCodeFormData>({
    resolver: zodResolver(classCodeSchema),
    defaultValues: {
      joinCode: '',
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (data: ClassCodeFormData) => {
      const response = await fetch(`/api/classes/verify-code?code=${encodeURIComponent(data.joinCode)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid class code');
      }
      return response.json();
    },
    onSuccess: (data) => {
      sessionStorage.setItem('pendingJoinCode', form.getValues().joinCode);
      toast({
        title: 'Class found!',
        description: `Sign in to join "${data.className}"`,
      });
      window.location.href = '/api/login';
    },
    onError: (error: any) => {
      toast({
        title: 'Invalid code',
        description: error.message || 'Please check your class code and try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmitCode = (data: ClassCodeFormData) => {
    verifyCodeMutation.mutate(data);
  };

  const handleGoogleSignIn = () => {
    window.location.href = '/api/login';
  };

  if (currentOption === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src={holaholaIcon} 
                alt="HolaHola" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-3xl font-bold" data-testid="text-get-started-title">
              Welcome to HolaHola
            </h1>
            <p className="text-muted-foreground text-lg">
              How would you like to get started?
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card 
              className="cursor-pointer hover-elevate transition-all border-2 hover:border-primary/50"
              onClick={() => setCurrentOption('class-code')}
              data-testid="card-class-code-option"
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
                  <GraduationCap className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">I Have a Class Code</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-base">
                  Your teacher gave you a code to join their class. Enter it to get started.
                </CardDescription>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover-elevate transition-all border-2 hover:border-primary/50"
              onClick={() => setCurrentOption('self-study')}
              data-testid="card-self-study-option"
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Self-Study / Explore</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-base">
                  Learn on your own or browse our class catalog to find courses that fit your goals.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentOption === 'class-code') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-class-code-title">
              Enter Your Class Code
            </CardTitle>
            <CardDescription>
              Your teacher or school provided a code to join their class
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCode)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="joinCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., ABC123"
                          className="text-center text-2xl font-mono tracking-widest"
                          maxLength={8}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-class-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={verifyCodeMutation.isPending}
                  data-testid="button-verify-code"
                >
                  {verifyCodeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Continue
                </Button>
              </form>
            </Form>
            
            <div className="text-center">
              <Button 
                variant="ghost" 
                onClick={() => setCurrentOption('choose')}
                data-testid="button-back"
              >
                Back to options
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentOption === 'self-study') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-self-study-title">
              Create Your Account
            </CardTitle>
            <CardDescription>
              Sign in to explore courses and start learning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Social login options */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleGoogleSignIn}
              data-testid="button-google-signin"
            >
              <SiGoogle className="h-5 w-5 mr-2" />
              Continue with Google
            </Button>

            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={handleGoogleSignIn}
              data-testid="button-github-signin"
            >
              <SiGithub className="h-5 w-5 mr-2" />
              Continue with GitHub
            </Button>

            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={handleGoogleSignIn}
              data-testid="button-apple-signin"
            >
              <SiApple className="h-5 w-5 mr-2" />
              Continue with Apple
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Email signup option */}
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              onClick={() => navigate('/login')}
              data-testid="button-email-signup"
            >
              <Mail className="h-5 w-5 mr-2" />
              Sign up with Email
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
            
            <div className="text-center pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setCurrentOption('choose')}
                data-testid="button-back"
              >
                Back to options
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
