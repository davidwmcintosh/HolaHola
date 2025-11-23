import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Message } from "@shared/schema";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMessage: (conversationId: string) => void;
}

export function SearchDialog({ open, onOpenChange, onSelectMessage }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: results = [], isLoading } = useQuery<Array<Message & { conversationTitle: string | null }>>({
    queryKey: ["/api/search/messages", searchQuery],
    enabled: searchQuery.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/search/messages?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    }
  });

  const handleSearch = () => {
    if (query.trim()) {
      setSearchQuery(query.trim());
    }
  };

  const handleSelectResult = (conversationId: string) => {
    onSelectMessage(conversationId);
    onOpenChange(false);
    setQuery("");
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="search-dialog">
        <DialogHeader>
          <DialogTitle>Search Conversations</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search for topics, words, or phrases..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-search"
            />
            <Button onClick={handleSearch} disabled={!query.trim()} data-testid="button-search">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searchQuery && (
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No results found for "{searchQuery}"</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{results.length} results found</p>
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="p-3 rounded-lg border hover-elevate active-elevate-2 cursor-pointer"
                      onClick={() => handleSelectResult(result.conversationId)}
                      data-testid={`search-result-${result.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-1 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {result.conversationTitle || "Untitled Conversation"}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {result.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(result.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
