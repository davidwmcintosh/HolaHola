import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
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
import { Play, Pause, Plus, Edit2, Trash2, Volume2, User, Languages, Loader2, Sparkles, Heart, Headphones } from "lucide-react";

// Personality preset types matching backend
type PersonalityType = 'warm' | 'calm' | 'energetic' | 'professional';

interface TTSMetadata {
  personalities: Record<PersonalityType, {
    name: string;
    description: string;
    baseline: string;
    emotions: string[];
  }>;
  expressivenessLevels: Record<number, {
    label: string;
    description: string;
  }>;
  emotionsMap: Record<PersonalityType, Record<number, string[]>>;
  getDefaultEmotion: Record<PersonalityType, string>;
}

interface TutorVoice {
  id: string;
  language: string;
  gender: 'male' | 'female';
  provider: string;
  voiceId: string;
  voiceName: string;
  languageCode: string;
  speakingRate: number;
  personality: PersonalityType;
  expressiveness: number;
  emotion: string;
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
    target: "Hello! I'm excited to help you learn English. What would you like to practice today?",
    native: "Hello! I'm excited to help you learn English. What would you like to practice today?"
  },
  spanish: { 
    target: "¡Hola! Estoy emocionado de ayudarte a aprender español. ¿Qué te gustaría practicar hoy?",
    native: "Hello! I'm excited to help you learn Spanish. What would you like to practice today?"
  },
  french: { 
    target: "Bonjour! Je suis ravi de vous aider à apprendre le français. Que souhaitez-vous pratiquer aujourd'hui?",
    native: "Hello! I'm excited to help you learn French. What would you like to practice today?"
  },
  german: { 
    target: "Hallo! Ich freue mich, dir beim Deutsch lernen zu helfen. Was möchtest du heute üben?",
    native: "Hello! I'm excited to help you learn German. What would you like to practice today?"
  },
  italian: { 
    target: "Ciao! Sono entusiasta di aiutarti a imparare l'italiano. Cosa vorresti praticare oggi?",
    native: "Hello! I'm excited to help you learn Italian. What would you like to practice today?"
  },
  portuguese: { 
    target: "Olá! Estou animado para ajudá-lo a aprender português. O que você gostaria de praticar hoje?",
    native: "Hello! I'm excited to help you learn Portuguese. What would you like to practice today?"
  },
  japanese: { 
    target: "こんにちは！日本語を学ぶお手伝いができて嬉しいです。今日は何を練習したいですか？",
    native: "Hello! I'm excited to help you learn Japanese. What would you like to practice today?"
  },
  'mandarin chinese': { 
    target: "你好！很高兴能帮助你学习中文。你今天想练习什么？",
    native: "Hello! I'm excited to help you learn Mandarin Chinese. What would you like to practice today?"
  },
  korean: { 
    target: "안녕하세요! 한국어를 배우는 것을 도와드리게 되어 기쁩니다. 오늘 무엇을 연습하고 싶으세요?",
    native: "Hello! I'm excited to help you learn Korean. What would you like to practice today?"
  },
};

export default function VoiceConsole() {
  const { toast } = useToast();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [auditionPhase, setAuditionPhase] = useState<'idle' | 'target' | 'native'>('idle');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [editingVoice, setEditingVoice] = useState<TutorVoice | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Emotion audition state
  const [auditionPersonality, setAuditionPersonality] = useState<PersonalityType>('warm');
  const [auditionExpressiveness, setAuditionExpressiveness] = useState(3);
  const [auditionEmotion, setAuditionEmotion] = useState('friendly');
  
  const [formData, setFormData] = useState({
    language: '',
    gender: 'female' as 'male' | 'female',
    provider: 'cartesia',
    voiceId: '',
    voiceName: '',
    languageCode: '',
    speakingRate: 0.9,
    personality: 'warm' as PersonalityType,
    expressiveness: 3,
    emotion: 'friendly',
    isActive: true,
  });

  // Fetch configured voices
  const { data: voices, isLoading } = useQuery<TutorVoice[]>({
    queryKey: ["/api/admin/tutor-voices"],
  });
  
  // Fetch TTS emotion metadata
  const { data: ttsMetadata } = useQuery<TTSMetadata>({
    queryKey: ["/api/admin/tts-meta"],
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
      personality: 'warm',
      expressiveness: 3,
      emotion: 'friendly',
      isActive: true,
    });
    // Reset emotion audition to defaults (synced with form)
    setAuditionPersonality('warm');
    setAuditionExpressiveness(3);
    setAuditionEmotion('friendly');
  };
  
  // Get available emotions based on personality and expressiveness
  const availableEmotions = ttsMetadata?.emotionsMap?.[auditionPersonality]?.[auditionExpressiveness] || ['friendly'];
  
  // Update emotion when personality/expressiveness changes and sync to formData
  useEffect(() => {
    if (ttsMetadata) {
      const defaultEmotion = ttsMetadata.getDefaultEmotion[auditionPersonality];
      const allowed = ttsMetadata.emotionsMap[auditionPersonality]?.[auditionExpressiveness] || [];
      // If current emotion is not in allowed list, reset to default
      if (!allowed.includes(auditionEmotion)) {
        const newEmotion = defaultEmotion || 'friendly';
        setAuditionEmotion(newEmotion);
        // Also sync to formData
        setFormData(prev => ({ ...prev, emotion: newEmotion }));
      }
    }
  }, [auditionPersonality, auditionExpressiveness, ttsMetadata]);
  
  // Sync audition controls to formData when they change (so changes get saved)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      personality: auditionPersonality,
      expressiveness: auditionExpressiveness,
      emotion: auditionEmotion,
    }));
  }, [auditionPersonality, auditionExpressiveness, auditionEmotion]);

  // Bilingual audition: plays voice in target language, then native (English)
  // Uses the selected auditionEmotion for previewing different emotional tones
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
      // First play in target language with selected emotion
      const targetAudio = await playVoiceSample(voiceId, phrases.target, languageCode, speakingRate, auditionEmotion);
      
      targetAudio.onended = async () => {
        // If language is not English, play English sample too
        if (language !== 'english') {
          setAuditionPhase('native');
          try {
            const nativeAudio = await playVoiceSample(voiceId, phrases.native, 'en', speakingRate, auditionEmotion);
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

  const playVoiceSample = async (
    voiceId: string, 
    text: string, 
    languageCode: string, 
    speakingRate: number = 0.9,
    emotion?: string
  ): Promise<HTMLAudioElement> => {
    const response = await fetch("/api/admin/tutor-voices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceId,
        text,
        language: languageCode,
        speakingRate,
        emotion: emotion || auditionEmotion,
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
    // Load saved emotion settings into form
    const savedPersonality = (voice.personality || 'warm') as PersonalityType;
    const savedExpressiveness = voice.expressiveness || 3;
    const savedEmotion = voice.emotion || 'friendly';
    
    setFormData({
      language: voice.language,
      gender: voice.gender,
      provider: voice.provider,
      voiceId: voice.voiceId,
      voiceName: voice.voiceName,
      languageCode: voice.languageCode,
      speakingRate: voice.speakingRate || 0.9,
      personality: savedPersonality,
      expressiveness: savedExpressiveness,
      emotion: savedEmotion,
      isActive: voice.isActive,
    });
    // Sync audition controls with saved values so preview uses saved emotion
    setAuditionPersonality(savedPersonality);
    setAuditionExpressiveness(savedExpressiveness);
    setAuditionEmotion(savedEmotion);
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
    <RoleGuard allowedRoles={['admin']}>
      <div className="min-h-screen bg-background p-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Command Center
        </Link>
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

                    {/* Emotion Controls for Audition */}
                    {formData.voiceId && ttsMetadata && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-medium">Emotion Audition</Label>
                        </div>
                        
                        {/* Personality Selector */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Personality</Label>
                            <Select 
                              value={auditionPersonality} 
                              onValueChange={(v) => setAuditionPersonality(v as PersonalityType)}
                            >
                              <SelectTrigger data-testid="select-personality">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ttsMetadata.personalities).map(([key, preset]) => (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex flex-col">
                                      <span>{preset.name}</span>
                                      <span className="text-xs text-muted-foreground">{preset.description}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Emotion Selector */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Emotion</Label>
                            <Select value={auditionEmotion} onValueChange={setAuditionEmotion}>
                              <SelectTrigger data-testid="select-emotion">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableEmotions.map(emotion => (
                                  <SelectItem key={emotion} value={emotion}>
                                    <span className="capitalize">{emotion}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {/* Expressiveness Slider */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Expressiveness</Label>
                            <span className="text-sm font-medium">
                              {ttsMetadata.expressivenessLevels[auditionExpressiveness]?.label || `Level ${auditionExpressiveness}`}
                            </span>
                          </div>
                          <Slider
                            value={[auditionExpressiveness]}
                            onValueChange={([value]) => setAuditionExpressiveness(value)}
                            min={1}
                            max={5}
                            step={1}
                            className="w-full"
                            data-testid="slider-expressiveness"
                          />
                          <p className="text-xs text-muted-foreground">
                            {ttsMetadata.expressivenessLevels[auditionExpressiveness]?.description || ''}
                          </p>
                        </div>
                        
                        <p className="text-xs text-muted-foreground border-t pt-2">
                          Preview how different emotions sound with this voice
                        </p>
                      </div>
                    )}

                    {/* Audition Button */}
                    {formData.voiceId && (
                      <div className="space-y-2">
                        <Label>Audition</Label>
                        <div className="flex items-center gap-3 flex-wrap">
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Heart className="h-3 w-3" />
                          <span>Using <strong className="capitalize">{auditionEmotion}</strong> emotion ({auditionPersonality} personality)</span>
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
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {SUPPORTED_LANGUAGES.map(lang => {
                const voicesForLang = groupedVoices?.[lang.value];
                const maleVoice = voicesForLang?.male;
                const femaleVoice = voicesForLang?.female;
                const configuredCount = (femaleVoice ? 1 : 0) + (maleVoice ? 1 : 0);
                
                return (
                  <div key={lang.value} data-testid={`list-voice-${lang.value}`}>
                    {/* Language Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Languages className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{lang.label}</span>
                        <Badge variant="outline" className="text-xs">{lang.code}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {configuredCount}/2 voices
                      </span>
                    </div>
                    
                    {/* Voice Rows */}
                    <div className="divide-y">
                      {(['female', 'male'] as const).map(gender => {
                        const voice = gender === 'female' ? femaleVoice : maleVoice;
                        
                        if (!voice) {
                          return (
                            <div key={gender} className="flex items-center justify-between px-4 py-2 pl-12 bg-background">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span className="text-sm capitalize">{gender}</span>
                                <span className="text-xs">— Not configured</span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  handleLanguageChange(lang.value);
                                  setFormData(prev => ({ ...prev, gender }));
                                  setIsAddDialogOpen(true);
                                }}
                                data-testid={`button-add-${lang.value}-${gender}`}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>
                          );
                        }
                        
                        return (
                          <div 
                            key={voice.id} 
                            className="flex items-center justify-between px-4 py-2 pl-12 bg-background"
                            data-testid={`voice-item-${voice.id}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm capitalize w-14 flex-shrink-0">{gender}</span>
                              <span className="font-medium text-sm truncate">{voice.voiceName}</span>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {voice.speakingRate === 0.7 ? 'Slow' : 
                                 voice.speakingRate === 0.9 ? 'Natural' : 
                                 voice.speakingRate === 1.0 ? 'Normal' :
                                 voice.speakingRate >= 1.2 ? 'Fast' : 
                                 `${voice.speakingRate}x`}
                              </Badge>
                              {!voice.isActive && (
                                <Badge variant="secondary" className="text-xs flex-shrink-0">Inactive</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Support Agent Voice Configuration */}
          <SupportAgentVoiceCard />
        </div>
      </div>
    </RoleGuard>
  );
}

/**
 * Support Agent Voice Configuration Card
 * Uses Google Cloud TTS Chirp 3 HD for cost-effective, professional support voice
 * Supports male and female voice options for each language
 */
function SupportAgentVoiceCard() {
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('female');
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Fetch support voice metadata with male/female options
  const { data: supportVoiceMeta, isLoading } = useQuery<{
    provider: string;
    model: string;
    voices: Record<string, { 
      languageCode: string;
      female: { name: string; displayName: string };
      male: { name: string; displayName: string };
    }>;
    audioConfig: {
      speakingRateRange: { min: number; max: number; default: number };
      pitchRange: { min: number; max: number; default: number };
    };
    description: string;
  }>({
    queryKey: ["/api/admin/support-voice-meta"],
  });
  
  const handleAudition = async () => {
    if (isPlaying && audioElement) {
      audioElement.pause();
      setIsPlaying(false);
      return;
    }
    
    setIsPlaying(true);
    
    try {
      const response = await fetch('/api/admin/support-voice-audition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          language: selectedLanguage,
          gender: selectedGender,
          speakingRate,
          pitch,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      setAudioElement(audio);
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        toast({ title: "Error", description: "Failed to play audio", variant: "destructive" });
      };
      
      await audio.play();
    } catch (error: any) {
      console.error('[VoiceConsole] Support voice audition error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsPlaying(false);
    }
  };
  
  return (
    <Card className="mt-6" data-testid="card-support-agent-voice">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Support Agent Voice
            </CardTitle>
            <CardDescription>
              {supportVoiceMeta?.description || 'Configure the Support Agent TTS voice settings'}
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30">
            Google Cloud Chirp 3 HD
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger data-testid="select-support-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportVoiceMeta?.voices && Object.entries(supportVoiceMeta.voices).map(([lang, config]) => (
                      <SelectItem key={lang} value={lang}>
                        <div className="flex items-center gap-2">
                          <span className="capitalize">{lang}</span>
                          <span className="text-xs text-muted-foreground">({config.languageCode})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={selectedGender} onValueChange={(v) => setSelectedGender(v as 'male' | 'female')}>
                  <SelectTrigger data-testid="select-support-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Female</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="male">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Male</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Voice Name</Label>
                <div className="px-3 py-2 border rounded-md bg-muted/30 text-sm">
                  {supportVoiceMeta?.voices?.[selectedLanguage]?.[selectedGender]?.displayName || 'N/A'}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Speaking Rate</Label>
                  <span className="text-sm text-muted-foreground">{speakingRate.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[speakingRate]}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  onValueChange={([v]) => setSpeakingRate(v)}
                  data-testid="slider-support-speaking-rate"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Pitch</Label>
                  <span className="text-sm text-muted-foreground">{pitch > 0 ? '+' : ''}{pitch.toFixed(0)}</span>
                </div>
                <Slider
                  value={[pitch]}
                  min={-10}
                  max={10}
                  step={1}
                  onValueChange={([v]) => setPitch(v)}
                  data-testid="slider-support-pitch"
                />
              </div>
            </div>
            
            <div className="flex justify-center pt-2">
              <Button
                onClick={handleAudition}
                variant={isPlaying ? "secondary" : "default"}
                className="w-full max-w-xs"
                data-testid="button-audition-support"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Audition Support Voice
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center pt-2">
              The Support Agent handles technical issues, billing questions, and offline exercises.
              It uses Google Cloud TTS for cost-effective voice responses.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
