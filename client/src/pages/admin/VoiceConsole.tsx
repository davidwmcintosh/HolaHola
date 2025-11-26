import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Play, Pause, Plus, Edit2, Trash2, Volume2, User, Languages, Loader2 } from "lucide-react";

interface TutorVoice {
  id: string;
  language: string;
  gender: 'male' | 'female';
  provider: string;
  voiceId: string;
  voiceName: string;
  languageCode: string;
  speakingRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  gender: 'male' | 'female' | string;
  isPublic: boolean;
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

const SAMPLE_PHRASES: Record<string, { target: string; native: string }> = {
  english: { 
    target: "Hello! I'm your language tutor. Let's practice together!",
    native: "Hello! I'm your language tutor. Let's practice together!"
  },
  spanish: { 
    target: "¡Hola! Soy tu tutor de idiomas. ¡Vamos a practicar juntos!",
    native: "Hello, I am your Spanish tutor. Let's learn Spanish together!"
  },
  french: { 
    target: "Bonjour! Je suis votre tuteur de langues. Pratiquons ensemble!",
    native: "Hello, I am your French tutor. Let's learn French together!"
  },
  german: { 
    target: "Hallo! Ich bin dein Sprachlehrer. Lass uns zusammen üben!",
    native: "Hello, I am your German tutor. Let's learn German together!"
  },
  italian: { 
    target: "Ciao! Sono il tuo tutor di lingue. Esercitiamoci insieme!",
    native: "Hello, I am your Italian tutor. Let's learn Italian together!"
  },
  portuguese: { 
    target: "Olá! Sou seu tutor de idiomas. Vamos praticar juntos!",
    native: "Hello, I am your Portuguese tutor. Let's learn Portuguese together!"
  },
  japanese: { 
    target: "こんにちは！私はあなたの語学チューターです。一緒に練習しましょう！",
    native: "Hello, I am your Japanese tutor. Let's learn Japanese together!"
  },
  'mandarin chinese': { 
    target: "你好！我是你的语言导师。让我们一起练习吧！",
    native: "Hello, I am your Mandarin Chinese tutor. Let's learn Chinese together!"
  },
  korean: { 
    target: "안녕하세요! 저는 당신의 언어 튜터입니다. 함께 연습해봐요!",
    native: "Hello, I am your Korean tutor. Let's learn Korean together!"
  },
};

export default function VoiceConsole() {
  const { toast } = useToast();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [auditionPhase, setAuditionPhase] = useState<'idle' | 'target' | 'native'>('idle');
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
    speakingRate: 0.9,
    isActive: true,
  });

  // Fetch configured voices
  const { data: voices, isLoading } = useQuery<TutorVoice[]>({
    queryKey: ["/api/admin/tutor-voices"],
  });

  // Fetch available Cartesia voices based on selected language and gender
  const { data: cartesiaVoicesData, isLoading: isLoadingCartesiaVoices } = useQuery<{ voices: CartesiaVoice[]; total: number }>({
    queryKey: ["/api/admin/cartesia-voices", formData.language, formData.gender],
    enabled: isAddDialogOpen && !!formData.language,
  });

  const cartesiaVoices = cartesiaVoicesData?.voices || [];

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
      speakingRate: 0.9,
      isActive: true,
    });
  };

  // Bilingual audition: plays voice in target language, then native (English)
  const handleAudition = async (voiceId: string, voiceName: string, language: string, languageCode: string, speakingRate: number = 0.9) => {
    if (playingVoiceId === voiceId && audioElement) {
      audioElement.pause();
      setPlayingVoiceId(null);
      setAuditionPhase('idle');
      setAudioElement(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    setPlayingVoiceId(voiceId);
    setAuditionPhase('target');
    
    const phrases = SAMPLE_PHRASES[language] || SAMPLE_PHRASES.english;
    
    try {
      // First play in target language
      const targetAudio = await playVoiceSample(voiceId, phrases.target, languageCode, speakingRate);
      
      targetAudio.onended = async () => {
        // If language is not English, play English sample too
        if (language !== 'english') {
          setAuditionPhase('native');
          try {
            const nativeAudio = await playVoiceSample(voiceId, phrases.native, 'en', speakingRate);
            nativeAudio.onended = () => {
              setPlayingVoiceId(null);
              setAuditionPhase('idle');
              setAudioElement(null);
            };
            nativeAudio.onerror = () => {
              setPlayingVoiceId(null);
              setAuditionPhase('idle');
              setAudioElement(null);
            };
            setAudioElement(nativeAudio);
            nativeAudio.play();
          } catch {
            setPlayingVoiceId(null);
            setAuditionPhase('idle');
          }
        } else {
          setPlayingVoiceId(null);
          setAuditionPhase('idle');
          setAudioElement(null);
        }
      };
      
      targetAudio.onerror = () => {
        setPlayingVoiceId(null);
        setAuditionPhase('idle');
        setAudioElement(null);
        toast({ title: "Error", description: "Failed to play audio", variant: "destructive" });
      };

      setAudioElement(targetAudio);
      targetAudio.play();
    } catch (error) {
      setPlayingVoiceId(null);
      setAuditionPhase('idle');
      toast({ title: "Error", description: "Failed to preview voice", variant: "destructive" });
    }
  };

  const playVoiceSample = async (voiceId: string, text: string, languageCode: string, speakingRate: number = 0.9): Promise<HTMLAudioElement> => {
    const response = await fetch("/api/admin/tutor-voices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceId,
        text,
        language: languageCode,
        speakingRate,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to preview voice");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    const originalOnEnded = audio.onended;
    audio.onended = (e) => {
      URL.revokeObjectURL(audioUrl);
      if (originalOnEnded) {
        (originalOnEnded as (ev: Event) => void)(e);
      }
    };
    
    return audio;
  };

  const handlePreview = async (voice: TutorVoice) => {
    await handleAudition(voice.voiceId, voice.voiceName, voice.language, voice.languageCode, voice.speakingRate);
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
      speakingRate: voice.speakingRate || 0.9,
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
      voiceId: '', // Reset voice selection when language changes
      voiceName: '',
    }));
  };

  const handleGenderChange = (value: 'male' | 'female') => {
    setFormData(prev => ({
      ...prev,
      gender: value,
      voiceId: '', // Reset voice selection when gender changes
      voiceName: '',
    }));
  };

  const handleVoiceSelect = (voiceId: string) => {
    const selectedVoice = cartesiaVoices.find(v => v.id === voiceId);
    if (selectedVoice) {
      setFormData(prev => ({
        ...prev,
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
      }));
    }
  };

  const handleSubmit = () => {
    if (!formData.language || !formData.voiceId || !formData.voiceName) {
      toast({ title: "Error", description: "Please select a language and voice", variant: "destructive" });
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
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingVoice ? "Edit Voice" : "Add Voice Configuration"}</DialogTitle>
                    <DialogDescription>
                      Select a language, gender, and Cartesia Sonic-3 voice for the tutor.
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
                        <Select value={formData.gender} onValueChange={(v) => handleGenderChange(v as 'male' | 'female')}>
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
                    
                    {/* Voice Selection Dropdown */}
                    {formData.language && (
                      <div className="space-y-2">
                        <Label>Voice</Label>
                        {isLoadingCartesiaVoices ? (
                          <div className="flex items-center gap-2 p-3 border rounded-md">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Loading available voices...</span>
                          </div>
                        ) : cartesiaVoices.length === 0 ? (
                          <div className="p-3 border rounded-md border-dashed">
                            <p className="text-sm text-muted-foreground">
                              No {formData.gender} voices found for {SUPPORTED_LANGUAGES.find(l => l.value === formData.language)?.label}.
                            </p>
                          </div>
                        ) : (
                          <Select value={formData.voiceId} onValueChange={handleVoiceSelect}>
                            <SelectTrigger data-testid="select-voice">
                              <SelectValue placeholder="Select a voice" />
                            </SelectTrigger>
                            <SelectContent>
                              {cartesiaVoices.map(voice => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  <div className="flex flex-col">
                                    <span>{voice.name}</span>
                                    {voice.description && (
                                      <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                        {voice.description}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {/* Speed Control */}
                    {formData.voiceId && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Speaking Speed</Label>
                          <span className="text-sm font-medium">
                            {formData.speakingRate === 0.7 ? 'Slow' : 
                             formData.speakingRate === 0.9 ? 'Natural' : 
                             formData.speakingRate === 1.0 ? 'Normal' :
                             formData.speakingRate >= 1.2 ? 'Fast' : 
                             formData.speakingRate.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={[formData.speakingRate]}
                          onValueChange={([value]) => setFormData(prev => ({ ...prev, speakingRate: value }))}
                          min={0.7}
                          max={1.3}
                          step={0.1}
                          className="w-full"
                          data-testid="slider-speed"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Slow (0.7)</span>
                          <span>Natural (0.9)</span>
                          <span>Fast (1.3)</span>
                        </div>
                      </div>
                    )}

                    {/* Audition Button */}
                    {formData.voiceId && (
                      <div className="space-y-2">
                        <Label>Audition</Label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleAudition(
                              formData.voiceId,
                              formData.voiceName,
                              formData.language,
                              formData.languageCode,
                              formData.speakingRate
                            )}
                            data-testid="button-audition"
                            className="flex-1"
                          >
                            {playingVoiceId === formData.voiceId ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                {auditionPhase === 'target' ? 'Playing Target Language...' : 'Playing English...'}
                              </>
                            ) : (
                              <>
                                <Languages className="h-4 w-4 mr-2" />
                                Audition Voice
                              </>
                            )}
                          </Button>
                          {playingVoiceId === formData.voiceId && (
                            <Badge variant="secondary">
                              {auditionPhase === 'target' 
                                ? SUPPORTED_LANGUAGES.find(l => l.value === formData.language)?.label 
                                : 'English'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Plays a sample in {SUPPORTED_LANGUAGES.find(l => l.value === formData.language)?.label || 'the target language'}{formData.language !== 'english' && ', then in English'} at selected speed
                        </p>
                      </div>
                    )}

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
                    <Button onClick={handleSubmit} disabled={upsertMutation.isPending || !formData.voiceId} data-testid="button-save-voice">
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
                  Click "Add Voice" to configure Cartesia Sonic-3 voices for each language.
                </p>
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
                                <Badge variant="outline" className="text-xs">
                                  {voice.speakingRate === 0.7 ? 'Slow' : 
                                   voice.speakingRate === 0.9 ? 'Natural' : 
                                   voice.speakingRate === 1.0 ? 'Normal' :
                                   voice.speakingRate >= 1.2 ? 'Fast' : 
                                   `${voice.speakingRate}x`}
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
                                title={`Audition in ${lang.label}${lang.value !== 'english' ? ' + English' : ''}`}
                              >
                                {playingVoiceId === voice.voiceId ? (
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
