import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { useUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit2, Save, X, Compass, BookOpen, Heart, Users, HelpCircle, Sparkles, Shield } from "lucide-react";

type NorthStarCategory = 'pedagogy' | 'honesty' | 'identity' | 'collaboration' | 'ambiguity';

interface NorthStarPrinciple {
  id: string;
  principle: string;
  category: NorthStarCategory;
  originalContext: string | null;
  founderSessionId: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
}

const CATEGORIES: { value: NorthStarCategory; label: string; icon: typeof BookOpen; description: string }[] = [
  { value: 'pedagogy', label: 'Pedagogy', icon: BookOpen, description: 'How to teach' },
  { value: 'honesty', label: 'Honesty', icon: Heart, description: 'Ethics and feedback' },
  { value: 'identity', label: 'Identity', icon: Sparkles, description: 'Who Daniela is' },
  { value: 'collaboration', label: 'Collaboration', icon: Users, description: 'How the team works' },
  { value: 'ambiguity', label: 'Ambiguity', icon: HelpCircle, description: 'Strategic uncertainty' },
];

const categoryColors: Record<NorthStarCategory, string> = {
  pedagogy: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  honesty: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  identity: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
  collaboration: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  ambiguity: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
};

export default function NorthStar() {
  const { toast } = useToast();
  const { user } = useUser();
  const isFounder = user?.role === 'founder';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NorthStarPrinciple>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPrinciple, setNewPrinciple] = useState({
    principle: '',
    category: 'pedagogy' as NorthStarCategory,
    originalContext: '',
    orderIndex: 1,
  });
  const [filterCategory, setFilterCategory] = useState<NorthStarCategory | 'all'>('all');

  const { data: principles, isLoading, error } = useQuery<NorthStarPrinciple[]>({
    queryKey: ['/api/north-star/principles'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NorthStarPrinciple> }) => {
      return apiRequest('PATCH', `/api/north-star/principles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/north-star/principles'] });
      setEditingId(null);
      setEditForm({});
      toast({ title: "Principle updated", description: "The North Star principle has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newPrinciple) => {
      return apiRequest('POST', '/api/north-star/principles', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/north-star/principles'] });
      setIsAddDialogOpen(false);
      setNewPrinciple({ principle: '', category: 'pedagogy', originalContext: '', orderIndex: 1 });
      toast({ title: "Principle created", description: "A new North Star principle has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Creation failed", description: error.message, variant: "destructive" });
    },
  });

  const startEditing = (principle: NorthStarPrinciple) => {
    setEditingId(principle.id);
    setEditForm({
      principle: principle.principle,
      category: principle.category,
      originalContext: principle.originalContext || '',
      orderIndex: principle.orderIndex,
      isActive: principle.isActive,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = (id: string) => {
    const data: Partial<NorthStarPrinciple> = {
      originalContext: editForm.originalContext,
      orderIndex: editForm.orderIndex,
      isActive: editForm.isActive,
    };
    
    // Founder can also edit constitutional fields
    if (isFounder) {
      data.principle = editForm.principle;
      data.category = editForm.category;
    }
    
    updateMutation.mutate({ id, data });
  };

  const toggleActive = (principle: NorthStarPrinciple) => {
    updateMutation.mutate({ id: principle.id, data: { isActive: !principle.isActive } });
  };

  const filteredPrinciples = principles?.filter(p => 
    filterCategory === 'all' || p.category === filterCategory
  ) || [];

  const categoryCounts = principles?.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  if (error) {
    return (
      <RoleGuard allowedRoles={['founder', 'admin']}>
        <div className="min-h-screen bg-background p-6">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Command Center
          </Link>
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load North Star principles. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={['founder', 'admin']}>
      <div className="min-h-screen bg-background p-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Command Center
        </Link>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Compass className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-north-star-title">North Star Principles</h1>
                <p className="text-sm text-muted-foreground">
                  Daniela's constitutional truths - her DNA that guides all teaching decisions
                </p>
              </div>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-principle">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Principle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Principle</DialogTitle>
                  <DialogDescription>
                    Create a new constitutional principle for Daniela
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-principle">Principle</Label>
                    <Textarea
                      id="new-principle"
                      placeholder="Enter the principle text..."
                      value={newPrinciple.principle}
                      onChange={(e) => setNewPrinciple({ ...newPrinciple, principle: e.target.value })}
                      className="min-h-[100px]"
                      data-testid="input-new-principle"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-category">Category</Label>
                      <Select
                        value={newPrinciple.category}
                        onValueChange={(v) => setNewPrinciple({ ...newPrinciple, category: v as NorthStarCategory })}
                      >
                        <SelectTrigger data-testid="select-new-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-order">Order Index</Label>
                      <Input
                        id="new-order"
                        type="number"
                        min={0}
                        value={newPrinciple.orderIndex}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setNewPrinciple({ ...newPrinciple, orderIndex: isNaN(val) ? 0 : val });
                        }}
                        data-testid="input-new-order"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-context">Original Context (optional)</Label>
                    <Textarea
                      id="new-context"
                      placeholder="What was the context when this principle was created?"
                      value={newPrinciple.originalContext}
                      onChange={(e) => setNewPrinciple({ ...newPrinciple, originalContext: e.target.value })}
                      data-testid="input-new-context"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => createMutation.mutate(newPrinciple)}
                    disabled={!newPrinciple.principle.trim() || createMutation.isPending}
                    data-testid="button-create-principle"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Principle"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterCategory('all')}
              data-testid="filter-all"
            >
              All ({principles?.length || 0})
            </Button>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const count = categoryCounts[cat.value] || 0;
              return (
                <Button
                  key={cat.value}
                  variant={filterCategory === cat.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory(cat.value)}
                  data-testid={`filter-${cat.value}`}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {cat.label} ({count})
                </Button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredPrinciples.map((principle) => {
                const isEditing = editingId === principle.id;
                const categoryInfo = CATEGORIES.find(c => c.value === principle.category);
                const CategoryIcon = categoryInfo?.icon || BookOpen;

                return (
                  <Card 
                    key={principle.id} 
                    className={!principle.isActive ? 'opacity-50' : ''}
                    data-testid={`card-principle-${principle.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="space-y-4">
                              {isFounder ? (
                                <>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 flex items-center gap-1">
                                      <Shield className="h-3 w-3" />
                                      Founder Override
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">You can edit constitutional text</span>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Principle Text</Label>
                                    <Textarea
                                      value={editForm.principle || ''}
                                      onChange={(e) => setEditForm({ ...editForm, principle: e.target.value })}
                                      className="min-h-[80px]"
                                      data-testid="input-edit-principle"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select
                                      value={editForm.category}
                                      onValueChange={(v) => setEditForm({ ...editForm, category: v as NorthStarCategory })}
                                    >
                                      <SelectTrigger data-testid="select-edit-category">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {CATEGORIES.map((cat) => (
                                          <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge 
                                      variant="outline" 
                                      className={`${categoryColors[principle.category]} flex items-center gap-1`}
                                    >
                                      <CategoryIcon className="h-3 w-3" />
                                      {categoryInfo?.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-muted-foreground text-xs">
                                      Principle text is immutable
                                    </Badge>
                                  </div>
                                  <p className="text-base font-medium leading-relaxed text-muted-foreground">
                                    {principle.principle}
                                  </p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Order Index</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={editForm.orderIndex ?? 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      setEditForm({ ...editForm, orderIndex: isNaN(val) ? 0 : val });
                                    }}
                                    data-testid="input-edit-order"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Active</Label>
                                  <div className="pt-2">
                                    <Switch
                                      checked={editForm.isActive}
                                      onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                                      data-testid="switch-edit-active"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Original Context</Label>
                                <Textarea
                                  value={editForm.originalContext || ''}
                                  onChange={(e) => setEditForm({ ...editForm, originalContext: e.target.value })}
                                  placeholder="Context when this principle was created..."
                                  data-testid="input-edit-context"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge 
                                  variant="outline" 
                                  className={`${categoryColors[principle.category]} flex items-center gap-1`}
                                >
                                  <CategoryIcon className="h-3 w-3" />
                                  {categoryInfo?.label}
                                </Badge>
                                <Badge variant="outline" className="text-muted-foreground">
                                  #{principle.orderIndex}
                                </Badge>
                                {!principle.isActive && (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </div>
                              <CardTitle className="text-base font-medium leading-relaxed">
                                {principle.principle}
                              </CardTitle>
                              {principle.originalContext && (
                                <CardDescription className="mt-2 text-sm">
                                  {principle.originalContext}
                                </CardDescription>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={cancelEditing}
                                data-testid="button-cancel-edit"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                onClick={() => saveEdit(principle.id)}
                                disabled={updateMutation.isPending}
                                data-testid="button-save-edit"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Switch
                                checked={principle.isActive}
                                onCheckedChange={() => toggleActive(principle)}
                                data-testid={`switch-active-${principle.id}`}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => startEditing(principle)}
                                data-testid={`button-edit-${principle.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}

              {filteredPrinciples.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {filterCategory === 'all' 
                        ? "No principles found. Add one to get started."
                        : `No ${filterCategory} principles found.`}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
