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
          <CardContent className="space-y-6">
            <Button
              className="w-full"
              size="lg"
              onClick={handleGoogleSignIn}
              data-testid="button-google-signin"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                After signing in, you can browse our catalog and enroll in courses that match your goals.
              </p>
            </div>
            
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

  return null;
}
