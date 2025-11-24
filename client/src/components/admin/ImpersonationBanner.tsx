import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { UserCog, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImpersonationBannerProps {
  targetUserEmail: string;
  targetUserId: string;
}

export function ImpersonationBanner({ targetUserEmail, targetUserId }: ImpersonationBannerProps) {
  const { toast } = useToast();

  const endImpersonation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/end-impersonation", {
        method: "POST",
        body: JSON.stringify({ targetUserId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Impersonation ended",
        description: "You are now back to your admin account",
      });
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to end impersonation",
        variant: "destructive",
      });
    },
  });

  return (
    <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-800 rounded-none" data-testid="alert-impersonation">
      <UserCog className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-yellow-700 dark:text-yellow-300 font-medium">
          Impersonating: {targetUserEmail}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => endImpersonation.mutate()}
          disabled={endImpersonation.isPending}
          className="border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900"
          data-testid="button-end-impersonation"
        >
          <X className="h-3 w-3 mr-1" />
          End Impersonation
        </Button>
      </AlertDescription>
    </Alert>
  );
}
