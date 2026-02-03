import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Check, AlertCircle, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const registrationSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

export default function CompleteRegistration() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  // Debug: log what we're getting
  console.log('[CompleteRegistration] search:', search);
  console.log('[CompleteRegistration] window.location.search:', window.location.search);
  
  // Use window.location.search directly as fallback
  const searchString = search || window.location.search.slice(1);
  const params = new URLSearchParams(searchString);
  const token = params.get('token');
  
  console.log('[CompleteRegistration] token:', token?.substring(0, 20) + '...');
  
  const { data: invitation, isLoading: isVerifying, error: verifyError } = useQuery({
    queryKey: ['/api/auth/invitations/verify', token],
    queryFn: async () => {
      if (!token) throw new Error('No invitation token provided');
      const response = await fetch(`/api/auth/invitations/verify?token=${encodeURIComponent(token)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Invalid invitation');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (data: RegistrationFormData) => {
      if (!token) {
        throw new Error('Missing invitation token');
      }
      const response = await apiRequest('POST', '/api/auth/invitations/complete', {
        token,
        password: data.password,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete registration');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Welcome to HolaHola!',
        description: 'Your account has been created successfully.',
      });
      navigate('/');
    },
    onError: (error: any) => {
      toast({
        title: 'Registration failed',
        description: error.message || 'Failed to complete registration',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: RegistrationFormData) => {
    completeMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="text-missing-token">
                No invitation token provided. Please use the link from your invitation email.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground" data-testid="text-verifying">
              Verifying your invitation...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="text-invalid-invitation">
                {(verifyError as Error).message || 'This invitation is invalid or has expired.'}
              </AlertDescription>
            </Alert>
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => navigate('/login')} data-testid="button-go-to-login">
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold" data-testid="text-registration-title">
            Complete Your Registration
          </CardTitle>
          <CardDescription data-testid="text-registration-description">
            {invitation?.firstName ? (
              <>Welcome, {invitation.firstName}! </>
            ) : null}
            Set a password to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitation?.email && (
            <div className="mb-4 p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Email: <span className="font-medium text-foreground" data-testid="text-invitation-email">{invitation.email}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Role: <span className="font-medium text-foreground capitalize" data-testid="text-invitation-role">{invitation.role}</span>
              </p>
            </div>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          placeholder="Create a strong password"
                          className="pl-10"
                          data-testid="input-password"
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      At least 8 characters with uppercase, lowercase, and a number
                    </FormDescription>
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
                disabled={completeMutation.isPending}
                data-testid="button-complete-registration"
              >
                {completeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Create Account
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
