import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useLogout() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/logout", { 
        method: "POST", 
        credentials: "include" 
      });
      if (!response.ok) {
        throw new Error("Failed to logout. Please try again.");
      }
      return response;
    },
    onSuccess: () => {
      // Invalidate auth query first
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Then clear all queries
      queryClient.removeQueries();
      // Finally redirect
      window.location.href = "/";
    },
    onError: (error: Error) => {
      console.error("Logout error:", error);
      // Invalidate auth query even on error
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Show error toast to user
      toast({
        title: "Logout Failed",
        description: error.message || "Could not sign out. Please try again.",
        variant: "destructive",
      });
    },
  });
}
