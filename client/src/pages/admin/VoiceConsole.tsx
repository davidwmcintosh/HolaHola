import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Play, Pause, Plus, Edit2, Trash2, Database, Volume2, User } from "lucide-react";

interface TutorVoice {
  id: string;
  language: string;
  gender: 'male' | 'female';
  provider: string;
  voiceId: string;
  voiceName: string;
  languageCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const SUPPORTED_LANGUAGES = [
  { value: 'english', label: 'English', code: 'en' },
  { value: 'spanish', label: 'Spanish', code: 'es' },
  { value: 'french', label: 'French', code: 'fr' },
  { value: 'german', label: 'German', code: 'de' },
  { value: 'italian', label: 'Italian', code: 'it' },
  { value: 'portuguese', label: 'Portuguese', code: 'pt' },
  { value: 'japanese', label: 'Japanese', code: 'ja' },
  { value: 'mandarin chinese', label: 'Mandarin Chinese', code: 'zh' },
  { value: 'korean', label: 'Korean', code: 'ko' },
];

const SAMPLE_PHRASES: Record<string, string> = {
  english: "Hello! I'm your language tutor. Let's practice together!",
  spanish: "¡Hola! Soy tu tutor de idiomas. ¡Vamos a practicar juntos!",
  french: "Bonjour! Je suis votre tuteur de langues. Pratiquons ensemble!",
  german: "Hallo! Ich bin dein Sprachlehrer. Lass uns zusammen üben!",
  italian: "Ciao! Sono il tuo tutor di lingue. Esercitiamoci insieme!",
  portuguese: "Olá! Sou seu tutor de idiomas. Vamos praticar juntos!",
  japanese: "こんにちは！私はあなたの語学チューターです。一緒に練習しましょう！",
  'mandarin chinese': "你好！我是你的语言导师。让我们一起练习吧！",
  korean: "안녕하세요! 저는 당신의 언어 튜터입니다. 함께 연습해봐요!",
};

export default function VoiceConsole() {
  const { toast } = useToast();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [editingVoice, setEditingVoice] = useState<TutorVoice | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    language: '',
    gender: 'female' as 'male' | 'female',
    provider: 'cartesia',
    voiceId: '',
    voiceName: '',
    languageCode: '',
    isActive: true,
  });

  const { data: voices, isLoading } = useQuery<TutorVoice[]>({
    queryKey: ["/api/admin/tutor-voices"],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/tutor-voices/seed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      toast({ title: "Success", description: "Default voices seeded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/tutor-voices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      toast({ title: "Success", description: "Voice configuration saved" });
      setIsAddDialogOpen(false);
      setEditingVoice(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/tutor-voices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      toast({ title: "Success", description: "Voice deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      language: '',
      gender: 'female',
      provider: 'cartesia',
      voiceId: '',
      voiceName: '',
      languageCode: '',
      isActive: true,
    });
  };

  const handlePreview = async (voice: TutorVoice) => {
    if (playingVoiceId === voice.id && audioElement) {
      audioElement.pause();
      setPlayingVoiceId(null);
      setAudioElement(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    setPlayingVoiceId(voice.id);
    
    try {
      const sampleText = SAMPLE_PHRASES[voice.language] || SAMPLE_PHRASES.english;
      
      const response = await fetch("/api/admin/tutor-voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: voice.voiceId,
          text: sampleText,
          language: voice.languageCode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to preview voice");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setPlayingVoiceId(null);
        setAudioElement(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setPlayingVoiceId(null);
        setAudioElement(null);
        toast({ title: "Error", description: "Failed to play audio", variant: "destructive" });
      };

      setAudioElement(audio);
      audio.play();
    } catch (error) {
      setPlayingVoiceId(null);
      toast({ title: "Error", description: "Failed to preview voice", variant: "destructive" });
    }
  };

  const handleEdit = (voice: TutorVoice) => {
    setEditingVoice(voice);
    setFormData({
      language: voice.language,
      gender: voice.gender,
      provider: voice.provider,
      voiceId: voice.voiceId,
      voiceName: voice.voiceName,
      languageCode: voice.languageCode,
      isActive: voice.isActive,
    });
    setIsAddDialogOpen(true);
  };

  const handleLanguageChange = (value: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === value);
    setFormData(prev => ({
      ...prev,
      language: value,
      languageCode: lang?.code || '',
    }));
  };

  const handleSubmit = () => {
    if (!formData.language || !formData.voiceId || !formData.voiceName) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    upsertMutation.mutate(formData);
  };

  const groupedVoices = voices?.reduce((acc, voice) => {
    if (!acc[voice.language]) {
      acc[voice.language] = { male: null, female: null };
    }
    acc[voice.language][voice.gender] = voice;
    return acc;
  }, {} as Record<string, { male: TutorVoice | null; female: TutorVoice | null }>);

  return (
    <RoleGuard allowedRoles={['developer', 'admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-page-title">Voice Console</h1>
              <p className="text-muted-foreground mt-2">
                Configure tutor voices for each language and gender
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                data-testid="button-seed-voices"
              >
                <Database className="h-4 w-4 mr-2" />
                {seedMutation.isPending ? "Seeding..." : "Seed Defaults"}
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) {
                  setEditingVoice(null);
                  resetForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-voice">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Voice
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingVoice ? "Edit Voice" : "Add Voice Configuration"}</DialogTitle>
                    <DialogDescription>
                      Configure a tutor voice for a specific language and gender.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Language</Label>
                        <Select value={formData.language} onValueChange={handleLanguageChange}>
                          <SelectTrigger data-testid="select-language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORTED_LANGUAGES.map(lang => (
                              <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Gender</Label>
                        <Select value={formData.gender} onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v as 'male' | 'female' }))}>
                          <SelectTrigger data-testid="select-gender">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Voice Name</Label>
                      <Input 
                        value={formData.voiceName} 
                        onChange={(e) => setFormData(prev => ({ ...prev, voiceName: e.target.value }))}
                        placeholder="e.g., Teacher Lady"
                        data-testid="input-voice-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Voice ID (Cartesia)</Label>
                      <Input 
                        value={formData.voiceId} 
                        onChange={(e) => setFormData(prev => ({ ...prev, voiceId: e.target.value }))}
                        placeholder="e.g., 573e3144-a684-4e72-ac2b-9b2063a50b53"
                        data-testid="input-voice-id"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                        data-testid="switch-active"
                      />
                      <Label>Active</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={upsertMutation.isPending} data-testid="button-save-voice">
                      {upsertMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : !voices || voices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Volume2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Voices Configured</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Seed Defaults" to populate with Cartesia Sonic-3 voices for all languages.
                </p>
                <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                  <Database className="h-4 w-4 mr-2" />
                  Seed Default Voices
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {SUPPORTED_LANGUAGES.map(lang => {
                const voicesForLang = groupedVoices?.[lang.value];
                const maleVoice = voicesForLang?.male;
                const femaleVoice = voicesForLang?.female;
                
                return (
                  <Card key={lang.value} data-testid={`card-voice-${lang.value}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center justify-between gap-2">
                        <span>{lang.label}</span>
                        <Badge variant="outline">{lang.code}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {voicesForLang ? `${femaleVoice ? 1 : 0} + ${maleVoice ? 1 : 0} voices configured` : "No voices configured"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[femaleVoice, maleVoice].map((voice, idx) => {
                        const gender = idx === 0 ? 'female' : 'male';
                        if (!voice) {
                          return (
                            <div key={gender} className="p-3 border rounded-md border-dashed flex items-center justify-between">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span className="text-sm capitalize">{gender} voice</span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  handleLanguageChange(lang.value);
                                  setFormData(prev => ({ ...prev, gender }));
                                  setIsAddDialogOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        }
                        
                        return (
                          <div 
                            key={voice.id} 
                            className="p-3 border rounded-md flex items-center justify-between gap-2"
                            data-testid={`voice-item-${voice.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{voice.voiceName}</span>
                                <Badge variant={voice.isActive ? "default" : "secondary"} className="text-xs">
                                  {voice.gender}
                                </Badge>
                                {!voice.isActive && (
                                  <Badge variant="outline" className="text-xs">Inactive</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {voice.voiceId.slice(0, 20)}...
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => handlePreview(voice)}
                                data-testid={`button-preview-${voice.id}`}
                              >
                                {playingVoiceId === voice.id ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => handleEdit(voice)}
                                data-testid={`button-edit-${voice.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Delete this voice configuration?")) {
                                    deleteMutation.mutate(voice.id);
                                  }
                                }}
                                data-testid={`button-delete-${voice.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </AdminLayout>
    </RoleGuard>
  );
}
