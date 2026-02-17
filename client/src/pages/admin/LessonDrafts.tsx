import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle, XCircle, Clock, Sparkles, ChevronRight, BookOpen, Target, MessageSquare, Loader2, Shuffle, CheckCheck, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ScaffoldedTask {
  taskNumber: number;
  instruction: string;
  expectedResponse: string;
  scaffoldingNotes: string;
}

interface LessonDraft {
  draft: {
    id: string;
    canDoStatementId: string;
    language: string;
    actflLevel: string;
    category: string;
    name: string;
    description: string;
    draftPayload: {
      objectives: string[];
      warmUp: string;
      modelInput: string;
      modelOutput: string;
      scaffoldedTasks: ScaffoldedTask[];
      assessmentCheck: string;
      culturalConnection: string;
      vocabularyFocus: string[];
      grammarFocus: string[];
      suggestedDuration: number;
      lessonType: string;
    };
    status: 'draft' | 'pending' | 'approved' | 'published' | 'rejected';
    reviewNotes: string | null;
    createdAt: string;
    reviewedAt: string | null;
  };
  canDo: {
    id: string;
    statement: string;
    category: string;
    actflLevel: string;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Draft", color: "bg-gray-500", icon: FileText },
  pending: { label: "Pending Review", color: "bg-yellow-500", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500", icon: CheckCircle },
  published: { label: "Published", color: "bg-blue-500", icon: BookOpen },
  rejected: { label: "Rejected", color: "bg-red-500", icon: XCircle },
};

const LEVEL_LABELS: Record<string, string> = {
  novice_low: "Novice Low",
  novice_mid: "Novice Mid",
  novice_high: "Novice High",
  intermediate_low: "Intermediate Low",
  intermediate_mid: "Intermediate Mid",
  intermediate_high: "Intermediate High",
  advanced_low: "Advanced Low",
  advanced_mid: "Advanced Mid",
  advanced_high: "Advanced High",
};

const CATEGORY_LABELS: Record<string, string> = {
  interpersonal: "Interpersonal",
  interpretive: "Interpretive",
  presentational: "Presentational",
};

const LANGUAGES = [
  { value: "all", label: "All Languages" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "mandarin", label: "Mandarin" },
  { value: "english", label: "English" },
  { value: "hebrew", label: "Hebrew" },
];

export default function LessonDrafts() {
  const [statusFilter, setStatusFilter] = useState("draft");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [selectedDraft, setSelectedDraft] = useState<LessonDraft | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [sampledDrafts, setSampledDrafts] = useState<LessonDraft[]>([]);
  const [showSampling, setShowSampling] = useState(false);
  const [samplingComplete, setSamplingComplete] = useState(false);
  const { toast } = useToast();

  const { data: drafts, isLoading } = useQuery<LessonDraft[]>({
    queryKey: ["/api/admin/lesson-drafts", statusFilter, languageFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      // Only send language param if it's a specific language, not "all"
      if (languageFilter && languageFilter !== "all") params.append("language", languageFilter);
      const response = await fetch(`/api/admin/lesson-drafts?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch drafts");
      return response.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ draftId, status, notes }: { draftId: string; status: string; notes?: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/lesson-drafts/${draftId}/status`, {
        status,
        reviewNotes: notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-drafts"] });
      setSelectedDraft(null);
      setReviewNotes("");
      toast({
        title: "Draft Updated",
        description: "The lesson draft status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update draft status",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (draftId: string) => {
    updateStatusMutation.mutate({ draftId, status: "approved", notes: reviewNotes });
  };

  const handleReject = (draftId: string) => {
    updateStatusMutation.mutate({ draftId, status: "rejected", notes: reviewNotes });
  };

  const handleMarkPending = (draftId: string) => {
    updateStatusMutation.mutate({ draftId, status: "pending" });
  };

  // Sampling mutation
  const sampleMutation = useMutation({
    mutationFn: async (count: number) => {
      const params = new URLSearchParams({ count: count.toString(), status: 'draft' });
      if (languageFilter && languageFilter !== "all") params.append('language', languageFilter);
      const response = await fetch(`/api/admin/lesson-drafts/sample?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch sample");
      return response.json();
    },
    onSuccess: (data) => {
      setSampledDrafts(data.sample);
      setShowSampling(true);
      setSamplingComplete(false);
      toast({
        title: "Sample Ready",
        description: `Loaded ${data.sampleSize} random drafts from ${data.totalAvailable} available`,
      });
    },
  });

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/lesson-drafts/bulk-status", {
        status: "approved",
        currentStatus: "draft",
        language: languageFilter !== "all" ? languageFilter : undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-drafts"] });
      setSampledDrafts([]);
      setShowSampling(false);
      setSamplingComplete(false);
      toast({
        title: "Bulk Approval Complete",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Approval Failed",
        description: error.message || "Failed to approve drafts",
        variant: "destructive",
      });
    },
  });

  const handleStartSampling = () => {
    sampleMutation.mutate(5);
  };

  const handleBulkApprove = () => {
    bulkApproveMutation.mutate();
  };

  const filteredDrafts = drafts?.filter((d) => {
    if (statusFilter && d.draft.status !== statusFilter) return false;
    if (languageFilter && languageFilter !== "all" && d.draft.language !== languageFilter) return false;
    return true;
  });

  const statusCounts = drafts?.reduce(
    (acc, d) => {
      acc[d.draft.status] = (acc[d.draft.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-page-title">
              AI Lesson Draft Review
            </h1>
            <p className="text-muted-foreground mt-2">
              Review and approve AI-generated lesson content before publishing
            </p>
          </div>
        </div>

          <div className="grid gap-4 md:grid-cols-5">
            {Object.entries(STATUS_LABELS).map(([status, info]) => {
              const Icon = info.icon;
              return (
                <Card
                  key={status}
                  className={`cursor-pointer transition-all ${statusFilter === status ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setStatusFilter(status)}
                  data-testid={`card-status-${status}`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${info.color}`} />
                        <span className="text-sm font-medium">{info.label}</span>
                      </div>
                      <span className="text-2xl font-bold">{statusCounts[status] || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-48" data-testid="select-language-filter">
                <SelectValue placeholder="All Languages" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {statusFilter === "draft" && (statusCounts.draft || 0) > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleStartSampling}
                  disabled={sampleMutation.isPending}
                  data-testid="button-start-sampling"
                >
                  {sampleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4 mr-2" />
                  )}
                  Quick Sample (5 Random)
                </Button>
                
                <Button
                  onClick={handleBulkApprove}
                  disabled={bulkApproveMutation.isPending}
                  data-testid="button-bulk-approve"
                >
                  {bulkApproveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-2" />
                  )}
                  Approve All {statusCounts.draft || 0} Drafts
                </Button>
              </div>
            )}
          </div>

          {showSampling && sampledDrafts.length > 0 && (
            <Alert className="border-primary/50 bg-primary/5">
              <Shuffle className="h-4 w-4" />
              <AlertTitle>Quick Sample Review</AlertTitle>
              <AlertDescription>
                Review these {sampledDrafts.length} random lessons. If quality looks good, approve all drafts at once.
              </AlertDescription>
              <div className="mt-4 space-y-2">
                {sampledDrafts.map((item, index) => (
                  <div
                    key={item.draft.id}
                    className="p-3 bg-background border rounded-lg flex items-center justify-between gap-4 cursor-pointer hover-elevate"
                    onClick={() => setSelectedDraft(item)}
                    data-testid={`sample-draft-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">#{index + 1}</span>
                        <h4 className="font-medium truncate text-sm">{item.draft.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.canDo?.statement}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">{item.draft.language}</Badge>
                        <Badge variant="secondary" className="text-xs">{LEVEL_LABELS[item.draft.actflLevel]}</Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSampling(false);
                    setSampledDrafts([]);
                    setSamplingComplete(false);
                  }}
                  data-testid="button-close-sampling"
                >
                  Close Sample
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSamplingComplete(true)}
                  disabled={samplingComplete}
                  data-testid="button-confirm-quality"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Quality Looks Good
                </Button>
                {samplingComplete && (
                  <Button
                    size="sm"
                    onClick={handleBulkApprove}
                    disabled={bulkApproveMutation.isPending}
                    data-testid="button-bulk-approve-panel"
                  >
                    {bulkApproveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4 mr-2" />
                    )}
                    Approve All {statusCounts.draft || 0} Drafts
                  </Button>
                )}
              </div>
            </Alert>
          )}

          <Card data-testid="card-drafts-list">
            <CardHeader>
              <CardTitle>
                {STATUS_LABELS[statusFilter]?.label || "All"} Drafts
              </CardTitle>
              <CardDescription>
                Click on a draft to review and take action
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : filteredDrafts && filteredDrafts.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {filteredDrafts.map((item) => (
                      <div
                        key={item.draft.id}
                        className="p-4 border rounded-lg hover-elevate cursor-pointer flex items-center justify-between gap-4"
                        onClick={() => setSelectedDraft(item)}
                        data-testid={`draft-${item.draft.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <h3 className="font-medium truncate">{item.draft.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {item.canDo?.statement || "Can-Do statement not found"}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="capitalize">
                              {item.draft.language}
                            </Badge>
                            <Badge variant="secondary">
                              {LEVEL_LABELS[item.draft.actflLevel] || item.draft.actflLevel}
                            </Badge>
                            <Badge>
                              {CATEGORY_LABELS[item.draft.category] || item.draft.category}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No drafts found with the selected filters</p>
                </div>
              )}
            </CardContent>
          </Card>

        <Dialog open={!!selectedDraft} onOpenChange={(open) => !open && setSelectedDraft(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {selectedDraft?.draft.name}
              </DialogTitle>
              <DialogDescription>
                Review this AI-generated lesson and decide whether to approve or reject it
              </DialogDescription>
            </DialogHeader>

            {selectedDraft && (
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Target Can-Do Statement
                    </h4>
                    <p className="text-sm">{selectedDraft.canDo?.statement}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">
                        {LEVEL_LABELS[selectedDraft.draft.actflLevel]}
                      </Badge>
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[selectedDraft.draft.category]}
                      </Badge>
                    </div>
                  </div>

                  <Tabs defaultValue="content" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="content">Lesson Content</TabsTrigger>
                      <TabsTrigger value="activities">Activities</TabsTrigger>
                      <TabsTrigger value="focus">Focus Areas</TabsTrigger>
                    </TabsList>

                    <TabsContent value="content" className="space-y-4 mt-4">
                      <div>
                        <h4 className="font-medium mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedDraft.draft.description}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Learning Objectives</h4>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {selectedDraft.draft.draftPayload.objectives?.map((obj, i) => (
                            <li key={i}>{obj}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Warm-Up</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedDraft.draft.draftPayload.warmUp}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Cultural Connection</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedDraft.draft.draftPayload.culturalConnection}
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="activities" className="space-y-4 mt-4">
                      <div>
                        <h4 className="font-medium mb-2">Model Input</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedDraft.draft.draftPayload.modelInput}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Model Output</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedDraft.draft.draftPayload.modelOutput}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Scaffolded Tasks</h4>
                        <div className="space-y-4">
                          {selectedDraft.draft.draftPayload.scaffoldedTasks?.map((task, i) => (
                            <div key={i} className="p-3 border rounded-lg space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Task {task.taskNumber}</Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Instruction:</p>
                                <p className="text-sm text-muted-foreground">{task.instruction}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Expected Response:</p>
                                <p className="text-sm text-muted-foreground">{task.expectedResponse}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Scaffolding Notes:</p>
                                <p className="text-sm text-muted-foreground italic">{task.scaffoldingNotes}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Assessment Check</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedDraft.draft.draftPayload.assessmentCheck}
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="focus" className="space-y-4 mt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="font-medium mb-2">Vocabulary Focus</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedDraft.draft.draftPayload.vocabularyFocus?.map((word, i) => (
                              <Badge key={i} variant="outline">
                                {word}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Grammar Focus</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedDraft.draft.draftPayload.grammarFocus?.map((point, i) => (
                              <Badge key={i} variant="secondary">
                                {point}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div>
                          <h4 className="font-medium mb-1">Duration</h4>
                          <p className="text-sm text-muted-foreground">
                            {selectedDraft.draft.draftPayload.suggestedDuration} minutes
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Lesson Type</h4>
                          <Badge>{selectedDraft.draft.draftPayload.lessonType}</Badge>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Review Notes (Optional)
                    </h4>
                    <Textarea
                      placeholder="Add notes about this draft (visible to curriculum builders)..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="resize-none"
                      rows={3}
                      data-testid="input-review-notes"
                    />
                  </div>
                </div>
              </ScrollArea>
            )}

            <DialogFooter className="flex-shrink-0 gap-2">
              {selectedDraft?.draft.status === "draft" && (
                <Button
                  variant="outline"
                  onClick={() => handleMarkPending(selectedDraft.draft.id)}
                  disabled={updateStatusMutation.isPending}
                  data-testid="button-mark-pending"
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 mr-2" />
                  )}
                  Mark for Review
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => selectedDraft && handleReject(selectedDraft.draft.id)}
                disabled={updateStatusMutation.isPending}
                data-testid="button-reject"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reject
              </Button>
              <Button
                onClick={() => selectedDraft && handleApprove(selectedDraft.draft.id)}
                disabled={updateStatusMutation.isPending}
                data-testid="button-approve"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export function LessonDraftsContent() {
  return <LessonDrafts />;
}
