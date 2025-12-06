import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wrench, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/lib/auth";

interface DevToolsFloatingMenuProps {
  classId?: string | null;
  conversationId?: string | null;
  onCreditsReloaded?: () => void;
  onDataReset?: () => void;
}

export function DevToolsFloatingMenu({ 
  classId, 
  conversationId,
  onCreditsReloaded,
  onDataReset 
}: DevToolsFloatingMenuProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDeveloper, isAdmin, user, isTestAccount } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  const reloadCreditsMutation = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error("No class selected");
      const res = await apiRequest("POST", "/api/developer/reload-credits", { 
        classId,
        hours: 120 
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/usage/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student/classes"] });
      toast({
        title: "Credits Reloaded",
        description: `Reset to ${data.hours || 120} hours (was ${data.previousHours?.toFixed(1) || "?"} hours)`,
      });
      onCreditsReloaded?.();
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reload credits",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  const resetDataMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not found");
      const res = await apiRequest("POST", `/api/admin/users/${user.id}/reset-learning-data`, {
        resetVocabulary: true,
        resetGrammar: true,
        resetProgress: true,
        resetConversations: true,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/grammar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-hub"] }); // Invalidate language hub stats
      toast({
        title: "Learning Data Reset",
        description: `Cleared: ${data.deletedVocabulary || 0} words, ${data.deletedGrammar || 0} exercises, ${data.deletedConversations || 0} conversations`,
      });
      onDataReset?.();
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reset data",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  if (!isDeveloper && !isAdmin) {
    return null;
  }

  const isLoading = reloadCreditsMutation.isPending || resetDataMutation.isPending;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      {conversationId && (
        <div 
          className="bg-background/80 backdrop-blur-sm border rounded-md px-2 py-1 text-xs font-mono text-muted-foreground cursor-pointer hover:bg-background/90 shadow-sm"
          onClick={() => {
            navigator.clipboard.writeText(conversationId);
            toast({
              title: "Copied",
              description: "Conversation ID copied to clipboard",
            });
          }}
          title="Click to copy conversation ID"
          data-testid="text-conversation-id"
        >
          {conversationId.slice(0, 8)}...
        </div>
      )}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full shadow-lg bg-yellow-500/90 hover:bg-yellow-500 border-yellow-600 text-yellow-950"
            data-testid="button-dev-tools"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Wrench className="h-5 w-5" />
            )}
          </Button>
        </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Developer Tools
          {isTestAccount && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">
              Test Account
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => reloadCreditsMutation.mutate()}
          disabled={!classId || reloadCreditsMutation.isPending}
          className="cursor-pointer"
          data-testid="button-reload-credits"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span>Reload Credits</span>
            {classId ? (
              <span className="text-xs text-muted-foreground">Reset to 120 hours</span>
            ) : (
              <span className="text-xs text-muted-foreground">Select a class first</span>
            )}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => resetDataMutation.mutate()}
          disabled={resetDataMutation.isPending}
          className="cursor-pointer text-destructive focus:text-destructive"
          data-testid="button-reset-learning-data"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span>Reset Learning Data</span>
            <span className="text-xs opacity-70">Clear all vocabulary, grammar, progress</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
