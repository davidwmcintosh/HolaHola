import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ThreadSelectorProps {
  language: string;
  difficulty: string;
  userName: string;
  selectedThreadId: string | null;
  onThreadSelect: (conversationId: string) => void;
}

export function ThreadSelector({
  language,
  difficulty,
  userName,
  selectedThreadId,
  onThreadSelect,
}: ThreadSelectorProps) {
  const [isNewThreadDialogOpen, setIsNewThreadDialogOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  // Fetch all conversations for current language
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations/by-language", language],
  });

  // Filter out onboarding conversations and sort by creation date
  const activeThreads = conversations
    .filter(c => !c.isOnboarding)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const currentThread = activeThreads.find(t => t.id === selectedThreadId);

  // Create new thread mutation
  const createThreadMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/conversations", {
        language,
        difficulty,
        userName: userName || "Student",
        title: title || null,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/by-language", language] });
      onThreadSelect(data.id);
      setIsNewThreadDialogOpen(false);
      setNewThreadTitle("");
    },
  });

  // Delete thread mutation
  const deleteThreadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/conversations/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/by-language", language] });
      setThreadToDelete(null);
      
      // If we deleted the current thread, select the first available thread
      if (threadToDelete === selectedThreadId && activeThreads.length > 1) {
        const nextThread = activeThreads.find(t => t.id !== threadToDelete);
        if (nextThread) {
          onThreadSelect(nextThread.id);
        }
      }
    },
  });

  const handleCreateThread = () => {
    createThreadMutation.mutate(newThreadTitle);
  };

  const handleDeleteThread = (id: string) => {
    setThreadToDelete(id);
  };

  const confirmDeleteThread = () => {
    if (threadToDelete) {
      deleteThreadMutation.mutate(threadToDelete);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 p-2 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex-1 justify-between"
              data-testid="button-thread-selector"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="truncate">
                  {currentThread?.title || "Current Conversation"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="start">
            <DropdownMenuLabel>Your Conversations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-64">
              {activeThreads.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No conversations yet. Create one to get started!
                </div>
              ) : (
                activeThreads.map((thread) => (
                  <DropdownMenuItem
                    key={thread.id}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                    onClick={() => onThreadSelect(thread.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {thread.title || "Untitled Conversation"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {thread.messageCount} messages • {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    {activeThreads.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteThread(thread.id);
                        }}
                        data-testid={`button-delete-thread-${thread.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsNewThreadDialogOpen(true)}
          data-testid="button-new-thread"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* New Thread Dialog */}
      <Dialog open={isNewThreadDialogOpen} onOpenChange={setIsNewThreadDialogOpen}>
        <DialogContent data-testid="dialog-new-thread">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Give your conversation a title to help you remember what you're practicing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="thread-title">Conversation Title (Optional)</Label>
              <Input
                id="thread-title"
                placeholder="e.g., Restaurant Vocabulary, Travel Phrases..."
                value={newThreadTitle}
                onChange={(e) => setNewThreadTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateThread();
                  }
                }}
                data-testid="input-thread-title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsNewThreadDialogOpen(false);
                setNewThreadTitle("");
              }}
              data-testid="button-cancel-new-thread"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateThread}
              disabled={createThreadMutation.isPending}
              data-testid="button-create-thread"
            >
              {createThreadMutation.isPending ? "Creating..." : "Create Conversation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!threadToDelete} onOpenChange={() => setThreadToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-thread">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteThread}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
