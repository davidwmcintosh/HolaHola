import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function PendingJoinCodeHandler() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const hasAttempted = useRef(false);

  const enrollMutation = useMutation({
    mutationFn: async (joinCode: string) => {
      const response = await apiRequest('POST', '/api/student/enroll', { joinCode });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/student/classes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/classes/catalogue'] });
      sessionStorage.removeItem('pendingJoinCode');
      
      toast({
        title: 'Welcome to your class!',
        description: `You've been enrolled in "${data.class?.name || 'the class'}".`,
      });
    },
    onError: (error: any) => {
      if (error.message?.includes('already enrolled')) {
        sessionStorage.removeItem('pendingJoinCode');
        toast({
          title: 'Already enrolled',
          description: "You're already a member of this class.",
        });
      } else if (error.status === 401 || error.message?.includes('Unauthorized')) {
        // Don't clear the code on auth errors - let retry happen
        console.log('[PendingJoinCode] Auth not ready, will retry');
      } else {
        sessionStorage.removeItem('pendingJoinCode');
        toast({
          title: 'Enrollment issue',
          description: error.message || 'Could not complete enrollment. Please try joining again.',
          variant: 'destructive',
        });
      }
    },
  });

  useEffect(() => {
    // Wait for auth to fully load before attempting enrollment
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (hasAttempted.current) return;
    
    const pendingCode = sessionStorage.getItem('pendingJoinCode');
    if (pendingCode) {
      hasAttempted.current = true;
      enrollMutation.mutate(pendingCode);
    }
  }, [isLoading, isAuthenticated]);

  return null;
}
